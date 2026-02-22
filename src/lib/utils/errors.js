// src/lib/utils/errors.js

/**
 * Extract a 0-based line number from an error message.
 *
 * Handles common formats:
 *   - Prettier/Babel:  "Unexpected token (3:5)"
 *   - JSON (V8):       "at position 45"
 *   - JSON (Firefox):  "at line 3 column 5"
 *   - Generic:         "line 3"
 *
 * @param {string} message - error message
 * @param {string} [text]  - source text (needed for position-based errors)
 * @returns {number} 0-based line index, or -1 if not found
 */
export function parseErrorLine(message, text) {
    if (!message) return -1;

    // (line:col) — Prettier, Babel, TypeScript
    let match = message.match(/\((\d+):(\d+)\)/);
    if (match) return parseInt(match[1]) - 1;

    // "at line N column M" — Firefox JSON parser
    match = message.match(/at line (\d+) column (\d+)/i);
    if (match) return parseInt(match[1]) - 1;

    // "line N" — generic
    match = message.match(/\bline (\d+)\b/i);
    if (match) return parseInt(match[1]) - 1;

    // "at position N" — V8 JSON parser (character offset)
    match = message.match(/position (\d+)/i);
    if (match && text) {
        const pos = parseInt(match[1]);
        if (pos >= 0 && pos <= text.length) {
            return text.slice(0, pos).split('\n').length - 1;
        }
    }

    // "column N" alone — less common
    // Can't determine line from column alone, skip

    return -1;
}