import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { useLogs } from '../contexts/LogsContext.jsx';
import { ApiService } from '../services/apiService.js';
import OfferForm from './OfferForm.jsx';
import '../styles/OffersList.css';

function OffersList({ isAutoUpdatingEnabled = false, onToggleAutoUpdate }) {
    const { t } = useLocale();
    const { client } = useAuth();
    const { addLog } = useLogs();
    const [offers, setOffers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [marketPrices, setMarketPrices] = useState({});
    const [loadingMarketPrices, setLoadingMarketPrices] = useState(false);
    // Load minPrices from localStorage on mount
    const [minPrices, setMinPrices] = useState(() => {
        try {
            const saved = localStorage.getItem('offersMinPrices');
            return saved ? JSON.parse(saved) : {};
        } catch (err) {
            console.error('Error loading minPrices from localStorage:', err);
            return {};
        }
    });
    const [pendingMinPrices, setPendingMinPrices] = useState({}); // Store pending min prices before applying
    const loadingPricesRef = useRef(false);
    const lastOffersRef = useRef([]);
    const [showOfferForm, setShowOfferForm] = useState(false);
    const autoUpdateIntervalRef = useRef(null);
    const isAutoUpdatingRef = useRef(false);
    const offersRef = useRef(offers);
    const minPricesRef = useRef({}); // Keep minPrices in ref to prevent loss during updates

    // Memoize apiService to prevent recreation on every render
    const apiService = useMemo(() => {
        return client ? new ApiService(client) : null;
    }, [client]);


    const loadOffers = useCallback(async () => {
        if (!apiService || loading) return; // Prevent concurrent calls

        // Save current minPrices before loading new offers
        try {
            const currentMinPrices = minPricesRef.current || minPrices;
            if (Object.keys(currentMinPrices).length > 0) {
                localStorage.setItem('offersMinPrices', JSON.stringify(currentMinPrices));
                console.log('Saved minPrices before loadOffers:', currentMinPrices);
            }
        } catch (err) {
            console.error('Error saving minPrices before loadOffers:', err);
        }

        setLoading(true);
        setError(null);

        try {
            const response = await apiService.getUserOffers({ currency: 'USD', gameId: 'a8db', limit: 100 });
            // API returns { objects: [...], cursor: "...", total: {...} }
            // Filter only offers (type === 'offer')
            const offersList = response?.objects?.filter(obj => obj.type === 'offer') || [];
            console.log('Loaded offers:', offersList.length, offersList);
            setOffers(offersList);
            
            // minPrices will be restored by useEffect when offers change
            // No need to restore here as useEffect will handle it automatically
        } catch (err) {
            setError(err.message);
            console.error('Error loading offers:', err);
        } finally {
            setLoading(false);
        }
    }, [apiService, loading, minPrices]);

    useEffect(() => {
        // Load initial offers only once when component mounts and client is available
        if (client && !loading) {
            loadOffers();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client]); // Only depend on client, not loadOffers

    // Load market prices (cheapest sell orders) when offers change
    useEffect(() => {
        const loadMarketPrices = async () => {
            if (!apiService || offers.length === 0 || loadingPricesRef.current) return;
            
            // Check if offers actually changed
            const offersChanged = JSON.stringify(offers.map(o => o.itemId || o.offerId || o.instantOfferId)) !== 
                                  JSON.stringify(lastOffersRef.current.map(o => o.itemId || o.offerId || o.instantOfferId));
            
            if (!offersChanged && lastOffersRef.current.length > 0) return;

            loadingPricesRef.current = true;
            setLoadingMarketPrices(true);
            lastOffersRef.current = offers;

            try {
                const prices = {}; // Store cheapest sell order prices for each offer
                
                for (const offer of offers) {
                    try {
                        const offerId = offer.extra?.offerId || offer.itemId || offer.offerId || offer.instantOfferId;
                        const title = offer.title || offer.extra?.name || offer.attributes?.title;
                        const gameId = offer.gameId || 'a8db';

                        if (!title || !offerId) continue;
                        // Get market items (sell orders) for this item to find cheapest price
                        const marketData = await apiService.getMarketItems({
                            gameId: gameId,
                            title: title,
                            currency: 'USD',
                            limit: 300
                        });

                       
                        // API returns { objects: [...] } structure
                        if (marketData?.objects && marketData.objects.length > 0) {
                            // Get offer's floatPartValue for filtering (if available)
                            const offerFloatValue = offer.extra?.floatPartValue || offer.attributes?.floatPartValue;

                            // Filter items by floatPartValue: match offer's floatPartValue or 'any' (empty string)
                            const filteredItems = marketData.objects.filter(item => {
                                if (!offerFloatValue || offerFloatValue === '') {
                                    // If offer has no float filter, accept all items
                                    return true;
                                }
                                const itemFloatValue = item.attributes?.floatPartValue || item.extra?.floatPartValue;
                                // Accept if floatPartValue matches offer's value or is empty (any)
                                return itemFloatValue === '' || 
                                       itemFloatValue === offerFloatValue;
                            });
                            // Find lowest price (cheapest sell order)
                            const itemPrices = filteredItems
                                .map(item => {
                                    // Price can be in different formats: { USD: "64.00" } or { amount: "6400" } or just a number/string
                                    const price = item.price?.USD || item.price?.amount || item.price;
                                    return parseFloat(price || 0);
                                })
                                .filter(price => price > 0 && !isNaN(price))
                                .sort((a, b) => a - b); // Sort ascending to get lowest price

                            if (itemPrices.length > 0) {
                                const cheapestPrice = itemPrices[0]; // Lowest price (cheapest sell order)

                                // Format price: if price is likely in cents (>= 1), format as cents
                                // Otherwise, format as decimal with 2 decimal places
                                let formattedPrice;
                                const priceStr = Math.round(cheapestPrice).toString();
                                formattedPrice = priceStr.length >= 2 
                                    ? priceStr.slice(0, -2) + '.' + priceStr.slice(-2)
                                    : '0.' + priceStr.padStart(2, '0');
                                prices[offerId] = formattedPrice;
                            }
                        }
                    } catch (err) {
                        console.error(`Error loading market prices for offer ${offer.itemId || offer.offerId}:`, err);
                    }
                }

                setMarketPrices(prices);
            } finally {
                loadingPricesRef.current = false;
                setLoadingMarketPrices(false);
            }
        };

        if (offers.length > 0 && apiService && !loading) {
            loadMarketPrices();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offers.length, apiService, loading]); // Only depend on length and apiService, not the full offers array

    const handleRefresh = async () => {
        await loadOffers();
    };

    // Calculate fee percentage based on offer's fees and price
    const getFeePercentage = useCallback((offer, price) => {
        if (!offer || !offer.fees || !offer.fees.dmarket || !offer.fees.dmarket.sell) {
            return 10; // Default fee if no fees info
        }

        const sellFees = offer.fees.dmarket.sell;
        
        // If no custom field exists, use default
        if (!sellFees.custom) {
            return parseFloat(sellFees.default?.percentage || 10);
        }

        // Check if custom fee conditions are met
        const custom = sellFees.custom;
        const conditions = custom.conditions || {};
        const priceInCents = Math.round(parseFloat(price) * 100); // Convert to cents
        const currentTime = Math.floor(Date.now() / 1000); // Current timestamp in seconds
        const minPrice = parseFloat(conditions.minPrice?.USD || 0);
        const maxPrice = parseFloat(conditions.maxPrice?.USD || Infinity);
        const startsAt = conditions.startsAt || 0;
        const expiresAt = conditions.expiresAt || Infinity;

        // Check if price is within range and time is valid
        if (priceInCents >= minPrice && priceInCents <= maxPrice &&
            currentTime >= startsAt && currentTime <= expiresAt) {
            return parseFloat(custom.percentage || 10);
        }

        // Use default fee if custom doesn't apply
        return parseFloat(sellFees.default?.percentage || 10);
    }, []);

    // Helper function to determine if custom fee applies
    const isCustomFeeApplicable = useCallback((offer, price) => {
        if (!offer?.fees?.dmarket?.sell?.custom) {
            return false; // No custom field, use default
        }

        const custom = offer.fees.dmarket.sell.custom;
        const conditions = custom.conditions || {};
        const priceInCents = Math.round(parseFloat(price) * 100);
        const currentTime = Math.floor(Date.now() / 1000);
        const minPrice = parseFloat(conditions.minPrice?.USD || 0);
        const maxPrice = parseFloat(conditions.maxPrice?.USD || Infinity);
        const startsAt = conditions.startsAt || 0;
        const expiresAt = conditions.expiresAt || Infinity;

        return priceInCents >= minPrice && priceInCents <= maxPrice &&
               currentTime >= startsAt && currentTime <= expiresAt;
    }, []);

    // Calculate amount after fee (considering minFee)
    const calculateYouGet = useCallback((offer, price) => {
        const priceNum = parseFloat(price) || 0;
        if (priceNum <= 0) return '0.00';

        const feePercentage = getFeePercentage(offer, price);
        const priceInCents = Math.round(priceNum * 100);
        
        // Get minFee - use custom if applicable, otherwise default
        let minFee = 0;
        if (isCustomFeeApplicable(offer, price)) {
            minFee = parseFloat(offer.fees.dmarket.sell.custom.minFee?.USD || 0);
        } else if (offer?.fees?.dmarket?.sell?.default) {
            minFee = parseFloat(offer.fees.dmarket.sell.default.minFee?.USD || 0);
        }

        // Calculate fee amount
        const feeAmount = Math.max(
            Math.round(priceInCents * feePercentage / 100),
            minFee
        );

        // Calculate amount after fee
        const youGetCents = priceInCents - feeAmount;
        return (youGetCents / 100).toFixed(2);
    }, [getFeePercentage, isCustomFeeApplicable]);

    // Calculate selling price with fee (if you want to get X, what price to set)
    const calculatePriceWithFee = useCallback((offer, priceAfterFee) => {
        const priceNum = parseFloat(priceAfterFee) || 0;
        if (priceNum <= 0) return '0.00';

        const feePercentage = getFeePercentage(offer, priceAfterFee);
        const priceAfterFeeInCents = Math.round(priceNum * 100);
        
        // Get minFee
        let minFee = 0;
        if (isCustomFeeApplicable(offer, priceAfterFee)) {
            minFee = parseFloat(offer.fees.dmarket.sell.custom.minFee?.USD || 0);
        } else if (offer?.fees?.dmarket?.sell?.default) {
            minFee = parseFloat(offer.fees.dmarket.sell.default.minFee?.USD || 0);
        }

        // If we want to get priceAfterFee, what selling price should we set?
        // Formula: sellingPrice - max(sellingPrice * feePercentage/100, minFee) = priceAfterFee
        // We need to solve for sellingPrice
        
        // First, try assuming fee = sellingPrice * feePercentage/100 (not minFee)
        // sellingPrice * (1 - feePercentage/100) = priceAfterFee
        let sellingPriceCents = Math.round(priceAfterFeeInCents / (1 - feePercentage / 100));
        
        // Check if this price would result in fee >= minFee
        const calculatedFee = Math.round(sellingPriceCents * feePercentage / 100);
        
        if (calculatedFee < minFee) {
            // If calculated fee is less than minFee, then fee = minFee
            // sellingPrice - minFee = priceAfterFee
            sellingPriceCents = priceAfterFeeInCents + minFee;
        } else {
            // Try different rounding to find the price that gives exactly priceAfterFee
            // Start with rounded value and check
            let testPrice = Math.round(priceAfterFeeInCents / (1 - feePercentage / 100));
            let bestPrice = testPrice;
            
            // Test a few values around the calculated price
            for (let i = -2; i <= 2; i++) {
                const testPriceCents = testPrice + i;
                const testFee = Math.max(
                    Math.round(testPriceCents * feePercentage / 100),
                    minFee
                );
                const testYouGet = testPriceCents - testFee;
                
                if (testYouGet >= priceAfterFeeInCents && testYouGet < priceAfterFeeInCents + 2) {
                    bestPrice = testPriceCents;
                    break;
                }
            }
            
            sellingPriceCents = bestPrice;
        }
        
        return (sellingPriceCents / 100).toFixed(2);
    }, [getFeePercentage, isCustomFeeApplicable]);

    // Update offersRef when offers change
    useEffect(() => {
        offersRef.current = offers;
    }, [offers]);

    // Auto-update offer prices: find lowest price from other offers and set 1 cent lower (but not less than minPrice)
    const autoUpdateOfferPrices = useCallback(async () => {
        const currentOffers = offersRef.current;
        const currentMinPrices = minPricesRef.current || minPrices;
        if (!apiService || currentOffers.length === 0 || loading || isAutoUpdatingRef.current) return;

        isAutoUpdatingRef.current = true;
        setLoading(true);
        try {
            // Collect all owner IDs from all our current offers ONCE before the loop
            // This ensures all our offers (regardless of count: 2, 3, 4, etc.) are excluded
            const ourOwnerIds = new Set();
            const ourOfferIds = new Set(); // Also collect all our offer IDs for faster comparison
            currentOffers.forEach(o => {
                const ownerId = o.owner || o.ownerDetails?.id;
                if (ownerId) {
                    ourOwnerIds.add(ownerId);
                }
                // Collect all possible offer identifiers
                const offerId = o.extra?.offerId || o.itemId || o.offerId || o.instantOfferId;
                if (offerId) {
                    ourOfferIds.add(offerId);
                }
                if (o.itemId) {
                    ourOfferIds.add(o.itemId);
                }
            });
            
            console.log('Collected owner IDs to exclude:', Array.from(ourOwnerIds));
            console.log('Collected offer IDs to exclude:', Array.from(ourOfferIds));
            
            for (let i = 0; i < currentOffers.length; i++) {
                const offer = currentOffers[i];
                try {
                    // Add delay between updates to avoid conflicts
                    if (i > 0) {
                        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay between updates
                    }
                    // Use consistent identifier for minPrices lookup - use itemId as it's stable
                    const offerId = offer.extra?.offerId || offer.itemId || offer.offerId || offer.instantOfferId;
                    // Try multiple possible locations for AssetID
                    const itemId = offer.itemId; // itemId is stable and doesn't change after update
                    const assetId = offer.itemId;
                    const title = offer.title || offer.extra?.name;
                    const gameId = offer.gameId || 'a8db';
                    // Get minPrice from saved values using itemId (stable identifier)
                    // Use ref to get latest value
                    const minPrice = currentMinPrices[itemId] || offer.minPrice;

                    if (!title || !offerId || !minPrice) continue;
                    if (!assetId) {
                        console.warn('No assetId found for offer', offerId, 'skipping update');
                        continue;
                    }

                    // Get market items (sell orders/offers) for this item
                    const marketData = await apiService.getMarketItems({
                        gameId: gameId,
                        title: title,
                        currency: 'USD',
                        limit: 300
                    });

                    if (marketData?.objects && marketData.objects.length > 0) {
                        // Get offer's floatPartValue for filtering
                        const offerFloatValue = offer.extra?.floatPartValue || offer.attributes?.floatPartValue;
                        
                        // Filter items by floatPartValue
                        const filteredItems = marketData.objects.filter(item => {
                            if (!offerFloatValue || offerFloatValue === '') {
                                return true;
                            }
                            const itemFloatValue = item.attributes?.floatPartValue || item.extra?.floatPartValue;
                            return itemFloatValue === '' || itemFloatValue === offerFloatValue;
                        });

                        // Convert minPrice to cents for comparison
                        const minPriceCents = parseFloat(minPrice) * 100;
                        
                        // Find lowest price from offers that are >= minPrice (excluding all our own offers)
                        // Use consistent identifier logic for comparison and owner ID check
                        const otherOfferPrices = filteredItems
                            .filter(item => {
                                // Get all possible identifiers for the market item
                                const itemOfferId = item.extra?.offerId || item.itemId || item.offerId || item.instantOfferId;
                                
                                // Check if this is our offer by comparing identifiers (check against ALL our offers)
                                const isOurOfferById = ourOfferIds.has(itemOfferId) || 
                                                  (item.itemId && ourOfferIds.has(item.itemId));
                                
                                // Check if this is our offer by comparing owner ID (check against ALL our owner IDs)
                                const itemOwnerId = item.owner || item.ownerDetails?.id;
                                const isOurOfferByOwner = itemOwnerId && ourOwnerIds.has(itemOwnerId);
                                
                                const isOurOffer = isOurOfferById || isOurOfferByOwner;
                                
                                if (isOurOffer) {
                                    console.log(`Excluding our own offer: itemOfferId=${itemOfferId}, item.itemId=${item.itemId}, itemOwnerId=${itemOwnerId}`);
                                }
                                return !isOurOffer; // Exclude all our own offers
                            })
                            .map(item => {
                                const price = item.price?.USD || item.price?.amount || item.price;
                                // Convert to cents
                                if (typeof price === 'string') {
                                    // Price from getMarketItems is usually in cents format (e.g., "5000")
                                    // But could also be decimal (e.g., "50.00")
                                    const parsed = parseFloat(price);
                                    // If price looks like cents (>= 10), use as is; otherwise assume dollars
                                    return parsed >= 10 ? parsed : parsed * 100;
                                }
                                // If number, assume cents if >= 10, otherwise dollars
                                return price >= 10 ? price : price * 100;
                            })
                            .filter(price => price > 0 && !isNaN(price) && price >= minPriceCents) // Only offers >= minPrice
                            .sort((a, b) => a - b); // Sort ascending

                        if (otherOfferPrices.length > 0) {
                            const lowestPrice = otherOfferPrices[0]; // Lowest price in range (>= minPrice) in cents
                            
                            // Set price 1 cent lower than lowest offer in range, but not less than minPrice
                            let newPriceCents = lowestPrice - 1; // 1 cent lower
                            if (newPriceCents < minPriceCents) {
                                newPriceCents = minPriceCents; // Don't go below minPrice
                            }

                            // Convert to dollars for API (decimal format)
                            const newPrice = (newPriceCents / 100).toFixed(2);
                            const newPriceFloat = parseFloat(newPrice);
                            
                            // Get current offer price and convert to decimal format (dollars)
                            let currentPriceFloat = null;
                            const currentPrice = offer.price?.USD || offer.price?.amount || offer.price;
                            if (currentPrice !== undefined && currentPrice !== null && currentPrice !== 'N/A') {
                                if (typeof currentPrice === 'string') {
                                    // If price is in cents string (e.g., "5000"), convert to decimal "50.00"
                                    const cents = parseFloat(currentPrice);
                                    if (!isNaN(cents)) {
                                        // If the number is >= 10, assume it's already in dollars, otherwise it's in cents
                                        currentPriceFloat = cents >= 10 ? cents : cents / 100;
                                    }
                                } else if (typeof currentPrice === 'number') {
                                    // If number is >= 10, assume it's already in dollars, otherwise it's in cents
                                    currentPriceFloat = currentPrice >= 10 ? currentPrice : currentPrice / 100;
                                }
                            }
                            
                            // Skip update if new price equals current price (to avoid API error)
                            if (currentPriceFloat !== null && Math.abs(newPriceFloat - currentPriceFloat) < 0.01) {
                                console.log(`Skipping update for ${title}: new price ${newPriceFloat} equals current price ${currentPriceFloat.toFixed(2)}`);
                                continue;
                            }
                            
                            // Get currency from offer - check which currency field is present
                            // offer.price can be { USD: "...", DMC: "..." } or { currency: "...", amount: "..." }
                            
                            // Update offer price
                            console.log('=== UPDATE OFFER ===');
                            console.log('title:', title);
                            console.log('offerId:', offerId);
                            console.log('assetId:', assetId);
                            console.log('currentPrice:', currentPriceFloat !== null ? currentPriceFloat.toFixed(2) : 'N/A');
                            console.log('newPrice:', newPriceFloat);
                            console.log('full offer object:', offer);
                            console.log('offer.extra:', offer.extra);
                            try {
                                const response = await apiService.updateOffer(offerId, itemId, {
                                    Price: { Amount: newPriceFloat, Currency: 'USD' }
                                });
                                
                                // Double-check response for errors even if no exception was thrown
                                if (response && response.Result && Array.isArray(response.Result)) {
                                    for (const resultItem of response.Result) {
                                        const items = Array.isArray(resultItem) ? resultItem : [resultItem];
                                        for (const item of items) {
                                            if (item.Error || item.Successful === false) {
                                                const errorCode = item.Error?.Code || item.Code || 'UnknownError';
                                                const errorMessage = item.Error?.Message || item.Message || 'Помилка оновлення офера';
                                                throw { errorCode, message: errorMessage, result: item };
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
                                        oldPrice: currentPriceFloat !== null ? currentPriceFloat.toFixed(2) : 'N/A',
                                        newPrice: newPriceFloat.toFixed(2),
                                        lowestPrice: (lowestPrice / 100).toFixed(2),
                                        minPrice: minPrice
                                    }
                                });
                            } catch (updateErr) {
                                // Handle offer update errors (e.g., "New offer has same price and fees")
                                const errorCode = updateErr.errorCode || 'UnknownError';
                                const errorMessage = updateErr.message || 'Помилка оновлення офера';
                                addLog({
                                    type: 'warning',
                                    category: 'parsing',
                                    message: `Не вдалося оновити офер: ${title} (${errorCode})`,
                                    details: {
                                        title,
                                        offerId,
                                        itemId,
                                        errorCode,
                                        errorMessage,
                                        oldPrice: currentPriceFloat !== null ? currentPriceFloat.toFixed(2) : 'N/A',
                                        newPrice: newPriceFloat.toFixed(2)
                                    }
                                });
                                console.warn(`Failed to update offer ${offerId}:`, errorCode, errorMessage);
                                // Don't throw - continue with next offer
                            }
                        }
                    }
                } catch (err) {
                    console.error(`Error auto-updating offer ${offer.itemId || offer.offerId}:`, err);
                    const title = offer.title || 'Невідомий офер';
                    addLog({
                        type: 'error',
                        category: 'parsing',
                        message: `Помилка оновлення ціни офера: ${title}`,
                        details: {
                            title,
                            offerId: offer.extra?.offerId || offer.itemId || offer.offerId,
                            error: err.message
                        }
                    });
                }
            }
            
            // Save minPrices to localStorage before reloading offers
            // Use both ref and state to ensure we have the latest values
            try {
                const currentMinPrices = minPricesRef.current || minPrices;
                if (Object.keys(currentMinPrices).length > 0) {
                    localStorage.setItem('offersMinPrices', JSON.stringify(currentMinPrices));
                    console.log('Saved minPrices to localStorage before reload:', currentMinPrices);
                    // Update ref to ensure it's synced
                    minPricesRef.current = currentMinPrices;
                } else {
                    console.warn('No minPrices to save before reload');
                }
            } catch (err) {
                console.error('Error saving minPrices before reload:', err);
            }
            
            // Reload offers after update (with delay to avoid infinite loop)
            await new Promise(resolve => setTimeout(resolve, 1000));
            await loadOffers();
        } catch (err) {
            console.error('Error in auto-update offer prices:', err);
        } finally {
            setLoading(false);
            isAutoUpdatingRef.current = false;
        }
    }, [apiService, loading, loadOffers]); // Remove minPrices from dependencies, use minPricesRef instead

    // Update minPricesRef when minPrices change
    useEffect(() => {
        minPricesRef.current = minPrices;
    }, [minPrices]);

    // Restore minPrices from localStorage when offers change
    // This ensures minPrices are always restored after offers are loaded
    useEffect(() => {
        if (offers.length > 0) {
            // Always restore from localStorage when offers change (localStorage is source of truth)
            try {
                const saved = localStorage.getItem('offersMinPrices');
                if (saved) {
                    const savedMinPrices = JSON.parse(saved);
                    console.log('Restoring minPrices from localStorage (useEffect):', savedMinPrices);
                    // Always use localStorage as source of truth to prevent data loss
                    setMinPrices(savedMinPrices);
                    minPricesRef.current = savedMinPrices;
                } else {
                    console.log('No saved minPrices in localStorage');
                }
            } catch (err) {
                console.error('Error restoring minPrices from localStorage (useEffect):', err);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offers.length]); // Only run when offers.length changes

    // Save minPrices to localStorage whenever they change
    // This ensures minPrices are always persisted and never lost
    useEffect(() => {
        if (Object.keys(minPrices).length > 0) {
            try {
                localStorage.setItem('offersMinPrices', JSON.stringify(minPrices));
                console.log('Saved minPrices to localStorage:', minPrices);
            } catch (err) {
                console.error('Error saving minPrices to localStorage:', err);
            }
        }
    }, [minPrices]);

    // Use toggle function from props if provided, otherwise use local state (for backward compatibility)
    const toggleAutoUpdate = onToggleAutoUpdate || (() => {
        console.warn('onToggleAutoUpdate not provided to OffersList');
    });

    // Start auto-update interval (every minute) - only when enabled
    useEffect(() => {
        if (!apiService || offers.length === 0 || !isAutoUpdatingEnabled) {
            // Clear interval if disabled
            if (autoUpdateIntervalRef.current) {
                clearInterval(autoUpdateIntervalRef.current);
                autoUpdateIntervalRef.current = null;
                addLog({
                    type: 'info',
                    category: 'parsing',
                    message: 'Парсинг оферів зупинено',
                    details: { offersCount: offers.length }
                });
            }
            return;
        }

        // Clear any existing interval
        if (autoUpdateIntervalRef.current) {
            clearInterval(autoUpdateIntervalRef.current);
        }

        // Start interval for auto-update
        console.log('Starting auto-update interval');
        addLog({
            type: 'success',
            category: 'parsing',
            message: 'Парсинг оферів запущено',
            details: { offersCount: offers.length, interval: '1 хвилина' }
        });
        autoUpdateIntervalRef.current = setInterval(() => {
            if (!isAutoUpdatingRef.current) {
                console.log('autoUpdateOfferPrices triggered');
                autoUpdateOfferPrices();
            }
        }, 60000); // 60 seconds = 1 minute

        return () => {
            if (autoUpdateIntervalRef.current) {
                clearInterval(autoUpdateIntervalRef.current);
                autoUpdateIntervalRef.current = null;
            }
        };
    }, [apiService, offers.length, isAutoUpdatingEnabled, autoUpdateOfferPrices, addLog]); // Don't depend on autoUpdateOfferPrices to avoid recreation

    const handleApplyMinPrice = async (itemId) => {
        const pendingPrice = pendingMinPrices[itemId];
        if (!pendingPrice || !itemId) {
            console.warn('handleApplyMinPrice: missing pendingPrice or itemId', { pendingPrice, itemId });
            return;
        }

        try {
            setLoading(true);
            // Note: API might not support minPrice update directly, so we store it locally
            // If API supports it, uncomment the following:
            // await apiService.updateOffer(offerId, {
            //     minPrice: parseFloat(pendingPrice)
            // });
            
            // Update minPrices with applied value using itemId (stable identifier)
            // Will be saved to localStorage automatically
            console.log('Applying minPrice:', { itemId, pendingPrice, currentMinPrices: minPrices });
            setMinPrices(prev => {
                const updated = {
                    ...prev,
                    [itemId]: pendingPrice
                };
                console.log('Updated minPrices:', updated);
                return updated;
            });
            // Clear pending value
            setPendingMinPrices(prev => {
                const newPending = { ...prev };
                delete newPending[itemId];
                return newPending;
            });
            // Reload offers to get updated data (if API supports minPrice)
            // await loadOffers();
            const offer = offers.find(o => o.itemId === itemId);
            const title = offer?.title || 'Невідомий офер';
            addLog({
                type: 'success',
                category: 'offer',
                message: `Мінімальна ціна встановлена: ${title}`,
                details: { title, itemId, minPrice: pendingPrice }
            });
        } catch (err) {
            console.error('Error applying minPrice:', err);
            const offer = offers.find(o => o.itemId === itemId);
            const title = offer?.title || 'Невідомий офер';
            addLog({
                type: 'error',
                category: 'offer',
                message: `Помилка застосування мінімальної ціни: ${title}`,
                details: { title, itemId, error: err.message }
            });
            alert('Помилка застосування мінімальної ціни: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (offer) => {
        const offerId = offer.extra?.offerId || offer.itemId || offer.offerId || offer.instantOfferId;
        const title = offer.title || 'Невідомий офер';
        if (!offerId) {
            alert('Неможливо видалити: ID не знайдено');
            return;
        }
        if (window.confirm('Ви впевнені, що хочете видалити цей офер?')) {
            try {
                setLoading(true);
                await apiService.deleteOffer(offer);
                addLog({
                    type: 'success',
                    category: 'offer',
                    message: `Офер видалено: ${title}`,
                    details: { offerId, title }
                });
                // Wait a bit before reloading to ensure API has processed the deletion
                await new Promise(resolve => setTimeout(resolve, 1000));
                await loadOffers();
            } catch (err) {
                addLog({
                    type: 'error',
                    category: 'offer',
                    message: `Помилка видалення офера: ${title}`,
                    details: { offerId, title, error: err.message }
                });
                setError('Помилка видалення офера: ' + err.message);
                console.error('Error deleting offer:', err);
            } finally {
                setLoading(false);
            }
        }
    };


    const filteredOffers = offers.filter(offer => {
        // API returns title directly, not in attributes
        const title = offer.title || offer.extra?.name || offer.attributes?.title || '';
        return title.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
        <div className="offers-list">
            <div className="offers-header">
                <h1 className="offers-title">{t('offers.title')}</h1>
                <div className="offers-actions">
                    <input
                        type="text"
                        placeholder={t('offers.search')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="offers-search"
                    />
                    <button onClick={() => setShowOfferForm(true)} className="btn btn-primary">
                        Створити офери
                    </button>
                    <button onClick={handleRefresh} className="btn btn-secondary">
                        {t('offers.refresh')}
                    </button>
                </div>
            </div>

            {loading && <div className="loading">{t('offers.loading')}</div>}
            {error && <div className="error">{t('offers.error')}: {error}</div>}
            {loadingMarketPrices && <div className="loading" style={{ fontSize: '12px', marginTop: '5px' }}>Завантаження ринкових цін...</div>}

            <div className="offers-table-container">
                <table className="offers-table">
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>Предмет</th>
                            <th>Ціна</th>
                            <th>Ринкова ціна</th>
                            <th>Мін.</th>
                            <th>Float</th>
                            <th>Дії</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredOffers.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="empty-state">
                                    {t('offers.empty')}
                                </td>
                            </tr>
                        ) : (
                            filteredOffers.map((offer, index) => {
                                // Use consistent identifier logic - same as in autoUpdateOfferPrices
                                const offerId = offer.extra?.offerId || offer.itemId || offer.offerId || offer.instantOfferId;
                                const itemId = offer.itemId; // Use itemId for minPrice (stable identifier)
                                const title = offer.title || t('target.unknownItem');
                                const price = offer.price?.USD || 'N/A';
                                // Format price from cents: "3" -> "0.03", "50" -> "0.50", "6400" -> "64.00"
                                const formattedPrice = typeof price === 'string' && price !== 'N/A' 
                                    ? (price.length >= 2 ? price.slice(0, -2) + '.' + price.slice(-2) : '0.' + price.padStart(2, '0'))
                                    : price;
                                const floatValue = offer.extra?.floatValue ? parseFloat(offer.extra.floatValue).toFixed(5) : 'N/A';
                                const marketPrice = marketPrices[offerId] || (loadingMarketPrices ? '...' : 'N/A');
                                
                                // formattedPrice is the amount after fee (what we get)
                                // Calculate selling price with fee (what we need to set)
                                const priceWithFee = formattedPrice !== 'N/A' ? calculatePriceWithFee(offer, formattedPrice) : 'N/A';
                                const feePercentage = formattedPrice !== 'N/A' ? getFeePercentage(offer, formattedPrice) : null;
                                
                                return (
                                    <tr key={offerId || index}>
                                        <td>{index + 1}</td>
                                        <td>
                                            <div className="offer-item">
                                                {title}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="offer-price-cell">
                                                <div className="offer-price-main">
                                                    ${formattedPrice} <span className="offer-price-label">(без комісії)</span>
                                                </div>
                                                {priceWithFee !== 'N/A' && (
                                                    <div className="offer-price-after-fee">
                                                        ${priceWithFee} <span className="offer-fee-percentage">({feePercentage}%)</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td>{marketPrice}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                            <input
                                                type="number"
                                                    step="0.01"
                                                    min="0.01"
                                                    value={pendingMinPrices[itemId] !== undefined 
                                                        ? pendingMinPrices[itemId] 
                                                        : (minPrices[itemId] || offer.minPrice || '')}
                                                    onChange={(e) => {
                                                        const newMinPrice = e.target.value;
                                                        setPendingMinPrices(prev => ({
                                                            ...prev,
                                                            [itemId]: newMinPrice
                                                        }));
                                                    }}
                                                    className="min-price-input"
                                                    placeholder="Мін. ціна"
                                                />
                                                {pendingMinPrices[itemId] !== undefined && (
                                                    <button
                                                        onClick={() => handleApplyMinPrice(itemId)}
                                                        className="btn-icon"
                                                        title="Застосувати мінімальну ціну"
                                                        disabled={loading}
                                                    >
                                                        ✓
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td>{floatValue}</td>
                                        <td>
                                            <div className="offer-actions">
                                                <button 
                                                    className="btn-icon" 
                                                    onClick={() => handleDelete(offer)}
                                                    title="Видалити офер"
                                                >
                                                    🗑
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {showOfferForm && (
                <OfferForm
                    onClose={() => setShowOfferForm(false)}
                    onSave={() => {
                        setShowOfferForm(false);
                        loadOffers();
                    }}
                />
            )}
        </div>
    );
}

export default OffersList;

