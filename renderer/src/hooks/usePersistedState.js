import { useState, useEffect } from 'react';

/**
 * useState backed by localStorage.
 * @param {string} key       localStorage key
 * @param {*}      fallback  default value when nothing is stored
 * @param {object} opts      { serialize, deserialize } – custom (de)serializers
 */
export default function usePersistedState(key, fallback, opts = {}) {
    const {
        serialize = JSON.stringify,
        deserialize = JSON.parse,
    } = opts;

    const [value, setValue] = useState(() => {
        try {
            const raw = localStorage.getItem(key);
            return raw !== null ? deserialize(raw) : fallback;
        } catch {
            return fallback;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(key, serialize(value));
        } catch { /* quota exceeded – ignore */ }
    }, [key, value, serialize]);

    return [value, setValue];
}
