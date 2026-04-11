import { sumOffersNetUsd } from './offerListingPrice.js';
import { formatUsdFromApiCents } from './formatUsd.js';
import { getOfferId, getOfferTitle } from '../hooks/useOffers.js';
import { fetchTargetMarketPricesMap, fetchOfferMarketPricesMap } from './telegramMarketPrices.js';

export const TELEGRAM_MAX_MESSAGE_CHARS = 4096;
const SAFE_MAX = 3800;
const SAFE_MAX_PRE_INNER = 3600;
const DEFAULT_LIST_CAP = 45;
/** Емодзі для рядків цін у списку (окремо від «застарілих» 💰/📈). */
const EMOJI_PRICE_YOURS = '🪙';
const EMOJI_PRICE_MARKET = '🛒';
const TITLE_MAX_LEN = 96;

export function targetTitleForTelegram(t) {
    return (
        t?.itemTitle ||
        t?.title ||
        t?.extra?.name ||
        t?.attributes?.title ||
        String(t?.itemId || '?')
    );
}

function clipTitle(s, maxLen) {
    const t = String(s).replace(/\s+/g, ' ').trim();
    if (t.length <= maxLen) return t;
    return `${t.slice(0, maxLen - 1)}…`;
}

function formatUsdDisplay(raw) {
    if (raw == null || raw === '') return '—';
    const s = String(raw).trim();
    if (s === '—') return '—';
    return s.startsWith('$') ? s : `$${s}`;
}

export function escapeHtmlTelegram(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function formatCentsUsd(amountStr) {
    if (!amountStr && amountStr !== '0') return '0.00';
    const amount = typeof amountStr === 'string' ? amountStr : amountStr.toString();
    if (amount.length >= 2) {
        return amount.slice(0, -2) + '.' + amount.slice(-2);
    }
    return '0.' + amount.padStart(2, '0');
}

function parseUsdCents(value) {
    const n = parseInt(String(value ?? '0'), 10);
    return Number.isFinite(n) ? n : 0;
}

export function truncateTelegramText(text, maxLen = SAFE_MAX) {
    const s = String(text ?? '');
    if (s.length <= maxLen) return s;
    return `${s.slice(0, maxLen)}…`;
}

export async function fetchDmarketStatusForTelegram(apiService) {
    const [targetsRes, offersRes] = await Promise.all([
        apiService.getUserTargets({ currency: 'USD', gameId: 'a8db', limit: 100 }),
        apiService.getUserOffers({ currency: 'USD', gameId: 'a8db', limit: 100 })
    ]);
    const targetsRaw = targetsRes?.objects?.filter((o) => o.type === 'target') || [];
    const offersRaw = offersRes?.objects?.filter((o) => o.type === 'offer') || [];

    let balance;
    try {
        balance = await apiService.getUserBalance();
    } catch (e) {
        balance = { error: e?.message || String(e) };
    }

    const [targetMarkets, offerMarkets] = await Promise.all([
        fetchTargetMarketPricesMap(apiService, targetsRaw),
        fetchOfferMarketPricesMap(apiService, offersRaw)
    ]);

    const listedNetUsd = Math.round(sumOffersNetUsd(offersRaw) * 100) / 100;
    return {
        targetsRaw,
        offersRaw,
        balance,
        listedNetUsd,
        targetMarkets,
        offerMarkets
    };
}

export function formatTelegramParsingLine(isTargets, isOffers, t) {
    const on = t('telegram.on');
    const off = t('telegram.off');
    return t('telegram.parsingLine')
        .replace('{targets}', isTargets ? on : off)
        .replace('{offers}', isOffers ? on : off);
}

export function formatTelegramBalanceBlock(balance, listedNetUsd, t) {
    if (balance?.error) {
        return t('telegram.balanceError').replace('{error}', String(balance.error));
    }
    const usdAvailable = balance?.usdAvailableToWithdraw || '0';
    const usdFrozen = balance?.usdTradeProtected || '0';
    const availableCents = parseUsdCents(usdAvailable);
    const frozenCents = parseUsdCents(usdFrozen);
    const walletDollars = (availableCents + frozenCents) / 100;
    const lines = [
        `🪙 ${t('telegram.sectionBalance')}`,
        `Доступно до виводу: $${formatCentsUsd(usdAvailable)}`,
        `Трейд-протекшн: $${formatCentsUsd(usdFrozen)}`,
        `Гаманець (доступно + протекшн): $${walletDollars.toFixed(2)}`
    ];
    if (listedNetUsd != null && !Number.isNaN(listedNetUsd)) {
        lines.push(
            t('telegram.listedTotal').replace('{amount}', String(listedNetUsd))
        );
    }
    return lines.join('\n');
}

function buildTargetsListString(slice, t, marketById) {
    return slice
        .map((tar, i) => {
            const id = tar.targetId || tar.itemId || tar.instantTargetId;
            const title = clipTitle(targetTitleForTelegram(tar), TITLE_MAX_LEN);
            const our = tar.price
                ? formatUsdDisplay(`$${formatUsdFromApiCents(tar.price?.USD)}`)
                : '—';
            const mktRaw = marketById[id];
            const mkt = mktRaw ? formatUsdDisplay(mktRaw) : '—';
            return [
                `${i + 1}. ${title}`,
                `   ${EMOJI_PRICE_YOURS} ${t('telegram.labelYour')} ${our}`,
                `   ${EMOJI_PRICE_MARKET} ${t('telegram.labelMarket')} ${mkt}`
            ].join('\n');
        })
        .join('\n\n');
}

function buildOffersListString(slice, t, marketById) {
    return slice
        .map((o, i) => {
            const id = getOfferId(o);
            const title = clipTitle(getOfferTitle(o), TITLE_MAX_LEN);
            const our = o.price
                ? formatUsdDisplay(`$${formatUsdFromApiCents(o.price?.USD)}`)
                : '—';
            const mktRaw = marketById[id];
            const mkt = mktRaw ? formatUsdDisplay(mktRaw) : '—';
            return [
                `${i + 1}. ${title}`,
                `   ${EMOJI_PRICE_YOURS} ${t('telegram.labelYour')} ${our}`,
                `   ${EMOJI_PRICE_MARKET} ${t('telegram.labelMarket')} ${mkt}`
            ].join('\n');
        })
        .join('\n\n');
}

/**
 * @returns {{ text: string, parseMode: 'HTML' }}
 */
export function formatTelegramTargetsBlock(targetsRaw, t, marketById = {}, maxItems = DEFAULT_LIST_CAP) {
    const slice = targetsRaw.slice(0, maxItems);
    const header = t('telegram.sectionTargets').replace('{n}', String(slice.length));
    const innerRaw = buildTargetsListString(slice, t, marketById);
    const inner = truncateTelegramText(
        `${header}\n\n${innerRaw}`,
        SAFE_MAX_PRE_INNER
    );
    return {
        text: `<pre>${escapeHtmlTelegram(inner)}</pre>`,
        parseMode: 'HTML'
    };
}

/**
 * @returns {{ text: string, parseMode: 'HTML' }}
 */
export function formatTelegramOffersBlock(offersRaw, t, marketById = {}, maxItems = DEFAULT_LIST_CAP) {
    const slice = offersRaw.slice(0, maxItems);
    const header = t('telegram.sectionOffers').replace('{n}', String(slice.length));
    const innerRaw = buildOffersListString(slice, t, marketById);
    const inner = truncateTelegramText(
        `${header}\n\n${innerRaw}`,
        SAFE_MAX_PRE_INNER
    );
    return {
        text: `<pre>${escapeHtmlTelegram(inner)}</pre>`,
        parseMode: 'HTML'
    };
}
