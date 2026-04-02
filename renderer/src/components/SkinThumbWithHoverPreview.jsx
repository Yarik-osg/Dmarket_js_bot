import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import '../styles/SkinThumbWithHoverPreview.css';

/**
 * Мініатюра з великим прев’ю при наведенні (портал у body, щоб не обрізало overflow таблиці).
 */
export function SkinThumbWithHoverPreview({
    src,
    alt = '',
    thumbClassName = '',
    onError,
    loading = 'lazy',
    maxPreviewWidth = 320,
    maxPreviewHeight = 320
}) {
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState({ left: 0, top: 0 });
    const thumbRef = useRef(null);
    const leaveTimerRef = useRef(null);

    const clearLeaveTimer = useCallback(() => {
        if (leaveTimerRef.current) {
            clearTimeout(leaveTimerRef.current);
            leaveTimerRef.current = null;
        }
    }, []);

    const updatePosition = useCallback(() => {
        const el = thumbRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const pad = 12;
        const estW = Math.min(maxPreviewWidth, window.innerWidth * 0.85) + 32;
        let left = r.right + pad;
        if (left + estW > window.innerWidth - 12) {
            left = r.left - estW - pad;
        }
        if (left < 12) {
            left = 12;
        }
        const top = r.top + r.height / 2;
        setCoords({ left, top });
    }, [maxPreviewWidth]);

    const openPreview = useCallback(() => {
        clearLeaveTimer();
        updatePosition();
        setOpen(true);
    }, [clearLeaveTimer, updatePosition]);

    const scheduleClose = useCallback(() => {
        clearLeaveTimer();
        leaveTimerRef.current = setTimeout(() => setOpen(false), 200);
    }, [clearLeaveTimer]);

    const onPreviewEnter = useCallback(() => {
        clearLeaveTimer();
    }, [clearLeaveTimer]);

    const onPreviewLeave = useCallback(() => {
        setOpen(false);
    }, []);

    useEffect(() => () => clearLeaveTimer(), [clearLeaveTimer]);

    useEffect(() => {
        if (!open) return undefined;
        const close = () => setOpen(false);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, [open]);

    const preview =
        open && src
            ? createPortal(
                  <div
                      className="skin-hover-preview-panel"
                      style={{
                          left: coords.left,
                          top: coords.top,
                          '--skin-preview-max-w': `${maxPreviewWidth}px`,
                          '--skin-preview-max-h': `${maxPreviewHeight}px`
                      }}
                      onMouseEnter={onPreviewEnter}
                      onMouseLeave={onPreviewLeave}
                  >
                      <img
                          src={src}
                          alt=""
                          className="skin-hover-preview-img"
                          draggable={false}
                      />
                  </div>,
                  document.body
              )
            : null;

    return (
        <>
            <img
                ref={thumbRef}
                src={src}
                alt={alt}
                className={thumbClassName}
                loading={loading}
                decoding="async"
                onError={onError}
                onMouseEnter={openPreview}
                onMouseMove={updatePosition}
                onMouseLeave={scheduleClose}
            />
            {preview}
        </>
    );
}
