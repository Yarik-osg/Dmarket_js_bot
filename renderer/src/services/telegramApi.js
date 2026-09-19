export async function telegramApiCall(token, method, { body, query } = {}) {
    const cleanToken = String(token || '').trim();
    if (!cleanToken) throw new Error('Telegram bot token is missing');

    if (window.electronAPI?.telegram?.call) {
        const result = await window.electronAPI.telegram.call({
            token: cleanToken,
            method,
            body,
            query
        });
        if (!result?.ok) {
            throw new Error(result?.error || `Telegram ${method} failed`);
        }
        return result.data;
    }

    const url = new URL(`https://api.telegram.org/bot${cleanToken}/${method}`);
    for (const [key, value] of Object.entries(query || {})) {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
    const response = await fetch(url.toString(), {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
        throw new Error(data.description || `Telegram ${method} failed (${response.status})`);
    }
    return data;
}
