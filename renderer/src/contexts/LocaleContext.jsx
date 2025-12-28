import React, { createContext, useContext } from 'react';
import ukTranslations from '../locales/uk.json';

const LocaleContext = createContext();

export function LocaleProvider({ children }) {
    // Завжди використовуємо українську мову
    const t = (key) => {
        return ukTranslations[key] || key;
    };

    return (
        <LocaleContext.Provider value={{ 
            locale: 'uk', 
            setLocale: () => {}, // Пуста функція, мова не змінюється
            t 
        }}>
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


