import React, { useState, useMemo } from 'react';
import { useLogs } from '../contexts/LogsContext.jsx';
import { 
    RiCheckboxCircleLine, 
    RiCloseCircleLine, 
    RiAlertLine, 
    RiInformationLine,
    RiFileTextLine 
} from 'react-icons/ri';
import '../styles/LogsList.css';

function LogsList() {
    const { logs, clearLogs } = useLogs();
    const [filter, setFilter] = useState({ type: 'all', category: 'all' });
    const [searchQuery, setSearchQuery] = useState('');

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            // Фільтр по типу
            if (filter.type !== 'all' && log.type !== filter.type) {
                return false;
            }
            // Фільтр по категорії
            if (filter.category !== 'all' && log.category !== filter.category) {
                return false;
            }
            // Пошук по тексту
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const messageMatch = log.message?.toLowerCase().includes(query);
                const detailsMatch = JSON.stringify(log.details || {}).toLowerCase().includes(query);
                if (!messageMatch && !detailsMatch) {
                    return false;
                }
            }
            return true;
        });
    }, [logs, filter, searchQuery]);

    const getTypeIcon = (type) => {
        switch (type) {
            case 'success': return <RiCheckboxCircleLine />;
            case 'error': return <RiCloseCircleLine />;
            case 'warning': return <RiAlertLine />;
            case 'info': return <RiInformationLine />;
            default: return <RiFileTextLine />;
        }
    };

    const getCategoryLabel = (category) => {
        const labels = {
            'target': 'Таргет',
            'offer': 'Офер',
            'parsing': 'Парсинг',
            'system': 'Система',
            'general': 'Загальне'
        };
        return labels[category] || category;
    };

    const getTypeLabel = (type) => {
        const labels = {
            'success': 'Успіх',
            'error': 'Помилка',
            'warning': 'Попередження',
            'info': 'Інформація'
        };
        return labels[type] || type;
    };

    return (
        <div className="logs-list">
            <div className="logs-header">
                <h1 className="logs-title">Логи системи</h1>
                <div className="logs-actions">
                    <input
                        type="text"
                        placeholder="Пошук..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="logs-search"
                    />
                    <select
                        value={filter.type}
                        onChange={(e) => setFilter(prev => ({ ...prev, type: e.target.value }))}
                        className="logs-filter"
                    >
                        <option value="all">Всі типи</option>
                        <option value="info">Інформація</option>
                        <option value="success">Успіх</option>
                        <option value="warning">Попередження</option>
                        <option value="error">Помилка</option>
                    </select>
                    <select
                        value={filter.category}
                        onChange={(e) => setFilter(prev => ({ ...prev, category: e.target.value }))}
                        className="logs-filter"
                    >
                        <option value="all">Всі категорії</option>
                        <option value="target">Таргети</option>
                        <option value="offer">Офери</option>
                        <option value="parsing">Парсинг</option>
                        <option value="system">Система</option>
                    </select>
                    <button onClick={clearLogs} className="btn btn-secondary">
                        Очистити логи
                    </button>
                </div>
            </div>

            <div className="logs-stats">
                <span>Всього логів: {logs.length}</span>
                <span>Відфільтровано: {filteredLogs.length}</span>
            </div>

            <div className="logs-container">
                {filteredLogs.length === 0 ? (
                    <div className="logs-empty">
                        {logs.length === 0 ? 'Логів поки немає' : 'Нічого не знайдено за фільтрами'}
                    </div>
                ) : (
                    <div className="logs-table-container">
                        <table className="logs-table">
                            <thead>
                                <tr>
                                    <th>Час</th>
                                    <th>Тип</th>
                                    <th>Категорія</th>
                                    <th>Повідомлення</th>
                                    <th>Деталі</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLogs.map((log) => (
                                    <tr key={log.id} className={`log-row log-${log.type}`}>
                                        <td className="log-timestamp">{log.timestamp}</td>
                                        <td className="log-type">
                                            <span className="log-type-icon">{getTypeIcon(log.type)}</span>
                                            <span className="log-type-label">{getTypeLabel(log.type)}</span>
                                        </td>
                                        <td className="log-category">{getCategoryLabel(log.category)}</td>
                                        <td className="log-message">{log.message}</td>
                                        <td className="log-details">
                                            {log.details && (
                                                <details>
                                                    <summary>Деталі</summary>
                                                    <pre>{JSON.stringify(log.details, null, 2)}</pre>
                                                </details>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default LogsList;

