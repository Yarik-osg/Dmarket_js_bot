const DMARKET_ORIGIN = 'https://dmarket.com';

/** Відомі gameId → сегмент шляху як на сайті (csgo-skins тощо). */
const GAME_ID_TO_MARKET_PATH = {
    a8db: 'csgo-skins'
};

/**
 * DMarket у шляху картки використовує wear як slug з дефісами (field-tested, factory-new),
 * а не пробіли — інакше часто 404 (наприклад field%20tested).
 */
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
    return normalizeExteriorForProductCard(m[1]);
}

/**
 * Публічна картка предмета: /{game}/product-card/{slug}/{exterior}
 * Приклад: /csgo-skins/product-card/m4a4-polysoup/factory-new
 */
export function getDMarketProductCardUrl(item) {
    if (!item || typeof item !== 'object') return null;
    const slug =
        item.slug ||
        item.extra?.slug ||
        item.attributes?.slug ||
        null;
    if (!slug || String(slug).trim() === '') return null;

    const gameId = item.gameId || item.extra?.gameId || 'a8db';
    const gamePath = GAME_ID_TO_MARKET_PATH[gameId] || 'csgo-skins';
    const slugPart = encodeURIComponent(String(slug).trim());
    let finalUrl = `${DMARKET_ORIGIN}/${gamePath}/product-card/${slugPart}?`;
    const exterior =
        normalizeExteriorForProductCard(
            item.extra?.exterior ?? item.attributes?.exterior ?? ''
        ) ||
        exteriorFromTitle(item.title || item.itemTitle || item.extra?.name || '');

    const phase = normalizeExteriorForProductCard(item.extra?.phase ?? item.attributes?.phase ?? '')

    if (exterior) {
        // Сегмент wear уже ASCII+дефіси; encodeURIComponent лишає їх без змін
        const extPart = encodeURIComponent(exterior);
        finalUrl += `exterior=${extPart}&`;
    }
    if (phase) {
        const phasePart = encodeURIComponent(phase);
        finalUrl += `phase=${phasePart}`;
    }
    return finalUrl;
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
