const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('./index');

// Crear directorio de logs si no existe
const logDir = path.dirname(config.logging.filePath);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Formato personalizado para logs
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Formato para consola
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Crear transports
const transports = [
  // Archivo de logs generales
  new winston.transports.File({
    filename: config.logging.filePath,
    level: config.logging.level,
    format: customFormat,
    maxsize: 10485760, // 10MB
    maxFiles: 5,
    tailable: true
  }),

  // Archivo específico para errores
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format: customFormat,
    maxsize: 10485760, // 10MB
    maxFiles: 5,
    tailable: true
  })
];

// Agregar consola si no estamos en producción
if (config.server.nodeEnv !== 'production') {
  transports.push(
    new winston.transports.Console({
      level: config.logging.enableDebugLogging ? 'debug' : 'info',
      format: consoleFormat
    })
  );
}

// Crear logger principal
const logger = winston.createLogger({
  level: config.logging.level,
  format: customFormat,
  transports,
  exitOnError: false,
  silent: config.server.nodeEnv === 'test'
});

// Logger específico para requests HTTP
const requestLogger = winston.createLogger({
  level: 'info',
  format: customFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'requests.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 3,
      tailable: true
    })
  ],
  silent: !config.logging.enableRequestLogging
});

// Logger específico para operaciones ND
const ndLogger = winston.createLogger({
  level: 'info',
  format: customFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'nd-operations.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 3,
      tailable: true
    })
  ],
  silent: config.server.nodeEnv === 'test'
});

// Funciones de conveniencia
const loggers = {
  // Logger principal
  info: (message, meta = {}) => logger.info(message, meta),
  warn: (message, meta = {}) => logger.warn(message, meta),
  error: (message, meta = {}) => logger.error(message, meta),
  debug: (message, meta = {}) => logger.debug(message, meta),

  // Request logging
  request: (req, res, responseTime) => {
    if (!config.logging.enableRequestLogging) return;
    
    requestLogger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      contentLength: res.get('Content-Length') || 0,
      timestamp: new Date().toISOString()
    });
  },

  // ND operations logging
  ndOperation: (operation, sessionId, userType, neurodiversities, meta = {}) => {
    ndLogger.info('ND Operation', {
      operation,
      sessionId,
      userType,
      neurodiversities,
      timestamp: new Date().toISOString(),
      ...meta
    });
  },

  // Error específico para ND
  ndError: (error, sessionId, context = {}) => {
    ndLogger.error('ND Operation Error', {
      error: error.message,
      stack: error.stack,
      sessionId,
      context,
      timestamp: new Date().toISOString()
    });
  },

  // Gemini API logging
  geminiCall: (prompt, responseLength, responseTime, success = true) => {
    logger.info('Gemini API Call', {
      promptLength: prompt.length,
      responseLength,
      responseTime: `${responseTime}ms`,
      success,
      model: config.api.geminiModel,
      timestamp: new Date().toISOString()
    });
  },

  // WebSocket logging
  websocket: (event, socketId, sessionId, data = {}) => {
    logger.debug('WebSocket Event', {
      event,
      socketId,
      sessionId,
      data,
      timestamp: new Date().toISOString()
    });
  },

  // Security logging
  security: (event, ip, userAgent, details = {}) => {
    logger.warn('Security Event', {
      event,
      ip,
      userAgent,
      details,
      timestamp: new Date().toISOString()
    });
  },

  // Performance logging
  performance: (operation, duration, details = {}) => {
    logger.info('Performance Metric', {
      operation,
      duration: `${duration}ms`,
      details,
      timestamp: new Date().toISOString()
    });
  }
};

// Stream para Morgan (HTTP request logging)
loggers.stream = {
  write: (message) => {
    requestLogger.info(message.trim());
  }
};

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
  
  // Darle tiempo al logger para escribir
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: promise.toString(),
    timestamp: new Date().toISOString()
  });
});

module.exports = loggers;