import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { useLogs } from '../contexts/LogsContext.jsx';
import { useAnalytics } from '../contexts/AnalyticsContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { showConfirmModal, showAlertModal } from '../utils/modal.js';
import { RiSearchLine, RiAddLine, RiRefreshLine } from 'react-icons/ri';
import '../styles/OffersList.css';
import { formatUsdFromApiCents } from '../utils/formatUsd.js';
import OfferForm from './OfferForm.jsx';
import { OffersTable } from './offers/OffersTable.jsx';
import { useOffers, getOfferId } from '../hooks/useOffers.js';
import { useOfferMarketPrices } from '../hooks/useOfferMarketPrices.js';
import { usePersistedOfferMinPrices } from '../hooks/usePersistedOfferMinPrices.js';
import { useOfferAutoUpdate } from '../hooks/useOfferAutoUpdate.js';

function OffersList({ isAutoUpdatingEnabled = false, onToggleAutoUpdate }) {
    const { t } = useLocale();
    const { client } = useAuth();
    const { addLog } = useLogs();
    const { addTransaction } = useAnalytics();

    const { offers, loading, error, loadOffers, offersRef, apiService } = useOffers({
        addLog,
        addTransaction
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch] = useDebouncedValue(searchQuery, 200);
    const [showOfferForm, setShowOfferForm] = useState(false);

    const {
        minPrices,
        setMinPrices,
        minPricesRef,
        pendingMinPrices,
        setPendingMinPrices,
        maxPrices,
        setMaxPrices,
        maxPricesRef,
        pendingMaxPrices,
        setPendingMaxPrices,
        skipForParsing,
        setSkipForParsing,
        skipForParsingRef,
        flushToLocalStorage
    } = usePersistedOfferMinPrices(offers);

    const { marketPrices, loadingMarketPrices } = useOfferMarketPrices({
        apiService,
        offers,
        loading
    });

    const { updating } = useOfferAutoUpdate({
        apiService,
        offersRef,
        minPricesRef,
        maxPricesRef,
        skipForParsingRef,
        flushToLocalStorage,
        loadOffers,
        addLog,
        isAutoUpdatingEnabled,
        offersLength: offers.length
    });

    useEffect(() => {
        if (client && !loading) loadOffers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client]);

    const handleRefresh = useCallback(async () => {
        flushToLocalStorage();
        await loadOffers();
    }, [loadOffers, flushToLocalStorage]);

    const handleApplyPriceBounds = useCallback(
        (itemId) => {
            const hasPendingMin = pendingMinPrices[itemId] !== undefined;
            const hasPendingMax = pendingMaxPrices[itemId] !== undefined;
            if (!hasPendingMin && !hasPendingMax) return;

            const offer = offers.find((o) => o.itemId === itemId);
            const minStr = hasPendingMin
                ? pendingMinPrices[itemId]
                : String(minPrices[itemId] ?? offer?.minPrice ?? '');
            let maxStr;
            if (hasPendingMax) {
                maxStr = pendingMaxPrices[itemId];
            } else {
                maxStr = maxPrices[itemId];
            }

            const minNum = parseFloat(String(minStr).replace(',', '.'));
            if (!String(minStr).trim() || isNaN(minNum) || minNum <= 0) {
                showAlertModal({
                    title: t('offers.error'),
                    message: t('offers.priceBoundsInvalid')
                });
                return;
            }
            if (maxStr !== undefined && maxStr !== null && String(maxStr).trim() !== '') {
                const maxNum = parseFloat(String(maxStr).replace(',', '.'));
                if (isNaN(maxNum) || maxNum < minNum) {
                    showAlertModal({
                        title: t('offers.error'),
                        message: t('offers.maxBelowMin')
                    });
                    return;
                }
            }

            setMinPrices((prev) => ({ ...prev, [itemId]: String(minNum) }));
            setMaxPrices((prev) => {
                if (!hasPendingMax) return prev;
                const next = { ...prev };
                if (maxStr === undefined || maxStr === null || String(maxStr).trim() === '') {
                    delete next[itemId];
                } else {
                    next[itemId] = String(
                        parseFloat(String(maxStr).replace(',', '.'))
                    );
                }
                return next;
            });
            setPendingMinPrices((prev) => {
                const next = { ...prev };
                delete next[itemId];
                return next;
            });
            setPendingMaxPrices((prev) => {
                const next = { ...prev };
                delete next[itemId];
                return next;
            });

            const title = offer?.title || 'Невідомий офер';
            addLog({
                type: 'success',
                category: 'offer',
                message: `Діапазон цін для парсингу збережено: ${title}`,
                details: {
                    title,
                    itemId,
                    minPrice: String(minNum),
                    maxPrice:
                        maxStr !== undefined &&
                        maxStr !== null &&
                        String(maxStr).trim() !== ''
                            ? String(maxStr)
                            : undefined
                }
            });
        },
        [
            pendingMinPrices,
            pendingMaxPrices,
            minPrices,
            maxPrices,
            offers,
            setMinPrices,
            setMaxPrices,
            setPendingMinPrices,
            setPendingMaxPrices,
            addLog,
            t
        ]
    );

    const handleCancelPriceBounds = useCallback((itemId) => {
        setPendingMinPrices((prev) => {
            if (prev[itemId] === undefined) return prev;
            const next = { ...prev };
            delete next[itemId];
            return next;
        });
        setPendingMaxPrices((prev) => {
            if (prev[itemId] === undefined) return prev;
            const next = { ...prev };
            delete next[itemId];
            return next;
        });
    }, [setPendingMinPrices, setPendingMaxPrices]);

    const handleDelete = useCallback(
        async (offer) => {
            const offerId = getOfferId(offer);
            const title = offer.title || 'Невідомий офер';
            const price = offer.price?.USD || 'N/A';
            const formattedPrice = formatUsdFromApiCents(price);
            const floatValue = offer.extra?.floatValue
                ? parseFloat(offer.extra.floatValue).toFixed(5)
                : null;

            if (!offerId) {
                showAlertModal({ title: 'Помилка', message: 'Неможливо видалити: ID не знайдено' });
                return;
            }

            const offerInfo = (
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
                        <div
                            style={{
                                fontWeight: '600',
                                marginBottom: '8px',
                                color: 'var(--text-primary, #fff)'
                            }}
                        >
                            Офер:
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
                                Ціна:{' '}
                                <strong style={{ color: 'var(--text-primary)' }}>
                                    ${formattedPrice}
                                </strong>
                            </span>
                            {floatValue && (
                                <span>
                                    Float:{' '}
                                    <strong style={{ color: 'var(--text-primary)' }}>
                                        {floatValue}
                                    </strong>
                                </span>
                            )}
                        </div>
                    </div>
                    <div style={{ color: 'var(--text-secondary, #aaa)', fontSize: '14px' }}>
                        Ця дія незворотна. Видалений офер не можна буде відновити.
                    </div>
                </div>
            );

            showConfirmModal({
                title: 'Підтвердження видалення',
                message: offerInfo,
                onConfirm: async () => {
                    try {
                        await apiService.deleteOffer(offer);
                        addLog({
                            type: 'success',
                            category: 'offer',
                            message: `Офер видалено: ${title}`,
                            details: { offerId, title }
                        });
                        await new Promise((r) => setTimeout(r, 1000));
                        await loadOffers();
                    } catch (err) {
                        addLog({
                            type: 'error',
                            category: 'offer',
                            message: `Помилка видалення офера: ${title}`,
                            details: { offerId, title, error: err.message }
                        });
                        showAlertModal({
                            title: 'Помилка',
                            message: 'Помилка видалення офера: ' + err.message
                        });
                    }
                },
                confirmText: 'Видалити',
                cancelText: 'Скасувати',
                confirmVariant: 'danger'
            });
        },
        [apiService, loadOffers, addLog]
    );

    const filteredOffers = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase();
        if (!q) return offers;
        return offers.filter((o) => {
            const title = o.title || o.extra?.name || o.attributes?.title || '';
            return title.toLowerCase().includes(q);
        });
    }, [offers, debouncedSearch]);

    const loadingTable = loading && filteredOffers.length > 0;

    return (
        <div className="offers-list">
            <div className="offers-header">
                <h1 className="offers-title">{t('offers.title')}</h1>
                <div className="offers-actions">
                    <div className="offers-search-wrap">
                        <RiSearchLine className="offers-search-icon" aria-hidden />
                        <input
                            type="search"
                            className="offers-search"
                            placeholder={t('offers.search')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            aria-label={t('offers.search')}
                        />
                    </div>
                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setShowOfferForm(true)}
                    >
                        <RiAddLine size={18} />
                        {t('offers.createOffers')}
                    </button>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleRefresh}
                        disabled={loading}
                    >
                        <RiRefreshLine size={18} />
                        {t('offers.refresh')}
                    </button>
                </div>
            </div>

            {error && (
                <div className="error">
                    {t('offers.error')}: {error}
                </div>
            )}
            {loadingMarketPrices && (
                <div className="loading offers-market-prices-hint">
                    Завантаження ринкових цін...
                </div>
            )}

            <OffersTable
                t={t}
                filteredOffers={filteredOffers}
                offersLength={offers.length}
                searchQuery={debouncedSearch.trim()}
                onClearSearch={() => setSearchQuery('')}
                marketPrices={marketPrices}
                loadingMarketPrices={loadingMarketPrices}
                loadingTable={loadingTable}
                minPrices={minPrices}
                pendingMinPrices={pendingMinPrices}
                maxPrices={maxPrices}
                pendingMaxPrices={pendingMaxPrices}
                onMinPricePendingChange={(itemId, val) =>
                    setPendingMinPrices((prev) => ({ ...prev, [itemId]: val }))
                }
                onMaxPricePendingChange={(itemId, val) =>
                    setPendingMaxPrices((prev) => ({ ...prev, [itemId]: val }))
                }
                onApplyPriceBounds={handleApplyPriceBounds}
                onCancelPriceBounds={handleCancelPriceBounds}
                skipForParsing={skipForParsing}
                onSkipChange={(itemId, checked) =>
                    setSkipForParsing((prev) => ({ ...prev, [itemId]: checked }))
                }
                updating={updating}
                onDelete={handleDelete}
                unknownItemLabel={t('target.unknownItem')}
            />

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
