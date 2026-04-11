import React, { useMemo } from 'react';
import { RiInformationLine } from 'react-icons/ri';

const SORT_OPTIONS = [
    { value: 'opportunity', label: '🔥 Можливістю' },
    { value: 'profit', label: '💵 Маржею' },
    { value: 'liquidity', label: '📊 Ліквідністю' },
    { value: 'risk', label: '⚠️ Ризиком (нижчий = краще)' },
    { value: 'spread', label: '📏 Спредом (офер − таргет)' },
];

const TOOLTIPS = {
    liquidity: {
        title: '📊 Формула розрахунку ліквідності:',
        formulas: [
            'Базова оцінка = (Продажі за 7 дн. × 15) + (Загальні продажі × 2) + (Наявність × 5)',
            '+ Бонус за частоту (до +50)',
            '- Штраф за застарілість (якщо > 7 днів)',
        ],
        desc: '🔥 Найвища вага: продажі за тиждень (×15). 📈 Середня вага: загальна історія (×2). ⚡ Бонуси за частоту, ⏱️ Штрафи за давність.',
    },
    opportunity: {
        title: '🎯 Формула оцінки можливості:',
        formulas: [
            'База ≈ Ліквідність (до 38) + Спред % (до 33) + ROI (до 14) + Низький ризик (до 15)',
            'Спред %: мін. офер − макс. таргет (якщо офер ≥ таргету); інакше слабкий сигнал з медіан історії',
        ],
        desc: 'Ліквідність і спред мають найбільшу вагу. Додаткові корекції: волатильність, тренд, стрибок ціни (штрафи); стабілізація після стрибка, зростання, свіжий продаж (невеликі бонуси).',
    },
    profit: {
        title: '💵 Маржа:',
        formulas: [
            'Чиста ціна продажу = медіана продажів × (1 − комісія %)',
            'Маржа = чиста ціна − мін. ціна лоту (як у картці)',
        ],
        desc: 'Сортування за абсолютною маржею в USD, без урахування відсотка ROI.',
    },
    spread: {
        title: '📏 Спред (офер − таргет):',
        formulas: [
            'Різниця між мінімальною ціною продажу (офер) і максимальною заявкою на купівлю (таргет) у знімку ринку',
            'Якщо офер < таргету, спред не показується — знімки з різних сегментів (наприклад знос)',
        ],
        desc: 'Більший спред зазвичай означає більший потенційний зазор між ціною купівлі та продажу при порівнянних умовах.',
    },
    risk: {
        title: '⚠️ Формула оцінки ризику:',
        formulas: [
            '• Волатильність (до 50 балів)',
            '• Низька ліквідність (до 25 балів)',
            '• Конкуренція (до 15 балів)',
            '• Застарілість (до 10 балів)',
        ],
        desc: '🚨 Стрибок ціни → до +15. 🔴 Волатильність >100% → 50 (макс). ✅ Стабілізація після стрибка → -10.',
    },
};

export default function LiquidityResultsHeader({ sortBy, setSortBy, sortedData, activeTooltip, setActiveTooltip }) {
    const summary = useMemo(() => {
        if (sortedData.length === 0) return null;
        const avgROI = sortedData.reduce((s, i) => s + i.roiPercent, 0) / sortedData.length;
        const avgRisk = sortedData.reduce((s, i) => s + i.riskScore, 0) / sortedData.length;
        const hotDeals = sortedData.filter(i => i.opportunityScore >= 70 && i.roiPercent >= 15 && i.riskScore <= 30).length;
        const excellent = sortedData.filter(i => i.opportunityScore >= 70).length;
        const good = sortedData.filter(i => i.opportunityScore >= 50 && i.opportunityScore < 70).length;
        return { avgROI, avgRisk, hotDeals, excellent, good, total: sortedData.length };
    }, [sortedData]);

    const tooltipData = TOOLTIPS[sortBy];

    return (
        <div className="results-header-wrapper">
            <div className="results-header">
                <h3 className="results-title">Топ-{sortedData.length} найліквідніших предметів</h3>
                <div className="sort-controls">
                    <label>Сортувати за:</label>
                    <select value={sortBy} onChange={e => { setSortBy(e.target.value); setActiveTooltip(null); }} className="sort-select">
                        {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    {tooltipData && (
                        <div className="liquidity-info-icon" onClick={() => setActiveTooltip(activeTooltip === sortBy ? null : sortBy)}>
                            <RiInformationLine />
                            {activeTooltip === sortBy && (
                                <>
                                    <div className="tooltip-backdrop" onClick={e => { e.stopPropagation(); setActiveTooltip(null); }} />
                                    <div className="liquidity-tooltip" onClick={e => e.stopPropagation()}>
                                        <div className="tooltip-title">{tooltipData.title}</div>
                                        {tooltipData.formulas.map((f, i) => <div key={i} className="tooltip-formula">{f}</div>)}
                                        <div className="tooltip-description"><p>{tooltipData.desc}</p></div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {summary && (
                <div className="results-summary" style={{
                    display: 'flex', gap: 16, flexWrap: 'wrap', padding: '12px 16px',
                    background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)',
                    marginBottom: 20, fontSize: 13, fontWeight: 600,
                }}>
                    <span>Всього: <b>{summary.total}</b></span>
                    <span>Середній ROI: <b style={{ color: summary.avgROI >= 0 ? 'var(--success-color)' : 'var(--error-color)' }}>{summary.avgROI.toFixed(1)}%</b></span>
                    <span>Середній Risk: <b style={{ color: summary.avgRisk <= 30 ? 'var(--success-color)' : summary.avgRisk <= 60 ? 'var(--warning-color)' : 'var(--error-color)' }}>{summary.avgRisk.toFixed(0)}</b></span>
                    {summary.hotDeals > 0 && <span style={{ color: '#ff6b35' }}>🔥 Hot Deals: <b>{summary.hotDeals}</b></span>}
                    <span style={{ color: '#22c55e' }}>Відмінні: <b>{summary.excellent}</b></span>
                    <span style={{ color: '#3b82f6' }}>Добрі: <b>{summary.good}</b></span>
                </div>
            )}
        </div>
    );
}
