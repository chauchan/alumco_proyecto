import { Icon } from '@iconify/react'

const ESTAMENTOS = [
  'Profesional de Atención Directa',
  'Técnico de Atención Directa',
  'Asistente de Trato Directo',
  'Auxiliares de Servicio',
  'Manipuladores de Alimentos',
  'Administración y Apoyo',
  'Directivos',
]

export default function TabAudiencia({ targeting, onChangeTargeting, usuario, guardando, onGuardar }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Sede */}
      <div style={{ border:'0.5px solid var(--gris-borde)', borderRadius:10, padding:'14px 16px' }}>
        <div style={{ fontSize:13, fontWeight:600, color:'#222', marginBottom:6 }}>¿En qué sede se publica?</div>
        <div style={{ fontSize:11, color:'var(--texto-muted)', marginBottom:12 }}>
          Publica en tu sede o en todas las sedes.
        </div>
        {[
          { label: 'Todas las sedes', sub: 'El curso será visible en todas las sedes', value: null },
          { label: `Solo ${usuario?.sede_nombre || 'mi sede'}`, sub: 'El curso será visible únicamente en tu sede', value: usuario?.sede_id },
        ].map(op => {
          const sel = targeting.sede_objetivo === op.value
          return (
            <div key={String(op.value)} onClick={() => onChangeTargeting(t => ({ ...t, sede_objetivo: op.value }))}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8, marginBottom:4, cursor:'pointer',
                border: sel ? '2px solid var(--azul-oscuro)' : '1px solid var(--gris-borde)',
                background: sel ? '#F0F4FF' : '#FAFAFA' }}>
              <div style={{ width:16, height:16, borderRadius:'50%', border: sel ? '2px solid var(--azul-oscuro)' : '1.5px solid #CCC', background: sel ? 'var(--azul-oscuro)' : '#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {sel && <div style={{ width:7, height:7, borderRadius:'50%', background:'#fff' }} />}
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight: sel ? 600 : 400, color:'#222' }}>{op.label}</div>
                <div style={{ fontSize:10, color:'var(--texto-muted)' }}>{op.sub}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Estamentos */}
      <div style={{ border:'0.5px solid var(--gris-borde)', borderRadius:10, padding:'14px 16px' }}>
        <div style={{ fontSize:13, fontWeight:600, color:'#222', marginBottom:6 }}>¿A quién va dirigido?</div>
        <div style={{ fontSize:11, color:'var(--texto-muted)', marginBottom:12 }}>
          Selecciona uno o más estamentos. Si no seleccionas ninguno, el curso será visible para todos.
        </div>

        {/* Opción Todos */}
        <div onClick={() => onChangeTargeting(t => ({ ...t, estamento_objetivo: null }))}
          style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8, marginBottom:8, cursor:'pointer',
            border: targeting.estamento_objetivo === null ? '2px solid var(--azul-oscuro)' : '1px solid var(--gris-borde)',
            background: targeting.estamento_objetivo === null ? '#F0F4FF' : '#FAFAFA' }}>
          <div style={{ width:16, height:16, borderRadius:'50%', border: targeting.estamento_objetivo === null ? '2px solid var(--azul-oscuro)' : '1.5px solid #CCC', background: targeting.estamento_objetivo === null ? 'var(--azul-oscuro)' : '#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            {targeting.estamento_objetivo === null && <div style={{ width:7, height:7, borderRadius:'50%', background:'#fff' }} />}
          </div>
          <div>
            <div style={{ fontSize:12, fontWeight: targeting.estamento_objetivo === null ? 600 : 400, color:'#222' }}>Todos los colaboradores</div>
            <div style={{ fontSize:10, color:'var(--texto-muted)' }}>Curso global — visible para todos los estamentos</div>
          </div>
        </div>

        {/* Estamentos específicos — checkboxes multiselect */}
        <div style={{ fontSize:11, fontWeight:500, color:'var(--texto-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>
          O elige estamentos específicos:
        </div>
        {ESTAMENTOS.map(est => {
          const seleccionado = Array.isArray(targeting.estamento_objetivo) && targeting.estamento_objetivo.includes(est)
          const toggleEst = () => onChangeTargeting(t => {
            const actual = Array.isArray(t.estamento_objetivo) ? t.estamento_objetivo : []
            const siguiente = seleccionado ? actual.filter(e => e !== est) : [...actual, est]
            return { ...t, estamento_objetivo: siguiente.length === 0 ? null : siguiente }
          })
          return (
            <div key={est} onClick={toggleEst}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8, marginBottom:4, cursor:'pointer',
                border: seleccionado ? '2px solid var(--azul-oscuro)' : '1px solid var(--gris-borde)',
                background: seleccionado ? '#F0F4FF' : '#FAFAFA' }}>
              <div style={{ width:16, height:16, borderRadius:4, border: seleccionado ? '2px solid var(--azul-oscuro)' : '1.5px solid #CCC', background: seleccionado ? 'var(--azul-oscuro)' : '#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {seleccionado && <Icon icon="lucide:check" color="white" width={10} />}
              </div>
              <span style={{ fontSize:12, fontWeight: seleccionado ? 600 : 400, color:'#222' }}>{est}</span>
            </div>
          )
        })}
      </div>

      {/* Resumen + Guardar */}
      <div style={{ background:'var(--gris-fondo)', borderRadius:8, padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
        <div style={{ fontSize:12, color:'var(--texto-sec)' }}>
          {targeting.sede_objetivo ? <>Sede: <strong>{usuario?.sede_nombre}</strong> · </> : <>Todas las sedes · </>}
          {Array.isArray(targeting.estamento_objetivo) && targeting.estamento_objetivo.length > 0
            ? <>Obligatorio para: <strong>{targeting.estamento_objetivo.length === 1 ? targeting.estamento_objetivo[0] : `${targeting.estamento_objetivo.length} estamentos`}</strong></>
            : <>Todos los estamentos (opcional)</>}
        </div>
        <button onClick={onGuardar} disabled={guardando}
          style={{ fontSize:12, padding:'6px 16px', borderRadius:7, border:'none', background:'var(--azul-oscuro)', color:'#fff', cursor:'pointer', fontWeight:500, flexShrink:0 }}>
          {guardando ? 'Guardando...' : <><Icon icon="lucide:check" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Guardar configuración</>}
        </button>
      </div>
    </div>
  )
}
