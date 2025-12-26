import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useLogs } from '../contexts/LogsContext.jsx';
import '../styles/Settings.css';

function Settings() {
    const { login, logout, isAuthenticated } = useAuth();
    const { addLog } = useLogs();
    const [publicKey, setPublicKey] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [showKeys, setShowKeys] = useState(false);

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
        if (window.confirm('Ви впевнені, що хочете вийти? Вам потрібно буде ввести ключі знову для використання бота.')) {
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
        }
    };

    const handleClear = () => {
        if (window.confirm('Ви впевнені, що хочете очистити поля? Поточні ключі залишаться збереженими.')) {
            setPublicKey('');
            setSecretKey('');
            setError('');
            setSuccess('');
            setShowKeys(false);
        }
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

    return (
        <div className="settings-container">
            <div className="settings-header">
                <h1 className="settings-title">Налаштування</h1>
            </div>

            <div className="settings-content">
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

