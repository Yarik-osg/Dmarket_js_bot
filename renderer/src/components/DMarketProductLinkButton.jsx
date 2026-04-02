import React from 'react';
import { RiExternalLinkLine } from 'react-icons/ri';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { getDMarketProductCardUrl, openUrlInBrowser } from '../utils/dmarketUrls.js';
import '../styles/DMarketProductLinkButton.css';

export function DMarketProductLinkButton({ item, className = '' }) {
    const { t } = useLocale();
    const url = getDMarketProductCardUrl(item);
    if (!url) return null;

    return (
        <button
            type="button"
            className={`dmarket-product-link-btn ${className}`.trim()}
            title={t('item.dmarketOpen')}
            aria-label={t('item.dmarketOpen')}
            onClick={(e) => {
                e.stopPropagation();
                openUrlInBrowser(url);
            }}
        >
            <RiExternalLinkLine className="dmarket-product-link-btn-icon" />
        </button>
    );
}
