import React from 'react';
import { RiTimerLine, RiRestartLine } from 'react-icons/ri';

export function PriceResetPanel({
    timeUntilReset,
    resetStats,
    onManualReset,
    disabled,
    bulkProgress
}) {
    return (
        <div className="price-reset-panel">
            <div className="reset-timer">
                <RiTimerLine className="reset-icon" />
                <div className="reset-timer-info">
                    <span className="reset-timer-label">Наступне скидання:</span>
                    <span className="reset-timer-value">{timeUntilReset}</span>
                </div>
            </div>

            {resetStats && (
                <div className="reset-stats">
                    <div className="reset-stats-item">
                        <span className="reset-stats-label">Останнє скидання:</span>
                        <span className="reset-stats-value">
                            {new Date(resetStats.lastResetTime).toLocaleString('uk-UA', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </span>
                    </div>
                    <div className="reset-stats-item">
                        <span className="reset-stats-label">Результат:</span>
                        <span className="reset-stats-value">
                            {resetStats.successCount}/{resetStats.totalCount} таргетів
                            {resetStats.failCount > 0 && (
                                <span className="reset-stats-errors"> ({resetStats.failCount} помилок)</span>
                            )}
                        </span>
                    </div>
                </div>
            )}

            {bulkProgress && (
                <div className="targets-bulk-progress" aria-live="polite">
                    {bulkProgress.kind === 'reset' && 'Скидання цін: '}
                    {bulkProgress.kind === 'auto' && 'Автооновлення: '}
                    {bulkProgress.current} з {bulkProgress.total}
                </div>
            )}

            <button
                type="button"
                onClick={onManualReset}
                className="btn btn-reset"
                disabled={disabled}
                title="Примусово скинути всі ціни до $0.10"
            >
                <RiRestartLine />
                Скинути зараз
            </button>
        </div>
    );
}
