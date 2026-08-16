import { Icon } from '@iconify/react'
import { Slide, SlideEditor } from '../PresentacionSlides'

function buildSlidesProfesor(mod, pres) {
  if (Array.isArray(pres?.diapositivas) && pres.diapositivas.length > 0) return pres.diapositivas
  const r = pres?.resumen && typeof pres.resumen === 'object' ? pres.resumen : pres
  if (!r) return []
  const slides = []
  slides.push({ tipo: 'portada', titulo: mod.titulo, subtitulo: r.objetivo || mod.descripcion })
  if (r.puntos_clave?.length)   slides.push({ tipo: 'puntos',    titulo: 'Puntos clave',  items: r.puntos_clave })
  if (r.conceptos_importantes?.length) slides.push({ tipo: 'conceptos', titulo: 'Conceptos',    items: r.conceptos_importantes })
  if (r.procedimientos?.length) slides.push({ tipo: 'procedimientos', titulo: 'Procedimiento', items: r.procedimientos })
  if (r.advertencias?.length)   slides.push({ tipo: 'advertencias',  titulo: 'Puntos críticos', items: r.advertencias })
  if (r.cierre || (r.resumen && typeof r.resumen === 'string'))
    slides.push({ tipo: 'cierre', titulo: 'Resumen', texto: r.cierre || r.resumen })
  return slides
}

export default function TabPresentacionPPT({
  modulos, imagenesProtocolo,
  moduloIdx, onSetModuloIdx, presentaciones, onSetPresentaciones,
  slide, onSetSlide, editando, onSetEditando, editData, onSetEditData, guardando,
  onAbrirModulo, onGuardarEdicion,
}) {
  if (moduloIdx === null) {
    return (
      <>
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:12, color:'var(--texto-muted)' }}>Selecciona un módulo para ver su presentación:</div>
        </div>
        {modulos?.map((mod, i) => {
          const tienePPT = (() => {
            if (presentaciones[i] && presentaciones[i] !== 'error' && presentaciones[i] !== 'cargando') return true
            const cp = mod.contenido_presentacion
            if (!cp) return false
            try {
              const p = typeof cp === 'string' ? JSON.parse(cp) : cp
              const slides = Array.isArray(p) ? p : p?.diapositivas || []
              return slides.length > 0
            } catch { return false }
          })()
          return (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', border:`0.5px solid ${tienePPT ? '#BBF7D0' : 'var(--gris-borde)'}`, borderRadius:8, marginBottom:8, background: tienePPT ? '#F0FDF4' : '#fff' }}>
            <div style={{ width:22, height:22, borderRadius:'50%', background: tienePPT ? 'var(--success)' : 'var(--azul-oscuro)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', flexShrink:0 }}>{tienePPT ? <Icon icon="lucide:check" color="#fff" width={12} /> : i+1}</div>
            <span style={{ fontSize:12, fontWeight:500, flex:1 }}>{mod.titulo}</span>
            <button onClick={() => onAbrirModulo(mod, i)} style={{
              fontSize:11, background:'var(--azul-oscuro)', color:'#fff', border:'none', borderRadius:6, padding:'4px 12px', cursor:'pointer'
            }}>
              {presentaciones[i] === 'cargando' ? <Icon icon="lucide:loader-circle" width={13} /> : tienePPT ? <><Icon icon="lucide:play" width={11} style={{verticalAlign:'middle',marginRight:3}} /> Ver</> : <><Icon icon="lucide:play" width={11} style={{verticalAlign:'middle',marginRight:3}} /> Generar</>}
            </button>
          </div>
        )})}
      </>
    )
  }

  const mod  = modulos[moduloIdx]
  const ppres = presentaciones[moduloIdx]
  const slides = ppres && ppres !== 'cargando' && ppres !== 'error' ? buildSlidesProfesor(mod, ppres) : []

  return (
    <div>
      <button onClick={() => { onSetModuloIdx(null); onSetSlide(0); onSetEditando(false) }}
        style={{ fontSize:11, color:'var(--azul-oscuro)', background:'none', border:'none', cursor:'pointer', marginBottom:12, display:'flex', alignItems:'center', gap:4 }}>
        <><Icon icon="lucide:arrow-left" width={13} style={{verticalAlign:"middle",marginRight:4}} /> Volver a módulos</>
      </button>
      {ppres === 'cargando' && (
        <div style={{ textAlign:'center', padding:'2rem 0', color:'var(--texto-muted)' }}>
          <Icon icon="lucide:loader-circle" width={28} style={{margin:"0 auto 8px",display:"block",color:"var(--texto-muted)"}} />
          <div style={{ fontSize:13 }}>Generando presentación...</div>
        </div>
      )}
      {ppres === 'error' && (
        <div style={{ textAlign:'center', padding:'2rem 0' }}>
          <div style={{ fontSize:13, color:'var(--danger)', marginBottom:10 }}>Error al generar</div>
          <button onClick={() => { onSetPresentaciones(prev => { const n={...prev}; delete n[moduloIdx]; return n }); onAbrirModulo(mod, moduloIdx) }}
            style={{ fontSize:12, background:'var(--azul-oscuro)', color:'#fff', border:'none', borderRadius:6, padding:'6px 14px', cursor:'pointer' }}>
            Reintentar
          </button>
        </div>
      )}
      {slides.length > 0 && (() => {
        const editSlides = editData[moduloIdx] || slides
        const curSlide = editSlides[slide]
        return (
          <>
            {/* Barra de edición */}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginBottom:8 }}>
              {editando ? (
                <>
                  <button onClick={() => onSetEditando(false)}
                    style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'1px solid #CCC', background:'#fff', cursor:'pointer', color:'var(--texto-sec)' }}>
                    Cancelar
                  </button>
                  <button onClick={() => onGuardarEdicion(moduloIdx, mod)} disabled={guardando}
                    style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'none', background:'var(--success)', color:'#fff', cursor:'pointer', fontWeight:500 }}>
                    {guardando ? 'Guardando...' : <><Icon icon="lucide:check" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Guardar</>}
                  </button>
                </>
              ) : (
                <button onClick={() => { onSetEditData(prev => ({ ...prev, [moduloIdx]: JSON.parse(JSON.stringify(slides)) })); onSetEditando(true) }}
                  style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'1px solid var(--azul-oscuro)', background:'#fff', color:'var(--azul-oscuro)', cursor:'pointer' }}>
                  <><Icon icon="lucide:pencil" width={12} style={{verticalAlign:"middle",marginRight:3}} /> Editar slides</>
                </button>
              )}
            </div>

            {/* Barra de progreso */}
            <div style={{ height:3, background:'var(--gris-borde)', marginBottom:0 }}>
              <div style={{ height:3, background:'var(--azul-oscuro)', width:`${((slide+1)/editSlides.length)*100}%`, transition:'width 0.3s' }} />
            </div>

            {/* Slide o Editor */}
            {editando ? (
              <SlideEditor
                slide={curSlide}
                imagenes={imagenesProtocolo || []}
                onChange={updated => {
                  const arr = [...editSlides]
                  arr[slide] = updated
                  onSetEditData(prev => ({ ...prev, [moduloIdx]: arr }))
                }}
              />
            ) : (
              <div style={{ padding:'16px 0' }}>
                <Slide slide={curSlide} total={editSlides.length} actual={slide} />
              </div>
            )}

            {/* Navegación */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <button onClick={() => onSetSlide(Math.max(0, slide-1))} disabled={slide===0}
                style={{ height:34, padding:'0 14px', borderRadius:8, border:'1px solid var(--gris-borde)', background: slide===0?'var(--gris-fondo)':'#fff', color: slide===0?'#CCC':'#333', fontSize:12, cursor: slide===0?'default':'pointer' }}>
                <><Icon icon="lucide:arrow-left" width={13} style={{verticalAlign:"middle",marginRight:4}} /> Anterior</>
              </button>
              <div style={{ display:'flex', gap:5 }}>
                {editSlides.map((_,k) => (
                  <div key={k} onClick={() => onSetSlide(k)} style={{ width: k===slide?18:7, height:7, borderRadius:4, background: k===slide?'var(--azul-oscuro)':'#D0D5E0', cursor:'pointer', transition:'all 0.2s' }} />
                ))}
              </div>
              <button onClick={() => onSetSlide(Math.min(editSlides.length-1, slide+1))} disabled={slide===editSlides.length-1}
                style={{ height:34, padding:'0 14px', borderRadius:8, border:'none', background: slide===editSlides.length-1?'#CCC':'var(--azul-oscuro)', color:'#fff', fontSize:12, cursor: slide===editSlides.length-1?'default':'pointer' }}>
                <>Siguiente <Icon icon="lucide:arrow-right" width={13} style={{verticalAlign:"middle",marginLeft:4}} /></>
              </button>
            </div>
          </>
        )
      })()}
    </div>
  )
}
