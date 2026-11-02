from django.contrib import admin
from .models import ChatMessage, TripPlan

admin.site.register(ChatMessage)
admin.site.register(TripPlan)
