/**
 * DMarket POST /target/v1/time-limits — скільки часу залишилось до наступного дозволеного оновлення таргета.
 */

export function getTargetRowId(target) {
    return target?.targetId || target?.itemId || target?.instantTargetId;
}

function inferShortNameFromTitle(fullTitle) {
    const s = String(fullTitle || '').trim();
    if (!s) return '';
    return s.replace(/^★\s*/u, '').trim() || s;
}

/**
 * Тіло запиту як у веб-клієнта DMarket: ItemTitle, GameID, AttributesV2.
 * Переважно клонує target.attributes з відповіді GET user/targets і дозаповнює поля.
 */
export function buildTargetTimeLimitsRequest(target) {
    const gameId = target.gameId || 'a8db';
    const itemTitle =
        target.itemTitle ||
        target.title ||
        target.attributes?.title ||
        target.extra?.name ||
        '';

    let base = {};
    if (target.attributes && typeof target.attributes === 'object') {
        try {
            base = JSON.parse(JSON.stringify(target.attributes));
        } catch {
            base = { ...target.attributes };
        }
    }

    const extra = target.extra && typeof target.extra === 'object' ? target.extra : {};
    const rowId = getTargetRowId(target) || base.id || '';

    const rawFloat =
        extra.floatPartValue ??
        base.floatPartValue ??
        target.floatPartValue ??
        target.extra?.floatPartValue ??
        target.attributes?.floatPartValue;
    const floatPartValue =
        rawFloat == null || rawFloat === '' || rawFloat === 'N/A'
            ? ''
            : String(rawFloat).trim();

    const AttributesV2 = {
        ...base,
        amount: Number(target.amount ?? base.amount ?? 1) || 1,
        gameId,
        title: itemTitle,
        name: base.name || extra.name || inferShortNameFromTitle(itemTitle),
        image: base.image || target.imageUrl || extra.image || target.extra?.image || '',
        category: base.category || extra.category || '',
        exterior: base.exterior || extra.exterior || '',
        price: target.price || base.price || { amount: '0', currency: 'USD' },
        floatPartValue,
        paintSeed: base.paintSeed ?? extra.paintSeed ?? '',
        id: base.id || rowId
    };

    if (base.ownerGets && !AttributesV2.ownerGets) AttributesV2.ownerGets = base.ownerGets;
    if (base.marketTargetPrice && !AttributesV2.marketTargetPrice) {
        AttributesV2.marketTargetPrice = base.marketTargetPrice;
    }
    if (base.fee != null && AttributesV2.fee == null) AttributesV2.fee = base.fee;
    if (base.feeResp && !AttributesV2.feeResp) AttributesV2.feeResp = base.feeResp;

    return {
        ItemTitle: itemTitle,
        GameID: gameId,
        AttributesV2
    };
}

export function parseTimeLimitsResponse(res) {
    const def = Number(res?.DefaultTimeLimit ?? res?.defaultTimeLimit ?? 0);
    const rem = Number(res?.RemainingTimeLimit ?? res?.remainingTimeLimit ?? 0);
    return {
        defaultMs: Number.isFinite(def) ? def : 0,
        remainingMs: Number.isFinite(rem) ? rem : 0
    };
}

/** Формат mm:ss для відображення залишку. */
export function formatCooldownMs(ms) {
    if (ms == null || !Number.isFinite(ms) || ms <= 0) return '';
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatCooldownCell(entry, now = Date.now()) {
    if (!entry) return { text: '…', className: 'target-cooldown--loading', title: '' };
    if (entry.loading) return { text: '…', className: 'target-cooldown--loading', title: '' };
    if (entry.error) return { text: '—', className: 'target-cooldown--error', title: String(entry.error) };
    const rem = Math.max(0, (entry.expiresAt || 0) - now);
    if (rem < 1000) {
        return { text: '—', className: 'target-cooldown--ready', title: '' };
    }
    const mmss = formatCooldownMs(rem);
    const def = entry.defaultMs > 0 ? ` / ${formatCooldownMs(entry.defaultMs)}` : '';
    return {
        text: mmss,
        className: 'target-cooldown--wait',
        title: def ? `${mmss} з періоду${def}` : mmss
    };
}

export function cooldownSortRemaining(target, cooldownById, now = Date.now()) {
    const id = getTargetRowId(target);
    const e = id ? cooldownById[id] : null;
    if (!e || e.error) return Number.MAX_SAFE_INTEGER;
    if (e.loading) return Number.MAX_SAFE_INTEGER - 1;
    return Math.max(0, (e.expiresAt || 0) - now);
}
