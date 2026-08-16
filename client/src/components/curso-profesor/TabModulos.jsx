import { Icon } from '@iconify/react'

export default function TabModulos({ modulos, editando, modulosEdit, onChangeModulosEdit, guardando, onIniciarEdicion, onGuardar, onCancelar }) {
  return (
    <>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10, gap:6 }}>
        {editando ? (
          <>
            <button onClick={onCancelar} style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'1px solid #CCC', background:'#fff', cursor:'pointer', color:'var(--texto-sec)' }}>Cancelar</button>
            <button onClick={onGuardar} disabled={guardando} style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'none', background:'var(--success)', color:'#fff', cursor:'pointer', fontWeight:500 }}>
              {guardando ? 'Guardando...' : <><Icon icon="lucide:check" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Guardar cambios</>}
            </button>
          </>
        ) : (
          <button onClick={onIniciarEdicion}
            style={{ fontSize:11, padding:'4px 12px', borderRadius:6, border:'1px solid var(--azul-oscuro)', background:'#fff', color:'var(--azul-oscuro)', cursor:'pointer' }}>
            <><Icon icon="lucide:pencil" width={12} style={{verticalAlign:"middle",marginRight:3}} /> Editar módulos</>
          </button>
        )}
      </div>
      {(editando ? modulosEdit : modulos)?.map((mod, i) => (
        <div key={i} style={{ border: editando ? '1px solid #C5D3F0' : '0.5px solid var(--gris-borde)', borderRadius:8, padding:'10px 14px', marginBottom:8, background: editando ? '#F7F9FF' : '#fff' }}>
          <div style={{ display:'flex', gap:8, alignItems:'flex-start', marginBottom: editando ? 8 : 4 }}>
            <div style={{ width:20, height:20, borderRadius:'50%', background:'var(--azul-oscuro)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'#fff', flexShrink:0, marginTop:2 }}>{i+1}</div>
            {editando ? (
              <input value={mod.titulo} onChange={e => { const arr=[...modulosEdit]; arr[i]={...arr[i],titulo:e.target.value}; onChangeModulosEdit(arr) }}
                style={{ flex:1, fontSize:12, fontWeight:500, padding:'5px 8px', borderRadius:6, border:'1px solid #CCC', outline:'none' }} />
            ) : (
              <span style={{ fontSize:12, fontWeight:500, flex:1 }}>{mod.titulo}</span>
            )}
          </div>
          {editando ? (
            <textarea value={mod.descripcion || ''} rows={3}
              onChange={e => { const arr=[...modulosEdit]; arr[i]={...arr[i],descripcion:e.target.value}; onChangeModulosEdit(arr) }}
              style={{ width:'100%', fontSize:11, padding:'5px 8px', borderRadius:6, border:'1px solid #CCC', resize:'none', lineHeight:1.5, boxSizing:'border-box', marginLeft:28 }} />
          ) : (
            <div style={{ fontSize:11, color:'var(--texto-muted)', lineHeight:1.5, paddingLeft:28 }}>{mod.descripcion}</div>
          )}
        </div>
      ))}
    </>
  )
}
