import io
import shutil
import tempfile
from datetime import timedelta

from asgiref.sync import sync_to_async
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TransactionTestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken
from bookings.models import Booking
from places.models import Place
from tours.models import Tour
from .models import Conversation, Message
from .routing import websocket_urlpatterns

User = get_user_model()
PRIVATE_ROOT = tempfile.mkdtemp()
TEST_LAYERS = {'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}}


def make_people():
    people = {
        'tourist': User.objects.create_user('tourist', password='pass', role='tourist'),
        'guide': User.objects.create_user('guide', password='pass', role='guide'),
        'stranger': User.objects.create_user('stranger', password='pass', role='tourist'),
        'other_guide': User.objects.create_user('other_guide', password='pass', role='guide'),
        'admin': User.objects.create_user('boss', password='pass', role='admin'),
    }
    place = Place.objects.create(name='Озеро', city='Айни', description='Описание')
    tour = Tour.objects.create(
        title='Тур', description='Описание', place=place, guide=people['guide'], price=100,
        days=2, start_date=timezone.localdate() + timedelta(days=10), max_people=5,
    )
    people['booking'] = Booking.objects.create(user=people['tourist'], tour=tour, people_count=1, total_price=100)
    return people


def image_file(name='photo.png'):
    data = io.BytesIO()
    Image.new('RGB', (4, 4), 'red').save(data, 'PNG')
    return SimpleUploadedFile(name, data.getvalue(), content_type='image/png')


def voice_file(data=b'\x1a\x45\xdf\xa3 voice data'):
    return SimpleUploadedFile('voice.webm', data, content_type='audio/webm')


@override_settings(PRIVATE_MEDIA_ROOT=PRIVATE_ROOT, CHANNEL_LAYERS=TEST_LAYERS)
class ChatApiTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(PRIVATE_ROOT, ignore_errors=True)
        super().tearDownClass()

    def setUp(self):
        self.people = make_people()
        self.conversation = Conversation.objects.create(tourist=self.people['tourist'], guide=self.people['guide'])
        self.messages_url = '/api/chat/conversations/' + str(self.conversation.id) + '/messages/'

    def login(self, name):
        self.client.force_authenticate(self.people[name])

    # ---------- Открыть диалог ----------

    def test_tourist_opens_conversation_by_booking(self):
        Conversation.objects.all().delete()
        self.login('tourist')
        response = self.client.post('/api/chat/conversations/', {'booking': self.people['booking'].id}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['other']['id'], self.people['guide'].id)

    def test_guide_opens_same_conversation(self):
        self.login('guide')
        response = self.client.post('/api/chat/conversations/', {'booking': self.people['booking'].id}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], self.conversation.id)

    def test_stranger_cannot_use_foreign_booking(self):
        for name in ('stranger', 'other_guide'):
            self.login(name)
            response = self.client.post('/api/chat/conversations/', {'booking': self.people['booking'].id}, format='json')
            self.assertEqual(response.status_code, 404)

    def test_cancelled_booking_does_not_open_conversation(self):
        Conversation.objects.all().delete()
        self.people['booking'].status = 'cancelled'
        self.people['booking'].save()
        self.login('tourist')
        response = self.client.post('/api/chat/conversations/', {'booking': self.people['booking'].id}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_admin_and_guest_have_no_chat(self):
        self.login('admin')
        self.assertEqual(self.client.get('/api/chat/conversations/').status_code, 403)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/chat/conversations/').status_code, 401)

    # ---------- Сообщения ----------

    def test_send_text_and_read_history(self):
        self.login('tourist')
        response = self.client.post(self.messages_url, {'kind': 'text', 'text': '  Привет  '}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['text'], 'Привет')

        self.login('guide')
        history = self.client.get(self.messages_url)
        self.assertEqual(len(history.data['results']), 1)
        self.assertFalse(history.data['has_more'])

    def test_empty_text_is_rejected(self):
        self.login('tourist')
        response = self.client.post(self.messages_url, {'kind': 'text', 'text': '   '}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_stranger_cannot_read_or_write(self):
        Message.objects.create(conversation=self.conversation, sender=self.people['tourist'], text='Секрет')
        for name in ('stranger', 'other_guide'):
            self.login(name)
            self.assertEqual(self.client.get(self.messages_url).status_code, 404)
            self.assertEqual(self.client.post(self.messages_url, {'text': 'x'}, format='json').status_code, 404)
            self.assertEqual(self.client.get('/api/chat/conversations/').data, [])

    def test_history_is_paged(self):
        for number in range(55):
            Message.objects.create(conversation=self.conversation, sender=self.people['tourist'], text=str(number))
        self.login('guide')
        first = self.client.get(self.messages_url)
        self.assertEqual(len(first.data['results']), 50)
        self.assertTrue(first.data['has_more'])
        self.assertEqual(first.data['results'][-1]['text'], '54')
        older = self.client.get(self.messages_url + '?before=' + str(first.data['results'][0]['id']))
        self.assertEqual(len(older.data['results']), 5)
        self.assertFalse(older.data['has_more'])

    # ---------- Файлы ----------

    def test_photo_is_private(self):
        self.login('tourist')
        response = self.client.post(self.messages_url, {'kind': 'image', 'text': 'Подпись', 'image': image_file()}, format='multipart')
        self.assertEqual(response.status_code, 201)
        file_url = '/api/chat/messages/' + str(response.data['id']) + '/file/'

        self.login('guide')
        answer = self.client.get(file_url)
        self.assertEqual(answer.status_code, 200)
        self.assertEqual(answer['Content-Type'], 'image/png')
        answer.close()

        self.login('stranger')
        self.assertEqual(self.client.get(file_url).status_code, 404)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(file_url).status_code, 401)

    def test_not_an_image_is_rejected(self):
        self.login('tourist')
        svg = SimpleUploadedFile('photo.svg', b'<svg onload="alert(1)"></svg>', content_type='image/svg+xml')
        response = self.client.post(self.messages_url, {'kind': 'image', 'image': svg}, format='multipart')
        self.assertEqual(response.status_code, 400)

    def test_voice_is_checked_by_content(self):
        self.login('tourist')
        good = self.client.post(self.messages_url, {'kind': 'voice', 'voice': voice_file(), 'duration': 3}, format='multipart')
        self.assertEqual(good.status_code, 201)
        self.assertEqual(good.data['duration'], 3)

        fake = self.client.post(self.messages_url, {'kind': 'voice', 'voice': voice_file(b'<script>x</script>'), 'duration': 3}, format='multipart')
        self.assertEqual(fake.status_code, 400)
        no_length = self.client.post(self.messages_url, {'kind': 'voice', 'voice': voice_file()}, format='multipart')
        self.assertEqual(no_length.status_code, 400)

    def test_big_file_is_rejected(self):
        self.login('tourist')
        big = voice_file(b'\x1a\x45\xdf\xa3' + b'0' * (10 * 1024 * 1024))
        response = self.client.post(self.messages_url, {'kind': 'voice', 'voice': big, 'duration': 3}, format='multipart')
        self.assertEqual(response.status_code, 400)

    # ---------- Прочтение и удаление ----------

    def test_read_marks_only_foreign_messages(self):
        mine = Message.objects.create(conversation=self.conversation, sender=self.people['guide'], text='Моё')
        theirs = Message.objects.create(conversation=self.conversation, sender=self.people['tourist'], text='Чужое')
        self.login('guide')
        self.assertEqual(self.client.get('/api/chat/conversations/').data[0]['unread'], 1)
        self.client.post('/api/chat/conversations/' + str(self.conversation.id) + '/read/')
        mine.refresh_from_db()
        theirs.refresh_from_db()
        self.assertIsNone(mine.read_at)
        self.assertIsNotNone(theirs.read_at)
        self.assertEqual(self.client.get('/api/chat/conversations/').data[0]['unread'], 0)

    def test_only_sender_deletes_and_file_is_removed(self):
        self.login('tourist')
        answer = self.client.post(self.messages_url, {'kind': 'image', 'image': image_file()}, format='multipart')
        message = Message.objects.get(id=answer.data['id'])
        storage = message.file.storage
        name = message.file.name
        self.assertTrue(storage.exists(name))

        self.login('guide')
        self.assertEqual(self.client.delete('/api/chat/messages/' + str(message.id) + '/').status_code, 403)
        self.login('stranger')
        self.assertEqual(self.client.delete('/api/chat/messages/' + str(message.id) + '/').status_code, 404)

        self.login('tourist')
        self.assertEqual(self.client.delete('/api/chat/messages/' + str(message.id) + '/').status_code, 204)
        self.assertFalse(storage.exists(name))


@override_settings(PRIVATE_MEDIA_ROOT=PRIVATE_ROOT, CHANNEL_LAYERS=TEST_LAYERS)
class ChatSocketTests(TransactionTestCase):
    def setUp(self):
        self.people = make_people()
        self.conversation = Conversation.objects.create(tourist=self.people['tourist'], guide=self.people['guide'])

    def token(self, name):
        return str(AccessToken.for_user(self.people[name]))

    async def connect(self, name):
        socket = WebsocketCommunicator(URLRouter(websocket_urlpatterns), '/ws/chat/')
        connected, _ = await socket.connect()
        self.assertTrue(connected)
        await socket.send_json_to({'type': 'auth', 'token': await sync_to_async(self.token)(name)})
        answer = await socket.receive_json_from()
        self.assertEqual(answer['type'], 'ready')
        return socket

    async def skip_presence(self, socket):
        answer = await socket.receive_json_from()
        while answer['type'] == 'presence':
            answer = await socket.receive_json_from()
        return answer

    async def test_bad_token_closes_connection(self):
        socket = WebsocketCommunicator(URLRouter(websocket_urlpatterns), '/ws/chat/')
        await socket.connect()
        await socket.send_json_to({'type': 'auth', 'token': 'bad'})
        answer = await socket.receive_output()
        self.assertEqual(answer['type'], 'websocket.close')
        self.assertEqual(answer['code'], 4001)
        await socket.disconnect()

    async def test_connection_closes_when_token_expires(self):
        def short_token():
            token = AccessToken.for_user(self.people['tourist'])
            token.set_exp(lifetime=timedelta(seconds=1))
            return str(token)

        socket = WebsocketCommunicator(URLRouter(websocket_urlpatterns), '/ws/chat/')
        await socket.connect()
        await socket.send_json_to({'type': 'auth', 'token': await sync_to_async(short_token)()})
        self.assertEqual((await socket.receive_json_from())['type'], 'ready')
        answer = await socket.receive_output(timeout=3)
        self.assertEqual(answer['code'], 4001)
        await socket.disconnect()

    async def test_message_before_auth_is_refused(self):
        socket = WebsocketCommunicator(URLRouter(websocket_urlpatterns), '/ws/chat/')
        await socket.connect()
        await socket.send_json_to({'type': 'message', 'conversation': self.conversation.id, 'text': 'x'})
        answer = await socket.receive_output()
        self.assertEqual(answer['code'], 4001)
        await socket.disconnect()
        self.assertEqual(await sync_to_async(Message.objects.count)(), 0)

    async def test_admin_is_refused(self):
        socket = WebsocketCommunicator(URLRouter(websocket_urlpatterns), '/ws/chat/')
        await socket.connect()
        await socket.send_json_to({'type': 'auth', 'token': await sync_to_async(self.token)('admin')})
        answer = await socket.receive_output()
        self.assertEqual(answer['code'], 4003)
        await socket.disconnect()

    async def test_message_reaches_both_members_only(self):
        tourist = await self.connect('tourist')
        guide = await self.connect('guide')
        stranger = await self.connect('stranger')

        await tourist.send_json_to({'type': 'message', 'conversation': self.conversation.id, 'text': 'Привет'})
        for socket in (tourist, guide):
            answer = await self.skip_presence(socket)
            self.assertEqual(answer['type'], 'message')
            self.assertEqual(answer['message']['text'], 'Привет')
        self.assertTrue(await stranger.receive_nothing())

        for socket in (tourist, guide, stranger):
            await socket.disconnect()

    async def test_stranger_cannot_write_to_foreign_conversation(self):
        stranger = await self.connect('stranger')
        await stranger.send_json_to({'type': 'message', 'conversation': self.conversation.id, 'text': 'Спам'})
        answer = await stranger.receive_json_from()
        self.assertEqual(answer['type'], 'error')
        self.assertEqual(await sync_to_async(Message.objects.count)(), 0)
        await stranger.disconnect()

    async def test_typing_reaches_only_the_other_member(self):
        tourist = await self.connect('tourist')
        guide = await self.connect('guide')
        await tourist.send_json_to({'type': 'typing', 'conversation': self.conversation.id})
        answer = await self.skip_presence(guide)
        self.assertEqual(answer['type'], 'typing')
        self.assertEqual(answer['user'], self.people['tourist'].id)
        await tourist.disconnect()
        await guide.disconnect()

    async def test_broken_data_keeps_connection(self):
        tourist = await self.connect('tourist')
        await tourist.send_to(text_data='это не json')
        answer = await tourist.receive_json_from()
        self.assertEqual(answer['type'], 'error')
        await tourist.send_json_to({'type': 'message', 'conversation': self.conversation.id, 'text': 'Живой'})
        answer = await tourist.receive_json_from()
        self.assertEqual(answer['type'], 'message')
        await tourist.disconnect()

    async def test_flood_is_limited(self):
        tourist = await self.connect('tourist')
        for number in range(31):
            await tourist.send_json_to({'type': 'typing', 'conversation': self.conversation.id})
        answer = await tourist.receive_json_from()
        self.assertEqual(answer['type'], 'error')
        await tourist.disconnect()
