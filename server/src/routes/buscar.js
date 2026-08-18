const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verificarToken } = require('../middleware/auth');

// GET /api/buscar?q=texto — resultados combinados para el buscador global.
//
// Mismo alcance por rol que /cursos, para no inventar una segunda fuente de
// verdad sobre qué puede ver cada rol: colaborador ve cursos publicados de
// su sede/estamento, profesor ve los suyos, admin_sede/jefatura ven todos.
// La búsqueda de usuarios solo aplica a jefatura: es el único rol con una
// pantalla de gestión de usuarios (/jefatura/usuarios) a la que navegar —
// admin_sede no tiene ruta equivalente todavía.
router.get('/', verificarToken, async (req, res) => {
  const { rol, id } = req.usuario;
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json({ cursos: [], usuarios: [] });
  const like = `%${q}%`;

  try {
    let cursosQuery, cursosParams;
    if (rol === 'colaborador') {
      cursosQuery = `
        SELECT c.id, c.nombre
        FROM cursos c
        JOIN usuarios me ON me.id = ?
        WHERE c.publicado = 1 AND c.nombre LIKE ?
          AND (c.sede_objetivo IS NULL OR c.sede_objetivo = COALESCE(me.sede_id, 0))
          AND (
            NOT EXISTS (SELECT 1 FROM curso_estamentos ce WHERE ce.curso_id = c.id)
            OR EXISTS (SELECT 1 FROM curso_estamentos ce WHERE ce.curso_id = c.id AND ce.estamento_id = me.estamento_id)
          )
        ORDER BY c.nombre LIMIT 6`;
      cursosParams = [id, like];
    } else if (rol === 'profesor') {
      cursosQuery = `SELECT id, nombre FROM cursos WHERE profesor_id = ? AND nombre LIKE ? ORDER BY nombre LIMIT 6`;
      cursosParams = [id, like];
    } else {
      cursosQuery = `SELECT id, nombre FROM cursos WHERE nombre LIKE ? ORDER BY nombre LIMIT 6`;
      cursosParams = [like];
    }
    const { rows: cursos } = await pool.query(cursosQuery, cursosParams);

    let usuarios = [];
    if (rol === 'jefatura') {
      const { rows } = await pool.query(
        `SELECT id, nombre, identificador, rol FROM usuarios
         WHERE (nombre LIKE ? OR identificador LIKE ?) ORDER BY nombre LIMIT 6`,
        [like, like]
      );
      usuarios = rows;
    }

    res.json({ cursos, usuarios });
  } catch (err) {
    console.error('[GET /buscar]', err);
    res.status(500).json({ error: 'Error al buscar' });
  }
});

module.exports = router;
