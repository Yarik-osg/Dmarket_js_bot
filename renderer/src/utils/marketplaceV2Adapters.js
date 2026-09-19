const DEFAULT_GAME_ID = 'a8db';

const INVENTORY_ORDER_BY_MAP = {
    updated: 'updatedAt',
    created: 'createdAt',
    price: 'price',
    title: 'title',
    float: 'float',
    updatedAt: 'updatedAt',
    createdAt: 'createdAt'
};

const TARGETS_ORDER_BY_MAP = {
    updated: 'createdAt',
    created: 'createdAt',
    price: 'price',
    title: 'title',
    createdAt: 'createdAt',
    updatedAt: 'createdAt'
};

const OFFERS_ORDER_BY_MAP = {
    updated: 'createdAt',
    created: 'createdAt',
    price: 'price',
    title: 'title',
    float: 'float',
    discount: 'discount',
    createdAt: 'createdAt'
};

function clampLimit(limit) {
    const n = Number.parseInt(limit, 10);
    if (!Number.isFinite(n) || n < 1) return 100;
    return Math.min(100, Math.max(1, n));
}

function usdAmountToCentsString(amount) {
    if (amount === undefined || amount === null || amount === '') return null;
    if (typeof amount === 'number' && Number.isFinite(amount)) {
        return String(Math.round(amount * 100));
    }
    const str = String(amount).trim();
    if (str === '') return null;
    if (str.includes('.') || /e/i.test(str)) {
        const dollars = parseFloat(str);
        if (!Number.isFinite(dollars)) return null;
        return String(Math.round(dollars * 100));
    }
    return str;
}

function normalizeEnum(value, prefix) {
    const raw = String(value || '').trim();
    if (!raw || raw.endsWith('_UNSPECIFIED')) return '';
    return raw
        .replace(new RegExp(`^${prefix}_`), '')
        .toLowerCase()
        .replaceAll('_', '-');
}

function normalizeFloatPart(value) {
    const raw = String(value || '').trim();
    if (!raw || raw.endsWith('_UNSPECIFIED')) return '';
    return raw.replace(/^FLOAT_PART_/, '').replaceAll('_', '-');
}

function normalizeExterior(value) {
    const exterior = String(value || '').replace(/^EXTERIOR_/, '').toLowerCase();
    const values = {
        factory_new: 'factory new',
        minimal_wear: 'minimal wear',
        field_tested: 'field-tested',
        well_worn: 'well-worn',
        battle_scarred: 'battle-scarred',
        not_painted: 'not painted'
    };
    return values[exterior] || exterior.replaceAll('_', '-');
}

function normalizeCategory(value) {
    const category = String(value || '').replace(/^CATEGORY_/, '').toLowerCase();
    return category === 'stattrak_tm' ? 'stattrak_tm' : category.replaceAll('_', '-');
}

function normalizePhase(cs2 = {}) {
    const raw = cs2.phase || cs2.phaseTitle || '';
    return normalizeEnum(raw, 'PHASE_TITLE');
}

function translateInventoryTreeFilters(treeFilters) {
    if (!treeFilters) return undefined;
    const raw = String(treeFilters).trim();
    if (!raw) return undefined;
    if (raw.includes('itemLocation[]=true')) {
        return 'inMarket=true';
    }
    return raw;
}

export function buildMarketplaceV2InventoryQuery(params = {}) {
    const gameId = params.gameId || DEFAULT_GAME_ID;
    const query = {
        gameId,
        limit: clampLimit(params.limit ?? 100)
    };

    if (params.title) query.title = params.title;
    if (params.cursor) query.cursor = params.cursor;

    const orderBy = INVENTORY_ORDER_BY_MAP[params.orderBy] || params.orderBy;
    if (orderBy) query.orderBy = orderBy;
    if (params.orderDir) query.orderDir = params.orderDir;

    const treeFilters = translateInventoryTreeFilters(params.treeFilters);
    if (treeFilters) query.treeFilters = treeFilters;

    return query;
}

export function buildMarketplaceV2TargetsQuery(params = {}) {
    const gameId = params.gameId || DEFAULT_GAME_ID;
    const query = {
        gameId,
        limit: clampLimit(params.limit ?? 100)
    };

    if (params.title) query.title = params.title;
    if (params.cursor) query.cursor = params.cursor;
    if (params.priceFrom != null) query.priceFrom = params.priceFrom;
    if (params.priceTo != null) query.priceTo = params.priceTo;

    const orderBy = TARGETS_ORDER_BY_MAP[params.orderBy] || params.orderBy;
    if (orderBy) query.orderBy = orderBy;
    if (params.orderDir) query.orderDir = params.orderDir;

    if (params.treeFilters) query.treeFilters = params.treeFilters;

    return query;
}

export function buildMarketplaceV2OffersQuery(params = {}, { userOffers = false } = {}) {
    const query = {
        gameId: params.gameId || DEFAULT_GAME_ID,
        limit: clampLimit(params.limit ?? 100)
    };

    if (params.title) query.title = params.title;
    if (params.cursor) query.cursor = params.cursor;
    if (params.treeFilters) query.treeFilters = params.treeFilters;

    if (!userOffers) {
        if (params.priceFrom != null) query.priceFrom = params.priceFrom;
        if (params.priceTo != null) query.priceTo = params.priceTo;
        if (params.withImages != null) query.withImages = Boolean(params.withImages);
    }

    const orderBy = OFFERS_ORDER_BY_MAP[params.orderBy] || params.orderBy;
    if (orderBy) query.orderBy = orderBy;
    if (params.orderDir) query.orderDir = params.orderDir;

    return query;
}

function mapV2TargetStatus(status) {
    const value = String(status || '').toUpperCase();
    if (value.includes('INACTIVE')) return 'inactive';
    if (value.includes('ACTIVE')) return 'active';
    return String(status || '').toLowerCase() || 'inactive';
}

function buildTargetAttributes(item, gameId) {
    const attrs = item?.attributes && typeof item.attributes === 'object' ? item.attributes : {};
    const cs2 = attrs.cs2 && typeof attrs.cs2 === 'object' ? attrs.cs2 : {};
    const title = item.title || attrs.title || '';

    return {
        ...attrs,
        title,
        gameId,
        name: attrs.name || title,
        image: attrs.imageUri || attrs.image || '',
        categoryPath: attrs.categoryPath || '',
        category: normalizeCategory(cs2.category),
        exterior: normalizeExterior(cs2.exterior),
        phase: normalizePhase(cs2),
        paintSeed: cs2.paintSeed ?? '',
        floatPartValue: normalizeFloatPart(cs2.floatPart || cs2.floatPartValue)
    };
}

export function normalizeMarketplaceV2Target(item, gameId = DEFAULT_GAME_ID) {
    if (!item || typeof item !== 'object') return item;

    const attributes = buildTargetAttributes(item, gameId);
    const priceCents = item.priceCents ?? 0;
    const targetId = item.targetId || item.id;

    return {
        type: 'target',
        itemId: targetId,
        targetId,
        instantTargetId: targetId,
        title: attributes.title,
        gameId,
        amount: item.amount ?? 1,
        status: mapV2TargetStatus(item.status),
        price: {
            USD: String(priceCents),
            currency: 'USD',
            amount: String(priceCents / 100)
        },
        attributes,
        extra: {
            name: attributes.name,
            category: attributes.category,
            exterior: attributes.exterior,
            phase: attributes.phase,
            paintSeed: attributes.paintSeed,
            floatPartValue: attributes.floatPartValue,
            image: attributes.image,
            categoryPath: attributes.categoryPath
        },
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
    };
}

function buildInventoryExtra(attrs = {}, title = '') {
    const cs2 = attrs.cs2 && typeof attrs.cs2 === 'object' ? attrs.cs2 : {};
    return {
        name: attrs.name || title,
        category: normalizeCategory(cs2.category) || attrs.category || '',
        exterior: normalizeExterior(cs2.exterior) || attrs.exterior || '',
        phase: normalizePhase(cs2),
        paintSeed: cs2.paintSeed ?? '',
        floatPartValue: normalizeFloatPart(cs2.floatPart || cs2.floatPartValue),
        floatValue: cs2.float ?? cs2.floatValue ?? attrs.floatValue,
        image: attrs.imageUri || attrs.image || '',
        categoryPath: attrs.categoryPath || ''
    };
}

export function normalizeMarketplaceV2InventoryItem(item, gameId = DEFAULT_GAME_ID) {
    if (!item || typeof item !== 'object') return item;

    const attrs = item.attributes && typeof item.attributes === 'object' ? item.attributes : {};
    const assetId = item.assetId || item.id || attrs.assetId || attrs.id;
    const title = item.title || attrs.title || attrs.name || '';
    const extra = buildInventoryExtra(attrs, title);

    const suggestedCents =
        item.suggestedPrice?.amount != null
            ? usdAmountToCentsString(item.suggestedPrice.amount)
            : item.suggestedPriceCents != null
              ? String(item.suggestedPriceCents)
              : null;
    const offerRecommendedCents =
        item.offerRecommendedPrice?.amount != null
            ? usdAmountToCentsString(item.offerRecommendedPrice.amount)
            : item.offerRecommendedPriceCents != null
              ? String(item.offerRecommendedPriceCents)
              : null;

    const normalized = {
        type: 'item',
        itemId: assetId,
        assetId,
        title,
        gameId: attrs.gameId || gameId,
        inMarket: item.inMarket,
        image: attrs.imageUri || attrs.image || item.image || '',
        attributes: {
            ...attrs,
            title,
            image: attrs.imageUri || attrs.image || '',
            floatPartValue: extra.floatPartValue,
            phase: extra.phase,
            paintSeed: extra.paintSeed
        },
        extra,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
    };

    if (item.fees) normalized.fees = item.fees;

    if (suggestedCents) {
        normalized.instantPrice = { USD: suggestedCents };
        normalized.suggestedPrice = { USD: suggestedCents };
    }

    if (offerRecommendedCents) {
        normalized.recommendedPrice = {
            offerPrice: { USD: offerRecommendedCents }
        };
    }

    return normalized;
}

export function normalizeMarketplaceV2Offer(item, gameId = DEFAULT_GAME_ID) {
    if (!item || typeof item !== 'object') return item;

    const attrs = item.attributes && typeof item.attributes === 'object' ? item.attributes : {};
    const assetId = attrs.id || item.assetId;
    const offerId = item.offerId || item.id;
    const title = attrs.title || attrs.name || item.title || '';
    const extra = {
        ...buildInventoryExtra(attrs, title),
        offerId,
        assetId,
        gameId: attrs.gameId || gameId
    };
    const priceCents = String(item.priceCents ?? 0);

    return {
        type: 'offer',
        id: offerId,
        itemId: assetId,
        assetId,
        offerId,
        instantOfferId: offerId,
        title,
        gameId: attrs.gameId || gameId,
        image: attrs.imageUri || attrs.image || '',
        owner: attrs.owner,
        price: {
            USD: priceCents,
            amount: priceCents,
            currency: 'USD'
        },
        attributes: {
            ...attrs,
            title,
            image: attrs.imageUri || attrs.image || '',
            floatPartValue: extra.floatPartValue,
            phase: extra.phase,
            paintSeed: extra.paintSeed
        },
        extra,
        locked: item.locked,
        discount: item.discountPercent,
        discountPercent: item.discountPercent,
        createdAt: item.createdAt
    };
}

export function normalizeMarketplaceV2ListResponse(response, normalizeItem, gameId = DEFAULT_GAME_ID) {
    if (!response || typeof response !== 'object') {
        return { objects: [], total: 0, cursor: null };
    }

    if (Array.isArray(response.objects)) {
        return response;
    }

    const rawItems = response.items || response.Items || [];
    const objects = rawItems.map((item) => normalizeItem(item, gameId));

    return {
        objects,
        total: response.total ?? response.Total ?? objects.length,
        cursor: response.cursor ?? response.Cursor ?? null
    };
}

export async function fetchMarketplaceV2Pages(
    client,
    path,
    query,
    normalizeItem,
    { fetchAll = false, maxItems } = {}
) {
    const allObjects = [];
    const seenCursors = new Set();
    let cursor = query.cursor;
    let total;
    const itemLimit = fetchAll ? Infinity : Math.max(1, maxItems ?? query.limit);

    do {
        const pageQuery = { ...query };
        if (cursor) pageQuery.cursor = cursor;
        else delete pageQuery.cursor;

        const response = await client.call('GET', path, pageQuery);
        const normalized = normalizeMarketplaceV2ListResponse(response, normalizeItem, query.gameId);
        allObjects.push(...normalized.objects);
        total = normalized.total ?? total;
        cursor = normalized.cursor;

        if (!cursor || allObjects.length >= itemLimit || seenCursors.has(cursor)) break;
        seenCursors.add(cursor);
    } while (true);

    return {
        objects: allObjects.slice(0, itemLimit),
        total: total ?? allObjects.length,
        cursor: cursor || null
    };
}

export async function fetchMarketplaceV2AllPages(client, path, query, normalizeItem, options = {}) {
    return fetchMarketplaceV2Pages(client, path, query, normalizeItem, {
        ...options,
        fetchAll: options.fetchAll ?? true
    });
}
