// src/lib/utils/diffstats.js

/**
 * Compute summary statistics from diff markers.
 *
 * @param {(string|null)[]} markers - array of 'added' | 'removed' | 'modified' | null
 * @returns {{ added: number, removed: number, modified: number, unchanged: number, total: number } | null}
 */
export function computeDiffStats(markers) {
    if (!markers || markers.length === 0) return null;

    const added = markers.filter((m) => m === 'added').length;
    const removed = markers.filter((m) => m === 'removed').length;
    const modified = markers.filter((m) => m === 'modified').length;
    const unchanged = markers.filter((m) => m === null).length;

    return { added, removed, modified, unchanged, total: markers.length };
}

/**
 * Check whether a diff has any actual changes.
 *
 * @param {{ added: number, removed: number, modified: number } | null} stats
 * @returns {boolean}
 */
export function hasChanges(stats) {
    if (!stats) return false;
    return stats.added > 0 || stats.removed > 0 || stats.modified > 0;
}