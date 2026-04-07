/**
 * Check whether a market listing matches an offer's wear (floatPartValue) and phase filters.
 * Empty fields on the listing are treated as "any".
 */
export function marketItemMatchesOfferWearAndPhase(offer, item) {
    const offerFloatValue = offer?.extra?.floatPartValue ?? offer?.attributes?.floatPartValue;
    if (offerFloatValue !== undefined && offerFloatValue !== null && String(offerFloatValue).trim() !== '') {
        const itemFloatValue = item?.attributes?.floatPartValue ?? item?.extra?.floatPartValue;
        const itemFloatStr =
            itemFloatValue === undefined || itemFloatValue === null ? '' : String(itemFloatValue);
        if (itemFloatStr !== '' && itemFloatStr !== String(offerFloatValue)) {
            return false;
        }
    }

    const offerPhase = offer?.attributes?.phase ?? offer?.extra?.phase;
    if (offerPhase !== undefined && offerPhase !== null && String(offerPhase).trim() !== '') {
        const offerPhaseNorm = String(offerPhase).trim().toLowerCase();
        const rawItemPhase = item?.attributes?.phase ?? item?.extra?.phase;
        const itemPhaseStr =
            rawItemPhase !== undefined && rawItemPhase !== null && String(rawItemPhase).trim() !== ''
                ? String(rawItemPhase).trim().toLowerCase()
                : '';
        if (itemPhaseStr !== '' && itemPhaseStr !== offerPhaseNorm) {
            return false;
        }
    }

    return true;
}
