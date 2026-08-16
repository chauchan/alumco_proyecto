import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import api from '../services/api'

// Piezas compartidas para ver/editar la presentación PPT generada por IA de un
// módulo — usadas por GeneradorIA (crear/editar borrador), Profesor (validar
// antes de publicar) y CursoDetalle (vista del colaborador).

// ── buildSlides: usa diapositivas IA si existen ──────────────────────────────
export function buildSlides(mod, pres) {
  if (Array.isArray(pres.diapositivas) && pres.diapositivas.length > 0) {
    return pres.diapositivas
  }
  return []
}

// ── SignedImage: prueba la URL pública primero, cae a signed URL si falla ───
// Las imágenes se suben a S3 con ACL public-read; la mayoría carga directo.
// Solo si el browser no puede descargar la URL pública (bucket policy no
// aplicada, etc.) pedimos una signed URL al backend como respaldo.
export function SignedImage({ src: rawSrc, ...imgProps }) {
  const [src, setSrc] = useState('')
  const [intentoSigned, setIntentoSigned] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
    setIntentoSigned(false)
    setSrc(rawSrc || '')
  }, [rawSrc])

  if (failed || !src) return null

  return (
    <img
      src={src}
      onError={() => {
        // Primer fallo: intentar con signed URL si es una URL S3 http
        if (!intentoSigned && rawSrc?.startsWith('http')) {
          setIntentoSigned(true)
          api.get('/ia/imagen-signed', { params: { url: rawSrc } })
            .then(r => {
              if (typeof r.data?.url === 'string' && r.data.url) setSrc(r.data.url)
              else setFailed(true)
            })
            .catch(() => setFailed(true))
        } else {
          setFailed(true)
        }
      }}
      {...imgProps}
    />
  )
}

// ── SlideEditor: edita el contenido de una diapositiva ───────────────────────
export function SlideEditor({ slide, onChange, imagenes = [] }) {
  const upd = (key, val) => onChange({ ...slide, [key]: val })
  const updArr = (key, idx, val) => {
    const arr = [...(slide[key] || [])]
    arr[idx] = val
    onChange({ ...slide, [key]: arr })
  }
  const fld = { fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid #CCC', width: '100%', boxSizing: 'border-box' }
  const ta = { ...fld, resize: 'none' }
  const lbl = { fontSize: 11, color: 'var(--texto-sec)', marginBottom: 4, display: 'block' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 20px', maxHeight: '55vh', overflowY: 'auto' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--azul)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
        Editando slide: {slide.tipo}
      </div>

      {slide.tipo === 'objetivos' && (<>
        <div><label style={lbl}>Título</label>
          <input style={fld} value={slide.titulo || ''} onChange={e => upd('titulo', e.target.value)} /></div>
        <div><label style={lbl}>Objetivos (uno por campo)</label>
          {(slide.lista || []).map((obj, k) => (
            <input key={k} style={{ ...fld, marginBottom: 4 }} value={obj} onChange={e => updArr('lista', k, e.target.value)} />
          ))}</div>
      </>)}

      {slide.tipo === 'desempeno' && (<>
        <div><label style={lbl}>Título</label>
          <input style={fld} value={slide.titulo || ''} onChange={e => upd('titulo', e.target.value)} /></div>
        <div><label style={lbl}>Descripción del objetivo</label>
          <textarea style={ta} rows={4} value={slide.descripcion || ''} onChange={e => upd('descripcion', e.target.value)} /></div>
      </>)}

      {slide.tipo === 'introduccion' && (<>
        <div><label style={lbl}>Título</label>
          <input style={fld} value={slide.titulo || ''} onChange={e => upd('titulo', e.target.value)} /></div>
        <div><label style={lbl}>Texto introductorio</label>
          <textarea style={ta} rows={5} value={slide.texto || ''} onChange={e => upd('texto', e.target.value)} /></div>
      </>)}

      {slide.tipo === 'seccion' && (<>
        <div><label style={lbl}>Título</label>
          <input style={fld} value={slide.titulo || ''} onChange={e => upd('titulo', e.target.value)} /></div>
        <div><label style={lbl}>Texto explicativo</label>
          <textarea style={ta} rows={4} value={slide.texto || ''} onChange={e => upd('texto', e.target.value)} /></div>
        <div><label style={lbl}>Puntos prácticos (uno por campo)</label>
          {(slide.puntos || []).map((p, k) => (
            <input key={k} style={{ ...fld, marginBottom: 4 }} value={p} onChange={e => updArr('puntos', k, e.target.value)} />
          ))}</div>
      </>)}

      {slide.tipo === 'caso_practico' && (<>
        <div><label style={lbl}>Título</label>
          <input style={fld} value={slide.titulo || ''} onChange={e => upd('titulo', e.target.value)} /></div>
        <div><label style={lbl}>Descripción de la situación</label>
          <textarea style={ta} rows={3} value={slide.descripcion || ''} onChange={e => upd('descripcion', e.target.value)} /></div>
        <div><label style={lbl}>Pasos para actuar (uno por campo)</label>
          {(slide.pasos || []).map((p, k) => (
            <input key={k} style={{ ...fld, marginBottom: 4 }} value={p} onChange={e => updArr('pasos', k, e.target.value)} />
          ))}</div>
      </>)}

      {slide.tipo === 'puntos_clave' && (<>
        <div><label style={lbl}>Título</label>
          <input style={fld} value={slide.titulo || ''} onChange={e => upd('titulo', e.target.value)} /></div>
        <div><label style={lbl}>Puntos claves (uno por campo)</label>
          {(slide.puntos || []).map((p, k) => (
            <input key={k} style={{ ...fld, marginBottom: 4 }} value={p} onChange={e => updArr('puntos', k, e.target.value)} />
          ))}</div>
      </>)}

      {slide.tipo === 'importante' && (<>
        <div><label style={lbl}>Título</label>
          <input style={fld} value={slide.titulo || ''} onChange={e => upd('titulo', e.target.value)} /></div>
        <div><label style={lbl}>Cosas importantes (una por campo)</label>
          {(slide.puntos || []).map((p, k) => (
            <input key={k} style={{ ...fld, marginBottom: 4 }} value={p} onChange={e => updArr('puntos', k, e.target.value)} />
          ))}</div>
      </>)}

      {slide.tipo === 'conclusion' && (<>
        <div><label style={lbl}>Título</label>
          <input style={fld} value={slide.titulo || ''} onChange={e => upd('titulo', e.target.value)} /></div>
        <div><label style={lbl}>Texto de cierre</label>
          <textarea style={ta} rows={4} value={slide.texto || ''} onChange={e => upd('texto', e.target.value)} /></div>
        <div><label style={lbl}>Mensaje motivacional</label>
          <input style={fld} value={slide.mensaje || ''} onChange={e => upd('mensaje', e.target.value)} /></div>
      </>)}

      {!['objetivos', 'desempeno', 'introduccion', 'seccion', 'caso_practico', 'puntos_clave', 'importante', 'conclusion'].includes(slide.tipo) && (
        <div style={{ fontSize: 12, color: 'var(--texto-muted)', textAlign: 'center', padding: '2rem 0' }}>
          El tipo "{slide.tipo}" no tiene campos editables en esta vista.
        </div>
      )}

      {/* ── Selector de imagen del protocolo ── */}
      {imagenes.length > 0 && (
        <div style={{ marginTop: 8, borderTop: '1px solid #EEE', paddingTop: 10 }}>
          <label style={lbl}>Imagen del protocolo (opcional)</label>
          {slide.imagen && (
            <div style={{ marginBottom: 8, position: 'relative', display: 'inline-block' }}>
              <SignedImage src={slide.imagen} alt="seleccionada" style={{ height: 80, borderRadius: 6, border: '2px solid var(--azul)', objectFit: 'cover' }} />
              <button onClick={() => upd('imagen', null)} style={{
                position: 'absolute', top: -6, right: -6, width: 18, height: 18,
                borderRadius: '50%', background: 'var(--rojo)', color: '#fff', border: 'none',
                fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}><Icon icon="lucide:x" width={18} /></button>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
            {imagenes.map((url, k) => (
              <SignedImage key={k} src={url} alt={`pág ${k + 1}`}
                onClick={() => upd('imagen', url)}
                style={{
                  width: '100%', height: 60, objectFit: 'cover', borderRadius: 5, cursor: 'pointer',
                  border: slide.imagen === url ? '2px solid var(--azul)' : '1.5px solid #DDD',
                  opacity: slide.imagen === url ? 1 : 0.8
                }} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Slide: renderiza cada tipo de diapositiva ─────────────────────────────────
export function Slide({ slide, total, actual }) {
  if (!slide || typeof slide !== 'object') return null

  // Paleta institucional ONG
  const paletas = {
    objetivos:    { bg: '#191B0E', color: '#EFEDE3', accent: '#F26B43' },
    desempeno:    { bg: '#EFEDE3', color: '#191B0E', accent: '#F26B43' },
    introduccion: { bg: '#fff',    color: '#191B0E', accent: '#897B61' },
    seccion:      { bg: '#fff',    color: '#191B0E', accent: 'var(--azul-oscuro)' },
    caso_practico:{ bg: '#EFEDE3', color: '#191B0E', accent: '#8DAB8E' },
    puntos_clave: { bg: '#EFEDE3', color: '#191B0E', accent: '#8DAB8E' },
    importante:   { bg: '#191B0E', color: '#EFEDE3', accent: '#E6C069' },
    conclusion:   { bg: '#F26B43', color: '#fff',    accent: 'rgba(255,255,255,0.2)' },
  }
  const p = paletas[slide.tipo] || { bg: '#EFEDE3', color: '#191B0E', accent: '#F26B43' }

  return (
    <div style={{
      background: p.bg, borderRadius: 12, padding: '36px 40px',
      minHeight: 340, display: 'flex', flexDirection: 'column', justifyContent: 'center',
      position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: '50%', background: p.accent, opacity: 0.25, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: -30, bottom: -30, width: 120, height: 120, borderRadius: '50%', background: p.accent, opacity: 0.2, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 14, right: 18, fontSize: 11, color: p.color, opacity: 0.45 }}>{actual + 1} / {total}</div>

      {/* ── OBJETIVOS DE APRENDIZAJE ── */}
      {slide.tipo === 'objetivos' && (
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Módulo</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: p.color, marginBottom: 20 }}>{slide.titulo}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {slide.lista?.map((obj, k) => (
              <div key={k} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: p.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{k + 1}</div>
                <div style={{ fontSize: 13, color: p.color, lineHeight: 1.5, paddingTop: 4 }}>{obj}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── OBJETIVO DE DESEMPEÑO ── */}
      {slide.tipo === 'desempeno' && (
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Objetivo de desempeño</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: p.color, marginBottom: 20 }}>{slide.titulo}</div>
          <div style={{ fontSize: 15, color: p.color, lineHeight: 1.8, borderLeft: `4px solid ${p.accent}`, paddingLeft: 16, fontStyle: 'italic' }}>
            {slide.descripcion}
          </div>
        </div>
      )}

      {/* ── INTRODUCCIÓN ── */}
      {slide.tipo === 'introduccion' && (
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Introducción</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: p.color, marginBottom: 16 }}>{slide.titulo}</div>
          <div style={{ fontSize: 14, color: '#444', lineHeight: 1.8 }}>{slide.texto}</div>
        </div>
      )}

      {/* ── PUNTOS CLAVES DEL PROTOCOLO ── */}
      {slide.tipo === 'puntos_clave' && (
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Puntos claves del protocolo</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: p.color, marginBottom: 16 }}>{slide.titulo}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {slide.puntos?.map((punto, k) => (
              <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.accent, flexShrink: 0, marginTop: 5 }} />
                <div style={{ fontSize: 13, color: p.color, lineHeight: 1.5 }}>{punto}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── COSAS IMPORTANTES ── */}
      {slide.tipo === 'importante' && (
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Cosas importantes</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: p.color, marginBottom: 18 }}>{slide.titulo}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {slide.puntos?.map((punto, k) => (
              <div key={k} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: p.accent, color: '#191B0E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>!</div>
                <div style={{ fontSize: 14, color: p.color, lineHeight: 1.5, paddingTop: 4 }}>{punto}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SECCIÓN DE CONTENIDO ── */}
      {slide.tipo === 'seccion' && (
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Contenido</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: p.color, marginBottom: 14 }}>{slide.titulo}</div>
          <div style={{ fontSize: 13, color: '#444', lineHeight: 1.8, marginBottom: 16, borderLeft: `4px solid ${p.accent}`, paddingLeft: 14 }}>{slide.texto}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {slide.puntos?.map((punto, k) => (
              <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.accent, flexShrink: 0, marginTop: 5 }} />
                <div style={{ fontSize: 13, color: p.color, lineHeight: 1.5 }}>{punto}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── CASO PRÁCTICO ── */}
      {slide.tipo === 'caso_practico' && (
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Caso práctico</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: p.color, marginBottom: 12 }}>{slide.titulo}</div>
          <div style={{ fontSize: 13, color: p.color, lineHeight: 1.6, background: 'rgba(141,171,142,0.12)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>{slide.descripcion}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: p.accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>¿Cómo actuar?</div>
          {slide.pasos?.map((paso, k) => (
            <div key={k} style={{ display: 'flex', gap: 10, fontSize: 13, color: p.color, marginBottom: 6 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: p.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{k + 1}</div>
              {paso}
            </div>
          ))}
        </div>
      )}

      {/* ── IMAGEN DEL PROTOCOLO (en cualquier slide) ── */}
      {slide.imagen && (
        <div style={{ marginTop: 16, borderRadius: 8, overflow: 'hidden', maxHeight: 180, display: 'flex', justifyContent: 'center' }}>
          <SignedImage src={slide.imagen} alt="Imagen del protocolo" style={{ maxHeight: 180, maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }} />
        </div>
      )}

      {/* ── CONCLUSIÓN ── */}
      {slide.tipo === 'conclusion' && (
        <div style={{ textAlign: 'center', position: 'relative' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>Conclusión</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 20 }}>{slide.titulo}</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', lineHeight: 1.8, maxWidth: 480, margin: '0 auto 24px' }}>{slide.texto}</div>
          {slide.mensaje && (
            <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 20px', fontSize: 13, color: '#fff', fontStyle: 'italic' }}>
              "{slide.mensaje}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}
