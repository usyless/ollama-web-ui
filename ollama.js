let api_address = {
        value: null,
        default_value: 'http://localhost:11434',
        id: 'api_address'
    },
    context_length = {
        value: null,
        default_value: null,
        id: 'context_length',
    },
    system_prompt = {
        value: null,
        default_value: null,
        id: 'system_prompt',
    },
    temperature = {
        value: null,
        default_value: null,
        id: 'temperature',
    };

for (let setting of [api_address, context_length, system_prompt, temperature]) {
    const elem = document.getElementById(setting.id);
    setting.value = window.localStorage.getItem(setting.id) || setting.default_value;
    if (setting.value !== setting.default_value) elem.value = setting.value;

    elem.addEventListener('input', (e) => {
        const newValue = e.target.value;
        if (newValue !== setting.default_value && newValue.length > 0) {
            window.localStorage.setItem(setting.id, newValue);
            setting.value = newValue;
        } else {
            window.localStorage.removeItem(setting.id);
            setting.value = setting.default_value;
        }
    });
}

const modelSelect = document.getElementById('modelSelect');
const input = document.getElementById('input');
const sendButton = document.getElementById('sendChatButton');
const newChatButton = document.getElementById('newChatButton');
const chatHistory = document.getElementById('chatHistory').firstElementChild;
const chatWith = document.getElementById('chatWith').querySelector('b');

const chat = document.getElementById('chat');
let currentContext = [];
let currentModel = null;

let responding = false;

let db;

if (!window.localStorage.getItem('firstEntry')) {
    alert(`Welcome!
Make sure to add OLLAMA_ORIGINS=${window.location.origin} to your environment variables and relaunch ollama for this website to work!`);
    window.localStorage.setItem('firstEntry', 'h');
}

document.addEventListener('DOMContentLoaded', () => {
    const dbOpen = window.indexedDB.open("chat_history", 2);
    dbOpen.addEventListener("error", () => console.error("Database failed to open"));
    dbOpen.addEventListener("success", () => {
        db = dbOpen.result;
        displayChatHistory();
    });
    dbOpen.addEventListener("upgradeneeded", (e) => {
        db = e.target.result;

        if (e.oldVersion <= 0) {
            const chatHistoryStore = db.createObjectStore("chat_history", {
                keyPath: "id",
                autoIncrement: true,
            });

            chatHistoryStore.createIndex('name', 'name', { unique: false });
            chatHistoryStore.createIndex('context', 'context', { unique: false });
            chatHistoryStore.createIndex('messages', 'messages', { unique: false });
        }
        if (e.oldVersion <= 1) {
            const transaction = e.target.transaction;
            const objectStore = transaction.objectStore('chat_history');
            objectStore.createIndex('model', 'model', { unique: false });
            transaction.addEventListener('complete', ()=> {
                console.log("Successfully added 'model' to database");
                if (window.localStorage.getItem('firstEntry')) alert("Due to the database upgrade, I recommend you delete all old chats, as from now on chats have the model they are begun with stored to avoid issues with switching models with the same context");
            });
        }
    });

    input.addEventListener('input', (e) => {
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
    });
    let holding_shift = false;
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Shift') holding_shift = true;
        else if (e.key === 'Enter' && !holding_shift) {
            e.preventDefault();
            sendButton.click();
        }
    });
    input.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') holding_shift = false
    });
    input.addEventListener('focusout', () => holding_shift = false);
    document.addEventListener('visibilitychange', () => holding_shift = false);
    sendButton.addEventListener('click', () => {
        if (!responding && input.value.length > 0) {
            createChatBubble(true);
            saveChat();
            postMessage();
        }
    });
    newChatButton.addEventListener('click', () => {
        if (responding) sendButton.click();
        chatHistory.querySelectorAll('.selected').forEach((element) => element.classList.remove('selected'));
        currentContext = [];
        currentModel = null;
        chatWith.textContent = modelSelect.value;
        chat.removeAttribute('data-id');
        responding = false;
        chat.innerHTML = '';
        input.value = '';
        input.dispatchEvent(new Event('input'));
        sendButton.textContent = 'Send';
        input.focus();
    });
    document.getElementById('deleteChat').addEventListener('click', (e) => {
        const id = chat.getAttribute('data-id');
        if (id != null) {
            const transaction = db.transaction(['chat_history'], "readwrite");
            transaction.objectStore('chat_history').delete(Number(id));
            transaction.addEventListener('complete', () => {
                document.querySelector(`button[data-id="${id}"]`).remove();
                if (!chatHistory.firstElementChild) chatHistory.textContent = 'No chat history';
            });
            newChatButton.click();
        } else alert("No chat to delete!");
    });
    document.getElementById('settings').addEventListener('click', () => {
        document.getElementById('settingsPage').removeAttribute('style');
        document.getElementById('main').style.display = 'none';
    });
    document.querySelector('#settingsPage button').addEventListener('click', (e) => {
        document.getElementById('main').removeAttribute('style');
        document.getElementById('settingsPage').style.display = 'none';
    });

    loadModels();
});

function loadModels() {
    getModels().then((models) => {
        for (const model of models) {
            const option = document.createElement('option');
            option.value = model['name'];
            option.textContent = model['name'];
            modelSelect.appendChild(option);

            const previous_model = window.localStorage.getItem('model');
            if (previous_model != null && model.name === previous_model) modelSelect.value = previous_model;
        }
        modelSelect.addEventListener('change', () => {
            window.localStorage.setItem('model', modelSelect.value);
            if (currentModel == null) chatWith.textContent = modelSelect.value;
        });
        modelSelect.dispatchEvent(new Event('change'));
    }).catch(() => {
        if (confirm(`Unable to find models, are you sure ollama is running and allowed for this domain? (add OLLAMA_ORIGINS=${window.location.origin} to your environment variables and relaunch ollama, then press OK)`)) {
            loadModels();
        }
    });
}

function saveChat() {
    const messages = chat.children;
    if (messages.length > 0) {
        const chatInfo = {
            title: messages[0].textContent,
            context: currentContext,
            messages: Array.from(chat.children).map((el) => el.firstElementChild.getAttribute('original'))
        }
        let id = chat.getAttribute('data-id');
        const transaction = db.transaction(['chat_history'], "readwrite");
        const objectStore = transaction.objectStore('chat_history');
        if (id) {
            id = Number(id);
            objectStore.get(id).addEventListener('success', (e) => {
                const result = e.target.result;
                result.context = currentContext;
                result.messages = chatInfo.messages;
                objectStore.put(result);
            });
        } else {
            chatInfo.model = modelSelect.value;
            currentModel = modelSelect.value;
            objectStore.add(chatInfo);
        }
        transaction.addEventListener('complete', () => {
            if (!id) displayChatHistory(id);
        });
        transaction.addEventListener('error', () => alert("Unable to save chat"));
    }
}

function createChatBubble(user, no_default_text) {
    const segment = document.createElement('div');
    const bubble = document.createElement('div');
    bubble.classList.add('chatBubble');
    if (user) {
        bubble.classList.add('userBubble');
        if (!no_default_text) setChatBubbleText(bubble, input.value);
    } else {
        bubble.classList.add('responseBubble');
        if (!no_default_text) setChatBubbleText(bubble, 'Generating response...');
    }
    segment.classList.add('chatSegment');
    segment.appendChild(bubble);
    chat.appendChild(segment);
    segment.scrollIntoView({behavior: 'smooth', block: 'end'});
    return bubble;
}

function loadChat(button) {
    newChatButton.click();
    const id = Number(button.getAttribute('data-id'));
    chat.setAttribute('data-id', id.toString());
    button.classList.add('selected');
    const objectStore = db.transaction(['chat_history'], "readonly").objectStore('chat_history');
    objectStore.get(id).addEventListener('success', (e) => {
        const result = e.target.result;
        currentContext = result.context;
        currentModel = result.model || modelSelect.value; // to ensure compatibility with old chats, falls back tog modelSelect value
        chatWith.textContent = currentModel;
        let i = 0;
        for (const message of result.messages) {
            if (i % 2 === 0) {
                const bubble = createChatBubble(true);
                setChatBubbleText(bubble, message);
            } else {
                const bubble = createChatBubble(false, true);
                bubble.setAttribute('original', message);
                formatBubble(bubble);
            }
            ++i;
        }
        chat.lastElementChild.scrollIntoView({behavior: 'instant', block: 'end'});
    });
}

function displayChatHistory(reselect_id) {
    const transaction = db.transaction('chat_history');
    transaction.objectStore('chat_history').openCursor().addEventListener('success', (e) => {
        const cursor = e.target.result;
        if (chatHistory.firstChild.nodeName === '#text') chatHistory.firstChild.remove();
        if (cursor) {
            let button = document.querySelector(`button[data-id="${cursor.value.id}"]`);
            if (button == null) button = createChatHistoryEntry(cursor.value.title, cursor.value.id);
            if (cursor.value.id === reselect_id) button.classList.add('selected');
            cursor.continue();
        } else {
            if (!chatHistory.firstElementChild) chatHistory.textContent = 'No chat history';
        }
    });
    transaction.addEventListener('complete', () => {
        if (!reselect_id && chat.children.length > 0) {
            chatHistory.lastElementChild.classList.add('selected');
            chat.setAttribute('data-id', chatHistory.lastElementChild.getAttribute('data-id'));
        }
    });
}

function createChatHistoryEntry(title, id) {
    const button = document.createElement('button');
    button.textContent = title;
    button.classList.add('standardButton');
    button.setAttribute('data-id', id);
    button.addEventListener('click', () => loadChat(button));
    chatHistory.appendChild(button);
    return button
}

async function getModels() {
    return (await (await fetch(`${api_address.value}/api/tags`)).json())['models'];
}

async function postMessage() {
    const prompt = input.value;
    if (prompt.length > 0) {
        const output = createChatBubble(false);
        input.value = '';
        input.dispatchEvent(new Event('input'));
        input.disabled = true;
        sendButton.textContent = 'Stop Responding';
        const controller = new AbortController();
        const cancelButtonCallback = (e) => {
            e.preventDefault();
            controller.abort();
        }

        try {
            responding = true;
            sendButton.addEventListener('click', cancelButtonCallback, {once: true});

            const body = {
                prompt: prompt,
                context: currentContext,
                options: {}
            }
            body.model = currentModel || modelSelect.value;
            if (context_length.value != null) body.options.num_ctx = parseInt(context_length.value);
            if (temperature.value != null) body.options.temperature = parseInt(temperature.value);
            if (system_prompt.value != null) body.system = system_prompt.value;

            const response = await fetch(`${api_address.value}/api/generate`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify(body),
                signal: controller.signal
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            output.textContent = '';
            let chunk;

            while (true) {
                const {value, done} = await reader.read();
                if (done) break;
                chunk = decoder.decode(value, {stream: true}).split('\n');
                for (let line of chunk) {
                    line = line.trim();
                    if (line.length > 0) {
                        line = JSON.parse(line);
                        output.textContent += line.response;
                        output.scrollIntoView({behavior: 'smooth', block: 'end'});
                        if (line.context != null) currentContext = line.context;
                    }
                }
            }
        } finally {
            output.setAttribute('original', output.textContent);
            formatBubble(output);
            input.disabled = false;
            sendButton.textContent = 'Send';
            sendButton.removeEventListener('click', cancelButtonCallback);
            responding = false;
            saveChat();
            input.focus();
        }
    }
}

function setChatBubbleText(bubble, text) {
    bubble.textContent = text;
    bubble.setAttribute('original', text);
}

function formatBubble(bubble) {
    bubble.innerHTML = '';
    try {
        bubble.append(...getFormatted(bubble.getAttribute('original')));
    } catch (e) {
        bubble.innerHTML = '';
        bubble.textContent = bubble.getAttribute('original');
        console.error('Failed to format text', e);
    }
}

const big_code_block = /```.*?\n```/gs;
const small_code_block = /`.*?`/gs;

// Return the text as an array of nodes to insert into an element
function getFormatted(text) {
    const output = [];

    const big_code_matches = text.match(big_code_block);
    let i = 0, j = 0;
    for (let t of text.split(big_code_block)) {
        while (t.substring(0, 1) === '\n') t = t.substring(2);
        // inline code blocks
        const small_code_matches = t.match(small_code_block);
        for (const ts of t.split(small_code_block)) {
            output.push(document.createTextNode(ts));
            if (small_code_matches && small_code_matches[j]) {
                const code = document.createElement('code');
                code.textContent = small_code_matches[j].substring(1, small_code_matches[j].length - 1);
                output.push(code);
            }
            ++j;
        }

        // multi line code blocks
        if (big_code_matches && big_code_matches[i]) {
            const d = document.createElement('div'),
                pre = document.createElement('pre'),
                code = document.createElement('code'),
                info_div = document.createElement('div'),
                language_div = document.createElement('div'),
                copy_button = document.createElement('button');
            d.classList.add('codeBlockLanguageOuter');
            pre.appendChild(code);
            const lines = big_code_matches[i].split('\n');
            let language = lines[0].substring(3).trim();
            if (language.length === 0) language = 'No Language Specified';
            info_div.classList.add('codeBlockLanguage');
            d.append(info_div, pre);
            info_div.append(language_div, copy_button);
            language_div.textContent = language;
            language_div.classList.add('languageDiv');
            copy_button.textContent = 'Copy';
            copy_button.addEventListener('click', () => navigator.clipboard.writeText(code.textContent));
            copy_button.classList.add('standardButton');
            lines.shift();
            lines.pop();
            output.push(d);
            code.textContent = lines.join('\n');
        }
        ++i;
    }
    return output;
}