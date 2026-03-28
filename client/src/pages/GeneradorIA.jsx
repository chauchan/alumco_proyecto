import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Topbar from '../components/Topbar'
import api from '../services/api'

export default function GeneradorIA() {
  const navigate = useNavigate()
  const [archivo, setArchivo] = useState(null)
  const [form, setForm] = useState({ nombre_curso: '', area: '', contexto: '' })
  const [resultado, setResultado] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!archivo || !form.nombre_curso) {
      return setError('El protocolo PDF y el nombre del curso son obligatorios')
    }
    setCargando(true)
    setError('')
    try {
      const data = new FormData()
      data.append('protocolo', archivo)
      data.append('nombre_curso', form.nombre_curso)
      data.append('area', form.area)
      data.append('contexto', form.contexto)
      const res = await api.post('/ia/generar-curso', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setResultado(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al generar el curso')
    } finally {
      setCargando(false)
    }
  }

  const handleEnviarProfesor = async () => {
    alert('Borrador enviado al profesor para revisión. Se notificará cuando esté listo.')
    navigate('/jefatura')
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <Topbar seccion="Generador de cursos con IA" />

      {/* Banner */}
      <div style={{ background: '#1E3A6E', padding: '20px 32px' }}>
        <h2 style={{ color: 'white', fontSize: 18, fontWeight: 600, marginBottom: 6 }}>
          Generador de cursos con IA
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginBottom: 16 }}>
          Sube un protocolo institucional en PDF y la IA genera un borrador de curso listo para revisar
        </p>
        <div style={{ display: 'flex', gap: 24 }}>
          {[
            { n: '1', title: 'Sube el protocolo', color: '#2B4BA0' },
            { n: '2', title: 'IA genera el curso', color: '#F5A623' },
            { n: '3', title: 'Profesor valida', color: '#7BC67A' },
          ].map(paso => (
            <div key={paso.n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: paso.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600, color: 'white', flexShrink: 0
              }}>{paso.n}</div>
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>{paso.title}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: 32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* Formulario */}
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Subir protocolo</h3>
          <form onSubmit={handleSubmit}>
            {/* Zona de subida */}
            <div
              onClick={() => document.getElementById('input-pdf').click()}
              style={{
                border: '2px dashed #CCC', borderRadius: 10, padding: '24px 16px',
                textAlign: 'center', cursor: 'pointer', marginBottom: 14,
                background: archivo ? '#EDFAF3' : 'transparent'
              }}
            >
              <input
                id="input-pdf" type="file" accept=".pdf"
                style={{ display: 'none' }}
                onChange={e => setArchivo(e.target.files[0])}
              />
              {archivo ? (
                <>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>✓</div>
                  <div style={{ fontSize: 12, color: '#1A7A45', fontWeight: 500 }}>{archivo.name}</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 24, marginBottom: 6, color: '#CCC' }}>📄</div>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Arrastra o selecciona el protocolo</div>
                  <div style={{ fontSize: 11, color: '#888' }}>Solo archivos PDF</div>
                </>
              )}
            </div>

            {['nombre_curso', 'area', 'contexto'].map(field => (
              <div key={field} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#555', marginBottom: 4 }}>
                  {field === 'nombre_curso' ? 'Nombre del curso *' : field === 'area' ? 'Área' : 'Contexto adicional (opcional)'}
                </label>
                {field === 'contexto' ? (
                  <textarea
                    value={form[field]}
                    onChange={e => setForm({ ...form, [field]: e.target.value })}
                    placeholder="Ej: Este protocolo aplica a residentes con movilidad reducida..."
                    rows={3}
                    style={{
                      width: '100%', border: '1px solid #E0E0E0', borderRadius: 8,
                      padding: '8px 12px', fontSize: 13, background: '#F4F5F7', resize: 'none'
                    }}
                  />
                ) : (
                  <input
                    type="text"
                    value={form[field]}
                    onChange={e => setForm({ ...form, [field]: e.target.value })}
                    placeholder={field === 'nombre_curso' ? 'Ej: Alimentación del adulto mayor en cama' : 'Ej: Cuidado clínico'}
                    style={{
                      width: '100%', height: 40, border: '1px solid #E0E0E0',
                      borderRadius: 8, padding: '0 12px', fontSize: 13, background: '#F4F5F7'
                    }}
                  />
                )}
              </div>
            ))}

            {error && <p style={{ color: '#E8505B', fontSize: 12, marginBottom: 8 }}>{error}</p>}

            <button
              type="submit"
              disabled={cargando}
              style={{
                width: '100%', height: 44, background: '#1E3A6E', color: 'white',
                border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
              }}
            >
              {cargando ? '⏳ Generando con IA...' : '✨ Generar curso con IA'}
            </button>
          </form>
        </div>

        {/* Resultado */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 500 }}>Borrador generado</h3>
            {resultado && <span className="badge badge-green">Listo para revisar</span>}
          </div>

          {cargando && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
              <p style={{ fontSize: 13 }}>Analizando el protocolo y generando el curso...</p>
              <p style={{ fontSize: 11, marginTop: 6 }}>Esto puede tomar 15-30 segundos</p>
            </div>
          )}

          {!resultado && !cargando && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#CCC' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
              <p style={{ fontSize: 13 }}>El borrador aparecerá aquí una vez que subas el protocolo</p>
            </div>
          )}

          {resultado && (
            <>
              <div style={{ background: '#F4F5F7', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#555' }}>
                Protocolo: <strong>{archivo?.name}</strong>
              </div>
              {resultado.modulos?.map((mod, i) => (
                <div key={i} style={{ border: '1px solid #E8E8E8', borderRadius: 10, padding: 12, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', background: '#1E3A6E',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: 'white', fontWeight: 600, flexShrink: 0
                    }}>{i + 1}</div>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{mod.titulo}</span>
                  </div>
                  <p style={{ fontSize: 11, color: '#666', marginBottom: 8, lineHeight: 1.5 }}>{mod.descripcion}</p>
                  <div style={{ fontSize: 10, fontWeight: 500, color: '#888', marginBottom: 4 }}>
                    {mod.preguntas?.length} preguntas de evaluación sugeridas
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={handleEnviarProfesor} style={{
                  flex: 1, height: 38, background: '#EDFAF3', color: '#1A7A45',
                  border: '1px solid #7BC67A', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer'
                }}>Enviar al profesor</button>
                <button style={{
                  flex: 1, height: 38, background: 'none', color: '#1E3A6E',
                  border: '1px solid #1E3A6E', borderRadius: 8, fontSize: 12, cursor: 'pointer'
                }}>Editar borrador</button>
                <button onClick={() => setResultado(null)} style={{
                  flex: 1, height: 38, background: 'none', color: '#888',
                  border: '1px solid #DDD', borderRadius: 8, fontSize: 12, cursor: 'pointer'
                }}>Descartar</button>
              </div>
              <p style={{ fontSize: 10, color: '#F5A623', marginTop: 12, textAlign: 'center' }}>
                ⚠ El contenido generado no se publica sin validación del profesor
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
