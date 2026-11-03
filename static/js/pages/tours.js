// Каталог туров и форма создания тура

// Категории берём из тегов места: тег в базе -> ключ перевода
var TOUR_CATEGORIES = [
    ['', 'catAll'],
    ['горы', 'catMountains'],
    ['озеро', 'catLakes'],
    ['история', 'catHistory'],
    ['архитектура', 'catArchitecture']
];

// Все места нужны каталогу, чтобы знать города и теги
var catalogPlaces = [];
var catalogTimer = null;
// Номер запроса: ответ на старый запрос не должен заменить новый список
var catalogRequest = 0;

function readCatalogFilters() {
    var query = currentQuery();
    return {
        search: query.get('search') || '',
        city: query.get('city') || '',
        days: query.get('days') || '',
        price_min: query.get('price_min') || '',
        price_max: query.get('price_max') || '',
        tag: query.get('tag') || '',
        sort: query.get('sort') || 'date'
    };
}

// Фильтры храним в адресе: страницу можно обновить или отправить ссылкой
function writeCatalogFilters(filters) {
    var query = new URLSearchParams();
    for (var name in filters) {
        if (filters[name] && !(name === 'sort' && filters[name] === 'date')) {
            query.set(name, filters[name]);
        }
    }
    var text = query.toString();
    // replaceState меняет адрес, но не перерисовывает всю страницу
    history.replaceState(null, '', '#/tours' + (text ? '?' + text : ''));
}

function cityOptionsHtml(selected) {
    var cities = [];
    for (var i = 0; i < catalogPlaces.length; i++) {
        if (cities.indexOf(catalogPlaces[i].city) === -1) {
            cities.push(catalogPlaces[i].city);
        }
    }
    cities.sort();

    // город из адреса может быть написан не так, как в базе: тоже показываем его
    if (selected && cities.indexOf(selected) === -1) {
        cities.unshift(selected);
    }

    var html = '<option value="">' + esc(t('anyCity')) + '</option>';
    for (var k = 0; k < cities.length; k++) {
        html = html + '<option value="' + esc(cities[k]) + '"' + (cities[k] === selected ? ' selected' : '') + '>' + esc(cities[k]) + '</option>';
    }
    return html;
}

function categoryChips(selected) {
    var html = '';
    for (var i = 0; i < TOUR_CATEGORIES.length; i++) {
        var active = TOUR_CATEGORIES[i][0] === selected;
        html = html + '<button class="chip" type="button" data-tag="' + esc(TOUR_CATEGORIES[i][0]) + '" aria-pressed="' + active + '">' + esc(t(TOUR_CATEGORIES[i][1])) + '</button>';
    }
    return html;
}

async function toursPage(number) {
    setCoverPage(false);
    setTitle(t('tours'));
    var filters = readCatalogFilters();
    var newButton = isRole('guide') ? '<a class="button" href="#/tours/new">' + icon('plus') + esc(t('newTour')) + '</a>' : '';

    function sortOption(value, key) {
        return '<option value="' + value + '"' + (filters.sort === value ? ' selected' : '') + '>' + esc(t(key)) + '</option>';
    }

    mainElement.innerHTML = '<div class="container"><div class="page-head"><div class="page-head-row"><div>' +
        '<h1>' + esc(t('catalogTitle')) + '</h1><p>' + esc(t('catalogText')) + '</p></div>' + newButton + '</div></div>' +
        '<div class="chips" id="tour-categories" style="margin-bottom:22px">' + categoryChips(filters.tag) + '</div>' +
        '<div class="catalog page-body">' +
        '<details class="filters-box" id="filters-box"><summary>' + icon('filter') + esc(t('filters')) + '</summary>' +
        '<form class="filters-form" id="tour-filters">' +
        field(t('search'), 'filter-search', 'type="search" placeholder="' + esc(t('searchTour')) + '" ' + valueAttr(filters.search)) +
        '<div class="field"><label for="filter-city">' + esc(t('city')) + '</label><select id="filter-city">' + cityOptionsHtml(filters.city) + '</select></div>' +
        '<div class="field-pair">' +
        field(t('priceMin'), 'filter-price-min', 'type="number" min="0" step="any" ' + valueAttr(filters.price_min)) +
        field(t('priceMax'), 'filter-price-max', 'type="number" min="0" step="any" ' + valueAttr(filters.price_max)) +
        '</div>' +
        field(t('days'), 'filter-days', 'type="number" min="1" step="1" ' + valueAttr(filters.days)) +
        '<button class="button secondary small" type="button" id="filter-reset">' + esc(t('reset')) + '</button>' +
        '</form></details>' +
        '<div><div class="toolbar"><span class="result-count" id="tour-count" aria-live="polite"></span>' +
        '<label class="sort-field">' + esc(t('sortBy')) + '<select id="tour-sort">' +
        sortOption('date', 'sortDate') + sortOption('cheap', 'sortCheap') + sortOption('expensive', 'sortExpensive') + sortOption('rating', 'sortRating') +
        '</select></label></div>' +
        '<div id="tour-list">' + skeletonCards(6) + '</div></div></div></div>';

    // на компьютере фильтры всегда открыты, на телефоне свёрнуты
    byId('filters-box').open = window.innerWidth > 900;

    byId('tour-filters').addEventListener('input', onCatalogInput);
    byId('tour-filters').addEventListener('submit', function (event) {
        event.preventDefault();
    });
    byId('tour-sort').addEventListener('change', updateCatalog);
    byId('filter-reset').addEventListener('click', function () {
        history.replaceState(null, '', '#/tours');
        render();
    });
    byId('tour-categories').addEventListener('click', onCategoryClick);

    try {
        catalogPlaces = await api('/places/');
    } catch (error) {
        catalogPlaces = [];
    }
    if (number !== renderNumber) {
        return;
    }
    byId('filter-city').innerHTML = cityOptionsHtml(filters.city);
    await loadCatalog(number);
}

function onCatalogInput() {
    // ждём паузу в наборе, чтобы не отправлять запрос на каждую букву
    clearTimeout(catalogTimer);
    catalogTimer = setTimeout(updateCatalog, 350);
}

function onCategoryClick(event) {
    var chip = event.target.closest('[data-tag]');
    if (!chip) {
        return;
    }
    var chips = byId('tour-categories').querySelectorAll('[data-tag]');
    for (var i = 0; i < chips.length; i++) {
        chips[i].setAttribute('aria-pressed', chips[i] === chip);
    }
    updateCatalog();
}

function selectedCategory() {
    var active = byId('tour-categories').querySelector('[aria-pressed="true"]');
    return active ? active.getAttribute('data-tag') : '';
}

function updateCatalog() {
    // пользователь мог уже уйти на другую страницу
    if (!byId('tour-filters')) {
        return;
    }
    writeCatalogFilters({
        search: formValue('filter-search'),
        city: byId('filter-city').value,
        days: formValue('filter-days'),
        price_min: formValue('filter-price-min'),
        price_max: formValue('filter-price-max'),
        tag: selectedCategory(),
        sort: byId('tour-sort').value
    });
    loadCatalog(renderNumber);
}

function sortTours(tours, sort) {
    tours.sort(function (a, b) {
        if (sort === 'cheap') {
            return Number(a.price) - Number(b.price);
        }
        if (sort === 'expensive') {
            return Number(b.price) - Number(a.price);
        }
        if (sort === 'rating') {
            return Number(b.average_rating) - Number(a.average_rating);
        }
        return a.start_date < b.start_date ? -1 : 1;
    });
}

// Оставляем только туры в места с нужным тегом
function filterByTag(tours, tag) {
    if (!tag) {
        return tours;
    }
    var placeIds = {};
    for (var i = 0; i < catalogPlaces.length; i++) {
        if (splitTags(catalogPlaces[i].tags).indexOf(tag) !== -1) {
            placeIds[catalogPlaces[i].id] = true;
        }
    }
    var result = [];
    for (var k = 0; k < tours.length; k++) {
        if (placeIds[tours[k].place]) {
            result.push(tours[k]);
        }
    }
    return result;
}

async function loadCatalog(number) {
    var filters = readCatalogFilters();
    var query = new URLSearchParams();
    var names = ['search', 'city', 'days', 'price_min', 'price_max'];
    for (var i = 0; i < names.length; i++) {
        if (filters[names[i]]) {
            query.set(names[i], filters[names[i]]);
        }
    }

    catalogRequest = catalogRequest + 1;
    var request = catalogRequest;
    var list = byId('tour-list');

    try {
        var tours = await api('/tours/?' + query.toString());
        if (number !== renderNumber || request !== catalogRequest) {
            return;
        }
        tours = filterByTag(tours, filters.tag);
        sortTours(tours, filters.sort);

        byId('tour-count').textContent = t('foundCount') + ': ' + tours.length;
        if (tours.length === 0) {
            list.innerHTML = emptyState('search', t('emptyTours'), t('emptyToursText'));
        } else {
            list.innerHTML = toursGrid(tours);
        }
    } catch (error) {
        if (number === renderNumber && request === catalogRequest) {
            byId('tour-count').textContent = '';
            list.innerHTML = emptyState('compass', error.message);
        }
    }
}

// ---------- Форма создания и изменения тура ----------

async function tourFormPage(id, number) {
    setCoverPage(false);
    setTitle(id ? t('editTour') : t('newTour'));
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
        mainElement.innerHTML = pageWrap(emptyState('pin', t('noPlacesYet')));
        return;
    }

    var values = tour || {};
    var options = '';
    for (var i = 0; i < places.length; i++) {
        var selected = values.place === places[i].id ? ' selected' : '';
        options = options + '<option value="' + places[i].id + '"' + selected + '>' + esc(places[i].name) + ', ' + esc(places[i].city) + '</option>';
    }

    mainElement.innerHTML = '<div class="container page-body"><div class="narrow-page"><div class="page-head"><h1>' + esc(id ? t('editTour') : t('newTour')) + '</h1></div>' +
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
        imageField(t('image') + ' (' + t('optional') + ')', 'tour-image', values.image) +
        '<p class="form-error" id="tour-error" role="alert"></p>' +
        '<div class="form-actions"><button class="button" type="submit">' + esc(t('save')) + '</button>' +
        '<a class="button secondary" href="' + (id ? '#/tour/' + id : '#/tours') + '">' + esc(t('cancel')) + '</a></div></form></div></div>';

    watchImageField('tour-image');
    byId('tour-form').addEventListener('submit', function (event) {
        submitTourForm(event, id);
    });
}

async function submitTourForm(event, id) {
    event.preventDefault();
    var button = event.target.querySelector('button[type="submit"]');
    setBusy(button, true);
    clearErrors(event.target);
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
        showErrors(error, 'tour-error', {
            title: 'tour-title',
            description: 'tour-description',
            place: 'tour-place',
            price: 'tour-price',
            days: 'tour-days',
            max_people: 'tour-max',
            start_date: 'tour-date',
            image: 'tour-image'
        });
        setBusy(button, false);
    }
}
