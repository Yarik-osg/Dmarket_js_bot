import React, { useEffect, useRef } from 'react';
import { useMantineColorScheme, useComputedColorScheme } from '@mantine/core';
import { UI_COLOR_SCHEME_STORE_KEY, UI_COLOR_SCHEME_LS_KEY } from '../constants/uiStorageKeys.js';

const VALID = new Set(['light', 'dark', 'auto']);

/**
 * Syncs resolved scheme to document[data-theme], loads preference from Electron store once,
 * and mirrors Mantine choice to the store.
 */
export default function ThemeDocumentAndStoreSync() {
    const computed = useComputedColorScheme('dark', { getInitialValueInEffect: true });
    const { colorScheme, setColorScheme } = useMantineColorScheme();
    const setColorSchemeRef = useRef(setColorScheme);
    setColorSchemeRef.current = setColorScheme;

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', computed);
    }, [computed]);

    // Must run only once: setColorScheme identity from Mantine can change when the scheme changes,
    // which would re-run this effect and fight the user's new choice (light/dark flicker).
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const stored = await window.electronAPI?.store?.get?.(UI_COLOR_SCHEME_STORE_KEY);
                if (cancelled || typeof stored !== 'string' || !VALID.has(stored)) return;
                setColorSchemeRef.current(stored);
                try {
                    localStorage.setItem(UI_COLOR_SCHEME_LS_KEY, stored);
                } catch {
                    /* ignore */
                }
            } catch {
                /* ignore */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!VALID.has(colorScheme)) return;
        (async () => {
            try {
                await window.electronAPI?.store?.set?.(UI_COLOR_SCHEME_STORE_KEY, colorScheme);
            } catch {
                /* ignore */
            }
        })();
    }, [colorScheme]);

    return null;
}
