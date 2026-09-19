import { calculateYouGet } from './offerFees.js';

/**
 * price.USD з Marketplace API v2 — публічна ціна продажу в центах (з комісією).
 */
export function offerPriceUsdToGrossDollars(priceUsd) {
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

/** Орієнтовна сума «отримаєте» після комісії по всіх активних оферах. */
export function sumOffersNetUsd(offersList) {
    if (!Array.isArray(offersList)) return 0;
    return offersList.reduce((sum, o) => {
        if (!o || o.type !== 'offer') return sum;
        const gross = offerPriceUsdToGrossDollars(o.price?.USD);
        return sum + Number(calculateYouGet(o, gross));
    }, 0);
}
