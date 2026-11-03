# Шаг 1: Django собирает статику и превращает шаблон в обычный index.html
FROM python:3.14-slim AS build

WORKDIR /app

# начало одинаковое с образом бэкенда: Docker скачивает библиотеки один раз
COPY requirements.txt .
RUN pip install --no-cache-dir --timeout 30 --retries 10 -r requirements.txt

COPY . .
RUN DJANGO_DATA_DIR=/tmp python manage.py collectstatic --noinput \
    && DJANGO_DATA_DIR=/tmp python manage.py shell -c "from django.template.loader import render_to_string; open('/app/index.html', 'w', encoding='utf-8').write(render_to_string('index.html'))"

# Cloudflare хранит CSS и JS несколько часов: у новой версии файлов должен быть новый адрес
RUN VERSION=$(find staticfiles -type f | sort | xargs sha256sum | sha256sum | cut -c1-12) \
    && sed -i -E "s#(/static/[^\"]+\.(css|js))\"#\1?v=$VERSION\"#g" index.html \
    && grep -q "?v=$VERSION" index.html

# Шаг 2: в итоговом образе только nginx и готовые файлы, без Python и исходников
FROM nginx:1.29-alpine

COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/index.html /usr/share/nginx/html/index.html
COPY --from=build /app/staticfiles /usr/share/nginx/html/static
