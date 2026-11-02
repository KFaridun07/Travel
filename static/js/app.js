// Страницы сайта: адрес после # решает, какую страницу показать

var state = {
    user: null,
    lang: 'ru',
    tourFilters: {},
    aiTab: 'chat'
};

// Номер текущего показа: старый ответ сервера не должен заменить новую страницу
var renderNumber = 0;

var mainElement = document.getElementById('main');

// ---------- Вспомогательные функции ----------

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

function formatDate(value) {
    var date = new Date(value);
    var locale = state.lang === 'en' ? 'en-GB' : state.lang === 'tg' ? 'tg-TJ' : 'ru-RU';
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatPrice(value) {
    return Number(value).toLocaleString('ru-RU') + ' ' + t('currency');
}

function showToast(message) {
    var toast = byId('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(hideToast, 3000);
}

function hideToast() {
    byId('toast').classList.remove('show');
}

function isRole(role) {
    return state.user !== null && state.user.role === role;
}

function emptyBlock(text) {
    return '<p class="empty">' + esc(text) + '</p>';
}

function field(label, id, attributes) {
    return '<div class="field"><label for="' + id + '">' + esc(label) + '</label>' +
        '<input id="' + id + '" ' + (attributes || '') + '></div>';
}

function textField(label, id, value, required) {
    return '<div class="field"><label for="' + id + '">' + esc(label) + '</label>' +
        '<textarea id="' + id + '"' + (required ? ' required' : '') + '>' + esc(value || '') + '</textarea></div>';
}

// Значение для атрибута value у поля
function valueAttr(value) {
    return 'value="' + esc(value === null || value === undefined ? '' : value) + '"';
}

// Убираем разметку Markdown из ответа AI, потому что показываем обычный текст
function cleanAiText(text) {
    var result = String(text);
    result = result.replace(/\*\*/g, '');
    result = result.replace(/^#+\s*/gm, '');
    return result;
}

// Рисунок гор вместо картинки: цвет зависит от номера записи
function artBlock(image, id) {
    if (image) {
        return '<span class="art"><img src="' + esc(image) + '" alt="" loading="lazy"></span>';
    }
    return '<span class="art art-' + (id % 5) + '">' +
        '<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' +
        '<path class="far" d="M0 130 62 62l42 42 56-74 62 76 40-32 58 62v44H0z"/>' +
        '<path class="near" d="M0 180v-34l52-34 54 38 62-58 70 58 40-22 42 28v24z"/>' +
        '</svg></span>';
}

function statusBadge(status) {
    var names = { pending: 'statusPending', confirmed: 'statusConfirmed', cancelled: 'statusCancelled' };
    return '<span class="status status-' + esc(status) + '">' + esc(t(names[status])) + '</span>';
}

function ratingText(tour) {
    if (!tour.average_rating) {
        return t('noRating');
    }
    return '★ ' + tour.average_rating;
}

function tourCard(tour) {
    return '<a class="card" href="#/tour/' + tour.id + '">' +
        artBlock(tour.image, tour.id) +
        '<div class="card-body">' +
        '<h3>' + esc(tour.title) + '</h3>' +
        '<div class="card-meta">' + esc(tour.place_city) + ' · ' + tour.days + ' ' + esc(t('dayShort')) + ' · ' + esc(formatDate(tour.start_date)) + '</div>' +
        '<div class="card-foot"><span class="price">' + esc(formatPrice(tour.price)) + '</span>' +
        '<span class="card-meta">' + esc(ratingText(tour)) + '</span></div>' +
        '<div class="card-meta">' + esc(t('freePlaces')) + ': ' + tour.free_places + '</div>' +
        '</div></a>';
}

function toursGrid(tours, emptyKey) {
    if (tours.length === 0) {
        return emptyBlock(t(emptyKey));
    }
    var html = '<div class="grid">';
    for (var i = 0; i < tours.length; i++) {
        html = html + tourCard(tours[i]);
    }
    return html + '</div>';
}

function showLoading() {
    mainElement.innerHTML = '<p class="loading">' + esc(t('loading')) + '</p>';
}

function showPageError(error) {
    mainElement.innerHTML = emptyBlock(error.message);
}

// Страница, для которой нужно войти в аккаунт
function needLoginPage() {
    mainElement.innerHTML = '<div class="empty"><p>' + esc(t('needLogin')) + '</p>' +
        '<a class="button" href="#/login">' + esc(t('login')) + '</a></div>';
}

// Блокируем кнопку на время запроса, чтобы его не отправили дважды
function setBusy(button, busy) {
    button.disabled = busy;
}

// ---------- Шапка и подвал ----------

var ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
var ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/></svg>';

function navLink(href, key, route) {
    var active = route === href ? ' class="active" aria-current="page"' : '';
    return '<a href="#' + href + '"' + active + '>' + esc(t(key)) + '</a>';
}

function renderHeader() {
    var route = location.hash.slice(1) || '/';
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var themeLabel = dark ? t('themeToLight') : t('themeToDark');

    var links = navLink('/', 'tours', route) + navLink('/places', 'places', route);
    if (state.user) {
        if (isRole('tourist')) {
            links = links + navLink('/favorites', 'favorites', route);
        }
        links = links + navLink('/bookings', 'bookings', route) + navLink('/ai', 'ai', route);
    } else {
        links = links + navLink('/ai', 'ai', route);
    }

    var account = '';
    if (state.user) {
        account = '<a class="link-button" href="#/profile">' + esc(state.user.username) + '</a>' +
            '<button class="link-button" type="button" id="logout-button">' + esc(t('logout')) + '</button>';
    } else {
        account = '<a class="link-button" href="#/login">' + esc(t('login')) + '</a>' +
            '<a class="button small" href="#/register">' + esc(t('register')) + '</a>';
    }

    byId('site-header').innerHTML = '<div class="header-row">' +
        '<a class="logo" href="#/"><svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="var(--accent)"/><path d="M4 25 13 10l5 8 3-4 7 11z" fill="var(--accent-text)"/></svg>TravelMate</a>' +
        '<nav class="nav" aria-label="' + esc(t('tours')) + '">' + links + '</nav>' +
        '<div class="header-tools">' + account +
        '<select class="lang-select" id="lang-select" aria-label="' + esc(t('language')) + '">' +
        '<option value="ru"' + (state.lang === 'ru' ? ' selected' : '') + '>RU</option>' +
        '<option value="en"' + (state.lang === 'en' ? ' selected' : '') + '>EN</option>' +
        '<option value="tg"' + (state.lang === 'tg' ? ' selected' : '') + '>TJ</option>' +
        '</select>' +
        '<button class="icon-button" type="button" id="theme-button" aria-label="' + esc(themeLabel) + '" title="' + esc(themeLabel) + '">' + (dark ? ICON_SUN : ICON_MOON) + '</button>' +
        '</div></div>';

    byId('theme-button').addEventListener('click', toggleTheme);
    byId('lang-select').addEventListener('change', changeLanguage);
    if (byId('logout-button')) {
        byId('logout-button').addEventListener('click', logout);
    }

    byId('skip-link').textContent = t('skip');
    byId('site-footer').innerHTML = 'TravelMate · <a href="/swagger/">' + esc(t('footerApi')) + '</a>';
}

function toggleTheme() {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var theme = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    writeStorage('theme', theme);
    renderHeader();
    byId('theme-button').focus();
}

function changeLanguage(event) {
    setLanguage(event.target.value);
    writeStorage('lang', state.lang);
    render();
}

function setLanguage(lang) {
    state.lang = lang;
    // для таджикского браузеру сообщаем код tg
    document.documentElement.setAttribute('lang', lang);
}

async function logout() {
    var refresh = readStorage('refresh');
    try {
        if (refresh) {
            await api('/auth/logout/', { method: 'POST', json: { refresh: refresh } });
        }
    } catch (error) {
        // даже если сервер не ответил, на этом устройстве всё равно выходим
    }
    clearTokens();
    state.user = null;
    location.hash = '#/';
    render();
}

// ---------- Туры ----------

async function toursPage(number) {
    var filters = state.tourFilters;
    var newButton = isRole('guide') ? '<a class="button" href="#/tours/new">' + esc(t('newTour')) + '</a>' : '';

    mainElement.innerHTML = '<div class="section-head"><div class="hero"><h1>' + esc(t('heroTitle')) + '</h1><p>' + esc(t('heroText')) + '</p></div>' + newButton + '</div>' +
        '<form class="panel filters" id="tour-filters">' +
        field(t('search'), 'filter-search', 'placeholder="' + esc(t('searchTour')) + '" ' + valueAttr(filters.search)) +
        field(t('city'), 'filter-city', valueAttr(filters.city)) +
        field(t('priceMin'), 'filter-price-min', 'type="number" min="0" step="any" ' + valueAttr(filters.price_min)) +
        field(t('priceMax'), 'filter-price-max', 'type="number" min="0" step="any" ' + valueAttr(filters.price_max)) +
        field(t('days'), 'filter-days', 'type="number" min="1" step="1" ' + valueAttr(filters.days)) +
        '<div class="form-actions"><button class="button" type="submit">' + esc(t('find')) + '</button>' +
        '<button class="button secondary" type="button" id="filter-reset">' + esc(t('reset')) + '</button></div>' +
        '</form><div id="tour-list" aria-live="polite"><p class="loading">' + esc(t('loading')) + '</p></div>';

    byId('tour-filters').addEventListener('submit', submitTourFilters);
    byId('filter-reset').addEventListener('click', resetTourFilters);
    await loadTours(number);
}

async function loadTours(number) {
    var filters = state.tourFilters;
    var query = new URLSearchParams();
    for (var name in filters) {
        if (filters[name]) {
            query.set(name, filters[name]);
        }
    }

    var list = byId('tour-list');
    try {
        var tours = await api('/tours/?' + query.toString());
        if (number !== renderNumber) {
            return;
        }
        list.innerHTML = toursGrid(tours, 'emptyTours');
    } catch (error) {
        if (number === renderNumber) {
            list.innerHTML = emptyBlock(error.message);
        }
    }
}

function submitTourFilters(event) {
    event.preventDefault();
    state.tourFilters = {
        search: formValue('filter-search'),
        city: formValue('filter-city'),
        price_min: formValue('filter-price-min'),
        price_max: formValue('filter-price-max'),
        days: formValue('filter-days')
    };
    loadTours(renderNumber);
}

function resetTourFilters() {
    state.tourFilters = {};
    render();
}

async function tourPage(id, number) {
    showLoading();

    var tour;
    var reviews;
    var favorites = [];
    try {
        tour = await api('/tours/' + id + '/');
        reviews = await api('/reviews/?tour=' + id);
        if (state.user) {
            favorites = await api('/favorites/');
        }
    } catch (error) {
        if (number === renderNumber) {
            showPageError(error);
        }
        return;
    }
    if (number !== renderNumber) {
        return;
    }

    // ищем этот тур в избранном обычным циклом
    var favoriteId = null;
    for (var i = 0; i < favorites.length; i++) {
        if (favorites[i].tour === tour.id) {
            favoriteId = favorites[i].id;
        }
    }

    var canEdit = isRole('admin') || (state.user !== null && state.user.id === tour.guide);
    var ownerButtons = '';
    if (canEdit) {
        ownerButtons = '<div class="row-actions"><a class="button secondary small" href="#/tour/' + tour.id + '/edit">' + esc(t('edit')) + '</a>' +
            '<button class="button danger small" type="button" id="tour-delete">' + esc(t('delete')) + '</button></div>';
    }

    var reviewsHtml = '';
    if (reviews.length === 0) {
        reviewsHtml = '<p class="hint">' + esc(t('emptyReviews')) + '</p>';
    }
    for (var r = 0; r < reviews.length; r++) {
        var review = reviews[r];
        var stars = '★★★★★'.slice(0, review.rating) + '☆☆☆☆☆'.slice(0, 5 - review.rating);
        reviewsHtml = reviewsHtml + '<article class="review"><div><span class="stars" aria-label="' + review.rating + '/5">' + stars + '</span> <strong>' + esc(review.username) + '</strong></div>' +
            '<p>' + esc(review.text) + '</p><div class="hint">' + esc(formatDate(review.created_at)) + '</div></article>';
    }

    var reviewForm = '';
    if (isRole('tourist')) {
        reviewForm = '<form class="panel stack" id="review-form"><h3>' + esc(t('writeReview')) + '</h3>' +
            '<p class="hint">' + esc(t('reviewHint')) + '</p>' +
            '<div class="field"><label for="review-rating">' + esc(t('yourRating')) + '</label><select id="review-rating">' +
            '<option value="5">★★★★★</option><option value="4">★★★★</option><option value="3">★★★</option><option value="2">★★</option><option value="1">★</option></select></div>' +
            textField(t('reviewText'), 'review-text', '', true) +
            '<p class="form-error" id="review-error" role="alert"></p>' +
            '<div><button class="button" type="submit">' + esc(t('send')) + '</button></div></form>';
    }

    var favoriteButton = '';
    if (isRole('tourist')) {
        favoriteButton = '<button class="button secondary" type="button" id="favorite-button">' + esc(favoriteId ? t('removeFavorite') : t('addFavorite')) + '</button>';
    }

    mainElement.innerHTML = '<div class="section-head"><h1>' + esc(tour.title) + '</h1>' + ownerButtons + '</div>' +
        '<div class="tour-layout"><div>' + artBlock(tour.image, tour.id) +
        '<dl class="facts">' +
        '<div><dt>' + esc(t('place')) + '</dt><dd>' + esc(tour.place_name) + ', ' + esc(tour.place_city) + '</dd></div>' +
        '<div><dt>' + esc(t('start')) + '</dt><dd>' + esc(formatDate(tour.start_date)) + '</dd></div>' +
        '<div><dt>' + esc(t('days')) + '</dt><dd>' + tour.days + '</dd></div>' +
        '<div><dt>' + esc(t('guide')) + '</dt><dd>' + esc(tour.guide_name) + '</dd></div>' +
        '<div><dt>' + esc(t('rating')) + '</dt><dd>' + esc(ratingText(tour)) + '</dd></div>' +
        '</dl><p>' + esc(tour.description) + '</p>' +
        '<h2>' + esc(t('reviews')) + '</h2><div class="stack">' + reviewForm + '<div>' + reviewsHtml + '</div></div></div>' +
        '<aside class="side"><div class="panel stack"><div><div class="big-price">' + esc(formatPrice(tour.price)) + '</div><div class="hint">' + esc(t('perPerson')) + '</div></div>' +
        '<div>' + esc(t('freePlaces')) + ': <strong>' + tour.free_places + '</strong> / ' + tour.max_people + '</div>' +
        bookingBlock(tour) + favoriteButton + '</div></aside></div>';

    if (canEdit) {
        byId('tour-delete').addEventListener('click', function () {
            deleteTour(tour.id);
        });
    }
    if (byId('favorite-button')) {
        byId('favorite-button').addEventListener('click', function () {
            toggleFavorite(tour.id, favoriteId);
        });
    }
    if (byId('review-form')) {
        byId('review-form').addEventListener('submit', function (event) {
            submitReview(event, tour.id);
        });
    }
    if (byId('booking-form')) {
        byId('booking-form').addEventListener('submit', function (event) {
            submitBooking(event, tour.id);
        });
        byId('booking-people').addEventListener('input', function () {
            updateBookingTotal(tour.price);
        });
        updateBookingTotal(tour.price);
    }
}

function bookingBlock(tour) {
    // дату сравниваем как текст: формат ГГГГ-ММ-ДД это позволяет
    var today = new Date().toISOString().slice(0, 10);
    if (tour.start_date <= today) {
        return '<p class="hint">' + esc(t('tourStarted')) + '</p>';
    }
    if (tour.free_places <= 0) {
        return '<p class="hint">' + esc(t('noPlaces')) + '</p>';
    }
    if (!state.user) {
        return '<p class="hint">' + esc(t('loginToBook')) + '</p><a class="button" href="#/login">' + esc(t('login')) + '</a>';
    }
    if (!isRole('tourist')) {
        return '<p class="hint">' + esc(t('onlyTouristBook')) + '</p>';
    }
    return '<form class="stack" id="booking-form">' +
        field(t('peopleCount'), 'booking-people', 'type="number" min="1" max="' + tour.free_places + '" value="1" required') +
        '<div>' + esc(t('total')) + ': <strong id="booking-total"></strong></div>' +
        '<p class="form-error" id="booking-error" role="alert"></p>' +
        '<button class="button" type="submit">' + esc(t('book')) + '</button></form>';
}

function updateBookingTotal(price) {
    var count = Number(byId('booking-people').value) || 0;
    byId('booking-total').textContent = formatPrice(Number(price) * count);
}

async function submitBooking(event, tourId) {
    event.preventDefault();
    var button = event.target.querySelector('button[type="submit"]');
    setBusy(button, true);
    byId('booking-error').textContent = '';
    try {
        await api('/bookings/', { method: 'POST', json: { tour: tourId, people_count: Number(formValue('booking-people')) } });
        showToast(t('booked'));
        location.hash = '#/bookings';
    } catch (error) {
        byId('booking-error').textContent = error.message;
        setBusy(button, false);
    }
}

async function toggleFavorite(tourId, favoriteId) {
    try {
        if (favoriteId) {
            await api('/favorites/' + favoriteId + '/', { method: 'DELETE' });
            showToast(t('favoriteRemoved'));
        } else {
            await api('/favorites/', { method: 'POST', json: { tour: tourId } });
            showToast(t('favoriteAdded'));
        }
        render();
    } catch (error) {
        showToast(error.message);
    }
}

async function submitReview(event, tourId) {
    event.preventDefault();
    var button = event.target.querySelector('button[type="submit"]');
    setBusy(button, true);
    byId('review-error').textContent = '';
    try {
        await api('/reviews/', { method: 'POST', json: { tour: tourId, rating: Number(byId('review-rating').value), text: formValue('review-text') } });
        showToast(t('reviewSent'));
        render();
    } catch (error) {
        byId('review-error').textContent = error.message;
        setBusy(button, false);
    }
}

async function deleteTour(id) {
    if (!confirm(t('confirmDelete'))) {
        return;
    }
    try {
        await api('/tours/' + id + '/', { method: 'DELETE' });
        showToast(t('deleted'));
        location.hash = '#/';
    } catch (error) {
        showToast(error.message);
    }
}

// Форма создания и изменения тура
async function tourFormPage(id, number) {
    if (!state.user) {
        needLoginPage();
        return;
    }
    showLoading();

    var tour = null;
    var places;
    try {
        places = await api('/places/');
        if (id) {
            tour = await api('/tours/' + id + '/');
        }
    } catch (error) {
        if (number === renderNumber) {
            showPageError(error);
        }
        return;
    }
    if (number !== renderNumber) {
        return;
    }
    if (places.length === 0) {
        mainElement.innerHTML = emptyBlock(t('noPlacesYet'));
        return;
    }

    var values = tour || {};
    var options = '';
    for (var i = 0; i < places.length; i++) {
        var selected = values.place === places[i].id ? ' selected' : '';
        options = options + '<option value="' + places[i].id + '"' + selected + '>' + esc(places[i].name) + ', ' + esc(places[i].city) + '</option>';
    }

    mainElement.innerHTML = '<div class="medium"><h1 class="page-title">' + esc(id ? t('editTour') : t('newTour')) + '</h1>' +
        '<form class="panel stack" id="tour-form">' +
        field(t('title'), 'tour-title', 'required maxlength="200" ' + valueAttr(values.title)) +
        textField(t('description'), 'tour-description', values.description, true) +
        '<div class="field"><label for="tour-place">' + esc(t('place')) + '</label><select id="tour-place">' + options + '</select></div>' +
        '<div class="form-grid">' +
        field(t('price'), 'tour-price', 'type="number" min="0" step="0.01" required ' + valueAttr(values.price)) +
        field(t('days'), 'tour-days', 'type="number" min="1" required ' + valueAttr(values.days)) +
        field(t('maxPeople'), 'tour-max', 'type="number" min="1" required ' + valueAttr(values.max_people)) +
        field(t('startDate'), 'tour-date', 'type="date" required ' + valueAttr(values.start_date)) +
        '</div>' +
        field(t('image') + ' (' + t('optional') + ')', 'tour-image', 'type="file" accept="image/*"') +
        '<p class="form-error" id="tour-error" role="alert"></p>' +
        '<div class="row-actions"><button class="button" type="submit">' + esc(t('save')) + '</button>' +
        '<a class="button secondary" href="' + (id ? '#/tour/' + id : '#/') + '">' + esc(t('cancel')) + '</a></div></form></div>';

    byId('tour-form').addEventListener('submit', function (event) {
        submitTourForm(event, id);
    });
}

async function submitTourForm(event, id) {
    event.preventDefault();
    var button = event.target.querySelector('button[type="submit"]');
    setBusy(button, true);
    byId('tour-error').textContent = '';

    // туры отправляем формой, потому что в них может быть картинка
    var form = new FormData();
    form.append('title', formValue('tour-title'));
    form.append('description', formValue('tour-description'));
    form.append('place', byId('tour-place').value);
    form.append('price', formValue('tour-price'));
    form.append('days', formValue('tour-days'));
    form.append('max_people', formValue('tour-max'));
    form.append('start_date', formValue('tour-date'));
    if (byId('tour-image').files.length > 0) {
        form.append('image', byId('tour-image').files[0]);
    }

    try {
        var saved;
        if (id) {
            saved = await api('/tours/' + id + '/', { method: 'PATCH', form: form });
        } else {
            saved = await api('/tours/', { method: 'POST', form: form });
        }
        showToast(t('saved'));
        location.hash = '#/tour/' + saved.id;
    } catch (error) {
        byId('tour-error').textContent = error.message;
        setBusy(button, false);
    }
}

// ---------- Места ----------

async function placesPage(number) {
    var addForm = '';
    if (isRole('admin')) {
        addForm = '<details class="panel" style="margin-bottom:18px"><summary>' + esc(t('newPlace')) + '</summary>' +
            '<form class="stack" id="place-form" style="margin-top:14px">' +
            field(t('title'), 'place-name', 'required maxlength="200"') +
            field(t('city'), 'place-city', 'required maxlength="100"') +
            textField(t('description'), 'place-description', '', true) +
            field(t('tagsField'), 'place-tags', 'maxlength="300"') +
            field(t('image') + ' (' + t('optional') + ')', 'place-image', 'type="file" accept="image/*"') +
            '<p class="form-error" id="place-error" role="alert"></p>' +
            '<div><button class="button" type="submit">' + esc(t('save')) + '</button></div></form></details>';
    }

    mainElement.innerHTML = '<h1 class="page-title">' + esc(t('places')) + '</h1>' + addForm +
        '<form class="panel form-grid" id="place-filters">' +
        field(t('search'), 'place-search', 'placeholder="' + esc(t('searchPlace')) + '"') +
        field(t('city'), 'place-filter-city', '') +
        '<button class="button" type="submit">' + esc(t('find')) + '</button>' +
        '</form><div id="place-list" aria-live="polite"><p class="loading">' + esc(t('loading')) + '</p></div>';

    byId('place-filters').addEventListener('submit', function (event) {
        event.preventDefault();
        loadPlaces(renderNumber);
    });
    if (byId('place-form')) {
        byId('place-form').addEventListener('submit', submitPlace);
    }
    await loadPlaces(number);
}

async function loadPlaces(number) {
    var query = new URLSearchParams();
    if (formValue('place-search')) {
        query.set('search', formValue('place-search'));
    }
    if (formValue('place-filter-city')) {
        query.set('city', formValue('place-filter-city'));
    }

    var list = byId('place-list');
    try {
        var places = await api('/places/?' + query.toString());
        if (number !== renderNumber) {
            return;
        }
        if (places.length === 0) {
            list.innerHTML = emptyBlock(t('emptyPlaces'));
            return;
        }

        var html = '<div class="grid">';
        for (var i = 0; i < places.length; i++) {
            html = html + placeCard(places[i]);
        }
        list.innerHTML = html + '</div>';

        // кнопки появляются после отрисовки, поэтому подключаем их здесь
        var cityButtons = list.querySelectorAll('[data-city]');
        for (var c = 0; c < cityButtons.length; c++) {
            cityButtons[c].addEventListener('click', openPlaceTours);
        }
        var deleteButtons = list.querySelectorAll('[data-delete-place]');
        for (var d = 0; d < deleteButtons.length; d++) {
            deleteButtons[d].addEventListener('click', deletePlace);
        }
    } catch (error) {
        if (number === renderNumber) {
            list.innerHTML = emptyBlock(error.message);
        }
    }
}

function placeCard(place) {
    var tagsHtml = '';
    var tags = (place.tags || '').split(',');
    for (var i = 0; i < tags.length; i++) {
        if (tags[i].trim()) {
            tagsHtml = tagsHtml + '<span class="tag">' + esc(tags[i].trim()) + '</span>';
        }
    }

    var deleteButton = '';
    if (isRole('admin')) {
        deleteButton = '<button class="button danger small" type="button" data-delete-place="' + place.id + '">' + esc(t('delete')) + '</button>';
    }

    return '<article class="card">' + artBlock(place.image, place.id) +
        '<div class="card-body"><h3>' + esc(place.name) + '</h3>' +
        '<div class="card-meta">' + esc(place.city) + '</div>' +
        '<p>' + esc(place.description) + '</p>' +
        '<div class="tags">' + tagsHtml + '</div>' +
        '<div class="card-foot"><button class="button secondary small" type="button" data-city="' + esc(place.city) + '">' + esc(t('showTours')) + '</button>' + deleteButton + '</div>' +
        '</div></article>';
}

function openPlaceTours(event) {
    state.tourFilters = { city: event.currentTarget.getAttribute('data-city') };
    location.hash = '#/';
}

async function deletePlace(event) {
    var id = event.currentTarget.getAttribute('data-delete-place');
    if (!confirm(t('confirmDelete'))) {
        return;
    }
    try {
        await api('/places/' + id + '/', { method: 'DELETE' });
        showToast(t('deleted'));
        loadPlaces(renderNumber);
    } catch (error) {
        showToast(error.message);
    }
}

async function submitPlace(event) {
    event.preventDefault();
    var button = event.target.querySelector('button[type="submit"]');
    setBusy(button, true);
    byId('place-error').textContent = '';

    var form = new FormData();
    form.append('name', formValue('place-name'));
    form.append('city', formValue('place-city'));
    form.append('description', formValue('place-description'));
    form.append('tags', formValue('place-tags'));
    if (byId('place-image').files.length > 0) {
        form.append('image', byId('place-image').files[0]);
    }

    try {
        await api('/places/', { method: 'POST', form: form });
        showToast(t('saved'));
        render();
    } catch (error) {
        byId('place-error').textContent = error.message;
        setBusy(button, false);
    }
}

// ---------- Избранное ----------

async function favoritesPage(number) {
    if (!state.user) {
        needLoginPage();
        return;
    }
    showLoading();
    try {
        var favorites = await api('/favorites/');
        var allTours = await api('/tours/');
        if (number !== renderNumber) {
            return;
        }

        // оставляем только туры из избранного
        var tours = [];
        for (var i = 0; i < allTours.length; i++) {
            for (var f = 0; f < favorites.length; f++) {
                if (favorites[f].tour === allTours[i].id) {
                    tours.push(allTours[i]);
                }
            }
        }
        mainElement.innerHTML = '<h1 class="page-title">' + esc(t('favorites')) + '</h1>' + toursGrid(tours, 'emptyFavorites');
    } catch (error) {
        if (number === renderNumber) {
            showPageError(error);
        }
    }
}

// ---------- Брони ----------

var bookingStatusFilter = '';

async function bookingsPage(number) {
    if (!state.user) {
        needLoginPage();
        return;
    }

    var statusNames = [['', 'allStatuses'], ['pending', 'statusPending'], ['confirmed', 'statusConfirmed'], ['cancelled', 'statusCancelled']];
    var options = '';
    for (var i = 0; i < statusNames.length; i++) {
        var selected = statusNames[i][0] === bookingStatusFilter ? ' selected' : '';
        options = options + '<option value="' + statusNames[i][0] + '"' + selected + '>' + esc(t(statusNames[i][1])) + '</option>';
    }

    mainElement.innerHTML = '<div class="section-head"><h1>' + esc(t('bookings')) + '</h1>' +
        '<div class="field"><label for="booking-status">' + esc(t('status')) + '</label><select id="booking-status">' + options + '</select></div></div>' +
        '<div class="panel" id="booking-list" aria-live="polite"><p class="loading">' + esc(t('loading')) + '</p></div>';

    byId('booking-status').addEventListener('change', function (event) {
        bookingStatusFilter = event.target.value;
        loadBookings(renderNumber);
    });
    await loadBookings(number);
}

async function loadBookings(number) {
    var list = byId('booking-list');
    var query = bookingStatusFilter ? '?status=' + bookingStatusFilter : '';
    try {
        var bookings = await api('/bookings/' + query);
        if (number !== renderNumber) {
            return;
        }
        if (bookings.length === 0) {
            list.innerHTML = emptyBlock(t('emptyBookings'));
            return;
        }

        var html = '';
        for (var i = 0; i < bookings.length; i++) {
            html = html + bookingRow(bookings[i]);
        }
        list.innerHTML = html;

        var buttons = list.querySelectorAll('[data-action]');
        for (var b = 0; b < buttons.length; b++) {
            buttons[b].addEventListener('click', bookingAction);
        }
    } catch (error) {
        if (number === renderNumber) {
            list.innerHTML = emptyBlock(error.message);
        }
    }
}

function bookingRow(booking) {
    var actions = '';
    var canConfirm = isRole('guide') || isRole('admin');
    if (canConfirm && booking.status === 'pending') {
        actions = actions + '<button class="button small" type="button" data-action="confirm" data-id="' + booking.id + '">' + esc(t('confirmBooking')) + '</button>';
    }
    var canCancel = booking.user === state.user.id || isRole('admin');
    if (canCancel && booking.status !== 'cancelled') {
        actions = actions + '<button class="button danger small" type="button" data-action="cancel" data-id="' + booking.id + '">' + esc(t('cancelBooking')) + '</button>';
    }

    var who = '';
    if (!isRole('tourist')) {
        who = esc(t('tourist')) + ': ' + esc(booking.username) + ' · ';
    }

    return '<div class="row"><div><a href="#/tour/' + booking.tour + '"><strong>' + esc(booking.tour_title) + '</strong></a> ' + statusBadge(booking.status) +
        '<div class="card-meta">' + who + esc(t('people')) + ': ' + booking.people_count + ' · ' + esc(t('total')) + ': ' + esc(formatPrice(booking.total_price)) + ' · ' + esc(formatDate(booking.created_at)) + '</div></div>' +
        '<div class="row-actions">' + actions + '</div></div>';
}

async function bookingAction(event) {
    var button = event.currentTarget;
    var action = button.getAttribute('data-action');
    setBusy(button, true);
    try {
        await api('/bookings/' + button.getAttribute('data-id') + '/' + action + '/', { method: 'POST', json: {} });
        showToast(t(action === 'confirm' ? 'bookingConfirmed' : 'bookingCancelled'));
        loadBookings(renderNumber);
    } catch (error) {
        showToast(error.message);
        setBusy(button, false);
    }
}

// ---------- Вход, регистрация и профиль ----------

function loginPage() {
    mainElement.innerHTML = '<div class="narrow"><h1 class="page-title">' + esc(t('loginTitle')) + '</h1>' +
        '<form class="panel stack" id="login-form">' +
        field(t('username'), 'login-username', 'required autocomplete="username"') +
        field(t('password'), 'login-password', 'type="password" required autocomplete="current-password"') +
        '<p class="form-error" id="login-error" role="alert"></p>' +
        '<button class="button" type="submit">' + esc(t('login')) + '</button>' +
        '<p class="hint">' + esc(t('noAccount')) + ' <a href="#/register">' + esc(t('register')) + '</a></p></form></div>';
    byId('login-form').addEventListener('submit', submitLogin);
}

async function signIn(username, password) {
    var tokens = await api('/auth/login/', { method: 'POST', json: { username: username, password: password } });
    saveTokens(tokens.access, tokens.refresh);
    state.user = await api('/auth/me/');
    location.hash = '#/';
    render();
}

async function submitLogin(event) {
    event.preventDefault();
    var button = event.target.querySelector('button[type="submit"]');
    setBusy(button, true);
    byId('login-error').textContent = '';
    try {
        await signIn(formValue('login-username'), byId('login-password').value);
    } catch (error) {
        // сервер отвечает на это по-английски, поэтому показываем свой текст
        byId('login-error').textContent = error.status === 401 ? t('wrongLogin') : error.message;
        setBusy(button, false);
    }
}

function registerPage() {
    mainElement.innerHTML = '<div class="narrow"><h1 class="page-title">' + esc(t('registerTitle')) + '</h1>' +
        '<form class="panel stack" id="register-form">' +
        field(t('username'), 'register-username', 'required autocomplete="username"') +
        field(t('password'), 'register-password', 'type="password" required autocomplete="new-password"') +
        '<div class="field"><label for="register-role">' + esc(t('role')) + '</label><select id="register-role">' +
        '<option value="tourist">' + esc(t('roleTourist')) + '</option><option value="guide">' + esc(t('roleGuide')) + '</option></select></div>' +
        field(t('email') + ' (' + t('optional') + ')', 'register-email', 'type="email" autocomplete="email"') +
        field(t('firstName') + ' (' + t('optional') + ')', 'register-first', 'autocomplete="given-name"') +
        field(t('lastName') + ' (' + t('optional') + ')', 'register-last', 'autocomplete="family-name"') +
        '<p class="form-error" id="register-error" role="alert"></p>' +
        '<button class="button" type="submit">' + esc(t('register')) + '</button>' +
        '<p class="hint">' + esc(t('hasAccount')) + ' <a href="#/login">' + esc(t('login')) + '</a></p></form></div>';
    byId('register-form').addEventListener('submit', submitRegister);
}

async function submitRegister(event) {
    event.preventDefault();
    var button = event.target.querySelector('button[type="submit"]');
    setBusy(button, true);
    byId('register-error').textContent = '';

    var username = formValue('register-username');
    var password = byId('register-password').value;
    try {
        await api('/auth/register/', {
            method: 'POST',
            json: {
                username: username,
                password: password,
                role: byId('register-role').value,
                email: formValue('register-email'),
                first_name: formValue('register-first'),
                last_name: formValue('register-last')
            }
        });
        await signIn(username, password);
    } catch (error) {
        byId('register-error').textContent = error.message;
        setBusy(button, false);
    }
}

function profilePage() {
    if (!state.user) {
        needLoginPage();
        return;
    }
    var user = state.user;
    var roles = { tourist: 'roleTourist', guide: 'roleGuide', admin: 'roleAdmin' };

    mainElement.innerHTML = '<div class="narrow"><h1 class="page-title">' + esc(t('profile')) + '</h1>' +
        '<form class="panel stack" id="profile-form">' +
        '<dl class="facts"><div><dt>' + esc(t('username')) + '</dt><dd>' + esc(user.username) + '</dd></div>' +
        '<div><dt>' + esc(t('role')) + '</dt><dd>' + esc(t(roles[user.role])) + '</dd></div></dl>' +
        field(t('email'), 'profile-email', 'type="email" ' + valueAttr(user.email)) +
        field(t('firstName'), 'profile-first', valueAttr(user.first_name)) +
        field(t('lastName'), 'profile-last', valueAttr(user.last_name)) +
        '<p class="form-error" id="profile-error" role="alert"></p>' +
        '<div><button class="button" type="submit">' + esc(t('save')) + '</button></div></form></div>';
    byId('profile-form').addEventListener('submit', submitProfile);
}

async function submitProfile(event) {
    event.preventDefault();
    byId('profile-error').textContent = '';
    try {
        state.user = await api('/auth/me/', {
            method: 'PATCH',
            json: { email: formValue('profile-email'), first_name: formValue('profile-first'), last_name: formValue('profile-last') }
        });
        showToast(t('saved'));
    } catch (error) {
        byId('profile-error').textContent = error.message;
    }
}

// ---------- AI-помощник ----------

function aiPage(number) {
    if (!state.user) {
        needLoginPage();
        return;
    }

    var tabs = [['chat', 'tabChat'], ['photo', 'tabPhoto'], ['plan', 'tabPlan']];
    var html = '<h1 class="page-title">' + esc(t('ai')) + '</h1><div class="tabs" role="tablist">';
    for (var i = 0; i < tabs.length; i++) {
        html = html + '<button class="tab" type="button" role="tab" data-tab="' + tabs[i][0] + '" aria-selected="' + (state.aiTab === tabs[i][0]) + '">' + esc(t(tabs[i][1])) + '</button>';
    }
    mainElement.innerHTML = html + '</div><div id="ai-content"></div><p class="hint">' + esc(t('aiWarning')) + '</p>';

    var buttons = mainElement.querySelectorAll('[data-tab]');
    for (var b = 0; b < buttons.length; b++) {
        buttons[b].addEventListener('click', changeAiTab);
    }

    if (state.aiTab === 'chat') {
        chatTab(number);
    } else if (state.aiTab === 'photo') {
        photoTab();
    } else {
        planTab(number);
    }
}

function changeAiTab(event) {
    state.aiTab = event.currentTarget.getAttribute('data-tab');
    render();
}

function chatBubbles(messages) {
    var html = '';
    for (var i = 0; i < messages.length; i++) {
        html = html + '<div class="bubble user">' + esc(messages[i].question) + '</div>' +
            '<div class="bubble bot">' + esc(cleanAiText(messages[i].answer)) + '</div>';
    }
    return html;
}

async function chatTab(number) {
    byId('ai-content').innerHTML = '<div class="panel"><p class="hint">' + esc(t('chatIntro')) + '</p>' +
        '<div class="chat-log" id="chat-log" aria-live="polite"><p class="hint">' + esc(t('loading')) + '</p></div>' +
        '<form class="stack" id="chat-form">' + textField(t('yourQuestion'), 'chat-question', '', true) +
        '<p class="form-error" id="chat-error" role="alert"></p>' +
        '<div><button class="button" type="submit">' + esc(t('send')) + '</button></div></form></div>';
    byId('chat-form').addEventListener('submit', submitChat);

    try {
        var messages = await api('/ai/chat/history/');
        if (number !== renderNumber) {
            return;
        }
        byId('chat-log').innerHTML = messages.length ? chatBubbles(messages) : '<p class="hint">' + esc(t('emptyChat')) + '</p>';
    } catch (error) {
        if (number === renderNumber) {
            byId('chat-log').innerHTML = '<p class="form-error">' + esc(error.message) + '</p>';
        }
    }
}

async function submitChat(event) {
    event.preventDefault();
    var button = event.target.querySelector('button[type="submit"]');
    var number = renderNumber;
    var errorBox = byId('chat-error');
    setBusy(button, true);
    errorBox.textContent = t('aiWait');
    try {
        var message = await api('/ai/chat/', { method: 'POST', json: { question: formValue('chat-question') } });
        if (number !== renderNumber) {
            return;
        }
        var log = byId('chat-log');
        // первый вопрос заменяет подсказку о пустом чате
        if (log.querySelector('.hint')) {
            log.innerHTML = '';
        }
        log.innerHTML = log.innerHTML + chatBubbles([message]);
        byId('chat-question').value = '';
        errorBox.textContent = '';
    } catch (error) {
        if (number === renderNumber) {
            errorBox.textContent = error.message;
        }
    }
    setBusy(button, false);
}

function photoTab() {
    byId('ai-content').innerHTML = '<div class="panel"><p class="hint">' + esc(t('photoIntro')) + '</p>' +
        '<form class="stack" id="photo-form">' +
        field(t('photoField'), 'photo-file', 'type="file" accept="image/jpeg,image/png" required') +
        '<img class="photo-preview" id="photo-preview" alt="" hidden>' +
        '<p class="form-error" id="photo-error" role="alert"></p>' +
        '<div><button class="button" type="submit">' + esc(t('recognize')) + '</button></div></form></div>' +
        '<div id="photo-result" aria-live="polite"></div>';
    byId('photo-form').addEventListener('submit', submitPhoto);
    byId('photo-file').addEventListener('change', previewPhoto);
}

function photoProblem(file) {
    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
        return t('photoType');
    }
    if (file.size > 3 * 1024 * 1024) {
        return t('photoSize');
    }
    return '';
}

function previewPhoto() {
    var input = byId('photo-file');
    var preview = byId('photo-preview');
    byId('photo-error').textContent = '';
    preview.hidden = true;
    if (input.files.length === 0) {
        return;
    }

    var problem = photoProblem(input.files[0]);
    if (problem) {
        byId('photo-error').textContent = problem;
        return;
    }
    preview.src = URL.createObjectURL(input.files[0]);
    preview.hidden = false;
}

async function submitPhoto(event) {
    event.preventDefault();
    var button = event.target.querySelector('button[type="submit"]');
    var number = renderNumber;
    var file = byId('photo-file').files[0];
    var errorBox = byId('photo-error');

    var problem = photoProblem(file);
    if (problem) {
        errorBox.textContent = problem;
        return;
    }

    setBusy(button, true);
    errorBox.textContent = t('aiWait');
    byId('photo-result').innerHTML = '';

    var form = new FormData();
    form.append('image', file);
    try {
        var result = await api('/ai/photo-search/', { method: 'POST', form: form });
        if (number !== renderNumber) {
            return;
        }
        errorBox.textContent = '';
        byId('photo-result').innerHTML = photoResult(result);
    } catch (error) {
        if (number === renderNumber) {
            errorBox.textContent = error.message;
        }
    }
    setBusy(button, false);
}

function photoResult(result) {
    var recognized = result.recognized || {};
    var html = '<div class="panel" style="margin-top:18px"><h2>' + esc(t('recognized')) + '</h2>' +
        '<p><strong>' + esc(recognized.name) + '</strong> ' + esc(recognized.city) + '</p>';

    if (result.place) {
        html = html + '<h3>' + esc(t('foundPlace')) + ': ' + esc(result.place.name) + ', ' + esc(result.place.city) + '</h3></div>' +
            '<h2 style="margin-top:22px">' + esc(t('toursHere')) + '</h2>' + toursGrid(result.tours, 'emptyTours');
    } else {
        html = html + '<p class="hint">' + esc(t('notInBase')) + '</p></div>';
    }
    return html;
}

async function planTab(number) {
    byId('ai-content').innerHTML = '<div class="panel"><p class="hint">' + esc(t('planIntro')) + '</p>' +
        '<form class="stack" id="plan-form"><div class="form-grid">' +
        field(t('city'), 'plan-city', 'required maxlength="100"') +
        field(t('days'), 'plan-days', 'type="number" min="1" max="30" value="2" required') +
        field(t('budget'), 'plan-budget', 'type="number" min="0" step="0.01" required') +
        '</div>' + field(t('interests'), 'plan-interests', 'required maxlength="1000"') +
        '<p class="form-error" id="plan-error" role="alert"></p>' +
        '<div><button class="button" type="submit">' + esc(t('makePlan')) + '</button></div></form></div>' +
        '<h2 style="margin-top:24px">' + esc(t('myPlans')) + '</h2><div class="panel" id="plan-list" aria-live="polite"><p class="hint">' + esc(t('loading')) + '</p></div>';
    byId('plan-form').addEventListener('submit', submitPlan);
    await loadPlans(number);
}

async function loadPlans(number) {
    try {
        var plans = await api('/ai/trip-plans/');
        if (number !== renderNumber) {
            return;
        }
        if (plans.length === 0) {
            byId('plan-list').innerHTML = '<p class="hint">' + esc(t('emptyPlans')) + '</p>';
            return;
        }

        // новые маршруты показываем первыми
        var html = '';
        for (var i = plans.length - 1; i >= 0; i--) {
            var plan = plans[i];
            var open = i === plans.length - 1 ? ' open' : '';
            html = html + '<details class="plan"' + open + '><summary><strong>' + esc(plan.city) + '</strong> · ' + plan.days + ' ' + esc(t('dayShort')) + ' · ' + esc(formatPrice(plan.budget)) + '</summary>' +
                '<div class="hint">' + esc(plan.interests) + '</div><div class="ai-text">' + esc(cleanAiText(plan.plan)) + '</div></details>';
        }
        byId('plan-list').innerHTML = html;
    } catch (error) {
        if (number === renderNumber) {
            byId('plan-list').innerHTML = '<p class="form-error">' + esc(error.message) + '</p>';
        }
    }
}

async function submitPlan(event) {
    event.preventDefault();
    var button = event.target.querySelector('button[type="submit"]');
    var number = renderNumber;
    var errorBox = byId('plan-error');
    setBusy(button, true);
    errorBox.textContent = t('aiWait');
    try {
        await api('/ai/trip-plan/', {
            method: 'POST',
            json: {
                city: formValue('plan-city'),
                days: Number(formValue('plan-days')),
                budget: formValue('plan-budget'),
                interests: formValue('plan-interests')
            }
        });
        if (number !== renderNumber) {
            return;
        }
        errorBox.textContent = '';
        event.target.reset();
        await loadPlans(number);
    } catch (error) {
        if (number === renderNumber) {
            errorBox.textContent = error.message;
        }
    }
    setBusy(button, false);
}

// ---------- Выбор страницы ----------

function notFoundPage() {
    mainElement.innerHTML = '<div class="empty"><p>' + esc(t('notFound')) + '</p><a class="button" href="#/">' + esc(t('toHome')) + '</a></div>';
}

function render() {
    renderNumber = renderNumber + 1;
    var number = renderNumber;

    renderHeader();
    window.scrollTo(0, 0);

    var route = location.hash.slice(1) || '/';
    var parts = route.split('/');

    if (route === '/') {
        toursPage(number);
    } else if (route === '/tours/new') {
        tourFormPage(null, number);
    } else if (parts[1] === 'tour' && /^\d+$/.test(parts[2] || '') && parts.length === 3) {
        tourPage(parts[2], number);
    } else if (parts[1] === 'tour' && /^\d+$/.test(parts[2] || '') && parts[3] === 'edit') {
        tourFormPage(parts[2], number);
    } else if (route === '/places') {
        placesPage(number);
    } else if (route === '/favorites') {
        favoritesPage(number);
    } else if (route === '/bookings') {
        bookingsPage(number);
    } else if (route === '/ai') {
        aiPage(number);
    } else if (route === '/login') {
        loginPage();
    } else if (route === '/register') {
        registerPage();
    } else if (route === '/profile') {
        profilePage();
    } else {
        notFoundPage();
    }
}

async function start() {
    var savedLang = readStorage('lang');
    if (savedLang === 'ru' || savedLang === 'en' || savedLang === 'tg') {
        setLanguage(savedLang);
    }

    // если токен сохранён, узнаём, кто вошёл
    if (readStorage('access')) {
        try {
            state.user = await api('/auth/me/');
        } catch (error) {
            clearTokens();
        }
    }

    window.addEventListener('hashchange', render);
    render();
}

start();
