import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Store from 'electron-store';
import electronUpdater from 'electron-updater';

const { autoUpdater } = electronUpdater;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    if (typeof url !== 'string' || !/^https:\/\//i.test(url)) {
        return { ok: false, error: 'invalid-url' };
    }
    try {
        await shell.openExternal(url);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e?.message || String(e) };
    }
});

function sendUpdaterEvent(payload) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('updater-event', payload);
    }
}

let autoUpdaterListenersAttached = false;

function setupAutoUpdater() {
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
        return { ok: false, error: 'mac-manual-update' };
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

        mainWindow.on('closed', () => {
            mainWindow = null;
        });
    } catch (error) {
        console.error('Failed to create window:', error);
    }
}

app.whenReady().then(() => {
    createWindow();
    setupAutoUpdater();

    if (app.isPackaged) {
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
