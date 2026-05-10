import { useCallback, useEffect, useState } from 'react';
import {
    deleteTargetPreset,
    getTargetPresets,
    hasLocalDb,
    saveTargetPreset
} from '../services/localDb.js';

export function useTargetPresets() {
    const [presets, setPresets] = useState([]);
    const [loadingPresets, setLoadingPresets] = useState(false);
    const [presetsError, setPresetsError] = useState('');

    const reloadPresets = useCallback(async () => {
        if (!hasLocalDb()) {
            setPresets([]);
            return [];
        }

        setLoadingPresets(true);
        setPresetsError('');
        try {
            const response = await getTargetPresets();
            if (response?.ok === false) {
                throw new Error(response.error || 'Failed to load target presets');
            }
            const nextPresets = response?.presets || [];
            setPresets(nextPresets);
            return nextPresets;
        } catch (err) {
            setPresetsError(err.message || 'Failed to load target presets');
            return [];
        } finally {
            setLoadingPresets(false);
        }
    }, []);

    const savePreset = useCallback(async (preset) => {
        if (!preset || !hasLocalDb()) return null;

        const response = await saveTargetPreset(preset);
        if (response?.ok === false) {
            throw new Error(response.error || 'Failed to save target preset');
        }
        const savedPreset = response?.preset || preset;
        setPresets((current) => {
            const withoutCurrent = current.filter((item) => item.id !== savedPreset.id);
            return [savedPreset, ...withoutCurrent];
        });
        return savedPreset;
    }, []);

    const deletePreset = useCallback(async (id) => {
        if (!id || !hasLocalDb()) return false;

        const response = await deleteTargetPreset(id);
        if (response?.ok === false) {
            throw new Error(response.error || 'Failed to delete target preset');
        }
        setPresets((current) => current.filter((preset) => preset.id !== id));
        return true;
    }, []);

    useEffect(() => {
        reloadPresets();
    }, [reloadPresets]);

    return {
        presets,
        loadingPresets,
        presetsError,
        reloadPresets,
        savePreset,
        deletePreset
    };
}
