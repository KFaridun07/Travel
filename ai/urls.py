from django.urls import path
from .views import ChatView, PhotoSearchView

urlpatterns = [
    path('photo-search/', PhotoSearchView.as_view(), name='photo-search'),
    path('chat/', ChatView.as_view(), name='chat'),
]
