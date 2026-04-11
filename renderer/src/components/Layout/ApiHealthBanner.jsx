import React from 'react';
import { Alert } from '@mantine/core';
import { useNotifications } from '../../contexts/NotificationContext.jsx';
import { useLocale } from '../../contexts/LocaleContext.jsx';
import '../../styles/ApiHealthBanner.css';

export default function ApiHealthBanner() {
    const { apiConnectionBanner, dismissApiConnectionBanner } = useNotifications();
    const { t } = useLocale();

    if (!apiConnectionBanner) {
        return null;
    }

    const isRateLimit = apiConnectionBanner.kind === 'rate_limit';
    const title = isRateLimit ? t('apiHealth.rateLimitTitle') : t('apiHealth.errorsTitle');
    const body = isRateLimit ? t('apiHealth.rateLimitBody') : t('apiHealth.errorsBody');
    const retrySec = isRateLimit ? apiConnectionBanner.retryAfterSec : null;
    const retryLine =
        retrySec != null && Number.isFinite(retrySec)
            ? t('apiHealth.rateLimitRetry').replace('{seconds}', String(retrySec))
            : null;

    return (
        <div className="main-api-health-banner" role="status">
            <Alert
                color={isRateLimit ? 'orange' : 'red'}
                variant="light"
                withCloseButton
                onClose={dismissApiConnectionBanner}
                title={title}
            >
                <div className="main-api-health-banner__body">{body}</div>
                {retryLine ? <div className="main-api-health-banner__retry">{retryLine}</div> : null}
            </Alert>
        </div>
    );
}
