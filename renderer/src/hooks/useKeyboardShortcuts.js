import { useEffect } from 'react';

const TAB_MAP = {
    '1': 'orders',
    '2': 'offers',
    '3': 'analytics',
    '4': 'notifications',
    '5': 'settings',
    '6': 'logs'
};

export function useKeyboardShortcuts({ onTabChange, onRefresh }) {
    useEffect(() => {
        function handleKeyDown(e) {
            const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

            // Ctrl/Cmd + 1-6: switch tabs
            if ((e.ctrlKey || e.metaKey) && TAB_MAP[e.key]) {
                e.preventDefault();
                onTabChange?.(TAB_MAP[e.key]);
                return;
            }

            // Escape: close modals / blur active input
            if (e.key === 'Escape') {
                if (isInput) {
                    document.activeElement.blur();
                    return;
                }
                const modalOverlay = document.querySelector('.ReactModal__Overlay');
                if (modalOverlay) {
                    const closeBtn = modalOverlay.querySelector('[aria-label="Close"], .modal-close-btn, button[data-close]');
                    closeBtn?.click();
                }
                return;
            }

            if (isInput) return;

            // Ctrl/Cmd + R: refresh current list
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                onRefresh?.();
                return;
            }

            // Ctrl/Cmd + F: focus search input on current tab
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                const visibleContent = document.querySelector('.main-content > div:not([style*="display: none"])');
                const searchInput = visibleContent?.querySelector('input[type="text"], input[type="search"], input[placeholder*="Пошук"], input[placeholder*="пошук"]');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
                return;
            }
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onTabChange, onRefresh]);
}
