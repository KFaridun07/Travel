from rest_framework import permissions, viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from accounts.permissions import IsGuide, IsOwnerOrAdmin
from .models import Tour
from .serializers import TourSerializer


class TourViewSet(viewsets.ModelViewSet):
    serializer_class = TourSerializer
    # эти парсеры нужны, чтобы загружать картинку
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return Tour.objects.all()

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
