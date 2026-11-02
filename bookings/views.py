from rest_framework import permissions, viewsets
from accounts.permissions import IsTourist
from .models import Booking
from .serializers import BookingSerializer


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
        serializer.save(user=self.request.user, total_price=total_price)
