// ==========================================
// Middleware de Seguridad para NeuroPlan360
// Compatible con express-rate-limit v7+
// ==========================================

const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');
const logger = require('../config/logger');

// Rate limiting general
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // máximo 100 requests por ventana
  message: {
    error: 'Demasiadas solicitudes desde esta IP',
    message: 'Por favor intenta de nuevo en unos minutos',
    retryAfter: Math.round(parseInt(process.env.RATE_LIMIT_WINDOW_MS) / 1000) || 900
  },
  standardHeaders: true, // Incluir headers rate limit en respuesta
  legacyHeaders: false, // Deshabilitar headers `X-RateLimit-*`
  // onLimitReached removido en v7 - usamos handler en su lugar
  handler: (req, res) => {
    logger.warn(`Rate limit alcanzado para IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      method: req.method
    });
    
    res.status(429).json({
      error: 'Demasiadas solicitudes desde esta IP',
      message: 'Por favor intenta de nuevo en unos minutos',
      retryAfter: Math.round(parseInt(process.env.RATE_LIMIT_WINDOW_MS) / 1000) || 900
    });
  }
});

// Rate limiting específico para generación de planes ND
const ndPlanLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 planes por ventana
  message: {
    error: 'Límite de generación de planes alcanzado',
    message: 'Puedes generar hasta 10 planes cada 15 minutos',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit ND alcanzado para IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.body?.sessionId
    });
    
    res.status(429).json({
      error: 'Límite de generación de planes alcanzado',
      message: 'Puedes generar hasta 10 planes cada 15 minutos',
      retryAfter: 900
    });
  }
});

// Rate limiting para rutas de administración
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // máximo 20 requests por ventana
  message: {
    error: 'Límite de administración alcanzado',
    message: 'Demasiadas operaciones administrativas',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.error(`Rate limit ADMIN alcanzado para IP: ${req.ip}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path
    });
    
    res.status(429).json({
      error: 'Límite de administración alcanzado',
      message: 'Demasiadas operaciones administrativas',
      retryAfter: 900
    });
  }
});

// Slow down para requests frecuentes
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutos
  delayAfter: 50, // permitir 50 requests a velocidad completa
  delayMs: 500, // agregar 500ms de delay por request después del límite
  maxDelayMs: 5000, // máximo delay de 5 segundos
  });

// Configuración de Helmet para seguridad de headers
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Permitir WebSockets
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Middleware para logging de seguridad
const securityLogger = (req, res, next) => {
  // Log de requests sospechosos
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
      body: req.body,
      headers: req.headers
    });
  }

  // Log de requests a endpoints sensibles
  const sensitiveEndpoints = ['/api/admin', '/api/export', '/api/feedback'];
  if (sensitiveEndpoints.some(endpoint => req.originalUrl.startsWith(endpoint))) {
    logger.info('Acceso a endpoint sensible', {
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      userAgent: userAgent
    });
  }

  next();
};

// Middleware para validar origen de requests
const originValidator = (req, res, next) => {
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:3001',
    'https://localhost:3000',
    'https://localhost:3001'
  ].filter(Boolean);

  const origin = req.get('Origin');
  const referer = req.get('Referer');

  // Permitir requests sin origin (como Postman, cURL)
  if (!origin && !referer) {
    return next();
  }

  // Verificar origin permitido
  const isAllowedOrigin = allowedOrigins.some(allowed => 
    origin?.startsWith(allowed) || referer?.startsWith(allowed)
  );

  if (!isAllowedOrigin && process.env.NODE_ENV === 'production') {
    logger.warn('Request desde origen no permitido', {
      ip: req.ip,
      origin: origin,
      referer: referer,
      url: req.originalUrl
    });
    
    return res.status(403).json({
      error: 'Origen no permitido',
      message: 'Este request no está autorizado desde este origen'
    });
  }

  next();
};

module.exports = {
  generalLimiter,
  ndPlanLimiter,
  adminLimiter,
  speedLimiter,
  helmetConfig,
  securityLogger,
  originValidator
};
