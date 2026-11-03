from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models import Q
from django.utils import timezone
from .models import Conversation, Message
from .serializers import MessageSerializer


def user_group(user_id):
    return 'user_' + str(user_id)


def conversations_of(user):
    return Conversation.objects.filter(Q(tourist=user) | Q(guide=user))


def notify_user(user_id, data):
    # у каждого пользователя своя группа: в неё входят все его открытые вкладки
    async_to_sync(get_channel_layer().group_send)(user_group(user_id), {'type': 'chat.event', 'data': data})


def notify_members(conversation, data):
    notify_user(conversation.tourist_id, data)
    notify_user(conversation.guide_id, data)


def create_message(conversation, sender, kind='text', text='', file=None, duration=None):
    message = Message(conversation=conversation, sender=sender, kind=kind, text=text, duration=duration)
    if file is not None:
        message.file = file
    message.save()
    notify_members(conversation, {'type': 'message', 'message': MessageSerializer(message).data})
    return message


def mark_read(conversation, user):
    # прочитанными становятся только чужие сообщения
    changed = conversation.messages.filter(read_at=None).exclude(sender=user).update(read_at=timezone.now())
    if changed:
        notify_members(conversation, {'type': 'read', 'conversation': conversation.id, 'reader': user.id})
    return changed


def delete_message(message):
    conversation = message.conversation
    message_id = message.id
    message.delete()
    notify_members(conversation, {'type': 'deleted', 'conversation': conversation.id, 'message': message_id})


def unread_total(user):
    return Message.objects.filter(
        Q(conversation__tourist=user) | Q(conversation__guide=user), read_at=None
    ).exclude(sender=user).count()
