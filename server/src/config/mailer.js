const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.MAIL_USER || 'omegabarra3236@gmail.com',
    pass: process.env.MAIL_PASS
  }
});

// Verificar conexión SMTP al arrancar (solo loggea, no bloquea)
transporter.verify().then(() => {
  console.log('[MAIL] Conexión SMTP OK — usuario:', process.env.MAIL_USER || 'omegabarra3236@gmail.com');
}).catch(err => {
  console.error('[MAIL] ⚠ Error de conexión SMTP:', err.message);
  console.error('[MAIL]  MAIL_USER:', process.env.MAIL_USER || '(no definido)');
  console.error('[MAIL]  MAIL_PASS:', process.env.MAIL_PASS ? '(definido)' : '(NO DEFINIDO)');
});

async function notificarProfesor({ profesorEmail, profesorNombre, cursoNombre, cursoId, modulosCount, preguntasCount, nombreArchivo, subidoPor }) {
  const destinatario = profesorEmail || process.env.MAIL_USER || 'omegabarra3236@gmail.com';
  console.log('[MAIL] notificarProfesor → destinatario:', destinatario, '| curso:', cursoNombre);

  await transporter.sendMail({
    from: `"ALUMCO" <${process.env.MAIL_USER || 'omegabarra3236@gmail.com'}>`,
    to: destinatario,
    subject: `[ALUMCO] Nuevo borrador de curso: ${cursoNombre}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1E3A6E; padding: 24px 32px; border-radius: 10px 10px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 20px;">ALUMCO — Nuevo borrador de curso</h1>
        </div>
        <div style="background: #f9f9f9; padding: 28px 32px; border-radius: 0 0 10px 10px; border: 1px solid #e8e8e8;">
          <p style="color: #333; font-size: 15px;">Hola <strong>${profesorNombre}</strong>,</p>
          <p style="color: #555; font-size: 14px; line-height: 1.6;">
            Se ha generado un nuevo borrador de curso con IA que requiere tu revisión y aprobación antes de publicarse.
          </p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #fff; border-bottom: 1px solid #eee;">
              <td style="padding: 10px 14px; font-size: 13px; color: #888; width: 40%;">Curso</td>
              <td style="padding: 10px 14px; font-size: 13px; color: #222; font-weight: bold;">${cursoNombre}</td>
            </tr>
            <tr style="background: #f4f5f7; border-bottom: 1px solid #eee;">
              <td style="padding: 10px 14px; font-size: 13px; color: #888;">Módulos generados</td>
              <td style="padding: 10px 14px; font-size: 13px; color: #222;">${modulosCount}</td>
            </tr>
            <tr style="background: #fff; border-bottom: 1px solid #eee;">
              <td style="padding: 10px 14px; font-size: 13px; color: #888;">Preguntas generadas</td>
              <td style="padding: 10px 14px; font-size: 13px; color: #222;">${preguntasCount}</td>
            </tr>
            <tr style="background: #f4f5f7; border-bottom: 1px solid #eee;">
              <td style="padding: 10px 14px; font-size: 13px; color: #888;">Archivo fuente</td>
              <td style="padding: 10px 14px; font-size: 13px; color: #222;">${nombreArchivo}</td>
            </tr>
            <tr style="background: #fff;">
              <td style="padding: 10px 14px; font-size: 13px; color: #888;">Subido por</td>
              <td style="padding: 10px 14px; font-size: 13px; color: #222;">${subidoPor}</td>
            </tr>
          </table>
          <p style="color: #F5A623; font-size: 12px; background: #FFF8E8; padding: 10px 14px; border-radius: 6px; border: 1px solid #F5C842;">
            ⚠ Este curso no se publicará hasta que lo revises y apruebes en el sistema.
          </p>
          <p style="color: #555; font-size: 13px; margin-top: 20px;">Ingresa al sistema ALUMCO para revisarlo.</p>
        </div>
      </div>
    `
  }).then(info => {
    console.log('[MAIL] Enviado OK. messageId:', info.messageId);
  }).catch(err => {
    console.error('[MAIL] Error al enviar notificarProfesor:', err.message);
    throw err;
  });
}

async function notificarAdminDobleFallo({ adminEmail, adminNombre, colaboradorNombre, cursoNombre, sede }) {
  const destinatario = adminEmail || process.env.MAIL_USER;
  if (!destinatario) return;
  await transporter.sendMail({
    from: `"ALUMCO" <${process.env.MAIL_USER || 'omegabarra3236@gmail.com'}>`,
    to: destinatario,
    subject: `[ALUMCO] Colaborador bloqueado por doble fallo`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #E8505B; padding: 24px 32px; border-radius: 10px 10px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 20px;">ALUMCO — Alerta de bloqueo</h1>
        </div>
        <div style="background: #f9f9f9; padding: 28px 32px; border-radius: 0 0 10px 10px; border: 1px solid #e8e8e8;">
          <p style="color: #333; font-size: 15px;">Hola <strong>${adminNombre}</strong>,</p>
          <p style="color: #555; font-size: 14px; line-height: 1.6;">
            El colaborador <strong>${colaboradorNombre}</strong> ha fallado 2 veces la evaluación del curso
            <strong>${cursoNombre}</strong> en la sede <strong>${sede}</strong> y ha quedado bloqueado por 7 días.
          </p>
          <p style="color: #E8505B; font-size: 13px; background: #FFF5F5; padding: 10px 14px; border-radius: 6px; border: 1px solid #FECACA;">
            ⚠ Se recomienda programar un práctico de refuerzo o contactar directamente al colaborador.
          </p>
          <p style="color: #555; font-size: 13px; margin-top: 20px;">Ingresa al sistema ALUMCO para ver el detalle.</p>
        </div>
      </div>
    `
  });
}

async function enviarRecordatorioCertificados({ destinatarios }) {
  const resultados = { enviados: 0, errores: 0 };
  for (const dest of destinatarios) {
    try {
      await transporter.sendMail({
        from: `"ALUMCO" <${process.env.MAIL_USER || 'omegabarra3236@gmail.com'}>`,
        to: dest.email,
        subject: `[ALUMCO] Recordatorio: tienes cursos pendientes`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1E3A6E; padding: 24px 32px; border-radius: 10px 10px 0 0;">
              <h1 style="color: #fff; margin: 0; font-size: 20px;">ALUMCO — Capacitación pendiente</h1>
            </div>
            <div style="background: #f9f9f9; padding: 28px 32px; border-radius: 0 0 10px 10px; border: 1px solid #e8e8e8;">
              <p style="color: #333; font-size: 15px;">Hola <strong>${dest.nombre}</strong>,</p>
              <p style="color: #555; font-size: 14px; line-height: 1.6;">
                Te recordamos que tienes <strong>${dest.cursos_pendientes}</strong> curso(s) asignado(s) sin certificado aprobado.
                Es importante completarlos para mantener tu formación al día.
              </p>
              <table style="width:100%; border-collapse:collapse; margin:16px 0;">
                ${dest.cursos.map(c => `
                  <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 8px 12px; font-size: 13px; color: #333;">${c.nombre}</td>
                    <td style="padding: 8px 12px; font-size: 12px; color: ${c.estado === 'bloqueado' ? '#E8505B' : '#F5A623'}; text-align:right;">
                      ${c.estado === 'bloqueado' ? '🔒 Bloqueado' : c.estado === 'pendiente' ? '⏳ En curso' : '📋 Sin iniciar'}
                    </td>
                  </tr>`).join('')}
              </table>
              <p style="color: #555; font-size: 13px;">Ingresa a la plataforma ALUMCO para continuar con tus capacitaciones.</p>
            </div>
          </div>
        `
      });
      resultados.enviados++;
    } catch (e) {
      console.error(`Error enviando correo a ${dest.email}:`, e.message);
      resultados.errores++;
    }
  }
  return resultados;
}

module.exports = { notificarProfesor, notificarAdminDobleFallo, enviarRecordatorioCertificados };
