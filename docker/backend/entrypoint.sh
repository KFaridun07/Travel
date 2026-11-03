#!/bin/sh
set -e

# при каждом запуске база обновляется до новой версии
python manage.py migrate --noinput

# разовая команда: docker compose run --rm backend python manage.py createsuperuser
if [ "$#" -gt 0 ]; then
    exec "$@"
fi

# exec: сервер получает сигнал остановки напрямую от Docker
exec daphne -b 0.0.0.0 -p 8000 server.asgi:application
