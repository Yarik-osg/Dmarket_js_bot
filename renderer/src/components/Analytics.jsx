import React, { useState, useMemo } from 'react';
import { useAnalytics } from '../contexts/AnalyticsContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { ApiService } from '../services/apiService.js';
import '../styles/Analytics.css';

function Analytics() {
    const { t } = useLocale();
    const { getStatistics, loadTransactionsFromAPI, transactions } = useAnalytics();
    const { client } = useAuth();
    const [period, setPeriod] = useState('30d');
    const [isLoading, setIsLoading] = useState(false);
    
    const apiService = useMemo(() => {
        return client ? new ApiService(client) : null;
    }, [client]);
    
    const handleLoadTransactions = async () => {
        if (!apiService || !loadTransactionsFromAPI) {
            return;
        }
        setIsLoading(true);
        try {
            await loadTransactionsFromAPI(apiService, 300);
        } catch (error) {
            console.error('Error loading transactions:', error);
        } finally {
            setIsLoading(false);
        }
    };
    
    const stats = useMemo(() => getStatistics(period), [getStatistics, period]);

    return (
        <div className="analytics-container">
                <div className="analytics-header">
                    <h1 className="analytics-title">{t('analytics.title')}</h1>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <select 
                            value={period} 
                            onChange={(e) => setPeriod(e.target.value)}
                            className="analytics-period-select"
                        >
                            <option value="7d">7 {t('analytics.days')}</option>
                            <option value="30d">30 {t('analytics.days')}</option>
                            <option value="60d">60 {t('analytics.days')}</option>
                        </select>
                        <button 
                            onClick={handleLoadTransactions}
                            disabled={isLoading || !apiService}
                            className="btn btn-primary"
                            style={{ padding: '8px 16px', fontSize: '14px' }}
                        >
                            {isLoading ? 'Завантаження...' : 'Завантажити транзакції'}
                        </button>
                    </div>
                </div>

            <div className="analytics-stats-grid">
                <div className="stat-card profit">
                    <h3>{t('analytics.totalProfit')}</h3>
                    <div className={`stat-value ${stats.profit >= 0 ? 'positive' : 'negative'}`}>
                        ${stats.profit.toFixed(2)}
                    </div>
                    <div className="stat-label">
                        {t('analytics.profitMargin')}: {stats.profitMargin.toFixed(1)}%
                    </div>
                </div>
                
                <div className="stat-card sales">
                    <h3>{t('analytics.totalSales')}</h3>
                    <div className="stat-value">${stats.totalSales.toFixed(2)}</div>
                    <div className="stat-label">{stats.salesCount} {t('analytics.transactions')}</div>
                </div>
                
                <div className="stat-card purchases">
                    <h3>{t('analytics.totalPurchases')}</h3>
                    <div className="stat-value">${stats.totalPurchases.toFixed(2)}</div>
                    <div className="stat-label">{stats.purchasesCount} {t('analytics.transactions')}</div>
                </div>
            </div>

            <div className="analytics-section">
                <h2 className="analytics-section-title">{t('analytics.topItems')}</h2>
                {stats.topItems.length > 0 ? (
                    <table className="analytics-table">
                        <thead>
                            <tr>
                                <th>{t('analytics.item')}</th>
                                <th>{t('analytics.revenue')}</th>
                                <th>{t('analytics.count')}</th>
                                <th>{t('analytics.avgPrice')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.topItems.map((item, idx) => (
                                <tr key={idx}>
                                    <td className="item-title">{item.title}</td>
                                    <td className={`revenue ${item.profit >= 0 ? 'positive' : 'negative'}`}>
                                        ${item.profit.toFixed(2)}
                                    </td>
                                    <td>{item.count}</td>
                                    <td>${item.avgPrice.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="analytics-empty">Немає даних для відображення</div>
                )}
            </div>

            <div className="analytics-section">
                <h2 className="analytics-section-title">{t('analytics.salesChart')}</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
                    Графік показує продажі та покупки по днях. Зелені стовпці - продажі (дохід), червоні стовпці - покупки (витрати).
                    Наведіть курсор на стовпці, щоб побачити деталі.
                </p>
                {stats.dailyData.length > 0 ? (
                    <div className="chart-container">
                        <SimpleChart data={stats.dailyData} />
                    </div>
                ) : (
                    <div className="analytics-empty">Немає даних для графіка</div>
                )}
            </div>

            {/* Список останніх транзакцій */}
            <div className="analytics-section">
                <h2 className="analytics-section-title">Останні транзакції</h2>
                {transactions && transactions.length > 0 ? (
                    <div className="transactions-list">
                        {transactions.slice(0, 15).map((transaction) => {
                            const date = new Date(transaction.timestamp || transaction.createdAt);
                            const formattedDate = date.toLocaleDateString('uk-UA', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                            const isSale = transaction.type === 'sale';
                            
                            return (
                                <div key={transaction.id} className="transaction-item">
                                    <div className="transaction-type">
                                        <span className={`transaction-badge ${isSale ? 'sale' : 'purchase'}`}>
                                            {isSale ? 'Продаж' : 'Покупка'}
                                        </span>
                                    </div>
                                    <div className="transaction-details">
                                        <div className="transaction-item-title">{transaction.itemTitle || 'Unknown Item'}</div>
                                        <div className="transaction-meta">
                                            <span className="transaction-date">{formattedDate}</span>
                                        </div>
                                    </div>
                                    <div className={`transaction-amount ${isSale ? 'positive' : 'negative'}`}>
                                        {isSale ? '+' : '-'}${parseFloat(transaction.amount || 0).toFixed(2)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="analytics-empty">Немає транзакцій для відображення</div>
                )}
            </div>
        </div>
    );
}

function SimpleChart({ data }) {
    const [tooltip, setTooltip] = useState(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    
    if (data.length === 0) return null;

    const maxValue = Math.max(...data.map(d => Math.max(d.sales, d.purchases)), 1);
    const width = 100;
    const height = 300;
    const barWidth = Math.max(2, (width / data.length) - 1);
    
    // Форматуємо дату для відображення
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
    };
    
    const formatDateFull = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    
    // Функція для правильного відмінювання слова "транзакція" в українській мові
    const getTransactionWord = (count) => {
        const lastDigit = count % 10;
        const lastTwoDigits = count % 100;
        
        // 1, 21, 31, 41... (крім 11) - транзакція
        if (lastDigit === 1 && lastTwoDigits !== 11) {
            return 'транзакція';
        }
        // 2, 3, 4, 22, 23, 24... (крім 12, 13, 14) - транзакції
        if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
            return 'транзакції';
        }
        // 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15... - транзакцій
        return 'транзакцій';
    };
    
    const handleBarHover = (e, d) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const chartRect = e.currentTarget.closest('.chart-wrapper').getBoundingClientRect();
        const date = formatDateFull(d.date);
        
        // Підраховуємо кількість транзакцій для продажів та покупок окремо
        const salesCount = d.salesCount || 0;
        const purchasesCount = d.purchasesCount || 0;
        const totalCount = salesCount + purchasesCount;
        
        // Формуємо текст тултіпа з обома даними
        let tooltipText = `Дата: ${date}\n`;
        if (d.sales > 0) {
            tooltipText += `Продажі: $${d.sales.toFixed(2)}`;
            if (salesCount > 0) {
                tooltipText += ` (${salesCount} ${getTransactionWord(salesCount)})`;
            }
            tooltipText += '\n';
        }
        if (d.purchases > 0) {
            tooltipText += `Покупки: $${d.purchases.toFixed(2)}`;
            if (purchasesCount > 0) {
                tooltipText += ` (${purchasesCount} ${getTransactionWord(purchasesCount)})`;
            }
            tooltipText += '\n';
        }
        if (totalCount > 0) {
            tooltipText += `Всього: ${totalCount} ${getTransactionWord(totalCount)}`;
        }
        
        setTooltip(tooltipText);
        setTooltipPosition({
            x: rect.left - chartRect.left + rect.width / 2,
            y: rect.top - chartRect.top - 10
        });
    };
    
    const handleBarLeave = () => {
        setTooltip(null);
    };
    
    return (
        <div className="chart-wrapper">
            {tooltip && (
                <div 
                    className="chart-tooltip"
                    style={{
                        left: `${tooltipPosition.x}px`,
                        top: `${tooltipPosition.y}px`,
                        transform: 'translateX(-50%)'
                    }}
                >
                    {tooltip.split('\n').map((line, i) => (
                        <div key={i}>{line}</div>
                    ))}
                </div>
            )}
            <div style={{ position: 'relative', width: '100%', height: '300px' }}>
                <svg viewBox={`0 0 ${width} ${height}`} className="simple-chart" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                    {data.map((d, i) => {
                        const x = (i / data.length) * width;
                        const salesHeight = (d.sales / maxValue) * height;
                        const purchasesHeight = (d.purchases / maxValue) * height;
                        
                        return (
                            <g 
                                key={i}
                                onMouseEnter={(e) => handleBarHover(e, d)}
                                onMouseLeave={handleBarLeave}
                                style={{ cursor: 'pointer' }}
                            >
                                {d.sales > 0 && (
                                    <rect
                                        x={x}
                                        y={height - salesHeight}
                                        width={barWidth}
                                        height={salesHeight}
                                        fill="var(--success-color)"
                                        opacity={0.7}
                                        className="chart-bar chart-bar-sales"
                                    />
                                )}
                                {d.purchases > 0 && (
                                    <rect
                                        x={x}
                                        y={height - purchasesHeight}
                                        width={barWidth}
                                        height={purchasesHeight}
                                        fill="var(--error-color)"
                                        opacity={0.7}
                                        className="chart-bar chart-bar-purchases"
                                    />
                                )}
                            </g>
                        );
                    })}
                </svg>
                {/* Дати винесені за межі SVG для кращого відображення */}
                <div style={{ 
                    position: 'relative',
                    marginTop: '8px',
                    height: '18px',
                    width: '100%'
                }}>
                    {data.map((d, i) => {
                        const date = formatDate(d.date);
                        // Показуємо максимум 12 дат, якщо їх більше - показуємо кожну N-ту
                        const maxDates = 12;
                        const step = data.length > maxDates ? Math.ceil(data.length / maxDates) : 1;
                        const showDate = i % step === 0 || i === data.length - 1;
                        
                        // Розраховуємо позицію відсотком від ширини контейнера
                        const positionPercent = data.length > 1 ? (i / (data.length - 1)) * 100 : 50;
                        
                        return (
                            <span 
                                key={i} 
                                style={{ 
                                    position: 'absolute',
                                    left: `${positionPercent}%`,
                                    transform: 'translateX(-50%)',
                                    fontSize: showDate ? '8px' : '0',
                                    color: 'var(--text-secondary)',
                                    whiteSpace: 'nowrap',
                                    opacity: showDate ? 1 : 0,
                                    pointerEvents: 'none',
                                    lineHeight: '1.2'
                                }}
                                title={date}
                            >
                                {showDate ? date : ''}
                            </span>
                        );
                    })}
                </div>
            </div>
            <div className="chart-legend">
                <div className="legend-item">
                    <span className="legend-color sales"></span>
                    <span>Продажі</span>
                </div>
                <div className="legend-item">
                    <span className="legend-color purchases"></span>
                    <span>Покупки</span>
                </div>
            </div>
        </div>
    );
}

export default Analytics;

