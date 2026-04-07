import { useState, useEffect, useRef } from 'react';
import { filterOrdersForTarget } from '../utils/targetOrdersFilter.js';
import { formatHighestBuyOrderPrice } from '../utils/buyOrderDisplay.js';
import { formatUsdFromApiCents } from '../utils/formatUsd.js';

/**
 * Fetches competing buy-order best prices per target row (for "market" column).
 */
export function useMarketBuyOrderPrices({ apiService, targets, loading }) {
    const [marketPrices, setMarketPrices] = useState({});
    const [loadingMarketPrices, setLoadingMarketPrices] = useState(false);
    const [authError, setAuthError] = useState(false);
    const loadingPricesRef = useRef(false);
    const lastTargetsRef = useRef([]);

    useEffect(() => {
        const loadMarketPrices = async () => {
            if (!apiService || targets.length === 0 || loadingPricesRef.current) return;

            loadingPricesRef.current = true;
            setLoadingMarketPrices(true);
            lastTargetsRef.current = targets;

            try {
                const prices = {};
                let unauthorizedCount = 0;

                for (const target of targets) {
                    try {
                        const targetId = target.targetId || target.itemId || target.instantTargetId;
                        const title =
                            target.itemTitle || target.title || target.attributes?.title || target.extra?.name;
                        const gameId = target.gameId || 'a8db';

                        if (!title || !targetId) continue;

                        const targetsData = await apiService.getTargetsByTitle(gameId, title);
                        if (targetsData?.orders && targetsData.orders.length > 0) {
                            const filteredOrders = filterOrdersForTarget(targetsData.orders, target);
                            const formatted = formatHighestBuyOrderPrice(
                                filteredOrders,
                                formatUsdFromApiCents
                            );
                            if (formatted) {
                                prices[targetId] = formatted;
                            }
                        }
                    } catch (err) {
                        if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
                            unauthorizedCount++;
                            if (unauthorizedCount === 1) {
                                console.warn(
                                    'Unauthorized access to targets-by-title endpoint. Check API credentials and permissions.'
                                );
                            }
                        } else {
                            console.error(
                                `Error loading buy orders for target ${target.targetId || target.itemId}:`,
                                err
                            );
                        }
                    }
                }

                if (unauthorizedCount > 0 && Object.keys(prices).length === 0) {
                    console.warn(
                        `Could not load buy order prices: ${unauthorizedCount} unauthorized request(s). The targets-by-title endpoint requires valid API authentication.`
                    );
                    setAuthError(true);
                } else if (unauthorizedCount === 0) {
                    setAuthError(false);
                }

                setMarketPrices(prices);
            } finally {
                loadingPricesRef.current = false;
                setLoadingMarketPrices(false);
            }
        };

        if (targets.length > 0 && apiService && !loading) {
            loadMarketPrices();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targets.length, apiService, loading]);

    return { marketPrices, loadingMarketPrices, authError };
}
