import React from 'react';
import { RiCheckLine } from 'react-icons/ri';

export function MinPriceEditor({
    itemId,
    pendingMinPrices,
    minPrices,
    offerMinPrice,
    onPendingChange,
    onApply,
    disabled
}) {
    const value =
        pendingMinPrices[itemId] !== undefined
            ? pendingMinPrices[itemId]
            : minPrices[itemId] || offerMinPrice || '';

    return (
        <div className="min-price-editor-wrap">
            <input
                type="number"
                step="0.01"
                min="0.01"
                value={value}
                onChange={(e) => onPendingChange(itemId, e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && pendingMinPrices[itemId] !== undefined) {
                        onApply(itemId);
                    }
                }}
                className="min-price-input"
                placeholder="Мін. ціна"
                aria-label="Мінімальна ціна"
            />
            {pendingMinPrices[itemId] !== undefined && (
                <button
                    type="button"
                    onClick={() => onApply(itemId)}
                    className="btn-icon"
                    title="Застосувати мінімальну ціну"
                    disabled={disabled}
                >
                    <RiCheckLine />
                </button>
            )}
        </div>
    );
}
