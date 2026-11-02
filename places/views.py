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
        return Place.objects.all()

    def get_permissions(self):
        # смотреть могут все
        if self.action == 'list' or self.action == 'retrieve':
            return [permissions.AllowAny()]
        # создавать, менять и удалять может только админ
        return [IsAdmin()]
