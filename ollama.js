const api_address = 'http://localhost:11434';
const modelSelect = document.getElementById('modelSelect');
const input = document.querySelector('textarea');
const sendButton = document.getElementById('sendChatButton');

const chat = document.getElementById('chat');
let currentContext = [];

let responding = false;

document.addEventListener('DOMContentLoaded', () => {
    input.addEventListener('input', (e) => {
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendButton.dispatchEvent(new Event('click'));
        }
    });
    sendButton.addEventListener('click', () => {
        if (!responding) {
            createChat(true);
            postMessage();
        }
    });

    getModels().then((models) => {
        for (const model of models) {
            const option = document.createElement('option');
            option.value = model['name'];
            option.textContent = model['name'];
            modelSelect.appendChild(option);

            const previous_model = window.localStorage.getItem('model');
            if (previous_model != null) modelSelect.value = previous_model;

            modelSelect.addEventListener('change', () => {
                window.localStorage.setItem('model', modelSelect.value);
            });
        }
    }).catch(() => alert('Unable to find models, are you sure ollama is running and allowed for this domain?'));
});

function createChat(user) {
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
            const output = createChat(false);
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