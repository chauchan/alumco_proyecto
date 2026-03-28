const jwt = require('jsonwebtoken');

// Verifica token JWT y adjunta usuario al request
function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// Verifica que el usuario tenga uno de los roles permitidos
function verificarRol(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    }
    next();
  };
}

// Verifica que el admin_sede solo acceda a datos de su sede
function verificarSede(req, res, next) {
  const { rol, sede_id } = req.usuario;
  if (rol === 'jefatura') return next(); // jefatura ve todo
  if (rol === 'admin_sede') {
    const sedeRequerida = parseInt(req.params.sede_id || req.query.sede_id);
    if (sedeRequerida && sedeRequerida !== sede_id) {
      return res.status(403).json({ error: 'Solo puedes ver datos de tu sede' });
    }
  }
  next();
}

module.exports = { verificarToken, verificarRol, verificarSede };
