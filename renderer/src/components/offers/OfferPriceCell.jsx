import React from 'react';
import { calculatePriceWithFee, getFeePercentage } from '../../utils/offerFees.js';
import { formatUsdFromApiCents } from '../../utils/formatUsd.js';

export function OfferPriceCell({ offer }) {
    const price = offer.price?.USD || 'N/A';
    const formattedPrice = formatUsdFromApiCents(price);
    const priceWithFee =
        formattedPrice !== 'N/A' ? calculatePriceWithFee(offer, formattedPrice) : 'N/A';
    const feePercentage =
        formattedPrice !== 'N/A' ? getFeePercentage(offer, formattedPrice) : null;

    return (
        <div className="offer-price-cell">
            <div className="offer-price-main">
                ${formattedPrice} <span className="offer-price-label">(без комісії)</span>
            </div>
            {priceWithFee !== 'N/A' && (
                <div className="offer-price-after-fee">
                    ${priceWithFee}{' '}
                    <span className="offer-fee-percentage">({feePercentage}%)</span>
                </div>
            )}
        </div>
    );
}
