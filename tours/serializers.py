from rest_framework import serializers
from bookings.models import Booking
from .models import Favorite, Review, Tour


class TourSerializer(serializers.ModelSerializer):
    free_places = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    place_name = serializers.CharField(source='place.name', read_only=True)
    place_city = serializers.CharField(source='place.city', read_only=True)
    guide_name = serializers.CharField(source='guide.username', read_only=True)

    class Meta:
        model = Tour
        fields = ('id', 'title', 'description', 'place', 'guide', 'price', 'days',
                  'start_date', 'max_people', 'image', 'created_at', 'free_places', 'average_rating',
                  'place_name', 'place_city', 'guide_name')
        read_only_fields = ('guide',)

    def get_free_places(self, obj):
        return obj.free_places()

    def get_average_rating(self, obj):
        total = 0
        count = 0
        for review in obj.reviews.all():
            total = total + review.rating
            count = count + 1

        if count == 0:
            return 0
        return round(total / count, 1)


class FavoriteSerializer(serializers.ModelSerializer):
    tour_title = serializers.CharField(source='tour.title', read_only=True)

    class Meta:
        model = Favorite
        fields = ('id', 'user', 'tour', 'tour_title')
        read_only_fields = ('user',)

    def validate_tour(self, value):
        user = self.context['request'].user
        if Favorite.objects.filter(user=user, tour=value).exists():
            raise serializers.ValidationError('Этот тур уже в избранном')
        return value


class ReviewSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Review
        fields = ('id', 'user', 'username', 'tour', 'rating', 'text', 'created_at')
        read_only_fields = ('user',)

    def validate_tour(self, value):
        user = self.context['request'].user

        if not Booking.objects.filter(user=user, tour=value, status='confirmed').exists():
            raise serializers.ValidationError('Отзыв можно оставить только с подтверждённой бронью этого тура')

        if Review.objects.filter(user=user, tour=value).exists():
            raise serializers.ValidationError('Вы уже оставили отзыв на этот тур')

        return value
