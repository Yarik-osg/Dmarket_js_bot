/**
 * Коротке повідомлення для користувача при помилках HTTP DMarket API.
 * Не вставляє повний HTML (maintenance, Cloudflare) у UI.
 */
export function summarizeDmarketHttpErrorBody(status, rawBody) {
    const body = typeof rawBody === 'string' ? rawBody : '';
    const trimmed = body.trim();
    if (!trimmed) {
        return `Запит не вдався (HTTP ${status}). Порожня відповідь.`;
    }

    const head = trimmed.slice(0, 800).toLowerCase();
    const looksLikeHtml =
        trimmed.startsWith('<!') ||
        trimmed.startsWith('<html') ||
        head.includes('<!doctype html') ||
        (trimmed.startsWith('<') && head.includes('<html'));

    if (looksLikeHtml) {
        const titleMatch = trimmed.match(/<title[^>]*>\s*([^<]+?)\s*<\/title>/i);
        const h1Match = trimmed.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/i);
        const title = titleMatch ? titleMatch[1].trim() : '';
        const h1 = h1Match ? h1Match[1].trim() : '';
        const hint = title || h1;
        const base =
            'Сервер повернув HTML замість даних API — ймовірно техобслуговування.';
        if (hint) {
            return `${base} HTTP ${status}. ${hint}`;
        }
        return `${base} HTTP ${status}.`;
    }

    if (trimmed.length > 400) {
        return `Запит не вдався (HTTP ${status}): ${trimmed.slice(0, 397)}…`;
    }
    return `Запит не вдався (HTTP ${status}): ${trimmed}`;
}
