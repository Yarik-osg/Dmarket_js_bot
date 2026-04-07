import { useState, useEffect, useRef } from 'react';
import { marketItemMatchesOfferWearAndPhase } from '../utils/offerMarketMatch.js';
import { formatUsdFromApiCents } from '../utils/formatUsd.js';
import { getOfferId } from './useOffers.js';


export function useOfferMarketPrices({ apiService, offers, loading }) {
    const [marketPrices, setMarketPrices] = useState({});
    const [loadingMarketPrices, setLoadingMarketPrices] = useState(false);
    const loadingRef = useRef(false);
    const lastOffersRef = useRef([]);

    useEffect(() => {
        const load = async () => {
            if (!apiService || offers.length === 0 || loadingRef.current) return;

            const currentIds = offers.map((o) => getOfferId(o)).join(',');
            const lastIds = lastOffersRef.current.map((o) => getOfferId(o)).join(',');
            if (currentIds === lastIds && lastOffersRef.current.length > 0) return;

            loadingRef.current = true;
            setLoadingMarketPrices(true);
            lastOffersRef.current = offers;

            try {
                const prices = {};
                for (const offer of offers) {
                    try {
                        const offerId = getOfferId(offer);
                        const title = offer.title || offer.extra?.name || offer.attributes?.title;
                        const gameId = offer.gameId || 'a8db';
                        if (!title || !offerId) continue;

                        const marketData = await apiService.getMarketItems({
                            gameId,
                            title,
                            currency: 'USD',
                            limit: 300
                        });

                        if (marketData?.objects?.length > 0) {
                            const filtered = marketData.objects.filter((item) =>
                                marketItemMatchesOfferWearAndPhase(offer, item)
                            );
                            const ranked = filtered
                                .map((item) => {
                                    const raw = item.price?.USD || item.price?.amount || item.price;
                                    const str =
                                        raw === undefined || raw === null
                                            ? ''
                                            : String(raw).trim();
                                    let cents;
                                    if (str.includes('.') || /e/i.test(str)) {
                                        cents = Math.round(parseFloat(str) * 100);
                                    } else {
                                        cents = parseInt(str, 10);
                                    }
                                    return { raw, cents };
                                })
                                .filter((x) => x.cents > 0 && !Number.isNaN(x.cents))
                                .sort((a, b) => a.cents - b.cents);

                            if (ranked.length > 0) {
                                prices[offerId] = formatUsdFromApiCents(ranked[0].raw);
                            }
                        }
                    } catch (err) {
                        console.error(
                            `Error loading market prices for offer ${getOfferId(offer)}:`,
                            err
                        );
                    }
                }
                setMarketPrices(prices);

            } finally {
                loadingRef.current = false;
                setLoadingMarketPrices(false);
            }
        };

        if (offers.length > 0 && apiService && !loading) {
            load();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offers.length, apiService, loading]);

    return { marketPrices, loadingMarketPrices };
}
