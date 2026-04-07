export function calculateMedian(numbers) {
    if (numbers.length === 0) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

export function detectOutliers(prices) {
    if (prices.length < 4) {
        return { cleanPrices: prices, outliers: [], cleanIndices: prices.map((_, i) => i) };
    }

    const sorted = [...prices].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const cleanPrices = [];
    const outliers = [];
    const cleanIndices = [];
    for (let i = 0; i < prices.length; i++) {
        if (prices[i] >= lowerBound && prices[i] <= upperBound) {
            cleanPrices.push(prices[i]);
            cleanIndices.push(i);
        } else {
            outliers.push(prices[i]);
        }
    }

    return { cleanPrices, outliers, cleanIndices };
}

export function detectPriceSpike(prices) {
    if (prices.length < 5) return { hasSpike: false, spikePercent: 0 };

    const median = calculateMedian(prices);
    let maxDeviation = 0;

    for (const price of prices) {
        const deviation = ((price - median) / median) * 100;
        if (Math.abs(deviation) > Math.abs(maxDeviation)) {
            maxDeviation = deviation;
        }
    }

    return { hasSpike: Math.abs(maxDeviation) > 50, spikePercent: maxDeviation };
}

export function analyzePriceStability(recentPrices, olderPrices) {
    if (recentPrices.length < 3 || olderPrices.length < 3) {
        return { isStabilizing: false, stabilityScore: 0, olderCV: 0, recentCV: 0 };
    }

    const cv = (prices) => {
        const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
        const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
        return (Math.sqrt(variance) / mean) * 100;
    };

    const olderCV = cv(olderPrices);
    const recentCV = cv(recentPrices);

    return {
        isStabilizing: recentCV < olderCV,
        stabilityScore: Math.max(0, 100 - recentCV),
        olderCV,
        recentCV,
    };
}
