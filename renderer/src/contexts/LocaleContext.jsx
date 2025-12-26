import React, { createContext, useContext, useState, useEffect } from 'react';
import ukTranslations from '../locales/uk.json';

const LocaleContext = createContext();

export function LocaleProvider({ children }) {
    const [locale, setLocale] = useState('uk');
    const [translations, setTranslations] = useState(ukTranslations);

    useEffect(() => {
        // Load translations based on locale
        if (locale === 'uk') {
            setTranslations(ukTranslations);
        }
    }, [locale]);

    const t = (key) => {
        return translations[key] || key;
    };

    return (
        <LocaleContext.Provider value={{ locale, setLocale, t }}>
            {children}
        </LocaleContext.Provider>
    );
}

export function useLocale() {
    const context = useContext(LocaleContext);
    if (!context) {
        throw new Error('useLocale must be used within LocaleProvider');
    }
    return context;
}


