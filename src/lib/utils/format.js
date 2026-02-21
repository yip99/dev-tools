// src/lib/utils/format.js

import * as prettier from 'prettier/standalone';
import * as prettierBabel from 'prettier/plugins/babel';
import * as prettierEstree from 'prettier/plugins/estree';
import * as prettierHtml from 'prettier/plugins/html';
import * as prettierCss from 'prettier/plugins/postcss';

const PLUGINS = [prettierBabel, prettierEstree, prettierHtml, prettierCss];

const PARSERS = {
    json: 'json',
    javascript: 'babel',
    html: 'html',
    css: 'css'
};

// ── Prettier formatting (async) ─────────────────────────────────

/**
 * Format code using Prettier.
 * @param {string} code
 * @param {string} language - 'json' | 'javascript' | 'html' | 'css'
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

// ── Minification ────────────────────────────────────────────────

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

        // Single-line comment
        if (ch === '/' && i + 1 < len && code[i + 1] === '/') {
            i += 2;
            while (i < len && code[i] !== '\n') i++;
            continue;
        }

        // Multi-line comment
        if (ch === '/' && i + 1 < len && code[i + 1] === '*') {
            i += 2;
            while (i < len && !(code[i] === '*' && i + 1 < len && code[i + 1] === '/')) i++;
            if (i < len) i += 2;
            continue;
        }

        // String (single/double quote)
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

        // Template literal
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

        // Regex literal
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

        // Whitespace
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

        // Comments
        if (ch === '/' && i + 1 < len && code[i + 1] === '*') {
            i += 2;
            while (i < len && !(code[i] === '*' && i + 1 < len && code[i + 1] === '/')) i++;
            if (i < len) i += 2;
            continue;
        }

        // Strings
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

        // Whitespace
        if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
            i++;
            while (
                i < len &&
                (code[i] === ' ' || code[i] === '\t' || code[i] === '\n' || code[i] === '\r')
            )
                i++;
            // Space needed between identifier-like chars, after colon in declarations
            const last = out[out.length - 1];
            const next = i < len ? code[i] : '';
            if (last && next && !':;{},>+~)('.includes(last) && !':;{},>+~)('.includes(next)) {
                out += ' ';
            }
            continue;
        }

        // Collapse semicolon before closing brace
        if (ch === ';' && i + 1 < len) {
            let j = i + 1;
            while (j < len && (code[j] === ' ' || code[j] === '\t' || code[j] === '\n' || code[j] === '\r')) j++;
            if (j < len && code[j] === '}') {
                // Skip the semicolon
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
        // Remove HTML comments (but not conditional comments)
        .replace(/<!--(?!\[)[\s\S]*?-->/g, '')
        // Collapse whitespace between tags
        .replace(/>\s+</g, '><')
        // Collapse internal whitespace runs
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

// ── JSON utilities ──────────────────────────────────────────────

/**
 * Parse potentially messy JSON.
 * Handles trailing commas, unquoted keys, smart quotes, unicode spaces.
 */
export function parseJSON(text) {
    const cleaned = text.replace(
        /("[^"\\]*(?:\\.[^"\\]*)*")|[\u00A0\u2000-\u200A\u202F\u205F\u3000]|[\u200B-\u200F\u2060\uFEFF]|[\u2028\u2029]|[\u201C\u201D\u00AB\u00BB\u201E]|[\u2018\u2019\u201A]|[\u2013\u2014\u2212]/g,
        (m, quoted) => {
            if (quoted) return quoted;
            if (/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/.test(m)) return ' ';
            if (/[\u200B-\u200F\u2060\uFEFF]/.test(m)) return '';
            if (/[\u2028\u2029]/.test(m)) return '\n';
            if (/[\u201C\u201D\u00AB\u00BB\u201E]/.test(m)) return '"';
            if (/[\u2018\u2019\u201A]/.test(m)) return "'";
            if (/[\u2013\u2014\u2212]/.test(m)) return '-';
            return m;
        }
    );
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        try {
            const fixed = cleaned
                .replace(/'/g, '"')
                .replace(/([{,]\s*)([a-zA-Z0-9_]+?)\s*:/g, '$1"$2":')
                .replace(/,\s*([}\]])/g, '$1');
            return JSON.parse(fixed);
        } catch {
            throw e;
        }
    }
}

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