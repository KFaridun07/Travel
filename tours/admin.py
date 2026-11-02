from django.contrib import admin
from .models import Favorite, Review, Tour

admin.site.register(Tour)
admin.site.register(Favorite)
admin.site.register(Review)
