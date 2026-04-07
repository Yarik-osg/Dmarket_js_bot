/**
 * Match buy orders API rows to a user target (float / phase / paint seed).
 */

export function getTargetFilterAttributes(target) {
    return {
        targetFloatValue: target.extra?.floatPartValue || target.attributes?.floatPartValue,
        targetPhase: target.attributes?.phase || target.extra?.phase,
        targetPaintSeed: target.attributes?.paintSeed || target.extra?.paintSeed
    };
}

export function orderMatchesTargetAttributes(order, attrs) {
    const { targetFloatValue, targetPhase, targetPaintSeed } = attrs;
    const orderFloatValue = order.attributes?.floatPartValue;
    const orderPhase = order.attributes?.phase;
    const orderPaintSeed = order.attributes?.paintSeed;

    const floatMatches =
        orderFloatValue === 'any' ||
        (targetFloatValue && orderFloatValue === targetFloatValue) ||
        (!targetFloatValue && !orderFloatValue);

    const phaseMatches = !targetPhase || orderPhase === targetPhase;

    const paintSeedMatches =
        !targetPaintSeed ||
        targetPaintSeed === 0 ||
        (orderPaintSeed && parseInt(orderPaintSeed, 10) === parseInt(targetPaintSeed, 10));

    return floatMatches && phaseMatches && paintSeedMatches;
}

export function filterOrdersForTarget(orders, target) {
    if (!orders?.length) return [];
    const attrs = getTargetFilterAttributes(target);
    return orders.filter((order) => orderMatchesTargetAttributes(order, attrs));
}

/**
 * IDs of "our" targets that share the same item slice (title + float + phase + seed).
 */
export function buildOurTargetIdSet(currentTargets, title, targetFloatValue, targetPhase, targetPaintSeed) {
    const ids = new Set();
    for (const ourTarget of currentTargets) {
        const ourTargetTitle =
            ourTarget.itemTitle || ourTarget.title || ourTarget.extra?.name || ourTarget.attributes?.title;
        const ourTargetFloat = ourTarget.extra?.floatPartValue || ourTarget.attributes?.floatPartValue;
        const ourTargetPhase = ourTarget.attributes?.phase || ourTarget.extra?.phase;
        const ourTargetPaintSeed = ourTarget.attributes?.paintSeed || ourTarget.extra?.paintSeed;

        const titleMatch = ourTargetTitle === title;
        const floatMatch = ourTargetFloat === targetFloatValue;
        const phaseMatch =
            (!targetPhase && !ourTargetPhase) || targetPhase === ourTargetPhase;
        const paintSeedMatch =
            ((!targetPaintSeed || targetPaintSeed === 0) &&
                (!ourTargetPaintSeed || ourTargetPaintSeed === 0)) ||
            (targetPaintSeed &&
                ourTargetPaintSeed &&
                parseInt(targetPaintSeed, 10) === parseInt(ourTargetPaintSeed, 10));

        if (titleMatch && floatMatch && phaseMatch && paintSeedMatch) {
            const id = ourTarget.targetId || ourTarget.itemId || ourTarget.instantTargetId;
            if (id) ids.add(id);
        }
    }
    return ids;
}
