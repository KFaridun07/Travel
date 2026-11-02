from rest_framework import serializers
from .models import Booking


class BookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ('id', 'user', 'tour', 'people_count', 'total_price', 'status', 'created_at')
        # эти поля заполняет сервер, а не пользователь
        read_only_fields = ('user', 'total_price', 'status')
