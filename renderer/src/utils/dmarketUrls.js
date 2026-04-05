const DMARKET_ORIGIN = 'https://dmarket.com';

/** Відомі gameId → сегмент шляху як на сайті (csgo-skins тощо). */
const GAME_ID_TO_MARKET_PATH = {
    a8db: 'csgo-skins'
};

/**
 * Wear у сегменті URL на DMarket змішаний:
 * — «Factory New», «Minimal Wear» → з пробілом: factory new, minimal wear (як у href на сайті);
 * — Field-Tested, Well-Worn, Battle-Scarred → з дефісом: field-tested, well-worn, battle-scarred.
 * Уніфікація всіх варіантів з API / назви.
 */
const WEAR_PATH_BY_KEY = {
    'factory new': 'factory new',
    'minimal wear': 'minimal wear',
    'field tested': 'field-tested',
    'well worn': 'well-worn',
    'battle scarred': 'battle-scarred'
};

const WEAR_ABBR = {
    fn: 'factory new',
    mw: 'minimal wear',
    ft: 'field-tested',
    ww: 'well-worn',
    bs: 'battle-scarred'
};

function wearKeyFromRaw(exterior) {
    if (exterior === undefined || exterior === null) return '';
    return String(exterior)
        .trim()
        .toLowerCase()
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Сегмент wear для path product-card (перед encodeURIComponent). */
function formatExteriorForDMarketProductCardPath(exterior) {
    if (exterior === undefined || exterior === null) return null;
    const trimmed = String(exterior).trim();
    if (!trimmed) return null;

    const key = wearKeyFromRaw(trimmed);
    if (!key) return null;

    if (WEAR_PATH_BY_KEY[key]) return WEAR_PATH_BY_KEY[key];
    if (WEAR_ABBR[key]) return WEAR_ABBR[key];

    return null;
}

/** Для phase та інших slug-подібних рядків (дефіси, без спец-мапи wear). */
function normalizeExteriorForProductCard(exterior) {
    if (exterior === undefined || exterior === null) return null;
    const s = String(exterior)
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return s || null;
}

function exteriorFromTitle(title) {
    if (!title || typeof title !== 'string') return null;
    const m = title.match(/\(([^)]+)\)\s*$/);
    if (!m) return null;
    return (
        formatExteriorForDMarketProductCardPath(m[1]) ||
        normalizeExteriorForProductCard(m[1])
    );
}

/** phase з API або з назви (Gamma Doppler Phase 3, phase-2, …) */
function normalizePhaseForProductCard(phase) {
    if (phase === undefined || phase === null) return null;
    if (typeof phase === 'number' && Number.isFinite(phase)) {
        return `phase-${Math.trunc(phase)}`;
    }
    const s = String(phase).trim();
    if (!s) return null;
    if (/^\d+$/.test(s)) return `phase-${s}`;
    return normalizeExteriorForProductCard(s);
}

function phaseFromTitle(title) {
    if (!title || typeof title !== 'string') return null;
    const p1 = title.match(/\bphase\s*[-]?\s*(\d+)\b/i);
    if (p1) return `phase-${p1[1]}`;
    const p2 = title.match(/\b(phase-\d+)\b/i);
    if (p2) return normalizeExteriorForProductCard(p2[1]);
    return null;
}

/**
 * Slug з повної назви маркету (без wear у дужках), коли API не дав slug.
 * "AK-47 | Head Shot (Well-Worn)" → "ak-47-head-shot"
 */
function slugFromItemTitle(fullTitle) {
    if (!fullTitle || typeof fullTitle !== 'string') return null;
    const wearMatch = fullTitle.match(/\(([^)]+)\)\s*$/);
    const base = wearMatch ? fullTitle.slice(0, wearMatch.index).trim() : fullTitle.trim();
    if (!base) return null;
    const s = base
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/™/gi, '')
        .replace(/\s*★\s*/g, ' ')
        .replace(/\|/g, ' ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return s || null;
}

/**
 * Публічна картка предмета: /{game}/product-card/{slug}/{exterior}
 * Wear: factory new / minimal wear (пробіл), field-tested / well-worn / battle-scarred (дефіс).
 */
export function getDMarketProductCardUrl(item) {
    if (!item || typeof item !== 'object') return null;

    let slug =
        item.slug ||
        item.extra?.slug ||
        item.attributes?.slug ||
        null;
    if (!slug || String(slug).trim() === '') {
        slug = slugFromItemTitle(item.title || item.itemTitle || item.extra?.name || '');
    }
    if (!slug || String(slug).trim() === '') return null;

    const gameId = item.gameId || item.extra?.gameId || 'a8db';
    const gamePath = GAME_ID_TO_MARKET_PATH[gameId] || 'csgo-skins';
    const slugPart = encodeURIComponent(String(slug).trim());

    const exteriorRaw =
        item.extra?.exterior ?? item.attributes?.exterior ?? '';
    const titleStr = item.title || item.itemTitle || item.extra?.name || '';
    const exterior =
        formatExteriorForDMarketProductCardPath(exteriorRaw) ||
        exteriorFromTitle(titleStr) ||
        normalizeExteriorForProductCard(exteriorRaw);

    const phaseRaw = item.extra?.phase ?? item.attributes?.phase ?? '';
    const phase =
        normalizePhaseForProductCard(phaseRaw) ||
        phaseFromTitle(item.title || item.itemTitle || item.extra?.name || '');

    let pathUrl;
    if (exterior) {
        const extPart = encodeURIComponent(exterior);
        pathUrl = `${DMARKET_ORIGIN}/${gamePath}/product-card/${slugPart}/${extPart}`;
    } else {
        pathUrl = `${DMARKET_ORIGIN}/${gamePath}/product-card/${slugPart}`;
    }

    if (phase) {
        const u = new URL(pathUrl);
        u.searchParams.set('phase', phase);
        return u.toString();
    }
    return pathUrl;
}

export async function openUrlInBrowser(url) {
    if (!url || typeof url !== 'string') return { ok: false };
    if (window.electronAPI?.openExternal) {
        const res = await window.electronAPI.openExternal(url);
        if (res && res.ok) return res;
        window.open(url, '_blank', 'noopener,noreferrer');
        return { ok: true };
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    return { ok: true };
}
