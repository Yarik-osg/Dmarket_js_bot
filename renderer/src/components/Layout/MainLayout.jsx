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
import {
    GITHUB_RELEASES_INDEX,
    GITHUB_RELEASES_LATEST,
    githubReleaseTagUrl
} from '../../constants/githubRelease.js';

function MainLayout() {
    const { isAuthenticated, client } = useAuth();
    const { addTransaction, loadTransactionsFromAPI } = useAnalytics();
    const { showNotification } = useNotifications();
    const [activeTab, setActiveTab] = useState('orders');
    const [isTargetsParsingEnabled, setIsTargetsParsingEnabled] = useState(false);
    const [isOffersParsingEnabled, setIsOffersParsingEnabled] = useState(false);
    const transactionMonitorRef = useRef(null);
    const hasLoadedInitialTransactions = useRef(false);
    const expectingManualUpdaterResultRef = useRef(false);
    const isMacUpdaterRef = useRef(false);

    const [appVersion, setAppVersion] = useState('');
    const [updaterPhase, setUpdaterPhase] = useState('idle');
    const [remoteVersion, setRemoteVersion] = useState(null);
    const [updaterError, setUpdaterError] = useState('');
    const [upToDateHint, setUpToDateHint] = useState('');
    const [downloadPercent, setDownloadPercent] = useState(0);

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

    useEffect(() => {
        isMacUpdaterRef.current = window.electronAPI?.platform === 'darwin';
    }, []);

    useEffect(() => {
        if (!window.electronAPI?.updater) return undefined;
        window.electronAPI.updater.getVersion().then(setAppVersion);
        const unsubscribe = window.electronAPI.updater.onEvent((ev) => {
            setUpdaterError('');
            switch (ev.type) {
                case 'checking':
                    setUpdaterPhase('checking');
                    break;
                case 'available':
                    setUpdaterPhase('available');
                    setRemoteVersion(ev.version);
                    setDownloadPercent(0);
                    showNotification({
                        type: 'info',
                        title: 'Доступне оновлення',
                        message: isMacUpdaterRef.current
                            ? `Версія ${ev.version}. На macOS автооновлення недоступне — відкрийте Налаштування та завантажте .dmg з GitHub.`
                            : `Версія ${ev.version}. У налаштуваннях натисніть «Завантажити оновлення».`
                    });
                    break;
                case 'not-available':
                    setUpdaterPhase('idle');
                    setRemoteVersion(null);
                    if (expectingManualUpdaterResultRef.current) {
                        setUpToDateHint('У вас встановлена остання версія.');
                        expectingManualUpdaterResultRef.current = false;
                    }
                    break;
                case 'error':
                    setUpdaterPhase('idle');
                    expectingManualUpdaterResultRef.current = false;
                    setUpdaterError(ev.message || 'Помилка оновлення');
                    break;
                case 'progress':
                    setUpdaterPhase('downloading');
                    setDownloadPercent(Math.round(ev.percent ?? 0));
                    break;
                case 'downloaded':
                    setUpdaterPhase('ready');
                    setDownloadPercent(100);
                    break;
                default:
                    break;
            }
        });
        return unsubscribe;
    }, [showNotification]);

    const handleUpdaterCheck = async () => {
        if (!window.electronAPI?.updater) return;
        setUpdaterError('');
        setUpToDateHint('');
        expectingManualUpdaterResultRef.current = true;
        const result = await window.electronAPI.updater.check();
        if (!result.ok) {
            expectingManualUpdaterResultRef.current = false;
            if (result.reason === 'dev') {
                setUpdaterError('Перевірка оновлень працює лише у встановленій збірці, не в режимі розробки (npm start).');
            } else if (result.error) {
                setUpdaterError(result.error);
            }
        }
    };

    const handleUpdaterDownload = async () => {
        if (!window.electronAPI?.updater) return;
        setUpdaterError('');
        const result = await window.electronAPI.updater.download();
        if (!result.ok && result.error) {
            setUpdaterError(result.error);
            setUpdaterPhase('available');
        }
    };

    const handleUpdaterQuitAndInstall = () => {
        window.electronAPI?.updater?.quitAndInstall();
    };

    const handleOpenMacRelease = async () => {
        const url = remoteVersion ? githubReleaseTagUrl(remoteVersion) : GITHUB_RELEASES_LATEST;
        const res = await window.electronAPI?.openExternal?.(url);
        if (res && !res.ok) {
            setUpdaterError('Не вдалося відкрити браузер. Спробуйте посилання вручну.');
        }
    };

    const handleOpenMacReleasesIndex = async () => {
        const res = await window.electronAPI?.openExternal?.(GITHUB_RELEASES_INDEX);
        if (res && !res.ok) {
            setUpdaterError('Не вдалося відкрити браузер. Спробуйте посилання вручну.');
        }
    };

    const updaterPanel =
        window.electronAPI?.updater
            ? {
                  appVersion,
                  phase: updaterPhase,
                  remoteVersion,
                  error: updaterError,
                  upToDateHint,
                  downloadPercent,
                  manualMacUpdate: window.electronAPI?.platform === 'darwin',
                  onOpenMacRelease: handleOpenMacRelease,
                  onOpenMacReleasesIndex: handleOpenMacReleasesIndex,
                  onCheck: handleUpdaterCheck,
                  onDownload: handleUpdaterDownload,
                  onInstall: handleUpdaterQuitAndInstall
              }
            : null;

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
                return <Settings updater={updaterPanel} />;
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

