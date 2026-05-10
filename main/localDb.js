import { join } from 'path';
import { existsSync, statSync } from 'fs';
import Database from 'better-sqlite3';

const DB_FILE_NAME = 'app.db';
const SCHEMA_VERSION = 2;
const SQLITE_BUSY_TIMEOUT_MS = 5000;

function nowIso() {
    return new Date().toISOString();
}

function safeJsonParse(value, fallback = null) {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function safeJsonStringify(value) {
    try {
        return JSON.stringify(value ?? null);
    } catch {
        return 'null';
    }
}

function normalizeId(value) {
    if (value === null || value === undefined || value === '') return null;
    return String(value);
}

function normalizeTransaction(transaction) {
    const id = normalizeId(transaction?.originalId || transaction?.id);
    if (!id || id.startsWith('test-')) return null;

    const timestamp = transaction.timestamp || transaction.createdAt || nowIso();
    return {
        id,
        type: transaction.type || 'unknown',
        itemTitle: transaction.itemTitle || null,
        assetId: normalizeId(transaction.assetId),
        amount: transaction.amount === null || transaction.amount === undefined
            ? null
            : Number(transaction.amount),
        currency: transaction.currency || 'USD',
        timestamp,
        rawJson: safeJsonStringify(transaction)
    };
}

function mapAnalyticsRow(row) {
    const raw = safeJsonParse(row.raw_json, {});
    return {
        ...raw,
        id: raw.id ?? row.id,
        type: raw.type ?? row.type,
        itemTitle: raw.itemTitle ?? row.item_title,
        assetId: raw.assetId ?? row.asset_id,
        amount: raw.amount ?? row.amount,
        currency: raw.currency ?? row.currency,
        timestamp: raw.timestamp ?? row.timestamp,
        createdAt: raw.createdAt ?? row.timestamp
    };
}

function normalizePresetNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? null : numberValue;
}

function normalizeTargetPreset(preset) {
    const id = normalizeId(preset?.id);
    const title = typeof preset?.title === 'string' ? preset.title.trim() : '';
    if (!id || !title) return null;

    const amount = Number.parseInt(preset.amount, 10);
    return {
        id,
        title,
        gameId: preset.gameId || preset.game_id || 'a8db',
        price: normalizePresetNumber(preset.price),
        amount: Number.isNaN(amount) || amount < 1 ? 1 : amount,
        maxPrice: normalizePresetNumber(preset.maxPrice ?? preset.max_price),
        floatPartValue: preset.floatPartValue ?? preset.float_part_value ?? null,
        phase: preset.phase || null,
        paintSeed: preset.paintSeed ?? preset.paint_seed ?? null,
        metadataJson: safeJsonStringify(preset.metadata || {})
    };
}

function mapTargetPresetRow(row) {
    const metadata = safeJsonParse(row.metadata_json, {});
    return {
        id: row.id,
        title: row.title,
        gameId: row.game_id,
        price: row.price,
        amount: row.amount,
        maxPrice: row.max_price,
        floatPartValue: row.float_part_value,
        phase: row.phase,
        paintSeed: row.paint_seed,
        metadata,
        timesCreated: row.times_created,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastUsedAt: row.last_used_at
    };
}

function ensureSchema(db) {
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma(`busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);

    db.exec(`
        CREATE TABLE IF NOT EXISTS analytics_transactions (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            item_title TEXT,
            asset_id TEXT,
            amount REAL,
            currency TEXT,
            timestamp TEXT NOT NULL,
            raw_json TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_analytics_transactions_timestamp
            ON analytics_transactions(timestamp DESC);

        CREATE INDEX IF NOT EXISTS idx_analytics_transactions_type
            ON analytics_transactions(type);

        CREATE TABLE IF NOT EXISTS target_price_rules (
            item_id TEXT PRIMARY KEY,
            item_title TEXT,
            max_price REAL NOT NULL,
            metadata_json TEXT,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS target_price_rule_keys (
            rule_key TEXT PRIMARY KEY,
            max_price REAL NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS offer_price_rules (
            item_id TEXT PRIMARY KEY,
            item_title TEXT,
            min_price REAL,
            max_price REAL,
            skip_for_parsing INTEGER NOT NULL DEFAULT 0,
            metadata_json TEXT,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS target_presets (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            game_id TEXT NOT NULL DEFAULT 'a8db',
            price REAL,
            amount INTEGER NOT NULL DEFAULT 1,
            max_price REAL,
            float_part_value TEXT,
            phase TEXT,
            paint_seed TEXT,
            metadata_json TEXT,
            times_created INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_used_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_target_presets_updated_at
            ON target_presets(updated_at DESC);
    `);

    db.pragma(`user_version = ${SCHEMA_VERSION}`);
}

export function createLocalDb({ getUserDataPath }) {
    let db = null;
    let dbPath = null;

    function getDb() {
        if (db) return db;

        dbPath = join(getUserDataPath(), DB_FILE_NAME);
        db = new Database(dbPath, { timeout: SQLITE_BUSY_TIMEOUT_MS });
        ensureSchema(db);
        return db;
    }

    function getPath() {
        getDb();
        return dbPath;
    }

    function getHealth() {
        const database = getDb();
        const count = (tableName) =>
            database.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count;
        const fileStats = dbPath && existsSync(dbPath) ? statSync(dbPath) : null;

        return {
            status: 'ok',
            path: dbPath,
            fileSizeBytes: fileStats?.size ?? 0,
            schemaVersion: database.pragma('user_version', { simple: true }),
            sqliteVersion: database.prepare('SELECT sqlite_version() AS version').get().version,
            journalMode: database.pragma('journal_mode', { simple: true }),
            foreignKeys: database.pragma('foreign_keys', { simple: true }) === 1,
            busyTimeoutMs: database.pragma('busy_timeout', { simple: true }),
            tables: {
                analyticsTransactions: count('analytics_transactions'),
                targetPriceRules: count('target_price_rules'),
                targetPriceRuleKeys: count('target_price_rule_keys'),
                offerPriceRules: count('offer_price_rules'),
                targetPresets: count('target_presets')
            }
        };
    }

    const analytics = {
        get({ limit = 5000 } = {}) {
            const rows = getDb()
                .prepare(`
                    SELECT *
                    FROM analytics_transactions
                    ORDER BY timestamp DESC
                    LIMIT ?
                `)
                .all(Number(limit) || 5000);

            return rows.map(mapAnalyticsRow);
        },

        save(transactions = [], { replace = false } = {}) {
            const database = getDb();
            const timestamp = nowIso();
            const rows = transactions.map(normalizeTransaction).filter(Boolean);
            const insert = database.prepare(`
                INSERT INTO analytics_transactions (
                    id, type, item_title, asset_id, amount, currency, timestamp,
                    raw_json, created_at, updated_at
                )
                VALUES (
                    @id, @type, @itemTitle, @assetId, @amount, @currency,
                    @timestamp, @rawJson, @createdAt, @updatedAt
                )
                ON CONFLICT(id) DO UPDATE SET
                    type = excluded.type,
                    item_title = excluded.item_title,
                    asset_id = excluded.asset_id,
                    amount = excluded.amount,
                    currency = excluded.currency,
                    timestamp = excluded.timestamp,
                    raw_json = excluded.raw_json,
                    updated_at = excluded.updated_at
            `);

            database.transaction(() => {
                if (replace) {
                    database.prepare('DELETE FROM analytics_transactions').run();
                }
                for (const row of rows) {
                    insert.run({
                        ...row,
                        createdAt: timestamp,
                        updatedAt: timestamp
                    });
                }
            })();

            return { count: rows.length };
        },

        clear() {
            getDb().prepare('DELETE FROM analytics_transactions').run();
        }
    };

    const targetPriceRules = {
        get() {
            const database = getDb();
            const ruleRows = database.prepare('SELECT * FROM target_price_rules').all();
            const keyRows = database.prepare('SELECT * FROM target_price_rule_keys').all();
            const maxPrices = {};
            const maxPricesByKey = {};

            for (const row of ruleRows) {
                maxPrices[row.item_id] = row.max_price;
            }
            for (const row of keyRows) {
                maxPricesByKey[row.rule_key] = row.max_price;
            }

            return { maxPrices, maxPricesByKey };
        },

        saveSnapshot({ maxPrices = {}, maxPricesByKey = {}, targetMetadata = {} } = {}) {
            const database = getDb();
            const timestamp = nowIso();
            const metadataByPrice = new Map();
            for (const [ruleKey, maxPrice] of Object.entries(maxPricesByKey || {})) {
                if (maxPrice === null || maxPrice === undefined || maxPrice === '') continue;
                const [itemTitle, floatPartValue = ''] = String(ruleKey).split('|');
                if (!itemTitle) continue;
                metadataByPrice.set(String(maxPrice), { itemTitle, floatPartValue });
            }
            const insertRule = database.prepare(`
                INSERT INTO target_price_rules (
                    item_id, item_title, max_price, metadata_json, updated_at
                )
                VALUES (@itemId, @itemTitle, @maxPrice, @metadataJson, @updatedAt)
            `);
            const insertKey = database.prepare(`
                INSERT INTO target_price_rule_keys (rule_key, max_price, updated_at)
                VALUES (@ruleKey, @maxPrice, @updatedAt)
            `);

            database.transaction(() => {
                database.prepare('DELETE FROM target_price_rules').run();
                database.prepare('DELETE FROM target_price_rule_keys').run();

                for (const [itemId, maxPrice] of Object.entries(maxPrices || {})) {
                    if (itemId && maxPrice !== null && maxPrice !== undefined && maxPrice !== '') {
                        const metadata = targetMetadata[itemId] || metadataByPrice.get(String(maxPrice)) || {};
                        insertRule.run({
                            itemId,
                            itemTitle: metadata.itemTitle || null,
                            maxPrice: Number(maxPrice),
                            metadataJson: safeJsonStringify(metadata),
                            updatedAt: timestamp
                        });
                    }
                }

                for (const [ruleKey, maxPrice] of Object.entries(maxPricesByKey || {})) {
                    if (ruleKey && maxPrice !== null && maxPrice !== undefined && maxPrice !== '') {
                        insertKey.run({ ruleKey, maxPrice: Number(maxPrice), updatedAt: timestamp });
                    }
                }
            })();
        }
    };

    const offerPriceRules = {
        get() {
            const rows = getDb().prepare('SELECT * FROM offer_price_rules').all();
            const minPrices = {};
            const maxPrices = {};
            const skipForParsing = {};

            for (const row of rows) {
                if (row.min_price !== null && row.min_price !== undefined) {
                    minPrices[row.item_id] = row.min_price;
                }
                if (row.max_price !== null && row.max_price !== undefined) {
                    maxPrices[row.item_id] = row.max_price;
                }
                if (row.skip_for_parsing) {
                    skipForParsing[row.item_id] = true;
                }
            }

            return { minPrices, maxPrices, skipForParsing };
        },

        save({ minPrices = {}, maxPrices = {}, skipForParsing = {}, offerMetadata = {} } = {}) {
            const database = getDb();
            const timestamp = nowIso();
            const itemIds = new Set([
                ...Object.keys(minPrices || {}),
                ...Object.keys(maxPrices || {}),
                ...Object.keys(skipForParsing || {})
            ]);
            const insert = database.prepare(`
                INSERT INTO offer_price_rules (
                    item_id, item_title, min_price, max_price, skip_for_parsing,
                    metadata_json, updated_at
                )
                VALUES (
                    @itemId, @itemTitle, @minPrice, @maxPrice, @skipForParsing,
                    @metadataJson, @updatedAt
                )
            `);

            database.transaction(() => {
                database.prepare('DELETE FROM offer_price_rules').run();
                for (const itemId of itemIds) {
                    const metadata = offerMetadata[itemId] || {};
                    const hasMinPrice = minPrices[itemId] !== undefined && minPrices[itemId] !== '';
                    const hasMaxPrice = maxPrices[itemId] !== undefined && maxPrices[itemId] !== '';
                    const hasSkipForParsing = skipForParsing[itemId] === true;
                    if (!hasMinPrice && !hasMaxPrice && !hasSkipForParsing) {
                        continue;
                    }
                    insert.run({
                        itemId,
                        itemTitle: metadata.itemTitle || null,
                        minPrice: !hasMinPrice
                            ? null
                            : Number(minPrices[itemId]),
                        maxPrice: !hasMaxPrice
                            ? null
                            : Number(maxPrices[itemId]),
                        skipForParsing: hasSkipForParsing ? 1 : 0,
                        metadataJson: safeJsonStringify(metadata),
                        updatedAt: timestamp
                    });
                }
            })();
        }
    };

    const targetPresets = {
        get() {
            const rows = getDb()
                .prepare(`
                    SELECT *
                    FROM target_presets
                    ORDER BY last_used_at IS NULL ASC, last_used_at DESC, updated_at DESC
                `)
                .all();
            return rows.map(mapTargetPresetRow);
        },

        upsert(preset = {}) {
            const database = getDb();
            const row = normalizeTargetPreset(preset);
            if (!row) {
                throw new Error('Target preset requires id and title');
            }

            const timestamp = nowIso();
            database.prepare(`
                INSERT INTO target_presets (
                    id, title, game_id, price, amount, max_price, float_part_value,
                    phase, paint_seed, metadata_json, times_created,
                    created_at, updated_at, last_used_at
                )
                VALUES (
                    @id, @title, @gameId, @price, @amount, @maxPrice, @floatPartValue,
                    @phase, @paintSeed, @metadataJson, 1,
                    @timestamp, @timestamp, @timestamp
                )
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    game_id = excluded.game_id,
                    price = excluded.price,
                    amount = excluded.amount,
                    max_price = excluded.max_price,
                    float_part_value = excluded.float_part_value,
                    phase = excluded.phase,
                    paint_seed = excluded.paint_seed,
                    metadata_json = excluded.metadata_json,
                    times_created = target_presets.times_created + 1,
                    updated_at = excluded.updated_at,
                    last_used_at = excluded.last_used_at
            `).run({ ...row, timestamp });

            return mapTargetPresetRow(
                database.prepare('SELECT * FROM target_presets WHERE id = ?').get(row.id)
            );
        },

        delete(id) {
            const normalizedId = normalizeId(id);
            if (!normalizedId) return { deleted: 0 };
            const result = getDb().prepare('DELETE FROM target_presets WHERE id = ?').run(normalizedId);
            return { deleted: result.changes || 0 };
        }
    };

    function close() {
        if (db) {
            db.close();
            db = null;
        }
    }

    return {
        getPath,
        getHealth,
        analytics,
        targetPriceRules,
        offerPriceRules,
        targetPresets,
        close
    };
}
