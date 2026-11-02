// Работа с сервером и хранение токенов

function readStorage(name) {
    // в приватном режиме браузер может запретить хранилище
    try {
        return localStorage.getItem(name);
    } catch (error) {
        return null;
    }
}

function writeStorage(name, value) {
    try {
        if (value === null) {
            localStorage.removeItem(name);
        } else {
            localStorage.setItem(name, value);
        }
    } catch (error) {
        // без хранилища сайт тоже работает, просто ничего не запоминает
    }
}

function saveTokens(access, refresh) {
    writeStorage('access', access);
    writeStorage('refresh', refresh);
}

function clearTokens() {
    writeStorage('access', null);
    writeStorage('refresh', null);
}

// Превращаем ответ сервера с ошибкой в обычный текст
function errorText(data) {
    if (!data) {
        return t('networkError');
    }
    if (typeof data === 'string') {
        return data;
    }

    var lines = [];
    for (var name in data) {
        var value = data[name];
        if (Array.isArray(value)) {
            for (var i = 0; i < value.length; i++) {
                if (typeof value[i] === 'string') {
                    lines.push(value[i]);
                }
            }
        } else if (typeof value === 'string' && name !== 'code') {
            lines.push(value);
        }
    }
    return lines.join('\n');
}

// Токен refresh можно использовать только один раз,
// поэтому несколько запросов сразу должны дождаться одного обновления
var refreshInProgress = null;

async function refreshTokens() {
    if (refreshInProgress === null) {
        refreshInProgress = requestNewTokens();
    }
    try {
        return await refreshInProgress;
    } finally {
        refreshInProgress = null;
    }
}

// Получаем новый access по токену refresh
async function requestNewTokens() {
    var refresh = readStorage('refresh');
    if (!refresh) {
        return false;
    }

    var response = await fetch('/api/auth/refresh/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refresh })
    });
    if (!response.ok) {
        clearTokens();
        return false;
    }

    var data = await response.json();
    saveTokens(data.access, data.refresh);
    return true;
}

async function sendRequest(path, options) {
    var settings = { method: options.method || 'GET', headers: {} };

    var token = readStorage('access');
    if (token) {
        settings.headers['Authorization'] = 'Bearer ' + token;
    }

    // form — это форма с файлом, json — обычные данные
    if (options.form) {
        settings.body = options.form;
    } else if (options.json) {
        settings.headers['Content-Type'] = 'application/json';
        settings.body = JSON.stringify(options.json);
    }

    return fetch('/api' + path, settings);
}

// Главная функция: отправляет запрос и возвращает данные или бросает ошибку
async function api(path, options) {
    if (!options) {
        options = {};
    }

    var response;
    try {
        response = await sendRequest(path, options);

        // access истёк: один раз пробуем обновить его и повторить запрос
        if (response.status === 401 && readStorage('refresh')) {
            var refreshed = await refreshTokens();
            // refresh тоже истёк: вошедшего пользователя просим войти заново
            if (!refreshed && state.user) {
                state.user = null;
                location.hash = '#/login';
            }
            response = await sendRequest(path, options);
        }
    } catch (error) {
        throw new Error(t('networkError'));
    }

    // у ответа 204 нет содержимого
    if (response.status === 204) {
        return null;
    }

    var data = null;
    try {
        data = await response.json();
    } catch (error) {
        data = null;
    }

    if (!response.ok) {
        var apiError = new Error(errorText(data));
        apiError.status = response.status;
        throw apiError;
    }
    return data;
}
