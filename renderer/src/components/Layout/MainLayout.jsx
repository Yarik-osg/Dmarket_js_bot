import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import Sidebar from './Sidebar.jsx';
import TargetsList from '../TargetsList.jsx';
import OffersList from '../OffersList.jsx';
import LogsList from '../LogsList.jsx';
import Settings from '../Settings.jsx';
import AuthScreen from '../AuthScreen.jsx';
import '../../styles/MainLayout.css';

function MainLayout() {
    const { isAuthenticated } = useAuth();
    const [activeTab, setActiveTab] = useState('orders');
    const [isTargetsParsingEnabled, setIsTargetsParsingEnabled] = useState(false);
    const [isOffersParsingEnabled, setIsOffersParsingEnabled] = useState(false);

    if (!isAuthenticated) {
        return <AuthScreen />;
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'phases':
                return <div>Фази (в розробці)</div>;
            case 'floats':
                return <div>Флоати (в розробці)</div>;
            case 'settings':
                return <Settings />;
            case 'logs':
                return <LogsList />;
            default:
                return null;
        }
    };

    return (
        <div className="main-layout">
            <Sidebar 
                activeTab={activeTab} 
                onTabChange={setActiveTab}
                isTargetsParsingEnabled={isTargetsParsingEnabled}
                isOffersParsingEnabled={isOffersParsingEnabled}
                onToggleTargetsParsing={() => setIsTargetsParsingEnabled(prev => !prev)}
                onToggleOffersParsing={() => setIsOffersParsingEnabled(prev => !prev)}
            />
            <div className="main-content">
                {/* Always render components but hide them with CSS to keep intervals running */}
                <div style={{ display: activeTab === 'orders' ? 'block' : 'none' }}>
                    <TargetsList 
                        isAutoUpdatingEnabled={isTargetsParsingEnabled}
                        onToggleAutoUpdate={() => setIsTargetsParsingEnabled(prev => !prev)}
                    />
                </div>
                <div style={{ display: activeTab === 'offers' ? 'block' : 'none' }}>
                    <OffersList 
                        isAutoUpdatingEnabled={isOffersParsingEnabled}
                        onToggleAutoUpdate={() => setIsOffersParsingEnabled(prev => !prev)}
                    />
                </div>
                {activeTab !== 'orders' && activeTab !== 'offers' && renderContent()}
            </div>
        </div>
    );
}

export default MainLayout;

