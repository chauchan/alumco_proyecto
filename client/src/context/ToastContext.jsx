import React, { createContext, useContext, useState, useCallback } from 'react';
import Toast from '../components/Toast';

const ToastContext = createContext(null);

let _nextId = 0;
const MAX_TOASTS = 3;
const DURATION = 4000;
const DURATION_UNDO = 5000;
const FADE_MS  = 300;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), FADE_MS);
  }, []);

  const add = useCallback((message, type, extra) => {
    const id = ++_nextId;
    setToasts(prev => [...prev.slice(-(MAX_TOASTS - 1)), { id, message, type, leaving: false, ...extra }]);
    const duracion = type === 'undo' ? DURATION_UNDO : DURATION;
    setTimeout(() => dismiss(id), duracion);
    return id;
  }, [dismiss]);

  const toast = {
    success: (msg) => add(msg, 'success'),
    error:   (msg) => add(msg, 'error'),
    warn:    (msg) => add(msg, 'warn'),
    info:    (msg) => add(msg, 'info'),
    // Muestra un toast con botón "Deshacer" que llama a onUndo dentro de la ventana de 5s.
    undo:    (msg, onUndo) => {
      const id = add(msg, 'undo', {
        onUndo: () => { onUndo(); dismiss(id); }
      });
    },
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map(t => (
          <Toast key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
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
