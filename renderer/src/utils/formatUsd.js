/**
 * Форматує ціну з API DMarket, коли USD передається як цілі центи в рядку (наприклад "10" → $0.10).
 * Якщо рядок уже з десятковою крапкою — трактує як долари.
 */
export function formatUsdFromApiCents(price) {
    if (price === undefined || price === null || price === 'N/A') {
        return price === 'N/A' ? 'N/A' : '';
    }
    if (typeof price === 'number') {
        if (Number.isNaN(price)) return String(price);
        const s = price.toString();
        if (s.includes('e') || s.includes('.')) {
            return price.toFixed(2);
        }
        return (price / 100).toFixed(2);
    }
    const str = String(price).trim();
    if (str === '') return str;
    if (str.includes('.') || /e/i.test(str)) {
        const n = parseFloat(str);
        return Number.isNaN(n) ? str : n.toFixed(2);
    }
    const cents = parseInt(str, 10);
    if (Number.isNaN(cents)) return str;
    return (cents / 100).toFixed(2);
}

/** Українська форма слова «транзакція» для числа n */
export function formatUaTransactionsCount(n) {
    const x = Math.abs(Number(n)) % 100;
    const y = x % 10;
    if (x > 10 && x < 20) return `${n} транзакцій`;
    if (y === 1) return `${n} транзакція`;
    if (y >= 2 && y <= 4) return `${n} транзакції`;
    return `${n} транзакцій`;
}
