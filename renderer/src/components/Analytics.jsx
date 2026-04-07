import React, { useState, useMemo, useCallback } from 'react';
import { useAnalytics } from '../contexts/AnalyticsContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { ApiService } from '../services/apiService.js';
import { RiRefreshLine, RiDownloadLine } from 'react-icons/ri';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import LiquidityAnalyzer from './LiquidityAnalyzer.jsx';
import '../styles/Analytics.css';
import { formatUaTransactionsCount } from '../utils/formatUsd.js';

function Analytics() {
    const { t } = useLocale();
    const { getStatistics, loadTransactionsFromAPI, reloadTransactionsFromAPI, transactions } = useAnalytics();
    const { client } = useAuth();
    const [period, setPeriod] = useState('30d');
    const [isLoading, setIsLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all'); // Фільтр за статусом: 'all', 'success', 'trade_protected'
    const [activeTab, setActiveTab] = useState('statistics'); // 'statistics' або 'liquidity'
    
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
    
    const handleReloadTransactions = async () => {
        if (!apiService || !reloadTransactionsFromAPI) {
            return;
        }
        setIsLoading(true);
        try {
            await reloadTransactionsFromAPI(apiService, 300);
        } catch (error) {
            console.error('Error reloading transactions:', error);
        } finally {
            setIsLoading(false);
        }
    };
    
    const stats = useMemo(() => getStatistics(period), [getStatistics, period]);

    return (
        <div className="analytics-container">
            <div className="analytics-header">
                <h1 className="analytics-title">{t('analytics.title')}</h1>
                
                {/* Вкладки */}
                <div className="analytics-tabs">
                    <button 
                        className={`analytics-tab ${activeTab === 'statistics' ? 'active' : ''}`}
                        onClick={() => setActiveTab('statistics')}
                    >
                        {t('analytics.tabStatistics')}
                    </button>
                    <button 
                        className={`analytics-tab ${activeTab === 'liquidity' ? 'active' : ''}`}
                        onClick={() => setActiveTab('liquidity')}
                    >
                        {t('analytics.tabLiquidity')}
                    </button>
                </div>
            </div>

            <div style={{ display: activeTab === 'liquidity' ? 'block' : 'none' }}>
                <LiquidityAnalyzer />
            </div>

            <div style={{ display: activeTab === 'statistics' ? 'block' : 'none' }}>
                <div className="analytics-header" style={{ marginTop: '0' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'flex-end' }}>
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
                            title="Додати нові транзакції з API"
                        >
                            <RiDownloadLine style={{ fontSize: '18px' }} />
                            {isLoading ? 'Завантаження...' : 'Завантажити'}
                        </button>
                        <button 
                            onClick={handleReloadTransactions}
                            disabled={isLoading || !apiService}
                            className="btn btn-secondary"
                            style={{ 
                                backgroundColor: 'var(--error-color)',
                                color: 'white'
                            }}
                            title="Повністю перезавантажити всі транзакції з API (очистить localStorage)"
                        >
                            <RiRefreshLine style={{ fontSize: '18px' }} />
                            {isLoading ? 'Оновлення...' : 'Перезавантажити'}
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
                
                <div className="stat-card profit" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <h3>Прибуток зі купівлі-продажу</h3>
                    <div className={`stat-value ${(stats.matchedProfit || 0) >= 0 ? 'positive' : 'negative'}`}>
                        ${(stats.matchedProfit || 0).toFixed(2)}
                    </div>
                    <div className="stat-label">
                        Маржа: {(stats.matchedProfitMargin || 0).toFixed(1)}% | {stats.matchedCount || 0} пар
                    </div>
                </div>
                
                <div className="stat-card sales">
                    <h3>{t('analytics.totalSales')}</h3>
                    <div className="stat-value">${stats.totalSales.toFixed(2)}</div>
                    <div className="stat-label">{formatUaTransactionsCount(stats.salesCount)}</div>
                </div>
                
                <div className="stat-card purchases">
                    <h3>{t('analytics.totalPurchases')}</h3>
                    <div className="stat-value">${stats.totalPurchases.toFixed(2)}</div>
                    <div className="stat-label">{formatUaTransactionsCount(stats.purchasesCount)}</div>
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
                    {t('analytics.chartDesc')}
                </p>
                {stats.dailyData.length > 0 ? (
                    <div className="chart-container">
                        <SalesChart data={stats.dailyData} t={t} />
                    </div>
                ) : (
                    <div className="analytics-empty">{t('analytics.chartNoData')}</div>
                )}
            </div>

            {/* Таблиця останніх проданих предметів */}
            <div className="analytics-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 className="analytics-section-title" style={{ marginBottom: 0 }}>Останні продані предмети</h2>
                    <select 
                        value={statusFilter} 
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="analytics-period-select"
                        style={{ width: 'auto', minWidth: '200px' }}
                    >
                        <option value="all">Всі статуси</option>
                        <option value="success">Success</option>
                        <option value="trade_protected">Trade Protected</option>
                    </select>
                </div>
                {(() => {
                    // Фільтруємо тестові транзакції
                    const filtered = transactions.filter(t => {
                        const id = t.id?.toString() || '';
                        return !id.startsWith('test-');
                    });
                    
                    // Отримуємо всі продажі та покупки
                    const sales = filtered.filter(t => t.type === 'sale').sort((a, b) => {
                        const timeA = new Date(a.timestamp || a.createdAt || 0).getTime();
                        const timeB = new Date(b.timestamp || b.createdAt || 0).getTime();
                        return timeB - timeA; // Найновіші спочатку
                    });
                    
                    const purchases = filtered.filter(t => t.type === 'purchase');
                    
                    // Створюємо мапу покупок по assetId для швидкого пошуку
                    const purchasesMap = new Map();
                    purchases.forEach(p => {
                        if (p.assetId) {
                            if (!purchasesMap.has(p.assetId)) {
                                purchasesMap.set(p.assetId, []);
                            }
                            purchasesMap.get(p.assetId).push(p);
                        }
                    });
                    
                    // Сортуємо покупки по даті для кожного assetId
                    purchasesMap.forEach((purchasesList) => {
                        purchasesList.sort((a, b) => {
                            const timeA = new Date(a.timestamp || a.createdAt || 0).getTime();
                            const timeB = new Date(b.timestamp || b.createdAt || 0).getTime();
                            return timeA - timeB; // Найстаріші спочатку (FIFO)
                        });
                    });
                    
                    // Зіставляємо продажі з покупками
                    const soldItems = [];
                    const usedPurchases = new Map(); // Відстежуємо використані покупки
                    
                    sales.forEach(sale => {
                        if (!sale.assetId) return; // Пропускаємо продажі без assetId
                        
                        const purchaseList = purchasesMap.get(sale.assetId);
                        if (!purchaseList || purchaseList.length === 0) return; // Немає покупки
                        
                        // Знаходимо першу невикористану покупку, яка була до продажу
                        let matchedPurchase = null;
                        const saleTime = new Date(sale.timestamp || sale.createdAt || 0).getTime();
                        
                        for (const purchase of purchaseList) {
                            const purchaseTime = new Date(purchase.timestamp || purchase.createdAt || 0).getTime();
                            if (purchaseTime <= saleTime) {
                                const key = `${purchase.assetId}-${purchase.id}`;
                                if (!usedPurchases.has(key)) {
                                    matchedPurchase = purchase;
                                    usedPurchases.set(key, true);
                                    break;
                                }
                            }
                        }
                        
                        if (matchedPurchase) {
                            const floatValue = sale.floatValue || matchedPurchase.floatValue || null;
                            const status = sale.status || 'unknown';
                            // Логуємо для діагностики
                            if (!floatValue) {
                                console.log('Float not found for sold item:', {
                                    itemTitle: sale.itemTitle,
                                    saleFloatValue: sale.floatValue,
                                    purchaseFloatValue: matchedPurchase.floatValue,
                                    sale: sale,
                                    purchase: matchedPurchase
                                });
                            }
                            soldItems.push({
                                assetId: sale.assetId,
                                itemTitle: sale.itemTitle || 'Unknown Item',
                                floatValue: floatValue,
                                status: status,
                                purchasePrice: parseFloat(matchedPurchase.amount || 0),
                                salePrice: parseFloat(sale.amount || 0),
                                purchaseDate: matchedPurchase.timestamp || matchedPurchase.createdAt,
                                saleDate: sale.timestamp || sale.createdAt
                            });
                        }
                    });
                    
                    // Фільтруємо за статусом
                    let filteredSoldItems = soldItems;
                    if (statusFilter !== 'all') {
                        filteredSoldItems = soldItems.filter(item => {
                            const itemStatus = (item.status || '').toLowerCase();
                            return itemStatus === statusFilter.toLowerCase();
                        });
                    }
                    
                    // Беремо останні 15
                    const lastSoldItems = filteredSoldItems.slice(0, 15);
                    
                    const formatDate = (dateString) => {
                        if (!dateString) return 'N/A';
                        const date = new Date(dateString);
                        return date.toLocaleDateString('uk-UA', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                    };
                    
                    const formatFloat = (floatValue) => {
                        if (!floatValue) return 'N/A';
                        if (typeof floatValue === 'number') {
                            return floatValue.toFixed(5);
                        }
                        return floatValue.toString();
                    };
                    
                    return lastSoldItems.length > 0 ? (
                        <div style={{ overflowX: 'auto', marginBottom: '20px' }}>
                            <table className="analytics-table">
                                <thead>
                                    <tr>
                                        <th>Предмет</th>
                                        <th>Float</th>
                                        <th>Статус</th>
                                        <th>Ціна покупки</th>
                                        <th>Ціна продажу</th>
                                        <th>Дохід</th>
                                        <th>Дата покупки</th>
                                        <th>Дата продажу</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lastSoldItems.map((item, idx) => {
                                        const profit = item.salePrice - item.purchasePrice;
                                        return (
                                            <tr key={idx}>
                                                <td className="item-title">{item.itemTitle}</td>
                                                <td>{formatFloat(item.floatValue)}</td>
                                                <td>
                                                    <span style={{
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '11px',
                                                        fontWeight: '500',
                                                        backgroundColor: item.status === 'success' ? 'var(--success-color)' : 
                                                                      item.status === 'trade_protected' ? 'var(--warning-color)' : 
                                                                      'var(--text-secondary)',
                                                        color: 'white',
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        {item.status === 'success' ? 'success' : item.status === 'trade_protected' ? 'trade protected' : 'unknown'}
                                                    </span>
                                                </td>
                                                <td>${item.purchasePrice.toFixed(2)}</td>
                                                <td className="positive">${item.salePrice.toFixed(2)}</td>
                                                <td className={profit >= 0 ? 'positive' : 'negative'}>
                                                    {profit >= 0 ? '+' : '-'}${Math.abs(profit).toFixed(2)}
                                                </td>
                                                <td style={{ fontSize: '12px' }}>{formatDate(item.purchaseDate)}</td>
                                                <td style={{ fontSize: '12px' }}>{formatDate(item.saleDate)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="analytics-empty">Немає проданих предметів для відображення</div>
                    );
                })()}
            </div>

            {/* Список останніх транзакцій */}
            <div className="analytics-section">
                <h2 className="analytics-section-title">Останні транзакції</h2>
                {(() => {
                    // Фільтруємо тестові транзакції та сортуємо за датою (найновіші спочатку)
                    const filteredAndSorted = transactions
                        .filter(t => {
                            // Виключаємо тестові транзакції (ID починається з "test-")
                            const id = t.id?.toString() || '';
                            if (id.startsWith('test-')) {
                                return false;
                            }
                            // Також виключаємо транзакції без timestamp
                            if (!t.timestamp && !t.createdAt) {
                                return false;
                            }
                            return true;
                        })
                        .sort((a, b) => {
                            // Функція для отримання timestamp в мілісекундах
                            const getTimestamp = (tx) => {
                                const ts = tx.timestamp || tx.createdAt;
                                if (!ts) return 0;
                                
                                // Якщо це число (Unix timestamp)
                                if (typeof ts === 'number') {
                                    // Якщо менше 10000000000, то це секунди, інакше мілісекунди
                                    return ts < 10000000000 ? ts * 1000 : ts;
                                }
                                
                                // Якщо це рядок (ISO string або інший формат)
                                const date = new Date(ts);
                                const time = isNaN(date.getTime()) ? 0 : date.getTime();
                                
                                // Якщо не вдалося розпарсити, використовуємо ID як fallback для стабільності
                                if (time === 0 && tx.id) {
                                    // Використовуємо числовий ID як fallback (якщо це число)
                                    const idNum = typeof tx.id === 'number' ? tx.id : parseInt(tx.id.toString().replace(/\D/g, ''), 10);
                                    return isNaN(idNum) ? 0 : idNum;
                                }
                                
                                return time;
                            };
                            
                            const timeA = getTimestamp(a);
                            const timeB = getTimestamp(b);
                            
                            // Якщо timestamp однакові, сортуємо по ID для стабільності
                            if (timeB === timeA) {
                                const idA = a.id?.toString() || '';
                                const idB = b.id?.toString() || '';
                                return idB.localeCompare(idA);
                            }
                            
                            return timeB - timeA; // Спадання (найновіші спочатку)
                        })
                        .slice(0, 15);
                    
                    return filteredAndSorted.length > 0 ? (
                        <div className="transactions-list">
                            {filteredAndSorted.map((transaction) => {
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
                    );
                })()}
            </div>
            </div>
        </div>
    );
}

function getTransactionWord(count) {
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;
    if (lastDigit === 1 && lastTwoDigits !== 11) return 'транзакція';
    if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) return 'транзакції';
    return 'транзакцій';
}

function formatDateShort(dateString) {
    return new Date(dateString).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
}

function formatDateFull(dateString) {
    return new Date(dateString).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function ChartTooltipContent({ active, payload, label, t }) {
    if (!active || !payload || payload.length === 0) return null;
    const row = payload[0]?.payload;
    if (!row) return null;

    const salesCount = row.salesCount || 0;
    const purchasesCount = row.purchasesCount || 0;
    const totalCount = salesCount + purchasesCount;

    return (
        <div className="chart-tooltip-recharts">
            <div className="chart-tooltip-date">{t('analytics.chartTooltipDate')}: {formatDateFull(row.date)}</div>
            {row.sales > 0 && (
                <div className="chart-tooltip-row sales">
                    {t('analytics.chartSales')}: ${row.sales.toFixed(2)}
                    {salesCount > 0 && <span className="chart-tooltip-count"> ({salesCount} {getTransactionWord(salesCount)})</span>}
                </div>
            )}
            {row.purchases > 0 && (
                <div className="chart-tooltip-row purchases">
                    {t('analytics.chartPurchases')}: ${row.purchases.toFixed(2)}
                    {purchasesCount > 0 && <span className="chart-tooltip-count"> ({purchasesCount} {getTransactionWord(purchasesCount)})</span>}
                </div>
            )}
            {totalCount > 0 && (
                <div className="chart-tooltip-row total">
                    {t('analytics.chartTooltipTotal')}: {totalCount} {getTransactionWord(totalCount)}
                </div>
            )}
        </div>
    );
}

function SalesChart({ data, t }) {
    if (data.length === 0) return null;

    const chartData = useMemo(
        () => data.map((d) => ({ ...d, label: formatDateShort(d.date) })),
        [data]
    );

    const renderTooltip = useCallback(
        (props) => <ChartTooltipContent {...props} t={t} />,
        [t]
    );

    return (
        <div className="chart-wrapper" role="img" aria-label={t('analytics.salesChart')}>
            <ResponsiveContainer width="100%" height={340}>
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }} barGap={2} barCategoryGap="20%">
                    <defs>
                        <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                            <stop offset="100%" stopColor="#059669" stopOpacity={0.75} />
                        </linearGradient>
                        <linearGradient id="purchasesGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.95} />
                            <stop offset="100%" stopColor="#dc2626" stopOpacity={0.75} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid
                        strokeDasharray="3 6"
                        stroke="rgba(255,255,255,0.06)"
                        vertical={false}
                    />
                    <XAxis
                        dataKey="label"
                        tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}
                        axisLine={{ stroke: 'var(--border-color)' }}
                        tickLine={false}
                        interval="preserveStartEnd"
                        minTickGap={32}
                    />
                    <YAxis
                        tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `$${v}`}
                        width={60}
                    />
                    <Tooltip
                        content={renderTooltip}
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        wrapperStyle={{ outline: 'none' }}
                    />
                    <Legend
                        verticalAlign="bottom"
                        iconType="square"
                        iconSize={14}
                        wrapperStyle={{ paddingTop: 16, fontSize: 14, fontWeight: 600 }}
                        formatter={(value) =>
                            value === 'sales' ? t('analytics.chartSales') : t('analytics.chartPurchases')
                        }
                    />
                    <Bar
                        dataKey="sales"
                        name="sales"
                        fill="url(#salesGradient)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={48}
                    />
                    <Bar
                        dataKey="purchases"
                        name="purchases"
                        fill="url(#purchasesGradient)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={48}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

export default Analytics;

