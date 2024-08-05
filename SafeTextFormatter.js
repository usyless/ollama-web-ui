(() => {
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

    window.TextFormatter = {
        getFormatted: getFormatted,
    };
})();