from django.urls import path
from .views import PhotoSearchView

urlpatterns = [
    path('photo-search/', PhotoSearchView.as_view(), name='photo-search'),
]
