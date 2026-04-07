import React from 'react';
import { RiCheckLine } from 'react-icons/ri';

export function MaxPriceEditor({
    itemId,
    pendingMaxPrices,
    maxPrices,
    targetMaxPrice,
    onPendingChange,
    onApply,
    disabled
}) {
    const value =
        pendingMaxPrices[itemId] !== undefined
            ? pendingMaxPrices[itemId]
            : maxPrices[itemId] || targetMaxPrice || '';

    return (
        <div className="max-price-editor-wrap">
            <input
                type="number"
                step="0.01"
                min="0.01"
                value={value}
                onChange={(e) => onPendingChange(itemId, e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && pendingMaxPrices[itemId] !== undefined) {
                        e.preventDefault();
                        onApply(itemId);
                    }
                }}
                className="max-price-input"
                placeholder="Макс. ціна"
                aria-label="Максимальна ціна"
            />
            {pendingMaxPrices[itemId] !== undefined && (
                <button
                    type="button"
                    onClick={() => onApply(itemId)}
                    className="btn-icon"
                    title="Застосувати максимальну ціну"
                    disabled={disabled}
                >
                    <RiCheckLine />
                </button>
            )}
        </div>
    );
}
