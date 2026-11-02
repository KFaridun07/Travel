from rest_framework import serializers
from .models import ChatMessage, TripPlan


class PhotoSearchSerializer(serializers.Serializer):
    image = serializers.ImageField()

    def validate_image(self, value):
        # отправляем в AI только самые обычные форматы картинок
        allowed_types = ['image/jpeg', 'image/png']
        if value.content_type not in allowed_types:
            raise serializers.ValidationError('Можно загружать только JPEG или PNG')

        # размер картинки не больше 3 МБ
        if value.size > 3 * 1024 * 1024:
            raise serializers.ValidationError('Картинка должна быть не больше 3 МБ')

        return value


class ChatMessageSerializer(serializers.ModelSerializer):
    # ограничиваем длину вопроса
    question = serializers.CharField(max_length=2000)

    class Meta:
        model = ChatMessage
        fields = ('id', 'question', 'answer', 'created_at')
        # ответ заполняет сервер
        read_only_fields = ('answer',)


class TripPlanSerializer(serializers.ModelSerializer):
    # ограничиваем длину текста с интересами
    interests = serializers.CharField(max_length=1000)

    class Meta:
        model = TripPlan
        fields = ('id', 'city', 'days', 'budget', 'interests', 'plan', 'created_at')
        # план заполняет сервер
        read_only_fields = ('plan',)
