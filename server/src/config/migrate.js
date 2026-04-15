require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function migrate() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     process.env.DB_PORT     || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'alumco',
    multipleStatements: true
  });

  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS sedes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        nombre VARCHAR(100) NOT NULL,
        ciudad VARCHAR(100),
        activa TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT PRIMARY KEY AUTO_INCREMENT,
        nombre VARCHAR(150) NOT NULL,
        identificador VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        rol ENUM('colaborador','profesor','admin_sede','jefatura') NOT NULL,
        tipo_contrato ENUM('fijo','reemplazo'),
        sede_id INT,
        rango_etario VARCHAR(20),
        rut VARCHAR(20) DEFAULT NULL,
        email VARCHAR(150) DEFAULT NULL,
        telefono VARCHAR(20) DEFAULT NULL,
        estamento VARCHAR(100) DEFAULT NULL,
        activo TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (sede_id) REFERENCES sedes(id)
      )
    `);

    // Migraciones incrementales de columnas para BDs existentes
    await conn.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rut VARCHAR(20) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email VARCHAR(150) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono VARCHAR(20) DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS estamento VARCHAR(100) DEFAULT NULL`).catch(() => {});

    // Actualizar usuarios existentes sin estamento: jefatura → 'Dirección'
    await conn.query(`
      UPDATE usuarios SET estamento = 'Dirección'
      WHERE rol = 'jefatura' AND (estamento IS NULL OR estamento = '')
    `).catch(() => {});

    await conn.query(`
      CREATE TABLE IF NOT EXISTS cursos (
        id INT PRIMARY KEY AUTO_INCREMENT,
        nombre VARCHAR(200) NOT NULL,
        descripcion TEXT,
        area VARCHAR(100),
        profesor_id INT,
        publicado TINYINT(1) DEFAULT 0,
        generado_por_ia TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (profesor_id) REFERENCES usuarios(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS modulos (
        id INT PRIMARY KEY AUTO_INCREMENT,
        curso_id INT,
        titulo VARCHAR(200) NOT NULL,
        descripcion TEXT,
        contenido_presentacion JSON,
        tipo ENUM('pdf','video','ppt'),
        archivo_url VARCHAR(500),
        orden INT DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE
      )
    `);

    // Migraciones incrementales: agregar columnas si no existen en BDs previas
    await conn.query(`ALTER TABLE modulos ADD COLUMN IF NOT EXISTS contenido_presentacion JSON AFTER descripcion`).catch(() => {});
    await conn.query(`ALTER TABLE modulos MODIFY COLUMN titulo VARCHAR(500) NOT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE cursos ADD COLUMN IF NOT EXISTS estamento_objetivo TEXT DEFAULT NULL`).catch(() => {});
    await conn.query(`ALTER TABLE cursos ADD COLUMN IF NOT EXISTS sede_objetivo INT DEFAULT NULL`).catch(() => {});
    // Convertir valores existentes de string a JSON array
    await conn.query(`
      UPDATE cursos
      SET estamento_objetivo = JSON_ARRAY(estamento_objetivo)
      WHERE estamento_objetivo IS NOT NULL
        AND JSON_VALID(estamento_objetivo) = 0
    `).catch(() => {});
    await conn.query(`ALTER TABLE cursos ADD COLUMN IF NOT EXISTS obligatorio TINYINT(1) DEFAULT 0`).catch(() => {});
    await conn.query(`ALTER TABLE cursos ADD COLUMN IF NOT EXISTS video_intro_url VARCHAR(500) DEFAULT NULL`).catch(() => {});
    await conn.query(`
      CREATE TABLE IF NOT EXISTS asignaciones (
        id INT PRIMARY KEY AUTO_INCREMENT,
        usuario_id INT,
        curso_id INT,
        obligatorio TINYINT(1) DEFAULT 0,
        fecha_limite DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_asignacion (usuario_id, curso_id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
        FOREIGN KEY (curso_id) REFERENCES cursos(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS progreso (
        id INT PRIMARY KEY AUTO_INCREMENT,
        usuario_id INT,
        curso_id INT,
        completado TINYINT(1) DEFAULT 0,
        porcentaje INT DEFAULT 0,
        ultimo_acceso DATETIME,
        intentos_fallidos INT DEFAULT 0,
        bloqueado_hasta DATETIME DEFAULT NULL,
        UNIQUE KEY uq_progreso (usuario_id, curso_id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
        FOREIGN KEY (curso_id) REFERENCES cursos(id)
      )
    `);
    // Para BDs existentes que no tienen aún estas columnas
    await conn.query(`ALTER TABLE progreso ADD COLUMN IF NOT EXISTS intentos_fallidos INT DEFAULT 0`).catch(() => {});
    await conn.query(`ALTER TABLE progreso ADD COLUMN IF NOT EXISTS bloqueado_hasta DATETIME DEFAULT NULL`).catch(() => {});

    await conn.query(`
      CREATE TABLE IF NOT EXISTS preguntas (
        id INT PRIMARY KEY AUTO_INCREMENT,
        curso_id INT,
        texto TEXT NOT NULL,
        alternativas JSON NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS intentos (
        id INT PRIMARY KEY AUTO_INCREMENT,
        usuario_id INT,
        curso_id INT,
        numero_intento INT DEFAULT 1,
        respuestas JSON,
        nota INT,
        aprobado TINYINT(1) DEFAULT 0,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
        FOREIGN KEY (curso_id) REFERENCES cursos(id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS certificados (
        id INT PRIMARY KEY AUTO_INCREMENT,
        usuario_id INT,
        curso_id INT,
        intento_id INT,
        validado_por INT,
        estado ENUM('pendiente','aprobado','rechazado') DEFAULT 'pendiente',
        archivo_url VARCHAR(500),
        fecha_emision DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
        FOREIGN KEY (curso_id) REFERENCES cursos(id),
        FOREIGN KEY (intento_id) REFERENCES intentos(id),
        FOREIGN KEY (validado_por) REFERENCES usuarios(id)
      )
    `);

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // Sedes iniciales
    const [sedes] = await conn.query("SELECT id FROM sedes WHERE nombre = 'ELEAM Hualpén'");
    if (sedes.length === 0) {
      await conn.query("INSERT INTO sedes (nombre, ciudad) VALUES ('ELEAM Hualpén', 'Hualpén')");
      await conn.query("INSERT INTO sedes (nombre, ciudad) VALUES ('ELEAM Coyhaique', 'Coyhaique')");
      console.log('✓ Sedes creadas');
    }

    // Perfiles de prueba con todos los atributos
    const seedUsuarios = [
      {
        nombre:         'Administrador ALUMCO',
        identificador:  'admin',
        password:       'admin123',
        rol:            'jefatura',
        tipo_contrato:  'fijo',
        sede_id:        1,
        rango_etario:   '40-49',
        rut:            '12.345.678-9',
        email:          'admin@alumco.cl',
        telefono:       '+56912345678',
        estamento:      'Dirección'
      },
      {
        nombre:         'Ana González Rojas',
        identificador:  'ana.gonzalez',
        password:       'prof123',
        rol:            'profesor',
        tipo_contrato:  'fijo',
        sede_id:        1,
        rango_etario:   '30-39',
        rut:            '15.234.567-8',
        email:          'ana.gonzalez@alumco.cl',
        telefono:       '+56923456789',
        estamento:      'Salud'
      },
      {
        nombre:         'Carlos Muñoz Pino',
        identificador:  'carlos.munoz',
        password:       'colab123',
        rol:            'colaborador',
        tipo_contrato:  'fijo',
        sede_id:        1,
        rango_etario:   '20-29',
        rut:            '18.765.432-1',
        email:          'carlos.munoz@alumco.cl',
        telefono:       '+56934567890',
        estamento:      'Cuidado directo'
      },
      {
        nombre:         'María Torres Vidal',
        identificador:  'maria.torres',
        password:       'sede123',
        rol:            'admin_sede',
        tipo_contrato:  'fijo',
        sede_id:        2,
        rango_etario:   '35-44',
        rut:            '14.876.543-2',
        email:          'maria.torres@alumco.cl',
        telefono:       '+56945678901',
        estamento:      'Administración'
      },
      {
        nombre:         'Pedro Soto Leal',
        identificador:  'pedro.soto',
        password:       'colab123',
        rol:            'colaborador',
        tipo_contrato:  'reemplazo',
        sede_id:        2,
        rango_etario:   '25-34',
        rut:            '19.123.456-7',
        email:          'pedro.soto@alumco.cl',
        telefono:       '+56956789012',
        estamento:      'Servicios generales'
      }
    ];

    for (const u of seedUsuarios) {
      const [existe] = await conn.query(
        "SELECT id FROM usuarios WHERE identificador = ?", [u.identificador]
      );
      if (existe.length === 0) {
        const hash = bcrypt.hashSync(u.password, 10);
        await conn.query(
          `INSERT INTO usuarios
            (nombre, identificador, password_hash, rol, tipo_contrato, sede_id,
             rango_etario, rut, email, telefono, estamento)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [u.nombre, u.identificador, hash, u.rol, u.tipo_contrato, u.sede_id,
           u.rango_etario, u.rut, u.email, u.telefono, u.estamento]
        );
        console.log(`✓ Usuario creado: ${u.identificador} (${u.rol}) — contraseña: ${u.password}`);
      }
    }

    console.log('✓ Migración MySQL completada exitosamente');
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('✗ Error en migración:', err.message);
    await conn.end();
    process.exit(1);
  }
}

migrate();
