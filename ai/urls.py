from django.urls import path
from .views import ChatHistoryView, ChatView, PhotoSearchView, TripPlanListView, TripPlanView

urlpatterns = [
    path('photo-search/', PhotoSearchView.as_view(), name='photo-search'),
    path('chat/', ChatView.as_view(), name='chat'),
    path('chat/history/', ChatHistoryView.as_view(), name='chat-history'),
    path('trip-plan/', TripPlanView.as_view(), name='trip-plan'),
    path('trip-plans/', TripPlanListView.as_view(), name='trip-plans'),
]
