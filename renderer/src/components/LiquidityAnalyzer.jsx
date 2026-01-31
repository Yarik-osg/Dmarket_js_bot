import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { ApiService } from '../services/apiService.js';
import { RiRefreshLine, RiSearchLine, RiInformationLine } from 'react-icons/ri';
import '../styles/LiquidityAnalyzer.css';

function LiquidityAnalyzer() {
    const { client } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [selectedCategories, setSelectedCategories] = useState(() => {
        const saved = localStorage.getItem('liquidity_categories');
        return saved ? JSON.parse(saved) : [];
    });
    const [selectedQualities, setSelectedQualities] = useState(() => {
        const saved = localStorage.getItem('liquidity_qualities');
        return saved ? JSON.parse(saved) : [];
    });
    const [selectedExteriors, setSelectedExteriors] = useState(() => {
        const saved = localStorage.getItem('liquidity_exteriors');
        return saved ? JSON.parse(saved) : [];
    });
    const [selectedStatTrak, setSelectedStatTrak] = useState(() => {
        const saved = localStorage.getItem('liquidity_stattrak');
        return saved ? JSON.parse(saved) : [];
    });
    const [items, setItems] = useState([]);
    const [analysisData, setAnalysisData] = useState([]);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [sortBy, setSortBy] = useState('opportunity'); // 'liquidity', 'recentSales', 'totalSales', 'price', 'roi', 'profit', 'opportunity', 'risk'
    const [showLiquidityTooltip, setShowLiquidityTooltip] = useState(false);
    const [showOpportunityTooltip, setShowOpportunityTooltip] = useState(false);
    const [showRiskTooltip, setShowRiskTooltip] = useState(false);
    const [showHeaderTooltip, setShowHeaderTooltip] = useState(false);
    const [minROI, setMinROI] = useState(() => {
        return localStorage.getItem('liquidity_minROI') || '';
    });
    
    // Налаштування фільтрів
    const [maxItems, setMaxItems] = useState(() => {
        return parseInt(localStorage.getItem('liquidity_maxItems') || '100');
    });
    const [minPrice, setMinPrice] = useState(() => {
        return localStorage.getItem('liquidity_minPrice') || '';
    });
    const [maxPrice, setMaxPrice] = useState(() => {
        return localStorage.getItem('liquidity_maxPrice') || '';
    });
    const [floatFrom, setFloatFrom] = useState(() => {
        return localStorage.getItem('liquidity_floatFrom') || '';
    });
    const [floatTo, setFloatTo] = useState(() => {
        return localStorage.getItem('liquidity_floatTo') || '';
    });
    const [requestDelay, setRequestDelay] = useState(() => {
        return parseInt(localStorage.getItem('liquidity_delay') || '300');
    });
    
    // Пошук по назві предмету (як в TargetForm)
    const [itemSearch, setItemSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeoutRef = useRef(null);
    
    // Зберігаємо налаштування при зміні
    React.useEffect(() => {
        localStorage.setItem('liquidity_categories', JSON.stringify(selectedCategories));
    }, [selectedCategories]);
    
    React.useEffect(() => {
        localStorage.setItem('liquidity_qualities', JSON.stringify(selectedQualities));
    }, [selectedQualities]);
    
    React.useEffect(() => {
        localStorage.setItem('liquidity_exteriors', JSON.stringify(selectedExteriors));
    }, [selectedExteriors]);
    
    React.useEffect(() => {
        localStorage.setItem('liquidity_stattrak', JSON.stringify(selectedStatTrak));
    }, [selectedStatTrak]);
    
    React.useEffect(() => {
        localStorage.setItem('liquidity_maxItems', maxItems.toString());
    }, [maxItems]);
    
    React.useEffect(() => {
        localStorage.setItem('liquidity_minPrice', minPrice);
    }, [minPrice]);
    
    React.useEffect(() => {
        localStorage.setItem('liquidity_maxPrice', maxPrice);
    }, [maxPrice]);
    
    React.useEffect(() => {
        localStorage.setItem('liquidity_floatFrom', floatFrom);
    }, [floatFrom]);
    
    React.useEffect(() => {
        localStorage.setItem('liquidity_floatTo', floatTo);
    }, [floatTo]);
    
    React.useEffect(() => {
        localStorage.setItem('liquidity_delay', requestDelay.toString());
    }, [requestDelay]);
    
    React.useEffect(() => {
        localStorage.setItem('liquidity_minROI', minROI);
    }, [minROI]);
    
    const handleCategoryToggle = (value) => {
        setSelectedCategories(prev => 
            prev.includes(value) 
                ? prev.filter(v => v !== value)
                : [...prev, value]
        );
    };
    
    const handleQualityToggle = (value) => {
        setSelectedQualities(prev => 
            prev.includes(value) 
                ? prev.filter(v => v !== value)
                : [...prev, value]
        );
    };
    
    const handleExteriorToggle = (value) => {
        setSelectedExteriors(prev => 
            prev.includes(value) 
                ? prev.filter(v => v !== value)
                : [...prev, value]
        );
    };
    
    const handleStatTrakToggle = (value) => {
        setSelectedStatTrak(prev => 
            prev.includes(value) 
                ? prev.filter(v => v !== value)
                : [...prev, value]
        );
    };
    
    // Функція пошуку предмету з debounce
    const handleItemSearch = (query) => {
        // Скасовуємо попередній таймер
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        
        if (!client || !query.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        
        setIsSearching(true);
        
        // Встановлюємо новий таймер (500мс затримка)
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const apiService = new ApiService(client);
                const results = await apiService.getAllMarketItems({
                    gameId: 'a8db',
                    currency: 'USD',
                    title: query,
                    limit: 50 // Завантажуємо більше для групування
                });
                
                if (results && results.objects) {
                    // Групуємо за назвою щоб видалити дублікати
                    const uniqueItems = new Map();
                    results.objects.forEach(item => {
                        const title = item.title || item.extra?.title || '';
                        if (!uniqueItems.has(title)) {
                            uniqueItems.set(title, item);
                        } else {
                            // Якщо вже є такий предмет, зберігаємо той що дешевший
                            const existing = uniqueItems.get(title);
                            const existingPrice = parseFloat(existing.price?.USD || existing.price?.amount || 0);
                            const currentPrice = parseFloat(item.price?.USD || item.price?.amount || 0);
                            if (currentPrice < existingPrice) {
                                uniqueItems.set(title, item);
                            }
                        }
                    });
                    
                    // Конвертуємо в масив і обмежуємо до 10 результатів
                    const uniqueArray = Array.from(uniqueItems.values()).slice(0, 10);
                    setSearchResults(uniqueArray);
                }
            } catch (error) {
                console.error('Search error:', error);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 500);
    };
    
    const handleSelectSearchResult = (item) => {
        const title = item.title || item.extra?.title || '';
        setItemSearch(title);
        setSearchResults([]);
    };
    
    // Очищуємо таймер при розмонтуванні компонента
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);
    
    // Закриваємо dropdown при кліку поза ним
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!event.target.closest('.search-input-wrapper')) {
                setSearchResults([]);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const categoryOptions = [
        { value: 'rifle', label: 'Rifle (Гвинтівки)' },
        { value: 'smg', label: 'SMG (Пістолети-кулемети)' },
        { value: 'pistol', label: 'Pistol (Пістолети)' },
        { value: 'sniper', label: 'Sniper Rifle (Снайперські)' },
        { value: 'knife', label: 'Knife (Ножі)' },
        { value: 'gloves', label: 'Gloves (Рукавички)' }
    ];
    
    const qualityOptions = [
        { value: 'covert', label: 'Covert (Таємне)' },
        { value: 'classified', label: 'Classified (Засекречене)' },
        { value: 'restricted', label: 'Restricted (Обмежений)' },
        { value: 'industrial grade', label: 'Industrial Grade' }
    ];
    
    const exteriorOptions = [
        { value: 'factory-new', label: 'Factory New' },
        { value: 'minimal-wear', label: 'Minimal Wear' },
        { value: 'field-tested', label: 'Field-Tested' },
        { value: 'well-worn', label: 'Well-Worn' },
        { value: 'battle-scarred', label: 'Battle-Scarred' }
    ];
    
    const statTrakOptions = [
        { value: 'stattrak_tm', label: 'StatTrak™' },
        { value: 'not_stattrak_tm', label: 'Not StatTrak™' }
    ];
    
    const apiService = useMemo(() => {
        return client ? new ApiService(client) : null;
    }, [client]);
    
    const handleAnalyze = async () => {
        if (!apiService) return;
        
        setIsLoading(true);
        setItems([]);
        setAnalysisData([]);
        setProgress({ current: 0, total: 0 });
        
        try {
            // Крок 1: Отримати список предметів з обраними фільтрами
            console.log('Fetching items with categories:', selectedCategories, 'qualities:', selectedQualities, 'exteriors:', selectedExteriors, 'statTrak:', selectedStatTrak, 'float:', { from: floatFrom, to: floatTo });
            
            // Об'єднуємо фільтри
            const filters = [];
            
            // Додаємо категорії
            selectedCategories.forEach(cat => {
                const value = cat === 'sniper' ? 'sniper rifle' : cat;
                filters.push(`categoryPath[]=${value}`);
            });
            
            // Додаємо якості
            selectedQualities.forEach(quality => {
                filters.push(`quality[]=${quality}`);
            });
            
            // Додаємо стани
            selectedExteriors.forEach(ext => {
                const value = ext === 'factory-new' ? 'factory new' : 
                             ext === 'minimal-wear' ? 'minimal wear' : ext;
                filters.push(`exterior[]=${value}`);
            });
            
            // Додаємо StatTrak
            selectedStatTrak.forEach(stat => {
                filters.push(`category_0[]=${stat}`);
            });
            
            // Додаємо Float Value якщо вказано
            if (floatFrom && parseFloat(floatFrom) >= 0) {
                filters.push(`floatValueFrom[]=${parseFloat(floatFrom)}`);
            }
            if (floatTo && parseFloat(floatTo) <= 1) {
                filters.push(`floatValueTo[]=${parseFloat(floatTo)}`);
            }
            
            const treeFilter = filters.join(',');
            
            let allItems = [];
            let cursor = null;
            const limit = 100;
            let hasMore = true;
            const maxItemsToFetch = maxItems * 5; // Завантажуємо більше для фільтрації
            let pageCount = 0;
            const maxPages = 300; // Безпечне обмеження на 300 сторінок = ~30000 предметів
            
            // Отримуємо всі предмети з пагінацією через cursor
            while (hasMore && allItems.length < maxItemsToFetch && pageCount < maxPages) {
                // Конвертуємо ціни в центи для API
                const priceFromCents = minPrice ? Math.round(parseFloat(minPrice) * 100) : 0;
                const priceToCents = maxPrice ? Math.round(parseFloat(maxPrice) * 100) : 0;
                
                const requestParams = {
                    gameId: 'a8db',
                    currency: 'USD',
                    limit: limit,
                    treeFilters: treeFilter,
                    orderBy: 'price',
                    orderDir: 'asc' // ASC = від дешевших до дорожчих!
                };
                
                // Додаємо пошук по назві якщо вказано
                if (itemSearch.trim()) {
                    requestParams.title = itemSearch.trim();
                }
                
                // Додаємо cursor якщо він є (не на першій сторінці)
                if (cursor) {
                    requestParams.cursor = cursor;
                }
                
                // Додаємо фільтри ціни якщо вони вказані
                if (priceFromCents > 0) {
                    requestParams.priceFrom = priceFromCents;
                }
                if (priceToCents > 0) {
                    requestParams.priceTo = priceToCents;
                }
                
                console.log('Fetching with params:', requestParams);
                
                const response = await apiService.getAllMarketItems(requestParams);
                pageCount++;
                
                if (response.objects && response.objects.length > 0) {
                    allItems = allItems.concat(response.objects);
                    
                    // Перевіряємо чи є наступна сторінка
                    if (response.cursor && response.cursor !== cursor) {
                        cursor = response.cursor;
                    } else {
                        // Немає більше сторінок
                        hasMore = false;
                    }
                    
                    // Якщо отримали менше предметів ніж limit, можливо це остання сторінка
                    if (response.objects.length < limit) {
                        hasMore = false;
                    }
                } else {
                    hasMore = false;
                }
                
                console.log(`Fetched ${allItems.length} items so far... (page ${pageCount}/${maxPages})`);
            }
            
            console.log(`Total items fetched: ${allItems.length} (${pageCount} pages)`);
            
            // Якщо досягли ліміту сторінок
            if (pageCount >= maxPages) {
                console.warn(`⚠️ Досягнуто ліміт сторінок (${maxPages}). Завантажено ${allItems.length} предметів.`);
            }
            
            // Тепер фільтрація вже виконана на стороні API, тому просто групуємо
            // Групуємо предмети за title (унікальні назви)
            const itemsByTitle = new Map();
            allItems.forEach(item => {
                const title = item.title || item.extra?.title || 'Unknown';
                if (!itemsByTitle.has(title)) {
                    itemsByTitle.set(title, {
                        title: title,
                        count: 0,
                        minPrice: Infinity,
                        maxPrice: -Infinity,
                        totalPrice: 0,
                        items: []
                    });
                }
                
                const group = itemsByTitle.get(title);
                const price = parseFloat(item.price?.USD || item.price?.amount || 0) / 100;
                
                group.count++;
                group.minPrice = Math.min(group.minPrice, price);
                group.maxPrice = Math.max(group.maxPrice, price);
                group.totalPrice += price;
                group.items.push(item);
            });
            
            // Конвертуємо в масив
            const uniqueItems = Array.from(itemsByTitle.values());
            console.log(`Unique items: ${uniqueItems.length}`);
            
            setItems(uniqueItems);
            
            const itemsToAnalyze = Math.min(uniqueItems.length, maxItems);
            setProgress({ current: 0, total: itemsToAnalyze });
            
            // ============ HELPER ФУНКЦІЇ (ВИНЕСЕНІ ПЕРЕД ЦИКЛОМ) ============
            
            // Функція для обчислення медіани
            const calculateMedian = (numbers) => {
                if (numbers.length === 0) return 0;
                const sorted = [...numbers].sort((a, b) => a - b);
                const mid = Math.floor(sorted.length / 2);
                return sorted.length % 2 === 0 
                    ? (sorted[mid - 1] + sorted[mid]) / 2 
                    : sorted[mid];
            };
            
            // Функція для детекції outliers (використовуємо IQR метод)
            const detectOutliers = (prices) => {
                if (prices.length < 4) return { cleanPrices: prices, outliers: [] };
                
                const sorted = [...prices].sort((a, b) => a - b);
                const q1Index = Math.floor(sorted.length * 0.25);
                const q3Index = Math.floor(sorted.length * 0.75);
                const q1 = sorted[q1Index];
                const q3 = sorted[q3Index];
                const iqr = q3 - q1;
                const lowerBound = q1 - 1.5 * iqr;
                const upperBound = q3 + 1.5 * iqr;
                
                const cleanPrices = prices.filter(p => p >= lowerBound && p <= upperBound);
                const outliers = prices.filter(p => p < lowerBound || p > upperBound);
                
                return { cleanPrices, outliers };
            };
            
            // Функція для детекції price spike
            const detectPriceSpike = (prices, dates) => {
                if (prices.length < 5) return { hasSpike: false, spikePercent: 0 };
                
                const median = calculateMedian(prices);
                let maxDeviation = 0;
                
                prices.forEach(price => {
                    const deviation = ((price - median) / median) * 100;
                    if (Math.abs(deviation) > Math.abs(maxDeviation)) {
                        maxDeviation = deviation;
                    }
                });
                
                // Якщо є ціна що відрізняється від медіани більш ніж на 50% - це spike
                const hasSpike = Math.abs(maxDeviation) > 50;
                
                return { hasSpike, spikePercent: maxDeviation };
            };
            
            // Функція для аналізу стабільності цін
            const analyzePriceStability = (recentPrices, olderPrices) => {
                if (recentPrices.length < 3 || olderPrices.length < 3) {
                    return { isStabilizing: false, stabilityScore: 0, olderCV: 0, recentCV: 0 };
                }
                
                // Обчислюємо коефіцієнт варіації (CV) для старих та нових цін
                const calculateCV = (prices) => {
                    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
                    const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
                    const stdDev = Math.sqrt(variance);
                    return (stdDev / mean) * 100;
                };
                
                const olderCV = calculateCV(olderPrices);
                const recentCV = calculateCV(recentPrices);
                
                // Якщо нова волатильність менша за стару - ціна стабілізується
                const isStabilizing = recentCV < olderCV;
                const stabilityScore = Math.max(0, 100 - recentCV); // 0-100, де 100 = дуже стабільно
                
                return { isStabilizing, stabilityScore, olderCV, recentCV };
            };
            
            // Крок 2: Аналізуємо ліквідність кожного предмета
            const liquidityData = [];
            
            for (let i = 0; i < itemsToAnalyze; i++) {
                const item = uniqueItems[i];
                setProgress({ current: i + 1, total: itemsToAnalyze });
                
                try {
                    // Отримуємо історію продажів (до 500 останніх)
                    const salesParams = {
                        gameId: 'a8db',
                        title: item.title
                    };
                    
                    const salesHistory = await apiService.getLastSales(salesParams);
                    
                    let sales = salesHistory.sales || [];
                    
                    // Фільтруємо продажі на клієнті за exterior та float
                    if (selectedExteriors.length > 0 || floatFrom || floatTo) {
                        const originalCount = sales.length;
                        
                        sales = sales.filter(sale => {
                            const attributes = sale.offerAttributes || sale.orderAttributes || {};
                            
                            // Фільтр по exterior
                            if (selectedExteriors.length > 0) {
                                const exterior = attributes.exterior || '';
                                const normalizedExterior = exterior.toLowerCase().replace(/\s+/g, '-');
                                
                                const matchesExterior = selectedExteriors.some(ext => {
                                    const normalized = ext.toLowerCase();
                                    return normalizedExterior.includes(normalized) || normalized.includes(normalizedExterior);
                                });
                                
                                if (!matchesExterior) return false;
                            }
                            
                            // Фільтр по float
                            if (floatFrom || floatTo) {
                                const floatValue = attributes.floatValue || attributes.float;
                                
                                if (floatValue !== undefined) {
                                    const float = parseFloat(floatValue);
                                    const minFloat = floatFrom ? parseFloat(floatFrom) : 0;
                                    const maxFloat = floatTo ? parseFloat(floatTo) : 1;
                                    
                                    if (float < minFloat || float > maxFloat) return false;
                                }
                            }
                            
                            return true;
                        });
                        
                        if (originalCount !== sales.length) {
                            console.log(`Client-side filtered: ${originalCount} -> ${sales.length} sales for "${item.title}"`);
                        }
                    }
                    
                    // ============ АНАЛІЗ ПО ТИПАХ ТРАНЗАКЦІЙ ============
                    
                    // Розділяємо продажі по типах
                    const offerSales = sales.filter(sale => sale.txOperationType === 'Offer');
                    const targetSales = sales.filter(sale => sale.txOperationType === 'Target');
                    
                    // Обчислюємо статистику по типах
                    const offerCount = offerSales.length;
                    const targetCount = targetSales.length;
                    const totalCount = sales.length;
                    
                    // Співвідношення типів (показує поведінку ринку)
                    const offerRatio = totalCount > 0 ? (offerCount / totalCount) * 100 : 0;
                    const targetRatio = totalCount > 0 ? (targetCount / totalCount) * 100 : 0;
                    
                    // Обчислюємо середні ціни по типах
                    const offerAvgPrice = offerCount > 0 
                        ? offerSales.reduce((sum, s) => sum + parseFloat(s.price || 0), 0) / offerCount 
                        : 0;
                    const targetAvgPrice = targetCount > 0 
                        ? targetSales.reduce((sum, s) => sum + parseFloat(s.price || 0), 0) / targetCount 
                        : 0;
                    
                    // Обчислюємо медіану по типах для точнішого аналізу
                    const offerMedianPrice = offerCount > 0 
                        ? calculateMedian(offerSales.map(s => parseFloat(s.price || 0)))
                        : 0;
                    const targetMedianPrice = targetCount > 0 
                        ? calculateMedian(targetSales.map(s => parseFloat(s.price || 0)))
                        : 0;
                    
                    // Обчислюємо мін/макс ціни по типах
                    const offerPrices = offerSales.map(s => parseFloat(s.price || 0));
                    const targetPrices = targetSales.map(s => parseFloat(s.price || 0));
                    
                    const minOfferPrice = offerPrices.length > 0 ? Math.min(...offerPrices) : 0;
                    const maxOfferPrice = offerPrices.length > 0 ? Math.max(...offerPrices) : 0;
                    const minTargetPrice = targetPrices.length > 0 ? Math.min(...targetPrices) : 0;
                    const maxTargetPrice = targetPrices.length > 0 ? Math.max(...targetPrices) : 0;
                    
                    // Обчислюємо спред між типами (різниця в цінах)
                    let priceSpread = 0;
                    let priceSpreadPercent = 0;
                    if (offerMedianPrice > 0 && targetMedianPrice > 0) {
                        priceSpread = offerMedianPrice - targetMedianPrice;
                        priceSpreadPercent = (priceSpread / offerMedianPrice) * 100;
                    }
                    
                    // Визначаємо домінуючий тип транзакцій
                    let txDominance = 'balanced';
                    if (offerRatio > 70) {
                        txDominance = 'offer-heavy'; // Багато ручних покупок - покупці готові платити
                    } else if (targetRatio > 70) {
                        txDominance = 'target-heavy'; // Багато автопродажів - продавці поспішають
                    }
                    
                    // ============ ОБЧИСЛЕННЯ МЕТРИК ============
                    
                    // Обчислюємо метрики ліквідності
                    const salesCount = sales.length;
                    const avgPrice = item.totalPrice / item.count;
                    
                    // Фільтруємо продажі за останні 30 днів (актуальні ціни)
                    const now = Date.now();
                    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
                    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
                    
                    const recentMonthSales = sales.filter(sale => {
                        const saleDate = parseInt(sale.date) * 1000;
                        return saleDate >= thirtyDaysAgo;
                    });
                    
                    const recentWeekSales = sales.filter(sale => {
                        const saleDate = parseInt(sale.date) * 1000;
                        return saleDate >= sevenDaysAgo;
                    });
                    
                    // Використовуємо тільки продажі за останній місяць для розрахунків
                    const relevantSales = recentMonthSales.length > 0 ? recentMonthSales : sales;
                    
                    // Отримуємо всі ціни та дати
                    const allPrices = relevantSales.map(s => parseFloat(s.price || 0));
                    const allDates = relevantSales.map(s => parseInt(s.date));
                    
                    // Детекція outliers та price spike
                    const { cleanPrices, outliers } = detectOutliers(allPrices);
                    const { hasSpike, spikePercent } = detectPriceSpike(allPrices, allDates);
                    
                    // Використовуємо МЕДІАНУ замість середнього для усунення викривлень
                    let medianSalePrice = calculateMedian(cleanPrices);
                    let avgSalePrice = medianSalePrice; // Використовуємо медіану як базову ціну
                    
                    // Також обчислюємо середнє арифметичне для порівняння
                    const arithmeticAvg = cleanPrices.length > 0 
                        ? cleanPrices.reduce((sum, price) => sum + price, 0) / cleanPrices.length 
                        : 0;
                    
                    // Обчислюємо частоту продажів і актуальність (тільки за останній місяць)
                    let salesFrequency = 0;
                    let daysSinceLastSale = 999;
                    let lastSaleDate = 0;
                    if (relevantSales.length > 0) {
                        const sortedSales = [...relevantSales].sort((a, b) => parseInt(a.date) - parseInt(b.date));
                        const firstSaleDate = parseInt(sortedSales[0].date) * 1000;
                        lastSaleDate = parseInt(sortedSales[sortedSales.length - 1].date) * 1000;
                        const timeSpanMs = lastSaleDate - firstSaleDate;
                        const timeSpanDays = timeSpanMs / (24 * 60 * 60 * 1000);
                        
                        // Частота продажів (продажів на день за останній місяць)
                        salesFrequency = timeSpanDays > 0 ? relevantSales.length / timeSpanDays : relevantSales.length;
                        
                        // Скільки днів пройшло з останнього продажу
                        daysSinceLastSale = (now - lastSaleDate) / (24 * 60 * 60 * 1000);
                    }
                    
                    // Покращена формула ліквідності (більша вага для нещодавніх продажів)
                    // Збільшуємо вагу продажів за тиждень x3 (було x10, тепер x15)
                    let baseScore = (recentWeekSales.length * 15) + (relevantSales.length * 2) + (item.count > 0 ? 5 : 0);
                    
                    // Бонус за високу частоту (більше 10 продажів/день = +50 балів)
                    const frequencyBonus = Math.min(salesFrequency * 5, 50);
                    
                    // Штраф якщо останній продаж був давно (якщо більше 7 днів - зменшуємо score)
                    const recencyPenalty = daysSinceLastSale > 7 ? Math.min(daysSinceLastSale * 2, 100) : 0;
                    
                    const liquidityScore = Math.max(0, Math.round(baseScore + frequencyBonus - recencyPenalty));
                    
                    // ====== НОВІ МЕТРИКИ ДЛЯ ПРИБУТКОВОСТІ ======
                    
                    // 1. Profit Margin - різниця між медіаною ціни продажу і мінімальною ціною покупки
                    const profitMargin = avgSalePrice > 0 ? avgSalePrice - item.minPrice : 0;
                    
                    // 2. ROI % - рентабельність інвестицій (на основі медіани)
                    const roiPercent = item.minPrice > 0 && avgSalePrice > 0 
                        ? ((avgSalePrice - item.minPrice) / item.minPrice) * 100 
                        : 0;
                    
                    // 3. Price Volatility - волатильність цін (використовуємо очищені ціни)
                    let priceVolatility = 0;
                    let avgPriceVariance = 0;
                    let maxSalePrice = 0;
                    let minSalePrice = 0;
                    if (cleanPrices.length > 0) {
                        minSalePrice = Math.min(...cleanPrices);
                        maxSalePrice = Math.max(...cleanPrices);
                        priceVolatility = maxSalePrice > 0 ? ((maxSalePrice - minSalePrice) / medianSalePrice) * 100 : 0;
                        
                        // Середнє відхилення від медіани
                        const variance = cleanPrices.reduce((sum, price) => sum + Math.abs(price - medianSalePrice), 0) / cleanPrices.length;
                        avgPriceVariance = (variance / medianSalePrice) * 100;
                    }
                    
                    // Аналіз стабільності цін (порівняння недавніх і старих цін)
                    const sortedByDate = [...relevantSales]
                        .filter(s => cleanPrices.includes(parseFloat(s.price)))
                        .sort((a, b) => parseInt(a.date) - parseInt(b.date));
                    
                    const midPoint = Math.floor(sortedByDate.length / 2);
                    const olderSalesPrices = sortedByDate.slice(0, midPoint).map(s => parseFloat(s.price));
                    const recentSalesPrices = sortedByDate.slice(midPoint).map(s => parseFloat(s.price));
                    
                    const { isStabilizing, stabilityScore, olderCV, recentCV } = analyzePriceStability(
                        recentSalesPrices, 
                        olderSalesPrices
                    );
                    
                    // 4. Risk Score - оцінка ризику (0-100, де 0 = низький ризик, 100 = високий ризик)
                    let riskScore = 0;
                    
                    // ПІДВИЩЕНА ВАГА для волатильності (до +50 балів замість 40)
                    // Екстремальна волатильність (>50%) = КРИТИЧНИЙ ризик
                    let volatilityRisk = 0;
                    if (priceVolatility > 100) {
                        volatilityRisk = 50; // Максимальний ризик
                    } else if (priceVolatility > 50) {
                        volatilityRisk = 35 + ((priceVolatility - 50) / 50) * 15; // 35-50 балів
                    } else {
                        volatilityRisk = (priceVolatility / 50) * 35; // 0-35 балів
                    }
                    
                    // Ризик через низьку ліквідність (до +25 балів)
                    const liquidityRisk = salesFrequency < 1 ? 25 : Math.max(0, 25 - (salesFrequency * 2.5));
                    
                    // Ризик через високу конкуренцію на ринку (до +15 балів)
                    const competitionRisk = item.count > 50 ? 15 : item.count > 20 ? 10 : item.count > 10 ? 5 : 0;
                    
                    // Ризик через застарілість продажів (до +10 балів)
                    const recencyRisk = daysSinceLastSale > 14 ? 10 : daysSinceLastSale > 7 ? 5 : 0;
                    
                    // БОНУС: Зниження ризику якщо ціна стабілізується після скачка
                    let stabilizationBonus = 0;
                    if (isStabilizing && hasSpike) {
                        stabilizationBonus = -10; // Знижуємо ризик на 10 балів
                    }
                    
                    // ШТРАФ: Збільшення ризику якщо виявлено price spike
                    let spikeRisk = 0;
                    if (hasSpike) {
                        spikeRisk = Math.min(Math.abs(spikePercent) / 5, 15); // До +15 балів
                    }
                    
                    riskScore = Math.min(100, Math.max(0, 
                        volatilityRisk + liquidityRisk + competitionRisk + recencyRisk + spikeRisk + stabilizationBonus
                    ));
                    
                    // 5. Price Trend - тренд цін (ПІДВИЩЕНА ВАГА для останніх 7 днів)
                    let priceTrend = 0; // -100 (падіння) до +100 (зростання)
                    let recentTrend = 0; // Окремий тренд для останнього тижня
                    
                    if (relevantSales.length >= 6) {
                        const sortedSales = [...relevantSales].sort((a, b) => parseInt(a.date) - parseInt(b.date));
                        
                        // Загальний тренд (місяць)
                        const recentSalesData = sortedSales.slice(-Math.min(5, sortedSales.length));
                        const olderSalesData = sortedSales.slice(0, Math.min(5, Math.max(1, sortedSales.length - 5)));
                        
                        if (olderSalesData.length > 0) {
                            const recentAvg = recentSalesData.reduce((sum, s) => sum + parseFloat(s.price || 0), 0) / recentSalesData.length;
                            const olderAvg = olderSalesData.reduce((sum, s) => sum + parseFloat(s.price || 0), 0) / olderSalesData.length;
                            
                            if (olderAvg > 0) {
                                priceTrend = ((recentAvg - olderAvg) / olderAvg) * 100;
                            }
                        }
                        
                        // НОВИЙ: Тренд для останнього тижня (більша вага)
                        if (recentWeekSales.length >= 3) {
                            const weekSorted = [...recentWeekSales].sort((a, b) => parseInt(a.date) - parseInt(b.date));
                            const lastThird = Math.max(1, Math.floor(weekSorted.length / 3));
                            
                            const lastPrices = weekSorted.slice(-lastThird).map(s => parseFloat(s.price || 0));
                            const firstPrices = weekSorted.slice(0, lastThird).map(s => parseFloat(s.price || 0));
                            
                            const lastAvg = lastPrices.reduce((a, b) => a + b, 0) / lastPrices.length;
                            const firstAvg = firstPrices.reduce((a, b) => a + b, 0) / firstPrices.length;
                            
                            if (firstAvg > 0) {
                                recentTrend = ((lastAvg - firstAvg) / firstAvg) * 100;
                            }
                        }
                    }
                    
                    // 6. Competition Level - рівень конкуренції
                    const competitionLevel = item.count > 100 ? 'Дуже висока' : 
                                           item.count > 50 ? 'Висока' : 
                                           item.count > 20 ? 'Середня' : 
                                           item.count > 10 ? 'Низька' : 'Дуже низька';
                    
                    // 7. Opportunity Score - загальна оцінка можливості (0-100)
                    let opportunityScore = 0;
                    
                    // Базовий score від ROI (до 40 балів)
                    const roiComponent = Math.min(roiPercent * 2, 40);
                    
                    // Компонент ліквідності (нормалізуємо до 30 балів)
                    const liquidityComponent = Math.min((liquidityScore / 200) * 30, 30);
                    
                    // Компонент низького ризику (до 30 балів)
                    const riskComponent = Math.max(0, 30 - (riskScore * 0.3));
                    
                    opportunityScore = roiComponent + liquidityComponent + riskComponent;
                    
                    // КРИТИЧНІ ШТРАФИ для поганих сигналів:
                    
                    // 1. Екстремальна волатильність (>50%) = -30 балів
                    if (priceVolatility > 50) {
                        opportunityScore -= 30;
                    }
                    
                    // 2. Падіння цін більше ніж на 10% (місячний тренд) = -20 балів
                    if (priceTrend < -10) {
                        opportunityScore -= 20;
                    }
                    
                    // 3. Падіння цін за тиждень більше ніж на 5% = -25 балів (НАЙВАЖЛИВІШЕ!)
                    if (recentTrend < -5) {
                        opportunityScore -= 25;
                    }
                    
                    // 4. Price spike виявлено = -15 балів
                    if (hasSpike) {
                        opportunityScore -= 15;
                    }
                    
                    // 5. Ціна нормалізується після скачка + падає = КРИТИЧНО ПОГАНО
                    if (isStabilizing && hasSpike && priceTrend < 0) {
                        opportunityScore -= 20;
                    }
                    
                    // БОНУСИ для хороших сигналів:
                    
                    // 1. Висока стабільність (>70) + зростання = +10 балів
                    if (stabilityScore > 70 && priceTrend > 5) {
                        opportunityScore += 10;
                    }
                    
                    // 2. Недавні продажі (останній продаж < 24 години) = +5 балів
                    if (daysSinceLastSale < 1) {
                        opportunityScore += 5;
                    }
                    
                    opportunityScore = Math.round(Math.max(0, Math.min(100, opportunityScore)));
                    
                    
                    // Діагностичний лог для розуміння розрахунків
                    if (i < 3) { // Показуємо детально тільки перші 3 айтеми
                        console.log(`\n=== Аналіз: ${item.title} ===`);
                        console.log(`📊 Продажі: ${relevantSales.length} (тиждень: ${recentWeekSales.length})`);
                        console.log(`💰 Ціни: Медіана=$${medianSalePrice.toFixed(2)} | Середнє=$${arithmeticAvg.toFixed(2)}`);
                        console.log(`🔍 Outliers: ${outliers.length} з ${allPrices.length} цін`);
                        console.log(`📈 Волатильність: ${priceVolatility.toFixed(1)}%`);
                        console.log(`⚠️ Price Spike: ${hasSpike ? `ТАК (${spikePercent.toFixed(1)}%)` : 'НІ'}`);
                        console.log(`⚖️ Стабілізація: ${isStabilizing ? `ТАК (score: ${stabilityScore.toFixed(0)})` : 'НІ'}`);
                        console.log(`📉 Тренд: Місяць=${priceTrend.toFixed(1)}% | Тиждень=${recentTrend.toFixed(1)}%`);
                        console.log(`🎯 Opportunity: ${opportunityScore} | Risk: ${riskScore.toFixed(0)} | ROI: ${roiPercent.toFixed(1)}%`);
                        console.log(`⚠️ Warnings: Volatility=${priceVolatility > 50} | Trend=${priceTrend < -5 || recentTrend < -5}`);
                        // Нова аналітика по типах
                        console.log(`\n💼 Типи транзакцій (історія):`);
                        console.log(`   Offer (ручні): ${offerCount} (${offerRatio.toFixed(1)}%) | Медіана: $${offerMedianPrice.toFixed(2)}`);
                        console.log(`   Target (авто): ${targetCount} (${targetRatio.toFixed(1)}%) | Медіана: $${targetMedianPrice.toFixed(2)}`);
                        if (maxTargetPrice > 0) {
                            console.log(`   Target MAX (історія): $${maxTargetPrice.toFixed(2)}`);
                        }
                        if (priceSpread > 0) {
                            console.log(`   📊 Спред: $${priceSpread.toFixed(2)} (${priceSpreadPercent.toFixed(1)}%)`);
                            console.log(`   🎭 Домінанс: ${txDominance}`);
                        }
                    }
                    
                    liquidityData.push({
                        title: item.title,
                        marketCount: item.count,
                        minPrice: item.minPrice,
                        maxPrice: item.maxPrice,
                        avgMarketPrice: avgPrice,
                        avgSalePrice: avgSalePrice, // Медіана
                        medianSalePrice: medianSalePrice,
                        arithmeticAvgPrice: arithmeticAvg,
                        salesCount: relevantSales.length, // Тільки актуальні продажі
                        recentSalesCount: recentWeekSales.length,
                        salesFrequency: salesFrequency,
                        daysSinceLastSale: daysSinceLastSale,
                        liquidityScore: liquidityScore,
                        // Нові метрики
                        profitMargin: profitMargin,
                        roiPercent: roiPercent,
                        priceVolatility: priceVolatility,
                        avgPriceVariance: avgPriceVariance,
                        riskScore: riskScore,
                        priceTrend: priceTrend,
                        recentTrend: recentTrend, // НОВИЙ: тренд за тиждень
                        competitionLevel: competitionLevel,
                        opportunityScore: opportunityScore,
                        maxSalePrice: maxSalePrice,
                        // НОВІ поля для діагностики
                        hasSpike: hasSpike,
                        spikePercent: spikePercent,
                        isStabilizing: isStabilizing,
                        stabilityScore: stabilityScore,
                        outliersCount: outliers.length,
                        cleanPricesCount: cleanPrices.length,
                        volatilityWarning: priceVolatility > 50,
                        trendWarning: priceTrend < -5 || recentTrend < -5,
                        // Аналітика по типах транзакцій
                        offerCount: offerCount,
                        targetCount: targetCount,
                        offerRatio: offerRatio,
                        targetRatio: targetRatio,
                        offerAvgPrice: offerAvgPrice,
                        targetAvgPrice: targetAvgPrice,
                        offerMedianPrice: offerMedianPrice,
                        targetMedianPrice: targetMedianPrice,
                        minOfferPrice: minOfferPrice,
                        maxOfferPrice: maxOfferPrice,
                        minTargetPrice: minTargetPrice,
                        maxTargetPrice: maxTargetPrice,
                        priceSpread: priceSpread,
                        priceSpreadPercent: priceSpreadPercent,
                        txDominance: txDominance,
                    });
                    
                    console.log(`Analyzed ${i + 1}/${itemsToAnalyze}: ${item.title}`);
                    
                    // Додаємо налаштовувану затримку між запитами
                    await new Promise(resolve => setTimeout(resolve, requestDelay));
                    
                } catch (error) {
                    console.error(`Error analyzing ${item.title}:`, error);
                    // Додаємо з базовими даними навіть якщо не вдалося отримати історію
                    liquidityData.push({
                        title: item.title,
                        marketCount: item.count,
                        minPrice: item.minPrice,
                        maxPrice: item.maxPrice,
                        avgMarketPrice: item.totalPrice / item.count,
                        avgSalePrice: 0,
                        medianSalePrice: 0,
                        arithmeticAvgPrice: 0,
                        salesCount: 0,
                        recentSalesCount: 0,
                        salesFrequency: 0,
                        daysSinceLastSale: 999,
                        liquidityScore: item.count > 0 ? 5 : 0,
                        profitMargin: 0,
                        roiPercent: 0,
                        priceVolatility: 0,
                        avgPriceVariance: 0,
                        riskScore: 100, // Максимальний ризик якщо немає даних
                        priceTrend: 0,
                        recentTrend: 0,
                        competitionLevel: 'Невідомо',
                        opportunityScore: 0,
                        maxSalePrice: 0,
                        // Додаткові поля
                        hasSpike: false,
                        spikePercent: 0,
                        isStabilizing: false,
                        stabilityScore: 0,
                        outliersCount: 0,
                        cleanPricesCount: 0,
                        volatilityWarning: false,
                        trendWarning: false,
                        error: true
                    });
                }
            }
            
            // Фільтруємо за мінімальним ROI якщо вказано
            let filteredData = liquidityData;
            if (minROI && parseFloat(minROI) > 0) {
                const minROIValue = parseFloat(minROI);
                filteredData = liquidityData.filter(item => item.roiPercent >= minROIValue);
                console.log(`Filtered by ROI >= ${minROIValue}%: ${liquidityData.length} -> ${filteredData.length} items`);
            }
            
            // Сортуємо за Opportunity Score за замовчуванням
            filteredData.sort((a, b) => b.opportunityScore - a.opportunityScore);
            
            setAnalysisData(filteredData);
            setSortBy('opportunity'); // Встановлюємо сортування за замовчуванням
            console.log('Analysis complete:', filteredData);
            
        } catch (error) {
            console.error('Error during analysis:', error);
            alert('Помилка при аналізі: ' + error.message);
        } finally {
            setIsLoading(false);
            setProgress({ current: 0, total: 0 });
        }
    };
    
    // Сортування даних
    const sortedData = useMemo(() => {
        if (analysisData.length === 0) return [];
        
        const sorted = [...analysisData];
        
        switch (sortBy) {
            case 'opportunity':
                sorted.sort((a, b) => b.opportunityScore - a.opportunityScore);
                break;
            case 'liquidity':
                sorted.sort((a, b) => b.liquidityScore - a.liquidityScore);
                break;
            case 'roi':
                sorted.sort((a, b) => b.roiPercent - a.roiPercent);
                break;
            case 'profit':
                sorted.sort((a, b) => b.profitMargin - a.profitMargin);
                break;
            case 'risk':
                sorted.sort((a, b) => a.riskScore - b.riskScore); // Нижчий ризик = краще
                break;
            case 'recentSales':
                sorted.sort((a, b) => b.recentSalesCount - a.recentSalesCount);
                break;
            case 'totalSales':
                sorted.sort((a, b) => b.salesCount - a.salesCount);
                break;
            case 'frequency':
                sorted.sort((a, b) => (b.salesFrequency || 0) - (a.salesFrequency || 0));
                break;
            case 'recency':
                sorted.sort((a, b) => (a.daysSinceLastSale || 999) - (b.daysSinceLastSale || 999));
                break;
            case 'price':
                sorted.sort((a, b) => b.avgMarketPrice - a.avgMarketPrice);
                break;
            default:
                break;
        }
        
        return sorted;
    }, [analysisData, sortBy]);
    
    return (
        <div className="liquidity-analyzer-container">
            <div className="liquidity-header">
                <div className="header-title-group">
                    <h2 className="liquidity-title">Аналіз ліквідності скінів</h2>
                    <div 
                        className="header-info-icon"
                        onClick={() => setShowHeaderTooltip(!showHeaderTooltip)}
                    >
                        <RiInformationLine />
                        {showHeaderTooltip && (
                            <>
                                <div 
                                    className="tooltip-backdrop"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowHeaderTooltip(false);
                                    }}
                                />
                                <div className="header-tooltip" onClick={(e) => e.stopPropagation()}>
                                    <div className="tooltip-title">Що таке аналіз ліквідності?</div>
                                    <div className="tooltip-description">
                                        <p>Інструмент автоматично знаходить найбільш ліквідні (популярні) скіни на DMarket.</p>
                                        <p><strong>Ліквідність</strong> - це показник того, наскільки швидко і часто продається предмет.</p>
                                        <p>Високоліквідні предмети:</p>
                                        <ul>
                                            <li>✅ Швидко продаються</li>
                                            <li>✅ Мають стабільну ціну</li>
                                            <li>✅ Популярні серед гравців</li>
                                        </ul>
                                        <p><strong>Фільтри:</strong></p>
                                        <ul>
                                            <li>📂 Категорія: Rifle, SMG, Pistol, Sniper, Knife, Gloves</li>
                                            <li>⭐ Якість: Covert, Classified, Restricted, Industrial Grade</li>
                                            <li>🎨 Стан: Factory New, Minimal Wear, Field-Tested, Well-Worn, Battle-Scarred</li>
                                            <li>🔢 StatTrak™: З лічильником вбивств або без</li>
                                            <li>🎯 Float Value: Точне значення зношення (0-1)</li>
                                            <li>🔍 Пошук по назві: Проаналізувати конкретний предмет (необов'язково)</li>
                                            <li>📝 Примітка: Фільтри Exterior та Float працюють на клієнті (історія продажів)</li>
                                        </ul>
                                        <p><strong>Аналіз ліквідності:</strong></p>
                                        <ul>
                                            <li>📊 Частота продажів (продажів на день/тиждень)</li>
                                            <li>⏱️ Актуальність (час з останнього продажу)</li>
                                            <li>🎯 Покращена формула з бонусами за частоту</li>
                                            <li>⚠️ Штрафи за застарілі продажі (більше 7 днів)</li>
                                        </ul>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <p className="liquidity-subtitle">
                    Знайдіть найліквідніші предмети на DMarket за якістю
                </p>
            </div>
            
            <div className="liquidity-controls">
                <div className="control-row">
                    <div className="filter-group-checkboxes">
                        <label className="filter-group-title">Категорія зброї:</label>
                        <div className="checkbox-grid">
                            {categoryOptions.map(option => (
                                <label key={option.value} className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={selectedCategories.includes(option.value)}
                                        onChange={() => handleCategoryToggle(option.value)}
                                        disabled={isLoading}
                                    />
                                    <span>{option.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    
                    <div className="filter-group-checkboxes">
                        <label className="filter-group-title">Якість:</label>
                        <div className="checkbox-grid">
                            {qualityOptions.map(option => (
                                <label key={option.value} className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={selectedQualities.includes(option.value)}
                                        onChange={() => handleQualityToggle(option.value)}
                                        disabled={isLoading}
                                    />
                                    <span>{option.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    
                    <div className="filter-group-checkboxes">
                        <label className="filter-group-title">Стан зношення:</label>
                        <div className="checkbox-grid">
                            {exteriorOptions.map(option => (
                                <label key={option.value} className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={selectedExteriors.includes(option.value)}
                                        onChange={() => handleExteriorToggle(option.value)}
                                        disabled={isLoading}
                                    />
                                    <span>{option.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    
                    <div className="filter-group-checkboxes">
                        <label className="filter-group-title">StatTrak™:</label>
                        <div className="checkbox-grid">
                            {statTrakOptions.map(option => (
                                <label key={option.value} className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={selectedStatTrak.includes(option.value)}
                                        onChange={() => handleStatTrakToggle(option.value)}
                                        disabled={isLoading}
                                    />
                                    <span>{option.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    
                    <div className="filter-group">
                        <label>Мін. ціна ($):</label>
                        <input 
                            type="number"
                            value={minPrice}
                            onChange={(e) => setMinPrice(e.target.value)}
                            disabled={isLoading}
                            placeholder="0"
                            min="0"
                            step="0.01"
                            className="price-input"
                        />
                    </div>
                    
                    <div className="filter-group">
                        <label>Макс. ціна ($):</label>
                        <input 
                            type="number"
                            value={maxPrice}
                            onChange={(e) => setMaxPrice(e.target.value)}
                            disabled={isLoading}
                            placeholder="Без ліміту"
                            min="0"
                            step="0.01"
                            className="price-input"
                        />
                    </div>
                    
                    <div className="filter-group">
                        <label>Float від (0-1):</label>
                        <input 
                            type="number"
                            value={floatFrom}
                            onChange={(e) => setFloatFrom(e.target.value)}
                            disabled={isLoading}
                            placeholder="0"
                            min="0"
                            max="1"
                            step="0.01"
                            className="price-input"
                        />
                    </div>
                    
                    <div className="filter-group">
                        <label>Float до (0-1):</label>
                        <input 
                            type="number"
                            value={floatTo}
                            onChange={(e) => setFloatTo(e.target.value)}
                            disabled={isLoading}
                            placeholder="1"
                            min="0"
                            max="1"
                            step="0.01"
                            className="price-input"
                        />
                    </div>
                    
                    <div className="filter-group">
                        <label>Мін. ROI (%):</label>
                        <input 
                            type="number"
                            value={minROI}
                            onChange={(e) => setMinROI(e.target.value)}
                            disabled={isLoading}
                            placeholder="0"
                            min="0"
                            step="1"
                            className="price-input"
                        />
                    </div>
                    
                    <div className="filter-group search-field">
                        <label>Пошук по назві (необов'язково):</label>
                        <div className="search-input-wrapper">
                            <input 
                                type="text"
                                value={itemSearch}
                                onChange={(e) => {
                                    setItemSearch(e.target.value);
                                    handleItemSearch(e.target.value);
                                }}
                                disabled={isLoading}
                                placeholder="Наприклад: AWP | Dragon Lore"
                                className="search-input"
                            />
                            {isSearching && <span className="search-loading">🔍</span>}
                            {searchResults.length > 0 && (
                                <div className="search-results-dropdown">
                                    {searchResults.map((result, idx) => (
                                        <div 
                                            key={idx}
                                            className="search-result-item"
                                            onClick={() => handleSelectSearchResult(result)}
                                        >
                                            <span className="result-title">{result.title || result.extra?.title}</span>
                                            <span className="result-price">${(parseFloat(result.price?.USD || result.price?.amount || 0) / 100).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="control-row">
                    <div className="filter-group">
                        <label>Кількість предметів для аналізу:</label>
                        <div className="slider-container">
                            <input 
                                type="range"
                                value={maxItems}
                                onChange={(e) => setMaxItems(parseInt(e.target.value))}
                                disabled={isLoading}
                                min="10"
                                max="30000"
                                step="10"
                                className="items-slider"
                            />
                            <span className="slider-value">{maxItems}</span>
                        </div>
                    </div>
                    
                    <div className="filter-group">
                        <label>Затримка між запитами (мс):</label>
                        <div className="slider-container">
                            <input 
                                type="range"
                                value={requestDelay}
                                onChange={(e) => setRequestDelay(parseInt(e.target.value))}
                                disabled={isLoading}
                                min="200"
                                max="1000"
                                step="100"
                                className="delay-slider"
                            />
                            <span className="slider-value">{requestDelay}ms</span>
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleAnalyze}
                        disabled={isLoading || !apiService}
                        className="btn btn-primary analyze-btn"
                    >
                        {isLoading ? (
                            <>
                                <RiRefreshLine className="spinning" />
                                Аналіз...
                            </>
                        ) : (
                            <>
                                <RiSearchLine />
                                Аналізувати
                            </>
                        )}
                    </button>
                </div>
            </div>
            
            {isLoading && progress.total > 0 && (
                <div className="progress-container">
                    <div className="progress-bar">
                        <div 
                            className="progress-fill"
                            style={{ width: `${(progress.current / progress.total) * 100}%` }}
                        />
                    </div>
                    <div className="progress-text">
                        Проаналізовано {progress.current} з {progress.total} предметів...
                    </div>
                    <div className="progress-info">
                        Очікуваний час: ~{Math.ceil((progress.total * requestDelay) / 1000)} секунд
                        {progress.current > 0 && (
                            <> | Залишилось: ~{Math.ceil(((progress.total - progress.current) * requestDelay) / 1000)} сек</>
                        )}
                    </div>
                </div>
            )}
            
            {!isLoading && items.length > 0 && analysisData.length === 0 && (
                <div className="info-message">
                    <strong>Знайдено {items.length} унікальних предметів</strong>
                    <div className="active-filters">
                        <span>Фільтри:</span>
                        {selectedCategories.length > 0 && (
                            <span className="filter-tag">
                                Категорії: {selectedCategories.map(c => 
                                    categoryOptions.find(o => o.value === c)?.label.split(' ')[0]
                                ).join(', ')}
                            </span>
                        )}
                        {selectedQualities.length > 0 && (
                            <span className="filter-tag">
                                Якість: {selectedQualities.join(', ')}
                            </span>
                        )}
                        {selectedExteriors.length > 0 && (
                            <span className="filter-tag">
                                Стан: {selectedExteriors.map(e => e.replace('-', ' ')).join(', ')}
                            </span>
                        )}
                        {selectedStatTrak.length > 0 && (
                            <span className="filter-tag">
                                {selectedStatTrak.includes('stattrak_tm') && 'StatTrak™'}
                                {selectedStatTrak.includes('stattrak_tm') && selectedStatTrak.includes('not_stattrak_tm') && ' / '}
                                {selectedStatTrak.includes('not_stattrak_tm') && 'Not StatTrak™'}
                            </span>
                        )}
                        {(minPrice || maxPrice) && (
                            <span className="filter-tag">
                                Ціна: {minPrice || '0'}$ - {maxPrice || '∞'}$
                            </span>
                        )}
                        {(floatFrom || floatTo) && (
                            <span className="filter-tag">
                                Float: {floatFrom || '0'} - {floatTo || '1'}
                            </span>
                        )}
                        {minROI && parseFloat(minROI) > 0 && (
                            <span className="filter-tag">
                                Мін. ROI: {minROI}%
                            </span>
                        )}
                        {itemSearch.trim() && (
                            <span className="filter-tag">
                                🔍 Предмет: {itemSearch}
                            </span>
                        )}
                        {selectedCategories.length === 0 && selectedQualities.length === 0 && selectedExteriors.length === 0 && selectedStatTrak.length === 0 && !(minPrice || maxPrice) && !(floatFrom || floatTo) && !minROI && !itemSearch.trim() && (
                            <span className="filter-tag">Всі предмети</span>
                        )}
                    </div>
                    <p>Буде проаналізовано перші {Math.min(items.length, maxItems)} предметів (~{Math.ceil((Math.min(items.length, maxItems) * requestDelay) / 1000)} сек)</p>
                </div>
            )}
            
            {analysisData.length > 0 && (
                <div className="liquidity-results">
                    <div className="results-header">
                        <h3 className="results-title">
                            Топ-{sortedData.length} найліквідніших предметів
                        </h3>
                        
                        <div className="sort-controls">
                            <label>Сортувати за:</label>
                            <select 
                                value={sortBy} 
                                onChange={(e) => {
                                    setSortBy(e.target.value);
                                    // Закриваємо всі tooltips при зміні сортування
                                    setShowLiquidityTooltip(false);
                                    setShowOpportunityTooltip(false);
                                    setShowRiskTooltip(false);
                                }}
                                className="sort-select"
                            >
                                <option value="opportunity">🔥 Прибутковістю (Opportunity)</option>
                                <option value="roi">💰 ROI %</option>
                                <option value="profit">💵 Profit Margin</option>
                                <option value="risk">⚠️ Ризиком (нижчий = краще)</option>
                                <option value="liquidity">📊 Ліквідністю</option>
                                <option value="recentSales">🔥 Недавніми продажами (7 днів)</option>
                                <option value="totalSales">📈 Загальними продажами</option>
                                <option value="frequency">⚡ Частотою продажів</option>
                                <option value="recency">⏱️ Актуальністю (останній продаж)</option>
                                <option value="price">💲 Ціною</option>
                            </select>
                            
                            {sortBy === 'liquidity' && (
                                <div 
                                    className="liquidity-info-icon"
                                    onClick={() => setShowLiquidityTooltip(!showLiquidityTooltip)}
                                >
                                    <RiInformationLine />
                                    {showLiquidityTooltip && (
                                        <>
                                            <div 
                                                className="tooltip-backdrop"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowLiquidityTooltip(false);
                                                }}
                                            />
                                            <div className="liquidity-tooltip" onClick={(e) => e.stopPropagation()}>
                                                <div className="tooltip-title">📊 Формула розрахунку ліквідності (оновлена):</div>
                                                <div className="tooltip-formula">
                                                    Базовий score = (Продажі за 7 днів × <strong>15</strong>) + (Загальні продажі × 2) + (Наявність × 5)
                                                </div>
                                                <div className="tooltip-formula">
                                                    + Бонус за частоту (до +50)
                                                </div>
                                                <div className="tooltip-formula">
                                                    - Штраф за застарілість (якщо &gt; 7 днів)
                                                </div>
                                                <div className="tooltip-description">
                                                    <p><strong>Підвищена вага для нещодавніх продажів</strong></p>
                                                    <p>🔥 Найвища вага: продажі за тиждень (×15)</p>
                                                    <p>📈 Середня вага: загальна історія продажів (×2)</p>
                                                    <p>⚡ Бонуси: висока частота продажів, свіжі продажі</p>
                                                    <p>⏱️ Штрафи: давно не продавалось (&gt;7 днів)</p>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                            
                            {sortBy === 'opportunity' && (
                                <div 
                                    className="liquidity-info-icon"
                                    onClick={() => setShowOpportunityTooltip(!showOpportunityTooltip)}
                                >
                                    <RiInformationLine />
                                    {showOpportunityTooltip && (
                                        <>
                                            <div 
                                                className="tooltip-backdrop"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowOpportunityTooltip(false);
                                                }}
                                            />
                                            <div className="liquidity-tooltip" onClick={(e) => e.stopPropagation()}>
                                                <div className="tooltip-title">🎯 Формула Opportunity Score (покращена):</div>
                                                <div className="tooltip-formula">
                                                    Opportunity = ROI (до 40) + Ліквідність (до 30) + Низький ризик (до 30)
                                                </div>
                                                <div className="tooltip-description">
                                                    <p><strong>⚠️ КРИТИЧНІ ШТРАФИ:</strong></p>
                                                    <p>🔴 Волатильність &gt;50% → -30 балів</p>
                                                    <p>📉 Падіння за місяць &gt;10% → -20 балів</p>
                                                    <p>🚨 Падіння за тиждень &gt;5% → -25 балів</p>
                                                    <p>💥 Price Spike виявлено → -15 балів</p>
                                                    <p>⚖️ Нормалізація після скачка + падіння → -20 балів</p>
                                                    
                                                    <p><strong>✅ БОНУСИ:</strong></p>
                                                    <p>📈 Стабільність + зростання → +10 балів</p>
                                                    <p>⚡ Останній продаж &lt;24 год → +5 балів</p>
                                                    
                                                    <p><strong>Результат:</strong></p>
                                                    <p>70-100: 🟢 Відмінна | 50-69: 🔵 Добра | 30-49: 🟡 Посередня | 0-29: 🔴 Погана</p>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                            
                            {sortBy === 'risk' && (
                                <div 
                                    className="liquidity-info-icon"
                                    onClick={() => setShowRiskTooltip(!showRiskTooltip)}
                                >
                                    <RiInformationLine />
                                    {showRiskTooltip && (
                                        <>
                                            <div 
                                                className="tooltip-backdrop"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowRiskTooltip(false);
                                                }}
                                            />
                                            <div className="liquidity-tooltip" onClick={(e) => e.stopPropagation()}>
                                                <div className="tooltip-title">⚠️ Формула Risk Score (покращена):</div>
                                                <div className="tooltip-formula">
                                                    <strong>Базові компоненти:</strong>
                                                </div>
                                                <div className="tooltip-formula">
                                                    • Волатильність (до 50 балів, підвищена вага!)
                                                </div>
                                                <div className="tooltip-formula">
                                                    • Низька ліквідність (до 25 балів)
                                                </div>
                                                <div className="tooltip-formula">
                                                    • Конкуренція (до 15 балів)
                                                </div>
                                                <div className="tooltip-formula">
                                                    • Застарілість (до 10 балів)
                                                </div>
                                                <div className="tooltip-description">
                                                    <p><strong>🚨 НОВІ ШТРАФИ:</strong></p>
                                                    <p>💥 Price Spike виявлено → +15 балів</p>
                                                    <p>🔴 Волатильність &gt;100% → 50 балів (максимум!)</p>
                                                    <p>🟡 Волатильність &gt;50% → 35-50 балів</p>
                                                    
                                                    <p><strong>✅ БОНУС:</strong></p>
                                                    <p>⚖️ Стабілізація після скачка → -10 балів</p>
                                                    
                                                    <p><strong>Результат:</strong></p>
                                                    <p>0-20: 🟢 Низький | 21-50: 🟡 Середній | 51-100: 🔴 Високий</p>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="results-grid">
                        {sortedData.map((item, index) => {
                            // Визначаємо класи для індикаторів
                            const opportunityClass = item.opportunityScore >= 70 ? 'excellent' : 
                                                   item.opportunityScore >= 50 ? 'good' : 
                                                   item.opportunityScore >= 30 ? 'medium' : 'low';
                            
                            const riskClass = item.riskScore <= 20 ? 'low-risk' : 
                                            item.riskScore <= 50 ? 'medium-risk' : 'high-risk';
                            
                            const roiClass = item.roiPercent >= 20 ? 'excellent' : 
                                           item.roiPercent >= 10 ? 'good' : 
                                           item.roiPercent >= 5 ? 'medium' : 'low';
                            
                            const trendClass = item.priceTrend > 5 ? 'trending-up' : 
                                             item.priceTrend < -5 ? 'trending-down' : 'trending-stable';
                            
                            const isHotDeal = item.opportunityScore >= 70 && item.roiPercent >= 15 && item.riskScore <= 30;
                            
                            return (
                            <div key={index} className={`liquidity-card ${isHotDeal ? 'hot-deal' : ''}`}>
                                {isHotDeal && (
                                    <div className="hot-deal-badge">🔥 Гаряча пропозиція!</div>
                                )}
                                
                                {/* WARNING для поганих сигналів */}
                                {(item.volatilityWarning || item.trendWarning || item.hasSpike) && (
                                    <div className="warning-badge">
                                        {item.volatilityWarning && <span title="Екстремальна волатильність!">⚠️ Висока волатильність ({item.priceVolatility.toFixed(0)}%)</span>}
                                        {item.trendWarning && (
                                            <span title={`Місяць: ${item.priceTrend.toFixed(1)}% | Тиждень: ${item.recentTrend.toFixed(1)}%`}>
                                                📉 Падіння цін 
                                                {item.recentTrend < -5 && item.priceTrend >= 0 && ' (за тиждень)'}
                                                {item.priceTrend < -5 && item.recentTrend >= 0 && ' (за місяць)'}
                                                {item.priceTrend < -5 && item.recentTrend < -5 && ' (місяць + тиждень)'}
                                            </span>
                                        )}
                                        {item.hasSpike && <span title="Виявлено аномальний скачок цін">🚨 Price Spike ({item.spikePercent.toFixed(0)}%)</span>}
                                        {item.isStabilizing && item.hasSpike && <span title="Ціна нормалізується після скачка">⚖️ Стабілізація після скачка</span>}
                                    </div>
                                )}
                                
                                <div className="card-header">
                                    <div className="card-rank">#{index + 1}</div>
                                    <div className={`card-opportunity ${opportunityClass}`}>
                                        Opportunity: {item.opportunityScore}
                                    </div>
                                </div>
                                
                                <div className="card-title">{item.title}</div>
                                
                                {/* Основні метрики прибутковості */}
                                <div className="profitability-section">
                                    <div className="section-title">💰 Прибутковість</div>
                                    
                                    <div className="stat-row highlight">
                                        <span className="stat-label">ROI:</span>
                                        <span className={`stat-value ${roiClass}`}>
                                            {item.roiPercent > 0 ? `+${item.roiPercent.toFixed(1)}%` : `${item.roiPercent.toFixed(1)}%`}
                                        </span>
                                    </div>
                                    
                                    <div className="stat-row highlight">
                                        <span className="stat-label">Profit Margin:</span>
                                        <span className={`stat-value ${item.profitMargin > 0 ? 'positive' : 'negative'}`}>
                                            {item.profitMargin > 0 ? `+$${item.profitMargin.toFixed(2)}` : `$${item.profitMargin.toFixed(2)}`}
                                        </span>
                                    </div>
                                    
                                    <div className="stat-row">
                                        <span className="stat-label">Купити від:</span>
                                        <span className="stat-value price">${item.minPrice.toFixed(2)}</span>
                                    </div>
                                    
                                    <div className="stat-row">
                                        <span className="stat-label">Продати ~:</span>
                                        <span className="stat-value price" title={`Медіана: $${item.medianSalePrice?.toFixed(2)} | Середнє: $${item.arithmeticAvgPrice?.toFixed(2)}`}>
                                            ${item.avgSalePrice > 0 ? item.avgSalePrice.toFixed(2) : 'N/A'}
                                        </span>
                                    </div>
                                    
                                    {item.outliersCount > 0 && (
                                        <div className="stat-row">
                                            <span className="stat-label" title="Виявлено аномальні ціни (outliers)">Outliers:</span>
                                            <span className="stat-value info">
                                                {item.outliersCount} з {item.cleanPricesCount + item.outliersCount}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Метрики ризику */}
                                <div className="risk-section">
                                    <div className="section-title">⚠️ Ризик</div>
                                    
                                    <div className="stat-row">
                                        <span className="stat-label">Risk Score:</span>
                                        <span className={`stat-value ${riskClass}`}>
                                            {item.riskScore.toFixed(0)}
                                        </span>
                                    </div>
                                    
                                    <div className="stat-row">
                                        <span className="stat-label">Волатильність:</span>
                                        <span className={`stat-value ${item.priceVolatility > 50 ? 'negative' : 'info'}`}>
                                            {item.priceVolatility.toFixed(1)}%
                                            {item.priceVolatility > 50 && ' ⚠️'}
                                        </span>
                                    </div>
                                    
                                    <div className="stat-row">
                                        <span className="stat-label">У вибірці:</span>
                                        <span className="stat-value info">
                                            {item.marketCount} шт.
                                        </span>
                                    </div>
                                    
                                    {item.priceTrend !== 0 && (
                                        <>
                                            <div className="stat-row">
                                                <span className="stat-label">Тренд (місяць):</span>
                                                <span className={`stat-value ${item.priceTrend > 5 ? 'trending-up' : item.priceTrend < -5 ? 'trending-down' : 'trending-stable'}`}>
                                                    {item.priceTrend > 0 ? '↑' : item.priceTrend < 0 ? '↓' : '→'}
                                                    {' '}
                                                    {item.priceTrend > 0 ? '+' : ''}{item.priceTrend.toFixed(1)}%
                                                </span>
                                            </div>
                                            
                                            {item.recentTrend !== 0 && item.recentSalesCount >= 3 && (
                                                <div className="stat-row">
                                                    <span className="stat-label">Тренд (тиждень):</span>
                                                    <span className={`stat-value ${item.recentTrend > 5 ? 'trending-up' : item.recentTrend < -5 ? 'trending-down' : 'trending-stable'}`}>
                                                        {item.recentTrend > 0 ? '↑' : item.recentTrend < 0 ? '↓' : '→'}
                                                        {' '}
                                                        {item.recentTrend > 0 ? '+' : ''}{item.recentTrend.toFixed(1)}%
                                                        {item.recentTrend < -5 && ' ⚠️'}
                                                    </span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    
                                    {item.isStabilizing && (
                                        <div className="stat-row">
                                            <span className="stat-label">Стабільність:</span>
                                            <span className="stat-value info" title="Ціна стабілізується">
                                                ⚖️ {item.stabilityScore.toFixed(0)}/100
                                            </span>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Метрики ліквідності */}
                                <div className="liquidity-section">
                                    <div className="section-title">📊 Ліквідність</div>
                                    
                                    <div className="stat-row">
                                        <span className="stat-label">Liquidity Score:</span>
                                        <span className="stat-value">{item.liquidityScore}</span>
                                    </div>
                                    
                                    <div className="stat-row">
                                        <span className="stat-label">Продажів (всього):</span>
                                        <span className="stat-value">{item.salesCount}</span>
                                    </div>
                                    
                                    <div className="stat-row">
                                        <span className="stat-label">Продажів (7 днів):</span>
                                        <span className="stat-value">{item.recentSalesCount}</span>
                                    </div>
                                    
                                    {item.salesFrequency > 0 && (
                                        <div className="stat-row">
                                            <span className="stat-label">Частота:</span>
                                            <span className="stat-value">
                                                {item.salesFrequency >= 1 
                                                    ? `${item.salesFrequency.toFixed(1)}/день` 
                                                    : `${(item.salesFrequency * 7).toFixed(1)}/тиждень`}
                                            </span>
                                        </div>
                                    )}
                                    
                                    {item.daysSinceLastSale < 999 && (
                                        <div className="stat-row">
                                            <span className="stat-label">Останній продаж:</span>
                                            <span className={`stat-value ${item.daysSinceLastSale <= 1 ? 'positive' : item.daysSinceLastSale > 7 ? 'negative' : 'info'}`}>
                                                {item.daysSinceLastSale < 1 
                                                    ? 'Сьогодні' 
                                                    : item.daysSinceLastSale < 2 
                                                    ? 'Вчора' 
                                                    : `${Math.floor(item.daysSinceLastSale)} днів тому`}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Аналітика по типах транзакцій */}
                                {(item.offerCount > 0 || item.targetCount > 0) && (
                                    <div className="transaction-types-section">
                                        <div className="section-title">💼 Типи транзакцій</div>
                                        
                                        <div className="stat-row">
                                            <span className="stat-label">Offer (ручні):</span>
                                            <span className="stat-value info">
                                                {item.offerCount} ({item.offerRatio.toFixed(0)}%)
                                            </span>
                                        </div>
                                        
                                        {item.offerMedianPrice > 0 && (
                                            <div className="stat-row">
                                                <span className="stat-label">└ Медіана:</span>
                                                <span className="stat-value price">${item.offerMedianPrice.toFixed(2)}</span>
                                            </div>
                                        )}
                                        
                                        <div className="stat-row">
                                            <span className="stat-label">Target (авто):</span>
                                            <span className="stat-value info">
                                                {item.targetCount} ({item.targetRatio.toFixed(0)}%)
                                            </span>
                                        </div>
                                        
                                        {item.targetMedianPrice > 0 && (
                                            <div className="stat-row">
                                                <span className="stat-label">└ Медіана:</span>
                                                <span className="stat-value price">${item.targetMedianPrice.toFixed(2)}</span>
                                            </div>
                                        )}
                                        
                                        {item.priceSpread > 0 && (
                                            <>
                                                <div className="stat-row highlight">
                                                    <span className="stat-label">Спред:</span>
                                                    <span className="stat-value positive" title="Різниця між цінами Offer і Target">
                                                        ${item.priceSpread.toFixed(2)} ({item.priceSpreadPercent.toFixed(1)}%)
                                                    </span>
                                                </div>
                                                
                                                <div className="stat-row">
                                                    <span className="stat-label">Домінанс:</span>
                                                    <span className={`stat-value ${
                                                        item.txDominance === 'offer-heavy' ? 'info' : 
                                                        item.txDominance === 'target-heavy' ? 'warning' : 
                                                        'neutral'
                                                    }`} title={
                                                        item.txDominance === 'offer-heavy' ? 'Покупці готові платити повну ціну' :
                                                        item.txDominance === 'target-heavy' ? 'Продавці поспішають продати' :
                                                        'Збалансований ринок'
                                                    }>
                                                        {item.txDominance === 'offer-heavy' ? '🎯 Offer' : 
                                                         item.txDominance === 'target-heavy' ? '⚡ Target' : 
                                                         '⚖️ Balanced'}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                                
                                {item.error && (
                                    <div className="card-error">
                                        ⚠️ Не вдалося отримати історію продажів
                                    </div>
                                )}
                            </div>
                        );
                        })}
                    </div>
                </div>
            )}
            
            {!isLoading && analysisData.length === 0 && items.length === 0 && (
                <div className="empty-state">
                    <RiSearchLine className="empty-icon" />
                    <p>Налаштуйте фільтри та натисніть "Аналізувати"</p>
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