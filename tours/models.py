from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from places.models import Place


class Tour(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField()
    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name='tours')
    # гид, который создал тур
    guide = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tours')
    # MinValueValidator не даёт сохранить слишком маленькое число
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    days = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    start_date = models.DateField()
    max_people = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    # картинка необязательная
    image = models.ImageField(upload_to='tours/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title
