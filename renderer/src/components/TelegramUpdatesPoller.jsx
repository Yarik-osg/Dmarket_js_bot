import { useEffect, useRef, useMemo } from 'react';
import { useNotifications } from '../contexts/NotificationContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import {
    fetchDmarketStatusForTelegram,
    formatTelegramBalanceBlock,
    formatTelegramOffersBlock,
    formatTelegramParsingLine,
    formatTelegramTargetsBlock,
    truncateTelegramText
} from '../utils/telegramStatusFormat.js';

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

async function telegramPostJson(token, method, body) {
    const url = `https://api.telegram.org/bot${token}/${method}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return res.json();
}

export default function TelegramUpdatesPoller({
    apiService,
    isTargetsParsingEnabled,
    isOffersParsingEnabled
}) {
    const { settings } = useNotifications();
    const { t } = useLocale();
    const offsetRef = useRef(0);
    const parsingRef = useRef({ targets: false, offers: false });

    parsingRef.current = {
        targets: Boolean(isTargetsParsingEnabled),
        offers: Boolean(isOffersParsingEnabled)
    };

    const labels = useMemo(
        () => ({
            balance: t('telegram.btnBalance'),
            targets: t('telegram.btnTargets'),
            offers: t('telegram.btnOffers'),
            parsing: t('telegram.btnParsing')
        }),
        [t]
    );

    const token = settings.telegram?.botToken?.trim();
    const chatId = settings.telegram?.chatId != null ? String(settings.telegram.chatId).trim() : '';
    const enabled =
        Boolean(settings.telegram?.enabled) &&
        Boolean(settings.telegram?.commandsEnabled) &&
        Boolean(token) &&
        Boolean(chatId);

    useEffect(() => {
        if (!apiService || !enabled) {
            return undefined;
        }

        let cancelled = false;

        const replyKeyboard = {
            keyboard: [
                [{ text: labels.balance }, { text: labels.targets }],
                [{ text: labels.offers }, { text: labels.parsing }]
            ],
            resize_keyboard: true
        };

        async function sendMessage(text, extra = {}) {
            const payload = {
                chat_id: chatId,
                text: truncateTelegramText(text),
                ...extra
            };
            await telegramPostJson(token, 'sendMessage', payload);
        }

        /** Рядок або HTML-блок з parse_mode (таблиці таргетів/оферів). */
        async function sendFormatted(payload) {
            if (typeof payload === 'string') {
                await sendMessage(payload);
                return;
            }
            if (payload?.parseMode === 'HTML' && payload.text) {
                await telegramPostJson(token, 'sendMessage', {
                    chat_id: chatId,
                    text: payload.text,
                    parse_mode: 'HTML'
                });
                return;
            }
            await sendMessage(payload?.text || '');
        }

        async function deleteWebhook() {
            try {
                const u = new URL(`https://api.telegram.org/bot${token}/deleteWebhook`);
                u.searchParams.set('drop_pending_updates', 'true');
                await fetch(u.toString());
            } catch (e) {
                console.warn('Telegram deleteWebhook', e);
            }
        }

        function routeText(raw) {
            const text = String(raw || '').trim();
            const low = text.toLowerCase();
            if (low === '/start' || low.startsWith('/start@')) return 'start';
            if (low === '/balance' || low.startsWith('/balance@')) return 'balance';
            if (low === '/targets' || low.startsWith('/targets@')) return 'targets';
            if (low === '/offers' || low.startsWith('/offers@')) return 'offers';
            if (low === '/parsing' || low.startsWith('/parsing@')) return 'parsing';
            if (text === labels.balance) return 'balance';
            if (text === labels.targets) return 'targets';
            if (text === labels.offers) return 'offers';
            if (text === labels.parsing) return 'parsing';
            return null;
        }

        async function dispatch(cmd) {
            const parsing = parsingRef.current;
            const data = await fetchDmarketStatusForTelegram(apiService);

            if (cmd === 'start') {
                await sendMessage(t('telegram.welcome'), { reply_markup: replyKeyboard });
                return;
            }

            if (cmd === 'balance') {
                await sendMessage(
                    formatTelegramBalanceBlock(data.balance, data.listedNetUsd, t)
                );
                return;
            }

            if (cmd === 'targets') {
                await sendFormatted(
                    formatTelegramTargetsBlock(data.targetsRaw, t, data.targetMarkets || {})
                );
                return;
            }

            if (cmd === 'offers') {
                await sendFormatted(
                    formatTelegramOffersBlock(data.offersRaw, t, data.offerMarkets || {})
                );
                return;
            }

            if (cmd === 'parsing') {
                await sendMessage(
                    formatTelegramParsingLine(parsing.targets, parsing.offers, t)
                );
                return;
            }
        }

        async function pollLoop() {
            await deleteWebhook();
            offsetRef.current = 0;

            while (!cancelled) {
                const ac = new AbortController();
                const timer = setTimeout(() => ac.abort(), 90000);
                try {
                    const u = new URL(`https://api.telegram.org/bot${token}/getUpdates`);
                    u.searchParams.set('offset', String(offsetRef.current));
                    u.searchParams.set('timeout', '25');
                    u.searchParams.set('allowed_updates', JSON.stringify(['message']));
                    const res = await fetch(u.toString(), { signal: ac.signal });
                    clearTimeout(timer);
                    const data = await res.json();
                    if (!data.ok) {
                        await sleep(3000);
                        continue;
                    }
                    for (const upd of data.result || []) {
                        if (cancelled) break;
                        offsetRef.current = upd.update_id + 1;
                        const msg = upd.message;
                        if (!msg) continue;
                        if (String(msg.chat?.id) !== chatId) continue;
                        const cmd = routeText(msg.text);
                        if (!cmd) continue;
                        try {
                            await dispatch(cmd);
                        } catch (e) {
                            console.warn('TelegramUpdatesPoller dispatch', e);
                        }
                    }
                } catch (e) {
                    clearTimeout(timer);
                    if (cancelled) break;
                    await sleep(2000);
                }
            }
        }

        pollLoop();
        return () => {
            cancelled = true;
        };
    }, [apiService, enabled, token, chatId, t, labels]);

    return null;
}
