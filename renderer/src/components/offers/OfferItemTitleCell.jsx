import React, { useState } from 'react';
import { SkinThumbWithHoverPreview } from '../SkinThumbWithHoverPreview.jsx';

function getOfferImageUrl(offer) {
    return offer?.image || offer?.Image || offer?.extra?.image || offer?.thumbnail || null;
}

export function OfferItemTitleCell({ offer, title }) {
    const [imgFailed, setImgFailed] = useState(false);
    const imageUrl = getOfferImageUrl(offer);
    const showImg = Boolean(imageUrl) && !imgFailed;

    return (
        <div className="offer-item-scroll-wrapper">
            <div className="offer-item">
                {showImg ? (
                    <SkinThumbWithHoverPreview
                        src={imageUrl}
                        alt=""
                        thumbClassName="offer-item-thumb"
                        loading="lazy"
                        onError={() => setImgFailed(true)}
                    />
                ) : null}
                <div className="offer-item-title-row">
                    <span className="offer-item-title-text" title={title}>
                        {title}
                    </span>
                </div>
            </div>
        </div>
    );
}
