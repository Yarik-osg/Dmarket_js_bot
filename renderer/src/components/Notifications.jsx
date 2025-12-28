import React, { useState } from 'react';
import { useNotifications } from '../contexts/NotificationContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import '../styles/Notifications.css';

function Notifications() {
    const { t } = useLocale();
    const { 
        notifications, 
        settings, 
        setSettings, 
        markAsRead, 
        markAllAsRead, 
        clearNotifications,
        unreadCount 
    } = useNotifications();

    const [activeTab, setActiveTab] = useState('list');

    const handleSettingChange = (key, value) => {
        setSettings(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleTelegramChange = (key, value) => {
        setSettings(prev => ({
            ...prev,
            telegram: {
                ...prev.telegram,
                [key]: value
            }
        }));
    };


    const unreadNotifications = notifications.filter(n => !n.read);
    const readNotifications = notifications.filter(n => n.read);

    return (
        <div className="notifications-container">
            <div className="notifications-header">
                <h1 className="notifications-title">{t('notifications.title')}</h1>
                <div className="notifications-tabs">
                    <button 
                        className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
                        onClick={() => setActiveTab('list')}
                    >
                        Сповіщення {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
                        onClick={() => setActiveTab('settings')}
                    >
                        {t('notifications.settings')}
                    </button>
                </div>
            </div>

            {activeTab === 'list' && (
                <div className="notifications-list-container">
                    <div className="notifications-actions">
                        <button 
                            className="btn btn-secondary"
                            onClick={markAllAsRead}
                            disabled={unreadCount === 0}
                        >
                            Позначити всі як прочитані
                        </button>
                        <button 
                            className="btn btn-secondary"
                            onClick={clearNotifications}
                            disabled={notifications.length === 0}
                        >
                            Очистити всі
                        </button>
                    </div>

                    {unreadNotifications.length > 0 && (
                        <div className="notifications-section">
                            <h2>Непрочитані ({unreadNotifications.length})</h2>
                            <div className="notifications-list">
                                {unreadNotifications.map(notification => (
                                    <NotificationItem 
                                        key={notification.id} 
                                        notification={notification}
                                        onMarkAsRead={markAsRead}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {readNotifications.length > 0 && (
                        <div className="notifications-section">
                            <h2>Прочитані ({readNotifications.length})</h2>
                            <div className="notifications-list">
                                {readNotifications.map(notification => (
                                    <NotificationItem 
                                        key={notification.id} 
                                        notification={notification}
                                        onMarkAsRead={markAsRead}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {notifications.length === 0 && (
                        <div className="notifications-empty">
                            Немає сповіщень
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'settings' && (
                <div className="notifications-settings">
                    <div className="settings-section">
                        <h2>Тестування</h2>
                        <div className="setting-item">
                            <p style={{ marginBottom: '10px', color: 'var(--text-secondary)' }}>
                                Протестуйте сповіщення без реальних транзакцій:
                            </p>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => {
                                        if (window.testTransaction) {
                                            window.testTransaction('sell', 'AK-47 | Redline (Field-Tested)', 25.50);
                                        } else {
                                            alert('TransactionMonitor не ініціалізовано. Перезавантажте сторінку.');
                                        }
                                    }}
                                >
                                    Тест: Продаж
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => {
                                        if (window.testTransaction) {
                                            window.testTransaction('buy', 'M4A1-S | Hyper Beast (Well-Worn)', 15.30);
                                        } else {
                                            alert('TransactionMonitor не ініціалізовано. Перезавантажте сторінку.');
                                        }
                                    }}
                                >
                                    Тест: Покупка
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => {
                                        if (window.testTargetClosed) {
                                            window.testTargetClosed('MP9 | Starlight Protector (Field-Tested)', 66.06);
                                        } else {
                                            alert('TransactionMonitor не ініціалізовано. Перезавантажте сторінку.');
                                        }
                                    }}
                                >
                                    Тест: Таргет закрито
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="settings-section">
                        <h2>Типи сповіщень</h2>
                        
                        <div className="setting-item">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={settings.sales}
                                    onChange={(e) => handleSettingChange('sales', e.target.checked)}
                                />
                                {t('notifications.sales')}
                            </label>
                        </div>

                        <div className="setting-item">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={settings.purchases}
                                    onChange={(e) => handleSettingChange('purchases', e.target.checked)}
                                />
                                {t('notifications.purchases')}
                            </label>
                        </div>

                        <div className="setting-item">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={settings.lowBalance}
                                    onChange={(e) => handleSettingChange('lowBalance', e.target.checked)}
                                />
                                {t('notifications.lowBalance')}
                            </label>
                        </div>

                        <div className="setting-item">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={settings.apiErrors}
                                    onChange={(e) => handleSettingChange('apiErrors', e.target.checked)}
                                />
                                {t('notifications.apiErrors')}
                            </label>
                        </div>

                        <div className="setting-item">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={settings.opportunities}
                                    onChange={(e) => handleSettingChange('opportunities', e.target.checked)}
                                />
                                {t('notifications.opportunities')}
                            </label>
                        </div>

                        <div className="setting-item">
                            <label>
                                {t('notifications.lowBalanceThreshold')}
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={settings.lowBalanceThreshold}
                                    onChange={(e) => handleSettingChange('lowBalanceThreshold', parseFloat(e.target.value))}
                                    className="setting-input"
                                />
                            </label>
                        </div>
                    </div>

                    <div className="settings-section">
                        <h2>{t('notifications.telegram')}</h2>
                        
                        <div className="setting-item">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={settings.telegram?.enabled || false}
                                    onChange={(e) => handleTelegramChange('enabled', e.target.checked)}
                                />
                                {t('notifications.enabled')}
                            </label>
                        </div>

                        {settings.telegram?.enabled && (
                            <>
                                <div className="setting-item">
                                    <label>
                                        {t('notifications.botToken')}
                                        <input
                                            type="password"
                                            value={settings.telegram?.botToken || ''}
                                            onChange={(e) => handleTelegramChange('botToken', e.target.value)}
                                            className="setting-input"
                                            placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                                        />
                                    </label>
                                </div>

                                <div className="setting-item">
                                    <label>
                                        {t('notifications.chatId')}
                                        <input
                                            type="text"
                                            value={settings.telegram?.chatId || ''}
                                            onChange={(e) => handleTelegramChange('chatId', e.target.value)}
                                            className="setting-input"
                                            placeholder="-1001234567890"
                                        />
                                    </label>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function NotificationItem({ notification, onMarkAsRead }) {
    const getLevelIcon = (level) => {
        switch (level) {
            case 'success': return '✅';
            case 'error': return '❌';
            case 'warning': return '⚠️';
            case 'info': return 'ℹ️';
            default: return '📢';
        }
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'щойно';
        if (minutes < 60) return `${minutes} хв тому`;
        if (hours < 24) return `${hours} год тому`;
        if (days < 7) return `${days} дн тому`;
        return date.toLocaleDateString('uk-UA');
    };

    return (
        <div className={`notification-item ${notification.read ? 'read' : 'unread'}`}>
            <div className="notification-icon">
                {getLevelIcon(notification.level)}
            </div>
            <div className="notification-content">
                <div className="notification-header">
                    <h3 className="notification-title">{notification.title}</h3>
                    <span className="notification-time">{formatTime(notification.timestamp)}</span>
                </div>
                <p className="notification-message">{notification.message}</p>
            </div>
            {!notification.read && (
                <button 
                    className="notification-mark-read"
                    onClick={() => onMarkAsRead(notification.id)}
                    title="Позначити як прочитане"
                >
                    ✓
                </button>
            )}
        </div>
    );
}

export default Notifications;

