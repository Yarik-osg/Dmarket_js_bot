import { useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { ApiService } from '../services/apiService.js';

export function getOfferId(offer) {
    return (
        offer?.extra?.offerId ||
        offer?.itemId ||
        offer?.offerId ||
        offer?.id ||
        offer?.instantOfferId
    );
}

export function getOfferRuleId(offer) {
    return offer?.itemId || offer?.extra?.assetId || offer?.assetId || getOfferId(offer);
}

/**
 * Усі можливі ключі під якими збережені min/max/skip у SQLite для цього офера.
 * Після batchUpdate DMarket інколи повертає лише { id, assetId } — без itemId/type;
 * prune має вважати валідними і offer id, і asset id, щоб не стерти правила.
 */
export function collectOfferRuleKeyAliases(offer) {
    const ids = new Set();
    if (!offer || typeof offer !== 'object') return ids;
    for (const key of [
        offer.itemId,
        offer.extra?.assetId,
        offer.assetId,
        offer.extra?.offerId,
        offer.offerId,
        offer.instantOfferId,
        offer.id
    ]) {
        if (key != null && key !== '') ids.add(String(key));
    }
    const oid = getOfferId(offer);
    const rid = getOfferRuleId(offer);
    if (oid != null && oid !== '') ids.add(String(oid));
    if (rid != null && rid !== '') ids.add(String(rid));
    return ids;
}

export function getOfferTitle(offer, fallback = 'Невідомий офер') {
    return offer?.title || offer?.extra?.name || offer?.attributes?.title || fallback;
}

export function useOffers({ addLog, addTransaction } = {}) {
    const { client } = useAuth();
    const [offers, setOffers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const previousOffersRef = useRef([]);
    const offersRef = useRef(offers);
    const loadingRef = useRef(false);

    const apiService = useMemo(() => (client ? new ApiService(client) : null), [client]);

    const loadOffers = useCallback(async () => {
        if (!apiService || loadingRef.current) return undefined;

        loadingRef.current = true;
        setLoading(true);
        setError(null);

        try {
            const response = await apiService.getUserOffers({
                currency: 'USD',
                gameId: 'a8db',
                limit: 100
            });
            const objects = response?.objects || [];
            const offersList = objects.filter((obj) => {
                if (!obj) return false;
                if (obj.type === 'offer') return true;
                if (obj.type && obj.type !== 'offer') return false;
                // Після batchUpdate GET інколи повертає записи без type, лише id + assetId
                return Boolean(
                    obj.assetId &&
                        (obj.id || obj.itemId || obj.offerId || obj.extra?.offerId)
                );
            });

            const previousOffers = previousOffersRef.current;
            if (previousOffers.length > 0) {
                const currentIds = new Set();
                for (const o of offersList) {
                    for (const alias of collectOfferRuleKeyAliases(o)) {
                        currentIds.add(alias);
                    }
                }
                const sold = previousOffers.filter((prev) => {
                    const prevAliases = collectOfferRuleKeyAliases(prev);
                    if (prevAliases.size === 0) return false;
                    const stillThere = [...prevAliases].some((id) => currentIds.has(id));
                    return !stillThere;
                });

                sold.forEach((soldOffer) => {
                    const title =
                        soldOffer.title || soldOffer.extra?.name || 'Unknown Item';
                    const price =
                        soldOffer.price?.USD || soldOffer.price?.amount || soldOffer.price || '0';
                    const assetId =
                        soldOffer.itemId || soldOffer.details?.itemId || soldOffer.extra?.itemId;
                    let amount = 0;
                    if (typeof price === 'string') {
                        const cents = parseFloat(price);
                        amount = cents >= 10 ? cents / 100 : cents;
                    } else if (typeof price === 'number') {
                        amount = price >= 10 ? price / 100 : price;
                    }

                    if (addTransaction) {
                        addTransaction({
                            type: 'sale',
                            itemTitle: title,
                            assetId,
                            amount,
                            createdAt: new Date().toISOString(),
                            soldAt: new Date().toISOString()
                        });
                    }
                    if (addLog) {
                        addLog({
                            type: 'success',
                            category: 'offer',
                            message: `Предмет продано: ${title}`,
                            details: { title, amount: amount.toFixed(2) }
                        });
                    }
                });
            }

            previousOffersRef.current = offersList;
            offersRef.current = offersList;
            setOffers(offersList);
            return offersList;
        } catch (err) {
            setError(err.message);
            console.error('Error loading offers:', err);
            return undefined;
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    }, [apiService, addLog, addTransaction]);

    return { offers, loading, error, loadOffers, offersRef, apiService };
}
