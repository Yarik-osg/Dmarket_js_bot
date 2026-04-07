import React from 'react';

function getFloatRangeDataFromValue(floatValue) {
    if (!floatValue || floatValue === 'N/A') return null;

    const value = parseFloat(floatValue);
    if (isNaN(value)) return null;

    let category = '';
    let color = '';
    let min = 0;
    let max = 1;

    if (value < 0.07) {
        category = 'Factory New';
        color = '#10b981';
        min = 0;
        max = 0.07;
    } else if (value < 0.15) {
        category = 'Minimal Wear';
        color = '#3b82f6';
        min = 0.07;
        max = 0.15;
    } else if (value < 0.38) {
        category = 'Field-Tested';
        color = '#f59e0b';
        min = 0.15;
        max = 0.38;
    } else if (value < 0.45) {
        category = 'Well-Worn';
        color = '#ff9800';
        min = 0.38;
        max = 0.45;
    } else {
        category = 'Battle-Scarred';
        color = '#ef4444';
        min = 0.45;
        max = 1.0;
    }

    return { min, max, value, category, color };
}

export function OfferFloatCell({ floatValue }) {
    const floatData = getFloatRangeDataFromValue(floatValue);
    if (!floatData) return <span className="offer-float-plain">{floatValue}</span>;

    const pct = ((floatData.value - floatData.min) / (floatData.max - floatData.min)) * 100;

    return (
        <div
            className="float-progress-container"
            title={`Float: ${floatValue} — ${floatData.min.toFixed(2)}-${floatData.max.toFixed(2)} (${floatData.category})`}
        >
            <div className="float-progress-labels">
                <span className="float-min">{floatData.min.toFixed(2)}</span>
                <span className="float-value">{floatValue}</span>
                <span className="float-max">{floatData.max.toFixed(2)}</span>
            </div>
            <div className="float-progress-bar">
                <div
                    className="float-progress-fill"
                    style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${floatData.color}, ${floatData.color}dd)`
                    }}
                />
            </div>
            <span className="float-category">{floatData.category}</span>
        </div>
    );
}
