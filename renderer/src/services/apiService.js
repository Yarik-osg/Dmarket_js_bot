import { DMarketClient } from './dmarketClient.js';

class ApiService {
    constructor(client) {
        if (!client || !(client instanceof DMarketClient)) {
            throw new Error('DMarketClient instance is required');
        }
        this.client = client;
    }

    // Marketplace API - Targets
    async getTargetsByTitle(gameId, title) {
        const path = `/marketplace-api/v1/targets-by-title/${gameId}/${title}`;
        return await this.client.call('GET', path);
    }

    async createTarget(targetData) {
        const path = '/marketplace-api/v1/user-targets/create';
        // https://api.dmarket.com/marketplace-api/v1/user-targets/create
        return await this.client.call('POST', path, targetData);
    }

    async updateTarget(targetId, targetData, gameId = 'a8db', title, floatPartValue = null, phase = null, paintSeed = null) {
        const path = `/exchange/v1/target/update`;
        // https://api.dmarket.com/exchange/v1/target/update
        // Price should be in cents (without decimal point)
        // Example: 33.97 USD = 3397 cents
        let priceAmount = targetData.price?.amount;
        
        // Convert price from decimal dollars to cents (string without decimal point)
        if (typeof priceAmount === 'string') {
            const dollars = parseFloat(priceAmount);
            if (!isNaN(dollars)) {
                priceAmount = Math.round(dollars * 100).toString(); // Convert to cents and remove decimal
            }
        } else if (typeof priceAmount === 'number') {
            // If already a number, assume it's in dollars and convert to cents
            priceAmount = Math.round(priceAmount * 100).toString();
        }
        
        if (!title) {
            console.error('updateTarget: title is missing!', { targetId, targetData, gameId });
        }
        
        // Ensure amount is a number
        let amount = targetData.amount;
        if (typeof amount === 'string') {
            amount = parseInt(amount, 10) || 1;
        } else if (typeof amount !== 'number') {
            amount = 1;
        }
        
        // Build attributes object
        const attributes = {
            title: title,
            gameId: gameId,
        };
        
        // Add floatPartValue if provided
        if (floatPartValue && floatPartValue !== '' && floatPartValue !== 'N/A') {
            attributes.floatPartValue = floatPartValue;
        }
        
        // Add phase if provided
        if (phase && phase !== '' && phase !== 'N/A') {
            attributes.phase = phase;
        }
        
        // Add paintSeed if provided (and not 0)
        if (paintSeed !== null && paintSeed !== undefined && paintSeed !== '' && paintSeed !== 'N/A') {
            const paintSeedNum = parseInt(paintSeed);
            if (!isNaN(paintSeedNum) && paintSeedNum !== 0) {
                attributes.paintSeed = paintSeedNum;
            }
        }
        
        const requestBody = {
            force: true,
            targets: [{ 
                id: targetId,
                body: {
                    amount: amount, // Must be a number
                    gameId: gameId,
                    attributes: attributes,
                    price: {
                        amount: priceAmount,
                        currency: targetData.price?.currency || 'USD'
                    }
                }
            }]
        };
        
        console.log('updateTarget request:', JSON.stringify(requestBody, null, 2));
        console.log('updateTarget - title value:', title, 'type:', typeof title);
        console.log('updateTarget - floatPartValue:', floatPartValue);
        console.log('updateTarget - phase:', phase);
        console.log('updateTarget - paintSeed:', paintSeed);
        const response = await this.client.call('POST', path, requestBody);
        
        console.log('updateTarget response:', JSON.stringify(response, null, 2));
        
        // Check for failed targets even if status is 200 OK
        // failedTargets can be an array or might be nested
        const failedTargets = response?.failedTargets || response?.failed_targets || [];
        const updated = response?.updated || [];
        
        if (failedTargets && failedTargets.length > 0) {
            console.warn('updateTarget: failedTargets detected:', failedTargets);
            const failedTarget = failedTargets[0];
            const errorMessage = failedTarget.message || failedTarget.errorCode || 'Unknown error';
            const error = new Error(errorMessage);
            error.errorCode = failedTarget.errorCode;
            error.failedTargets = failedTargets;
            error.updated = updated;
            throw error;
        }
        
        // If updated array is empty and we sent a target, it means update failed
        // (unless there are no failedTargets, which would be strange)
        if (updated.length === 0 && requestBody.targets && requestBody.targets.length > 0) {
            console.warn('updateTarget: updated array is empty, update likely failed. Response:', response);
            // Don't throw here, as it might be a valid response in some cases
            // But log it for debugging
        }
        
        return response;
    }

    async deleteTarget(targetId) {
        const path = `/marketplace-api/v1/user-targets/delete`;
        // Include targetId in the request body for DELETE
        console.log('delete targetId', targetId);
        return await this.client.call('POST', path, { Targets: [{ "TargetID": targetId }] });
    }

    async activateTarget(targetId) {
        const path = '/exchange/v1/target/activate';
        const requestBody = {
            force: true,
            targetIds: [targetId]
        };
        console.log('activate target', targetId, requestBody);
        return await this.client.call('POST', path, requestBody);
    }

    async deactivateTarget(targetId) {
        const path = '/exchange/v1/target/deactivate';
        const requestBody = {
            force: true,
            targetIds: [targetId]
        };
        console.log('deactivate target', targetId, requestBody);
        return await this.client.call('POST', path, requestBody);
    }

    // Exchange API - Market Items
    async getMarketItems(params = {}) {
        const path = '/exchange/v1/offers-by-title';
        // https://api.dmarket.com/exchange/v1/offers-by-title
        return await this.client.call('GET', path, params);
    }

    async getAllMarketItems(params = {}) {
        const path = '/exchange/v1/market/items';
        // https://api.dmarket.com/exchange/v1/market/items
        // Default parameters
        const defaultParams = {
            gameId: 'a8db',
            currency: 'USD',
            limit: 100,
            offset: 0
        };
        const finalParams = { ...defaultParams, ...params };
        return await this.client.call('GET', path, finalParams);
    }

    // Trade Aggregator API
    async getLastSales(params) {
        const path = '/trade-aggregator/v1/last-sales';
        return await this.client.call('GET', path, params);
    }

    // Exchange API - User Data
    async getUserOffers(params = {}) {
        const path = '/exchange/v1/user/offers';
        return await this.client.call('GET', path, params);
    }

    async getUserItems(params = {}) {
        const path = '/exchange/v1/user/items';
        console.log('getUserItems', params);
        return await this.client.call('GET', path, params);
    }

    async getUserTargets(params = {}) {
        const path = '/exchange/v1/user/targets';
        // Default parameters
        const defaultParams = {
            currency: 'USD',
            gameId: 'a8db',
            limit: 100
        };
        // Merge with provided params
        const finalParams = { ...defaultParams, ...params };
        return await this.client.call('GET', path, finalParams);
    }

    // Marketplace API - Aggregated Prices
    async getAggregatedPrices(gameId, titles, limit = '100') {
        const path = '/marketplace-api/v1/aggregated-prices';
        const requestBody = {
            filter: {
                game: gameId,
                titles: titles
            },
            limit: limit.toString()
        };
        return await this.client.call('POST', path, requestBody);
    }

    // Account API - User Balance
    async getUserBalance(params = {}) {
        const path = '/account/v1/balance';
        return await this.client.call('GET', path, params);
    }

    // Exchange API - Transaction History
    async getTransactionHistory(params = {}) {
        const path = '/exchange/v1/history';
        // Default parameters according to DMarket API
        const defaultParams = {
            version: 'V3',
            activities: '', // Empty = all activities
            from: 0,
            createdFrom: 0,
            statuses: '', // Empty = all statuses
            to: 0,
            createdTo: 0,
            sortBy: 'createdAt', // Sort by creation date
            offset: 0,
            limit: 20 // Get last 20 transactions
        };
        const finalParams = { ...defaultParams, ...params };
        return await this.client.call('GET', path, finalParams);
    }

    // Marketplace API - Create Offers (v2 batch)
    // POST /marketplace-api/v2/offers:batchCreate
    // Body: { requests: [{ assetId: string, priceCents: number }] }
    async createOffer(offersData) {
        const path = '/marketplace-api/v2/offers:batchCreate';
        let body = offersData;

        // Legacy v1 shape from older clients: { Offers: [{ AssetID, Price: { Amount, Currency } }] }
        if (offersData?.Offers && !offersData?.requests) {
            body = {
                requests: offersData.Offers.map((o) => {
                    const amount = o.Price?.Amount;
                    const dollars =
                        typeof amount === 'number'
                            ? amount
                            : parseFloat(String(amount || 0)) || 0;
                    return {
                        assetId: o.AssetID || o.assetId,
                        priceCents: Math.round(dollars * 100)
                    };
                })
            };
        }

        return await this.client.call('POST', path, body);
    }

    // Marketplace API - Update Offer (v2 batch)
    // POST /marketplace-api/v2/offers:batchUpdate
    // Body: { requests: [{ offerId: string, priceCents: number }] }
    // offerData: { Price: { Amount: number (USD dollars), Currency } } or { priceCents: number }
    async updateOffer(offerId, _assetId, offerData) {
        const path = '/marketplace-api/v2/offers:batchUpdate';

        if (!offerId) {
            throw new Error('offerId is required to update an offer');
        }

        let priceCents;
        if (offerData?.priceCents !== undefined && offerData?.priceCents !== null) {
            priceCents = Math.round(Number(offerData.priceCents));
        } else if (offerData?.Price?.Amount !== undefined && offerData?.Price?.Amount !== null) {
            const amount = offerData.Price.Amount;
            const dollars =
                typeof amount === 'number' ? amount : parseFloat(String(amount)) || 0;
            priceCents = Math.round(dollars * 100);
        } else {
            throw new Error('priceCents or Price.Amount is required to update an offer');
        }

        const requestBody = {
            requests: [{ offerId: String(offerId), priceCents }]
        };

        console.log('inside update offer', requestBody);
        const response = await this.client.call('POST', path, requestBody);

        console.log('updateOffer response:', JSON.stringify(response, null, 2));

        // Legacy v1-style body: { Result: [...] }
        if (response && response.Result && Array.isArray(response.Result)) {
            for (const resultItem of response.Result) {
                const items = Array.isArray(resultItem) ? resultItem : [resultItem];

                for (const item of items) {
                    if (item.Error || item.Successful === false) {
                        const errorCode = item.Error?.Code || item.Code || 'UnknownError';
                        const errorMessage = item.Error?.Message || item.Message || 'Unknown error';
                        const error = new Error(errorMessage);
                        error.errorCode = errorCode;
                        error.result = item;
                        error.response = response;
                        throw error;
                    }
                }
            }
        }

        // v2 batch: per-request errors (common patterns)
        const batchResults = response?.results || response?.Requests || response?.requests;
        if (Array.isArray(batchResults)) {
            for (const item of batchResults) {
                if (item?.error || item?.Error || item?.successful === false || item?.Successful === false) {
                    const errorCode = item.error?.code || item.Error?.Code || item.code || 'UnknownError';
                    const errorMessage =
                        item.error?.message ||
                        item.Error?.Message ||
                        item.message ||
                        'Unknown error';
                    const error = new Error(errorMessage);
                    error.errorCode = errorCode;
                    error.result = item;
                    error.response = response;
                    throw error;
                }
            }
        }

        return response;
    }

    // Marketplace API - Delete Offers (v2 batch)
    // POST /marketplace-api/v2/offers:batchDelete
    // Body: { requests: [{ offerId: string }] }
    async deleteOffer(offer) {
        const path = '/marketplace-api/v2/offers:batchDelete';
        const offerId =
            offer?.extra?.offerId ||
            offer?.offerId ||
            offer?.instantOfferId ||
            offer?.itemId;

        if (!offerId) {
            throw new Error('offerId is required to delete an offer');
        }

        const requestBody = {
            requests: [{ offerId: String(offerId) }]
        };

        console.log('delete offer', offer);
        console.log('delete offer:', requestBody);
        return await this.client.call('POST', path, requestBody);
    }
}

export { ApiService };

