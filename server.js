require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');

// Importar configuración y servicios
const config = require('./config');
const logger = require('./config/logger');
const {
  helmetConfig,
  corsOptions,
  securityLogging,
  preventCommonAttacks,
  mainRateLimit
} = require('./middleware/security');
const routes = require('./routes');

// ==========================================
// Crear aplicación Express y servidor HTTP
// ==========================================
const app = express();
const server = http.createServer(app);

// *** MUY IMPORTANTE: confiar en proxy ANTES de todo (Railway / Nginx / CF) ***
app.set('trust proxy', 1);

// ==========================================
// Healthcheck mínimo (antes de cualquier middleware)
// Siempre 200 OK para Railway
// ==========================================
app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true, ts: Date.now() });
});

// ==========================================
// Middlewares base
// ==========================================
app.use(helmetConfig);
app.use(cors(corsOptions));
app.use(express.json({ limit: config.server.maxRequestSize }));
app.use(express.urlencoded({ extended: true, limit: config.server.maxRequestSize }));

// Logging de requests
if (config.logging.enableRequestLogging) {
  app.use(morgan('combined', { stream: logger.stream }));
}

// Middlewares de seguridad adicionales
app.use(securityLogging);
app.use(preventCommonAttacks);

// ==========================================
// Rate limit general (después de health)
// ==========================================
app.use(mainRateLimit);

// ==========================================
// Socket.IO
// ==========================================
const io = socketIo(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
});

io.on('connection', (socket) => {
  logger.websocket('client_connected', socket.id, null, {
    userAgent: socket.request.headers['user-agent'],
    ip: socket.request.connection?.remoteAddress
  });

  socket.on('join-session', (sessionId) => {
    socket.join(sessionId);
    logger.websocket('session_joined', socket.id, sessionId);

    socket.emit('session-status', {
      status: 'connected',
      sessionId,
      message: 'Conectado a la sesión ND',
      timestamp: Date.now()
    });
  });

  socket.on('generation-status', (data) => {
    if (data?.sessionId) {
      socket.to(data.sessionId).emit('status-update', data);
    }
    logger.websocket('status_broadcast', socket.id, data?.sessionId, {
      status: data?.status
    });
  });

  socket.on('disconnect', () => {
    logger.websocket('client_disconnected', socket.id);
  });

  socket.on('error', (error) => {
    logger.error('Socket.IO error', {
      error: error.message,
      socketId: socket.id,
      stack: error.stack
    });
  });
});

// Función para emitir actualizaciones de estado
function emitStatusUpdate(sessionId, status, message, data = {}) {
  io.to(sessionId).emit('status-update', {
    status,
    message,
    data,
    timestamp: Date.now()
  });

  logger.websocket('status_update', null, sessionId, {
    status,
    message,
    dataKeys: Object.keys(data || {})
  });
}
global.emitStatusUpdate = emitStatusUpdate;

// ==========================================
// Rutas de la aplicación
// ==========================================
app.use(routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    path: req.originalUrl
  });
});

// Error handler (último)
app.use((error, req, res, next) => {
  const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  logger.error('Unhandled application error', {
    errorId,
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const errorResponse = {
    success: false,
    error: config.server.nodeEnv === 'production' ? 'Error interno del servidor' : error.message,
    errorId,
    timestamp: new Date().toISOString()
  };

  if (config.server.nodeEnv === 'development') {
    errorResponse.stack = error.stack;
  }

  res.status(error.status || 500).json(errorResponse);
});

// Manejo de promesas no capturadas
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: promise && promise.toString ? promise.toString() : String(promise)
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });
  setTimeout(() => process.exit(1), 1000);
});

// ==========================================
// Start (HOST forzado a 0.0.0.0 en producción)
// ==========================================
const PORT = process.env.PORT || config.server.port || 3001;
const HOST =
  process.env.NODE_ENV === 'production'
    ? '0.0.0.0'
    : (config.server.host || '0.0.0.0');

server.listen(PORT, HOST, () => {
  logger.info('🧠 ND Assistant Backend Started', {
    port: PORT,
    host: HOST,
    environment: config.server.nodeEnv,
    nodeVersion: process.version,
    pid: process.pid
  });

  logger.info('🌈 Features Enabled', {
    websockets: config.features.websockets,
    adminRoutes: config.features.adminRoutes,
    feedbackCollection: config.features.feedbackCollection,
    requestLogging: config.logging.enableRequestLogging
  });

  logger.info('🔑 Services Configuration', {
    geminiConfigured: !!config.api.geminiApiKey,
    geminiModel: config.api.geminiModel,
    frontendUrl: config.frontend.url,
    corsOrigins: config.frontend.allowedOrigins.length
  });

  if (config.server.nodeEnv === 'development') {
    logger.info('🛠️ Development URLs', {
      api: `http://${HOST}:${PORT}/api`,
      health: `http://${HOST}:${PORT}/api/health`,
      admin: `http://${HOST}:${PORT}/api/admin/stats`,
      docs: `http://${HOST}:${PORT}/api`
    });
  }

  if (!config.api.geminiApiKey) {
    logger.warn('⚠️ Gemini API Key not configured - some features will not work');
  }
  if (config.security.adminPassword === 'admin123') {
    logger.warn('⚠️ Using default admin password - change in production');
  }
});

// Exportar para testing
module.exports = { app, server, io };
