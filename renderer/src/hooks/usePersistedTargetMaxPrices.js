import { useState, useEffect, useCallback, useRef } from 'react';
import {
    addPendingMaxPriceToSnapshot,
    buildMaxPricesSnapshot,
    loadMaxPricesSnapshot,
    persistMaxPricesSnapshot
} from '../utils/targetMaxPricesStorage.js';

/**
 * Max prices keyed by itemId + pending editors + hydrate new target max from form.
 */
export function usePersistedTargetMaxPrices(targets) {
    const [maxPrices, setMaxPrices] = useState({});
    const [pendingMaxPrices, setPendingMaxPrices] = useState({});
    const maxPricesRef = useRef(maxPrices);
    const hasHydratedRef = useRef(false);

    useEffect(() => {
        maxPricesRef.current = maxPrices;
    }, [maxPrices]);

    useEffect(() => {
        if (!hasHydratedRef.current) return;
        persistMaxPricesSnapshot(buildMaxPricesSnapshot(targets, maxPrices)).catch((err) => {
            console.error('Error saving maxPrices:', err);
        });
    }, [maxPrices, targets]);

    useEffect(() => {
        if (targets.length > 0) {
            let cancelled = false;
            (async () => {
                try {
                    const snapshot = await loadMaxPricesSnapshot();
                    if (cancelled) return;
                    if (Object.keys(snapshot.maxPrices).length > 0) {
                        const savedMaxPrices = snapshot.maxPrices;
                        if (import.meta.env.DEV) {
                            console.log('Restoring maxPrices from storage (useEffect):', savedMaxPrices);
                        }
                        setMaxPrices(savedMaxPrices);
                        maxPricesRef.current = savedMaxPrices;
                    } else if (import.meta.env.DEV) {
                        console.log('No saved maxPrices in storage');
                    }
                } catch (err) {
                    console.error('Error restoring maxPrices from storage (useEffect):', err);
                } finally {
                    if (!cancelled) {
                        hasHydratedRef.current = true;
                    }
                }
            })();
            return () => {
                cancelled = true;
            };
        }
        return undefined;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targets.length]);

    const handleSaveWithMaxPrice = useCallback(async (
        title,
        floatPartValue,
        maxPrice,
        phase = null,
        paintSeed = null,
        targetId = null
    ) => {
        const pending = { title, floatPartValue, maxPrice, phase, paintSeed, targetId };
        const currentMaxPrices = maxPricesRef.current || {};
        const snapshot = addPendingMaxPriceToSnapshot(
            buildMaxPricesSnapshot(targets, currentMaxPrices),
            pending
        );
        await persistMaxPricesSnapshot(snapshot);
        if (import.meta.env.DEV) {
            console.log('Stored pending maxPrice for new target:', {
                title,
                floatPartValue,
                maxPrice,
                phase,
                paintSeed
            });
        }
        return pending;
    }, [targets]);

    return {
        maxPrices,
        setMaxPrices,
        maxPricesRef,
        pendingMaxPrices,
        setPendingMaxPrices,
        handleSaveWithMaxPrice
    };
}
