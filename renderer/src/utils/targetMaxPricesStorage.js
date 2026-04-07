/**
 * Local max price map keyed by itemId, with fallback mapping title|floatPartValue → price.
 */

export function buildMaxPricesSnapshot(targets, maxPrices) {
    const maxPricesByKey = {};
    for (const target of targets) {
        const itemId = target.itemId;
        const title = target.itemTitle || target.title || target.extra?.name || target.attributes?.title;
        const floatPartValue = target.extra?.floatPartValue || target.attributes?.floatPartValue || '';
        if (itemId && title && maxPrices[itemId]) {
            maxPricesByKey[`${title}|${floatPartValue}`] = maxPrices[itemId];
        }
    }
    return {
        maxPrices: { ...maxPrices },
        maxPricesByKey
    };
}

/** Keep only entries whose itemId still exists in the current targets list. */
export function pruneMaxPricesForTargets(maxPrices, targets) {
    const valid = new Set();
    for (const target of targets) {
        const id = target.itemId;
        if (id != null && id !== '') valid.add(String(id));
    }
    const out = {};
    for (const [k, v] of Object.entries(maxPrices)) {
        if (valid.has(String(k))) out[k] = v;
    }
    return out;
}

export function syncMaxPricesStorage(targets, prunedMaxPrices) {
    persistMaxPricesSnapshot(buildMaxPricesSnapshot(targets, prunedMaxPrices));
}

export function mergeMaxPricesAfterLoad(savedMaxPrices, savedByKey, newTargets) {
    let restored = { ...savedMaxPrices };
    for (const target of newTargets) {
        const newItemId = target.itemId;
        const title = target.itemTitle || target.title || target.extra?.name || target.attributes?.title;
        const floatPartValue = target.extra?.floatPartValue || target.attributes?.floatPartValue || '';
        const key = `${title}|${floatPartValue}`;
        if (newItemId && title && !restored[newItemId] && savedByKey[key]) {
            restored[newItemId] = savedByKey[key];
        }
    }
    return restored;
}

export function persistMaxPricesSnapshot({ maxPrices, maxPricesByKey }) {
    try {
        localStorage.setItem('targetsMaxPrices', JSON.stringify(maxPrices));
        localStorage.setItem('targetsMaxPricesByKey', JSON.stringify(maxPricesByKey));
    } catch (err) {
        console.error('Error persisting maxPrices snapshot:', err);
    }
}
