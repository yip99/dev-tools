// src/lib/utils/diff.js

/**
 * Compute a unified line-level diff with inline character-level segments.
 *
 * @param {string} oldText
 * @param {string} newText
 * @returns {{
 *   text: string,
 *   markers: Array<'added'|'removed'|'modified'|null>,
 *   segments: Array<null | Array<{text: string, type: 'char-added'|'char-removed'|null}>>
 * }}
 */
export function computeDiff(oldText, newText) {
    const empty = (lines, marker) => ({
        text: lines.join('\n'),
        markers: lines.map(() => marker),
        segments: lines.map(() => null)
    });

    if (oldText === newText) return empty(newText.split('\n'), null);
    if (!oldText) return empty(newText.split('\n'), 'added');
    if (!newText) return empty(oldText.split('\n'), 'removed');

    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const matches = lineLCS(oldLines, newLines);
    const output = [];

    let ai = 0;
    let bi = 0;
    const sentinel = { aIdx: oldLines.length, bIdx: newLines.length };

    for (const match of [...matches, sentinel]) {
        const removed = oldLines.slice(ai, match.aIdx);
        const added = newLines.slice(bi, match.bIdx);
        const pairs = Math.min(removed.length, added.length);

        for (let k = 0; k < pairs; k++) {
            const segs = charDiff(removed[k], added[k]);
            output.push({
                text: segs.map((s) => s.text).join(''),
                marker: 'modified',
                segments: segs
            });
        }

        for (let k = pairs; k < removed.length; k++) {
            output.push({ text: removed[k], marker: 'removed', segments: null });
        }

        for (let k = pairs; k < added.length; k++) {
            output.push({ text: added[k], marker: 'added', segments: null });
        }

        if (match.aIdx < oldLines.length) {
            output.push({ text: oldLines[match.aIdx], marker: null, segments: null });
        }

        ai = match.aIdx + 1;
        bi = match.bIdx + 1;
    }

    return {
        text: output.map((o) => o.text).join('\n'),
        markers: output.map((o) => o.marker),
        segments: output.map((o) => o.segments)
    };
}

// ── Line-level LCS ──

function lineLCS(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] =
                a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }

    const result = [];
    let i = m;
    let j = n;
    while (i > 0 && j > 0) {
        if (a[i - 1] === b[j - 1]) {
            result.unshift({ aIdx: i - 1, bIdx: j - 1 });
            i--;
            j--;
        } else if (dp[i - 1][j] >= dp[i][j - 1]) {
            i--;
        } else {
            j--;
        }
    }
    return result;
}

// ── Character-level diff for a single modified line ──

function charDiff(oldLine, newLine) {
    if (oldLine === newLine) return [{ text: oldLine, type: null }];
    if (!oldLine) return [{ text: newLine, type: 'char-added' }];
    if (!newLine) return [{ text: oldLine, type: 'char-removed' }];

    if (oldLine.length > 500 || newLine.length > 500) {
        return [
            { text: oldLine, type: 'char-removed' },
            { text: newLine, type: 'char-added' }
        ];
    }

    const m = oldLine.length;
    const n = newLine.length;
    const dp = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] =
                oldLine[i - 1] === newLine[j - 1]
                    ? dp[i - 1][j - 1] + 1
                    : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }

    const matches = [];
    let i = m;
    let j = n;
    while (i > 0 && j > 0) {
        if (oldLine[i - 1] === newLine[j - 1]) {
            matches.unshift({ ai: i - 1, bi: j - 1 });
            i--;
            j--;
        } else if (dp[i - 1][j] >= dp[i][j - 1]) {
            i--;
        } else {
            j--;
        }
    }

    const raw = [];
    let ai = 0;
    let bi = 0;

    for (const cm of [...matches, { ai: m, bi: n }]) {
        if (ai < cm.ai) raw.push({ text: oldLine.slice(ai, cm.ai), type: 'char-removed' });
        if (bi < cm.bi) raw.push({ text: newLine.slice(bi, cm.bi), type: 'char-added' });
        if (cm.ai < m) raw.push({ text: oldLine[cm.ai], type: null });
        ai = cm.ai + 1;
        bi = cm.bi + 1;
    }

    const merged = [];
    for (const seg of raw) {
        const last = merged[merged.length - 1];
        if (last && last.type === seg.type) {
            last.text += seg.text;
        } else {
            merged.push({ text: seg.text, type: seg.type });
        }
    }

    return merged.filter((s) => s.text.length > 0);
}