// Избранное и брони

async function favoritesPage(number) {
    setCoverPage(false);
    setTitle(t('favorites'));
    if (!state.user) {
        needLoginPage();
        return;
    }
    mainElement.innerHTML = '<div class="container"><div class="page-head"><h1>' + esc(t('favorites')) + '</h1></div>' +
        '<div class="page-body" id="favorite-list">' + skeletonCards(3) + '</div></div>';

    try {
        var answers = await Promise.all([api('/tours/'), loadFavorites()]);
        if (number !== renderNumber) {
            return;
        }

        // оставляем только туры из избранного
        var tours = [];
        for (var i = 0; i < answers[0].length; i++) {
            if (state.favorites[answers[0][i].id] !== undefined) {
                tours.push(answers[0][i]);
            }
        }
        if (tours.length === 0) {
            byId('favorite-list').innerHTML = emptyState('heart', t('emptyFavorites'), t('emptyFavoritesText'), '<a class="button" href="#/tours">' + esc(t('allTours')) + '</a>');
        } else {
            byId('favorite-list').innerHTML = toursGrid(tours);
        }
    } catch (error) {
        if (number === renderNumber) {
            byId('favorite-list').innerHTML = emptyState('compass', error.message);
        }
    }
}

// ---------- Брони ----------

var allBookings = [];
var bookingTours = {};
var reviewedTours = {};
var bookingStatusFilter = '';

function bookingsTitle() {
    if (isRole('guide')) {
        return t('bookingsGuide');
    }
    return isRole('admin') ? t('bookingsAdmin') : t('bookingsTourist');
}

async function bookingsPage(number) {
    setCoverPage(false);
    setTitle(bookingsTitle());
    if (!state.user) {
        needLoginPage();
        return;
    }

    mainElement.innerHTML = '<div class="container"><div class="page-head"><h1>' + esc(bookingsTitle()) + '</h1></div>' +
        '<div class="page-body"><div id="booking-segments"></div><div id="booking-list" aria-live="polite"><div class="stack"><div class="skeleton line"></div><div class="skeleton line"></div></div></div></div></div>';
    byId('booking-segments').addEventListener('click', function (event) {
        var segment = event.target.closest('[data-status]');
        if (segment) {
            bookingStatusFilter = segment.getAttribute('data-status');
            showBookings();
        }
    });
    await loadBookings(number);
}

async function loadBookings(number) {
    try {
        var answers = await Promise.all([api('/bookings/'), api('/tours/'), api('/reviews/')]);
        if (number !== renderNumber) {
            return;
        }
        allBookings = answers[0];

        // запоминаем туры, на которые пользователь уже оставил отзыв
        reviewedTours = {};
        for (var r = 0; r < answers[2].length; r++) {
            if (answers[2][r].user === state.user.id) {
                reviewedTours[answers[2][r].tour] = true;
            }
        }

        // сначала новые брони
        allBookings.sort(function (a, b) {
            return a.created_at < b.created_at ? 1 : -1;
        });

        bookingTours = {};
        for (var i = 0; i < answers[1].length; i++) {
            bookingTours[answers[1][i].id] = answers[1][i];
        }
        showBookings();
    } catch (error) {
        if (number === renderNumber) {
            byId('booking-list').innerHTML = emptyState('compass', error.message);
        }
    }
}

function showBookings() {
    var names = [['', 'allStatuses'], ['pending', 'statusPending'], ['confirmed', 'statusConfirmed'], ['cancelled', 'statusCancelled']];

    var segments = '';
    for (var i = 0; i < names.length; i++) {
        var count = 0;
        for (var k = 0; k < allBookings.length; k++) {
            if (!names[i][0] || allBookings[k].status === names[i][0]) {
                count = count + 1;
            }
        }
        segments = segments + '<button class="segment" type="button" data-status="' + names[i][0] + '" aria-pressed="' + (bookingStatusFilter === names[i][0]) + '">' +
            esc(t(names[i][1])) + ' <span class="count">' + count + '</span></button>';
    }
    byId('booking-segments').innerHTML = '<div class="segments">' + segments + '</div>';

    var html = '';
    for (var n = 0; n < allBookings.length; n++) {
        if (!bookingStatusFilter || allBookings[n].status === bookingStatusFilter) {
            html = html + bookingCardRow(allBookings[n]);
        }
    }

    var list = byId('booking-list');
    if (html) {
        list.innerHTML = '<div class="trip-list">' + html + '</div>';
    } else {
        var action = isRole('tourist') ? '<a class="button" href="#/tours">' + esc(t('allTours')) + '</a>' : '';
        list.innerHTML = emptyState('ticket', t('emptyBookings'), '', action);
    }

    var buttons = list.querySelectorAll('[data-action]');
    for (var b = 0; b < buttons.length; b++) {
        buttons[b].addEventListener('click', bookingAction);
    }
    var chatButtons = list.querySelectorAll('[data-chat-booking]');
    for (var c = 0; c < chatButtons.length; c++) {
        chatButtons[c].addEventListener('click', startChatFromBooking);
    }
}

function bookingCardRow(booking) {
    var tour = bookingTours[booking.tour] || {};

    var actions = '';
    // турист пишет гиду тура, гид пишет туристу из брони
    if (chatAllowed() && booking.status !== 'cancelled') {
        var chatLabel = t(isRole('guide') ? 'chatWriteTourist' : 'chatWriteGuide');
        actions = actions + '<button class="button secondary small" type="button" data-chat-booking="' + booking.id + '">' + icon('chat') + esc(chatLabel) + '</button>';
    }
    var canConfirm = isRole('guide') || isRole('admin');
    if (canConfirm && booking.status === 'pending') {
        actions = actions + '<button class="button small" type="button" data-action="confirm" data-id="' + booking.id + '">' + icon('check') + esc(t('confirmBooking')) + '</button>';
    }
    var canCancel = booking.user === state.user.id || isRole('admin');
    if (canCancel && booking.status !== 'cancelled') {
        actions = actions + '<button class="button danger small" type="button" data-action="cancel" data-id="' + booking.id + '">' + esc(t('cancelBooking')) + '</button>';
    }
    if (isRole('tourist') && booking.status === 'confirmed' && !reviewedTours[booking.tour]) {
        actions = actions + '<a class="button secondary small" href="#/tour/' + booking.tour + '?review=1">' + esc(t('writeReview')) + '</a>';
    }

    var who = '';
    if (!isRole('tourist')) {
        who = '<span>' + icon('user') + esc(booking.username) + '</span>';
    }
    var date = tour.start_date ? '<span>' + icon('calendar') + esc(formatDate(tour.start_date)) + '</span>' : '';

    return '<article class="trip"><div class="trip-photo">' + coverHtml(tour.image, booking.tour) + '</div>' +
        '<div class="trip-body">' + statusBadge(booking.status) +
        '<h3><a href="#/tour/' + booking.tour + '">' + esc(booking.tour_title) + '</a></h3>' +
        '<div class="tour-facts">' + who + date +
        '<span>' + icon('users') + esc(t('people')) + ': ' + booking.people_count + '</span>' +
        '<span><strong>' + esc(formatPrice(booking.total_price)) + '</strong></span></div></div>' +
        '<div class="trip-actions">' + actions + '</div></article>';
}

async function bookingAction(event) {
    var button = event.currentTarget;
    var action = button.getAttribute('data-action');
    var number = renderNumber;

    if (action === 'cancel') {
        var agreed = await confirmDialog(t('confirmCancelBooking'), t('cancelBooking'));
        if (!agreed) {
            return;
        }
    }

    setBusy(button, true);
    try {
        await api('/bookings/' + button.getAttribute('data-id') + '/' + action + '/', { method: 'POST', json: {} });
        showToast(t(action === 'confirm' ? 'bookingConfirmed' : 'bookingCancelled'));
        await loadBookings(number);
    } catch (error) {
        showToast(error.message);
        setBusy(button, false);
    }
}
