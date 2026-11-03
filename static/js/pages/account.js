// Вход, регистрация и профиль

function authLayout(formHtml) {
    return '<div class="auth"><div class="auth-photo"><img class="cover-image" src="' + esc(staticUrl('img/scenes/auth_alaudin.jpg')) + '" alt="">' +
        '<blockquote>' + esc(t('authQuote')) + '</blockquote></div>' +
        '<div class="auth-form"><div>' + formHtml + '</div></div></div>';
}

// Куда вернуться после входа. Адрес обязан начинаться с одной косой черты:
// так ссылка не сможет увести пользователя на чужой сайт
function nextRoute() {
    var next = currentQuery().get('next') || '/';
    if (next.charAt(0) !== '/' || next.charAt(1) === '/') {
        return '/';
    }
    return next;
}

// Переносим адрес возврата при переходе между входом и регистрацией
function nextSuffix() {
    var next = nextRoute();
    return next === '/' ? '' : '?next=' + encodeURIComponent(next);
}

function loginPage() {
    setCoverPage(false);
    setTitle(t('loginTitle'));
    mainElement.innerHTML = authLayout('<h1>' + esc(t('loginTitle')) + '</h1><p class="auth-sub">' + esc(t('loginSub')) + '</p>' +
        '<form class="stack" id="login-form">' +
        field(t('username'), 'login-username', 'required autocomplete="username"') +
        passwordField(t('password'), 'login-password', 'current-password') +
        '<p class="form-error" id="login-error" role="alert"></p>' +
        '<button class="button wide" type="submit">' + esc(t('login')) + '</button>' +
        '<p class="auth-switch">' + esc(t('noAccount')) + ' <a href="#/register' + esc(nextSuffix()) + '">' + esc(t('register')) + '</a></p></form>');
    byId('login-form').addEventListener('submit', submitLogin);
}

async function signIn(username, password) {
    var next = nextRoute();
    var tokens = await api('/auth/login/', { method: 'POST', json: { username: username, password: password } });
    saveTokens(tokens.access, tokens.refresh);
    state.user = await api('/auth/me/');
    await loadFavorites();

    // если адрес не меняется, hashchange не сработает, поэтому рисуем сами
    if (location.hash === '#' + next) {
        render();
    } else {
        location.hash = '#' + next;
    }
}

async function submitLogin(event) {
    event.preventDefault();
    var button = event.target.querySelector('button[type="submit"]');
    setBusy(button, true);
    clearErrors(event.target);
    byId('login-error').textContent = '';
    try {
        await signIn(formValue('login-username'), byId('login-password').value);
    } catch (error) {
        // сервер отвечает на это по-английски, поэтому показываем свой текст
        if (error.status === 401) {
            byId('login-error').textContent = t('wrongLogin');
        } else {
            showErrors(error, 'login-error', { username: 'login-username', password: 'login-password' });
        }
        setBusy(button, false);
    }
}

function roleChoice(value, iconName, titleKey, textKey, checked) {
    return '<label class="choice"><input type="radio" name="register-role" value="' + value + '"' + (checked ? ' checked' : '') + '>' +
        '<strong>' + icon(iconName) + esc(t(titleKey)) + '</strong><small>' + esc(t(textKey)) + '</small></label>';
}

function registerPage() {
    setCoverPage(false);
    setTitle(t('registerTitle'));
    mainElement.innerHTML = authLayout('<h1>' + esc(t('registerTitle')) + '</h1><p class="auth-sub">' + esc(t('registerSub')) + '</p>' +
        '<form class="stack" id="register-form">' +
        '<div class="field"><span class="field-title">' + esc(t('role')) + '</span><div class="choice-row">' +
        roleChoice('tourist', 'compass', 'roleTourist', 'roleTouristText', true) +
        roleChoice('guide', 'route', 'roleGuide', 'roleGuideText', false) + '</div></div>' +
        field(t('username'), 'register-username', 'required autocomplete="username"') +
        passwordField(t('password'), 'register-password', 'new-password') +
        '<div class="form-grid">' +
        field(t('firstName') + ' (' + t('optional') + ')', 'register-first', 'autocomplete="given-name"') +
        field(t('lastName') + ' (' + t('optional') + ')', 'register-last', 'autocomplete="family-name"') +
        '</div>' +
        field(t('email') + ' (' + t('optional') + ')', 'register-email', 'type="email" autocomplete="email"') +
        '<p class="form-error" id="register-error" role="alert"></p>' +
        '<button class="button wide" type="submit">' + esc(t('register')) + '</button>' +
        '<p class="auth-switch">' + esc(t('hasAccount')) + ' <a href="#/login' + esc(nextSuffix()) + '">' + esc(t('login')) + '</a></p></form>');
    byId('register-form').addEventListener('submit', submitRegister);
}

async function submitRegister(event) {
    event.preventDefault();
    var button = event.target.querySelector('button[type="submit"]');
    setBusy(button, true);
    clearErrors(event.target);
    byId('register-error').textContent = '';

    var username = formValue('register-username');
    var password = byId('register-password').value;
    try {
        await api('/auth/register/', {
            method: 'POST',
            json: {
                username: username,
                password: password,
                role: event.target.querySelector('input[name="register-role"]:checked').value,
                email: formValue('register-email'),
                first_name: formValue('register-first'),
                last_name: formValue('register-last')
            }
        });
        await signIn(username, password);
    } catch (error) {
        showErrors(error, 'register-error', {
            username: 'register-username',
            password: 'register-password',
            email: 'register-email',
            first_name: 'register-first',
            last_name: 'register-last'
        });
        setBusy(button, false);
    }
}

// ---------- Профиль ----------

function profileLink(href, iconName, text) {
    return '<a class="profile-link" href="' + href + '">' + icon(iconName) + esc(text) + '</a>';
}

async function profilePage(number) {
    setCoverPage(false);
    setTitle(t('profile'));
    if (!state.user) {
        needLoginPage();
        return;
    }
    var user = state.user;
    var roles = { tourist: 'roleTourist', guide: 'roleGuide', admin: 'roleAdmin' };
    var fullName = (user.first_name + ' ' + user.last_name).trim();

    var links = profileLink('#/bookings', 'ticket', bookingsTitle());
    if (isRole('tourist')) {
        links = links + profileLink('#/favorites', 'heart', t('favorites'));
    }
    if (isRole('guide')) {
        links = links + profileLink('#/tours/new', 'plus', t('newTour'));
    }
    links = links + profileLink('#/ai', 'spark', t('ai'));

    var guideBlock = isRole('guide') ? '<section class="content-section"><h2>' + esc(t('myTours')) + '</h2><div id="my-tours">' + skeletonCards(2) + '</div></section>' : '';

    mainElement.innerHTML = '<div class="container page-body" style="padding-top:clamp(32px,5vw,60px)"><div class="narrow-page">' +
        '<div class="profile-head"><span class="avatar big">' + esc(user.username.charAt(0)) + '</span><div>' +
        '<h1>' + esc(fullName || user.username) + '</h1><p class="hint">@' + esc(user.username) + ' · ' + esc(t(roles[user.role])) + '</p></div></div>' +
        '<div class="profile-links">' + links + '</div>' +
        '<form class="panel stack" id="profile-form"><h3>' + esc(t('personalData')) + '</h3>' +
        '<div class="form-grid">' +
        field(t('firstName'), 'profile-first', 'autocomplete="given-name" ' + valueAttr(user.first_name)) +
        field(t('lastName'), 'profile-last', 'autocomplete="family-name" ' + valueAttr(user.last_name)) +
        '</div>' +
        field(t('email'), 'profile-email', 'type="email" autocomplete="email" ' + valueAttr(user.email)) +
        '<p class="form-error" id="profile-error" role="alert"></p>' +
        '<div><button class="button" type="submit">' + esc(t('save')) + '</button></div></form>' +
        guideBlock + '</div></div>';

    byId('profile-form').addEventListener('submit', submitProfile);

    if (isRole('guide')) {
        await loadMyTours(number);
    }
}

async function loadMyTours(number) {
    try {
        var tours = await api('/tours/');
        if (number !== renderNumber) {
            return;
        }
        var mine = [];
        for (var i = 0; i < tours.length; i++) {
            if (tours[i].guide === state.user.id) {
                mine.push(tours[i]);
            }
        }
        if (mine.length === 0) {
            byId('my-tours').innerHTML = emptyState('route', t('noMyTours'), '', '<a class="button" href="#/tours/new">' + esc(t('newTour')) + '</a>');
        } else {
            byId('my-tours').innerHTML = toursGrid(mine);
        }
    } catch (error) {
        if (number === renderNumber) {
            byId('my-tours').innerHTML = emptyState('compass', error.message);
        }
    }
}

async function submitProfile(event) {
    event.preventDefault();
    var button = event.target.querySelector('button[type="submit"]');
    setBusy(button, true);
    clearErrors(event.target);
    byId('profile-error').textContent = '';
    try {
        state.user = await api('/auth/me/', {
            method: 'PATCH',
            json: { email: formValue('profile-email'), first_name: formValue('profile-first'), last_name: formValue('profile-last') }
        });
        showToast(t('saved'));
        render();
    } catch (error) {
        showErrors(error, 'profile-error', { email: 'profile-email', first_name: 'profile-first', last_name: 'profile-last' });
        setBusy(button, false);
    }
}
