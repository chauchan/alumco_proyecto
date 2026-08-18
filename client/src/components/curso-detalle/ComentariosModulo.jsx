import { Icon } from '@iconify/react'

const fmtFecha = (iso) => {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

// Preguntas/comentarios de un módulo, con una capa de respuestas (sin
// anidamiento más profundo — el backend solo soporta parent_id directo).
export default function ComentariosModulo({
  comentarios, textoInput, onChangeTexto, enviando,
  replyingTo, textoReply, onChangeReplyTexto, onToggleReply, onEnviar,
}) {
  const raices = comentarios.filter(c => !c.parent_id)
  const respuestasDe = (parentId) => comentarios.filter(c => c.parent_id === parentId)

  return (
    <div style={{ marginTop: 28, borderTop: '0.5px solid var(--cd-border-light)', paddingTop: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--cd-text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon icon="lucide:message-circle" width={15} style={{color:'var(--azul)'}} />
        Preguntas y comentarios
        {comentarios.length > 0 && (
          <span style={{ fontSize: 11, background: 'var(--azul-claro)', color: 'var(--azul)', borderRadius: 10, padding: '2px 8px', fontWeight: 600 }}>
            {comentarios.length}
          </span>
        )}
      </div>

      {raices.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--cd-text-muted)', marginBottom: 14 }}>
          Sé el primero en preguntar o comentar sobre este módulo.
        </div>
      )}
      {raices.map(com => (
        <div key={com.id} style={{ marginBottom: 14 }}>
          {/* Comentario raíz */}
          <div style={{ background: 'var(--cd-subtle-bg)', border: '0.5px solid var(--cd-border)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cd-text)' }}>{com.autor_nombre}</span>
              <span style={{ fontSize: 11, color: 'var(--cd-text-muted)' }}>{fmtFecha(com.creado_en)}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--cd-text)', lineHeight: 1.6, wordBreak: 'break-word' }}>{com.texto}</div>
            <button
              onClick={() => onToggleReply(com.id)}
              style={{ marginTop: 6, background: 'none', border: 'none', fontSize: 11, color: 'var(--azul)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon icon="lucide:corner-down-right" width={11} /> Responder
            </button>
          </div>

          {/* Respuestas hijas */}
          {respuestasDe(com.id).map(rep => (
            <div key={rep.id} style={{ marginLeft: 24, marginTop: 6, background: 'var(--cd-card-bg)', border: '0.5px solid var(--cd-border)', borderRadius: 10, padding: '8px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cd-text)' }}>{rep.autor_nombre}</span>
                <span style={{ fontSize: 11, color: 'var(--cd-text-muted)' }}>{fmtFecha(rep.creado_en)}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--cd-text)', lineHeight: 1.6, wordBreak: 'break-word' }}>{rep.texto}</div>
            </div>
          ))}

          {/* Caja de respuesta */}
          {replyingTo === com.id && (
            <div style={{ marginLeft: 24, marginTop: 6, display: 'flex', gap: 8 }}>
              <textarea
                value={textoReply}
                onChange={e => onChangeReplyTexto(e.target.value)}
                placeholder="Escribe una respuesta..."
                rows={2}
                style={{ flex: 1, resize: 'vertical', borderRadius: 8, border: '1px solid var(--cd-border)', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button
                  onClick={() => onEnviar(textoReply, com.id)}
                  disabled={!textoReply.trim() || enviando}
                  style={{ background: 'var(--azul)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: textoReply.trim() ? 'pointer' : 'not-allowed', opacity: textoReply.trim() ? 1 : 0.5 }}>
                  {enviando ? '...' : 'Enviar'}
                </button>
                <button
                  onClick={() => onToggleReply(null)}
                  style={{ background: 'var(--cd-subtle-bg)', color: 'var(--cd-text-sec)', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Nueva pregunta / comentario raíz */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <textarea
          value={textoInput}
          onChange={e => onChangeTexto(e.target.value)}
          placeholder="Escribe una pregunta o comentario sobre este módulo..."
          rows={2}
          style={{ flex: 1, resize: 'vertical', borderRadius: 8, border: '1px solid var(--cd-border)', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
        />
        <button
          onClick={() => onEnviar(textoInput, null)}
          disabled={!textoInput.trim() || enviando}
          style={{ alignSelf: 'flex-end', background: 'var(--azul)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: textoInput.trim() ? 'pointer' : 'not-allowed', opacity: textoInput.trim() ? 1 : 0.5, whiteSpace: 'nowrap' }}>
          <Icon icon="lucide:send" width={14} style={{verticalAlign:'middle',marginRight:4}} />
          {enviando ? 'Enviando...' : 'Comentar'}
        </button>
      </div>
    </div>
  )
}
