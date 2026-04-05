/**
 * price.USD з getUserOffers — рядок у центах (як у OffersList «без комісії»).
 */
export function offerPriceUsdToNetDollars(priceUsd) {
    if (priceUsd === undefined || priceUsd === null || priceUsd === 'N/A') return 0;
    if (typeof priceUsd === 'string') {
        if (!priceUsd.length) return 0;
        const dollars =
            priceUsd.length >= 2
                ? parseFloat(`${priceUsd.slice(0, -2)}.${priceUsd.slice(-2)}`)
                : parseFloat(`0.${priceUsd.padStart(2, '0')}`);
        return Number.isFinite(dollars) ? dollars : 0;
    }
    if (typeof priceUsd === 'number' && Number.isFinite(priceUsd)) {
        return priceUsd >= 10 ? priceUsd / 100 : priceUsd;
    }
    return 0;
}

/** Сума «отримаєте» по всіх user offers (type === 'offer'). */
export function sumOffersNetUsd(offersList) {
    if (!Array.isArray(offersList)) return 0;
    return offersList.reduce((sum, o) => {
        if (!o || o.type !== 'offer') return sum;
        return sum + offerPriceUsdToNetDollars(o.price?.USD);
    }, 0);
}
