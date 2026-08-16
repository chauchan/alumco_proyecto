import { Icon } from '@iconify/react'
import { Link } from 'react-router-dom'

// Formulario "Subir protocolo" de GeneradorIA: elegir PDF (subido o de la
// biblioteca) + datos del curso a generar. Todo el estado vive en el padre.
export default function FormularioProtocolo({
  form, onChangeForm, fuentePDF, onChangeFuentePDF,
  archivo, onChangeArchivo, protocolos, protocoloSeleccionado, onSelectProtocolo,
  profesores, error, cargando, onSubmit,
}) {
  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 16 }}>Subir protocolo</div>
      <form onSubmit={onSubmit} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); e.currentTarget.requestSubmit() } }}>
        {/* Toggle fuente PDF */}
        <div style={{ display: 'flex', background: '#F0F2F5', borderRadius: 8, padding: 3, gap: 2, marginBottom: 14 }}>
          {[['subir', <><Icon icon="lucide:upload" width={12} style={{verticalAlign:'middle',marginRight:3}} /> Subir PDF</>],['biblioteca', <><Icon icon="lucide:folder-open" width={12} style={{verticalAlign:'middle',marginRight:3}} /> Desde biblioteca</>]].map(([val, lbl]) => (
            <button key={val} type="button" onClick={() => onChangeFuentePDF(val)} style={{
              flex: 1, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: fuentePDF === val ? 600 : 400,
              background: fuentePDF === val ? '#fff' : 'transparent',
              color: fuentePDF === val ? 'var(--azul-oscuro)' : 'var(--texto-muted)',
              boxShadow: fuentePDF === val ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}>{lbl}</button>
          ))}
        </div>

        {fuentePDF === 'subir' ? (
          <div className="upload-zone" style={{ marginBottom: 16 }} onClick={() => document.getElementById('input-pdf').click()}>
            <input id="input-pdf" type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => onChangeArchivo(e.target.files[0])} />
            {archivo ? (
              <><Icon icon="lucide:check" width={20} style={{margin:"0 auto 4px",display:"block",color:"var(--success)"}} />
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--success)' }}>{archivo.name}</div>
                <span className="format-tag tag-pdf" style={{ marginTop: 6, display: 'inline-block' }}>PDF</span></>
            ) : (
              <><div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Arrastra o selecciona un PDF</div>
                <div style={{ fontSize: 11, color: 'var(--texto-muted)' }}>Protocolo institucional en formato PDF</div></>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            {protocolos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', background: 'var(--gris-fondo)', borderRadius: 8, fontSize: 12, color: 'var(--texto-muted)' }}>
                No hay protocolos guardados. <Link to="/protocolos" style={{ color: 'var(--azul-oscuro)' }}>Ir a la biblioteca <Icon icon="lucide:arrow-right" width={12} style={{verticalAlign:"middle",marginLeft:3}} /></Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                {protocolos.map(p => (
                  <div key={p.id} onClick={() => onSelectProtocolo(p)} style={{
                    padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                    border: `1.5px solid ${protocoloSeleccionado?.id === p.id ? 'var(--azul-oscuro)' : 'var(--gris-borde)'}`,
                    background: protocoloSeleccionado?.id === p.id ? '#F0F4FF' : '#fff',
                    display: 'flex', alignItems: 'center', gap: 10
                  }}>
                    <Icon icon="lucide:file-text" width={16} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#222' }}>{p.nombre}</div>
                      {p.descripcion && <div style={{ fontSize: 10, color: 'var(--texto-muted)' }}>{p.descripcion}</div>}
                    </div>
                    {protocoloSeleccionado?.id === p.id && <Icon icon="lucide:check" color="var(--azul-oscuro)" width={14} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="field">
          <label>Nombre del curso *</label>
          <input type="text" placeholder="Ej: Alimentación del adulto mayor en cama"
            value={form.nombre_curso} onChange={e => onChangeForm({ ...form, nombre_curso: e.target.value })} />
        </div>
        <div className="field">
          <label>Área</label>
          <select value={form.area} onChange={e => onChangeForm({ ...form, area: e.target.value })}>
            <option value="">Seleccionar área</option>
            <option>Cuidado clínico</option>
            <option>Alimentación</option>
            <option>Seguridad y emergencias</option>
            <option>Higiene y cuidado personal</option>
            <option>Movilización y posicionamiento</option>
          </select>
        </div>
        <div className="field">
          <label>Profesor responsable</label>
          <select value={form.profesor_id} onChange={e => onChangeForm({ ...form, profesor_id: e.target.value })}>
            <option value="">Asignar automáticamente</option>
            {profesores.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}{p.sede_nombre ? ` — ${p.sede_nombre}` : ''}</option>
            ))}
          </select>
          {!form.profesor_id && (
            <span style={{ fontSize: 12, color: 'var(--texto-muted)', marginTop: 4, display: 'block' }}>
              Si no eliges, lo asignaremos automáticamente según sede y estamento
            </span>
          )}
        </div>
        <div className="field">
          <label>Número de módulos</label>
          <select value={form.num_modulos} onChange={e => onChangeForm({ ...form, num_modulos: e.target.value })}>
            <option value="">Automático (según el protocolo)</option>
            {[3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} módulos</option>)}
          </select>
        </div>
        <div className="field">
          <label>Contexto adicional (opcional)</label>
          <textarea rows={3} placeholder="Ej: Aplica especialmente para residentes con movilidad reducida..."
            value={form.contexto} onChange={e => onChangeForm({ ...form, contexto: e.target.value })}
            style={{ resize: 'none' }} />
        </div>
        {error && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{error}</p>}
        <button type="submit" disabled={cargando} style={{
          width: '100%', height: 42, background: 'var(--azul-oscuro)', color: '#fff', border: 'none',
          borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
        }}>
          {cargando ? <><Icon icon="lucide:loader-circle" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Generando...</> : <><Icon icon="lucide:sparkles" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Generar curso con IA</>}
        </button>
      </form>
    </div>
  )
}
