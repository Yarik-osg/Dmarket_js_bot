import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { useTargets } from '../hooks/useTargets.js';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLogs } from '../contexts/LogsContext.jsx';
import { ApiService } from '../services/apiService.js';
import TargetForm from './TargetForm.jsx';
import { showConfirmModal, showAlertModal } from '../utils/modal.js';
import { RiSearchLine, RiAddLine, RiRefreshLine } from 'react-icons/ri';
import '../styles/TargetsList.css';
import { formatUsdFromApiCents } from '../utils/formatUsd.js';
import { getFloatRange } from '../utils/csFloatRanges.js';
import {
    buildMaxPricesSnapshot,
    mergeMaxPricesAfterLoad,
    persistMaxPricesSnapshot,
    pruneMaxPricesForTargets,
    syncMaxPricesStorage
} from '../utils/targetMaxPricesStorage.js';
import { usePersistedTargetMaxPrices } from '../hooks/usePersistedTargetMaxPrices.js';
import { useMarketBuyOrderPrices } from '../hooks/useMarketBuyOrderPrices.js';
import { useTargetPriceAutomation } from '../hooks/useTargetPriceAutomation.js';
import { TargetsTable } from './targets/TargetsTable.jsx';
import { BatchConfirmDetails } from './batch/BatchConfirmDetails.jsx';
import { PriceResetPanel } from './targets/PriceResetPanel.jsx';

function normalizeTargetUpdateErrorCode(err) {
    if (!err) return null;
    if (err.errorCode) return String(err.errorCode);
    const ft = err.failedTargets?.[0]?.errorCode || err.failed_targets?.[0]?.errorCode;
    if (ft) return String(ft);
    const m = typeof err.message === 'string' ? err.message.match(/\(([^)]+)\)\s*$/) : null;
    return m ? m[1] : null;
}

function isTargetUpdatedRecentlyError(err) {
    const code = normalizeTargetUpdateErrorCode(err);
    if (!code) return false;
    return code.replace(/_/g, '').toLowerCase() === 'targetupdatedrecently';
}

function TargetsList({ isAutoUpdatingEnabled = false }) {
    const { t } = useLocale();
    const { client } = useAuth();
    const { addLog } = useLogs();
    const { targets, loading, error, loadTargets, deleteTarget, updateTarget } = useTargets();
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch] = useDebouncedValue(searchQuery, 200);
    const [onlyActive, setOnlyActive] = useState(() => {
        try {
            return localStorage.getItem('targetsOnlyActive') === '1';
        } catch {
            return false;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('targetsOnlyActive', onlyActive ? '1' : '0');
        } catch {
            /* ignore */
        }
    }, [onlyActive]);
    const [showForm, setShowForm] = useState(false);
    const [editingTarget, setEditingTarget] = useState(null);
    const [pendingAmounts, setPendingAmounts] = useState({});

    const targetsRef = useRef(targets);
    useEffect(() => {
        targetsRef.current = targets;
    }, [targets]);

    const {
        maxPrices,
        setMaxPrices,
        maxPricesRef,
        pendingMaxPrices,
        setPendingMaxPrices,
        handleSaveWithMaxPrice
    } = usePersistedTargetMaxPrices(targets, { addLog });

    const apiService = useMemo(() => {
        return client ? new ApiService(client) : null;
    }, [client]);

    const loadTargetsWithMaxPrices = useCallback(
        async (items = []) => {
            try {
                const currentMaxPrices = maxPricesRef.current || maxPrices;
                const currentTargets = targetsRef.current || targets;
                if (Object.keys(currentMaxPrices).length > 0) {
                    const snapshot = buildMaxPricesSnapshot(currentTargets, currentMaxPrices);
                    persistMaxPricesSnapshot(snapshot);
                    if (import.meta.env.DEV) {
                        console.log('Saved maxPrices before loadTargets:', snapshot.maxPrices);
                        console.log('Saved maxPricesByKey before loadTargets:', snapshot.maxPricesByKey);
                    }
                }
            } catch (err) {
                console.error('Error saving maxPrices before loadTargets:', err);
            }

            const fresh = await loadTargets(items);
            if (fresh !== undefined) {
                try {
                    let merged;
                    const saved = localStorage.getItem('targetsMaxPrices');
                    if (saved) {
                        const savedByKey = localStorage.getItem('targetsMaxPricesByKey');
                        const savedMaxPrices = JSON.parse(saved);
                        const savedMaxPricesByKey = savedByKey ? JSON.parse(savedByKey) : {};
                        merged = mergeMaxPricesAfterLoad(savedMaxPrices, savedMaxPricesByKey, fresh);
                        if (import.meta.env.DEV) {
                            console.log('Restoring maxPrices after loadTargets (merged):', merged);
                        }
                    } else {
                        merged = { ...(maxPricesRef.current || {}) };
                        if (import.meta.env.DEV) {
                            console.warn('No saved targetsMaxPrices in localStorage; pruning current ref');
                        }
                    }
                    const pruned = pruneMaxPricesForTargets(merged, fresh);
                    syncMaxPricesStorage(fresh, pruned);
                    setMaxPrices(pruned);
                    maxPricesRef.current = pruned;
                    if (import.meta.env.DEV) {
                        console.log('maxPrices after prune:', pruned);
                    }
                } catch (err) {
                    console.error('Error restoring maxPrices after loadTargets:', err);
                }
            }
        },
        [loadTargets, setMaxPrices]
    );

    const sawLoadingCycleRef = useRef(false);
    useEffect(() => {
        if (loading) {
            sawLoadingCycleRef.current = true;
            return;
        }
        if (!sawLoadingCycleRef.current || error || !client) return;

        const current = maxPricesRef.current || {};
        const pruned = pruneMaxPricesForTargets(current, targets);
        const same =
            Object.keys(pruned).length === Object.keys(current).length &&
            Object.keys(pruned).every((k) => pruned[k] === current[k]);
        if (!same) {
            setMaxPrices(pruned);
            maxPricesRef.current = pruned;
            syncMaxPricesStorage(targets, pruned);
        }

        const validIds = new Set(
            targets.map((x) => x.itemId).filter((id) => id != null && id !== '').map(String)
        );
        setPendingMaxPrices((prev) => {
            const next = {};
            let changed = false;
            for (const [k, v] of Object.entries(prev)) {
                if (validIds.has(String(k))) next[k] = v;
                else changed = true;
            }
            return changed ? next : prev;
        });
    }, [targets, loading, error, client, setMaxPrices, setPendingMaxPrices]);

    useEffect(() => {
        if (client && !loading) {
            loadTargetsWithMaxPrices();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client]);

    const { marketPrices, loadingMarketPrices, authError } = useMarketBuyOrderPrices({
        apiService,
        targets,
        loading
    });

    const {
        updating,
        setUpdating,
        timeUntilReset,
        resetStats,
        bulkProgress,
        handleManualReset
    } = useTargetPriceAutomation({
        apiService,
        targetsRef,
        maxPricesRef,
        updateTarget,
        loadTargetsWithMaxPrices,
        addLog,
        isAutoUpdatingEnabled,
        targetsLength: targets.length
    });

    const handleRefresh = async () => {
        await loadTargetsWithMaxPrices();
    };

    const handleDelete = async (targetId) => {
        if (!targetId) {
            showAlertModal({
                title: 'Помилка',
                message: 'Неможливо видалити: ID не знайдено'
            });
            return;
        }
        const target = targets.find((t) => (t.targetId || t.itemId || t.instantTargetId) === targetId);
        const title = target?.itemTitle || target?.title || target?.extra?.name || 'Невідомий таргет';
        const price = target?.price?.USD || 'N/A';
        const formattedPrice = formatUsdFromApiCents(price);
        const status = target?.status || 'N/A';
        const amount = target?.amount || 1;
        const floatPartValue = target?.extra?.floatPartValue || target?.attributes?.floatPartValue || null;

        const targetInfo = (
            <div style={{ marginBottom: '16px' }}>
                <div
                    style={{
                        marginBottom: '12px',
                        padding: '12px',
                        backgroundColor: 'var(--bg-tertiary, #333)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color, #444)'
                    }}
                >
                    <div style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary, #fff)' }}>
                        Таргет:
                    </div>
                    <div style={{ marginBottom: '6px', color: 'var(--text-primary, #fff)' }}>
                        <strong>{title}</strong>
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '12px',
                            fontSize: '13px',
                            color: 'var(--text-secondary, #aaa)'
                        }}
                    >
                        <span>
                            Статус:{' '}
                            <strong
                                style={{
                                    color: status === 'active' ? 'var(--success-color)' : 'var(--text-secondary)'
                                }}
                            >
                                {status}
                            </strong>
                        </span>
                        <span>
                            Ціна:{' '}
                            <strong style={{ color: 'var(--text-primary)' }}>${formattedPrice}</strong>
                        </span>
                        <span>
                            Кількість:{' '}
                            <strong style={{ color: 'var(--text-primary)' }}>{amount}</strong>
                        </span>
                        {floatPartValue && (
                            <span>
                                Float:{' '}
                                <strong style={{ color: 'var(--text-primary)' }}>{floatPartValue}</strong>
                            </span>
                        )}
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
        const target = targets.find((t) => (t.targetId || t.itemId || t.instantTargetId) === targetId);
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
        const target = targets.find((t) => (t.targetId || t.itemId || t.instantTargetId) === targetId);
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

    const getTargetRowIdForBatch = (target) =>
        target.targetId || target.itemId || target.instantTargetId;

    const buildTargetBatchModalItems = useCallback(
        (rows) =>
            rows.map((target, idx) => {
                const title =
                    target.itemTitle || target.title || target.extra?.name || t('target.unknownItem');
                const price = formatUsdFromApiCents(target.price?.USD || 'N/A');
                const status = target.status || '—';
                const amount = target.amount ?? 1;
                const fp = target.extra?.floatPartValue || target.attributes?.floatPartValue;
                const tid = getTargetRowIdForBatch(target);
                const lines = [
                    `${t('target.price')}: $${price}`,
                    `${t('batch.status')} ${status}`,
                    `${t('targets.quantity')}: ${amount}`,
                    fp ? `${t('target.float')}: ${fp}` : null
                ].filter(Boolean);
                return { key: tid ? String(tid) : `target-${idx}`, title, lines };
            }),
        [t]
    );

    const handleBatchDeleteTargets = useCallback(
        (selected, clearSelection) => {
            if (!selected?.length || !apiService) return;
            const ids = selected.map(getTargetRowIdForBatch).filter((id) => id != null && id !== '');
            if (ids.length === 0) {
                showAlertModal({
                    title: t('targets.error'),
                    message: t('targets.deleteError')
                });
                return;
            }
            const items = buildTargetBatchModalItems(selected);
            showConfirmModal({
                title: t('common.delete'),
                message: (
                    <BatchConfirmDetails
                        intro={t('batch.confirmDeleteTargets').replace('{n}', String(ids.length))}
                        items={items}
                    />
                ),
                onConfirm: async () => {
                    try {
                        await apiService.deleteTargetsBatch(ids);
                        addLog({
                            type: 'success',
                            category: 'target',
                            message: `Видалено таргетів: ${ids.length}`,
                            details: { count: ids.length }
                        });
                        await loadTargetsWithMaxPrices();
                        clearSelection();
                    } catch (err) {
                        addLog({
                            type: 'error',
                            category: 'target',
                            message: `Помилка масового видалення таргетів: ${err.message}`,
                            details: { count: ids.length, error: err.message }
                        });
                        showAlertModal({
                            title: t('targets.error'),
                            message: t('targets.deleteError') + ': ' + err.message
                        });
                    }
                },
                confirmText: t('common.delete'),
                cancelText: t('common.cancel'),
                confirmVariant: 'danger'
            });
        },
        [apiService, loadTargetsWithMaxPrices, addLog, t, buildTargetBatchModalItems]
    );

    const handleBatchDeactivateTargets = useCallback(
        (selected, clearSelection) => {
            if (!apiService) return;
            const active = selected.filter((x) => (x.status || '').toLowerCase() === 'active');
            if (active.length === 0) {
                showAlertModal({
                    title: t('targets.error'),
                    message: t('batch.noActiveToDeactivate')
                });
                return;
            }
            const ids = active.map(getTargetRowIdForBatch).filter((id) => id != null && id !== '');
            if (ids.length === 0) return;
            const items = buildTargetBatchModalItems(active);
            showConfirmModal({
                title: t('batch.deactivate'),
                message: (
                    <BatchConfirmDetails
                        intro={t('batch.confirmDeactivateTargets').replace('{n}', String(ids.length))}
                        items={items}
                    />
                ),
                onConfirm: async () => {
                    try {
                        setUpdating(true);
                        await apiService.deactivateTargets(ids);
                        addLog({
                            type: 'success',
                            category: 'target',
                            message: `Деактивовано таргетів: ${ids.length}`,
                            details: { count: ids.length }
                        });
                        await loadTargetsWithMaxPrices();
                        clearSelection();
                    } catch (err) {
                        addLog({
                            type: 'error',
                            category: 'target',
                            message: `Помилка масової деактивації: ${err.message}`,
                            details: { count: ids.length, error: err.message }
                        });
                        showAlertModal({
                            title: t('targets.error'),
                            message: 'Помилка деактивації таргета: ' + (err.message || 'Невідома помилка')
                        });
                    } finally {
                        setUpdating(false);
                    }
                },
                confirmText: t('batch.deactivate'),
                cancelText: t('common.cancel'),
                confirmVariant: 'primary'
            });
        },
        [apiService, loadTargetsWithMaxPrices, addLog, t, setUpdating, buildTargetBatchModalItems]
    );

    const handleAmountChange = async (
        targetId,
        itemId,
        newAmount,
        title,
        gameId,
        floatPartValue,
        phase,
        paintSeed,
        currentAmount,
        currentPrice
    ) => {
        const amount = parseInt(newAmount, 10);
        if (isNaN(amount) || amount < 1) {
            return;
        }

        if (amount === currentAmount) {
            return;
        }

        try {
            setUpdating(true);
            let priceAmount = currentPrice;
            if (typeof priceAmount === 'string' && priceAmount !== 'N/A') {
                const cents = parseFloat(priceAmount);
                priceAmount = cents >= 10 ? (cents / 100).toFixed(2) : (cents / 100).toFixed(2);
            } else if (typeof priceAmount === 'number') {
                priceAmount = priceAmount >= 10 ? (priceAmount / 100).toFixed(2) : (priceAmount / 100).toFixed(2);
            } else {
                priceAmount = '0.00';
            }

            try {
                const response = await updateTarget(
                    targetId,
                    {
                        price: { amount: priceAmount, currency: 'USD' },
                        amount
                    },
                    gameId,
                    title,
                    floatPartValue,
                    phase,
                    paintSeed,
                    true
                );

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
                const errorCode = updateErr.errorCode || 'UnknownError';
                const errorMessage = updateErr.message || 'Помилка оновлення кількості';
                const error = new Error(`${errorMessage} (${errorCode})`);
                error.errorCode = errorCode;
                if (updateErr.failedTargets) error.failedTargets = updateErr.failedTargets;
                throw error;
            }
        } catch (err) {
            console.error('Error updating target amount:', err);
            const errorCode = normalizeTargetUpdateErrorCode(err);
            const recentlyBlocked = isTargetUpdatedRecentlyError(err);

            addLog({
                type: recentlyBlocked ? 'warning' : 'error',
                category: 'target',
                message: recentlyBlocked
                    ? `Кількість не змінено (обмеження DMarket ~15 хв): ${title}`
                    : `Помилка оновлення кількості таргета: ${title}`,
                details: {
                    title,
                    targetId,
                    error: err.message,
                    errorCode: errorCode || 'UnknownError'
                }
            });

            if (recentlyBlocked) {
                showAlertModal({
                    title: t('targets.targetUpdatedRecentlyTitle'),
                    message: t('targets.targetUpdatedRecentlyMessage')
                });
            } else {
                showAlertModal({
                    title: t('targets.error'),
                    message: 'Помилка оновлення кількості: ' + (err.message || 'Невідома помилка')
                });
            }
        } finally {
            setUpdating(false);
            setPendingAmounts((prev) => {
                const next = { ...prev };
                delete next[targetId];
                return next;
            });
        }
    };

    const clearQuantityPending = (targetId) =>
        setPendingAmounts((prev) => {
            const next = { ...prev };
            delete next[targetId];
            return next;
        });

    /** Blur: скинути чернетку, якщо значення невалідне або не відрізняється від поточної кількості. */
    const handleQuantityBlurDiscard = (targetId, raw, amount) => {
        const newAmount = parseInt(raw, 10);
        if (isNaN(newAmount) || newAmount < 1 || newAmount === amount) {
            clearQuantityPending(targetId);
        }
    };

    /** Кнопка ✓ або Enter: підтвердження модалкою, потім API. */
    const handleQuantityApply = (targetId, row) => {
        const raw = pendingAmounts[targetId];
        if (raw === undefined) return;

        const newAmount = parseInt(raw, 10);
        if (isNaN(newAmount) || newAmount < 1) {
            clearQuantityPending(targetId);
            return;
        }
        if (newAmount === row.amount) {
            clearQuantityPending(targetId);
            return;
        }

        const { itemId, title, gameId, floatPartValue, phase, paintSeed, amount, price } = row;

        const intro = t('targets.quantityChangeIntro')
            .replace('{title}', title)
            .replace('{from}', String(amount))
            .replace('{to}', String(newAmount));

        showConfirmModal({
            title: t('targets.quantityChangeTitle'),
            message: (
                <div>
                    <p style={{ margin: '0 0 12px' }}>{intro}</p>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary, #aaa)' }}>
                        {t('targets.quantityChangeNote')}
                    </p>
                </div>
            ),
            onConfirm: async () => {
                await handleAmountChange(
                    targetId,
                    itemId,
                    newAmount,
                    title,
                    gameId,
                    floatPartValue,
                    phase,
                    paintSeed,
                    amount,
                    price
                );
            },
            onCancel: () => clearQuantityPending(targetId),
            confirmText: t('targets.quantityChangeConfirm'),
            cancelText: t('common.cancel'),
            confirmVariant: 'primary'
        });
    };

    const handleApplyMaxPrice = async (itemId) => {
        const pendingPrice = pendingMaxPrices[itemId];
        if (!pendingPrice || !itemId) {
            if (import.meta.env.DEV) {
                console.warn('handleApplyMaxPrice: missing pendingPrice or itemId', { pendingPrice, itemId });
            }
            return;
        }

        try {
            setUpdating(true);
            if (import.meta.env.DEV) {
                console.log('Applying maxPrice:', { itemId, pendingPrice, currentMaxPrices: maxPrices });
            }
            setMaxPrices((prev) => {
                const updated = {
                    ...prev,
                    [itemId]: pendingPrice
                };
                if (import.meta.env.DEV) {
                    console.log('Updated maxPrices:', updated);
                }
                return updated;
            });
            setPendingMaxPrices((prev) => {
                const newPending = { ...prev };
                delete newPending[itemId];
                return newPending;
            });
            await loadTargetsWithMaxPrices();
            const target = targets.find((t) => t.itemId === itemId);
            const title = target?.itemTitle || target?.title || target?.extra?.name || 'Невідомий таргет';
            addLog({
                type: 'success',
                category: 'target',
                message: `Максимальна ціна встановлена: ${title}`,
                details: { title, itemId, maxPrice: pendingPrice }
            });
        } catch (err) {
            console.error('Error applying maxPrice:', err);
            const target = targets.find((t) => t.itemId === itemId);
            const title = target?.itemTitle || target?.title || target?.extra?.name || 'Невідомий таргет';
            addLog({
                type: 'error',
                category: 'target',
                message: `Помилка застосування максимальної ціни: ${title}`,
                details: { title, itemId, error: err.message }
            });
            showAlertModal({
                title: 'Помилка',
                message: 'Помилка застосування максимальної ціни: ' + err.message
            });
        } finally {
            setUpdating(false);
        }
    };

    const handleAdd = () => {
        setEditingTarget(null);
        setShowForm(true);
    };

    const searchFilteredTargets = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase();
        if (!q) return targets;
        return targets.filter((target) => {
            const title =
                target.itemTitle || target.title || target.attributes?.title || target.extra?.name || '';
            return title.toLowerCase().includes(q);
        });
    }, [targets, debouncedSearch]);

    const displayTargets = useMemo(() => {
        if (!onlyActive) return searchFilteredTargets;
        return searchFilteredTargets.filter((target) => {
            const s = String(target.status || '').toLowerCase();
            return s === 'active';
        });
    }, [searchFilteredTargets, onlyActive]);

    const loadingTable = loading && displayTargets.length > 0;

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
                    <div className="targets-search-wrap">
                        <RiSearchLine className="targets-search-icon" aria-hidden />
                        <input
                            type="search"
                            className="targets-search"
                            placeholder={t('targets.search')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            aria-label={t('targets.search')}
                        />
                    </div>
                    <label className="targets-only-active">
                        <input
                            type="checkbox"
                            className="targets-only-active-input"
                            checked={onlyActive}
                            onChange={(e) => setOnlyActive(e.currentTarget.checked)}
                        />
                        <span className="targets-only-active-face" aria-hidden />
                        <span className="targets-only-active-text">{t('targets.onlyActive')}</span>
                    </label>
                    <button type="button" className="btn btn-primary" onClick={handleAdd}>
                        <RiAddLine size={18} />
                        {t('targets.add')}
                    </button>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleRefresh}
                        disabled={loading || updating}
                    >
                        <RiRefreshLine size={18} />
                        {t('targets.refresh')}
                    </button>
                </div>
            </div>

            <PriceResetPanel
                timeUntilReset={timeUntilReset}
                resetStats={resetStats}
                onManualReset={handleManualReset}
                disabled={updating || loading}
                bulkProgress={bulkProgress}
            />

            {loading && <div className="loading">{t('targets.loading')}</div>}
            {error && (
                <div className="error targets-page-error" role="alert">
                    <div className="targets-page-error__title">{t('targets.error')}</div>
                    <p className="targets-page-error__message">{error}</p>
                    <p className="targets-page-error__hint">{t('targets.errorHint')}</p>
                </div>
            )}
            {authError && (
                <div className="error" style={{ marginTop: '10px' }}>
                    ⚠️ Не вдалося завантажити ціни buy orders: потрібна автентифікація API. Перевірте API ключі
                    та права доступу.
                </div>
            )}
            {loadingMarketPrices && (
                <div className="loading targets-market-prices-hint">
                    Завантаження ринкових цін...
                </div>
            )}

            <TargetsTable
                t={t}
                filteredTargets={displayTargets}
                targetsLength={targets.length}
                searchMatchCount={searchFilteredTargets.length}
                onlyActiveFilter={onlyActive}
                onClearActiveFilter={() => setOnlyActive(false)}
                searchQuery={debouncedSearch.trim()}
                onClearSearch={() => setSearchQuery('')}
                marketPrices={marketPrices}
                loadingMarketPrices={loadingMarketPrices}
                loadingTable={loadingTable}
                maxPrices={maxPrices}
                pendingMaxPrices={pendingMaxPrices}
                pendingAmounts={pendingAmounts}
                onMaxPricePendingChange={(itemId, val) =>
                    setPendingMaxPrices((prev) => ({ ...prev, [itemId]: val }))
                }
                onApplyMaxPrice={handleApplyMaxPrice}
                onQuantityPendingChange={(targetId, val) =>
                    setPendingAmounts((prev) => ({ ...prev, [targetId]: val }))
                }
                onQuantityBlurDiscard={handleQuantityBlurDiscard}
                onQuantityApply={handleQuantityApply}
                updating={updating}
                onDeactivate={handleDeactivate}
                onActivate={handleActivate}
                onDelete={handleDelete}
                getFloatRange={getFloatRange}
                unknownItemLabel={t('target.unknownItem')}
                marketLegendText={t('targets.marketLegend')}
                onBatchDeleteTargets={handleBatchDeleteTargets}
                onBatchDeactivateTargets={handleBatchDeactivateTargets}
            />
        </div>
    );
}

export default TargetsList;
