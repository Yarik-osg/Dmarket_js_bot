import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTargets } from '../hooks/useTargets.js';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLogs } from '../contexts/LogsContext.jsx';
import { ApiService } from '../services/apiService.js';
import TargetForm from './TargetForm.jsx';
import { showConfirmModal, showAlertModal } from '../utils/modal.js';
import { 
    RiSearchLine, 
    RiAddLine, 
    RiDeleteBin6Line, 
    RiRefreshLine,
    RiPlayCircleLine,
    RiPauseCircleLine,
    RiPencilLine,
    RiCheckLine,
    RiTimerLine,
    RiRestartLine
} from 'react-icons/ri';
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
    const [resetStats, setResetStats] = useState(() => {
        // Load reset stats from localStorage
        try {
            const saved = localStorage.getItem('targetPriceResetStats');
            return saved ? JSON.parse(saved) : null;
        } catch (err) {
            console.error('Error loading reset stats:', err);
            return null;
        }
    });
    const [timeUntilReset, setTimeUntilReset] = useState('');
    const loadingPricesRef = useRef(false);
    const lastTargetsRef = useRef([]);
    const autoUpdateIntervalRef = useRef(null);
    const isAutoUpdatingRef = useRef(false);
    const targetsRef = useRef(targets);
    const maxPricesRef = useRef({}); // Keep maxPrices in ref to prevent loss during updates
    const lastPriceResetTimeRef = useRef((() => {
        // Load last reset time from localStorage
        try {
            const saved = localStorage.getItem('lastTargetPriceResetTime');
            return saved ? parseInt(saved, 10) : 0;
        } catch (err) {
            console.error('Error loading lastPriceResetTime:', err);
            return 0;
        }
    })());

    const apiService = useMemo(() => {
        return client ? new ApiService(client) : null;
    }, [client]);
    
    // Update timer every second
    useEffect(() => {
        const updateTimer = () => {
            const RESET_INTERVAL_MS = 3.5 * 60 * 60 * 1000; // 3.5 hours
            const now = Date.now();
            const lastResetTime = lastPriceResetTimeRef.current;
            
            if (lastResetTime === 0) {
                setTimeUntilReset('Очікування першого циклу');
                return;
            }
            
            const timeSinceLastReset = now - lastResetTime;
            const timeRemaining = RESET_INTERVAL_MS - timeSinceLastReset;
            
            if (timeRemaining <= 0) {
                setTimeUntilReset('Готово до скидання');
                return;
            }
            
            const hours = Math.floor(timeRemaining / (60 * 60 * 1000));
            const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));
            const seconds = Math.floor((timeRemaining % (60 * 1000)) / 1000);
            
            setTimeUntilReset(`${hours}г ${minutes}хв ${seconds}с`);
        };
        
        updateTimer(); // Initial update
        const interval = setInterval(updateTimer, 1000); // Update every second
        
        return () => clearInterval(interval);
    }, []);

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
            // const targetsChanged = JSON.stringify(targets.map(t => t.targetId || t.itemId || t.instantTargetId)) !== 
            //                       JSON.stringify(lastTargetsRef.current.map(t => t.targetId || t.itemId || t.instantTargetId));
            // console.log('targetsChanged', targetsChanged);
            // console.log('lastTargetsRef.current', lastTargetsRef.current);
            // console.log('targets', targets);
            // if (!targetsChanged && lastTargetsRef.current.length > 0) return;

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
                            // Get target's attributes for filtering
                            const targetFloatValue = target.extra?.floatPartValue || target.attributes?.floatPartValue;
                            const targetPhase = target.attributes?.phase || target.extra?.phase;
                            const targetPaintSeed = target.attributes?.paintSeed || target.extra?.paintSeed;
                            
                            // Filter orders by floatPartValue, phase, and paintSeed
                            const filteredOrders = targetsData.orders.filter(order => {
                                const orderFloatValue = order.attributes?.floatPartValue;
                                const orderPhase = order.attributes?.phase;
                                const orderPaintSeed = order.attributes?.paintSeed;
                                
                                // Check floatPartValue match
                                const floatMatches = orderFloatValue === 'any' || 
                                                   (targetFloatValue && orderFloatValue === targetFloatValue) ||
                                                   (!targetFloatValue && !orderFloatValue);
                                
                                // Check phase match (if our target has phase, order must have same phase)
                                const phaseMatches = !targetPhase || (orderPhase === targetPhase);
                                
                                // Check paintSeed match (if our target has paintSeed and it's not 0, order must have same paintSeed)
                                const paintSeedMatches = !targetPaintSeed || targetPaintSeed === 0 || 
                                                        (orderPaintSeed && parseInt(orderPaintSeed) === parseInt(targetPaintSeed));
                                
                                return floatMatches && phaseMatches && paintSeedMatches;
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

                            console.log('title', title);
                            console.log('targetPrices', targetPrices);
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
    
    // Get float range data for progress bar
    const getFloatRangeData = (floatPartValue) => {
        if (!floatPartValue || floatPartValue === '' || floatPartValue === 'N/A') {
            return null;
        }
        
        // Parse the float range to get min/max values
        const range = getFloatRange(floatPartValue);
        if (range === 'Any' || range === floatPartValue) {
            return null;
        }
        
        const [min, max] = range.split('-').map(parseFloat);
        
        // Extract actual float value from floatPartValue (e.g., "FN-3" -> 0.03, "MW-2" -> 0.09)
        let value = (min + max) / 2; // Default to middle of range
        
        // Try to extract exact value from the range
        const parts = floatPartValue.split('-');
        if (parts.length === 2) {
            const suffix = parseInt(parts[1]);
            const prefix = parts[0];
            
            // Calculate approximate value based on prefix and suffix
            if (prefix === 'FN') {
                value = 0.01 * suffix + 0.005;
            } else if (prefix === 'MW') {
                value = suffix < 4 ? 0.07 + 0.01 * suffix : 0.11 + (suffix - 4) * 0.01;
            } else if (prefix === 'FT') {
                value = suffix < 4 ? 0.15 + 0.03 * suffix : 0.27 + (suffix - 4) * 0.03;
            } else if (prefix === 'WW') {
                value = suffix < 4 ? 0.38 + 0.01 * suffix : 0.42 + (suffix - 4) * 0.01;
            } else if (prefix === 'BS') {
                if (suffix === 0) value = 0.475;
                else if (suffix === 1) value = 0.565;
                else if (suffix === 2) value = 0.695;
                else if (suffix === 3) value = 0.78;
                else value = 0.90;
            }
        }
        
        // Ensure value is within range
        value = Math.max(min, Math.min(max, value));
        
        // Determine wear category and color
        let category = '';
        let color = '';
        
        if (max <= 0.07) {
            category = 'Factory New';
            color = '#10b981'; // green
        } else if (max <= 0.15) {
            category = 'Minimal Wear';
            color = '#3b82f6'; // blue
        } else if (max <= 0.38) {
            category = 'Field-Tested';
            color = '#f59e0b'; // yellow
        } else if (max <= 0.45) {
            category = 'Well-Worn';
            color = '#ff9800'; // orange
        } else {
            category = 'Battle-Scarred';
            color = '#ef4444'; // red
        }
        
        return { min, max, value, category, color, range };
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

    // Reset all target prices to 0.10 (10 cents) for target reactivation
    const resetAllTargetPrices = useCallback(async () => {
        const currentTargets = targetsRef.current;
        if (!apiService || currentTargets.length === 0) return;

        console.log('=== RESETTING ALL TARGET PRICES TO 0.10 ===');
        addLog({
            type: 'info',
            category: 'parsing',
            message: 'Скидання цін всіх таргетів до 0.10 для актуалізації',
            details: { targetsCount: currentTargets.length }
        });

        const resetPrice = '0.10'; // 10 cents in dollars
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < currentTargets.length; i++) {
            const target = currentTargets[i];
            try {
                // Add delay between updates to avoid conflicts
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
                }

                const targetId = target.targetId || target.itemId || target.instantTargetId;
                const title = target.itemTitle || target.title || target.extra?.name || target.attributes?.title;
                const gameId = target.gameId || 'a8db';
                const floatPartValue = target.extra?.floatPartValue || target.attributes?.floatPartValue || null;
                const phase = target.attributes?.phase || target.extra?.phase || null;
                const paintSeed = target.attributes?.paintSeed || target.extra?.paintSeed || null;
                const ourAmount = target.amount || 1;

                if (!title || !targetId) {
                    console.warn(`Skipping target ${targetId}: missing title or targetId`);
                    continue;
                }

                console.log(`Resetting price for ${title} (${targetId}) to ${resetPrice}`);
                await updateTarget(targetId, { 
                    price: { amount: resetPrice, currency: 'USD' }, 
                    amount: ourAmount 
                }, gameId, title, floatPartValue, phase, paintSeed, true);
                
                successCount++;
            } catch (err) {
                console.error(`Failed to reset price for target ${target.targetId || target.itemId}:`, err);
                failCount++;
            }
        }

        // Save reset time to localStorage
        const now = Date.now();
        lastPriceResetTimeRef.current = now;
        
        // Save reset stats
        const stats = {
            lastResetTime: now,
            successCount,
            failCount,
            totalCount: currentTargets.length
        };
        setResetStats(stats);
        
        try {
            localStorage.setItem('lastTargetPriceResetTime', now.toString());
            localStorage.setItem('targetPriceResetStats', JSON.stringify(stats));
        } catch (err) {
            console.error('Error saving reset data:', err);
        }

        addLog({
            type: successCount > 0 ? 'success' : 'warning',
            category: 'parsing',
            message: `Скидання цін завершено: ${successCount} успішно, ${failCount} помилок`,
            details: { successCount, failCount, targetsCount: currentTargets.length }
        });

        console.log(`Price reset completed: ${successCount} success, ${failCount} failed`);
    }, [apiService, updateTarget, addLog]);
    
    // Manual reset with confirmation
    const handleManualReset = useCallback(() => {
        showConfirmModal({
            title: 'Скинути всі ціни',
            message: 'Ви впевнені, що хочете скинути ціни всіх таргетів до $0.10? Це може зайняти деякий час.',
            confirmText: 'Скинути',
            cancelText: 'Скасувати',
            confirmVariant: 'primary',
            onConfirm: async () => {
                await resetAllTargetPrices();
                await loadTargetsWithMaxPrices(); // Reload to show updated prices
            }
        });
    }, [resetAllTargetPrices, loadTargetsWithMaxPrices]);

    // Auto-update target prices: find highest price from other targets and set 1 cent higher (but not more than maxPrice)
    const autoUpdateTargetPrices = useCallback(async () => {
        const currentTargets = targetsRef.current;
        const currentMaxPrices = maxPricesRef.current || maxPrices;
        if (!apiService || currentTargets.length === 0 || updating || isAutoUpdatingRef.current) return;

        // Check if it's time to reset prices (every 3.5 hours = 12600000 ms)
        const RESET_INTERVAL_MS = 3.5 * 60 * 60 * 1000; // 3.5 hours in milliseconds
        const now = Date.now();
        const lastResetTime = lastPriceResetTimeRef.current;
        const timeSinceLastReset = now - lastResetTime;

        // Only reset if lastResetTime exists (not first run) and enough time has passed
        if (lastResetTime > 0 && timeSinceLastReset >= RESET_INTERVAL_MS) {
            console.log(`Time to reset prices: ${timeSinceLastReset}ms since last reset (${RESET_INTERVAL_MS}ms interval)`);
            await resetAllTargetPrices();
            // After reset, continue with normal price update logic
        } else if (lastResetTime === 0) {
            // First run - initialize reset time but don't reset yet
            console.log('First run detected, initializing reset timer');
            lastPriceResetTimeRef.current = now;
            try {
                localStorage.setItem('lastTargetPriceResetTime', now.toString());
            } catch (err) {
                console.error('Error saving lastPriceResetTime:', err);
            }
        }

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
                    // Get phase from target
                    const phase = target.attributes?.phase || target.extra?.phase || null;
                    // Get paintSeed from target
                    const paintSeed = target.attributes?.paintSeed || target.extra?.paintSeed || null;
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
                        // Get target's attributes for filtering
                        const targetFloatValue = target.extra?.floatPartValue || target.attributes?.floatPartValue;
                        const targetPhase = target.attributes?.phase || target.extra?.phase;
                        const targetPaintSeed = target.attributes?.paintSeed || target.extra?.paintSeed;
                        
                        // Get our target amount
                        const ourAmount = target.amount || 1;
                        
                        // Get current target price and convert to cents for comparison
                        let currentPriceCents = 0;
                        const currentPrice = target.price?.amount || target.price?.USD || target.price;
                        if (currentPrice !== undefined && currentPrice !== null && currentPrice !== 'N/A') {
                            if (typeof currentPrice === 'string') {
                                const parsed = parseFloat(currentPrice);
                                if (!isNaN(parsed)) {
                                    currentPriceCents = parsed >= 10 ? parsed : parsed * 100;
                                }
                            } else if (typeof currentPrice === 'number') {
                                currentPriceCents = currentPrice >= 10 ? currentPrice : currentPrice * 100;
                            }
                        }
                        
                        if (currentPriceCents === 0) {
                            console.log(`Skipping target ${title}: no current price`);
                            continue;
                        }
                        
                        // Filter orders by floatPartValue, phase, and paintSeed
                        const filteredOrders = targetsData.orders.filter(order => {
                            const orderFloatValue = order.attributes?.floatPartValue;
                            const orderPhase = order.attributes?.phase;
                            const orderPaintSeed = order.attributes?.paintSeed;
                            
                            // Check floatPartValue match
                            const floatMatches = orderFloatValue === 'any' || 
                                               (targetFloatValue && orderFloatValue === targetFloatValue) ||
                                               (!targetFloatValue && !orderFloatValue);

                            // Check phase match (if our target has phase, order must have same phase)
                            const phaseMatches = !targetPhase || (orderPhase === targetPhase);

                            // Check paintSeed match (if our target has paintSeed and it's not 0, order must have same paintSeed)
                            const paintSeedMatches = !targetPaintSeed || targetPaintSeed === 0 || 
                                                    (orderPaintSeed && parseInt(orderPaintSeed) === parseInt(targetPaintSeed));  
                            return floatMatches && phaseMatches && paintSeedMatches;
                        });

                        console.log('filteredOrders', filteredOrders);
                        console.log('targetsData', targetsData);
                        console.log('Our target:', { title, ourAmount, currentPriceCents });
                        
                        // Find all our targets that match the same title/floatPartValue/phase/paintSeed to exclude them
                        const ourTargetIds = new Set();
                        const ourTargetId = target.targetId || target.itemId || target.instantTargetId;
                        
                        for (const ourTarget of currentTargets) {
                            const ourTargetTitle = ourTarget.itemTitle || ourTarget.title || ourTarget.extra?.name || ourTarget.attributes?.title;
                            const ourTargetFloat = ourTarget.extra?.floatPartValue || ourTarget.attributes?.floatPartValue;
                            const ourTargetPhase = ourTarget.attributes?.phase || ourTarget.extra?.phase;
                            const ourTargetPaintSeed = ourTarget.attributes?.paintSeed || ourTarget.extra?.paintSeed;
                            
                            // Check if this target matches the same title, floatPartValue, phase, and paintSeed
                            const titleMatch = ourTargetTitle === title;
                            const floatMatch = ourTargetFloat === targetFloatValue;
                            const phaseMatch = (!targetPhase && !ourTargetPhase) || (targetPhase === ourTargetPhase);
                            const paintSeedMatch = (!targetPaintSeed || targetPaintSeed === 0) && (!ourTargetPaintSeed || ourTargetPaintSeed === 0) ||
                                                 (targetPaintSeed && ourTargetPaintSeed && parseInt(targetPaintSeed) === parseInt(ourTargetPaintSeed));
                            
                            if (titleMatch && floatMatch && phaseMatch && paintSeedMatch) {
                                const id = ourTarget.targetId || ourTarget.itemId || ourTarget.instantTargetId;
                                ourTargetIds.add(id);
                            }
                        }
                        
                        console.log('Our targets matching:', { ourTargetIds: Array.from(ourTargetIds) });
                        
                        const maxPriceCents = parseFloat(maxPrice) * 100; // Convert maxPrice to cents
                        
                        // Find orders and check if we need to increase price
                        // We should increase price if:
                        // 1. There's a target with higher price than ours, OR
                        // 2. There's a target with same price but higher amount
                        let shouldIncreasePrice = false;
                        let highestPriceCents = currentPriceCents;
                        
                        for (const order of filteredOrders) {
                            // Get all possible identifiers for the market order
                            const orderTargetId = order.targetId || order.itemId || order.instantTargetId;
                            // Check if this order is one of our targets
                            const isOurTarget = ourTargetIds.has(orderTargetId) || 
                                              ourTargetIds.has(order.itemId) ||
                                              (order.itemId && Array.from(ourTargetIds).some(id => order.itemId === id));
                            
                            if (isOurTarget) {
                                console.log(`Excluding our own target: orderTargetId=${orderTargetId}, order.itemId=${order.itemId}`);
                                continue; // Skip our own targets
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
                            
                            if (orderPriceCents <= 0 || orderPriceCents > maxPriceCents) {
                                continue; // Skip invalid prices or prices above max
                            }
                            
                            // Get order amount (from endpoint, it's a string)
                            const orderAmount = parseInt(order.amount || '1', 10);
                            
                            // Track highest price for setting new price
                            if (orderPriceCents > highestPriceCents) {
                                highestPriceCents = orderPriceCents;
                            }
                            
                            // Check if price is higher than ours - then we should increase
                            if (orderPriceCents > currentPriceCents) {
                                shouldIncreasePrice = true;
                                console.log(`Found order with higher price: ${orderPriceCents} > ${currentPriceCents}`);
                            }
                            // Check if price is the same (within 1 cent tolerance) and amount is greater
                            else if (Math.abs(orderPriceCents - currentPriceCents) < 1) {
                                if (orderAmount > ourAmount) {
                                    shouldIncreasePrice = true;
                                    console.log(`Found order with same price (${orderPriceCents} cents) but higher amount: ${orderAmount} > ${ourAmount}`);
                                }
                            }
                        }

                        console.log('Price check result:', { shouldIncreasePrice, currentPriceCents, highestPriceCents, ourAmount });

                        // Increase price if we found orders with higher price OR same price but higher amount
                        if (shouldIncreasePrice) {
                            // Set price 1 cent higher than highest price (or current price if it's higher), but not more than maxPrice
                            let newPriceCents = Math.max(highestPriceCents, currentPriceCents) + 1; // 1 cent higher
                            if (newPriceCents > maxPriceCents) {
                                newPriceCents = maxPriceCents; // Don't exceed maxPrice
                            }

                            // Convert to dollars for API (decimal format)
                            const newPrice = (newPriceCents / 100).toFixed(2);
                            const newPriceFloat = parseFloat(newPrice);
                            
                            // Get current target price in decimal format (dollars)
                            const currentPriceFloat = currentPriceCents / 100;
                            
                            // Skip update if new price equals current price (to avoid API error)
                            if (Math.abs(newPriceFloat - currentPriceFloat) < 0.01) {
                                console.log(`Skipping update for ${title}: new price ${newPriceFloat} equals current price ${currentPriceFloat.toFixed(2)}`);
                                continue;
                            }
                            
                            // Update target price
                            console.log('=== UPDATE TARGET ===');
                            console.log('title:', title);
                            console.log('targetId:', targetId);
                            console.log('currentPrice:', currentPriceFloat.toFixed(2));
                            console.log('newPrice:', newPriceFloat);
                            console.log('ourAmount:', ourAmount);
                            console.log('maxPriceCents:', maxPriceCents);
                            try {
                                await updateTarget(targetId, { price: { amount: newPrice, currency: 'USD' }, amount: ourAmount }, gameId, title, floatPartValue, phase, paintSeed, true);
                                addLog({
                                    type: 'success',
                                    category: 'parsing',
                                    message: `Ціна таргета оновлена: ${title}`,
                                    details: {
                                        title,
                                        targetId,
                                        oldPrice: currentPriceFloat.toFixed(2),
                                        newPrice: newPriceFloat.toFixed(2),
                                        ourAmount,
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
                                        oldPrice: currentPriceFloat.toFixed(2),
                                        newPrice: newPriceFloat.toFixed(2)
                                    }
                                });
                                console.warn(`Failed to update target ${targetId}:`, errorCode, errorMessage);
                                // Don't throw - continue with next target
                            }
                        } else {
                            console.log(`Skipping price increase for ${title}: no orders with same price and higher amount found`);
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
    }, [apiService, updateTarget, loadTargets, updating, resetAllTargetPrices]); // Remove maxPrices from dependencies, use maxPricesRef instead

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
            type: 'info',
            category: 'parsing',
            message: 'Парсинг таргетів запущено',
            details: { targetsCount: targets.length, interval: '1 хвилина' }
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
            showAlertModal({
                title: 'Помилка',
                message: 'Неможливо видалити: ID не знайдено'
            });
            return;
        }
        const target = targets.find(t => (t.targetId || t.itemId || t.instantTargetId) === targetId);
        const title = target?.itemTitle || target?.title || target?.extra?.name || 'Невідомий таргет';
        const price = target?.price?.USD || 'N/A';
        const formattedPrice = typeof price === 'string' && price !== 'N/A' 
            ? (price.length >= 2 ? price.slice(0, -2) + '.' + price.slice(-2) : '0.' + price.padStart(2, '0'))
            : price;
        const status = target?.status || 'N/A';
        const amount = target?.amount || 1;
        const floatPartValue = target?.extra?.floatPartValue || target?.attributes?.floatPartValue || null;
        
        const targetInfo = (
            <div style={{ marginBottom: '16px' }}>
                <div style={{ marginBottom: '12px', padding: '12px', backgroundColor: 'var(--bg-tertiary, #333)', borderRadius: '8px', border: '1px solid var(--border-color, #444)' }}>
                    <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary, #fff)' }}>Таргет:</div>
                    <div style={{ marginBottom: '6px', color: 'var(--text-primary, #fff)' }}><strong>{title}</strong></div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '13px', color: 'var(--text-secondary, #aaa)' }}>
                        <span>Статус: <strong style={{ color: status === 'active' ? 'var(--success-color)' : 'var(--text-secondary)' }}>{status}</strong></span>
                        <span>Ціна: <strong style={{ color: 'var(--text-primary)' }}>${formattedPrice}</strong></span>
                        <span>Кількість: <strong style={{ color: 'var(--text-primary)' }}>{amount}</strong></span>
                        {floatPartValue && <span>Float: <strong style={{ color: 'var(--text-primary)' }}>{floatPartValue}</strong></span>}
                    </div>
                </div>
                <div style={{ color: 'var(--text-secondary, #aaa)', fontSize: '14px' }}>
                    {t('targets.deleteConfirm')}
                </div>
            </div>
        );
        
        showConfirmModal({
            title: 'Підтвердження видалення',
            message: targetInfo,
            onConfirm: async () => {
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
                    showAlertModal({
                        title: 'Помилка',
                        message: t('targets.deleteError') + ': ' + err.message
                    });
                }
            },
            confirmText: 'Видалити',
            cancelText: 'Скасувати',
            confirmVariant: 'danger'
        });
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
            showAlertModal({
                title: 'Помилка',
                message: 'Помилка активації таргета: ' + (err.message || 'Невідома помилка')
            });
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
            showAlertModal({
                title: 'Помилка',
                message: 'Помилка деактивації таргета: ' + (err.message || 'Невідома помилка')
            });
        } finally {
            setUpdating(false);
        }
    };

    const handleAmountChange = async (targetId, itemId, newAmount, title, gameId, floatPartValue, phase, paintSeed, currentAmount, currentPrice) => {
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
                }, gameId, title, floatPartValue, phase, paintSeed, true);
                
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

    const handleSaveWithMaxPrice = useCallback((title, floatPartValue, maxPrice, phase = null, paintSeed = null) => {
        // Store maxPrice temporarily - will be saved after target is loaded
        setPendingNewTargetMaxPrice({ title, floatPartValue, maxPrice, phase, paintSeed });
        console.log('Stored pending maxPrice for new target:', { title, floatPartValue, maxPrice, phase, paintSeed });
    }, []);
    
    // Save maxPrice for newly created target when targets are loaded
    useEffect(() => {
        if (pendingNewTargetMaxPrice && targets.length > 0) {
            const { title, floatPartValue, maxPrice, phase, paintSeed } = pendingNewTargetMaxPrice;
            // Find the target by title, floatPartValue, phase, and paintSeed
            const matchingTarget = targets.find(t => {
                const targetTitle = t.itemTitle || t.title || t.extra?.name || t.attributes?.title;
                const targetFloat = t.extra?.floatPartValue || t.attributes?.floatPartValue || '';
                const targetPhase = t.attributes?.phase || t.extra?.phase || null;
                const targetPaintSeed = t.attributes?.paintSeed || t.extra?.paintSeed || null;
                
                const titleMatch = targetTitle === title;
                const floatMatch = targetFloat === floatPartValue;
                const phaseMatch = (!phase && !targetPhase) || (phase === targetPhase);
                const paintSeedMatch = (!paintSeed || paintSeed === '0' || paintSeed === 0) && (!targetPaintSeed || targetPaintSeed === 0) ||
                                     (paintSeed && targetPaintSeed && parseInt(paintSeed) === parseInt(targetPaintSeed));
                
                return titleMatch && floatMatch && phaseMatch && paintSeedMatch;
            });
            
            if (matchingTarget && matchingTarget.itemId) {
                const itemId = matchingTarget.itemId;
                console.log('Saving maxPrice for newly created target:', { itemId, title, floatPartValue, maxPrice, phase, paintSeed });
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
                    details: { 
                        title, 
                        itemId, 
                        maxPrice, 
                        floatPartValue: floatPartValue || '', 
                        phase: phase || null,
                        paintSeed: paintSeed && paintSeed !== '0' && paintSeed !== 0 ? paintSeed : null
                    }
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

            {/* Price Reset Info Panel */}
            <div className="price-reset-panel">
                <div className="reset-timer">
                    <RiTimerLine className="reset-icon" />
                    <div className="reset-timer-info">
                        <span className="reset-timer-label">Наступне скидання:</span>
                        <span className="reset-timer-value">{timeUntilReset}</span>
                    </div>
                </div>
                
                {resetStats && (
                    <div className="reset-stats">
                        <div className="reset-stats-item">
                            <span className="reset-stats-label">Останнє скидання:</span>
                            <span className="reset-stats-value">
                                {new Date(resetStats.lastResetTime).toLocaleString('uk-UA', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </span>
                        </div>
                        <div className="reset-stats-item">
                            <span className="reset-stats-label">Результат:</span>
                            <span className="reset-stats-value">
                                {resetStats.successCount}/{resetStats.totalCount} таргетів
                                {resetStats.failCount > 0 && (
                                    <span className="reset-stats-errors"> ({resetStats.failCount} помилок)</span>
                                )}
                            </span>
                        </div>
                    </div>
                )}
                
                <button 
                    onClick={handleManualReset} 
                    className="btn btn-reset" 
                    disabled={updating || loading}
                    title="Примусово скинути всі ціни до $0.10"
                >
                    <RiRestartLine />
                    Скинути зараз
                </button>
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
                                const phase = target.attributes?.phase || target.extra?.phase || null;
                                const paintSeed = target.attributes?.paintSeed || target.extra?.paintSeed || null;
                                const gameId = target.gameId || 'a8db';
                                
                                return (
                                    <tr key={targetId || index}>
                                        <td>{index + 1}</td>
                                        <td>
                                            <div className="target-item">
                                                <span className={status === 'active' ? 'active-target-status' : 'inactive-target-status'}>{status}</span>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <span>{title}</span>
                                                    {(floatPartValue !== 'N/A' || phase || (paintSeed && paintSeed !== 0)) && (
                                                        <div style={{ fontSize: '11px', color: '#888', display: 'flex', flexDirection: 'row', gap: '10px', flexWrap: 'wrap' }}>
                                                            {floatPartValue !== 'N/A' && (
                                                                <span>
                                                                    Float: {floatPartValue} {floatRange !== floatPartValue && `(${floatRange})`}
                                                                </span>
                                                            )}
                                                            {phase && (
                                                                <span>Phase: {phase}</span>
                                                            )}
                                                            {paintSeed && paintSeed !== 0 && (
                                                                <span>Paint Seed: {paintSeed}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span 
                                                className="price-cell"
                                                title={`Ваша ціна: $${formattedPrice}`}
                                            >
                                                ${formattedPrice}
                                            </span>
                                        </td>
                                        <td>
                                            {(() => {
                                                const marketPrice = marketPrices[targetId];
                                                const ourPrice = parseFloat(formattedPrice);
                                                
                                                if (loadingMarketPrices) return '...';
                                                if (!marketPrice || marketPrice === 'N/A') return 'N/A';
                                                
                                                const marketPriceNum = parseFloat(marketPrice.replace('$', ''));
                                                const diff = ourPrice - marketPriceNum;
                                                const diffPercent = marketPriceNum > 0 ? ((diff / marketPriceNum) * 100).toFixed(1) : 0;
                                                const isHigher = diff > 0;
                                                
                                                return (
                                                    <span 
                                                        className="price-cell"
                                                        title={`Ринкова ціна: ${marketPrice}\nВаша ціна: $${formattedPrice}\nРізниця: ${isHigher ? '+' : ''}$${diff.toFixed(2)} (${isHigher ? '+' : ''}${diffPercent}%)`}
                                                        style={{
                                                            color: isHigher ? '#ef4444' : '#10b981',
                                                            cursor: 'help'
                                                        }}
                                                    >
                                                        {marketPrice}
                                                        {Math.abs(diff) > 0.01 && (
                                                            <span style={{ fontSize: '10px', marginLeft: '4px' }}>
                                                                ({isHigher ? '+' : ''}{diffPercent}%)
                                                            </span>
                                                        )}
                                                    </span>
                                                );
                                            })()}
                                        </td>
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
                                                        <RiCheckLine />
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
                                                        handleAmountChange(targetId, itemId, newAmount, title, gameId, floatPartValue !== 'N/A' ? floatPartValue : null, phase, paintSeed, amount, price);
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
                                                        <RiPauseCircleLine />
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={() => handleActivate(targetId)} 
                                                        className="btn-icon" 
                                                        title="Активувати таргет"
                                                        disabled={updating}
                                                    >
                                                        <RiPlayCircleLine />
                                                    </button>
                                                )}
                                                <button onClick={() => handleDelete(targetId)} className="btn-icon btn-icon-danger" title="Видалити">
                                                    <RiDeleteBin6Line />
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
        </div>
    );
}

export default TargetsList;

