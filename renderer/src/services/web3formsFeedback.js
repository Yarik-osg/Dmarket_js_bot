/**
 * Web3Forms приймає POST лише з клієнта (Chromium). Викликати з renderer, не з Electron main.
 */

const WEB3FORMS_URL = 'https://api.web3forms.com/submit';

function simpleEmailValid(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * @param {string} accessKey
 * @param {{ subject?: string, message?: string, replyTo?: string, maxSubject?: number, maxMessage?: number }} payload
 * @returns {Promise<{ ok: true } | { ok: false, code: string, message?: string }>}
 */
export async function submitWeb3Feedback(accessKey, payload) {
    const maxSubject = payload.maxSubject ?? 200;
    const maxMessage = payload.maxMessage ?? 8000;

    const key = String(accessKey || '').trim();
    if (!key) {
        return { ok: false, code: 'not_configured' };
    }

    const message = typeof payload.message === 'string' ? payload.message.trim() : '';
    if (!message || message.length > maxMessage) {
        return { ok: false, code: 'invalid_message' };
    }

    const subjectRaw = typeof payload.subject === 'string' ? payload.subject.trim() : '';
    const subject = (subjectRaw.slice(0, maxSubject) || "DMarket Bot — зворотний зв'язок").slice(
        0,
        maxSubject
    );

    let replyTo = typeof payload.replyTo === 'string' ? payload.replyTo.trim() : '';
    if (replyTo && !simpleEmailValid(replyTo)) {
        return { ok: false, code: 'invalid_reply_email' };
    }

    const body = {
        access_key: key,
        subject,
        message,
        from_name: 'DMarket Bot'
    };
    if (replyTo) {
        body.reply_to = replyTo;
    }

    try {
        const response = await fetch(WEB3FORMS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify(body)
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.success === true) {
            return { ok: true };
        }
        const msg = data.message || data.error || `HTTP ${response.status}`;
        return { ok: false, code: 'api_error', message: String(msg) };
    } catch (e) {
        return { ok: false, code: 'network', message: e?.message || String(e) };
    }
}
