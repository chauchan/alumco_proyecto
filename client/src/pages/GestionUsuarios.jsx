import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import * as XLSX from 'xlsx'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import api from '../services/api'
import { useToast } from '../context/ToastContext'

const ESTAMENTOS = [
  'Profesional de Atención Directa',
  'Técnico de Atención Directa',
  'Asistente de Trato Directo',
  'Auxiliares de Servicio',
  'Manipuladores de Alimentos',
  'Administración y Apoyo',
  'Directivos',
]

const ROLES = ['colaborador', 'profesor', 'admin_sede', 'jefatura']
const ROL_LABEL = {
  colaborador: 'Colaborador', profesor: 'Profesor',
  admin_sede: 'Admin sede', jefatura: 'Jefatura'
}
const ROL_COLOR = {
  colaborador: '#2B4BA0', profesor: '#E8505B',
  admin_sede: '#7BC67A', jefatura: '#F5A623'
}

const FORM_INICIAL = {
  nombre: '', rut: '', correo: '', rol: 'colaborador',
  tipo_contrato: 'fijo', sede_id: '', estamento: ''
}

const limpiarRut = (rut) => rut.replace(/\./g, '').replace(/-/g, '')

function ContratoPill({ tipo }) {
  if (tipo === 'fijo')
    return <span style={{ fontSize: 10, background: '#EDFAF3', color: '#1A7A45', borderRadius: 20, padding: '2px 8px', fontWeight: 500 }}>Fijo</span>
  if (tipo === 'reemplazo')
    return <span style={{ fontSize: 10, background: '#FFF4E5', color: '#C06000', borderRadius: 20, padding: '2px 8px', fontWeight: 500 }}>Reemplazo</span>
  return <span style={{ color: '#AAA', fontSize: 12 }}>—</span>
}

const BTN_GHOST = {
  background: 'none', border: '0.5px solid #E8E8E8', borderRadius: 8,
  padding: '0 12px', height: 36, fontSize: 12, color: '#555', cursor: 'pointer'
}

export default function GestionUsuarios() {
  const navigate = useNavigate()
  const toast = useToast()
  const selectAllRef = useRef(null)
  const fileInputRef = useRef(null)

  const [usuarios, setUsuarios] = useState([])
  const [sedes, setSedes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)

  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('')
  const [filtroSede, setFiltroSede] = useState('')
  const [filtroContrato, setFiltroContrato] = useState('')

  const [seleccionados, setSeleccionados] = useState(new Set())
  const [confirmarBulk, setConfirmarBulk] = useState(null)

  const [mostrarImport, setMostrarImport] = useState(false)
  const [importStep, setImportStep] = useState(1)
  const [xlsxRows, setXlsxRows] = useState([])
  const [importResult, setImportResult] = useState(null)
  const [importando, setImportando] = useState(false)

  const cargar = (contrato = '') => {
    setCargando(true)
    const params = {}
    if (contrato) params.tipo_contrato = contrato
    Promise.all([api.get('/usuarios', { params }), api.get('/sedes')])
      .then(([u, s]) => { setUsuarios(u.data); setSedes(s.data) })
      .catch(() => {})
      .finally(() => setCargando(false))
  }

  useEffect(() => { cargar(filtroContrato) }, [filtroContrato])

  const handleDesactivar = async (id, nombre) => {
    if (!confirm(`¿Desactivar a ${nombre}? El usuario no podrá ingresar al sistema pero su historial se conservará.`)) return
    try {
      await api.patch(`/usuarios/${id}`, { activo: false })
      setExito(`Usuario "${nombre}" desactivado correctamente`)
      cargar()
    } catch {
      setError('Error al desactivar usuario')
    }
  }

  const handleReactivar = async (id, nombre) => {
    if (!confirm(`¿Reactivar a ${nombre}?`)) return
    try {
      await api.patch(`/usuarios/${id}`, { activo: true })
      setExito(`Usuario "${nombre}" reactivado correctamente`)
      cargar()
    } catch {
      setError('Error al reactivar usuario')
    }
  }

  const usuariosFiltrados = usuarios.filter(u => {
    const matchBusqueda = !busqueda ||
      u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      u.identificador.toLowerCase().includes(busqueda.toLowerCase())
    const matchRol = !filtroRol || u.rol === filtroRol
    const matchSede = !filtroSede || String(u.sede_id) === filtroSede
    return matchBusqueda && matchRol && matchSede
  })

  const activosVisibles = usuariosFiltrados.filter(u => u.activo)
  const todosVisiblesSeleccionados = usuariosFiltrados.length > 0 && usuariosFiltrados.every(u => seleccionados.has(u.id))
  const algunoVisible = usuariosFiltrados.some(u => seleccionados.has(u.id))

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = algunoVisible && !todosVisiblesSeleccionados
    }
  }, [algunoVisible, todosVisiblesSeleccionados])

  const toggleSeleccion = (id) => {
    setSeleccionados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleTodosVisibles = () => {
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (todosVisiblesSeleccionados) {
        usuariosFiltrados.forEach(u => next.delete(u.id))
      } else {
        usuariosFiltrados.forEach(u => next.add(u.id))
      }
      return next
    })
  }

  const handleCrear = async (e) => {
    e.preventDefault()
    if (!form.nombre || !form.rut || !form.rol)
      return toast.error('Nombre, RUT y rol son obligatorios')
    try {
      await api.post('/usuarios', { ...form, password: 'alumco2026' })
      const username = limpiarRut(form.rut)
      toast.success(`Usuario "${form.nombre}" creado. Usuario: ${username} · Contraseña: alumco2026`)
      setForm(FORM_INICIAL)
      setMostrarForm(false)
      cargar(filtroContrato)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear usuario')
    }
  }

  const handleDesactivar = async (id, nombre) => {
    if (!confirm(`¿Desactivar a ${nombre}? El usuario no podrá ingresar pero su historial se conservará.`)) return
    try {
      await api.patch(`/usuarios/${id}`, { activo: false })
      toast.success(`Usuario "${nombre}" desactivado`)
      cargar(filtroContrato)
    } catch {
      toast.error('Error al desactivar usuario')
    }
  }

  const handleReactivar = async (id, nombre) => {
    if (!confirm(`¿Reactivar a ${nombre}?`)) return
    try {
      await api.patch(`/usuarios/${id}`, { activo: true })
      toast.success(`Usuario "${nombre}" reactivado`)
      cargar(filtroContrato)
    } catch {
      toast.error('Error al reactivar usuario')
    }
  }

  const handleBulkConfirm = async () => {
    const { tipo, ids } = confirmarBulk
    const endpoint = tipo === 'desactivar' ? '/usuarios/desactivar-bulk' : '/usuarios/reactivar-bulk'
    try {
      const { data } = await api.post(endpoint, { ids })
      const count = tipo === 'desactivar' ? data.desactivados : data.reactivados
      const verbo = tipo === 'desactivar' ? 'desactivado' : 'reactivado'
      toast.success(`${count} usuario${count !== 1 ? 's' : ''} ${verbo}${count !== 1 ? 's' : ''} correctamente`)
      setConfirmarBulk(null)
      setSeleccionados(new Set())
      cargar(filtroContrato)
    } catch (err) {
      toast.error(err.response?.data?.error || `Error al ${tipo} usuarios`)
    }
  }

  // XLSX import
  const descargarPlantilla = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['nombre', 'rut', 'correo', 'rol', 'tipo_contrato', 'sede', 'estamento'],
      ['María González', '12.345.678-9', 'maria@ejemplo.cl', 'colaborador', 'fijo', 'Sede Central', 'Técnico de Atención Directa'],
      ['Juan Pérez', '11.111.111-1', '', 'colaborador', 'reemplazo', 'Sede Norte', ''],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Usuarios')
    XLSX.writeFile(wb, 'plantilla_usuarios.xlsx')
  }

  const parsearXLSX = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        resolve(XLSX.utils.sheet_to_json(ws, { defval: '' }))
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })

  const handleXlsxFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const rows = await parsearXLSX(file)
      setXlsxRows(rows)
    } catch {
      toast.error('Error al leer el archivo Excel')
    }
  }

  const handleImportConfirm = async () => {
    if (!xlsxRows.length) return
    setImportando(true)
    try {
      const { data } = await api.post('/usuarios/bulk', { rows: xlsxRows })
      setImportResult(data)
      setImportStep(3)
      if (data.creados > 0) cargar(filtroContrato)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al importar usuarios')
    } finally {
      setImportando(false)
    }
  }

  const cerrarImport = () => {
    setMostrarImport(false)
    setImportStep(1)
    setXlsxRows([])
    setImportResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const limpiarFiltros = () => {
    setBusqueda(''); setFiltroRol(''); setFiltroSede(''); setFiltroContrato('')
  }

  const hayFiltros = busqueda || filtroRol || filtroSede || filtroContrato

  const SELECT_STYLE = {
    height: 36, border: '0.5px solid #E8E8E8', borderRadius: 8,
    padding: '0 10px', fontSize: 13, background: '#F4F5F7'
  }

  return (
    <div className="app-shell">
      <Topbar seccion="Jefatura — Gestión de usuarios" />
      <div className="app-body">
        <Sidebar />

        <main className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 80 }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="page-title">Gestión de usuarios</div>
              <div className="page-sub">Crear y administrar usuarios de todas las sedes · {usuarios.filter(u => u.activo).length} activos</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setMostrarImport(true); setImportStep(1) }}
                style={{ ...BTN_GHOST, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Icon icon="lucide:upload" width={13} /> Importar XLSX
              </button>
              <button className="btn-primary" onClick={() => { setMostrarForm(!mostrarForm) }}>
                {mostrarForm ? <><Icon icon="lucide:x" width={13} /> Cancelar</> : '+ Nuevo usuario'}
              </button>
            </div>
          </div>

          {/* Formulario */}
          {mostrarForm && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 16 }}>Nuevo usuario</div>
              <form onSubmit={handleCrear}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="field">
                    <label>Nombre completo *</label>
                    <input type="text" placeholder="Ej: María González"
                      value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>RUT *</label>
                    <input type="text" placeholder="Ej: 12.345.678-9"
                      value={form.rut} onChange={e => setForm({ ...form, rut: e.target.value })}
                      style={{ borderColor: form.rut && !validarFormatoRut(form.rut) ? '#E8505B' : undefined }} />
                    {form.rut && !validarFormatoRut(form.rut) && (
                      <span style={{ fontSize: 11, color: '#E8505B', marginTop: 4, display: 'block' }}>
                        Formato inválido. Ej: 12.345.678-9
                      </span>
                    )}
                    {form.rut && validarFormatoRut(form.rut) && (
                      <span style={{ fontSize: 11, color: '#888', marginTop: 4, display: 'block' }}>
                        Usuario de ingreso: <strong>{limpiarRut(form.rut)}</strong>
                      </span>
                    )}
                  </div>
                  <div className="field">
                    <label>Correo electrónico</label>
                    <input type="email" placeholder="Ej: maria@alumco.cl"
                      value={form.correo} onChange={e => setForm({ ...form, correo: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Rol *</label>
                    <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>
                      {ROLES.map(r => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Sede</label>
                    <select value={form.sede_id} onChange={e => setForm({ ...form, sede_id: e.target.value })}>
                      <option value="">Sin sede asignada</option>
                      {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Estamento</label>
                    <select value={form.estamento} onChange={e => setForm({ ...form, estamento: e.target.value })}>
                      <option value="">Seleccionar estamento</option>
                      {ESTAMENTOS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                  {form.rol === 'colaborador' && (
                    <div className="field">
                      <label>Tipo de contrato</label>
                      <select value={form.tipo_contrato} onChange={e => setForm({ ...form, tipo_contrato: e.target.value })}>
                        <option value="fijo">Fijo</option>
                        <option value="reemplazo">Reemplazo</option>
                      </select>
                    </div>
                  )}
                </div>
                <div className="notice" style={{ marginBottom: 12 }}>
                  La contraseña inicial será <strong>alumco2026</strong>. El usuario podrá cambiarla después de su primer ingreso.
                </div>
                <button type="submit" className="btn-primary">Crear usuario</button>
              </form>
            </div>
          )}

          {/* Filtros */}
          <div className="card" style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="text" placeholder="Buscar por nombre o RUT..."
                value={busqueda} onChange={e => setBusqueda(e.target.value)}
                style={{ flex: 1, minWidth: 200, height: 36, border: '0.5px solid #E8E8E8', borderRadius: 8, padding: '0 12px', fontSize: 13, background: '#F4F5F7' }}
              />
              <select value={filtroRol} onChange={e => setFiltroRol(e.target.value)} style={SELECT_STYLE}>
                <option value="">Todos los roles</option>
                {ROLES.map(r => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
              </select>
              <select value={filtroSede} onChange={e => setFiltroSede(e.target.value)} style={SELECT_STYLE}>
                <option value="">Todas las sedes</option>
                {sedes.map(s => <option key={s.id} value={String(s.id)}>{s.nombre}</option>)}
              </select>
              <select value={filtroContrato} onChange={e => setFiltroContrato(e.target.value)} style={SELECT_STYLE}>
                <option value="">Todos los contratos</option>
                <option value="fijo">Fijo</option>
                <option value="reemplazo">Reemplazo</option>
              </select>
              {hayFiltros && (
                <button onClick={limpiarFiltros} style={BTN_GHOST}>
                  Limpiar filtros
                </button>
              )}
              {filtroContrato === 'reemplazo' && activosVisibles.length > 0 && (
                <button
                  onClick={() => setConfirmarBulk({ tipo: 'desactivar', ids: activosVisibles.map(u => u.id) })}
                  style={{ ...BTN_GHOST, color: '#C0392B', borderColor: '#E8505B' }}
                >
                  Desactivar todos los reemplazos visibles ({activosVisibles.length})
                </button>
              )}
              <span style={{ fontSize: 12, color: '#888', marginLeft: 'auto' }}>
                {usuariosFiltrados.length} resultado{usuariosFiltrados.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Tabla usuarios */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {cargando ? (
              <div style={{ textAlign: 'center', color: '#888', padding: 32 }}>Cargando...</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F4F5F7' }}>
                    <th style={{ padding: '10px 14px', borderBottom: '0.5px solid #E8E8E8', width: 36 }}>
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={todosVisiblesSeleccionados}
                        onChange={toggleTodosVisibles}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    {['Nombre', 'Identificador', 'Rol', 'Estamento', 'Sede', 'Contrato', 'Estado', 'Acciones'].map(h => (
                      <th key={h} style={{ fontSize: 11, fontWeight: 500, color: '#888', textAlign: 'left', padding: '10px 14px', borderBottom: '0.5px solid #E8E8E8' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', color: '#888', padding: 32 }}>No se encontraron usuarios</td></tr>
                  ) : usuariosFiltrados.map(u => (
                    <tr key={u.id} style={{ borderBottom: '0.5px solid #E8E8E8', opacity: u.activo ? 1 : 0.5, background: seleccionados.has(u.id) ? '#F0F4FF' : 'transparent' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <input
                          type="checkbox"
                          checked={seleccionados.has(u.id)}
                          onChange={() => toggleSeleccion(u.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 500 }}>{u.nombre}</td>
                      <td style={{ padding: '10px 14px', color: '#888', fontSize: 12 }}>{u.identificador}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 10, background: `${ROL_COLOR[u.rol]}22`, color: ROL_COLOR[u.rol], borderRadius: 20, padding: '2px 8px', fontWeight: 500 }}>
                          {ROL_LABEL[u.rol]}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 11, color: '#555' }}>{u.estamento || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#888', fontSize: 12 }}>{u.sede_nombre || '—'}</td>
                      <td style={{ padding: '10px 14px' }}><ContratoPill tipo={u.tipo_contrato} /></td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className={`status-pill ${u.activo ? 'status-ok' : 'status-fallo'}`}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {u.activo ? (
                          <button className="btn-rechazar" onClick={() => handleDesactivar(u.id, u.nombre)}>
                            Desactivar
                          </button>
                        ) : (
                          <button className="btn-aprobar" onClick={() => handleReactivar(u.id, u.nombre)}>
                            Reactivar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>

      {/* Bulk action bar */}
      {seleccionados.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#1E3A6E', borderRadius: 10, padding: '10px 18px',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)', zIndex: 200
        }}>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 500, marginRight: 4 }}>
            {seleccionados.size} seleccionado{seleccionados.size !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setConfirmarBulk({ tipo: 'desactivar', ids: [...seleccionados] })}
            style={{ background: '#E8505B', border: 'none', borderRadius: 7, padding: '6px 14px', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
          >
            Desactivar ({seleccionados.size})
          </button>
          <button
            onClick={() => setConfirmarBulk({ tipo: 'reactivar', ids: [...seleccionados] })}
            style={{ background: '#7BC67A', border: 'none', borderRadius: 7, padding: '6px 14px', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
          >
            Reactivar ({seleccionados.size})
          </button>
          <button
            onClick={() => setSeleccionados(new Set())}
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 7, padding: '6px 12px', color: '#fff', fontSize: 12, cursor: 'pointer' }}
          >
            Limpiar selección
          </button>
        </div>
      )}

      {/* Modal confirmar bulk */}
      {confirmarBulk && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300 }} onClick={() => setConfirmarBulk(null)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            background: 'white', borderRadius: 12, padding: 28, width: 400, zIndex: 301,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>
              {confirmarBulk.tipo === 'desactivar' ? 'Desactivar usuarios' : 'Reactivar usuarios'}
            </div>
            <div style={{ fontSize: 13, color: '#555', marginBottom: 24, lineHeight: 1.6 }}>
              Vas a <strong>{confirmarBulk.tipo}</strong> {confirmarBulk.ids.length} usuario{confirmarBulk.ids.length !== 1 ? 's' : ''}.
              {confirmarBulk.tipo === 'desactivar' && ' Esta acción se puede revertir reactivándolos.'}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmarBulk(null)} style={BTN_GHOST}>Cancelar</button>
              <button
                onClick={handleBulkConfirm}
                className={confirmarBulk.tipo === 'desactivar' ? 'btn-rechazar' : 'btn-aprobar'}
                style={{ padding: '8px 20px' }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modal importar XLSX */}
      {mostrarImport && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300 }} onClick={cerrarImport} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            background: 'white', borderRadius: 12, width: 560, maxHeight: '80vh',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
            zIndex: 301, boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
          }}>
            {/* Modal header */}
            <div style={{ padding: '16px 20px', borderBottom: '0.5px solid #E8E8E8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Importar usuarios</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                  Paso {importStep} de 3 · {importStep === 1 ? 'Plantilla' : importStep === 2 ? 'Cargar archivo' : 'Resultado'}
                </div>
              </div>
              <button onClick={cerrarImport} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
                <Icon icon="lucide:x" width={18} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>

              {/* Step 1: Descargar plantilla */}
              {importStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ fontSize: 13, color: '#555', lineHeight: 1.7 }}>
                    Descargá la plantilla Excel con el formato requerido. Completá las columnas y subí el archivo en el siguiente paso.
                  </div>
                  <div style={{ background: '#F4F5F7', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#555' }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Columnas del archivo:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                      {['nombre *', 'rut *', 'correo', 'rol', 'tipo_contrato', 'sede', 'estamento'].map(c => (
                        <span key={c} style={{ fontFamily: 'monospace', background: '#E8E8E8', borderRadius: 4, padding: '1px 6px' }}>{c}</span>
                      ))}
                    </div>
                    <div style={{ marginTop: 8, color: '#888' }}>
                      Roles válidos: colaborador, profesor, admin_sede, jefatura · Contratos: fijo, reemplazo
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={descargarPlantilla} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon icon="lucide:download" width={13} /> Descargar plantilla
                    </button>
                    <button onClick={() => setImportStep(2)} style={BTN_GHOST}>
                      Ya tengo mi archivo →
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Cargar archivo + preview */}
              {importStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 500, color: '#555', display: 'block', marginBottom: 6 }}>
                      Seleccionar archivo (.xlsx / .xls)
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleXlsxFile}
                      style={{ fontSize: 13 }}
                    />
                  </div>

                  {xlsxRows.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6, color: '#555' }}>
                        Vista previa — {xlsxRows.length} fila{xlsxRows.length !== 1 ? 's' : ''} detectada{xlsxRows.length !== 1 ? 's' : ''}
                      </div>
                      <div style={{ overflowX: 'auto', border: '0.5px solid #E8E8E8', borderRadius: 8, maxHeight: 260, overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                          <thead>
                            <tr style={{ background: '#F4F5F7' }}>
                              {['', 'nombre', 'rut', 'rol', 'contrato', 'sede'].map(h => (
                                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500, color: '#888', borderBottom: '0.5px solid #E8E8E8', whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {xlsxRows.slice(0, 50).map((row, i) => {
                              const valida = !!(row.nombre?.toString().trim() && row.rut?.toString().trim())
                              return (
                                <tr key={i} style={{ borderBottom: '0.5px solid #F0F0F0', background: valida ? 'transparent' : '#FFF5F5' }}>
                                  <td style={{ padding: '5px 10px' }}>
                                    <span style={{ fontSize: 10, color: valida ? '#1A7A45' : '#C0392B' }}>
                                      {valida ? '✓' : '✗'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '5px 10px', color: '#1a1a1a' }}>{row.nombre?.toString() || '—'}</td>
                                  <td style={{ padding: '5px 10px', color: '#555' }}>{row.rut?.toString() || '—'}</td>
                                  <td style={{ padding: '5px 10px', color: '#555' }}>{row.rol?.toString() || 'colaborador'}</td>
                                  <td style={{ padding: '5px 10px', color: '#555' }}>{row.tipo_contrato?.toString() || '—'}</td>
                                  <td style={{ padding: '5px 10px', color: '#555' }}>{row.sede?.toString() || '—'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                        {xlsxRows.length > 50 && (
                          <div style={{ padding: '8px 10px', fontSize: 11, color: '#888', textAlign: 'center', borderTop: '0.5px solid #E8E8E8' }}>
                            Mostrando primeras 50 de {xlsxRows.length} filas
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <button onClick={() => setImportStep(1)} style={BTN_GHOST}>← Atrás</button>
                    <button
                      onClick={handleImportConfirm}
                      className="btn-primary"
                      disabled={!xlsxRows.length || importando}
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      {importando
                        ? <><Icon icon="lucide:loader-circle" width={13} /> Importando...</>
                        : `Importar ${xlsxRows.length} usuario${xlsxRows.length !== 1 ? 's' : ''}`
                      }
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Resultado */}
              {importStep === 3 && importResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{
                    background: '#EDFAF3', border: '0.5px solid #7BC67A', borderRadius: 8,
                    padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8
                  }}>
                    <Icon icon="lucide:check-circle" width={16} style={{ color: '#1A7A45' }} />
                    <span style={{ fontSize: 13, color: '#1A7A45', fontWeight: 500 }}>
                      {importResult.creados} usuario{importResult.creados !== 1 ? 's' : ''} creado{importResult.creados !== 1 ? 's' : ''} correctamente
                    </span>
                  </div>

                  {importResult.errores.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#C0392B', marginBottom: 8 }}>
                        {importResult.errores.length} fila{importResult.errores.length !== 1 ? 's' : ''} con error:
                      </div>
                      <div style={{ border: '0.5px solid #E8E8E8', borderRadius: 8, overflow: 'hidden', maxHeight: 220, overflowY: 'auto' }}>
                        {importResult.errores.map((err, i) => (
                          <div key={i} style={{
                            padding: '7px 12px', fontSize: 12, borderBottom: '0.5px solid #F0F0F0',
                            display: 'flex', gap: 10, background: i % 2 === 0 ? 'white' : '#FAFAFA'
                          }}>
                            <span style={{ color: '#C0392B', fontWeight: 500, flexShrink: 0 }}>Fila {err.fila}</span>
                            <span style={{ color: '#555' }}>{err.motivo}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button onClick={cerrarImport} className="btn-primary" style={{ alignSelf: 'flex-start' }}>
                    Cerrar
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
