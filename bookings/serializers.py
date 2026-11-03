from django.utils import timezone
from rest_framework import serializers
from .models import Booking

ALREADY_BOOKED = 'Вы уже забронировали этот тур'


class BookingSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    tour_title = serializers.CharField(source='tour.title', read_only=True)

    class Meta:
        model = Booking
        fields = ('id', 'user', 'username', 'tour', 'tour_title', 'people_count',
                  'total_price', 'status', 'created_at')
        # эти поля заполняет сервер, а не пользователь
        read_only_fields = ('user', 'total_price', 'status')
        # повторную бронь проверяем сами в validate: там понятное сообщение
        validators = []

    def validate(self, data):
        tour = data['tour']
        people_count = data['people_count']

        # один турист держит только одну активную бронь на тур
        user = self.context['request'].user
        if Booking.objects.filter(user=user, tour=tour).exclude(status='cancelled').exists():
            raise serializers.ValidationError(ALREADY_BOOKED)

        # нельзя бронировать тур, который уже начался
        today = timezone.localdate()
        if tour.start_date <= today:
            raise serializers.ValidationError('Этот тур уже начался, бронировать его нельзя')

        # проверяем, хватает ли свободных мест
        free_places = tour.free_places()
        if people_count > free_places:
            raise serializers.ValidationError('Не хватает мест. Свободно мест: ' + str(free_places))

        return data


class BookingActionSerializer(serializers.Serializer):
    # пустой сериализатор: для confirm и cancel ничего отправлять не нужно
    pass
