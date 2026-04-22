require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function seed() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'alumco',
  });

  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    // ─── SEDES ─────────────────────────────────────────────────────────────────

    const sedesData = [
      { nombre: 'ELEAM Hualpén',   ciudad: 'Hualpén'   },
      { nombre: 'ELEAM Coyhaique', ciudad: 'Coyhaique' },
      { nombre: 'ELEAM Temuco',    ciudad: 'Temuco'    },
    ];

    let sede1Id, sede2Id, sede3Id;
    for (const s of sedesData) {
      const [ex] = await conn.query('SELECT id FROM sedes WHERE nombre = ?', [s.nombre]);
      if (ex.length === 0) {
        const [r] = await conn.query('INSERT INTO sedes (nombre, ciudad) VALUES (?, ?)', [s.nombre, s.ciudad]);
        console.log(`✓ Sede: ${s.nombre}`);
        if (s.nombre === 'ELEAM Hualpén')   sede1Id = r.insertId;
        if (s.nombre === 'ELEAM Coyhaique') sede2Id = r.insertId;
        if (s.nombre === 'ELEAM Temuco')    sede3Id = r.insertId;
      } else {
        if (s.nombre === 'ELEAM Hualpén')   sede1Id = ex[0].id;
        if (s.nombre === 'ELEAM Coyhaique') sede2Id = ex[0].id;
        if (s.nombre === 'ELEAM Temuco')    sede3Id = ex[0].id;
      }
    }

    // ─── USUARIOS ──────────────────────────────────────────────────────────────

    const usuariosData = [
      { nombre: 'Administrador ALUMCO',   identificador: 'admin',             password: 'admin123',  rol: 'jefatura',    tipo_contrato: 'fijo',      sede_id: sede1Id, rango_etario: '40-49', rut: '12.345.678-9',  email: 'admin@alumco.cl',             telefono: '+56912345678', estamento: 'Dirección'          },
      { nombre: 'Ana González Rojas',     identificador: 'ana.gonzalez',      password: 'prof123',   rol: 'profesor',    tipo_contrato: 'fijo',      sede_id: sede1Id, rango_etario: '30-39', rut: '15.234.567-8',  email: 'ana.gonzalez@alumco.cl',      telefono: '+56923456789', estamento: 'Salud'              },
      { nombre: 'Roberto Fuentes Vera',   identificador: 'roberto.fuentes',   password: 'prof123',   rol: 'profesor',    tipo_contrato: 'fijo',      sede_id: sede2Id, rango_etario: '45-54', rut: '11.987.654-3',  email: 'roberto.fuentes@alumco.cl',   telefono: '+56911223344', estamento: 'Salud'              },
      { nombre: 'María Torres Vidal',     identificador: 'maria.torres',      password: 'sede123',   rol: 'admin_sede',  tipo_contrato: 'fijo',      sede_id: sede2Id, rango_etario: '35-44', rut: '14.876.543-2',  email: 'maria.torres@alumco.cl',      telefono: '+56945678901', estamento: 'Administración'     },
      { nombre: 'Jorge Rivas Campos',     identificador: 'jorge.rivas',       password: 'sede123',   rol: 'admin_sede',  tipo_contrato: 'fijo',      sede_id: sede3Id, rango_etario: '38-47', rut: '13.654.321-0',  email: 'jorge.rivas@alumco.cl',       telefono: '+56966778899', estamento: 'Administración'     },
      { nombre: 'Carlos Muñoz Pino',      identificador: 'carlos.munoz',      password: 'colab123',  rol: 'colaborador', tipo_contrato: 'fijo',      sede_id: sede1Id, rango_etario: '20-29', rut: '18.765.432-1',  email: 'carlos.munoz@alumco.cl',      telefono: '+56934567890', estamento: 'Cuidado directo'    },
      { nombre: 'Pedro Soto Leal',        identificador: 'pedro.soto',        password: 'colab123',  rol: 'colaborador', tipo_contrato: 'reemplazo', sede_id: sede2Id, rango_etario: '25-34', rut: '19.123.456-7',  email: 'pedro.soto@alumco.cl',        telefono: '+56956789012', estamento: 'Servicios generales'},
      { nombre: 'Valentina Rojas Díaz',   identificador: 'valentina.rojas',   password: 'colab123',  rol: 'colaborador', tipo_contrato: 'fijo',      sede_id: sede1Id, rango_etario: '28-37', rut: '20.345.678-K',  email: 'valentina.rojas@alumco.cl',   telefono: '+56978901234', estamento: 'Cuidado directo'    },
      { nombre: 'Luis Herrera Castillo',  identificador: 'luis.herrera',      password: 'colab123',  rol: 'colaborador', tipo_contrato: 'reemplazo', sede_id: sede3Id, rango_etario: '22-31', rut: '21.456.789-2',  email: 'luis.herrera@alumco.cl',      telefono: '+56989012345', estamento: 'Nutrición'          },
      { nombre: 'Carmen Sepúlveda Mora',  identificador: 'carmen.sepulveda',  password: 'colab123',  rol: 'colaborador', tipo_contrato: 'fijo',      sede_id: sede2Id, rango_etario: '50-59', rut: '10.234.567-4',  email: 'carmen.sepulveda@alumco.cl',  telefono: '+56990123456', estamento: 'Servicios generales'},
    ];

    const uid = {};
    for (const u of usuariosData) {
      const [ex] = await conn.query('SELECT id FROM usuarios WHERE identificador = ?', [u.identificador]);
      if (ex.length === 0) {
        const hash = bcrypt.hashSync(u.password, 10);
        const [r] = await conn.query(
          `INSERT INTO usuarios (nombre, identificador, password_hash, rol, tipo_contrato, sede_id, rango_etario, rut, email, telefono, estamento)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [u.nombre, u.identificador, hash, u.rol, u.tipo_contrato, u.sede_id, u.rango_etario, u.rut, u.email, u.telefono, u.estamento]
        );
        uid[u.identificador] = r.insertId;
        console.log(`✓ Usuario: ${u.identificador} (${u.rol}) — pass: ${u.password}`);
      } else {
        uid[u.identificador] = ex[0].id;
      }
    }

    // ─── CURSOS ────────────────────────────────────────────────────────────────

    const cursosData = [
      {
        nombre: 'Cuidado del Adulto Mayor con Demencia',
        descripcion: 'Técnicas de cuidado para personas mayores con distintos grados de demencia.',
        area: 'Salud', profesor_id: uid['ana.gonzalez'], publicado: 1, generado_por_ia: 0,
        estamento_objetivo: JSON.stringify(['Cuidado directo', 'Salud']),
        sede_objetivo: null, obligatorio: 1,
        video_intro_url: 'https://storage.alumco.cl/videos/intro-demencia.mp4'
      },
      {
        nombre: 'Prevención de Caídas en el ELEAM',
        descripcion: 'Estrategias y protocolos para reducir el riesgo de caídas en residentes.',
        area: 'Seguridad', profesor_id: uid['ana.gonzalez'], publicado: 1, generado_por_ia: 0,
        estamento_objetivo: JSON.stringify(['Cuidado directo', 'Salud', 'Servicios generales']),
        sede_objetivo: null, obligatorio: 1,
        video_intro_url: null
      },
      {
        nombre: 'Nutrición y Alimentación en el Adulto Mayor',
        descripcion: 'Principios de nutrición gerontológica y manejo de dietas especiales.',
        area: 'Nutrición', profesor_id: uid['roberto.fuentes'], publicado: 1, generado_por_ia: 0,
        estamento_objetivo: JSON.stringify(['Nutrición', 'Cuidado directo']),
        sede_objetivo: sede2Id, obligatorio: 0,
        video_intro_url: 'https://storage.alumco.cl/videos/intro-nutricion.mp4'
      },
      {
        nombre: 'Primeros Auxilios Básicos',
        descripcion: 'Técnicas esenciales de primeros auxilios aplicadas al contexto del ELEAM.',
        area: 'Salud', profesor_id: uid['roberto.fuentes'], publicado: 1, generado_por_ia: 1,
        estamento_objetivo: JSON.stringify(['Cuidado directo', 'Salud', 'Administración', 'Servicios generales']),
        sede_objetivo: null, obligatorio: 1,
        video_intro_url: null
      },
      {
        nombre: 'Manejo de Residuos y Limpieza Hospitalaria',
        descripcion: 'Protocolos de higiene, manejo de residuos y desinfección en establecimientos de larga estadía.',
        area: 'Servicios generales', profesor_id: uid['ana.gonzalez'], publicado: 0, generado_por_ia: 0,
        estamento_objetivo: JSON.stringify(['Servicios generales']),
        sede_objetivo: sede1Id, obligatorio: 0,
        video_intro_url: null
      },
    ];

    const cid = [];
    for (const c of cursosData) {
      const [ex] = await conn.query('SELECT id FROM cursos WHERE nombre = ?', [c.nombre]);
      if (ex.length === 0) {
        const [r] = await conn.query(
          `INSERT INTO cursos (nombre, descripcion, area, profesor_id, publicado, generado_por_ia, estamento_objetivo, sede_objetivo, obligatorio, video_intro_url)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [c.nombre, c.descripcion, c.area, c.profesor_id, c.publicado, c.generado_por_ia, c.estamento_objetivo, c.sede_objetivo, c.obligatorio, c.video_intro_url]
        );
        cid.push(r.insertId);
        console.log(`✓ Curso: ${c.nombre}`);
      } else {
        cid.push(ex[0].id);
      }
    }

    const [c1, c2, c3, c4, c5] = cid;

    // ─── MÓDULOS ───────────────────────────────────────────────────────────────

    const modulosData = [
      { curso_id: c1, orden: 1, tipo: 'pdf',   titulo: 'Introducción a la Demencia',          descripcion: 'Tipos, etapas y síntomas.',                             archivo_url: 'https://storage.alumco.cl/modulos/demencia-intro.pdf',          contenido_presentacion: null },
      { curso_id: c1, orden: 2, tipo: 'video',  titulo: 'Comunicación con el Paciente',        descripcion: 'Técnicas de comunicación no verbal.',                   archivo_url: 'https://storage.alumco.cl/modulos/demencia-comunicacion.mp4',   contenido_presentacion: null },
      { curso_id: c1, orden: 3, tipo: 'ppt',    titulo: 'Manejo de Conductas Difíciles',       descripcion: 'Estrategias para situaciones de agitación.',             archivo_url: 'https://storage.alumco.cl/modulos/demencia-conductas.pptx',    contenido_presentacion: JSON.stringify([{ slide: 1, titulo: 'Conductas difíciles', texto: 'Agitación, vagabundeo y agresividad.' }, { slide: 2, titulo: 'Estrategias clave', texto: 'Redirección, ambiente seguro y validación emocional.' }]) },
      { curso_id: c2, orden: 1, tipo: 'pdf',    titulo: 'Factores de Riesgo de Caídas',        descripcion: 'Identificación de riesgos intrínsecos y extrínsecos.',   archivo_url: 'https://storage.alumco.cl/modulos/caidas-riesgos.pdf',          contenido_presentacion: null },
      { curso_id: c2, orden: 2, tipo: 'video',  titulo: 'Evaluación del Entorno Físico',       descripcion: 'Inspección de habitaciones, baños y pasillos.',          archivo_url: 'https://storage.alumco.cl/modulos/caidas-entorno.mp4',          contenido_presentacion: null },
      { curso_id: c3, orden: 1, tipo: 'pdf',    titulo: 'Necesidades Nutricionales del AM',    descripcion: 'Macro y micronutrientes esenciales.',                    archivo_url: 'https://storage.alumco.cl/modulos/nutricion-necesidades.pdf',   contenido_presentacion: null },
      { curso_id: c3, orden: 2, tipo: 'ppt',    titulo: 'Dietas Especiales y Texturizadas',    descripcion: 'Adaptaciones para disfagia y otras patologías.',         archivo_url: 'https://storage.alumco.cl/modulos/nutricion-dietas.pptx',      contenido_presentacion: JSON.stringify([{ slide: 1, titulo: 'Disfagia', texto: 'Clasificación IDDSI y adaptaciones de textura.' }, { slide: 2, titulo: 'Diabetes en el AM', texto: 'Dieta hipocalórica y control glucémico.' }]) },
      { curso_id: c4, orden: 1, tipo: 'video',  titulo: 'RCP Básico',                          descripcion: 'Reanimación cardiopulmonar con y sin DEA.',              archivo_url: 'https://storage.alumco.cl/modulos/primeros-aux-rcp.mp4',        contenido_presentacion: null },
      { curso_id: c4, orden: 2, tipo: 'pdf',    titulo: 'Manejo de Heridas y Hemorragias',     descripcion: 'Protocolos de hemostasia y vendaje.',                    archivo_url: 'https://storage.alumco.cl/modulos/primeros-aux-heridas.pdf',    contenido_presentacion: null },
      { curso_id: c5, orden: 1, tipo: 'pdf',    titulo: 'Clasificación de Residuos',           descripcion: 'Tipos de residuos en centros de salud.',                 archivo_url: 'https://storage.alumco.cl/modulos/residuos-clasificacion.pdf',  contenido_presentacion: null },
    ];

    for (const m of modulosData) {
      const [ex] = await conn.query('SELECT id FROM modulos WHERE curso_id = ? AND titulo = ?', [m.curso_id, m.titulo]);
      if (ex.length === 0) {
        await conn.query(
          `INSERT INTO modulos (curso_id, titulo, descripcion, contenido_presentacion, tipo, archivo_url, orden)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [m.curso_id, m.titulo, m.descripcion, m.contenido_presentacion, m.tipo, m.archivo_url, m.orden]
        );
      }
    }
    console.log('✓ Módulos insertados');

    // ─── PREGUNTAS ─────────────────────────────────────────────────────────────

    const preguntasData = [
      { curso_id: c1, texto: '¿Cuál es la etapa más avanzada de la demencia de Alzheimer?',
        alternativas: JSON.stringify([{ texto: 'Etapa leve', correcta: false }, { texto: 'Etapa moderada', correcta: false }, { texto: 'Etapa grave', correcta: true }, { texto: 'Etapa temprana', correcta: false }]) },
      { curso_id: c1, texto: '¿Qué técnica es más efectiva para comunicarse con una persona con demencia avanzada?',
        alternativas: JSON.stringify([{ texto: 'Comunicación verbal extensa', correcta: false }, { texto: 'Comunicación no verbal y contacto visual', correcta: true }, { texto: 'Ignorar las respuestas del paciente', correcta: false }, { texto: 'Hablar en voz alta y rápido', correcta: false }]) },
      { curso_id: c1, texto: '¿Cuál de las siguientes es una conducta difícil frecuente en la demencia?',
        alternativas: JSON.stringify([{ texto: 'Hipertensión', correcta: false }, { texto: 'Agitación nocturna', correcta: true }, { texto: 'Aumento del apetito', correcta: false }, { texto: 'Mejora de la memoria', correcta: false }]) },
      { curso_id: c2, texto: '¿Cuál es el factor de riesgo extrínseco más común de caídas en el ELEAM?',
        alternativas: JSON.stringify([{ texto: 'Debilidad muscular', correcta: false }, { texto: 'Suelos mojados y sin antideslizantes', correcta: true }, { texto: 'Problemas de visión', correcta: false }, { texto: 'Hipotensión ortostática', correcta: false }]) },
      { curso_id: c2, texto: '¿Qué elemento reduce significativamente el riesgo de caída en el baño?',
        alternativas: JSON.stringify([{ texto: 'Espejo grande', correcta: false }, { texto: 'Barras de apoyo', correcta: true }, { texto: 'Alfombra gruesa', correcta: false }, { texto: 'Luz tenue', correcta: false }]) },
      { curso_id: c3, texto: '¿Qué vitamina es esencial para la absorción del calcio en adultos mayores?',
        alternativas: JSON.stringify([{ texto: 'Vitamina C', correcta: false }, { texto: 'Vitamina B12', correcta: false }, { texto: 'Vitamina D', correcta: true }, { texto: 'Vitamina K', correcta: false }]) },
      { curso_id: c3, texto: '¿Cuál es el nivel IDDSI para disfagia severa?',
        alternativas: JSON.stringify([{ texto: 'Nivel 3 - Líquido espeso', correcta: false }, { texto: 'Nivel 4 - Puré', correcta: false }, { texto: 'Nivel 5 - Picado y húmedo', correcta: false }, { texto: 'Nivel 6 - Blando y que se parte', correcta: true }]) },
      { curso_id: c4, texto: '¿Cuántas compresiones por minuto se realizan durante la RCP?',
        alternativas: JSON.stringify([{ texto: '60-80 compresiones/min', correcta: false }, { texto: '100-120 compresiones/min', correcta: true }, { texto: '80-100 compresiones/min', correcta: false }, { texto: '50-70 compresiones/min', correcta: false }]) },
      { curso_id: c4, texto: '¿Cuál es la relación compresiones-ventilaciones en RCP adultos?',
        alternativas: JSON.stringify([{ texto: '15:2', correcta: false }, { texto: '20:2', correcta: false }, { texto: '30:2', correcta: true }, { texto: '10:1', correcta: false }]) },
      { curso_id: c5, texto: '¿En qué contenedor se depositan los residuos cortopunzantes?',
        alternativas: JSON.stringify([{ texto: 'Bolsa negra', correcta: false }, { texto: 'Bolsa roja', correcta: false }, { texto: 'Guardián rígido amarillo', correcta: true }, { texto: 'Bolsa verde', correcta: false }]) },
    ];

    for (const p of preguntasData) {
      const [ex] = await conn.query('SELECT id FROM preguntas WHERE curso_id = ? AND texto = ?', [p.curso_id, p.texto]);
      if (ex.length === 0) {
        await conn.query(
          'INSERT INTO preguntas (curso_id, texto, alternativas) VALUES (?, ?, ?)',
          [p.curso_id, p.texto, p.alternativas]
        );
      }
    }
    console.log('✓ Preguntas insertadas');

    // ─── ASIGNACIONES ──────────────────────────────────────────────────────────

    const asignacionesData = [
      { usuario_id: uid['carlos.munoz'],     curso_id: c1, obligatorio: 1, fecha_limite: '2026-06-30', estamento: 'Cuidado directo'     },
      { usuario_id: uid['carlos.munoz'],     curso_id: c2, obligatorio: 1, fecha_limite: '2026-06-30', estamento: 'Cuidado directo'     },
      { usuario_id: uid['carlos.munoz'],     curso_id: c4, obligatorio: 1, fecha_limite: '2026-07-31', estamento: 'Cuidado directo'     },
      { usuario_id: uid['pedro.soto'],       curso_id: c2, obligatorio: 1, fecha_limite: '2026-06-30', estamento: 'Servicios generales' },
      { usuario_id: uid['pedro.soto'],       curso_id: c4, obligatorio: 1, fecha_limite: '2026-07-31', estamento: 'Servicios generales' },
      { usuario_id: uid['pedro.soto'],       curso_id: c5, obligatorio: 0, fecha_limite: null,         estamento: 'Servicios generales' },
      { usuario_id: uid['valentina.rojas'],  curso_id: c1, obligatorio: 1, fecha_limite: '2026-06-30', estamento: 'Cuidado directo'     },
      { usuario_id: uid['valentina.rojas'],  curso_id: c2, obligatorio: 1, fecha_limite: '2026-06-30', estamento: 'Cuidado directo'     },
      { usuario_id: uid['luis.herrera'],     curso_id: c3, obligatorio: 0, fecha_limite: '2026-08-31', estamento: 'Nutrición'           },
      { usuario_id: uid['luis.herrera'],     curso_id: c4, obligatorio: 1, fecha_limite: '2026-07-31', estamento: 'Nutrición'           },
      { usuario_id: uid['carmen.sepulveda'], curso_id: c2, obligatorio: 1, fecha_limite: '2026-06-30', estamento: 'Servicios generales' },
      { usuario_id: uid['carmen.sepulveda'], curso_id: c5, obligatorio: 1, fecha_limite: '2026-05-31', estamento: 'Servicios generales' },
      { usuario_id: uid['ana.gonzalez'],     curso_id: c1, obligatorio: 0, fecha_limite: null,         estamento: 'Salud'               },
      { usuario_id: uid['roberto.fuentes'],  curso_id: c4, obligatorio: 0, fecha_limite: null,         estamento: 'Salud'               },
    ];

    for (const a of asignacionesData) {
      await conn.query(
        `INSERT IGNORE INTO asignaciones (usuario_id, curso_id, obligatorio, fecha_limite, estamento)
         VALUES (?, ?, ?, ?, ?)`,
        [a.usuario_id, a.curso_id, a.obligatorio, a.fecha_limite, a.estamento]
      );
    }
    console.log('✓ Asignaciones insertadas');

    // ─── PROGRESO ──────────────────────────────────────────────────────────────

    const progresoData = [
      { usuario_id: uid['carlos.munoz'],     curso_id: c1, completado: 1, porcentaje: 100, ultimo_acceso: '2026-04-10 14:30:00', intentos_fallidos: 0, bloqueado_hasta: null               },
      { usuario_id: uid['carlos.munoz'],     curso_id: c2, completado: 0, porcentaje: 60,  ultimo_acceso: '2026-04-18 09:15:00', intentos_fallidos: 1, bloqueado_hasta: null               },
      { usuario_id: uid['carlos.munoz'],     curso_id: c4, completado: 0, porcentaje: 30,  ultimo_acceso: '2026-04-20 11:00:00', intentos_fallidos: 0, bloqueado_hasta: null               },
      { usuario_id: uid['pedro.soto'],       curso_id: c2, completado: 1, porcentaje: 100, ultimo_acceso: '2026-04-05 16:45:00', intentos_fallidos: 0, bloqueado_hasta: null               },
      { usuario_id: uid['pedro.soto'],       curso_id: c4, completado: 0, porcentaje: 0,   ultimo_acceso: null,                  intentos_fallidos: 0, bloqueado_hasta: null               },
      { usuario_id: uid['valentina.rojas'],  curso_id: c1, completado: 1, porcentaje: 100, ultimo_acceso: '2026-04-12 10:00:00', intentos_fallidos: 2, bloqueado_hasta: null               },
      { usuario_id: uid['valentina.rojas'],  curso_id: c2, completado: 0, porcentaje: 45,  ultimo_acceso: '2026-04-19 13:20:00', intentos_fallidos: 0, bloqueado_hasta: null               },
      { usuario_id: uid['luis.herrera'],     curso_id: c3, completado: 0, porcentaje: 80,  ultimo_acceso: '2026-04-21 08:30:00', intentos_fallidos: 0, bloqueado_hasta: null               },
      { usuario_id: uid['carmen.sepulveda'], curso_id: c5, completado: 0, porcentaje: 20,  ultimo_acceso: '2026-04-15 17:00:00', intentos_fallidos: 3, bloqueado_hasta: '2026-04-22 17:00:00' },
      { usuario_id: uid['ana.gonzalez'],     curso_id: c1, completado: 1, porcentaje: 100, ultimo_acceso: '2026-03-01 09:00:00', intentos_fallidos: 0, bloqueado_hasta: null               },
    ];

    for (const p of progresoData) {
      await conn.query(
        `INSERT IGNORE INTO progreso (usuario_id, curso_id, completado, porcentaje, ultimo_acceso, intentos_fallidos, bloqueado_hasta)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [p.usuario_id, p.curso_id, p.completado, p.porcentaje, p.ultimo_acceso, p.intentos_fallidos, p.bloqueado_hasta]
      );
    }
    console.log('✓ Progreso insertado');

    // ─── INTENTOS ──────────────────────────────────────────────────────────────

    const intentosData = [
      { usuario_id: uid['carlos.munoz'],    curso_id: c1, numero_intento: 1, nota: 55,  aprobado: 0, fecha: '2026-04-08 14:00:00', respuestas: JSON.stringify([{ pregunta_id: 1, seleccion: 1 }, { pregunta_id: 2, seleccion: 0 }, { pregunta_id: 3, seleccion: 1 }]) },
      { usuario_id: uid['carlos.munoz'],    curso_id: c1, numero_intento: 2, nota: 80,  aprobado: 1, fecha: '2026-04-10 14:00:00', respuestas: JSON.stringify([{ pregunta_id: 1, seleccion: 2 }, { pregunta_id: 2, seleccion: 1 }, { pregunta_id: 3, seleccion: 1 }]) },
      { usuario_id: uid['pedro.soto'],      curso_id: c2, numero_intento: 1, nota: 90,  aprobado: 1, fecha: '2026-04-05 16:00:00', respuestas: JSON.stringify([{ pregunta_id: 4, seleccion: 1 }, { pregunta_id: 5, seleccion: 1 }]) },
      { usuario_id: uid['valentina.rojas'], curso_id: c1, numero_intento: 1, nota: 40,  aprobado: 0, fecha: '2026-04-09 10:00:00', respuestas: JSON.stringify([{ pregunta_id: 1, seleccion: 0 }, { pregunta_id: 2, seleccion: 0 }, { pregunta_id: 3, seleccion: 0 }]) },
      { usuario_id: uid['valentina.rojas'], curso_id: c1, numero_intento: 2, nota: 60,  aprobado: 0, fecha: '2026-04-10 11:00:00', respuestas: JSON.stringify([{ pregunta_id: 1, seleccion: 2 }, { pregunta_id: 2, seleccion: 0 }, { pregunta_id: 3, seleccion: 1 }]) },
      { usuario_id: uid['valentina.rojas'], curso_id: c1, numero_intento: 3, nota: 85,  aprobado: 1, fecha: '2026-04-12 10:00:00', respuestas: JSON.stringify([{ pregunta_id: 1, seleccion: 2 }, { pregunta_id: 2, seleccion: 1 }, { pregunta_id: 3, seleccion: 1 }]) },
      { usuario_id: uid['ana.gonzalez'],    curso_id: c1, numero_intento: 1, nota: 100, aprobado: 1, fecha: '2026-03-01 09:00:00', respuestas: JSON.stringify([{ pregunta_id: 1, seleccion: 2 }, { pregunta_id: 2, seleccion: 1 }, { pregunta_id: 3, seleccion: 1 }]) },
    ];

    const intentoIds = [];
    for (const i of intentosData) {
      const [r] = await conn.query(
        `INSERT INTO intentos (usuario_id, curso_id, numero_intento, respuestas, nota, aprobado, fecha)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [i.usuario_id, i.curso_id, i.numero_intento, i.respuestas, i.nota, i.aprobado, i.fecha]
      );
      intentoIds.push({ id: r.insertId, ...i });
    }
    console.log('✓ Intentos insertados');

    // ─── CERTIFICADOS ──────────────────────────────────────────────────────────

    const aprobados = intentoIds.filter(i => i.aprobado === 1);
    const certData = [
      { i: aprobados[0], estado: 'aprobado',  archivo: 'https://storage.alumco.cl/certs/cert-carlos-c1.pdf',    fecha: '2026-04-11 10:00:00', validado_por: uid['admin'] },
      { i: aprobados[1], estado: 'aprobado',  archivo: 'https://storage.alumco.cl/certs/cert-pedro-c2.pdf',     fecha: '2026-04-06 09:00:00', validado_por: uid['admin'] },
      { i: aprobados[2], estado: 'pendiente', archivo: null,                                                     fecha: null,                  validado_por: null         },
      { i: aprobados[3], estado: 'aprobado',  archivo: 'https://storage.alumco.cl/certs/cert-ana-c1.pdf',       fecha: '2026-03-02 09:00:00', validado_por: uid['admin'] },
    ];

    for (const c of certData) {
      if (!c.i) continue;
      await conn.query(
        `INSERT INTO certificados (usuario_id, curso_id, intento_id, validado_por, estado, archivo_url, fecha_emision)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [c.i.usuario_id, c.i.curso_id, c.i.id, c.validado_por, c.estado, c.archivo, c.fecha]
      );
    }
    console.log('✓ Certificados insertados');

    // ─── PRÁCTICOS ─────────────────────────────────────────────────────────────

    const practicosData = [
      { curso_id: c1, sede_id: sede1Id, titulo: 'Taller: Comunicación con paciente con demencia',  descripcion: 'Simulación de interacciones con residentes en distintas etapas de demencia.',        fecha: '2026-05-15', hora_inicio: '09:00:00', hora_fin: '12:00:00', lugar: 'Sala de capacitación ELEAM Hualpén',  creado_por: uid['ana.gonzalez']    },
      { curso_id: c2, sede_id: sede2Id, titulo: 'Simulacro de prevención de caídas',               descripcion: 'Recorrido de identificación de riesgos y práctica de protocolo en caída.',          fecha: '2026-05-22', hora_inicio: '10:00:00', hora_fin: '13:00:00', lugar: 'Pasillos y baños ELEAM Coyhaique',    creado_por: uid['roberto.fuentes'] },
      { curso_id: c4, sede_id: sede1Id, titulo: 'Práctica de RCP con maniquí',                     descripcion: 'Entrenamiento certificado en RCP básico con uso de DEA.',                           fecha: '2026-06-05', hora_inicio: '08:30:00', hora_fin: '11:30:00', lugar: 'Patio cubierto ELEAM Hualpén',        creado_por: uid['ana.gonzalez']    },
    ];

    const practicoIds = [];
    for (const p of practicosData) {
      const [ex] = await conn.query('SELECT id FROM practicos WHERE titulo = ? AND fecha = ?', [p.titulo, p.fecha]);
      if (ex.length === 0) {
        const [r] = await conn.query(
          `INSERT INTO practicos (curso_id, sede_id, titulo, descripcion, fecha, hora_inicio, hora_fin, lugar, creado_por)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [p.curso_id, p.sede_id, p.titulo, p.descripcion, p.fecha, p.hora_inicio, p.hora_fin, p.lugar, p.creado_por]
        );
        practicoIds.push(r.insertId);
        console.log(`✓ Práctico: ${p.titulo}`);
      } else {
        practicoIds.push(ex[0].id);
      }
    }

    // ─── NOTIFICACIONES ────────────────────────────────────────────────────────

    const [prac1, prac2, prac3] = practicoIds;
    const notificacionesData = [
      { usuario_id: uid['carlos.munoz'],     practico_id: prac1, titulo: 'Nuevo taller programado',          mensaje: 'Taller "Comunicación con paciente con demencia" agendado para el 15/05/2026 a las 09:00 en ELEAM Hualpén.',    leida: 0 },
      { usuario_id: uid['valentina.rojas'],  practico_id: prac1, titulo: 'Nuevo taller programado',          mensaje: 'Taller "Comunicación con paciente con demencia" agendado para el 15/05/2026 a las 09:00 en ELEAM Hualpén.',    leida: 1 },
      { usuario_id: uid['pedro.soto'],       practico_id: prac2, titulo: 'Simulacro de prevención de caídas', mensaje: 'Recuerda asistir al simulacro de caídas el 22/05/2026 en ELEAM Coyhaique.',                                   leida: 0 },
      { usuario_id: uid['carmen.sepulveda'], practico_id: prac2, titulo: 'Simulacro de prevención de caídas', mensaje: 'Recuerda asistir al simulacro de caídas el 22/05/2026 en ELEAM Coyhaique.',                                   leida: 0 },
      { usuario_id: uid['carlos.munoz'],     practico_id: prac3, titulo: 'Práctica de RCP agendada',          mensaje: 'Práctica de RCP con maniquí programada para el 05/06/2026 a las 08:30 en ELEAM Hualpén.',                      leida: 0 },
      { usuario_id: uid['valentina.rojas'],  practico_id: prac3, titulo: 'Práctica de RCP agendada',          mensaje: 'Práctica de RCP con maniquí programada para el 05/06/2026 a las 08:30 en ELEAM Hualpén.',                      leida: 0 },
    ];

    for (const n of notificacionesData) {
      await conn.query(
        `INSERT INTO notificaciones (usuario_id, practico_id, titulo, mensaje, leida)
         VALUES (?, ?, ?, ?, ?)`,
        [n.usuario_id, n.practico_id, n.titulo, n.mensaje, n.leida]
      );
    }
    console.log('✓ Notificaciones insertadas');

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('\n✓ Seed completo — todas las tablas pobladas con datos ficticios');
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('✗ Error en seed:', err.message);
    await conn.end();
    process.exit(1);
  }
}

seed();
