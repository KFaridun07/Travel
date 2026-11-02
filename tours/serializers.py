from rest_framework import serializers
from .models import Tour


class TourSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tour
        fields = ('id', 'title', 'description', 'place', 'guide', 'price', 'days',
                  'start_date', 'max_people', 'image', 'created_at')
        # гида берём из токена, сам пользователь его не указывает
        read_only_fields = ('guide',)
