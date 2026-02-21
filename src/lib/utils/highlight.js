// src/lib/utils/highlight.js

import hljs from 'highlight.js/lib/core';
import jsonLang from 'highlight.js/lib/languages/json';
import jsLang from 'highlight.js/lib/languages/javascript';
import htmlLang from 'highlight.js/lib/languages/xml';
import cssLang from 'highlight.js/lib/languages/css';

hljs.registerLanguage('json', jsonLang);
hljs.registerLanguage('javascript', jsLang);
hljs.registerLanguage('html', htmlLang);
hljs.registerLanguage('css', cssLang);

/**
 * Highlight code using highlight.js.
 * Returns per-line HTML strings, or null if unsupported/empty.
 * @param {string} text
 * @param {string} language - 'json' | 'javascript' | 'html' | 'css'
 * @returns {string[] | null}
 */
export function highlight(text, language) {
    if (!text || !language) return null;
    try {
        // highlight.js uses 'xml' internally for HTML
        const lang = language === 'html' ? 'html' : language;
        const result = hljs.highlight(text, { language: lang, ignoreIllegals: true });
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

    // HTML — starts with doctype, tag, or comment
    if (/^(<!DOCTYPE|<html|<\!--|<[a-zA-Z])/i.test(t)) return 'html';

    // CSS — starts with selector, @rule, or :root
    if (/^(@(import|media|font-face|keyframes|charset|layer)|:root|[.#a-zA-Z*][^{]*\{)/i.test(t)) {
        return 'css';
    }

    // JavaScript — starts with keyword, comment, or import/export
    if (
        /^(\/\/|\/\*|import\s|export\s|const\s|let\s|var\s|function[\s(]|class\s|async\s|'use strict')/.test(
            t
        )
    ) {
        return 'javascript';
    }

    // JSON — starts with { or [
    if (t[0] === '{' || t[0] === '[') return 'json';

    return null;
}

export function supportedLanguages() {
    return ['json', 'javascript', 'html', 'css'];
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