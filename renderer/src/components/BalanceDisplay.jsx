import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useNotifications } from '../contexts/NotificationContext.jsx';
import { ApiService } from '../services/apiService.js';
import '../styles/BalanceDisplay.css';

function BalanceDisplay() {
    const { client } = useAuth();
    const { checkLowBalance } = useNotifications();
    const [balance, setBalance] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const loadingRef = useRef(false);
    const errorRef = useRef(null);
    const lastBalanceRef = useRef(null);

    const apiService = useMemo(() => {
        return client ? new ApiService(client) : null;
    }, [client]);

    const loadBalance = async () => {
        if (!apiService || loadingRef.current) return;
        
        // Don't retry if we got 404 or 403 error
        if (errorRef.current?.includes('404') || errorRef.current?.includes('403')) {
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
            
            // Check for low balance
            checkLowBalance(data);
            
            // Store last balance for comparison
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
    };

    // Load balance on mount and periodically
    useEffect(() => {
        if (apiService) {
            loadBalance();
            // Check balance every 5 minutes
            const interval = setInterval(() => {
                loadBalance();
            }, 5 * 60 * 1000);
            
            return () => clearInterval(interval);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiService]);

    const handleRefresh = () => {
        loadBalance();
    };

    if (!client) return null;

    if (loading && !balance) {
        return (
            <div className="balance-display">
                <div className="balance-loading">Завантаження...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="balance-display">
                <div className="balance-error">Помилка завантаження балансу</div>
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

    // API returns: { usd: "string", usdAvailableToWithdraw: "string", dmc: "string", dmcAvailableToWithdraw: "string" }
    // All values are in cents (for USD) or dimoshi (for DMC) as strings
    const usdTotal = balance?.usd || '0';
    const usdAvailable = balance?.usdAvailableToWithdraw || '0';
    const usdFrozen = balance?.usdTradeProtected || '0';

    return (
        <div className="balance-display">
            <div className="balance-header">
                <span>💰 Баланс</span>
                <button 
                    onClick={handleRefresh} 
                    className="balance-refresh-btn"
                    disabled={loading}
                    title="Оновити баланс"
                >
                    {loading ? '⏳' : '🔄'}
                </button>
            </div>
            <div className="balance-item">
                <span className="balance-label">Доступно:</span>
                <span className="balance-value available">${formatBalance(usdAvailable)}</span>
            </div>
            <div className="balance-item">
                <span className="balance-label">Заморожено:</span>
                <span className="balance-value frozen">${formatBalance(usdFrozen)}</span>
            </div>
            <div className="balance-item total">
                <span className="balance-label">Всього:</span>
                <span className="balance-value total">${formatBalance(String(Number(usdAvailable) + Number(usdFrozen)))}</span>
            </div>
        </div>
    );
}

export default BalanceDisplay;


