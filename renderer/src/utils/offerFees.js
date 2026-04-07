/**
 * Pure fee calculation utilities for DMarket offers.
 */

export function isCustomFeeApplicable(offer, price) {
    if (!offer?.fees?.dmarket?.sell?.custom) return false;

    const custom = offer.fees.dmarket.sell.custom;
    const conditions = custom.conditions || {};
    const priceInCents = Math.round(parseFloat(price) * 100);
    const currentTime = Math.floor(Date.now() / 1000);
    const minPrice = parseFloat(conditions.minPrice?.USD || 0);
    const maxPrice = parseFloat(conditions.maxPrice?.USD || Infinity);
    const startsAt = conditions.startsAt || 0;
    const expiresAt = conditions.expiresAt || Infinity;

    return (
        priceInCents >= minPrice &&
        priceInCents <= maxPrice &&
        currentTime >= startsAt &&
        currentTime <= expiresAt
    );
}

export function getFeePercentage(offer, price) {
    if (!offer?.fees?.dmarket?.sell) return 10;

    const sellFees = offer.fees.dmarket.sell;
    if (!sellFees.custom) return parseFloat(sellFees.default?.percentage || 10);

    if (isCustomFeeApplicable(offer, price)) {
        return parseFloat(sellFees.custom.percentage || 10);
    }
    return parseFloat(sellFees.default?.percentage || 10);
}

function getMinFee(offer, price) {
    if (isCustomFeeApplicable(offer, price)) {
        return parseFloat(offer.fees.dmarket.sell.custom.minFee?.USD || 0);
    }
    if (offer?.fees?.dmarket?.sell?.default) {
        return parseFloat(offer.fees.dmarket.sell.default.minFee?.USD || 0);
    }
    return 0;
}

export function calculateYouGet(offer, price) {
    const priceNum = parseFloat(price) || 0;
    if (priceNum <= 0) return '0.00';

    const feePercentage = getFeePercentage(offer, price);
    const priceInCents = Math.round(priceNum * 100);
    const minFee = getMinFee(offer, price);
    const feeAmount = Math.max(Math.round((priceInCents * feePercentage) / 100), minFee);
    const youGetCents = priceInCents - feeAmount;
    return (youGetCents / 100).toFixed(2);
}

export function calculatePriceWithFee(offer, priceAfterFee) {
    const priceNum = parseFloat(priceAfterFee) || 0;
    if (priceNum <= 0) return '0.00';

    const feePercentage = getFeePercentage(offer, priceAfterFee);
    const priceAfterFeeInCents = Math.round(priceNum * 100);
    const minFee = getMinFee(offer, priceAfterFee);

    let sellingPriceCents = Math.round(priceAfterFeeInCents / (1 - feePercentage / 100));
    const calculatedFee = Math.round((sellingPriceCents * feePercentage) / 100);

    if (calculatedFee < minFee) {
        sellingPriceCents = priceAfterFeeInCents + minFee;
    } else {
        const testPrice = Math.round(priceAfterFeeInCents / (1 - feePercentage / 100));
        let bestPrice = testPrice;
        for (let i = -2; i <= 2; i++) {
            const testPriceCents = testPrice + i;
            const testFee = Math.max(Math.round((testPriceCents * feePercentage) / 100), minFee);
            const testYouGet = testPriceCents - testFee;
            if (testYouGet >= priceAfterFeeInCents && testYouGet < priceAfterFeeInCents + 2) {
                bestPrice = testPriceCents;
                break;
            }
        }
        sellingPriceCents = bestPrice;
    }

    return (sellingPriceCents / 100).toFixed(2);
}
