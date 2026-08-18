import { Icon } from '@iconify/react'
import MascotaFoye from './MascotaFoye'
import { Slide, SlideEditor, SignedImage } from './PresentacionSlides'

// Modal para ver/editar la presentación PPT de un módulo generado por IA.
// Sin estado propio: todo (qué módulo está abierto, si se está editando, el
// slide actual) vive en el componente que lo usa — este solo pinta según las
// props y dispara los callbacks que le pasan.
export default function ModalPresentacionModulo({
  mod, moduloIndex, totalModulos, pres, activePres, slides,
  modoPPT, onSetModoPPT, editandoPPT, onToggleEditarPPT,
  slideActual, onSetSlideActual, onChangeSlide,
  imagenesProtocolo, onClose, onRetry,
}) {
  if (!mod) return null

  const diaps        = activePres?.diapositivas || []
  const objetivos     = diaps.find(d => d.tipo === 'objetivos')
  const desempeno     = diaps.find(d => d.tipo === 'desempeno')
  const introduccion  = diaps.find(d => d.tipo === 'introduccion')
  const secciones     = diaps.filter(d => d.tipo === 'seccion')
  const caso          = diaps.find(d => d.tipo === 'caso_practico')
  const puntos_clave  = diaps.find(d => d.tipo === 'puntos_clave')
  const importante    = diaps.find(d => d.tipo === 'importante')
  const conclusion    = diaps.find(d => d.tipo === 'conclusion')

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 720,
        boxShadow: '0 12px 48px rgba(0,0,0,0.3)', overflow: 'hidden'
      }} onClick={e => e.stopPropagation()}>

        {/* Cabecera modal */}
        <div style={{ background: 'var(--gris-fondo)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--gris-borde)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#222' }}>{mod.titulo}</div>
            <div style={{ fontSize: 11, color: 'var(--texto-muted)', marginTop: 2 }}>Módulo {moduloIndex + 1} de {totalModulos ?? '?'}</div>
          </div>
          {/* Tabs */}
          {pres && pres !== 'cargando' && pres !== 'error' && (
            <div style={{ display: 'flex', background: 'var(--gris-borde)', borderRadius: 8, padding: 3, gap: 2 }}>
              <button onClick={() => onSetModoPPT(false)} style={{
                fontSize: 11, padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: !modoPPT ? '#fff' : 'transparent',
                color: !modoPPT ? 'var(--azul-oscuro)' : 'var(--texto-muted)',
                fontWeight: !modoPPT ? 600 : 400,
                boxShadow: !modoPPT ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}>Resumen</button>
              <button onClick={() => { onSetModoPPT(true); onSetSlideActual(0) }} style={{
                fontSize: 11, padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: modoPPT ? 'var(--azul-oscuro)' : 'transparent',
                color: modoPPT ? '#fff' : 'var(--texto-muted)',
                fontWeight: modoPPT ? 600 : 400
              , display:'flex', alignItems:'center', gap:4 }}><Icon icon="lucide:play" width={11} /> Presentación</button>
            </div>
          )}
          {modoPPT && pres && pres !== 'cargando' && pres !== 'error' && (
            <button
              onClick={onToggleEditarPPT}
              style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 6,
                border: `1px solid ${editandoPPT ? 'var(--azul)' : '#CCC'}`,
                background: editandoPPT ? 'var(--azul)' : 'transparent',
                color: editandoPPT ? '#fff' : 'var(--texto-sec)',
                cursor: 'pointer', fontWeight: 500
              }}>
              {editandoPPT ? <><Icon icon="lucide:arrow-left" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Vista previa</> : <><Icon icon="lucide:pencil" width={13} style={{verticalAlign:'middle',marginRight:3}} /> Editar slides</>}
            </button>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--texto-muted)', cursor: 'pointer', display:'flex', alignItems:'center' }}><Icon icon="lucide:x" width={18} /></button>
        </div>

        {/* Cuerpo modal */}
        <div style={{ padding: modoPPT ? '0' : '20px 24px' }}>

          {/* Estado cargando */}
          {(!pres || pres === 'cargando') && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '3rem 0' }}>
              <MascotaFoye size={64} estado="activo" animate />
              <div style={{ fontSize: 13, marginTop: 10, color: 'var(--texto-sec)', fontWeight: 500 }}>Generando presentación con IA...</div>
              <div style={{ fontSize: 11, marginTop: 4, color: 'var(--texto-muted)' }}>Puede tomar unos segundos</div>
            </div>
          )}

          {/* Estado error */}
          {pres === 'error' && (
            <div style={{ textAlign: 'center', padding: '3rem 0' }}>
              <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>No se pudo generar la presentación</div>
              <button onClick={onRetry}
                style={{ fontSize: 12, background: 'var(--azul-oscuro)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer' }}>
                Reintentar
              </button>
            </div>
          )}

          {/* ── MODO RESUMEN ── construido desde las diapositivas */}
          {pres && pres !== 'cargando' && pres !== 'error' && !modoPPT && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '60vh', overflowY: 'auto' }}>
              {objetivos?.lista?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#F26B43', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Objetivos de aprendizaje</div>
                  {objetivos.lista.map((obj, k) => (
                    <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#191B0E', marginBottom: 5 }}>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#F26B43', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{k + 1}</span>
                      {obj}
                    </div>
                  ))}
                </div>
              )}
              {desempeno?.descripcion && (
                <div style={{ background: '#EFEDE3', borderRadius: 8, padding: '10px 14px', borderLeft: '4px solid #F26B43' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#F26B43', marginBottom: 4 }}>Objetivo de desempeño</div>
                  <div style={{ fontSize: 12, color: '#191B0E', lineHeight: 1.6, fontStyle: 'italic' }}>{desempeno.descripcion}</div>
                </div>
              )}
              {introduccion?.texto && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#897B61', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Introducción</div>
                  <div style={{ fontSize: 12, color: 'var(--texto-sec)', lineHeight: 1.7 }}>{introduccion.texto}</div>
                </div>
              )}
              {secciones.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--azul-oscuro)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Contenido</div>
                  {secciones.map((sec, k) => (
                    <div key={k} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--azul-oscuro)', marginBottom: 4, display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--azul-oscuro)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, flexShrink: 0 }}>{k+1}</span>
                        {sec.titulo}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--texto-sec)', lineHeight: 1.6, paddingLeft: 24 }}>{sec.texto}</div>
                    </div>
                  ))}
                </div>
              )}
              {caso && (
                <div style={{ background: '#F0F4FF', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--azul-oscuro)', marginBottom: 6 }}>Caso práctico</div>
                  <div style={{ fontSize: 12, color: '#333', lineHeight: 1.6, marginBottom: 8 }}>{caso.descripcion}</div>
                  {caso.pasos?.map((p, k) => (
                    <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#333', marginBottom: 4 }}>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#8DAB8E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{k+1}</span>
                      {p}
                    </div>
                  ))}
                </div>
              )}
              {puntos_clave?.puntos?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#8DAB8E', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Puntos claves del protocolo</div>
                  {puntos_clave.puntos.map((p, k) => (
                    <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#191B0E', marginBottom: 5, alignItems: 'flex-start' }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#8DAB8E', flexShrink: 0, marginTop: 4 }} />
                      {p}
                    </div>
                  ))}
                </div>
              )}
              {importante?.puntos?.length > 0 && (
                <div style={{ background: '#191B0E', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#E6C069', marginBottom: 6 }}>Cosas importantes</div>
                  {importante.puntos.map((p, k) => (
                    <div key={k} style={{ fontSize: 12, color: '#EFEDE3', padding: '2px 0' }}>! {p}</div>
                  ))}
                </div>
              )}
              {conclusion?.texto && (
                <div style={{ background: '#F26B43', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>Conclusión</div>
                  <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.6 }}>{conclusion.texto}</div>
                  {conclusion.mensaje && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 6, fontStyle: 'italic' }}>"{conclusion.mensaje}"</div>}
                </div>
              )}
              {diaps.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--texto-muted)', padding: '2rem 0', fontSize: 13 }}>
                  Sin contenido de resumen disponible
                </div>
              )}
              {/* ── Galería de imágenes del protocolo ── */}
              {imagenesProtocolo?.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#897B61', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    Imágenes del protocolo ({imagenesProtocolo.length})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                    {imagenesProtocolo.map((url, k) => (
                      <SignedImage key={k} src={url} alt={`Imagen ${k + 1}`} style={{
                        width: '100%', borderRadius: 6, border: '0.5px solid var(--gris-borde)',
                        objectFit: 'cover', maxHeight: 120, cursor: 'pointer'
                      }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── MODO PPT ── */}
          {pres && pres !== 'cargando' && pres !== 'error' && modoPPT && slides.length > 0 && (
            <div>
              {/* Barra de progreso */}
              <div style={{ height: 3, background: 'var(--gris-borde)' }}>
                <div style={{ height: 3, background: 'var(--azul-oscuro)', width: `${((slideActual + 1) / slides.length) * 100}%`, transition: 'width 0.3s ease' }} />
              </div>

              {/* Slide */}
              <div style={{ padding: editandoPPT ? '0' : '24px 28px' }}>
                {editandoPPT ? (
                  <SlideEditor
                    slide={slides[slideActual]}
                    imagenes={imagenesProtocolo || []}
                    onChange={onChangeSlide}
                  />
                ) : (
                  <Slide slide={slides[slideActual]} total={slides.length} actual={slideActual} />
                )}
              </div>

              {/* Navegación */}
              <div style={{ padding: '0 28px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  onClick={() => onSetSlideActual(Math.max(0, slideActual - 1))}
                  disabled={slideActual === 0}
                  style={{
                    height: 36, padding: '0 16px', borderRadius: 8, border: '1px solid var(--gris-borde)',
                    background: slideActual === 0 ? 'var(--gris-fondo)' : '#fff', color: slideActual === 0 ? '#CCC' : '#333',
                    fontSize: 12, cursor: slideActual === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6
                  }}>
                  <><Icon icon="lucide:arrow-left" width={13} style={{verticalAlign:"middle",marginRight:4}} /> Anterior</>
                </button>

                {/* Puntos indicadores */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {slides.map((_, k) => (
                    <div key={k} onClick={() => onSetSlideActual(k)} style={{
                      width: k === slideActual ? 20 : 8, height: 8, borderRadius: 4,
                      background: k === slideActual ? 'var(--azul-oscuro)' : '#D0D5E0',
                      cursor: 'pointer', transition: 'all 0.2s'
                    }} />
                  ))}
                </div>

                <button
                  onClick={() => onSetSlideActual(Math.min(slides.length - 1, slideActual + 1))}
                  disabled={slideActual === slides.length - 1}
                  style={{
                    height: 36, padding: '0 16px', borderRadius: 8, border: 'none',
                    background: slideActual === slides.length - 1 ? '#CCC' : 'var(--azul-oscuro)',
                    color: '#fff', fontSize: 12,
                    cursor: slideActual === slides.length - 1 ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6
                  }}>
                  <>Siguiente <Icon icon="lucide:arrow-right" width={13} style={{verticalAlign:"middle",marginLeft:4}} /></>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
