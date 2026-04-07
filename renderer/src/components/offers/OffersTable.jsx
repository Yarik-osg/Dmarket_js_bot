import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { DataTable } from 'mantine-datatable';
import { Button, Checkbox, Group, Menu, Text } from '@mantine/core';
import {
    RiCheckboxCircleLine,
    RiDeleteBin6Line,
    RiLayoutColumnLine,
    RiSkipForwardLine,
    RiCheckLine,
    RiLineChartLine
} from 'react-icons/ri';
import { OfferItemTitleCell } from './OfferItemTitleCell.jsx';
import { OfferPriceCell } from './OfferPriceCell.jsx';
import { PriceBoundsEditor } from './PriceBoundsEditor.jsx';
import { OfferFloatCell } from './OfferFloatCell.jsx';
import { OfferTradeLockCell } from './OfferTradeLockCell.jsx';
import { DMarketProductLinkButton } from '../DMarketProductLinkButton.jsx';
import { PriceHistoryModal } from '../PriceHistoryChart.jsx';
import { formatUsdFromApiCents } from '../../utils/formatUsd.js';
import { getOfferId, getOfferTitle } from '../../hooks/useOffers.js';

const COLUMN_STORAGE_KEY = 'offersTableColumnVisibility';
const COLUMN_IDS = ['num', 'itemTitle', 'tradeLock', 'ourPrice', 'marketPrice', 'minPrice', 'float', 'actions'];

function loadColumnVisibility() {
    try {
        const raw = localStorage.getItem(COLUMN_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
    } catch {
        /* ignore */
    }
    return null;
}

function ourPriceSortNumber(offer) {
    const price = offer.price?.USD;
    if (price === undefined || price === null || price === 'N/A') return 0;
    if (typeof price === 'number') {
        const s = price.toString();
        if (s.includes('e') || s.includes('.')) return price;
        return price / 100;
    }
    const str = String(price).trim();
    if (str === '') return 0;
    if (str.includes('.') || /e/i.test(str)) {
        const n = parseFloat(str);
        return Number.isNaN(n) ? 0 : n;
    }
    const cents = parseInt(str, 10);
    return Number.isNaN(cents) ? 0 : cents / 100;
}

function marketSortNumber(offer, marketPrices) {
    const id = getOfferId(offer);
    const m = marketPrices[id];
    if (!m || m === 'N/A') return -Infinity;
    const n = parseFloat(String(m).replace(/[^0-9.-]/g, ''));
    return Number.isNaN(n) ? -Infinity : n;
}

function minPriceSortNumber(offer, minPrices, pendingMinPrices) {
    const itemId = offer.itemId;
    const raw = pendingMinPrices[itemId] ?? minPrices[itemId] ?? offer.minPrice;
    if (raw === undefined || raw === null || raw === '') return 0;
    const n = parseFloat(String(raw));
    return Number.isNaN(n) ? 0 : n;
}

function floatSortNumber(offer) {
    const fv = offer.extra?.floatValue;
    if (fv === undefined || fv === null) return Infinity;
    const n = parseFloat(fv);
    return Number.isNaN(n) ? Infinity : n;
}

function tradeLockSortNumber(offer) {
    const d = offer.extra?.tradeLockDuration;
    if (!d || d <= 0) return 0;
    return d;
}

function compareSort(a, b, columnAccessor, ctx) {
    let va, vb;
    switch (columnAccessor) {
        case 'itemTitle':
            va = getOfferTitle(a, '').toLowerCase();
            vb = getOfferTitle(b, '').toLowerCase();
            return va.localeCompare(vb, 'uk');
        case 'ourPrice':
            va = ourPriceSortNumber(a);
            vb = ourPriceSortNumber(b);
            break;
        case 'marketPrice':
            va = marketSortNumber(a, ctx.marketPrices);
            vb = marketSortNumber(b, ctx.marketPrices);
            break;
        case 'minPrice':
            va = minPriceSortNumber(a, ctx.minPrices, ctx.pendingMinPrices);
            vb = minPriceSortNumber(b, ctx.minPrices, ctx.pendingMinPrices);
            break;
        case 'float':
            va = floatSortNumber(a);
            vb = floatSortNumber(b);
            break;
        case 'tradeLock':
            va = tradeLockSortNumber(a);
            vb = tradeLockSortNumber(b);
            break;
        default:
            return 0;
    }
    if (va < vb) return -1;
    if (va > vb) return 1;
    return 0;
}

export function OffersTable({
    t,
    filteredOffers,
    offersLength,
    searchQuery,
    onClearSearch,
    marketPrices,
    loadingMarketPrices,
    loadingTable,
    minPrices,
    pendingMinPrices,
    maxPrices,
    pendingMaxPrices,
    onMinPricePendingChange,
    onMaxPricePendingChange,
    onApplyPriceBounds,
    onCancelPriceBounds,
    skipForParsing,
    onSkipChange,
    updating,
    onDelete,
    unknownItemLabel
}) {
    const [priceHistoryTitle, setPriceHistoryTitle] = useState(null);

    const [sortStatus, setSortStatus] = useState({
        columnAccessor: 'itemTitle',
        direction: 'asc'
    });

    const [visibleColumns, setVisibleColumns] = useState(() => {
        const loaded = loadColumnVisibility();
        const base = {};
        for (const id of COLUMN_IDS) base[id] = loaded?.[id] !== false;
        return base;
    });

    useEffect(() => {
        try {
            localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(visibleColumns));
        } catch {
            /* ignore */
        }
    }, [visibleColumns]);

    const toggleColumn = useCallback((id) => {
        if (id === 'num' || id === 'actions') return;
        setVisibleColumns((prev) => ({ ...prev, [id]: !prev[id] }));
    }, []);

    const sortCtx = useMemo(
        () => ({ marketPrices, minPrices, pendingMinPrices }),
        [marketPrices, minPrices, pendingMinPrices]
    );

    const sortedRecords = useMemo(() => {
        const rows = [...filteredOffers];
        const { columnAccessor, direction } = sortStatus;
        const mult = direction === 'asc' ? 1 : -1;
        rows.sort((a, b) => mult * compareSort(a, b, columnAccessor, sortCtx));
        return rows;
    }, [filteredOffers, sortStatus, sortCtx]);

    useEffect(() => {
        if (visibleColumns[sortStatus.columnAccessor] !== false) return;
        const fallback = ['itemTitle', 'ourPrice', 'marketPrice', 'minPrice', 'float'].find(
            (a) => visibleColumns[a] !== false
        );
        setSortStatus({ columnAccessor: fallback || 'itemTitle', direction: 'asc' });
    }, [visibleColumns, sortStatus.columnAccessor]);

    const allColumns = useMemo(
        () => [
            {
                accessor: 'num',
                title: t('offers.number'),
                sortable: false,
                width: 52,
                textAlign: 'center',
                render: (_record, index) => index + 1
            },
            {
                accessor: 'itemTitle',
                title: t('offers.item'),
                sortable: true,
                width: 260,
                render: (offer) => (
                    <OfferItemTitleCell
                        offer={offer}
                        title={getOfferTitle(offer, unknownItemLabel)}
                    />
                )
            },
            {
                accessor: 'tradeLock',
                title: t('offers.tradeLock'),
                sortable: true,
                width: 100,
                render: (offer) => <OfferTradeLockCell offer={offer} />
            },
            {
                accessor: 'ourPrice',
                title: t('offers.ourPrice'),
                sortable: true,
                width: 120,
                render: (offer) => <OfferPriceCell offer={offer} />
            },
            {
                accessor: 'marketPrice',
                title: t('offers.marketPrice'),
                sortable: true,
                width: 110,
                render: (offer) => {
                    const offerId = getOfferId(offer);
                    const mp = marketPrices[offerId] || (loadingMarketPrices ? '...' : 'N/A');
                    return <span className="offer-market-price">{mp !== 'N/A' && mp !== '...' ? `$${mp}` : mp}</span>;
                }
            },
            {
                accessor: 'minPrice',
                title: t('offers.priceBoundsColumn'),
                sortable: true,
                width: 280,
                render: (offer) => (
                    <PriceBoundsEditor
                        itemId={offer.itemId}
                        pendingMinPrices={pendingMinPrices}
                        pendingMaxPrices={pendingMaxPrices}
                        minPrices={minPrices}
                        maxPrices={maxPrices}
                        offerMinPrice={offer.minPrice}
                        onMinPendingChange={onMinPricePendingChange}
                        onMaxPendingChange={onMaxPricePendingChange}
                        onApply={onApplyPriceBounds}
                        onCancel={onCancelPriceBounds}
                        disabled={updating}
                        minLabel={t('offers.minPrice')}
                        maxLabel={t('offers.maxPrice')}
                        cancelTitle={t('offers.priceBoundsCancel')}
                    />
                )
            },
            {
                accessor: 'float',
                title: t('offers.float'),
                sortable: true,
                width: 160,
                render: (offer) => {
                    const fv = offer.extra?.floatValue
                        ? parseFloat(offer.extra.floatValue).toFixed(5)
                        : 'N/A';
                    return <OfferFloatCell floatValue={fv} />;
                }
            },
            {
                accessor: 'actions',
                title: t('offers.actions'),
                sortable: false,
                width: 160,
                render: (offer) => {
                    const itemId = offer.itemId;
                    const title = getOfferTitle(offer, unknownItemLabel);
                    return (
                        <div className="offer-actions">
                            <button
                                type="button"
                                className="btn-icon"
                                title="Історія цін"
                                onClick={() => setPriceHistoryTitle(title)}
                            >
                                <RiLineChartLine size={18} />
                            </button>
                            <DMarketProductLinkButton item={offer} className="offer-item-dmarket-btn" />
                            <button
                                type="button"
                                className={
                                    skipForParsing[itemId] === true
                                        ? 'btn-icon btn-icon-skip'
                                        : 'btn-icon'
                                }
                                onClick={() =>
                                    onSkipChange(itemId, skipForParsing[itemId] !== true)
                                }
                                title={
                                    skipForParsing[itemId]
                                        ? 'Офер пропускається під час парсингу'
                                        : 'Офер бере участь у парсингу'
                                }
                                aria-pressed={skipForParsing[itemId] === true}
                            >
                                {skipForParsing[itemId] === true ? (
                                    <RiSkipForwardLine size={18} aria-hidden />
                                ) : (
                                    <RiCheckboxCircleLine size={18} aria-hidden />
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => onDelete(offer)}
                                className="btn-icon btn-icon-danger"
                                title={t('common.delete')}
                            >
                                <RiDeleteBin6Line size={18} />
                            </button>
                        </div>
                    );
                }
            }
        ],
        [
            t,
            unknownItemLabel,
            marketPrices,
            loadingMarketPrices,
            minPrices,
            pendingMinPrices,
            maxPrices,
            pendingMaxPrices,
            onMinPricePendingChange,
            onMaxPricePendingChange,
            onApplyPriceBounds,
            onCancelPriceBounds,
            skipForParsing,
            onSkipChange,
            updating,
            onDelete,
            setPriceHistoryTitle
        ]
    );

    const columns = useMemo(
        () => allColumns.filter((c) => visibleColumns[c.accessor] !== false),
        [allColumns, visibleColumns]
    );

    const emptyState = (
        <div className="offers-datatable-empty">
            <Text size="sm" c="dimmed">
                {offersLength === 0
                    ? t('offers.empty')
                    : searchQuery
                      ? t('offers.searchNoResults')
                      : t('offers.empty')}
            </Text>
            {offersLength > 0 && searchQuery ? (
                <Button variant="light" size="xs" mt="sm" onClick={onClearSearch}>
                    {t('offers.clearSearch')}
                </Button>
            ) : null}
        </div>
    );

    return (
        <div className="offers-table-container offers-table-container--mantine">
            <Group justify="flex-end" mb="xs" gap="xs" wrap="wrap">
                <Menu shadow="md" width={260} position="bottom-end">
                    <Menu.Target>
                        <Button
                            variant="light"
                            size="xs"
                            leftSection={<RiLayoutColumnLine size={16} />}
                        >
                            {t('offers.columns')}
                        </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Label>{t('offers.columnsHint')}</Menu.Label>
                        {allColumns.map((col) => {
                            const id = col.accessor;
                            const locked = id === 'num' || id === 'actions';
                            return (
                                <div key={id} className="offers-column-menu-row">
                                    <Checkbox
                                        label={columnLabel(id, t)}
                                        checked={visibleColumns[id] !== false}
                                        disabled={locked}
                                        onChange={() => toggleColumn(id)}
                                    />
                                </div>
                            );
                        })}
                    </Menu.Dropdown>
                </Menu>
            </Group>

            <DataTable
                className={`offers-mantine-datatable${loadingTable ? ' offers-mantine-datatable--loading' : ''}`}
                minHeight={280}
                verticalAlign="middle"
                highlightOnHover
                records={sortedRecords}
                columns={columns}
                sortStatus={sortStatus}
                onSortStatusChange={setSortStatus}
                idAccessor={(record) => {
                    const id = getOfferId(record);
                    if (id != null && id !== '') return String(id);
                    return `row-${record.title}-${record.itemId}`;
                }}
                fetching={loadingTable}
                noRecordsText=""
                emptyState={filteredOffers.length === 0 ? emptyState : undefined}
            />

            {priceHistoryTitle && (
                <PriceHistoryModal
                    itemTitle={priceHistoryTitle}
                    onClose={() => setPriceHistoryTitle(null)}
                />
            )}
        </div>
    );
}

function columnLabel(accessor, t) {
    switch (accessor) {
        case 'num':
            return t('offers.number');
        case 'itemTitle':
            return t('offers.item');
        case 'tradeLock':
            return t('offers.tradeLock');
        case 'ourPrice':
            return t('offers.ourPrice');
        case 'marketPrice':
            return t('offers.marketPrice');
        case 'minPrice':
            return t('offers.priceBoundsColumn');
        case 'float':
            return t('offers.float');
        case 'actions':
            return t('offers.actions');
        default:
            return accessor;
    }
}
