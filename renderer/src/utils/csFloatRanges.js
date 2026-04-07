/**
 * CS:GO floatPartValue (e.g. FN-3) → wear range label for display.
 */
export const FLOAT_PART_TO_RANGE = {
    'FN-0': '0.00-0.01',
    'FN-1': '0.01-0.02',
    'FN-2': '0.02-0.03',
    'FN-3': '0.03-0.04',
    'FN-4': '0.04-0.05',
    'FN-5': '0.05-0.06',
    'FN-6': '0.06-0.07',
    'MW-0': '0.07-0.08',
    'MW-1': '0.08-0.09',
    'MW-2': '0.09-0.10',
    'MW-3': '0.10-0.11',
    'MW-4': '0.11-0.15',
    'FT-0': '0.15-0.18',
    'FT-1': '0.18-0.21',
    'FT-2': '0.21-0.24',
    'FT-3': '0.24-0.27',
    'FT-4': '0.27-0.38',
    'WW-0': '0.38-0.39',
    'WW-1': '0.39-0.40',
    'WW-2': '0.40-0.41',
    'WW-3': '0.41-0.42',
    'WW-4': '0.42-0.45',
    'BS-0': '0.45-0.50',
    'BS-1': '0.50-0.63',
    'BS-2': '0.63-0.76',
    'BS-3': '0.76-0.80',
    'BS-4': '0.80-1.00'
};

export function getFloatRange(floatPartValue) {
    if (!floatPartValue || floatPartValue === '' || floatPartValue === 'N/A') {
        return 'Any';
    }
    return FLOAT_PART_TO_RANGE[floatPartValue] || floatPartValue;
}

/**
 * Data for wear visualization (progress) from floatPartValue token.
 */
export function getFloatRangeData(floatPartValue) {
    if (!floatPartValue || floatPartValue === '' || floatPartValue === 'N/A') {
        return null;
    }

    const range = getFloatRange(floatPartValue);
    if (range === 'Any' || range === floatPartValue) {
        return null;
    }

    const [min, max] = range.split('-').map(parseFloat);

    let value = (min + max) / 2;

    const parts = floatPartValue.split('-');
    if (parts.length === 2) {
        const suffix = parseInt(parts[1], 10);
        const prefix = parts[0];

        if (prefix === 'FN') {
            value = 0.01 * suffix + 0.005;
        } else if (prefix === 'MW') {
            value = suffix < 4 ? 0.07 + 0.01 * suffix : 0.11 + (suffix - 4) * 0.01;
        } else if (prefix === 'FT') {
            value = suffix < 4 ? 0.15 + 0.03 * suffix : 0.27 + (suffix - 4) * 0.03;
        } else if (prefix === 'WW') {
            value = suffix < 4 ? 0.38 + 0.01 * suffix : 0.42 + (suffix - 4) * 0.01;
        } else if (prefix === 'BS') {
            if (suffix === 0) value = 0.475;
            else if (suffix === 1) value = 0.565;
            else if (suffix === 2) value = 0.695;
            else if (suffix === 3) value = 0.78;
            else value = 0.9;
        }
    }

    value = Math.max(min, Math.min(max, value));

    let category = '';
    let color = '';

    if (max <= 0.07) {
        category = 'Factory New';
        color = '#10b981';
    } else if (max <= 0.15) {
        category = 'Minimal Wear';
        color = '#3b82f6';
    } else if (max <= 0.38) {
        category = 'Field-Tested';
        color = '#f59e0b';
    } else if (max <= 0.45) {
        category = 'Well-Worn';
        color = '#ff9800';
    } else {
        category = 'Battle-Scarred';
        color = '#ef4444';
    }

    return { min, max, value, category, color, range };
}
