import React from 'react';

export function QuantityEditor({
    targetId,
    amount,
    pendingAmounts,
    onPendingChange,
    onBlurCommit
}) {
    return (
        <input
            type="number"
            min="1"
            value={pendingAmounts[targetId] !== undefined ? pendingAmounts[targetId] : amount}
            className="quantity-input"
            onChange={(e) => onPendingChange(targetId, e.target.value)}
            onBlur={(e) => onBlurCommit(targetId, e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.target.blur();
                }
            }}
        />
    );
}
