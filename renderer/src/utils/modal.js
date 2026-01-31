import React from 'react';
import { createRoot } from 'react-dom/client';
import CustomModal from '../components/Modal.jsx';

let modalRoot = null;

export const showModal = ({ title, content, onClose, size = 'medium' }) => {
    if (!modalRoot) {
        const container = document.createElement('div');
        container.id = 'modal-container';
        document.body.appendChild(container);
        modalRoot = createRoot(container);
    }

    const handleClose = () => {
        if (onClose) {
            onClose();
        }
        modalRoot.render(null);
    };

    modalRoot.render(
        <CustomModal isOpen={true} onClose={handleClose} title={title} size={size}>
            {content}
        </CustomModal>
    );
};

export const showConfirmModal = ({ title, message, onConfirm, onCancel, confirmText = 'Підтвердити', cancelText = 'Скасувати', confirmVariant = 'primary' }) => {
    if (!modalRoot) {
        const container = document.createElement('div');
        container.id = 'modal-container';
        document.body.appendChild(container);
        modalRoot = createRoot(container);
    }

    const handleConfirm = () => {
        if (onConfirm) {
            onConfirm();
        }
        modalRoot.render(null);
    };

    const handleCancel = () => {
        if (onCancel) {
            onCancel();
        }
        modalRoot.render(null);
    };

    modalRoot.render(
        <CustomModal isOpen={true} onClose={handleCancel} title={title} size="medium">
            <div style={{ lineHeight: '1.6' }}>{message}</div>
            <div className="modal-footer">
                <button className={`modal-btn modal-btn-secondary`} onClick={handleCancel}>
                    {cancelText}
                </button>
                <button className={`modal-btn modal-btn-${confirmVariant}`} onClick={handleConfirm}>
                    {confirmText}
                </button>
            </div>
        </CustomModal>
    );
};

export const showAlertModal = ({ title, message, onClose, buttonText = 'OK' }) => {
    if (!modalRoot) {
        const container = document.createElement('div');
        container.id = 'modal-container';
        document.body.appendChild(container);
        modalRoot = createRoot(container);
    }

    const handleClose = () => {
        if (onClose) {
            onClose();
        }
        modalRoot.render(null);
    };

    modalRoot.render(
        <CustomModal isOpen={true} onClose={handleClose} title={title} size="small">
            <div style={{ marginBottom: '24px', lineHeight: '1.6' }}>{message}</div>
            <div className="modal-footer">
                <button className="modal-btn modal-btn-primary" onClick={handleClose}>
                    {buttonText}
                </button>
            </div>
        </CustomModal>
    );
};

