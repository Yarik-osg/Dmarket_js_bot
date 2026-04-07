import { parseOrderPriceRawToCents } from './dmarketPrice.js';

/**
 * Best competing buy price for display ($x.xx), or null.
 */
export function formatHighestBuyOrderPrice(orders, formatUsdFromApiCents) {
    if (!orders?.length) return null;
    const ranked = orders
        .map((order) => {
            const raw = order.price?.amount || order.price?.USD || order.price;
            const cents = parseOrderPriceRawToCents(raw);
            return { raw, cents };
        })
        .filter((x) => x.cents > 0 && !Number.isNaN(x.cents))
        .sort((a, b) => b.cents - a.cents);
    if (ranked.length === 0) return null;
    return `$${formatUsdFromApiCents(ranked[0].raw)}`;
}
