from rest_framework.routers import SimpleRouter
from .views import PlaceViewSet

router = SimpleRouter()
router.register('places', PlaceViewSet, basename='place')

urlpatterns = router.urls
