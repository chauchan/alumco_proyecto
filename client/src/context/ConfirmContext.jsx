import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { Icon } from '@iconify/react'

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)

  const confirm = useCallback((opts) => {
    return new Promise(resolve => {
      setState({
        title: opts.title || '¿Confirmar acción?',
        message: opts.message || '',
        confirmText: opts.confirmText || 'Confirmar',
        cancelText: opts.cancelText || 'Cancelar',
        danger: !!opts.danger,
        resolve,
      })
    })
  }, [])

  const close = (result) => {
    if (state) state.resolve(result)
    setState(null)
  }

  useEffect(() => {
    if (!state) return
    const onKey = (e) => {
      if (e.key === 'Escape') close(false)
      else if (e.key === 'Enter') close(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 16,
          }}
          onClick={() => close(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 12, padding: '24px 28px',
              maxWidth: 420, width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: state.danger ? '#FFF0F0' : '#EEF2FF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon
                  icon={state.danger ? 'lucide:triangle-alert' : 'lucide:help-circle'}
                  width={20}
                  style={{ color: state.danger ? '#E8505B' : '#2B4BA0' }}
                />
              </div>
              <div style={{ flex: 1, paddingTop: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>
                  {state.title}
                </div>
              </div>
            </div>
            {state.message && (
              <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 22, paddingLeft: 48 }}>
                {state.message}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => close(false)}
                style={{
                  background: 'none', border: '0.5px solid #E8E8E8', borderRadius: 8,
                  padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: '#555',
                }}
              >
                {state.cancelText}
              </button>
              <button
                onClick={() => close(true)}
                autoFocus
                style={{
                  background: state.danger ? '#E8505B' : '#2B4BA0', border: 'none',
                  borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer',
                  color: '#fff', fontWeight: 500,
                }}
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm debe usarse dentro de ConfirmProvider')
  return ctx
}
