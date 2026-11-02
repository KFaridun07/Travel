from django.contrib.auth import password_validation
from rest_framework import serializers
from .models import CustomUser



class RegisterSerializer(serializers.ModelSerializer):
    # write_only: пароль можно отправить, но в ответе он не показывается
    password = serializers.CharField(write_only=True)

    class Meta:
        model = CustomUser
        fields = ('username', 'password', 'role', 'email', 'first_name', 'last_name')

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
            role=validated_data.get('role', 'tourist'),  # если роль не прислали, будет tourist
            # эти поля необязательные: если их не прислали, будет пустая строка
            email=validated_data.get('email', ''),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )
        return user


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        # пароль сюда не добавляем, он не должен быть виден в профиле
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'role')
        # эти поля можно только смотреть: иначе пользователь сам поставил бы себе role admin
        read_only_fields = ('id', 'username', 'role')


class LogoutSerializer(serializers.Serializer):
    # благодаря этому полю Swagger показывает, что нужно отправить refresh
    refresh = serializers.CharField()
