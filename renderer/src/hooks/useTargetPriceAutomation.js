import { useState, useEffect, useCallback, useRef } from 'react';
import { filterOrdersForTarget, buildOurTargetIdSet } from '../utils/targetOrdersFilter.js';
import { parseTargetPriceToCents } from '../utils/dmarketPrice.js';
import { showConfirmModal } from '../utils/modal.js';

const RESET_INTERVAL_MS = 3.5 * 60 * 60 * 1000;

function readLastResetTime() {
    try {
        const saved = localStorage.getItem('lastTargetPriceResetTime');
        return saved ? parseInt(saved, 10) : 0;
    } catch {
        return 0;
    }
}

/**
 * Timer text for next scheduled price reset, bulk reset/update, auto-update loop.
 */
export function useTargetPriceAutomation({
    apiService,
    targetsRef,
    maxPricesRef,
    updateTarget,
    loadTargetsWithMaxPrices,
    addLog,
    isAutoUpdatingEnabled,
    targetsLength
}) {
    const [updating, setUpdating] = useState(false);
    const [timeUntilReset, setTimeUntilReset] = useState('');
    const [resetStats, setResetStats] = useState(() => {
        try {
            const saved = localStorage.getItem('targetPriceResetStats');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });
    /** @type {{ kind: string; current: number; total: number } | null} */
    const [bulkProgress, setBulkProgress] = useState(null);

    const lastPriceResetTimeRef = useRef(readLastResetTime());
    const autoUpdateIntervalRef = useRef(null);
    const isAutoUpdatingRef = useRef(false);
    const autoUpdateTargetPricesRef = useRef(null);

    useEffect(() => {
        const updateTimer = () => {
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

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, []);

    const resetAllTargetPrices = useCallback(async () => {
        const currentTargets = targetsRef.current;
        if (!apiService || currentTargets.length === 0) return;

        if (import.meta.env.DEV) {
            console.log('=== RESETTING ALL TARGET PRICES TO 0.10 ===');
        }
        addLog({
            type: 'info',
            category: 'parsing',
            message: 'Скидання цін всіх таргетів до 0.10 для актуалізації',
            details: { targetsCount: currentTargets.length }
        });

        const resetPrice = '0.10';
        let successCount = 0;
        let failCount = 0;
        const total = currentTargets.length;
        setBulkProgress({ kind: 'reset', current: 0, total });

        for (let i = 0; i < currentTargets.length; i++) {
            const target = currentTargets[i];
            setBulkProgress({ kind: 'reset', current: i + 1, total });
            try {
                if (i > 0) {
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                }

                const targetId = target.targetId || target.itemId || target.instantTargetId;
                const title =
                    target.itemTitle || target.title || target.extra?.name || target.attributes?.title;
                const gameId = target.gameId || 'a8db';
                const floatPartValue = target.extra?.floatPartValue || target.attributes?.floatPartValue || null;
                const phase = target.attributes?.phase || target.extra?.phase || null;
                const paintSeed = target.attributes?.paintSeed || target.extra?.paintSeed || null;
                const ourAmount = target.amount || 1;

                if (!title || !targetId) {
                    if (import.meta.env.DEV) {
                        console.warn(`Skipping target ${targetId}: missing title or targetId`);
                    }
                    continue;
                }

                await updateTarget(
                    targetId,
                    {
                        price: { amount: resetPrice, currency: 'USD' },
                        amount: ourAmount
                    },
                    gameId,
                    title,
                    floatPartValue,
                    phase,
                    paintSeed,
                    true
                );

                successCount++;
            } catch (err) {
                console.error(`Failed to reset price for target ${target.targetId || target.itemId}:`, err);
                failCount++;
            }
        }

        setBulkProgress(null);

        const now = Date.now();
        lastPriceResetTimeRef.current = now;

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

        if (import.meta.env.DEV) {
            console.log(`Price reset completed: ${successCount} success, ${failCount} failed`);
        }
    }, [apiService, updateTarget, addLog, targetsRef]);

    const autoUpdateTargetPrices = useCallback(async () => {
        const currentTargets = targetsRef.current;
        const currentMaxPrices = maxPricesRef.current || {};
        if (!apiService || currentTargets.length === 0 || updating || isAutoUpdatingRef.current) return;

        const now = Date.now();
        const lastResetTime = lastPriceResetTimeRef.current;
        const timeSinceLastReset = now - lastResetTime;

        if (lastResetTime > 0 && timeSinceLastReset >= RESET_INTERVAL_MS) {
            if (import.meta.env.DEV) {
                console.log(
                    `Time to reset prices: ${timeSinceLastReset}ms since last reset (${RESET_INTERVAL_MS}ms interval)`
                );
            }
            await resetAllTargetPrices();
        } else if (lastResetTime === 0) {
            if (import.meta.env.DEV) {
                console.log('First run detected, initializing reset timer');
            }
            lastPriceResetTimeRef.current = now;
            try {
                localStorage.setItem('lastTargetPriceResetTime', now.toString());
            } catch (err) {
                console.error('Error saving lastPriceResetTime:', err);
            }
        }

        isAutoUpdatingRef.current = true;
        setUpdating(true);
        const total = currentTargets.length;
        setBulkProgress({ kind: 'auto', current: 0, total });

        try {
            for (let i = 0; i < currentTargets.length; i++) {
                const target = currentTargets[i];
                setBulkProgress({ kind: 'auto', current: i + 1, total });
                try {
                    if (target.status === 'inactive' || target.status === 'Inactive') {
                        if (import.meta.env.DEV) {
                            console.log(`Skipping inactive target: ${target.targetId || target.itemId}`);
                        }
                        continue;
                    }

                    if (i > 0) {
                        await new Promise((resolve) => setTimeout(resolve, 1000));
                    }

                    const targetId = target.targetId || target.itemId || target.instantTargetId;
                    const itemId = target.itemId;
                    const title =
                        target.itemTitle || target.title || target.extra?.name || target.attributes?.title;
                    const gameId = target.gameId || 'a8db';
                    const floatPartValue = target.extra?.floatPartValue || target.attributes?.floatPartValue || null;
                    const phase = target.attributes?.phase || target.extra?.phase || null;
                    const paintSeed = target.attributes?.paintSeed || target.extra?.paintSeed || null;
                    const maxPrice = currentMaxPrices[itemId] || target.maxPrice;

                    if (!title || !targetId || !maxPrice) {
                        if (import.meta.env.DEV) {
                            console.warn(
                                `Skipping target ${targetId}: missing title (${title}), targetId (${targetId}), or maxPrice (${maxPrice})`
                            );
                        }
                        continue;
                    }

                    const targetFloatValue = target.extra?.floatPartValue || target.attributes?.floatPartValue;
                    const targetPhase = target.attributes?.phase || target.extra?.phase;
                    const targetPaintSeed = target.attributes?.paintSeed || target.extra?.paintSeed;

                    const targetsData = await apiService.getTargetsByTitle(gameId, title);

                    if (targetsData?.orders && targetsData.orders.length > 0) {
                        const ourAmount = target.amount || 1;

                        const currentPrice = target.price?.amount || target.price?.USD || target.price;
                        let currentPriceCents = parseTargetPriceToCents(currentPrice);

                        if (currentPriceCents === 0) {
                            if (import.meta.env.DEV) {
                                console.log(`Skipping target ${title}: no current price`);
                            }
                            continue;
                        }

                        const filteredOrders = filterOrdersForTarget(targetsData.orders, target);

                        if (import.meta.env.DEV) {
                            console.log('filteredOrders', filteredOrders);
                            console.log('targetsData', targetsData);
                            console.log('Our target:', { title, ourAmount, currentPriceCents });
                        }

                        const ourTargetIds = buildOurTargetIdSet(
                            currentTargets,
                            title,
                            targetFloatValue,
                            targetPhase,
                            targetPaintSeed
                        );

                        if (import.meta.env.DEV) {
                            console.log('Our targets matching:', { ourTargetIds: Array.from(ourTargetIds) });
                        }

                        const maxPriceCents = parseFloat(String(maxPrice)) * 100;

                        let shouldIncreasePrice = false;
                        let highestPriceCents = currentPriceCents;

                        for (const order of filteredOrders) {
                            const orderTargetId = order.targetId || order.itemId || order.instantTargetId;
                            const isOurTarget =
                                ourTargetIds.has(orderTargetId) ||
                                ourTargetIds.has(order.itemId) ||
                                (order.itemId &&
                                    Array.from(ourTargetIds).some((id) => order.itemId === id));

                            if (isOurTarget) {
                                if (import.meta.env.DEV) {
                                    console.log(
                                        `Excluding our own target: orderTargetId=${orderTargetId}, order.itemId=${order.itemId}`
                                    );
                                }
                                continue;
                            }

                            const orderPrice = order.price?.amount || order.price?.USD || order.price;
                            const orderPriceCents = parseTargetPriceToCents(orderPrice);

                            if (orderPriceCents <= 0 || orderPriceCents > maxPriceCents) {
                                continue;
                            }

                            const orderAmount = parseInt(order.amount || '1', 10);

                            if (orderPriceCents > highestPriceCents) {
                                highestPriceCents = orderPriceCents;
                            }

                            if (orderPriceCents > currentPriceCents) {
                                shouldIncreasePrice = true;
                                if (import.meta.env.DEV) {
                                    console.log(
                                        `Found order with higher price: ${orderPriceCents} > ${currentPriceCents}`
                                    );
                                }
                            } else if (Math.abs(orderPriceCents - currentPriceCents) < 1) {
                                if (orderAmount > ourAmount) {
                                    shouldIncreasePrice = true;
                                    if (import.meta.env.DEV) {
                                        console.log(
                                            `Found order with same price (${orderPriceCents} cents) but higher amount: ${orderAmount} > ${ourAmount}`
                                        );
                                    }
                                }
                            }
                        }

                        if (import.meta.env.DEV) {
                            console.log('Price check result:', {
                                shouldIncreasePrice,
                                currentPriceCents,
                                highestPriceCents,
                                ourAmount
                            });
                        }

                        if (shouldIncreasePrice) {
                            let newPriceCents = Math.max(highestPriceCents, currentPriceCents) + 1;
                            if (newPriceCents > maxPriceCents) {
                                newPriceCents = maxPriceCents;
                            }

                            const newPrice = (newPriceCents / 100).toFixed(2);
                            const newPriceFloat = parseFloat(newPrice);
                            const currentPriceFloat = currentPriceCents / 100;

                            if (Math.abs(newPriceFloat - currentPriceFloat) < 0.01) {
                                if (import.meta.env.DEV) {
                                    console.log(
                                        `Skipping update for ${title}: new price ${newPriceFloat} equals current price ${currentPriceFloat.toFixed(2)}`
                                    );
                                }
                                continue;
                            }

                            if (import.meta.env.DEV) {
                                console.log('=== UPDATE TARGET ===');
                                console.log('title:', title);
                                console.log('targetId:', targetId);
                                console.log('currentPrice:', currentPriceFloat.toFixed(2));
                                console.log('newPrice:', newPriceFloat);
                                console.log('ourAmount:', ourAmount);
                                console.log('maxPriceCents:', maxPriceCents);
                            }
                            try {
                                await updateTarget(
                                    targetId,
                                    { price: { amount: newPrice, currency: 'USD' }, amount: ourAmount },
                                    gameId,
                                    title,
                                    floatPartValue,
                                    phase,
                                    paintSeed,
                                    true
                                );
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
                                        maxPrice
                                    }
                                });
                            } catch (updateErr) {
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
                                if (import.meta.env.DEV) {
                                    console.warn(`Failed to update target ${targetId}:`, errorCode, errorMessage);
                                }
                            }
                        } else if (import.meta.env.DEV) {
                            console.log(
                                `Skipping price increase for ${title}: no orders with same price and higher amount found`
                            );
                        }
                    }
                } catch (err) {
                    console.error(`Error auto-updating target ${target.targetId || target.itemId}:`, err);
                    const errTitle =
                        target.itemTitle || target.title || target.extra?.name || 'Невідомий таргет';
                    addLog({
                        type: 'error',
                        category: 'parsing',
                        message: `Помилка оновлення ціни таргета: ${errTitle}`,
                        details: {
                            title: errTitle,
                            targetId: target.targetId || target.itemId,
                            error: err.message
                        }
                    });
                }
            }

            await new Promise((resolve) => setTimeout(resolve, 1000));
            await loadTargetsWithMaxPrices();
        } catch (err) {
            console.error('Error in auto-update target prices:', err);
        } finally {
            setUpdating(false);
            isAutoUpdatingRef.current = false;
            setBulkProgress(null);
        }
    }, [
        apiService,
        updateTarget,
        loadTargetsWithMaxPrices,
        updating,
        resetAllTargetPrices,
        maxPricesRef,
        targetsRef
    ]);

    autoUpdateTargetPricesRef.current = autoUpdateTargetPrices;

    const handleManualReset = useCallback(() => {
        showConfirmModal({
            title: 'Скинути всі ціни',
            message:
                'Ви впевнені, що хочете скинути ціни всіх таргетів до $0.10? Це може зайняти деякий час.',
            confirmText: 'Скинути',
            cancelText: 'Скасувати',
            confirmVariant: 'primary',
            onConfirm: async () => {
                await resetAllTargetPrices();
                await loadTargetsWithMaxPrices();
            }
        });
    }, [resetAllTargetPrices, loadTargetsWithMaxPrices]);

    useEffect(() => {
        if (!apiService || targetsLength === 0 || !isAutoUpdatingEnabled) {
            if (autoUpdateIntervalRef.current) {
                clearInterval(autoUpdateIntervalRef.current);
                autoUpdateIntervalRef.current = null;
                addLog({
                    type: 'info',
                    category: 'parsing',
                    message: 'Парсинг таргетів зупинено',
                    details: { targetsCount: targetsLength }
                });
            }
            return;
        }

        if (autoUpdateIntervalRef.current) {
            clearInterval(autoUpdateIntervalRef.current);
        }

        if (import.meta.env.DEV) {
            console.log('Starting auto-update interval');
        }
        addLog({
            type: 'info',
            category: 'parsing',
            message: 'Парсинг таргетів запущено',
            details: { targetsCount: targetsLength, interval: '1 хвилина' }
        });

        autoUpdateIntervalRef.current = setInterval(() => {
            if (!isAutoUpdatingRef.current && autoUpdateTargetPricesRef.current) {
                if (import.meta.env.DEV) {
                    console.log('autoUpdateTargetPrices triggered');
                }
                autoUpdateTargetPricesRef.current();
            }
        }, 60000);

        return () => {
            if (autoUpdateIntervalRef.current) {
                clearInterval(autoUpdateIntervalRef.current);
                autoUpdateIntervalRef.current = null;
            }
        };
    }, [apiService, targetsLength, isAutoUpdatingEnabled, addLog]);

    return {
        updating,
        setUpdating,
        timeUntilReset,
        resetStats,
        bulkProgress,
        resetAllTargetPrices,
        autoUpdateTargetPrices,
        handleManualReset
    };
}
