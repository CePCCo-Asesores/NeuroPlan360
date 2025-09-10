// ==========================================
// Middleware de Seguridad para NeuroPlan360
// Completo con todos los exports esperados
// ==========================================

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const logger = require('../config/logger');

// ==========================================
// Rate Limiters Base
// ==========================================

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: {
    error: 'Demasiadas solicitudes',
    message: 'Por favor intenta de nuevo en unos minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  onLimitReached: (req, res, options) => {
    logger.warn(`Rate limit general alcanzado para IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  }
});

const ndPlanLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  message: {
    error: 'Límite de planes alcanzado',
    message: 'Puedes generar hasta 10 planes cada 15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,
  onLimitReached: (req, res, options) => {
    logger.warn(`Rate limit ND alcanzado para IP: ${req.ip}`, {
      ip: req.ip,
      sessionId: req.body?.sessionId
    });
  }
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,
  message: {
    error: 'Límite de administración alcanzado',
    message: 'Demasiadas operaciones administrativas'
  },
  standardHeaders: true,
  legacyHeaders: false,
  onLimitReached: (req, res, options) => {
    logger.error(`Rate limit ADMIN alcanzado para IP: ${req.ip}`, {
      ip: req.ip,
      endpoint: req.path
    });
  }
});

// ==========================================
// Configuración de Helmet
// ==========================================

const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:", process.env.FRONTEND_URL || "http://localhost:3000"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// ==========================================
// CORS Options
// ==========================================

const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || "http://localhost:3000")
  .split(',')
  .map(origin => origin.trim());

const corsOptions = {
  origin: function (origin, callback) {
    // Permitir requests sin origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS: Origen no permitido', { origin, allowedOrigins });
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id', 'x-admin-key']
};

// ==========================================
// Middleware de Autenticación Admin
// ==========================================

const adminAuth = (req, res, next) => {
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (!adminPassword) {
    return res.status(503).json({
      error: 'Administración no configurada'
    });
  }

  const providedKey = req.headers['x-admin-key'] || req.body.adminKey || req.query.adminKey;
  
  if (!providedKey || providedKey !== adminPassword) {
    logger.warn('Intento de acceso admin no autorizado', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      providedKey: providedKey ? '***' : 'none'
    });
    
    return res.status(401).json({
      error: 'No autorizado',
      message: 'Credenciales de administrador requeridas'
    });
  }

  next();
};

// ==========================================
// Middleware de Seguridad de Sesión
// ==========================================

const sessionSecurity = (req, res, next) => {
  const sessionId = req.headers['x-session-id'] || req.body.sessionId;
  
  // Verificar formato de sessionId (debe ser tipo UUID o formato específico)
  if (sessionId && !/^nd_session_\d+_[a-f0-9]{8}$/i.test(sessionId)) {
    logger.warn('SessionId con formato inválido', {
      sessionId,
      ip: req.ip
    });
    
    return res.status(400).json({
      error: 'Session ID inválido',
      message: 'El formato del session ID no es válido'
    });
  }

  // Opcional: limitar sesiones por IP
  const maxSessionsPerIp = parseInt(process.env.MAX_SESSIONS_PER_IP) || 10;
  // TODO: Implementar contador de sesiones por IP si es necesario

  req.sessionId = sessionId;
  next();
};

// ==========================================
// Middleware de Logging de Seguridad
// ==========================================

const securityLogger = (req, res, next) => {
  // Detectar patrones sospechosos
  const suspiciousPatterns = [
    /\.\./,           // Path traversal
    /<script/i,       // XSS attempts
    /union.*select/i, // SQL injection
    /javascript:/i,   // JavaScript injection
    /vbscript:/i,     // VBScript injection
    /onload=/i,       // Event handler injection
    /eval\(/i,        // Code evaluation
    /expression\(/i   // CSS expression injection
  ];

  const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
  const userAgent = req.get('User-Agent') || '';
  const requestBody = JSON.stringify(req.body || {});
  
  // Verificar patrones sospechosos
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(fullUrl) || 
    pattern.test(userAgent) || 
    pattern.test(requestBody)
  );

  if (isSuspicious) {
    logger.warn('Request sospechoso detectado', {
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      userAgent: userAgent,
      body: req.body
    });
  }

  // Log de requests a endpoints sensibles
  const sensitiveEndpoints = ['/api/admin', '/api/auth', '/api/generate-nd-plan'];
  if (sensitiveEndpoints.some(endpoint => req.originalUrl.startsWith(endpoint))) {
    logger.info('Acceso a endpoint sensible', {
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      userAgent: userAgent,
      sessionId: req.headers['x-session-id']
    });
  }

  next();
};

// ==========================================
// Middleware Anti-Ataques Comunes
// ==========================================

const preventCommonAttacks = [
  helmetConfig,
  (req, res, next) => {
    // Validar tamaño de headers
    const headerSize = JSON.stringify(req.headers).length;
    if (headerSize > 8192) { // 8KB max headers
      logger.warn('Headers demasiado grandes', {
        ip: req.ip,
        size: headerSize
      });
      return res.status(413).json({
        error: 'Headers demasiado grandes'
      });
    }

    // Validar User-Agent
    const userAgent = req.get('User-Agent');
    if (!userAgent || userAgent.length < 10) {
      logger.warn('User-Agent sospechoso', {
        ip: req.ip,
        userAgent: userAgent
      });
    }

    next();
  }
];

// ==========================================
// Aliases para compatibilidad
// ==========================================

const mainRateLimit = generalLimiter;
const planGenerationLimit = ndPlanLimiter;
const adminRateLimit = adminLimiter;
const securityLogging = securityLogger;

// ==========================================
// Exportaciones
// ==========================================

module.exports = {
  // Rate limiters base
  generalLimiter,
  ndPlanLimiter,
  adminLimiter,
  
  // Aliases para compatibilidad
  mainRateLimit,
  planGenerationLimit,
  adminRateLimit,
  
  // Configuraciones
  helmetConfig,
  corsOptions,
  
  // Middleware de autenticación y sesión
  adminAuth,
  sessionSecurity,
  
  // Middleware de logging y seguridad
  securityLogger,
  securityLogging, // alias
  preventCommonAttacks
};
