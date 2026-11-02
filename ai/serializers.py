from rest_framework import serializers


class PhotoSearchSerializer(serializers.Serializer):
    image = serializers.ImageField()

    def validate_image(self, value):
        # Claude принимает только такие форматы картинок
        allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        if value.content_type not in allowed_types:
            raise serializers.ValidationError('Можно загружать только JPEG, PNG, GIF или WEBP')

        # размер картинки не больше 5 МБ
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError('Картинка должна быть не больше 5 МБ')

        return value
