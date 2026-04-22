require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host:               process.env.DB_HOST     || 'localhost',
    port:               parseInt(process.env.DB_PORT) || 3306,
    user:               process.env.DB_USER     || 'root',
    password:           process.env.DB_PASSWORD || '',
    database:           process.env.DB_NAME     || 'alumco',
    multipleStatements: true
  });

  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    // ── Catálogos ──────────────────────────────────────────────────────────────

    await conn.query(`
      CREATE TABLE IF NOT EXISTS estamentos (
        id     INT PRIMARY KEY AUTO_INCREMENT,
        nombre VARCHAR(100) NOT NULL UNIQUE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS areas (
        id     INT PRIMARY KEY AUTO_INCREMENT,
        nombre VARCHAR(100) NOT NULL UNIQUE
      )
    `);

    // ── Entidades principales ──────────────────────────────────────────────────

    await conn.query(`
      CREATE TABLE IF NOT EXISTS sedes (
        id         INT PRIMARY KEY AUTO_INCREMENT,
        nombre     VARCHAR(100) NOT NULL UNIQUE,
        ciudad     VARCHAR(100),
        activa     TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id                   INT PRIMARY KEY AUTO_INCREMENT,
        nombre               VARCHAR(150) NOT NULL,
        identificador        VARCHAR(50) UNIQUE NOT NULL,
        password_hash        VARCHAR(255) NOT NULL,
        rol                  ENUM('colaborador','profesor','admin_sede','jefatura') NOT NULL,
        tipo_contrato        ENUM('fijo','reemplazo'),
        sede_id              INT,
        rango_etario         VARCHAR(20),
        rut                  VARCHAR(20) DEFAULT NULL,
        email                VARCHAR(150) DEFAULT NULL,
        telefono             VARCHAR(20) DEFAULT NULL,
        estamento_id         INT DEFAULT NULL,
        activo               TINYINT(1) DEFAULT 1,
        ultimo_acceso        DATETIME DEFAULT NULL,
        google_access_token  TEXT DEFAULT NULL,
        google_refresh_token TEXT DEFAULT NULL,
        created_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (sede_id)      REFERENCES sedes(id),
        FOREIGN KEY (estamento_id) REFERENCES estamentos(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS cursos (
        id              INT PRIMARY KEY AUTO_INCREMENT,
        nombre          VARCHAR(200) NOT NULL,
        descripcion     TEXT,
        area_id         INT,
        profesor_id     INT,
        publicado       TINYINT(1) DEFAULT 0,
        generado_por_ia TINYINT(1) DEFAULT 0,
        sede_objetivo   INT DEFAULT NULL,
        obligatorio     TINYINT(1) DEFAULT 0,
        video_intro_url VARCHAR(500) DEFAULT NULL,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (area_id)       REFERENCES areas(id),
        FOREIGN KEY (profesor_id)   REFERENCES usuarios(id),
        FOREIGN KEY (sede_objetivo) REFERENCES sedes(id)
      )
    `);

    // curso ↔ estamento  (reemplaza JSON estamento_objetivo)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS curso_estamentos (
        curso_id     INT NOT NULL,
        estamento_id INT NOT NULL,
        PRIMARY KEY (curso_id, estamento_id),
        FOREIGN KEY (curso_id)     REFERENCES cursos(id)     ON DELETE CASCADE,
        FOREIGN KEY (estamento_id) REFERENCES estamentos(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS modulos (
        id          INT PRIMARY KEY AUTO_INCREMENT,
        curso_id    INT,
        titulo      VARCHAR(200) NOT NULL,
        descripcion TEXT,
        tipo        ENUM('pdf','video','ppt'),
        archivo_url VARCHAR(500),
        orden       INT DEFAULT 1,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE
      )
    `);

    // slides de módulos PPT  (reemplaza JSON contenido_presentacion)
    // datos: objeto JSON flexible por tipo de diapositiva
    await conn.query(`
      CREATE TABLE IF NOT EXISTS modulo_slides (
        id        INT PRIMARY KEY AUTO_INCREMENT,
        modulo_id INT NOT NULL,
        numero    INT NOT NULL,
        datos     JSON NOT NULL,
        FOREIGN KEY (modulo_id) REFERENCES modulos(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS asignaciones (
        id           INT PRIMARY KEY AUTO_INCREMENT,
        usuario_id   INT,
        curso_id     INT,
        obligatorio  TINYINT(1) DEFAULT 0,
        fecha_limite DATE,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_asignacion (usuario_id, curso_id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
        FOREIGN KEY (curso_id)   REFERENCES cursos(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS progreso (
        id                INT PRIMARY KEY AUTO_INCREMENT,
        usuario_id        INT,
        curso_id          INT,
        completado        TINYINT(1) DEFAULT 0,
        porcentaje        INT DEFAULT 0,
        ultimo_acceso     DATETIME,
        intentos_fallidos INT DEFAULT 0,
        bloqueado_hasta   DATETIME DEFAULT NULL,
        UNIQUE KEY uq_progreso (usuario_id, curso_id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
        FOREIGN KEY (curso_id)   REFERENCES cursos(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS preguntas (
        id         INT PRIMARY KEY AUTO_INCREMENT,
        curso_id   INT,
        texto      TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE
      )
    `);

    // alternativas de preguntas  (reemplaza JSON alternativas)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS alternativas (
        id          INT PRIMARY KEY AUTO_INCREMENT,
        pregunta_id INT NOT NULL,
        texto       TEXT NOT NULL,
        correcta    TINYINT(1) DEFAULT 0,
        FOREIGN KEY (pregunta_id) REFERENCES preguntas(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS intentos (
        id             INT PRIMARY KEY AUTO_INCREMENT,
        usuario_id     INT,
        curso_id       INT,
        numero_intento INT DEFAULT 1,
        nota           INT,
        aprobado       TINYINT(1) DEFAULT 0,
        fecha          DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
        FOREIGN KEY (curso_id)   REFERENCES cursos(id)
      )
    `);

    // respuestas por intento  (reemplaza JSON respuestas)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS intento_respuestas (
        id             INT PRIMARY KEY AUTO_INCREMENT,
        intento_id     INT NOT NULL,
        pregunta_id    INT NOT NULL,
        alternativa_id INT NOT NULL,
        UNIQUE KEY uq_respuesta (intento_id, pregunta_id),
        FOREIGN KEY (intento_id)     REFERENCES intentos(id)     ON DELETE CASCADE,
        FOREIGN KEY (pregunta_id)    REFERENCES preguntas(id),
        FOREIGN KEY (alternativa_id) REFERENCES alternativas(id)
      )
    `);

    // usuario_id y curso_id se derivan de intento_id → no se repiten aquí
    await conn.query(`
      CREATE TABLE IF NOT EXISTS certificados (
        id            INT PRIMARY KEY AUTO_INCREMENT,
        intento_id    INT,
        validado_por  INT,
        estado        ENUM('pendiente','aprobado','rechazado') DEFAULT 'pendiente',
        archivo_url   VARCHAR(500),
        fecha_emision DATETIME,
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (intento_id)   REFERENCES intentos(id),
        FOREIGN KEY (validado_por) REFERENCES usuarios(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS practicos (
        id          INT PRIMARY KEY AUTO_INCREMENT,
        curso_id    INT NOT NULL,
        sede_id     INT NOT NULL,
        titulo      VARCHAR(200) NOT NULL,
        descripcion TEXT,
        fecha       DATE NOT NULL,
        hora_inicio TIME NOT NULL,
        hora_fin    TIME,
        lugar       VARCHAR(200),
        creado_por  INT NOT NULL,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (curso_id)   REFERENCES cursos(id) ON DELETE CASCADE,
        FOREIGN KEY (sede_id)    REFERENCES sedes(id),
        FOREIGN KEY (creado_por) REFERENCES usuarios(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS notificaciones (
        id          INT PRIMARY KEY AUTO_INCREMENT,
        usuario_id  INT NOT NULL,
        practico_id INT,
        titulo      VARCHAR(200) NOT NULL,
        mensaje     TEXT NOT NULL,
        leida       TINYINT(1) DEFAULT 0,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id)  REFERENCES usuarios(id)  ON DELETE CASCADE,
        FOREIGN KEY (practico_id) REFERENCES practicos(id) ON DELETE CASCADE
      )
    `);

    // ── Columnas que pueden faltar en tablas ya existentes ────────────────────

    const alteraciones = [
      // usuarios
      { tabla: 'usuarios', columna: 'rango_etario',         sql: "ALTER TABLE usuarios ADD COLUMN rango_etario VARCHAR(20)" },
      { tabla: 'usuarios', columna: 'rut',                  sql: "ALTER TABLE usuarios ADD COLUMN rut VARCHAR(20) DEFAULT NULL" },
      { tabla: 'usuarios', columna: 'email',                sql: "ALTER TABLE usuarios ADD COLUMN email VARCHAR(150) DEFAULT NULL" },
      { tabla: 'usuarios', columna: 'telefono',             sql: "ALTER TABLE usuarios ADD COLUMN telefono VARCHAR(20) DEFAULT NULL" },
      { tabla: 'usuarios', columna: 'estamento_id',         sql: "ALTER TABLE usuarios ADD COLUMN estamento_id INT DEFAULT NULL" },
      { tabla: 'usuarios', columna: 'activo',               sql: "ALTER TABLE usuarios ADD COLUMN activo TINYINT(1) DEFAULT 1" },
      { tabla: 'usuarios', columna: 'ultimo_acceso',        sql: "ALTER TABLE usuarios ADD COLUMN ultimo_acceso DATETIME DEFAULT NULL" },
      { tabla: 'usuarios', columna: 'google_access_token',  sql: "ALTER TABLE usuarios ADD COLUMN google_access_token TEXT DEFAULT NULL" },
      { tabla: 'usuarios', columna: 'google_refresh_token', sql: "ALTER TABLE usuarios ADD COLUMN google_refresh_token TEXT DEFAULT NULL" },
      { tabla: 'usuarios', columna: 'updated_at',           sql: "ALTER TABLE usuarios ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },
      // sedes
      { tabla: 'sedes',    columna: 'ciudad',               sql: "ALTER TABLE sedes ADD COLUMN ciudad VARCHAR(100)" },
      { tabla: 'sedes',    columna: 'activa',               sql: "ALTER TABLE sedes ADD COLUMN activa TINYINT(1) DEFAULT 1" },
      // cursos
      { tabla: 'cursos',   columna: 'descripcion',          sql: "ALTER TABLE cursos ADD COLUMN descripcion TEXT" },
      { tabla: 'cursos',   columna: 'area_id',              sql: "ALTER TABLE cursos ADD COLUMN area_id INT DEFAULT NULL" },
      { tabla: 'cursos',   columna: 'profesor_id',          sql: "ALTER TABLE cursos ADD COLUMN profesor_id INT DEFAULT NULL" },
      { tabla: 'cursos',   columna: 'publicado',            sql: "ALTER TABLE cursos ADD COLUMN publicado TINYINT(1) DEFAULT 0" },
      { tabla: 'cursos',   columna: 'generado_por_ia',      sql: "ALTER TABLE cursos ADD COLUMN generado_por_ia TINYINT(1) DEFAULT 0" },
      { tabla: 'cursos',   columna: 'sede_objetivo',        sql: "ALTER TABLE cursos ADD COLUMN sede_objetivo INT DEFAULT NULL" },
      { tabla: 'cursos',   columna: 'obligatorio',          sql: "ALTER TABLE cursos ADD COLUMN obligatorio TINYINT(1) DEFAULT 0" },
      { tabla: 'cursos',   columna: 'video_intro_url',      sql: "ALTER TABLE cursos ADD COLUMN video_intro_url VARCHAR(500) DEFAULT NULL" },
      { tabla: 'cursos',   columna: 'updated_at',           sql: "ALTER TABLE cursos ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP" },
      // modulos
      { tabla: 'modulos',  columna: 'descripcion',          sql: "ALTER TABLE modulos ADD COLUMN descripcion TEXT" },
      { tabla: 'modulos',  columna: 'tipo',                 sql: "ALTER TABLE modulos ADD COLUMN tipo ENUM('pdf','video','ppt')" },
      { tabla: 'modulos',  columna: 'archivo_url',          sql: "ALTER TABLE modulos ADD COLUMN archivo_url VARCHAR(500)" },
      { tabla: 'modulos',  columna: 'orden',                sql: "ALTER TABLE modulos ADD COLUMN orden INT DEFAULT 1" },
      // asignaciones
      { tabla: 'asignaciones', columna: 'obligatorio',      sql: "ALTER TABLE asignaciones ADD COLUMN obligatorio TINYINT(1) DEFAULT 0" },
      { tabla: 'asignaciones', columna: 'fecha_limite',     sql: "ALTER TABLE asignaciones ADD COLUMN fecha_limite DATE" },
      // progreso
      { tabla: 'progreso', columna: 'porcentaje',           sql: "ALTER TABLE progreso ADD COLUMN porcentaje INT DEFAULT 0" },
      { tabla: 'progreso', columna: 'ultimo_acceso',        sql: "ALTER TABLE progreso ADD COLUMN ultimo_acceso DATETIME" },
      { tabla: 'progreso', columna: 'intentos_fallidos',    sql: "ALTER TABLE progreso ADD COLUMN intentos_fallidos INT DEFAULT 0" },
      { tabla: 'progreso', columna: 'bloqueado_hasta',      sql: "ALTER TABLE progreso ADD COLUMN bloqueado_hasta DATETIME DEFAULT NULL" },
      // intentos
      { tabla: 'intentos', columna: 'numero_intento',       sql: "ALTER TABLE intentos ADD COLUMN numero_intento INT DEFAULT 1" },
      { tabla: 'intentos', columna: 'nota',                 sql: "ALTER TABLE intentos ADD COLUMN nota INT" },
      { tabla: 'intentos', columna: 'aprobado',             sql: "ALTER TABLE intentos ADD COLUMN aprobado TINYINT(1) DEFAULT 0" },
      // practicos
      { tabla: 'practicos', columna: 'descripcion',         sql: "ALTER TABLE practicos ADD COLUMN descripcion TEXT" },
      { tabla: 'practicos', columna: 'hora_fin',            sql: "ALTER TABLE practicos ADD COLUMN hora_fin TIME" },
      { tabla: 'practicos', columna: 'lugar',               sql: "ALTER TABLE practicos ADD COLUMN lugar VARCHAR(200)" },
      // notificaciones
      { tabla: 'notificaciones', columna: 'practico_id',    sql: "ALTER TABLE notificaciones ADD COLUMN practico_id INT DEFAULT NULL" },
      { tabla: 'notificaciones', columna: 'leida',          sql: "ALTER TABLE notificaciones ADD COLUMN leida TINYINT(1) DEFAULT 0" },
    ];

    for (const { tabla, columna, sql } of alteraciones) {
      const [cols] = await conn.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [tabla, columna]
      );
      if (!cols.length) {
        await conn.query(sql);
        console.log(`  + Columna agregada: ${tabla}.${columna}`);
      }
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('✓ Migración completada — 17 tablas creadas/verificadas');
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('✗ Error en migración:', err.message);
    await conn.end();
    process.exit(1);
  }
}

migrate();
