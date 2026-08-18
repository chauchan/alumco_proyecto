import { Icon } from '@iconify/react'
import ContenidoModulo from './ContenidoModulo'
import ComentariosModulo from './ComentariosModulo'

// Paso "Módulos" de CursoDetalle: pestañas horizontales + contenido del
// módulo activo (delegado a ContenidoModulo) + sus comentarios, y el botón
// para pasar a la evaluación una vez completados todos.
export default function TabModulos({
  modulos, moduloActivo, onSetModuloActivo, completados, slideActual, onSetSlideActual,
  signedUrls, onMarcarCompleto,
  comentariosPorModulo, textoPorModulo, onChangeTexto, replyingTo, replyTexto,
  onChangeReplyTexto, onToggleReply, enviandoCom, onEnviarComentario,
  todosModulosCompletos, tienePreguntas, onIrEvaluacion,
}) {
  if (!modulos?.length) {
    return <div style={{ textAlign: 'center', color: 'var(--cd-text-muted)', padding: 32 }}>No hay módulos en este curso.</div>
  }

  const idx = modulos.findIndex(m => m.id === moduloActivo)
  const mod = modulos[idx]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Indicador "Módulo X de Y" */}
      {idx >= 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cd-text-sec)' }}>Módulo {idx + 1} de {modulos.length}</span>
          <span style={{ fontSize: 12, color: 'var(--cd-text-muted)' }}>{completados.size} de {modulos.length} completados</span>
        </div>
      )}

      {/* Pestañas de módulos */}
      <div style={{ display: 'flex', overflowX: 'auto', gap: 0, borderBottom: '1.5px solid var(--cd-border-light)', marginBottom: 20, scrollbarWidth: 'none' }}>
        {modulos.map((m, i) => {
          const completo = completados.has(m.id)
          const activo = moduloActivo === m.id
          return (
            <button key={m.id}
              onClick={() => { onSetModuloActivo(m.id); onSetSlideActual(0) }}
              style={{
                flexShrink: 0, background: 'none', border: 'none',
                padding: '10px 16px', cursor: 'pointer',
                borderBottom: activo ? '2px solid var(--azul)' : completo ? '2px solid var(--success)' : '2px solid transparent',
                display: 'flex', alignItems: 'center', gap: 7,
                color: activo ? 'var(--azul)' : completo ? 'var(--success)' : 'var(--cd-text-sec)',
                fontWeight: activo ? 600 : 400, fontSize: 13,
                maxWidth: 200, marginBottom: -1.5,
                whiteSpace: 'nowrap'
              }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                background: activo ? 'var(--azul)' : completo ? 'var(--success)' : 'var(--cd-border)',
                color: activo || completo ? '#fff' : 'var(--cd-text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700
              }}>
                {completo ? <Icon icon="lucide:check" width={10} /> : i + 1}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{m.titulo}</span>
            </button>
          )
        })}
      </div>

      {/* Contenido del módulo activo */}
      {mod && (() => {
        const completo = completados.has(mod.id)
        return (
          <div>
            {/* flexWrap + minWidth:0 en el bloque de texto: sin esto, en un
                móvil la píldora "Completado" no encoge y comprimía el título y
                la descripción hasta dejarlos en una palabra por línea. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: completo ? '#DCFCE7' : 'var(--azul-claro)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {completo
                  ? <Icon icon="lucide:check" color="var(--success)" width={16} />
                  : mod.tipo === 'video'
                    ? <Icon icon="lucide:video" width={16} style={{color:'var(--azul)'}} />
                    : mod.tipo === 'pdf'
                      ? <Icon icon="lucide:file-text" width={16} style={{color:'var(--rojo)'}} />
                      : <Icon icon="lucide:presentation" width={16} style={{color:'var(--cd-text-muted)'}} />}
              </div>
              <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: completo ? 'var(--success)' : 'var(--cd-text)' }}>{idx + 1}. {mod.titulo}</div>
                {mod.descripcion && <div style={{ fontSize: 12, color: 'var(--cd-text-muted)', marginTop: 2 }}>{mod.descripcion}</div>}
              </div>
              {completo && (
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '4px 10px' }}>
                  <Icon icon="lucide:check" width={12} /> Completado
                </span>
              )}
            </div>

            {completo ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--success)' }}>
                <Icon icon="lucide:check-circle" width={40} style={{marginBottom:8,display:'block',margin:'0 auto 12px'}} />
                <div style={{ fontSize: 14, fontWeight: 500 }}>Módulo completado</div>
                {idx + 1 < modulos.length && (
                  <button onClick={() => { onSetModuloActivo(modulos[idx + 1].id); onSetSlideActual(0) }}
                    style={{ marginTop: 14, background: 'var(--azul)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    <>Siguiente módulo <Icon icon="lucide:arrow-right" width={13} style={{verticalAlign:'middle',marginLeft:4}} /></>
                  </button>
                )}
              </div>
            ) : (
              <ContenidoModulo
                mod={mod} slideActual={slideActual} onSetSlideActual={onSetSlideActual}
                signedUrl={signedUrls[mod.id]} onMarcarCompleto={() => onMarcarCompleto(mod.id)}
              />
            )}

            <ComentariosModulo
              comentarios={comentariosPorModulo[mod.id] || []}
              textoInput={textoPorModulo[mod.id] || ''}
              onChangeTexto={val => onChangeTexto(mod.id, val)}
              enviando={!!enviandoCom[mod.id]}
              replyingTo={replyingTo[mod.id] || null}
              textoReply={replyTexto[mod.id] || ''}
              onChangeReplyTexto={val => onChangeReplyTexto(mod.id, val)}
              onToggleReply={comId => onToggleReply(mod.id, comId)}
              onEnviar={(texto, parentId) => onEnviarComentario(mod.id, texto, parentId)}
            />
          </div>
        )
      })()}

      {/* Botón ir a evaluación */}
      {tienePreguntas && (
        <div style={{ textAlign: 'center', marginTop: 24, paddingTop: 20, borderTop: '0.5px solid var(--cd-border-light)' }}>
          {todosModulosCompletos ? (
            <button onClick={onIrEvaluacion} style={{
              background: 'var(--azul)', color: '#fff', border: 'none', borderRadius: 10,
              padding: '11px 28px', fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}>
              <>Ir a la evaluación <Icon icon="lucide:arrow-right" width={13} style={{verticalAlign:'middle',marginLeft:4}} /></>
            </button>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--cd-text-muted)', background: 'var(--cd-subtle-bg)', borderRadius: 10, padding: '10px 20px', display: 'inline-block' }}>
              <><Icon icon="lucide:lock" width={12} style={{verticalAlign:'middle',marginRight:3}} /> Completa todos los módulos para acceder a la evaluación</>
              {' '}({completados.size}/{modulos.length} completados)
            </div>
          )}
        </div>
      )}
    </div>
  )
}
