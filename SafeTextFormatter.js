(() => {
    const big_code_block = /```.*?\n```/gs;
    const small_code_block = /`.*?`/g;
    const bold_regex = /\*\*.*?\*\*/gs;
    // do headers, links

    // Return the text as an array of nodes to insert into an element
    function getFormatted(text) {
        const output = [];

        const big_code_matches = text.match(big_code_block) || [];
        let first_iterator = 0;
        for (let one of text.split(big_code_block)) {
            while (one.substring(0, 1) === '\n') one = one.substring(2); // Remove initial newlines

            const small_code_matches = one.match(small_code_block) || [];
            let second_iterator = 0;
            for (const two of one.split(small_code_block)) {

                const bold_matches = two.match(bold_regex) || [];
                let third_iterator = 0;
                for (const three of two.split(bold_regex)) {
                    output.push(document.createTextNode(three));

                    // bold text
                    if (bold_matches[third_iterator]) {
                        const bold = document.createElement('b');
                        bold.textContent = bold_matches[third_iterator].substring(2, bold_matches[third_iterator].length - 2);
                        output.push(bold);
                    }
                    ++third_iterator;
                }

                // inline code blocks
                if (small_code_matches[second_iterator]) {
                    const code = document.createElement('code');
                    code.textContent = small_code_matches[second_iterator].substring(1, small_code_matches[second_iterator].length - 1);
                    output.push(code);
                }
                ++second_iterator;
            }

            // multi line code blocks
            if (big_code_matches[first_iterator]) {
                const holding_div = document.createElement('div'), pre = document.createElement('pre'), code = document.createElement('code'), info_div = document.createElement('div'), language_div = document.createElement('div'), copy_button = document.createElement('button');
                const lines = big_code_matches[first_iterator].split('\n');
                let language = lines[0].substring(3).trim();
                if (language.length === 0) language = 'No Language Specified';
                holding_div.classList.add('codeBlockLanguageOuter');
                pre.appendChild(code);
                info_div.classList.add('codeBlockLanguage');
                holding_div.append(info_div, pre);
                info_div.append(language_div, copy_button);
                language_div.textContent = language;
                language_div.classList.add('languageDiv');
                copy_button.textContent = 'Copy';
                copy_button.addEventListener('click', () => navigator.clipboard.writeText(code.textContent));
                copy_button.classList.add('standardButton');
                lines.shift();
                lines.pop();
                output.push(holding_div);
                code.textContent = lines.join('\n');
            }
            ++first_iterator;
        }
        return output;
    }

    window.TextFormatter = {
        getFormatted: getFormatted,
    };
})();