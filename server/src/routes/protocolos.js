const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { verificarToken, verificarRol } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/protocolos-lib'),
  filename: (req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${ts}_${safe}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF'), false);
  },
  limits: { fileSize: 20 * 1024 * 1024 }
});

// GET /api/protocolos — listar todos
router.get('/', verificarToken, verificarRol('jefatura', 'admin_sede', 'profesor'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.nombre AS creado_por_nombre
       FROM protocolos p
       LEFT JOIN usuarios u ON u.id = p.creado_por
       ORDER BY p.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/protocolos — subir nuevo protocolo
router.post('/', verificarToken, verificarRol('jefatura', 'admin_sede'), upload.single('protocolo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo PDF requerido' });
  const { nombre, descripcion } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const result = await pool.query(
      'INSERT INTO protocolos (nombre, descripcion, archivo_nombre, archivo_path, creado_por) VALUES ($1,$2,$3,$4,$5)',
      [nombre, descripcion || null, req.file.originalname, req.file.path, req.usuario?.id || null]
    );
    const nuevo = await pool.query('SELECT * FROM protocolos WHERE id = $1', [result.lastID]);
    res.status(201).json(nuevo.rows[0]);
  } catch (err) {
    if (req.file?.path) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/protocolos/:id — editar nombre/descripción
router.put('/:id', verificarToken, verificarRol('jefatura', 'admin_sede'), async (req, res) => {
  const { nombre, descripcion } = req.body;
  try {
    await pool.query(
      'UPDATE protocolos SET nombre = COALESCE($1, nombre), descripcion = $2, updated_at = NOW() WHERE id = $3',
      [nombre || null, descripcion ?? null, req.params.id]
    );
    const result = await pool.query('SELECT * FROM protocolos WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/protocolos/:id — eliminar protocolo y archivo
router.delete('/:id', verificarToken, verificarRol('jefatura', 'admin_sede'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM protocolos WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Protocolo no encontrado' });
    const prot = result.rows[0];
    if (fs.existsSync(prot.archivo_path)) fs.unlinkSync(prot.archivo_path);
    await pool.query('DELETE FROM protocolos WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
