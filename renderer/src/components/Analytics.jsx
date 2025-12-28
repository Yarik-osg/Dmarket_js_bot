import React, { useState, useMemo } from 'react';
import { useAnalytics } from '../contexts/AnalyticsContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { ApiService } from '../services/apiService.js';
import '../styles/Analytics.css';

function Analytics() {
    const { t } = useLocale();
    const { getStatistics, loadTransactionsFromAPI, reloadTransactionsFromAPI, transactions } = useAnalytics();
    const { client } = useAuth();
    const [period, setPeriod] = useState('30d');
    const [isLoading, setIsLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all'); // Фільтр за статусом: 'all', 'success', 'trade_protected'
    
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
                            style={{ 
                                padding: '8px 16px', 
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                            title="Додати нові транзакції з API"
                        >
                            <span style={{ 
                                display: 'inline-block',
                                transform: isLoading ? 'rotate(360deg)' : 'none',
                                transition: isLoading ? 'transform 1s linear' : 'none',
                                fontSize: '16px'
                            }}>
                                🔄
                            </span>
                            {isLoading ? 'Завантаження...' : 'Завантажити'}
                        </button>
                        <button 
                            onClick={handleReloadTransactions}
                            disabled={isLoading || !apiService}
                            className="btn btn-secondary"
                            style={{ 
                                padding: '8px 16px', 
                                fontSize: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                backgroundColor: 'var(--error-color)',
                                color: 'white'
                            }}
                            title="Повністю перезавантажити всі транзакції з API (очистить localStorage)"
                        >
                            <span style={{ 
                                display: 'inline-block',
                                transform: isLoading ? 'rotate(360deg)' : 'none',
                                transition: isLoading ? 'transform 1s linear' : 'none',
                                fontSize: '16px'
                            }}>
                                🔄
                            </span>
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

