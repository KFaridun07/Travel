from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser


# UserAdmin правильно работает с паролем: хеширует его, а не сохраняет как обычный текст
class CustomUserAdmin(UserAdmin):
    # колонки в списке пользователей
    list_display = ('username', 'email', 'first_name', 'last_name', 'role', 'is_staff')
    # фильтр по роли справа от списка
    list_filter = UserAdmin.list_filter + ('role',)
    # поле role на странице изменения пользователя
    fieldsets = UserAdmin.fieldsets + (
        ('Роль', {'fields': ('role',)}),
    )
    # поле role на странице создания пользователя
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Роль', {'fields': ('role',)}),
    )


# Register your models here.
admin.site.register(CustomUser, CustomUserAdmin)
