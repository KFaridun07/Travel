// Главная страница

// Карусель мест: какое место сейчас в центре
var orbitPlaces = [];
var orbitIndex = 0;

// Сколько шагов от центральной карточки: лента замкнута в круг
function orbitOffset(index) {
    var count = orbitPlaces.length;
    var offset = index - orbitIndex;
    if (offset > count / 2) {
        offset = offset - count;
    }
    if (offset < -count / 2) {
        offset = offset + count;
    }
    return offset;
}

// Ставим карточки в пространстве: чем дальше от центра, тем сильнее поворот
function layoutOrbit() {
    var cards = document.querySelectorAll('.orbit-card');
    if (cards.length === 0) {
        return;
    }
    var width = cards[0].offsetWidth;
    for (var i = 0; i < cards.length; i++) {
        var offset = orbitOffset(i);
        var distance = Math.abs(offset);
        var side = offset < 0 ? -1 : 1;
        var shift = distance === 0 ? 0 : side * (width * 0.84 + (distance - 1) * width * 0.4);
        var turn = distance === 0 ? 0 : -side * (30 + distance * 8);

        cards[i].style.transform = 'translateX(calc(-50% + ' + shift + 'px)) translateZ(' + (-distance * 150) + 'px) rotateY(' + turn + 'deg)';
        cards[i].style.zIndex = 10 - distance;
        cards[i].style.opacity = distance > 2 ? 0 : 1;
        cards[i].style.pointerEvents = distance > 2 ? 'none' : '';
        cards[i].classList.toggle('current', distance === 0);
        cards[i].classList.toggle('on-right', offset > 0);

        // с клавиатуры доступны только ссылки центральной карточки
        var links = cards[i].querySelectorAll('a');
        for (var k = 0; k < links.length; k++) {
            links[k].tabIndex = distance === 0 ? 0 : -1;
        }
    }
}

function showOrbit(index) {
    var count = orbitPlaces.length;
    orbitIndex = (index + count) % count;
    var place = orbitPlaces[orbitIndex];
    layoutOrbit();

    byId('orbit-thumb').innerHTML = coverHtml(place.image, place.id);
    byId('orbit-name').textContent = place.name;
    byId('orbit-city').textContent = place.city;
    var dots = document.querySelectorAll('.orbit-dots button');
    for (var i = 0; i < dots.length; i++) {
        dots[i].classList.toggle('active', i === orbitIndex);
    }
    if (place.image) {
        setAmbient(place.image);
    }
}

function orbitCard(place, index, total) {
    return '<article class="orbit-card" data-orbit="' + index + '">' + coverHtml(place.image, place.id) +
        '<a class="orbit-expand" href="#/place/' + place.id + '">' + icon('expand') + esc(t('openPlace')) + '</a>' +
        '<div class="orbit-body"><div class="orbit-title"><h2><a href="#/place/' + place.id + '">' + esc(place.name) + '</a></h2>' +
        '<span class="orbit-count">' + (index + 1) + ' / ' + total + '</span></div>' +
        '<p class="orbit-text">' + esc(place.description) + '</p>' +
        '<div class="orbit-place">' + icon('pin') + esc(place.city) + '</div></div></article>';
}

function orbitHtml(places) {
    var cards = '';
    var dots = '';
    for (var i = 0; i < places.length; i++) {
        cards = cards + orbitCard(places[i], i, places.length);
        dots = dots + '<button type="button" data-orbit-dot="' + i + '" aria-label="' + esc(places[i].name) + '"></button>';
    }
    return '<div class="orbit" id="orbit">' + cards + '</div>' +
        '<div class="orbit-dock"><button class="round-button back" type="button" id="orbit-back" aria-label="' + esc(t('railBack')) + '">' + icon('arrow') + '</button>' +
        '<span class="orbit-thumb" id="orbit-thumb"></span>' +
        '<div aria-live="polite"><strong id="orbit-name"></strong><small id="orbit-city"></small></div>' +
        '<button class="round-button" type="button" id="orbit-next" aria-label="' + esc(t('railForward')) + '">' + icon('arrow') + '</button></div>' +
        '<div class="orbit-dots">' + dots + '</div>';
}

function connectOrbit() {
    var orbit = byId('orbit');
    byId('orbit-back').addEventListener('click', function () {
        showOrbit(orbitIndex - 1);
    });
    byId('orbit-next').addEventListener('click', function () {
        showOrbit(orbitIndex + 1);
    });

    // нажатие на боковую карточку выводит её в центр
    orbit.addEventListener('click', function (event) {
        var card = event.target.closest('[data-orbit]');
        if (card && !card.classList.contains('current')) {
            event.preventDefault();
            showOrbit(Number(card.getAttribute('data-orbit')));
        }
    });

    var dots = document.querySelectorAll('[data-orbit-dot]');
    for (var i = 0; i < dots.length; i++) {
        dots[i].addEventListener('click', function (event) {
            showOrbit(Number(event.currentTarget.getAttribute('data-orbit-dot')));
        });
    }

    // на телефоне карточки листаются пальцем
    var touchStart = 0;
    orbit.addEventListener('touchstart', function (event) {
        touchStart = event.touches[0].clientX;
    }, { passive: true });
    orbit.addEventListener('touchend', function (event) {
        var moved = event.changedTouches[0].clientX - touchStart;
        if (Math.abs(moved) > 40) {
            showOrbit(orbitIndex + (moved < 0 ? 1 : -1));
        }
    }, { passive: true });

    showOrbit(0);
}

// Ширина карточек зависит от окна, поэтому при его изменении расставляем их заново
window.addEventListener('resize', layoutOrbit);

function spatialHtml() {
    return '<section class="spatial">' +
        '<div class="container"><span class="hero-kicker">' + esc(t('heroKicker')) + '</span>' +
        '<h1>' + esc(t('heroTitle')) + '</h1>' +
        '<p class="hero-text">' + esc(t('heroText')) + '</p></div>' +
        '<div id="orbit-stage"><div class="container"><div class="skeleton orbit-empty"></div></div></div></section>' +
        '<div class="container hero-search"><form class="search-panel" id="hero-search">' +
        '<div class="search-cell"><label for="hero-city">' + esc(t('whereTo')) + '</label><input id="hero-city" list="hero-cities" placeholder="' + esc(t('anyCity')) + '" autocomplete="off"><datalist id="hero-cities"></datalist></div>' +
        '<div class="search-cell"><label for="hero-days">' + esc(t('days')) + '</label><input id="hero-days" type="number" min="1" step="1" placeholder="' + esc(t('anyDays')) + '"></div>' +
        '<div class="search-cell"><label for="hero-budget">' + esc(t('budgetUpTo')) + '</label><input id="hero-budget" type="number" min="0" step="any" placeholder="' + esc(t('currency')) + '"></div>' +
        '<button class="button" type="submit">' + icon('search') + esc(t('find')) + '</button>' +
        '</form></div>';
}

function submitHeroSearch(event) {
    event.preventDefault();
    var query = new URLSearchParams();
    if (formValue('hero-city')) {
        query.set('city', formValue('hero-city'));
    }
    if (formValue('hero-days')) {
        query.set('days', formValue('hero-days'));
    }
    if (formValue('hero-budget')) {
        query.set('price_max', formValue('hero-budget'));
    }
    location.hash = '#/tours?' + query.toString();
}

function statsHtml(tours, places) {
    var cities = {};
    for (var i = 0; i < places.length; i++) {
        cities[places[i].city] = true;
    }

    // средний рейтинг считаем только по турам, у которых есть оценки
    var sum = 0;
    var rated = 0;
    for (var k = 0; k < tours.length; k++) {
        if (tours[k].average_rating) {
            sum = sum + tours[k].average_rating;
            rated = rated + 1;
        }
    }

    var items = [
        [tours.length, t('statTours')],
        [places.length, t('statPlaces')],
        [Object.keys(cities).length, t('statCities')],
        [rated ? (sum / rated).toFixed(1) : '—', t('statRating')]
    ];

    var html = '<div class="container"><div class="stats">';
    for (var n = 0; n < items.length; n++) {
        html = html + '<div><span class="stat-number">' + esc(items[n][0]) + '</span><span class="stat-label">' + esc(items[n][1]) + '</span></div>';
    }
    return html + '</div></div>';
}

// Строка в списке туров: миниатюра, название и круглая кнопка
function exploreRow(tour) {
    return '<a class="explore-row" href="#/tour/' + tour.id + '"><span class="explore-thumb">' + coverHtml(tour.image, tour.id) + '</span>' +
        '<span><strong>' + esc(tour.title) + '</strong><small><span>' + icon('pin') + esc(tour.place_city) + '</span>' +
        '<span>' + icon('calendar') + esc(formatShortDate(tour.start_date)) + '</span><span>' + esc(formatPrice(tour.price)) + '</span></small></span>' +
        '<span class="round-button">' + icon('arrow') + '</span></a>';
}

function toursSection(tours) {
    // показываем только те туры, которые ещё можно забронировать: сначала ближайшие
    var upcoming = [];
    for (var i = 0; i < tours.length; i++) {
        if (!tourIsOver(tours[i])) {
            upcoming.push(tours[i]);
        }
    }
    upcoming.sort(function (a, b) {
        return a.start_date < b.start_date ? -1 : 1;
    });
    if (upcoming.length === 0) {
        return '';
    }

    var first = upcoming[0];
    var rows = '';
    for (var k = 1; k < upcoming.length && k < 6; k++) {
        rows = rows + exploreRow(upcoming[k]);
    }

    return '<section class="section reveal"><div class="container"><div class="section-head"><div>' +
        '<span class="kicker">' + esc(t('toursKicker')) + '</span><h2>' + esc(t('toursTitle')) + '</h2></div>' +
        '<a class="text-link" href="#/tours">' + esc(t('allTours')) + icon('arrow') + '</a></div>' +
        '<div class="explore"><article class="explore-hero">' + coverHtml(first.image, first.id) +
        '<h3><a href="#/tour/' + first.id + '">' + esc(first.title) + '</a></h3>' +
        '<div class="explore-city">' + esc(first.place_city) + '</div>' +
        '<p class="explore-note">' + esc(first.description) + '</p>' +
        '<div class="explore-bar">' + icon('pin') + '<div><strong>' + esc(formatPrice(first.price)) + '</strong>' +
        '<small>' + esc(formatShortDate(first.start_date)) + ' · ' + first.days + ' ' + esc(t('dayShort')) + '</small></div>' +
        heartButton(first.id) + '<a class="round-button explore-go" href="#/tour/' + first.id + '" aria-label="' + esc(first.title) + '">' + icon('arrow') + '</a></div></article>' +
        '<div class="explore-list">' + rows + '</div></div></div></section>';
}

function aiSection() {
    var features = [
        ['chat', 'chat', 'tabChat', 'featureChat'],
        ['photo', 'camera', 'tabPhoto', 'featurePhoto'],
        ['plan', 'route', 'tabPlan', 'featurePlan']
    ];
    var html = '';
    for (var i = 0; i < features.length; i++) {
        html = html + '<a class="feature" href="#/ai?tab=' + features[i][0] + '">' + icon(features[i][1]) +
            '<strong>' + esc(t(features[i][2])) + '</strong>' + icon('arrow') + '<span>' + esc(t(features[i][3])) + '</span></a>';
    }
    return '<section class="section tight reveal"><div class="container"><div class="ai-band">' +
        '<div class="ai-band-photo"><img src="' + esc(staticUrl('img/places/pamir.jpg')) + '" alt="" loading="lazy"></div>' +
        '<div class="ai-band-text-side"><span class="kicker">' + esc(t('aiKicker')) + '</span><h2>' + esc(t('aiTitle')) + '</h2>' +
        '<p class="ai-band-text">' + esc(t('aiText')) + '</p><div class="feature-row">' + html + '</div></div></div></div></section>';
}

function stepsSection() {
    var steps = [['step1Title', 'step1Text'], ['step2Title', 'step2Text'], ['step3Title', 'step3Text']];
    var html = '';
    for (var i = 0; i < steps.length; i++) {
        html = html + '<div class="step"><h3>' + esc(t(steps[i][0])) + '</h3><p>' + esc(t(steps[i][1])) + '</p></div>';
    }
    return '<section class="section tight reveal"><div class="container"><div class="section-head"><div>' +
        '<span class="kicker">' + esc(t('stepsKicker')) + '</span><h2>' + esc(t('stepsTitle')) + '</h2></div></div>' +
        '<div class="steps">' + html + '</div></div></section>';
}

function reviewsSection(reviews, tours) {
    // название тура находим по его номеру
    var titles = {};
    for (var i = 0; i < tours.length; i++) {
        titles[tours[i].id] = tours[i].title;
    }

    // сначала самые высокие оценки и самые подробные отзывы
    var best = reviews.slice();
    best.sort(function (a, b) {
        return (b.rating - a.rating) || (b.text.length - a.text.length);
    });
    if (best.length === 0) {
        return '';
    }

    var html = '';
    for (var k = 0; k < best.length && k < 3; k++) {
        html = html + '<figure class="quote">' + starsHtml(best[k].rating) +
            '<blockquote>' + esc(best[k].text) + '</blockquote>' +
            '<figcaption><strong>' + esc(best[k].username) + '</strong>' + esc(titles[best[k].tour] || '') + '</figcaption></figure>';
    }
    return '<section class="section tight reveal"><div class="container"><div class="section-head"><div>' +
        '<span class="kicker">' + esc(t('reviews')) + '</span><h2>' + esc(t('quotesTitle')) + '</h2></div></div>' +
        '<div class="quote-grid">' + html + '</div></div></section>';
}

function ctaSection() {
    // вошедшего пользователя регистрироваться не зовём
    if (state.user) {
        return '';
    }
    return '<section class="section tight reveal"><div class="container"><div class="cta">' +
        '<img src="' + esc(staticUrl('img/scenes/auth_alaudin.jpg')) + '" alt="" loading="lazy">' +
        '<h2>' + esc(t('ctaTitle')) + '</h2><p>' + esc(t('ctaText')) + '</p>' +
        '<a class="button" href="#/register">' + esc(t('register')) + icon('arrow') + '</a></div></div></section>';
}

async function homePage(number) {
    setCoverPage(true);
    setTitle('');
    orbitIndex = 0;

    mainElement.innerHTML = spatialHtml() + '<div id="home-content"></div>';
    byId('hero-search').addEventListener('submit', submitHeroSearch);

    try {
        // три запроса идут одновременно, ждём ответы на все
        var answers = await Promise.all([api('/tours/'), api('/places/'), api('/reviews/')]);
        if (number !== renderNumber) {
            return;
        }
        var tours = answers[0];
        var places = answers[1];
        var reviews = answers[2];

        orbitPlaces = places;
        if (places.length > 0) {
            byId('orbit-stage').innerHTML = orbitHtml(places);
            connectOrbit();
        } else {
            byId('orbit-stage').innerHTML = '';
        }

        var cityOptions = {};
        for (var k = 0; k < places.length; k++) {
            cityOptions[places[k].city] = true;
        }
        var options = '';
        for (var city in cityOptions) {
            options = options + '<option value="' + esc(city) + '"></option>';
        }
        byId('hero-cities').innerHTML = options;

        byId('home-content').innerHTML = statsHtml(tours, places) + toursSection(tours) +
            aiSection() + stepsSection() + reviewsSection(reviews, tours) + ctaSection();
        watchReveal();
    } catch (error) {
        if (number === renderNumber) {
            byId('home-content').innerHTML = '<div class="container section">' + emptyState('compass', error.message) + '</div>';
        }
    }
}
