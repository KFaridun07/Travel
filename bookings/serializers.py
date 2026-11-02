from django.utils import timezone
from rest_framework import serializers
from .models import Booking


class BookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ('id', 'user', 'tour', 'people_count', 'total_price', 'status', 'created_at')
        # эти поля заполняет сервер, а не пользователь
        read_only_fields = ('user', 'total_price', 'status')

    def validate(self, data):
        tour = data['tour']
        people_count = data['people_count']

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
