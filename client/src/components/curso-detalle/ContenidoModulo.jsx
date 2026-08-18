import { Icon } from '@iconify/react'
import { Slide } from '../PresentacionSlides'

// Cuerpo de un módulo según su tipo: presentación PPT generada por IA, video,
// PDF, un archivo descargable (Office embebido), o texto simple como fallback.
export default function ContenidoModulo({ mod, slideActual, onSetSlideActual, signedUrl, onMarcarCompleto }) {
  const cp = mod.contenido_presentacion
  const slides = Array.isArray(cp) ? cp
    : Array.isArray(cp?.diapositivas) ? cp.diapositivas
    : []
  const esPPT = slides.length > 0

  // PPT sin slides y sin archivo subido: mostrar spinner mientras se genera con IA
  if (mod.tipo === 'ppt' && !esPPT && !mod.archivo_url) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--cd-text-muted)' }}>
        <Icon icon="lucide:loader" width={32} style={{ marginBottom: 12, display: 'block', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
        <div style={{ fontSize: 14, fontWeight: 500 }}>Generando presentación...</div>
        <div style={{ fontSize: 12, marginTop: 6 }}>Esto puede tomar unos segundos</div>
      </div>
    )
  }
  const esVideo = mod.tipo === 'video' && mod.archivo_url
  const esPDF = mod.tipo === 'pdf' && mod.archivo_url

  if (esPPT) {
    const total = slides.length
    const slide = slides[slideActual] || null
    const esUltimo = slideActual === total - 1
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Slide slide={slide} total={total} actual={slideActual} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => onSetSlideActual(Math.max(0, slideActual - 1))}
            disabled={slideActual === 0}
            style={{ background: 'var(--cd-subtle-bg)', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: slideActual === 0 ? 'not-allowed' : 'pointer', color: slideActual === 0 ? '#ccc' : 'var(--cd-text)' }}>
            <><Icon icon="lucide:arrow-left" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Anterior</>
          </button>
          <span style={{ fontSize: 12, color: 'var(--cd-text-muted)' }}>{slideActual + 1} / {total}</span>
          {esUltimo ? (
            <button onClick={onMarcarCompleto}
              style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <><Icon icon="lucide:check" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Completar módulo</>
            </button>
          ) : (
            <button onClick={() => onSetSlideActual(Math.min(total - 1, slideActual + 1))}
              style={{ background: 'var(--azul)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
              <>Siguiente <Icon icon="lucide:arrow-right" width={13} style={{verticalAlign:'middle',marginLeft:4}} /></>
            </button>
          )}
        </div>
      </div>
    )
  }

  if (esVideo) {
    const videoSrc = signedUrl || ''
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <video
          key={videoSrc}
          controls
          style={{ width: '100%', borderRadius: 10, background: '#000', maxHeight: 480 }}
          onEnded={onMarcarCompleto}
        >
          {videoSrc && <source src={videoSrc} type="video/mp4" />}
          {videoSrc && <source src={videoSrc} type="video/webm" />}
        </video>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--cd-text-muted)' }}>El módulo se marcará como completo al terminar el video.</span>
          <button onClick={onMarcarCompleto}
            style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <><Icon icon="lucide:check" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Marcar como visto</>
          </button>
        </div>
      </div>
    )
  }

  if (esPDF) {
    const pdfSrc = signedUrl || ''
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <iframe
          src={pdfSrc}
          style={{ width: '100%', height: 500, border: 'none', borderRadius: 10 }}
          title={mod.titulo}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onMarcarCompleto}
            style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <><Icon icon="lucide:check" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Marcar como visto</>
          </button>
        </div>
      </div>
    )
  }

  if (mod.archivo_url) {
    const downloadSrc = signedUrl || mod.archivo_url
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <iframe
          key={downloadSrc}
          src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(downloadSrc)}`}
          style={{ width: '100%', height: 520, border: 'none', borderRadius: 10 }}
          title={mod.titulo}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <a href={downloadSrc} download target="_blank" rel="noreferrer"
            style={{ background: 'var(--cd-subtle-bg)', color: 'var(--cd-text)', borderRadius: 8, padding: '8px 14px', fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Icon icon="lucide:download" width={12} /> Descargar PPT
          </a>
          <button onClick={onMarcarCompleto}
            style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <><Icon icon="lucide:check" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Marcar como visto</>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'var(--cd-subtle-bg)', borderRadius: 10, padding: '18px 20px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--cd-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Contenido del módulo</div>
        <div style={{ fontSize: 14, color: 'var(--cd-text)', lineHeight: 1.7 }}>{mod.descripcion || mod.titulo}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onMarcarCompleto}
          style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <><Icon icon="lucide:check" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Marcar como visto</>
        </button>
      </div>
    </div>
  )
}
