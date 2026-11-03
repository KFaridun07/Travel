# Django: API, админка и WebSocket
FROM python:3.14-slim

WORKDIR /app

# начало одинаковое с образом фронтенда: Docker скачивает библиотеки один раз
COPY requirements.txt .
RUN pip install --no-cache-dir --timeout 30 --retries 10 -r requirements.txt

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_DATA_DIR=/data

COPY . .

# сервер работает не от root, база и файлы лежат в /data
RUN useradd --create-home app \
    && mkdir -p /data/media /data/private_media \
    && chown -R app:app /data
USER app

ENTRYPOINT ["sh", "/app/docker/backend/entrypoint.sh"]
