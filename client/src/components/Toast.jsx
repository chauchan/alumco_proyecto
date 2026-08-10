import React from 'react';
import { Icon } from '@iconify/react';

const ICONS = {
  success: 'lucide:check-circle',
  error:   'lucide:x-circle',
  warn:    'lucide:triangle-alert',
  info:    'lucide:info',
};

export default function Toast({ toast, onDismiss, onAction }) {
  return (
    <div className={`toast toast-${toast.type}${toast.leaving ? ' toast-leaving' : ''}`}>
      <span className="toast-icon">
        <Icon icon={ICONS[toast.type]} width={16} />
      </span>
      <span className="toast-message">{toast.message}</span>
      {toast.action && (
        <button className="toast-action" onClick={onAction}>
          {toast.action.label}
        </button>
      )}
      <button className="toast-close" onClick={onDismiss} aria-label="Cerrar">×</button>
    </div>
  );
}
