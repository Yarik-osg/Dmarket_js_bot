import React from 'react';
import Modal from 'react-modal';
import { FaTimes } from 'react-icons/fa';
import '../styles/Modal.css';

// Set app element for react-modal accessibility
if (typeof document !== 'undefined') {
    Modal.setAppElement('#root');
}

function CustomModal({ isOpen, onClose, title, children, size = 'medium' }) {
    const sizeClasses = {
        small: 'modal-small',
        medium: 'modal-medium',
        large: 'modal-large'
    };

    return (
        <Modal
            isOpen={isOpen}
            onRequestClose={onClose}
            className={`modal-content ${sizeClasses[size] || sizeClasses.medium}`}
            overlayClassName="modal-overlay"
            closeTimeoutMS={200}
        >
            <div className="modal-header">
                <h2 className="modal-title">{title}</h2>
                <button className="modal-close-btn" onClick={onClose} aria-label="Close">
                    <FaTimes />
                </button>
            </div>
            <div className="modal-body">
                {children}
            </div>
        </Modal>
    );
}

export default CustomModal;





