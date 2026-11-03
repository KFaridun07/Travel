// AI-помощник: чат, поиск по фото и план поездки

var AI_TABS = [
    ['chat', 'chat', 'tabChat', 'featureChat'],
    ['photo', 'camera', 'tabPhoto', 'featurePhoto'],
    ['plan', 'route', 'tabPlan', 'featurePlan']
];

// Туры нужны, чтобы под ответом AI показать ссылки на упомянутые туры
var aiTours = [];
var photoPreviewUrl = null;

function aiHeader() {
    return '<section class="ai-hero"><img src="' + esc(staticUrl('img/places/registan.jpg')) + '" alt="">' +
        '<div class="container"><span class="hero-kicker">' + esc(t('aiKicker')) + '</span>' +
        '<h1>' + esc(t('aiTitle')) + '</h1><p>' + esc(t('aiText')) + '</p></div></section>';
}

function aiPage(number) {
    setCoverPage(true);
    setTitle(t('ai'));

    // гостю показываем, что умеет помощник, вместо пустой просьбы войти
    if (!state.user) {
        var features = '';
        for (var g = 0; g < AI_TABS.length; g++) {
            features = features + '<div class="ai-tab">' + icon(AI_TABS[g][1]) + '<span><strong>' + esc(t(AI_TABS[g][2])) + '</strong><small>' + esc(t(AI_TABS[g][3])) + '</small></span></div>';
        }
        mainElement.innerHTML = aiHeader() + '<div class="container ai-body"><div class="ai-tabs">' + features + '</div>' +
            '<div class="panel guest-card"><h2>' + esc(t('aiGuestTitle')) + '</h2><p>' + esc(t('aiGuestText')) + '</p>' +
            '<div class="form-actions"><a class="button" href="' + loginHref() + '">' + esc(t('login')) + '</a>' +
            '<a class="button secondary" href="#/register?next=' + encodeURIComponent('/ai') + '">' + esc(t('register')) + '</a></div></div></div>';
        return;
    }

    var tab = currentQuery().get('tab');
    if (tab !== 'photo' && tab !== 'plan') {
        tab = 'chat';
    }

    var tabs = '';
    for (var i = 0; i < AI_TABS.length; i++) {
        tabs = tabs + '<button class="ai-tab" type="button" role="tab" data-ai-tab="' + AI_TABS[i][0] + '" aria-selected="' + (tab === AI_TABS[i][0]) + '">' + icon(AI_TABS[i][1]) +
            '<span><strong>' + esc(t(AI_TABS[i][2])) + '</strong><small>' + esc(t(AI_TABS[i][3])) + '</small></span></button>';
    }

    mainElement.innerHTML = aiHeader() + '<div class="container ai-body"><div class="ai-tabs" role="tablist">' + tabs + '</div>' +
        '<div id="ai-content"></div><p class="field-note" style="margin-top:12px">' + esc(t('aiWarning')) + '</p></div>';

    var buttons = mainElement.querySelectorAll('[data-ai-tab]');
    for (var b = 0; b < buttons.length; b++) {
        buttons[b].addEventListener('click', function (event) {
            location.hash = '#/ai?tab=' + event.currentTarget.getAttribute('data-ai-tab');
        });
    }

    if (tab === 'chat') {
        chatTab(number);
    } else if (tab === 'photo') {
        photoTab(number);
    } else {
        planTab(number);
    }
}

// ---------- Чат ----------

function chatEmptyHtml() {
    var keys = ['askWeekend', 'askCheap', 'askHistory', 'askActive'];
    var chips = '';
    for (var i = 0; i < keys.length; i++) {
        chips = chips + '<button class="chip" type="button" data-question="' + esc(t(keys[i])) + '">' + esc(t(keys[i])) + '</button>';
    }
    return '<div class="chat-empty" id="chat-empty">' + icon('spark') + '<h3>' + esc(t('chatHello')) + '</h3><p class="hint">' + esc(t('chatIntro')) + '</p>' +
        '<div class="chips">' + chips + '</div></div>';
}

// Ссылки на туры, названия которых есть в ответе AI
function mentionedTours(answer) {
    var html = '';
    for (var i = 0; i < aiTours.length; i++) {
        if (String(answer).indexOf(aiTours[i].title) !== -1) {
            html = html + '<a class="chip" href="#/tour/' + aiTours[i].id + '">' + esc(aiTours[i].title) + icon('arrow') + '</a>';
        }
    }
    return html ? '<div class="bubble-tours">' + html + '</div>' : '';
}

function answerHtml(answer) {
    return '<div class="bubble bot">' + esc(cleanAiText(answer)) + '</div>' + mentionedTours(answer);
}

function scrollChatDown() {
    var log = byId('chat-log');
    if (log) {
        log.scrollTop = log.scrollHeight;
    }
}

async function chatTab(number) {
    byId('ai-content').innerHTML = '<div class="chat"><div class="chat-log" id="chat-log" aria-live="polite"><p class="loading">' + esc(t('loading')) + '</p></div>' +
        '<form class="composer" id="chat-form"><textarea id="chat-question" rows="1" maxlength="2000" required placeholder="' + esc(t('yourQuestion')) + '" aria-label="' + esc(t('yourQuestion')) + '"></textarea>' +
        '<button class="button" type="submit" aria-label="' + esc(t('send')) + '" title="' + esc(t('send')) + '">' + icon('send') + '</button></form></div>';

    byId('chat-form').addEventListener('submit', submitChat);
    byId('chat-log').addEventListener('click', function (event) {
        var chip = event.target.closest('[data-question]');
        if (chip) {
            byId('chat-question').value = chip.getAttribute('data-question');
            byId('chat-form').requestSubmit();
        }
    });

    // Enter отправляет вопрос, Shift+Enter переносит строку
    byId('chat-question').addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            byId('chat-form').requestSubmit();
        }
    });
    // поле растёт вместе с текстом
    byId('chat-question').addEventListener('input', function (event) {
        event.target.style.height = 'auto';
        event.target.style.height = event.target.scrollHeight + 2 + 'px';
    });

    try {
        var answers = await Promise.all([api('/ai/chat/history/'), api('/tours/')]);
        if (number !== renderNumber) {
            return;
        }
        var messages = answers[0];
        aiTours = answers[1];

        var html = '';
        for (var i = 0; i < messages.length; i++) {
            html = html + '<div class="bubble user">' + esc(messages[i].question) + '</div>' + answerHtml(messages[i].answer);
        }
        byId('chat-log').innerHTML = html || chatEmptyHtml();
        scrollChatDown();
    } catch (error) {
        if (number === renderNumber) {
            byId('chat-log').innerHTML = '<div class="bubble bot error">' + esc(error.message) + '</div>';
        }
    }
}

async function submitChat(event) {
    event.preventDefault();
    var number = renderNumber;
    var input = byId('chat-question');
    var question = input.value.trim();
    var button = event.target.querySelector('button[type="submit"]');
    if (!question || button.disabled) {
        return;
    }

    var log = byId('chat-log');
    if (byId('chat-empty')) {
        byId('chat-empty').remove();
    }

    // вопрос показываем сразу, а пока AI думает, показываем три точки
    log.insertAdjacentHTML('beforeend', '<div class="bubble user">' + esc(question) + '</div>' +
        '<div class="bubble bot" id="chat-typing" aria-label="' + esc(t('aiWait')) + '"><span class="typing"><span></span><span></span><span></span></span></div>');
    input.value = '';
    input.style.height = 'auto';
    setBusy(button, true);
    scrollChatDown();

    try {
        var message = await api('/ai/chat/', { method: 'POST', json: { question: question } });
        if (number !== renderNumber) {
            return;
        }
        byId('chat-typing').outerHTML = answerHtml(message.answer);
    } catch (error) {
        if (number !== renderNumber) {
            return;
        }
        byId('chat-typing').outerHTML = '<div class="bubble bot error">' + esc(error.message) + '</div>';
        // при ошибке возвращаем вопрос, чтобы не набирать его заново
        input.value = question;
    }
    setBusy(button, false);
    scrollChatDown();
    input.focus();
}

// ---------- Поиск по фото ----------

function photoTab(number) {
    byId('ai-content').innerHTML = '<div class="photo-layout"><form class="stack" id="photo-form">' +
        '<label class="dropzone" id="photo-zone">' + icon('camera') + '<strong>' + esc(t('dropTitle')) + '</strong><span>' + esc(t('photoIntro')) + '</span>' +
        '<img id="photo-preview" alt="" hidden><input id="photo-file" type="file" accept="image/jpeg,image/png" required aria-label="' + esc(t('photoField')) + '"></label>' +
        '<p class="form-error" id="photo-error" role="alert"></p>' +
        '<button class="button wide" type="submit">' + icon('spark') + esc(t('recognize')) + '</button></form>' +
        '<div class="panel photo-result" id="photo-result" aria-live="polite"><h3>' + esc(t('photoHowTitle')) + '</h3><p class="hint">' + esc(t('photoHowText')) + '</p></div></div>' +
        '<div id="photo-tours"></div>';

    var zone = byId('photo-zone');
    zone.addEventListener('dragenter', function () {
        zone.classList.add('drag');
    });
    zone.addEventListener('dragleave', function () {
        zone.classList.remove('drag');
    });
    zone.addEventListener('drop', function () {
        zone.classList.remove('drag');
    });
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
        input.value = '';
        return;
    }
    // старый адрес картинки освобождаем, чтобы не занимать память
    if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
    }
    photoPreviewUrl = URL.createObjectURL(input.files[0]);
    preview.src = photoPreviewUrl;
    preview.hidden = false;
}

async function submitPhoto(event) {
    event.preventDefault();
    var button = event.target.querySelector('button[type="submit"]');
    var number = renderNumber;
    var file = byId('photo-file').files[0];
    var errorBox = byId('photo-error');
    if (!file) {
        return;
    }

    setBusy(button, true);
    errorBox.textContent = '';
    byId('photo-zone').classList.add('scanning');
    byId('photo-result').innerHTML = '<p class="hint">' + esc(t('aiWait')) + '</p>';
    byId('photo-tours').innerHTML = '';

    var form = new FormData();
    form.append('image', file);
    try {
        var result = await api('/ai/photo-search/', { method: 'POST', form: form });
        if (number !== renderNumber) {
            return;
        }
        showPhotoResult(result);
    } catch (error) {
        if (number !== renderNumber) {
            return;
        }
        byId('photo-result').innerHTML = '';
        showErrors(error, 'photo-error');
    }
    byId('photo-zone').classList.remove('scanning');
    setBusy(button, false);
}

function showPhotoResult(result) {
    var recognized = result.recognized || {};

    var tagsHtml = '';
    if (Array.isArray(recognized.tags)) {
        for (var i = 0; i < recognized.tags.length; i++) {
            tagsHtml = tagsHtml + '<span class="tag">' + esc(recognized.tags[i]) + '</span>';
        }
    }

    var html = '<span class="kicker">' + esc(t('recognized')) + '</span>' +
        '<p class="recognized-name">' + esc(recognized.name || t('unknownPlace')) + '</p>' +
        '<p class="hint">' + esc(recognized.city) + '</p><div class="tags" style="margin-bottom:16px">' + tagsHtml + '</div>';

    if (result.place) {
        html = html + '<span class="field-title">' + esc(t('foundPlace')) + '</span><div style="margin-top:8px">' + placeTile(result.place) + '</div>';
    } else {
        html = html + '<p class="notice">' + esc(t('notInBase')) + '</p>';
    }
    byId('photo-result').innerHTML = html;

    if (result.tours && result.tours.length > 0) {
        byId('photo-tours').innerHTML = '<div class="content-section"><h2>' + esc(t('toursHere')) + '</h2>' + toursGrid(result.tours) + '</div>';
    }
}

// ---------- План поездки ----------

// Строки "День 1" становятся заголовками маршрута
function planHtml(text) {
    var lines = cleanAiText(text).split('\n');
    var days = [];
    var intro = [];

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) {
            continue;
        }
        line = line.replace(/^[-*]\s+/, '• ');
        if (/^(день|day|рӯзи|рӯз)\s*\d+/i.test(line)) {
            days.push({ title: line.replace(/:$/, ''), lines: [] });
        } else if (days.length > 0) {
            days[days.length - 1].lines.push(line);
        } else {
            intro.push(line);
        }
    }

    var html = '';
    if (intro.length > 0) {
        html = html + '<p style="white-space:pre-wrap">' + esc(intro.join('\n')) + '</p>';
    }
    if (days.length > 0) {
        html = html + '<ol class="timeline">';
        for (var d = 0; d < days.length; d++) {
            html = html + '<li><h4>' + esc(days[d].title) + '</h4><p>' + esc(days[d].lines.join('\n')) + '</p></li>';
        }
        html = html + '</ol>';
    }
    return html;
}

function planTab(number) {
    var interests = ['interestMountains', 'interestHistory', 'interestFood', 'interestNature', 'interestCrafts'];
    var chips = '';
    for (var i = 0; i < interests.length; i++) {
        chips = chips + '<button class="chip" type="button" data-interest="' + esc(t(interests[i])) + '" aria-pressed="false">' + esc(t(interests[i])) + '</button>';
    }

    byId('ai-content').innerHTML = '<div class="plan-layout"><form class="panel stack" id="plan-form"><p class="hint" style="margin:0">' + esc(t('planIntro')) + '</p>' +
        field(t('city'), 'plan-city', 'required maxlength="100"') +
        '<div class="field-pair">' +
        field(t('days'), 'plan-days', 'type="number" min="1" max="30" value="2" required') +
        field(t('budget'), 'plan-budget', 'type="number" min="0" step="0.01" required') +
        '</div>' +
        field(t('interests'), 'plan-interests', 'required maxlength="1000"') +
        '<div class="chips" id="plan-chips">' + chips + '</div>' +
        '<p class="form-error" id="plan-error" role="alert"></p>' +
        '<button class="button wide" type="submit">' + icon('spark') + esc(t('makePlan')) + '</button></form>' +
        '<div><h2 style="font-size:1.9rem">' + esc(t('myPlans')) + '</h2><div class="plan-list" id="plan-list" aria-live="polite"><div class="skeleton line"></div></div></div></div>';

    byId('plan-form').addEventListener('submit', submitPlan);
    byId('plan-chips').addEventListener('click', togglePlanInterest);
    loadPlans(number);
}

// Кнопка-интерес добавляет слово в поле или убирает его оттуда
function togglePlanInterest(event) {
    var chip = event.target.closest('[data-interest]');
    if (!chip) {
        return;
    }
    var word = chip.getAttribute('data-interest');
    var words = splitTags(byId('plan-interests').value);
    var position = words.indexOf(word);
    if (position === -1) {
        words.push(word);
    } else {
        words.splice(position, 1);
    }
    byId('plan-interests').value = words.join(', ');
    chip.setAttribute('aria-pressed', position === -1);
}

async function loadPlans(number) {
    try {
        var plans = await api('/ai/trip-plans/');
        if (number !== renderNumber) {
            return;
        }
        if (plans.length === 0) {
            byId('plan-list').innerHTML = emptyState('route', t('emptyPlans'));
            return;
        }

        // новые маршруты показываем первыми, самый новый сразу открыт
        var html = '';
        for (var i = plans.length - 1; i >= 0; i--) {
            var plan = plans[i];
            var open = i === plans.length - 1 ? ' open' : '';
            html = html + '<details class="plan-card"' + open + '><summary><strong>' + esc(plan.city) + '</strong><span>' + plan.days + ' ' + esc(t('dayShort')) + ' · ' + esc(formatPrice(plan.budget)) + ' · ' + esc(plan.interests) + '</span>' + icon('chevron') + '</summary>' +
                '<div class="plan-content">' + planHtml(plan.plan) + '</div></details>';
        }
        byId('plan-list').innerHTML = html;
    } catch (error) {
        if (number === renderNumber) {
            byId('plan-list').innerHTML = emptyState('compass', error.message);
        }
    }
}

async function submitPlan(event) {
    event.preventDefault();
    var form = event.target;
    var button = form.querySelector('button[type="submit"]');
    var number = renderNumber;
    var errorBox = byId('plan-error');
    setBusy(button, true);
    clearErrors(form);
    errorBox.textContent = '';
    byId('plan-list').insertAdjacentHTML('afterbegin', '<p class="notice" id="plan-wait">' + esc(t('aiWait')) + '</p>');

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
        form.reset();
        var chips = byId('plan-chips').querySelectorAll('[aria-pressed]');
        for (var i = 0; i < chips.length; i++) {
            chips[i].setAttribute('aria-pressed', 'false');
        }
        await loadPlans(number);
    } catch (error) {
        if (number !== renderNumber) {
            return;
        }
        if (byId('plan-wait')) {
            byId('plan-wait').remove();
        }
        showErrors(error, 'plan-error', { city: 'plan-city', days: 'plan-days', budget: 'plan-budget', interests: 'plan-interests' });
    }
    setBusy(button, false);
}
