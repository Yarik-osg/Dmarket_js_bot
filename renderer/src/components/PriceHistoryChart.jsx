import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { ApiService } from '../services/apiService.js';
import {
    ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend
} from 'recharts';
import { RiCloseLine, RiSearchLine, RiLineChartLine, RiLoader4Line } from 'react-icons/ri';
import '../styles/PriceHistoryChart.css';
import { FLOAT_PART_TO_RANGE } from '../utils/csFloatRanges.js';

const EXTERIORS = [
    { value: 'factory new', label: 'Factory New', short: 'FN' },
    { value: 'minimal wear', label: 'Minimal Wear', short: 'MW' },
    { value: 'field-tested', label: 'Field-Tested', short: 'FT' },
    { value: 'well-worn', label: 'Well-Worn', short: 'WW' },
    { value: 'battle-scarred', label: 'Battle-Scarred', short: 'BS' },
];

const PERIODS = [
    { label: '7д', value: '7D' },
    { label: '1м', value: '1M' },
    { label: '6м', value: '6M' },
    { label: '1р', value: '1Y' },
];

const DEFAULT_PERIOD = '6M';

const EXTERIOR_RE = /\s*\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)\s*$/i;

const EXTERIOR_LABEL_TO_PREFIX = {
    'Factory New': 'FN',
    'Minimal Wear': 'MW',
    'Field-Tested': 'FT',
    'Well-Worn': 'WW',
    'Battle-Scarred': 'BS',
};

function getFloatTokensForItemTitle(title) {
    const m = title?.match(EXTERIOR_RE);
    if (!m) return [];
    const prefix = EXTERIOR_LABEL_TO_PREFIX[m[1]];
    if (!prefix) return [];
    return Object.keys(FLOAT_PART_TO_RANGE)
        .filter(k => k.startsWith(`${prefix}-`))
        .sort((a, b) => {
            const na = parseInt(a.split('-')[1], 10);
            const nb = parseInt(b.split('-')[1], 10);
            return na - nb;
        });
}

function buildAvgSalesFiltersString(tokensForWear, selected) {
    if (!tokensForWear.length || !selected.length) return undefined;
    const allSelected =
        selected.length === tokensForWear.length &&
        tokensForWear.every(t => selected.includes(t));
    if (allSelected) return undefined;
    return selected
        .slice()
        .sort()
        .map(t => `floatPartValue[]=${t}`)
        .join(',');
}

function stripExterior(title) {
    return title.replace(EXTERIOR_RE, '');
}

function computeSMA(prices, window) {
    if (prices.length < window) return prices.map(() => null);
    const result = [];
    let sum = 0;
    for (let i = 0; i < prices.length; i++) {
        sum += prices[i];
        if (i >= window) sum -= prices[i - window];
        result.push(i >= window - 1 ? sum / window : null);
    }
    return result;
}

function PriceHistoryModal({ itemTitle, onClose }) {
    const { client } = useAuth();
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [period, setPeriod] = useState(DEFAULT_PERIOD);
    const [selectedFloatTokens, setSelectedFloatTokens] = useState([]);

    const floatTokensForItem = useMemo(() => getFloatTokensForItemTitle(itemTitle), [itemTitle]);

    useEffect(() => {
        setSelectedFloatTokens([]);
    }, [itemTitle]);

    const filtersParam = useMemo(
        () => buildAvgSalesFiltersString(floatTokensForItem, selectedFloatTokens),
        [floatTokensForItem, selectedFloatTokens]
    );

    const toggleFloatToken = useCallback((token) => {
        setSelectedFloatTokens(prev =>
            prev.includes(token) ? prev.filter(t => t !== token) : [...prev, token]
        );
    }, []);

    const selectAllFloatTokens = useCallback(() => {
        setSelectedFloatTokens([...floatTokensForItem]);
    }, [floatTokensForItem]);

    const clearFloatTokens = useCallback(() => {
        setSelectedFloatTokens([]);
    }, []);

    useEffect(() => {
        if (!client || !itemTitle) return;
        let cancelled = false;
        setLoading(true);
        setError(null);

        const apiService = new ApiService(client);
        const params = {
            title: itemTitle,
            gameId: 'a8db',
            period,
            limit: 20,
            txOperationType: ['Target', 'Offer'],
        };
        if (filtersParam) params.filters = filtersParam;

        apiService.getAvgSalesGraph(params)
            .then(result => {
                if (cancelled) return;
                const dates = result?.date || [];
                const avgPrices = result?.avgPrice || [];
                const totalSales = result?.totalSales || [];

                const points = [];
                for (let i = 0; i < dates.length; i++) {
                    const price = parseFloat(avgPrices[i]) || 0;
                    const volume = parseInt(totalSales[i]) || 0;
                    if (price <= 0) continue;
                    points.push({
                        ts: parseInt(dates[i]) * 1000,
                        price,
                        volume,
                    });
                }
                points.sort((a, b) => a.ts - b.ts);
                setChartData(points);
            })
            .catch(err => {
                if (!cancelled) setError(err.message || 'Помилка завантаження');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [client, itemTitle, period, filtersParam]);

    const smaWindow = useMemo(() => {
        if (!chartData) return 7;
        if (chartData.length > 40) return 7;
        if (chartData.length > 14) return 5;
        return 3;
    }, [chartData?.length]);

    const processedData = useMemo(() => {
        if (!chartData?.length) return [];
        const sma = computeSMA(chartData.map(p => p.price), smaWindow);
        return chartData.map((p, i) => ({
            time: formatDate(p.ts),
            fullTime: formatFullDate(p.ts),
            price: p.price,
            sma: sma[i],
            volume: p.volume,
            ts: p.ts,
        }));
    }, [chartData, smaWindow]);

    const stats = useMemo(() => {
        if (!processedData.length) return null;
        const prices = processedData.map(d => d.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
        const last = prices[prices.length - 1];
        const first = prices[0];
        const change = last - first;
        const changePct = first > 0 ? (change / first) * 100 : 0;
        const totalVolume = processedData.reduce((s, d) => s + d.volume, 0);
        const padding = (max - min) * 0.1 || 0.5;
        return {
            min, max, avg, last, first, change, changePct, totalVolume,
            domainMin: Math.max(0, min - padding),
            domainMax: max + padding
        };
    }, [processedData]);

    return (
        <div className="price-history-overlay" onClick={onClose}>
            <div className="price-history-modal price-history-modal-lg" onClick={e => e.stopPropagation()}>
                <div className="price-history-modal-header">
                    <div>
                        <h3>{itemTitle}</h3>
                        {stats && (
                            <div className="price-history-meta">
                                <span>Остання: <strong>${stats.last.toFixed(2)}</strong></span>
                                <span className={stats.change >= 0 ? 'positive' : 'negative'}>
                                    {stats.change >= 0 ? '+' : ''}{stats.change.toFixed(2)} ({stats.changePct.toFixed(1)}%)
                                </span>
                                <span className="price-history-count">
                                    {stats.totalVolume} продажів
                                </span>
                            </div>
                        )}
                    </div>
                    <button className="price-history-close" onClick={onClose}><RiCloseLine /></button>
                </div>

                <div className="ph-controls-row">
                    <div className="ph-time-range-btns">
                        {PERIODS.map(p => (
                            <button
                                key={p.value}
                                className={`ph-time-btn ${period === p.value ? 'active' : ''}`}
                                onClick={() => setPeriod(p.value)}
                                disabled={loading}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                {floatTokensForItem.length > 0 && (
                    <div className="ph-float-filter">
                        <div className="ph-float-filter-header">
                            <span className="ph-float-filter-label">Категорії флоата</span>
                            <div className="ph-float-filter-actions">
                                <button
                                    type="button"
                                    className="ph-float-filter-link"
                                    onClick={selectAllFloatTokens}
                                    disabled={loading}
                                >
                                    Усі
                                </button>
                                <button
                                    type="button"
                                    className="ph-float-filter-link"
                                    onClick={clearFloatTokens}
                                    disabled={loading}
                                >
                                    Скинути
                                </button>
                            </div>
                        </div>
                        <p className="ph-float-filter-hint">
                            Без вибору — усі піддіапазони для цього зносу. Оберіть вузькі діапазони:
                        </p>
                        <div className="ph-float-chips" role="group" aria-label="Піддіапазони float">
                            {floatTokensForItem.map(token => {
                                const on = selectedFloatTokens.includes(token);
                                return (
                                    <button
                                        key={token}
                                        type="button"
                                        className={`ph-float-chip ${on ? 'active' : ''}`}
                                        onClick={() => toggleFloatToken(token)}
                                        disabled={loading}
                                        title={FLOAT_PART_TO_RANGE[token]}
                                    >
                                        <span className="ph-float-chip-id">{token}</span>
                                        <span className="ph-float-chip-range">{FLOAT_PART_TO_RANGE[token]}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {loading && (
                    <div className="price-history-empty">
                        <RiLoader4Line className="price-history-spinner" />
                        Завантаження...
                    </div>
                )}

                {error && (
                    <div className="price-history-empty" style={{ color: 'var(--error-color)' }}>
                        {error}
                    </div>
                )}

                {!loading && !error && processedData.length === 0 && (
                    <div className="price-history-empty">
                        Немає даних про продажі для цього предмета на DMarket.
                    </div>
                )}

                {!loading && !error && processedData.length > 0 && stats && (
                    <>
                        <div className="price-history-stats-row">
                            <div className="price-history-stat">
                                <span className="price-history-stat-label">Мін</span>
                                <span className="price-history-stat-value">${stats.min.toFixed(2)}</span>
                            </div>
                            <div className="price-history-stat">
                                <span className="price-history-stat-label">Середня</span>
                                <span className="price-history-stat-value">${stats.avg.toFixed(2)}</span>
                            </div>
                            <div className="price-history-stat">
                                <span className="price-history-stat-label">Макс</span>
                                <span className="price-history-stat-value">${stats.max.toFixed(2)}</span>
                            </div>
                        </div>
                        <div className="price-history-chart-wrap">
                            <ResponsiveContainer width="100%" height={320}>
                                <ComposedChart data={processedData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                                    <defs>
                                        <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.06)" vertical={false} />
                                    <XAxis
                                        dataKey="time"
                                        tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                                        axisLine={{ stroke: 'var(--border-color)' }}
                                        tickLine={false}
                                        interval="preserveStartEnd"
                                        minTickGap={50}
                                    />
                                    <YAxis
                                        yAxisId="price"
                                        domain={[stats.domainMin, stats.domainMax]}
                                        tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={v => `$${v.toFixed(2)}`}
                                        width={70}
                                    />
                                    <YAxis yAxisId="vol" orientation="right" hide />
                                    <Tooltip content={<SaleTooltip />} />
                                    <Bar
                                        yAxisId="vol"
                                        dataKey="volume"
                                        name="Продажів"
                                        fill="rgba(59, 130, 246, 0.15)"
                                        barSize={processedData.length > 60 ? 3 : 8}
                                        isAnimationActive={false}
                                    />
                                    <Area
                                        yAxisId="price"
                                        type="monotone"
                                        dataKey="price"
                                        fill="url(#priceGrad)"
                                        stroke="none"
                                        isAnimationActive={false}
                                    />
                                    <Line
                                        yAxisId="price"
                                        type="monotone"
                                        dataKey="price"
                                        name="Сер. ціна"
                                        stroke="#3b82f6"
                                        strokeWidth={2}
                                        dot={processedData.length <= 40 ? { r: 2.5, fill: '#3b82f6' } : false}
                                        activeDot={{ r: 4 }}
                                        isAnimationActive={false}
                                    />
                                    <Line
                                        yAxisId="price"
                                        type="monotone"
                                        dataKey="sma"
                                        name={`SMA(${smaWindow})`}
                                        stroke="#f59e0b"
                                        strokeWidth={2}
                                        dot={false}
                                        strokeDasharray="6 3"
                                        isAnimationActive={false}
                                        connectNulls
                                    />
                                    <Legend
                                        verticalAlign="top"
                                        height={28}
                                        iconSize={10}
                                        wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function SaleTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
        <div className="chart-tooltip-recharts">
            <div className="chart-tooltip-date">{d.fullTime}</div>
            <div style={{ color: '#3b82f6', fontWeight: 700, fontSize: 15 }}>
                ${d.price.toFixed(2)}
            </div>
            {d.sma != null && (
                <div style={{ color: '#f59e0b', fontSize: 12 }}>
                    SMA: ${d.sma.toFixed(2)}
                </div>
            )}
            {d.volume > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    Продажів: {d.volume}
                </div>
            )}
        </div>
    );
}

function PriceHistoryPanel() {
    const { client } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [recentSearches, setRecentSearches] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('priceHistoryRecentSearches') || '[]');
        } catch { return []; }
    });

    const apiService = useMemo(() => client ? new ApiService(client) : null, [client]);

    const handleSearch = useCallback(async () => {
        if (!apiService || !searchQuery.trim()) return;
        setSearching(true);
        setSearchResults([]);
        try {
            const data = await apiService.getAllMarketItems({
                gameId: 'a8db',
                title: searchQuery.trim(),
                currency: 'USD',
                limit: 50,
                orderBy: 'price',
                orderDir: 'asc'
            });

            const baseTitles = new Map();

            for (const item of (data?.objects || [])) {
                const fullTitle = item.title || item.extra?.title || 'Unknown';
                const base = stripExterior(fullTitle);
                const img = item.image || item.extra?.image || null;

                if (!baseTitles.has(base)) {
                    baseTitles.set(base, { image: img, foundExteriors: new Map() });
                }
                const group = baseTitles.get(base);
                if (!group.image && img) group.image = img;

                const extMatch = fullTitle.match(EXTERIOR_RE);
                if (extMatch) {
                    const extLabel = extMatch[1];
                    const raw = item.price?.USD || item.price?.amount || item.price || 0;
                    let price = parseFloat(String(raw));
                    if (price >= 100) price = price / 100;
                    if (!group.foundExteriors.has(extLabel) || price < group.foundExteriors.get(extLabel)) {
                        group.foundExteriors.set(extLabel, price);
                    }
                }
            }

            const items = [];
            for (const [base, group] of baseTitles) {
                for (const ext of EXTERIORS) {
                    const fullTitle = `${base} (${ext.label})`;
                    const foundPrice = group.foundExteriors.get(ext.label);
                    items.push({
                        fullTitle,
                        baseTitle: base,
                        exterior: ext,
                        price: foundPrice || null,
                        image: group.image,
                    });
                }
            }

            setSearchResults(items);
        } catch (err) {
            console.error('Search error:', err);
        } finally {
            setSearching(false);
        }
    }, [apiService, searchQuery]);

    const handleSelectItem = useCallback((fullTitle) => {
        setSelectedItem(fullTitle);
        setRecentSearches(prev => {
            const updated = [fullTitle, ...prev.filter(t => t !== fullTitle)].slice(0, 20);
            localStorage.setItem('priceHistoryRecentSearches', JSON.stringify(updated));
            return updated;
        });
    }, []);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter') handleSearch();
    }, [handleSearch]);

    const groupedResults = useMemo(() => {
        const groups = new Map();
        for (const item of searchResults) {
            if (!groups.has(item.baseTitle)) {
                groups.set(item.baseTitle, { baseTitle: item.baseTitle, image: item.image, items: [] });
            }
            groups.get(item.baseTitle).items.push(item);
        }
        return [...groups.values()];
    }, [searchResults]);

    return (
        <div className="price-history-panel">
            <div className="price-history-panel-header">
                <h3>Історія продажів на DMarket</h3>
                <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                    Пошукайте предмет, щоб побачити реальну історію продажів з DMarket API
                </span>
            </div>

            <div className="price-history-search-row">
                <input
                    type="text"
                    placeholder="Назва предмета, наприклад: AK-47 | Redline"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="price-history-search"
                />
                <button
                    className="btn btn-primary price-history-search-btn"
                    onClick={handleSearch}
                    disabled={searching || !searchQuery.trim() || !apiService}
                >
                    {searching ? <RiLoader4Line className="price-history-spinner" /> : <RiSearchLine />}
                    {searching ? 'Пошук...' : 'Знайти'}
                </button>
            </div>

            {groupedResults.length > 0 && (
                <div className="price-history-section">
                    <h4 className="price-history-section-label">Результати пошуку</h4>
                    {groupedResults.map(group => (
                        <div key={group.baseTitle} className="ph-result-group">
                            <div className="ph-result-group-header">
                                {group.image && (
                                    <img src={group.image} alt="" className="price-history-item-img" loading="lazy" />
                                )}
                                <span className="ph-result-group-title">{group.baseTitle}</span>
                            </div>
                            <div className="ph-exterior-cards">
                                {group.items.map(item => (
                                    <button
                                        key={item.fullTitle}
                                        className="ph-exterior-card"
                                        onClick={() => handleSelectItem(item.fullTitle)}
                                    >
                                        <span className="ph-exterior-card-label">{item.exterior.short}</span>
                                        <span className="ph-exterior-card-name">{item.exterior.label}</span>
                                        <span className="ph-exterior-card-price">
                                            {item.price ? `$${item.price.toFixed(2)}` : '—'}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {recentSearches.length > 0 && groupedResults.length === 0 && (
                <div className="price-history-section">
                    <h4 className="price-history-section-label">Нещодавно переглянуті</h4>
                    <div className="price-history-recent-list">
                        {recentSearches.map(title => (
                            <button
                                key={title}
                                className="price-history-recent-item"
                                onClick={() => handleSelectItem(title)}
                            >
                                <RiLineChartLine style={{ flexShrink: 0 }} />
                                <span>{title}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {!apiService && (
                <div className="price-history-empty-panel">
                    <div>Для перегляду історії цін необхідно авторизуватись</div>
                </div>
            )}

            {apiService && groupedResults.length === 0 && recentSearches.length === 0 && (
                <div className="price-history-empty-panel">
                    <RiLineChartLine style={{ fontSize: 32, marginBottom: 8 }} />
                    <div>Введіть назву предмета та натисніть "Знайти"</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        Буде показано реальну історію продажів з DMarket
                    </div>
                </div>
            )}

            {selectedItem && (
                <PriceHistoryModal
                    itemTitle={selectedItem}
                    onClose={() => setSelectedItem(null)}
                />
            )}
        </div>
    );
}

function formatDate(ts) {
    return new Date(ts).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
}

function formatFullDate(ts) {
    return new Date(ts).toLocaleDateString('uk-UA', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
}

export { PriceHistoryModal, PriceHistoryPanel };
export default PriceHistoryPanel;
