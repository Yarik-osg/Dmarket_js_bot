import React from 'react';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import { useNotifications } from '../../contexts/NotificationContext.jsx';
import BalanceDisplay from '../BalanceDisplay.jsx';
import { 
    RiShoppingCart2Line, 
    RiPriceTag3Line, 
    RiLineChartLine, 
    RiBellLine, 
    RiSettings3Line, 
    RiFileListLine,
    RiPlayCircleLine,
    RiPauseCircleLine
} from 'react-icons/ri';
import '../../styles/Sidebar.css';

function Sidebar({ activeTab, onTabChange, isTargetsParsingEnabled, isOffersParsingEnabled, onToggleTargetsParsing, onToggleOffersParsing }) {
    const { t } = useLocale();
    const { unreadCount } = useNotifications();

    const menuItems = [
        { id: 'orders', label: t('nav.orders'), icon: RiShoppingCart2Line },
        { id: 'offers', label: t('nav.offers'), icon: RiPriceTag3Line },
        { id: 'analytics', label: t('nav.analytics'), icon: RiLineChartLine },
        { id: 'notifications', label: t('nav.notifications'), icon: RiBellLine, badge: unreadCount > 0 ? unreadCount : null },
        { id: 'settings', label: t('nav.settings'), icon: RiSettings3Line },
        { id: 'logs', label: t('nav.logs'), icon: RiFileListLine }
    ];

    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <h2 className="sidebar-title">DMarket Bot</h2>
            </div>
            <div className="sidebar-menu">
                {menuItems.map(item => {
                    const IconComponent = item.icon;
                    return (
                        <div
                            key={item.id}
                            className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
                            onClick={() => onTabChange(item.id)}
                        >
                            <IconComponent className="sidebar-icon" />
                            <span className="sidebar-label">{item.label}</span>
                            {item.badge && item.badge > 0 && (
                                <span className="sidebar-badge">{item.badge}</span>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="parsing-controls">
                <button 
                    onClick={onToggleTargetsParsing}
                    className={`parsing-btn ${isTargetsParsingEnabled ? 'parsing-btn-active' : ''}`}
                >
                    {isTargetsParsingEnabled ? (
                        <><RiPauseCircleLine className="btn-icon-svg" /> Зупинити таргети</>
                    ) : (
                        <><RiPlayCircleLine className="btn-icon-svg" /> Запустити таргети</>
                    )}
                </button>
                <button 
                    onClick={onToggleOffersParsing}
                    className={`parsing-btn ${isOffersParsingEnabled ? 'parsing-btn-active' : ''}`}
                >
                    {isOffersParsingEnabled ? (
                        <><RiPauseCircleLine className="btn-icon-svg" /> Зупинити офери</>
                    ) : (
                        <><RiPlayCircleLine className="btn-icon-svg" /> Запустити офери</>
                    )}
                </button>
            </div>
            <BalanceDisplay />
        </div>
    );
}

export default Sidebar;

