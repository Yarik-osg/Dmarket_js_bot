import { ApiService } from './apiService.js';

export class MarketAnalysisService {
    constructor(apiService) {
        this.apiService = apiService;
        this.priceHistory = new Map();
    }

    async analyzeOpportunities(itemTitle, gameId = 'a8db') {
        try {
            // Get current market prices
            const marketItems = await this.apiService.getMarketItems({
                gameId,
                title: itemTitle,
                limit: 100
            });

            const targets = await this.apiService.getTargetsByTitle(gameId, itemTitle);
            
            if (!marketItems?.objects || marketItems.objects.length === 0) {
                return null;
            }

            // Find lowest sell price
            const sellPrices = marketItems.objects
                .map(item => {
                    const price = item.price?.USD || item.price?.amount || item.price;
                    return typeof price === 'string' ? parseFloat(price) : price;
                })
                .filter(price => price > 0 && !isNaN(price));

            if (sellPrices.length === 0) return null;

            const lowestSellPrice = Math.min(...sellPrices);

            // Find highest buy price
            let highestBuyPrice = 0;
            if (targets?.orders && targets.orders.length > 0) {
                const buyPrices = targets.orders
                    .map(order => {
                        const price = order.price?.amount || order.price?.USD || order.price;
                        return typeof price === 'string' ? parseFloat(price) : price;
                    })
                    .filter(price => price > 0 && !isNaN(price));
                
                if (buyPrices.length > 0) {
                    highestBuyPrice = Math.max(...buyPrices);
                }
            }

            // Calculate potential profit
            const potentialProfit = highestBuyPrice - lowestSellPrice;
            const profitMargin = lowestSellPrice > 0 ? (potentialProfit / lowestSellPrice) * 100 : 0;

            return {
                itemTitle,
                lowestSellPrice: lowestSellPrice / 100, // Convert from cents to dollars
                highestBuyPrice: highestBuyPrice / 100,
                potentialProfit: potentialProfit / 100,
                profitMargin,
                opportunity: profitMargin > 5, // If margin > 5%
                sellOrdersCount: sellPrices.length,
                buyOrdersCount: targets?.orders?.length || 0
            };
        } catch (err) {
            console.error('Market analysis error:', err);
            return null;
        }
    }

    trackPriceTrend(itemTitle, currentPrice) {
        const key = itemTitle;
        if (!this.priceHistory.has(key)) {
            this.priceHistory.set(key, []);
        }

        const history = this.priceHistory.get(key);
        history.push({
            timestamp: Date.now(),
            price: currentPrice
        });

        // Keep only last 100 points
        if (history.length > 100) {
            history.shift();
        }

        // Analyze trend
        if (history.length >= 3) {
            const recent = history.slice(-3);
            const trend = recent[2].price - recent[0].price;
            const trendPercent = recent[0].price > 0 ? (trend / recent[0].price) * 100 : 0;

            return {
                trend: trend > 0 ? 'up' : trend < 0 ? 'down' : 'stable',
                trendPercent: Math.abs(trendPercent),
                priceChange: trend,
                currentPrice: recent[2].price
            };
        }

        return null;
    }

    async analyzeMarketPosition(itemTitle, ourPrice, gameId = 'a8db') {
        try {
            const marketItems = await this.apiService.getMarketItems({
                gameId,
                title: itemTitle,
                limit: 50
            });

            if (!marketItems?.objects || marketItems.objects.length === 0) {
                return null;
            }

            const prices = marketItems.objects
                .map(item => {
                    const price = item.price?.USD || item.price?.amount || item.price;
                    return typeof price === 'string' ? parseFloat(price) : price;
                })
                .filter(price => price > 0 && !isNaN(price))
                .sort((a, b) => a - b);

            if (prices.length === 0) return null;

            const lowestPrice = prices[0];
            const highestPrice = prices[prices.length - 1];
            const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
            
            // Convert our price to cents for comparison
            const ourPriceCents = typeof ourPrice === 'string' 
                ? parseFloat(ourPrice) * 100 
                : ourPrice * 100;

            // Find our position (0 = best, 100 = worst)
            const betterPrices = prices.filter(p => p < ourPriceCents).length;
            const position = prices.length > 0 ? (betterPrices / prices.length) * 100 : 50;

            return {
                itemTitle,
                ourPrice: ourPriceCents / 100,
                lowestPrice: lowestPrice / 100,
                highestPrice: highestPrice / 100,
                avgPrice: avgPrice / 100,
                position: Math.round(position),
                totalOffers: prices.length,
                isCompetitive: position <= 10 // Top 10%
            };
        } catch (err) {
            console.error('Market position analysis error:', err);
            return null;
        }
    }
}


