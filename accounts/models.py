from django.db import models

# Create your models here.
from django.contrib.auth.models import AbstractUser

class CustomUser(AbstractUser):
    ROLE_CHOICES = (
        ('tourist', 'Турист'),
        ('guide', 'Гид'),
        ('admin', 'Админ'),
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='tourist')
