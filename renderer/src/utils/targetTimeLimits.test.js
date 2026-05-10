import { describe, expect, it } from 'vitest';
import {
    buildTargetTimeLimitsRequest,
    formatCooldownMs,
    parseTimeLimitsResponse
} from './targetTimeLimits.js';

describe('targetTimeLimits', () => {
    it('parses API preview shape', () => {
        const r = parseTimeLimitsResponse({
            DefaultTimeLimit: '900000',
            RemainingTimeLimit: '876000'
        });
        expect(r.defaultMs).toBe(900000);
        expect(r.remainingMs).toBe(876000);
    });

    it('formats mm:ss', () => {
        expect(formatCooldownMs(90_000)).toBe('1:30');
        expect(formatCooldownMs(59_000)).toBe('0:59');
    });

    it('builds time-limits body from target', () => {
        const body = buildTargetTimeLimitsRequest({
            gameId: 'a8db',
            itemTitle: 'AK-47 | Redline (Field-Tested)',
            targetId: 'tid-1',
            itemId: 'iid-1',
            amount: 1,
            price: { USD: '500', currency: 'USD' },
            attributes: { title: 'AK-47 | Redline (Field-Tested)', floatPartValue: 'FT-0' },
            extra: { floatPartValue: 'FT-0' }
        });
        expect(body.GameID).toBe('a8db');
        expect(body.ItemTitle).toContain('AK-47');
        expect(body.AttributesV2.gameId).toBe('a8db');
        expect(body.AttributesV2.id).toBe('tid-1');
    });

    it('does not inject FT-0 when float is not chosen (any float)', () => {
        const body = buildTargetTimeLimitsRequest({
            gameId: 'a8db',
            itemTitle: 'AK-47 | Redline (Field-Tested)',
            targetId: 'tid-1',
            itemId: 'iid-1',
            amount: 1,
            attributes: { title: 'AK-47 | Redline (Field-Tested)' },
            extra: {}
        });
        expect(body.AttributesV2.floatPartValue).toBe('');
    });
});
