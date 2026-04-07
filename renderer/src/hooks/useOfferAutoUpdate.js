import { useState, useEffect, useCallback, useRef } from 'react';
import { marketItemMatchesOfferWearAndPhase } from '../utils/offerMarketMatch.js';
import { getOfferId } from './useOffers.js';

function itemOfferPriceToCents(item) {
    const price = item.price?.USD || item.price?.amount || item.price;
    if (typeof price === 'string') {
        const p = parseFloat(price);
        return p >= 10 ? p : p * 100;
    }
    return price >= 10 ? price : price * 100;
}

function parseMaxPriceCents(raw, minPriceCents) {
    if (raw === undefined || raw === null || String(raw).trim() === '') return null;
    const m = parseFloat(String(raw));
    if (isNaN(m) || m <= 0) return null;
    const cents = Math.round(m * 100);
    if (cents < minPriceCents) return null;
    return cents;
}

export function useOfferAutoUpdate({
    apiService,
    offersRef,
    minPricesRef,
    maxPricesRef,
    skipForParsingRef,
    flushToLocalStorage,
    loadOffers,
    addLog,
    isAutoUpdatingEnabled,
    offersLength
}) {
    const [updating, setUpdating] = useState(false);
    const isAutoUpdatingRef = useRef(false);
    const intervalRef = useRef(null);

    const autoUpdateOfferPrices = useCallback(async () => {
        const currentOffers = offersRef.current;
        const currentMinPrices = minPricesRef.current || {};
        const currentMaxPrices = maxPricesRef.current || {};
        if (!apiService || currentOffers.length === 0 || isAutoUpdatingRef.current) return;

        isAutoUpdatingRef.current = true;
        setUpdating(true);
        try {
            const ourOwnerIds = new Set();
            const ourOfferIds = new Set();
            currentOffers.forEach((o) => {
                const ownerId = o.owner || o.ownerDetails?.id;
                if (ownerId) ourOwnerIds.add(ownerId);
                const oid = getOfferId(o);
                if (oid) ourOfferIds.add(oid);
                if (o.itemId) ourOfferIds.add(o.itemId);
            });

            for (let i = 0; i < currentOffers.length; i++) {
                const offer = currentOffers[i];
                try {
                    if (i > 0) await new Promise((r) => setTimeout(r, 1000));
                    const offerId = getOfferId(offer);
                    const itemId = offer.itemId;
                    const assetId = offer.itemId;
                    const title = offer.title || offer.extra?.name;
                    const gameId = offer.gameId || 'a8db';
                    const minPrice = currentMinPrices[itemId] || offer.minPrice;
                    const maxPriceRaw = currentMaxPrices[itemId];
                    const currentSkip = skipForParsingRef.current || {};
                    if (currentSkip[itemId] === true) continue;
                    if (!title || !offerId || !minPrice || !assetId) continue;

                    const minPriceCents = parseFloat(minPrice) * 100;
                    const maxPriceCents = parseMaxPriceCents(maxPriceRaw, minPriceCents);
                    const hasMaxCap = maxPriceCents != null;

                    const marketData = await apiService.getMarketItems({
                        gameId,
                        title,
                        currency: 'USD',
                        limit: 300
                    });

                    let otherPrices = [];
                    if (marketData?.objects?.length > 0) {
                        const filtered = marketData.objects.filter((item) =>
                            marketItemMatchesOfferWearAndPhase(offer, item)
                        );
                        otherPrices = filtered
                            .filter((item) => {
                                const ioid =
                                    item.extra?.offerId ||
                                    item.itemId ||
                                    item.offerId ||
                                    item.instantOfferId;
                                const isOurById =
                                    ourOfferIds.has(ioid) ||
                                    (item.itemId && ourOfferIds.has(item.itemId));
                                const iown = item.owner || item.ownerDetails?.id;
                                const isOurByOwner = iown && ourOwnerIds.has(iown);
                                return !isOurById && !isOurByOwner;
                            })
                            .map((item) => itemOfferPriceToCents(item))
                            .filter((p) => p > 0 && !isNaN(p) && p >= minPriceCents);
                        if (hasMaxCap) {
                            otherPrices = otherPrices.filter((p) => p <= maxPriceCents);
                        }
                        otherPrices.sort((a, b) => a - b);
                    }

                    let currentPriceFloat = null;
                    const curPrice = offer.price?.USD || offer.price?.amount || offer.price;
                    if (curPrice !== undefined && curPrice !== null && curPrice !== 'N/A') {
                        const n = typeof curPrice === 'string' ? parseFloat(curPrice) : curPrice;
                        if (!isNaN(n)) currentPriceFloat = n >= 10 ? n : n / 100;
                    }

                    let newPriceFloat;
                    let logExtra = {};

                    if (otherPrices.length > 0) {
                        const lowestPrice = otherPrices[0];
                        let newPriceCents = lowestPrice - 1;
                        newPriceCents = Math.max(minPriceCents, newPriceCents);
                        if (hasMaxCap) {
                            newPriceCents = Math.min(maxPriceCents, newPriceCents);
                        }
                        newPriceFloat = parseFloat((newPriceCents / 100).toFixed(2));
                        logExtra = {
                            mode: 'undercut',
                            lowestPrice: (lowestPrice / 100).toFixed(2),
                            minPrice,
                            maxPrice: hasMaxCap ? String(maxPriceRaw) : undefined
                        };
                    } else if (hasMaxCap) {
                        newPriceFloat = parseFloat((maxPriceCents / 100).toFixed(2));
                        logExtra = {
                            mode: 'fallbackMax',
                            minPrice,
                            maxPrice: String(maxPriceRaw)
                        };
                    } else {
                        continue;
                    }

                    if (
                        currentPriceFloat !== null &&
                        Math.abs(newPriceFloat - currentPriceFloat) < 0.01
                    )
                        continue;

                    try {
                        const response = await apiService.updateOffer(offerId, itemId, {
                            Price: { Amount: newPriceFloat, Currency: 'USD' }
                        });
                        if (response?.Result && Array.isArray(response.Result)) {
                            for (const ri of response.Result) {
                                const items = Array.isArray(ri) ? ri : [ri];
                                for (const it of items) {
                                    if (it.Error || it.Successful === false) {
                                        throw {
                                            errorCode:
                                                it.Error?.Code || it.Code || 'UnknownError',
                                            message:
                                                it.Error?.Message ||
                                                it.Message ||
                                                'Помилка оновлення офера'
                                        };
                                    }
                                }
                            }
                        }
                        addLog({
                            type: 'success',
                            category: 'parsing',
                            message: `Ціна офера оновлена: ${title}`,
                            details: {
                                title,
                                offerId,
                                itemId,
                                oldPrice:
                                    currentPriceFloat !== null
                                        ? currentPriceFloat.toFixed(2)
                                        : 'N/A',
                                newPrice: newPriceFloat.toFixed(2),
                                ...logExtra
                            }
                        });
                    } catch (updateErr) {
                        const errorCode = updateErr.errorCode || 'UnknownError';
                        addLog({
                            type: 'warning',
                            category: 'parsing',
                            message: `Не вдалося оновити офер: ${title} (${errorCode})`,
                            details: {
                                title,
                                offerId,
                                itemId,
                                errorCode,
                                errorMessage:
                                    updateErr.message || 'Помилка оновлення офера',
                                oldPrice:
                                    currentPriceFloat !== null
                                        ? currentPriceFloat.toFixed(2)
                                        : 'N/A',
                                newPrice: newPriceFloat.toFixed(2),
                                ...logExtra
                            }
                        });
                    }
                } catch (err) {
                    console.error(
                        `Error auto-updating offer ${offer.itemId || offer.offerId}:`,
                        err
                    );
                    addLog({
                        type: 'error',
                        category: 'parsing',
                        message: `Помилка оновлення ціни офера: ${offer.title || 'Невідомий офер'}`,
                        details: {
                            title: offer.title,
                            offerId: getOfferId(offer),
                            error: err.message
                        }
                    });
                }
            }

            if (flushToLocalStorage) flushToLocalStorage();

            await new Promise((r) => setTimeout(r, 1000));
            await loadOffers();
        } catch (err) {
            console.error('Error in auto-update offer prices:', err);
        } finally {
            setUpdating(false);
            isAutoUpdatingRef.current = false;
        }
    }, [
        apiService,
        loadOffers,
        addLog,
        offersRef,
        minPricesRef,
        maxPricesRef,
        skipForParsingRef,
        flushToLocalStorage
    ]);

    useEffect(() => {
        if (!apiService || offersLength === 0 || !isAutoUpdatingEnabled) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
                addLog({
                    type: 'info',
                    category: 'parsing',
                    message: 'Парсинг оферів зупинено',
                    details: { offersCount: offersLength }
                });
            }
            return;
        }

        if (intervalRef.current) clearInterval(intervalRef.current);

        addLog({
            type: 'success',
            category: 'parsing',
            message: 'Парсинг оферів запущено',
            details: { offersCount: offersLength, interval: '1 хвилина' }
        });
        intervalRef.current = setInterval(() => {
            if (!isAutoUpdatingRef.current) autoUpdateOfferPrices();
        }, 60000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [apiService, offersLength, isAutoUpdatingEnabled, autoUpdateOfferPrices, addLog]);

    return { updating };
}
