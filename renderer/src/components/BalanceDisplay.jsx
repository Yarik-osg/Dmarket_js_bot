import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useNotifications } from '../contexts/NotificationContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { ApiService } from '../services/apiService.js';
import { sumOffersNetUsd } from '../utils/offerListingPrice.js';
import { RiWallet3Line, RiRefreshLine, RiArrowUpSLine, RiArrowDownSLine } from 'react-icons/ri';
import '../styles/BalanceDisplay.css';

const BALANCE_COLLAPSED_KEY = 'balanceDisplayCollapsed';

function BalanceDisplay() {
    const { t } = useLocale();
    const { client } = useAuth();
    const { checkLowBalance } = useNotifications();
    const [balance, setBalance] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [listedNetUsd, setListedNetUsd] = useState(null);
    const [listedError, setListedError] = useState(null);
    const loadingRef = useRef(false);
    const errorRef = useRef(null);
    const lastBalanceRef = useRef(null);
    const [sectionCollapsed, setSectionCollapsed] = useState(() => {
        try {
            return localStorage.getItem(BALANCE_COLLAPSED_KEY) === '1';
        } catch {
            return false;
        }
    });

    const toggleSectionCollapsed = useCallback(() => {
        setSectionCollapsed((prev) => {
            const next = !prev;
            try {
                localStorage.setItem(BALANCE_COLLAPSED_KEY, next ? '1' : '0');
            } catch {
                /* ignore */
            }
            return next;
        });
    }, []);

    const apiService = useMemo(() => {
        return client ? new ApiService(client) : null;
    }, [client]);

    useEffect(() => {
        if (!apiService) {
            setListedNetUsd(null);
            setListedError(null);
        }
    }, [apiService]);

    const loadListedOffersNet = useCallback(async () => {
        if (!apiService) return;
        setListedError(null);
        try {
            const response = await apiService.getUserOffers({
                currency: 'USD',
                gameId: 'a8db',
                limit: 100
            });
            const offersList = response?.objects?.filter((obj) => obj.type === 'offer') || [];
            setListedNetUsd(sumOffersNetUsd(offersList));
        } catch (err) {
            console.error('Error loading offers for balance estimate:', err);
            setListedError(err.message || 'error');
            setListedNetUsd(null);
        }
    }, [apiService]);

    const loadBalance = useCallback(
        async (forceRetry = false) => {
            if (!apiService || loadingRef.current) return;

            if (
                !forceRetry &&
                (errorRef.current?.includes('404') || errorRef.current?.includes('403'))
            ) {
                return;
            }

            loadingRef.current = true;
            setLoading(true);
            setError(null);

            try {
                const data = await apiService.getUserBalance();
                console.log('balance data', data);
                setBalance(data);
                setError(null);
                errorRef.current = null;

                checkLowBalance(data);

                lastBalanceRef.current = data;
            } catch (err) {
                console.error('Error loading balance:', err);
                const errorMsg = err.message || 'Unknown error';
                setError(errorMsg);
                errorRef.current = errorMsg;
            } finally {
                setLoading(false);
                loadingRef.current = false;
            }
        },
        [apiService, checkLowBalance]
    );

    useEffect(() => {
        if (apiService) {
            loadBalance(false);
            loadListedOffersNet();
            const interval = setInterval(() => {
                loadBalance(false);
                loadListedOffersNet();
            }, 5 * 60 * 1000);

            return () => clearInterval(interval);
        }
    }, [apiService, loadBalance, loadListedOffersNet]);

    const handleRefresh = useCallback(() => {
        loadBalance(true);
        loadListedOffersNet();
    }, [loadBalance, loadListedOffersNet]);

    if (!client) return null;

    if (loading && !balance) {
        return (
            <div className="balance-display">
                <div className="balance-loading">{t('balance.loadingShort')}</div>
            </div>
        );
    }

    if (error) {
        return (
            <div
                className={`balance-display balance-display--error${
                    sectionCollapsed ? ' balance-display--collapsed' : ''
                }`}
            >
                <div className="balance-header">
                    <button
                        type="button"
                        className="balance-section-toggle"
                        onClick={toggleSectionCollapsed}
                        aria-expanded={!sectionCollapsed}
                        title={sectionCollapsed ? t('balance.sectionExpand') : t('balance.sectionCollapse')}
                    >
                        {sectionCollapsed ? (
                            <RiArrowDownSLine className="balance-section-toggle-icon" aria-hidden />
                        ) : (
                            <RiArrowUpSLine className="balance-section-toggle-icon" aria-hidden />
                        )}
                    </button>
                    <span className="balance-header-title">
                        <RiWallet3Line aria-hidden /> Баланс
                    </span>
                    <button
                        type="button"
                        onClick={handleRefresh}
                        className="balance-refresh-btn"
                        disabled={loading}
                        title={t('balance.refreshTitle')}
                        aria-label={t('balance.refreshTitle')}
                    >
                        <RiRefreshLine
                            style={{
                                animation: loading ? 'spin 1s linear infinite' : 'none'
                            }}
                        />
                    </button>
                </div>
                {!sectionCollapsed && (
                    <>
                        <div className="balance-error">{t('balance.loadError')}</div>
                        <p className="balance-error-detail">{error}</p>
                        <div className="balance-error-retry">
                            <button
                                type="button"
                                className="balance-error-retry-btn"
                                onClick={handleRefresh}
                                disabled={loading}
                            >
                                <RiRefreshLine size={18} aria-hidden />
                                {t('balance.refreshTitle')}
                            </button>
                        </div>
                    </>
                )}
            </div>
        );
    }

    // Format price from cents (string) to dollars (string with decimal point)
    // API returns values as strings in cents
    const formatBalance = (amountStr) => {
        if (!amountStr && amountStr !== '0') return '0.00';
        const amount = typeof amountStr === 'string' ? amountStr : amountStr.toString();
        if (amount.length >= 2) {
            return amount.slice(0, -2) + '.' + amount.slice(-2);
        }
        return '0.' + amount.padStart(2, '0');
    };

    const parseUsdCents = (value) => {
        const n = parseInt(String(value ?? '0'), 10);
        return Number.isFinite(n) ? n : 0;
    };

    // API returns: { usd: "string", usdAvailableToWithdraw: "string", ... } — USD у центах (рядок)
    const usdAvailable = balance?.usdAvailableToWithdraw || '0';
    const usdFrozen = balance?.usdTradeProtected || '0';
    const availableCents = parseUsdCents(usdAvailable);
    const frozenCents = parseUsdCents(usdFrozen);
    const walletDollars = (availableCents + frozenCents) / 100;

    const grandWithOffersDollars =
        listedNetUsd !== null && !listedError ? walletDollars + listedNetUsd : null;

    return (
        <div className={`balance-display${sectionCollapsed ? ' balance-display--collapsed' : ''}`}>
            <div className="balance-header">
                <button
                    type="button"
                    className="balance-section-toggle"
                    onClick={toggleSectionCollapsed}
                    aria-expanded={!sectionCollapsed}
                    title={sectionCollapsed ? t('balance.sectionExpand') : t('balance.sectionCollapse')}
                >
                    {sectionCollapsed ? (
                        <RiArrowDownSLine className="balance-section-toggle-icon" aria-hidden />
                    ) : (
                        <RiArrowUpSLine className="balance-section-toggle-icon" aria-hidden />
                    )}
                </button>
                <span className="balance-header-title">
                    <RiWallet3Line aria-hidden /> Баланс
                </span>
                <button
                    type="button"
                    onClick={handleRefresh}
                    className="balance-refresh-btn"
                    disabled={loading}
                    title={t('balance.refreshTitle')}
                    aria-label={t('balance.refreshTitle')}
                >
                    <RiRefreshLine style={{ 
                        animation: loading ? 'spin 1s linear infinite' : 'none' 
                    }} />
                </button>
            </div>
            {!sectionCollapsed && (
            <>
            <div className="balance-item">
                <span className="balance-label">Доступно:</span>
                <span className="balance-value available">${formatBalance(usdAvailable)}</span>
            </div>
            <div className="balance-item">
                <span className="balance-label">Заморожено:</span>
                <span className="balance-value frozen">${formatBalance(usdFrozen)}</span>
            </div>
            <div className="balance-item listed-net">
                <span
                    className="balance-label"
                    title={t('balance.listedNetHint')}
                >
                    {t('balance.listedNet')}:
                </span>
                <span className="balance-value listed">
                    {listedError
                        ? '—'
                        : listedNetUsd === null
                          ? '…'
                          : `$${listedNetUsd.toFixed(2)}`}
                </span>
            </div>
            <div className="balance-item total">
                <span className="balance-label">Всього:</span>
                <span className="balance-value total">${walletDollars.toFixed(2)}</span>
            </div>
            <div className="balance-item">
                <span className="balance-label">{t('balance.totalWithOffers')}:</span>
                <span className="balance-value total">
                    {grandWithOffersDollars === null ? '…' : `$${grandWithOffersDollars.toFixed(2)}`}
                </span>
            </div>
            </>
            )}
        </div>
    );
}

export default BalanceDisplay;


