// src/lib/utils/diff.js

import { diffLines, diffChars } from 'diff';

/**
 * Compute a line-level diff with character-level segments for modified lines.
 * Returns { text, markers, segments } compatible with CodeEditor.
 *
 * @param {string} original
 * @param {string} modified
 * @returns {{ text: string, markers: (string|null)[], segments: (object[]|null)[] }}
 */
export function computeDiff(original, modified) {
    if (!original && !modified) return { text: '', markers: [], segments: [] };

    if (original === modified) {
        const lines = original.split('\n');
        return {
            text: original,
            markers: lines.map(() => null),
            segments: lines.map(() => null)
        };
    }

    const changes = diffLines(original, modified);
    const outputLines = [];
    const markers = [];
    const segments = [];

    let i = 0;
    while (i < changes.length) {
        const change = changes[i];
        const lines = splitValue(change.value);

        // Unchanged lines
        if (!change.added && !change.removed) {
            for (const line of lines) {
                outputLines.push(line);
                markers.push(null);
                segments.push(null);
            }
            i++;
            continue;
        }

        // Removed followed by added — pair as modifications
        if (change.removed && i + 1 < changes.length && changes[i + 1].added) {
            const removedLines = lines;
            const addedLines = splitValue(changes[i + 1].value);
            const maxLen = Math.max(removedLines.length, addedLines.length);

            for (let j = 0; j < maxLen; j++) {
                const hasRemoved = j < removedLines.length;
                const hasAdded = j < addedLines.length;

                if (hasRemoved && hasAdded) {
                    // Modified line — compute character-level diff
                    const charChanges = diffChars(removedLines[j], addedLines[j]);
                    const lineSegments = charChanges.map((part) => ({
                        text: part.value,
                        type: part.added ? 'char-added' : part.removed ? 'char-removed' : 'plain'
                    }));
                    outputLines.push(addedLines[j]);
                    markers.push('modified');
                    segments.push(lineSegments);
                } else if (hasRemoved) {
                    outputLines.push(removedLines[j]);
                    markers.push('removed');
                    segments.push(null);
                } else {
                    outputLines.push(addedLines[j]);
                    markers.push('added');
                    segments.push(null);
                }
            }
            i += 2;
            continue;
        }

        // Pure removal or pure addition
        for (const line of lines) {
            outputLines.push(line);
            markers.push(change.removed ? 'removed' : 'added');
            segments.push(null);
        }
        i++;
    }

    return {
        text: outputLines.join('\n'),
        markers,
        segments
    };
}

/**
 * Split a diff change value into lines.
 * diffLines includes trailing newlines in values — strip before splitting.
 */
function splitValue(value) {
    if (!value) return [''];
    // Remove trailing newline that diffLines appends
    const trimmed = value.endsWith('\n') ? value.slice(0, -1) : value;
    return trimmed.split('\n');
}