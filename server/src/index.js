require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes          = require('./routes/auth');
const usuariosRoutes      = require('./routes/usuarios');
const cursosRoutes        = require('./routes/cursos');
const evaluacionesRoutes  = require('./routes/evaluaciones');
const certificadosRoutes  = require('./routes/certificados');
const reportesRoutes      = require('./routes/reportes');
const iaRoutes            = require('./routes/ia');
const sedesRoutes         = require('./routes/sedes');
const practicosRoutes     = require('./routes/practicos');
const notificacionesRoutes = require('./routes/notificaciones');

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth',           authRoutes);
app.use('/api/usuarios',       usuariosRoutes);
app.use('/api/cursos',         cursosRoutes);
app.use('/api/evaluaciones',   evaluacionesRoutes);
app.use('/api/certificados',   certificadosRoutes);
app.use('/api/reportes',       reportesRoutes);
app.use('/api/ia',             iaRoutes);
app.use('/api/sedes',          sedesRoutes);
app.use('/api/practicos',      practicosRoutes);
app.use('/api/notificaciones', notificacionesRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor ALUMCO corriendo en puerto ${PORT}`));
