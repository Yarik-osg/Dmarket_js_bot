import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useAnalytics } from '../../contexts/AnalyticsContext.jsx';
import { useNotifications } from '../../contexts/NotificationContext.jsx';
import { ApiService } from '../../services/apiService.js';
import { TransactionMonitor } from '../../services/transactionMonitor.js';
import Sidebar from './Sidebar.jsx';
import TargetsList from '../TargetsList.jsx';
import OffersList from '../OffersList.jsx';
import LogsList from '../LogsList.jsx';
import Settings from '../Settings.jsx';
import Analytics from '../Analytics.jsx';
import Notifications from '../Notifications.jsx';
import AuthScreen from '../AuthScreen.jsx';
import '../../styles/MainLayout.css';

function MainLayout() {
    const { isAuthenticated, client } = useAuth();
    const { addTransaction, loadTransactionsFromAPI } = useAnalytics();
    const { showNotification } = useNotifications();
    const [activeTab, setActiveTab] = useState('orders');
    const [isTargetsParsingEnabled, setIsTargetsParsingEnabled] = useState(false);
    const [isOffersParsingEnabled, setIsOffersParsingEnabled] = useState(false);
    const transactionMonitorRef = useRef(null);
    const hasLoadedInitialTransactions = useRef(false);

    const apiService = useMemo(() => {
        return client ? new ApiService(client) : null;
    }, [client]);

    // Завантажуємо існуючі транзакції при першому запуску
    useEffect(() => {
        if (apiService && isAuthenticated && loadTransactionsFromAPI && !hasLoadedInitialTransactions.current) {
            const saved = localStorage.getItem('analytics_transactions');
            const hasExistingTransactions = saved && JSON.parse(saved).length > 0;
            
            // Завантажуємо тільки якщо немає збережених транзакцій або їх мало
            if (!hasExistingTransactions || JSON.parse(saved).length < 10) {
                console.log('Loading initial transactions from API...');
                loadTransactionsFromAPI(apiService, 100).then(() => {
                    hasLoadedInitialTransactions.current = true;
                });
            } else {
                hasLoadedInitialTransactions.current = true;
            }
        }
    }, [apiService, isAuthenticated, loadTransactionsFromAPI]);

    // Initialize transaction monitor
    useEffect(() => {
        if (apiService && isAuthenticated && addTransaction && showNotification) {
            console.log('Initializing TransactionMonitor');
            const monitor = new TransactionMonitor(apiService, { addTransaction }, { showNotification });
            transactionMonitorRef.current = monitor;
            
            // Start monitoring transactions every 10 minutes
            monitor.startMonitoring(600000);
            console.log('TransactionMonitor started');

            // Expose test methods to window for testing
            window.testTransaction = (type = 'sell', itemTitle = 'Test Item', amount = 0.50) => {
                console.log('Testing transaction via window.testTransaction');
                monitor.testTransaction(type, itemTitle, amount);
            };
            
            window.testTargetClosed = (itemTitle = 'Test Target Item', amount = 10.00) => {
                console.log('Testing target closed via window.testTargetClosed');
                monitor.testTargetClosed(itemTitle, amount);
            };

            return () => {
                console.log('Stopping TransactionMonitor');
                monitor.stopMonitoring();
                delete window.testTransaction;
                delete window.testTargetClosed;
            };
        } else {
            console.log('TransactionMonitor not initialized:', { apiService: !!apiService, isAuthenticated, addTransaction: !!addTransaction, showNotification: !!showNotification });
        }
    }, [apiService, isAuthenticated, addTransaction, showNotification]);

    if (!isAuthenticated) {
        return <AuthScreen />;
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'analytics':
                return <Analytics />;
            case 'notifications':
                return <Notifications />;
            case 'settings':
                return <Settings />;
            case 'logs':
                return <LogsList />;
            default:
                return null;
        }
    };

    return (
        <div className="main-layout">
            <Sidebar 
                activeTab={activeTab} 
                onTabChange={setActiveTab}
                isTargetsParsingEnabled={isTargetsParsingEnabled}
                isOffersParsingEnabled={isOffersParsingEnabled}
                onToggleTargetsParsing={() => setIsTargetsParsingEnabled(prev => !prev)}
                onToggleOffersParsing={() => setIsOffersParsingEnabled(prev => !prev)}
            />
            <div className="main-content">
                {/* Always render components but hide them with CSS to keep intervals running */}
                <div style={{ display: activeTab === 'orders' ? 'block' : 'none' }}>
                    <TargetsList 
                        isAutoUpdatingEnabled={isTargetsParsingEnabled}
                        onToggleAutoUpdate={() => setIsTargetsParsingEnabled(prev => !prev)}
                    />
                </div>
                <div style={{ display: activeTab === 'offers' ? 'block' : 'none' }}>
                    <OffersList 
                        isAutoUpdatingEnabled={isOffersParsingEnabled}
                        onToggleAutoUpdate={() => setIsOffersParsingEnabled(prev => !prev)}
                    />
                </div>
                {activeTab !== 'orders' && activeTab !== 'offers' && renderContent()}
            </div>
        </div>
    );
}

export default MainLayout;

