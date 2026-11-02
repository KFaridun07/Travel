from rest_framework import permissions, viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from accounts.permissions import IsAdmin
from .models import Place
from .serializers import PlaceSerializer


class PlaceViewSet(viewsets.ModelViewSet):
    serializer_class = PlaceSerializer
    # эти парсеры нужны, чтобы загружать картинку
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        places = Place.objects.all()

        # фильтр по городу: /api/places/?city=Душанбе
        city = self.request.query_params.get('city')
        if city:
            # SQLite не умеет искать русские буквы без учёта регистра,
            # поэтому сравниваем сами обычным циклом
            found_ids = []
            for place in places:
                if city.lower() in place.city.lower():
                    found_ids.append(place.id)
            places = places.filter(id__in=found_ids)

        # поиск по названию: /api/places/?search=озеро
        search = self.request.query_params.get('search')
        if search:
            found_ids = []
            for place in places:
                if search.lower() in place.name.lower():
                    found_ids.append(place.id)
            places = places.filter(id__in=found_ids)

        return places

    def get_permissions(self):
        # смотреть могут все
        if self.action == 'list' or self.action == 'retrieve':
            return [permissions.AllowAny()]
        # создавать, менять и удалять может только админ
        return [IsAdmin()]
