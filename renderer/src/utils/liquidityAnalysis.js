import {
    calculateMedian,
    detectOutliers,
    detectPriceSpike,
    analyzePriceStability,
} from './liquidityMetrics.js';
import { FLOAT_PART_TO_RANGE } from './csFloatRanges.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DMARKET_FEE_PERCENT = 2;

const _parsedRangeCache = {};
function parsedRange(token) {
    if (_parsedRangeCache[token]) return _parsedRangeCache[token];
    const str = FLOAT_PART_TO_RANGE[token];
    if (!str) return null;
    const [min, max] = str.split('-').map(Number);
    const r = { min, max };
    _parsedRangeCache[token] = r;
    return r;
}

export function getFloatRangeFromTokens(selectedFloats) {
    if (!selectedFloats?.length) return null;
    let lo = 1, hi = 0;
    for (const token of selectedFloats) {
        const r = parsedRange(token);
        if (!r) continue;
        if (r.min < lo) lo = r.min;
        if (r.max > hi) hi = r.max;
    }
    return hi > 0 ? { floatFrom: lo, floatTo: hi } : null;
}

export function buildTreeFilters({ categories, qualities, exteriors, statTrak, selectedFloats }) {
    const filters = [];

    categories.forEach(cat => {
        filters.push(`categoryPath[]=${cat === 'sniper' ? 'sniper rifle' : cat}`);
    });
    qualities.forEach(q => filters.push(`quality[]=${q}`));
    exteriors.forEach(ext => {
        const val = ext === 'factory-new' ? 'factory new'
            : ext === 'minimal-wear' ? 'minimal wear' : ext;
        filters.push(`exterior[]=${val}`);
    });
    statTrak.forEach(s => filters.push(`category_0[]=${s}`));

    const range = getFloatRangeFromTokens(selectedFloats);
    if (range) {
        filters.push(`floatValueFrom[]=${range.floatFrom}`);
        filters.push(`floatValueTo[]=${range.floatTo}`);
    }

    return filters.join(',');
}

export function filterSalesClientSide(sales, { exteriors, selectedFloats }) {
    if (exteriors.length === 0 && (!selectedFloats || selectedFloats.length === 0)) return sales;

    const tokenRanges = (selectedFloats || []).map(t => parsedRange(t)).filter(Boolean);

    return sales.filter(sale => {
        const attrs = sale.offerAttributes || sale.orderAttributes || {};

        if (exteriors.length > 0) {
            const ext = (attrs.exterior || '').toLowerCase().replace(/\s+/g, '-');
            if (!exteriors.some(e => ext.includes(e.toLowerCase()) || e.toLowerCase().includes(ext))) {
                return false;
            }
        }

        if (tokenRanges.length > 0) {
            const fv = attrs.floatValue ?? attrs.float;
            if (fv !== undefined) {
                const f = parseFloat(fv);
                if (!tokenRanges.some(r => f >= r.min && f <= r.max)) return false;
            }
        }

        return true;
    });
}

function computeTransactionTypes(sales) {
    const offerSales = sales.filter(s => s.txOperationType === 'Offer');
    const targetSales = sales.filter(s => s.txOperationType === 'Target');
    const total = sales.length;

    const offerPrices = offerSales.map(s => parseFloat(s.price || 0));
    const targetPrices = targetSales.map(s => parseFloat(s.price || 0));

    const offerMedianPrice = offerPrices.length > 0 ? calculateMedian(offerPrices) : 0;
    const targetMedianPrice = targetPrices.length > 0 ? calculateMedian(targetPrices) : 0;

    let priceSpread = 0;
    let priceSpreadPercent = 0;
    if (offerMedianPrice > 0 && targetMedianPrice > 0) {
        priceSpread = offerMedianPrice - targetMedianPrice;
        priceSpreadPercent = (priceSpread / offerMedianPrice) * 100;
    }

    const offerRatio = total > 0 ? (offerSales.length / total) * 100 : 0;
    const targetRatio = total > 0 ? (targetSales.length / total) * 100 : 0;
    let txDominance = 'balanced';
    if (offerRatio > 70) txDominance = 'offer-heavy';
    else if (targetRatio > 70) txDominance = 'target-heavy';

    return {
        offerCount: offerSales.length,
        targetCount: targetSales.length,
        offerRatio,
        targetRatio,
        offerAvgPrice: offerPrices.length > 0
            ? offerPrices.reduce((a, b) => a + b, 0) / offerPrices.length : 0,
        targetAvgPrice: targetPrices.length > 0
            ? targetPrices.reduce((a, b) => a + b, 0) / targetPrices.length : 0,
        offerMedianPrice,
        targetMedianPrice,
        minOfferPrice: offerPrices.length > 0 ? Math.min(...offerPrices) : 0,
        maxOfferPrice: offerPrices.length > 0 ? Math.max(...offerPrices) : 0,
        minTargetPrice: targetPrices.length > 0 ? Math.min(...targetPrices) : 0,
        maxTargetPrice: targetPrices.length > 0 ? Math.max(...targetPrices) : 0,
        priceSpread,
        priceSpreadPercent,
        txDominance,
    };
}

function computeLiquidity(relevantSales, recentWeekSales, marketCount) {
    const now = Date.now();
    let salesFrequency = 0;
    let daysSinceLastSale = 999;

    if (relevantSales.length > 0) {
        const sorted = [...relevantSales].sort((a, b) => parseInt(a.date) - parseInt(b.date));
        const firstDate = parseInt(sorted[0].date) * 1000;
        const lastDate = parseInt(sorted[sorted.length - 1].date) * 1000;
        const span = (lastDate - firstDate) / DAY_MS;
        salesFrequency = span > 0 ? relevantSales.length / span : relevantSales.length;
        daysSinceLastSale = (now - lastDate) / DAY_MS;
    }

    const baseScore = (recentWeekSales.length * 15) + (relevantSales.length * 2) + (marketCount > 0 ? 5 : 0);
    const frequencyBonus = Math.min(salesFrequency * 5, 50);
    const recencyPenalty = daysSinceLastSale > 7 ? Math.min(daysSinceLastSale * 2, 100) : 0;
    const liquidityScore = Math.max(0, Math.round(baseScore + frequencyBonus - recencyPenalty));

    return { salesFrequency, daysSinceLastSale, liquidityScore };
}

function computeRiskScore({ priceVolatility, salesFrequency, marketCount, daysSinceLastSale, hasSpike, spikePercent, isStabilizing }) {
    let volatilityRisk;
    if (priceVolatility > 100) volatilityRisk = 50;
    else if (priceVolatility > 50) volatilityRisk = 35 + ((priceVolatility - 50) / 50) * 15;
    else volatilityRisk = (priceVolatility / 50) * 35;

    const liquidityRisk = salesFrequency < 1 ? 25 : Math.max(0, 25 - salesFrequency * 2.5);
    const competitionRisk = marketCount > 50 ? 15 : marketCount > 20 ? 10 : marketCount > 10 ? 5 : 0;
    const recencyRisk = daysSinceLastSale > 14 ? 10 : daysSinceLastSale > 7 ? 5 : 0;
    const stabilizationBonus = isStabilizing && hasSpike ? -10 : 0;
    const spikeRisk = hasSpike ? Math.min(Math.abs(spikePercent) / 5, 15) : 0;

    return Math.min(100, Math.max(0,
        volatilityRisk + liquidityRisk + competitionRisk + recencyRisk + spikeRisk + stabilizationBonus
    ));
}

/** spreadPctForOpportunity: live (offer−target)/offer %, or weaker % from sales medians */
function computeOpportunityScore({
    roiPercent, liquidityScore, riskScore, spreadPctForOpportunity,
    priceVolatility, priceTrend, recentTrend, hasSpike, isStabilizing, stabilityScore, daysSinceLastSale,
}) {
    const liquidityComponent = Math.min((liquidityScore / 250) * 38, 38);
    const spreadComponent = Math.min(Math.max(0, spreadPctForOpportunity) / 25 * 33, 33);
    const roiComponent = Math.min(roiPercent * 1.2, 14);
    const riskComponent = Math.max(0, 15 - riskScore * 0.15);
    let score = liquidityComponent + spreadComponent + roiComponent + riskComponent;

    if (priceVolatility > 50) score -= Math.min((priceVolatility - 50) * 0.2, 12);
    if (priceTrend < -10) score -= Math.min(Math.abs(priceTrend) * 0.35, 10);
    if (recentTrend < -5) score -= Math.min(Math.abs(recentTrend) * 0.5, 10);
    if (hasSpike) score -= 6;

    if (isStabilizing && stabilityScore > 70) score += 8;
    else if (isStabilizing) score += 4;
    if (priceTrend > 5) score += 4;
    if (daysSinceLastSale < 1) score += 4;

    return Math.round(Math.max(0, Math.min(100, score)));
}

function computePriceTrend(relevantSales, recentWeekSales) {
    let priceTrend = 0;
    let recentTrend = 0;

    if (relevantSales.length >= 6) {
        const sorted = [...relevantSales].sort((a, b) => parseInt(a.date) - parseInt(b.date));
        const half = Math.floor(sorted.length / 2);
        const olderHalf = sorted.slice(0, half);
        const recentHalf = sorted.slice(half);

        const olderAvg = olderHalf.reduce((s, x) => s + parseFloat(x.price || 0), 0) / olderHalf.length;
        const recentAvg = recentHalf.reduce((s, x) => s + parseFloat(x.price || 0), 0) / recentHalf.length;
        if (olderAvg > 0) priceTrend = ((recentAvg - olderAvg) / olderAvg) * 100;

        if (recentWeekSales.length >= 3) {
            const weekSorted = [...recentWeekSales].sort((a, b) => parseInt(a.date) - parseInt(b.date));
            const weekHalf = Math.floor(weekSorted.length / 2);
            const firstP = weekSorted.slice(0, weekHalf).map(s => parseFloat(s.price || 0));
            const lastP = weekSorted.slice(weekHalf).map(s => parseFloat(s.price || 0));
            const firstAvg = firstP.reduce((a, b) => a + b, 0) / firstP.length;
            const lastAvg = lastP.reduce((a, b) => a + b, 0) / lastP.length;
            if (firstAvg > 0) recentTrend = ((lastAvg - firstAvg) / firstAvg) * 100;
        }
    }

    return { priceTrend, recentTrend };
}

/**
 * Analyse a single item given its market group data and sales history.
 * @param {object} itemGroup - grouped market item { title, count, minPrice, maxPrice, totalPrice, items }
 * @param {Array}  sales     - pre-filtered sales array
 * @param {object} opts      - { feePercent }
 * @returns {object} analysis result
 */
export function analyzeItem(itemGroup, sales, opts = {}) {
    const feePercent = opts.feePercent ?? DMARKET_FEE_PERCENT;
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * DAY_MS;
    const sevenDaysAgo = now - 7 * DAY_MS;

    const sampleListing = itemGroup.items?.[0];
    const dmarketItem = {
        title: itemGroup.title,
        gameId: sampleListing?.gameId || sampleListing?.extra?.gameId || 'a8db',
        slug: sampleListing?.slug || sampleListing?.extra?.slug,
        extra: sampleListing?.extra,
        attributes: sampleListing?.attributes,
    };

    const txTypes = computeTransactionTypes(sales);

    const recentMonthSales = sales.filter(s => parseInt(s.date) * 1000 >= thirtyDaysAgo);
    const recentWeekSales = sales.filter(s => parseInt(s.date) * 1000 >= sevenDaysAgo);
    const relevantSales = recentMonthSales.length > 0 ? recentMonthSales : sales;

    const allPrices = relevantSales.map(s => parseFloat(s.price || 0));
    const { cleanPrices, outliers, cleanIndices } = detectOutliers(allPrices);
    const { hasSpike, spikePercent } = detectPriceSpike(allPrices);

    const medianSalePrice = calculateMedian(cleanPrices);
    const arithmeticAvg = cleanPrices.length > 0
        ? cleanPrices.reduce((a, b) => a + b, 0) / cleanPrices.length : 0;

    const { salesFrequency, daysSinceLastSale, liquidityScore } =
        computeLiquidity(relevantSales, recentWeekSales, itemGroup.count);

    const netSalePrice = medianSalePrice * (1 - feePercent / 100);
    const profitMargin = netSalePrice > 0 ? netSalePrice - itemGroup.minPrice : 0;
    const roiPercent = itemGroup.minPrice > 0 && netSalePrice > 0
        ? ((netSalePrice - itemGroup.minPrice) / itemGroup.minPrice) * 100 : 0;

    let priceVolatility = 0;
    let avgPriceVariance = 0;
    let maxSalePrice = 0;
    let minSalePrice = 0;
    let priceP25 = 0;
    let priceP75 = 0;
    if (cleanPrices.length > 0) {
        const sortedClean = [...cleanPrices].sort((a, b) => a - b);
        minSalePrice = sortedClean[0];
        maxSalePrice = sortedClean[sortedClean.length - 1];
        priceP25 = sortedClean[Math.floor(sortedClean.length * 0.25)];
        priceP75 = sortedClean[Math.floor(sortedClean.length * 0.75)];
        priceVolatility = maxSalePrice > 0 ? ((maxSalePrice - minSalePrice) / medianSalePrice) * 100 : 0;
        const variance = cleanPrices.reduce((sum, p) => sum + Math.abs(p - medianSalePrice), 0) / cleanPrices.length;
        avgPriceVariance = (variance / medianSalePrice) * 100;
    }

    const cleanSalesByDate = cleanIndices
        .map(i => relevantSales[i])
        .sort((a, b) => parseInt(a.date) - parseInt(b.date));
    const mid = Math.floor(cleanSalesByDate.length / 2);
    const olderPrices = cleanSalesByDate.slice(0, mid).map(s => parseFloat(s.price));
    const recentPrices = cleanSalesByDate.slice(mid).map(s => parseFloat(s.price));
    const { isStabilizing, stabilityScore } = analyzePriceStability(recentPrices, olderPrices);

    const riskScore = computeRiskScore({
        priceVolatility, salesFrequency, marketCount: itemGroup.count,
        daysSinceLastSale, hasSpike, spikePercent, isStabilizing,
    });

    const { priceTrend, recentTrend } = computePriceTrend(relevantSales, recentWeekSales);

    const competitionLevel = itemGroup.count > 100 ? 'Дуже висока'
        : itemGroup.count > 50 ? 'Висока'
        : itemGroup.count > 20 ? 'Середня'
        : itemGroup.count > 10 ? 'Низька' : 'Дуже низька';

    const currentMinOffer = opts.currentMinOffer || itemGroup.minPrice;
    const currentMaxTarget = opts.currentMaxTarget || 0;
    // Spread only when ask ≥ bid; otherwise min listing and max buy order refer to different market slices (e.g. wear) and a dollar spread is misleading.
    const currentSpread = (currentMinOffer > 0 && currentMaxTarget > 0 && currentMinOffer >= currentMaxTarget)
        ? currentMinOffer - currentMaxTarget
        : null;

    let spreadPctForOpportunity = 0;
    if (currentSpread != null && currentMinOffer > 0) {
        spreadPctForOpportunity = (currentSpread / currentMinOffer) * 100;
    } else if (txTypes.priceSpreadPercent > 0) {
        spreadPctForOpportunity = Math.min(txTypes.priceSpreadPercent, 15) * 0.5;
    }

    const opportunityScore = computeOpportunityScore({
        roiPercent, liquidityScore, riskScore, spreadPctForOpportunity, priceVolatility,
        priceTrend, recentTrend, hasSpike, isStabilizing, stabilityScore, daysSinceLastSale,
    });

    const breakEvenPrice = itemGroup.minPrice > 0 ? itemGroup.minPrice / (1 - feePercent / 100) : 0;
    const timeToSell = salesFrequency > 0 && itemGroup.count > 0
        ? itemGroup.count / salesFrequency : null;

    return {
        title: itemGroup.title,
        marketCount: itemGroup.count,
        minPrice: itemGroup.minPrice,
        maxPrice: itemGroup.maxPrice,
        avgMarketPrice: itemGroup.totalPrice / itemGroup.count,
        medianSalePrice,
        arithmeticAvgPrice: arithmeticAvg,
        salesCount: relevantSales.length,
        recentSalesCount: recentWeekSales.length,
        salesFrequency,
        daysSinceLastSale,
        liquidityScore,
        profitMargin,
        roiPercent,
        priceVolatility,
        avgPriceVariance,
        riskScore,
        priceTrend,
        recentTrend,
        competitionLevel,
        opportunityScore,
        minSalePrice,
        maxSalePrice,
        priceP25,
        priceP75,
        breakEvenPrice,
        timeToSell,
        currentMinOffer,
        currentMaxTarget,
        currentSpread,
        hasSpike,
        spikePercent,
        isStabilizing,
        stabilityScore,
        outliersCount: outliers.length,
        cleanPricesCount: cleanPrices.length,
        volatilityWarning: priceVolatility > 50,
        trendWarning: priceTrend < -5 || recentTrend < -5,
        ...txTypes,
        dmarketItem,
    };
}

/** Fallback result when sales history fetch fails */
export function errorItemResult(itemGroup) {
    const sampleListing = itemGroup.items?.[0];
    return {
        title: itemGroup.title,
        marketCount: itemGroup.count,
        minPrice: itemGroup.minPrice,
        maxPrice: itemGroup.maxPrice,
        avgMarketPrice: itemGroup.totalPrice / itemGroup.count,
        medianSalePrice: 0, arithmeticAvgPrice: 0,
        salesCount: 0, recentSalesCount: 0, salesFrequency: 0,
        daysSinceLastSale: 999,
        liquidityScore: itemGroup.count > 0 ? 5 : 0,
        profitMargin: 0, roiPercent: 0, priceVolatility: 0, avgPriceVariance: 0,
        riskScore: 100, priceTrend: 0, recentTrend: 0,
        competitionLevel: 'Невідомо', opportunityScore: 0,
        minSalePrice: 0, maxSalePrice: 0, priceP25: 0, priceP75: 0,
        breakEvenPrice: 0, timeToSell: null,
        currentMinOffer: itemGroup.minPrice, currentMaxTarget: 0, currentSpread: null,
        hasSpike: false, spikePercent: 0, isStabilizing: false, stabilityScore: 0,
        outliersCount: 0, cleanPricesCount: 0,
        volatilityWarning: false, trendWarning: false,
        offerCount: 0, targetCount: 0, offerRatio: 0, targetRatio: 0,
        offerAvgPrice: 0, targetAvgPrice: 0,
        offerMedianPrice: 0, targetMedianPrice: 0,
        minOfferPrice: 0, maxOfferPrice: 0, minTargetPrice: 0, maxTargetPrice: 0,
        priceSpread: 0, priceSpreadPercent: 0, txDominance: 'balanced',
        error: true,
        dmarketItem: {
            title: itemGroup.title,
            gameId: sampleListing?.gameId || sampleListing?.extra?.gameId || 'a8db',
            slug: sampleListing?.slug || sampleListing?.extra?.slug,
            extra: sampleListing?.extra,
            attributes: sampleListing?.attributes,
        },
    };
}
