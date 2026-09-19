import { describe, expect, it } from 'vitest';
import { offerPriceUsdToGrossDollars, sumOffersNetUsd } from './offerListingPrice.js';

describe('offer listing prices', () => {
    it('treats v2 priceCents as the gross listing price', () => {
        expect(offerPriceUsdToGrossDollars('3000')).toBe(30);
    });

    it('subtracts the estimated fee when summing net proceeds', () => {
        expect(
            sumOffersNetUsd([
                {
                    type: 'offer',
                    price: { USD: '3000' }
                }
            ])
        ).toBe(29.4);
    });
});
