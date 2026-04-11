import React, { useEffect } from 'react';
import {
    MantineProvider,
    createTheme,
    localStorageColorSchemeManager,
    ColorSchemeScript
} from '@mantine/core';
import { ErrorBoundary } from 'react-error-boundary';

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
import ThemeDocumentAndStoreSync from './components/ThemeDocumentAndStoreSync.jsx';
import { UI_COLOR_SCHEME_LS_KEY } from './constants/uiStorageKeys.js';

const colorSchemeManager = localStorageColorSchemeManager({ key: UI_COLOR_SCHEME_LS_KEY });

function ErrorFallback({ error, resetErrorBoundary }) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            background: '#0f172a',
            color: '#f1f5f9',
            padding: '40px',
            textAlign: 'center'
        }}>
            <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                padding: '32px',
                maxWidth: '600px',
                width: '100%'
            }}>
                <h2 style={{ color: '#ef4444', marginBottom: '16px', fontSize: '24px' }}>
                    Щось пішло не так
                </h2>
                <p style={{ color: '#94a3b8', marginBottom: '16px', fontSize: '14px' }}>
                    Виникла неочікувана помилка. Спробуйте перезавантажити додаток.
                </p>
                <details style={{
                    textAlign: 'left',
                    marginBottom: '20px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '8px',
                    padding: '12px'
                }}>
                    <summary style={{ cursor: 'pointer', color: '#94a3b8', fontSize: '13px' }}>
                        Деталі помилки
                    </summary>
                    <pre style={{
                        color: '#ef4444',
                        fontSize: '12px',
                        marginTop: '8px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        userSelect: 'text'
                    }}>
                        {error.message}
                        {error.stack && `\n\n${error.stack}`}
                    </pre>
                </details>
                <button
                    onClick={resetErrorBoundary}
                    style={{
                        background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '12px 32px',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer'
                    }}
                >
                    Спробувати знову
                </button>
            </div>
        </div>
    );
}

function TabErrorFallback({ error, resetErrorBoundary }) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 40px',
            textAlign: 'center'
        }}>
            <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                padding: '24px',
                maxWidth: '500px',
                width: '100%'
            }}>
                <h3 style={{ color: '#ef4444', marginBottom: '12px', fontSize: '18px' }}>
                    Помилка у цій вкладці
                </h3>
                <p style={{ color: '#94a3b8', marginBottom: '16px', fontSize: '13px' }}>
                    {error.message}
                </p>
                <button
                    onClick={resetErrorBoundary}
                    style={{
                        background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '10px 24px',
                        color: 'white',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer'
                    }}
                >
                    Перезавантажити вкладку
                </button>
            </div>
        </div>
    );
}

export { TabErrorFallback };

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
    return (
        <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
            <ColorSchemeScript defaultColorScheme="dark" storageKey={UI_COLOR_SCHEME_LS_KEY} />
            <MantineProvider
                theme={mantineTheme}
                defaultColorScheme="dark"
                colorSchemeManager={colorSchemeManager}
            >
                <ThemeDocumentAndStoreSync />
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
        </ErrorBoundary>
    );
}

export default App;

