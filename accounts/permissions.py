from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    message = 'Это действие доступно только админу'

    def has_permission(self, request, view):
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
        return request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.user.role == 'admin':
            return True
        if hasattr(obj, 'guide'):
            return obj.guide == request.user
        return obj.user == request.user
