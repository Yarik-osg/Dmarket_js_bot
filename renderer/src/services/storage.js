// Storage service wrapper for electron-store
export class StorageService {
    static get(key) {
        if (window.electronAPI) {
            return window.electronAPI.store.get(key);
        }
        return null;
    }

    static set(key, value) {
        if (window.electronAPI) {
            window.electronAPI.store.set(key, value);
            return true;
        }
        return false;
    }

    static delete(key) {
        if (window.electronAPI) {
            window.electronAPI.store.delete(key);
            return true;
        }
        return false;
    }

    static clear() {
        if (window.electronAPI) {
            window.electronAPI.store.clear();
            return true;
        }
        return false;
    }

    static has(key) {
        if (window.electronAPI) {
            return window.electronAPI.store.has(key);
        }
        return false;
    }
}


