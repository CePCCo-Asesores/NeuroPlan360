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

// Rutas
const healthRoutes = require('./routes/health'); // <-- health separado para Railway
const routes = require('./routes');               // resto de rutas (auth, nd, admin, etc.)

// Crear aplicación Express
const app = express();
const server = http.createServer(app);

// *** MUY IMPORTANTE: confiar en proxy ANTES de rate limits / lectura de IP ***
app.set('trust proxy', 1);

// --- Middlewares base (orden afinado) ---
app.use(helmetConfig);                                   // Cabeceras seguras
app.use(cors(corsOptions));                              // CORS antes de parsers
app.use(express.json({ limit: config.server.maxRequestSize }));
app.use(express.urlencoded({ extended: true, limit: config.server.maxRequestSize }));

// Logging de requests (a archivos/STDOUT según tu logger)
if (config.logging.enableRequestLogging) {
  app.use(morgan('combined', { stream: logger.stream }));
}

// Logging de seguridad y checks básicos
app.use(securityLogging);
app.use(preventCommonAttacks);

// ==========================================
// Health endpoints primero (liveness 200 OK)
// ==========================================
app.use('/api', healthRoutes); // /api/health, /api/ready, etc.

// ==========================================
// Rate limiting general (después de health)
// ==========================================
app.use(mainRateLimit);

// =======================
// Configurar Socket.IO
// =======================
const io = socketIo(server, {
  // Socket.IO acepta { origin: [...] }, pero tu corsOptions funciona (usa callback por origen).
  // Si alguna vez falla, cámbialo a { origin: allowedOriginsArray, methods: ['GET','POST'] }.
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
      sessionId: sessionId,
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

// Hacer disponible la función globalmente
global.emitStatusUpdate = emitStatusUpdate;

// =======================
// Montar resto de rutas
// =======================
app.use(routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    pat
