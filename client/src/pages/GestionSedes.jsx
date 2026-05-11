import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import api from '../services/api'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'

const FORM_INICIAL = { nombre: '', ciudad: '' }

const BTN_GHOST = {
  background: 'none', border: '0.5px solid #E8E8E8', borderRadius: 8,
  padding: '0 14px', height: 36, fontSize: 13, color: '#555', cursor: 'pointer'
}

export default function GestionSedes() {
  const toast = useToast()
  const confirm = useConfirm()
  const [sedes, setSedes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(null) // null | { modo: 'crear' | 'editar', sede?: {} }
  const [form, setForm] = useState(FORM_INICIAL)
  const [guardando, setGuardando] = useState(false)

  const cargar = () => {
    setCargando(true)
    api.get('/sedes')
      .then(r => setSedes(r.data))
      .catch(() => toast.error('Error al cargar sedes'))
      .finally(() => setCargando(false))
  }

  useEffect(() => { cargar() }, [])

  const abrirCrear = () => {
    setForm(FORM_INICIAL)
    setModal({ modo: 'crear' })
  }

  const abrirEditar = (sede) => {
    setForm({ nombre: sede.nombre, ciudad: sede.ciudad || '' })
    setModal({ modo: 'editar', sede })
  }

  const cerrarModal = () => { setModal(null); setForm(FORM_INICIAL) }

  const handleGuardar = async (e) => {
    e.preventDefault()
    if (!form.nombre.trim()) return toast.error('El nombre es requerido')
    setGuardando(true)
    try {
      if (modal.modo === 'crear') {
        await api.post('/sedes', { nombre: form.nombre.trim(), ciudad: form.ciudad.trim() || null })
        toast.success(`Sede "${form.nombre.trim()}" creada correctamente`)
      } else {
        await api.patch(`/sedes/${modal.sede.id}`, { nombre: form.nombre.trim(), ciudad: form.ciudad.trim() || null })
        toast.success(`Sede "${form.nombre.trim()}" actualizada correctamente`)
      }
      cerrarModal()
      cargar()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar sede')
    } finally {
      setGuardando(false)
    }
  }

  const handleDesactivar = async (sede) => {
    const ok = await confirm({
      title: `Desactivar "${sede.nombre}"`,
      message: 'La sede dejará de aparecer en los selectores. Puedes reactivarla en cualquier momento.',
      confirmText: 'Desactivar',
      danger: true,
    })
    if (!ok) return
    try {
      await api.delete(`/sedes/${sede.id}`)
      toast.success(`Sede "${sede.nombre}" desactivada`)
      cargar()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al desactivar sede')
    }
  }

  const handleReactivar = async (sede) => {
    const ok = await confirm({
      title: `Reactivar "${sede.nombre}"`,
      message: 'La sede volverá a estar disponible en los selectores.',
      confirmText: 'Reactivar',
    })
    if (!ok) return
    try {
      await api.patch(`/sedes/${sede.id}`, { activa: true })
      toast.success(`Sede "${sede.nombre}" reactivada`)
      cargar()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al reactivar sede')
    }
  }

  return (
    <div className="app-shell">
      <Topbar seccion="Jefatura — Gestión de sedes" />
      <div className="app-body">
        <Sidebar />

        <main className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="page-title">Gestión de sedes</div>
              <div className="page-sub">
                Administrar sedes de la organización · {sedes.filter(s => s.activa).length} activas
              </div>
            </div>
            <button className="btn-primary" onClick={abrirCrear} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon icon="lucide:plus" width={13} /> Nueva sede
            </button>
          </div>

          {/* Tabla */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {cargando ? (
              <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>Cargando...</div>
            ) : sedes.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#888', padding: 40, fontSize: 13 }}>
                No hay sedes registradas. Creá la primera con el botón de arriba.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F4F5F7' }}>
                    {['Nombre', 'Ciudad', 'Estado', 'Usuarios activos', 'Acciones'].map(h => (
                      <th key={h} style={{
                        fontSize: 11, fontWeight: 500, color: '#888', textAlign: 'left',
                        padding: '10px 16px', borderBottom: '0.5px solid #E8E8E8'
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sedes.map(s => (
                    <tr key={s.id} style={{ borderBottom: '0.5px solid #E8E8E8', opacity: s.activa ? 1 : 0.55 }}>
                      <td style={{ padding: '11px 16px', fontWeight: 500 }}>{s.nombre}</td>
                      <td style={{ padding: '11px 16px', color: '#666' }}>{s.ciudad || '—'}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <span className={`status-pill ${s.activa ? 'status-ok' : 'status-fallo'}`}>
                          {s.activa ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td style={{ padding: '11px 16px', color: '#555' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 12, color: parseInt(s.usuarios_activos) > 0 ? '#2B4BA0' : '#AAA'
                        }}>
                          <Icon icon="lucide:users" width={12} />
                          {s.usuarios_activos}
                        </span>
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => abrirEditar(s)}
                            style={{ ...BTN_GHOST, height: 30, padding: '0 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                          >
                            <Icon icon="lucide:pencil" width={11} /> Editar
                          </button>
                          {s.activa ? (
                            <button className="btn-rechazar" onClick={() => handleDesactivar(s)}>
                              Desactivar
                            </button>
                          ) : (
                            <button className="btn-aprobar" onClick={() => handleReactivar(s)}>
                              Reactivar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>

      {/* Modal crear / editar */}
      {modal && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300 }}
            onClick={cerrarModal}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            background: 'white', borderRadius: 12, padding: 28, width: 420, zIndex: 301,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)'
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 18 }}>
              {modal.modo === 'crear' ? 'Nueva sede' : `Editar "${modal.sede.nombre}"`}
            </div>
            <form onSubmit={handleGuardar}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <div className="field">
                  <label>Nombre *</label>
                  <input
                    type="text"
                    placeholder="Ej: Sede Central"
                    value={form.nombre}
                    onChange={e => setForm({ ...form, nombre: e.target.value })}
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label>Ciudad</label>
                  <input
                    type="text"
                    placeholder="Ej: Santiago"
                    value={form.ciudad}
                    onChange={e => setForm({ ...form, ciudad: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={cerrarModal} style={BTN_GHOST} disabled={guardando}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={guardando}>
                  {guardando ? 'Guardando...' : modal.modo === 'crear' ? 'Crear sede' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
