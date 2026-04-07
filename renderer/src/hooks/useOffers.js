import { useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { ApiService } from '../services/apiService.js';

export function getOfferId(offer) {
    return offer.extra?.offerId || offer.itemId || offer.offerId || offer.instantOfferId;
}

export function getOfferTitle(offer, fallback = 'Невідомий офер') {
    return offer.title || offer.extra?.name || offer.attributes?.title || fallback;
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
            const offersList = response?.objects?.filter((obj) => obj.type === 'offer') || [];

            const previousOffers = previousOffersRef.current;
            if (previousOffers.length > 0) {
                const currentIds = new Set(offersList.map((o) => o.itemId || o.extra?.offerId));
                const sold = previousOffers.filter((prev) => {
                    const id = prev.itemId || prev.extra?.offerId;
                    return id && !currentIds.has(id);
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
