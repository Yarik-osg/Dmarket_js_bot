import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getOfferPriceRules, saveOfferPriceRules } from '../services/localDb.js';
import {
    collectOfferRuleKeyAliases,
    getOfferId,
    getOfferRuleId,
    getOfferTitle
} from './useOffers.js';

function readJson(key, fallback) {
    try {
        const s = localStorage.getItem(key);
        return s ? JSON.parse(s) : fallback;
    } catch {
        return fallback;
    }
}

function clearLegacyOfferRuleKeys() {
    try {
        localStorage.removeItem('offersMinPrices');
        localStorage.removeItem('offersMaxPrices');
        localStorage.removeItem('offersSkipForParsing');
    } catch {
        /* ignore */
    }
}

export async function persistOfferRules({ minPrices, maxPrices, skipForParsing, offerMetadata }) {
    const result = await saveOfferPriceRules({ minPrices, maxPrices, skipForParsing, offerMetadata });
    if (!result?.ok) {
        throw new Error(result?.error || 'Failed to save offer price rules to SQLite');
    }
    return result;
}

function buildOfferMetadata(offers) {
    const metadata = {};
    for (const offer of offers || []) {
        const ruleId = getOfferRuleId(offer);
        if (!ruleId) continue;
        metadata[ruleId] = {
            itemTitle: getOfferTitle(offer, 'Невідомий офер')
        };
    }
    return metadata;
}

export function pruneOfferRulesForOffers(
    { minPrices = {}, maxPrices = {}, skipForParsing = {} } = {},
    offers = []
) {
    const validIds = new Set();
    for (const offer of offers || []) {
        for (const alias of collectOfferRuleKeyAliases(offer)) {
            validIds.add(alias);
        }
    }
    const pruneMap = (source) => {
        const pruned = {};
        for (const [key, value] of Object.entries(source || {})) {
            if (validIds.has(String(key))) {
                pruned[key] = value;
            }
        }
        return pruned;
    };

    const pruned = {
        minPrices: pruneMap(minPrices),
        maxPrices: pruneMap(maxPrices),
        skipForParsing: pruneMap(skipForParsing)
    };
    const changed =
        JSON.stringify(pruned.minPrices) !== JSON.stringify(minPrices || {}) ||
        JSON.stringify(pruned.maxPrices) !== JSON.stringify(maxPrices || {}) ||
        JSON.stringify(pruned.skipForParsing) !== JSON.stringify(skipForParsing || {});

    return { ...pruned, changed };
}

export function usePersistedOfferMinPrices(offers) {
    const [minPrices, setMinPrices] = useState({});
    const [pendingMinPrices, setPendingMinPrices] = useState({});
    const [maxPrices, setMaxPrices] = useState({});
    const [pendingMaxPrices, setPendingMaxPrices] = useState({});
    const [skipForParsing, setSkipForParsing] = useState({});
    const minPricesRef = useRef(minPrices);
    const maxPricesRef = useRef(maxPrices);
    const skipForParsingRef = useRef(skipForParsing);
    const hasHydratedRef = useRef(false);
    const offerMetadata = useMemo(() => buildOfferMetadata(offers), [offers]);

    useEffect(() => {
        minPricesRef.current = minPrices;
    }, [minPrices]);

    useEffect(() => {
        maxPricesRef.current = maxPrices;
    }, [maxPrices]);

    useEffect(() => {
        skipForParsingRef.current = skipForParsing;
    }, [skipForParsing]);

    useEffect(() => {
        if (!hasHydratedRef.current) return;
        persistOfferRules({ minPrices, maxPrices, skipForParsing, offerMetadata }).catch((err) => {
            console.error('Error saving offer rules:', err);
        });
    }, [skipForParsing, minPrices, maxPrices, offerMetadata]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const result = await getOfferPriceRules();
                if (cancelled || !result?.ok) return;

                const hasSqliteRules =
                    Object.keys(result.minPrices || {}).length > 0 ||
                    Object.keys(result.maxPrices || {}).length > 0 ||
                    Object.keys(result.skipForParsing || {}).length > 0;

                if (hasSqliteRules) {
                    setMinPrices(result.minPrices || {});
                    setMaxPrices(result.maxPrices || {});
                    setSkipForParsing(result.skipForParsing || {});
                    minPricesRef.current = result.minPrices || {};
                    maxPricesRef.current = result.maxPrices || {};
                    skipForParsingRef.current = result.skipForParsing || {};
                } else {
                    const legacy = {
                        minPrices: readJson('offersMinPrices', {}),
                        maxPrices: readJson('offersMaxPrices', {}),
                        skipForParsing: readJson('offersSkipForParsing', {})
                    };
                    if (
                        Object.keys(legacy.minPrices).length > 0 ||
                        Object.keys(legacy.maxPrices).length > 0 ||
                        Object.keys(legacy.skipForParsing).length > 0
                    ) {
                        await persistOfferRules(legacy);
                        clearLegacyOfferRuleKeys();
                        if (!cancelled) {
                            setMinPrices(legacy.minPrices);
                            setMaxPrices(legacy.maxPrices);
                            setSkipForParsing(legacy.skipForParsing);
                            minPricesRef.current = legacy.minPrices;
                            maxPricesRef.current = legacy.maxPrices;
                            skipForParsingRef.current = legacy.skipForParsing;
                        }
                    }
                }
            } catch (err) {
                console.warn('Error restoring offer rules from SQLite:', err);
            } finally {
                if (!cancelled) {
                    hasHydratedRef.current = true;
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (offers.length > 0) {
            try {
                const matched = { ...skipForParsingRef.current };
                const matchedMinPrices = { ...minPricesRef.current };
                const matchedMaxPrices = { ...maxPricesRef.current };
                offers.forEach((offer) => {
                    const canonicalId = getOfferRuleId(offer);
                    const legacyIds = [
                        offer.itemId,
                        offer.extra?.assetId,
                        offer.assetId,
                        getOfferId(offer),
                        offer.extra?.offerId,
                        offer.offerId,
                        offer.instantOfferId,
                        offer.id
                    ].filter(Boolean);

                    if (!canonicalId) return;

                    for (const legacyId of legacyIds) {
                        if (legacyId && matched[legacyId] && !matched[canonicalId]) {
                            matched[canonicalId] = matched[legacyId];
                        }
                        if (legacyId && matchedMinPrices[legacyId] !== undefined && matchedMinPrices[canonicalId] === undefined) {
                            matchedMinPrices[canonicalId] = matchedMinPrices[legacyId];
                        }
                        if (legacyId && matchedMaxPrices[legacyId] !== undefined && matchedMaxPrices[canonicalId] === undefined) {
                            matchedMaxPrices[canonicalId] = matchedMaxPrices[legacyId];
                        }
                        if (legacyId && legacyId !== canonicalId) {
                            delete matched[legacyId];
                            delete matchedMinPrices[legacyId];
                            delete matchedMaxPrices[legacyId];
                        }
                    }
                });
                const validRuleIds = new Set();
                offers.forEach((o) => {
                    collectOfferRuleKeyAliases(o).forEach((id) => validRuleIds.add(id));
                });
                for (const key of Object.keys(matched)) {
                    if (!validRuleIds.has(String(key))) delete matched[key];
                }
                for (const key of Object.keys(matchedMinPrices)) {
                    if (!validRuleIds.has(String(key))) delete matchedMinPrices[key];
                }
                for (const key of Object.keys(matchedMaxPrices)) {
                    if (!validRuleIds.has(String(key))) delete matchedMaxPrices[key];
                }
                const changed =
                    JSON.stringify(matched) !== JSON.stringify(skipForParsingRef.current) ||
                    JSON.stringify(matchedMinPrices) !== JSON.stringify(minPricesRef.current) ||
                    JSON.stringify(matchedMaxPrices) !== JSON.stringify(maxPricesRef.current);

                if (changed) {
                    setMinPrices(matchedMinPrices);
                    setMaxPrices(matchedMaxPrices);
                    setSkipForParsing(matched);
                    minPricesRef.current = matchedMinPrices;
                    maxPricesRef.current = matchedMaxPrices;
                    skipForParsingRef.current = matched;
                    persistOfferRules({
                        minPrices: matchedMinPrices,
                        maxPrices: matchedMaxPrices,
                        skipForParsing: matched,
                        offerMetadata
                    }).catch((err) => {
                        console.error('Error saving normalized offer rules:', err);
                    });
                }
            } catch (err) {
                console.error('Error matching skipForParsing after offers load:', err);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offers.length]);

    const pruneRulesForOffers = useCallback(
        (currentOffers) => {
            const next = pruneOfferRulesForOffers(
                {
                    minPrices: minPricesRef.current || {},
                    maxPrices: maxPricesRef.current || {},
                    skipForParsing: skipForParsingRef.current || {}
                },
                currentOffers || []
            );

            if (!next.changed) return Promise.resolve(false);

            setMinPrices(next.minPrices);
            setMaxPrices(next.maxPrices);
            setSkipForParsing(next.skipForParsing);
            minPricesRef.current = next.minPrices;
            maxPricesRef.current = next.maxPrices;
            skipForParsingRef.current = next.skipForParsing;

            return persistOfferRules({
                minPrices: next.minPrices,
                maxPrices: next.maxPrices,
                skipForParsing: next.skipForParsing,
                offerMetadata: buildOfferMetadata(currentOffers || [])
            }).then(() => true);
        },
        []
    );

    const flushToLocalStorage = useCallback(() => {
        return persistOfferRules({
            minPrices: minPricesRef.current || {},
            maxPrices: maxPricesRef.current || {},
            skipForParsing: skipForParsingRef.current || {},
            offerMetadata
        }).catch((err) => {
            console.error('Error flushing offer rules to SQLite:', err);
        });
    }, [offerMetadata]);

    return {
        minPrices,
        setMinPrices,
        minPricesRef,
        pendingMinPrices,
        setPendingMinPrices,
        maxPrices,
        setMaxPrices,
        maxPricesRef,
        pendingMaxPrices,
        setPendingMaxPrices,
        skipForParsing,
        setSkipForParsing,
        skipForParsingRef,
        pruneRulesForOffers,
        flushToLocalStorage
    };
}
