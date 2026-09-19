import React from 'react';
import { calculateYouGet, getFeePercentage } from '../../utils/offerFees.js';
import { formatUsdFromApiCents } from '../../utils/formatUsd.js';

export function OfferPriceCell({ offer }) {
    const price = offer.price?.USD || 'N/A';
    const formattedPrice = formatUsdFromApiCents(price);
    const priceAfterFee =
        formattedPrice !== 'N/A' ? calculateYouGet(offer, formattedPrice) : 'N/A';
    const feePercentage =
        formattedPrice !== 'N/A' ? getFeePercentage(offer, formattedPrice) : null;

    return (
        <div className="offer-price-cell">
            <div className="offer-price-main">
                ${formattedPrice} <span className="offer-price-label">(ціна продажу)</span>
            </div>
            {priceAfterFee !== 'N/A' && (
                <div className="offer-price-after-fee">
                    ${priceAfterFee}{' '}
                    <span className="offer-fee-percentage">(отримаєте, −{feePercentage}%)</span>
                </div>
            )}
        </div>
    );
}
