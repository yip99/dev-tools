// src/lib/utils/clipboard.js

/**
 * Copy text to clipboard and manage a reactive copied state.
 *
 * @param {string} key - identifier for the copied item
 * @param {string} text - text to copy
 * @param {function} setCopied - callback to update copied state, receives (key, value)
 * @param {number} [timeout=2000] - ms before resetting copied state
 */
export async function copyToClipboard(key, text, setCopied, timeout = 2000) {
    try {
        await navigator.clipboard.writeText(text);
        setCopied(key, true);
        setTimeout(() => setCopied(key, false), timeout);
    } catch (err) {
        console.error('Failed to copy:', err);
    }
}