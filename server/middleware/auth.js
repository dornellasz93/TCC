const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ugb-tcc-presenca-2026-secret-key-change-in-prod';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      role: user.role,
      registration_number: user.registration_number,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function extractBearerToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

function optionalAuth(req, res, next) {
  const token = extractBearerToken(req);
  if (token) {
    try {
      req.authUser = verifyToken(token);
    } catch (err) {
      // Token inválido ignorado no modo opcional
    }
  }
  next();
}

function requireAuth(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({
      success: false,
      error_code: 'AUTH_REQUIRED',
      message: 'Token JWT de autenticação ausente. Faça login novamente.'
    });
  }

  try {
    req.authUser = verifyToken(token);
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error_code: 'INVALID_TOKEN',
      message: 'Sessão expirada ou token inválido. Faça login novamente.'
    });
  }
}

function requireTeacher(req, res, next) {
  requireAuth(req, res, () => {
    if (req.authUser?.role !== 'teacher' && req.authUser?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error_code: 'FORBIDDEN_ROLE',
        message: 'Acesso restrito a docentes autorizados.'
      });
    }
    next();
  });
}

module.exports = {
  JWT_SECRET,
  signToken,
  verifyToken,
  optionalAuth,
  requireAuth,
  requireTeacher
};
