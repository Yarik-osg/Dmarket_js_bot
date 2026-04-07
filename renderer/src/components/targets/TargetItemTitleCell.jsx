import React, { useState } from 'react';
import { SkinThumbWithHoverPreview } from '../SkinThumbWithHoverPreview.jsx';
import { DMarketProductLinkButton } from '../DMarketProductLinkButton.jsx';

function getTargetImageUrl(target) {
    return (
        target?.image ||
        target?.Image ||
        target?.extra?.image ||
        target?.thumbnail ||
        null
    );
}

export function TargetItemTitleCell({
    target,
    title,
    status,
    floatPartValue,
    floatRange,
    phase,
    paintSeed
}) {
    const [imgFailed, setImgFailed] = useState(false);
    const imageUrl = getTargetImageUrl(target);
    const showImg = Boolean(imageUrl) && !imgFailed;

    return (
        <div className="target-item">
            {showImg ? (
                <SkinThumbWithHoverPreview
                    src={imageUrl}
                    alt=""
                    thumbClassName="target-item-thumb"
                    loading="lazy"
                    onError={() => setImgFailed(true)}
                />
            ) : null}
            <div className="target-item-inner">
                <span
                    className={
                        status === 'active' ? 'active-target-status' : 'inactive-target-status'
                    }
                >
                    {status}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div className="target-item-title-row">
                        <span className="target-item-title-text" title={title}>
                            {title}
                        </span>
                        <DMarketProductLinkButton item={target} className="target-item-dmarket-btn" />
                    </div>
                    {(floatPartValue !== 'N/A' || phase || (paintSeed && paintSeed !== 0)) && (
                        <div
                            style={{
                                fontSize: '11px',
                                color: '#888',
                                display: 'flex',
                                flexDirection: 'row',
                                gap: '10px',
                                flexWrap: 'wrap'
                            }}
                        >
                            {floatPartValue !== 'N/A' && (
                                <span>
                                    Float: {floatPartValue}{' '}
                                    {floatRange !== floatPartValue && `(${floatRange})`}
                                </span>
                            )}
                            {phase && <span>Phase: {phase}</span>}
                            {paintSeed && paintSeed !== 0 && <span>Paint Seed: {paintSeed}</span>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
