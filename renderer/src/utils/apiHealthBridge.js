/**
 * @typedef {{ ok: boolean; status: number; method: string; path: string; retryAfterSec?: number | null }} DmarketHttpReport
 */

/** @type {((payload: DmarketHttpReport) => void) | null} */
let reporter = null;

/** @param {DmarketHttpReport} payload */
export function reportDmarketHttpResult(payload) {
    try {
        reporter?.(payload);
    } catch (e) {
        console.warn('[apiHealthBridge] reporter failed', e);
    }
}

/** @param {((payload: DmarketHttpReport) => void) | null} fn */
export function setDmarketHttpReporter(fn) {
    reporter = fn;
}
