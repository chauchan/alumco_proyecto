const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: { error: 'Demasiados intentos de inicio de sesión. Intentá de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  message: { error: 'Demasiados intentos de restablecimiento de contraseña. Intentá de nuevo en 1 hora.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { loginLimiter, passwordResetLimiter };
