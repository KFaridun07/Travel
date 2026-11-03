from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from places.models import Place


class Tour(models.Model):
    title = models.CharField(max_length=200)
    description = models.TextField()
    place = models.ForeignKey(Place, on_delete=models.CASCADE, related_name='tours')
    guide = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tours')
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    days = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    start_date = models.DateField()
    max_people = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    image = models.ImageField(upload_to='tours/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

    def free_places(self):
        booked = 0
        for booking in self.bookings.all():
            if booking.status != 'cancelled':
                booked = booked + booking.people_count
        return self.max_people - booked


class Favorite(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='favorites')
    tour = models.ForeignKey(Tour, on_delete=models.CASCADE, related_name='favorites')

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'tour'], name='unique_favorite'),
        ]

    def __str__(self):
        return str(self.user) + ' - ' + str(self.tour)


class Review(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews')
    tour = models.ForeignKey(Tour, on_delete=models.CASCADE, related_name='reviews')
    rating = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'tour'], name='unique_review'),
        ]

    def __str__(self):
        return str(self.user) + ' - ' + str(self.tour)
