import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { setDmarketHttpReporter } from '../utils/apiHealthBridge.js';

const NotificationContext = createContext();

const API_ERROR_WINDOW_MS = 60_000;
const API_ERROR_THRESHOLD = 5;
const API_SUCCESS_CLEAR_STREAK = 2;

export function NotificationProvider({ children }) {
    const [notifications, setNotifications] = useState([]);
    const [apiConnectionBanner, setApiConnectionBanner] = useState(null);
    const apiErrorTimestampsRef = useRef([]);
    const apiSuccessStreakRef = useRef(0);
    const [settings, setSettings] = useState(() => {
        const saved = localStorage.getItem('notificationSettings');
        return saved ? JSON.parse(saved) : {
            sales: true,
            purchases: true,
            lowBalance: true,
            apiErrors: true,
            opportunities: true,
            lowBalanceThreshold: 10.00,
            telegram: { enabled: false, botToken: '', chatId: '' },
            email: { enabled: false }
        };
    });

    useEffect(() => {
        localStorage.setItem('notificationSettings', JSON.stringify(settings));
    }, [settings]);

    const showNotification = useCallback((notification) => {
        const id = Date.now() + Math.random();
        const newNotification = {
            id,
            timestamp: new Date().toISOString(),
            read: false,
            ...notification
        };

        setNotifications(prev => [newNotification, ...prev].slice(0, 500));

        // External notifications (Telegram)
        if (notification.sendExternal !== false) {
            sendExternalNotification(notification);
        }

        return id;
    }, [settings]);

    const sendExternalNotification = useCallback(async (notification) => {
        const message = `${notification.title || 'DMarket Bot'}: ${notification.message}`;

        // Telegram
        // Check if Telegram is enabled, configured, and this notification type is enabled
        const isTelegramEnabled = settings.telegram?.enabled && 
                                  settings.telegram?.botToken && 
                                  settings.telegram?.chatId &&
                                  settings[notification.type]; // Check if this notification type is enabled
        
        console.log('Sending external notification:', {
            type: notification.type,
            telegramEnabled: settings.telegram?.enabled,
            hasBotToken: !!settings.telegram?.botToken,
            hasChatId: !!settings.telegram?.chatId,
            typeEnabled: settings[notification.type],
            willSendTelegram: isTelegramEnabled
        });

        if (isTelegramEnabled) {
            try {
                const url = `https://api.telegram.org/bot${settings.telegram.botToken}/sendMessage`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: settings.telegram.chatId,
                        text: message,
                        parse_mode: 'HTML'
                    })
                });
                
                const result = await response.json();
                if (result.ok) {
                    console.log('Telegram notification sent successfully');
                } else {
                    console.error('Telegram API error:', result);
                }
            } catch (err) {
                console.error('Telegram notification error:', err);
            }
        } else {
            console.log('Telegram notification skipped:', {
                reason: !settings.telegram?.enabled ? 'Telegram disabled' :
                       !settings.telegram?.botToken ? 'No bot token' :
                       !settings.telegram?.chatId ? 'No chat ID' :
                       !settings[notification.type] ? `Type ${notification.type} disabled` : 'Unknown'
            });
        }
    }, [settings]);

    const checkLowBalance = useCallback((balance) => {
        if (balance && settings.lowBalance) {
            const available = parseFloat(balance.usdAvailableToWithdraw || '0') / 100;
            if (available < settings.lowBalanceThreshold) {
                showNotification({
                    type: 'lowBalance',
                    title: 'Низький баланс',
                    message: `Доступний баланс: $${available.toFixed(2)}`,
                    level: 'warning',
                    sendExternal: true
                });
            }
        }
    }, [settings, showNotification]);

    const markAsRead = useCallback((id) => {
        setNotifications(prev => 
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
    }, []);

    const markAllAsRead = useCallback(() => {
        setNotifications(prev => 
            prev.map(n => ({ ...n, read: true }))
        );
    }, []);

    const clearNotifications = useCallback(() => {
        setNotifications([]);
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    const dismissApiConnectionBanner = useCallback(() => {
        setApiConnectionBanner(null);
    }, []);

    const reportDmarketHttp = useCallback((payload) => {
        if (payload.ok) {
            apiSuccessStreakRef.current += 1;
            if (apiSuccessStreakRef.current >= API_SUCCESS_CLEAR_STREAK) {
                setApiConnectionBanner(null);
                apiErrorTimestampsRef.current = [];
            }
            return;
        }

        apiSuccessStreakRef.current = 0;

        if (payload.status === 429) {
            setApiConnectionBanner({
                kind: 'rate_limit',
                since: Date.now(),
                retryAfterSec:
                    payload.retryAfterSec != null && Number.isFinite(payload.retryAfterSec)
                        ? payload.retryAfterSec
                        : null
            });
            return;
        }

        const now = Date.now();
        apiErrorTimestampsRef.current = apiErrorTimestampsRef.current.filter(
            (t) => now - t < API_ERROR_WINDOW_MS
        );
        apiErrorTimestampsRef.current.push(now);
        if (apiErrorTimestampsRef.current.length >= API_ERROR_THRESHOLD) {
            setApiConnectionBanner({ kind: 'errors', since: now });
        }
    }, []);

    useEffect(() => {
        setDmarketHttpReporter(reportDmarketHttp);
        return () => setDmarketHttpReporter(null);
    }, [reportDmarketHttp]);

    return (
        <NotificationContext.Provider value={{
            notifications,
            showNotification,
            checkLowBalance,
            settings,
            setSettings,
            markAsRead,
            markAllAsRead,
            clearNotifications,
            unreadCount,
            apiConnectionBanner,
            dismissApiConnectionBanner
        }}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within NotificationProvider');
    }
    return context;
}

