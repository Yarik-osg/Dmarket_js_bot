import { describe, expect, it } from 'vitest';
import { pruneOfferRulesForOffers } from './usePersistedOfferMinPrices.js';

describe('offer price rules pruning', () => {
    it('keeps rules only for currently loaded offer rule ids', () => {
        const result = pruneOfferRulesForOffers(
            {
                minPrices: {
                    'asset-1': '10',
                    'sold-asset': '20'
                },
                maxPrices: {
                    'asset-1': '15',
                    'sold-asset': '25'
                },
                skipForParsing: {
                    'asset-1': true,
                    'sold-asset': true
                }
            },
            [
                {
                    itemId: 'asset-1',
                    extra: { offerId: 'offer-1' }
                }
            ]
        );

        expect(result.changed).toBe(true);
        expect(result.minPrices).toEqual({ 'asset-1': '10' });
        expect(result.maxPrices).toEqual({ 'asset-1': '15' });
        expect(result.skipForParsing).toEqual({ 'asset-1': true });
    });

    it('can prune all rules when a confirmed refresh returns no offers', () => {
        const result = pruneOfferRulesForOffers(
            {
                minPrices: { 'asset-1': '10' },
                maxPrices: { 'asset-1': '15' },
                skipForParsing: { 'asset-1': true }
            },
            []
        );

        expect(result.changed).toBe(true);
        expect(result.minPrices).toEqual({});
        expect(result.maxPrices).toEqual({});
        expect(result.skipForParsing).toEqual({});
    });

    it('reports unchanged when all rules still match loaded offers', () => {
        const result = pruneOfferRulesForOffers(
            {
                minPrices: { 'asset-1': '10' },
                maxPrices: { 'asset-1': '15' },
                skipForParsing: { 'asset-1': true }
            },
            [{ itemId: 'asset-1' }]
        );

        expect(result.changed).toBe(false);
        expect(result.minPrices).toEqual({ 'asset-1': '10' });
        expect(result.maxPrices).toEqual({ 'asset-1': '15' });
        expect(result.skipForParsing).toEqual({ 'asset-1': true });
    });

    it('keeps rules keyed by offer id when GET returns slim { id, assetId }', () => {
        const oid = '8523e414-2483-4669-9254-0d166d49667d';
        const aid = 'beb46bee-ba6a-5994-8e56-81e73fb06dc0';
        const result = pruneOfferRulesForOffers(
            {
                minPrices: { [oid]: '1.5' },
                maxPrices: { [oid]: '9.99' },
                skipForParsing: { [aid]: true }
            },
            [{ id: oid, assetId: aid }]
        );

        expect(result.changed).toBe(false);
        expect(result.minPrices[oid]).toBe('1.5');
        expect(result.maxPrices[oid]).toBe('9.99');
        expect(result.skipForParsing[aid]).toBe(true);
    });
});
