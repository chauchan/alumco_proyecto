import { Icon } from '@iconify/react'

// Edición del borrador generado por IA antes de enviarlo al profesor: nombre,
// descripción, título/descripción de cada módulo y sus preguntas de
// evaluación (texto + alternativa correcta). borradorEdit es una copia local
// del resultado; guardarEdicion (en el padre) es quien persiste en la BD.
export default function EditorBorradorCurso({ borradorEdit, onChange, onGuardar, guardando, onCancelar }) {
  return (
    <div style={{ border: '1.5px solid var(--azul)', borderRadius: 10, padding: 14, marginBottom: 12, background: '#F7F9FF' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--azul-oscuro)', marginBottom: 10 }}>Editando borrador</div>
      <div className="field" style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11 }}>Nombre del curso</label>
        <input type="text" value={borradorEdit.nombre}
          onChange={e => onChange(prev => ({ ...prev, nombre: e.target.value }))}
          style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid #CCC', width: '100%' }} />
      </div>
      <div className="field" style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11 }}>Descripción general del curso</label>
        <textarea rows={3} value={borradorEdit.descripcion || ''}
          onChange={e => onChange(prev => ({ ...prev, descripcion: e.target.value }))}
          style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid #CCC', width: '100%', resize: 'none', color: 'var(--texto-sec)' }} />
      </div>
      {borradorEdit.modulos?.map((mod, i) => (
        <div key={i} style={{ marginBottom: 8, background: '#fff', borderRadius: 8, padding: '10px 12px', border: '0.5px solid var(--gris-borde)' }}>
          <div style={{ fontSize: 10, color: 'var(--texto-muted)', marginBottom: 4 }}>Módulo {i + 1}</div>
          <input type="text" value={mod.titulo}
            onChange={e => onChange(prev => {
              const mods = [...prev.modulos]; mods[i] = { ...mods[i], titulo: e.target.value }; return { ...prev, modulos: mods }
            })}
            style={{ fontSize: 12, fontWeight: 500, padding: '5px 8px', borderRadius: 6, border: '1px solid #CCC', width: '100%', marginBottom: 6 }} />
          <textarea value={mod.descripcion} rows={2}
            onChange={e => onChange(prev => {
              const mods = [...prev.modulos]; mods[i] = { ...mods[i], descripcion: e.target.value }; return { ...prev, modulos: mods }
            })}
            style={{ fontSize: 11, padding: '5px 8px', borderRadius: 6, border: '1px solid #CCC', width: '100%', resize: 'none', color: 'var(--texto-sec)' }} />
          {mod.preguntas?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--azul-oscuro)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Preguntas de evaluación
              </div>
              {mod.preguntas.map((preg, j) => (
                <div key={j} style={{ marginBottom: 8, background: '#F0F4FF', borderRadius: 7, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, color: 'var(--texto-muted)', marginBottom: 4 }}>Pregunta {j + 1}</div>
                  <textarea rows={2} value={preg.texto}
                    onChange={e => onChange(prev => {
                      const mods = [...prev.modulos]
                      const pregs = [...(mods[i].preguntas || [])]
                      pregs[j] = { ...pregs[j], texto: e.target.value }
                      mods[i] = { ...mods[i], preguntas: pregs }
                      return { ...prev, modulos: mods }
                    })}
                    style={{ fontSize: 11, padding: '5px 8px', borderRadius: 6, border: '1px solid #CCC', width: '100%', resize: 'none', marginBottom: 6 }} />
                  <div style={{ fontSize: 10, color: 'var(--texto-muted)', marginBottom: 4 }}>Alternativas (● = correcta)</div>
                  {preg.alternativas?.map((alt, k) => (
                    <div key={k} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                      <input type="radio" name={`correcta-${i}-${j}`} checked={!!alt.correcta}
                        onChange={() => onChange(prev => {
                          const mods = [...prev.modulos]
                          const pregs = [...(mods[i].preguntas || [])]
                          const alts = pregs[j].alternativas.map((a, ki) => ({ ...a, correcta: ki === k }))
                          pregs[j] = { ...pregs[j], alternativas: alts }
                          mods[i] = { ...mods[i], preguntas: pregs }
                          return { ...prev, modulos: mods }
                        })} />
                      <input type="text" value={alt.texto}
                        onChange={e => onChange(prev => {
                          const mods = [...prev.modulos]
                          const pregs = [...(mods[i].preguntas || [])]
                          const alts = [...pregs[j].alternativas]
                          alts[k] = { ...alts[k], texto: e.target.value }
                          pregs[j] = { ...pregs[j], alternativas: alts }
                          mods[i] = { ...mods[i], preguntas: pregs }
                          return { ...prev, modulos: mods }
                        })}
                        style={{ flex: 1, fontSize: 11, padding: '4px 8px', borderRadius: 5, border: '1px solid #CCC' }} />
                      {alt.correcta && <span style={{ fontSize: 10, color: 'var(--success)', fontWeight: 700, display:'flex', alignItems:'center' }}><Icon icon="lucide:check" width={10} /></span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button onClick={onGuardar} disabled={guardando}
          style={{ flex: 1, height: 36, background: 'var(--azul-oscuro)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>
        <button onClick={onCancelar}
          style={{ height: 36, padding: '0 16px', background: 'none', color: 'var(--texto-muted)', border: '0.5px solid var(--gris-borde)', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
