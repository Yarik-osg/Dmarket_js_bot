import { ApiService } from './apiService.js';

export class TransactionMonitor {
    constructor(apiService, analyticsContext, notificationContext) {
        this.apiService = apiService;
        this.analyticsContext = analyticsContext;
        this.notificationContext = notificationContext;
        this.lastCheckedTransactionId = null;
        this.lastCheckedTimestamp = null;
        this.isMonitoring = false;
        this.checkInterval = null;
        this.processedTransactionIds = new Set(); // Track processed transactions to avoid duplicates
    }

    startMonitoring(intervalMs = 600000) { // Check every 10 minutes by default
        if (this.isMonitoring) {
            console.log('TransactionMonitor already monitoring');
            return;
        }

        this.isMonitoring = true;
        
        // Load last checked transaction ID and timestamp from localStorage
        const savedId = localStorage.getItem('lastTransactionId');
        const savedTimestamp = localStorage.getItem('lastTransactionTimestamp');
        if (savedId) {
            this.lastCheckedTransactionId = savedId;
            console.log('Loaded last transaction ID from localStorage:', savedId);
        }
        if (savedTimestamp) {
            this.lastCheckedTimestamp = parseInt(savedTimestamp, 10);
            console.log('Loaded last transaction timestamp from localStorage:', this.lastCheckedTimestamp);
        }
        
        // Load processed IDs to avoid duplicates
        const savedProcessed = localStorage.getItem('processedTransactionIds');
        if (savedProcessed) {
            try {
                this.processedTransactionIds = new Set(JSON.parse(savedProcessed));
                console.log('Loaded processed transaction IDs:', this.processedTransactionIds.size);
            } catch (e) {
                console.error('Error loading processed IDs:', e);
                this.processedTransactionIds = new Set();
            }
        }
        
        if (!savedId && !savedTimestamp) {
            console.log('No saved transaction data found, will save on first check');
        }

        // Check immediately
        console.log('Starting immediate transaction check');
        this.checkTransactions();

        // Then check periodically
        this.checkInterval = setInterval(() => {
            console.log('Periodic transaction check');
            this.checkTransactions();
        }, intervalMs);
    }

    stopMonitoring() {
        this.isMonitoring = false;
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    // Test method to simulate a transaction
    async testTransaction(type = 'sell', itemTitle = 'Test Item', amount = 0.50) {
        const testTransaction = {
            id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: type, // 'sell' or 'buy'
            subject: itemTitle,
            status: 'success',
            createdAt: Math.floor(Date.now() / 1000), // Current timestamp in seconds
            changes: [{
                money: {
                    amount: amount.toString(),
                    currency: 'USD'
                },
                changeType: type === 'sell' ? 'Credit' : 'Debit'
            }]
        };

        console.log('Testing transaction:', testTransaction);
        await this.processTransaction(testTransaction);
        
        // Mark as processed to avoid duplicates
        if (testTransaction.id) {
            this.processedTransactionIds.add(testTransaction.id);
            localStorage.setItem('processedTransactionIds', JSON.stringify(Array.from(this.processedTransactionIds)));
        }
    }

    // Test method to simulate a target closed transaction
    async testTargetClosed(itemTitle = 'Test Target Item', amount = 10.00) {
        const testTransaction = {
            id: `test-target-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'target_closed', // DMarket uses 'target_closed' (with underscore) for successful targets
            subject: itemTitle,
            status: 'success',
            createdAt: Math.floor(Date.now() / 1000), // Current timestamp in seconds
            changes: [{
                money: {
                    amount: amount.toString(),
                    currency: 'USD'
                },
                changeType: 'Debit' // Target closed means money was spent
            }]
        };

        console.log('Testing target closed transaction:', testTransaction);
        await this.processTransaction(testTransaction);
        
        // Mark as processed to avoid duplicates
        if (testTransaction.id) {
            this.processedTransactionIds.add(testTransaction.id);
            localStorage.setItem('processedTransactionIds', JSON.stringify(Array.from(this.processedTransactionIds)));
        }
    }

    async checkTransactions() {
        if (!this.apiService) {
            return;
        }

        try {
            const response = await this.apiService.getTransactionHistory({
                limit: 30,
                sortBy: 'createdAt'
            });

            // Handle different possible response structures
            // DMarket API returns: { objects: [...], cursor: "...", total: {...} }
            const transactions = response?.objects || response?.transactions || response?.result || [];
            
            if (transactions.length === 0) {
                console.log('No transactions found');
                return;
            }

            console.log(`Found ${transactions.length} transactions, lastCheckedId:`, this.lastCheckedTransactionId);

            // Sort by date (newest first) - DMarket API already sorts by createdAt, but ensure it
            transactions.sort((a, b) => {
                // Handle Unix timestamp (seconds) or ISO string
                const getTimestamp = (tx) => {
                    if (tx.createdAt) {
                        return typeof tx.createdAt === 'number' 
                            ? (tx.createdAt < 10000000000 ? tx.createdAt * 1000 : tx.createdAt)
                            : new Date(tx.createdAt).getTime();
                    }
                    return new Date(tx.date || tx.trxDate || tx.timestamp || 0).getTime();
                };
                return getTimestamp(b) - getTimestamp(a);
            });

            // Find new transactions using timestamp comparison
            const newTransactions = [];
            
            // Get current timestamp for comparison
            const getTransactionTimestamp = (tx) => {
                if (tx.createdAt) {
                    return typeof tx.createdAt === 'number' 
                        ? (tx.createdAt < 10000000000 ? tx.createdAt * 1000 : tx.createdAt)
                        : new Date(tx.createdAt).getTime();
                }
                return new Date(tx.date || tx.trxDate || tx.timestamp || 0).getTime();
            };
            
            // If this is the first check, save the latest transaction and skip processing
            if (this.lastCheckedTimestamp === null && this.lastCheckedTransactionId === null) {
                if (transactions.length > 0) {
                    const latest = transactions[0];
                    const latestId = latest.id || latest.transactionId || latest.trxId;
                    const latestTimestamp = getTransactionTimestamp(latest);
                    
                    if (latestId && latestTimestamp) {
                        this.lastCheckedTransactionId = latestId;
                        this.lastCheckedTimestamp = latestTimestamp;
                        localStorage.setItem('lastTransactionId', latestId);
                        localStorage.setItem('lastTransactionTimestamp', latestTimestamp.toString());
                        console.log('First check: saved last transaction:', { id: latestId, timestamp: latestTimestamp }, '- skipping notifications for existing transactions');
                    }
                }
                return; // Don't process any transactions on first check
            }

            // Find transactions that are newer than the last checked
            // Primary check: by ID (most reliable)
            // Secondary check: by timestamp (for cases where ID might be missing)
            for (const transaction of transactions) {
                const transactionId = transaction.id || transaction.transactionId || transaction.trxId;
                const transactionTimestamp = getTransactionTimestamp(transaction);
                const transactionType = transaction.type || 'unknown';
                
                console.log('Checking transaction:', {
                    id: transactionId,
                    type: transactionType,
                    subject: transaction.subject,
                    timestamp: transactionTimestamp,
                    lastCheckedId: this.lastCheckedTransactionId,
                    lastCheckedTimestamp: this.lastCheckedTimestamp,
                    isProcessed: transactionId && this.processedTransactionIds.has(transactionId),
                    isLastChecked: transactionId === this.lastCheckedTransactionId,
                    isNewer: this.lastCheckedTimestamp === null || transactionTimestamp > this.lastCheckedTimestamp
                });
                
                // Skip if no ID
                if (!transactionId) {
                    console.log('  -> Skipping: no ID');
                    continue;
                }
                
                // Skip if already processed (primary check)
                if (this.processedTransactionIds.has(transactionId)) {
                    console.log('  -> Skipping: already processed');
                    continue;
                }
                
                // Skip if this is the last checked transaction
                if (transactionId === this.lastCheckedTransactionId) {
                    console.log('  -> Skipping: same as last checked ID');
                    continue;
                }
                
                // If we have a last checked timestamp, verify this transaction is newer or equal
                // Use >= instead of > to catch transactions with the same timestamp
                // But skip if it's significantly older (more than 5 minutes)
                if (this.lastCheckedTimestamp !== null) {
                    const timeDiff = this.lastCheckedTimestamp - transactionTimestamp;
                    
                    // If transaction is significantly older (more than 5 minutes), skip it
                    if (timeDiff > 300000) { // More than 5 minutes difference
                        console.log('  -> Skipping: too old (diff:', timeDiff, 'ms,', Math.round(timeDiff/1000), 'seconds)');
                        continue;
                    }
                    
                    // If transaction is newer or equal (within 5 minutes), process it
                    // This handles cases where transactions have the same timestamp
                    if (transactionTimestamp < this.lastCheckedTimestamp && timeDiff <= 300000) {
                        console.log('  -> Processing: timestamp within acceptable range (diff:', timeDiff, 'ms)');
                    } else if (transactionTimestamp >= this.lastCheckedTimestamp) {
                        console.log('  -> Processing: timestamp is newer or equal');
                    }
                }
                 
                // This is a new transaction
                console.log('  -> Adding as new transaction');
                newTransactions.push(transaction);
            }

            console.log(`Found ${newTransactions.length} new transactions (lastCheckedTimestamp: ${this.lastCheckedTimestamp}, lastCheckedId: ${this.lastCheckedTransactionId}, processedCount: ${this.processedTransactionIds.size})`);

            // Process only new transactions (in reverse order to process oldest first)
            if (newTransactions.length > 0) {
                newTransactions.reverse();
                for (const transaction of newTransactions) {
                    const transactionId = transaction.id || transaction.transactionId || transaction.trxId;
                    console.log('=== About to call processTransaction ===', {
                        transactionId: transactionId,
                        subject: transaction.subject,
                        type: transaction.type,
                        hasDetails: !!transaction.details,
                        detailsItemId: transaction.details?.itemId
                    });
                    
                    // Mark as processed before processing to avoid duplicates
                    if (transactionId) {
                        this.processedTransactionIds.add(transactionId);
                    }
                    
                    await this.processTransaction(transaction);
                }
                
                // Save processed IDs (keep only last 100 to avoid memory issues)
                if (this.processedTransactionIds.size > 100) {
                    const idsArray = Array.from(this.processedTransactionIds);
                    this.processedTransactionIds = new Set(idsArray.slice(-100));
                }
                localStorage.setItem('processedTransactionIds', JSON.stringify(Array.from(this.processedTransactionIds)));
            } else {
                console.log('No new transactions to process');
            }

            // Update last checked transaction ID and timestamp to the latest one
            // Always update to the latest transaction, even if no new transactions were found
            // This ensures we don't miss transactions that appear between checks
            if (transactions.length > 0) {
                const latest = transactions[0];
                const latestId = latest.id || latest.transactionId || latest.trxId;
                const latestTimestamp = getTransactionTimestamp(latest);
                
                if (latestId && latestTimestamp) {
                    // Always update to the latest transaction to track our position
                    // This prevents missing transactions that appear between checks
                    if (this.lastCheckedTimestamp === null || latestTimestamp >= this.lastCheckedTimestamp) {
                        const wasUpdated = this.lastCheckedTransactionId !== latestId || this.lastCheckedTimestamp !== latestTimestamp;
                        console.log('Updating last checked:', { 
                            oldId: this.lastCheckedTransactionId, 
                            newId: latestId,
                            oldTimestamp: this.lastCheckedTimestamp,
                            newTimestamp: latestTimestamp,
                            wasUpdated: wasUpdated
                        });
                        this.lastCheckedTransactionId = latestId;
                        this.lastCheckedTimestamp = latestTimestamp;
                        localStorage.setItem('lastTransactionId', latestId);
                        localStorage.setItem('lastTransactionTimestamp', latestTimestamp.toString());
                    } else {
                        console.log('Not updating - latest transaction is older than last checked:', {
                            latestTimestamp,
                            lastCheckedTimestamp: this.lastCheckedTimestamp,
                            diff: this.lastCheckedTimestamp - latestTimestamp
                        });
                    }
                }
            }

        } catch (err) {
            console.error('Error checking transactions:', err);
        }
    }

    async processTransaction(transaction) {
        console.log('=== processTransaction CALLED ===', {
            transactionId: transaction.id,
            transactionType: transaction.type,
            hasDetails: !!transaction.details,
            detailsKeys: transaction.details ? Object.keys(transaction.details) : []
        });
        
        // DMarket API structure: { type: 'sell'/'purchase'/'target_closed', status: 'success', subject: "...", changes: [{ money: { amount: "...", currency: "USD" } }] }
        const transactionType = transaction.type || transaction.activity || transaction.operation || transaction.action || '';
        const typeLower = transactionType.toLowerCase();
        
        // DMarket uses: 'sell', 'purchase', 'target_closed'
        // target_closed і purchase - обидва покупки (витрата грошей), тому обробляємо їх однаково
        const isSale = typeLower === 'sell' || typeLower === 'sale';
        const isPurchase = typeLower === 'purchase' || typeLower === 'buy' || 
                          typeLower === 'target_closed' || 
                          (typeLower.includes('target') && typeLower.includes('closed'));

        console.log('processTransaction - type check:', {
            id: transaction.id,
            type: transactionType,
            typeLower: typeLower,
            isSale,
            isPurchase,
            status: transaction.status
        });

        // Process sales and purchases (target_closed вважається purchase)
        if (!isSale && !isPurchase) {
            console.log('  -> Skipping: not a sale or purchase');
            return;
        }

        // Extract transaction data from DMarket API structure
        // DMarket returns: { subject: "...", changes: [{ money: { amount: "0.03", currency: "USD" } }], status: "success", createdAt: 1766880875, details: { itemId: "..." } }
        const itemTitle = transaction.subject || transaction.title || transaction.itemTitle || transaction.item || transaction.itemName || 'Unknown Item';
        
        // Extract asset id (itemId) - це унікальний ідентифікатор конкретного екземпляра предмета
        // DMarket API має itemId в details.itemId
        const assetId = transaction.details?.itemId || 
                       transaction.details?.extra?.itemId ||
                       transaction.itemId || 
                       transaction.assetId || 
                       transaction.asset_id ||
                       null; // Не використовуємо transaction.id як fallback, бо це не itemId
        
        // Get amount from changes array (first change with money)
        let amount = 0;
        if (transaction.changes && Array.isArray(transaction.changes) && transaction.changes.length > 0) {
            const moneyChange = transaction.changes.find(change => change.money);
            if (moneyChange && moneyChange.money) {
                // Amount is already in dollars (e.g., "0.03" = $0.03)
                amount = parseFloat(moneyChange.money.amount || 0);
                // Для покупок amount завжди позитивний (це витрата, але зберігаємо як позитивне число)
                // changeType може бути "Debit" (витрата) або "Credit" (дохід)
                console.log('  -> Money change:', {
                    amount: amount,
                    changeType: moneyChange.changeType,
                    currency: moneyChange.money.currency
                });
            }
        }
        
        // Fallback to other possible locations
        if (amount === 0) {
            amount = this.parseAmount(transaction.price?.USD || transaction.price?.amount || transaction.money || transaction.amount || transaction.price);
        }
        
        const status = transaction.status || 'unknown';

        console.log('  -> Status check:', status);
        console.log('  -> Asset ID (itemId from details.itemId):', assetId);
        console.log('  -> Item Title:', itemTitle);
        console.log('  -> Transaction details structure:', {
            hasDetails: !!transaction.details,
            detailsKeys: transaction.details ? Object.keys(transaction.details) : [],
            detailsItemId: transaction.details?.itemId,
            detailsExtraItemId: transaction.details?.extra?.itemId,
            directItemId: transaction.itemId,
            transactionId: transaction.id
        });
        
        // Перевірка: чи правильно витягується itemId
        if (!assetId && transaction.details) {
            console.error('  -> ERROR: details exists but itemId not found!', {
                details: transaction.details,
                detailsKeys: Object.keys(transaction.details)
            });
        }

        // Only process successful transactions
        // if (status.toLowerCase() !== 'success' && status.toLowerCase() !== 'completed' && status.toLowerCase() !== 'successful') {
        //     console.log('  -> Skipping: status is not success');
        //     return;
        // }

        // Convert createdAt from Unix timestamp (seconds) to ISO string
        let createdAt = new Date().toISOString();
        if (transaction.createdAt) {
            // If it's a Unix timestamp in seconds, convert to milliseconds
            const timestamp = typeof transaction.createdAt === 'number' 
                ? (transaction.createdAt < 10000000000 ? transaction.createdAt * 1000 : transaction.createdAt)
                : new Date(transaction.createdAt).getTime();
            createdAt = new Date(timestamp).toISOString();
        } else if (transaction.date || transaction.trxDate) {
            createdAt = new Date(transaction.date || transaction.trxDate).toISOString();
        }

        // Add to analytics
        // Додаємо транзакцію навіть якщо немає assetId (для старих транзакцій буде використано fallback)
        if (this.analyticsContext) {
            if (!assetId) {
                console.warn('  -> WARNING: Transaction without itemId (will use fallback):', {
                    type: transactionType,
                    subject: itemTitle,
                    id: transaction.id,
                    hasDetails: !!transaction.details,
                    detailsKeys: transaction.details ? Object.keys(transaction.details) : []
                });
            }
            
            this.analyticsContext.addTransaction({
                type: isSale ? 'sale' : 'purchase',
                itemTitle: itemTitle,
                assetId: assetId, // Додаємо asset id (itemId з details.itemId) для зіставлення
                amount: amount,
                createdAt: createdAt,
                soldAt: isSale ? createdAt : null
            });
        }

        // Send notification
        const showNotification = this.notificationContext?.showNotification || this.notificationContext;
        if (showNotification && typeof showNotification === 'function') {
            // Для target_closed показуємо спеціальне повідомлення, але тип залишається 'purchases'
            const isTargetClosed = typeLower === 'target_closed' || (typeLower.includes('target') && typeLower.includes('closed'));
            const notificationType = isSale ? 'sales' : 'purchases';
            const title = isTargetClosed ? 'Таргет закрито' : (isSale ? 'Продаж' : 'Покупка');
            
            console.log('Sending notification:', title, itemTitle, `$${amount.toFixed(2)}`);
            
            showNotification({
                type: notificationType,
                title: title,
                message: `${itemTitle} - $${amount.toFixed(2)}`,
                level: 'success',
                sendExternal: true
            });
        } else {
            console.warn('showNotification not available in processTransaction', {
                hasNotificationContext: !!this.notificationContext,
                type: typeof showNotification
            });
        }
    }

    parseAmount(amount) {
        if (typeof amount === 'number') {
            return amount;
        }
        if (typeof amount === 'string') {
            // Remove currency symbols and parse
            const cleaned = amount.replace(/[^0-9.-]/g, '');
            const parsed = parseFloat(cleaned);
            // If amount looks like cents (>= 10), convert to dollars
            return parsed >= 10 ? parsed / 100 : parsed;
        }
        return 0;
    }
}

