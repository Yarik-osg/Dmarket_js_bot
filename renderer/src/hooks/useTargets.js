import { useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { ApiService } from '../services/apiService.js';

export function useTargets() {
    const { client } = useAuth();
    const [targets, setTargets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const loadingRef = useRef(false);

    // Memoize apiService to prevent recreation on every render
    const apiService = useMemo(() => {
        return client ? new ApiService(client) : null;
    }, [client]);

    const loadTargets = useCallback(async (items = []) => {
        if (!apiService || loadingRef.current) return undefined;

        loadingRef.current = true;
        setLoading(true);
        setError(null);

        let nextTargets = [];

        try {
            if (items.length > 0) {
                const allTargets = [];
                for (const item of items) {
                    try {
                        const response = await apiService.getTargetsByTitle(item.gameId || 'a8db', item.title);
                        if (response && response.targets) {
                            allTargets.push(...response.targets.map(t => ({ ...t, itemTitle: item.title })));
                        }
                    } catch (err) {
                        console.error(`Error loading targets for ${item.title}:`, err);
                    }
                }
                nextTargets = allTargets;
                setTargets(allTargets);
            } else {
                try {
                    const response = await apiService.getUserTargets({ currency: 'USD', gameId: 'a8db', limit: 100 });
                    const targetsList = response?.objects?.filter(obj => obj.type === 'target') || [];
                    if (import.meta.env.DEV) {
                        console.log('Loaded targets:', targetsList.length, targetsList);
                    }
                    nextTargets = targetsList;
                    setTargets(targetsList);
                } catch (err) {
                    console.error('Error loading user targets:', err);
                    setError(err.message || 'Failed to load targets');
                    nextTargets = [];
                    setTargets([]);
                }
            }
        } catch (err) {
            setError(err.message);
            console.error('Error loading targets:', err);
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }

        return nextTargets;
    }, [apiService]);

    const createTarget = useCallback(async (targetData) => {
        if (!apiService) throw new Error('Not authenticated');

        try {
            const response = await apiService.createTarget(targetData);
            await loadTargets();
            return response;
        } catch (err) {
            throw new Error(err.message);
        }
    }, [apiService, loadTargets]);

    const updateTarget = useCallback(async (targetId, targetData, gameId, title, floatPartValue, phase = null, paintSeed = null, skipReload = false) => {
        if (!apiService) throw new Error('Not authenticated');

        try {
            const response = await apiService.updateTarget(targetId, targetData, gameId, title, floatPartValue, phase, paintSeed);
            if (!skipReload) {
                await loadTargets();
            }
            return response;
        } catch (err) {
            // Preserve error properties (errorCode, failedTargets, etc.)
            const error = new Error(err.message);
            if (err.errorCode) error.errorCode = err.errorCode;
            if (err.failedTargets) error.failedTargets = err.failedTargets;
            if (err.updated) error.updated = err.updated;
            throw error;
        }
    }, [apiService, loadTargets]);

    const deleteTarget = useCallback(async (targetId) => {
        if (!apiService) throw new Error('Not authenticated');

        try {
            await apiService.deleteTarget(targetId);
            await loadTargets();
        } catch (err) {
            throw new Error(err.message);
        }
    }, [apiService, loadTargets]);

    return {
        targets,
        loading,
        error,
        loadTargets,
        createTarget,
        updateTarget,
        deleteTarget
    };
}

