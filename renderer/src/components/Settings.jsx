import React, { useState, useEffect } from 'react';
import { SegmentedControl, Text, useMantineColorScheme } from '@mantine/core';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLogs } from '../contexts/LogsContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import { showConfirmModal } from '../utils/modal.js';
import { getReleaseNotesForVersion } from '../data/releaseNotes.js';
import { GITHUB_RELEASES_INDEX } from '../constants/githubRelease.js';
import { FEEDBACK_APP_MAX_BODY_CHARS, FEEDBACK_MAX_SUBJECT_CHARS } from '../constants/feedbackContact.js';
import { submitWeb3Feedback } from '../services/web3formsFeedback.js';
import '../styles/Settings.css';

function Settings({ updater }) {
    const { login, logout, isAuthenticated } = useAuth();
    const { addLog } = useLogs();
    const { t } = useLocale();
    const { colorScheme, setColorScheme } = useMantineColorScheme();
    const [publicKey, setPublicKey] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [showKeys, setShowKeys] = useState(false);
    const [feedbackSubject, setFeedbackSubject] = useState('');
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [feedbackReplyEmail, setFeedbackReplyEmail] = useState('');
    const [feedbackWeb3Configured, setFeedbackWeb3Configured] = useState(null);
    const [feedbackSending, setFeedbackSending] = useState(false);
    const [feedbackBanner, setFeedbackBanner] = useState(null);

    const updaterReleaseNotes = updater ? getReleaseNotesForVersion(updater.appVersion) : [];

    useEffect(() => {
        const api = window.electronAPI?.feedback;
        if (!api?.isWeb3Configured) {
            setFeedbackWeb3Configured(false);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await api.isWeb3Configured();
                if (!cancelled) {
                    setFeedbackWeb3Configured(Boolean(res?.ok && res.configured));
                }
            } catch {
                if (!cancelled) {
                    setFeedbackWeb3Configured(false);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        // Load current keys from storage (masked)
        const loadCurrentKeys = async () => {
            if (window.electronAPI) {
                try {
                    const storedPublicKey = await window.electronAPI.store.get('DMARKET_PUBLIC_KEY');
                    const storedSecretKey = await window.electronAPI.store.get('DMARKET_SECRET_KEY');
                    
                    if (storedPublicKey) {
                        // Show masked version
                        const masked = maskKey(storedPublicKey);
                        setPublicKey(masked);
                    }
                    if (storedSecretKey) {
                        const masked = maskKey(storedSecretKey);
                        setSecretKey(masked);
                    }
                } catch (err) {
                    console.error('Error loading keys:', err);
                }
            }
        };
        
        loadCurrentKeys();
    }, []);

    const maskKey = (key) => {
        if (!key || key.length < 8) return '••••••••';
        return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        // If keys are masked, user needs to enter new keys
        const publicKeyValue = publicKey.includes('••••') ? '' : publicKey.trim();
        const secretKeyValue = secretKey.includes('••••') ? '' : secretKey.trim();

        if (!publicKeyValue || !secretKeyValue) {
            setError('Будь ласка, введіть обидва ключі');
            setLoading(false);
            return;
        }

        try {
            const success = await login(publicKeyValue, secretKeyValue);
            if (success) {
                setSuccess('Ключі успішно збережено!');
                addLog({
                    type: 'success',
                    category: 'system',
                    message: 'API ключі оновлено',
                    details: { publicKey: maskKey(publicKeyValue) }
                });
                // Update displayed keys to masked version
                setPublicKey(maskKey(publicKeyValue));
                setSecretKey(maskKey(secretKeyValue));
                setShowKeys(false);
            } else {
                setError('Не вдалося зберегти ключі. Перевірте правильність введених ключів.');
                addLog({
                    type: 'error',
                    category: 'system',
                    message: 'Помилка збереження API ключів',
                    details: { error: 'Invalid keys' }
                });
            }
        } catch (err) {
            setError('Помилка: ' + (err.message || 'Невідома помилка'));
            addLog({
                type: 'error',
                category: 'system',
                message: 'Помилка збереження API ключів',
                details: { error: err.message }
            });
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        showConfirmModal({
            title: 'Підтвердження виходу',
            message: 'Ви впевнені, що хочете вийти? Вам потрібно буде ввести ключі знову для використання бота.',
            onConfirm: async () => {
                await logout();
                addLog({
                    type: 'info',
                    category: 'system',
                    message: 'Користувач вийшов з системи'
                });
                // Clear form
                setPublicKey('');
                setSecretKey('');
                setError('');
                setSuccess('');
            },
            confirmText: 'Вийти',
            cancelText: 'Скасувати',
            confirmVariant: 'danger'
        });
    };

    const handleClear = () => {
        showConfirmModal({
            title: 'Підтвердження',
            message: 'Ви впевнені, що хочете очистити поля? Поточні ключі залишаться збереженими.',
            onConfirm: () => {
                setPublicKey('');
                setSecretKey('');
                setError('');
                setSuccess('');
                setShowKeys(false);
            },
            confirmText: 'Очистити',
            cancelText: 'Скасувати'
        });
    };

    const handleShowKeys = () => {
        setShowKeys(true);
        // Load actual keys when showing
        const loadActualKeys = async () => {
            if (window.electronAPI) {
                try {
                    const storedPublicKey = await window.electronAPI.store.get('DMARKET_PUBLIC_KEY');
                    const storedSecretKey = await window.electronAPI.store.get('DMARKET_SECRET_KEY');
                    
                    if (storedPublicKey) {
                        setPublicKey(storedPublicKey);
                    }
                    if (storedSecretKey) {
                        setSecretKey(storedSecretKey);
                    }
                } catch (err) {
                    console.error('Error loading keys:', err);
                }
            }
        };
        loadActualKeys();
    };

    const sendFeedbackFromApp = async () => {
        const message = feedbackMessage.trim();
        if (!message || feedbackSending) {
            return;
        }
        const reply = feedbackReplyEmail.trim();
        if (reply && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reply)) {
            setFeedbackBanner({ type: 'error', text: t('feedback.invalidReplyEmail') });
            return;
        }
        const feedbackApi = window.electronAPI?.feedback;
        if (!feedbackApi?.isWeb3Configured) {
            setFeedbackBanner({ type: 'error', text: t('feedback.sendError') });
            return;
        }
        setFeedbackSending(true);
        setFeedbackBanner(null);
        try {
            const cfg = await feedbackApi.isWeb3Configured();
            const accessKey = String(cfg?.accessKey || '').trim();
            if (!cfg?.ok || !accessKey) {
                setFeedbackBanner({ type: 'info', text: t('feedback.notConfiguredHint') });
                setFeedbackWeb3Configured(Boolean(cfg?.configured));
                return;
            }
            const result = await submitWeb3Feedback(accessKey, {
                subject: feedbackSubject.trim(),
                message,
                replyTo: reply || undefined,
                maxSubject: FEEDBACK_MAX_SUBJECT_CHARS
            });
            if (result?.ok) {
                setFeedbackBanner({ type: 'success', text: t('feedback.sentOk') });
                addLog({
                    type: 'success',
                    category: 'system',
                    message: 'Надіслано зворотний зв\'язок з додатка'
                });
            } else if (result?.code === 'not_configured') {
                setFeedbackBanner({ type: 'info', text: t('feedback.notConfiguredHint') });
            } else if (result?.code === 'invalid_reply_email') {
                setFeedbackBanner({ type: 'error', text: t('feedback.invalidReplyEmail') });
            } else {
                setFeedbackBanner({
                    type: 'error',
                    text: `${t('feedback.sendError')}${result?.message ? ` (${result.message})` : ''}`
                });
            }
        } catch (err) {
            setFeedbackBanner({
                type: 'error',
                text: `${t('feedback.sendError')} ${err?.message || ''}`.trim()
            });
        } finally {
            setFeedbackSending(false);
        }
    };

    const feedbackBodyLen = feedbackMessage.length;
    const feedbackSubjectLen = feedbackSubject.length;

    return (
        <div className="settings-container">
            <div className="settings-header">
                <h1 className="settings-title">Налаштування</h1>
            </div>

            <div className="settings-content">
                <div className="settings-section">
                    <h2 className="settings-section-title">{t('theme.title')}</h2>
                    <Text size="sm" c="dimmed" mb="sm">
                        {t('theme.appearanceHint')}
                    </Text>
                    <SegmentedControl
                        fullWidth
                        value={colorScheme}
                        onChange={setColorScheme}
                        data={[
                            { label: t('theme.light'), value: 'light' },
                            { label: t('theme.dark'), value: 'dark' },
                            { label: t('theme.system'), value: 'auto' }
                        ]}
                    />
                </div>

                <div className="settings-section">
                    <h2 className="settings-section-title">API Ключі DMarket</h2>
                    <p className="settings-description">
                        Введіть ваші публічний та приватний ключі для доступу до DMarket API.
                        Ключі будуть збережені безпечно та використовуватимуться для всіх операцій.
                    </p>

                    <form onSubmit={handleSubmit} className="settings-form">
                        <div className="settings-field">
                            <label htmlFor="publicKey">Публічний ключ (Public Key)</label>
                            <div className="settings-input-wrapper">
                                <input
                                    id="publicKey"
                                    type={showKeys ? "text" : "password"}
                                    value={publicKey}
                                    onChange={(e) => setPublicKey(e.target.value)}
                                    placeholder="Введіть публічний ключ"
                                    className="settings-input"
                                    disabled={loading}
                                />
                                {!showKeys && publicKey && (
                                    <button
                                        type="button"
                                        onClick={handleShowKeys}
                                        className="settings-show-btn"
                                        title="Показати ключі"
                                    >
                                        👁️
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="settings-field">
                            <label htmlFor="secretKey">Приватний ключ (Secret Key)</label>
                            <div className="settings-input-wrapper">
                                <input
                                    id="secretKey"
                                    type={showKeys ? "text" : "password"}
                                    value={secretKey}
                                    onChange={(e) => setSecretKey(e.target.value)}
                                    placeholder="Введіть приватний ключ"
                                    className="settings-input"
                                    disabled={loading}
                                />
                                {!showKeys && secretKey && (
                                    <button
                                        type="button"
                                        onClick={handleShowKeys}
                                        className="settings-show-btn"
                                        title="Показати ключі"
                                    >
                                        👁️
                                    </button>
                                )}
                            </div>
                        </div>

                        {error && <div className="settings-error">{error}</div>}
                        {success && <div className="settings-success">{success}</div>}

                        <div className="settings-actions">
                            <button 
                                type="submit" 
                                className="btn btn-primary settings-save-btn"
                                disabled={loading}
                            >
                                {loading ? 'Збереження...' : 'Зберегти ключі'}
                            </button>
                            <button 
                                type="button" 
                                onClick={handleClear}
                                className="btn btn-secondary"
                                disabled={loading}
                            >
                                Очистити
                            </button>
                        </div>
                    </form>
                </div>

                <div className="settings-section">
                    <h2 className="settings-section-title">{t('feedback.title')}</h2>
                    <p className="settings-description">{t('feedback.description')}</p>

                    {feedbackWeb3Configured === false ? (
                        <p className="settings-description" style={{ marginTop: 0 }}>
                            {t('feedback.notConfiguredHint')}
                        </p>
                    ) : (
                        <>
                            <div className="settings-field">
                                <label htmlFor="feedbackSubject">{t('feedback.subjectLabel')}</label>
                                <input
                                    id="feedbackSubject"
                                    type="text"
                                    value={feedbackSubject}
                                    onChange={(e) =>
                                        setFeedbackSubject(
                                            e.target.value.slice(0, FEEDBACK_MAX_SUBJECT_CHARS)
                                        )
                                    }
                                    placeholder={t('feedback.subjectPlaceholder')}
                                    className="settings-input"
                                    maxLength={FEEDBACK_MAX_SUBJECT_CHARS}
                                    autoComplete="off"
                                />
                                <p className="settings-feedback-meta">
                                    {t('feedback.charCount')
                                        .replace('{used}', String(feedbackSubjectLen))
                                        .replace('{max}', String(FEEDBACK_MAX_SUBJECT_CHARS))}
                                </p>
                            </div>

                            <div className="settings-field">
                                <label htmlFor="feedbackReplyEmail">{t('feedback.replyEmailLabel')}</label>
                                <input
                                    id="feedbackReplyEmail"
                                    type="email"
                                    value={feedbackReplyEmail}
                                    onChange={(e) =>
                                        setFeedbackReplyEmail(e.target.value.slice(0, 254))
                                    }
                                    placeholder={t('feedback.replyEmailPlaceholder')}
                                    className="settings-input"
                                    autoComplete="email"
                                />
                            </div>

                            <div className="settings-field">
                                <label htmlFor="feedbackMessage">{t('feedback.messageLabel')}</label>
                                <textarea
                                    id="feedbackMessage"
                                    value={feedbackMessage}
                                    onChange={(e) =>
                                        setFeedbackMessage(
                                            e.target.value.slice(0, FEEDBACK_APP_MAX_BODY_CHARS)
                                        )
                                    }
                                    placeholder={t('feedback.messagePlaceholder')}
                                    className="settings-input settings-feedback-textarea"
                                    rows={5}
                                    maxLength={FEEDBACK_APP_MAX_BODY_CHARS}
                                />
                                <p className="settings-feedback-meta">
                                    {t('feedback.charCount')
                                        .replace('{used}', String(feedbackBodyLen))
                                        .replace('{max}', String(FEEDBACK_APP_MAX_BODY_CHARS))}
                                </p>
                            </div>

                            {feedbackBanner?.type === 'success' ? (
                                <div className="settings-success">{feedbackBanner.text}</div>
                            ) : null}
                            {feedbackBanner?.type === 'error' ? (
                                <div className="settings-error">{feedbackBanner.text}</div>
                            ) : null}
                            {feedbackBanner?.type === 'info' ? (
                                <div className="settings-description" style={{ marginBottom: 12 }}>
                                    {feedbackBanner.text}
                                </div>
                            ) : null}

                            <div className="settings-actions">
                                {feedbackWeb3Configured ? (
                                    <button
                                        type="button"
                                        className="btn btn-primary settings-save-btn"
                                        onClick={sendFeedbackFromApp}
                                        disabled={!feedbackMessage.trim() || feedbackSending}
                                    >
                                        {feedbackSending
                                            ? t('feedback.sending')
                                            : t('feedback.sendFromApp')}
                                    </button>
                                ) : null}
                            </div>
                        </>
                    )}
                </div>

                {updater && (
                    <div className="settings-section">
                        <h2 className="settings-section-title">Оновлення додатку</h2>
                        {updater.manualMacUpdate ? (
                            <div className="settings-mac-update-note" role="note">
                                <strong>macOS:</strong> автооновлення в застосунку недоступне без платного підпису Apple.
                                Натисніть «Завантажити оновлення (ZIP)» — архів збережеться у тимчасовій папці й
                                відкриється; розпакуйте <strong>.app</strong> і замініть стару копію в Програмах.
                                Альтернатива — завантажити <strong>.dmg</strong> зі сторінки релізу на GitHub.
                            </div>
                        ) : null}
                        {updater.manualMacUpdate && updater.remoteReleaseNotes ? (
                            <details className="settings-changelog-details" style={{ marginBottom: 16 }}>
                                <summary className="settings-changelog-summary">
                                    Примітки до нової версії на GitHub
                                </summary>
                                <div className="settings-remote-release-body">{updater.remoteReleaseNotes}</div>
                            </details>
                        ) : null}
                        {updaterReleaseNotes.length > 0 && (
                            <details className="settings-changelog-details">
                                <summary className="settings-changelog-summary">
                                    Зміни в поточній версії ({updater.appVersion || '—'})
                                </summary>
                                <ul className="settings-changelog-list">
                                    {updaterReleaseNotes.map((line, i) => (
                                        <li key={i}>{line}</li>
                                    ))}
                                </ul>
                            </details>
                        )}
                        <p className="settings-description" style={{ marginTop: '-12px' }}>
                            Поточна версія: <strong>{updater.appVersion || '—'}</strong>
                            {updater.remoteVersion ? (
                                <span>
                                    {' '}
                                    · доступна: <strong>{updater.remoteVersion}</strong>
                                </span>
                            ) : null}
                        </p>

                        {updater.upToDateHint ? <div className="settings-success">{updater.upToDateHint}</div> : null}
                        {updater.macPostDownloadHint ? (
                            <div className="settings-success">{updater.macPostDownloadHint}</div>
                        ) : null}
                        {updater.error ? <div className="settings-error">{updater.error}</div> : null}

                        {updater.phase === 'checking' && (
                            <p className="settings-description" style={{ marginBottom: 0 }}>
                                Перевірка оновлень…
                            </p>
                        )}

                        {updater.phase === 'downloading' && (
                            <div className="settings-update-progress-wrap">
                                <div className="settings-update-progress">
                                    <div
                                        className="settings-update-progress-bar"
                                        style={{ width: `${updater.downloadPercent}%` }}
                                    />
                                </div>
                                <p className="settings-description" style={{ marginBottom: 0, marginTop: 8 }}>
                                    {updater.manualMacUpdate ? 'Завантаження ZIP' : 'Завантаження'}:{' '}
                                    {updater.downloadPercent}%
                                </p>
                            </div>
                        )}

                        <div className="settings-actions" style={{ marginTop: '16px' }}>
                            <button
                                type="button"
                                className="btn btn-primary settings-save-btn"
                                onClick={updater.onCheck}
                                disabled={updater.phase === 'checking' || updater.phase === 'downloading'}
                            >
                                Перевірити оновлення
                            </button>
                            {updater.manualMacUpdate && updater.phase === 'available' && (
                                <>
                                    <button type="button" className="btn btn-primary" onClick={updater.onDownload}>
                                        Завантажити оновлення (ZIP)
                                    </button>
                                    {updater.onOpenMacRelease ? (
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={updater.onOpenMacRelease}
                                        >
                                            Відкрити сторінку релізу
                                        </button>
                                    ) : null}
                                </>
                            )}
                            {!updater.manualMacUpdate && updater.phase === 'available' && (
                                <button type="button" className="btn btn-secondary" onClick={updater.onDownload}>
                                    Завантажити оновлення
                                </button>
                            )}
                            {!updater.manualMacUpdate && updater.phase === 'ready' && (
                                <button type="button" className="btn btn-primary" onClick={updater.onInstall}>
                                    Встановити та перезапустити
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div className="settings-section">
                    <h2 className="settings-section-title">Безпека</h2>
                    <p className="settings-description">
                        Вийти з системи та видалити збережені ключі. Після виходу вам потрібно буде
                        ввести ключі знову для використання бота.
                    </p>
                    <button 
                        onClick={handleLogout}
                        className="btn btn-danger settings-logout-btn"
                        disabled={loading}
                    >
                        Вийти з системи
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Settings;

