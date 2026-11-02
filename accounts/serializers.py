from django.contrib.auth import password_validation
from rest_framework import serializers
from .models import CustomUser



class RegisterSerializer(serializers.ModelSerializer):
    # write_only: пароль можно отправить, но в ответе он не показывается
    password = serializers.CharField(write_only=True)

    class Meta:
        model = CustomUser
        fields = ('username', 'password', 'role')

    def validate_password(self, value):
        # проверяем пароль по правилам из AUTH_PASSWORD_VALIDATORS в settings.py
        password_validation.validate_password(value)
        return value

    def validate_role(self, value):
        # самому зарегистрироваться как admin нельзя
        if value == 'admin':
            raise serializers.ValidationError('Можно выбрать только tourist или guide')
        return value

    def create(self, validated_data):
        user = CustomUser.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            role=validated_data.get('role', 'tourist')  # если роль не прислали, будет tourist
        )
        return user


class LogoutSerializer(serializers.Serializer):
    # благодаря этому полю Swagger показывает, что нужно отправить refresh
    refresh = serializers.CharField()
