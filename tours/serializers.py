from rest_framework import serializers
from .models import Favorite, Tour


class TourSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tour
        fields = ('id', 'title', 'description', 'place', 'guide', 'price', 'days',
                  'start_date', 'max_people', 'image', 'created_at')
        # гида берём из токена, сам пользователь его не указывает
        read_only_fields = ('guide',)


class FavoriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Favorite
        fields = ('id', 'user', 'tour')
        # пользователя берём из токена
        read_only_fields = ('user',)

    def validate_tour(self, value):
        # проверяем, что этого тура ещё нет в избранном
        user = self.context['request'].user
        if Favorite.objects.filter(user=user, tour=value).exists():
            raise serializers.ValidationError('Этот тур уже в избранном')
        return value
