import { describe, expect, it, vi } from 'vitest';
import { ApiService } from './apiService.js';

function createApiService(response) {
    const service = Object.create(ApiService.prototype);
    service.client = {
        call: vi.fn(async () => response)
    };
    return service;
}

describe('ApiService.updateOffer', () => {
    it('converts dollar amount to cents for v2 batch update', async () => {
        const response = { offers: [{ offerId: 'offer-1' }], failed: [] };
        const service = createApiService(response);

        await expect(
            service.updateOffer('offer-1', 'asset-1', {
                Price: { Amount: 12.34, Currency: 'USD' }
            })
        ).resolves.toBe(response);

        expect(service.client.call).toHaveBeenCalledWith(
            'POST',
            '/marketplace-api/v2/offers:batchUpdate',
            {
                requests: [{ offerId: 'offer-1', priceCents: 1234 }]
            }
        );
    });

    it('throws a structured error when DMarket returns failed offers', async () => {
        const response = {
            offers: [],
            failed: [
                {
                    offerId: 'offer-1',
                    code: 'AssetTimeLocked',
                    message: '12:19'
                }
            ]
        };
        const service = createApiService(response);

        await expect(service.updateOffer('offer-1', 'asset-1', { priceCents: 1234 }))
            .rejects
            .toMatchObject({
                message: '12:19',
                errorCode: 'AssetTimeLocked',
                result: response.failed[0],
                response
            });
    });

    it('uses the matching failed offer when batch response contains multiple failures', async () => {
        const response = {
            offers: [],
            failed: [
                { offerId: 'other-offer', code: 'OtherError', message: 'Other failure' },
                { offerId: 'offer-1', errorCode: 'AssetTimeLocked', message: '12:19' }
            ]
        };
        const service = createApiService(response);

        await expect(service.updateOffer('offer-1', 'asset-1', { priceCents: 1234 }))
            .rejects
            .toMatchObject({
                message: '12:19',
                errorCode: 'AssetTimeLocked',
                result: response.failed[1]
            });
    });

    it('falls back to UnknownError for failed offers without code or message', async () => {
        const response = {
            offers: [],
            failed: [{ offerId: 'offer-1' }]
        };
        const service = createApiService(response);

        await expect(service.updateOffer('offer-1', 'asset-1', { priceCents: 1234 }))
            .rejects
            .toMatchObject({
                message: 'UnknownError',
                errorCode: 'UnknownError',
                result: response.failed[0]
            });
    });

    it('throws when DMarket returns no updated offers and no failure reason', async () => {
        const response = { offers: [], failed: [] };
        const service = createApiService(response);

        await expect(service.updateOffer('offer-1', 'asset-1', { priceCents: 1234 }))
            .rejects
            .toMatchObject({
                message: 'DMarket did not update the offer and returned no failure reason',
                errorCode: 'EmptyOfferUpdateResult',
                response
            });
    });

    it('throws when offer id is missing', async () => {
        const service = createApiService({ offers: [], failed: [] });

        await expect(service.updateOffer('', 'asset-1', { priceCents: 1234 }))
            .rejects
            .toThrow('offerId is required to update an offer');
    });

    it('throws when price data is missing', async () => {
        const service = createApiService({ offers: [], failed: [] });

        await expect(service.updateOffer('offer-1', 'asset-1', {}))
            .rejects
            .toThrow('priceCents or Price.Amount is required to update an offer');
    });

    it('converts string dollar amount to cents', async () => {
        const response = { offers: [{ offerId: 'offer-1' }], failed: [] };
        const service = createApiService(response);

        await service.updateOffer('offer-1', 'asset-1', {
            Price: { Amount: '0.99', Currency: 'USD' }
        });

        expect(service.client.call).toHaveBeenCalledWith(
            'POST',
            '/marketplace-api/v2/offers:batchUpdate',
            {
                requests: [{ offerId: 'offer-1', priceCents: 99 }]
            }
        );
    });

    it('throws for legacy Result failures', async () => {
        const response = {
            Result: [
                {
                    Successful: false,
                    Code: 'LegacyFailure',
                    Message: 'Legacy failure message'
                }
            ]
        };
        const service = createApiService(response);

        await expect(service.updateOffer('offer-1', 'asset-1', { priceCents: 1234 }))
            .rejects
            .toMatchObject({
                message: 'Legacy failure message',
                errorCode: 'LegacyFailure',
                result: response.Result[0]
            });
    });

    it('throws for nested v2 result errors', async () => {
        const response = {
            results: [
                {
                    error: {
                        code: 'NestedFailure',
                        message: 'Nested failure message'
                    }
                }
            ]
        };
        const service = createApiService(response);

        await expect(service.updateOffer('offer-1', 'asset-1', { priceCents: 1234 }))
            .rejects
            .toMatchObject({
                message: 'Nested failure message',
                errorCode: 'NestedFailure',
                result: response.results[0]
            });
    });
});
