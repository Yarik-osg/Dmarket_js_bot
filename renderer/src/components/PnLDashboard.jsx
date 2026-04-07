import React, { useState, useMemo } from 'react';
import { useAnalytics } from '../contexts/AnalyticsContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    Cell, LineChart, Line
} from 'recharts';
import '../styles/PnLDashboard.css';

const DEFAULT_FEE_PERCENT = 2;

/**
 * API amount for sales = what user received (net, after DMarket fee).
 * To show gross (listed price on DMarket): gross = net / (1 - fee/100)
 * Fee paid to DMarket: fee = gross - net
 */
function estimateGrossPrice(netReceived, feePercent) {
    return netReceived / (1 - feePercent / 100);
}

function PnLDashboard() {
    const { transactions } = useAnalytics();
    const { t } = useLocale();
    const [period, setPeriod] = useState('30d');
    const [feePercent, setFeePercent] = useState(DEFAULT_FEE_PERCENT);

    const pnlData = useMemo(() => {
        const now = new Date();
        const periodMs = {
            '7d': 7 * 86400000,
            '30d': 30 * 86400000,
            '60d': 60 * 86400000,
            '90d': 90 * 86400000,
            'all': Infinity
        }[period] || 30 * 86400000;

        const validTx = transactions.filter(tx => {
            const id = (tx.id || '').toString();
            if (id.startsWith('test-')) return false;
            const tDate = new Date(tx.timestamp);
            return periodMs === Infinity || (now - tDate) <= periodMs;
        });

        const sales = validTx.filter(tx => tx.type === 'sale');
        const purchases = validTx.filter(tx => tx.type === 'purchase');
        const allPurchases = transactions.filter(tx => {
            const id = (tx.id || '').toString();
            return tx.type === 'purchase' && !id.startsWith('test-');
        });

        const purchasesByAsset = new Map();
        allPurchases
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            .forEach(p => {
                const key = p.assetId || p.itemTitle || 'Unknown';
                if (!purchasesByAsset.has(key)) purchasesByAsset.set(key, []);
                purchasesByAsset.get(key).push({ ...p, used: false });
            });

        const matched = [];
        const purchaseIndices = new Map();

        sales
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            .forEach(sale => {
                const key = sale.assetId || sale.itemTitle || 'Unknown';
                const pList = purchasesByAsset.get(key);
                if (!pList) return;

                const startIdx = purchaseIndices.get(key) || 0;
                for (let i = startIdx; i < pList.length; i++) {
                    if (!pList[i].used && new Date(pList[i].timestamp) <= new Date(sale.timestamp)) {
                        const purchase = pList[i];
                        pList[i].used = true;
                        purchaseIndices.set(key, i + 1);

                        // amount from API = what user actually received (net, post-fee)
                        const received = parseFloat(sale.amount) || 0;
                        const paid = parseFloat(purchase.amount) || 0;
                        const grossPrice = estimateGrossPrice(received, feePercent);
                        const feeAmount = grossPrice - received;
                        const profit = received - paid;
                        const roi = paid > 0 ? (profit / paid) * 100 : 0;
                        const holdDays = Math.max(0, Math.floor(
                            (new Date(sale.timestamp) - new Date(purchase.timestamp)) / 86400000
                        ));

                        matched.push({
                            itemTitle: sale.itemTitle || 'Unknown',
                            assetId: sale.assetId,
                            paid,
                            received,
                            grossPrice,
                            feeAmount,
                            profit,
                            roi,
                            holdDays,
                            purchaseDate: purchase.timestamp,
                            saleDate: sale.timestamp,
                            floatValue: sale.floatValue || purchase.floatValue
                        });
                        break;
                    }
                }
            });

        const totalReceived = matched.reduce((s, m) => s + m.received, 0);
        const totalPaid = matched.reduce((s, m) => s + m.paid, 0);
        const totalFees = matched.reduce((s, m) => s + m.feeAmount, 0);
        const totalGross = matched.reduce((s, m) => s + m.grossPrice, 0);
        const totalProfit = matched.reduce((s, m) => s + m.profit, 0);
        const avgROI = matched.length > 0 ? matched.reduce((s, m) => s + m.roi, 0) / matched.length : 0;
        const avgHoldDays = matched.length > 0 ? matched.reduce((s, m) => s + m.holdDays, 0) / matched.length : 0;

        const profitable = matched.filter(m => m.profit > 0);
        const lossMaking = matched.filter(m => m.profit <= 0);
        const winRate = matched.length > 0 ? (profitable.length / matched.length) * 100 : 0;

        const byItem = {};
        matched.forEach(m => {
            if (!byItem[m.itemTitle]) {
                byItem[m.itemTitle] = { count: 0, profit: 0, totalPaid: 0, totalReceived: 0, totalFees: 0 };
            }
            byItem[m.itemTitle].count++;
            byItem[m.itemTitle].profit += m.profit;
            byItem[m.itemTitle].totalPaid += m.paid;
            byItem[m.itemTitle].totalReceived += m.received;
            byItem[m.itemTitle].totalFees += m.feeAmount;
        });

        const topProfitable = Object.entries(byItem)
            .map(([title, data]) => ({ title, ...data, avgProfit: data.profit / data.count }))
            .sort((a, b) => b.profit - a.profit)
            .slice(0, 10);

        const topLossMaking = Object.entries(byItem)
            .map(([title, data]) => ({ title, ...data, avgProfit: data.profit / data.count }))
            .sort((a, b) => a.profit - b.profit)
            .filter(i => i.profit < 0)
            .slice(0, 5);

        const dailyPnL = {};
        matched.forEach(m => {
            const date = new Date(m.saleDate).toISOString().split('T')[0];
            if (!dailyPnL[date]) {
                dailyPnL[date] = { date, profit: 0, fees: 0, trades: 0, received: 0, paid: 0 };
            }
            dailyPnL[date].profit += m.profit;
            dailyPnL[date].fees += m.feeAmount;
            dailyPnL[date].trades++;
            dailyPnL[date].received += m.received;
            dailyPnL[date].paid += m.paid;
        });

        const dailyData = Object.values(dailyPnL)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(d => ({ ...d, label: formatDateShort(d.date) }));

        let cumulative = 0;
        const cumulativeData = dailyData.map(d => {
            cumulative += d.profit;
            return { ...d, cumulative };
        });

        return {
            matched,
            totalReceived,
            totalPaid,
            totalFees,
            totalGross,
            totalProfit,
            avgROI,
            avgHoldDays,
            winRate,
            profitableCount: profitable.length,
            lossCount: lossMaking.length,
            topProfitable,
            topLossMaking,
            dailyData: cumulativeData,
        };
    }, [transactions, period, feePercent]);

    return (
        <div className="pnl-dashboard">
            <div className="pnl-header">
                <h2 className="pnl-title">Прибутки та Збитки (P&L)</h2>
                <div className="pnl-controls">
                    <select value={period} onChange={e => setPeriod(e.target.value)} className="analytics-period-select">
                        <option value="7d">7 днів</option>
                        <option value="30d">30 днів</option>
                        <option value="60d">60 днів</option>
                        <option value="90d">90 днів</option>
                        <option value="all">Весь час</option>
                    </select>
                    <select value={feePercent} onChange={e => setFeePercent(Number(e.target.value))} className="analytics-period-select">
                        <option value={2}>Комісія 2%</option>
                        <option value={5}>Комісія 5%</option>
                        <option value={10}>Комісія 10%</option>
                    </select>
                </div>
            </div>

            <div className="pnl-fee-note">
                Отримано = сума на балансі (вже після комісії DMarket).
                Прибуток = отримано − покупка. Комісія (~{feePercent}%) показана інформативно (зворотний розрахунок).
            </div>

            <div className="pnl-summary-grid">
                <div className="pnl-card pnl-card-main">
                    <div className="pnl-card-label">Прибуток</div>
                    <div className={`pnl-card-value ${pnlData.totalProfit >= 0 ? 'positive' : 'negative'}`}>
                        {pnlData.totalProfit >= 0 ? '+' : ''}${pnlData.totalProfit.toFixed(2)}
                    </div>
                    <div className="pnl-card-sub">
                        Отримано: ${pnlData.totalReceived.toFixed(2)} | Витрачено: ${pnlData.totalPaid.toFixed(2)}
                    </div>
                </div>

                <div className="pnl-card">
                    <div className="pnl-card-label">Win Rate</div>
                    <div className={`pnl-card-value ${pnlData.winRate >= 50 ? 'positive' : 'negative'}`}>
                        {pnlData.winRate.toFixed(1)}%
                    </div>
                    <div className="pnl-card-sub">
                        {pnlData.profitableCount} прибуткових / {pnlData.lossCount} збиткових
                    </div>
                </div>

                <div className="pnl-card">
                    <div className="pnl-card-label">Середній ROI</div>
                    <div className={`pnl-card-value ${pnlData.avgROI >= 0 ? 'positive' : 'negative'}`}>
                        {pnlData.avgROI.toFixed(1)}%
                    </div>
                    <div className="pnl-card-sub">
                        {pnlData.matched.length} угод | ~{pnlData.avgHoldDays.toFixed(1)} дн. утримання
                    </div>
                </div>

                <div className="pnl-card">
                    <div className="pnl-card-label">Комісія DMarket (оцінка)</div>
                    <div className="pnl-card-value" style={{ color: 'var(--warning-color)' }}>
                        ~${pnlData.totalFees.toFixed(2)}
                    </div>
                    <div className="pnl-card-sub">
                        Ціна на маркеті: ~${pnlData.totalGross.toFixed(2)}
                    </div>
                </div>
            </div>

            {pnlData.dailyData.length > 0 && (
                <div className="pnl-section">
                    <h3 className="pnl-section-title">Кумулятивний P&L</h3>
                    <div className="pnl-chart-container">
                        <ResponsiveContainer width="100%" height={280}>
                            <LineChart data={pnlData.dailyData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.06)" vertical={false} />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                                    axisLine={{ stroke: 'var(--border-color)' }}
                                    tickLine={false}
                                    interval="preserveStartEnd"
                                />
                                <YAxis
                                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={v => `$${v}`}
                                    width={60}
                                />
                                <Tooltip content={<PnLTooltip />} />
                                <Line
                                    type="monotone"
                                    dataKey="cumulative"
                                    stroke="#10b981"
                                    strokeWidth={2.5}
                                    dot={false}
                                    activeDot={{ r: 4, fill: '#10b981' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {pnlData.dailyData.length > 0 && (
                <div className="pnl-section">
                    <h3 className="pnl-section-title">Щоденний P&L</h3>
                    <div className="pnl-chart-container">
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={pnlData.dailyData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.06)" vertical={false} />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                                    axisLine={{ stroke: 'var(--border-color)' }}
                                    tickLine={false}
                                    interval="preserveStartEnd"
                                />
                                <YAxis
                                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={v => `$${v}`}
                                    width={60}
                                />
                                <Tooltip content={<DailyPnLTooltip />} />
                                <Bar dataKey="profit" radius={[4, 4, 0, 0]} maxBarSize={36}>
                                    {pnlData.dailyData.map((entry, idx) => (
                                        <Cell key={idx} fill={entry.profit >= 0 ? '#10b981' : '#ef4444'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {pnlData.topProfitable.length > 0 && (
                <div className="pnl-section">
                    <h3 className="pnl-section-title">Найприбутковіші предмети</h3>
                    <div className="pnl-table-wrap">
                        <table className="analytics-table">
                            <thead>
                                <tr>
                                    <th>Предмет</th>
                                    <th>Угод</th>
                                    <th>Інвестовано</th>
                                    <th>Отримано</th>
                                    <th>Комісія (~)</th>
                                    <th>Прибуток</th>
                                    <th>Сер. P&L</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pnlData.topProfitable.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="item-title">{item.title}</td>
                                        <td>{item.count}</td>
                                        <td>${item.totalPaid.toFixed(2)}</td>
                                        <td>${item.totalReceived.toFixed(2)}</td>
                                        <td style={{ color: 'var(--warning-color)', fontSize: '12px' }}>
                                            ~${item.totalFees.toFixed(2)}
                                        </td>
                                        <td className={item.profit >= 0 ? 'positive' : 'negative'}>
                                            {item.profit >= 0 ? '+' : ''}${item.profit.toFixed(2)}
                                        </td>
                                        <td className={item.avgProfit >= 0 ? 'positive' : 'negative'}>
                                            {item.avgProfit >= 0 ? '+' : ''}${item.avgProfit.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {pnlData.topLossMaking.length > 0 && (
                <div className="pnl-section">
                    <h3 className="pnl-section-title">Збиткові предмети</h3>
                    <div className="pnl-table-wrap">
                        <table className="analytics-table">
                            <thead>
                                <tr>
                                    <th>Предмет</th>
                                    <th>Угод</th>
                                    <th>Інвестовано</th>
                                    <th>Отримано</th>
                                    <th>Прибуток</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pnlData.topLossMaking.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="item-title">{item.title}</td>
                                        <td>{item.count}</td>
                                        <td>${item.totalPaid.toFixed(2)}</td>
                                        <td>${item.totalReceived.toFixed(2)}</td>
                                        <td className="negative">${item.profit.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {pnlData.matched.length > 0 && (
                <div className="pnl-section">
                    <h3 className="pnl-section-title">Останні угоди (детально)</h3>
                    <div className="pnl-table-wrap">
                        <table className="analytics-table">
                            <thead>
                                <tr>
                                    <th>Предмет</th>
                                    <th>Float</th>
                                    <th>Покупка</th>
                                    <th>Отримано</th>
                                    <th>Комісія (~)</th>
                                    <th>Прибуток</th>
                                    <th>ROI</th>
                                    <th>Дні</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pnlData.matched.slice(0, 20).map((trade, idx) => (
                                    <tr key={idx}>
                                        <td className="item-title">{trade.itemTitle}</td>
                                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            {trade.floatValue ? parseFloat(trade.floatValue).toFixed(5) : 'N/A'}
                                        </td>
                                        <td>${trade.paid.toFixed(2)}</td>
                                        <td>${trade.received.toFixed(2)}</td>
                                        <td style={{ color: 'var(--warning-color)', fontSize: '12px' }}>
                                            ~${trade.feeAmount.toFixed(2)}
                                        </td>
                                        <td className={trade.profit >= 0 ? 'positive' : 'negative'}>
                                            {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                                        </td>
                                        <td className={trade.roi >= 0 ? 'positive' : 'negative'} style={{ fontSize: '12px' }}>
                                            {trade.roi.toFixed(1)}%
                                        </td>
                                        <td style={{ fontSize: '12px' }}>{trade.holdDays}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {pnlData.matched.length === 0 && (
                <div className="analytics-empty" style={{ marginTop: 24 }}>
                    Немає зіставлених угод (покупка + продаж) для розрахунку P&L
                </div>
            )}
        </div>
    );
}

function formatDateShort(dateStr) {
    return new Date(dateStr).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
}

function formatDateFull(dateStr) {
    return new Date(dateStr).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function PnLTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
        <div className="chart-tooltip-recharts">
            <div className="chart-tooltip-date">{formatDateFull(d.date)}</div>
            <div style={{ color: d.cumulative >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                Кумулятивний P&L: ${d.cumulative.toFixed(2)}
            </div>
            <div style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 12 }}>
                Денний: {d.profit >= 0 ? '+' : ''}${d.profit.toFixed(2)} | Угод: {d.trades}
            </div>
        </div>
    );
}

function DailyPnLTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
        <div className="chart-tooltip-recharts">
            <div className="chart-tooltip-date">{formatDateFull(d.date)}</div>
            <div style={{ color: d.profit >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                Прибуток: {d.profit >= 0 ? '+' : ''}${d.profit.toFixed(2)}
            </div>
            <div style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 12 }}>
                Отримано: ${d.received.toFixed(2)} | Витрачено: ${d.paid.toFixed(2)}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                Угод: {d.trades}
            </div>
        </div>
    );
}

export default PnLDashboard;
