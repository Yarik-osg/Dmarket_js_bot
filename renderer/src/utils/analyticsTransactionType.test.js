import { describe, expect, it } from 'vitest';
import {
    classifyDMarketAnalyticsType,
    mapHistoryTransactionToAnalytics
} from './analyticsTransactionType.js';

function baseTx(overrides) {
    return {
        type: 'purchase',
        subject: 'Test',
        changes: [{ money: { amount: '10.5', currency: 'USD' } }],
        createdAt: '2026-01-01T00:00:00.000Z',
        ...overrides
    };
}

describe('classifyDMarketAnalyticsType', () => {
    it('classifies ETH-style subject as cash_deposit', () => {
        const tx = baseTx({
            subject: '0x8604900Cc2fC806d58cbD25aA27C25549f6Ee552',
            changes: [{ money: { amount: '39.54', currency: 'USD' } }]
        });
        const t = mapHistoryTransactionToAnalytics(tx);
        expect(t.type).toBe('cash_deposit');
    });

    it('classifies $0 skin purchase as deposit (завіз на DMarket)', () => {
        const tx = baseTx({
            type: 'purchase',
            subject: 'M4A4 | Polysoup (Minimal Wear)',
            details: { itemId: 'asset-uuid-1' },
            changes: [{ money: { amount: '0', currency: 'USD' } }]
        });
        const t = mapHistoryTransactionToAnalytics(tx);
        expect(t.type).toBe('deposit');
    });

    it('classifies $0 skin sell as withdraw (вивід з DMarket)', () => {
        const tx = baseTx({
            type: 'sell',
            subject: 'Glock-18 | AXIA (Field-Tested)',
            details: { itemId: 'asset-uuid-2' },
            changes: [{ money: { amount: '0', currency: 'USD' } }]
        });
        const t = mapHistoryTransactionToAnalytics(tx);
        expect(t.type).toBe('withdraw');
    });

    it('leaves normal purchase as purchase', () => {
        const tx = baseTx({
            type: 'purchase',
            subject: 'AK-47 | Redline (Field-Tested)',
            details: { itemId: 'x' },
            changes: [{ money: { amount: '25.00', currency: 'USD' } }]
        });
        expect(
            classifyDMarketAnalyticsType(tx, {
                amount: 25,
                itemTitle: tx.subject,
                assetId: 'x',
                isSale: false
            })
        ).toBe('purchase');
    });

    it('leaves sell as sale', () => {
        const tx = baseTx({
            type: 'sell',
            subject: 'Item',
            changes: [{ money: { amount: '100', currency: 'USD' } }]
        });
        expect(
            classifyDMarketAnalyticsType(tx, {
                amount: 100,
                itemTitle: 'Item',
                assetId: 'a',
                isSale: true
            })
        ).toBe('sale');
    });
});
