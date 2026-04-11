import { app, BrowserWindow, ipcMain, shell, Menu } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { writeFile, mkdir, readdir, unlink, stat } from 'fs/promises';
import Store from 'electron-store';
import electronUpdater from 'electron-updater';
import { checkMacUpdate, downloadMacUpdate } from './updater/macGithub.js';
import { getWeb3FormsAccessKey } from './feedbackWeb3Send.js';

const { autoUpdater } = electronUpdater;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Підхопити Web3Forms-ключ з .env у корені репо (Electron сам по собі .env не читає). */
function loadFeedbackKeyFromDotEnv() {
    try {
        const envPath = join(__dirname, '..', '.env');
        if (!existsSync(envPath)) {
            return;
        }
        const text = readFileSync(envPath, 'utf8');
        for (const line of text.split(/\n/)) {
            const t = line.trim();
            if (!t || t.startsWith('#')) {
                continue;
            }
            const m = t.match(/^DMARKET_WEB3FORMS_ACCESS_KEY\s*=\s*(.*)$/);
            if (!m) {
                continue;
            }
            let v = m[1].trim();
            if (
                (v.startsWith('"') && v.endsWith('"')) ||
                (v.startsWith("'") && v.endsWith("'"))
            ) {
                v = v.slice(1, -1);
            }
            if (v && !process.env.DMARKET_WEB3FORMS_ACCESS_KEY) {
                process.env.DMARKET_WEB3FORMS_ACCESS_KEY = v;
            }
            break;
        }
    } catch {
        /* ignore */
    }
}

loadFeedbackKeyFromDotEnv();

let mainWindow;
const store = new Store();

// IPC handlers for store operations
ipcMain.handle('store-get', (event, key) => {
    return store.get(key);
});

ipcMain.handle('store-set', (event, key, value) => {
    store.set(key, value);
    return true;
});

ipcMain.handle('store-delete', (event, key) => {
    store.delete(key);
    return true;
});

ipcMain.handle('store-clear', () => {
    store.clear();
    return true;
});

ipcMain.handle('store-has', (event, key) => {
    return store.has(key);
});

ipcMain.handle('shell-open-external', async (event, url) => {
    if (typeof url !== 'string' || url.length > 20000) {
        return { ok: false, error: 'invalid-url' };
    }
    let protocol;
    try {
        protocol = new URL(url).protocol;
    } catch {
        return { ok: false, error: 'invalid-url' };
    }
    const allowed = protocol === 'https:';
    if (!allowed) {
        return { ok: false, error: 'invalid-url' };
    }
    try {
        await shell.openExternal(url);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e?.message || String(e) };
    }
});

// --- Persistent file logging ---
const LOG_DIR = join(app.getPath('userData'), 'logs');
const MAX_LOG_FILES = 7;
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB per file

function getLogFileName() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.log`;
}

async function ensureLogDir() {
    try {
        await mkdir(LOG_DIR, { recursive: true });
    } catch { /* exists */ }
}

async function rotateLogsIfNeeded() {
    try {
        const files = (await readdir(LOG_DIR))
            .filter(f => f.endsWith('.log'))
            .sort();
        while (files.length > MAX_LOG_FILES) {
            const oldest = files.shift();
            await unlink(join(LOG_DIR, oldest));
        }
    } catch { /* ignore */ }
}

let logBuffer = [];
let flushTimer = null;

async function flushLogs() {
    if (logBuffer.length === 0) return;
    const batch = logBuffer.splice(0);
    const filePath = join(LOG_DIR, getLogFileName());
    try {
        await ensureLogDir();
        const content = batch.join('\n') + '\n';
        const { appendFile } = await import('fs/promises');
        await appendFile(filePath, content, 'utf-8');
        const s = await stat(filePath).catch(() => null);
        if (s && s.size > MAX_LOG_SIZE) {
            await rotateLogsIfNeeded();
        }
    } catch (e) {
        console.error('Failed to write log:', e);
    }
}

ipcMain.handle('log-write', async (_event, entry) => {
    const ts = new Date().toISOString();
    const line = `[${ts}] [${entry.type || 'info'}] [${entry.category || 'general'}] ${entry.message}${entry.details ? ' | ' + JSON.stringify(entry.details) : ''}`;
    logBuffer.push(line);
    if (!flushTimer) {
        flushTimer = setTimeout(() => {
            flushTimer = null;
            flushLogs();
        }, 2000);
    }
    return { ok: true };
});

ipcMain.handle('log-read', async (_event, { date, limit } = {}) => {
    try {
        await ensureLogDir();
        const fileName = date ? `${date}.log` : getLogFileName();
        const filePath = join(LOG_DIR, fileName);
        const { readFile } = await import('fs/promises');
        const content = await readFile(filePath, 'utf-8');
        const lines = content.trim().split('\n');
        return { ok: true, lines: limit ? lines.slice(-limit) : lines };
    } catch {
        return { ok: true, lines: [] };
    }
});

ipcMain.handle('log-list-files', async () => {
    try {
        await ensureLogDir();
        const files = (await readdir(LOG_DIR)).filter(f => f.endsWith('.log')).sort().reverse();
        return { ok: true, files };
    } catch {
        return { ok: true, files: [] };
    }
});

ipcMain.handle('log-get-path', () => {
    return { ok: true, path: LOG_DIR };
});

/** Один канал: configured + accessKey (POST лише з renderer, інакше Web3Forms 403). */
ipcMain.handle('feedback-web3-configured', async () => {
    const key = await getWeb3FormsAccessKey();
    return { ok: true, configured: Boolean(key), accessKey: key || '' };
});

function sendUpdaterEvent(payload) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater-event', payload);
    }
}

let autoUpdaterListenersAttached = false;

function setupAutoUpdater() {
    if (process.platform === 'darwin') return;
    if (!app.isPackaged || autoUpdaterListenersAttached) return;
    autoUpdaterListenersAttached = true;

    autoUpdater.autoDownload = false;
    // macOS (Squirrel.Mac): при true кнопка «Встановити» може мовчки не спрацювати, якщо
    // внутрішній checkForUpdates після завантаження не завершився — quitAndInstall тоді
    // не викликає повторний checkForUpdates (див. MacUpdater.quitAndInstall у electron-updater).
    autoUpdater.autoInstallOnAppQuit = process.platform !== 'darwin';

    autoUpdater.on('checking-for-update', () => {
        sendUpdaterEvent({ type: 'checking' });
    });
    autoUpdater.on('update-available', (info) => {
        sendUpdaterEvent({
            type: 'available',
            version: info.version,
            releaseNotes: info.releaseNotes
        });
    });
    autoUpdater.on('update-not-available', () => {
        sendUpdaterEvent({ type: 'not-available' });
    });
    autoUpdater.on('error', (err) => {
        sendUpdaterEvent({ type: 'error', message: err?.message || String(err) });
    });
    autoUpdater.on('download-progress', (progress) => {
        sendUpdaterEvent({
            type: 'progress',
            percent: progress.percent,
            transferred: progress.transferred,
            total: progress.total
        });
    });
    autoUpdater.on('update-downloaded', (info) => {
        sendUpdaterEvent({
            type: 'downloaded',
            version: info.version
        });
    });
}

ipcMain.handle('updater-get-version', () => app.getVersion());

ipcMain.handle('updater-check', async () => {
    if (!app.isPackaged) {
        return { ok: false, reason: 'dev' };
    }
    if (process.platform === 'darwin') {
        return checkMacUpdate({ app, sendUpdaterEvent });
    }
    try {
        const result = await autoUpdater.checkForUpdates();
        return { ok: true, updateInfo: result?.updateInfo };
    } catch (e) {
        return { ok: false, error: e?.message || String(e) };
    }
});

ipcMain.handle('updater-download', async () => {
    if (!app.isPackaged) {
        return { ok: false, reason: 'dev' };
    }
    if (process.platform === 'darwin') {
        return downloadMacUpdate({ app, shell, sendUpdaterEvent });
    }
    try {
        await autoUpdater.downloadUpdate();
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e?.message || String(e) };
    }
});

ipcMain.handle('updater-quit-install', () => {
    if (!app.isPackaged || process.platform === 'darwin') return;
    autoUpdater.quitAndInstall(false, true);
});

function createWindow() {
    try {
        // Check if we're in development mode
        // In production builds, NODE_ENV should be 'production' and app.isPackaged will be true
        const isDev = !app.isPackaged && (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV);
        
        mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: join(__dirname, 'preload.cjs'),
                // Disable web security in dev mode to bypass CORS
                webSecurity: !isDev
            },
            titleBarStyle: 'default',
            backgroundColor: '#1a1a1a',
            show: true, // Show immediately
            autoHideMenuBar: !isDev // Hide menu bar in production
        });
        
        // Hide menu bar in production
        if (!isDev) {
            mainWindow.setMenuBarVisibility(false);
        }

        // Focus window when ready
        mainWindow.once('ready-to-show', () => {
            mainWindow.focus();
        });

        // Handle errors
        mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
            console.error('Failed to load:', errorCode, errorDescription);
        });

        // Open DevTools only in development mode
        if (isDev) {
            mainWindow.webContents.openDevTools();
        }

        // Load the app
        const distPath = join(__dirname, '../renderer/dist/index.html');
        
        if (isDev) {
            // In development mode, try dev server first
            console.log('Development mode: Loading from http://localhost:8080');
            setTimeout(() => {
                mainWindow.loadURL('http://localhost:8080').catch((err) => {
                    console.error('Failed to load from dev server:', err);
                    console.log('Falling back to dist file...');
                    // Fallback to dist if dev server is not available
                    mainWindow.loadFile(distPath).catch((err2) => {
                        console.error('Failed to load from dist:', err2);
                    });
                });
            }, 2000); // Wait 2 seconds for dev server to start
        } else {
            // Production mode: load from dist
            console.log('Production mode: Loading from:', distPath);
            mainWindow.loadFile(distPath).catch((err) => {
                console.error('Failed to load from dist:', err);
            });
        }

        // Context menu for copy/paste on right-click
        mainWindow.webContents.on('context-menu', (_event, params) => {
            const menuItems = [];
            if (params.selectionText) {
                menuItems.push({ label: 'Копіювати', role: 'copy' });
            }
            if (params.isEditable) {
                menuItems.push(
                    { label: 'Вирізати', role: 'cut' },
                    { label: 'Вставити', role: 'paste' },
                    { type: 'separator' },
                    { label: 'Виділити все', role: 'selectAll' }
                );
            }
            if (params.selectionText || params.isEditable) {
                Menu.buildFromTemplate(menuItems).popup({ window: mainWindow });
            }
        });

        mainWindow.on('closed', () => {
            mainWindow = null;
        });
    } catch (error) {
        console.error('Failed to create window:', error);
    }
}

app.whenReady().then(async () => {
    createWindow();
    setupAutoUpdater();

    if (app.isPackaged && process.platform !== 'darwin') {
        setTimeout(() => {
            autoUpdater.checkForUpdates().catch(() => {});
        }, 8000);
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
}).catch((error) => {
    console.error('Failed to start app:', error);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

