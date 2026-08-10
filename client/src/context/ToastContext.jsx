import React, { createContext, useContext, useState, useCallback } from 'react';
import Toast from '../components/Toast';

const ToastContext = createContext(null);

let _nextId = 0;
const MAX_TOASTS = 3;
const DURATION = 4000;
const UNDO_DURATION = 5000;   // §4 del plan: "Deshacer" visible por 5 segundos
const FADE_MS  = 300;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), FADE_MS);
  }, []);

  // opts: { action: { label, onClick }, duration }
  const add = useCallback((message, type, opts = {}) => {
    const id = ++_nextId;
    const action = opts.action || null;
    const duration = opts.duration || (action ? UNDO_DURATION : DURATION);
    setToasts(prev => [...prev.slice(-(MAX_TOASTS - 1)), { id, message, type, action, leaving: false }]);
    setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  // Al pulsar la acción se cierra el toast y se ejecuta el callback: sin esto
  // el "Deshacer" seguiría en pantalla después de haber deshecho.
  const runAction = useCallback((t) => {
    dismiss(t.id);
    if (t.action?.onClick) t.action.onClick();
  }, [dismiss]);

  const toast = {
    success: (msg, opts) => add(msg, 'success', opts),
    error:   (msg, opts) => add(msg, 'error', opts),
    warn:    (msg, opts) => add(msg, 'warn', opts),
    info:    (msg, opts) => add(msg, 'info', opts),
    /* Confirmación reversible: muestra el mensaje con un "Deshacer" durante 5s.
       Uso: toast.undo('Certificado aprobado', () => revertirAprobacion(id)) */
    undo:    (msg, onUndo, opts = {}) =>
      add(msg, 'success', { ...opts, action: { label: 'Deshacer', onClick: onUndo } }),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map(t => (
          <Toast
            key={t.id}
            toast={t}
            onDismiss={() => dismiss(t.id)}
            onAction={() => runAction(t)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider');
  return ctx;
}
