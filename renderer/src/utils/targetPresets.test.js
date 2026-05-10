import { describe, expect, it } from 'vitest';
import {
    buildTargetPresetFromForm,
    getTargetPresetKey,
    presetToTargetFormInitialData
} from './targetPresets.js';

describe('target preset helpers', () => {
    it('builds a deterministic key from title, game and attributes', () => {
        const input = {
            title: ' AK-47 | Redline (Field-Tested) ',
            gameId: 'a8db',
            floatPartValue: 'FT-2',
            phase: 'phase-1',
            paintSeed: '123'
        };

        expect(getTargetPresetKey(input)).toBe(
            getTargetPresetKey({
                ...input,
                title: 'ak-47 | redline (field-tested)',
                floatPartValue: 'ft-2',
                phase: 'PHASE-1'
            })
        );
    });

    it('converts form data into a preset', () => {
        expect(
            buildTargetPresetFromForm({
                title: 'AWP | Asiimov (Field-Tested)',
                price: '0.03',
                quantity: '2',
                maxPrice: '15.5',
                floatPartValue: 'FT-1',
                phase: '',
                paintSeed: '0'
            })
        ).toMatchObject({
            title: 'AWP | Asiimov (Field-Tested)',
            gameId: 'a8db',
            price: 0.03,
            amount: 2,
            maxPrice: 15.5,
            floatPartValue: 'FT-1',
            phase: null,
            paintSeed: null
        });
    });

    it('converts a preset back to TargetForm initial data', () => {
        expect(
            presetToTargetFormInitialData({
                title: 'M4A1-S | Printstream (Minimal Wear)',
                price: 0.03,
                amount: 3,
                maxPrice: 50,
                floatPartValue: 'MW-1',
                phase: 'emerald',
                paintSeed: '321'
            })
        ).toEqual({
            title: 'M4A1-S | Printstream (Minimal Wear)',
            price: '0.03',
            quantity: 3,
            maxPrice: '50',
            floatPartValue: 'MW-1',
            phase: 'emerald',
            paintSeed: '321',
            imageUrl: null
        });
    });

    it('handles empty optional fields without breaking key or preset build', () => {
        const preset = buildTargetPresetFromForm({
            title: 'Desert Eagle | Blaze',
            price: '',
            quantity: '',
            maxPrice: '',
            floatPartValue: '',
            phase: '',
            paintSeed: ''
        });

        expect(preset.id).toBe('target-preset|a8db|desert eagle | blaze|||');
        expect(preset.amount).toBe(1);
        expect(preset.price).toBeNull();
        expect(preset.maxPrice).toBeNull();
        expect(preset.floatPartValue).toBeNull();
        expect(preset.phase).toBeNull();
        expect(preset.paintSeed).toBeNull();
    });
});
