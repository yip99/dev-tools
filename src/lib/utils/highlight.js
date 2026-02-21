// src/lib/utils/highlight.js

/**
 * Syntax highlighting tokenizer.
 * Token types: key, string, number, boolean, null, keyword, comment, punctuation, plain
 */

const JS_KEYWORDS = new Set([
    'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
    'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends',
    'finally', 'for', 'from', 'function', 'get', 'if', 'import', 'in',
    'instanceof', 'let', 'new', 'of', 'return', 'set', 'static', 'super',
    'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while',
    'with', 'yield'
]);

const tokenizers = {
    json: tokenizeJSON,
    javascript: tokenizeJavaScript
};

export function highlight(text, language) {
    if (!language || text == null) return null;
    const fn = tokenizers[language];
    if (!fn) return null;
    return fn(text);
}

export function detectLanguage(text) {
    if (!text) return null;
    const t = text.trimStart();
    if (/^(\/\/|\/\*|import\s|export\s|const\s|let\s|var\s|function[\s(]|class\s|async\s)/.test(t)) {
        return 'javascript';
    }
    if (t[0] === '{' || t[0] === '[') return 'json';
    return null;
}

export function supportedLanguages() {
    return Object.keys(tokenizers);
}

// ── JSON tokenizer (line-by-line) ──────────────────────────────

function tokenizeJSON(text) {
    return text.split('\n').map(tokenizeJSONLine);
}

function tokenizeJSONLine(line) {
    const tokens = [];
    let i = 0;

    while (i < line.length) {
        const ch = line[i];

        if (ch === ' ' || ch === '\t' || ch === '\r') {
            const s = i;
            while (i < line.length && (line[i] === ' ' || line[i] === '\t' || line[i] === '\r')) i++;
            tokens.push({ text: line.slice(s, i), type: 'plain' });
            continue;
        }

        if (ch === '"') {
            const s = i++;
            while (i < line.length && line[i] !== '"') {
                if (line[i] === '\\') i++;
                i++;
            }
            if (i < line.length) i++;
            const str = line.slice(s, i);
            let j = i;
            while (j < line.length && line[j] === ' ') j++;
            tokens.push({ text: str, type: line[j] === ':' ? 'key' : 'string' });
            continue;
        }

        if (ch === '-' || (ch >= '0' && ch <= '9')) {
            const s = i;
            if (line[i] === '-') i++;
            while (i < line.length && line[i] >= '0' && line[i] <= '9') i++;
            if (i < line.length && line[i] === '.') {
                i++;
                while (i < line.length && line[i] >= '0' && line[i] <= '9') i++;
            }
            if (i < line.length && (line[i] === 'e' || line[i] === 'E')) {
                i++;
                if (i < line.length && (line[i] === '+' || line[i] === '-')) i++;
                while (i < line.length && line[i] >= '0' && line[i] <= '9') i++;
            }
            tokens.push({ text: line.slice(s, i), type: 'number' });
            continue;
        }

        if (ch === 't' && line.startsWith('true', i)) {
            tokens.push({ text: 'true', type: 'boolean' });
            i += 4;
            continue;
        }
        if (ch === 'f' && line.startsWith('false', i)) {
            tokens.push({ text: 'false', type: 'boolean' });
            i += 5;
            continue;
        }
        if (ch === 'n' && line.startsWith('null', i)) {
            tokens.push({ text: 'null', type: 'null' });
            i += 4;
            continue;
        }

        if ('{}[]:,'.includes(ch)) {
            tokens.push({ text: ch, type: 'punctuation' });
            i++;
            continue;
        }

        tokens.push({ text: ch, type: 'plain' });
        i++;
    }

    return tokens;
}

// ── JavaScript tokenizer (full-text, split to lines) ───────────

function tokenizeJavaScript(text) {
    const tokens = [];
    let i = 0;

    while (i < text.length) {
        const ch = text[i];

        // Newline
        if (ch === '\n') {
            tokens.push({ text: '\n', type: 'plain' });
            i++;
            continue;
        }

        // Whitespace (non-newline)
        if (ch === ' ' || ch === '\t' || ch === '\r') {
            const s = i;
            while (
                i < text.length &&
                text[i] !== '\n' &&
                (text[i] === ' ' || text[i] === '\t' || text[i] === '\r')
            )
                i++;
            tokens.push({ text: text.slice(s, i), type: 'plain' });
            continue;
        }

        // Comments
        if (ch === '/') {
            if (text[i + 1] === '/') {
                const s = i;
                while (i < text.length && text[i] !== '\n') i++;
                tokens.push({ text: text.slice(s, i), type: 'comment' });
                continue;
            }
            if (text[i + 1] === '*') {
                const s = i;
                i += 2;
                while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
                if (i < text.length) i += 2;
                tokens.push({ text: text.slice(s, i), type: 'comment' });
                continue;
            }
        }

        // Strings (single / double quote)
        if (ch === '"' || ch === "'") {
            const s = i;
            const q = ch;
            i++;
            while (i < text.length && text[i] !== q && text[i] !== '\n') {
                if (text[i] === '\\') i++;
                i++;
            }
            if (i < text.length && text[i] === q) i++;
            tokens.push({ text: text.slice(s, i), type: 'string' });
            continue;
        }

        // Template literal
        if (ch === '`') {
            const s = i;
            i++;
            while (i < text.length && text[i] !== '`') {
                if (text[i] === '\\') {
                    i += 2;
                    continue;
                }
                if (text[i] === '$' && i + 1 < text.length && text[i + 1] === '{') {
                    i += 2;
                    let depth = 1;
                    while (i < text.length && depth > 0) {
                        const c = text[i];
                        // Skip strings inside expression
                        if (c === '"' || c === "'") {
                            const q = c;
                            i++;
                            while (i < text.length && text[i] !== q && text[i] !== '\n') {
                                if (text[i] === '\\') i++;
                                i++;
                            }
                            if (i < text.length && text[i] === q) i++;
                            continue;
                        }
                        if (c === '{') depth++;
                        else if (c === '}') {
                            depth--;
                            if (depth === 0) break;
                        }
                        i++;
                    }
                    if (i < text.length) i++; // skip closing }
                    continue;
                }
                i++;
            }
            if (i < text.length) i++; // skip closing `
            tokens.push({ text: text.slice(s, i), type: 'string' });
            continue;
        }

        // Numbers
        if (ch >= '0' && ch <= '9') {
            const s = i;
            if (ch === '0' && i + 1 < text.length) {
                const nx = text[i + 1];
                if (nx === 'x' || nx === 'X') {
                    i += 2;
                    while (i < text.length && /[0-9a-fA-F_]/.test(text[i])) i++;
                } else if (nx === 'b' || nx === 'B') {
                    i += 2;
                    while (i < text.length && /[01_]/.test(text[i])) i++;
                } else if (nx === 'o' || nx === 'O') {
                    i += 2;
                    while (i < text.length && /[0-7_]/.test(text[i])) i++;
                } else {
                    i = readDecimal(text, i);
                }
            } else {
                i = readDecimal(text, i);
            }
            if (i < text.length && text[i] === 'n') i++; // BigInt
            tokens.push({ text: text.slice(s, i), type: 'number' });
            continue;
        }

        // Dot-number (.5)
        if (ch === '.' && i + 1 < text.length && text[i + 1] >= '0' && text[i + 1] <= '9') {
            const s = i;
            i++;
            while (i < text.length && text[i] >= '0' && text[i] <= '9') i++;
            if (i < text.length && (text[i] === 'e' || text[i] === 'E')) {
                i++;
                if (i < text.length && (text[i] === '+' || text[i] === '-')) i++;
                while (i < text.length && text[i] >= '0' && text[i] <= '9') i++;
            }
            tokens.push({ text: text.slice(s, i), type: 'number' });
            continue;
        }

        // Identifiers / keywords
        if (
            (ch >= 'a' && ch <= 'z') ||
            (ch >= 'A' && ch <= 'Z') ||
            ch === '_' ||
            ch === '$'
        ) {
            const s = i;
            while (
                i < text.length &&
                ((text[i] >= 'a' && text[i] <= 'z') ||
                    (text[i] >= 'A' && text[i] <= 'Z') ||
                    (text[i] >= '0' && text[i] <= '9') ||
                    text[i] === '_' ||
                    text[i] === '$')
            )
                i++;
            const word = text.slice(s, i);
            let type = 'plain';
            if (word === 'true' || word === 'false') type = 'boolean';
            else if (word === 'null' || word === 'undefined' || word === 'NaN' || word === 'Infinity')
                type = 'null';
            else if (JS_KEYWORDS.has(word)) type = 'keyword';
            tokens.push({ text: word, type });
            continue;
        }

        // Punctuation
        if ('{}[]();,.:'.includes(ch)) {
            tokens.push({ text: ch, type: 'punctuation' });
            i++;
            continue;
        }

        // Everything else (operators, etc.)
        tokens.push({ text: ch, type: 'plain' });
        i++;
    }

    return splitTokensToLines(tokens);
}

function readDecimal(text, i) {
    while (i < text.length && ((text[i] >= '0' && text[i] <= '9') || text[i] === '_')) i++;
    if (i < text.length && text[i] === '.') {
        i++;
        while (i < text.length && ((text[i] >= '0' && text[i] <= '9') || text[i] === '_')) i++;
    }
    if (i < text.length && (text[i] === 'e' || text[i] === 'E')) {
        i++;
        if (i < text.length && (text[i] === '+' || text[i] === '-')) i++;
        while (i < text.length && ((text[i] >= '0' && text[i] <= '9') || text[i] === '_')) i++;
    }
    return i;
}

function splitTokensToLines(tokens) {
    const lines = [[]];
    for (const token of tokens) {
        if (token.text === '\n') {
            lines.push([]);
            continue;
        }
        // Multi-line tokens (comments, template literals)
        if (token.text.includes('\n')) {
            const parts = token.text.split('\n');
            for (let j = 0; j < parts.length; j++) {
                if (parts[j]) {
                    lines[lines.length - 1].push({ text: parts[j], type: token.type });
                }
                if (j < parts.length - 1) {
                    lines.push([]);
                }
            }
            continue;
        }
        lines[lines.length - 1].push(token);
    }
    return lines;
}