// Список мест и страница одного места

var allPlaces = [];
var placeTourCounts = {};

async function placesPage(number) {
    setCoverPage(false);
    setTitle(t('places'));

    var addButton = isRole('admin') ? '<button class="button" type="button" id="place-add">' + icon('plus') + esc(t('newPlace')) + '</button>' : '';

    mainElement.innerHTML = '<div class="container"><div class="page-head"><div class="page-head-row"><div>' +
        '<h1>' + esc(t('placesTitle')) + '</h1><p>' + esc(t('placesText')) + '</p></div>' + addButton + '</div></div>' +
        '<div class="toolbar"><div class="chips" id="place-categories">' + categoryChips('') + '</div>' +
        '<div class="field" style="min-width:min(100%,260px)"><input id="place-search" type="search" placeholder="' + esc(t('searchPlace')) + '" aria-label="' + esc(t('searchPlace')) + '"></div></div>' +
        '<div class="page-body" id="place-list" aria-live="polite">' + skeletonCards(6) + '</div></div>';

    if (byId('place-add')) {
        byId('place-add').addEventListener('click', function () {
            openPlaceDialog(null);
        });
    }
    byId('place-search').addEventListener('input', showPlaces);
    byId('place-categories').addEventListener('click', function (event) {
        var chip = event.target.closest('[data-tag]');
        if (!chip) {
            return;
        }
        var chips = byId('place-categories').querySelectorAll('[data-tag]');
        for (var i = 0; i < chips.length; i++) {
            chips[i].setAttribute('aria-pressed', chips[i] === chip);
        }
        showPlaces();
    });

    try {
        var answers = await Promise.all([api('/places/'), api('/tours/')]);
        if (number !== renderNumber) {
            return;
        }
        allPlaces = answers[0];
        placeTourCounts = countToursByPlace(answers[1]);
        showPlaces();
    } catch (error) {
        if (number === renderNumber) {
            byId('place-list').innerHTML = emptyState('compass', error.message);
        }
    }
}

// Все места уже загружены, поэтому ищем прямо в браузере: без запроса к серверу
function showPlaces() {
    var search = formValue('place-search').toLowerCase();
    var active = byId('place-categories').querySelector('[aria-pressed="true"]');
    var tag = active ? active.getAttribute('data-tag') : '';

    var html = '';
    for (var i = 0; i < allPlaces.length; i++) {
        var place = allPlaces[i];
        var text = (place.name + ' ' + place.city).toLowerCase();
        if (text.indexOf(search) !== -1 && (!tag || splitTags(place.tags).indexOf(tag) !== -1)) {
            html = html + placeTile(place, placeTourCounts[place.id]);
        }
    }
    byId('place-list').innerHTML = html ? '<div class="place-grid">' + html + '</div>' : emptyState('search', t('emptyPlaces'));
}

async function placePage(id, number) {
    setCoverPage(true);
    mainElement.innerHTML = '<section class="cover"></section><div class="container section">' + skeletonCards(3) + '</div>';

    var place;
    var tours;
    try {
        var answers = await Promise.all([api('/places/' + id + '/'), api('/tours/')]);
        place = answers[0];
        tours = answers[1];
    } catch (error) {
        if (number === renderNumber) {
            showPageError(error);
        }
        return;
    }
    if (number !== renderNumber) {
        return;
    }
    setTitle(place.name);

    var placeTours = [];
    for (var i = 0; i < tours.length; i++) {
        if (tours[i].place === place.id) {
            placeTours.push(tours[i]);
        }
    }

    var tools = '';
    if (isRole('admin')) {
        tools = '<div class="cover-tools"><button class="button glass small" type="button" id="place-edit">' + icon('edit') + esc(t('edit')) + '</button>' +
            '<button class="button glass small" type="button" id="place-delete">' + icon('trash') + esc(t('delete')) + '</button></div>';
    }

    var tags = splitTags(place.tags);
    var tagsHtml = '';
    for (var k = 0; k < tags.length; k++) {
        tagsHtml = tagsHtml + '<span class="tag">' + esc(tags[k]) + '</span>';
    }

    var toursHtml = placeTours.length ? toursGrid(placeTours) : emptyState('compass', t('noToursHere'));
    if (place.image) {
        setAmbient(place.image);
    }

    mainElement.innerHTML = '<section class="cover">' + coverHtml(place.image, place.id, place.name) +
        '<div class="container"><nav class="breadcrumbs" aria-label="' + esc(t('places')) + '"><a href="#/places">' + esc(t('places')) + '</a><span aria-hidden="true">/</span><span>' + esc(place.city) + '</span></nav>' +
        '<h1>' + esc(place.name) + '</h1><div class="cover-meta"><span>' + icon('pin') + esc(place.city) + '</span></div>' + tools + '</div></section>' +
        '<div class="container section"><div class="narrow-page" style="margin:0 0 clamp(32px,5vw,56px)"><p class="lead">' + esc(place.description) + '</p><div class="tags">' + tagsHtml + '</div></div>' +
        '<div class="section-head"><h2>' + esc(t('toursHere')) + '</h2></div>' + toursHtml + '</div>';

    if (isRole('admin')) {
        byId('place-edit').addEventListener('click', function () {
            openPlaceDialog(place);
        });
        byId('place-delete').addEventListener('click', function () {
            deletePlace(place.id);
        });
    }
}

// Одно окно и для нового места, и для изменения старого
function openPlaceDialog(place) {
    var values = place || {};
    var dialog = byId('dialog');
    dialog.className = 'dialog large';
    dialog.innerHTML = '<h2>' + esc(place ? t('edit') : t('newPlace')) + '</h2><form class="stack" id="place-form">' +
        field(t('title'), 'place-name', 'required maxlength="200" ' + valueAttr(values.name)) +
        field(t('city'), 'place-city', 'required maxlength="100" ' + valueAttr(values.city)) +
        textField(t('description'), 'place-description', values.description, true) +
        field(t('tagsField'), 'place-tags', 'maxlength="300" ' + valueAttr(values.tags)) +
        imageField(t('image') + ' (' + t('optional') + ')', 'place-image', values.image) +
        '<p class="form-error" id="place-error" role="alert"></p>' +
        '<div class="dialog-actions"><button class="button secondary" type="button" id="place-cancel">' + esc(t('cancel')) + '</button>' +
        '<button class="button" type="submit">' + esc(t('save')) + '</button></div></form>';
    dialog.showModal();

    watchImageField('place-image');
    byId('place-cancel').addEventListener('click', function () {
        dialog.close();
    });
    byId('place-form').addEventListener('submit', function (event) {
        submitPlace(event, place);
    });
}

async function submitPlace(event, place) {
    event.preventDefault();
    var button = event.target.querySelector('button[type="submit"]');
    setBusy(button, true);
    clearErrors(event.target);
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
        if (place) {
            await api('/places/' + place.id + '/', { method: 'PATCH', form: form });
        } else {
            await api('/places/', { method: 'POST', form: form });
        }
        byId('dialog').close();
        showToast(t('saved'));
        render();
    } catch (error) {
        showErrors(error, 'place-error', {
            name: 'place-name',
            city: 'place-city',
            description: 'place-description',
            tags: 'place-tags',
            image: 'place-image'
        });
        setBusy(button, false);
    }
}

async function deletePlace(id) {
    var agreed = await confirmDialog(t('confirmDeletePlace'), t('delete'));
    if (!agreed) {
        return;
    }
    try {
        await api('/places/' + id + '/', { method: 'DELETE' });
        showToast(t('deleted'));
        location.hash = '#/places';
    } catch (error) {
        showToast(error.message);
    }
}
