import { Icon } from '@iconify/react'
import Ayuda from '../Ayuda'
import { descargarCertificado } from '../../services/api'

// Paso "Evaluación" de CursoDetalle: si ya hay resultado, muestra la nota
// (aprobado con estado del certificado, o reprobado con intentos restantes);
// si no, el formulario de preguntas.
export default function TabEvaluacion({
  curso, resultado, respuestas, onChangeRespuesta, todosRespondidos, enviando, onEnviarEvaluacion,
  intentosRestantes, esperandoPractico, buscandoCert, certificado,
  onIntentarNuevamente, onVolverCapacitaciones,
}) {
  if (!resultado) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ fontSize: 13, color: 'var(--cd-text-sec)' }}>
          Responde todas las preguntas. Necesitas al menos 60% para aprobar.
        </div>
        {curso.preguntas.map((preg, pi) => (
          <div key={preg.id} style={{ border: '0.5px solid var(--cd-border)', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>{pi + 1}. {preg.texto}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(preg.alternativas || []).filter(alt => alt?.texto?.trim()).slice(0, 4).map((alt, ai) => {
                const sel = respuestas[preg.id] === ai
                return (
                  <label key={ai} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                    borderRadius: 8, cursor: 'pointer', fontSize: 13,
                    background: sel ? 'var(--azul-claro)' : 'var(--cd-subtle-bg)',
                    border: `1px solid ${sel ? 'var(--azul)' : 'var(--cd-border)'}`
                  }}>
                    <input type="radio" name={`preg-${preg.id}`} checked={sel}
                      onChange={() => onChangeRespuesta(preg.id, ai)}
                      style={{ accentColor: 'var(--azul)' }} />
                    {alt.texto}
                  </label>
                )
              })}
            </div>
          </div>
        ))}
        <button onClick={onEnviarEvaluacion} disabled={!todosRespondidos || enviando} style={{
          background: todosRespondidos ? 'var(--azul)' : '#ccc', color: '#fff',
          border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 14,
          fontWeight: 600, cursor: todosRespondidos ? 'pointer' : 'not-allowed',
          alignSelf: 'center', marginTop: 4
        }}>
          {enviando ? 'Enviando...' : 'Enviar evaluación'}
        </button>
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'center', padding: '32px 16px' }}>
      {resultado.aprobado ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <Icon icon="lucide:trophy" width={64} style={{color:'var(--amarillo)'}} />
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--success)' }}>¡Curso finalizado!</div>
          <div style={{ fontSize: 14, color: 'var(--cd-text-sec)' }}>{curso?.nombre}</div>
          <div style={{
            background: 'linear-gradient(135deg, var(--azul-oscuro) 0%, var(--azul) 100%)',
            borderRadius: 16, padding: '24px 40px', color: '#fff', width: '100%', maxWidth: 340
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7, marginBottom: 8 }}>
              Nota obtenida
            </div>
            <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1 }}>{resultado.notaChilena?.toFixed(1) ?? resultado.score}</div>
            <div style={{ fontSize: 13, opacity: 0.85, marginTop: 8 }}>
              {resultado.correctas} de {resultado.total} preguntas correctas
            </div>
          </div>
          <div style={{ width: '100%', maxWidth: 340 }}>
            <div style={{ height: 8, background: 'var(--cd-border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4, transition: 'width 0.8s ease',
                width: `${resultado.score}%`,
                background: resultado.score >= 80 ? 'var(--success)' : resultado.score >= 60 ? 'var(--amarillo)' : 'var(--rojo)'
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--cd-text-muted)', marginTop: 4 }}>
              <span>1.0</span>
              <span style={{ color: 'var(--cd-text-muted)' }}>Mínimo aprobación: 4.0</span>
              <span>7.0</span>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--success)', background: 'var(--success-bg)', border: '1px solid var(--verde)', borderRadius: 10, padding: '10px 20px' }}>
            <><Icon icon="lucide:check" width={13} style={{verticalAlign:'middle',marginRight:4}} /> Tu progreso ha sido registrado</>
          </div>

          {/* Estado del certificado: cierra el ciclo aquí mismo */}
          {!esperandoPractico && !buscandoCert && certificado?.estado === 'aprobado' && (
            <div style={{
              width: '100%', maxWidth: 340, background: 'var(--cd-card-bg)',
              border: '1px solid var(--verde)', borderRadius: 12, padding: '16px 20px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}>
              <Icon icon="lucide:award" width={28} style={{ color: 'var(--success)' }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cd-text)' }}>
                Tu certificado está listo
              </div>
              <button
                onClick={() => descargarCertificado(
                  certificado.id,
                  `certificado_${(curso?.nombre || 'curso').replace(/[^a-zA-Z0-9_-]+/g, '_')}.pdf`
                )}
                style={{
                  background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 10,
                  padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 7,
                }}>
                <Icon icon="lucide:download" width={15} />
                Descargar certificado
              </button>
            </div>
          )}
          {!esperandoPractico && !buscandoCert && certificado?.estado === 'pendiente' && (
            <div style={{
              width: '100%', maxWidth: 340, background: 'var(--warning-bg)',
              border: '1px solid var(--warning-graphic)', borderRadius: 12, padding: '12px 18px',
              fontSize: 13, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 9,
            }}>
              <Icon icon="lucide:clock" width={16} style={{ flexShrink: 0 }} />
              <span>Tu certificado quedó <b>en revisión del profesor</b>. Te avisaremos cuando esté disponible en “Mis certificados”.</span>
            </div>
          )}
          {esperandoPractico && (
            <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '10px 16px', fontSize: 13, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 8, maxWidth: 340, width: '100%' }}>
              <Icon icon="lucide:clock" width={16} style={{flexShrink:0}} />
              Has aprobado la evaluación. Falta asistir al práctico para certificarte.
            </div>
          )}
          <button onClick={onVolverCapacitaciones}
            style={{ background: 'var(--azul)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 32px', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>
            Volver a capacitaciones
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <Icon icon="lucide:frown" width={56} style={{color:'var(--rojo)'}} />
          <div style={{ fontSize: 18, fontWeight: 600 }}>No aprobaste esta vez</div>
          <div style={{ background: '#FFF5F5', border: '1px solid #FECACA', borderRadius: 14, padding: '20px 32px', width: '100%', maxWidth: 320 }}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--danger)', letterSpacing: '0.08em', marginBottom: 6 }}>Tu nota</div>
            <div style={{ fontSize: 44, fontWeight: 800, color: 'var(--danger)', lineHeight: 1 }}>{resultado.notaChilena?.toFixed(1) ?? resultado.score}</div>
            <div style={{ fontSize: 13, color: 'var(--cd-text-muted)', marginTop: 6 }}>
              {resultado.correctas} de {resultado.total} correctas · Necesitas nota 4.0 para aprobar
            </div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: intentosRestantes <= 0 ? '#FFF5F5' : 'var(--cd-subtle-bg)',
            border: `1px solid ${intentosRestantes <= 0 ? '#FECACA' : 'var(--cd-border)'}`,
            borderRadius: 10, padding: '10px 20px', fontSize: 13
          }}>
            <Icon icon="lucide:refresh-cw" width={14} style={{color: intentosRestantes <= 0 ? 'var(--rojo)' : 'var(--cd-text-muted)'}} />
            <span style={{ color: intentosRestantes <= 0 ? 'var(--rojo)' : 'var(--cd-text-sec)', fontWeight: intentosRestantes <= 0 ? 600 : 400 }}>
              Intentos restantes: <strong>{intentosRestantes}/2</strong>
            </span>
            <Ayuda texto="Tienes un máximo de 2 intentos para aprobar la evaluación (nota mínima 60%). Si fallas ambos, quedas bloqueado 7 días antes de poder reintentar." />
          </div>
          {intentosRestantes <= 0 ? (
            <div style={{ fontSize: 13, color: 'var(--danger)', textAlign: 'center', maxWidth: 300 }}>
              Has agotado tus intentos. El curso quedará bloqueado por 7 días.
            </div>
          ) : (
            <button onClick={onIntentarNuevamente}
              style={{ background: 'var(--azul)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Intentar nuevamente
            </button>
          )}
        </div>
      )}
    </div>
  )
}
