from rest_framework import permissions, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from accounts.permissions import IsGuide, IsOwnerOrAdmin, IsTourist
from .models import Favorite, Review, Tour
from .serializers import FavoriteSerializer, ReviewSerializer, TourSerializer


def check_number(value, name):
    # в адресе всё приходит текстом, поэтому проверяем, что это правда число
    # replace убирает одну точку, чтобы цена 99.50 тоже проходила
    if not value.replace('.', '', 1).isdecimal() or len(value) > 10:
        raise ValidationError({name: 'Здесь должно быть число'})


class TourViewSet(viewsets.ModelViewSet):
    serializer_class = TourSerializer
    # эти парсеры нужны, чтобы загружать картинку
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        tours = Tour.objects.all()

        # фильтр по городу места: ?city=Душанбе
        city = self.request.query_params.get('city')
        if city:
            tours = tours.filter(place__city__icontains=city)

        # цена от: ?price_min=100
        price_min = self.request.query_params.get('price_min')
        if price_min:
            check_number(price_min, 'price_min')
            tours = tours.filter(price__gte=price_min)

        # цена до: ?price_max=500
        price_max = self.request.query_params.get('price_max')
        if price_max:
            check_number(price_max, 'price_max')
            tours = tours.filter(price__lte=price_max)

        # количество дней: ?days=3
        days = self.request.query_params.get('days')
        if days:
            # дни могут быть только целым числом, поэтому точку здесь не пропускаем
            if not days.isdecimal() or len(days) > 10:
                raise ValidationError({'days': 'Здесь должно быть целое число'})
            tours = tours.filter(days=days)

        # поиск по названию: ?search=озеро
        search = self.request.query_params.get('search')
        if search:
            tours = tours.filter(title__icontains=search)

        return tours

    def get_permissions(self):
        # смотреть могут все
        if self.action == 'list' or self.action == 'retrieve':
            return [permissions.AllowAny()]
        # создавать может только гид
        if self.action == 'create':
            return [IsGuide()]
        # менять и удалять может владелец тура или админ
        return [IsOwnerOrAdmin()]

    def perform_create(self, serializer):
        # гид — это тот, чей токен пришёл в запросе
        serializer.save(guide=self.request.user)


class FavoriteViewSet(viewsets.ModelViewSet):
    serializer_class = FavoriteSerializer
    permission_classes = [permissions.IsAuthenticated]
    # избранное можно смотреть, добавлять и удалять, но не менять
    http_method_names = ['get', 'post', 'delete']

    def get_queryset(self):
        # Swagger открывает эту страницу без входа, поэтому проверяем пользователя
        if not self.request.user.is_authenticated:
            return Favorite.objects.none()
        # каждый видит только своё избранное
        return Favorite.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewSerializer
    # отзывы можно смотреть и создавать
    http_method_names = ['get', 'post']

    def get_queryset(self):
        reviews = Review.objects.all()

        # фильтр по туру: ?tour=1
        tour = self.request.query_params.get('tour')
        if tour:
            if not tour.isdecimal() or len(tour) > 10:
                raise ValidationError({'tour': 'Здесь должно быть целое число'})
            reviews = reviews.filter(tour=tour)

        return reviews

    def get_permissions(self):
        # написать отзыв может только турист
        if self.action == 'create':
            return [IsTourist()]
        # смотреть могут все
        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
