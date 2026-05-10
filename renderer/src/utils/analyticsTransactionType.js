/**
 * Класифікація транзакцій DMarket для локальної аналітики (не чіпає PnL sale/purchase логіку окремо).
 *
 * - cash_deposit — поповнення балансу грошима (0x… у subject, або type cash_deposit).
 * - deposit — завіз предмета на DMarket (~$0 або type deposit для шмотки).
 * - withdraw — вивід предмета з DMarket (~$0 або type withdraw для шмотки).
 * - cash_withdraw — вивід грошей з балансу.
 */

function looksLikeEthStyleAddress(subject) {
    const s = String(subject || '').trim();
    if (!s.startsWith('0x')) return false;
    const hex = s.slice(2);
    return /^[a-fA-F0-9]{20,}$/.test(hex);
}

function looksLikeSkinItemTitle(subject) {
    const s = String(subject || '');
    if (s.includes(' | ')) return true;
    return /\((?:Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred|FN|MW|FT|WW|BS)\)/i.test(
        s
    );
}

function rawApiType(tx) {
    return String(tx?.type || tx?.activity || tx?.operation || tx?.action || '').toLowerCase();
}

function isCashWithdrawApiType(typeRaw) {
    return (
        (typeRaw.includes('withdraw') || typeRaw.includes('payout')) &&
        (typeRaw.includes('cash') || typeRaw.includes('balance') || typeRaw.includes('money'))
    );
}

/**
 * @param {object} tx — сира транзакція з /exchange/v1/history
 * @param {object} p
 * @param {number} p.amount
 * @param {string} p.itemTitle
 * @param {string|null} p.assetId
 * @param {boolean} p.isSale
 */
export function classifyDMarketAnalyticsType(tx, { amount, itemTitle, assetId, isSale }) {
    const typeRaw = rawApiType(tx);
    const subject = String(tx.subject || tx.title || itemTitle || '').trim();
    const abs = Math.abs(parseFloat(amount) || 0);
    const nearZero = abs < 0.005;
    const hasItemContext = Boolean(assetId) || looksLikeSkinItemTitle(subject);

    if (typeRaw.includes('cash_deposit')) return 'cash_deposit';
    if (typeRaw.includes('cash_withdraw')) return 'cash_withdraw';

    if (
        typeRaw.includes('item_deposit') ||
        typeRaw.includes('deposit_item') ||
        typeRaw.includes('item_in') ||
        typeRaw.includes('inventory_in')
    ) {
        return 'deposit';
    }
    if (
        typeRaw.includes('item_withdraw') ||
        typeRaw.includes('withdraw_item') ||
        typeRaw.includes('item_out') ||
        typeRaw.includes('inventory_out')
    ) {
        return 'withdraw';
    }

    if (typeRaw === 'item_move' || typeRaw.includes('inventory_transfer')) {
        return guessDepositOrWithdraw(isSale);
    }

    if (typeRaw === 'deposit') {
        if (looksLikeEthStyleAddress(subject)) return 'cash_deposit';
        if (hasItemContext) return 'deposit';
        return 'cash_deposit';
    }

    if (isCashWithdrawApiType(typeRaw)) {
        return 'cash_withdraw';
    }

    if (typeRaw === 'withdraw') {
        return 'withdraw';
    }

    if (looksLikeEthStyleAddress(subject)) return 'cash_deposit';

    if (nearZero && hasItemContext && !looksLikeEthStyleAddress(subject)) {
        return guessDepositOrWithdraw(isSale);
    }

    if (isSale && (typeRaw.includes('withdraw') || typeRaw.includes('payout')) && !hasItemContext) {
        return 'cash_withdraw';
    }

    return isSale ? 'sale' : 'purchase';
}

/** Без явного type: sell → withdraw предмета, purchase → deposit предмета. */
function guessDepositOrWithdraw(isSale) {
    return isSale ? 'withdraw' : 'deposit';
}

export function isTradeSaleOrPurchase(type) {
    return type === 'sale' || type === 'purchase';
}

const STORED_ANALYTICS_TYPES = new Set([
    'sale',
    'purchase',
    'cash_deposit',
    'deposit',
    'withdraw',
    'cash_withdraw'
]);

export function isStoredAnalyticsType(type) {
    return STORED_ANALYTICS_TYPES.has(type);
}

/**
 * Сира транзакція з GET /exchange/v1/history → запис для AnalyticsContext.
 */
export function mapHistoryTransactionToAnalytics(tx) {
    const transactionType = tx.type || '';
    const typeLower = transactionType.toLowerCase();
    const isSale = typeLower === 'sell' || typeLower === 'sale';

    let amount = 0;
    if (tx.changes && Array.isArray(tx.changes) && tx.changes.length > 0) {
        const moneyChange = tx.changes.find((change) => change.money);
        if (moneyChange && moneyChange.money) {
            amount = parseFloat(moneyChange.money.amount || 0);
        }
    }

    const assetId =
        tx.details?.itemId || tx.itemId || tx.assetId || tx.asset_id || null;

    const floatValue =
        tx.details?.extra?.floatValue ||
        tx.details?.extra?.float ||
        tx.details?.floatValue ||
        tx.details?.float ||
        tx.extra?.floatValue ||
        tx.extra?.float ||
        null;

    let createdAt = new Date().toISOString();
    if (tx.createdAt) {
        const timestamp =
            typeof tx.createdAt === 'number'
                ? tx.createdAt < 10000000000
                    ? tx.createdAt * 1000
                    : tx.createdAt
                : new Date(tx.createdAt).getTime();
        createdAt = new Date(timestamp).toISOString();
    }

    const transactionId = tx.id || tx.transactionId || tx.trxId;
    const status = tx.status || 'unknown';
    const itemTitle = tx.subject || tx.title || 'Unknown Item';

    const analyticsType = classifyDMarketAnalyticsType(tx, {
        amount,
        itemTitle,
        assetId,
        isSale
    });

    return {
        id: transactionId || (Date.now() + Math.random()),
        originalId: transactionId,
        type: analyticsType,
        itemTitle,
        assetId,
        amount,
        floatValue,
        status,
        createdAt,
        timestamp: createdAt,
        soldAt: analyticsType === 'sale' ? createdAt : null
    };
}
