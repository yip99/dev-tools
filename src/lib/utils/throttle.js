// src/lib/utils/throttle.js

/**
 * Throttle a function with guaranteed trailing execution.
 * - First call executes immediately
 * - Subsequent calls within the window are deferred
 * - Last call always executes after the window
 * - Handles async functions — won't overlap executions
 *
 * @param {Function} fn
 * @param {number} ms - throttle window in milliseconds
 * @returns {Function & { cancel: () => void, flush: () => void }}
 */
export function throttle(fn, ms = 150) {
    let timer = null;
    let pendingArgs = null;
    let lastRun = 0;
    let running = false;

    async function execute() {
        if (pendingArgs === null || running) return;
        const args = pendingArgs;
        pendingArgs = null;
        lastRun = Date.now();
        running = true;
        try {
            await fn(...args);
        } finally {
            running = false;
            // If new calls arrived during execution, schedule next run
            if (pendingArgs !== null) {
                schedule();
            }
        }
    }

    function schedule() {
        clearTimeout(timer);
        const elapsed = Date.now() - lastRun;
        if (elapsed >= ms) {
            execute();
        } else {
            timer = setTimeout(execute, ms - elapsed);
        }
    }

    function throttled(...args) {
        pendingArgs = args;
        if (!running) schedule();
    }

    throttled.cancel = () => {
        clearTimeout(timer);
        pendingArgs = null;
    };

    throttled.flush = () => {
        clearTimeout(timer);
        lastRun = 0;
        execute();
    };

    return throttled;
}