import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { DataTable } from 'mantine-datatable';
import { Button, Checkbox, Group, Menu, Text } from '@mantine/core';
import { RiDeleteBin6Line, RiPlayCircleLine, RiPauseCircleLine, RiLayoutColumnLine } from 'react-icons/ri';
import { TargetItemTitleCell } from './TargetItemTitleCell.jsx';
import { MarketPriceCell } from './MarketPriceCell.jsx';
import { MaxPriceEditor } from './MaxPriceEditor.jsx';
import { QuantityEditor } from './QuantityEditor.jsx';
import { formatUsdFromApiCents } from '../../utils/formatUsd.js';

const COLUMN_STORAGE_KEY = 'targetsTableColumnVisibility';

const COLUMN_IDS = ['num', 'itemTitle', 'ourPrice', 'marketPrice', 'maxPrice', 'amount', 'actions'];

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

function getTargetRowId(target) {
    return target.targetId || target.itemId || target.instantTargetId;
}

function getTitle(target, unknownLabel) {
    return target.itemTitle || target.title || target.extra?.name || unknownLabel;
}

/** USD amount as number for sorting (matches display cents/dollars rules). */
function ourPriceSortNumber(target) {
    const price = target.price?.USD;
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

function marketSortNumber(target, marketPrices) {
    const id = getTargetRowId(target);
    const m = marketPrices[id];
    if (!m || m === 'N/A') return -Infinity;
    const n = parseFloat(String(m).replace(/[^0-9.-]/g, ''));
    return Number.isNaN(n) ? -Infinity : n;
}

function maxPriceSortNumber(target, maxPrices, pendingMaxPrices) {
    const itemId = target.itemId;
    const raw = pendingMaxPrices[itemId] ?? maxPrices[itemId] ?? target.maxPrice;
    if (raw === undefined || raw === null || raw === '') return 0;
    const n = parseFloat(String(raw));
    return Number.isNaN(n) ? 0 : n;
}

function compareSort(a, b, columnAccessor, ctx) {
    let va;
    let vb;
    switch (columnAccessor) {
        case 'itemTitle':
            va = getTitle(a, ctx.unknownItemLabel).toLowerCase();
            vb = getTitle(b, ctx.unknownItemLabel).toLowerCase();
            return va.localeCompare(vb, 'uk');
        case 'ourPrice':
            va = ourPriceSortNumber(a);
            vb = ourPriceSortNumber(b);
            break;
        case 'marketPrice':
            va = marketSortNumber(a, ctx.marketPrices);
            vb = marketSortNumber(b, ctx.marketPrices);
            break;
        case 'maxPrice':
            va = maxPriceSortNumber(a, ctx.maxPrices, ctx.pendingMaxPrices);
            vb = maxPriceSortNumber(b, ctx.maxPrices, ctx.pendingMaxPrices);
            break;
        case 'amount':
            va = Number(a.amount) || 1;
            vb = Number(b.amount) || 1;
            break;
        default:
            return 0;
    }
    if (va < vb) return -1;
    if (va > vb) return 1;
    return 0;
}

export function TargetsTable({
    t,
    filteredTargets,
    targetsLength,
    searchMatchCount,
    onlyActiveFilter = false,
    onClearActiveFilter,
    searchQuery,
    onClearSearch,
    marketPrices,
    loadingMarketPrices,
    loadingTable,
    maxPrices,
    pendingMaxPrices,
    pendingAmounts,
    onMaxPricePendingChange,
    onApplyMaxPrice,
    onQuantityPendingChange,
    onQuantityBlur,
    updating,
    onDeactivate,
    onActivate,
    onDelete,
    getFloatRange,
    unknownItemLabel,
    marketLegendText
}) {
    const [sortStatus, setSortStatus] = useState({
        columnAccessor: 'itemTitle',
        direction: 'asc'
    });

    const [visibleColumns, setVisibleColumns] = useState(() => {
        const loaded = loadColumnVisibility();
        const base = {};
        for (const id of COLUMN_IDS) {
            base[id] = loaded?.[id] !== false;
        }
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
        () => ({
            marketPrices,
            maxPrices,
            pendingMaxPrices,
            unknownItemLabel
        }),
        [marketPrices, maxPrices, pendingMaxPrices, unknownItemLabel]
    );

    const sortedRecords = useMemo(() => {
        const rows = [...filteredTargets];
        const { columnAccessor, direction } = sortStatus;
        const mult = direction === 'asc' ? 1 : -1;
        rows.sort((a, b) => mult * compareSort(a, b, columnAccessor, sortCtx));
        return rows;
    }, [filteredTargets, sortStatus, sortCtx]);

    useEffect(() => {
        if (visibleColumns[sortStatus.columnAccessor] !== false) return;
        const fallback = ['itemTitle', 'ourPrice', 'marketPrice', 'maxPrice', 'amount'].find(
            (a) => visibleColumns[a] !== false
        );
        setSortStatus({
            columnAccessor: fallback || 'itemTitle',
            direction: 'asc'
        });
    }, [visibleColumns, sortStatus.columnAccessor]);

    const allColumns = useMemo(
        () => [
            {
                accessor: 'num',
                title: t('targets.number'),
                sortable: false,
                width: 52,
                textAlign: 'center',
                render: (_record, index) => index + 1
            },
            {
                accessor: 'itemTitle',
                title: t('targets.item'),
                sortable: true,
                render: (target) => {
                    const title = getTitle(target, unknownItemLabel);
                    const status = target.status || 'N/A';
                    const floatPartValue =
                        target.extra?.floatPartValue || target.attributes?.floatPartValue || 'N/A';
                    const floatRange = getFloatRange(floatPartValue);
                    const phase = target.attributes?.phase || target.extra?.phase || null;
                    const paintSeed = target.attributes?.paintSeed || target.extra?.paintSeed || null;
                    return (
                        <TargetItemTitleCell
                            target={target}
                            title={title}
                            status={status}
                            floatPartValue={floatPartValue}
                            floatRange={floatRange}
                            phase={phase}
                            paintSeed={paintSeed}
                        />
                    );
                }
            },
            {
                accessor: 'ourPrice',
                title: t('targets.ourPrice'),
                sortable: true,
                render: (target) => {
                    const price = target.price?.USD || 'N/A';
                    const formattedPrice = formatUsdFromApiCents(price);
                    return (
                        <span className="price-cell" title={`Ваша ціна: $${formattedPrice}`}>
                            ${formattedPrice}
                        </span>
                    );
                }
            },
            {
                accessor: 'marketPrice',
                title: (
                    <span className="targets-th-market-mantine">
                        <span className="targets-th-market-title">{t('targets.marketPrice')}</span>
                        {marketLegendText ? (
                            <span className="targets-th-market-legend">{marketLegendText}</span>
                        ) : null}
                    </span>
                ),
                sortable: true,
                render: (target) => {
                    const targetId = getTargetRowId(target);
                    const price = target.price?.USD || 'N/A';
                    const formattedPrice = formatUsdFromApiCents(price);
                    return (
                        <MarketPriceCell
                            loadingMarketPrices={loadingMarketPrices}
                            marketPrice={marketPrices[targetId]}
                            formattedOurPrice={formattedPrice}
                        />
                    );
                }
            },
            {
                accessor: 'maxPrice',
                title: t('targets.maxPrice'),
                sortable: true,
                width: 180,
                render: (target) => {
                    const itemId = target.itemId;
                    return (
                        <MaxPriceEditor
                            itemId={itemId}
                            pendingMaxPrices={pendingMaxPrices}
                            maxPrices={maxPrices}
                            targetMaxPrice={target.maxPrice}
                            onPendingChange={onMaxPricePendingChange}
                            onApply={onApplyMaxPrice}
                            disabled={updating}
                        />
                    );
                }
            },
            {
                accessor: 'amount',
                title: t('targets.quantity'),
                sortable: true,
                render: (target) => {
                    const targetId = getTargetRowId(target);
                    const itemId = target.itemId;
                    const title = getTitle(target, unknownItemLabel);
                    const gameId = target.gameId || 'a8db';
                    const amount = target.amount || 1;
                    const floatPartValue =
                        target.extra?.floatPartValue || target.attributes?.floatPartValue || 'N/A';
                    const phase = target.attributes?.phase || target.extra?.phase || null;
                    const paintSeed = target.attributes?.paintSeed || target.extra?.paintSeed || null;
                    const price = target.price?.USD || 'N/A';
                    return (
                        <QuantityEditor
                            targetId={targetId}
                            amount={amount}
                            pendingAmounts={pendingAmounts}
                            onPendingChange={onQuantityPendingChange}
                            onBlurCommit={(tid, val) =>
                                onQuantityBlur(
                                    tid,
                                    itemId,
                                    val,
                                    title,
                                    gameId,
                                    floatPartValue !== 'N/A' ? floatPartValue : null,
                                    phase,
                                    paintSeed,
                                    amount,
                                    price
                                )
                            }
                        />
                    );
                }
            },
            {
                accessor: 'actions',
                title: t('targets.actions'),
                sortable: false,
                width: 110,
                textAlign: 'center',
                render: (target) => {
                    const targetId = getTargetRowId(target);
                    const status = target.status || 'N/A';
                    return (
                        <div className="target-actions">
                            {status === 'active' ? (
                                <button
                                    type="button"
                                    onClick={() => onDeactivate(targetId)}
                                    className="btn-icon"
                                    title="Деактивувати таргет"
                                    disabled={updating}
                                >
                                    <RiPauseCircleLine size={18} />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => onActivate(targetId)}
                                    className="btn-icon"
                                    title="Активувати таргет"
                                    disabled={updating}
                                >
                                    <RiPlayCircleLine size={18} />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => onDelete(targetId)}
                                className="btn-icon btn-icon-danger"
                                title="Видалити"
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
            getFloatRange,
            marketPrices,
            loadingMarketPrices,
            marketLegendText,
            maxPrices,
            pendingMaxPrices,
            pendingAmounts,
            onMaxPricePendingChange,
            onApplyMaxPrice,
            onQuantityPendingChange,
            onQuantityBlur,
            updating,
            onDeactivate,
            onActivate,
            onDelete
        ]
    );

    const columns = useMemo(
        () => allColumns.filter((c) => visibleColumns[c.accessor] !== false),
        [allColumns, visibleColumns]
    );

    const searchMatches = searchMatchCount ?? filteredTargets.length;
    const isActiveOnlyEmpty =
        onlyActiveFilter && searchMatches > 0 && filteredTargets.length === 0;

    const emptyMessage =
        targetsLength === 0
            ? t('targets.empty')
            : isActiveOnlyEmpty
              ? t('targets.emptyActiveOnly')
              : searchQuery && searchMatches === 0
                ? t('targets.searchNoResults')
                : t('targets.empty');

    const emptyState = (
        <div className="targets-datatable-empty">
            <Text size="sm" c="dimmed">
                {emptyMessage}
            </Text>
            {targetsLength > 0 && searchQuery && searchMatches === 0 ? (
                <Button variant="light" size="xs" mt="sm" onClick={onClearSearch}>
                    {t('targets.clearSearch')}
                </Button>
            ) : null}
            {isActiveOnlyEmpty && onClearActiveFilter ? (
                <Button variant="light" size="xs" mt="sm" onClick={onClearActiveFilter}>
                    {t('targets.showAllTargets')}
                </Button>
            ) : null}
        </div>
    );

    return (
        <div className="targets-table-container targets-table-container--mantine">
            <Group justify="flex-end" mb="xs" gap="xs" wrap="wrap">
                <Menu shadow="md" width={260} position="bottom-end">
                    <Menu.Target>
                        <Button
                            variant="light"
                            size="xs"
                            leftSection={<RiLayoutColumnLine size={16} />}
                        >
                            {t('targets.columns')}
                        </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Label>{t('targets.columnsHint')}</Menu.Label>
                        {allColumns.map((col) => {
                            const id = col.accessor;
                            const locked = id === 'num' || id === 'actions';
                            return (
                                <div key={id} className="targets-column-menu-row">
                                    <Checkbox
                                        label={columnLabelText(id, t)}
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
                className={`targets-mantine-datatable${loadingTable ? ' targets-mantine-datatable--loading' : ''}`}
                minHeight={280}
                verticalAlign="middle"
                highlightOnHover
                records={sortedRecords}
                columns={columns}
                sortStatus={sortStatus}
                onSortStatusChange={setSortStatus}
                idAccessor={(record) => {
                    const id = getTargetRowId(record);
                    if (id != null && id !== '') return String(id);
                    const title = getTitle(record, unknownItemLabel);
                    const fp =
                        record.extra?.floatPartValue || record.attributes?.floatPartValue || '';
                    return `row-${title}-${fp}`;
                }}
                fetching={loadingTable}
                noRecordsText=""
                emptyState={filteredTargets.length === 0 ? emptyState : undefined}
            />
        </div>
    );
}

function columnLabelText(accessor, t) {
    switch (accessor) {
        case 'num':
            return t('targets.number');
        case 'itemTitle':
            return t('targets.item');
        case 'ourPrice':
            return t('targets.ourPrice');
        case 'marketPrice':
            return t('targets.marketPrice');
        case 'maxPrice':
            return t('targets.maxPrice');
        case 'amount':
            return t('targets.quantity');
        case 'actions':
            return t('targets.actions');
        default:
            return accessor;
    }
}
