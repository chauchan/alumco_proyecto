import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import * as XLSX from 'xlsx'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import Paginacion from '../components/Paginacion'
import Breadcrumb from '../components/Breadcrumb'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../context/ConfirmContext'
import { validarRut } from '../utils/validacion'
import { useFiltrosUrl } from '../hooks/useFiltrosUrl'
import Ayuda from '../components/Ayuda'

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
// Cada rol necesita dos valores: el texto usa el token semántico (4.5:1) y el
// fondo su versión tintada. Antes el fondo se derivaba concatenando "22" al
// hex para darle 13% de opacidad, algo que ya no es posible con variables CSS.
const ROL_COLOR = {
  colaborador: { texto: 'var(--azul)',    fondo: 'var(--azul-claro)'  },
  profesor:    { texto: 'var(--danger)',  fondo: 'var(--danger-bg)'   },
  admin_sede:  { texto: 'var(--success)', fondo: 'var(--success-bg)'  },
  jefatura:    { texto: 'var(--warning)', fondo: 'var(--warning-bg)'  },
}

const FORM_INICIAL = {
  nombre: '', rut: '', correo: '', rol: 'colaborador',
  tipo_contrato: 'fijo', sede_id: '', estamento: ''
}

const limpiarRut = (rut) => rut.replace(/\./g, '').replace(/-/g, '')

function ContratoPill({ tipo }) {
  if (tipo === 'fijo')
    return <span style={{ fontSize: 10, background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 20, padding: '2px 8px', fontWeight: 500 }}>Fijo</span>
  if (tipo === 'reemplazo')
    return <span style={{ fontSize: 10, background: 'var(--warning-bg)', color: 'var(--warning)', borderRadius: 20, padding: '2px 8px', fontWeight: 500 }}>Reemplazo</span>
  return <span style={{ color: 'var(--texto-muted)', fontSize: 12 }}>—</span>
}

const BTN_GHOST = {
  background: 'none', border: '0.5px solid var(--gris-borde)', borderRadius: 8,
  padding: '0 12px', height: 36, fontSize: 12, color: 'var(--texto-sec)', cursor: 'pointer'
}

export default function GestionUsuarios() {
  const navigate = useNavigate()
  const { usuario: usuarioActual } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  // Rol y sede solo los mueve jefatura: para admin_sede son campos de solo
  // lectura, no ocultos, para que se entienda por qué no puede cambiarlos.
  const esJefatura = usuarioActual?.rol === 'jefatura'
  const selectAllRef = useRef(null)
  const fileInputRef = useRef(null)

  const [filtros, setFiltro] = useFiltrosUrl({ busqueda: '', filtroRol: '', filtroSede: '', filtroContrato: '', pagina: '1' })
  const { busqueda, filtroRol, filtroSede, filtroContrato } = filtros
  const pagina = parseInt(filtros.pagina) || 1

  const [usuarios, setUsuarios] = useState([])
  const [total, setTotal] = useState(0)
  const LIMIT = 20
  const [sedes, setSedes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [editando, setEditando] = useState(null)   // id del usuario en edición, o null si es alta

  const [seleccionados, setSeleccionados] = useState(new Set())
  const [confirmarBulk, setConfirmarBulk] = useState(null)

  const [mostrarImport, setMostrarImport] = useState(false)
  const [importStep, setImportStep] = useState(1)
  const [xlsxRows, setXlsxRows] = useState([])
  const [importResult, setImportResult] = useState(null)
  const [importando, setImportando] = useState(false)

  const busquedaRef = useRef(busqueda)
  busquedaRef.current = busqueda
  const prevBusquedaRef = useRef(busqueda)

  const cargar = useCallback((pag = 1) => {
    setCargando(true)
    const params = { page: pag, limit: LIMIT }
    if (busquedaRef.current) params.q = busquedaRef.current
    if (filtroRol) params.rol = filtroRol
    if (filtroSede) params.sede_id = filtroSede
    if (filtroContrato) params.tipo_contrato = filtroContrato

    Promise.all([api.get('/usuarios', { params }), api.get('/sedes')])
      .then(([u, s]) => {
        setUsuarios(u.data.rows)
        setTotal(u.data.total)
        setFiltro('pagina', String(u.data.page))
        setSedes(s.data)
      })
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [filtroRol, filtroSede, filtroContrato])

  // Primera carga: respeta la página guardada en la URL (recargar no la pierde).
  // Cambios posteriores de filtro/búsqueda sí resetean a la página 1.
  const montadoRef = useRef(false)
  useEffect(() => {
    if (!montadoRef.current) {
      montadoRef.current = true
      cargar(pagina)
      return
    }
    const delay = busqueda !== prevBusquedaRef.current ? 300 : 0
    prevBusquedaRef.current = busqueda
    const t = setTimeout(() => cargar(1), delay)
    return () => clearTimeout(t)
  }, [busqueda, filtroRol, filtroSede, filtroContrato])

  const activosVisibles = usuarios.filter(u => u.activo)
  const todosVisiblesSeleccionados = usuarios.length > 0 && usuarios.every(u => seleccionados.has(u.id))
  const algunoVisible = usuarios.some(u => seleccionados.has(u.id))

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
        usuarios.forEach(u => next.delete(u.id))
      } else {
        usuarios.forEach(u => next.add(u.id))
      }
      return next
    })
  }

  const cerrarForm = () => {
    setForm(FORM_INICIAL)
    setEditando(null)
    setMostrarForm(false)
  }

  const abrirEdicion = (u) => {
    setForm({
      nombre: u.nombre || '',
      rut: u.rut || u.identificador || '',
      correo: u.email || '',
      rol: u.rol || 'colaborador',
      tipo_contrato: u.tipo_contrato || 'fijo',
      sede_id: u.sede_id ? String(u.sede_id) : '',
      estamento: u.estamento || '',
    })
    setEditando(u.id)
    setMostrarForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Alta y edición comparten formulario y validaciones: la única diferencia es
  // el verbo y que al editar no se toca la contraseña.
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nombre || !form.rut || !form.rol)
      return toast.error('Nombre, RUT y rol son obligatorios')
    if (!validarRut(form.rut))
      return toast.error('El RUT ingresado no es válido. Revisa el dígito verificador.')
    if (!form.estamento)
      return toast.error('El estamento es obligatorio: sin él, el colaborador no recibe capacitaciones obligatorias')

    if (editando) {
      // Solo se envía lo que jefatura puede mover; si un admin_sede mandara rol
      // o sede el servidor responde 403, así que ni se incluyen.
      const cambios = {
        nombre: form.nombre,
        rut: form.rut,
        correo: form.correo,
        tipo_contrato: form.tipo_contrato,
        estamento: form.estamento,
      }
      if (esJefatura) {
        cambios.rol = form.rol
        cambios.sede_id = form.sede_id || null
      }
      try {
        await api.patch(`/usuarios/${editando}`, cambios)
        toast.success(`Cambios guardados en "${form.nombre}"`)
        cerrarForm()
        cargar(pagina)
      } catch (err) {
        toast.error(err.response?.data?.error || 'No pudimos guardar los cambios. Inténtalo de nuevo.')
      }
      return
    }

    try {
      await api.post('/usuarios', { ...form, password: 'alumco2026' })
      const username = limpiarRut(form.rut)
      toast.success(`Usuario "${form.nombre}" creado. Usuario: ${username} · Contraseña: alumco2026`)
      cerrarForm()
      cargar(1)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear usuario')
    }
  }

  const handleDesactivar = async (id, nombre) => {
    const ok = await confirm({
      title: `Desactivar a ${nombre}`,
      message: 'El usuario no podrá ingresar pero su historial se conservará. Puedes reactivarlo más tarde.',
      confirmText: 'Desactivar',
      danger: true,
    })
    if (!ok) return
    try {
      await api.patch(`/usuarios/${id}`, { activo: false })
      // Desactivar es reversible con el mismo endpoint, así que el toast ofrece
      // "Deshacer" durante 5s en vez de obligar a buscar al usuario y reactivarlo.
      toast.undo(`Usuario "${nombre}" desactivado`, async () => {
        try {
          await api.patch(`/usuarios/${id}`, { activo: true })
          toast.success(`Se restauró a "${nombre}"`)
        } catch {
          toast.error(`No se pudo restaurar a "${nombre}"`)
        }
        cargar(pagina)
      })
      cargar(pagina)
    } catch {
      toast.error('Error al desactivar usuario')
    }
  }

  const handleReactivar = async (id, nombre) => {
    const ok = await confirm({
      title: `Reactivar a ${nombre}`,
      message: 'El usuario podrá volver a ingresar a la plataforma.',
      confirmText: 'Reactivar',
    })
    if (!ok) return
    try {
      await api.patch(`/usuarios/${id}`, { activo: true })
      toast.success(`Usuario "${nombre}" reactivado`)
      cargar(pagina)
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
      cargar(1)
    } catch (err) {
      toast.error(err.response?.data?.error || `Error al ${tipo} usuarios`)
    }
  }

  // XLSX import
  const descargarPlantilla = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['nombre', 'rut', 'correo', 'rol', 'tipo_contrato', 'sede', 'estamento'],
      ['María González', '12.345.678-9', 'maria@ejemplo.cl', 'colaborador', 'fijo', 'Sede Central', 'Técnico de Atención Directa'],
      ['Juan Pérez', '11.111.111-1', '', 'colaborador', 'reemplazo', 'Sede Norte', 'Auxiliares de Servicio'],
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
      if (data.creados > 0) cargar(1)
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
    setFiltro.multiple({ busqueda: '', filtroRol: '', filtroSede: '', filtroContrato: '', pagina: '1' })
  }

  const hayFiltros = busqueda || filtroRol || filtroSede || filtroContrato

  const SELECT_STYLE = {
    height: 36, border: '0.5px solid var(--gris-borde)', borderRadius: 8,
    padding: '0 10px', fontSize: 13, background: 'var(--gris-fondo)'
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
              <Breadcrumb items={[{ label: 'Resumen global', path: '/jefatura' }, { label: 'Gestión de usuarios' }]} />
              <div className="page-title">Gestión de usuarios</div>
              <div className="page-sub">Crear y administrar usuarios de todas las sedes · {total} en total</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setMostrarImport(true); setImportStep(1) }}
                style={{ ...BTN_GHOST, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Icon icon="lucide:upload" width={13} /> Importar XLSX
              </button>
              <button className="btn-primary" onClick={() => {
                // Si estaba abierto en modo edición, este botón vuelve al alta
                // en blanco en vez de cerrar y dejar el formulario contaminado.
                if (mostrarForm) cerrarForm()
                else { setForm(FORM_INICIAL); setEditando(null); setMostrarForm(true) }
              }}>
                {mostrarForm ? <><Icon icon="lucide:x" width={13} /> Cancelar</> : '+ Nuevo usuario'}
              </button>
            </div>
          </div>

          {/* Formulario */}
          {mostrarForm && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 2 }}>
                {editando ? 'Editar usuario' : 'Nuevo usuario'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--texto-muted)', marginBottom: 14 }}>* campo obligatorio</div>
              <form onSubmit={handleSubmit} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); e.currentTarget.requestSubmit() } }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="field">
                    <label>Nombre completo *</label>
                    <input type="text" placeholder="Ej: María González"
                      value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>RUT *</label>
                    <input type="text" placeholder="Ej: 12.345.678-9"
                      value={form.rut} onChange={e => setForm({ ...form, rut: e.target.value })} />
                    {form.rut && !validarRut(form.rut) ? (
                      <span style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4, display: 'block' }}>
                        RUT inválido — revisa el dígito verificador
                      </span>
                    ) : form.rut && (
                      <span style={{ fontSize: 12, color: 'var(--texto-muted)', marginTop: 4, display: 'block' }}>
                        Usuario de ingreso: <strong>{limpiarRut(form.rut)}</strong>
                        {editando && ' — corregir el RUT cambia con qué usuario ingresa esta persona.'}
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
                    <select value={form.rol} disabled={editando && !esJefatura}
                      onChange={e => setForm({ ...form, rol: e.target.value })}>
                      {ROLES.map(r => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
                    </select>
                    {editando && !esJefatura && (
                      <span style={{ fontSize: 12, color: 'var(--texto-muted)', marginTop: 4, display: 'block' }}>
                        Solo jefatura puede cambiar el rol.
                      </span>
                    )}
                  </div>
                  <div className="field">
                    <label>Sede</label>
                    <select value={form.sede_id} disabled={editando && !esJefatura}
                      onChange={e => setForm({ ...form, sede_id: e.target.value })}>
                      <option value="">Sin sede asignada</option>
                      {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                    {editando && !esJefatura && (
                      <span style={{ fontSize: 12, color: 'var(--texto-muted)', marginTop: 4, display: 'block' }}>
                        Solo jefatura puede mover a alguien de sede.
                      </span>
                    )}
                  </div>
                  <div className="field">
                    <label>Estamento *<Ayuda texto="Determina qué cursos obligatorios recibe este usuario. Sin estamento, no se le asigna ninguna capacitación obligatoria aunque el curso esté publicado." /></label>
                    <select value={form.estamento} onChange={e => setForm({ ...form, estamento: e.target.value })} required>
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
                {!editando && (
                  <div className="notice" style={{ marginBottom: 12 }}>
                    La contraseña inicial será <strong>alumco2026</strong>. El usuario podrá cambiarla después de su primer ingreso.
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" className="btn-primary">
                    {editando ? 'Guardar cambios' : 'Crear usuario'}
                  </button>
                  {editando && (
                    <button type="button" className="btn-outline-dark" onClick={cerrarForm}>
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* Filtros */}
          <div className="card" style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="text" placeholder="Buscar por nombre o RUT..."
                value={busqueda} onChange={e => setFiltro('busqueda', e.target.value)}
                style={{ flex: 1, minWidth: 200, height: 36, border: '0.5px solid var(--gris-borde)', borderRadius: 8, padding: '0 12px', fontSize: 13, background: 'var(--gris-fondo)' }}
              />
              <select value={filtroRol} onChange={e => setFiltro('filtroRol', e.target.value)} style={SELECT_STYLE}>
                <option value="">Todos los roles</option>
                {ROLES.map(r => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
              </select>
              <select value={filtroSede} onChange={e => setFiltro('filtroSede', e.target.value)} style={SELECT_STYLE}>
                <option value="">Todas las sedes</option>
                {sedes.map(s => <option key={s.id} value={String(s.id)}>{s.nombre}</option>)}
              </select>
              <select value={filtroContrato} onChange={e => setFiltro('filtroContrato', e.target.value)} style={SELECT_STYLE}>
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
                  style={{ ...BTN_GHOST, color: 'var(--danger)', borderColor: 'var(--danger)' }}
                >
                  Desactivar todos los reemplazos visibles ({activosVisibles.length})
                </button>
              )}
              <span style={{ fontSize: 12, color: 'var(--texto-muted)', marginLeft: 'auto' }}>
                {total} resultado{total !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Tabla usuarios */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {cargando ? (
              <div style={{ textAlign: 'center', color: 'var(--texto-muted)', padding: 32 }}>Cargando...</div>
            ) : (
              <div className="tabla-scroll">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }} aria-live="polite">
                  <thead>
                    <tr style={{ background: 'var(--gris-fondo)' }}>
                      <th style={{ padding: '10px 14px', borderBottom: '0.5px solid var(--gris-borde)', width: 36 }}>
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          checked={todosVisiblesSeleccionados}
                          onChange={toggleTodosVisibles}
                          style={{ cursor: 'pointer' }}
                        />
                      </th>
                      {['Nombre', 'Identificador', 'Rol', 'Estamento', 'Sede', 'Contrato', 'Estado', 'Acciones'].map(h => (
                        <th key={h} style={{ fontSize: 11, fontWeight: 500, color: 'var(--texto-muted)', textAlign: 'left', padding: '10px 14px', borderBottom: '0.5px solid var(--gris-borde)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.length === 0 ? (
                      <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--texto-muted)', padding: 32 }}>No se encontraron usuarios</td></tr>
                    ) : usuarios.map(u => (
                      <tr key={u.id} style={{ borderBottom: '0.5px solid var(--gris-borde)', opacity: u.activo ? 1 : 0.5, background: seleccionados.has(u.id) ? '#F0F4FF' : 'transparent' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <input
                            type="checkbox"
                            checked={seleccionados.has(u.id)}
                            onChange={() => toggleSeleccion(u.id)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 500 }}>{u.nombre}</td>
                        <td style={{ padding: '10px 14px', color: 'var(--texto-muted)', fontSize: 12 }}>{u.identificador}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: 12, background: ROL_COLOR[u.rol]?.fondo, color: ROL_COLOR[u.rol]?.texto, borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>
                            {ROL_LABEL[u.rol]}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--texto-sec)' }}>
                          {u.estamento || (
                            // Sin estamento el colaborador no entra en el reparto de
                            // capacitaciones obligatorias, así que se marca en vez de
                            // mostrar un guion como si fuera un dato opcional más.
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--warning)', fontWeight: 600 }}>
                              <Icon icon="lucide:alert-triangle" width={13} />
                              Sin estamento
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', color: 'var(--texto-muted)', fontSize: 12 }}>{u.sede_nombre || '—'}</td>
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
                          <button
                            className="btn-outline-dark"
                            style={{ display: 'inline-flex', padding: '4px 10px', fontSize: 12, marginLeft: 6 }}
                            onClick={() => abrirEdicion(u)}
                            aria-label={`Editar a ${u.nombre}`}
                          >
                            <Icon icon="lucide:pencil" width={12} /> Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <Paginacion total={total} limit={LIMIT} pagina={pagina} onChange={p => cargar(p)} />
        </main>
      </div>

      {/* Bulk action bar */}
      {seleccionados.size > 0 && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--azul-oscuro)', borderRadius: 10, padding: '10px 18px',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)', zIndex: 200
        }}>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 500, marginRight: 4 }}>
            {seleccionados.size} seleccionado{seleccionados.size !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setConfirmarBulk({ tipo: 'desactivar', ids: [...seleccionados] })}
            style={{ background: 'var(--rojo)', border: 'none', borderRadius: 7, padding: '6px 14px', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
          >
            Desactivar ({seleccionados.size})
          </button>
          <button
            onClick={() => setConfirmarBulk({ tipo: 'reactivar', ids: [...seleccionados] })}
            style={{ background: 'var(--verde)', border: 'none', borderRadius: 7, padding: '6px 14px', color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
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
            <div style={{ fontSize: 13, color: 'var(--texto-sec)', marginBottom: 24, lineHeight: 1.6 }}>
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
            <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--gris-borde)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Importar usuarios</div>
                <div style={{ fontSize: 11, color: 'var(--texto-muted)', marginTop: 2 }}>
                  Paso {importStep} de 3 · {importStep === 1 ? 'Plantilla' : importStep === 2 ? 'Cargar archivo' : 'Resultado'}
                </div>
              </div>
              <button onClick={cerrarImport} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-muted)' }}>
                <Icon icon="lucide:x" width={18} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>

              {/* Step 1: Descargar plantilla */}
              {importStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ fontSize: 13, color: 'var(--texto-sec)', lineHeight: 1.7 }}>
                    Descargá la plantilla Excel con el formato requerido. Completá las columnas y subí el archivo en el siguiente paso.
                  </div>
                  <div style={{ background: 'var(--gris-fondo)', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: 'var(--texto-sec)' }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Columnas del archivo:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                      {['nombre *', 'rut *', 'correo', 'rol', 'tipo_contrato', 'sede', 'estamento'].map(c => (
                        <span key={c} style={{ fontFamily: 'monospace', background: 'var(--gris-borde)', borderRadius: 4, padding: '1px 6px' }}>{c}</span>
                      ))}
                    </div>
                    <div style={{ marginTop: 8, color: 'var(--texto-muted)' }}>
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
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--texto-sec)', display: 'block', marginBottom: 6 }}>
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
                      <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6, color: 'var(--texto-sec)' }}>
                        Vista previa — {xlsxRows.length} fila{xlsxRows.length !== 1 ? 's' : ''} detectada{xlsxRows.length !== 1 ? 's' : ''}
                      </div>
                      <div style={{ overflowX: 'auto', border: '0.5px solid var(--gris-borde)', borderRadius: 8, maxHeight: 260, overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                          <thead>
                            <tr style={{ background: 'var(--gris-fondo)' }}>
                              {['', 'nombre', 'rut', 'rol', 'contrato', 'sede'].map(h => (
                                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500, color: 'var(--texto-muted)', borderBottom: '0.5px solid var(--gris-borde)', whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {xlsxRows.slice(0, 50).map((row, i) => {
                              const valida = !!(row.nombre?.toString().trim() && row.rut?.toString().trim())
                              return (
                                <tr key={i} style={{ borderBottom: '0.5px solid #F0F0F0', background: valida ? 'transparent' : '#FFF5F5' }}>
                                  <td style={{ padding: '5px 10px' }}>
                                    <span style={{ fontSize: 10, color: valida ? 'var(--success)' : 'var(--danger)' }}>
                                      {valida ? '✓' : '✗'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '5px 10px', color: 'var(--texto)' }}>{row.nombre?.toString() || '—'}</td>
                                  <td style={{ padding: '5px 10px', color: 'var(--texto-sec)' }}>{row.rut?.toString() || '—'}</td>
                                  <td style={{ padding: '5px 10px', color: 'var(--texto-sec)' }}>{row.rol?.toString() || 'colaborador'}</td>
                                  <td style={{ padding: '5px 10px', color: 'var(--texto-sec)' }}>{row.tipo_contrato?.toString() || '—'}</td>
                                  <td style={{ padding: '5px 10px', color: 'var(--texto-sec)' }}>{row.sede?.toString() || '—'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                        {xlsxRows.length > 50 && (
                          <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--texto-muted)', textAlign: 'center', borderTop: '0.5px solid var(--gris-borde)' }}>
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
                    background: 'var(--success-bg)', border: '0.5px solid var(--verde)', borderRadius: 8,
                    padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8
                  }}>
                    <Icon icon="lucide:check-circle" width={16} style={{ color: 'var(--success)' }} />
                    <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 500 }}>
                      {importResult.creados} usuario{importResult.creados !== 1 ? 's' : ''} creado{importResult.creados !== 1 ? 's' : ''} correctamente
                    </span>
                  </div>

                  {importResult.errores.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--danger)', marginBottom: 8 }}>
                        {importResult.errores.length} fila{importResult.errores.length !== 1 ? 's' : ''} con error:
                      </div>
                      <div style={{ border: '0.5px solid var(--gris-borde)', borderRadius: 8, overflow: 'hidden', maxHeight: 220, overflowY: 'auto' }}>
                        {importResult.errores.map((err, i) => (
                          <div key={i} style={{
                            padding: '7px 12px', fontSize: 12, borderBottom: '0.5px solid #F0F0F0',
                            display: 'flex', gap: 10, background: i % 2 === 0 ? 'white' : '#FAFAFA'
                          }}>
                            <span style={{ color: 'var(--danger)', fontWeight: 500, flexShrink: 0 }}>Fila {err.fila}</span>
                            <span style={{ color: 'var(--texto-sec)' }}>{err.motivo}</span>
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
