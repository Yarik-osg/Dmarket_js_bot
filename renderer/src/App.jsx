import React, { useEffect } from 'react';
import { MantineProvider, createTheme } from '@mantine/core';

/** Палітра slate як у main.css (--bg-primary …), без «чистого» чорного Mantine */
const mantineTheme = createTheme({
    primaryColor: 'blue',
    defaultRadius: 'md',
    colors: {
        dark: [
            '#f1f5f9',
            '#e2e8f0',
            '#cbd5e1',
            '#94a3b8',
            '#64748b',
            '#475569',
            '#334155',
            '#1e293b',
            '#172033',
            '#0f172a'
        ]
    }
});
import '@mantine/core/styles.css';
import 'mantine-datatable/styles.css';
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
        <MantineProvider defaultColorScheme="dark" theme={mantineTheme}>
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
        </MantineProvider>
    );
}

export default App;

