from django.db import IntegrityError, transaction
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from accounts.permissions import IsTourist
from .models import Booking
from .serializers import ALREADY_BOOKED, BookingActionSerializer, BookingSerializer


class BookingViewSet(viewsets.ModelViewSet):
    serializer_class = BookingSerializer
    # бронь нельзя менять или удалять, статус меняется отдельными действиями
    http_method_names = ['get', 'post']

    def get_queryset(self):
        user = self.request.user

        # Swagger открывает эту страницу без входа, поэтому проверяем пользователя
        if not user.is_authenticated:
            return Booking.objects.none()

        # админ видит все брони
        if user.role == 'admin':
            bookings = Booking.objects.all()
        # гид видит брони своих туров
        elif user.role == 'guide':
            bookings = Booking.objects.filter(tour__guide=user)
        # турист видит только свои брони
        else:
            bookings = Booking.objects.filter(user=user)

        # фильтр по статусу: ?status=pending
        booking_status = self.request.query_params.get('status')
        if booking_status:
            bookings = bookings.filter(status=booking_status)

        return bookings

    def get_permissions(self):
        # создать бронь может только турист
        if self.action == 'create':
            return [IsTourist()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        tour = serializer.validated_data['tour']
        people_count = serializer.validated_data['people_count']
        # цену считает сервер, а не пользователь
        total_price = tour.price * people_count
        try:
            # transaction.atomic: после ошибки базы запрос может продолжать работу
            with transaction.atomic():
                serializer.save(user=self.request.user, total_price=total_price)
        except IntegrityError:
            # два одновременных запроса: проверку прошли оба, но база пропустила только первый
            raise serializers.ValidationError(ALREADY_BOOKED)

    # POST /api/bookings/{id}/confirm/
    @action(detail=True, methods=['post'], serializer_class=BookingActionSerializer)
    def confirm(self, request, pk=None):
        # get_object находит только брони, которые этот пользователь может видеть,
        # поэтому чужой гид получит ошибку 404
        booking = self.get_object()

        if request.user.role != 'guide' and request.user.role != 'admin':
            return Response(
                {'detail': 'Подтвердить бронь может только гид'},
                status=status.HTTP_403_FORBIDDEN
            )
        if booking.status != 'pending':
            return Response(
                {'detail': 'Подтвердить можно только бронь со статусом pending'},
                status=status.HTTP_400_BAD_REQUEST
            )

        booking.status = 'confirmed'
        booking.save()
        return Response(BookingSerializer(booking).data)

    # POST /api/bookings/{id}/cancel/
    @action(detail=True, methods=['post'], serializer_class=BookingActionSerializer)
    def cancel(self, request, pk=None):
        booking = self.get_object()

        # отменить бронь может только её владелец или админ
        if booking.user != request.user and request.user.role != 'admin':
            return Response(
                {'detail': 'Отменить можно только свою бронь'},
                status=status.HTTP_403_FORBIDDEN
            )
        if booking.status == 'cancelled':
            return Response(
                {'detail': 'Эта бронь уже отменена'},
                status=status.HTTP_400_BAD_REQUEST
            )

        booking.status = 'cancelled'
        booking.save()
        return Response(BookingSerializer(booking).data)
