from django.db.models import Max
from django.db.models.functions import Coalesce
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from bookings.models import Booking
from .models import Conversation, Message
from .serializers import (ConversationCreateSerializer, ConversationSerializer,
                          MessageCreateSerializer, MessageSerializer)
from .services import conversations_of, create_message, delete_message, mark_read

PAGE_SIZE = 50

FILE_TYPES = {
    'jpg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp', 'gif': 'image/gif',
    'webm': 'audio/webm', 'ogg': 'audio/ogg', 'm4a': 'audio/mp4',
}


class IsTouristOrGuide(BasePermission):
    message = 'Переписка доступна только туристу и гиду'

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.role in ('tourist', 'guide')


class MessageSendThrottle(UserRateThrottle):
    rate = '60/min'


class ConversationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = ConversationSerializer
    permission_classes = [IsTouristOrGuide]

    def get_queryset(self):
        # Swagger открывает эту страницу без входа
        if not self.request.user.is_authenticated:
            return Conversation.objects.none()
        # сверху диалоги с самыми новыми сообщениями
        conversations = conversations_of(self.request.user).select_related('tourist', 'guide')
        conversations = conversations.annotate(last_time=Coalesce(Max('messages__created_at'), 'created_at'))
        return conversations.order_by('-last_time')

    def get_throttles(self):
        if self.action == 'messages' and self.request.method == 'POST':
            return [MessageSendThrottle()]
        return super().get_throttles()

    # POST /api/chat/conversations/ {"booking": 1}: открыть диалог по брони
    def create(self, request):
        serializer = ConversationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        booking = get_object_or_404(Booking.objects.select_related('tour'), id=serializer.validated_data['booking'])
        # чужую бронь пользователь видеть не должен, поэтому ответ такой же, как у несуществующей
        if request.user.id != booking.user_id and request.user.id != booking.tour.guide_id:
            return Response({'detail': 'Страница не найдена.'}, status=status.HTTP_404_NOT_FOUND)
        if booking.status == 'cancelled':
            return Response({'detail': 'Эта бронь отменена'}, status=status.HTTP_400_BAD_REQUEST)

        conversation, created = Conversation.objects.get_or_create(tourist_id=booking.user_id, guide_id=booking.tour.guide_id)
        data = ConversationSerializer(conversation, context={'request': request}).data
        return Response(data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    # GET /api/chat/conversations/{id}/messages/?before=100: последние сообщения
    # POST /api/chat/conversations/{id}/messages/: отправить текст, фото или голосовое
    @action(detail=True, methods=['get', 'post'])
    def messages(self, request, pk=None):
        conversation = self.get_object()
        if request.method == 'POST':
            return self.send_message(request, conversation)

        messages = conversation.messages.select_related('sender')
        before = request.query_params.get('before')
        if before and before.isdigit():
            messages = messages.filter(id__lt=int(before))

        # берём на одно сообщение больше, чтобы узнать, есть ли ещё более ранние
        page = list(messages.order_by('-id')[:PAGE_SIZE + 1])
        has_more = len(page) > PAGE_SIZE
        page = page[:PAGE_SIZE]
        page.reverse()
        return Response({'results': MessageSerializer(page, many=True).data, 'has_more': has_more})

    def send_message(self, request, conversation):
        serializer = MessageCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        kind = data['kind']

        file = None
        if kind == 'image':
            file = data['image']
        elif kind == 'voice':
            file = data['voice']

        message = create_message(
            conversation,
            request.user,
            kind=kind,
            text='' if kind == 'voice' else data['text'],
            file=file,
            duration=data.get('duration') if kind == 'voice' else None,
        )
        return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)

    # POST /api/chat/conversations/{id}/read/
    @action(detail=True, methods=['post'])
    def read(self, request, pk=None):
        return Response({'updated': mark_read(self.get_object(), request.user)})


class MessageViewSet(mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class = MessageSerializer
    permission_classes = [IsTouristOrGuide]

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return Message.objects.none()
        return Message.objects.filter(conversation__in=conversations_of(self.request.user)).select_related('conversation')

    def destroy(self, request, *args, **kwargs):
        message = self.get_object()
        if message.sender_id != request.user.id:
            return Response({'detail': 'Удалить можно только своё сообщение'}, status=status.HTTP_403_FORBIDDEN)
        delete_message(message)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # GET /api/chat/messages/{id}/file/: фото или голос видят только участники диалога
    @action(detail=True, methods=['get'])
    def file(self, request, pk=None):
        message = self.get_object()
        if not message.file:
            return Response({'detail': 'У сообщения нет файла'}, status=status.HTTP_404_NOT_FOUND)
        extension = message.file.name.rsplit('.', 1)[-1]
        response = FileResponse(message.file.open('rb'), content_type=FILE_TYPES.get(extension, 'application/octet-stream'))
        response['Cache-Control'] = 'private, max-age=3600'
        return response
