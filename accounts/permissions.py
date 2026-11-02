from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    # текст ошибки, который увидит пользователь
    message = 'Это действие доступно только админу'

    def has_permission(self, request, view):
        # сначала проверяем вход: у гостя нет поля role
        if not request.user.is_authenticated:
            return False
        return request.user.role == 'admin'


class IsGuide(BasePermission):
    message = 'Это действие доступно только гиду'

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.role == 'guide'


class IsTourist(BasePermission):
    message = 'Это действие доступно только туристу'

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.role == 'tourist'


class IsOwnerOrAdmin(BasePermission):
    message = 'Менять можно только свои записи'

    def has_permission(self, request, view):
        # гостей не пускаем сразу
        return request.user.is_authenticated

    # этот метод проверяет доступ к одной конкретной записи (obj)
    def has_object_permission(self, request, view, obj):
        # админу можно всё
        if request.user.role == 'admin':
            return True
        # у тура владелец хранится в поле guide
        if hasattr(obj, 'guide'):
            return obj.guide == request.user
        # у брони, отзыва и избранного владелец хранится в поле user
        return obj.user == request.user
