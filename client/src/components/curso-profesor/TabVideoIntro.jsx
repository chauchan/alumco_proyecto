import { Icon } from '@iconify/react'

export default function TabVideoIntro({ videoIntroUrl, subiendoVideo, eliminandoVideo, onSubir, onEliminar }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:13, color:'var(--texto-sec)' }}>
        El video introductorio se muestra al colaborador <strong>antes</strong> de que pueda acceder a los módulos del curso.
        Acepta archivos MP4 o WebM (máx. 500 MB).
      </div>

      {videoIntroUrl ? (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <video controls style={{ width:'100%', borderRadius:10, background:'#000', maxHeight:320 }}>
            <source src={videoIntroUrl} type="video/mp4" />
            <source src={videoIntroUrl} type="video/webm" />
          </video>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <label style={{ background:'var(--azul)', color:'#fff', borderRadius:8, padding:'8px 16px', fontSize:12, cursor:'pointer', fontWeight:500 }}>
              {subiendoVideo ? 'Subiendo...' : <><Icon icon="lucide:upload" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Reemplazar video</>}
              <input type="file" accept="video/mp4,video/webm" style={{ display:'none' }} onChange={onSubir} disabled={subiendoVideo} />
            </label>
            <button onClick={onEliminar} disabled={eliminandoVideo}
              style={{ background:'none', color:'var(--danger)', border:'1px solid var(--danger)', borderRadius:8, padding:'8px 16px', fontSize:12, cursor:'pointer', fontWeight:500 }}>
              {eliminandoVideo ? 'Eliminando...' : <><Icon icon="lucide:x" width={13} style={{verticalAlign:'middle',marginRight:3}} /> Quitar video</>}
            </button>
          </div>
        </div>
      ) : (
        <label style={{
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          border:'2px dashed #D0D5DD', borderRadius:12, padding:'40px 24px', cursor:'pointer',
          background: subiendoVideo ? '#F9FAFB' : '#FAFAFA', gap:10
        }}>
          <Icon icon="lucide:video" width={36} style={{marginBottom:8,display:"block",color:"var(--texto-muted)"}} />
          <div style={{ fontSize:13, fontWeight:500, color:'#444' }}>
            {subiendoVideo ? 'Subiendo video...' : 'Arrastra o haz click para subir un video'}
          </div>
          <div style={{ fontSize:11, color:'var(--texto-muted)' }}>MP4 o WebM · máx. 500 MB</div>
          <input type="file" accept="video/mp4,video/webm" style={{ display:'none' }} onChange={onSubir} disabled={subiendoVideo} />
        </label>
      )}
    </div>
  )
}
