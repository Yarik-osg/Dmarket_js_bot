import { describe, expect, it } from 'vitest';
import {
    addPendingMaxPriceToSnapshot,
    buildMaxPricesSnapshot,
    getCreatedTargetIdFromResponse,
    getTargetPriceKey,
    mergeMaxPricesAfterLoad,
    mergePendingMaxPriceAfterLoad,
    pruneMaxPricesForTargets
} from './targetMaxPricesStorage.js';

describe('target max price storage helpers', () => {
    it('uses the stable target price key fallback order', () => {
        expect(getTargetPriceKey({ itemId: 'item-1', targetId: 'target-1' })).toBe('item-1');
        expect(getTargetPriceKey({ targetId: 'target-1', instantTargetId: 'instant-1' })).toBe('target-1');
        expect(getTargetPriceKey({ instantTargetId: 'instant-1' })).toBe('instant-1');
        expect(getTargetPriceKey({})).toBeNull();
    });

    it('builds a snapshot with metadata and title fallback key', () => {
        const targets = [
            {
                itemId: 'item-1',
                itemTitle: 'AK-47 | Redline',
                extra: { floatPartValue: '0.15', phase: 'Phase 2' },
                attributes: { paintSeed: '321' }
            },
            {
                targetId: 'target-2',
                title: 'M4A1-S | Printstream',
                attributes: { floatPartValue: '0.05' }
            }
        ];

        const snapshot = buildMaxPricesSnapshot(targets, {
            'item-1': '12.34',
            'target-2': 55
        });

        expect(snapshot.maxPrices).toEqual({
            'item-1': '12.34',
            'target-2': 55
        });
        expect(snapshot.maxPricesByKey).toEqual({
            'AK-47 | Redline|0.15': '12.34',
            'M4A1-S | Printstream|0.05': 55
        });
        expect(snapshot.targetMetadata).toEqual({
            'item-1': {
                itemTitle: 'AK-47 | Redline',
                floatPartValue: '0.15',
                phase: 'Phase 2',
                paintSeed: '321'
            },
            'target-2': {
                itemTitle: 'M4A1-S | Printstream',
                floatPartValue: '0.05',
                phase: null,
                paintSeed: null
            }
        });
    });

    it('keeps zero max prices but skips targets without title or saved price', () => {
        const snapshot = buildMaxPricesSnapshot(
            [
                {
                    itemId: 'zero-price-target',
                    title: 'Zero Price Target',
                    attributes: { floatPartValue: '0.00' }
                },
                {
                    itemId: 'missing-title'
                },
                {
                    itemId: 'missing-price',
                    title: 'No Saved Price'
                }
            ],
            {
                'zero-price-target': 0,
                'missing-title': '10'
            }
        );

        expect(snapshot.maxPricesByKey).toEqual({
            'Zero Price Target|0.00': 0
        });
        expect(snapshot.targetMetadata).toEqual({
            'zero-price-target': {
                itemTitle: 'Zero Price Target',
                floatPartValue: '0.00',
                phase: null,
                paintSeed: null
            }
        });
    });

    it('prunes prices for targets that are no longer loaded', () => {
        const pruned = pruneMaxPricesForTargets(
            {
                'item-1': '10',
                'missing-item': '20',
                'target-2': '30'
            },
            [{ itemId: 'item-1' }, { targetId: 'target-2' }]
        );

        expect(pruned).toEqual({
            'item-1': '10',
            'target-2': '30'
        });
    });

    it('keeps a pending created target id during prune even before it appears in loaded targets', () => {
        const pruned = pruneMaxPricesForTargets(
            {
                'created-target-id': '12.34',
                'old-target-id': '9.99'
            },
            [],
            ['created-target-id']
        );

        expect(pruned).toEqual({
            'created-target-id': '12.34'
        });
    });

    it('restores max prices by title and float when target id changes', () => {
        const restored = mergeMaxPricesAfterLoad(
            {},
            { 'AK-47 | Redline|0.15': '12.34' },
            [
                {
                    itemId: 'new-item-id',
                    itemTitle: 'AK-47 | Redline',
                    extra: { floatPartValue: '0.15' }
                }
            ]
        );

        expect(restored).toEqual({ 'new-item-id': '12.34' });
    });

    it('adds a newly created target max price to the title fallback snapshot', () => {
        const snapshot = addPendingMaxPriceToSnapshot(
            buildMaxPricesSnapshot([], {}),
            {
                title: 'AK-47 | Redline',
                floatPartValue: 'FT-1',
                maxPrice: '12.34',
                targetId: 'created-target-id'
            }
        );

        expect(snapshot.maxPrices).toEqual({
            'created-target-id': '12.34'
        });
        expect(snapshot.maxPricesByKey).toEqual({
            'AK-47 | Redline|FT-1': '12.34'
        });
        expect(snapshot.targetMetadata).toEqual({
            'created-target-id': {
                itemTitle: 'AK-47 | Redline',
                floatPartValue: 'FT-1',
                phase: null,
                paintSeed: null
            }
        });
    });

    it('extracts created target id from nested create response', () => {
        expect(
            getCreatedTargetIdFromResponse({
                targets: [{ TargetID: 'created-target-id' }]
            })
        ).toBe('created-target-id');
    });

    it('extracts created target id from DMarket Result response', () => {
        expect(
            getCreatedTargetIdFromResponse({
                Result: [
                    {
                        CreateTarget: {
                            Amount: '1',
                            Price: { Currency: 'USD', Amount: 0.03 },
                            Title: 'AK-47 | Redline',
                            Attrs: { paintSeed: 0, phase: '', floatPartValue: 'FT-1' }
                        },
                        TargetID: 'dmarket-created-target-id',
                        Successful: true,
                        Error: { Code: 'Internal', Message: '' }
                    }
                ]
            })
        ).toBe('dmarket-created-target-id');
    });

    it('merges a pending max price into a freshly loaded target id', () => {
        const merged = mergePendingMaxPriceAfterLoad(
            {},
            [
                {
                    TargetID: 'target-id-from-api',
                    Title: 'AK-47 | Redline',
                    Attrs: { floatPartValue: 'FT-1' }
                }
            ],
            {
                title: 'AK-47 | Redline',
                floatPartValue: 'FT-1',
                maxPrice: '12.34'
            }
        );

        expect(merged).toEqual({
            'target-id-from-api': '12.34'
        });
    });

    it('does not overwrite an existing restored price for a target id', () => {
        const restored = mergeMaxPricesAfterLoad(
            { 'new-item-id': '9.99' },
            { 'AK-47 | Redline|0.15': '12.34' },
            [
                {
                    itemId: 'new-item-id',
                    itemTitle: 'AK-47 | Redline',
                    extra: { floatPartValue: '0.15' }
                }
            ]
        );

        expect(restored).toEqual({ 'new-item-id': '9.99' });
    });
});
