import { useState, useEffect, useCallback, useRef } from 'react';

function readJson(key, fallback) {
    try {
        const s = localStorage.getItem(key);
        return s ? JSON.parse(s) : fallback;
    } catch {
        return fallback;
    }
}

/**
 * Max prices keyed by itemId + pending editors + hydrate new target max from form.
 */
export function usePersistedTargetMaxPrices(targets, { addLog }) {
    const [maxPrices, setMaxPrices] = useState(() => readJson('targetsMaxPrices', {}));
    const [pendingMaxPrices, setPendingMaxPrices] = useState({});
    const [pendingNewTargetMaxPrice, setPendingNewTargetMaxPrice] = useState(null);
    const maxPricesRef = useRef(maxPrices);

    useEffect(() => {
        maxPricesRef.current = maxPrices;
    }, [maxPrices]);

    useEffect(() => {
        if (Object.keys(maxPrices).length > 0) {
            try {
                localStorage.setItem('targetsMaxPrices', JSON.stringify(maxPrices));
                if (import.meta.env.DEV) {
                    console.log('Saved maxPrices to localStorage:', maxPrices);
                }
            } catch (err) {
                console.error('Error saving maxPrices to localStorage:', err);
            }
        }
    }, [maxPrices]);

    useEffect(() => {
        if (targets.length > 0) {
            try {
                const saved = localStorage.getItem('targetsMaxPrices');
                if (saved) {
                    const savedMaxPrices = JSON.parse(saved);
                    if (import.meta.env.DEV) {
                        console.log('Restoring maxPrices from localStorage (useEffect):', savedMaxPrices);
                    }
                    setMaxPrices(savedMaxPrices);
                    maxPricesRef.current = savedMaxPrices;
                } else if (import.meta.env.DEV) {
                    console.log('No saved maxPrices in localStorage');
                }
            } catch (err) {
                console.error('Error restoring maxPrices from localStorage (useEffect):', err);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targets.length]);

    useEffect(() => {
        if (!pendingNewTargetMaxPrice || targets.length === 0) return;
        const { title, floatPartValue, maxPrice, phase, paintSeed } = pendingNewTargetMaxPrice;
        const matchingTarget = targets.find((t) => {
            const targetTitle = t.itemTitle || t.title || t.extra?.name || t.attributes?.title;
            const targetFloat = t.extra?.floatPartValue || t.attributes?.floatPartValue || '';
            const targetPhase = t.attributes?.phase || t.extra?.phase || null;
            const targetPaintSeed = t.attributes?.paintSeed || t.extra?.paintSeed || null;

            const titleMatch = targetTitle === title;
            const floatMatch = targetFloat === floatPartValue;
            const phaseMatch = (!phase && !targetPhase) || phase === targetPhase;
            const paintSeedMatch =
                ((!paintSeed || paintSeed === '0' || paintSeed === 0) &&
                    (!targetPaintSeed || targetPaintSeed === 0)) ||
                (paintSeed &&
                    targetPaintSeed &&
                    parseInt(paintSeed, 10) === parseInt(targetPaintSeed, 10));

            return titleMatch && floatMatch && phaseMatch && paintSeedMatch;
        });

        if (matchingTarget?.itemId) {
            const itemId = matchingTarget.itemId;
            if (import.meta.env.DEV) {
                console.log('Saving maxPrice for newly created target:', {
                    itemId,
                    title,
                    floatPartValue,
                    maxPrice,
                    phase,
                    paintSeed
                });
            }
            setMaxPrices((prev) => {
                const updated = { ...prev, [itemId]: maxPrice };
                if (import.meta.env.DEV) {
                    console.log('Updated maxPrices with new target:', updated);
                }
                return updated;
            });
            maxPricesRef.current = { ...maxPricesRef.current, [itemId]: maxPrice };
            addLog({
                type: 'success',
                category: 'target',
                message: `Таргет створено: ${title}`,
                details: {
                    title,
                    itemId,
                    maxPrice,
                    floatPartValue: floatPartValue || '',
                    phase: phase || null,
                    paintSeed:
                        paintSeed && paintSeed !== '0' && paintSeed !== 0 ? paintSeed : null
                }
            });
            setPendingNewTargetMaxPrice(null);
        }
    }, [targets, pendingNewTargetMaxPrice, addLog]);

    const handleSaveWithMaxPrice = useCallback((title, floatPartValue, maxPrice, phase = null, paintSeed = null) => {
        setPendingNewTargetMaxPrice({ title, floatPartValue, maxPrice, phase, paintSeed });
        if (import.meta.env.DEV) {
            console.log('Stored pending maxPrice for new target:', {
                title,
                floatPartValue,
                maxPrice,
                phase,
                paintSeed
            });
        }
    }, []);

    return {
        maxPrices,
        setMaxPrices,
        maxPricesRef,
        pendingMaxPrices,
        setPendingMaxPrices,
        pendingNewTargetMaxPrice,
        setPendingNewTargetMaxPrice,
        handleSaveWithMaxPrice
    };
}
