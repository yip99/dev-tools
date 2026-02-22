// src/lib/utils/format.js

import * as prettier from 'prettier/standalone';
import * as prettierBabel from 'prettier/plugins/babel';
import * as prettierEstree from 'prettier/plugins/estree';
import * as prettierHtml from 'prettier/plugins/html';
import * as prettierCss from 'prettier/plugins/postcss';

const PLUGINS = [prettierBabel, prettierEstree, prettierHtml, prettierCss];

const PARSERS = {
    javascript: 'babel',
    html: 'html',
    css: 'css'
};

// ── Prettier formatting (async) ─────────────────────────────────

/**
 * Format code using Prettier.
 *
 * @param {string} code
 * @param {string} language - 'javascript' | 'html' | 'css'
 * @param {object} [options]
 * @param {string} [options.indent]
 * @param {number} [options.indentSize]
 * @returns {Promise<string>}
 */
export async function formatCode(code, language, options = {}) {
    if (!code?.trim()) return '';

    const parser = PARSERS[language];
    if (!parser) return code;

    const indent = options.indent ?? '  ';
    const tabWidth = indent[0] === '\t' ? (options.indentSize ?? 2) : indent.length;
    const useTabs = indent[0] === '\t';

    const prettierOptions = {
        parser,
        plugins: PLUGINS,
        tabWidth,
        useTabs,
        printWidth: 80
    };

    if (language === 'javascript') {
        Object.assign(prettierOptions, {
            semi: true,
            singleQuote: true,
            trailingComma: 'none',
            bracketSpacing: true,
            arrowParens: 'always'
        });
    }

    if (language === 'html') {
        Object.assign(prettierOptions, {
            htmlWhitespaceSensitivity: 'css',
            singleAttributePerLine: false,
            bracketSameLine: false,
            printWidth: 100
        });
    }

    if (language === 'css') {
        Object.assign(prettierOptions, {
            singleQuote: false
        });
    }

    const result = await prettier.format(code, prettierOptions);
    return result.replace(/\n$/, '');
}

// ── JSON parsing (sync — tokenizer-based) ───────────────────────

/**
 * Parse potentially messy JSON into a JS object. Synchronous.
 * Tries strict JSON.parse first. Falls back to normalizeJSON
 * tokenizer which strips comments, converts single quotes,
 * quotes unquoted keys, and removes trailing commas.
 *
 * @param {string} text
 * @returns {any}
 */
export function parseJSON(text) {
    const cleaned = cleanUnicode(text);
    try {
        return JSON.parse(cleaned);
    } catch (firstError) {
        try {
            return JSON.parse(normalizeJSON(cleaned));
        } catch {
            throw firstError;
        }
    }
}

/**
 * Single-pass tokenizer that converts messy JSON5-ish text to strict JSON.
 * Handles: // and /* comments, 'single quotes', unquoted keys, trailing commas.
 * Properly skips string contents so it never corrupts values.
 *
 * @param {string} text
 * @returns {string} strict JSON string
 */
function normalizeJSON(text) {
    let out = '';
    let i = 0;
    const len = text.length;
    let lastSignificant = '';

    while (i < len) {
        const ch = text[i];

        // Whitespace — pass through, don't update lastSignificant
        if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
            out += ch;
            i++;
            continue;
        }

        // Line comment — skip to end of line
        if (ch === '/' && i + 1 < len && text[i + 1] === '/') {
            i += 2;
            while (i < len && text[i] !== '\n') i++;
            continue;
        }

        // Block comment — skip to closing */
        if (ch === '/' && i + 1 < len && text[i + 1] === '*') {
            i += 2;
            while (i < len && !(text[i] === '*' && i + 1 < len && text[i + 1] === '/')) i++;
            if (i < len) i += 2;
            continue;
        }

        // Double-quoted string — pass through unchanged
        if (ch === '"') {
            let j = i + 1;
            while (j < len) {
                if (text[j] === '\\') { j += 2; continue; }
                if (text[j] === '"') break;
                j++;
            }
            out += text.slice(i, j + 1);
            lastSignificant = '"';
            i = j + 1;
            continue;
        }

        // Single-quoted string — convert to double-quoted
        if (ch === "'") {
            let j = i + 1;
            let inner = '';
            while (j < len && text[j] !== "'") {
                if (text[j] === '\\') {
                    if (j + 1 < len && text[j + 1] === "'") {
                        // \' → unescaped ' (not a valid JSON escape)
                        inner += "'";
                    } else {
                        inner += text.slice(j, j + 2);
                    }
                    j += 2;
                    continue;
                }
                // Escape double quotes that appear inside
                if (text[j] === '"') {
                    inner += '\\"';
                } else {
                    inner += text[j];
                }
                j++;
            }
            out += '"' + inner + '"';
            lastSignificant = '"';
            i = j + 1;
            continue;
        }

        // Trailing comma — skip if next meaningful token is } or ]
        if (ch === ',') {
            if (isTrailingComma(text, i, len)) {
                i++;
                continue;
            }
            out += ch;
            lastSignificant = ch;
            i++;
            continue;
        }

        // Unquoted key — identifier in key position (after { or ,)
        if (isIdentStart(ch) && (lastSignificant === '{' || lastSignificant === ',')) {
            let j = i;
            while (j < len && isIdentChar(text[j])) j++;
            // Look ahead past whitespace for a colon
            let k = j;
            while (k < len && (text[k] === ' ' || text[k] === '\t' || text[k] === '\n' || text[k] === '\r')) k++;
            if (k < len && text[k] === ':') {
                out += '"' + text.slice(i, j) + '"';
                lastSignificant = '"';
                i = j;
                continue;
            }
        }

        out += ch;
        lastSignificant = ch;
        i++;
    }

    return out;
}

/**
 * Check if comma at position is trailing (followed only by
 * whitespace/comments, then } or ]).
 */
function isTrailingComma(text, pos, len) {
    let j = pos + 1;
    while (j < len) {
        const ch = text[j];
        if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { j++; continue; }
        if (ch === '/' && j + 1 < len && text[j + 1] === '/') {
            j += 2;
            while (j < len && text[j] !== '\n') j++;
            continue;
        }
        if (ch === '/' && j + 1 < len && text[j + 1] === '*') {
            j += 2;
            while (j < len && !(text[j] === '*' && j + 1 < len && text[j + 1] === '/')) j++;
            if (j < len) j += 2;
            continue;
        }
        return ch === '}' || ch === ']';
    }
    return false;
}

function isIdentStart(ch) {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$';
}

function isIdentChar(ch) {
    return isIdentStart(ch) || (ch >= '0' && ch <= '9');
}

/**
 * Remove spaces after colons in formatted JSON.
 * @param {string} json
 * @returns {string}
 */
export function stripColonSpaces(json) {
    return json.replace(/(^\s*"(?:[^"\\]|\\.)*"): /gm, '$1:');
}

// ── Minification (sync) ────────────────────────────────────────

/**
 * Minify code. Synchronous.
 * @param {string} code
 * @param {string} language
 * @returns {string}
 */
export function minifyCode(code, language) {
    if (!code?.trim()) return '';
    if (language === 'json') return JSON.stringify(JSON.parse(code));
    if (language === 'javascript') return minifyJS(code);
    if (language === 'css') return minifyCSS(code);
    if (language === 'html') return minifyHTML(code);
    return code;
}

function minifyJS(code) {
    let out = '';
    let i = 0;
    const len = code.length;

    while (i < len) {
        const ch = code[i];

        if (ch === '/' && i + 1 < len && code[i + 1] === '/') {
            i += 2;
            while (i < len && code[i] !== '\n') i++;
            continue;
        }

        if (ch === '/' && i + 1 < len && code[i + 1] === '*') {
            i += 2;
            while (i < len && !(code[i] === '*' && i + 1 < len && code[i + 1] === '/')) i++;
            if (i < len) i += 2;
            continue;
        }

        if (ch === '"' || ch === "'") {
            const q = ch;
            out += ch;
            i++;
            while (i < len && code[i] !== q && code[i] !== '\n') {
                if (code[i] === '\\' && i + 1 < len) out += code[i++];
                out += code[i++];
            }
            if (i < len && code[i] === q) out += code[i++];
            continue;
        }

        if (ch === '`') {
            out += ch;
            i++;
            let depth = 0;
            while (i < len) {
                if (code[i] === '\\' && i + 1 < len) {
                    out += code[i++];
                    out += code[i++];
                    continue;
                }
                if (code[i] === '`' && depth === 0) break;
                if (code[i] === '$' && i + 1 < len && code[i + 1] === '{') {
                    out += '${';
                    i += 2;
                    depth++;
                    continue;
                }
                if (code[i] === '{') depth++;
                if (code[i] === '}') depth = Math.max(0, depth - 1);
                out += code[i++];
            }
            if (i < len) out += code[i++];
            continue;
        }

        if (ch === '/' && canStartRegex(out)) {
            out += ch;
            i++;
            while (i < len && code[i] !== '/' && code[i] !== '\n') {
                if (code[i] === '\\' && i + 1 < len) out += code[i++];
                out += code[i++];
            }
            if (i < len && code[i] === '/') {
                out += code[i++];
                while (i < len && /[gimsuy]/.test(code[i])) out += code[i++];
            }
            continue;
        }

        if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
            i++;
            while (
                i < len &&
                (code[i] === ' ' || code[i] === '\t' || code[i] === '\n' || code[i] === '\r')
            )
                i++;
            if (needsSpace(out, i < len ? code[i] : '')) out += ' ';
            continue;
        }

        out += ch;
        i++;
    }

    return out;
}

function minifyCSS(code) {
    let out = '';
    let i = 0;
    const len = code.length;

    while (i < len) {
        const ch = code[i];

        if (ch === '/' && i + 1 < len && code[i + 1] === '*') {
            i += 2;
            while (i < len && !(code[i] === '*' && i + 1 < len && code[i + 1] === '/')) i++;
            if (i < len) i += 2;
            continue;
        }

        if (ch === '"' || ch === "'") {
            const q = ch;
            out += ch;
            i++;
            while (i < len && code[i] !== q) {
                if (code[i] === '\\' && i + 1 < len) out += code[i++];
                out += code[i++];
            }
            if (i < len) out += code[i++];
            continue;
        }

        if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
            i++;
            while (
                i < len &&
                (code[i] === ' ' || code[i] === '\t' || code[i] === '\n' || code[i] === '\r')
            )
                i++;
            const last = out[out.length - 1];
            const next = i < len ? code[i] : '';
            if (last && next && !':;{},>+~)('.includes(last) && !':;{},>+~)('.includes(next)) {
                out += ' ';
            }
            continue;
        }

        if (ch === ';' && i + 1 < len) {
            let j = i + 1;
            while (j < len && (code[j] === ' ' || code[j] === '\t' || code[j] === '\n' || code[j] === '\r')) j++;
            if (j < len && code[j] === '}') {
                i++;
                continue;
            }
        }

        out += ch;
        i++;
    }

    return out;
}

function minifyHTML(code) {
    return code
        .replace(/<!--(?!\[)[\s\S]*?-->/g, '')
        .replace(/>\s+</g, '><')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function needsSpace(output, nextChar) {
    if (!output || !nextChar) return false;
    const last = output[output.length - 1];
    const isId = (c) => /[a-zA-Z0-9_$]/.test(c);
    return isId(last) && isId(nextChar);
}

function canStartRegex(output) {
    if (!output) return true;
    const trimmed = output.trimEnd();
    if (!trimmed) return true;
    const last = trimmed[trimmed.length - 1];
    return '=(:;,!&|?{[+->~%^*/'.includes(last);
}

// ── Unicode cleanup ─────────────────────────────────────────────

function cleanUnicode(text) {
    return text.replace(
        /("[^"\\]*(?:\\.[^"\\]*)*")|('[^'\\]*(?:\\.[^'\\]*)*')|[\u00A0\u2000-\u200A\u202F\u205F\u3000]|[\u200B-\u200F\u2060\uFEFF]|[\u2028\u2029]|[\u201C\u201D\u00AB\u00BB\u201E]|[\u2018\u2019\u201A]|[\u2013\u2014\u2212]/g,
        (m, dblQuoted, sglQuoted) => {
            if (dblQuoted || sglQuoted) return m;
            if (/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/.test(m)) return ' ';
            if (/[\u200B-\u200F\u2060\uFEFF]/.test(m)) return '';
            if (/[\u2028\u2029]/.test(m)) return '\n';
            if (/[\u201C\u201D\u00AB\u00BB\u201E]/.test(m)) return '"';
            if (/[\u2018\u2019\u201A]/.test(m)) return "'";
            if (/[\u2013\u2014\u2212]/.test(m)) return '-';
            return m;
        }
    );
}

// ── JSON object utilities ───────────────────────────────────────

export function stripNulls(obj) {
    if (Array.isArray(obj)) return obj.map(stripNulls).filter((v) => v !== null);
    if (typeof obj === 'object' && obj !== null) {
        return Object.fromEntries(
            Object.entries(obj)
                .filter(([, v]) => v !== null)
                .map(([k, v]) => [k, stripNulls(v)])
        );
    }
    return obj;
}

export function sortKeys(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(sortKeys);
    return Object.keys(obj)
        .sort()
        .reduce((acc, key) => ({ ...acc, [key]: sortKeys(obj[key]) }), {});
}