import { Icon } from '@iconify/react'

export default function TabPreguntas({
  preguntas, editando, preguntasEdit, onChangePreguntasEdit, guardando,
  pregExpandida, onTogglePregExpandida,
  onIniciarEdicion, onAgregarPregunta, onEliminarPregunta, onGuardar, onCancelar,
}) {
  return (
    <>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10, gap:6 }}>
        {editando ? (
          <>
            <button onClick={onCancelar} style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'1px solid #CCC', background:'#fff', cursor:'pointer', color:'var(--texto-sec)' }}>Cancelar</button>
            <button onClick={onAgregarPregunta} style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'1px solid var(--azul)', background:'var(--azul-claro)', color:'var(--azul)', cursor:'pointer', fontWeight:500 }}>
              <><Icon icon="lucide:plus" width={12} style={{verticalAlign:'middle',marginRight:3}} /> Agregar pregunta</>
            </button>
            <button onClick={onGuardar} disabled={guardando} style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'none', background:'var(--success)', color:'#fff', cursor:'pointer', fontWeight:500 }}>
              {guardando ? 'Guardando...' : <><Icon icon="lucide:check" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Guardar cambios</>}
            </button>
          </>
        ) : (
          <button onClick={onIniciarEdicion} style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'1px solid var(--azul-oscuro)', background:'#fff', color:'var(--azul-oscuro)', cursor:'pointer' }}>
            <><Icon icon="lucide:pencil" width={12} style={{verticalAlign:"middle",marginRight:3}} /> Editar preguntas</>
          </button>
        )}
      </div>

      {preguntas?.length === 0 && (
        <div style={{ textAlign:'center', color:'var(--texto-muted)', padding:32, fontSize:13 }}>No hay preguntas cargadas</div>
      )}

      {(editando ? preguntasEdit : preguntas)?.map((preg, j) => {
        const alts = typeof preg.alternativas === 'string' ? JSON.parse(preg.alternativas) : preg.alternativas
        return editando ? (
          <div key={j} style={{ border:'1px solid #C5D3F0', borderRadius:8, marginBottom:10, padding:'10px 12px', background:'#F7F9FF' }}>
            <div style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom:8 }}>
              <span style={{ width:18, height:18, borderRadius:'50%', background:'var(--azul-oscuro)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'#fff', flexShrink:0, marginTop:3 }}>{j+1}</span>
              <textarea value={preg.texto} rows={2}
                onChange={e => { const arr=[...preguntasEdit]; arr[j]={...arr[j],texto:e.target.value}; onChangePreguntasEdit(arr) }}
                style={{ flex:1, fontSize:12, padding:'5px 8px', borderRadius:6, border:'1px solid #CCC', resize:'none', lineHeight:1.5, boxSizing:'border-box' }} />
              <button onClick={() => onEliminarPregunta(j, preg.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#CCC', padding:2, flexShrink:0 }} title="Eliminar pregunta">
                <Icon icon="lucide:trash-2" width={14} />
              </button>
            </div>
            <div style={{ paddingLeft:26, display:'flex', flexDirection:'column', gap:6 }}>
              {alts?.map((alt, k) => (
                <div key={k} style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <div onClick={() => {
                    const arr = JSON.parse(JSON.stringify(preguntasEdit))
                    arr[j].alternativas = arr[j].alternativas.map((a, ki) => ({ ...a, correcta: ki === k }))
                    onChangePreguntasEdit(arr)
                  }} style={{ width:16, height:16, borderRadius:'50%', border: alt.correcta ? '2px solid var(--success)' : '1.5px solid #CCC', background: alt.correcta ? '#E8F5ED' : '#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
                    {alt.correcta && <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--success)' }} />}
                  </div>
                  <input value={alt.texto} onChange={e => {
                    const arr = JSON.parse(JSON.stringify(preguntasEdit))
                    arr[j].alternativas[k].texto = e.target.value
                    onChangePreguntasEdit(arr)
                  }} style={{ flex:1, fontSize:11, padding:'4px 7px', borderRadius:5, border:'1px solid #CCC', color: alt.correcta ? 'var(--success)' : '#333' }} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div key={j} style={{ border:'0.5px solid #EEE', borderRadius:8, marginBottom:8, overflow:'hidden' }}>
            <div style={{ display:'flex', gap:8, padding:'9px 12px', cursor:'pointer', background: pregExpandida === j ? '#F7F8FF' : '#FAFAFA' }}
              onClick={() => onTogglePregExpandida(j)}>
              <span style={{ width:18, height:18, borderRadius:'50%', background:'var(--gris-borde)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'#666', flexShrink:0 }}>{j+1}</span>
              <span style={{ fontSize:12, color:'#333', flex:1 }}>{preg.texto}</span>
              <span style={{ fontSize:10, color:'var(--texto-muted)' }}>{pregExpandida === j ? '▲' : '▼'}</span>
            </div>
            {pregExpandida === j && (
              <div style={{ padding:'8px 12px 10px 38px', background:'#F7F8FF', borderTop:'0.5px solid #EEE' }}>
                {alts?.map((alt, k) => (
                  <div key={k} style={{ display:'flex', gap:7, fontSize:12, padding:'4px 0', color: alt.correcta ? 'var(--success)' : 'var(--texto-sec)' }}>
                    <span style={{ width:16, height:16, borderRadius:'50%', border: alt.correcta ? '2px solid var(--success)' : '1.5px solid #CCC', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, flexShrink:0, background: alt.correcta ? '#E8F5ED' : 'transparent' }}>
                      {alt.correcta ? <Icon icon="lucide:check" color="var(--success)" width={9} /> : null}
                    </span>
                    {alt.texto}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
