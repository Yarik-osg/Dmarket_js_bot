import { contextBridge } from 'electron';
import Store from 'electron-store';

let store;

try {
    store = new Store();
} catch (error) {
    console.error('Failed to initialize electron-store:', error);
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Storage methods
    store: {
        get: (key) => {
            try {
                return store ? store.get(key) : null;
            } catch (error) {
                console.error('Store get error:', error);
                return null;
            }
        },
        set: (key, value) => {
            try {
                if (store) {
                    store.set(key, value);
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Store set error:', error);
                return false;
            }
        },
        delete: (key) => {
            try {
                if (store) {
                    store.delete(key);
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Store delete error:', error);
                return false;
            }
        },
        clear: () => {
            try {
                if (store) {
                    store.clear();
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Store clear error:', error);
                return false;
            }
        },
        has: (key) => {
            try {
                return store ? store.has(key) : false;
            } catch (error) {
                console.error('Store has error:', error);
                return false;
            }
        }
    }
});

