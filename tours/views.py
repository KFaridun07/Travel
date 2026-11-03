from rest_framework import permissions, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from accounts.permissions import IsGuide, IsOwnerOrAdmin, IsTourist
from .models import Favorite, Review, Tour
from .serializers import FavoriteSerializer, ReviewSerializer, TourSerializer


def check_number(value, name):
    if not value.replace('.', '', 1).isdecimal() or len(value) > 10:
        raise ValidationError({name: 'Здесь должно быть число'})


class TourViewSet(viewsets.ModelViewSet):
    serializer_class = TourSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        tours = Tour.objects.all()

        city = self.request.query_params.get('city')
        if city:
            found_ids = []
            for tour in tours:
                if city.lower() in tour.place.city.lower():
                    found_ids.append(tour.id)
            tours = tours.filter(id__in=found_ids)

        price_min = self.request.query_params.get('price_min')
        if price_min:
            check_number(price_min, 'price_min')
            tours = tours.filter(price__gte=price_min)

        price_max = self.request.query_params.get('price_max')
        if price_max:
            check_number(price_max, 'price_max')
            tours = tours.filter(price__lte=price_max)

        days = self.request.query_params.get('days')
        if days:
            if not days.isdecimal() or len(days) > 10:
                raise ValidationError({'days': 'Здесь должно быть целое число'})
            tours = tours.filter(days=days)

        search = self.request.query_params.get('search')
        if search:
            found_ids = []
            for tour in tours:
                if search.lower() in tour.title.lower():
                    found_ids.append(tour.id)
            tours = tours.filter(id__in=found_ids)

        return tours

    def get_permissions(self):
        if self.action == 'list' or self.action == 'retrieve':
            return [permissions.AllowAny()]
        if self.action == 'create':
            return [IsGuide()]
        return [IsOwnerOrAdmin()]

    def perform_create(self, serializer):
        serializer.save(guide=self.request.user)


class FavoriteViewSet(viewsets.ModelViewSet):
    serializer_class = FavoriteSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'post', 'delete']

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return Favorite.objects.none()
        return Favorite.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewSerializer
    http_method_names = ['get', 'post']

    def get_queryset(self):
        reviews = Review.objects.all()

        tour = self.request.query_params.get('tour')
        if tour:
            if not tour.isdecimal() or len(tour) > 10:
                raise ValidationError({'tour': 'Здесь должно быть целое число'})
            reviews = reviews.filter(tour=tour)

        return reviews

    def get_permissions(self):
        if self.action == 'create':
            return [IsTourist()]
        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
