import React from 'react';

const ICONS = { success: '✓', error: '✕', warn: '⚠', info: 'i' };

export default function Toast({ toast, onDismiss }) {
  return (
    <div className={`toast toast-${toast.type}${toast.leaving ? ' toast-leaving' : ''}`}>
      <span className="toast-icon">{ICONS[toast.type]}</span>
      <span className="toast-message">{toast.message}</span>
      <button className="toast-close" onClick={onDismiss} aria-label="Cerrar">×</button>
    </div>
  );
}
