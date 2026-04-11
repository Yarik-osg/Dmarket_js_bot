import { filterOrdersForTarget } from './targetOrdersFilter.js';
import { formatHighestBuyOrderPrice } from './buyOrderDisplay.js';
import { formatUsdFromApiCents } from './formatUsd.js';
import { marketItemMatchesOfferWearAndPhase } from './offerMarketMatch.js';
import { getOfferId } from '../hooks/useOffers.js';

const BATCH = 6;

function targetRowId(target) {
    return target?.targetId || target?.itemId || target?.instantTargetId;
}

async function mapInBatches(items, batchSize, fn) {
    const out = {};
    for (let i = 0; i < items.length; i += batchSize) {
        const chunk = items.slice(i, i + batchSize);
        const pairs = await Promise.all(
            chunk.map(async (item) => {
                const id = fn.id(item);
                try {
                    const val = await fn.run(item);
                    return [id, val];
                } catch {
                    return [id, null];
                }
            })
        );
        for (const [id, val] of pairs) {
            if (id) out[id] = val;
        }
    }
    return out;
}

/**
 * Найкраща конкуруюча ціна buy order для таргета (як колонка «ринок» у таблиці таргетів).
 */
export async function fetchTargetMarketPrice(apiService, target) {
    const id = targetRowId(target);
    const title =
        target.itemTitle || target.title || target.attributes?.title || target.extra?.name;
    const gameId = target.gameId || 'a8db';
    if (!title || !id) return null;

    const targetsData = await apiService.getTargetsByTitle(gameId, title);
    if (!targetsData?.orders?.length) return null;
    const filtered = filterOrdersForTarget(targetsData.orders, target);
    return formatHighestBuyOrderPrice(filtered, formatUsdFromApiCents);
}

/**
 * Найнижча ціна sell на маркеті для зрізу офера (як у OffersTable).
 */
export async function fetchOfferMarketPrice(apiService, offer) {
    const offerId = getOfferId(offer);
    const title = offer.title || offer.extra?.name || offer.attributes?.title;
    const gameId = offer.gameId || 'a8db';
    if (!title || !offerId) return null;

    const marketData = await apiService.getMarketItems({
        gameId,
        title,
        currency: 'USD',
        limit: 300
    });

    if (!marketData?.objects?.length) return null;
    const filtered = marketData.objects.filter((item) => marketItemMatchesOfferWearAndPhase(offer, item));
    const ranked = filtered
        .map((item) => {
            const raw = item.price?.USD || item.price?.amount || item.price;
            const str = raw === undefined || raw === null ? '' : String(raw).trim();
            let cents;
            if (str.includes('.') || /e/i.test(str)) {
                cents = Math.round(parseFloat(str) * 100);
            } else {
                cents = parseInt(str, 10);
            }
            return { raw, cents };
        })
        .filter((x) => x.cents > 0 && !Number.isNaN(x.cents))
        .sort((a, b) => a.cents - b.cents);

    if (ranked.length === 0) return null;
    return `$${formatUsdFromApiCents(ranked[0].raw)}`;
}

export async function fetchTargetMarketPricesMap(apiService, targetsRaw) {
    if (!apiService || !targetsRaw?.length) return {};
    return mapInBatches(targetsRaw, BATCH, {
        id: (target) => targetRowId(target),
        run: (target) => fetchTargetMarketPrice(apiService, target)
    });
}

export async function fetchOfferMarketPricesMap(apiService, offersRaw) {
    if (!apiService || !offersRaw?.length) return {};
    return mapInBatches(offersRaw, BATCH, {
        id: (offer) => getOfferId(offer),
        run: (offer) => fetchOfferMarketPrice(apiService, offer)
    });
}
