// src/lib/utils/highlight.js

import hljs from 'highlight.js/lib/core';
import jsonLang from 'highlight.js/lib/languages/json';
import jsLang from 'highlight.js/lib/languages/javascript';

hljs.registerLanguage('json', jsonLang);
hljs.registerLanguage('javascript', jsLang);

/**
 * Highlight code using highlight.js.
 * Returns per-line HTML strings, or null if unsupported/empty.
 * @param {string} text
 * @param {string} language - 'json' | 'javascript'
 * @returns {string[] | null}
 */
export function highlight(text, language) {
    if (!text || !language) return null;
    try {
        const result = hljs.highlight(text, { language, ignoreIllegals: true });
        return splitHighlightedHTML(result.value);
    } catch {
        return null;
    }
}

/**
 * Auto-detect language from content.
 * @param {string} text
 * @returns {string | null}
 */
export function detectLanguage(text) {
    if (!text) return null;
    const t = text.trimStart();
    if (
        /^(\/\/|\/\*|import\s|export\s|const\s|let\s|var\s|function[\s(]|class\s|async\s)/.test(t)
    ) {
        return 'javascript';
    }
    if (t[0] === '{' || t[0] === '[') return 'json';
    return null;
}

export function supportedLanguages() {
    return ['json', 'javascript'];
}

/**
 * Split highlight.js HTML output into per-line strings,
 * properly closing and reopening tags at line boundaries.
 */
function splitHighlightedHTML(html) {
    const lines = [];
    let current = '';
    const openTags = [];

    for (let i = 0; i < html.length; i++) {
        const ch = html[i];

        // Line break — close all open tags, push line, reopen for next
        if (ch === '\n') {
            for (let j = openTags.length - 1; j >= 0; j--) {
                current += '</span>';
            }
            lines.push(current);
            current = openTags.join('');
            continue;
        }

        // HTML tag
        if (ch === '<') {
            const end = html.indexOf('>', i);
            if (end === -1) {
                current += ch;
                continue;
            }
            const tag = html.slice(i, end + 1);
            if (tag.startsWith('</')) {
                openTags.pop();
            } else if (!tag.endsWith('/>')) {
                openTags.push(tag);
            }
            current += tag;
            i = end;
            continue;
        }

        current += ch;
    }

    // Push final line
    for (let j = openTags.length - 1; j >= 0; j--) {
        current += '</span>';
    }
    lines.push(current);

    return lines;
}