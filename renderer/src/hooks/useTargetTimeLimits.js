import { useState, useEffect, useMemo, useRef } from 'react';
import {
    buildTargetTimeLimitsRequest,
    getTargetRowId,
    parseTimeLimitsResponse
} from '../utils/targetTimeLimits.js';

/** Повторне звернення до API для синхронізації залишку паузи (відлік у таблиці — кожну секунду локально). */
const REFETCH_INTERVAL_MS = 60 * 1000;

/**
 * Завантажує time-limits для кожного таргета (POST /target/v1/time-limits).
 */
export function useTargetTimeLimits(targets, apiService) {
    const [cooldownById, setCooldownById] = useState({});
    const [tick, setTick] = useState(0);
    const targetsRef = useRef(targets);
    const fetchInFlightRef = useRef(false);
    targetsRef.current = targets;

    const idsKey = useMemo(
        () =>
            (targets || [])
                .map((t) => getTargetRowId(t))
                .filter((id) => id != null && id !== '')
                .sort()
                .join('|'),
        [targets]
    );

    useEffect(() => {
        const id = setInterval(() => setTick((x) => x + 1), 1000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        if (!apiService || !targets?.length) {
            setCooldownById({});
            return undefined;
        }

        let cancelled = false;

        async function runFetch(list) {
            if (!list?.length || fetchInFlightRef.current) return;
            fetchInFlightRef.current = true;
            const next = {};
            try {
                for (const target of list) {
                    if (cancelled) return;
                    const rowId = getTargetRowId(target);
                    if (!rowId) continue;
                    try {
                        const body = buildTargetTimeLimitsRequest(target);
                        const res = await apiService.getTargetTimeLimits(body);
                        const { defaultMs, remainingMs } = parseTimeLimitsResponse(res);
                        next[rowId] = {
                            defaultMs,
                            remainingMs,
                            expiresAt: Date.now() + remainingMs,
                            loading: false,
                            error: null
                        };
                    } catch (err) {
                        next[rowId] = {
                            loading: false,
                            error: err?.message || '—',
                            defaultMs: 0,
                            remainingMs: 0,
                            expiresAt: Date.now()
                        };
                    }
                    await new Promise((r) => setTimeout(r, 100));
                }
                if (!cancelled) setCooldownById(next);
            } finally {
                fetchInFlightRef.current = false;
            }
        }

        runFetch(targets);

        const iv = setInterval(() => {
            const list = targetsRef.current;
            if (list?.length && apiService) runFetch(list);
        }, REFETCH_INTERVAL_MS);

        return () => {
            cancelled = true;
            clearInterval(iv);
        };
    }, [apiService, idsKey]);

    return { cooldownById, cooldownTick: tick };
}
