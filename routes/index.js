const express = require('express');
const router = express.Router();

// Importar rutas específicas
const authRoutes = require('./auth');
const ndRoutes = require('./nd');
const adminRoutes = require('./admin');
const healthRoutes = require('./health');

// Usar rutas específicas
router.use('/api/auth', authRoutes);
router.use('/api', ndRoutes);
router.use('/api/admin', adminRoutes);
router.use('/api', healthRoutes);

// Ruta raíz de la API
router.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'API del Asistente de Planeación Inclusiva y Neurodivergente',
    version: '1.0.0',
    endpoints: {
      auth: {
        googleLogin: 'POST /api/auth/google',
        logout: 'POST /api/auth/logout',
        profile: 'GET /api/auth/profile',
        updateProfile: 'PUT /api/auth/profile',
        refreshToken: 'POST /api/auth/refresh',
        deleteAccount: 'DELETE /api/auth/account',
        googleConfig: 'GET /api/auth/google/config'
      },
      main: {
        health: '/api/health',
        generatePlan: 'POST /api/generate-nd-plan',
        regeneratePlan: 'POST /api/regenerate-plan',
        getSession: 'GET /api/session/:sessionId',
        feedback: 'POST /api/feedback',
        exportPlan: 'POST /api/export-plan',
        neurodiversities: 'GET /api/neurodiversities'
      },
      admin: '/api/admin/* (requiere autenticación)'
    },
    documentation: {
      websockets: 'Socket.IO habilitado en el mismo puerto',
      authentication: 'Google OAuth 2.0 + JWT tokens',
      rateLimit: 'Límites aplicados por IP y endpoint',
      cors: 'Configurado para frontend específico'
    },
    timestamp: new Date().toISOString()
  });
});

// Middleware para rutas no encontradas
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint no encontrado',
    availableEndpoints: '/api',
    requestedPath: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;