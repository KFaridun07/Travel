// Карточки туров и мест, пустые состояния и избранное

// Фото записи, а если его нет, рисунок гор: цвет зависит от номера записи
function coverHtml(image, id, altText) {
    if (image) {
        return '<img class="cover-image" src="' + esc(image) + '" alt="' + esc(altText || '') + '" loading="lazy">';
    }
    return '<span class="cover-art tone-' + (Number(id) % 5) + '">' +
        '<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' +
        '<path class="far" d="M0 130 62 62l42 42 56-74 62 76 40-32 58 62v44H0z"/>' +
        '<path class="near" d="M0 180v-34l52-34 54 38 62-58 70 58 40-22 42 28v24z"/>' +
        '</svg></span>';
}

function ratingHtml(tour) {
    if (!tour.average_rating) {
        return '<span class="price-note">' + esc(t('noRating')) + '</span>';
    }
    return '<span class="rating">' + icon('star') + tour.average_rating + '</span>';
}

function tourIsOver(tour) {
    return tour.start_date <= todayText();
}

function heartButton(tourId) {
    // гиду и админу избранное не нужно
    if (state.user && !isRole('tourist')) {
        return '';
    }
    var active = state.favorites[tourId] !== undefined;
    var label = active ? t('removeFavorite') : t('addFavorite');
    return '<button class="icon-button heart-button" type="button" data-favorite="' + tourId + '" aria-pressed="' + active + '" aria-label="' + esc(label) + '" title="' + esc(label) + '">' + icon('heart') + '</button>';
}

function tourCard(tour) {
    var badge = '';
    if (tourIsOver(tour)) {
        badge = '<span class="badge">' + esc(t('tourStartedShort')) + '</span>';
    } else if (tour.free_places <= 0) {
        badge = '<span class="badge">' + esc(t('noPlaces')) + '</span>';
    } else if (tour.free_places <= 3) {
        badge = '<span class="badge hot">' + esc(t('fewPlaces')) + ': ' + tour.free_places + '</span>';
    }

    return '<article class="tour-card"><div class="tour-photo">' + coverHtml(tour.image, tour.id) + '</div><div class="tour-badges">' + badge + '</div>' + heartButton(tour.id) +
        '<div class="tour-body"><div class="tour-place">' + icon('pin') + esc(tour.place_city) + '</div>' +
        '<h3><a href="#/tour/' + tour.id + '">' + esc(tour.title) + '</a></h3>' +
        '<div class="tour-facts"><span>' + icon('calendar') + esc(formatShortDate(tour.start_date)) + '</span>' +
        '<span>' + icon('clock') + tour.days + ' ' + esc(t('dayShort')) + '</span></div>' +
        '<div class="tour-foot"><span class="price">' + esc(formatPrice(tour.price)) + '</span>' + ratingHtml(tour) + '</div>' +
        '</div></article>';
}

function toursGrid(tours) {
    var html = '<div class="tour-grid">';
    for (var i = 0; i < tours.length; i++) {
        html = html + tourCard(tours[i]);
    }
    return html + '</div>';
}

function skeletonCards(count) {
    var html = '<div class="tour-grid" aria-hidden="true">';
    for (var i = 0; i < count; i++) {
        html = html + '<div class="skeleton card"></div>';
    }
    return html + '</div>';
}

function placeTile(place, tourCount) {
    var count = '';
    if (tourCount) {
        count = '<span>' + esc(t('toursCount')) + ': ' + tourCount + '</span>';
    }
    return '<a class="place-tile" href="#/place/' + place.id + '">' + coverHtml(place.image, place.id) +
        '<div class="tile-glass"><h3>' + esc(place.name) + '</h3>' +
        '<span class="tile-meta"><span>' + esc(place.city) + '</span>' + count + '</span></div></a>';
}

// Считаем, сколько туров едет в каждое место
function countToursByPlace(tours) {
    var counts = {};
    for (var i = 0; i < tours.length; i++) {
        counts[tours[i].place] = (counts[tours[i].place] || 0) + 1;
    }
    return counts;
}

function statusBadge(status) {
    var names = { pending: 'statusPending', confirmed: 'statusConfirmed', cancelled: 'statusCancelled' };
    return '<span class="status status-' + esc(status) + '">' + esc(t(names[status])) + '</span>';
}

// ---------- Состояния страницы ----------

function emptyState(iconName, title, text, action) {
    return '<div class="empty">' + icon(iconName) + '<h3>' + esc(title) + '</h3>' +
        (text ? '<p>' + esc(text) + '</p>' : '') + (action || '') + '</div>';
}

function pageWrap(html) {
    return '<div class="container page-body" style="padding-top:40px">' + html + '</div>';
}

function showLoading() {
    mainElement.innerHTML = pageWrap('<p class="loading">' + esc(t('loading')) + '</p>');
}

function showPageError(error) {
    setCoverPage(false);
    var title = error.status === 404 ? t('notFound') : error.message;
    mainElement.innerHTML = pageWrap(emptyState('compass', title, '', '<a class="button" href="#/">' + esc(t('toHome')) + '</a>'));
}

// Страница, для которой нужно войти в аккаунт: после входа вернёмся на неё
function loginHref() {
    var route = location.hash.slice(1) || '/';
    return '#/login?next=' + encodeURIComponent(route);
}

function needLoginPage() {
    setCoverPage(false);
    mainElement.innerHTML = pageWrap(emptyState('user', t('needLogin'), '', '<a class="button" href="' + loginHref() + '">' + esc(t('login')) + '</a>'));
}

// ---------- Сообщения ----------

function showToast(message) {
    var toast = byId('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () {
        toast.classList.remove('show');
    }, 3000);
}

// Окно с вопросом вместо стандартного confirm: отвечает true или false
function confirmDialog(text, buttonText) {
    var dialog = byId('dialog');
    dialog.className = 'dialog';
    dialog.innerHTML = '<h2>' + esc(text) + '</h2><form method="dialog" class="dialog-actions">' +
        '<button class="button secondary" value="no">' + esc(t('cancel')) + '</button>' +
        '<button class="button danger" value="yes">' + esc(buttonText) + '</button></form>';
    dialog.returnValue = '';
    dialog.showModal();

    return new Promise(function (resolve) {
        dialog.addEventListener('close', function () {
            resolve(dialog.returnValue === 'yes');
        }, { once: true });
    });
}

// ---------- Избранное работает на любой странице ----------

async function loadFavorites() {
    state.favorites = {};
    if (!isRole('tourist')) {
        return;
    }
    var favorites = await api('/favorites/');
    for (var i = 0; i < favorites.length; i++) {
        state.favorites[favorites[i].tour] = favorites[i].id;
    }
}

async function toggleFavorite(button) {
    // гостя отправляем войти, а потом он вернётся на эту же страницу
    if (!state.user) {
        location.hash = loginHref();
        return;
    }

    var tourId = button.getAttribute('data-favorite');
    var favoriteId = state.favorites[tourId];
    setBusy(button, true);
    try {
        if (favoriteId) {
            await api('/favorites/' + favoriteId + '/', { method: 'DELETE' });
            delete state.favorites[tourId];
            showToast(t('favoriteRemoved'));
        } else {
            var created = await api('/favorites/', { method: 'POST', json: { tour: Number(tourId) } });
            state.favorites[tourId] = created.id;
            showToast(t('favoriteAdded'));
        }
    } catch (error) {
        showToast(error.message);
    }
    setBusy(button, false);

    // на странице одного тура таких кнопок может быть несколько
    var active = state.favorites[tourId] !== undefined;
    var label = active ? t('removeFavorite') : t('addFavorite');
    var buttons = document.querySelectorAll('[data-favorite="' + tourId + '"]');
    for (var i = 0; i < buttons.length; i++) {
        buttons[i].setAttribute('aria-pressed', active);
        buttons[i].setAttribute('aria-label', label);
        buttons[i].setAttribute('title', label);
        var text = buttons[i].querySelector('[data-favorite-text]');
        if (text) {
            text.textContent = label;
        }
    }

    // на странице избранного убранный тур должен исчезнуть
    if (!active && location.hash === '#/favorites') {
        render();
    }
}

// Клики ловим на всём документе: кнопки появляются и исчезают при смене страницы
document.addEventListener('click', function (event) {
    var favorite = event.target.closest('[data-favorite]');
    if (favorite) {
        toggleFavorite(favorite);
        return;
    }
    var password = event.target.closest('[data-toggle-password]');
    if (password) {
        togglePassword(password);
    }
});

// ---------- Плавное появление при прокрутке ----------

function watchReveal() {
    var items = document.querySelectorAll('.reveal:not(.visible)');
    if (!('IntersectionObserver' in window)) {
        for (var i = 0; i < items.length; i++) {
            items[i].classList.add('visible');
        }
        return;
    }

    var observer = new IntersectionObserver(function (entries) {
        for (var e = 0; e < entries.length; e++) {
            if (entries[e].isIntersecting) {
                entries[e].target.classList.add('visible');
                observer.unobserve(entries[e].target);
            }
        }
    }, { rootMargin: '0px 0px -8% 0px' });

    for (var k = 0; k < items.length; k++) {
        observer.observe(items[k]);
    }
}
