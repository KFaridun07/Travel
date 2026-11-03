// Переписка туриста и гида: соединение WebSocket работает на всех страницах сайта

var chatSocket = null;
var chatSocketUser = null;
var chatSocketReady = false;
var chatRetryTimer = null;
var chatRetryDelay = 1000;
// всего непрочитанных сообщений: число на значке в меню
var chatUnread = 0;

var chatPageActive = false;
var chatList = [];
var chatOpenId = null;
var chatItems = [];
var chatHasMore = false;
// прижата ли переписка к низу: тогда новые сообщения прокручивают её сами
var chatStickToBottom = true;
var chatBlobs = {};
var chatTypingTimer = null;
var chatLastTypingSent = 0;
var chatAudio = null;
var chatAudioId = null;
var chatRecording = null;

var CHAT_MAX_FILE = 10 * 1024 * 1024;
var CHAT_MAX_VOICE_SECONDS = 600;

function chatAllowed() {
    return isRole('tourist') || isRole('guide');
}

// ---------- Соединение ----------

function syncChatSocket() {
    if (!chatAllowed()) {
        closeChatSocket();
        chatUnread = 0;
        return;
    }
    if (chatSocket && chatSocketUser === state.user.id) {
        return;
    }
    closeChatSocket();
    openChatSocket();
}

function closeChatSocket() {
    clearTimeout(chatRetryTimer);
    if (chatSocket) {
        var socket = chatSocket;
        chatSocket = null;
        socket.close();
    }
    chatSocketUser = null;
    chatSocketReady = false;
}

function openChatSocket() {
    var protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
    var socket = new WebSocket(protocol + location.host + '/ws/chat/');
    chatSocket = socket;
    chatSocketUser = state.user.id;
    chatSocketReady = false;

    socket.onopen = function () {
        // токен отправляем первым сообщением: в адресе он попал бы в журналы сервера
        socket.send(JSON.stringify({ type: 'auth', token: readStorage('access') }));
    };
    socket.onmessage = function (event) {
        handleChatEvent(JSON.parse(event.data));
    };
    socket.onclose = function (event) {
        onChatSocketClosed(socket, event.code);
    };
}

async function onChatSocketClosed(socket, code) {
    // это старое соединение, которое мы закрыли сами
    if (chatSocket !== socket) {
        return;
    }
    chatSocket = null;
    chatSocketReady = false;

    if (code === 4003) {
        return;
    }
    // 4001: токен истёк, получаем новый и сразу подключаемся снова
    if (code === 4001) {
        var refreshed = false;
        try {
            refreshed = await refreshTokens();
        } catch (error) {
            refreshed = false;
        }
        if (refreshed) {
            syncChatSocket();
        }
        return;
    }

    // сервер недоступен: каждый раз ждём дольше
    chatRetryTimer = setTimeout(syncChatSocket, chatRetryDelay);
    chatRetryDelay = Math.min(chatRetryDelay * 2, 30000);
}

function handleChatEvent(data) {
    if (data.type === 'ready') {
        var reconnected = chatRetryDelay > 1000;
        chatSocketReady = true;
        chatRetryDelay = 1000;
        chatUnread = data.unread;
        updateChatBadges();
        // пока соединения не было, могли прийти сообщения
        if (reconnected && chatPageActive) {
            reloadChatAfterReconnect();
        }
    } else if (data.type === 'message') {
        onChatMessage(data.message);
    } else if (data.type === 'read') {
        onChatRead(data);
    } else if (data.type === 'deleted') {
        onChatDeleted(data);
    } else if (data.type === 'typing') {
        onChatTyping(data);
    } else if (data.type === 'presence') {
        onChatPresence(data);
    } else if (data.type === 'error') {
        showToast(data.detail);
    }
}

function updateChatBadges() {
    var badges = document.querySelectorAll('[data-chat-badge]');
    for (var i = 0; i < badges.length; i++) {
        badges[i].textContent = chatUnread > 99 ? '99+' : chatUnread;
        badges[i].hidden = chatUnread === 0;
    }
}

function findChat(id) {
    for (var i = 0; i < chatList.length; i++) {
        if (chatList[i].id === Number(id)) {
            return chatList[i];
        }
    }
    return null;
}

function chatIsVisible() {
    return chatPageActive && document.visibilityState === 'visible';
}

function onChatMessage(message) {
    var mine = message.sender === state.user.id;
    var isOpen = chatPageActive && message.conversation === chatOpenId;
    var seen = isOpen && chatIsVisible();

    if (!mine && !seen) {
        chatUnread = chatUnread + 1;
        updateChatBadges();
        if (!chatPageActive) {
            showToast(message.sender_name + ': ' + chatPreview(message));
        }
    }

    if (chatPageActive) {
        var chat = findChat(message.conversation);
        if (chat) {
            chat.last_message = message;
            if (!mine && !seen) {
                chat.unread = chat.unread + 1;
            }
            // диалог с новым сообщением поднимается наверх
            chatList.splice(chatList.indexOf(chat), 1);
            chatList.unshift(chat);
            renderChatList();
        } else {
            loadChatList();
        }
    }

    if (isOpen) {
        if (!mine) {
            showChatStatus();
        }
        appendChatMessage(message);
        if (!mine && seen) {
            markChatRead(chatOpenId);
        }
    }
}

function onChatRead(data) {
    if (data.reader === state.user.id) {
        var chat = findChat(data.conversation);
        if (chat) {
            chatUnread = Math.max(0, chatUnread - chat.unread);
            chat.unread = 0;
            updateChatBadges();
            renderChatList();
        } else {
            refreshChatUnread();
        }
        return;
    }
    if (chatPageActive && data.conversation === chatOpenId) {
        // собеседник прочитал: у наших сообщений появляются две галочки
        for (var i = 0; i < chatItems.length; i++) {
            chatItems[i].is_read = true;
        }
        var ticks = document.querySelectorAll('.msg-ticks');
        for (var k = 0; k < ticks.length; k++) {
            ticks[k].innerHTML = icon('checks');
            ticks[k].classList.add('read');
        }
    }
}

async function refreshChatUnread() {
    try {
        var chats = await api('/chat/conversations/');
        chatUnread = 0;
        for (var i = 0; i < chats.length; i++) {
            chatUnread = chatUnread + chats[i].unread;
        }
        updateChatBadges();
    } catch (error) {
        // значок обновится при следующем сообщении
    }
}

function onChatDeleted(data) {
    if (!chatPageActive) {
        refreshChatUnread();
        return;
    }
    loadChatList();
    if (data.conversation !== chatOpenId) {
        return;
    }
    chatItems = chatItems.filter(function (item) {
        return item.id !== data.message;
    });
    if (chatItems.length === 0) {
        renderChatMessages();
        return;
    }

    // убираем только это сообщение: остальные не должны мигать, а голосовое продолжает играть
    var node = document.querySelector('.msg[data-message="' + data.message + '"]');
    if (node) {
        var before = node.previousElementSibling;
        var after = node.nextElementSibling;
        node.remove();
        // дата без единого сообщения под ней не нужна
        if (before && before.classList.contains('chat-day') && (!after || after.classList.contains('chat-day'))) {
            before.remove();
        }
    }
}

function onChatTyping(data) {
    if (!chatPageActive || data.conversation !== chatOpenId) {
        return;
    }
    var status = byId('chat-status');
    if (!status) {
        return;
    }
    status.textContent = t('chatTyping');
    status.classList.add('typing');
    clearTimeout(chatTypingTimer);
    chatTypingTimer = setTimeout(showChatStatus, 4000);
}

function onChatPresence(data) {
    if (!chatPageActive) {
        return;
    }
    for (var i = 0; i < chatList.length; i++) {
        if (chatList[i].other.id === data.user) {
            chatList[i].other.online = data.online;
        }
    }
    renderChatList();
    showChatStatus();
}

function showChatStatus() {
    var status = byId('chat-status');
    var chat = findChat(chatOpenId);
    if (!status || !chat) {
        return;
    }
    clearTimeout(chatTypingTimer);
    status.classList.remove('typing');
    status.classList.toggle('online', chat.other.online);
    status.textContent = t(chat.other.online ? 'chatOnline' : 'chatOffline');
}

// ---------- Страница ----------

// Вызывается при уходе со страницы: останавливаем запись и звук, освобождаем память
function leaveChat() {
    if (!chatPageActive) {
        return;
    }
    chatPageActive = false;
    chatOpenId = null;
    chatItems = [];
    document.body.classList.remove('chat-open');
    clearTimeout(chatTypingTimer);
    cancelChatRecording();
    stopChatAudio();
    for (var id in chatBlobs) {
        URL.revokeObjectURL(chatBlobs[id]);
    }
    chatBlobs = {};
}

async function chatPage(id, number) {
    setCoverPage(false);
    setTitle(t('chatNav'));
    if (!state.user) {
        needLoginPage();
        return;
    }
    if (!chatAllowed()) {
        mainElement.innerHTML = pageWrap(emptyState('chat', t('chatOnlyPeople')));
        return;
    }

    chatPageActive = true;
    chatOpenId = id ? Number(id) : null;
    document.body.classList.add('chat-open');

    mainElement.innerHTML = '<div class="messenger' + (id ? ' room-open' : '') + '">' +
        '<aside class="chat-side"><div class="chat-side-head"><h1>' + esc(t('chatNav')) + '</h1>' +
        '<label class="chat-search">' + icon('search') + '<input id="chat-search" type="search" placeholder="' + esc(t('chatSearch')) + '" aria-label="' + esc(t('chatSearch')) + '"></label></div>' +
        '<div class="chat-list" id="chat-list"><p class="loading">' + esc(t('loading')) + '</p></div></aside>' +
        '<section class="chat-room" id="chat-room">' + chatPickHtml() + '</section></div>';
    byId('chat-search').addEventListener('input', renderChatList);

    await loadChatList(number);
    if (number !== renderNumber || !id) {
        return;
    }
    if (findChat(id)) {
        await openChatRoom(number);
    } else {
        byId('chat-room').innerHTML = emptyState('compass', t('notFound'), '', '<a class="button" href="#/chat">' + esc(t('chatNav')) + '</a>');
    }
}

function chatPickHtml() {
    return '<div class="chat-pick">' + icon('chat') + '<p>' + esc(t('chatPick')) + '</p></div>';
}

async function loadChatList(number) {
    try {
        var chats = await api('/chat/conversations/');
        if (number !== undefined && number !== renderNumber) {
            return;
        }
        chatList = chats;
        renderChatList();
    } catch (error) {
        if (byId('chat-list')) {
            byId('chat-list').innerHTML = '<p class="loading">' + esc(error.message) + '</p>';
        }
    }
}

async function reloadChatAfterReconnect() {
    var number = renderNumber;
    await loadChatList(number);
    if (chatOpenId && findChat(chatOpenId) && number === renderNumber) {
        await loadChatMessages(number);
    }
}

function chatPreview(message) {
    if (message.kind === 'image') {
        return message.text || t('chatPhoto');
    }
    if (message.kind === 'voice') {
        return t('chatVoice');
    }
    return message.text;
}

function chatTime(value) {
    return readDate(value).toLocaleTimeString(currentLocale(), { hour: '2-digit', minute: '2-digit' });
}

function renderChatList() {
    var box = byId('chat-list');
    if (!box) {
        return;
    }
    if (chatList.length === 0) {
        box.innerHTML = '<div class="chat-list-empty">' + icon('chat') + '<p>' + esc(t('chatEmptyText')) + '</p>' +
            '<a class="button small" href="#/bookings">' + esc(t('bookings')) + '</a></div>';
        return;
    }

    var query = byId('chat-search').value.trim().toLowerCase();
    var html = '';
    for (var i = 0; i < chatList.length; i++) {
        var chat = chatList[i];
        if (query && chat.other.name.toLowerCase().indexOf(query) === -1) {
            continue;
        }
        var last = chat.last_message;
        var who = last && last.sender === state.user.id ? esc(t('chatYou')) + ': ' : '';
        html = html + '<a class="chat-item' + (chat.id === chatOpenId ? ' active' : '') + '" href="#/chat/' + chat.id + '">' +
            chatAvatar(chat) +
            '<span class="chat-item-body"><span class="chat-item-top"><strong>' + esc(chat.other.name) + '</strong>' +
            '<time>' + (last ? esc(chatTime(last.created_at)) : '') + '</time></span>' +
            '<span class="chat-item-bottom"><span class="chat-item-text">' + (last ? who + esc(chatPreview(last)) : esc(t('chatNoMessages'))) + '</span>' +
            (chat.unread ? '<span class="nav-badge">' + chat.unread + '</span>' : '') + '</span></span></a>';
    }
    box.innerHTML = html || '<p class="loading">' + esc(t('chatNotFound')) + '</p>';
}

function chatAvatar(chat) {
    return '<span class="chat-avatar' + (chat.other.online ? ' online' : '') + '"><span class="avatar">' + esc(chat.other.name.charAt(0)) + '</span></span>';
}

// ---------- Открытый диалог ----------

async function openChatRoom(number) {
    var chat = findChat(chatOpenId);
    setTitle(chat.other.name);
    var canRecord = navigator.mediaDevices && window.MediaRecorder;

    byId('chat-room').innerHTML = '<header class="chat-room-head"><a class="round-button back chat-back" href="#/chat" aria-label="' + esc(t('navBack')) + '">' + icon('arrow') + '</a>' +
        chatAvatar(chat) + '<div><strong>' + esc(chat.other.name) + '</strong><small id="chat-status"></small></div></header>' +
        '<div class="chat-messages" id="chat-messages"><p class="loading">' + esc(t('loading')) + '</p></div>' +
        '<form class="chat-composer" id="chat-composer">' +
        '<label class="round-button chat-attach" title="' + esc(t('chatAttach')) + '">' + icon('clip') +
        '<input id="chat-photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="' + esc(t('chatAttach')) + '"></label>' +
        '<textarea id="chat-text" rows="1" maxlength="4000" placeholder="' + esc(t('chatPlaceholder')) + '" aria-label="' + esc(t('chatPlaceholder')) + '"></textarea>' +
        (canRecord ? '<button class="round-button chat-mic" type="button" id="chat-mic" aria-label="' + esc(t('chatRecord')) + '" title="' + esc(t('chatRecord')) + '">' + icon('mic') + '</button>' : '') +
        '<button class="round-button chat-send" type="submit" id="chat-send" aria-label="' + esc(t('chatSend')) + '" title="' + esc(t('chatSend')) + '"' + (canRecord ? ' hidden' : '') + '>' + icon('arrow') + '</button>' +
        '</form>' +
        '<div class="chat-recording" id="chat-recording" hidden><span class="rec-dot"></span><span id="chat-rec-time">0:00</span><span class="rec-hint">' + esc(t('chatVoice')) + '</span>' +
        '<button class="round-button" type="button" id="chat-rec-cancel" aria-label="' + esc(t('cancel')) + '" title="' + esc(t('cancel')) + '">' + icon('trash') + '</button>' +
        '<button class="round-button chat-send" type="button" id="chat-rec-send" aria-label="' + esc(t('chatSend')) + '" title="' + esc(t('chatSend')) + '">' + icon('arrow') + '</button></div>';

    showChatStatus();
    connectChatRoom();
    await loadChatMessages(number);
    if (number === renderNumber && byId('chat-text')) {
        byId('chat-text').focus({ preventScroll: true });
    }
}

function connectChatRoom() {
    var log = byId('chat-messages');
    log.addEventListener('click', onChatLogClick);
    log.addEventListener('input', onChatSeek);
    log.addEventListener('scroll', function () {
        chatStickToBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    });

    var text = byId('chat-text');
    text.addEventListener('input', onChatInput);
    text.addEventListener('keydown', function (event) {
        // Enter отправляет, Shift+Enter переносит строку
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
            event.preventDefault();
            sendChatText();
        }
    });
    byId('chat-composer').addEventListener('submit', function (event) {
        event.preventDefault();
        sendChatText();
    });
    byId('chat-photo').addEventListener('change', onChatPhotoChosen);
    if (byId('chat-mic')) {
        byId('chat-mic').addEventListener('click', startChatRecording);
    }
    byId('chat-rec-cancel').addEventListener('click', cancelChatRecording);
    byId('chat-rec-send').addEventListener('click', finishChatRecording);
}

async function loadChatMessages(number) {
    var id = chatOpenId;
    try {
        var page = await api('/chat/conversations/' + id + '/messages/');
        if (number !== renderNumber || id !== chatOpenId) {
            return;
        }
        chatItems = page.results;
        chatHasMore = page.has_more;
        chatStickToBottom = true;
        renderChatMessages();
        if (chatIsVisible()) {
            markChatRead(id);
        }
    } catch (error) {
        if (byId('chat-messages')) {
            byId('chat-messages').innerHTML = '<p class="loading">' + esc(error.message) + '</p>';
        }
    }
}

async function loadOlderChatMessages() {
    var log = byId('chat-messages');
    var id = chatOpenId;
    var oldHeight = log.scrollHeight;
    try {
        var page = await api('/chat/conversations/' + id + '/messages/?before=' + chatItems[0].id);
        if (id !== chatOpenId) {
            return;
        }
        chatItems = page.results.concat(chatItems);
        chatHasMore = page.has_more;
        chatStickToBottom = false;
        renderChatMessages();
        // ранние сообщения появляются сверху, а то, что человек читал, остаётся на месте
        log.scrollTop = log.scrollHeight - oldHeight;
    } catch (error) {
        showToast(error.message);
    }
}

async function markChatRead(id) {
    try {
        await api('/chat/conversations/' + id + '/read/', { method: 'POST', json: {} });
    } catch (error) {
        // отметка обновится, когда диалог откроют снова
    }
}

// Страницу снова открыли: сообщения в открытом диалоге теперь прочитаны
document.addEventListener('visibilitychange', function () {
    if (chatIsVisible() && chatOpenId && findChat(chatOpenId) && findChat(chatOpenId).unread) {
        markChatRead(chatOpenId);
    }
});

// ---------- Сообщения ----------

function chatDayKey(value) {
    var date = readDate(value);
    return date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();
}

function chatDayTitle(value) {
    var now = new Date();
    if (chatDayKey(value) === chatDayKey(now.toISOString())) {
        return t('chatToday');
    }
    now.setDate(now.getDate() - 1);
    if (chatDayKey(value) === chatDayKey(now.toISOString())) {
        return t('chatYesterday');
    }
    return formatDate(value);
}

function formatChatDuration(seconds) {
    var total = Math.max(0, Math.round(seconds));
    return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
}

function chatVoiceHtml(message) {
    return '<div class="voice" data-voice="' + message.id + '" data-duration="' + message.duration + '">' +
        '<button class="voice-play" type="button" data-voice-play aria-label="' + esc(t('chatPlay')) + '">' + icon('play') + '</button>' +
        '<input class="voice-seek" type="range" min="0" max="1000" value="0" aria-label="' + esc(t('chatSeek')) + '">' +
        '<span class="voice-time">' + formatChatDuration(message.duration) + '</span></div>';
}

function chatMessageHtml(message) {
    var mine = message.sender === state.user.id;
    var body = '';
    if (message.kind === 'image') {
        body = '<button class="msg-photo" type="button" data-photo="' + message.id + '" aria-label="' + esc(t('chatPhoto')) + '"><img data-blob="' + message.id + '" alt=""></button>';
    } else if (message.kind === 'voice') {
        body = chatVoiceHtml(message);
    }
    if (message.text) {
        body = body + '<p class="msg-text">' + esc(message.text) + '</p>';
    }

    var ticks = '';
    if (mine) {
        ticks = '<span class="msg-ticks' + (message.is_read ? ' read' : '') + '">' + icon(message.is_read ? 'checks' : 'check') + '</span>';
    }
    var remove = mine ? '<button class="msg-delete" type="button" data-delete="' + message.id + '" aria-label="' + esc(t('chatDelete')) + '" title="' + esc(t('chatDelete')) + '">' + icon('trash') + '</button>' : '';

    return '<div class="msg ' + (mine ? 'mine' : 'theirs') + ' kind-' + message.kind + '" data-message="' + message.id + '">' + remove +
        '<div class="msg-bubble">' + body + '<span class="msg-meta"><time>' + esc(chatTime(message.created_at)) + '</time>' + ticks + '</span></div></div>';
}

function renderChatMessages() {
    var log = byId('chat-messages');
    if (!log) {
        return;
    }
    // разметка заменяется целиком, поэтому плеер голосового начнёт заново
    stopChatAudio();
    if (chatItems.length === 0) {
        log.innerHTML = '<div class="chat-pick">' + icon('chat') + '<p>' + esc(t('chatStart')) + '</p></div>';
        return;
    }

    var html = chatHasMore ? '<button class="chat-older" type="button" data-older>' + esc(t('chatOlder')) + '</button>' : '';
    var lastDay = '';
    for (var i = 0; i < chatItems.length; i++) {
        var day = chatDayKey(chatItems[i].created_at);
        if (day !== lastDay) {
            html = html + '<div class="chat-day"><span>' + esc(chatDayTitle(chatItems[i].created_at)) + '</span></div>';
            lastDay = day;
        }
        html = html + chatMessageHtml(chatItems[i]);
    }
    log.innerHTML = html;
    loadChatImages();
    if (chatStickToBottom) {
        log.scrollTop = log.scrollHeight;
    }
}

function appendChatMessage(message) {
    // одно и то же сообщение могло прийти и после обновления истории
    for (var i = 0; i < chatItems.length; i++) {
        if (chatItems[i].id === message.id) {
            return;
        }
    }
    if (message.sender === state.user.id) {
        chatStickToBottom = true;
    }
    var previous = chatItems[chatItems.length - 1];
    chatItems.push(message);
    if (!previous) {
        renderChatMessages();
        return;
    }

    // добавляем только новое сообщение: остальные не мигают, а голосовое продолжает играть
    var log = byId('chat-messages');
    var html = '';
    if (chatDayKey(previous.created_at) !== chatDayKey(message.created_at)) {
        html = '<div class="chat-day"><span>' + esc(chatDayTitle(message.created_at)) + '</span></div>';
    }
    log.insertAdjacentHTML('beforeend', html + chatMessageHtml(message));
    log.lastElementChild.classList.add('new');
    loadChatImages();
    if (chatStickToBottom) {
        log.scrollTop = log.scrollHeight;
    }
}

// Файлы чата закрыты: браузер получает их только запросом с токеном
async function chatBlobUrl(id) {
    if (!chatBlobs[id]) {
        var blob = await apiBlob('/chat/messages/' + id + '/file/');
        chatBlobs[id] = URL.createObjectURL(blob);
    }
    return chatBlobs[id];
}

function loadChatImages() {
    var images = document.querySelectorAll('img[data-blob]:not([src])');
    for (var i = 0; i < images.length; i++) {
        showChatImage(images[i]);
    }
}

async function showChatImage(image) {
    try {
        image.addEventListener('load', function () {
            if (chatStickToBottom && byId('chat-messages')) {
                byId('chat-messages').scrollTop = byId('chat-messages').scrollHeight;
            }
        }, { once: true });
        image.src = await chatBlobUrl(image.getAttribute('data-blob'));
    } catch (error) {
        image.alt = t('chatFileError');
    }
}

function onChatLogClick(event) {
    var older = event.target.closest('[data-older]');
    if (older) {
        loadOlderChatMessages();
        return;
    }
    var photo = event.target.closest('[data-photo]');
    if (photo) {
        openChatPhoto(photo.getAttribute('data-photo'));
        return;
    }
    var play = event.target.closest('[data-voice-play]');
    if (play) {
        toggleChatVoice(play.closest('.voice'));
        return;
    }
    var remove = event.target.closest('[data-delete]');
    if (remove) {
        deleteChatMessage(remove.getAttribute('data-delete'));
    }
}

async function openChatPhoto(id) {
    var dialog = byId('dialog');
    var url = await chatBlobUrl(id);
    dialog.className = 'dialog large chat-viewer';
    dialog.innerHTML = '<form method="dialog"><button class="round-button" aria-label="' + esc(t('close')) + '">' + icon('close') + '</button></form><img alt="">';
    dialog.querySelector('img').src = url;
    dialog.showModal();
}

async function deleteChatMessage(id) {
    var agreed = await confirmDialog(t('chatDeleteAsk'), t('chatDelete'));
    if (!agreed) {
        return;
    }
    try {
        await api('/chat/messages/' + id + '/', { method: 'DELETE' });
    } catch (error) {
        showToast(error.message);
    }
}

// ---------- Отправка ----------

function onChatInput() {
    var text = byId('chat-text');
    // поле растёт вместе с текстом
    text.style.height = 'auto';
    text.style.height = text.scrollHeight + 'px';

    var hasText = text.value.trim() !== '';
    if (byId('chat-mic')) {
        byId('chat-mic').hidden = hasText;
        byId('chat-send').hidden = !hasText;
    }

    var now = Date.now();
    if (hasText && chatSocketReady && now - chatLastTypingSent > 3000) {
        chatLastTypingSent = now;
        chatSocket.send(JSON.stringify({ type: 'typing', conversation: chatOpenId }));
    }
}

async function sendChatText() {
    var field = byId('chat-text');
    var text = field.value.trim();
    if (!text) {
        return;
    }
    field.value = '';
    onChatInput();

    if (chatSocketReady) {
        chatSocket.send(JSON.stringify({ type: 'message', conversation: chatOpenId, text: text }));
        return;
    }
    // соединения нет: отправляем обычным запросом, а ответ показываем сами
    try {
        var message = await api('/chat/conversations/' + chatOpenId + '/messages/', { method: 'POST', json: { kind: 'text', text: text } });
        appendChatMessage(message);
    } catch (error) {
        field.value = text;
        onChatInput();
        showToast(error.message);
    }
}

async function sendChatForm(form) {
    var id = chatOpenId;
    showToast(t('chatSending'));
    try {
        var message = await api('/chat/conversations/' + id + '/messages/', { method: 'POST', form: form });
        if (!chatSocketReady && id === chatOpenId) {
            appendChatMessage(message);
        }
    } catch (error) {
        showToast(error.message);
    }
}

function onChatPhotoChosen(event) {
    var file = event.target.files[0];
    // одно и то же фото можно выбрать снова
    event.target.value = '';
    if (!file) {
        return;
    }
    if (file.size > CHAT_MAX_FILE) {
        showToast(t('chatFileTooBig'));
        return;
    }

    var url = URL.createObjectURL(file);
    var dialog = byId('dialog');
    dialog.className = 'dialog large chat-photo-send';
    dialog.innerHTML = '<img alt=""><form method="dialog"><div class="field"><label for="chat-caption">' + esc(t('chatCaption')) + '</label>' +
        '<input id="chat-caption" maxlength="4000"></div><div class="dialog-actions"><button class="button secondary" value="no">' + esc(t('cancel')) + '</button>' +
        '<button class="button" value="yes">' + esc(t('chatSend')) + '</button></div></form>';
    dialog.querySelector('img').src = url;
    dialog.returnValue = '';
    dialog.showModal();

    dialog.addEventListener('close', function () {
        var caption = byId('chat-caption') ? byId('chat-caption').value : '';
        var send = dialog.returnValue === 'yes';
        URL.revokeObjectURL(url);
        if (send) {
            var form = new FormData();
            form.append('kind', 'image');
            form.append('image', file);
            form.append('text', caption);
            sendChatForm(form);
        }
    }, { once: true });
}

// ---------- Голосовые ----------

function chatRecordingType() {
    var types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    for (var i = 0; i < types.length; i++) {
        if (MediaRecorder.isTypeSupported(types[i])) {
            return types[i];
        }
    }
    return '';
}

async function startChatRecording() {
    var stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
        showToast(t(error.name === 'NotFoundError' ? 'chatNoMic' : 'chatMicDenied'));
        return;
    }
    // пока браузер спрашивал разрешение, человек мог уйти со страницы
    if (!byId('chat-recording')) {
        stream.getTracks().forEach(function (track) {
            track.stop();
        });
        return;
    }

    var type = chatRecordingType();
    var options = { audioBitsPerSecond: 64000 };
    if (type) {
        options.mimeType = type;
    }
    var recorder = new MediaRecorder(stream, options);
    var recording = { recorder: recorder, stream: stream, chunks: [], startedAt: Date.now(), send: false, timer: null };
    chatRecording = recording;

    recorder.ondataavailable = function (event) {
        if (event.data.size > 0) {
            recording.chunks.push(event.data);
        }
    };
    recorder.onstop = function () {
        onChatRecordingStopped(recording);
    };
    recorder.start();

    byId('chat-composer').hidden = true;
    byId('chat-recording').hidden = false;
    byId('chat-rec-time').textContent = '0:00';
    recording.timer = setInterval(function () {
        var seconds = (Date.now() - recording.startedAt) / 1000;
        if (byId('chat-rec-time')) {
            byId('chat-rec-time').textContent = formatChatDuration(Math.floor(seconds));
        }
        if (seconds >= CHAT_MAX_VOICE_SECONDS) {
            finishChatRecording();
        }
    }, 250);
}

function stopChatRecording(send) {
    var recording = chatRecording;
    if (!recording) {
        return;
    }
    chatRecording = null;
    recording.send = send;
    recording.seconds = (Date.now() - recording.startedAt) / 1000;
    clearInterval(recording.timer);
    recording.recorder.stop();
    recording.stream.getTracks().forEach(function (track) {
        track.stop();
    });
    if (byId('chat-recording')) {
        byId('chat-recording').hidden = true;
        byId('chat-composer').hidden = false;
    }
}

function cancelChatRecording() {
    stopChatRecording(false);
}

function finishChatRecording() {
    stopChatRecording(true);
}

function onChatRecordingStopped(recording) {
    if (!recording.send) {
        return;
    }
    if (recording.seconds < 1) {
        showToast(t('chatVoiceShort'));
        return;
    }
    var blob = new Blob(recording.chunks, { type: recording.recorder.mimeType });
    if (blob.size > CHAT_MAX_FILE) {
        showToast(t('chatFileTooBig'));
        return;
    }
    var form = new FormData();
    form.append('kind', 'voice');
    form.append('voice', blob, 'voice');
    form.append('duration', Math.round(recording.seconds));
    sendChatForm(form);
}

function setChatVoiceIcon(box, playing) {
    var button = box.querySelector('[data-voice-play]');
    button.innerHTML = icon(playing ? 'pause' : 'play');
    button.setAttribute('aria-label', t(playing ? 'chatPause' : 'chatPlay'));
}

function chatVoiceBox(id) {
    return document.querySelector('.voice[data-voice="' + id + '"]');
}

function stopChatAudio() {
    if (!chatAudio) {
        return;
    }
    chatAudio.pause();
    var box = chatVoiceBox(chatAudioId);
    if (box) {
        setChatVoiceIcon(box, false);
    }
    chatAudio = null;
    chatAudioId = null;
}

async function toggleChatVoice(box) {
    var id = box.getAttribute('data-voice');
    if (chatAudio && chatAudioId === id) {
        if (chatAudio.paused) {
            chatAudio.play();
        } else {
            chatAudio.pause();
        }
        setChatVoiceIcon(box, !chatAudio.paused);
        return;
    }

    stopChatAudio();
    var url;
    try {
        url = await chatBlobUrl(id);
    } catch (error) {
        showToast(t('chatFileError'));
        return;
    }

    var audio = new Audio(url);
    chatAudio = audio;
    chatAudioId = id;
    var duration = Number(box.getAttribute('data-duration'));

    audio.addEventListener('timeupdate', function () {
        var current = chatVoiceBox(id);
        if (current && chatAudio === audio) {
            current.querySelector('.voice-seek').value = Math.min(1000, audio.currentTime / duration * 1000);
            current.querySelector('.voice-time').textContent = formatChatDuration(duration - audio.currentTime);
        }
    });
    audio.addEventListener('ended', function () {
        var current = chatVoiceBox(id);
        if (current) {
            current.querySelector('.voice-seek').value = 0;
            current.querySelector('.voice-time').textContent = formatChatDuration(duration);
            setChatVoiceIcon(current, false);
        }
        chatAudio = null;
        chatAudioId = null;
    });

    try {
        await audio.play();
        setChatVoiceIcon(box, true);
    } catch (error) {
        showToast(t('chatFileError'));
    }
}

function onChatSeek(event) {
    if (!event.target.classList.contains('voice-seek')) {
        return;
    }
    var box = event.target.closest('.voice');
    if (chatAudio && chatAudioId === box.getAttribute('data-voice')) {
        chatAudio.currentTime = event.target.value / 1000 * Number(box.getAttribute('data-duration'));
    }
}

// ---------- Начать переписку со страницы брони ----------

async function startChatFromBooking(event) {
    var button = event.currentTarget;
    setBusy(button, true);
    try {
        var chat = await api('/chat/conversations/', { method: 'POST', json: { booking: Number(button.getAttribute('data-chat-booking')) } });
        location.hash = '#/chat/' + chat.id;
    } catch (error) {
        showToast(error.message);
        setBusy(button, false);
    }
}
