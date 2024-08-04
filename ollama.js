const api_address = 'http://localhost:11434';
const modelSelect = document.getElementById('modelSelect');

document.addEventListener('DOMContentLoaded', () => {
    const input = document.querySelector('textarea');
    input.addEventListener('input', (e) => {
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            postMessage(e.target.value); // do context stuff later
        }
    });

    getModels().then((models) => {
        for (const model of models) {
            const option = document.createElement('option');
            option.value = model['name'];
            option.textContent = model['name'];
            modelSelect.appendChild(option);
        }
    }).catch(() => alert('Unable to find models, are you sure ollama is running and allowed for this domain?'));
});

async function getModels() {
    return (await (await fetch(`${api_address}/api/tags`)).json())['models'];
}

async function postMessage(prompt, context) {
    const model = modelSelect.value;
    const body = {
        model: model,
        prompt: prompt
    }
    if (context != null) body['context'] = context;
    const response = await fetch(`${api_address}/api/generate`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const output = document.getElementById('output');

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        output.textContent += chunk;
    }
}