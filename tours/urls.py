from rest_framework.routers import SimpleRouter
from .views import FavoriteViewSet, ReviewViewSet, TourViewSet

router = SimpleRouter()
router.register('tours', TourViewSet, basename='tour')
router.register('favorites', FavoriteViewSet, basename='favorite')
router.register('reviews', ReviewViewSet, basename='review')

urlpatterns = router.urls
