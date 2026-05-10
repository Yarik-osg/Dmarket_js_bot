function getDbApi() {
    return window.electronAPI?.db || null;
}

export function hasLocalDb() {
    return Boolean(getDbApi());
}

export async function getAnalyticsTransactions(options) {
    return getDbApi()?.analytics?.get(options);
}

export async function saveAnalyticsTransactions(transactions, options) {
    return getDbApi()?.analytics?.save(transactions, options);
}

export async function clearAnalyticsTransactions() {
    return getDbApi()?.analytics?.clear();
}

export async function getDbHealth() {
    return getDbApi()?.getHealth?.();
}

export async function openDbFolder() {
    return getDbApi()?.openFolder?.();
}

export async function getTargetPriceRules() {
    return getDbApi()?.targetPriceRules?.get();
}

export async function saveTargetPriceRules(snapshot) {
    return getDbApi()?.targetPriceRules?.save(snapshot);
}

export async function getTargetPresets() {
    return getDbApi()?.targetPresets?.get();
}

export async function saveTargetPreset(preset) {
    return getDbApi()?.targetPresets?.save(preset);
}

export async function deleteTargetPreset(id) {
    return getDbApi()?.targetPresets?.delete(id);
}

export async function getOfferPriceRules() {
    return getDbApi()?.offerPriceRules?.get();
}

export async function saveOfferPriceRules(rules) {
    return getDbApi()?.offerPriceRules?.save(rules);
}
