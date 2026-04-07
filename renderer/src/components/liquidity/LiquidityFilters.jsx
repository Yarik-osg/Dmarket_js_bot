import React from 'react';
import { RiRefreshLine, RiSearchLine, RiArrowDownSLine, RiArrowUpSLine } from 'react-icons/ri';

const CATEGORY_OPTIONS = [
    { value: 'rifle', label: 'Rifle (Гвинтівки)' },
    { value: 'smg', label: 'SMG (Пістолети-кулемети)' },
    { value: 'pistol', label: 'Pistol (Пістолети)' },
    { value: 'sniper', label: 'Sniper Rifle (Снайперські)' },
    { value: 'knife', label: 'Knife (Ножі)' },
    { value: 'gloves', label: 'Gloves (Рукавички)' },
];
const QUALITY_OPTIONS = [
    { value: 'covert', label: 'Covert (Таємне)' },
    { value: 'classified', label: 'Classified (Засекречене)' },
    { value: 'restricted', label: 'Restricted (Обмежений)' },
    { value: 'industrial grade', label: 'Industrial Grade' },
];
const EXTERIOR_OPTIONS = [
    { value: 'factory-new', label: 'Factory New' },
    { value: 'minimal-wear', label: 'Minimal Wear' },
    { value: 'field-tested', label: 'Field-Tested' },
    { value: 'well-worn', label: 'Well-Worn' },
    { value: 'battle-scarred', label: 'Battle-Scarred' },
];
const STATTRAK_OPTIONS = [
    { value: 'stattrak_tm', label: 'StatTrak™' },
    { value: 'not_stattrak_tm', label: 'Not StatTrak™' },
];

function toggleValue(setter, value) {
    setter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
}

function CheckboxGroup({ title, options, selected, onChange, disabled }) {
    return (
        <div className="filter-group-checkboxes">
            <label className="filter-group-title">{title}</label>
            <div className="checkbox-grid">
                {options.map(o => (
                    <label key={o.value} className="checkbox-label">
                        <input
                            type="checkbox"
                            checked={selected.includes(o.value)}
                            onChange={() => onChange(o.value)}
                            disabled={disabled}
                        />
                        <span>{o.label}</span>
                    </label>
                ))}
            </div>
        </div>
    );
}

function ActiveFilterTags({ categories, qualities, exteriors, statTrak, minPrice, maxPrice, floatFrom, floatTo, minROI, itemSearch }) {
    const tags = [];
    if (categories.length > 0) {
        tags.push(`Категорії: ${categories.map(c => CATEGORY_OPTIONS.find(o => o.value === c)?.label.split(' ')[0]).join(', ')}`);
    }
    if (qualities.length > 0) tags.push(`Якість: ${qualities.join(', ')}`);
    if (exteriors.length > 0) tags.push(`Стан: ${exteriors.map(e => e.replace('-', ' ')).join(', ')}`);
    if (statTrak.length > 0) {
        const parts = [];
        if (statTrak.includes('stattrak_tm')) parts.push('StatTrak™');
        if (statTrak.includes('not_stattrak_tm')) parts.push('Not StatTrak™');
        tags.push(parts.join(' / '));
    }
    if (minPrice || maxPrice) tags.push(`Ціна: ${minPrice || '0'}$ - ${maxPrice || '∞'}$`);
    if (floatFrom || floatTo) tags.push(`Float: ${floatFrom || '0'} - ${floatTo || '1'}`);
    if (minROI && parseFloat(minROI) > 0) tags.push(`Мін. ROI: ${minROI}%`);
    if (itemSearch.trim()) tags.push(`Предмет: ${itemSearch}`);
    if (tags.length === 0) tags.push('Всі предмети');

    return (
        <div className="active-filters" style={{ justifyContent: 'flex-start', margin: 0 }}>
            {tags.map((t, i) => <span key={i} className="filter-tag">{t}</span>)}
        </div>
    );
}

export default function LiquidityFilters({
    filters, setFilters, isLoading, isCollapsed, setIsCollapsed,
    searchResults, isSearching, onItemSearch, onSelectSearchResult, onAnalyze, apiService,
}) {
    const {
        selectedCategories, selectedQualities, selectedExteriors, selectedStatTrak,
        minPrice, maxPrice, floatFrom, floatTo, minROI, maxItems, itemSearch,
    } = filters;

    const set = (key) => (val) => setFilters(prev => ({ ...prev, [key]: typeof val === 'function' ? val(prev[key]) : val }));

    return (
        <div className="liquidity-controls">
            <div
                className="filters-collapse-header"
                onClick={() => setIsCollapsed(!isCollapsed)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: isCollapsed ? 0 : 16 }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Фільтри</span>
                    {isCollapsed && (
                        <ActiveFilterTags
                            categories={selectedCategories} qualities={selectedQualities}
                            exteriors={selectedExteriors} statTrak={selectedStatTrak}
                            minPrice={minPrice} maxPrice={maxPrice}
                            floatFrom={floatFrom} floatTo={floatTo}
                            minROI={minROI} itemSearch={itemSearch}
                        />
                    )}
                </div>
                {isCollapsed ? <RiArrowDownSLine size={20} /> : <RiArrowUpSLine size={20} />}
            </div>

            {!isCollapsed && (
                <>
                    <div className="control-row">
                        <CheckboxGroup title="Категорія зброї:" options={CATEGORY_OPTIONS} selected={selectedCategories} onChange={v => toggleValue(set('selectedCategories'), v)} disabled={isLoading} />
                        <CheckboxGroup title="Якість:" options={QUALITY_OPTIONS} selected={selectedQualities} onChange={v => toggleValue(set('selectedQualities'), v)} disabled={isLoading} />
                        <CheckboxGroup title="Стан зношення:" options={EXTERIOR_OPTIONS} selected={selectedExteriors} onChange={v => toggleValue(set('selectedExteriors'), v)} disabled={isLoading} />
                        <CheckboxGroup title="StatTrak™:" options={STATTRAK_OPTIONS} selected={selectedStatTrak} onChange={v => toggleValue(set('selectedStatTrak'), v)} disabled={isLoading} />

                        <div className="filter-group">
                            <label>Мін. ціна ($):</label>
                            <input type="number" value={minPrice} onChange={e => set('minPrice')(e.target.value)} disabled={isLoading} placeholder="0" min="0" step="0.01" className="price-input" />
                        </div>
                        <div className="filter-group">
                            <label>Макс. ціна ($):</label>
                            <input type="number" value={maxPrice} onChange={e => set('maxPrice')(e.target.value)} disabled={isLoading} placeholder="Без ліміту" min="0" step="0.01" className="price-input" />
                        </div>
                        <div className="filter-group">
                            <label>Float від (0-1):</label>
                            <input type="number" value={floatFrom} onChange={e => set('floatFrom')(e.target.value)} disabled={isLoading} placeholder="0" min="0" max="1" step="0.01" className="price-input" />
                        </div>
                        <div className="filter-group">
                            <label>Float до (0-1):</label>
                            <input type="number" value={floatTo} onChange={e => set('floatTo')(e.target.value)} disabled={isLoading} placeholder="1" min="0" max="1" step="0.01" className="price-input" />
                        </div>
                        <div className="filter-group">
                            <label>Мін. ROI (%):</label>
                            <input type="number" value={minROI} onChange={e => set('minROI')(e.target.value)} disabled={isLoading} placeholder="0" min="0" step="1" className="price-input" />
                        </div>

                        <div className="filter-group search-field">
                            <label>Пошук по назві (необов'язково):</label>
                            <div className="search-input-wrapper">
                                <input
                                    type="text"
                                    value={itemSearch}
                                    onChange={e => { set('itemSearch')(e.target.value); onItemSearch(e.target.value); }}
                                    disabled={isLoading}
                                    placeholder="Наприклад: AWP | Dragon Lore"
                                    className="search-input"
                                />
                                {isSearching && <span className="search-loading">🔍</span>}
                                {searchResults.length > 0 && (
                                    <div className="search-results-dropdown">
                                        {searchResults.map((r, i) => (
                                            <div key={i} className="search-result-item" onClick={() => onSelectSearchResult(r)}>
                                                <span className="result-title">{r.title || r.extra?.title}</span>
                                                <span className="result-price">${(parseFloat(r.price?.USD || r.price?.amount || 0) / 100).toFixed(2)}</span>
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
                                <input type="range" value={maxItems} onChange={e => set('maxItems')(parseInt(e.target.value))} disabled={isLoading} min="10" max="30000" step="10" className="items-slider" />
                                <span className="slider-value">{maxItems}</span>
                            </div>
                        </div>
                        <button onClick={onAnalyze} disabled={isLoading || !apiService} className="btn btn-primary analyze-btn">
                            {isLoading
                                ? <><RiRefreshLine className="spinning" /> Аналіз...</>
                                : <><RiSearchLine /> Аналізувати</>}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

export { CATEGORY_OPTIONS, QUALITY_OPTIONS, EXTERIOR_OPTIONS, STATTRAK_OPTIONS };
