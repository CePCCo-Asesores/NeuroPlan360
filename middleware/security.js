const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const config = require('../config');
const logger = require('../config/logger');

// Rate limiting principal
const mainRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: config.rateLimit.skipSuccessfulRequests,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  handler: (req, res) => {
    const clientIp = req.ip || req.connection.remoteAddress;
    
    logger.security('Rate Limit Exceeded', clientIp, req.get('User-Agent'), {
      endpoint: req.path,
      method: req.method,
      limit: config.rateLimit.maxRequests,
      windowMs: config.rateLimit.windowMs
    });

    res.status(429).json({
      success: false,
      error: 'Demasiadas solicitudes',
      details: `Máximo ${config.rateLimit.maxRequests} solicitudes por ${config.rateLimit.windowMs / 1000 / 60} minutos`,
      retryAfter: Math.round(config.rateLimit.windowMs / 1000),
      timestamp: new Date().toISOString()
    });
  },
  onLimitReached: (req) => {
    logger.warn('Rate limit reached', {
      ip: req.ip,
      endpoint: req.path,
      userAgent: req.get('User-Agent')
    });
  }
});

// Rate limiting estricto para generación de planes
const planGenerationLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 planes por 15 minutos
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  handler: (req, res) => {
    logger.security('Plan Generation Rate Limit Exceeded', req.ip, req.get('User-Agent'), {
      endpoint: req.path,
      method: req.method
    });

    res.status(429).json({
      success: false,
      error: 'Límite de generación excedido',
      details: 'Máximo 10 planes por 15 minutos. Por favor, espera antes de generar más planes.',
      retryAfter: Math.round(15 * 60),
      timestamp: new Date().toISOString()
    });
  }
});

// Rate limiting para admin
const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 requests para admin
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    logger.security('Admin Rate Limit Exceeded', req.ip, req.get('User-Agent'));
    
    res.status(429).json({
      success: false,
      error: 'Rate limit excedido para operaciones de administración',
      timestamp: new Date().toISOString()
    });
  }
});

// Configuración de Helmet para seguridad de headers
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://generativelanguage.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: {
    policy: "cross-origin"
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Middleware para prevenir ataques comunes
const preventCommonAttacks = (req, res, next) => {
  const clientIp = req.ip;
  const userAgent = req.get('User-Agent') || '';
  
  // Detectar patrones sospechosos en User-Agent
  const suspiciousPatterns = [
    /sqlmap/i,
    /nikto/i,
    /nmap/i,
    /masscan/i,
    /nessus/i,
    /burpsuite/i,
    /python-requests/i,
    /curl\/[\d.]+$/,
    /wget/i
  ];

  if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
    logger.security('Suspicious User Agent Detected', clientIp, userAgent, {
      endpoint: req.path,
      method: req.method,
      headers: req.headers
    });
    
    return res.status(403).json({
      success: false,
      error: 'Acceso denegado',
      timestamp: new Date().toISOString()
    });
  }

  // Verificar headers sospechosos
  const suspiciousHeaders = ['x-forwarded-host', 'x-real-ip'];
  for (const header of suspiciousHeaders) {
    if (req.get(header) && !req.get(header).includes(config.server.host)) {
      logger.security('Suspicious Header Detected', clientIp, userAgent, {
        header,
        value: req.get(header),
        endpoint: req.path
      });
    }
  }

  next();
};

// Middleware para validar sesiones y prevenir ataques
const sessionSecurity = (req, res, next) => {
  const sessionId = req.body.sessionId || req.params.sessionId;
  
  if (sessionId) {
    // Validar formato de sessionId
    const sessionPattern = /^nd_session_\d+_[a-zA-Z0-9]+$/;
    if (!sessionPattern.test(sessionId)) {
      logger.security('Invalid Session ID Format', req.ip, req.get('User-Agent'), {
        sessionId,
        endpoint: req.path
      });
      
      return res.status(400).json({
        success: false,
        error: 'Formato de sesión inválido',
        timestamp: new Date().toISOString()
      });
    }

    // Verificar que la sesión no sea demasiado antigua (potencial replay attack)
    const sessionTimestamp = sessionId.split('_')[2];
    const sessionAge = Date.now() - parseInt(sessionTimestamp);
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas

    if (sessionAge > maxAge) {
      logger.security('Expired Session Used', req.ip, req.get('User-Agent'), {
        sessionId,
        sessionAge: `${Math.round(sessionAge / 1000 / 60 / 60)}h`,
        endpoint: req.path
      });
      
      return res.status(400).json({
        success: false,
        error: 'Sesión expirada',
        details: 'La sesión ha expirado por razones de seguridad',
        timestamp: new Date().toISOString()
      });
    }
  }

  next();
};

// Middleware para logging de seguridad
const securityLogging = (req, res, next) => {
  const startTime = Date.now();
  
  // Log de request inicial
  if (config.logging.enableRequestLogging) {
    logger.request(req, {
      statusCode: 'pending',
      responseTime: 0
    });
  }

  // Override del res.json para capturar respuestas
  const originalJson = res.json;
  res.json = function(data) {
    const responseTime = Date.now() - startTime;
    
    // Log de respuesta
    logger.request(req, res, responseTime);
    
    // Log específico para errores de seguridad
    if (!data.success && res.statusCode >= 400) {
      logger.security('Security Response', req.ip, req.get('User-Agent'), {
        statusCode: res.statusCode,
        endpoint: req.path,
        method: req.method,
        responseTime: `${responseTime}ms`,
        errorType: data.error
      });
    }

    // Performance logging para requests lentos
    if (responseTime > 5000) {
      logger.performance('Slow Request', responseTime, {
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent')
      });
    }

    originalJson.call(this, data);
  };

  next();
};

// Middleware de autenticación simple para admin
const adminAuth = (req, res, next) => {
  const authHeader = req.get('Authorization');
  const adminPassword = config.security.adminPassword;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.security('Admin Access Attempt - No Auth', req.ip, req.get('User-Agent'), {
      endpoint: req.path
    });
    
    return res.status(401).json({
      success: false,
      error: 'Autenticación requerida',
      timestamp: new Date().toISOString()
    });
  }

  const token = authHeader.substring(7);
  
  if (token !== adminPassword) {
    logger.security('Admin Access Attempt - Wrong Password', req.ip, req.get('User-Agent'), {
      endpoint: req.path,
      providedToken: token.substring(0, 10) + '...'
    });
    
    return res.status(403).json({
      success: false,
      error: 'Acceso denegado',
      timestamp: new Date().toISOString()
    });
  }

  logger.info('Admin Access Granted', {
    ip: req.ip,
    endpoint: req.path,
    userAgent: req.get('User-Agent')
  });

  next();
};

// Configuración CORS personalizada
const corsOptions = {
  origin: (origin, callback) => {
    // Permitir requests sin origin (apps móviles, postman, etc.)
    if (!origin) return callback(null, true);
    
    if (config.frontend.allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      logger.security('CORS Violation', null, null, {
        origin,
        allowedOrigins: config.frontend.allowedOrigins
      });
      
      const error = new Error('No permitido por CORS');
      error.status = 403;
      return callback(error, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
  maxAge: 86400 // 24 hours
};

// Cleanup de memoria para prevenir memory leaks
const memoryCleanup = () => {
  if (global.gc) {
    global.gc();
    logger.debug('Memory cleanup executed', {
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    });
  }
};

// Ejecutar cleanup cada 30 minutos
setInterval(memoryCleanup, 30 * 60 * 1000);

module.exports = {
  mainRateLimit,
  planGenerationLimit,
  adminRateLimit,
  helmetConfig,
  corsOptions,
  preventCommonAttacks,
  sessionSecurity,
  securityLogging,
  adminAuth,
  memoryCleanup
};