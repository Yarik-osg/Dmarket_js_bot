import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import {
    clearAnalyticsTransactions,
    getAnalyticsTransactions,
    hasLocalDb,
    saveAnalyticsTransactions
} from '../services/localDb.js';
import {
    isStoredAnalyticsType,
    isTradeSaleOrPurchase,
    mapHistoryTransactionToAnalytics
} from '../utils/analyticsTransactionType.js';

const AnalyticsContext = createContext();

function readLegacyTransactions() {
    try {
        const saved = localStorage.getItem('analytics_transactions');
        const parsed = saved ? JSON.parse(saved) : [];

        return parsed.filter(t => {
            const id = t.originalId || t.id;
            return !id || !id.toString().startsWith('test-');
        });
    } catch {
        return [];
    }
}

function persistLegacyTransactions(transactions) {
    try {
        localStorage.setItem('analytics_transactions', JSON.stringify(transactions));
    } catch {
        /* ignore */
    }
}

function clearLegacyAnalyticsStorage() {
    try {
        localStorage.removeItem('analytics_transactions');
    } catch {
        /* ignore */
    }
}

async function persistTransactions(transactions, options = {}) {
    try {
        if (hasLocalDb()) {
            const result = await saveAnalyticsTransactions(transactions, options);
            if (result?.ok) return;
            console.warn('SQLite analytics save failed, falling back to localStorage:', result?.error);
        }
    } catch (error) {
        console.warn('SQLite analytics save failed, falling back to localStorage:', error);
    }

    persistLegacyTransactions(transactions);
}

export function AnalyticsProvider({ children }) {
    const [transactions, setTransactions] = useState(() => {
        const filtered = readLegacyTransactions();
        
        // Якщо були видалені тестові транзакції, зберігаємо очищений список
        persistLegacyTransactions(filtered);
        
        return filtered;
    });
    const [isHydrated, setIsHydrated] = useState(() => !hasLocalDb());

    useEffect(() => {
        if (!hasLocalDb()) {
            setIsHydrated(true);
            return undefined;
        }

        let cancelled = false;

        (async () => {
            try {
                const result = await getAnalyticsTransactions({ limit: 5000 });
                if (cancelled) return;

                if (result?.ok && result.transactions?.length > 0) {
                    setTransactions(result.transactions);
                    clearLegacyAnalyticsStorage();
                } else {
                    const legacy = readLegacyTransactions();
                    if (legacy.length > 0) {
                        await saveAnalyticsTransactions(legacy, { replace: true });
                        if (!cancelled) {
                            setTransactions(legacy);
                            clearLegacyAnalyticsStorage();
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to hydrate analytics from SQLite:', error);
            } finally {
                if (!cancelled) setIsHydrated(true);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const addTransaction = useCallback((transaction) => {
        // Перевіряємо, чи це тестова транзакція (перевіряємо оригінальний ID, якщо він переданий)
        const originalId = transaction.originalId || transaction.id;
        if (originalId) {
            const idStr = originalId.toString();
            if (idStr.startsWith('test-')) {
                console.log('Skipping test transaction:', originalId);
                return; // Не додаємо тестові транзакції
            }
        }
        
        // Використовуємо createdAt з транзакції, якщо є, інакше поточний час
        const timestamp = transaction.createdAt || transaction.timestamp || new Date().toISOString();

        const newTransaction = {
            id: originalId || (Date.now() + Math.random()), // Використовуємо оригінальний ID, якщо є
            timestamp: timestamp, // Використовуємо час транзакції з API
            ...transaction
        };
        console.log('newTransaction', newTransaction);
        console.log('Adding transaction to analytics:', {
            type: newTransaction.type,
            itemTitle: newTransaction.itemTitle,
            assetId: newTransaction.assetId,
            amount: newTransaction.amount,
            timestamp: newTransaction.timestamp,
            id: newTransaction.id
        });
        
        setTransactions(prev => {
            const updated = [newTransaction, ...prev].slice(0, 5000);
            persistTransactions(updated, { replace: true });
            console.log(`Total transactions in analytics: ${updated.length}`);
            return updated;
        });
    }, []);

        const getStatistics = useCallback((period = '30d') => {
            console.log('getStatistics called:', { period, totalTransactions: transactions.length });
            
            const now = new Date();
            const periodMs = {
                '7d': 7 * 24 * 60 * 60 * 1000,
                '30d': 30 * 24 * 60 * 60 * 1000,
                '60d': 60 * 24 * 60 * 60 * 1000,
                'all': Infinity
            }[period] || 30 * 24 * 60 * 60 * 1000;

        const filtered = transactions.filter(t => {
            // Виключаємо тестові транзакції (ID починається з "test-")
            const id = t.id?.toString() || '';
            if (id.startsWith('test-')) {
                return false;
            }
            
            const tDate = new Date(t.timestamp);
            const timeDiff = now - tDate;
            const isInPeriod = periodMs === Infinity || timeDiff <= periodMs;
            
            if (!isInPeriod) {
                // console.log('Transaction filtered out:', {
                //     timestamp: t.timestamp,
                //     date: tDate,
                //     timeDiff: Math.round(timeDiff / (1000 * 60 * 60 * 24)) + ' days',
                //     period: period
                // });
            }
            
            return isInPeriod;
        });
        
        console.log('Filtered transactions:', { 
            total: transactions.length, 
            filtered: filtered.length, 
            period 
        });

        const sales = filtered.filter(t => t.type === 'sale');
        const purchases = filtered.filter(t => t.type === 'purchase');

        const totalSales = sales.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const totalPurchases = purchases.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        const profit = totalSales - totalPurchases;

        // Top profitable items - враховуємо прибуток (продаж - покупка)
        // Зіставляємо покупки та продажі по asset id (itemId) - унікальний ідентифікатор конкретного екземпляра предмета
        // Якщо asset id немає, використовуємо комбінацію назви предмета + timestamp як fallback
        // Для продажів у періоді шукаємо покупки серед ВСІХ транзакцій (не тільки в періоді)
        // щоб врахувати покупки, які були до початку періоду
        // Виключаємо тестові транзакції
        const allPurchases = transactions.filter(t => {
            const id = t.id?.toString() || '';
            return t.type === 'purchase' && !id.startsWith('test-');
        });
        
        const assetPurchases = {}; // Ключ - asset id (itemId) або fallback
        const assetSales = {}; // Ключ - asset id (itemId) або fallback
        
        console.log('Top items calculation:', {
            totalPurchases: allPurchases.length,
            purchasesWithAssetId: allPurchases.filter(p => p.assetId).length,
            purchasesWithoutAssetId: allPurchases.filter(p => !p.assetId).length,
            totalSales: sales.length,
            salesWithAssetId: sales.filter(s => s.assetId).length,
            salesWithoutAssetId: sales.filter(s => !s.assetId).length
        });
        console.log('allPurchases sample (first 3):', allPurchases.slice(0, 3).map(p => ({
            itemTitle: p.itemTitle,
            assetId: p.assetId,
            hasAssetId: !!p.assetId
        })));
        
        // Збираємо ВСІ покупки (не тільки в періоді) для правильного зіставлення
        // Використовуємо asset id (itemId з details.itemId) якщо є, інакше групуємо по назві предмета (FIFO)
        allPurchases
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            .forEach(purchase => {
                // Використовуємо asset id (itemId) якщо є, інакше групуємо по назві предмета
                // Це дозволить зіставити покупки та продажі по назві, якщо немає itemId
                const key = purchase.assetId || purchase.itemTitle || 'Unknown';
                
                if (!purchase.assetId) {
                    console.warn('Purchase without assetId (itemId):', {
                        itemTitle: purchase.itemTitle,
                        timestamp: purchase.timestamp,
                        id: purchase.id
                    });
                }
                
                if (!assetPurchases[key]) {
                    assetPurchases[key] = [];
                }
                assetPurchases[key].push({
                    amount: parseFloat(purchase.amount) || 0,
                    timestamp: purchase.timestamp,
                    itemTitle: purchase.itemTitle,
                    assetId: purchase.assetId // Це має бути itemId з details.itemId
                });
            });
        
        // Збираємо продажі в періоді (сортуємо за часом, найстаріші перші)
        // Використовуємо asset id (itemId з details.itemId) якщо є, інакше групуємо по назві предмета
        sales
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            .forEach(sale => {
                // Використовуємо asset id (itemId) якщо є, інакше групуємо по назві предмета
                const key = sale.assetId || sale.itemTitle || 'Unknown';
                
                if (!sale.assetId) {
                    console.warn('Sale without assetId (itemId):', {
                        itemTitle: sale.itemTitle,
                        timestamp: sale.timestamp,
                        id: sale.id
                    });
                }
                
                if (!assetSales[key]) {
                    assetSales[key] = [];
                }
                assetSales[key].push({
                    amount: parseFloat(sale.amount) || 0,
                    timestamp: sale.timestamp,
                    itemTitle: sale.itemTitle,
                    assetId: sale.assetId // Це має бути itemId з details.itemId
                });
            });
        
        console.log('Grouped by assetId:', {
            uniquePurchaseAssetIds: Object.keys(assetPurchases).length,
            uniqueSalesAssetIds: Object.keys(assetSales).length,
            purchaseAssetIds: Object.keys(assetPurchases).slice(0, 5),
            salesAssetIds: Object.keys(assetSales).slice(0, 5)
        });
        
        // Розраховуємо прибуток для кожного asset id (конкретного екземпляра предмета)
        // Зіставляємо покупку та продаж по asset id (1:1 зіставлення - один продаж з однією покупкою)
        const assetStats = {};
        
        Object.keys(assetSales).forEach(assetId => {
            const sales = assetSales[assetId];
            const purchases = assetPurchases[assetId] || [];
            
            // Пропускаємо asset id, для яких немає покупок
            if (purchases.length === 0) {
                console.log(`Skipping assetId "${assetId}": no purchases found`);
                return;
            }
            
            // Для кожного продажу знаходимо відповідну покупку по asset id
            // Оскільки asset id унікальний для кожного екземпляра, має бути 1:1 зіставлення
            let totalRevenue = 0;
            let totalCost = 0;
            let matchedCount = 0;
            let purchaseIndex = 0;
            const itemTitle = sales[0]?.itemTitle || 'Unknown Item'; // Використовуємо назву з першого продажу
            
            console.log(`\n=== Processing "${itemTitle}" (assetId: "${assetId}") ===`);
            console.log(`Sales: ${sales.length}`, sales.map(s => ({ amount: s.amount, timestamp: s.timestamp })));
            console.log(`Purchases: ${purchases.length}`, purchases.map(p => ({ amount: p.amount, timestamp: p.timestamp })));
            
            sales.forEach((sale, saleIdx) => {
                // Шукаємо покупку з таким самим asset id, яка була до цього продажу
                let foundPurchase = null;
                for (let i = purchaseIndex; i < purchases.length; i++) {
                    if (new Date(purchases[i].timestamp) <= new Date(sale.timestamp)) {
                        foundPurchase = purchases[i];
                        purchaseIndex = i + 1;
                        break;
                    }
                }
                
                // Якщо знайшли покупку, враховуємо прибуток
                if (foundPurchase) {
                    const saleProfit = sale.amount - foundPurchase.amount;
                    console.log(`  Sale #${saleIdx + 1}: $${sale.amount.toFixed(2)} - Purchase: $${foundPurchase.amount.toFixed(2)} = Profit: $${saleProfit.toFixed(2)}`);
                    totalRevenue += sale.amount;
                    totalCost += foundPurchase.amount;
                    matchedCount++;
                } else {
                    console.log(`  Sale #${saleIdx + 1}: $${sale.amount.toFixed(2)} - NO MATCHING PURCHASE FOUND (same assetId)`);
                }
            });
            
            // Показуємо тільки якщо є зіставлені продажі з покупками
            if (matchedCount > 0) {
                const profit = totalRevenue - totalCost;
                
                console.log(`\n=== Summary for "${itemTitle}" (assetId: "${assetId}") ===`);
                console.log(`Total Revenue: $${totalRevenue.toFixed(2)}`);
                console.log(`Total Cost: $${totalCost.toFixed(2)}`);
                console.log(`Total Profit: $${profit.toFixed(2)}`);
                console.log(`Matched Count: ${matchedCount}\n`);
                
                // Групуємо по назві предмета для відображення в топі
                if (!assetStats[itemTitle]) {
                    assetStats[itemTitle] = {
                        revenue: 0,
                        cost: 0,
                        profit: 0,
                        count: 0
                    };
                }
                
                assetStats[itemTitle].revenue += totalRevenue;
                assetStats[itemTitle].cost += totalCost;
                assetStats[itemTitle].profit += profit;
                assetStats[itemTitle].count += matchedCount;
            }
        });
        
        console.log('Final assetStats:', Object.keys(assetStats).length, 'items');
        
        // Підраховуємо загальний прибуток зі зіставлених покупок-продажів
        const matchedProfit = Object.values(assetStats).reduce((sum, stats) => sum + stats.profit, 0);
        const matchedRevenue = Object.values(assetStats).reduce((sum, stats) => sum + stats.revenue, 0);
        const matchedCost = Object.values(assetStats).reduce((sum, stats) => sum + stats.cost, 0);
        const matchedCount = Object.values(assetStats).reduce((sum, stats) => sum + stats.count, 0);
        
        const topItems = Object.entries(assetStats)
            .map(([title, stats]) => ({
                title,
                revenue: stats.revenue,
                cost: stats.cost,
                profit: stats.profit, // Прибуток = продаж - покупка
                count: stats.count,
                avgPrice: stats.revenue / stats.count // Середня ціна продажу
            }))
            .sort((a, b) => b.profit - a.profit) // Сортуємо за прибутком, а не за доходом
            .slice(0, 10);

        return {
            period,
            totalSales,
            totalPurchases,
            profit,
            profitMargin: totalSales > 0 ? (profit / totalSales) * 100 : 0,
            salesCount: sales.length,
            purchasesCount: purchases.length,
            matchedProfit, // Прибуток зі зіставлених покупок-продажів
            matchedRevenue, // Загальний дохід зі зіставлених продажів
            matchedCost, // Загальна вартість зіставлених покупок
            matchedCount, // Кількість зіставлених пар покупка-продаж
            matchedProfitMargin: matchedRevenue > 0 ? (matchedProfit / matchedRevenue) * 100 : 0,
            topItems,
            dailyData: getDailyData(filtered)
        };
    }, [transactions]);

    const getDailyData = (transactions) => {
        const daily = {};
        transactions.forEach(t => {
            const date = new Date(t.timestamp).toISOString().split('T')[0];
            if (!daily[date]) {
                daily[date] = { 
                    sales: 0, 
                    purchases: 0, 
                    count: 0,
                    salesCount: 0,
                    purchasesCount: 0
                };
            }
            if (t.type === 'sale') {
                daily[date].sales += parseFloat(t.amount) || 0;
                daily[date].salesCount += 1;
            } else if (t.type === 'purchase') {
                daily[date].purchases += parseFloat(t.amount) || 0;
                daily[date].purchasesCount += 1;
            }
            if (isTradeSaleOrPurchase(t.type)) {
                daily[date].count += 1;
            }
        });
        return Object.entries(daily)
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => a.date.localeCompare(b.date));
    };

    // Функція для повного перезавантаження транзакцій (очищає localStorage і завантажує з API)
    const reloadTransactionsFromAPI = useCallback(async (apiService, limit = 300) => {
        if (!apiService) {
            console.warn('API service not available for reloading transactions');
            return;
        }

        try {
            console.log('Reloading all transactions from API (clearing stored analytics)...');
            localStorage.removeItem('analytics_transactions');
            await clearAnalyticsTransactions();
            
            const response = await apiService.getTransactionHistory({
                limit: limit,
                sortBy: 'createdAt'
            });

            const transactions = response?.objects || response?.transactions || response?.result || [];
            console.log(`Loaded ${transactions.length} transactions from API`);

            if (transactions.length === 0) {
                setTransactions([]);
                return;
            }

            const analyticsTransactions = transactions
                .map(mapHistoryTransactionToAnalytics)
                .filter((tx) => {
                    const id = tx.originalId || tx.id;
                    if (id && String(id).startsWith('test-')) {
                        console.log('Filtering out test transaction from API:', id);
                        return false;
                    }
                    if (!isStoredAnalyticsType(tx.type)) {
                        return false;
                    }
                    if (
                        (tx.type === 'sale' || tx.type === 'purchase') &&
                        !tx.assetId
                    ) {
                        console.warn('Transaction without assetId (will use fallback):', {
                            type: tx.type,
                            itemTitle: tx.itemTitle,
                            id: tx.id
                        });
                    }
                    return true;
                });

            console.log(`Processed ${analyticsTransactions.length} transactions for analytics`);

            // Зберігаємо всі транзакції (повне перезавантаження)
            setTransactions(analyticsTransactions);
            await persistTransactions(analyticsTransactions, { replace: true });
            console.log(`Reloaded ${analyticsTransactions.length} transactions from API`);
        } catch (error) {
            console.error('Error reloading transactions from API:', error);
        }
    }, []);

    // Функція для завантаження існуючих транзакцій з API (додає тільки нові)
    const loadTransactionsFromAPI = useCallback(async (apiService, limit = 100) => {
        if (!apiService) {
            console.warn('API service not available for loading transactions');
            return;
        }

        try {
            console.log('Loading transactions from API...');
            const response = await apiService.getTransactionHistory({
                limit: limit,
                sortBy: 'createdAt'
            });

            const transactions = response?.objects || response?.transactions || response?.result || [];
            console.log(`Loaded ${transactions.length} transactions from API`);

            if (transactions.length === 0) {
                return;
            }

            const analyticsTransactions = transactions
                .map(mapHistoryTransactionToAnalytics)
                .filter((tx) => {
                    const id = tx.originalId || tx.id;
                    if (id && String(id).startsWith('test-')) {
                        console.log('Filtering out test transaction from API:', id);
                        return false;
                    }
                    if (!isStoredAnalyticsType(tx.type)) {
                        return false;
                    }
                    if (
                        (tx.type === 'sale' || tx.type === 'purchase') &&
                        !tx.assetId
                    ) {
                        console.warn('Transaction without assetId (will use fallback):', {
                            type: tx.type,
                            itemTitle: tx.itemTitle,
                            id: tx.id
                        });
                    }
                    return true;
                });

            console.log(`Processed ${analyticsTransactions.length} transactions for analytics`);

            // Додаємо транзакції, уникаючи дублікатів
            setTransactions((prev) => {
                const existingIds = new Set(prev.map(t => t.id));
                const newTransactions = analyticsTransactions.filter(t => !existingIds.has(t.id));
                
                if (newTransactions.length > 0) {
                    const updated = [...newTransactions, ...prev].slice(0, 5000);
                    persistTransactions(updated, { replace: true });
                    console.log(`Added ${newTransactions.length} new transactions, total: ${updated.length}`);
                    return updated;
                } else {
                    console.log('No new transactions to add');
                    return prev;
                }
            });
        } catch (error) {
            console.error('Error loading transactions from API:', error);
        }
    }, []);

    return (
        <AnalyticsContext.Provider value={{
            transactions,
            addTransaction,
            getStatistics,
            loadTransactionsFromAPI,
            reloadTransactionsFromAPI,
            isHydrated
        }}>
            {children}
        </AnalyticsContext.Provider>
    );
}

export function useAnalytics() {
    const context = useContext(AnalyticsContext);
    if (!context) {
        throw new Error('useAnalytics must be used within AnalyticsProvider');
    }
    return context;
}

