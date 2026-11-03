"""
ASGI config for server project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.1/howto/deployment/asgi/
"""

import os

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'server.settings')

# сначала настраиваем Django: chat.routing обращается к моделям
django_application = get_asgi_application()

from chat.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter({
    'http': django_application,
    # чужие сайты не могут подключиться к чату от имени пользователя
    'websocket': AllowedHostsOriginValidator(URLRouter(websocket_urlpatterns)),
})
