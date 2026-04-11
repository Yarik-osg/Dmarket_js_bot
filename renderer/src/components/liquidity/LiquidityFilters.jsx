import React, { useState, useEffect, useRef } from 'react';
import { RiRefreshLine, RiSearchLine, RiArrowDownSLine, RiArrowUpSLine } from 'react-icons/ri';
import { FLOAT_PART_TO_RANGE } from '../../utils/csFloatRanges.js';

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

const FLOAT_GROUPS = [
    { prefix: 'FN', label: 'Factory New', color: '#10b981' },
    { prefix: 'MW', label: 'Minimal Wear', color: '#3b82f6' },
    { prefix: 'FT', label: 'Field-Tested', color: '#f59e0b' },
    { prefix: 'WW', label: 'Well-Worn', color: '#ff9800' },
    { prefix: 'BS', label: 'Battle-Scarred', color: '#ef4444' },
];

const FLOAT_OPTIONS = Object.entries(FLOAT_PART_TO_RANGE).map(([token, range]) => ({
    value: token,
    label: range,
    prefix: token.split('-')[0],
}));

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

function FloatMultiSelect({ selected, onChange, disabled }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const toggle = (token) => {
        onChange(selected.includes(token) ? selected.filter(t => t !== token) : [...selected, token]);
    };

    const toggleGroup = (prefix) => {
        const groupTokens = FLOAT_OPTIONS.filter(o => o.prefix === prefix).map(o => o.value);
        const allSelected = groupTokens.every(t => selected.includes(t));
        if (allSelected) {
            onChange(selected.filter(t => !groupTokens.includes(t)));
        } else {
            onChange([...new Set([...selected, ...groupTokens])]);
        }
    };

    const clearAll = () => onChange([]);

    const summary = selected.length === 0
        ? 'Всі діапазони'
        : selected.length <= 3
            ? selected.map(t => FLOAT_PART_TO_RANGE[t]).join(', ')
            : `${selected.length} обрано`;

    return (
        <div className="float-multi-select" ref={ref}>
            <label className="filter-group-title">Float діапазон:</label>
            <button
                type="button"
                className="float-select-trigger"
                onClick={() => !disabled && setOpen(!open)}
                disabled={disabled}
            >
                <span className="float-select-text">{summary}</span>
                {open ? <RiArrowUpSLine size={16} /> : <RiArrowDownSLine size={16} />}
            </button>
            {open && (
                <div className="float-select-dropdown">
                    {selected.length > 0 && (
                        <button type="button" className="float-clear-btn" onClick={clearAll}>Очистити все</button>
                    )}
                    {FLOAT_GROUPS.map(group => {
                        const groupOpts = FLOAT_OPTIONS.filter(o => o.prefix === group.prefix);
                        const allChecked = groupOpts.every(o => selected.includes(o.value));
                        const someChecked = groupOpts.some(o => selected.includes(o.value));
                        return (
                            <div key={group.prefix} className="float-group">
                                <label className="float-group-header" onClick={() => toggleGroup(group.prefix)}>
                                    <input
                                        type="checkbox"
                                        checked={allChecked}
                                        ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                                        onChange={() => toggleGroup(group.prefix)}
                                    />
                                    <span className="float-group-dot" style={{ background: group.color }} />
                                    <span className="float-group-label">{group.label}</span>
                                </label>
                                <div className="float-group-items">
                                    {groupOpts.map(opt => (
                                        <label key={opt.value} className={`float-item${selected.includes(opt.value) ? ' checked' : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={selected.includes(opt.value)}
                                                onChange={() => toggle(opt.value)}
                                            />
                                            <span className="float-item-range">{opt.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function ActiveFilterTags({ categories, qualities, exteriors, statTrak, minPrice, maxPrice, selectedFloats, itemSearch }) {
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
    if (selectedFloats && selectedFloats.length > 0) {
        if (selectedFloats.length <= 3) {
            tags.push(`Float: ${selectedFloats.map(t => FLOAT_PART_TO_RANGE[t]).join(', ')}`);
        } else {
            tags.push(`Float: ${selectedFloats.length} діапазонів`);
        }
    }
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
        minPrice, maxPrice, selectedFloats, maxItems, itemSearch,
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
                            selectedFloats={selectedFloats}
                            itemSearch={itemSearch}
                        />
                    )}
                </div>
                {isCollapsed ? <RiArrowDownSLine size={20} /> : <RiArrowUpSLine size={20} />}
            </div>

            {!isCollapsed && (
                <>
                    <div className="liquidity-filters-main-section">
                        <div className="control-row liquidity-checkbox-row">
                            <CheckboxGroup title="Категорія зброї:" options={CATEGORY_OPTIONS} selected={selectedCategories} onChange={v => toggleValue(set('selectedCategories'), v)} disabled={isLoading} />
                            <CheckboxGroup title="Якість:" options={QUALITY_OPTIONS} selected={selectedQualities} onChange={v => toggleValue(set('selectedQualities'), v)} disabled={isLoading} />
                            <CheckboxGroup title="Стан зношення:" options={EXTERIOR_OPTIONS} selected={selectedExteriors} onChange={v => toggleValue(set('selectedExteriors'), v)} disabled={isLoading} />
                            <CheckboxGroup title="StatTrak™:" options={STATTRAK_OPTIONS} selected={selectedStatTrak} onChange={v => toggleValue(set('selectedStatTrak'), v)} disabled={isLoading} />
                        </div>

                        <div className="liquidity-row-price-float-search">
                            <div className="price-range-group">
                                <div className="filter-group">
                                    <label>Мін. ціна ($):</label>
                                    <input type="number" value={minPrice} onChange={e => set('minPrice')(e.target.value)} disabled={isLoading} placeholder="0" min="0" step="0.01" className="price-input" />
                                </div>
                                <div className="filter-group">
                                    <label>Макс. ціна ($):</label>
                                    <input type="number" value={maxPrice} onChange={e => set('maxPrice')(e.target.value)} disabled={isLoading} placeholder="Без ліміту" min="0" step="0.01" className="price-input" />
                                </div>
                            </div>
                            <FloatMultiSelect
                                selected={selectedFloats || []}
                                onChange={v => set('selectedFloats')(v)}
                                disabled={isLoading}
                            />
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
                    </div>

                    <div className="control-row liquidity-slider-row">
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
