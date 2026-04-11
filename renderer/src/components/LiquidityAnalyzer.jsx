import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { ApiService } from '../services/apiService.js';
import { RiSearchLine, RiInformationLine, RiCloseLine } from 'react-icons/ri';
import LiquidityFilters from './liquidity/LiquidityFilters.jsx';
import LiquidityCard from './liquidity/LiquidityCard.jsx';
import LiquidityResultsHeader from './liquidity/LiquidityResultsHeader.jsx';
import { buildTreeFilters, filterSalesClientSide, analyzeItem, errorItemResult } from '../utils/liquidityAnalysis.js';
import usePersistedState from '../hooks/usePersistedState.js';
import '../styles/LiquidityAnalyzer.css';

const RAW = { serialize: String, deserialize: String };
const INT = { serialize: String, deserialize: v => parseInt(v, 10) };

function LiquidityAnalyzer() {
    const { client } = useAuth();
    const { t } = useLocale();
    const [isLoading, setIsLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [analysisData, setAnalysisData] = useState([]);
    const [progress, setProgress] = useState({ current: 0, total: 0, currentTitle: '' });
    const [sortBy, setSortBy] = useState('opportunity');
    const [activeTooltip, setActiveTooltip] = useState(null);
    const [showHeaderTooltip, setShowHeaderTooltip] = useState(false);
    const [filtersCollapsed, setFiltersCollapsed] = useState(false);

    const cancelRef = useRef(false);

    // Persisted filter state — single object driven by usePersistedState for each key
    const [selectedCategories, setSelectedCategories] = usePersistedState('liquidity_categories', []);
    const [selectedQualities, setSelectedQualities] = usePersistedState('liquidity_qualities', []);
    const [selectedExteriors, setSelectedExteriors] = usePersistedState('liquidity_exteriors', []);
    const [selectedStatTrak, setSelectedStatTrak] = usePersistedState('liquidity_stattrak', []);
    const [maxItems, setMaxItems] = usePersistedState('liquidity_maxItems', 100, INT);
    const [minPrice, setMinPrice] = usePersistedState('liquidity_minPrice', '', RAW);
    const [maxPrice, setMaxPrice] = usePersistedState('liquidity_maxPrice', '', RAW);
    const [selectedFloats, setSelectedFloats] = usePersistedState('liquidity_selectedFloats', []);
    const requestDelay = 300;

    const [itemSearch, setItemSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeoutRef = useRef(null);

    // Aggregated filters object for LiquidityFilters component
    const filters = {
        selectedCategories, selectedQualities, selectedExteriors, selectedStatTrak,
        minPrice, maxPrice, selectedFloats, maxItems, itemSearch,
    };
    const setFilters = useCallback((updater) => {
        const next = typeof updater === 'function' ? updater(filters) : updater;
        if (next.selectedCategories !== undefined) setSelectedCategories(next.selectedCategories);
        if (next.selectedQualities !== undefined) setSelectedQualities(next.selectedQualities);
        if (next.selectedExteriors !== undefined) setSelectedExteriors(next.selectedExteriors);
        if (next.selectedStatTrak !== undefined) setSelectedStatTrak(next.selectedStatTrak);
        if (next.minPrice !== undefined) setMinPrice(next.minPrice);
        if (next.maxPrice !== undefined) setMaxPrice(next.maxPrice);
        if (next.selectedFloats !== undefined) setSelectedFloats(next.selectedFloats);
        if (next.maxItems !== undefined) setMaxItems(next.maxItems);
        if (next.itemSearch !== undefined) setItemSearch(next.itemSearch);
    }, [filters]);

    // Search
    const handleItemSearch = useCallback((query) => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        if (!client || !query.trim()) { setSearchResults([]); setIsSearching(false); return; }
        setIsSearching(true);
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const api = new ApiService(client);
                const res = await api.getAllMarketItems({ gameId: 'a8db', currency: 'USD', title: query, limit: 50 });
                if (res?.objects) {
                    const unique = new Map();
                    res.objects.forEach(item => {
                        const t = item.title || item.extra?.title || '';
                        if (!unique.has(t)) { unique.set(t, item); return; }
                        const ep = parseFloat(unique.get(t).price?.USD || unique.get(t).price?.amount || 0);
                        const cp = parseFloat(item.price?.USD || item.price?.amount || 0);
                        if (cp < ep) unique.set(t, item);
                    });
                    setSearchResults(Array.from(unique.values()).slice(0, 10));
                }
            } catch { setSearchResults([]); }
            finally { setIsSearching(false); }
        }, 500);
    }, [client]);

    const handleSelectSearchResult = useCallback((item) => {
        setItemSearch(item.title || item.extra?.title || '');
        setSearchResults([]);
    }, []);

    useEffect(() => () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); }, []);
    useEffect(() => {
        const handler = (e) => { if (!e.target.closest('.search-input-wrapper')) setSearchResults([]); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const apiService = useMemo(() => client ? new ApiService(client) : null, [client]);

    // Cancel handler
    const handleCancel = useCallback(() => { cancelRef.current = true; }, []);

    const handleAnalyze = async () => {
        if (!apiService) return;

        cancelRef.current = false;
        setIsLoading(true);
        setItems([]);
        setAnalysisData([]);
        setProgress({ current: 0, total: 0, currentTitle: '' });

        try {
            const treeFilter = buildTreeFilters({
                categories: selectedCategories, qualities: selectedQualities,
                exteriors: selectedExteriors, statTrak: selectedStatTrak,
                selectedFloats,
            });

            let allItems = [];
            let cursor = null;
            const limit = 100;
            let hasMore = true;
            const maxItemsToFetch = maxItems * 5;
            let pageCount = 0;
            const maxPages = 300;

            while (hasMore && allItems.length < maxItemsToFetch && pageCount < maxPages) {
                if (cancelRef.current) break;

                const priceFromCents = minPrice ? Math.round(parseFloat(minPrice) * 100) : 0;
                const priceToCents = maxPrice ? Math.round(parseFloat(maxPrice) * 100) : 0;

                const params = {
                    gameId: 'a8db', currency: 'USD', limit,
                    treeFilters: treeFilter, orderBy: 'price', orderDir: 'asc',
                };
                if (itemSearch.trim()) params.title = itemSearch.trim();
                if (cursor) params.cursor = cursor;
                if (priceFromCents > 0) params.priceFrom = priceFromCents;
                if (priceToCents > 0) params.priceTo = priceToCents;

                const response = await apiService.getAllMarketItems(params);
                pageCount++;

                if (response.objects?.length > 0) {
                    allItems = allItems.concat(response.objects);
                    if (response.cursor && response.cursor !== cursor) cursor = response.cursor;
                    else hasMore = false;
                    if (response.objects.length < limit) hasMore = false;
                } else {
                    hasMore = false;
                }
            }

            if (cancelRef.current) { finishWithData([]); return; }

            const itemsByTitle = new Map();
            allItems.forEach(item => {
                const title = item.title || item.extra?.title || 'Unknown';
                if (!itemsByTitle.has(title)) {
                    itemsByTitle.set(title, { title, count: 0, minPrice: Infinity, maxPrice: -Infinity, totalPrice: 0, items: [] });
                }
                const g = itemsByTitle.get(title);
                const price = parseFloat(item.price?.USD || item.price?.amount || 0) / 100;
                g.count++;
                g.minPrice = Math.min(g.minPrice, price);
                g.maxPrice = Math.max(g.maxPrice, price);
                g.totalPrice += price;
                g.items.push(item);
            });

            const uniqueItems = Array.from(itemsByTitle.values());
            setItems(uniqueItems);

            const itemsToAnalyze = Math.min(uniqueItems.length, maxItems);
            setProgress({ current: 0, total: itemsToAnalyze, currentTitle: '' });

            const liquidityData = [];

            for (let i = 0; i < itemsToAnalyze; i++) {
                if (cancelRef.current) break;

                const itemGroup = uniqueItems[i];
                setProgress({ current: i + 1, total: itemsToAnalyze, currentTitle: itemGroup.title });

                try {
                    const [salesHistory, targetsData, marketData] = await Promise.all([
                        apiService.getLastSales({ gameId: 'a8db', title: itemGroup.title }),
                        apiService.getTargetsByTitle('a8db', itemGroup.title).catch(() => null),
                        apiService.getAllMarketItems({
                            gameId: 'a8db', title: itemGroup.title,
                            currency: 'USD', limit: 20,
                            treeFilters: treeFilter, orderBy: 'price', orderDir: 'asc',
                        }).catch(() => null),
                    ]);
                    let sales = salesHistory.sales || [];
                    sales = filterSalesClientSide(sales, { exteriors: selectedExteriors, selectedFloats });

                    let currentMaxTarget = 0;
                    if (targetsData?.orders?.length > 0) {
                        let orders = targetsData.orders;
                        if (selectedFloats.length > 0) {
                            orders = orders.filter(o => {
                                const fv = o.attributes?.floatPartValue;
                                if (!fv || fv === 'any') return true;
                                return selectedFloats.includes(fv);
                            });
                        } else {
                            orders = orders.filter(o => {
                                const fv = o.attributes?.floatPartValue;
                                return !fv || fv === 'any';
                            });
                        }
                        const prices = orders
                            .map(o => {
                                const raw = o.price?.amount || o.price?.USD || o.price;
                                const v = parseFloat(String(raw));
                                return Number.isFinite(v) && v > 0 ? (v >= 100 ? v / 100 : v) : 0;
                            })
                            .filter(p => p > 0);
                        if (prices.length > 0) currentMaxTarget = Math.max(...prices);
                    }

                    let currentMinOffer = itemGroup.minPrice;
                    if (marketData?.objects?.length > 0) {
                        const offerPrices = marketData.objects
                            .map(item => {
                                const raw = item.price?.USD || item.price?.amount || 0;
                                const v = parseFloat(String(raw));
                                return Number.isFinite(v) && v > 0 ? (v >= 100 ? v / 100 : v) : 0;
                            })
                            .filter(p => p > 0);
                        if (offerPrices.length > 0) currentMinOffer = Math.min(...offerPrices);
                    }

                    liquidityData.push(analyzeItem(itemGroup, sales, { currentMaxTarget, currentMinOffer }));
                } catch (error) {
                    console.error(`Error analyzing ${itemGroup.title}:`, error);
                    liquidityData.push(errorItemResult(itemGroup));
                }

                await new Promise(r => setTimeout(r, requestDelay));
            }

            finishWithData(liquidityData);

        } catch (error) {
            console.error('Error during analysis:', error);
            alert('Помилка при аналізі: ' + error.message);
        } finally {
            setIsLoading(false);
            setProgress({ current: 0, total: 0, currentTitle: '' });
        }
    };

    function finishWithData(liquidityData) {
        const filteredData = [...liquidityData];
        filteredData.sort((a, b) => b.opportunityScore - a.opportunityScore);
        setAnalysisData(filteredData);
        setSortBy('opportunity');
        if (filteredData.length > 0) setFiltersCollapsed(true);
    }

    // Sorting
    const sortedData = useMemo(() => {
        if (analysisData.length === 0) return [];
        const sorted = [...analysisData];
        switch (sortBy) {
            case 'opportunity': sorted.sort((a, b) => b.opportunityScore - a.opportunityScore); break;
            case 'profit': sorted.sort((a, b) => b.profitMargin - a.profitMargin); break;
            case 'liquidity': sorted.sort((a, b) => b.liquidityScore - a.liquidityScore); break;
            case 'risk': sorted.sort((a, b) => a.riskScore - b.riskScore); break;
            case 'spread':
                sorted.sort((a, b) => {
                    const va = a.currentSpread;
                    const vb = b.currentSpread;
                    if (va == null && vb == null) return 0;
                    if (va == null) return 1;
                    if (vb == null) return -1;
                    return vb - va;
                });
                break;
            default: sorted.sort((a, b) => b.opportunityScore - a.opportunityScore); break;
        }
        return sorted;
    }, [analysisData, sortBy]);

    return (
        <div className="liquidity-analyzer-container">
            <div className="liquidity-header">
                <div className="header-title-group">
                    <h2 className="liquidity-title">{t('liquidity.title')}</h2>
                    <div className="header-info-icon" onClick={() => setShowHeaderTooltip(!showHeaderTooltip)}>
                        <RiInformationLine />
                        {showHeaderTooltip && (
                            <>
                                <div className="tooltip-backdrop" onClick={e => { e.stopPropagation(); setShowHeaderTooltip(false); }} />
                                <div className="header-tooltip" onClick={e => e.stopPropagation()}>
                                    <div className="tooltip-title">{t('liquidity.tooltipWhat')}</div>
                                    <div className="tooltip-description">
                                        <p>Інструмент автоматично знаходить найбільш ліквідні (популярні) скіни на DMarket.</p>
                                        <p><strong>Ліквідність</strong> — показник того, наскільки швидко і часто продається предмет.</p>
                                        <p>Високоліквідні предмети: швидко продаються, мають стабільну ціну, популярні серед гравців.</p>
                                        <p><strong>{t('liquidity.feeNote')}</strong></p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <p className="liquidity-subtitle">{t('liquidity.subtitle')}</p>
            </div>

            <LiquidityFilters
                filters={filters}
                setFilters={setFilters}
                isLoading={isLoading}
                isCollapsed={filtersCollapsed}
                setIsCollapsed={setFiltersCollapsed}
                searchResults={searchResults}
                isSearching={isSearching}
                onItemSearch={handleItemSearch}
                onSelectSearchResult={handleSelectSearchResult}
                onAnalyze={handleAnalyze}
                apiService={apiService}
            />

            {isLoading && progress.total > 0 && (
                <div className="progress-container">
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
                    </div>
                    <div className="progress-text">
                        {t('liquidity.progressText').replace('{current}', progress.current).replace('{total}', progress.total)}
                    </div>
                    {progress.currentTitle && (
                        <div className="progress-info" style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                            {progress.currentTitle}
                        </div>
                    )}
                    <div className="progress-info">
                        Очікуваний час: ~{Math.ceil((progress.total * requestDelay) / 1000)} секунд
                        {progress.current > 0 && <> | Залишилось: ~{Math.ceil(((progress.total - progress.current) * requestDelay) / 1000)} сек</>}
                    </div>
                    <button
                        onClick={handleCancel}
                        className="btn btn-secondary"
                        style={{ marginTop: 12, backgroundColor: 'var(--error-color)', color: 'white', border: 'none', padding: '8px 24px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
                    >
                        <RiCloseLine style={{ marginRight: 4, verticalAlign: 'middle' }} />
                        {t('liquidity.cancel')}
                    </button>
                </div>
            )}

            {analysisData.length > 0 && (
                <div className="liquidity-results">
                    <LiquidityResultsHeader
                        sortBy={sortBy}
                        setSortBy={setSortBy}
                        sortedData={sortedData}
                        activeTooltip={activeTooltip}
                        setActiveTooltip={setActiveTooltip}
                    />
                    <div className="results-grid">
                        {sortedData.map((item, index) => (
                            <LiquidityCard key={index} item={item} index={index} />
                        ))}
                    </div>
                </div>
            )}

            {!isLoading && analysisData.length === 0 && items.length === 0 && (
                <div className="empty-state">
                    <RiSearchLine className="empty-icon" />
                    <p>{t('liquidity.emptyHint')}</p>
                    <p className="empty-subtitle">
                        Аналіз може зайняти від {Math.ceil((10 * requestDelay) / 1000)} до {Math.ceil((maxItems * requestDelay) / 1000)} секунд
                    </p>
                    <div className="tips">
                        <p className="tip-title">💡 Поради:</p>
                        <ul>
                            <li>Менша затримка = швидший аналіз, але можливі помилки API</li>
                            <li>Фільтр по ціні допоможе знайти предмети у вашому діапазоні</li>
                            <li>Рекомендовано: 100-200 предметів, 300-500мс затримка</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}

export default LiquidityAnalyzer;
