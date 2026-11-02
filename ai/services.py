import base64
import json
import os
import groq
from dotenv import load_dotenv

# читаем ключ из файла .env
load_dotenv()

# эта модель понимает и текст, и картинки
MODEL = 'qwen/qwen3.8-27b'
# бесплатный тариф Groq принимает запросы только до 1000 токенов ответа в минуту
MAX_TOKENS = 900


class AIServiceError(Exception):
    # наша ошибка: в ней лежит понятный текст для пользователя
    pass


def ask_groq(content):
    # отправляет запрос в Groq и возвращает ответ текстом
    api_key = os.getenv('GROQ_API_KEY')
    if not api_key:
        raise AIServiceError('Не задан ключ GROQ_API_KEY в файле .env')

    client = groq.Groq(api_key=api_key)

    try:
        response = client.chat.completions.create(
            model=MODEL,
            max_completion_tokens=MAX_TOKENS,
            # прячем рассуждения модели, нам нужен только готовый ответ
            reasoning_format='hidden',
            messages=[{'role': 'user', 'content': content}],
        )
    except groq.AuthenticationError:
        raise AIServiceError('Неправильный ключ GROQ_API_KEY')
    except groq.RateLimitError:
        raise AIServiceError('Слишком много запросов к AI, попробуйте позже')
    except groq.APIStatusError:
        raise AIServiceError('Сервис AI вернул ошибку, попробуйте позже')
    except groq.APIConnectionError:
        raise AIServiceError('Нет связи с сервисом AI, попробуйте позже')

    text = response.choices[0].message.content
    if not text:
        raise AIServiceError('AI вернул пустой ответ, попробуйте ещё раз')

    # ответ не поместился в MAX_TOKENS: честно предупреждаем об этом
    if response.choices[0].finish_reason == 'length':
        text = text + '\n\n(Ответ получился слишком длинным и был обрезан)'
    return text


def recognize_place(image):
    # картинку нужно отправить как текст в формате base64
    image_data = base64.b64encode(image.read()).decode('utf-8')

    content = [
        {
            'type': 'text',
            'text': 'Определи, какое место или достопримечательность на фото. '
                    'Ответь только JSON, без другого текста, в таком виде: '
                    '{"name": "название", "city": "город", "tags": ["тег", "тег"]}. '
                    'Значения пиши на русском языке.',
        },
        {
            'type': 'image_url',
            'image_url': {
                'url': 'data:' + image.content_type + ';base64,' + image_data,
            },
        },
    ]
    text = ask_groq(content)

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
        'Если подходящего тура в списке нет, так и скажи. Отвечай кратко.\n\n'
        'Список туров:\n' + tours_text + '\n\n'
        'Вопрос клиента: ' + question
    )
    return ask_groq(content)


def make_trip_plan(city, days, budget, interests):
    content = (
        'Составь короткий план поездки по дням на русском языке: '
        'на каждый день 2-3 пункта, общая длина до 300 слов.\n'
        'Город: ' + city + '\n'
        'Количество дней: ' + str(days) + '\n'
        'Бюджет: ' + str(budget) + '\n'
        'Интересы: ' + interests
    )
    return ask_groq(content)
