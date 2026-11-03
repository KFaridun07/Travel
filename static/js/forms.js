// Поля форм и показ ошибок

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

// Поле пароля с кнопкой "показать"
function passwordField(label, id, autocomplete) {
    return '<div class="field"><label for="' + id + '">' + esc(label) + '</label>' +
        '<div class="password-field"><input id="' + id + '" type="password" required autocomplete="' + autocomplete + '">' +
        '<button class="icon-button" type="button" data-toggle-password="' + id + '" aria-label="' + esc(t('showPassword')) + '" title="' + esc(t('showPassword')) + '">' + icon('eye') + '</button>' +
        '</div></div>';
}

function togglePassword(button) {
    var input = byId(button.getAttribute('data-toggle-password'));
    input.type = input.type === 'password' ? 'text' : 'password';
}

// Поле загрузки картинки с предпросмотром
function imageField(label, id, currentImage) {
    var preview = '<img id="' + id + '-preview" alt="" hidden>';
    if (currentImage) {
        preview = '<img id="' + id + '-preview" src="' + esc(currentImage) + '" alt="">';
    }
    return '<div class="field"><span class="field-title">' + esc(label) + '</span>' +
        '<label class="dropzone" id="' + id + '-zone">' + icon('upload') +
        '<strong>' + esc(t('dropTitle')) + '</strong><span>' + esc(t('dropHint')) + '</span>' +
        preview + '<input id="' + id + '" type="file" accept="image/*" aria-label="' + esc(label) + '">' +
        '</label></div>';
}

// Подсветка при перетаскивании файла и показ выбранной картинки
function watchImageField(id) {
    var input = byId(id);
    var zone = byId(id + '-zone');
    zone.addEventListener('dragenter', function () {
        zone.classList.add('drag');
    });
    zone.addEventListener('dragleave', function () {
        zone.classList.remove('drag');
    });
    zone.addEventListener('drop', function () {
        zone.classList.remove('drag');
    });
    input.addEventListener('change', function () {
        if (input.files.length > 0) {
            var preview = byId(id + '-preview');
            preview.src = URL.createObjectURL(input.files[0]);
            preview.hidden = false;
        }
    });
}

function clearErrors(form) {
    var old = form.querySelectorAll('.field-error');
    for (var i = 0; i < old.length; i++) {
        old[i].remove();
    }
    var invalid = form.querySelectorAll('[aria-invalid]');
    for (var k = 0; k < invalid.length; k++) {
        invalid[k].removeAttribute('aria-invalid');
    }
}

// Показываем ошибку сервера рядом с полем, к которому она относится.
// fields: название поля на сервере -> id поля в форме
function showErrors(error, boxId, fields) {
    var box = byId(boxId);
    var other = [];
    var data = error.data;

    if (!data || typeof data !== 'object') {
        box.textContent = error.message;
        return;
    }

    for (var name in data) {
        var value = data[name];
        var input = fields && fields[name] ? byId(fields[name]) : null;
        if (input && Array.isArray(value)) {
            input.setAttribute('aria-invalid', 'true');
            var note = document.createElement('small');
            note.className = 'field-error';
            note.textContent = value.join(' ');
            input.closest('.field').appendChild(note);
        } else if (Array.isArray(value)) {
            other.push(value.join(' '));
        } else if (typeof value === 'string' && name !== 'code') {
            other.push(value);
        }
    }
    box.textContent = other.join('\n');
}
