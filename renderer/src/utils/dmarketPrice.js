/**
 * Parse API order/target price for ranking (highest buy) — integer string = cents;
 * decimal / scientific = dollars.
 */
export function parseOrderPriceRawToCents(raw) {
    if (raw === undefined || raw === null) return null;
    const str = String(raw).trim();
    if (str === '') return null;
    let cents;
    if (str.includes('.') || /e/i.test(str)) {
        cents = Math.round(parseFloat(str) * 100);
    } else {
        cents = parseInt(str, 10);
    }
    if (!Number.isFinite(cents) || Number.isNaN(cents) || cents <= 0) return null;
    return cents;
}

/**
 * Heuristic used in auto-update loops: values ≥ 10 treated as cents, else as dollars.
 */
export function parseTargetPriceToCents(price) {
    if (price === undefined || price === null || price === 'N/A') return 0;
    if (typeof price === 'string') {
        const parsed = parseFloat(price);
        if (Number.isNaN(parsed)) return 0;
        return parsed >= 10 ? parsed : parsed * 100;
    }
    if (typeof price === 'number') {
        return price >= 10 ? price : price * 100;
    }
    return 0;
}
