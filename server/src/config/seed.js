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

    async function upsert(table, col, valor) {
      const [ex] = await conn.query(`SELECT id FROM ${table} WHERE ${col} = ?`, [valor]);
      if (ex.length) return ex[0].id;
      const [r] = await conn.query(`INSERT INTO ${table} (${col}) VALUES (?)`, [valor]);
      return r.insertId;
    }

    // ── Catálogos ──────────────────────────────────────────────────────────────

    const eid = {};
    for (const n of ['Dirección','Salud','Administración','Cuidado directo','Servicios generales','Nutrición'])
      eid[n] = await upsert('estamentos', 'nombre', n);
    console.log('✓ Estamentos');

    const aid = {};
    for (const n of ['Salud','Seguridad','Nutrición','Servicios generales'])
      aid[n] = await upsert('areas', 'nombre', n);
    console.log('✓ Áreas');

    // ── Sedes ──────────────────────────────────────────────────────────────────

    const sid = {};
    for (const [nombre, ciudad] of [['ELEAM Hualpén','Hualpén'],['ELEAM Coyhaique','Coyhaique']]) {
      const [ex] = await conn.query('SELECT id FROM sedes WHERE nombre = ?', [nombre]);
      if (ex.length) { sid[nombre] = ex[0].id; continue; }
      const [r] = await conn.query('INSERT INTO sedes (nombre, ciudad) VALUES (?,?)', [nombre, ciudad]);
      sid[nombre] = r.insertId;
      console.log(`✓ Sede: ${nombre}`);
    }

    // ── Usuarios ───────────────────────────────────────────────────────────────

    const usuariosData = [
      { nombre:'Administrador ALUMCO',  id:'admin',            pw:'admin123', rol:'jefatura',   tc:'fijo',      sede:'ELEAM Hualpén',   re:'40-49', rut:'12.345.678-9', email:'admin@alumco.cl',            tel:'+56912345678', est:'Dirección'          },
      { nombre:'Ana González Rojas',    id:'ana.gonzalez',     pw:'prof123',  rol:'profesor',   tc:'fijo',      sede:'ELEAM Hualpén',   re:'30-39', rut:'15.234.567-8', email:'ana.gonzalez@alumco.cl',     tel:'+56923456789', est:'Salud'              },
      { nombre:'Roberto Fuentes Vera',  id:'roberto.fuentes',  pw:'prof123',  rol:'profesor',   tc:'fijo',      sede:'ELEAM Coyhaique', re:'45-54', rut:'11.987.654-3', email:'roberto.fuentes@alumco.cl',  tel:'+56911223344', est:'Salud'              },
      { nombre:'María Torres Vidal',    id:'maria.torres',     pw:'sede123',  rol:'admin_sede', tc:'fijo',      sede:'ELEAM Coyhaique', re:'35-44', rut:'14.876.543-2', email:'maria.torres@alumco.cl',     tel:'+56945678901', est:'Administración'     },
      { nombre:'Carlos Muñoz Pino',     id:'carlos.munoz',     pw:'colab123', rol:'colaborador',tc:'fijo',      sede:'ELEAM Hualpén',   re:'20-29', rut:'18.765.432-1', email:'carlos.munoz@alumco.cl',     tel:'+56934567890', est:'Cuidado directo'    },
      { nombre:'Pedro Soto Leal',       id:'pedro.soto',       pw:'colab123', rol:'colaborador',tc:'reemplazo', sede:'ELEAM Coyhaique', re:'25-34', rut:'19.123.456-7', email:'pedro.soto@alumco.cl',       tel:'+56956789012', est:'Servicios generales'},
      { nombre:'Valentina Rojas Díaz',  id:'valentina.rojas',  pw:'colab123', rol:'colaborador',tc:'fijo',      sede:'ELEAM Hualpén',   re:'28-37', rut:'20.345.678-K', email:'valentina.rojas@alumco.cl',  tel:'+56978901234', est:'Cuidado directo'    },
      { nombre:'Carmen Sepúlveda Mora', id:'carmen.sepulveda', pw:'colab123', rol:'colaborador',tc:'fijo',      sede:'ELEAM Coyhaique', re:'50-59', rut:'10.234.567-4', email:'carmen.sepulveda@alumco.cl', tel:'+56990123456', est:'Servicios generales'},
    ];

    const uid = {};
    for (const u of usuariosData) {
      const [ex] = await conn.query('SELECT id FROM usuarios WHERE identificador = ?', [u.id]);
      if (ex.length) { uid[u.id] = ex[0].id; continue; }
      const hash = bcrypt.hashSync(u.pw, 10);
      const [r] = await conn.query(
        `INSERT INTO usuarios (nombre,identificador,password_hash,rol,tipo_contrato,sede_id,rango_etario,rut,email,telefono,estamento_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [u.nombre,u.id,hash,u.rol,u.tc,sid[u.sede],u.re,u.rut,u.email,u.tel,eid[u.est]]
      );
      uid[u.id] = r.insertId;
      console.log(`✓ Usuario: ${u.id} (${u.rol}) — pass: ${u.pw}`);
    }

    // ── Cursos ─────────────────────────────────────────────────────────────────

    const cursosData = [
      { key:'c1', nombre:'Cuidado del Adulto Mayor con Demencia',         descripcion:'Técnicas de cuidado para personas mayores con distintos grados de demencia.',                       area:'Salud',             profesor:'ana.gonzalez',    pub:1, ia:0, sede_obj:null,            obl:1, video:'https://storage.alumco.cl/videos/intro-demencia.mp4',  ests:['Cuidado directo','Salud'] },
      { key:'c2', nombre:'Prevención de Caídas en el ELEAM',              descripcion:'Estrategias y protocolos para reducir el riesgo de caídas en residentes.',                          area:'Seguridad',         profesor:'ana.gonzalez',    pub:1, ia:0, sede_obj:null,            obl:1, video:null,                                                   ests:['Cuidado directo','Salud','Servicios generales'] },
      { key:'c3', nombre:'Nutrición y Alimentación en el Adulto Mayor',   descripcion:'Principios de nutrición gerontológica y manejo de dietas especiales.',                              area:'Nutrición',         profesor:'roberto.fuentes', pub:1, ia:0, sede_obj:'ELEAM Coyhaique',obl:0, video:'https://storage.alumco.cl/videos/intro-nutricion.mp4', ests:['Nutrición','Cuidado directo'] },
      { key:'c4', nombre:'Primeros Auxilios Básicos',                     descripcion:'Técnicas esenciales de primeros auxilios aplicadas al contexto del ELEAM.',                         area:'Salud',             profesor:'roberto.fuentes', pub:1, ia:1, sede_obj:null,            obl:1, video:null,                                                   ests:['Cuidado directo','Salud','Administración','Servicios generales'] },
      { key:'c5', nombre:'Manejo de Residuos y Limpieza Hospitalaria',    descripcion:'Protocolos de higiene, manejo de residuos y desinfección en establecimientos de larga estadía.',    area:'Servicios generales',profesor:'ana.gonzalez',    pub:0, ia:0, sede_obj:'ELEAM Hualpén', obl:0, video:null,                                                   ests:['Servicios generales'] },
    ];

    const cid = {};
    for (const c of cursosData) {
      const [ex] = await conn.query('SELECT id FROM cursos WHERE nombre = ?', [c.nombre]);
      let cursoId;
      if (ex.length) { cursoId = ex[0].id; }
      else {
        const [r] = await conn.query(
          `INSERT INTO cursos (nombre,descripcion,area_id,profesor_id,publicado,generado_por_ia,sede_objetivo,obligatorio,video_intro_url)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [c.nombre,c.descripcion,aid[c.area],uid[c.profesor],c.pub,c.ia,c.sede_obj?sid[c.sede_obj]:null,c.obl,c.video]
        );
        cursoId = r.insertId;
        console.log(`✓ Curso: ${c.nombre}`);
      }
      cid[c.key] = cursoId;
      for (const e of c.ests)
        await conn.query('INSERT IGNORE INTO curso_estamentos (curso_id,estamento_id) VALUES (?,?)', [cursoId, eid[e]]);
    }
    console.log('✓ curso_estamentos');

    // ── Módulos y slides ───────────────────────────────────────────────────────

    const modulosData = [
      { curso:'c1',orden:1,tipo:'pdf',  titulo:'Introducción a la Demencia',       desc:'Tipos, etapas y síntomas.',                           url:'https://storage.alumco.cl/modulos/demencia-intro.pdf',         slides:[] },
      { curso:'c1',orden:2,tipo:'video',titulo:'Comunicación con el Paciente',     desc:'Técnicas de comunicación no verbal.',                 url:'https://storage.alumco.cl/modulos/demencia-comunicacion.mp4',  slides:[] },
      { curso:'c1',orden:3,tipo:'ppt',  titulo:'Manejo de Conductas Difíciles',    desc:'Estrategias para situaciones de agitación.',           url:'https://storage.alumco.cl/modulos/demencia-conductas.pptx',   slides:[
        {numero:1,datos:{tipo:'seccion',titulo:'Conductas difíciles',  texto:'Agitación, vagabundeo y agresividad.'}},
        {numero:2,datos:{tipo:'seccion',titulo:'Estrategias clave',     texto:'Redirección, ambiente seguro y validación emocional.'}},
      ]},
      { curso:'c2',orden:1,tipo:'pdf',  titulo:'Factores de Riesgo de Caídas',     desc:'Identificación de riesgos intrínsecos y extrínsecos.', url:'https://storage.alumco.cl/modulos/caidas-riesgos.pdf',         slides:[] },
      { curso:'c2',orden:2,tipo:'video',titulo:'Evaluación del Entorno Físico',    desc:'Inspección de habitaciones, baños y pasillos.',       url:'https://storage.alumco.cl/modulos/caidas-entorno.mp4',         slides:[] },
      { curso:'c3',orden:1,tipo:'pdf',  titulo:'Necesidades Nutricionales del AM', desc:'Macro y micronutrientes esenciales.',                 url:'https://storage.alumco.cl/modulos/nutricion-necesidades.pdf',  slides:[] },
      { curso:'c3',orden:2,tipo:'ppt',  titulo:'Dietas Especiales y Texturizadas', desc:'Adaptaciones para disfagia y otras patologías.',      url:'https://storage.alumco.cl/modulos/nutricion-dietas.pptx',     slides:[
        {numero:1,datos:{tipo:'seccion',titulo:'Disfagia',         texto:'Clasificación IDDSI y adaptaciones de textura.'}},
        {numero:2,datos:{tipo:'seccion',titulo:'Diabetes en el AM', texto:'Dieta hipocalórica y control glucémico.'}},
      ]},
      { curso:'c4',orden:1,tipo:'video',titulo:'RCP Básico',                       desc:'Reanimación cardiopulmonar con y sin DEA.',            url:'https://storage.alumco.cl/modulos/primeros-aux-rcp.mp4',      slides:[] },
      { curso:'c4',orden:2,tipo:'pdf',  titulo:'Manejo de Heridas y Hemorragias',  desc:'Protocolos de hemostasia y vendaje.',                 url:'https://storage.alumco.cl/modulos/primeros-aux-heridas.pdf',   slides:[] },
      { curso:'c5',orden:1,tipo:'pdf',  titulo:'Clasificación de Residuos',        desc:'Tipos de residuos en centros de salud.',              url:'https://storage.alumco.cl/modulos/residuos-clasificacion.pdf', slides:[] },
    ];

    for (const m of modulosData) {
      const [ex] = await conn.query('SELECT id FROM modulos WHERE curso_id=? AND titulo=?', [cid[m.curso], m.titulo]);
      let modId;
      if (ex.length) { modId = ex[0].id; }
      else {
        const [r] = await conn.query(
          'INSERT INTO modulos (curso_id,titulo,descripcion,tipo,archivo_url,orden) VALUES (?,?,?,?,?,?)',
          [cid[m.curso],m.titulo,m.desc,m.tipo,m.url,m.orden]
        );
        modId = r.insertId;
      }
      for (const s of m.slides) {
        const [exS] = await conn.query('SELECT id FROM modulo_slides WHERE modulo_id=? AND numero=?', [modId, s.numero]);
        if (!exS.length)
          await conn.query('INSERT INTO modulo_slides (modulo_id,numero,datos) VALUES (?,?,?)', [modId, s.numero, JSON.stringify(s.datos)]);
      }
    }
    console.log('✓ Módulos y slides');

    // ── Preguntas y alternativas ───────────────────────────────────────────────

    const preguntasDef = [
      { key:'c1_p1',curso:'c1',texto:'¿Cuál es la etapa más avanzada de la demencia de Alzheimer?',                         alts:['Etapa leve','Etapa moderada','Etapa grave','Etapa temprana'], correcta:2 },
      { key:'c1_p2',curso:'c1',texto:'¿Qué técnica es más efectiva para comunicarse con una persona con demencia avanzada?', alts:['Comunicación verbal extensa','Comunicación no verbal y contacto visual','Ignorar las respuestas del paciente','Hablar en voz alta y rápido'], correcta:1 },
      { key:'c1_p3',curso:'c1',texto:'¿Cuál de las siguientes es una conducta difícil frecuente en la demencia?',           alts:['Hipertensión','Agitación nocturna','Aumento del apetito','Mejora de la memoria'], correcta:1 },
      { key:'c2_p1',curso:'c2',texto:'¿Cuál es el factor de riesgo extrínseco más común de caídas en el ELEAM?',            alts:['Debilidad muscular','Suelos mojados y sin antideslizantes','Problemas de visión','Hipotensión ortostática'], correcta:1 },
      { key:'c2_p2',curso:'c2',texto:'¿Qué elemento reduce significativamente el riesgo de caída en el baño?',              alts:['Espejo grande','Barras de apoyo','Alfombra gruesa','Luz tenue'], correcta:1 },
      { key:'c3_p1',curso:'c3',texto:'¿Qué vitamina es esencial para la absorción del calcio en adultos mayores?',          alts:['Vitamina C','Vitamina B12','Vitamina D','Vitamina K'], correcta:2 },
      { key:'c3_p2',curso:'c3',texto:'¿Cuál es el nivel IDDSI recomendado para disfagia severa?',                           alts:['Nivel 3 - Líquido espeso','Nivel 4 - Puré','Nivel 5 - Picado y húmedo','Nivel 6 - Blando y que se parte'], correcta:3 },
      { key:'c4_p1',curso:'c4',texto:'¿Cuántas compresiones por minuto se realizan durante la RCP?',                        alts:['60-80 compresiones/min','100-120 compresiones/min','80-100 compresiones/min','50-70 compresiones/min'], correcta:1 },
      { key:'c4_p2',curso:'c4',texto:'¿Cuál es la relación compresiones-ventilaciones en RCP adultos?',                    alts:['15:2','20:2','30:2','10:1'], correcta:2 },
      { key:'c5_p1',curso:'c5',texto:'¿En qué contenedor se depositan los residuos cortopunzantes?',                        alts:['Bolsa negra','Bolsa roja','Guardián rígido amarillo','Bolsa verde'], correcta:2 },
    ];

    const pMap = {};
    for (const p of preguntasDef) {
      const [ex] = await conn.query('SELECT id FROM preguntas WHERE curso_id=? AND texto=?', [cid[p.curso], p.texto]);
      let pregId;
      if (ex.length) { pregId = ex[0].id; }
      else {
        const [r] = await conn.query('INSERT INTO preguntas (curso_id,texto) VALUES (?,?)', [cid[p.curso], p.texto]);
        pregId = r.insertId;
      }
      const altIds = [];
      for (let i = 0; i < p.alts.length; i++) {
        const [exA] = await conn.query('SELECT id FROM alternativas WHERE pregunta_id=? AND texto=?', [pregId, p.alts[i]]);
        if (exA.length) { altIds.push(exA[0].id); continue; }
        const [rA] = await conn.query('INSERT INTO alternativas (pregunta_id,texto,correcta) VALUES (?,?,?)', [pregId, p.alts[i], i===p.correcta?1:0]);
        altIds.push(rA.insertId);
      }
      pMap[p.key] = { id: pregId, altIds };
    }
    console.log('✓ Preguntas y alternativas');

    // ── Asignaciones ───────────────────────────────────────────────────────────

    for (const a of [
      {u:'carlos.munoz',    c:'c1',obl:1,fl:'2026-06-30'},{u:'carlos.munoz',    c:'c2',obl:1,fl:'2026-06-30'},{u:'carlos.munoz',    c:'c4',obl:1,fl:'2026-07-31'},
      {u:'pedro.soto',      c:'c2',obl:1,fl:'2026-06-30'},{u:'pedro.soto',      c:'c4',obl:1,fl:'2026-07-31'},{u:'pedro.soto',      c:'c5',obl:0,fl:null},
      {u:'valentina.rojas', c:'c1',obl:1,fl:'2026-06-30'},{u:'valentina.rojas', c:'c2',obl:1,fl:'2026-06-30'},
      {u:'carmen.sepulveda',c:'c2',obl:1,fl:'2026-06-30'},{u:'carmen.sepulveda',c:'c5',obl:1,fl:'2026-05-31'},
      {u:'ana.gonzalez',    c:'c1',obl:0,fl:null},{u:'roberto.fuentes',c:'c4',obl:0,fl:null},
    ]) {
      await conn.query('INSERT IGNORE INTO asignaciones (usuario_id,curso_id,obligatorio,fecha_limite) VALUES (?,?,?,?)',
        [uid[a.u],cid[a.c],a.obl,a.fl]);
    }
    console.log('✓ Asignaciones');

    // ── Progreso ───────────────────────────────────────────────────────────────

    for (const p of [
      {u:'carlos.munoz',    c:'c1',comp:1,pct:100,ua:'2026-04-10 14:30:00',if_:0,bh:null},
      {u:'carlos.munoz',    c:'c2',comp:0,pct:60, ua:'2026-04-18 09:15:00',if_:1,bh:null},
      {u:'carlos.munoz',    c:'c4',comp:0,pct:30, ua:'2026-04-20 11:00:00',if_:0,bh:null},
      {u:'pedro.soto',      c:'c2',comp:1,pct:100,ua:'2026-04-05 16:45:00',if_:0,bh:null},
      {u:'pedro.soto',      c:'c4',comp:0,pct:0,  ua:null,                 if_:0,bh:null},
      {u:'valentina.rojas', c:'c1',comp:1,pct:100,ua:'2026-04-12 10:00:00',if_:2,bh:null},
      {u:'valentina.rojas', c:'c2',comp:0,pct:45, ua:'2026-04-19 13:20:00',if_:0,bh:null},
      {u:'carmen.sepulveda',c:'c5',comp:0,pct:20, ua:'2026-04-15 17:00:00',if_:3,bh:'2026-04-22 17:00:00'},
      {u:'ana.gonzalez',    c:'c1',comp:1,pct:100,ua:'2026-03-01 09:00:00',if_:0,bh:null},
    ]) {
      await conn.query(
        'INSERT IGNORE INTO progreso (usuario_id,curso_id,porcentaje,ultimo_acceso,intentos_fallidos,bloqueado_hasta) VALUES (?,?,?,?,?,?)',
        [uid[p.u],cid[p.c],p.pct,p.ua,p.if_,p.bh]
      );
    }
    console.log('✓ Progreso');

    // ── Intentos e intento_respuestas ──────────────────────────────────────────

    const intentosData = [
      {u:'carlos.munoz',   c:'c1',n:1,nota:55, apr:0,f:'2026-04-08 14:00:00',resp:[['c1_p1',1],['c1_p2',0],['c1_p3',1]]},
      {u:'carlos.munoz',   c:'c1',n:2,nota:80, apr:1,f:'2026-04-10 14:00:00',resp:[['c1_p1',2],['c1_p2',1],['c1_p3',1]]},
      {u:'pedro.soto',     c:'c2',n:1,nota:90, apr:1,f:'2026-04-05 16:00:00',resp:[['c2_p1',1],['c2_p2',1]]},
      {u:'valentina.rojas',c:'c1',n:1,nota:40, apr:0,f:'2026-04-09 10:00:00',resp:[['c1_p1',0],['c1_p2',0],['c1_p3',0]]},
      {u:'valentina.rojas',c:'c1',n:2,nota:60, apr:0,f:'2026-04-10 11:00:00',resp:[['c1_p1',2],['c1_p2',0],['c1_p3',1]]},
      {u:'valentina.rojas',c:'c1',n:3,nota:85, apr:1,f:'2026-04-12 10:00:00',resp:[['c1_p1',2],['c1_p2',1],['c1_p3',1]]},
      {u:'ana.gonzalez',   c:'c1',n:1,nota:100,apr:1,f:'2026-03-01 09:00:00',resp:[['c1_p1',2],['c1_p2',1],['c1_p3',1]]},
    ];

    const intentoIds = [];
    for (const i of intentosData) {
      const [r] = await conn.query(
        'INSERT INTO intentos (usuario_id,curso_id,numero_intento,nota,aprobado,fecha) VALUES (?,?,?,?,?,?)',
        [uid[i.u],cid[i.c],i.n,i.nota,i.apr,i.f]
      );
      intentoIds.push({ id: r.insertId, aprobado: i.apr });
      for (const [pk, altIdx] of i.resp) {
        await conn.query(
          'INSERT IGNORE INTO intento_respuestas (intento_id,pregunta_id,alternativa_id) VALUES (?,?,?)',
          [r.insertId, pMap[pk].id, pMap[pk].altIds[altIdx]]
        );
      }
    }
    console.log('✓ Intentos e intento_respuestas');

    // ── Certificados ───────────────────────────────────────────────────────────

    const aprobados = intentoIds.filter(i => i.aprobado === 1);
    for (const [idx, cert] of [
      [0,{est:'aprobado', arch:'https://storage.alumco.cl/certs/cert-carlos-c1.pdf',  f:'2026-04-11 10:00:00',vp:'admin'}],
      [1,{est:'aprobado', arch:'https://storage.alumco.cl/certs/cert-pedro-c2.pdf',   f:'2026-04-06 09:00:00',vp:'admin'}],
      [2,{est:'pendiente',arch:null,                                                   f:null,                 vp:null}],
      [3,{est:'aprobado', arch:'https://storage.alumco.cl/certs/cert-ana-c1.pdf',     f:'2026-03-02 09:00:00',vp:'admin'}],
    ]) {
      if (!aprobados[idx]) continue;
      await conn.query(
        'INSERT INTO certificados (intento_id,validado_por,estado,archivo_url,fecha_emision) VALUES (?,?,?,?,?)',
        [aprobados[idx].id, cert.vp ? uid[cert.vp] : null, cert.est, cert.arch, cert.f]
      );
    }
    console.log('✓ Certificados');

    // ── Prácticos ──────────────────────────────────────────────────────────────

    const practicosData = [
      {c:'c1',s:'ELEAM Hualpén',  titulo:'Taller: Comunicación con paciente con demencia',desc:'Simulación de interacciones con residentes.',             f:'2026-05-15',hi:'09:00:00',hf:'12:00:00',l:'Sala de capacitación ELEAM Hualpén',cp:'ana.gonzalez'},
      {c:'c2',s:'ELEAM Coyhaique',titulo:'Simulacro de prevención de caídas',             desc:'Recorrido de identificación de riesgos.',                 f:'2026-05-22',hi:'10:00:00',hf:'13:00:00',l:'Pasillos y baños ELEAM Coyhaique',  cp:'roberto.fuentes'},
      {c:'c4',s:'ELEAM Hualpén',  titulo:'Práctica de RCP con maniquí',                   desc:'Entrenamiento certificado en RCP básico con uso de DEA.', f:'2026-06-05',hi:'08:30:00',hf:'11:30:00',l:'Patio cubierto ELEAM Hualpén',      cp:'ana.gonzalez'},
    ];

    const practicoIds = [];
    for (const p of practicosData) {
      const [ex] = await conn.query('SELECT id FROM practicos WHERE titulo=? AND fecha=?', [p.titulo, p.f]);
      if (ex.length) { practicoIds.push(ex[0].id); continue; }
      const [r] = await conn.query(
        'INSERT INTO practicos (curso_id,sede_id,titulo,descripcion,fecha,hora_inicio,hora_fin,lugar,creado_por) VALUES (?,?,?,?,?,?,?,?,?)',
        [cid[p.c],sid[p.s],p.titulo,p.desc,p.f,p.hi,p.hf,p.l,uid[p.cp]]
      );
      practicoIds.push(r.insertId);
      console.log(`✓ Práctico: ${p.titulo}`);
    }

    // ── Notificaciones ─────────────────────────────────────────────────────────

    const [pr1, pr2, pr3] = practicoIds;
    for (const n of [
      {u:'carlos.munoz',    pr:pr1,t:'Nuevo taller programado',           m:'Taller "Comunicación con paciente con demencia" agendado para el 15/05/2026 a las 09:00 en ELEAM Hualpén.',l:0},
      {u:'valentina.rojas', pr:pr1,t:'Nuevo taller programado',           m:'Taller "Comunicación con paciente con demencia" agendado para el 15/05/2026 a las 09:00 en ELEAM Hualpén.',l:1},
      {u:'pedro.soto',      pr:pr2,t:'Simulacro de prevención de caídas', m:'Recuerda asistir al simulacro de caídas el 22/05/2026 en ELEAM Coyhaique.',l:0},
      {u:'carmen.sepulveda',pr:pr2,t:'Simulacro de prevención de caídas', m:'Recuerda asistir al simulacro de caídas el 22/05/2026 en ELEAM Coyhaique.',l:0},
      {u:'carlos.munoz',    pr:pr3,t:'Práctica de RCP agendada',          m:'Práctica de RCP con maniquí programada para el 05/06/2026 a las 08:30 en ELEAM Hualpén.',l:0},
      {u:'valentina.rojas', pr:pr3,t:'Práctica de RCP agendada',          m:'Práctica de RCP con maniquí programada para el 05/06/2026 a las 08:30 en ELEAM Hualpén.',l:0},
    ]) {
      await conn.query(
        'INSERT INTO notificaciones (usuario_id,tipo,entidad,entidad_id,titulo,mensaje,leida) VALUES (?,?,?,?,?,?,?)',
        [uid[n.u],'practico_asignado','practico',n.pr,n.t,n.m,n.l]
      );
    }
    console.log('✓ Notificaciones');

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('\n✓ Seed completo');
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('✗ Error en seed:', err.message);
    await conn.end();
    process.exit(1);
  }
}

seed();
