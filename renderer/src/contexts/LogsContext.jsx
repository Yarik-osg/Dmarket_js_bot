import React, { createContext, useContext, useState, useCallback } from 'react';

const LogsContext = createContext();

export function LogsProvider({ children }) {
    const [logs, setLogs] = useState([]);
    const MAX_LOGS = 1000;

    const addLog = useCallback((log) => {
        const timestamp = new Date().toLocaleString('uk-UA', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const newLog = {
            id: Date.now() + Math.random(),
            timestamp,
            type: log.type || 'info',
            category: log.category || 'general',
            message: log.message || '',
            details: log.details || null,
            ...log
        };

        setLogs(prev => {
            const updated = [newLog, ...prev];
            if (updated.length > MAX_LOGS) {
                return updated.slice(0, MAX_LOGS);
            }
            return updated;
        });

        // Persist to file via main process
        if (window.electronAPI?.logger) {
            window.electronAPI.logger.write({
                type: newLog.type,
                category: newLog.category,
                message: newLog.message,
                details: newLog.details
            }).catch(() => {});
        }

        if (log.type === 'error' && window.notificationContext) {
            try {
                window.notificationContext.showNotification({
                    type: 'apiErrors',
                    title: 'Помилка API',
                    message: log.message,
                    level: 'error'
                });
            } catch (e) {
                // Notification context not available
            }
        }
    }, []);

    const clearLogs = useCallback(() => {
        setLogs([]);
    }, []);

    return (
        <LogsContext.Provider value={{ logs, addLog, clearLogs }}>
            {children}
        </LogsContext.Provider>
    );
}

export function useLogs() {
    const context = useContext(LogsContext);
    if (!context) {
        throw new Error('useLogs must be used within a LogsProvider');
    }
    return context;
}

