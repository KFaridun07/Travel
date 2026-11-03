// Страница одного тура

async function tourPage(id, number) {
    setCoverPage(true);
    mainElement.innerHTML = '<section class="cover"></section><div class="container section">' + skeletonCards(2) + '</div>';

    var tour;
    var reviews;
    var allTours;
    var place = null;
    var bookings = [];
    try {
        var answers = await Promise.all([api('/tours/' + id + '/'), api('/reviews/?tour=' + id), api('/tours/')]);
        tour = answers[0];
        reviews = answers[1];
        allTours = answers[2];
        place = await api('/places/' + tour.place + '/');
        // турист может оставить отзыв только с подтверждённой бронью
        if (isRole('tourist')) {
            bookings = await api('/bookings/?status=confirmed');
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

    setTitle(tour.title);
    var canEdit = isRole('admin') || (state.user !== null && state.user.id === tour.guide);

    mainElement.innerHTML = tourCover(tour, canEdit) +
        '<div class="container tour-layout"><div>' +
        tourFacts(tour) +
        '<p class="lead">' + esc(tour.description) + '</p>' +
        placeBlock(place) +
        reviewsBlock(tour, reviews, bookings) +
        '</div><aside>' + bookingCard(tour) + '</aside></div>' +
        relatedBlock(tour, allTours) +
        mobileBookBar(tour);

    document.body.classList.add('has-mobile-book');
    connectTourPage(tour, canEdit);

    // ссылка "Оставить отзыв" со страницы броней ведёт сразу к форме
    if (currentQuery().get('review') && byId('reviews')) {
        byId('reviews').scrollIntoView();
    }
}

function tourCover(tour, canEdit) {
    var tools = '';
    if (canEdit) {
        tools = '<div class="cover-tools"><a class="button glass small" href="#/tour/' + tour.id + '/edit">' + icon('edit') + esc(t('edit')) + '</a>' +
            '<button class="button glass small" type="button" id="tour-delete">' + icon('trash') + esc(t('delete')) + '</button></div>';
    }
    var rating = tour.average_rating ? '<span class="rating">' + icon('star') + tour.average_rating + '</span>' : '';

    return '<section class="cover">' + coverHtml(tour.image, tour.id, tour.title) +
        '<div class="container"><nav class="breadcrumbs" aria-label="' + esc(t('tours')) + '"><a href="#/tours">' + esc(t('tours')) + '</a><span aria-hidden="true">/</span><span>' + esc(tour.place_city) + '</span></nav>' +
        '<h1>' + esc(tour.title) + '</h1>' +
        '<div class="cover-meta"><span>' + icon('pin') + esc(tour.place_name) + '</span><span>' + icon('clock') + tour.days + ' ' + esc(t('dayShort')) + '</span>' + rating + '</div>' +
        tools + '</div></section>';
}

function tourFacts(tour) {
    var dates = formatDate(tour.start_date);
    if (Number(tour.days) > 1) {
        dates = formatShortDate(tour.start_date) + ' — ' + formatDate(tourEndDate(tour));
    }
    var facts = [
        ['calendar', t('dates'), dates],
        ['clock', t('duration'), tour.days + ' ' + t('dayShort')],
        ['user', t('guide'), tour.guide_name],
        ['users', t('groupSize'), t('upTo') + ' ' + tour.max_people]
    ];
    var html = '<dl class="fact-grid">';
    for (var i = 0; i < facts.length; i++) {
        html = html + '<div><dt>' + icon(facts[i][0]) + '' + esc(facts[i][1]) + '</dt><dd>' + esc(facts[i][2]) + '</dd></div>';
    }
    return html + '</dl>';
}

function placeBlock(place) {
    var tags = splitTags(place.tags);
    var tagsHtml = '';
    for (var i = 0; i < tags.length; i++) {
        tagsHtml = tagsHtml + '<span class="tag">' + esc(tags[i]) + '</span>';
    }
    return '<section class="content-section"><h2>' + esc(t('aboutPlace')) + '</h2>' +
        '<a class="place-link-card" href="#/place/' + place.id + '"><div class="place-link-photo">' + coverHtml(place.image, place.id) + '</div>' +
        '<div class="place-link-body"><h3>' + esc(place.name) + '</h3><p>' + esc(place.description) + '</p><div class="tags">' + tagsHtml + '</div></div></a></section>';
}

// ---------- Бронирование ----------

function bookingCard(tour) {
    // сколько мест уже занято: от этого зависит полоска
    var taken = Math.max(0, tour.max_people - tour.free_places);
    var percent = tour.max_people ? Math.round(taken / tour.max_people * 100) : 0;
    var low = tour.free_places <= 3 ? ' low' : '';

    return '<div class="book-card" id="book-card"><div class="big-price">' + esc(formatPrice(tour.price)) + '</div>' +
        '<div class="price-note">' + esc(t('perPerson')) + '</div>' +
        '<div class="seats"><div class="seats-row"><span>' + esc(t('freePlaces')) + '</span><strong>' + tour.free_places + ' / ' + tour.max_people + '</strong></div>' +
        '<div class="seats-bar' + low + '"><span style="width:' + percent + '%"></span></div></div>' +
        bookingBlock(tour) + favoriteWideButton(tour) + '</div>';
}

function bookingBlock(tour) {
    if (tourIsOver(tour)) {
        return '<p class="notice">' + esc(t('tourStarted')) + '</p>';
    }
    if (tour.free_places <= 0) {
        return '<p class="notice">' + esc(t('noPlaces')) + '</p>';
    }
    if (!state.user) {
        return '<div class="stack"><p class="notice">' + esc(t('loginToBook')) + '</p><a class="button wide" href="' + loginHref() + '">' + esc(t('login')) + '</a></div>';
    }
    if (!isRole('tourist')) {
        return '<p class="notice">' + esc(t('onlyTouristBook')) + '</p>';
    }
    return '<form class="stack" id="booking-form"><div class="field"><label for="booking-people">' + esc(t('peopleCount')) + '</label>' +
        '<div class="stepper"><button type="button" id="people-minus" aria-label="' + esc(t('fewer')) + '">' + icon('minus') + '</button>' +
        '<input id="booking-people" type="number" min="1" max="' + tour.free_places + '" value="1" required>' +
        '<button type="button" id="people-plus" aria-label="' + esc(t('more')) + '">' + icon('plus') + '</button></div></div>' +
        '<div class="total-row"><span>' + esc(t('total')) + '</span><strong id="booking-total"></strong></div>' +
        '<p class="form-error" id="booking-error" role="alert"></p>' +
        '<button class="button wide" type="submit">' + esc(t('book')) + '</button>' +
        '<p class="book-note">' + icon('info') + '<span>' + esc(t('bookNote')) + '</span></p></form>';
}

function favoriteWideButton(tour) {
    if (!isRole('tourist')) {
        return '';
    }
    var active = state.favorites[tour.id] !== undefined;
    var label = active ? t('removeFavorite') : t('addFavorite');
    return '<button class="button secondary wide" type="button" style="margin-top:10px" data-favorite="' + tour.id + '" aria-pressed="' + active + '">' + icon('heart') + '<span data-favorite-text>' + esc(label) + '</span></button>';
}

function mobileBookBar(tour) {
    return '<div class="mobile-book"><div><div class="price">' + esc(formatPrice(tour.price)) + '</div><div class="price-note">' + esc(t('perPerson')) + '</div></div>' +
        '<a class="button small" href="#/tour/' + tour.id + '" id="mobile-book-button">' + esc(t('book')) + '</a></div>';
}

function updateBookingTotal(tour) {
    var input = byId('booking-people');
    var count = Number(input.value) || 0;
    byId('booking-total').textContent = formatPrice(Number(tour.price) * count);
    byId('people-minus').disabled = count <= 1;
    byId('people-plus').disabled = count >= tour.free_places;
}

function changePeople(tour, step) {
    var input = byId('booking-people');
    var count = (Number(input.value) || 1) + step;
    input.value = Math.min(Math.max(count, 1), tour.free_places);
    updateBookingTotal(tour);
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
        showErrors(error, 'booking-error');
        setBusy(button, false);
    }
}

// ---------- Отзывы ----------

function reviewSummary(reviews) {
    if (reviews.length === 0) {
        return '';
    }
    var counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    var sum = 0;
    for (var i = 0; i < reviews.length; i++) {
        counts[reviews[i].rating] = counts[reviews[i].rating] + 1;
        sum = sum + reviews[i].rating;
    }

    var bars = '';
    for (var stars = 5; stars >= 1; stars--) {
        var percent = Math.round(counts[stars] / reviews.length * 100);
        bars = bars + '<div class="review-bar"><span>' + stars + '</span><span class="bar"><span style="width:' + percent + '%"></span></span><span>' + counts[stars] + '</span></div>';
    }
    return '<div class="review-summary"><div class="review-average">' + (sum / reviews.length).toFixed(1) + '</div><div class="review-bars">' + bars + '</div></div>';
}

function reviewForm(tour, reviews, bookings) {
    if (!isRole('tourist')) {
        return '';
    }
    // свой отзыв уже есть: второй оставить нельзя
    for (var i = 0; i < reviews.length; i++) {
        if (reviews[i].user === state.user.id) {
            return '';
        }
    }
    var hasBooking = false;
    for (var k = 0; k < bookings.length; k++) {
        if (bookings[k].tour === tour.id) {
            hasBooking = true;
        }
    }
    if (!hasBooking) {
        return '<p class="notice" style="margin-bottom:18px">' + esc(t('reviewHint')) + '</p>';
    }

    // звёзды идут в обратном порядке: так CSS может закрасить все звёзды до выбранной
    var stars = '';
    for (var value = 5; value >= 1; value--) {
        stars = stars + '<input type="radio" name="review-rating" id="review-star-' + value + '" value="' + value + '"' + (value === 5 ? ' checked' : '') + '>' +
            '<label for="review-star-' + value + '" aria-label="' + value + '/5">' + icon('star') + '</label>';
    }
    return '<form class="panel stack" id="review-form" style="margin-bottom:18px"><h3>' + esc(t('writeReview')) + '</h3>' +
        '<div class="field"><span class="field-title" id="review-rating-title">' + esc(t('yourRating')) + '</span>' +
        '<div class="star-input" role="radiogroup" aria-labelledby="review-rating-title">' + stars + '</div></div>' +
        textField(t('reviewText'), 'review-text', '', true) +
        '<p class="form-error" id="review-error" role="alert"></p>' +
        '<div><button class="button" type="submit">' + esc(t('send')) + '</button></div></form>';
}

function reviewsBlock(tour, reviews, bookings) {
    var list = '';
    for (var i = 0; i < reviews.length; i++) {
        var review = reviews[i];
        list = list + '<article class="review"><div class="review-head"><span class="avatar">' + esc(review.username.charAt(0)) + '</span>' +
            '<div><strong>' + esc(review.username) + '</strong><div class="review-date">' + esc(formatDate(review.created_at)) + '</div></div></div>' +
            starsHtml(review.rating) + '<p>' + esc(review.text) + '</p></article>';
    }
    var empty = reviews.length === 0 ? '<p class="hint">' + esc(t('emptyReviews')) + '</p>' : '';

    return '<section class="content-section" id="reviews"><h2>' + esc(t('reviews')) + '</h2>' +
        reviewSummary(reviews) + reviewForm(tour, reviews, bookings) + empty + list + '</section>';
}

async function submitReview(event, tourId) {
    event.preventDefault();
    var button = event.target.querySelector('button[type="submit"]');
    setBusy(button, true);
    clearErrors(event.target);
    byId('review-error').textContent = '';
    var rating = event.target.querySelector('input[name="review-rating"]:checked').value;
    try {
        await api('/reviews/', { method: 'POST', json: { tour: tourId, rating: Number(rating), text: formValue('review-text') } });
        showToast(t('reviewSent'));
        render();
    } catch (error) {
        showErrors(error, 'review-error', { text: 'review-text' });
        setBusy(button, false);
    }
}

// ---------- Похожие туры ----------

function relatedBlock(tour, allTours) {
    // сначала туры из того же города, потом самые близкие по цене
    var others = [];
    for (var i = 0; i < allTours.length; i++) {
        if (allTours[i].id !== tour.id && !tourIsOver(allTours[i])) {
            others.push(allTours[i]);
        }
    }
    others.sort(function (a, b) {
        var sameA = a.place_city === tour.place_city ? 0 : 1;
        var sameB = b.place_city === tour.place_city ? 0 : 1;
        if (sameA !== sameB) {
            return sameA - sameB;
        }
        return Math.abs(a.price - tour.price) - Math.abs(b.price - tour.price);
    });
    if (others.length === 0) {
        return '';
    }
    return '<section class="section tight"><div class="container"><div class="section-head"><h2>' + esc(t('relatedTours')) + '</h2></div>' +
        toursGrid(others.slice(0, 3)) + '</div></section>';
}

// ---------- Подключаем кнопки ----------

function connectTourPage(tour, canEdit) {
    if (tour.image) {
        setAmbient(tour.image);
    }
    if (canEdit) {
        byId('tour-delete').addEventListener('click', function () {
            deleteTour(tour.id);
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
            updateBookingTotal(tour);
        });
        byId('people-minus').addEventListener('click', function () {
            changePeople(tour, -1);
        });
        byId('people-plus').addEventListener('click', function () {
            changePeople(tour, 1);
        });
        updateBookingTotal(tour);
    }
    byId('mobile-book-button').addEventListener('click', function (event) {
        event.preventDefault();
        byId('book-card').scrollIntoView();
    });
}

async function deleteTour(id) {
    var agreed = await confirmDialog(t('confirmDelete'), t('delete'));
    if (!agreed) {
        return;
    }
    try {
        await api('/tours/' + id + '/', { method: 'DELETE' });
        showToast(t('deleted'));
        location.hash = '#/tours';
    } catch (error) {
        showToast(error.message);
    }
}
