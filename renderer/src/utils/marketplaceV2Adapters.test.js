import { describe, expect, it, vi } from 'vitest';
import {
    buildMarketplaceV2InventoryQuery,
    buildMarketplaceV2OffersQuery,
    buildMarketplaceV2TargetsQuery,
    fetchMarketplaceV2Pages,
    normalizeMarketplaceV2InventoryItem,
    normalizeMarketplaceV2ListResponse,
    normalizeMarketplaceV2Offer,
    normalizeMarketplaceV2Target
} from './marketplaceV2Adapters.js';

describe('buildMarketplaceV2InventoryQuery', () => {
    it('requires gameId and limit with v2 orderBy mapping', () => {
        expect(
            buildMarketplaceV2InventoryQuery({
                orderBy: 'updated',
                orderDir: 'desc',
                limit: 150,
                treeFilters: 'itemLocation[]=true'
            })
        ).toEqual({
            gameId: 'a8db',
            limit: 100,
            orderBy: 'updatedAt',
            orderDir: 'desc',
            treeFilters: 'inMarket=true'
        });
    });
});

describe('buildMarketplaceV2TargetsQuery', () => {
    it('builds required v2 query params', () => {
        expect(
            buildMarketplaceV2TargetsQuery({
                gameId: '9a92',
                limit: 25,
                orderBy: 'price',
                orderDir: 'asc'
            })
        ).toEqual({
            gameId: '9a92',
            limit: 25,
            orderBy: 'price',
            orderDir: 'asc'
        });
    });
});

describe('buildMarketplaceV2OffersQuery', () => {
    it('drops legacy params and builds a documented offers query', () => {
        expect(
            buildMarketplaceV2OffersQuery({
                gameId: 'a8db',
                currency: 'USD',
                offset: 100,
                title: 'AK-47',
                priceFrom: 500,
                priceTo: 5000,
                orderBy: 'price',
                orderDir: 'asc',
                limit: 300,
                withImages: true
            })
        ).toEqual({
            gameId: 'a8db',
            title: 'AK-47',
            priceFrom: 500,
            priceTo: 5000,
            orderBy: 'price',
            orderDir: 'asc',
            limit: 100,
            withImages: true
        });
    });
});

describe('normalizeMarketplaceV2Target', () => {
    it('maps v2 target fields to exchange-style objects', () => {
        const normalized = normalizeMarketplaceV2Target({
            targetId: 'target-1',
            title: 'AK-47 | Redline',
            amount: 2,
            status: 'TARGET_STATUS_INACTIVE',
            priceCents: '1234',
            attributes: {
                title: 'AK-47 | Redline',
                name: 'Redline',
                image: 'https://example.com/img.png',
                categoryPath: 'weapon/rifle',
                cs2: {
                    category: 'CATEGORY_NORMAL',
                    exterior: 'EXTERIOR_FIELD_TESTED',
                    phaseTitle: 'PHASE_TITLE_PHASE_1',
                    paintSeed: 42,
                    floatPart: 'FLOAT_PART_FT_2'
                }
            }
        });

        expect(normalized).toMatchObject({
            type: 'target',
            itemId: 'target-1',
            targetId: 'target-1',
            title: 'AK-47 | Redline',
            amount: 2,
            status: 'inactive',
            price: {
                USD: '1234',
                currency: 'USD',
                amount: '12.34'
            },
            attributes: {
                title: 'AK-47 | Redline',
                floatPartValue: 'FT-2',
                paintSeed: 42
            },
            extra: {
                floatPartValue: 'FT-2',
                phase: 'phase-1'
            }
        });
    });
});

describe('normalizeMarketplaceV2InventoryItem', () => {
    it('maps v2 inventory fields to exchange-style objects', () => {
        const normalized = normalizeMarketplaceV2InventoryItem({
            inMarket: true,
            suggestedPrice: { currency: 'USD', amount: '5.00' },
            offerRecommendedPrice: { currency: 'USD', amount: '4.50' },
            attributes: {
                id: 'asset-1',
                title: 'M4A4 | Howl',
                name: 'Howl',
                imageUri: 'https://example.com/howl.png',
                cs2: { exterior: 'EXTERIOR_FACTORY_NEW' }
            }
        });

        expect(normalized).toMatchObject({
            type: 'item',
            itemId: 'asset-1',
            assetId: 'asset-1',
            title: 'M4A4 | Howl',
            inMarket: true,
            image: 'https://example.com/howl.png',
            instantPrice: { USD: '500' },
            recommendedPrice: { offerPrice: { USD: '450' } },
            extra: { exterior: 'factory new' }
        });
    });
});

describe('normalizeMarketplaceV2Offer', () => {
    it('maps documented v2 offer fields to the legacy app shape', () => {
        const normalized = normalizeMarketplaceV2Offer({
            offerId: 'offer-1',
            priceCents: '1599',
            locked: false,
            discountPercent: 12.5,
            attributes: {
                id: 'asset-1',
                gameId: 'a8db',
                owner: 'owner-1',
                title: 'AK-47 | Redline (Field-Tested)',
                imageUri: 'https://example.com/redline.png',
                cs2: {
                    exterior: 'EXTERIOR_FIELD_TESTED',
                    floatPart: 'FLOAT_PART_FT_2',
                    phaseTitle: 'PHASE_TITLE_PHASE_2'
                }
            }
        });

        expect(normalized).toMatchObject({
            type: 'offer',
            id: 'offer-1',
            itemId: 'asset-1',
            offerId: 'offer-1',
            title: 'AK-47 | Redline (Field-Tested)',
            owner: 'owner-1',
            image: 'https://example.com/redline.png',
            price: { USD: '1599', amount: '1599', currency: 'USD' },
            attributes: { floatPartValue: 'FT-2', phase: 'phase-2' },
            extra: {
                offerId: 'offer-1',
                assetId: 'asset-1',
                exterior: 'field-tested',
                floatPartValue: 'FT-2'
            }
        });
    });
});

describe('normalizeMarketplaceV2ListResponse', () => {
    it('passes through already-normalized exchange responses', () => {
        const response = { objects: [{ type: 'target' }], total: 1, cursor: null };
        expect(normalizeMarketplaceV2ListResponse(response, normalizeMarketplaceV2Target)).toBe(response);
    });

    it('converts v2 list payloads to objects', () => {
        const response = normalizeMarketplaceV2ListResponse(
            {
                items: [{ targetId: 't1', title: 'Test', priceCents: 100, amount: 1 }],
                total: 1,
                cursor: 'next'
            },
            normalizeMarketplaceV2Target
        );

        expect(response.objects).toHaveLength(1);
        expect(response.objects[0].type).toBe('target');
        expect(response.cursor).toBe('next');
    });
});

describe('fetchMarketplaceV2Pages', () => {
    it('uses cursors to satisfy a requested limit larger than 100', async () => {
        const client = {
            call: vi
                .fn()
                .mockResolvedValueOnce({
                    items: [{ offerId: 'o1', priceCents: '100', attributes: { id: 'a1' } }],
                    total: '2',
                    cursor: 'next'
                })
                .mockResolvedValueOnce({
                    items: [{ offerId: 'o2', priceCents: '200', attributes: { id: 'a2' } }],
                    total: '2',
                    cursor: ''
                })
        };

        const response = await fetchMarketplaceV2Pages(
            client,
            '/marketplace-api/v2/offers',
            { gameId: 'a8db', limit: 100 },
            normalizeMarketplaceV2Offer,
            { maxItems: 300 }
        );

        expect(response.objects).toHaveLength(2);
        expect(client.call).toHaveBeenNthCalledWith(
            2,
            'GET',
            '/marketplace-api/v2/offers',
            { gameId: 'a8db', limit: 100, cursor: 'next' }
        );
    });
});
