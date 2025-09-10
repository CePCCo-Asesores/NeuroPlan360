const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const config = require('../config');
const logger = require('../config/logger');

// Cliente OAuth2 de Google
const googleClient = new OAuth2Client(config.auth.google.clientId);

// Middleware para verificar JWT token
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token de autenticación requerido',
        code: 'AUTH_TOKEN_MISSING',
        timestamp: new Date().toISOString()
      });
    }

    const token = authHeader.substring(7);
    
    const decoded = jwt.verify(token, config.security.jwtSecret);
    
    // Verificar que el token no haya expirado
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return res.status(401).json({
        success: false,
        error: 'Token expirado',
        code: 'AUTH_TOKEN_EXPIRED',
        timestamp: new Date().toISOString()
      });
    }

    // Agregar información del usuario al request
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
      googleId: decoded.googleId,
      role: decoded.role || 'user',
      tokenIssuedAt: decoded.iat,
      tokenExpiresAt: decoded.exp
    };

    logger.debug('Token verified successfully', {
      userId: req.user.id,
      email: req.user.email,
      endpoint: req.path
    });

    next();
  } catch (error) {
    logger.warn('Token verification failed', {
      error: error.message,
      token: req.headers.authorization?.substring(0, 20) + '...',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    let errorMessage = 'Token inválido';
    let errorCode = 'AUTH_TOKEN_INVALID';

    if (error.name === 'TokenExpiredError') {
      errorMessage = 'Token expirado';
      errorCode = 'AUTH_TOKEN_EXPIRED';
    } else if (error.name === 'JsonWebTokenError') {
      errorMessage = 'Token malformado';
      errorCode = 'AUTH_TOKEN_MALFORMED';
    }

    return res.status(401).json({
      success: false,
      error: errorMessage,
      code: errorCode,
      timestamp: new Date().toISOString()
    });
  }
};

// Middleware para verificar Google ID token
const verifyGoogleToken = async (req, res, next) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({
        success: false,
        error: 'Google ID token requerido',
        code: 'GOOGLE_TOKEN_MISSING',
        timestamp: new Date().toISOString()
      });
    }

    // Verificar el token con Google
    const ticket = await googleClient.verifyIdToken({
      idToken: idToken,
      audience: config.auth.google.clientId
    });

    const payload = ticket.getPayload();
    
    // Verificar que el token sea válido y no expirado
    if (!payload || !payload.email_verified) {
      return res.status(400).json({
        success: false,
        error: 'Email no verificado por Google',
        code: 'GOOGLE_EMAIL_NOT_VERIFIED',
        timestamp: new Date().toISOString()
      });
    }

    // Agregar información del usuario de Google al request
    req.googleUser = {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      emailVerified: payload.email_verified,
      locale: payload.locale,
      familyName: payload.family_name,
      givenName: payload.given_name
    };

    logger.info('Google token verified successfully', {
      email: req.googleUser.email,
      name: req.googleUser.name,
      googleId: req.googleUser.googleId
    });

    next();
  } catch (error) {
    logger.error('Google token verification failed', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });

    return res.status(400).json({
      success: false,
      error: 'Token de Google inválido',
      code: 'GOOGLE_TOKEN_INVALID',
      details: config.server.nodeEnv === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
};

// Middleware para verificar roles específicos
const requireRole = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Autenticación requerida',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

    if (!allowedRoles.includes(userRole)) {
      logger.warn('Access denied - insufficient role', {
        userId: req.user.id,
        userRole: userRole,
        requiredRoles: allowedRoles,
        endpoint: req.path,
        ip: req.ip
      });

      return res.status(403).json({
        success: false,
        error: 'Permisos insuficientes',
        code: 'AUTH_INSUFFICIENT_PERMISSIONS',
        requiredRoles: allowedRoles,
        userRole: userRole,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
};

// Middleware opcional (no requiere auth pero la usa si está presente)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No hay token, continuar sin usuario
    req.user = null;
    return next();
  }

  // Hay token, intentar verificarlo pero no fallar si es inválido
  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.security.jwtSecret);
    
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
      googleId: decoded.googleId,
      role: decoded.role || 'user'
    };
  } catch (error) {
    // Token inválido pero no es un error crítico
    req.user = null;
    logger.debug('Optional auth failed, continuing without user', {
      error: error.message,
      ip: req.ip
    });
  }

  next();
};

// Función para generar JWT token
const generateToken = (user, expiresIn = '7d') => {
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    googleId: user.googleId,
    role: user.role || 'user',
    iat: Math.floor(Date.now() / 1000)
  };

  return jwt.sign(payload, config.security.jwtSecret, {
    expiresIn: expiresIn,
    issuer: 'nd-assistant',
    audience: 'nd-assistant-users'
  });
};

// Función para refrescar token
const refreshToken = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado',
        code: 'AUTH_USER_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }

    // Verificar si el token expira en menos de 24 horas
    const expiresAt = req.user.tokenExpiresAt * 1000;
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    const twentyFourHours = 24 * 60 * 60 * 1000;

    if (timeUntilExpiry < twentyFourHours) {
      // Generar nuevo token
      const newToken = generateToken(req.user);
      
      res.set('X-New-Token', newToken);
      
      logger.info('Token refreshed', {
        userId: req.user.id,
        oldExpiry: new Date(expiresAt).toISOString(),
        timeUntilExpiry: Math.round(timeUntilExpiry / 1000 / 60) + ' minutes'
      });
    }

    next();
  } catch (error) {
    logger.error('Token refresh failed', {
      error: error.message,
      userId: req.user?.id
    });
    next(); // Continuar aunque falle el refresh
  }
};

// Middleware para logging de autenticación
const authLogging = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    // Log de eventos de autenticación
    if (req.path.includes('/auth/') && data.success === false) {
      logger.security('Authentication failed', req.ip, req.get('User-Agent'), {
        endpoint: req.path,
        method: req.method,
        error: data.error,
        code: data.code,
        userId: req.user?.id
      });
    }

    if (req.user && req.path.includes('/auth/login')) {
      logger.info('User logged in', {
        userId: req.user.id,
        email: req.user.email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }

    originalJson.call(this, data);
  };

  next();
};

// Rate limiting específico para auth
const authRateLimit = require('express-rate-limit')({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 intentos de login por IP por ventana
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    logger.security('Auth rate limit exceeded', req.ip, req.get('User-Agent'), {
      endpoint: req.path,
      method: req.method
    });

    res.status(429).json({
      success: false,
      error: 'Demasiados intentos de autenticación',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      retryAfter: Math.round(15 * 60),
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = {
  verifyToken,
  verifyGoogleToken,
  requireRole,
  optionalAuth,
  generateToken,
  refreshToken,
  authLogging,
  authRateLimit
};