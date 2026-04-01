import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { useLogs } from '../contexts/LogsContext.jsx';
import { ApiService } from '../services/apiService.js';
import '../styles/OfferForm.css';

function OfferForm({ onClose, onSave }) {
    const { t } = useLocale();
    const { client } = useAuth();
    const { addLog } = useLogs();
    const apiService = useMemo(() => {
        return client ? new ApiService(client) : null;
    }, [client]);

    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedItems, setSelectedItems] = useState([]); // Array of { assetId, price, skipForParsing }
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const loadInventory = async () => {
            if (!apiService) return;

            setLoading(true);
            setError(null);
            try {
                // API endpoint: /exchange/v1/user/items
                // Parameters: side=user, orderBy=updated, orderDir=desc, gameId=a8db, limit=100, currency=USD, platform=browser
                // treeFilters=itemLocation[]=true (URL encoded as itemLocation%5B%5D=true)
                const response = await apiService.getUserItems({
                    side: 'user',
                    orderBy: 'updated',
                    orderDir: 'desc',
                    'treeFilters': 'itemLocation[]=true',
                    gameId: 'a8db',
                    limit: 100,
                    currency: 'USD'
                });
                console.log('response', response);
                // API returns { objects: [...] } structure
                const items = response?.objects || response?.Items || [];
                console.log('Loaded inventory:', items.length, items);
                setInventory(items);
            } catch (err) {
                setError(err.message);
                console.error('Error loading inventory:', err);
            } finally {
                setLoading(false);
            }
        };

        if (apiService) {
            loadInventory();
        }
    }, [apiService]);

    // Helper function to get item identifier (itemId or AssetID)
    const getItemId = (item) => {
        return item.itemId || item.AssetID || item.assetId;
    };

    // Helper function to get item title
    const getItemTitle = (item) => {
        return item.title || item.Title || item.extra?.name || 'Unknown';
    };

    const handleItemSelect = (item) => {
        const assetId = getItemId(item);
        if (!assetId) return;

        const existingIndex = selectedItems.findIndex(si => si.assetId === assetId);
        if (existingIndex >= 0) {
            // Remove if already selected
            setSelectedItems(selectedItems.filter((_, i) => i !== existingIndex));
        } else {
            // Add new item with default price
            // Use recommendedPrice.offerPrice.USD or instantPrice.USD (both in cents, convert to dollars)
            let defaultPrice = '0.01';
            if (item.recommendedPrice?.offerPrice?.USD) {
                const priceInCents = parseFloat(item.recommendedPrice.offerPrice.USD);
                if (priceInCents > 0) {
                    defaultPrice = (priceInCents / 100).toFixed(2);
                }
            } else if (item.instantPrice?.USD) {
                const priceInCents = parseFloat(item.instantPrice.USD);
                if (priceInCents > 0) {
                    defaultPrice = (priceInCents / 100).toFixed(2);
                }
            }
            setSelectedItems([...selectedItems, { assetId, price: defaultPrice, skipForParsing: false }]);
        }
    };

    const handlePriceChange = (assetId, newPrice) => {
        setSelectedItems(selectedItems.map(item => 
            item.assetId === assetId ? { ...item, price: newPrice } : item
        ));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!apiService || selectedItems.length === 0) return;

        setLoading(true);
        setError(null);

        try {
            // v2 batchCreate: price in whole cents (USD)
            const requestBody = {
                requests: selectedItems.map((item) => {
                    const dollars = parseFloat(item.price);
                    const safeDollars = !Number.isNaN(dollars) && dollars > 0 ? dollars : 0.01;
                    return {
                        assetId: item.assetId,
                        priceCents: Math.round(safeDollars * 100)
                    };
                })
            };

            console.log('Creating offers:', requestBody);
            await apiService.createOffer(requestBody);
            
            // Save skipForParsing settings for created offers
            // We need to match assetId with itemId after offers are created
            // For now, save by assetId - will be matched when offers are loaded
            try {
                const savedSkipForParsing = JSON.parse(localStorage.getItem('offersSkipForParsing') || '{}');
                selectedItems.forEach(item => {
                    if (item.skipForParsing) {
                        // Save by assetId - will be matched to itemId when offers are loaded
                        savedSkipForParsing[item.assetId] = true;
                    }
                });
                localStorage.setItem('offersSkipForParsing', JSON.stringify(savedSkipForParsing));
            } catch (err) {
                console.error('Error saving skipForParsing:', err);
            }
            
            const itemsCount = selectedItems.length;
            const itemsTitles = selectedItems.map(item => {
                const inventoryItem = inventory.find(i => getItemId(i) === item.assetId);
                return getItemTitle(inventoryItem) || 'Невідомий предмет';
            }).join(', ');
            
            addLog({
                type: 'success',
                category: 'offer',
                message: `Створено ${itemsCount} офер${itemsCount > 1 ? 'ів' : ''}`,
                details: { count: itemsCount, items: itemsTitles }
            });
            
            if (onSave) {
                onSave();
            }
            onClose();
        } catch (err) {
            setError(err.message || 'Помилка створення оферів');
            console.error('Error creating offers:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredInventory = inventory.filter(item => {
        const title = getItemTitle(item);
        return title.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const isItemSelected = (item) => {
        const assetId = getItemId(item);
        return selectedItems.some(si => si.assetId === assetId);
    };

    const getSelectedItemPrice = (item) => {
        const assetId = getItemId(item);
        const selected = selectedItems.find(si => si.assetId === assetId);
        return selected ? selected.price : '';
    };

    // Calculate fee percentage based on item's fees and price
    const getFeePercentage = (item, price) => {

        if (!item || !item.fees || !item.fees.dmarket || !item.fees.dmarket.sell) {
            return 10; // Default fee if no fees info
        }

        const sellFees = item.fees.dmarket.sell;

        // If no custom field exists, use default
        if (!sellFees.custom) {
            return parseFloat(sellFees.default?.percentage || 10);
        }

        // Check if custom fee conditions are met
        const custom = sellFees.custom;
        const conditions = custom.conditions || {};
        const priceInCents = Math.round(parseFloat(price) * 100); // Convert to cents
        const currentTime = Math.floor(Date.now() / 1000); // Current timestamp in seconds
        const minPrice = parseFloat(conditions.minPrice?.USD || 0);
        const maxPrice = parseFloat(conditions.maxPrice?.USD || Infinity);
        const startsAt = conditions.startsAt || 0;
        const expiresAt = conditions.expiresAt || Infinity;


        // Check if price is within range and time is valid
        if (priceInCents >= minPrice && priceInCents <= maxPrice &&
            currentTime >= startsAt && currentTime <= expiresAt) {
            return parseFloat(custom.percentage || 10);
        }

        // Use default fee if custom doesn't apply
        return parseFloat(sellFees.default?.percentage || 10);
    };

    // Helper function to determine if custom fee applies
    const isCustomFeeApplicable = (item, price) => {
        if (!item?.fees?.dmarket?.sell?.custom) {
            return false; // No custom field, use default
        }

        const custom = item.fees.dmarket.sell.custom;
        const conditions = custom.conditions || {};
        const priceInCents = Math.round(parseFloat(price) * 100);
        const currentTime = Math.floor(Date.now() / 1000);
        const minPrice = parseFloat(conditions.minPrice?.USD || 0);
        const maxPrice = parseFloat(conditions.maxPrice?.USD || Infinity);
        const startsAt = conditions.startsAt || 0;
        const expiresAt = conditions.expiresAt || Infinity;

        return priceInCents >= minPrice && priceInCents <= maxPrice &&
               currentTime >= startsAt && currentTime <= expiresAt;
    };

    // Calculate amount after fee (considering minFee)
    const calculateYouGet = (item, price) => {
        const priceNum = parseFloat(price) || 0;
        if (priceNum <= 0) return '0.00';

        const feePercentage = getFeePercentage(item, price);
        const priceInCents = Math.round(priceNum * 100);
        
        // Get minFee - use custom if applicable, otherwise default
        let minFee = 0;
        if (isCustomFeeApplicable(item, price)) {
            minFee = parseFloat(item.fees.dmarket.sell.custom.minFee?.USD || 0);
        } else if (item?.fees?.dmarket?.sell?.default) {
            minFee = parseFloat(item.fees.dmarket.sell.default.minFee?.USD || 0);
        }

        // Calculate fee amount
        const feeAmount = Math.max(
            Math.round(priceInCents * feePercentage / 100),
            minFee
        );

        // Calculate amount after fee
        const youGetCents = priceInCents - feeAmount;
        return (youGetCents / 100).toFixed(2);
    };

    return (
        <div className="offer-form-overlay">
            <div className="offer-form-container">
                <div className="offer-form-header">
                    <h2>Створити офери з інвентаря</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                {loading && !inventory.length && (
                    <div className="loading">Завантаження інвентаря...</div>
                )}
                {error && (
                    <div className="error">{error}</div>
                )}

                <form onSubmit={handleSubmit} className="offer-form">
                    <div className="offer-form-section">
                        <div className="offer-form-search">
                            <input
                                type="text"
                                placeholder="Пошук предметів..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="search-input"
                            />
                        </div>

                        <div className="inventory-list">
                            {filteredInventory.length === 0 ? (
                                <div className="empty-state">Інвентар порожній або не знайдено предметів</div>
                            ) : (
                                filteredInventory.map((item, index) => {
                                    const assetId = getItemId(item);
                                    const title = getItemTitle(item);
                                    const floatValue = item.extra?.floatValue;
                                    const floatPartValue = item.extra?.floatPartValue;
                                    const exterior = item.extra?.exterior;
                                    const isSelected = isItemSelected(item);
                                    const selectedPrice = getSelectedItemPrice(item);

                                    return (
                                        <div 
                                            key={assetId || index} 
                                            className={`inventory-item ${isSelected ? 'selected' : ''}`}
                                        >
                                            <div className="inventory-item-checkbox">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleItemSelect(item)}
                                                />
                                            </div>
                                            <div className="inventory-item-info">
                                                <div className="inventory-item-title">{title}</div>
                                                <div className="inventory-item-details">
                                                    {exterior && <span className="detail-badge">{exterior}</span>}
                                                    {floatPartValue && <span className="detail-badge">{floatPartValue}</span>}
                                                    {floatValue && (
                                                        <span className="detail-badge">
                                                            Float: {parseFloat(floatValue).toFixed(5)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <div className="inventory-item-price">
                                                    <div className="price-input-group">
                                                        <div className="price-input-wrapper">
                                                            <label>Ціна ($):</label>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                min="0.01"
                                                                value={selectedPrice}
                                                                onChange={(e) => handlePriceChange(assetId, e.target.value)}
                                                                className="price-input"
                                                            />
                                                        </div>
                                                        <div className="price-calc-info">
                                                            <div className="price-calc-row">
                                                                <span className="price-calc-label">Комісія:</span>
                                                                <span className="price-calc-value fee">{getFeePercentage(item, selectedPrice)}%</span>
                                                            </div>
                                                            <div className="price-calc-row">
                                                                <span className="price-calc-label">Отримаєте:</span>
                                                                <span className="price-calc-value you-get">${calculateYouGet(item, selectedPrice)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {selectedItems.length > 0 && (
                        <div className="offer-form-summary">
                            <div className="summary-title">
                                Вибрано предметів: {selectedItems.length}
                            </div>
                            <div className="summary-items">
                                {selectedItems.map((item, index) => {
                                    const inventoryItem = inventory.find(i => getItemId(i) === item.assetId);
                                    const title = getItemTitle(inventoryItem);
                                    const feePercentage = getFeePercentage(inventoryItem, item.price);
                                    const youGet = calculateYouGet(inventoryItem, item.price);
                                    return (
                                        <div key={index} className="summary-item">
                                            <span>{title}</span>
                                            <div className="summary-item-prices">
                                                <span className="summary-price">${item.price}</span>
                                                <span className="summary-fee">({feePercentage}%)</span>
                                                <span className="summary-you-get">→ ${youGet}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="offer-form-actions">
                        <button type="button" onClick={onClose} className="btn btn-secondary">
                            Скасувати
                        </button>
                        <button 
                            type="submit" 
                            className="btn btn-primary"
                            disabled={loading || selectedItems.length === 0}
                        >
                            {loading ? 'Створення...' : `Створити ${selectedItems.length} офер(ів)`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default OfferForm;

