from rest_framework.routers import SimpleRouter
from .views import ConversationViewSet, MessageViewSet

router = SimpleRouter()
router.register('conversations', ConversationViewSet, basename='conversation')
router.register('messages', MessageViewSet, basename='message')

urlpatterns = router.urls
