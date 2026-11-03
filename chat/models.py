import os
import uuid

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver


class PrivateStorage(FileSystemStorage):
    # файлы чата лежат вне папки media: у них нет открытой ссылки,
    # отдаёт их только проверка доступа в MessageViewSet
    @property
    def base_location(self):
        return settings.PRIVATE_MEDIA_ROOT

    @property
    def location(self):
        return os.path.abspath(self.base_location)


def message_file_path(message, filename):
    # имя файла придумываем сами, имя от пользователя не используем
    extension = os.path.splitext(filename)[1].lower()
    return 'chat/' + str(message.conversation_id) + '/' + uuid.uuid4().hex + extension


class Conversation(models.Model):
    # один диалог на пару турист и гид
    tourist = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tourist_conversations')
    guide = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='guide_conversations')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['tourist', 'guide'], name='unique_conversation'),
        ]

    def __str__(self):
        return str(self.tourist) + ' - ' + str(self.guide)

    def other_user(self, user):
        return self.guide if user.id == self.tourist_id else self.tourist


class Message(models.Model):
    KIND_CHOICES = (
        ('text', 'Текст'),
        ('image', 'Фото'),
        ('voice', 'Голосовое'),
    )
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_messages')
    kind = models.CharField(max_length=5, choices=KIND_CHOICES, default='text')
    # у фото это подпись, у голосового текста нет
    text = models.TextField(blank=True)
    file = models.FileField(upload_to=message_file_path, storage=PrivateStorage(), blank=True)
    # длительность голосового в секундах
    duration = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return str(self.sender) + ': ' + self.kind


# вместе с сообщением удаляем и его файл с диска
@receiver(post_delete, sender=Message)
def delete_message_file(sender, instance, **kwargs):
    if instance.file:
        instance.file.delete(save=False)
