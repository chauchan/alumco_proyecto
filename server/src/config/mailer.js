const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER || 'omegabarra3236@gmail.com',
    pass: process.env.MAIL_PASS
  },
  tls: { rejectUnauthorized: false }
});

async function notificarProfesor({ profesorEmail, profesorNombre, cursoNombre, cursoId, modulosCount, preguntasCount, nombreArchivo, subidoPor }) {
  const destinatario = profesorEmail || process.env.MAIL_USER || 'omegabarra3236@gmail.com';

  await transporter.sendMail({
    from: `"${process.env.MAIL_FROM_NAME || 'ALUMCO'}" <${process.env.MAIL_USER || 'omegabarra3236@gmail.com'}>`,
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
  });
}

async function enviarResetPassword(email, link, nombre) {
  await transporter.sendMail({
    from: `"${process.env.MAIL_FROM_NAME || 'ALUMCO'}" <${process.env.MAIL_USER || 'omegabarra3236@gmail.com'}>`,
    to: email,
    subject: '[ALUMCO] Recuperación de contraseña',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1E3A6E; padding: 24px 32px; border-radius: 10px 10px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 20px;">ALUMCO — Recuperación de contraseña</h1>
        </div>
        <div style="background: #f9f9f9; padding: 28px 32px; border-radius: 0 0 10px 10px; border: 1px solid #e8e8e8;">
          <p style="color: #333; font-size: 15px;">Hola <strong>${nombre}</strong>,</p>
          <p style="color: #555; font-size: 14px; line-height: 1.6;">
            Recibimos una solicitud para restablecer la contraseña de tu cuenta ALUMCO.
            Este enlace expirará en <strong>30 minutos</strong>.
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${link}"
               style="background: #2B4BA0; color: #fff; padding: 12px 28px; border-radius: 8px;
                      text-decoration: none; font-size: 14px; font-weight: 500; display: inline-block;">
              Restablecer contraseña
            </a>
          </div>
          <p style="color: #aaa; font-size: 12px;">
            Si no solicitaste restablecer tu contraseña, ignora este correo. Tu contraseña no será cambiada.
          </p>
        </div>
      </div>
    `
  });
}

async function enviarRecordatorioCertificados(email, nombre, cursosPendientes) {
  const listaCursos = cursosPendientes
    .map(c => `<li style="padding:4px 0; font-size:13px; color:#333;">${c}</li>`)
    .join('');
  await transporter.sendMail({
    from: `"${process.env.MAIL_FROM_NAME || 'ALUMCO'}" <${process.env.MAIL_USER || 'omegabarra3236@gmail.com'}>`,
    to: email,
    subject: '[ALUMCO] Recordatorio: tienes capacitaciones pendientes',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1E3A6E; padding: 24px 32px; border-radius: 10px 10px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 20px;">ALUMCO — Capacitaciones pendientes</h1>
        </div>
        <div style="background: #f9f9f9; padding: 28px 32px; border-radius: 0 0 10px 10px; border: 1px solid #e8e8e8;">
          <p style="color: #333; font-size: 15px;">Hola <strong>${nombre}</strong>,</p>
          <p style="color: #555; font-size: 14px; line-height: 1.6;">
            Te recordamos que tienes los siguientes cursos asignados pendientes de completar:
          </p>
          <ul style="margin: 16px 0; padding-left: 20px; border-left: 3px solid #2B4BA0;">
            ${listaCursos}
          </ul>
          <p style="color: #555; font-size: 14px;">
            Ingresa a la plataforma ALUMCO para completar tus capacitaciones y obtener tus certificados.
          </p>
          <p style="color: #aaa; font-size: 12px; margin-top: 24px;">
            Este es un recordatorio automático. Si ya completaste alguno de estos cursos, ignora este mensaje.
          </p>
        </div>
      </div>
    `
  });
}

async function enviarBloqueo(email, nombreDestinatario, nombreColab, nombreCurso) {
  await transporter.sendMail({
    from: `"${process.env.MAIL_FROM_NAME || 'ALUMCO'}" <${process.env.MAIL_USER || 'omegabarra3236@gmail.com'}>`,
    to: email,
    subject: `[ALUMCO] Colaborador bloqueado en "${nombreCurso}"`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #C0392B; padding: 24px 32px; border-radius: 10px 10px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 20px;">ALUMCO — Alerta de bloqueo</h1>
        </div>
        <div style="background: #f9f9f9; padding: 28px 32px; border-radius: 0 0 10px 10px; border: 1px solid #e8e8e8;">
          <p style="color: #333; font-size: 15px;">Hola <strong>${nombreDestinatario}</strong>,</p>
          <p style="color: #555; font-size: 14px; line-height: 1.6;">
            El colaborador <strong>${nombreColab}</strong> ha fallado dos veces consecutivas en el curso
            "<strong>${nombreCurso}</strong>" y ha sido bloqueado temporalmente.
          </p>
          <div style="background: #FFF0F0; border-left: 3px solid #E8505B; padding: 10px 14px; border-radius: 0 6px 6px 0; margin: 16px 0;">
            <p style="color: #555; font-size: 13px; margin: 0;">
              Ingresa al sistema ALUMCO para revisar el caso y desbloquear al colaborador si lo consideras necesario.
            </p>
          </div>
          <p style="color: #aaa; font-size: 12px; margin-top: 20px;">
            Este es un aviso automático del sistema de capacitación ALUMCO.
          </p>
        </div>
      </div>
    `
  });
}

async function enviarDesbloqueo(email, nombreColab, nombreCurso) {
  await transporter.sendMail({
    from: `"${process.env.MAIL_FROM_NAME || 'ALUMCO'}" <${process.env.MAIL_USER || 'omegabarra3236@gmail.com'}>`,
    to: email,
    subject: `[ALUMCO] Tu acceso al curso "${nombreCurso}" ha sido restaurado`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1A7A45; padding: 24px 32px; border-radius: 10px 10px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 20px;">ALUMCO — Acceso restaurado</h1>
        </div>
        <div style="background: #f9f9f9; padding: 28px 32px; border-radius: 0 0 10px 10px; border: 1px solid #e8e8e8;">
          <p style="color: #333; font-size: 15px;">Hola <strong>${nombreColab}</strong>,</p>
          <p style="color: #555; font-size: 14px; line-height: 1.6;">
            Tu acceso al curso <strong>"${nombreCurso}"</strong> ha sido restaurado.
            Ya puedes ingresar y volver a intentar la evaluación.
          </p>
          <p style="color: #aaa; font-size: 12px; margin-top: 20px;">
            Este es un aviso automático del sistema de capacitación ALUMCO.
          </p>
        </div>
      </div>
    `
  });
}

async function enviarPracticoAsignado({ email, nombre, titulo, cursoNombre, fechaFormateada, horaInicio, horaFin, lugar, descripcion }) {
  const horario = horaFin ? `${horaInicio} — ${horaFin}` : horaInicio;
  await transporter.sendMail({
    from: `"${process.env.MAIL_FROM_NAME || 'ALUMCO'}" <${process.env.MAIL_USER || 'omegabarra3236@gmail.com'}>`,
    to: email,
    subject: `[ALUMCO] Práctico programado: ${titulo}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1E3A6E; padding: 24px 32px; border-radius: 10px 10px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 20px;">ALUMCO — Práctico programado</h1>
        </div>
        <div style="background: #f9f9f9; padding: 28px 32px; border-radius: 0 0 10px 10px; border: 1px solid #e8e8e8;">
          <p style="color: #333; font-size: 15px;">Hola <strong>${nombre}</strong>,</p>
          <p style="color: #555; font-size: 14px; line-height: 1.6;">
            Se ha programado un práctico al que estás asignado(a). Te dejamos los detalles a continuación:
          </p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #fff; border-bottom: 1px solid #eee;">
              <td style="padding: 10px 14px; font-size: 13px; color: #888; width: 35%;">Práctico</td>
              <td style="padding: 10px 14px; font-size: 13px; color: #222; font-weight: bold;">${titulo}</td>
            </tr>
            ${cursoNombre ? `
            <tr style="background: #f4f5f7; border-bottom: 1px solid #eee;">
              <td style="padding: 10px 14px; font-size: 13px; color: #888;">Curso</td>
              <td style="padding: 10px 14px; font-size: 13px; color: #222;">${cursoNombre}</td>
            </tr>` : ''}
            <tr style="background: #fff; border-bottom: 1px solid #eee;">
              <td style="padding: 10px 14px; font-size: 13px; color: #888;">Fecha</td>
              <td style="padding: 10px 14px; font-size: 13px; color: #222;">${fechaFormateada}</td>
            </tr>
            <tr style="background: #f4f5f7; border-bottom: 1px solid #eee;">
              <td style="padding: 10px 14px; font-size: 13px; color: #888;">Horario</td>
              <td style="padding: 10px 14px; font-size: 13px; color: #222;">${horario}</td>
            </tr>
            ${lugar ? `
            <tr style="background: #fff; border-bottom: 1px solid #eee;">
              <td style="padding: 10px 14px; font-size: 13px; color: #888;">Lugar</td>
              <td style="padding: 10px 14px; font-size: 13px; color: #222;">${lugar}</td>
            </tr>` : ''}
            ${descripcion ? `
            <tr style="background: #f4f5f7;">
              <td style="padding: 10px 14px; font-size: 13px; color: #888;">Detalles</td>
              <td style="padding: 10px 14px; font-size: 13px; color: #222;">${descripcion}</td>
            </tr>` : ''}
          </table>
          <p style="color: #555; font-size: 13px; margin-top: 20px;">
            Ingresa al sistema ALUMCO para más información.
          </p>
          <p style="color: #aaa; font-size: 12px; margin-top: 20px;">
            Este es un aviso automático del sistema de capacitación ALUMCO.
          </p>
        </div>
      </div>
    `
  });
}

module.exports = { notificarProfesor, enviarResetPassword, enviarRecordatorioCertificados, enviarBloqueo, enviarDesbloqueo, enviarPracticoAsignado };
