import React, { useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { LocaleProvider } from './contexts/LocaleContext.jsx';
import { LogsProvider } from './contexts/LogsContext.jsx';
import { NotificationProvider, useNotifications } from './contexts/NotificationContext.jsx';
import { AnalyticsProvider } from './contexts/AnalyticsContext.jsx';
import MainLayout from './components/Layout/MainLayout.jsx';

// Component to expose notification context globally for LogsContext
function NotificationContextExposer() {
    const notificationContext = useNotifications();
    
    useEffect(() => {
        window.notificationContext = notificationContext;
        return () => {
            delete window.notificationContext;
        };
    }, [notificationContext]);
    
    return null;
}

function App() {
    // Встановлюємо темну тему за замовчуванням
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', 'dark');
    }, []);

    return (
        <LocaleProvider>
            <AuthProvider>
                <NotificationProvider>
                    <NotificationContextExposer />
                    <AnalyticsProvider>
                        <LogsProvider>
                            <MainLayout />
                        </LogsProvider>
                    </AnalyticsProvider>
                </NotificationProvider>
            </AuthProvider>
        </LocaleProvider>
    );
}

export default App;

