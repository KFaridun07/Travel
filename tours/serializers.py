from rest_framework import serializers
from bookings.models import Booking
from .models import Favorite, Review, Tour


class TourSerializer(serializers.ModelSerializer):
    # это поле считается в методе get_free_places, в базе его нет
    free_places = serializers.SerializerMethodField()

    class Meta:
        model = Tour
        fields = ('id', 'title', 'description', 'place', 'guide', 'price', 'days',
                  'start_date', 'max_people', 'image', 'created_at', 'free_places')
        # гида берём из токена, сам пользователь его не указывает
        read_only_fields = ('guide',)

    def get_free_places(self, obj):
        return obj.free_places()


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


class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ('id', 'user', 'tour', 'rating', 'text', 'created_at')
        # пользователя берём из токена
        read_only_fields = ('user',)

    def validate_tour(self, value):
        user = self.context['request'].user

        # отзыв можно оставить только с подтверждённой бронью этого тура
        if not Booking.objects.filter(user=user, tour=value, status='confirmed').exists():
            raise serializers.ValidationError('Отзыв можно оставить только с подтверждённой бронью этого тура')

        # один отзыв на один тур
        if Review.objects.filter(user=user, tour=value).exists():
            raise serializers.ValidationError('Вы уже оставили отзыв на этот тур')

        return value
