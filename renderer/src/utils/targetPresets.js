const DEFAULT_GAME_ID = 'a8db';

function normalizeText(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

function normalizeKeyPart(value) {
    return normalizeText(value).toLowerCase();
}

function normalizeOptional(value) {
    const text = normalizeText(value);
    return text === '' || text === '0' ? null : text;
}

function normalizeNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? null : numberValue;
}

function normalizeAmount(value) {
    const amount = Number.parseInt(value, 10);
    return Number.isNaN(amount) || amount < 1 ? 1 : amount;
}

function firstArrayItem(value) {
    return Array.isArray(value) ? value[0] : value;
}

function normalizeImageCandidate(value) {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
        return (
            value.url ||
            value.src ||
            value.image ||
            value.imageUrl ||
            value.thumbnail ||
            value.small ||
            value.medium ||
            value.large ||
            null
        );
    }
    return null;
}

function getTargetPriceValue(target) {
    return target?.price?.USD ?? target?.Price?.Amount ?? target?.price ?? null;
}

export function getTargetImageUrl(source = {}) {
    const item = source || {};
    return (
        normalizeImageCandidate(item.image) ||
        normalizeImageCandidate(item.Image) ||
        normalizeImageCandidate(item.imageUrl) ||
        normalizeImageCandidate(item.thumbnail) ||
        normalizeImageCandidate(firstArrayItem(item.images)) ||
        normalizeImageCandidate(firstArrayItem(item.previewImages)) ||
        normalizeImageCandidate(firstArrayItem(item.media)) ||
        normalizeImageCandidate(item.extra?.image) ||
        normalizeImageCandidate(item.extra?.Image) ||
        normalizeImageCandidate(item.extra?.imageUrl) ||
        normalizeImageCandidate(item.extra?.thumbnail) ||
        normalizeImageCandidate(firstArrayItem(item.extra?.images)) ||
        normalizeImageCandidate(item.metadata?.image) ||
        normalizeImageCandidate(item.metadata?.Image) ||
        normalizeImageCandidate(item.metadata?.imageUrl) ||
        normalizeImageCandidate(item.metadata?.thumbnail) ||
        normalizeImageCandidate(firstArrayItem(item.metadata?.images)) ||
        null
    );
}

export function getTargetPresetTitleKey(title) {
    return normalizeKeyPart(title);
}

export function getTargetPresetMatchingImage(preset, targets = []) {
    const presetTitle = getTargetPresetTitleKey(preset?.title);
    if (!presetTitle) return null;

    const matchingTarget = targets.find((target) => {
        const title = target?.itemTitle || target?.title || target?.extra?.name || target?.attributes?.title;
        return getTargetPresetTitleKey(title) === presetTitle;
    });

    return matchingTarget ? getTargetImageUrl(matchingTarget) : null;
}

function centsToUsd(cents) {
    const value = normalizeNumber(cents);
    if (value === null) return null;
    return value / 100;
}

export function getTargetPresetKey({
    title,
    gameId = DEFAULT_GAME_ID,
    floatPartValue,
    phase,
    paintSeed
} = {}) {
    const normalizedTitle = normalizeKeyPart(title);
    if (!normalizedTitle) return null;

    return [
        'target-preset',
        normalizeKeyPart(gameId) || DEFAULT_GAME_ID,
        normalizedTitle,
        normalizeKeyPart(floatPartValue),
        normalizeKeyPart(phase),
        normalizeKeyPart(paintSeed)
    ].join('|');
}

export function buildTargetPresetFromForm(formData = {}, options = {}) {
    const title = normalizeText(formData.title);
    const gameId = options.gameId || formData.gameId || DEFAULT_GAME_ID;
    const floatPartValue = normalizeOptional(formData.floatPartValue);
    const phase = normalizeOptional(formData.phase);
    const paintSeed = normalizeOptional(formData.paintSeed);
    const id = getTargetPresetKey({ title, gameId, floatPartValue, phase, paintSeed });

    if (!id) return null;

    return {
        id,
        title,
        gameId,
        price: normalizeNumber(formData.price),
        amount: normalizeAmount(formData.quantity ?? formData.amount),
        maxPrice: normalizeNumber(formData.maxPrice),
        floatPartValue,
        phase,
        paintSeed,
        metadata: {
            source: options.source || 'target-form',
            imageUrl: getTargetImageUrl(formData)
        }
    };
}

export function buildTargetPresetFromTarget(target = {}, options = {}) {
    const title = normalizeText(target.itemTitle || target.title || target.extra?.name || target.attributes?.title);
    const gameId = options.gameId || target.gameId || target.gameID || DEFAULT_GAME_ID;
    const floatPartValue = normalizeOptional(target.extra?.floatPartValue || target.attributes?.floatPartValue);
    const phase = normalizeOptional(target.extra?.phase || target.attributes?.phase);
    const paintSeed = normalizeOptional(target.attributes?.paintSeed || target.extra?.paintSeed);
    const id = getTargetPresetKey({ title, gameId, floatPartValue, phase, paintSeed });

    if (!id) return null;

    return {
        id,
        title,
        gameId,
        price: centsToUsd(getTargetPriceValue(target)),
        amount: normalizeAmount(target.amount),
        maxPrice: normalizeNumber(options.maxPrice),
        floatPartValue,
        phase,
        paintSeed,
        metadata: {
            source: options.source || 'target',
            targetId: target.targetId || target.itemId || target.instantTargetId || null,
            imageUrl: getTargetImageUrl(target)
        }
    };
}

export function presetToTargetFormInitialData(preset = {}) {
    return {
        title: preset.title || '',
        price: preset.price === null || preset.price === undefined ? '' : String(preset.price),
        maxPrice: preset.maxPrice === null || preset.maxPrice === undefined ? '' : String(preset.maxPrice),
        quantity: preset.amount || 1,
        floatPartValue: preset.floatPartValue || '',
        phase: preset.phase || '',
        paintSeed: preset.paintSeed || '0',
        imageUrl: getTargetImageUrl(preset)
    };
}
