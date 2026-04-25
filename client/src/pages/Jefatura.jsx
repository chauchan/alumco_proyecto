import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'
import api from '../services/api'
import { useToast } from '../context/ToastContext'

export default function Jefatura() {
  const navigate = useNavigate()
  const toast = useToast()
  const [resumen, setResumen] = useState(null)
  const [sedes, setSedes] = useState([])
  const [cursos, setCursos] = useState([])
  const [enviandoRecordatorios, setEnviandoRecordatorios] = useState(false)

  useEffect(() => {
    Promise.all([api.get('/reportes/resumen'), api.get('/reportes/sedes'), api.get('/reportes/cursos')])
      .then(([r, s, c]) => { setResumen(r.data); setSedes(s.data); setCursos(c.data) })
      .catch(() => {})
  }, [])

  const navItems = [
    { label:'Resumen global', active:true },
    { label:'Sedes', active:false },
    { label:'Métricas y reportes', active:false },
    { label:'Cursos', active:false },
    { label:'Generador IA', active:false, new:true },
    { label:'Configuración', active:false },
  ]

  const sedeColors = ['#2B4BA0','#7BC67A','#F5A623']

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
              <button className="btn-primary" onClick={() => navigate('/jefatura/ia')}><><Icon icon="lucide:sparkles" width={13} style={{verticalAlign:"middle",marginRight:4}} /> Generador IA</></button>
            </div>
          </div>

          {/* Stats globales */}
          <div className="stats-grid-4">
            {[
              { val: resumen?.total_colaboradores ?? '—', label:'Colaboradores totales', sub:'ambas sedes', color:'#2B4BA0' },
              { val: resumen?.capacitados_al_dia ?? '—', label:'Capacitados al día', sub:'meta: 100%', color:'#7BC67A' },
              { val: resumen?.certificados_emitidos ?? '—', label:'Certificados emitidos', sub:'este período', color:'#F5A623' },
              { val: resumen?.requieren_atencion ?? '—', label:'Requieren atención', sub:'doble fallo o alerta', color:'#E8505B' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color:s.color }}>{s.val}</div>
                <div className="stat-sub">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Sedes */}
          <div>
            <div className="card-header" style={{ marginBottom:10 }}>
              <span className="card-title" style={{ fontSize:14 }}>Comparativa por sede</span>
              <span className="card-link" style={{ color:'#1E3A6E' }}>Detalle <Icon icon="lucide:arrow-right" width={12} style={{verticalAlign:"middle"}} /></span>
            </div>
            <div className="two-col">
              {sedes.map((s, i) => (
                <div key={s.id} className="card">
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <div style={{ fontSize:13, fontWeight:500 }}>{s.nombre}</div>
                    <div style={{ display:'flex', gap:16 }}>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:18, fontWeight:500 }}>{s.colaboradores}</div>
                        <div style={{ fontSize:10, color:'#888' }}>colaboradores</div>
                      </div>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:18, fontWeight:500 }}>{s.certificados}</div>
                        <div style={{ fontSize:10, color:'#888' }}>certificados</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#888', marginBottom:4 }}>
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
              <span className="card-link" style={{ color:'#1E3A6E' }}>Ver todos <Icon icon="lucide:arrow-right" width={12} style={{verticalAlign:"middle"}} /></span>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr>
                  {['Curso','Inscritos','Completaron','Cobertura'].map(h => (
                    <th key={h} style={{ fontSize:11, fontWeight:500, color:'#888', textAlign:'left', padding:'6px 8px', borderBottom:'0.5px solid #E8E8E8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cursos.slice(0,5).map(c => (
                  <tr key={c.id} style={{ borderBottom:'0.5px solid #E8E8E8' }}>
                    <td style={{ padding:'8px 8px' }}>{c.nombre}</td>
                    <td style={{ padding:'8px 8px' }}>{c.inscritos}</td>
                    <td style={{ padding:'8px 8px' }}>{c.completaron}</td>
                    <td style={{ padding:'8px 8px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:60, height:4, background:'#EEE', borderRadius:2, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${c.pct_completado||0}%`, background:'#2B4BA0', borderRadius:2 }} />
                        </div>
                        <span>{c.pct_completado||0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  )
}
