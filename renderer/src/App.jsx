import React from 'react';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { LocaleProvider } from './contexts/LocaleContext.jsx';
import { LogsProvider } from './contexts/LogsContext.jsx';
import MainLayout from './components/Layout/MainLayout.jsx';

function App() {
    return (
        <LocaleProvider>
            <AuthProvider>
                <LogsProvider>
                    <MainLayout />
                </LogsProvider>
            </AuthProvider>
        </LocaleProvider>
    );
}

export default App;

