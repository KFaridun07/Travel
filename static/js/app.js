// Шапка, подвал и выбор страницы: адрес после # решает, какую страницу показать

// ---------- Шапка ----------

// Разделы сайта: адрес, ключ перевода и значок
function navItems() {
    var items = [['/', 'navHome', 'home'], ['/tours', 'tours', 'ticket'], ['/places', 'places', 'pin'], ['/ai', 'ai', 'spark']];
    if (isRole('tourist')) {
        items.push(['/favorites', 'favorites', 'heart']);
    }
    if (state.user) {
        items.push(['/bookings', 'bookings', 'calendar']);
    }
    if (chatAllowed()) {
        items.push(['/chat', 'chatNav', 'chat']);
    }
    return items;
}

// Открытый диалог #/chat/5 тоже относится к разделу #/chat
function navActive(href, path) {
    var current = path === href || (href === '/chat' && path.indexOf('/chat/') === 0);
    return current ? ' class="active" aria-current="page"' : '';
}

// Число непрочитанных сообщений рядом с разделом чата
function navBadge(href) {
    return href === '/chat' ? '<b class="nav-badge" data-chat-badge hidden></b>' : '';
}

function navLinks(path) {
    var items = navItems();
    var links = '';
    for (var i = 0; i < items.length; i++) {
        links = links + '<a href="#' + items[i][0] + '"' + navActive(items[i][0], path) + '>' + esc(t(items[i][1])) + navBadge(items[i][0]) + '</a>';
    }
    return links;
}

// Боковая панель со значками: подпись видна при наведении
function renderRail(path) {
    var items = navItems();
    var links = '';
    for (var i = 0; i < items.length; i++) {
        links = links + '<a href="#' + items[i][0] + '"' + navActive(items[i][0], path) + '>' + icon(items[i][2]) + '<span>' + esc(t(items[i][1])) + '</span>' + navBadge(items[i][0]) + '</a>';
    }
    byId('side-rail').setAttribute('aria-label', t('mainMenu'));
    byId('side-rail').innerHTML = links;
}

function submitHeaderSearch(event) {
    event.preventDefault();
    var text = formValue('header-search-input');
    location.hash = text ? '#/tours?search=' + encodeURIComponent(text) : '#/tours';
}

function accountHtml() {
    if (!state.user) {
        return '<a class="header-login" href="#/login">' + esc(t('login')) + '</a>' +
            '<a class="button small" href="#/register">' + esc(t('register')) + '</a>';
    }
    return '<details class="account-menu" id="account-menu"><summary><span class="avatar">' + esc(state.user.username.charAt(0)) + '</span>' +
        '<span class="account-name">' + esc(state.user.username) + '</span></summary>' +
        '<div class="account-popup"><a href="#/profile">' + esc(t('profile')) + '</a><a href="#/bookings">' + esc(t('bookings')) + '</a>' +
        '<button type="button" id="logout-button">' + esc(t('logout')) + '</button></div></details>';
}

function renderHeader(path) {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var themeLabel = dark ? t('themeToLight') : t('themeToDark');
    var guestLinks = state.user ? '' : '<a href="#/login">' + esc(t('login')) + '</a><a class="button" href="#/register">' + esc(t('register')) + '</a>';

    function langOption(value, text) {
        return '<option value="' + value + '"' + (state.lang === value ? ' selected' : '') + '>' + text + '</option>';
    }

    var header = byId('site-header');
    header.classList.remove('menu-open');
    header.innerHTML = '<div class="container header-row">' +
        '<a class="logo" href="#/">' + logoHtml() + '</a>' +
        '<div class="history-buttons"><button class="round-button back" type="button" id="history-back" aria-label="' + esc(t('navBack')) + '" title="' + esc(t('navBack')) + '">' + icon('arrow') + '</button>' +
        '<button class="round-button" type="button" id="history-forward" aria-label="' + esc(t('navForward')) + '" title="' + esc(t('navForward')) + '">' + icon('arrow') + '</button></div>' +
        '<form class="header-search" id="header-search" role="search">' + icon('search') +
        '<input id="header-search-input" type="search" placeholder="' + esc(t('searchTour')) + '" aria-label="' + esc(t('search')) + '"></form>' +
        '<div class="header-tools">' +
        '<select class="lang-select" id="lang-select" aria-label="' + esc(t('language')) + '">' + langOption('ru', 'RU') + langOption('en', 'EN') + langOption('tg', 'TJ') + '</select>' +
        '<button class="icon-button" type="button" id="theme-button" aria-label="' + esc(themeLabel) + '" title="' + esc(themeLabel) + '">' + icon(dark ? 'sun' : 'moon') + '</button>' +
        accountHtml() +
        '<button class="icon-button menu-button" type="button" id="menu-button" aria-expanded="false" aria-label="' + esc(t('mainMenu')) + '">' + icon('menu') + '</button>' +
        '</div></div>' +
        '<nav class="mobile-menu" aria-label="' + esc(t('mainMenu')) + '">' + navLinks(path) + guestLinks + '</nav>';

    renderRail(path);

    byId('history-back').addEventListener('click', function () {
        history.back();
    });
    byId('history-forward').addEventListener('click', function () {
        history.forward();
    });
    byId('header-search').addEventListener('submit', submitHeaderSearch);
    byId('theme-button').addEventListener('click', toggleTheme);
    byId('lang-select').addEventListener('change', changeLanguage);
    byId('menu-button').addEventListener('click', function (event) {
        var open = header.classList.toggle('menu-open');
        event.currentTarget.setAttribute('aria-expanded', open);
        event.currentTarget.innerHTML = icon(open ? 'close' : 'menu');
    });
    if (byId('logout-button')) {
        byId('logout-button').addEventListener('click', logout);
    }

    byId('skip-link').textContent = t('skip');
    updateChatBadges();
}

function renderFooter() {
    byId('site-footer').innerHTML = '<div class="container"><div class="footer-row">' +
        '<div><a class="logo" href="#/">' + logoHtml() + '</a><p>' + esc(t('footerText')) + '</p></div>' +
        '<div><span class="footer-title">' + esc(t('footerTravel')) + '</span><div class="footer-links"><a href="#/tours">' + esc(t('tours')) + '</a><a href="#/places">' + esc(t('places')) + '</a><a href="#/ai">' + esc(t('ai')) + '</a></div></div>' +
        '<div><span class="footer-title">' + esc(t('footerProject')) + '</span><div class="footer-links"><a href="#/credits">' + esc(t('creditsTitle')) + '</a><a href="/swagger/">' + esc(t('footerApi')) + '</a></div></div>' +
        '</div><div class="footer-bottom">TravelMate · ' + new Date().getFullYear() + '</div></div>';
}

function toggleTheme() {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var theme = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    writeStorage('theme', theme);
    renderHeader(currentPath());
    byId('theme-button').focus();
}

function changeLanguage(event) {
    setLanguage(event.target.value);
    writeStorage('lang', state.lang);
    render();
    byId('lang-select').focus();
}

function setLanguage(lang) {
    state.lang = lang;
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
    state.favorites = {};
    if (location.hash === '#/' || location.hash === '') {
        render();
    } else {
        location.hash = '#/';
    }
}

// Шапка становится непрозрачной, когда страницу прокрутили
function updateHeaderOnScroll() {
    byId('site-header').classList.toggle('scrolled', window.scrollY > 30);
}

// Меню аккаунта закрывается при клике в любом другом месте
document.addEventListener('click', function (event) {
    var menu = byId('account-menu');
    if (menu && menu.open && !menu.contains(event.target)) {
        menu.open = false;
    }
});

// ---------- Выбор страницы ----------

// Адрес без параметров: из #/tours?city=Душанбе получаем /tours
function currentPath() {
    var path = location.hash.slice(1) || '/';
    return path.split('?')[0];
}

function notFoundPage() {
    setCoverPage(false);
    setTitle(t('notFound'));
    mainElement.innerHTML = pageWrap(emptyState('compass', t('notFound'), '', '<a class="button" href="#/">' + esc(t('toHome')) + '</a>'));
}

function render() {
    renderNumber = renderNumber + 1;
    var number = renderNumber;
    var path = currentPath();
    var parts = path.split('/');

    // то, что осталось от прошлой страницы
    document.body.classList.remove('has-mobile-book');
    leaveChat();
    syncChatSocket();
    setAmbient(staticUrl('img/scenes/hero_registan.jpg'));
    var dialog = byId('dialog');
    if (dialog.open) {
        dialog.close();
    }

    renderHeader(path);
    renderFooter();
    updateHeaderOnScroll();
    window.scrollTo({ top: 0, behavior: 'instant' });

    // запускаем плавное появление заново и переводим фокус на новую страницу
    mainElement.style.animation = 'none';
    void mainElement.offsetWidth;
    mainElement.style.animation = '';
    mainElement.focus({ preventScroll: true });

    var isNumber = /^\d+$/.test(parts[2] || '');

    if (path === '/') {
        homePage(number);
    } else if (path === '/tours') {
        toursPage(number);
    } else if (path === '/tours/new') {
        tourFormPage(null, number);
    } else if (parts[1] === 'tour' && isNumber && parts.length === 3) {
        tourPage(parts[2], number);
    } else if (parts[1] === 'tour' && isNumber && parts[3] === 'edit') {
        tourFormPage(parts[2], number);
    } else if (path === '/places') {
        placesPage(number);
    } else if (parts[1] === 'place' && isNumber && parts.length === 3) {
        placePage(parts[2], number);
    } else if (path === '/favorites') {
        favoritesPage(number);
    } else if (path === '/bookings') {
        bookingsPage(number);
    } else if (path === '/chat') {
        chatPage(null, number);
    } else if (parts[1] === 'chat' && isNumber && parts.length === 3) {
        chatPage(parts[2], number);
    } else if (path === '/ai') {
        aiPage(number);
    } else if (path === '/login') {
        loginPage();
    } else if (path === '/register') {
        registerPage();
    } else if (path === '/profile') {
        profilePage(number);
    } else if (path === '/credits') {
        creditsPage();
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
            await loadFavorites();
        } catch (error) {
            // сервер не ответил или токен устарел: продолжаем как гость
            if (error.status === 401) {
                clearTokens();
            }
            state.user = null;
        }
    }

    window.addEventListener('hashchange', render);
    window.addEventListener('scroll', updateHeaderOnScroll, { passive: true });
    render();
}

start();
