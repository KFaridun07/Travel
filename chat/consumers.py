import asyncio
import time

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken
from .presence import add_connection, remove_connection
from .serializers import MAX_TEXT_LENGTH
from .services import conversations_of, create_message, unread_total, user_group

AUTH_TIMEOUT = 10
# больше 30 действий за 10 секунд от одной вкладки не принимаем
EVENT_LIMIT = 30
EVENT_WINDOW = 10
MAX_FRAME_LENGTH = 20000

CLOSE_UNAUTHORIZED = 4001
CLOSE_FORBIDDEN = 4003


class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = None
        self.event_times = []
        self.expiry_task = None
        await self.accept()
        # токен приходит первым сообщением: в адресе он попал бы в журналы сервера
        self.auth_task = asyncio.create_task(self.close_later(AUTH_TIMEOUT))

    async def close_later(self, seconds):
        await asyncio.sleep(seconds)
        await self.close(code=CLOSE_UNAUTHORIZED)

    async def disconnect(self, code):
        self.auth_task.cancel()
        if self.expiry_task:
            self.expiry_task.cancel()
        if self.user is None:
            return
        await self.channel_layer.group_discard(user_group(self.user.id), self.channel_name)
        if remove_connection(self.user.id):
            await self.send_presence(False)

    async def receive(self, text_data=None, bytes_data=None, **kwargs):
        # испорченные данные не должны ронять соединение
        if text_data is None or len(text_data) > MAX_FRAME_LENGTH:
            await self.send_error('Неверные данные')
            return
        try:
            await super().receive(text_data=text_data, **kwargs)
        except ValueError:
            await self.send_error('Неверные данные')

    async def receive_json(self, content, **kwargs):
        if not isinstance(content, dict):
            await self.send_error('Неверные данные')
            return

        if self.user is None:
            await self.authenticate(content)
            return

        if self.too_many_events():
            await self.send_error('Слишком много сообщений, подождите немного')
            return

        event_type = content.get('type')
        if event_type == 'message':
            await self.handle_message(content)
        elif event_type == 'typing':
            await self.handle_typing(content)
        else:
            await self.send_error('Неизвестное действие')

    def too_many_events(self):
        now = time.monotonic()
        self.event_times = [moment for moment in self.event_times if now - moment < EVENT_WINDOW]
        if len(self.event_times) >= EVENT_LIMIT:
            return True
        self.event_times.append(now)
        return False

    async def send_error(self, detail):
        await self.send_json({'type': 'error', 'detail': detail})

    # ---------- Вход ----------

    async def authenticate(self, content):
        token = content.get('token') if content.get('type') == 'auth' else None
        if not isinstance(token, str):
            await self.close(code=CLOSE_UNAUTHORIZED)
            return
        try:
            access = AccessToken(token)
        except TokenError:
            await self.close(code=CLOSE_UNAUTHORIZED)
            return

        user = await self.get_user(access['user_id'])
        if user is None:
            await self.close(code=CLOSE_UNAUTHORIZED)
            return
        # переписка есть только между туристом и гидом
        if user.role not in ('tourist', 'guide'):
            await self.close(code=CLOSE_FORBIDDEN)
            return

        self.auth_task.cancel()
        self.user = user
        # когда токен истечёт, браузер получит код 4001, обновит токен и подключится снова
        self.expiry_task = asyncio.create_task(self.close_later(max(access['exp'] - time.time(), 0)))
        await self.channel_layer.group_add(user_group(user.id), self.channel_name)
        if add_connection(user.id):
            await self.send_presence(True)
        await self.send_json({'type': 'ready', 'unread': await database_sync_to_async(unread_total)(user)})

    @database_sync_to_async
    def get_user(self, user_id):
        return get_user_model().objects.filter(id=user_id, is_active=True).first()

    # ---------- Действия ----------

    async def handle_message(self, content):
        text = content.get('text')
        if not isinstance(text, str) or not text.strip() or len(text) > MAX_TEXT_LENGTH:
            await self.send_error('Сообщение пустое или слишком длинное')
            return
        conversation = await self.get_conversation(content.get('conversation'))
        if conversation is None:
            await self.send_error('Диалог не найден')
            return
        await database_sync_to_async(create_message)(conversation, self.user, text=text.strip())

    async def handle_typing(self, content):
        conversation = await self.get_conversation(content.get('conversation'))
        if conversation is None:
            return
        other_id = conversation.guide_id if conversation.tourist_id == self.user.id else conversation.tourist_id
        await self.channel_layer.group_send(user_group(other_id), {
            'type': 'chat.event',
            'data': {'type': 'typing', 'conversation': conversation.id, 'user': self.user.id},
        })

    @database_sync_to_async
    def get_conversation(self, conversation_id):
        # чужой диалог для этого пользователя выглядит как несуществующий
        if not isinstance(conversation_id, int):
            return None
        return conversations_of(self.user).filter(id=conversation_id).first()

    async def send_presence(self, online):
        for other_id in await self.get_partner_ids():
            await self.channel_layer.group_send(user_group(other_id), {
                'type': 'chat.event',
                'data': {'type': 'presence', 'user': self.user.id, 'online': online},
            })

    @database_sync_to_async
    def get_partner_ids(self):
        ids = []
        for conversation in conversations_of(self.user):
            ids.append(conversation.guide_id if conversation.tourist_id == self.user.id else conversation.tourist_id)
        return ids

    # событие из группы отправляем в браузер
    async def chat_event(self, event):
        await self.send_json(event['data'])
