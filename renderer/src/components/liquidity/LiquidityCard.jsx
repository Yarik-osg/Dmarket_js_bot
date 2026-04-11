import React, { useState } from 'react';
import { DMarketProductLinkButton } from '../DMarketProductLinkButton.jsx';

function formatDays(days) {
    if (days < 1) return 'Сьогодні';
    if (days < 2) return 'Вчора';
    return `${Math.floor(days)} дн. тому`;
}

function formatTimeToSell(days) {
    if (days === null || days === undefined) return null;
    if (days < 1) return '< 1 дня';
    if (days < 7) return `~${Math.round(days)} дн.`;
    if (days < 30) return `~${(days / 7).toFixed(1)} тижн.`;
    return `~${(days / 30).toFixed(1)} міс.`;
}

export default function LiquidityCard({ item, index }) {
    const [expanded, setExpanded] = useState(false);

    const opportunityClass = item.opportunityScore >= 70 ? 'excellent'
        : item.opportunityScore >= 50 ? 'good'
        : item.opportunityScore >= 30 ? 'medium' : 'low';

    const riskClass = item.riskScore <= 20 ? 'low-risk'
        : item.riskScore <= 50 ? 'medium-risk' : 'high-risk';

    const roiClass = item.roiPercent >= 20 ? 'excellent'
        : item.roiPercent >= 10 ? 'good'
        : item.roiPercent >= 5 ? 'medium' : 'low';

    const isHotDeal = item.opportunityScore >= 70 && item.roiPercent >= 15 && item.riskScore <= 30;

    const timeToSellStr = formatTimeToSell(item.timeToSell);

    return (
        <div className={`liquidity-card ${isHotDeal ? 'hot-deal' : ''}`}>
            {isHotDeal && <div className="hot-deal-badge">🔥 Гаряча пропозиція!</div>}

            {(item.volatilityWarning || item.trendWarning || item.hasSpike) && (
                <div className="warning-badge">
                    {item.volatilityWarning && <span>⚠️ Висока волатильність ({item.priceVolatility.toFixed(0)}%)</span>}
                    {item.trendWarning && (
                        <span>
                            📉 Падіння цін
                            {item.recentTrend < -5 && item.priceTrend >= 0 && ' (за тиждень)'}
                            {item.priceTrend < -5 && item.recentTrend >= 0 && ' (за місяць)'}
                            {item.priceTrend < -5 && item.recentTrend < -5 && ' (місяць + тиждень)'}
                        </span>
                    )}
                    {item.hasSpike && <span>🚨 Стрибок ціни ({item.spikePercent.toFixed(0)}%)</span>}
                </div>
            )}

            <div className="card-header">
                <div className="card-rank">#{index + 1}</div>
                <div className={`card-opportunity ${opportunityClass}`}>Можливість: {item.opportunityScore}</div>
            </div>

            <div className="card-title-row">
                <div className="card-title">{item.title}</div>
                {item.dmarketItem && <DMarketProductLinkButton item={item.dmarketItem} className="liquidity-card-dmarket-btn" />}
            </div>

            {/* Compact — always visible */}
            <div className="profitability-section">
                <div className="section-title">💰 Прибутковість</div>
                <div className="stat-row highlight">
                    <span className="stat-label">ROI:</span>
                    <span className={`stat-value ${roiClass}`}>{item.roiPercent > 0 ? '+' : ''}{item.roiPercent.toFixed(1)}%</span>
                </div>
                <div className="stat-row highlight">
                    <span className="stat-label">Маржа:</span>
                    <span className={`stat-value ${item.profitMargin > 0 ? 'positive' : 'negative'}`}>
                        {item.profitMargin > 0 ? '+' : ''}${item.profitMargin.toFixed(2)}
                    </span>
                </div>
                <div className="stat-row">
                    <span className="stat-label">Купити від:</span>
                    <span className="stat-value price">${item.minPrice.toFixed(2)}</span>
                </div>
                <div className="stat-row">
                    <span className="stat-label">Медіана продажу:</span>
                    <span className="stat-value price" title={`Середнє: $${item.arithmeticAvgPrice?.toFixed(2)}`}>
                        ${item.medianSalePrice > 0 ? item.medianSalePrice.toFixed(2) : 'N/A'}
                    </span>
                </div>
                {item.breakEvenPrice > 0 && (
                    <div className="stat-row">
                        <span className="stat-label">Беззбитковість:</span>
                        <span className="stat-value price" title="Мінімальна ціна продажу для ROI = 0 (з урахуванням комісії)">
                            ${item.breakEvenPrice.toFixed(2)}
                        </span>
                    </div>
                )}
            </div>

            <div className="liquidity-section">
                <div className="section-title">📊 Ліквідність</div>
                <div className="stat-row">
                    <span className="stat-label">Оцінка:</span>
                    <span className="stat-value">{item.liquidityScore}</span>
                </div>
                <div className="stat-row">
                    <span className="stat-label">Продажів (7 дн.):</span>
                    <span className="stat-value">{item.recentSalesCount}</span>
                </div>
                {item.daysSinceLastSale < 999 && (
                    <div className="stat-row">
                        <span className="stat-label">Останній продаж:</span>
                        <span className={`stat-value ${item.daysSinceLastSale <= 1 ? 'positive' : item.daysSinceLastSale > 7 ? 'negative' : 'info'}`}>
                            {formatDays(item.daysSinceLastSale)}
                        </span>
                    </div>
                )}
                {timeToSellStr && (
                    <div className="stat-row">
                        <span className="stat-label">Час до продажу:</span>
                        <span className="stat-value info" title="Оцінка на основі кількості лістингів та частоти продажів">
                            {timeToSellStr}
                        </span>
                    </div>
                )}
            </div>

            <button
                className="card-expand-btn"
                onClick={() => setExpanded(e => !e)}
                style={{
                    background: 'none', border: '1px solid var(--border-color)', borderRadius: 6,
                    color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px 12px',
                    fontSize: 12, fontWeight: 600, width: '100%', marginTop: 8,
                    transition: 'all 0.2s',
                }}
            >
                {expanded ? 'Згорнути' : 'Детальніше'}
            </button>

            {expanded && (
                <>
                    {/* Price range */}
                    {item.priceP25 > 0 && item.priceP75 > 0 && (
                        <div className="profitability-section" style={{ marginTop: 12 }}>
                            <div className="section-title">💲 Діапазон цін</div>
                            <div className="stat-row">
                                <span className="stat-label">P25 – P75:</span>
                                <span className="stat-value price">${item.priceP25.toFixed(2)} – ${item.priceP75.toFixed(2)}</span>
                            </div>
                            {item.minSalePrice > 0 && item.maxSalePrice > 0 && (
                                <div className="stat-row">
                                    <span className="stat-label">Мін – Макс:</span>
                                    <span className="stat-value price">${item.minSalePrice.toFixed(2)} – ${item.maxSalePrice.toFixed(2)}</span>
                                </div>
                            )}
                            {item.outliersCount > 0 && (
                                <div className="stat-row">
                                    <span className="stat-label">Викиди:</span>
                                    <span className="stat-value info">{item.outliersCount} з {item.cleanPricesCount + item.outliersCount}</span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="risk-section">
                        <div className="section-title">⚠️ Ризик</div>
                        <div className="stat-row">
                            <span className="stat-label">Оцінка ризику:</span>
                            <span className={`stat-value ${riskClass}`}>{item.riskScore.toFixed(0)}</span>
                        </div>
                        <div className="stat-row">
                            <span className="stat-label">Волатильність:</span>
                            <span className={`stat-value ${item.priceVolatility > 50 ? 'negative' : 'info'}`}>
                                {item.priceVolatility.toFixed(1)}%{item.priceVolatility > 50 && ' ⚠️'}
                            </span>
                        </div>
                        <div className="stat-row">
                            <span className="stat-label">Конкуренція:</span>
                            <span className="stat-value info">{item.competitionLevel} ({item.marketCount} шт.)</span>
                        </div>
                        {item.priceTrend !== 0 && (
                            <>
                                <div className="stat-row">
                                    <span className="stat-label">Тренд (місяць):</span>
                                    <span className={`stat-value ${item.priceTrend > 5 ? 'trending-up' : item.priceTrend < -5 ? 'trending-down' : 'trending-stable'}`}>
                                        {item.priceTrend > 0 ? '↑' : item.priceTrend < 0 ? '↓' : '→'} {item.priceTrend > 0 ? '+' : ''}{item.priceTrend.toFixed(1)}%
                                    </span>
                                </div>
                                {item.recentTrend !== 0 && item.recentSalesCount >= 3 && (
                                    <div className="stat-row">
                                        <span className="stat-label">Тренд (тиждень):</span>
                                        <span className={`stat-value ${item.recentTrend > 5 ? 'trending-up' : item.recentTrend < -5 ? 'trending-down' : 'trending-stable'}`}>
                                            {item.recentTrend > 0 ? '↑' : item.recentTrend < 0 ? '↓' : '→'} {item.recentTrend > 0 ? '+' : ''}{item.recentTrend.toFixed(1)}%
                                            {item.recentTrend < -5 && ' ⚠️'}
                                        </span>
                                    </div>
                                )}
                            </>
                        )}
                        {item.isStabilizing && (
                            <div className="stat-row">
                                <span className="stat-label">Стабільність:</span>
                                <span className="stat-value info">⚖️ {item.stabilityScore.toFixed(0)}/100</span>
                            </div>
                        )}
                    </div>

                    <div className="liquidity-section">
                        <div className="section-title">📊 Ліквідність (деталі)</div>
                        <div className="stat-row">
                            <span className="stat-label">Продажів (всього):</span>
                            <span className="stat-value">{item.salesCount}</span>
                        </div>
                        {item.salesFrequency > 0 && (
                            <div className="stat-row">
                                <span className="stat-label">Частота:</span>
                                <span className="stat-value">
                                    {item.salesFrequency >= 1
                                        ? `${item.salesFrequency.toFixed(1)}/день`
                                        : `${(item.salesFrequency * 7).toFixed(1)}/тиждень`}
                                </span>
                            </div>
                        )}
                    </div>

                    {(item.currentMinOffer > 0 || item.currentMaxTarget > 0) && (
                        <div className="transaction-types-section">
                            <div className="section-title">🏪 Поточний ринок</div>
                            {item.currentMinOffer > 0 && (
                                <div className="stat-row">
                                    <span className="stat-label">Мін. офер (продаж):</span>
                                    <span className="stat-value price">${item.currentMinOffer.toFixed(2)}</span>
                                </div>
                            )}
                            {item.currentMaxTarget > 0 && (
                                <div className="stat-row">
                                    <span className="stat-label">Макс. таргет (купівля):</span>
                                    <span className="stat-value price">${item.currentMaxTarget.toFixed(2)}</span>
                                </div>
                            )}
                            {item.currentMinOffer > 0 && item.currentMaxTarget > 0 && (
                                <div className="stat-row highlight">
                                    <span className="stat-label">Спред (офер − таргет):</span>
                                    {item.currentSpread !== null ? (
                                        <span className={`stat-value ${item.currentSpread >= 0 ? 'positive' : 'negative'}`}>
                                            {item.currentSpread >= 0 ? '+' : ''}${item.currentSpread.toFixed(2)}
                                        </span>
                                    ) : (
                                        <span
                                            className="stat-value info"
                                            title="Мінімальна ціна продажу нижча за максимальну заявку на купівлю — ці значення з різних сегментів ринку (наприклад знос), тому числовий спред тут не показується. Звузьте фільтри (екстер’єр / флот) для порівнянного знімка."
                                        >
                                            —
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {(item.offerCount > 0 || item.targetCount > 0) && (
                        <div className="transaction-types-section">
                            <div className="section-title">💼 Історія транзакцій</div>
                            <div className="stat-row">
                                <span className="stat-label">Офер (ручні):</span>
                                <span className="stat-value info">{item.offerCount} ({item.offerRatio.toFixed(0)}%)</span>
                            </div>
                            {item.offerMedianPrice > 0 && (
                                <div className="stat-row">
                                    <span className="stat-label">└ Медіана:</span>
                                    <span className="stat-value price">${item.offerMedianPrice.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="stat-row">
                                <span className="stat-label">Таргет (авто):</span>
                                <span className="stat-value info">{item.targetCount} ({item.targetRatio.toFixed(0)}%)</span>
                            </div>
                            {item.targetMedianPrice > 0 && (
                                <div className="stat-row">
                                    <span className="stat-label">└ Медіана:</span>
                                    <span className="stat-value price">${item.targetMedianPrice.toFixed(2)}</span>
                                </div>
                            )}
                            {item.priceSpread > 0 && (
                                <div className="stat-row">
                                    <span className="stat-label">Спред (медіани):</span>
                                    <span className="stat-value info">${item.priceSpread.toFixed(2)} ({item.priceSpreadPercent.toFixed(1)}%)</span>
                                </div>
                            )}
                            <div className="stat-row">
                                <span className="stat-label">Домінанс:</span>
                                <span className={`stat-value ${
                                    item.txDominance === 'offer-heavy' ? 'info'
                                    : item.txDominance === 'target-heavy' ? 'warning' : 'neutral'
                                }`} title={
                                    item.txDominance === 'offer-heavy' ? 'Покупці готові платити повну ціну'
                                    : item.txDominance === 'target-heavy' ? 'Продавці поспішають продати' : 'Збалансований ринок'
                                }>
                                    {item.txDominance === 'offer-heavy' ? '🎯 Офер'
                                    : item.txDominance === 'target-heavy' ? '⚡ Таргет' : '⚖️ Збалансовано'}
                                </span>
                            </div>
                        </div>
                    )}
                </>
            )}

            {item.error && <div className="card-error">⚠️ Не вдалося отримати історію продажів</div>}
        </div>
    );
}
