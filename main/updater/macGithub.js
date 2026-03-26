import axios from 'axios';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { join } from 'path';
import semver from 'semver';

const LATEST_RELEASE_URL =
    'https://api.github.com/repos/Yarik-osg/Dmarket_js_bot/releases/latest';

/** @type {{ version: string, browser_download_url: string, name: string } | null} */
let cachedMacZipAsset = null;

/**
 * @param {Array<{ name?: string, browser_download_url?: string }>} assets
 * @param {string} arch process.arch
 */
function pickMacZipAsset(assets, arch) {
    const zips = (assets || []).filter(
        (a) => a?.name?.endsWith('.zip') && a.browser_download_url
    );
    if (!zips.length) return null;

    if (arch === 'arm64') {
        const arm = zips.find(
            (z) => z.name.includes('arm64') && z.name.includes('mac')
        );
        if (arm) return arm;
    }

    const intel = zips.find(
        (z) => z.name.includes('-mac.zip') && !z.name.includes('arm64')
    );
    return intel || zips[0];
}

function normalizeVersion(tagName) {
    const raw = String(tagName || '').replace(/^v/i, '').trim();
    const coerced = semver.coerce(raw);
    return coerced ? coerced.version : null;
}

/**
 * @param {object} opts
 * @param {import('electron').App} opts.app
 * @param {import('electron').Shell} opts.shell
 * @param {(payload: object) => void} opts.sendUpdaterEvent
 */
export async function checkMacUpdate({ app, sendUpdaterEvent }) {
    cachedMacZipAsset = null;
    sendUpdaterEvent({ type: 'checking' });

    try {
        const { data } = await axios.get(LATEST_RELEASE_URL, {
            headers: { Accept: 'application/vnd.github+json' },
            timeout: 30000
        });

        const remoteVer = normalizeVersion(data.tag_name);
        const currentVer = normalizeVersion(app.getVersion());

        if (!remoteVer || !currentVer) {
            sendUpdaterEvent({
                type: 'error',
                message: 'Не вдалося розпізнати версію релізу або застосунку.'
            });
            return { ok: false, error: 'invalid-version' };
        }

        if (!semver.gt(remoteVer, currentVer)) {
            sendUpdaterEvent({ type: 'not-available' });
            return { ok: true };
        }

        const asset = pickMacZipAsset(data.assets, process.arch);
        if (!asset) {
            sendUpdaterEvent({
                type: 'error',
                message: 'У релізі не знайдено ZIP для macOS.'
            });
            return { ok: false, error: 'no-zip-asset' };
        }

        cachedMacZipAsset = {
            version: remoteVer,
            browser_download_url: asset.browser_download_url,
            name: asset.name
        };

        const notes =
            typeof data.body === 'string' && data.body.trim()
                ? data.body.trim().slice(0, 2000)
                : data.name || '';

        sendUpdaterEvent({
            type: 'mac-update-available',
            version: remoteVer,
            notes
        });

        return { ok: true };
    } catch (e) {
        const msg =
            e?.response?.status === 404
                ? 'Реліз на GitHub не знайдено.'
                : e?.message || String(e);
        sendUpdaterEvent({ type: 'error', message: msg });
        return { ok: false, error: msg };
    }
}

/**
 * @param {object} opts
 * @param {import('electron').App} opts.app
 * @param {import('electron').Shell} opts.shell
 * @param {(payload: object) => void} opts.sendUpdaterEvent
 */
export async function downloadMacUpdate({ app, shell, sendUpdaterEvent }) {
    if (!cachedMacZipAsset?.browser_download_url) {
        const err = 'Спочатку перевірте оновлення.';
        sendUpdaterEvent({ type: 'error', message: err });
        return { ok: false, error: err };
    }

    const { browser_download_url, name, version } = cachedMacZipAsset;
    const safeName = name.replace(/[^\w.\-()+]/g, '_') || `update-${version}.zip`;
    const destPath = join(app.getPath('temp'), safeName);

    try {
        const response = await axios({
            method: 'get',
            url: browser_download_url,
            responseType: 'stream',
            timeout: 0,
            onDownloadProgress: (ev) => {
                const total = ev.total || 0;
                const loaded = ev.loaded || 0;
                const percent = total > 0 ? (loaded / total) * 100 : 0;
                sendUpdaterEvent({
                    type: 'progress',
                    percent,
                    transferred: loaded,
                    total
                });
            }
        });

        const writer = createWriteStream(destPath);
        await pipeline(response.data, writer);

        const openPathErr = await shell.openPath(destPath);

        sendUpdaterEvent({
            type: 'downloaded',
            version,
            path: destPath,
            openPathFailed: Boolean(openPathErr)
        });

        return { ok: true, path: destPath, openPathError: openPathErr || undefined };
    } catch (e) {
        const msg = e?.message || String(e);
        sendUpdaterEvent({ type: 'error', message: msg });
        return { ok: false, error: msg };
    }
}
