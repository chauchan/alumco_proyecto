import { useState, useEffect, useRef } from 'react'
import { Icon } from '@iconify/react'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import api from '../services/api'

export default function Protocolos() {
  const [protocolos, setProtocolos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [editando, setEditando] = useState(null)      // { id, nombre, descripcion }
  const [form, setForm] = useState({ nombre: '', descripcion: '' })
  const [archivo, setArchivo] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef()

  const cargar = () => {
    setCargando(true)
    api.get('/protocolos').then(r => setProtocolos(r.data)).catch(() => {}).finally(() => setCargando(false))
  }

  useEffect(() => { cargar() }, [])

  const subir = async (e) => {
    e.preventDefault()
    if (!archivo || !form.nombre) return setError('El nombre y el PDF son obligatorios')
    setSubiendo(true); setError('')
    try {
      const data = new FormData()
      data.append('protocolo', archivo)
      data.append('nombre', form.nombre)
      data.append('descripcion', form.descripcion)
      await api.post('/protocolos', data, { headers: { 'Content-Type': 'multipart/form-data' } })
      setForm({ nombre: '', descripcion: '' }); setArchivo(null); setMostrarForm(false)
      cargar()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al subir')
    } finally { setSubiendo(false) }
  }

  const guardarEdicion = async () => {
    try {
      await api.put(`/protocolos/${editando.id}`, { nombre: editando.nombre, descripcion: editando.descripcion })
      setEditando(null); cargar()
    } catch { alert('Error al guardar') }
  }

  const eliminar = async (id, nombre) => {
    if (!confirm(`¿Eliminar el protocolo "${nombre}"? Esta acción no se puede deshacer.`)) return
    try { await api.delete(`/protocolos/${id}`); cargar() }
    catch { alert('Error al eliminar') }
  }

  return (
    <div className="app-shell">
      <Topbar seccion="Panel de jefatura — Biblioteca de protocolos" />
      <div className="app-body">
        <Sidebar />
        <main className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="page-title">Biblioteca de protocolos</div>
              <div className="page-sub">Protocolos institucionales guardados para generar cursos con IA</div>
            </div>
            <button className="btn-primary" onClick={() => setMostrarForm(v => !v)}>
              {mostrarForm ? 'Cancelar' : '+ Subir protocolo'}
            </button>
          </div>

          {/* Formulario subir */}
          {mostrarForm && (
            <div className="card" style={{ border: '1.5px solid #1E3A6E' }}>
              <div className="card-title" style={{ marginBottom: 14 }}>Nuevo protocolo</div>
              <form onSubmit={subir}>
                <div className="field">
                  <label>Nombre del protocolo *</label>
                  <input type="text" placeholder="Ej: Protocolo prevención LPP"
                    value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                </div>
                <div className="field">
                  <label>Descripción (opcional)</label>
                  <textarea rows={2} placeholder="Breve descripción del protocolo..."
                    value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                    style={{ resize: 'none' }} />
                </div>
                <div className="upload-zone" style={{ marginBottom: 12 }} onClick={() => inputRef.current?.click()}>
                  <input ref={inputRef} type="file" accept=".pdf" style={{ display: 'none' }}
                    onChange={e => setArchivo(e.target.files[0])} />
                  {archivo ? (
                    <><Icon icon="lucide:check" width={24} style={{margin:"0 auto 4px",display:"block",color:"#1A7A45"}} />
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#1A7A45' }}>{archivo.name}</div></>
                  ) : (
                    <><div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Arrastra o selecciona el PDF</div>
                      <div style={{ fontSize: 11, color: '#888' }}>Máximo 20 MB</div></>
                  )}
                </div>
                {error && <p style={{ color: '#E8505B', fontSize: 12, marginBottom: 8 }}>{error}</p>}
                <button type="submit" disabled={subiendo} className="btn-primary" style={{ width: '100%', height: 40 }}>
                  {subiendo ? 'Subiendo...' : <><Icon icon="lucide:folder-open" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Guardar protocolo</>}
                </button>
              </form>
            </div>
          )}

          {/* Lista de protocolos */}
          {cargando ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#888' }}>
              <Icon icon="lucide:loader-circle" width={28} style={{margin:"0 auto 10px",display:"block",color:"#888"}} />
              <div style={{ fontSize: 13 }}>Cargando protocolos...</div>
            </div>
          ) : protocolos.length === 0 ? (
            <div style={{ display: 'flex',flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '4rem 0', color: '#CCC' }}>
              <Icon icon="lucide:folder-open" width={40} style={{marginBottom:12,display:"block",color:"#CCC"}} />
              <div style={{ fontSize: 14, fontWeight: 500, color: '#AAA' }}>No hay protocolos guardados</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Sube el primer protocolo con el botón de arriba</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {protocolos.map(p => (
                <div key={p.id} className="card" style={{ padding: '12px 16px' }}>
                  {editando?.id === p.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input value={editando.nombre} onChange={e => setEditando({ ...editando, nombre: e.target.value })}
                        style={{ fontSize: 13, fontWeight: 500, padding: '6px 10px', borderRadius: 6, border: '1px solid #1E3A6E', width: '100%' }} />
                      <textarea value={editando.descripcion || ''} rows={2}
                        onChange={e => setEditando({ ...editando, descripcion: e.target.value })}
                        style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, border: '1px solid #CCC', width: '100%', resize: 'none' }}
                        placeholder="Descripción (opcional)" />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={guardarEdicion}
                          style={{ flex: 1, height: 34, background: '#1E3A6E', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                          Guardar
                        </button>
                        <button onClick={() => setEditando(null)}
                          style={{ height: 34, padding: '0 14px', background: 'none', border: '0.5px solid #E8E8E8', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#888' }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#F0F4FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon icon="lucide:file-text" width={18} style={{color:'#2B4BA0'}} /></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#222', marginBottom: 2 }}>{p.nombre}</div>
                        {p.descripcion && <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{p.descripcion}</div>}
                        <div style={{ fontSize: 10, color: '#AAA' }}>
                          {p.archivo_nombre} · {p.creado_por_nombre || 'Sistema'} · {new Date(p.created_at).toLocaleDateString('es-CL')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => setEditando({ id: p.id, nombre: p.nombre, descripcion: p.descripcion })}
                          style={{ height: 30, padding: '0 10px', background: 'none', border: '0.5px solid #CCC', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: '#555' }}>
                          <><Icon icon="lucide:pencil" width={12} style={{verticalAlign:"middle",marginRight:3}} /> Editar</>
                        </button>
                        <button onClick={() => eliminar(p.id, p.nombre)}
                          style={{ height: 30, padding: '0 10px', background: 'none', border: '0.5px solid #E8505B', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: '#E8505B' }}>
                          <><Icon icon="lucide:trash-2" width={12} style={{verticalAlign:"middle",marginRight:3}} /> Eliminar</>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
