document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('textarea').addEventListener('input', (e) => {
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
    });
});