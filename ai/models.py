from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class ChatMessage(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='chat_messages')
    question = models.TextField()
    answer = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return str(self.user) + ': ' + self.question[:30]


class TripPlan(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='trip_plans')
    city = models.CharField(max_length=100)
    # поездка от 1 до 30 дней
    days = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(30)])
    budget = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    interests = models.TextField()
    # готовый план, который составил AI
    plan = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return str(self.user) + ': ' + self.city
