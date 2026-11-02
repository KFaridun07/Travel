from rest_framework.routers import SimpleRouter
from .views import FavoriteViewSet, TourViewSet

router = SimpleRouter()
router.register('tours', TourViewSet, basename='tour')
router.register('favorites', FavoriteViewSet, basename='favorite')

urlpatterns = router.urls
