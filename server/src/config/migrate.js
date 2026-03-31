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
        activo TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (sede_id) REFERENCES sedes(id)
      )
    `);

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
        tipo ENUM('pdf','video','ppt'),
        archivo_url VARCHAR(500),
        orden INT DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE
      )
    `);

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
        UNIQUE KEY uq_progreso (usuario_id, curso_id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
        FOREIGN KEY (curso_id) REFERENCES cursos(id)
      )
    `);

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

    // Usuario admin de prueba
    const [admins] = await conn.query("SELECT id FROM usuarios WHERE identificador = 'admin'");
    if (admins.length === 0) {
      const hash = bcrypt.hashSync('admin123', 10);
      await conn.query(
        "INSERT INTO usuarios (nombre, identificador, password_hash, rol) VALUES (?, ?, ?, ?)",
        ['Administrador ALUMCO', 'admin', hash, 'jefatura']
      );
      console.log('✓ Usuario de prueba creado:');
      console.log('  identificador: admin');
      console.log('  contraseña:    admin123');
      console.log('  rol:           jefatura');
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
