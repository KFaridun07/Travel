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
