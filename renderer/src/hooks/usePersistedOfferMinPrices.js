import { useState, useEffect, useRef, useCallback } from 'react';

function readJson(key, fallback) {
    try {
        const s = localStorage.getItem(key);
        return s ? JSON.parse(s) : fallback;
    } catch {
        return fallback;
    }
}

export function usePersistedOfferMinPrices(offers) {
    const [minPrices, setMinPrices] = useState(() => readJson('offersMinPrices', {}));
    const [pendingMinPrices, setPendingMinPrices] = useState({});
    const [skipForParsing, setSkipForParsing] = useState(() => readJson('offersSkipForParsing', {}));
    const minPricesRef = useRef(minPrices);
    const skipForParsingRef = useRef(skipForParsing);

    useEffect(() => {
        minPricesRef.current = minPrices;
    }, [minPrices]);

    useEffect(() => {
        skipForParsingRef.current = skipForParsing;
    }, [skipForParsing]);

    useEffect(() => {
        if (Object.keys(minPrices).length > 0) {
            try {
                localStorage.setItem('offersMinPrices', JSON.stringify(minPrices));
            } catch (err) {
                console.error('Error saving minPrices to localStorage:', err);
            }
        }
    }, [minPrices]);

    useEffect(() => {
        try {
            localStorage.setItem('offersSkipForParsing', JSON.stringify(skipForParsing));
        } catch (err) {
            console.error('Error saving skipForParsing to localStorage:', err);
        }
    }, [skipForParsing]);

    useEffect(() => {
        if (offers.length > 0) {
            try {
                const saved = localStorage.getItem('offersMinPrices');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    setMinPrices(parsed);
                    minPricesRef.current = parsed;
                }
            } catch (err) {
                console.error('Error restoring minPrices from localStorage:', err);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offers.length]);

    useEffect(() => {
        if (offers.length > 0) {
            try {
                const saved = localStorage.getItem('offersSkipForParsing');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    const matched = { ...parsed };
                    offers.forEach((offer) => {
                        const itemId = offer.itemId;
                        const assetId = offer.itemId || offer.extra?.assetId;
                        if (assetId && parsed[assetId] && !parsed[itemId]) {
                            matched[itemId] = parsed[assetId];
                        }
                    });
                    setSkipForParsing(matched);
                    skipForParsingRef.current = matched;
                }
            } catch (err) {
                console.error('Error restoring skipForParsing from localStorage:', err);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offers.length]);

    const flushToLocalStorage = useCallback(() => {
        try {
            const mp = minPricesRef.current || {};
            if (Object.keys(mp).length > 0)
                localStorage.setItem('offersMinPrices', JSON.stringify(mp));
        } catch {
            /* ignore */
        }
        try {
            const sp = skipForParsingRef.current || {};
            localStorage.setItem('offersSkipForParsing', JSON.stringify(sp));
        } catch {
            /* ignore */
        }
    }, []);

    return {
        minPrices,
        setMinPrices,
        minPricesRef,
        pendingMinPrices,
        setPendingMinPrices,
        skipForParsing,
        setSkipForParsing,
        skipForParsingRef,
        flushToLocalStorage
    };
}
