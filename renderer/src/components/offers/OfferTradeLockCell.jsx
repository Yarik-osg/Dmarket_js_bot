import React from 'react';

function formatTradeLockDuration(seconds) {
    if (!seconds || seconds <= 0) return null;

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}д ${hours}г`;
    if (hours > 0) return `${hours}г ${minutes}хв`;
    if (minutes > 0) return `${minutes}хв`;
    return `${seconds}с`;
}

export function OfferTradeLockCell({ offer }) {
    const tradeLockDuration = offer.extra?.tradeLockDuration;
    const tradable = offer.extra?.tradable;
    const tradeLock = offer.extra?.tradeLock;

    const hasTradeBan = tradeLockDuration && tradeLockDuration > 0;
    const isNotTradable = tradable === false;

    if (hasTradeBan || isNotTradable) {
        const formatted = tradeLockDuration ? formatTradeLockDuration(tradeLockDuration) : null;
        return (
            <span
                className="offer-tradelock offer-tradelock--banned"
                title={
                    formatted
                        ? `Трейдбан: ${formatted}${tradeLock ? ` (Lock: ${tradeLock})` : ''}`
                        : 'Предмет не можна торгувати'
                }
            >
                {formatted || 'Немає'}
            </span>
        );
    }

    return <span className="offer-tradelock offer-tradelock--ok">Немає</span>;
}
