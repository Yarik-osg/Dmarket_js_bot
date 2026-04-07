import React from 'react';

export function MarketPriceCell({
    loadingMarketPrices,
    marketPrice,
    formattedOurPrice
}) {
    if (loadingMarketPrices) return '...';
    if (!marketPrice || marketPrice === 'N/A') return 'N/A';

    const ourPrice = parseFloat(formattedOurPrice);
    const marketPriceNum = parseFloat(String(marketPrice).replace('$', ''));
    const diff = ourPrice - marketPriceNum;
    const diffPercent = marketPriceNum > 0 ? ((diff / marketPriceNum) * 100).toFixed(1) : 0;
    const isHigher = diff > 0;

    return (
        <span
            className="price-cell"
            title={`Ринкова ціна: ${marketPrice}\nВаша ціна: $${formattedOurPrice}\nРізниця: ${isHigher ? '+' : ''}$${diff.toFixed(2)} (${isHigher ? '+' : ''}${diffPercent}%)`}
            style={{
                color: isHigher ? '#ef4444' : '#10b981',
                cursor: 'help'
            }}
        >
            {marketPrice}
            {Math.abs(diff) > 0.01 && (
                <span style={{ fontSize: '10px', marginLeft: '4px' }}>
                    ({isHigher ? '+' : ''}
                    {diffPercent}%)
                </span>
            )}
        </span>
    );
}
