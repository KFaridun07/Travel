from rest_framework import serializers
from .models import Conversation, Message
from .presence import is_online

MAX_TEXT_LENGTH = 4000
MAX_FILE_SIZE = 10 * 1024 * 1024
MAX_VOICE_SECONDS = 600

IMAGE_EXTENSIONS = {'JPEG': '.jpg', 'PNG': '.png', 'WEBP': '.webp', 'GIF': '.gif'}


def voice_extension(data):
    # браузер присылает тип файла сам, поэтому смотрим на его первые байты
    start = data.read(12)
    data.seek(0)
    if start.startswith(b'\x1a\x45\xdf\xa3'):
        return '.webm'
    if start.startswith(b'OggS'):
        return '.ogg'
    if start[4:8] == b'ftyp':
        return '.m4a'
    return None


class MessageSerializer(serializers.ModelSerializer):
    has_file = serializers.SerializerMethodField()
    sender_name = serializers.SerializerMethodField()
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ('id', 'conversation', 'sender', 'sender_name', 'kind', 'text', 'has_file', 'duration', 'created_at', 'is_read')

    def get_has_file(self, message):
        return bool(message.file)

    def get_sender_name(self, message):
        return message.sender.get_full_name() or message.sender.username

    def get_is_read(self, message):
        return message.read_at is not None


class MessageCreateSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=Message.KIND_CHOICES, default='text')
    text = serializers.CharField(required=False, allow_blank=True, max_length=MAX_TEXT_LENGTH)
    image = serializers.ImageField(required=False)
    voice = serializers.FileField(required=False)
    duration = serializers.IntegerField(required=False, min_value=1, max_value=MAX_VOICE_SECONDS)

    def validate_image(self, image):
        if image.size > MAX_FILE_SIZE:
            raise serializers.ValidationError('Файл больше 10 МБ')
        if image.image.format not in IMAGE_EXTENSIONS:
            raise serializers.ValidationError('Можно отправить только JPEG, PNG, WEBP или GIF')
        image.name = 'photo' + IMAGE_EXTENSIONS[image.image.format]
        return image

    def validate_voice(self, voice):
        if voice.size > MAX_FILE_SIZE:
            raise serializers.ValidationError('Файл больше 10 МБ')
        extension = voice_extension(voice)
        if extension is None:
            raise serializers.ValidationError('Это не голосовое сообщение')
        voice.name = 'voice' + extension
        return voice

    def validate(self, data):
        kind = data['kind']
        data['text'] = data.get('text', '').strip()
        if kind == 'text' and not data['text']:
            raise serializers.ValidationError('Напишите сообщение')
        if kind == 'image' and 'image' not in data:
            raise serializers.ValidationError('Выберите фото')
        if kind == 'voice' and ('voice' not in data or 'duration' not in data):
            raise serializers.ValidationError('Нет записи голоса')
        return data


class ConversationCreateSerializer(serializers.Serializer):
    booking = serializers.IntegerField()


class ConversationSerializer(serializers.ModelSerializer):
    other = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ('id', 'other', 'last_message', 'unread', 'created_at')

    def get_other(self, conversation):
        user = conversation.other_user(self.context['request'].user)
        return {
            'id': user.id,
            'name': user.get_full_name() or user.username,
            'role': user.role,
            'online': is_online(user.id),
        }

    def get_last_message(self, conversation):
        message = conversation.messages.select_related('sender').last()
        if message is None:
            return None
        return MessageSerializer(message).data

    def get_unread(self, conversation):
        user = self.context['request'].user
        return conversation.messages.filter(read_at=None).exclude(sender=user).count()
