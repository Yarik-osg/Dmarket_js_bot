const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// IPC to communicate with main process for storage
contextBridge.exposeInMainWorld('electronAPI', {
    // Storage methods via IPC
    store: {
        get: (key) => {
            return ipcRenderer.invoke('store-get', key);
        },
        set: (key, value) => {
            return ipcRenderer.invoke('store-set', key, value);
        },
        delete: (key) => {
            return ipcRenderer.invoke('store-delete', key);
        },
        clear: () => {
            return ipcRenderer.invoke('store-clear');
        },
        has: (key) => {
            return ipcRenderer.invoke('store-has', key);
        }
    },
    updater: {
        getVersion: () => ipcRenderer.invoke('updater-get-version'),
        check: () => ipcRenderer.invoke('updater-check'),
        download: () => ipcRenderer.invoke('updater-download'),
        quitAndInstall: () => ipcRenderer.invoke('updater-quit-install'),
        onEvent: (callback) => {
            const listener = (_, payload) => callback(payload);
            ipcRenderer.on('updater-event', listener);
            return () => ipcRenderer.removeListener('updater-event', listener);
        }
    }
});
