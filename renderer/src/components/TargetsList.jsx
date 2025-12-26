import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTargets } from '../hooks/useTargets.js';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLogs } from '../contexts/LogsContext.jsx';
import { ApiService } from '../services/apiService.js';
import TargetForm from './TargetForm.jsx';
import '../styles/TargetsList.css';

function TargetsList({ isAutoUpdatingEnabled = false, onToggleAutoUpdate }) {
    const { t } = useLocale();
    const { client } = useAuth();
    const { addLog } = useLogs();
    const { targets, loading, error, loadTargets, deleteTarget, updateTarget } = useTargets();
    const [searchQuery, setSearchQuery] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingTarget, setEditingTarget] = useState(null);
    const [marketPrices, setMarketPrices] = useState({});
    const [updating, setUpdating] = useState(false);
    const [loadingMarketPrices, setLoadingMarketPrices] = useState(false);
    const [authError, setAuthError] = useState(false);
    // Load maxPrices from localStorage on mount
    const [maxPrices, setMaxPrices] = useState(() => {
        try {
            const saved = localStorage.getItem('targetsMaxPrices');
            return saved ? JSON.parse(saved) : {};
        } catch (err) {
            console.error('Error loading maxPrices from localStorage:', err);
            return {};
        }
    });
    const [pendingMaxPrices, setPendingMaxPrices] = useState({}); // Store pending max prices before applying
    const [pendingAmounts, setPendingAmounts] = useState({}); // Store pending amounts before applying
    const [pendingNewTargetMaxPrice, setPendingNewTargetMaxPrice] = useState(null); // Store maxPrice for newly created target
    const loadingPricesRef = useRef(false);
    const lastTargetsRef = useRef([]);
    const autoUpdateIntervalRef = useRef(null);
    const isAutoUpdatingRef = useRef(false);
    const targetsRef = useRef(targets);
    const maxPricesRef = useRef({}); // Keep maxPrices in ref to prevent loss during updates

    const apiService = useMemo(() => {
        return client ? new ApiService(client) : null;
    }, [client]);
    

    useEffect(() => {
        // Load initial targets only once when component mounts and client is available
        if (client && !loading) {
            loadTargetsWithMaxPrices();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client]); // Only depend on client, not loadTargetsWithMaxPrices

    // Load market prices when targets change
    useEffect(() => {
        const loadMarketPrices = async () => {
            if (!apiService || targets.length === 0 || loadingPricesRef.current) return;
            
            // Check if targets actually changed
            const targetsChanged = JSON.stringify(targets.map(t => t.targetId || t.itemId || t.instantTargetId)) !== 
                                  JSON.stringify(lastTargetsRef.current.map(t => t.targetId || t.itemId || t.instantTargetId));
            
            if (!targetsChanged && lastTargetsRef.current.length > 0) return;

            loadingPricesRef.current = true;
            setLoadingMarketPrices(true);
            lastTargetsRef.current = targets;

            try {
                const prices = {}; // Store best buy order prices for each target
                let unauthorizedCount = 0;
                
                for (const target of targets) {
                    try {
                        const targetId = target.targetId || target.itemId || target.instantTargetId;
                        const title = target.itemTitle || target.title || target.attributes?.title || target.extra?.name;
                        const gameId = target.gameId || 'a8db';

                        if (!title || !targetId) continue;

                        // Get buy orders (targets) for this item to find best price
                        const targetsData = await apiService.getTargetsByTitle(gameId, title);
                        // API returns { orders: [...] } structure
                        if (targetsData?.orders && targetsData.orders.length > 0) {
                            // Get target's floatPartValue for filtering
                            const targetFloatValue = target.extra?.floatPartValue;
                            
                            // Filter orders by floatPartValue: match target's floatPartValue or 'any'
                            const filteredOrders = targetsData.orders.filter(order => {
                                const orderFloatValue = order.attributes?.floatPartValue;
                                // Accept if floatPartValue matches target's value or is 'any'
                                return orderFloatValue === 'any' || 
                                       (targetFloatValue && orderFloatValue === targetFloatValue);
                            });

                            // Find highest price (best offer for seller from buy orders)
                            const targetPrices = filteredOrders
                                .map(order => {
                                    // Price can be in different formats: { amount: "1234", currency: "USD" } or just a number/string
                                    const price = order.price?.amount || order.price?.USD || order.price;
                                    return typeof price === 'string' ? parseFloat(price) : price;
                                })
                                .filter(price => price > 0 && !isNaN(price))
                                .sort((a, b) => b - a); // Sort descending to get highest price

                            if (targetPrices.length > 0) {
                                const bestPrice = targetPrices[0]; // Highest price (best buy order)
                                // Format price: add dot after last 2 digits
                                const priceStr = bestPrice.toString();
                                prices[targetId] = priceStr.length >= 2 
                                    ? priceStr.slice(0, -2) + '.' + priceStr.slice(-2)
                                    : '0.' + priceStr.padStart(2, '0');
                            }
                        }
                    } catch (err) {
                        // Handle 401 Unauthorized errors gracefully
                        if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
                            unauthorizedCount++;
                            // Only log once to avoid spam
                            if (unauthorizedCount === 1) {
                                console.warn('Unauthorized access to targets-by-title endpoint. Check API credentials and permissions.');
                            }
                        } else {
                            console.error(`Error loading buy orders for target ${target.targetId || target.itemId}:`, err);
                        }
                    }
                }

                // Show warning if all requests failed due to unauthorized access
                if (unauthorizedCount > 0 && Object.keys(prices).length === 0) {
                    console.warn(`Could not load buy order prices: ${unauthorizedCount} unauthorized request(s). The targets-by-title endpoint requires valid API authentication.`);
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
    }, [targets.length, apiService, loading]); // Only depend on length and apiService, not the full targets array

    // Function to get float range from floatPartValue
    const getFloatRange = (floatPartValue) => {
        if (!floatPartValue || floatPartValue === '' || floatPartValue === 'N/A') {
            return 'Any';
        }

        // Mapping of floatPartValue to float ranges
        const floatRanges = {
            'FN-0': '0.00-0.01',
            'FN-1': '0.01-0.02',
            'FN-2': '0.02-0.03',
            'FN-3': '0.03-0.04',
            'FN-4': '0.04-0.05',
            'FN-5': '0.05-0.06',
            'FN-6': '0.06-0.07',
            'MW-0': '0.07-0.08',
            'MW-1': '0.08-0.09',
            'MW-2': '0.09-0.10',
            'MW-3': '0.10-0.11',
            'MW-4': '0.11-0.15',
            'FT-0': '0.15-0.18',
            'FT-1': '0.18-0.21',
            'FT-2': '0.21-0.24',
            'FT-3': '0.24-0.27',
            'FT-4': '0.27-0.38',
            'WW-0': '0.38-0.39',
            'WW-1': '0.39-0.40',
            'WW-2': '0.40-0.41',
            'WW-3': '0.41-0.42',
            'WW-4': '0.42-0.45',
            'BS-0': '0.45-0.50',
            'BS-1': '0.50-0.63',
            'BS-2': '0.63-0.76',
            'BS-3': '0.76-0.80',
            'BS-4': '0.80-1.00'
        };

        return floatRanges[floatPartValue] || floatPartValue;
    };

    // Wrapper for loadTargets that saves maxPrices before loading
    const loadTargetsWithMaxPrices = useCallback(async (items = []) => {
        // Save current maxPrices before loading new targets
        // Also create a mapping from old itemId to new itemId using title+floatPartValue as stable key
        try {
            const currentMaxPrices = maxPricesRef.current || maxPrices;
            const currentTargets = targetsRef.current || targets;
            
            // Create mapping: title+floatPartValue -> itemId -> maxPrice
            // This allows us to restore maxPrice even if itemId changes after update
            const maxPricesByKey = {};
            for (const target of currentTargets) {
                const itemId = target.itemId;
                const title = target.itemTitle || target.title || target.extra?.name || target.attributes?.title;
                const floatPartValue = target.extra?.floatPartValue || target.attributes?.floatPartValue || '';
                if (itemId && title && currentMaxPrices[itemId]) {
                    const key = `${title}|${floatPartValue}`;
                    maxPricesByKey[key] = currentMaxPrices[itemId];
                }
            }
            
            // Save both by itemId and by title+floatPartValue key
            if (Object.keys(currentMaxPrices).length > 0) {
                localStorage.setItem('targetsMaxPrices', JSON.stringify(currentMaxPrices));
                localStorage.setItem('targetsMaxPricesByKey', JSON.stringify(maxPricesByKey));
                console.log('Saved maxPrices before loadTargets:', currentMaxPrices);
                console.log('Saved maxPricesByKey before loadTargets:', maxPricesByKey);
            }
        } catch (err) {
            console.error('Error saving maxPrices before loadTargets:', err);
        }
        
        await loadTargets(items);
        
        // Restore maxPrices from localStorage after loading targets
        // Use setTimeout to ensure state update happens after targets are set
        setTimeout(() => {
            try {
                const saved = localStorage.getItem('targetsMaxPrices');
                const savedByKey = localStorage.getItem('targetsMaxPricesByKey');
                const newTargets = targetsRef.current || targets;
                
                if (saved) {
                    const savedMaxPrices = JSON.parse(saved);
                    const savedMaxPricesByKey = savedByKey ? JSON.parse(savedByKey) : {};
                    
                    // Restore maxPrices by itemId first
                    let restoredMaxPrices = { ...savedMaxPrices };
                    
                    // Then restore by title+floatPartValue for targets with new itemIds
                    for (const target of newTargets) {
                        const newItemId = target.itemId;
                        const title = target.itemTitle || target.title || target.extra?.name || target.attributes?.title;
                        const floatPartValue = target.extra?.floatPartValue || target.attributes?.floatPartValue || '';
                        const key = `${title}|${floatPartValue}`;
                        
                        // If we don't have maxPrice for this itemId, try to restore from key
                        if (newItemId && title && !restoredMaxPrices[newItemId] && savedMaxPricesByKey[key]) {
                            restoredMaxPrices[newItemId] = savedMaxPricesByKey[key];
                            console.log(`Restored maxPrice for new itemId ${newItemId} from key ${key}:`, savedMaxPricesByKey[key]);
                        }
                    }
                    
                    console.log('Restoring maxPrices after loadTargets:', restoredMaxPrices);
                    setMaxPrices(restoredMaxPrices);
                    maxPricesRef.current = restoredMaxPrices;
                    console.log('Restored maxPrices state and ref:', restoredMaxPrices);
                } else {
                    console.warn('No saved maxPrices found in localStorage');
                }
            } catch (err) {
                console.error('Error restoring maxPrices after loadTargets:', err);
            }
        }, 300); // Small delay to ensure targets state is updated
    }, [loadTargets, maxPrices, targets]);

    const handleRefresh = async () => {
        await loadTargetsWithMaxPrices();
    };

    // Update targetsRef when targets change
    useEffect(() => {
        targetsRef.current = targets;
    }, [targets]);

    // Auto-update target prices: find highest price from other targets and set 1 cent higher (but not more than maxPrice)
    const autoUpdateTargetPrices = useCallback(async () => {
        const currentTargets = targetsRef.current;
        const currentMaxPrices = maxPricesRef.current || maxPrices;
        if (!apiService || currentTargets.length === 0 || updating || isAutoUpdatingRef.current) return;

        isAutoUpdatingRef.current = true;
        setUpdating(true);
        try {
            for (let i = 0; i < currentTargets.length; i++) {
                const target = currentTargets[i];
                try {
                    // Skip inactive targets
                    if (target.status === 'inactive' || target.status === 'Inactive') {
                        console.log(`Skipping inactive target: ${target.targetId || target.itemId}`);
                        continue;
                    }
                    
                    // Add delay between updates to avoid conflicts
                    if (i > 0) {
                        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay between updates
                    }
                    
                    const targetId = target.targetId || target.itemId || target.instantTargetId;
                    const itemId = target.itemId; // itemId is stable and doesn't change after update
                    const title = target.itemTitle || target.title || target.extra?.name || target.attributes?.title;
                    const gameId = target.gameId || 'a8db';
                    // Get floatPartValue from target
                    const floatPartValue = target.extra?.floatPartValue || target.attributes?.floatPartValue || null;
                    // Get maxPrice from saved values using itemId (stable identifier)
                    const maxPrice = currentMaxPrices[itemId] || target.maxPrice;

                    if (!title || !targetId || !maxPrice) {
                        console.warn(`Skipping target ${targetId}: missing title (${title}), targetId (${targetId}), or maxPrice (${maxPrice})`);
                        console.warn('Target object:', target);
                        continue;
                    }
                    
                    console.log('Target update - title:', title, 'targetId:', targetId);

                    // Get all targets (buy orders) for this item
                    const targetsData = await apiService.getTargetsByTitle(gameId, title);
                    
                    if (targetsData?.orders && targetsData.orders.length > 0) {
                        // Get target's floatPartValue for filtering
                        const targetFloatValue = target.extra?.floatPartValue;
                        
                        // Filter orders by floatPartValue
                        const filteredOrders = targetsData.orders.filter(order => {
                            const orderFloatValue = order.attributes?.floatPartValue;
                            return orderFloatValue === 'any' || 
                                   (targetFloatValue && orderFloatValue === targetFloatValue);
                        });

                        console.log('filteredOrders', filteredOrders);
                        console.log('targetsData', targetsData);
                        
                        const maxPriceCents = parseFloat(maxPrice) * 100; // Convert maxPrice to cents
                        
                        // Find highest price (excluding our own target) within maxPrice range
                        // Use consistent identifier logic for comparison
                        const otherTargetPrices = filteredOrders
                            .filter(order => {
                                // Get all possible identifiers for the market order
                                const orderTargetId = order.targetId || order.itemId || order.instantTargetId;
                                // Get all possible identifiers for our target
                                const ourTargetId = target.targetId || target.itemId || target.instantTargetId;
                                // Exclude our own target by comparing all possible identifiers
                                const isOurTarget = orderTargetId === ourTargetId || 
                                                  order.itemId === target.itemId ||
                                                  order.itemId === ourTargetId ||
                                                  orderTargetId === target.itemId;
                                if (isOurTarget) {
                                    console.log(`Excluding our own target: orderTargetId=${orderTargetId}, ourTargetId=${ourTargetId}, target.itemId=${target.itemId}, order.itemId=${order.itemId}`);
                                    return false; // Exclude our own target
                                }
                                
                                // Convert order price to cents for comparison
                                const orderPrice = order.price?.amount || order.price?.USD || order.price;
                                let orderPriceCents = 0;
                                if (typeof orderPrice === 'string') {
                                    const parsed = parseFloat(orderPrice);
                                    orderPriceCents = parsed >= 10 ? parsed : parsed * 100;
                                } else if (typeof orderPrice === 'number') {
                                    orderPriceCents = orderPrice >= 10 ? orderPrice : orderPrice * 100;
                                }
                                
                                // Only include orders with price <= maxPrice
                                return orderPriceCents > 0 && !isNaN(orderPriceCents) && orderPriceCents <= maxPriceCents;
                            })
                            .map(order => {
                                const price = order.price?.amount || order.price?.USD || order.price;
                                // Convert to cents if needed
                                if (typeof price === 'string') {
                                    const parsed = parseFloat(price);
                                    // If price looks like cents (>= 10), use as is; otherwise assume dollars
                                    return parsed >= 10 ? parsed : parsed * 100;
                                }
                                // If number, assume cents if >= 10, otherwise dollars
                                return price >= 10 ? price : price * 100;
                            })
                            .sort((a, b) => b - a); // Sort descending

                        if (otherTargetPrices.length > 0) {
                            const highestPrice = otherTargetPrices[0]; // Highest price in cents (within maxPrice range)
                            
                            // Set price 1 cent higher than highest price in range, but not more than maxPrice
                            let newPriceCents = highestPrice + 1; // 1 cent higher
                            if (newPriceCents > maxPriceCents) {
                                newPriceCents = maxPriceCents; // Don't exceed maxPrice
                            }

                            // Convert to dollars for API (decimal format)
                            const newPrice = (newPriceCents / 100).toFixed(2);
                            const newPriceFloat = parseFloat(newPrice);
                            
                            // Get current target price and convert to decimal format (dollars)
                            let currentPriceFloat = null;
                            const currentPrice = target.price?.amount || target.price?.USD || target.price;
                            if (currentPrice !== undefined && currentPrice !== null && currentPrice !== 'N/A') {
                                if (typeof currentPrice === 'string') {
                                    const cents = parseFloat(currentPrice);
                                    if (!isNaN(cents)) {
                                        currentPriceFloat = cents >= 10 ? cents : cents / 100;
                                    }
                                } else if (typeof currentPrice === 'number') {
                                    currentPriceFloat = currentPrice >= 10 ? currentPrice : currentPrice / 100;
                                }
                            }
                            
                            // Skip update if new price equals current price (to avoid API error)
                            if (currentPriceFloat !== null && Math.abs(newPriceFloat - currentPriceFloat) < 0.01) {
                                console.log(`Skipping update for ${title}: new price ${newPriceFloat} equals current price ${currentPriceFloat.toFixed(2)}`);
                                continue;
                            }
                            
                            // Update target price
                            console.log('=== UPDATE TARGET ===');
                            console.log('title:', title);
                            console.log('targetId:', targetId);
                            console.log('highestPrice:', highestPrice);
                            console.log('maxPriceCents:', maxPriceCents);
                            console.log('currentPrice:', currentPriceFloat !== null ? currentPriceFloat.toFixed(2) : 'N/A');
                            console.log('newPrice:', newPriceFloat);
                            try {
                                await updateTarget(targetId, { price: { amount: newPrice, currency: 'USD' }, amount: target.amount || 1 }, gameId, title, floatPartValue, true);
                                addLog({
                                    type: 'success',
                                    category: 'parsing',
                                    message: `Ціна таргета оновлена: ${title}`,
                                    details: {
                                        title,
                                        targetId,
                                        oldPrice: currentPriceFloat !== null ? currentPriceFloat.toFixed(2) : 'N/A',
                                        newPrice: newPriceFloat.toFixed(2),
                                        highestPrice: (highestPrice / 100).toFixed(2),
                                        maxPrice: maxPrice
                                    }
                                });
                            } catch (updateErr) {
                                // Handle failedTargets error (e.g., TargetUpdatedRecently)
                                const errorCode = updateErr.errorCode || 'UnknownError';
                                const errorMessage = updateErr.message || 'Помилка оновлення таргета';
                                addLog({
                                    type: 'warning',
                                    category: 'parsing',
                                    message: `Не вдалося оновити таргет: ${title} (${errorCode})`,
                                    details: {
                                        title,
                                        targetId,
                                        errorCode,
                                        errorMessage,
                                        oldPrice: currentPriceFloat !== null ? currentPriceFloat.toFixed(2) : 'N/A',
                                        newPrice: newPriceFloat.toFixed(2)
                                    }
                                });
                                console.warn(`Failed to update target ${targetId}:`, errorCode, errorMessage);
                                // Don't throw - continue with next target
                            }
                        }
                    }
                } catch (err) {
                    console.error(`Error auto-updating target ${target.targetId || target.itemId}:`, err);
                    const title = target.itemTitle || target.title || target.extra?.name || 'Невідомий таргет';
                    addLog({
                        type: 'error',
                        category: 'parsing',
                        message: `Помилка оновлення ціни таргета: ${title}`,
                        details: {
                            title,
                            targetId: target.targetId || target.itemId,
                            error: err.message
                        }
                    });
                }
            }
            
            // Reload targets after update (with delay to avoid infinite loop)
            await new Promise(resolve => setTimeout(resolve, 1000));
            await loadTargetsWithMaxPrices();
        } catch (err) {
            console.error('Error in auto-update target prices:', err);
        } finally {
            setUpdating(false);
            isAutoUpdatingRef.current = false;
        }
    }, [apiService, updateTarget, loadTargets, updating]); // Remove maxPrices from dependencies, use maxPricesRef instead

    // Update maxPricesRef when maxPrices change
    useEffect(() => {
        maxPricesRef.current = maxPrices;
    }, [maxPrices]);

    // Restore maxPrices from localStorage when targets change
    // This ensures maxPrices are always restored after targets are loaded
    useEffect(() => {
        if (targets.length > 0) {
            // Always restore from localStorage when targets change (localStorage is source of truth)
            try {
                const saved = localStorage.getItem('targetsMaxPrices');
                if (saved) {
                    const savedMaxPrices = JSON.parse(saved);
                    console.log('Restoring maxPrices from localStorage (useEffect):', savedMaxPrices);
                    // Always use localStorage as source of truth to prevent data loss
                    setMaxPrices(savedMaxPrices);
                    maxPricesRef.current = savedMaxPrices;
                } else {
                    console.log('No saved maxPrices in localStorage');
                }
            } catch (err) {
                console.error('Error restoring maxPrices from localStorage (useEffect):', err);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targets.length]); // Only run when targets.length changes

    // Save maxPrices to localStorage whenever they change
    // This ensures maxPrices are always persisted and never lost
    useEffect(() => {
        if (Object.keys(maxPrices).length > 0) {
            try {
                localStorage.setItem('targetsMaxPrices', JSON.stringify(maxPrices));
                console.log('Saved maxPrices to localStorage:', maxPrices);
            } catch (err) {
                console.error('Error saving maxPrices to localStorage:', err);
            }
        }
    }, [maxPrices]);

    // Use toggle function from props if provided, otherwise use local state (for backward compatibility)
    const toggleAutoUpdate = onToggleAutoUpdate || (() => {
        console.warn('onToggleAutoUpdate not provided to TargetsList');
    });

    // Start auto-update interval (every minute) - only when enabled
    useEffect(() => {
        if (!apiService || targets.length === 0 || !isAutoUpdatingEnabled) {
            // Clear interval if disabled
            if (autoUpdateIntervalRef.current) {
                clearInterval(autoUpdateIntervalRef.current);
                autoUpdateIntervalRef.current = null;
                addLog({
                    type: 'info',
                    category: 'parsing',
                    message: 'Парсинг таргетів зупинено',
                    details: { targetsCount: targets.length }
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
            message: 'Парсинг таргетів запущено',
            details: { targetsCount: targets.length, interval: '20 секунд' }
        });
        autoUpdateIntervalRef.current = setInterval(() => {
            if (!isAutoUpdatingRef.current) {
                console.log('autoUpdateTargetPrices triggered');
                autoUpdateTargetPrices();
            }
        }, 60000); // 60 seconds = 1 minute

        return () => {
            if (autoUpdateIntervalRef.current) {
                clearInterval(autoUpdateIntervalRef.current);
                autoUpdateIntervalRef.current = null;
            }
        };
    }, [apiService, targets.length, isAutoUpdatingEnabled, autoUpdateTargetPrices, addLog]); // Don't depend on autoUpdateTargetPrices to avoid recreation

    const handleDelete = async (targetId) => {
        if (!targetId) {
            alert('Неможливо видалити: ID не знайдено');
            return;
        }
        const target = targets.find(t => (t.targetId || t.itemId || t.instantTargetId) === targetId);
        const title = target?.itemTitle || target?.title || target?.extra?.name || 'Невідомий таргет';
        if (window.confirm(t('targets.deleteConfirm'))) {
            try {
                await deleteTarget(targetId);
                addLog({
                    type: 'success',
                    category: 'target',
                    message: `Таргет видалено: ${title}`,
                    details: { targetId, title }
                });
            } catch (err) {
                addLog({
                    type: 'error',
                    category: 'target',
                    message: `Помилка видалення таргета: ${title}`,
                    details: { targetId, title, error: err.message }
                });
                alert(t('targets.deleteError') + ': ' + err.message);
            }
        }
    };

    const handleActivate = async (targetId) => {
        if (!apiService || !targetId) return;
        const target = targets.find(t => (t.targetId || t.itemId || t.instantTargetId) === targetId);
        const title = target?.itemTitle || target?.title || target?.extra?.name || 'Невідомий таргет';
        try {
            setUpdating(true);
            await apiService.activateTarget(targetId);
            await loadTargetsWithMaxPrices();
            addLog({
                type: 'success',
                category: 'target',
                message: `Таргет активовано: ${title}`,
                details: { targetId, title }
            });
        } catch (err) {
            console.error('Error activating target:', err);
            addLog({
                type: 'error',
                category: 'target',
                message: `Помилка активації таргета: ${title}`,
                details: { targetId, title, error: err.message }
            });
            alert('Помилка активації таргета: ' + (err.message || 'Невідома помилка'));
        } finally {
            setUpdating(false);
        }
    };

    const handleDeactivate = async (targetId) => {
        if (!apiService || !targetId) return;
        const target = targets.find(t => (t.targetId || t.itemId || t.instantTargetId) === targetId);
        const title = target?.itemTitle || target?.title || target?.extra?.name || 'Невідомий таргет';
        try {
            setUpdating(true);
            await apiService.deactivateTarget(targetId);
            await loadTargetsWithMaxPrices();
            addLog({
                type: 'success',
                category: 'target',
                message: `Таргет деактивовано: ${title}`,
                details: { targetId, title }
            });
        } catch (err) {
            console.error('Error deactivating target:', err);
            addLog({
                type: 'error',
                category: 'target',
                message: `Помилка деактивації таргета: ${title}`,
                details: { targetId, title, error: err.message }
            });
            alert('Помилка деактивації таргета: ' + (err.message || 'Невідома помилка'));
        } finally {
            setUpdating(false);
        }
    };

    const handleAmountChange = async (targetId, itemId, newAmount, title, gameId, floatPartValue, currentAmount, currentPrice) => {
        const amount = parseInt(newAmount, 10);
        if (isNaN(amount) || amount < 1) {
            return; // Invalid amount, don't update
        }
        
        if (amount === currentAmount) {
            return; // No change, don't update
        }

        try {
            setUpdating(true);
            // Get current price in the format expected by API (decimal dollars)
            let priceAmount = currentPrice;
            const oldAmount = currentAmount;
            if (typeof priceAmount === 'string' && priceAmount !== 'N/A') {
                // Convert from cents format to decimal
                const cents = parseFloat(priceAmount);
                priceAmount = cents >= 10 ? (cents / 100).toFixed(2) : (cents / 100).toFixed(2);
            } else if (typeof priceAmount === 'number') {
                priceAmount = priceAmount >= 10 ? (priceAmount / 100).toFixed(2) : (priceAmount / 100).toFixed(2);
            } else {
                priceAmount = '0.00';
            }
            
            try {
                const response = await updateTarget(targetId, {
                    price: { amount: priceAmount, currency: 'USD' },
                    amount: amount
                }, gameId, title, floatPartValue, true);
                
                // Double-check response for failedTargets even if no exception was thrown
                const failedTargets = response?.failedTargets || response?.failed_targets || [];
                if (failedTargets && failedTargets.length > 0) {
                    const failedTarget = failedTargets[0];
                    const errorCode = failedTarget.errorCode || 'UnknownError';
                    const errorMessage = failedTarget.message || 'Помилка оновлення кількості';
                    throw { errorCode, message: errorMessage, failedTargets };
                }
                
                await loadTargetsWithMaxPrices();
                addLog({
                    type: 'success',
                    category: 'target',
                    message: `Кількість таргета змінено: ${title}`,
                    details: { title, targetId, oldAmount: currentAmount, newAmount: amount }
                });
            } catch (updateErr) {
                // Handle failedTargets error - preserve error properties
                const errorCode = updateErr.errorCode || 'UnknownError';
                const errorMessage = updateErr.message || 'Помилка оновлення кількості';
                const error = new Error(`${errorMessage} (${errorCode})`);
                error.errorCode = errorCode;
                if (updateErr.failedTargets) error.failedTargets = updateErr.failedTargets;
                throw error;
            }
        } catch (err) {
            console.error('Error updating target amount:', err);
            const errorCode = err.errorCode || (err.message?.includes('(') ? err.message.match(/\(([^)]+)\)/)?.[1] : null);
            const isFailedTargetsError = errorCode === 'TargetUpdatedRecently' || err.errorCode === 'TargetUpdatedRecently';
            
            addLog({
                type: isFailedTargetsError ? 'warning' : 'error',
                category: 'target',
                message: isFailedTargetsError 
                    ? `Не вдалося оновити кількість таргета: ${title} (${errorCode})`
                    : `Помилка оновлення кількості таргета: ${title}`,
                details: { 
                    title, 
                    targetId, 
                    error: err.message,
                    errorCode: errorCode || 'UnknownError'
                }
            });
            
            // Don't show alert for failedTargets errors (e.g., TargetUpdatedRecently) - only log
            if (!isFailedTargetsError) {
                alert('Помилка оновлення кількості: ' + (err.message || 'Невідома помилка'));
            }
        } finally {
            setUpdating(false);
        }
    };

    const handleApplyMaxPrice = async (itemId) => {
        const pendingPrice = pendingMaxPrices[itemId];
        if (!pendingPrice || !itemId) {
            console.warn('handleApplyMaxPrice: missing pendingPrice or itemId', { pendingPrice, itemId });
            return;
        }

        try {
            setUpdating(true);
            // Note: API might not support maxPrice update directly, so we store it locally
            // Update maxPrices with applied value using itemId (stable identifier)
            // Will be saved to localStorage automatically
            console.log('Applying maxPrice:', { itemId, pendingPrice, currentMaxPrices: maxPrices });
            setMaxPrices(prev => {
                const updated = {
                    ...prev,
                    [itemId]: pendingPrice
                };
                console.log('Updated maxPrices:', updated);
                return updated;
            });
            // Clear pending value
            setPendingMaxPrices(prev => {
                const newPending = { ...prev };
                delete newPending[itemId];
                return newPending;
            });
            // Reload targets to get updated data
            await loadTargetsWithMaxPrices();
            const target = targets.find(t => t.itemId === itemId);
            const title = target?.itemTitle || target?.title || target?.extra?.name || 'Невідомий таргет';
            addLog({
                type: 'success',
                category: 'target',
                message: `Максимальна ціна встановлена: ${title}`,
                details: { title, itemId, maxPrice: pendingPrice }
            });
        } catch (err) {
            console.error('Error applying maxPrice:', err);
            const target = targets.find(t => t.itemId === itemId);
            const title = target?.itemTitle || target?.title || target?.extra?.name || 'Невідомий таргет';
            addLog({
                type: 'error',
                category: 'target',
                message: `Помилка застосування максимальної ціни: ${title}`,
                details: { title, itemId, error: err.message }
            });
            alert('Помилка застосування максимальної ціни: ' + err.message);
        } finally {
            setUpdating(false);
        }
    };

    const handleAdd = () => {
        setEditingTarget(null);
        setShowForm(true);
    };

    const filteredTargets = targets.filter(target => {
        // API returns title directly, not in attributes
        const title = target.itemTitle || target.title || target.attributes?.title || target.extra?.name || '';
        return title.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const handleSaveWithMaxPrice = useCallback((title, floatPartValue, maxPrice) => {
        // Store maxPrice temporarily - will be saved after target is loaded
        setPendingNewTargetMaxPrice({ title, floatPartValue, maxPrice });
        console.log('Stored pending maxPrice for new target:', { title, floatPartValue, maxPrice });
    }, []);
    
    // Save maxPrice for newly created target when targets are loaded
    useEffect(() => {
        if (pendingNewTargetMaxPrice && targets.length > 0) {
            const { title, floatPartValue, maxPrice } = pendingNewTargetMaxPrice;
            // Find the target by title and floatPartValue
            const matchingTarget = targets.find(t => {
                const targetTitle = t.itemTitle || t.title || t.extra?.name || t.attributes?.title;
                const targetFloat = t.extra?.floatPartValue || t.attributes?.floatPartValue || '';
                return targetTitle === title && targetFloat === floatPartValue;
            });
            
            if (matchingTarget && matchingTarget.itemId) {
                const itemId = matchingTarget.itemId;
                console.log('Saving maxPrice for newly created target:', { itemId, title, floatPartValue, maxPrice });
                setMaxPrices(prev => {
                    const updated = {
                        ...prev,
                        [itemId]: maxPrice
                    };
                    console.log('Updated maxPrices with new target:', updated);
                    return updated;
                });
                maxPricesRef.current = {
                    ...maxPricesRef.current,
                    [itemId]: maxPrice
                };
                addLog({
                    type: 'success',
                    category: 'target',
                    message: `Таргет створено: ${title}`,
                    details: { title, itemId, maxPrice, floatPartValue }
                });
                // Clear pending maxPrice
                setPendingNewTargetMaxPrice(null);
            }
        }
    }, [targets, pendingNewTargetMaxPrice]);

    if (showForm) {
        return (
            <TargetForm
                target={editingTarget}
                onClose={() => {
                    setShowForm(false);
                    setEditingTarget(null);
                }}
                onSave={() => {
                    setShowForm(false);
                    setEditingTarget(null);
                    loadTargetsWithMaxPrices();
                }}
                onSaveWithMaxPrice={handleSaveWithMaxPrice}
            />
        );
    }

    return (
        <div className="targets-list">
            <div className="targets-header">
                <h1 className="targets-title">{t('targets.title')}</h1>
                <div className="targets-actions">
                    <input
                        type="text"
                        placeholder={t('targets.search')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="targets-search"
                    />
                    <button onClick={handleAdd} className="btn btn-primary">
                        {t('targets.add')}
                    </button>
                    <button onClick={handleRefresh} className="btn btn-secondary" disabled={loading || updating}>
                        {t('targets.refresh')}
                    </button>
                </div>
            </div>

            {loading && <div className="loading">{t('targets.loading')}</div>}
            {error && <div className="error">{t('targets.error')}: {error}</div>}
            {authError && (
                <div className="error" style={{ marginTop: '10px' }}>
                    ⚠️ Не вдалося завантажити ціни buy orders: потрібна автентифікація API. Перевірте API ключі та права доступу.
                </div>
            )}
            {loadingMarketPrices && <div className="loading" style={{ fontSize: '12px', marginTop: '5px' }}>Завантаження ринкових цін...</div>}

            <div className="targets-table-container">
                <table className="targets-table">
                    <thead>
                        <tr>
                            <th>{t('targets.number')}</th>
                            <th>{t('targets.item')}</th>
                            <th>{t('targets.ourPrice')}</th>
                            <th>{t('targets.marketPrice')}</th>
                            <th>{t('targets.maxPrice')}</th>
                            <th>{t('targets.quantity')}</th>
                            <th>{t('targets.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTargets.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="empty-state">
                                    {t('targets.empty')}
                                </td>
                            </tr>
                        ) : (
                            filteredTargets.map((target, index) => {
                                // API returns itemId, not targetId
                                const targetId = target.targetId || target.itemId || target.instantTargetId;
                                const itemId = target.itemId; // Use itemId for maxPrice (stable identifier)
                                const title = target.itemTitle || target.title || target.extra?.name || t('target.unknownItem');
                                const price = target.price?.USD || 'N/A';
                                // Format price from cents: "3" -> "0.03", "50" -> "0.50", "6400" -> "64.00"
                                const formattedPrice = typeof price === 'string' && price !== 'N/A' 
                                    ? (price.length >= 2 ? price.slice(0, -2) + '.' + price.slice(-2) : '0.' + price.padStart(2, '0'))
                                    : price;
                                const status = target.status || 'N/A';
                                const amount = target.amount || 1;
                                const floatPartValue = target.extra?.floatPartValue || target.attributes?.floatPartValue || 'N/A';
                                const floatRange = getFloatRange(floatPartValue);
                                const gameId = target.gameId || 'a8db';
                                
                                return (
                                    <tr key={targetId || index}>
                                        <td>{index + 1}</td>
                                        <td>
                                            <div className="target-item">
                                                <span className={status === 'active' ? 'active-target-status' : 'inactive-target-status'}>{status}</span>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <span>{title}</span>
                                                    {floatPartValue !== 'N/A' && (
                                                        <span style={{ fontSize: '11px', color: '#888' }}>
                                                            {floatPartValue} {floatRange !== floatPartValue && `(${floatRange})`}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td>{formattedPrice}</td>
                                        <td>{marketPrices[targetId] || (loadingMarketPrices ? '...' : 'N/A')}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0.01"
                                                    value={pendingMaxPrices[itemId] !== undefined 
                                                        ? pendingMaxPrices[itemId] 
                                                        : (maxPrices[itemId] || target.maxPrice || '')}
                                                    onChange={(e) => {
                                                        const newMaxPrice = e.target.value;
                                                        setPendingMaxPrices(prev => ({
                                                            ...prev,
                                                            [itemId]: newMaxPrice
                                                        }));
                                                    }}
                                                    className="max-price-input"
                                                    placeholder="Макс. ціна"
                                                />
                                                {pendingMaxPrices[itemId] !== undefined && (
                                                    <button
                                                        onClick={() => handleApplyMaxPrice(itemId)}
                                                        className="btn-icon"
                                                        title="Застосувати максимальну ціну"
                                                        disabled={updating}
                                                    >
                                                        ✓
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                min="1"
                                                value={pendingAmounts[targetId] !== undefined ? pendingAmounts[targetId] : amount}
                                                className="quantity-input"
                                                onChange={(e) => {
                                                    const newAmount = e.target.value;
                                                    setPendingAmounts(prev => ({
                                                        ...prev,
                                                        [targetId]: newAmount
                                                    }));
                                                }}
                                                onBlur={(e) => {
                                                    const newAmount = parseInt(e.target.value, 10);
                                                    if (!isNaN(newAmount) && newAmount >= 1 && newAmount !== amount) {
                                                        handleAmountChange(targetId, itemId, newAmount, title, gameId, floatPartValue !== 'N/A' ? floatPartValue : null, amount, price);
                                                        // Clear pending amount after successful update
                                                        setPendingAmounts(prev => {
                                                            const updated = { ...prev };
                                                            delete updated[targetId];
                                                            return updated;
                                                        });
                                                    } else if (isNaN(newAmount) || newAmount < 1) {
                                                        // Reset to original value if invalid
                                                        setPendingAmounts(prev => {
                                                            const updated = { ...prev };
                                                            delete updated[targetId];
                                                            return updated;
                                                        });
                                                    }
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.target.blur(); // Trigger onBlur
                                                    }
                                                }}
                                            />
                                        </td>
                                        <td>
                                            <div className="target-actions">
                                                {status === 'active' ? (
                                                    <button 
                                                        onClick={() => handleDeactivate(targetId)} 
                                                        className="btn-icon" 
                                                        title="Деактивувати таргет"
                                                        disabled={updating}
                                                    >
                                                        ⏸
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={() => handleActivate(targetId)} 
                                                        className="btn-icon" 
                                                        title="Активувати таргет"
                                                        disabled={updating}
                                                    >
                                                        ▶
                                                    </button>
                                                )}
                                                <button onClick={() => handleDelete(targetId)} className="btn-icon" title="Видалити">🗑</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default TargetsList;

