import React from 'react';

const ICONS = { success: '✓', error: '✕', warn: '⚠', info: 'i', undo: '↺' };

export default function Toast({ toast, onDismiss }) {
  return (
    <div className={`toast toast-${toast.type}${toast.leaving ? ' toast-leaving' : ''}`}>
      <span className="toast-icon">{ICONS[toast.type]}</span>
      <span className="toast-message">{toast.message}</span>
      {toast.type === 'undo' && (
        <button className="toast-undo-btn" onClick={toast.onUndo}>Deshacer</button>
      )}
      <button className="toast-close" onClick={onDismiss} aria-label="Cerrar">×</button>
    </div>
  );
}
