import React, { useState, useEffect, useMemo } from 'react';
import { useTargets } from '../hooks/useTargets.js';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { ApiService } from '../services/apiService.js';
import '../styles/TargetForm.css';

// Format price from cents (string) to dollars (string with decimal point)
// Example: "6400" -> "64.00", "50" -> "0.50"
const formatPriceFromCents = (priceInCents) => {
    if (!priceInCents) return '';
    const priceStr = priceInCents.toString();
    if (priceStr.length >= 2) {
        return priceStr.slice(0, -2) + '.' + priceStr.slice(-2);
    }
    return '0.' + priceStr.padStart(2, '0');
};

// Detect wear type from item title
const getWearTypeFromTitle = (title) => {
    if (!title) return null;
    const titleLower = title.toLowerCase();
    if (titleLower.includes('factory new')) return 'FN';
    if (titleLower.includes('minimal wear')) return 'MW';
    if (titleLower.includes('field-tested')) return 'FT';
    if (titleLower.includes('well-worn')) return 'WW';
    if (titleLower.includes('battle-scarred')) return 'BS';
    return null;
};

function TargetForm({ target, onClose, onSave, onSaveWithMaxPrice }) {
    const { t } = useLocale();
    const { client } = useAuth();
    const { createTarget, updateTarget } = useTargets();
    const apiService = client ? new ApiService(client) : null;

    const [formData, setFormData] = useState({
        title: target?.title || '',
        price: formatPriceFromCents('3'),
        minPrice: target?.minPrice || '0.03',
        maxPrice: target?.maxPrice || '1',
        quantity: target?.amount || 1,
        floatPartValue: target?.extra?.floatPartValue || '',
        phase: '',
        phaseAny: true,
        paintSeed: target?.attributes?.paintSeed || '0'
    });

    // All float part value options according to DMarket API
    const allFloatPartValueOptions = [
        { value: '', label: 'Будь-який Float' },
        { value: 'FN-0', label: 'FN-0 (0.00 ≤ Float < 0.01)' },
        { value: 'FN-1', label: 'FN-1 (0.01 ≤ Float < 0.02)' },
        { value: 'FN-2', label: 'FN-2 (0.02 ≤ Float < 0.03)' },
        { value: 'FN-3', label: 'FN-3 (0.03 ≤ Float < 0.04)' },
        { value: 'FN-4', label: 'FN-4 (0.04 ≤ Float < 0.05)' },
        { value: 'FN-5', label: 'FN-5 (0.05 ≤ Float < 0.06)' },
        { value: 'FN-6', label: 'FN-6 (0.06 ≤ Float < 0.07)' },
        { value: 'MW-0', label: 'MW-0 (0.07 ≤ Float < 0.08)' },
        { value: 'MW-1', label: 'MW-1 (0.08 ≤ Float < 0.09)' },
        { value: 'MW-2', label: 'MW-2 (0.09 ≤ Float < 0.1)' },
        { value: 'MW-3', label: 'MW-3 (0.1 ≤ Float < 0.11)' },
        { value: 'MW-4', label: 'MW-4 (0.11 ≤ Float < 0.15)' },
        { value: 'FT-0', label: 'FT-0 (0.15 ≤ Float < 0.18)' },
        { value: 'FT-1', label: 'FT-1 (0.18 ≤ Float < 0.21)' },
        { value: 'FT-2', label: 'FT-2 (0.21 ≤ Float < 0.24)' },
        { value: 'FT-3', label: 'FT-3 (0.24 ≤ Float < 0.27)' },
        { value: 'FT-4', label: 'FT-4 (0.27 ≤ Float < 0.38)' },
        { value: 'WW-0', label: 'WW-0 (0.38 ≤ Float < 0.39)' },
        { value: 'WW-1', label: 'WW-1 (0.39 ≤ Float < 0.4)' },
        { value: 'WW-2', label: 'WW-2 (0.4 ≤ Float < 0.41)' },
        { value: 'WW-3', label: 'WW-3 (0.41 ≤ Float < 0.42)' },
        { value: 'WW-4', label: 'WW-4 (0.42 ≤ Float < 0.45)' },
        { value: 'BS-0', label: 'BS-0 (0.45 ≤ Float < 0.5)' },
        { value: 'BS-1', label: 'BS-1 (0.5 ≤ Float < 0.63)' },
        { value: 'BS-2', label: 'BS-2 (0.63 ≤ Float < 0.76)' },
        { value: 'BS-3', label: 'BS-3 (0.76 ≤ Float < 0.8)' },
        { value: 'BS-4', label: 'BS-4 (0.8 ≤ Float < 1.0)' }
    ];

    // Filter float options based on title wear type
    const floatPartValueOptions = useMemo(() => {
        const wearType = getWearTypeFromTitle(formData.title);
        if (!wearType) {
            // If no wear type detected, show all options
            return allFloatPartValueOptions;
        }
        // Filter to show only "Any Float" and options matching the wear type
        return allFloatPartValueOptions.filter(option => 
            option.value === '' || option.value.startsWith(wearType + '-')
        );
    }, [formData.title]);

    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSearch = async (query) => {
        if (!apiService || !query.trim()) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            const response = await apiService.getMarketItems({
                gameId: 'a8db',
                title: query,
                limit: 50, // Get more results to filter unique titles
                currency: 'USD'
            });
            
            // Filter to show only unique titles
            const seenTitles = new Set();
            const uniqueItems = (response?.objects || []).filter(item => {
                const title = item.title;
                if (!title || seenTitles.has(title)) {
                    return false;
                }
                seenTitles.add(title);
                return true;
            }).slice(0, 50); // Limit to 10 unique results
            
            setSearchResults(uniqueItems);
        } catch (err) {
            console.error('Search error:', err);
            setSearchResults([]);
        } finally {
            setSearching(false);
        }
    };

    const handleSelectItem = (item) => {
        const newWearType = getWearTypeFromTitle(item.title);
        const currentFloatValue = formData.floatPartValue;
        
        // Reset floatPartValue if it doesn't match the new wear type
        let newFloatValue = currentFloatValue;
        if (currentFloatValue && newWearType) {
            // If current float value doesn't start with the new wear type, reset it
            if (!currentFloatValue.startsWith(newWearType + '-')) {
                newFloatValue = '';
            }
        }
        
        setFormData(prev => ({
            ...prev,
            title: item.title,
            floatPartValue: newFloatValue
        }));
        setSearchResults([]);
    };

    // Reset floatPartValue when title changes manually if it doesn't match wear type
    useEffect(() => {
        const wearType = getWearTypeFromTitle(formData.title);
        if (formData.floatPartValue && wearType && formData.floatPartValue !== '') {
            // If current float value doesn't match the wear type, reset it
            if (!formData.floatPartValue.startsWith(wearType + '-')) {
                setFormData(prev => ({
                    ...prev,
                    floatPartValue: ''
                }));
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.title]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);

        try {
            // Build Attrs object - only include fields that have values
            const attrs = {};
            if (formData.floatPartValue) {
                attrs.floatPartValue = formData.floatPartValue;
            }
            if (formData.phase) {
                attrs.phase = formData.phase;
            }
            if (formData.paintSeed) {
                attrs.paintSeed = parseInt(formData.paintSeed) || 0;
            }

            // API expects PascalCase structure according to documentation
            const targetData = {
                GameID: 'a8db',
                Targets: [{
                    Amount: formData.quantity.toString(),
                    Price: {
                        Currency: 'USD',
                        Amount: parseFloat(formData.price || 0) // API expects decimal number (e.g., 0.05, 5.00)
                    },
                    Title: formData.title,
                    ...(Object.keys(attrs).length > 0 ? { Attrs: attrs } : {})
                }]
            };

            if (target) {
                await updateTarget(target.targetId, targetData);
                onSave();
            } else {
                const response = await createTarget(targetData);
                // If maxPrice was provided and onSaveWithMaxPrice callback exists, save it
                if (formData.maxPrice && onSaveWithMaxPrice) {
                    onSaveWithMaxPrice(formData.title, formData.floatPartValue || '', formData.maxPrice);
                }
                onSave();
            }
        } catch (err) {
            setError(err.message || t('target.saveError'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="target-form-container">
            <div className="target-form-header">
                <button onClick={onClose} className="btn-back">←</button>
                <h2 className="target-form-title">{target ? t('target.edit') : t('target.new')}</h2>
                <div style={{ width: '40px' }}></div>
            </div>

            <form onSubmit={handleSubmit} className="target-form">
                <div className="form-field">
                    <label>{t('target.name')}</label>
                    <div className="search-container">
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => {
                                setFormData(prev => ({ ...prev, title: e.target.value }));
                                handleSearch(e.target.value);
                            }}
                            placeholder={t('target.name')}
                            className="form-input"
                            required
                        />
                        {searchResults.length > 0 && (
                            <div className="search-results">
                                {searchResults.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="search-result-item"
                                        onClick={() => handleSelectItem(item)}
                                    >
                                        {item.title}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="form-field">
                    <label>{t('target.price')}</label>
                    <input
                        type="number"
                        value="0.03"
                        onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                        className="form-input"
                        required
                        disabled
                    />
                </div>

                <div className="form-field">
                    <label>{t('target.maxPrice')}</label>
                    <input
                        type="number"
                        step="0.01"
                        value={formData.maxPrice}
                        onChange={(e) => setFormData(prev => ({ ...prev, maxPrice: e.target.value }))}
                        className="form-input"
                    />
                </div>

                <div className="form-field">
                    <label>{t('target.quantity')}</label>
                    <input
                        type="number"
                        min="1"
                        value={formData.quantity}
                        onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                        className="form-input"
                        required
                    />
                </div>

                <div className="form-field">
                    <label>{t('target.float')}</label>
                    <select
                        value={formData.floatPartValue}
                        onChange={(e) => setFormData(prev => ({ ...prev, floatPartValue: e.target.value }))}
                        className="form-input"
                    >
                        {floatPartValueOptions.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-field">
                    <label>{t('target.phase')}</label>
                    <select
                        value={formData.phase || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, phase: e.target.value }))}
                        className="form-input"
                    >
                        <option value="">{t('target.selectPhase')}</option>
                        <option value="phase-1">Phase 1</option>
                        <option value="phase-2">Phase 2</option>
                        <option value="phase-3">Phase 3</option>
                        <option value="phase-4">Phase 4</option>
                        <option value="ruby">Ruby</option>
                        <option value="emerald">Emerald</option>
                        <option value="sapphire">Sapphire</option>
                        <option value="black-pearl">Black Pearl</option>
                    </select>
                </div>

                <div className="form-field">
                    <label>{t('target.paintSeed')}</label>
                    <input
                        type="number"
                        value={formData.paintSeed}
                        onChange={(e) => setFormData(prev => ({ ...prev, paintSeed: e.target.value }))}
                        className="form-input"
                    />
                </div>

                {error && <div className="form-error">{error}</div>}

                <div className="form-actions">
                    <button type="button" onClick={onClose} className="btn btn-secondary">
                        {t('common.cancel')}
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? t('target.saving') : t('target.createButton')}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default TargetForm;

