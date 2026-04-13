import React from 'react';
import { RiCheckLine } from 'react-icons/ri';

export function QuantityEditor({
    targetId,
    amount,
    pendingAmounts,
    onPendingChange,
    onApply,
    onBlurDiscard,
    disabled,
    applyTitle
}) {
    const pendingRaw = pendingAmounts[targetId];
    const hasPending = pendingRaw !== undefined;
    const pendingNum =
        hasPending && pendingRaw !== '' ? parseInt(String(pendingRaw), 10) : NaN;
    const canApply =
        hasPending && !Number.isNaN(pendingNum) && pendingNum >= 1 && pendingNum !== amount;

    return (
        <div className="quantity-editor-wrap">
            <input
                type="number"
                min="1"
                value={hasPending ? pendingRaw : amount}
                className="quantity-input"
                onChange={(e) => onPendingChange(targetId, e.target.value)}
                onBlur={(e) => onBlurDiscard(targetId, e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && canApply) {
                        e.preventDefault();
                        onApply(targetId);
                    }
                }}
                aria-label={applyTitle}
            />
            {canApply ? (
                <button
                    type="button"
                    onClick={() => onApply(targetId)}
                    className="btn-icon"
                    title={applyTitle}
                    disabled={disabled}
                >
                    <RiCheckLine />
                </button>
            ) : null}
        </div>
    );
}
