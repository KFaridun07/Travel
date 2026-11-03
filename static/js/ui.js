// Общие функции, которыми пользуются все страницы

var state = {
    user: null,
    lang: 'ru',
    // туры в избранном у туриста: номер тура -> номер записи в избранном
    favorites: {}
};

// Номер текущего показа: старый ответ сервера не должен заменить новую страницу
var renderNumber = 0;

var mainElement = document.getElementById('main');

// ---------- Текст и числа ----------

function t(key) {
    return TRANSLATIONS[state.lang][key] || TRANSLATIONS.ru[key] || key;
}

// Защита: текст от пользователя нельзя вставлять в страницу как HTML
function esc(value) {
    var text = String(value === null || value === undefined ? '' : value);
    text = text.replace(/&/g, '&amp;');
    text = text.replace(/</g, '&lt;');
    text = text.replace(/>/g, '&gt;');
    text = text.replace(/"/g, '&quot;');
    text = text.replace(/'/g, '&#39;');
    return text;
}

function byId(id) {
    return document.getElementById(id);
}

function formValue(id) {
    return byId(id).value.trim();
}

function currentLocale() {
    if (state.lang === 'en') {
        return 'en-GB';
    }
    return state.lang === 'tg' ? 'tg-TJ' : 'ru-RU';
}

// Дату без времени читаем как местную, иначе браузер может сдвинуть её на день
function readDate(value) {
    if (String(value).length === 10) {
        return new Date(value + 'T00:00:00');
    }
    return new Date(value);
}

// В браузерах часто нет таджикских названий месяцев, поэтому храним их сами
var TAJIK_MONTHS = ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];

function formatDate(value) {
    var date = readDate(value);
    if (state.lang === 'tg') {
        return date.getDate() + ' ' + TAJIK_MONTHS[date.getMonth()] + ' ' + date.getFullYear();
    }
    return date.toLocaleDateString(currentLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatShortDate(value) {
    var date = readDate(value);
    if (state.lang === 'tg') {
        return date.getDate() + ' ' + TAJIK_MONTHS[date.getMonth()];
    }
    return date.toLocaleDateString(currentLocale(), { day: 'numeric', month: 'short' });
}

function formatPrice(value) {
    return Number(value).toLocaleString('ru-RU') + ' ' + t('currency');
}

// Сегодняшняя дата в виде ГГГГ-ММ-ДД: такие даты можно сравнивать как текст
function todayText() {
    var now = new Date();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    return now.getFullYear() + '-' + month + '-' + day;
}

// Дата окончания тура: первый день уже входит в длительность
function tourEndDate(tour) {
    var date = readDate(tour.start_date);
    date.setDate(date.getDate() + Number(tour.days) - 1);
    return date;
}

function isRole(role) {
    return state.user !== null && state.user.role === role;
}

// Адрес файла из папки static
function staticUrl(path) {
    return STATIC_URL + path;
}

// Параметры из адреса после ?: например #/tours?city=Душанбе
function currentQuery() {
    var hash = location.hash.slice(1);
    var position = hash.indexOf('?');
    return new URLSearchParams(position === -1 ? '' : hash.slice(position + 1));
}

function setTitle(text) {
    document.title = text ? text + ' · TravelMate' : 'TravelMate';
}

function splitTags(text) {
    var result = [];
    var parts = String(text || '').split(',');
    for (var i = 0; i < parts.length; i++) {
        if (parts[i].trim()) {
            result.push(parts[i].trim());
        }
    }
    return result;
}

// Убираем разметку Markdown из ответа AI, потому что показываем обычный текст
function cleanAiText(text) {
    var result = String(text);
    result = result.replace(/\*\*/g, '');
    result = result.replace(/^#+\s*/gm, '');
    return result;
}

// Большая фотография заходит под прозрачную шапку
function setCoverPage(enabled) {
    document.body.classList.toggle('has-cover', enabled);
}

// Меняем размытую фотографию на фоне: новый снимок плавно проявляется поверх старого
function setAmbient(url) {
    var layers = document.querySelectorAll('#ambient div');
    var next = layers[0].classList.contains('active') ? layers[1] : layers[0];
    var other = next === layers[0] ? layers[1] : layers[0];
    next.style.backgroundImage = 'url("' + encodeURI(url) + '")';
    next.classList.add('active');
    other.classList.remove('active');
}

// Блокируем кнопку на время запроса, чтобы его не отправили дважды
function setBusy(button, busy) {
    button.disabled = busy;
}

// ---------- Значки ----------

var ICONS = {
    home: '<path d="m3.5 11 8.5-7 8.5 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-6h4v6"/>',
    expand: '<path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    clip: '<path d="m20 11.5-8.2 8.2a5 5 0 0 1-7-7l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.6-7.6"/>',
    checks: '<path d="m2.5 12.5 4.5 4.5L16.5 7"/><path d="m11 16 1 1 9.5-10"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    heart: '<path d="M12 20.5s-8.5-5-8.5-11.2A4.8 4.8 0 0 1 12 6.4a4.8 4.8 0 0 1 8.5 2.9c0 6.2-8.5 11.2-8.5 11.2z"/>',
    pin: '<path d="M12 21.5s7-6.2 7-11.5a7 7 0 1 0-14 0c0 5.3 7 11.5 7 11.5z"/><circle cx="12" cy="10" r="2.5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.8 3-6 6.5-6s6 2.2 6.5 6"/><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.5c1.7.9 2.7 2.8 3 5.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.7-4.2 3.8-6.5 8-6.5s7.3 2.3 8 6.5"/>',
    star: '<path d="m12 3 2.7 5.8 6.3.8-4.6 4.3 1.2 6.3L12 17l-5.6 3.2 1.2-6.3L3 9.6l6.3-.8z"/>',
    arrow: '<path d="M4 12h16M14 6l6 6-6 6"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    send: '<path d="M4 12h15M13 6l6 6-6 6"/>',
    spark: '<path d="M12 3c.6 4.8 3.2 7.4 8 8-4.8.6-7.4 3.2-8 8-.6-4.8-3.2-7.4-8-8 4.8-.6 7.4-3.2 8-8z"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
    route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5"/>',
    chat: '<path d="M4 5h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 3.5V6a1 1 0 0 1 1-1z"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    play: '<path d="m7 4 13 8-13 8z"/>',
    compass: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    ticket: '<path d="M3 8a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2.5a1.5 1.5 0 0 0 0 3V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2.5a1.5 1.5 0 0 0 0-3z"/><path d="M14 7v10"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'
};

function icon(name) {
    return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>';
}

function logoHtml() {
    return '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="16" fill="#0d7a72"/><path d="M5 24 13 10.5l4.6 7.2 2.6-3.6L27 24z" fill="#fff"/></svg>TravelMate';
}

function starsHtml(rating) {
    var html = '<span class="stars" role="img" aria-label="' + rating + '/5">';
    for (var i = 1; i <= 5; i++) {
        html = html + '<svg class="icon' + (i <= rating ? ' filled' : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONS.star + '</svg>';
    }
    return html + '</span>';
}
