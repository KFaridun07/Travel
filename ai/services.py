import base64
import json
import os
import anthropic
from dotenv import load_dotenv

# читаем ключ из файла .env
load_dotenv()

MODEL = 'claude-opus-5-5'


class AIServiceError(Exception):
    # наша ошибка: в ней лежит понятный текст для пользователя
    pass


def ask_claude(content):
    # отправляет запрос в Claude и возвращает ответ текстом
    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        raise AIServiceError('Не задан ключ ANTHROPIC_API_KEY в файле .env')

    client = anthropic.Anthropic(api_key=api_key)

    try:
        response = client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            # если модель откажется отвечать, запрос сам перейдёт на запасную модель
            betas=['server-side-fallback-2026-07-01'],
            fallbacks='default',
            messages=[{'role': 'user', 'content': content}],
        )
    except anthropic.AuthenticationError:
        raise AIServiceError('Неправильный ключ ANTHROPIC_API_KEY')
    except anthropic.RateLimitError:
        raise AIServiceError('Слишком много запросов к AI, попробуйте позже')
    except anthropic.APIStatusError:
        raise AIServiceError('Сервис AI вернул ошибку, попробуйте позже')
    except anthropic.APIConnectionError:
        raise AIServiceError('Нет связи с сервисом AI, попробуйте позже')

    if response.stop_reason == 'refusal':
        raise AIServiceError('AI отказался отвечать на этот запрос')

    # ответ состоит из блоков, нам нужны только текстовые
    text = ''
    for block in response.content:
        if block.type == 'text':
            text = text + block.text
    return text


def recognize_place(image):
    # картинку нужно отправить как текст в формате base64
    image_data = base64.standard_b64encode(image.read()).decode('utf-8')

    content = [
        {
            'type': 'image',
            'source': {
                'type': 'base64',
                'media_type': image.content_type,
                'data': image_data,
            },
        },
        {
            'type': 'text',
            'text': 'Определи, какое место или достопримечательность на фото. '
                    'Ответь только JSON, без другого текста, в таком виде: '
                    '{"name": "название", "city": "город", "tags": ["тег", "тег"]}. '
                    'Значения пиши на русском языке.',
        },
    ]
    text = ask_claude(content)

    # AI мог добавить текст вокруг JSON, поэтому берём часть от { до }
    start = text.find('{')
    end = text.rfind('}')
    try:
        return json.loads(text[start:end + 1])
    except ValueError:
        # AI вернул не JSON
        return None


def ask_consultant(question, tours_text):
    content = (
        'Ты консультант туристической платформы TravelMate. '
        'Советуй туры ТОЛЬКО из списка ниже. '
        'Если подходящего тура в списке нет, так и скажи.\n\n'
        'Список туров:\n' + tours_text + '\n\n'
        'Вопрос клиента: ' + question
    )
    return ask_claude(content)
