require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'alumco',
  });

  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS practicos (
        id INT PRIMARY KEY AUTO_INCREMENT,
        curso_id INT NOT NULL,
        sede_id INT NOT NULL,
        titulo VARCHAR(200) NOT NULL,
        descripcion TEXT,
        fecha DATE NOT NULL,
        hora_inicio TIME NOT NULL,
        hora_fin TIME,
        lugar VARCHAR(200),
        creado_por INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE,
        FOREIGN KEY (sede_id) REFERENCES sedes(id),
        FOREIGN KEY (creado_por) REFERENCES usuarios(id)
      )
    `);
    console.log('✓ Tabla practicos creada');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS notificaciones (
        id INT PRIMARY KEY AUTO_INCREMENT,
        usuario_id INT NOT NULL,
        practico_id INT,
        titulo VARCHAR(200) NOT NULL,
        mensaje TEXT NOT NULL,
        leida TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (practico_id) REFERENCES practicos(id) ON DELETE CASCADE
      )
    `);
    console.log('✓ Tabla notificaciones creada');

    console.log('✓ Migración de prácticos completada');
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('✗ Error:', err.message);
    await conn.end();
    process.exit(1);
  }
}

migrate();
