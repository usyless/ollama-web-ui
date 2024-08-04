const api_address = 'http://localhost:11434';
const modelSelect = document.getElementById('modelSelect');
const input = document.querySelector('textarea');
const sendButton = document.getElementById('sendChatButton');
const newChatButton = document.getElementById('newChatButton');
const chatHistory = document.getElementById('chatHistory');

const chat = document.getElementById('chat');
let currentContext = [];

let responding = false;

let db;

document.addEventListener('DOMContentLoaded', () => {
    const dbOpen = window.indexedDB.open("chat_history", 1);
    dbOpen.addEventListener("error", () => console.error("Database failed to open"));
    dbOpen.addEventListener("success", () => {
        db = dbOpen.result;
        displayChatHistory();
    });
    dbOpen.addEventListener("upgradeneeded", (e) => {
        db = e.target.result;

        const chatHistoryStore = db.createObjectStore("chat_history", {
            keyPath: "id",
            autoIncrement: true,
        });

        chatHistoryStore.createIndex('name', 'name', { unique: false });
        chatHistoryStore.createIndex('context', 'context', { unique: false });
        chatHistoryStore.createIndex('messages', 'messages', { unique: false });
    });


    input.addEventListener('input', (e) => {
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendButton.click();
        }
    });
    sendButton.addEventListener('click', () => {
        if (!responding) {
            createChatBubble(true);
            postMessage();
        }
    });
    newChatButton.addEventListener('click', () => {
        if (responding) sendButton.click();
        currentContext = [];
        chat.removeAttribute('data-id');
        responding = false;
        chat.innerHTML = '';
        input.value = '';
        sendButton.textContent = 'Send';
        input.focus();
    });
    document.getElementById('saveChat').addEventListener('click', (e) => {
        const messages = chat.children;
        if (messages.length > 0) {
            const chatInfo = {
                title: messages[0].textContent,
                context: currentContext,
                messages: Array.from(chat.children).map((el) => el.textContent)
            }
            const id = chat.getAttribute('data-id');
            if (id) chatInfo.id = id;
            const transaction = db.transaction(['chat_history'], "readwrite");
            const objectStore = transaction.objectStore('chat_history');
            objectStore.add(chatInfo);
            transaction.addEventListener('success', () => {
                displayChatHistory();
                alert("Saved Successfully!");
            });
            transaction.addEventListener('error', () => alert("Unable to save chat"));
        } else alert("No chat to save!");
    });
    document.getElementById('deleteChat').addEventListener('click', (e) => {
        const id = chat.getAttribute('data-id');
        if (id != null) {
            const transaction = db.transaction(['chat_history'], "readwrite");
            const objectStore = transaction.objectStore('chat_history');
            objectStore.delete(id);
            transaction.addEventListener('complete', () => {
                document.querySelector(`button[data-id=${id}]`).remove();
                if (!chatHistory.firstElementChild) chatHistory.textContent = 'No chat history';
            });
            newChatButton.click();
        } else alert("No chat to delete!");
    });

    getModels().then((models) => {
        for (const model of models) {
            const option = document.createElement('option');
            option.value = model['name'];
            option.textContent = model['name'];
            modelSelect.appendChild(option);

            const previous_model = window.localStorage.getItem('model');
            if (previous_model != null && models.map((m) => m.name).includes(previous_model)) modelSelect.value = previous_model;

            modelSelect.addEventListener('change', () => {
                window.localStorage.setItem('model', modelSelect.value);
            });
        }
    }).catch(() => alert('Unable to find models, are you sure ollama is running and allowed for this domain?'));
});

function createChatBubble(user) {
    const segment = document.createElement('div');
    const bubble = document.createElement('div');
    bubble.classList.add('chatBubble', 'userBubble');
    if (user) bubble.classList.add('userBubble');
    else bubble.classList.add('responseBubble');
    bubble.textContent = input.value;
    segment.classList.add('chatSegment');
    segment.appendChild(bubble);
    chat.appendChild(segment);
    return bubble;
}

function loadChat(id) {
    newChatButton.click();
    const transaction = db.transaction(['chat_history'], "readonly");
    const objectStore = transaction.objectStore('chat_history');
    objectStore.get(id).addEventListener('success', (e) => {
        console.log(e.target.result);
    });
}

function displayChatHistory() {
    chatHistory.innerHTML = '';
    const objectStore = db.transaction('chat_history').objectStore('chat_history');
    objectStore.openCursor().addEventListener('success', (e) => {
        const cursor = e.target.result;
        if (cursor) {
            createChatHistoryEntry(cursor.title, cursor.id);
            cursor.continue();
        } else {
            if (!chatHistory.firstElementChild) chatHistory.textContent = 'No chat history';
        }
    });
}

function createChatHistoryEntry(title, id) {
    const button = document.createElement('button');
    button.textContent = title;
    button.setAttribute('data-id', id);
    button.addEventListener('click', () => loadChat(id));
    chatHistory.appendChild(button);
}

async function getModels() {
    return (await (await fetch(`${api_address}/api/tags`)).json())['models'];
}

async function postMessage() {
    const prompt = input.value;
    if (prompt.length > 0) {
        input.value = '';
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

            const response = await fetch(`${api_address}/api/generate`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    model: modelSelect.value,
                    prompt: prompt,
                    context: currentContext
                }),
                signal: controller.signal
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            const output = createChatBubble(false);
            let chunk;

            while (true) {
                const {value, done} = await reader.read();
                if (done) break;
                chunk = JSON.parse(decoder.decode(value, {stream: true}));
                output.textContent += chunk.response;
                output.scrollIntoView({behavior: 'smooth', block: 'end'});
            }
            if (chunk.context != null) currentContext = chunk.context;
        } finally {
            input.disabled = false;
            sendButton.textContent = 'Send';
            sendButton.removeEventListener('click', cancelButtonCallback);
            responding = false;
            input.focus();
        }
    }
}