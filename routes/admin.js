const express = require('express');
const router = express.Router();
const { adminRateLimit, adminAuth } = require('../middleware/security');
const NDAssistantProcessor = require('../services/NDAssistantProcessor');
const logger = require('../config/logger');
const config = require('../config');

// Instancia del procesador ND
const ndProcessor = new NDAssistantProcessor();

// Aplicar rate limiting y autenticación a todas las rutas admin
router.use(adminRateLimit);
router.use(adminAuth);

// Estadísticas del sistema
router.get('/stats', (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const activeSessions = Array.from(ndProcessor.conversationalMemory.entries()).map(([id, data]) => ({
      sessionId: id,
      userType: data.userType,
      neurodiversities: data.neurodiversities,
      timestamp: data.timestamp,
      age: Date.now() - data.timestamp,
      ageFormatted: formatAge(Date.now() - data.timestamp)
    }));

    const stats = {
      server: {
        uptime: process.uptime(),
        uptimeFormatted: formatUptime(process.uptime()),
        nodeVersion: process.version,
        platform: process.platform,
        environment: config.server.nodeEnv,
        startTime: new Date(Date.now() - process.uptime() * 1000).toISOString()
      },
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100} MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100} MB`,
        arrayBuffers: `${Math.round(memoryUsage.arrayBuffers / 1024 / 1024 * 100) / 100} MB`
      },
      sessions: {
        total: ndProcessor.conversationalMemory.size,
        active: activeSessions.filter(s => s.age < 60 * 60 * 1000).length, // Últimas 1 hora
        activeSessions: activeSessions.filter(s => s.age < 60 * 60 * 1000),
        oldest: activeSessions.length > 0 ? Math.max(...activeSessions.map(s => s.age)) : 0,
        newest: activeSessions.length > 0 ? Math.min(...activeSessions.map(s => s.age)) : 0
      },
      operations: ndProcessor.getOperationStats(),
      performance: {
        averageResponseTime: ndProcessor.getAverageResponseTime(),
        totalRequests: ndProcessor.getTotalRequests(),
        errorRate: ndProcessor.getErrorRate(),
        successRate: ndProcessor.getSuccessRate()
      }
    };

    logger.info('Admin stats accessed', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      totalSessions: stats.sessions.total,
      activeSessions: stats.sessions.active
    });

    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error getting admin stats', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Error obteniendo estadísticas',
      timestamp: new Date().toISOString()
    });
  }
});

// Obtener logs recientes
router.get('/logs', (req, res) => {
  try {
    const { lines = 100, level = 'info', type = 'all' } = req.query;
    
    // En una implementación real, leerías los archivos de log
    // Por ahora, simulamos con información del logger
    const logs = {
      message: 'En desarrollo: implementar lectura de archivos de log',
      availableLogTypes: ['app', 'requests', 'nd-operations', 'error'],
      requestedLines: parseInt(lines),
      requestedLevel: level,
      requestedType: type,
      logFiles: {
        app: config.logging.filePath,
        requests: './logs/requests.log',
        ndOperations: './logs/nd-operations.log',
        error: './logs/error.log'
      }
    };

    logger.info('Admin logs accessed', {
      ip: req.ip,
      lines: parseInt(lines),
      level,
      type
    });

    res.json({
      success: true,
      data: logs,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error getting logs', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Error obteniendo logs',
      timestamp: new Date().toISOString()
    });
  }
});

// Gestión de sesiones
router.get('/sessions', (req, res) => {
  try {
    const { active, userType, neurodiversity } = req.query;
    let sessions = Array.from(ndProcessor.conversationalMemory.entries()).map(([id, data]) => ({
      sessionId: id,
      userType: data.userType,
      customRole: data.customRole,
      neurodiversities: data.neurodiversities,
      priorityND: data.priorityND,
      menuOption: data.menuOption,
      outputFormat: data.outputFormat,
      timestamp: data.timestamp,
      age: Date.now() - data.timestamp,
      ageFormatted: formatAge(Date.now() - data.timestamp),
      isActive: (Date.now() - data.timestamp) < 60 * 60 * 1000 // 1 hora
    }));

    // Filtros
    if (active === 'true') {
      sessions = sessions.filter(s => s.isActive);
    }
    if (userType) {
      sessions = sessions.filter(s => s.userType === userType);
    }
    if (neurodiversity) {
      sessions = sessions.filter(s => s.neurodiversities.includes(neurodiversity));
    }

    // Ordenar por timestamp descendente
    sessions.sort((a, b) => b.timestamp - a.timestamp);

    logger.info('Admin sessions accessed', {
      ip: req.ip,
      totalSessions: sessions.length,
      filters: { active, userType, neurodiversity }
    });

    res.json({
      success: true,
      data: {
        sessions,
        total: sessions.length,
        filters: { active, userType, neurodiversity }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error getting sessions', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Error obteniendo sesiones',
      timestamp: new Date().toISOString()
    });
  }
});

// Eliminar sesión específica
router.delete('/sessions/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionExists = ndProcessor.conversationalMemory.has(sessionId);
    
    if (sessionExists) {
      const sessionData = ndProcessor.conversationalMemory.get(sessionId);
      ndProcessor.conversationalMemory.delete(sessionId);
      
      logger.info('Admin deleted session', {
        sessionId,
        userType: sessionData.userType,
        age: Date.now() - sessionData.timestamp,
        deletedBy: req.ip
      });

      res.json({
        success: true,
        message: 'Sesión eliminada correctamente',
        sessionId,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Sesión no encontrada',
        sessionId,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    logger.error('Error deleting session', {
      error: error.message,
      sessionId: req.params.sessionId,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Error eliminando sesión',
      sessionId: req.params.sessionId,
      timestamp: new Date().toISOString()
    });
  }
});

// Limpiar sesiones antiguas
router.post('/cleanup', (req, res) => {
  try {
    const { maxAge = 60 * 60 * 1000 } = req.body; // Default 1 hora
    const beforeCount = ndProcessor.conversationalMemory.size;
    
    let deletedCount = 0;
    const cutoffTime = Date.now() - maxAge;
    
    for (const [sessionId, data] of ndProcessor.conversationalMemory.entries()) {
      if (data.timestamp < cutoffTime) {
        ndProcessor.conversationalMemory.delete(sessionId);
        deletedCount++;
      }
    }

    const afterCount = ndProcessor.conversationalMemory.size;

    logger.info('Admin cleanup executed', {
      beforeCount,
      afterCount,
      deletedCount,
      maxAge,
      executedBy: req.ip
    });

    res.json({
      success: true,
      message: 'Limpieza ejecutada correctamente',
      data: {
        sessionsBefore: beforeCount,
        sessionsAfter: afterCount,
        deleted: deletedCount,
        maxAge: maxAge,
        cutoffTime: new Date(cutoffTime).toISOString()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error executing cleanup', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Error ejecutando limpieza',
      timestamp: new Date().toISOString()
    });
  }
});

// Configuración del sistema
router.get('/config', (req, res) => {
  try {
    // Configuración segura (sin claves sensibles)
    const safeConfig = {
      server: {
        port: config.server.port,
        host: config.server.host,
        nodeEnv: config.server.nodeEnv,
        maxRequestSize: config.server.maxRequestSize
      },
      features: config.features,
      rateLimit: {
        windowMs: config.rateLimit.windowMs,
        maxRequests: config.rateLimit.maxRequests,
        maxSessionsPerIp: config.rateLimit.maxSessionsPerIp
      },
      memory: {
        cleanupInterval: config.memory.cleanupInterval,
        maxSessionAge: config.memory.maxSessionAge,
        maxSessions: config.memory.maxSessions
      },
      logging: {
        level: config.logging.level,
        enableRequestLogging: config.logging.enableRequestLogging,
        enableErrorLogging: config.logging.enableErrorLogging
      },
      gemini: {
        model: config.gemini.model,
        hasApiKey: !!config.gemini.apiKey,
        maxRetries: config.gemini.maxRetries,
        timeoutMs: config.gemini.timeoutMs,
        generationConfig: config.gemini.generationConfig
      }
    };

    logger.info('Admin config accessed', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: safeConfig,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error getting config', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Error obteniendo configuración',
      timestamp: new Date().toISOString()
    });
  }
});

// Reiniciar contador de estadísticas
router.post('/reset-stats', (req, res) => {
  try {
    ndProcessor.resetStats();
    
    logger.info('Admin stats reset', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Estadísticas reiniciadas correctamente',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error resetting stats', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Error reiniciando estadísticas',
      timestamp: new Date().toISOString()
    });
  }
});

// Funciones auxiliares
function formatAge(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

module.exports = router;