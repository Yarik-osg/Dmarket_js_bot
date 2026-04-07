import React from 'react';
import { RiCheckLine, RiCloseLine } from 'react-icons/ri';

/** Порожні рядки та відсутнє значення вважаємо однаковими; числа порівнюємо як float. */
function boundValueEqual(pending, saved) {
    const p = pending === undefined || pending === null ? '' : String(pending).trim();
    const s = saved === undefined || saved === null ? '' : String(saved).trim();
    if (p === '' && s === '') return true;
    const np = parseFloat(p.replace(',', '.'));
    const ns = parseFloat(s.replace(',', '.'));
    if (!Number.isNaN(np) && !Number.isNaN(ns)) return Math.abs(np - ns) < 0.0005;
    return p === s;
}

export function PriceBoundsEditor({
    itemId,
    pendingMinPrices,
    pendingMaxPrices,
    minPrices,
    maxPrices,
    offerMinPrice,
    onMinPendingChange,
    onMaxPendingChange,
    onApply,
    onCancel,
    disabled,
    minLabel,
    maxLabel,
    cancelTitle
}) {
    const minValue =
        pendingMinPrices[itemId] !== undefined
            ? pendingMinPrices[itemId]
            : minPrices[itemId] || offerMinPrice || '';

    const maxValue =
        pendingMaxPrices[itemId] !== undefined
            ? pendingMaxPrices[itemId]
            : maxPrices[itemId] ?? '';

    const savedMin = minPrices[itemId] ?? offerMinPrice ?? '';
    const savedMax = maxPrices[itemId] ?? '';

    const hasRawPending =
        pendingMinPrices[itemId] !== undefined || pendingMaxPrices[itemId] !== undefined;

    const minDirty =
        pendingMinPrices[itemId] !== undefined &&
        !boundValueEqual(pendingMinPrices[itemId], savedMin);
    const maxDirty =
        pendingMaxPrices[itemId] !== undefined &&
        !boundValueEqual(pendingMaxPrices[itemId], savedMax);

    const hasDirtyChanges = minDirty || maxDirty;

    return (
        <div className="price-bounds-editor-wrap">
            <div className="price-bounds-fields">
            <div className="price-bounds-editor-row">
                <label className="price-bounds-label">{minLabel}</label>
                <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={minValue}
                    onChange={(e) => onMinPendingChange(itemId, e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && hasDirtyChanges) onApply(itemId);
                    }}
                    className="min-price-input price-bounds-input"
                    placeholder="—"
                    aria-label={minLabel}
                />
            </div>
            <div className="price-bounds-editor-row">
                <label className="price-bounds-label">{maxLabel}</label>
                <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={maxValue}
                    onChange={(e) => onMaxPendingChange(itemId, e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && hasDirtyChanges) onApply(itemId);
                    }}
                    className="min-price-input price-bounds-input"
                    placeholder="—"
                    aria-label={maxLabel}
                />
            </div>
            </div>
            {(hasDirtyChanges || hasRawPending) && (
                <div className="price-bounds-actions">
                    {hasDirtyChanges && (
                        <button
                            type="button"
                            onClick={() => onApply(itemId)}
                            className="btn-icon price-bounds-apply"
                            title="Застосувати діапазон цін"
                            disabled={disabled}
                        >
                            <RiCheckLine />
                        </button>
                    )}
                    {hasRawPending && (
                        <button
                            type="button"
                            onClick={() => onCancel(itemId)}
                            className="btn-icon price-bounds-cancel"
                            title={cancelTitle}
                            disabled={disabled}
                        >
                            <RiCloseLine />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
