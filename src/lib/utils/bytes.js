// src/lib/utils/bytes.js

/**
 * Get byte length of a string using UTF-8 encoding.
 * @param {string} str
 * @returns {number}
 */
export function byteSize(str) {
    return new TextEncoder().encode(str).length;
}

/**
 * Format a byte count into a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
export function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Compute the delta between two byte sizes.
 * @param {number} originalBytes
 * @param {number} modifiedBytes
 * @returns {{ diff: number, pct: number, formatted: string } | null}
 */
export function sizeDelta(originalBytes, modifiedBytes) {
    const d = modifiedBytes - originalBytes;
    if (d === 0) return null;
    const pct = originalBytes > 0 ? (d / originalBytes) * 100 : 0;
    return { diff: d, pct, formatted: formatSize(Math.abs(d)) };
}