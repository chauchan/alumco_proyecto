require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new sqlite3.Database(path.join(DB_DIR, 'alumco.db'));

// Ejecutar un statement como promesa
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// Obtener filas como promesa
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function migrate() {
  try {
    await run('PRAGMA foreign_keys = ON');

    await run(`CREATE TABLE IF NOT EXISTS sedes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      ciudad TEXT,
      activa INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`);

    await run(`CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      identificador TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL CHECK (rol IN ('colaborador','profesor','admin_sede','jefatura')),
      tipo_contrato TEXT CHECK (tipo_contrato IN ('fijo','reemplazo')),
      sede_id INTEGER REFERENCES sedes(id),
      rango_etario TEXT,
      activo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`);

    await run(`CREATE TABLE IF NOT EXISTS cursos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      area TEXT,
      profesor_id INTEGER REFERENCES usuarios(id),
      publicado INTEGER DEFAULT 0,
      generado_por_ia INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`);

    await run(`CREATE TABLE IF NOT EXISTS modulos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      curso_id INTEGER REFERENCES cursos(id) ON DELETE CASCADE,
      titulo TEXT NOT NULL,
      descripcion TEXT,
      tipo TEXT CHECK (tipo IN ('pdf','video','ppt')),
      archivo_url TEXT,
      orden INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`);

    await run(`CREATE TABLE IF NOT EXISTS asignaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER REFERENCES usuarios(id),
      curso_id INTEGER REFERENCES cursos(id),
      obligatorio INTEGER DEFAULT 0,
      fecha_limite TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(usuario_id, curso_id)
    )`);

    await run(`CREATE TABLE IF NOT EXISTS progreso (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER REFERENCES usuarios(id),
      curso_id INTEGER REFERENCES cursos(id),
      completado INTEGER DEFAULT 0,
      porcentaje INTEGER DEFAULT 0,
      ultimo_acceso TEXT,
      UNIQUE(usuario_id, curso_id)
    )`);

    await run(`CREATE TABLE IF NOT EXISTS preguntas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      curso_id INTEGER REFERENCES cursos(id) ON DELETE CASCADE,
      texto TEXT NOT NULL,
      alternativas TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`);

    await run(`CREATE TABLE IF NOT EXISTS intentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER REFERENCES usuarios(id),
      curso_id INTEGER REFERENCES cursos(id),
      numero_intento INTEGER DEFAULT 1,
      respuestas TEXT,
      nota INTEGER,
      aprobado INTEGER DEFAULT 0,
      fecha TEXT DEFAULT (datetime('now'))
    )`);

    await run(`CREATE TABLE IF NOT EXISTS certificados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER REFERENCES usuarios(id),
      curso_id INTEGER REFERENCES cursos(id),
      intento_id INTEGER REFERENCES intentos(id),
      validado_por INTEGER REFERENCES usuarios(id),
      estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobado','rechazado')),
      archivo_url TEXT,
      fecha_emision TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`);

    // Sedes iniciales
    const sedes = await all(`SELECT id FROM sedes WHERE nombre = 'ELEAM Hualpén'`);
    if (sedes.length === 0) {
      await run(`INSERT INTO sedes (nombre, ciudad) VALUES ('ELEAM Hualpén', 'Hualpén')`);
      await run(`INSERT INTO sedes (nombre, ciudad) VALUES ('ELEAM Coyhaique', 'Coyhaique')`);
      console.log('✓ Sedes creadas');
    }

    // Usuario admin de prueba
    const admins = await all(`SELECT id FROM usuarios WHERE identificador = 'admin'`);
    if (admins.length === 0) {
      const hash = bcrypt.hashSync('admin123', 10);
      await run(
        `INSERT INTO usuarios (nombre, identificador, password_hash, rol) VALUES (?, ?, ?, ?)`,
        ['Administrador ALUMCO', 'admin', hash, 'jefatura']
      );
      console.log('✓ Usuario de prueba creado:');
      console.log('  identificador: admin');
      console.log('  contraseña:    admin123');
      console.log('  rol:           jefatura');
    }

    console.log('✓ Migración completada exitosamente');
    db.close();
    process.exit(0);
  } catch (err) {
    console.error('✗ Error en migración:', err.message);
    db.close();
    process.exit(1);
  }
}

migrate();
