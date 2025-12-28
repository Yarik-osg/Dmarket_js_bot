import React from 'react';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { useNotifications } from '../../contexts/NotificationContext.jsx';
import BalanceDisplay from '../BalanceDisplay.jsx';
import '../../styles/Sidebar.css';

function Sidebar({ activeTab, onTabChange, isTargetsParsingEnabled, isOffersParsingEnabled, onToggleTargetsParsing, onToggleOffersParsing }) {
    const { t } = useLocale();
    const { unreadCount } = useNotifications();

    const menuItems = [
        { id: 'orders', label: t('nav.orders'), icon: '📋' },
        { id: 'offers', label: t('nav.offers'), icon: '💰' },
        { id: 'analytics', label: t('nav.analytics'), icon: '📈' },
        { id: 'notifications', label: t('nav.notifications'), icon: '🔔', badge: unreadCount > 0 ? unreadCount : null },
        { id: 'settings', label: t('nav.settings'), icon: '⚙️' },
        { id: 'logs', label: t('nav.logs'), icon: '📊' }
    ];

    return (
        <div className="sidebar">
            <div className="sidebar-menu">
                {menuItems.map(item => (
                    <div
                        key={item.id}
                        className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
                        onClick={() => onTabChange(item.id)}
                    >
                        <span className="sidebar-icon">{item.icon}</span>
                        <span className="sidebar-label">{item.label}</span>
                        {item.badge && item.badge > 0 && (
                            <span className="sidebar-badge">{item.badge}</span>
                        )}
                    </div>
                ))}
            </div>
            <div className="parsing-controls" style={{ marginTop: '20px', padding: '10px', borderTop: '1px solid #333' }}>
                <div style={{ marginBottom: '10px' }}>
                    <button 
                        onClick={onToggleTargetsParsing}
                        className={`btn ${isTargetsParsingEnabled ? 'btn-danger' : 'btn-success'}`}
                        style={{ 
                            width: '100%',
                            backgroundColor: isTargetsParsingEnabled ? '#dc3545' : '#28a745',
                            color: '#ffffff',
                            padding: '8px',
                            fontSize: '12px'
                        }}
                    >
                        {isTargetsParsingEnabled ? '⏸ Зупинити парсинг таргетів' : '▶ Запустити парсинг таргетів'}
                    </button>
                </div>
                <div>
                    <button 
                        onClick={onToggleOffersParsing}
                        className={`btn ${isOffersParsingEnabled ? 'btn-danger' : 'btn-success'}`}
                        style={{ 
                            width: '100%',
                            backgroundColor: isOffersParsingEnabled ? '#dc3545' : '#28a745',
                            color: '#ffffff',
                            padding: '8px',
                            fontSize: '12px'
                        }}
                    >
                        {isOffersParsingEnabled ? '⏸ Зупинити парсинг оферів' : '▶ Запустити парсинг оферів'}
                    </button>
                </div>
            </div>
            <BalanceDisplay />
        </div>
    );
}

export default Sidebar;

