import { getTargetPriceRules, saveTargetPriceRules } from '../services/localDb.js';

/**
 * Local max price map keyed by itemId, with fallback mapping title|floatPartValue → price.
 */

export function getTargetPriceKey(target) {
    return (
        target?.itemId ||
        target?.itemID ||
        target?.ItemID ||
        target?.targetId ||
        target?.targetID ||
        target?.TargetID ||
        target?.instantTargetId ||
        target?.id ||
        null
    );
}

function getTargetTitle(target) {
    return target?.itemTitle || target?.title || target?.Title || target?.extra?.name || target?.attributes?.title || '';
}

function getTargetFloatPartValue(target) {
    return (
        target?.extra?.floatPartValue ||
        target?.attributes?.floatPartValue ||
        target?.Attrs?.floatPartValue ||
        target?.attrs?.floatPartValue ||
        ''
    );
}

function getTargetPhase(target) {
    return target?.attributes?.phase || target?.extra?.phase || target?.Attrs?.phase || target?.attrs?.phase || null;
}

function getTargetPaintSeed(target) {
    return (
        target?.attributes?.paintSeed ||
        target?.extra?.paintSeed ||
        target?.Attrs?.paintSeed ||
        target?.attrs?.paintSeed ||
        null
    );
}

const TARGET_ID_KEYS = [
    'itemId',
    'itemID',
    'ItemID',
    'targetId',
    'targetID',
    'TargetID',
    'instantTargetId'
];

function getTargetIdFromObject(value) {
    if (!value || typeof value !== 'object') return null;
    for (const key of TARGET_ID_KEYS) {
        if (value[key] !== null && value[key] !== undefined && value[key] !== '') {
            return value[key];
        }
    }
    return null;
}

function getTargetIdFromRows(rows) {
    if (!Array.isArray(rows)) return null;
    for (const row of rows) {
        if (row?.Successful === false) continue;
        const id = getTargetIdFromObject(row) || getTargetIdFromObject(row?.target) || getTargetIdFromObject(row?.Target);
        if (id) return id;
    }
    return null;
}

export function getCreatedTargetIdFromResponse(response) {
    return (
        getTargetIdFromRows(response?.Result) ||
        getTargetIdFromRows(response?.targets) ||
        getTargetIdFromRows(response?.Targets) ||
        getTargetIdFromObject(response)
    );
}

export function buildMaxPricesSnapshot(targets, maxPrices) {
    const maxPricesByKey = {};
    const targetMetadata = {};
    for (const target of targets || []) {
        const itemId = getTargetPriceKey(target);
        const title = getTargetTitle(target);
        const floatPartValue = getTargetFloatPartValue(target);
        const maxPrice = maxPrices?.[itemId];
        const hasMaxPrice = maxPrice !== undefined && maxPrice !== null && maxPrice !== '';
        if (itemId && title && hasMaxPrice) {
            maxPricesByKey[`${title}|${floatPartValue}`] = maxPrice;
            targetMetadata[itemId] = {
                itemTitle: title,
                floatPartValue,
                phase: getTargetPhase(target),
                paintSeed: getTargetPaintSeed(target)
            };
        }
    }
    return {
        maxPrices: { ...maxPrices },
        maxPricesByKey,
        targetMetadata
    };
}

export function findTargetForPendingMaxPrice(targets = [], pendingMaxPrice = null) {
    if (!pendingMaxPrice?.title) return null;

    return (targets || []).find((target) => {
        const targetTitle = getTargetTitle(target);
        const targetFloat = getTargetFloatPartValue(target);
        const targetPhase = getTargetPhase(target);
        const targetPaintSeed = getTargetPaintSeed(target);

        const titleMatch = targetTitle === pendingMaxPrice.title;
        const floatMatch = targetFloat === (pendingMaxPrice.floatPartValue || '');
        const phaseMatch = (!pendingMaxPrice.phase && !targetPhase) || pendingMaxPrice.phase === targetPhase;
        const paintSeedMatch =
            ((!pendingMaxPrice.paintSeed || pendingMaxPrice.paintSeed === '0' || pendingMaxPrice.paintSeed === 0) &&
                (!targetPaintSeed || targetPaintSeed === 0)) ||
            (pendingMaxPrice.paintSeed &&
                targetPaintSeed &&
                parseInt(pendingMaxPrice.paintSeed, 10) === parseInt(targetPaintSeed, 10));

        return titleMatch && floatMatch && phaseMatch && paintSeedMatch;
    }) || null;
}

export function mergePendingMaxPriceAfterLoad(maxPrices, targets, pendingMaxPrice) {
    const target = findTargetForPendingMaxPrice(targets, pendingMaxPrice);
    const targetKey = getTargetPriceKey(target);
    if (!targetKey) return maxPrices;

    return {
        ...maxPrices,
        [targetKey]: pendingMaxPrice.maxPrice
    };
}

export function addPendingMaxPriceToSnapshot(snapshot, pendingMaxPrice) {
    if (
        !pendingMaxPrice?.title ||
        pendingMaxPrice.maxPrice === null ||
        pendingMaxPrice.maxPrice === undefined ||
        pendingMaxPrice.maxPrice === ''
    ) {
        return snapshot;
    }

    return {
        ...snapshot,
        maxPrices: pendingMaxPrice.targetId
            ? {
                  ...(snapshot.maxPrices || {}),
                  [pendingMaxPrice.targetId]: pendingMaxPrice.maxPrice
              }
            : { ...(snapshot.maxPrices || {}) },
        maxPricesByKey: {
            ...(snapshot.maxPricesByKey || {}),
            [`${pendingMaxPrice.title}|${pendingMaxPrice.floatPartValue || ''}`]: pendingMaxPrice.maxPrice
        },
        targetMetadata: pendingMaxPrice.targetId
            ? {
                  ...(snapshot.targetMetadata || {}),
                  [pendingMaxPrice.targetId]: {
                      itemTitle: pendingMaxPrice.title,
                      floatPartValue: pendingMaxPrice.floatPartValue || '',
                      phase: pendingMaxPrice.phase || null,
                      paintSeed: pendingMaxPrice.paintSeed || null
                  }
              }
            : { ...(snapshot.targetMetadata || {}) }
    };
}

/** Keep only entries whose itemId still exists in the current targets list. */
export function pruneMaxPricesForTargets(maxPrices, targets, extraValidIds = []) {
    const valid = new Set();
    for (const target of targets) {
        const id = getTargetPriceKey(target);
        if (id != null && id !== '') valid.add(String(id));
    }
    for (const id of extraValidIds || []) {
        if (id != null && id !== '') valid.add(String(id));
    }
    const out = {};
    for (const [k, v] of Object.entries(maxPrices)) {
        if (valid.has(String(k))) out[k] = v;
    }
    return out;
}

export function syncMaxPricesStorage(targets, prunedMaxPrices) {
    return persistMaxPricesSnapshot(buildMaxPricesSnapshot(targets, prunedMaxPrices));
}

export function mergeMaxPricesAfterLoad(savedMaxPrices, savedByKey, newTargets) {
    let restored = { ...savedMaxPrices };
    for (const target of newTargets) {
        const newItemId = getTargetPriceKey(target);
        const title = getTargetTitle(target);
        const floatPartValue = getTargetFloatPartValue(target);
        const key = `${title}|${floatPartValue}`;
        if (newItemId && title && !restored[newItemId] && savedByKey[key]) {
            restored[newItemId] = savedByKey[key];
        }
    }
    return restored;
}

function readLegacyMaxPricesSnapshot() {
    try {
        const saved = localStorage.getItem('targetsMaxPrices');
        const savedByKey = localStorage.getItem('targetsMaxPricesByKey');
        return {
            maxPrices: saved ? JSON.parse(saved) : {},
            maxPricesByKey: savedByKey ? JSON.parse(savedByKey) : {}
        };
    } catch (err) {
        console.error('Error loading legacy target max prices:', err);
        return { maxPrices: {}, maxPricesByKey: {} };
    }
}

function clearLegacyTargetMaxPriceKeys() {
    try {
        localStorage.removeItem('targetsMaxPrices');
        localStorage.removeItem('targetsMaxPricesByKey');
    } catch {
        /* ignore */
    }
}

export async function persistMaxPricesSnapshot(snapshot) {
    const result = await saveTargetPriceRules(snapshot);
    if (!result?.ok) {
        throw new Error(result?.error || 'Failed to save target max prices to SQLite');
    }
    return result;
}

export async function loadMaxPricesSnapshot() {
    try {
        const result = await getTargetPriceRules();
        if (result?.ok) {
            const maxPrices = result.maxPrices || {};
            const maxPricesByKey = result.maxPricesByKey || {};
            if (Object.keys(maxPrices).length > 0 || Object.keys(maxPricesByKey).length > 0) {
                return { maxPrices, maxPricesByKey, source: 'sqlite' };
            }
        }
    } catch (err) {
        console.warn('Error loading target max prices from SQLite:', err);
    }

    const legacy = readLegacyMaxPricesSnapshot();
    if (Object.keys(legacy.maxPrices).length > 0 || Object.keys(legacy.maxPricesByKey).length > 0) {
        await persistMaxPricesSnapshot(legacy);
        clearLegacyTargetMaxPriceKeys();
        return { ...legacy, source: 'legacy-localStorage' };
    }

    return { maxPrices: {}, maxPricesByKey: {}, source: 'empty' };
}
