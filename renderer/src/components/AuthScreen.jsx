import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLocale } from '../contexts/LocaleContext.jsx';
import '../styles/AuthScreen.css';

function AuthScreen() {
    const { login, loading } = useAuth();
    const { t } = useLocale();
    const [publicKey, setPublicKey] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!publicKey.trim() || !secretKey.trim()) {
            setError('Будь ласка, введіть обидва ключі');
            return;
        }

        const success = await login(publicKey, secretKey);
        if (!success) {
            setError(t('auth.error') + '. Перевірте правильність ключів.');
        }
    };

    if (loading) {
        return <div className="auth-loading">{t('auth.loading')}</div>;
    }

    return (
        <div className="auth-container">
            <div className="auth-box">
                <h1 className="auth-title">{t('auth.title')}</h1>
                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="auth-field">
                        <label htmlFor="publicKey">{t('auth.publicKey')}</label>
                        <input
                            id="publicKey"
                            type="text"
                            value={publicKey}
                            onChange={(e) => setPublicKey(e.target.value)}
                            placeholder={t('auth.publicKey')}
                            className="auth-input"
                        />
                    </div>
                    <div className="auth-field">
                        <label htmlFor="secretKey">{t('auth.secretKey')}</label>
                        <input
                            id="secretKey"
                            type="password"
                            value={secretKey}
                            onChange={(e) => setSecretKey(e.target.value)}
                            placeholder={t('auth.secretKey')}
                            className="auth-input"
                        />
                    </div>
                    {error && <div className="auth-error">{error}</div>}
                    <button type="submit" className="auth-button">
                        {t('auth.login')}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default AuthScreen;

