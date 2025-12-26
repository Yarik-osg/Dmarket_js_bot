import React, { createContext, useContext, useState, useEffect } from 'react';
import { DMarketClient } from '../services/dmarketClient.js';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [client, setClient] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if credentials are stored
        const loadCredentials = async () => {
            if (window.electronAPI) {
                try {
                    const publicKey = await window.electronAPI.store.get('DMARKET_PUBLIC_KEY');
                    const secretKey = await window.electronAPI.store.get('DMARKET_SECRET_KEY');
                    
                    if (publicKey && secretKey) {
                        try {
                            const dmarketClient = new DMarketClient(publicKey, secretKey);
                            setClient(dmarketClient);
                            setIsAuthenticated(true);
                        } catch (error) {
                            console.error('Failed to initialize client:', error);
                        }
                    }
                } catch (error) {
                    console.error('Failed to load credentials:', error);
                }
            }
            setLoading(false);
        };
        
        loadCredentials();
    }, []);

    const login = async (publicKey, secretKey) => {
        try {
            const dmarketClient = new DMarketClient(publicKey, secretKey);
            setClient(dmarketClient);
            setIsAuthenticated(true);
            
            // Store credentials
            if (window.electronAPI) {
                await window.electronAPI.store.set('DMARKET_PUBLIC_KEY', publicKey);
                await window.electronAPI.store.set('DMARKET_SECRET_KEY', secretKey);
            }
            return true;
        } catch (error) {
            console.error('Login failed:', error);
            return false;
        }
    };

    const logout = async () => {
        setClient(null);
        setIsAuthenticated(false);
        if (window.electronAPI) {
            await window.electronAPI.store.delete('DMARKET_PUBLIC_KEY');
            await window.electronAPI.store.delete('DMARKET_SECRET_KEY');
        }
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, client, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}

