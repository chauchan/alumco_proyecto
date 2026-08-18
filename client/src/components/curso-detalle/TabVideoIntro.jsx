import { Icon } from '@iconify/react'

export default function TabVideoIntro({ videoIntroUrl, videoVisto, onVideoEnded, onComenzarModulos, videoRef }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 13, color: 'var(--cd-text-sec)', fontWeight: 500 }}>
        Mira el video introductorio antes de comenzar los módulos.
      </div>
      <video
        key={videoIntroUrl}
        ref={videoRef}
        controls
        style={{ width: '100%', borderRadius: 12, background: '#000', maxHeight: 480 }}
        onEnded={onVideoEnded}
      >
        {videoIntroUrl && <source src={videoIntroUrl} type="video/mp4" />}
        {videoIntroUrl && <source src={videoIntroUrl} type="video/webm" />}
      </video>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--cd-text-muted)' }}>
          {videoVisto
            ? <><Icon icon="lucide:check" width={13} style={{verticalAlign:'middle',marginRight:3,color:'var(--success)'}} /> Video completado</>
            : 'El video debe terminar para continuar.'}
        </span>
        <button
          onClick={onComenzarModulos}
          disabled={!videoVisto}
          style={{
            background: videoVisto ? 'var(--azul)' : '#ccc', color: '#fff', border: 'none',
            borderRadius: 10, padding: '10px 24px', fontSize: 13, fontWeight: 600,
            cursor: videoVisto ? 'pointer' : 'not-allowed'
          }}>
          <>Comenzar módulos <Icon icon="lucide:arrow-right" width={13} style={{verticalAlign:'middle',marginLeft:4}} /></>
        </button>
      </div>
    </div>
  )
}
