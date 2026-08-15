import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
// Se importa como Ayuda y no como Tooltip para no chocar con el Tooltip de recharts
import Ayuda from '../components/Ayuda'
import api from '../services/api'
import { useToast } from '../context/ToastContext'

const DONUT_COLORS = ['var(--azul)', 'var(--verde)', 'var(--amarillo)', 'var(--rojo)', '#A855F7', '#06B6D4', '#F43F5E', '#14B8A6']

const hoyISO = () => new Date().toISOString().slice(0, 10)
const hace12MesesISO = () => {
  const d = new Date()
  d.setMonth(d.getMonth() - 11)
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

export default function Jefatura() {
  const navigate = useNavigate()
  const toast = useToast()
  const [resumen, setResumen] = useState(null)
  const [sedes, setSedes] = useState([])
  const [cursos, setCursos] = useState([])
  const [enviandoRecordatorios, setEnviandoRecordatorios] = useState(false)

  // --- Gráficos ---
  const [desde, setDesde] = useState(hace12MesesISO)
  const [hasta, setHasta] = useState(hoyISO)
  const [coberturaData, setCoberturaData] = useState([])
  const [certMesData, setCertMesData] = useState([])
  const [estamentoData, setEstamentoData] = useState([])
  const [cargandoGraficos, setCargandoGraficos] = useState(false)

  useEffect(() => {
    Promise.all([api.get('/reportes/resumen'), api.get('/reportes/sedes'), api.get('/reportes/cursos')])
      .then(([r, s, c]) => { setResumen(r.data); setSedes(s.data); setCursos(c.data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!desde || !hasta) return
    setCargandoGraficos(true)
    const qs = `?desde=${desde}&hasta=${hasta}`
    Promise.all([
      api.get(`/reportes/graficos/cobertura-sede${qs}`),
      api.get(`/reportes/graficos/certificaciones-mes${qs}`),
      api.get(`/reportes/graficos/distribucion-estamento${qs}`)
    ])
      .then(([c, m, e]) => {
        setCoberturaData(c.data)
        setCertMesData(m.data)
        setEstamentoData(e.data)
      })
      .catch(() => {})
      .finally(() => setCargandoGraficos(false))
  }, [desde, hasta])

  const sedeColors = ['var(--azul)','var(--verde)','var(--amarillo)']

  const enviarRecordatoriosAhora = async () => {
    setEnviandoRecordatorios(true)
    try {
      const { data } = await api.post('/reportes/enviar-recordatorios')
      toast.success(`Recordatorios enviados: ${data.enviados} de ${data.total}${data.errores > 0 ? ` (${data.errores} errores)` : ''}`)
    } catch {
      toast.error('Error al enviar recordatorios')
    } finally {
      setEnviandoRecordatorios(false)
    }
  }

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new()

    // Hoja 1: Resumen global
    const wsResumen = XLSX.utils.aoa_to_sheet([
      ['Resumen Global ALUMCO'],
      ['Generado el', new Date().toLocaleDateString('es-CL')],
      [],
      ['Indicador', 'Valor'],
      ['Colaboradores totales', resumen?.total_colaboradores ?? 0],
      ['Capacitados al día', resumen?.capacitados_al_dia ?? 0],
      ['Certificados emitidos', resumen?.certificados_emitidos ?? 0],
      ['Requieren atención', resumen?.requieren_atencion ?? 0],
    ])
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen global')

    // Hoja 2: Sedes
    const wsSedes = XLSX.utils.aoa_to_sheet([
      ['Sede', 'Colaboradores', 'Certificados', 'Cobertura (%)'],
      ...sedes.map(s => [s.nombre, s.colaboradores, s.certificados, s.cobertura_pct || 0])
    ])
    XLSX.utils.book_append_sheet(wb, wsSedes, 'Sedes')

    // Hoja 3: Cursos
    const wsCursos = XLSX.utils.aoa_to_sheet([
      ['Curso', 'Inscritos', 'Completaron', 'Cobertura (%)'],
      ...cursos.map(c => [c.nombre, c.inscritos, c.completaron, c.pct_completado || 0])
    ])
    XLSX.utils.book_append_sheet(wb, wsCursos, 'Cursos')

    XLSX.writeFile(wb, `reporte_alumco_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  return (
    <div className="app-shell">
      <Topbar seccion="Panel de jefatura — vista global" />
      <div className="app-body">

        <Sidebar />

        <main className="main-content" style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div className="page-title">Resumen ONG ALUMCO</div>
              <div className="page-sub">Vista global de todas las sedes · {new Date().toLocaleDateString('es-CL',{month:'long',year:'numeric'})}</div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn-outline-dark" onClick={exportarExcel}><><Icon icon="lucide:download" width={13} style={{verticalAlign:"middle",marginRight:4}} /> Exportar a Excel</></button>
              <button className="btn-outline-dark" onClick={enviarRecordatoriosAhora} disabled={enviandoRecordatorios}>
                <><Icon icon="lucide:bell" width={13} style={{verticalAlign:"middle",marginRight:4}} /> {enviandoRecordatorios ? 'Enviando…' : 'Enviar recordatorios'}</>
              </button>
              <button className="btn-primary" onClick={() => navigate('/ia')}><><Icon icon="lucide:sparkles" width={13} style={{verticalAlign:"middle",marginRight:4}} /> Generador IA</></button>
            </div>
          </div>

          {/* Stats globales */}
          <div className="stats-grid-4">
            {[
              { val: resumen?.total_colaboradores ?? '—', label:'Colaboradores totales', sub:'ambas sedes', color:'var(--azul)' },
              { val: resumen?.capacitados_al_dia ?? '—', label:'Capacitados al día', sub:'meta: 100%', color:'var(--success)',
                ayuda:'Colaboradores que tienen al 100% todos los cursos obligatorios que les corresponden, sea por su estamento o porque se los asignaron. Quien no tenga estamento no se cuenta aquí: sin estamento no recibe obligatorios, así que no hay nada contra qué medirlo.' },
              { val: resumen?.certificados_emitidos ?? '—', label:'Certificados emitidos', sub:'este período', color:'var(--warning)' },
              { val: resumen?.requieren_atencion ?? '—', label:'Requieren atención', sub:'doble fallo o alerta', color:'var(--danger)',
                ayuda:'"Doble fallo": el colaborador reprobó una evaluación dos veces y quedó bloqueado 7 días. También cuenta a quienes tienen una capacitación con fecha límite vencida y sin completar.' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-label">
                  {s.label}
                  {s.ayuda && <Ayuda texto={s.ayuda} etiqueta={`Qué significa: ${s.label}`} />}
                </div>
                <div className="stat-value" style={{ color:s.color }}>{s.val}</div>
                <div className="stat-sub">{s.sub}</div>
              </div>
            ))}
          </div>

          {resumen?.sin_estamento > 0 && (
            <div style={{ marginTop: 12, background: 'var(--warning-bg)', border: '1px solid var(--warning-graphic)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--warning)' }}>
              ⚠ {resumen.sin_estamento} colaborador{resumen.sin_estamento !== 1 ? 'es' : ''} sin estamento asignado — no {resumen.sin_estamento !== 1 ? 'reciben' : 'recibe'} capacitaciones obligatorias por estamento. Revisar en Gestión de usuarios.
            </div>
          )}

          {/* Sedes */}
          <div>
            <div className="card-header" style={{ marginBottom:10 }}>
              <span className="card-title" style={{ fontSize:14 }}>Comparativa por sede</span>
              <span className="card-link" onClick={() => navigate('/jefatura/sedes')} style={{ color:'var(--azul-oscuro)', cursor:'pointer' }}>Detalle <Icon icon="lucide:arrow-right" width={12} style={{verticalAlign:"middle"}} /></span>
            </div>
            <div className="two-col sedes-grid">
              {sedes.map((s, i) => (
                <div key={s.id} className="card">
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <div style={{ fontSize:13, fontWeight:500 }}>{s.nombre}</div>
                    <div style={{ display:'flex', gap:16 }}>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:18, fontWeight:500 }}>{s.colaboradores}</div>
                        <div style={{ fontSize:10, color:'var(--texto-muted)' }}>colaboradores</div>
                      </div>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:18, fontWeight:500 }}>{s.certificados}</div>
                        <div style={{ fontSize:10, color:'var(--texto-muted)' }}>certificados</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--texto-muted)', marginBottom:4 }}>
                    <span>Cobertura de capacitación</span>
                    <span>{s.cobertura_pct || 0}%</span>
                  </div>
                  <div className="progress-bar-wrap" style={{ height:6, borderRadius:3 }}>
                    <div className="progress-bar-fill" style={{ width:`${s.cobertura_pct||0}%`, background:sedeColors[i] }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cursos */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Cobertura por curso</span>
              <span className="card-link" onClick={() => navigate('/capacitaciones')} style={{ color:'var(--azul-oscuro)', cursor:'pointer' }}>Ver todos <Icon icon="lucide:arrow-right" width={12} style={{verticalAlign:"middle"}} /></span>
            </div>
            <div className="tabla-scroll">
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr>
                    {['Curso','Inscritos','Completaron','Cobertura'].map(h => (
                      <th key={h} style={{ fontSize:11, fontWeight:500, color:'var(--texto-muted)', textAlign:'left', padding:'6px 8px', borderBottom:'0.5px solid var(--gris-borde)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cursos.slice(0,5).map(c => (
                    <tr key={c.id} style={{ borderBottom:'0.5px solid var(--gris-borde)' }}>
                      <td style={{ padding:'8px 8px' }}>{c.nombre}</td>
                      <td style={{ padding:'8px 8px' }}>{c.inscritos}</td>
                      <td style={{ padding:'8px 8px' }}>{c.completaron}</td>
                      <td style={{ padding:'8px 8px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:60, height:4, background:'#EEE', borderRadius:2, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${c.pct_completado||0}%`, background:'var(--azul)', borderRadius:2 }} />
                          </div>
                          <span>{c.pct_completado||0}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Gráficos analíticos ── */}
          <div>
            {/* Encabezado con filtro de fechas */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div>
                <div className="card-title" style={{ fontSize:14 }}>Análisis y gráficos</div>
                {cargandoGraficos && <div style={{ fontSize:11, color:'var(--texto-muted)', marginTop:2 }}>Cargando…</div>}
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <label style={{ fontSize:11, color:'var(--texto-muted)' }}>Desde</label>
                <input
                  type="date"
                  value={desde}
                  max={hasta}
                  onChange={e => setDesde(e.target.value)}
                  style={{ fontSize:11, padding:'4px 6px', border:'1px solid #DDD', borderRadius:4, color:'#333' }}
                />
                <label style={{ fontSize:11, color:'var(--texto-muted)' }}>Hasta</label>
                <input
                  type="date"
                  value={hasta}
                  min={desde}
                  max={hoyISO()}
                  onChange={e => setHasta(e.target.value)}
                  style={{ fontSize:11, padding:'4px 6px', border:'1px solid #DDD', borderRadius:4, color:'#333' }}
                />
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:16 }}>

              {/* Barra: cobertura por sede */}
              <div className="card">
                <div style={{ fontSize:12, fontWeight:500, marginBottom:12 }}>
                  Cobertura por sede (%)
                  <Ayuda
                    texto="Porcentaje de colaboradores activos de la sede que tienen al día todos sus cursos obligatorios, sobre el total de colaboradores activos de esa sede. Es el estado de hoy: no depende del rango de fechas seleccionado arriba."
                    etiqueta="Qué significa: cobertura por sede"
                  />
                </div>
                {coberturaData.length === 0 && !cargandoGraficos
                  ? <div style={{ fontSize:11, color:'var(--texto-muted)', textAlign:'center', padding:'24px 0' }}>Sin datos</div>
                  : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={coberturaData} margin={{ top:4, right:8, left:-20, bottom:4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                        <XAxis dataKey="nombre" tick={{ fontSize:10 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize:10 }} unit="%" />
                        <Tooltip
                          formatter={(v, n, p) => [`${v}% (${p.payload.completaron}/${p.payload.total})`, 'Cobertura']}
                          contentStyle={{ fontSize:11 }}
                        />
                        <Bar dataKey="pct_completado" name="Cobertura" fill="var(--azul)" radius={[3,3,0,0]} maxBarSize={60} />
                      </BarChart>
                    </ResponsiveContainer>
                  )
                }
              </div>

              {/* Línea: certificaciones por mes */}
              <div className="card">
                <div style={{ fontSize:12, fontWeight:500, marginBottom:12 }}>Certificaciones emitidas por mes</div>
                {certMesData.length === 0 && !cargandoGraficos
                  ? <div style={{ fontSize:11, color:'var(--texto-muted)', textAlign:'center', padding:'24px 0' }}>Sin datos</div>
                  : (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={certMesData} margin={{ top:4, right:8, left:-20, bottom:4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                        <XAxis dataKey="label" tick={{ fontSize:9 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize:10 }} allowDecimals={false} />
                        <Tooltip contentStyle={{ fontSize:11 }} />
                        <Line
                          type="monotone"
                          dataKey="total"
                          name="Certificaciones"
                          stroke="var(--success-graphic)"
                          strokeWidth={2}
                          dot={{ r:3 }}
                          activeDot={{ r:5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )
                }
              </div>

              {/* Donut: distribución por estamento */}
              <div className="card">
                <div style={{ fontSize:12, fontWeight:500, marginBottom:12 }}>Distribución por estamento</div>
                {estamentoData.length === 0 && !cargandoGraficos
                  ? <div style={{ fontSize:11, color:'var(--texto-muted)', textAlign:'center', padding:'24px 0' }}>Sin datos</div>
                  : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={estamentoData}
                          dataKey="total"
                          nameKey="nombre"
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={75}
                          paddingAngle={2}
                        >
                          {estamentoData.map((_, i) => (
                            <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v, name) => [v, name]} contentStyle={{ fontSize:11 }} />
                        <Legend iconSize={9} wrapperStyle={{ fontSize:10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )
                }
              </div>

            </div>
          </div>
          {/* ── fin gráficos ── */}

        </main>
      </div>
    </div>
  )
}
