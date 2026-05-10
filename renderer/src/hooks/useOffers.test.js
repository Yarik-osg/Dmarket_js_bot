import { describe, expect, it } from 'vitest';
import {
    collectOfferRuleKeyAliases,
    getOfferId,
    getOfferRuleId,
    getOfferTitle
} from './useOffers.js';

describe('offer id helpers', () => {
    it('uses offer id for DMarket API calls', () => {
        expect(
            getOfferId({
                itemId: 'asset-1',
                offerId: 'offer-1',
                extra: { offerId: 'extra-offer-1' }
            })
        ).toBe('extra-offer-1');

        expect(getOfferId({ itemId: 'asset-1', offerId: 'offer-1' })).toBe('asset-1');
        expect(getOfferId({ offerId: 'offer-1' })).toBe('offer-1');
        expect(getOfferId({ instantOfferId: 'instant-offer-1' })).toBe('instant-offer-1');
        expect(getOfferId({ id: 'offer-by-id', assetId: 'asset-1' })).toBe('offer-by-id');
    });

    it('uses stable item or asset id for local SQLite rules', () => {
        expect(
            getOfferRuleId({
                itemId: 'asset-1',
                extra: { offerId: 'offer-1', assetId: 'extra-asset-1' }
            })
        ).toBe('asset-1');

        expect(
            getOfferRuleId({
                extra: { offerId: 'offer-1', assetId: 'extra-asset-1' }
            })
        ).toBe('extra-asset-1');

        expect(getOfferRuleId({ assetId: 'asset-2', offerId: 'offer-2' })).toBe('asset-2');
        expect(getOfferRuleId({ offerId: 'offer-2' })).toBe('offer-2');
    });

    it('collects offer id and asset id for batchUpdate slim payloads', () => {
        const aliases = collectOfferRuleKeyAliases({
            id: '8523e414-2483-4669-9254-0d166d49667d',
            assetId: 'beb46bee-ba6a-5994-8e56-81e73fb06dc0'
        });
        expect(aliases.has('8523e414-2483-4669-9254-0d166d49667d')).toBe(true);
        expect(aliases.has('beb46bee-ba6a-5994-8e56-81e73fb06dc0')).toBe(true);
    });

    it('uses a readable offer title fallback order', () => {
        expect(getOfferTitle({ title: 'Title' })).toBe('Title');
        expect(getOfferTitle({ extra: { name: 'Extra Name' } })).toBe('Extra Name');
        expect(getOfferTitle({ attributes: { title: 'Attribute Title' } })).toBe('Attribute Title');
        expect(getOfferTitle({}, 'Fallback')).toBe('Fallback');
    });

    it('handles missing offer objects without throwing', () => {
        expect(getOfferId(null)).toBeUndefined();
        expect(getOfferRuleId(undefined)).toBeUndefined();
        expect(getOfferTitle(null, 'Fallback')).toBe('Fallback');
    });
});
