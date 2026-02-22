// src/lib/utils/jsonpath.js

/**
 * Compute JSON paths for each line of formatted JSON.
 * Returns an array of path strings (one per line), e.g. ['$', '$.id', '$.name', ...].
 *
 * @param {string} formattedJson - Pretty-printed JSON string
 * @returns {string[]}
 */
export function computeJsonPaths(formattedJson) {
    if (!formattedJson?.trim()) return [];

    const lines = formattedJson.split('\n');
    const paths = [];
    const stack = []; // { type: 'object'|'array', segment: string|number|null, index: number }

    for (const line of lines) {
        const t = line.trim();

        // Empty line
        if (!t) {
            paths.push(buildPath(stack));
            continue;
        }

        // Closing bracket/brace
        if (t[0] === '}' || t[0] === ']') {
            stack.pop();
            paths.push(buildPath(stack));
            // Parent array advances to next element
            if (stack.length > 0 && stack[stack.length - 1].type === 'array') {
                stack[stack.length - 1].index++;
            }
            continue;
        }

        // Object key: "key": ...
        const keyMatch = t.match(/^"((?:[^"\\]|\\.)*)"\s*:\s*/);

        if (keyMatch) {
            const key = unescapeKey(keyMatch[1]);
            if (stack.length > 0) {
                stack[stack.length - 1].segment = key;
            }

            paths.push(buildPath(stack));

            // Check if value opens a nested structure
            const rest = t.slice(keyMatch[0].length).trim().replace(/,?\s*$/, '');
            if (rest === '{') {
                stack.push({ type: 'object', segment: null, index: 0 });
            } else if (rest === '[') {
                stack.push({ type: 'array', segment: null, index: 0 });
            }
            continue;
        }

        // Array element or bare opener
        if (stack.length > 0 && stack[stack.length - 1].type === 'array') {
            stack[stack.length - 1].segment = stack[stack.length - 1].index;
        }

        paths.push(buildPath(stack));

        const stripped = t.replace(/,?\s*$/, '');
        const last = stripped[stripped.length - 1];

        if (stripped === '{' || last === '{') {
            stack.push({ type: 'object', segment: null, index: 0 });
        } else if (stripped === '[' || last === '[') {
            stack.push({ type: 'array', segment: null, index: 0 });
        } else if (stack.length > 0 && stack[stack.length - 1].type === 'array') {
            stack[stack.length - 1].index++;
        }
    }

    return paths;
}

/**
 * Build a JSON path string from the current stack state.
 */
function buildPath(stack) {
    let path = '$';
    for (const frame of stack) {
        if (frame.segment === null || frame.segment === undefined) continue;
        if (typeof frame.segment === 'number') {
            path += `[${frame.segment}]`;
        } else if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(frame.segment)) {
            path += `.${frame.segment}`;
        } else {
            path += `["${frame.segment.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
        }
    }
    return path;
}

/**
 * Unescape JSON key string.
 */
function unescapeKey(key) {
    return key
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r');
}

/**
 * Get a short value type label from a formatted JSON line.
 * @param {string} line
 * @returns {string|null}
 */
export function getValueType(line) {
    const t = line.trim().replace(/,?\s*$/, '');

    // Extract value part (after key if present)
    const keyMatch = t.match(/^"(?:[^"\\]|\\.)*"\s*:\s*/);
    const val = keyMatch ? t.slice(keyMatch[0].length).replace(/,?\s*$/, '') : t;

    if (val === '{' || val === '}') return 'Object';
    if (val === '[' || val === ']') return 'Array';
    if (val.startsWith('"')) return 'String';
    if (val === 'null') return 'null';
    if (val === 'true' || val === 'false') return 'Boolean';
    if (/^-?\d/.test(val)) return 'Number';
    return null;
}