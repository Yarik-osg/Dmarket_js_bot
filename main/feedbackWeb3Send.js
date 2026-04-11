/**
 * Лише читання Web3Forms access key (з env / local.mjs / example.mjs).
 * Відправка POST має йти з renderer — інакше Web3Forms повертає 403 (лише client-side).
 */

const MAX_SUBJECT = 200;
const MAX_MESSAGE = 8000;

export { MAX_SUBJECT, MAX_MESSAGE };

/** Кешуємо лише знайдений ключ; якщо ключа не було — наступний виклик знову читає файли */
let cachedNonEmptyKey;

function isPlaceholderKey(k) {
    const t = String(k || '').trim().toLowerCase();
    return (
        !t ||
        t === 'your_access_key_here' ||
        t === 'paste-your-key-here' ||
        t === 'your-key-here'
    );
}

async function tryImportAccessKey(specifier) {
    try {
        const mod = await import(specifier);
        const raw = String(mod.WEB3FORMS_ACCESS_KEY || '').trim();
        if (!isPlaceholderKey(raw)) {
            return raw;
        }
    } catch {
        /* файл відсутній або помилка модуля */
    }
    return '';
}

export async function getWeb3FormsAccessKey() {
    if (cachedNonEmptyKey) {
        return cachedNonEmptyKey;
    }

    let key = (process.env.DMARKET_WEB3FORMS_ACCESS_KEY || '').trim();
    if (!key) {
        key = await tryImportAccessKey('./web3forms.local.mjs');
    }
    if (!key) {
        key = await tryImportAccessKey('./web3forms.local.example.mjs');
    }

    if (key) {
        cachedNonEmptyKey = key;
    }
    return key || '';
}
