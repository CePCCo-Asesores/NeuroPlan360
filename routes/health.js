const express = require('express');
const router = express.Router();
const config = require('../config');
const logger = require('../config/logger');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Health check básico
router.get('/health', (req, res) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: config.server.nodeEnv,
    services: {
      server: 'operational',
      gemini: !!config.api.geminiApiKey ? 'configured' : 'not_configured',
      websockets: config.features.websockets ? 'enabled' : 'disabled',
      logging: 'operational'
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    }
  };

  // Log cada cierto tiempo para no saturar
  if (Math.random() < 0.01) { // 1% de los health checks
    logger.debug('Health check performed', {
      ip: req.ip,
      uptime: `${Math.round(process.uptime())}s`,
      memoryUsed: `${healthData.system.memory.used}MB`
    });
  }

  res.json({
    success: true,
    data: healthData
  });
});

// Health check detallado
router.get('/health/detailed', async (req, res) => {
  const startTime = Date.now();
  let geminiStatus = 'unknown';
  let geminiResponseTime = null;

  try {
    // Test de conectividad con Gemini
    if (config.api.geminiApiKey) {
      const geminiStart = Date.now();
      try {
        const genAI = new GoogleGenerativeAI(config.api.geminiApiKey);
        const model = genAI.getGenerativeModel({ model: config.api.geminiModel });
        
        // Test simple
        const result = await Promise.race([
          model.generateContent('Test de conectividad: responde "OK"'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
        
        geminiResponseTime = Date.now() - geminiStart;
        geminiStatus = 'operational';
      } catch (error) {
        geminiResponseTime = Date.now() - geminiStart;
        geminiStatus = error.message.includes('Timeout') ? 'timeout' : 'error';
        
        logger.warn('Gemini health check failed', {
          error: error.message,
          responseTime: geminiResponseTime
        });
      }
    } else {
      geminiStatus = 'not_configured';
    }

    const memoryUsage = process.memoryUsage();
    const healthData = {
      status: geminiStatus === 'operational' || geminiStatus === 'not_configured' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      uptime: {
        seconds: process.uptime(),
        formatted: formatUptime(process.uptime())
      },
      version: '1.0.0',
      environment: config.server.nodeEnv,
      services: {
        server: {
          status: 'operational',
          port: config.server.port,
          host: config.server.host
        },
        gemini: {
          status: geminiStatus,
          model: config.api.geminiModel,
          responseTime: geminiResponseTime,
          configured: !!config.api.geminiApiKey
        },
        websockets: {
          status: config.features.websockets ? 'enabled' : 'disabled'
        },
        logging: {
          status: 'operational',
          level: config.logging.level,
          requestLogging: config.logging.enableRequestLogging
        }
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
          usage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
        },
        cpu: {
          usage: process.cpuUsage()
        }
      },
      configuration: {
        features: config.features,
        rateLimit: {
          enabled: true,
          maxRequests: config.rateLimit.maxRequests,
          windowMs: config.rateLimit.windowMs
        },
        cors: {
          enabled: true,
          allowedOrigins: config.frontend.allowedOrigins.length
        }
      }
    };

    logger.info('Detailed health check performed', {
      ip: req.ip,
      responseTime: healthData.responseTime,
      geminiStatus,
      geminiResponseTime,
      memoryUsage: healthData.system.memory.usage
    });

    res.json({
      success: true,
      data: healthData
    });

  } catch (error) {
    logger.error('Detailed health check failed', {
      error: error.message,
      stack: error.stack,
      responseTime: Date.now() - startTime
    });

    res.status(503).json({
      success: false,
      error: 'Health check fallido',
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        error: error.message
      }
    });
  }
});

// Readiness check (para Kubernetes/Docker)
router.get('/ready', (req, res) => {
  const isReady = !!config.api.geminiApiKey && process.uptime() > 5; // 5 segundos de warm-up
  
  if (isReady) {
    res.json({
      success: true,
      status: 'ready',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } else {
    res.status(503).json({
      success: false,
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      reasons: [
        !config.api.geminiApiKey ? 'gemini_not_configured' : null,
        process.uptime() <= 5 ? 'warming_up' : null
      ].filter(Boolean)
    });
  }
});

// Liveness check (para Kubernetes/Docker)
router.get('/live', (req, res) => {
  // Verificar que el proceso esté vivo y respondiendo
  const isAlive = process.uptime() > 0;
  
  if (isAlive) {
    res.json({
      success: true,
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      pid: process.pid
    });
  } else {
    res.status(503).json({
      success: false,
      status: 'not_alive',
      timestamp: new Date().toISOString()
    });
  }
});

// Métricas básicas para monitoreo
router.get('/metrics', (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime_seconds: process.uptime(),
      memory: {
        rss_bytes: memoryUsage.rss,
        heap_total_bytes: memoryUsage.heapTotal,
        heap_used_bytes: memoryUsage.heapUsed,
        external_bytes: memoryUsage.external,
        heap_usage_percent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
      },
      cpu: {
        user_microseconds: cpuUsage.user,
        system_microseconds: cpuUsage.system
      },
      process: {
        pid: process.pid,
        version: process.version,
        platform: process.platform
      }
    };

    // Formato Prometheus-like (opcional)
    if (req.query.format === 'prometheus') {
      let prometheusText = '';
      prometheusText += `# HELP nodejs_uptime_seconds Process uptime in seconds\n`;
      prometheusText += `# TYPE nodejs_uptime_seconds gauge\n`;
      prometheusText += `nodejs_uptime_seconds ${metrics.uptime_seconds}\n\n`;
      
      prometheusText += `# HELP nodejs_memory_heap_used_bytes Heap memory used\n`;
      prometheusText += `# TYPE nodejs_memory_heap_used_bytes gauge\n`;
      prometheusText += `nodejs_memory_heap_used_bytes ${metrics.memory.heap_used_bytes}\n\n`;
      
      prometheusText += `# HELP nodejs_memory_heap_total_bytes Total heap memory\n`;
      prometheusText += `# TYPE nodejs_memory_heap_total_bytes gauge\n`;
      prometheusText += `nodejs_memory_heap_total_bytes ${metrics.memory.heap_total_bytes}\n\n`;

      res.set('Content-Type', 'text/plain');
      return res.send(prometheusText);
    }

    res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    logger.error('Metrics endpoint error', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Error obteniendo métricas',
      timestamp: new Date().toISOString()
    });
  }
});

// Status de la API
router.get('/status', (req, res) => {
  const status = {
    api: 'Asistente de Planeación Inclusiva y Neurodivergente',
    version: '1.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    environment: config.server.nodeEnv,
    uptime: formatUptime(process.uptime()),
    endpoints: {
      health: '/api/health',
      detailed_health: '/api/health/detailed',
      ready: '/api/ready',
      live: '/api/live',
      metrics: '/api/metrics',
      main_api: '/api/generate-nd-plan'
    },
    features: {
      neurodiversities_supported: [
        'TDAH', 'Autismo', 'Dislexia', 'Discalculia', 'Disgrafía',
        'Altas Capacidades', 'Tourette', 'Dispraxia', 
        'Procesamiento Sensorial', 'Ansiedad'
      ],
      user_types_supported: [
        'Docentes', 'Terapeutas', 'Padres/Madres', 'Médicos', 'Mixtos', 'Otros'
      ],
      output_formats: [
        'Práctico', 'Completo', 'ND Plus', 'Sensorial', 'Semáforo ND'
      ]
    },
    gemini: {
      configured: !!config.api.geminiApiKey,
      model: config.api.geminiModel
    }
  };

  res.json({
    success: true,
    data: status
  });
});

// Función auxiliar para formatear uptime
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