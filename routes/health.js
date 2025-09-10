// ==========================================
// Health & Metrics Routes
// Liveness 200 OK para Railway
// Readiness separada
// ==========================================

const express = require('express');
const router = express.Router();

let logger;
try {
  logger = require('../config/logger');
} catch {
  // Fallback si no tienes logger aún
  logger = console;
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

function envStatus() {
  const required = ['JWT_SECRET', 'JWT_EXPIRES_IN', 'ADMIN_PASSWORD', 'FRONTEND_URL'];
  const optional = ['GEMINI_API_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'];

  const missingCore = required.filter(k => !process.env[k] || process.env[k] === '');
  const missingOptional = optional.filter(k => !process.env[k] || process.env[k] === '');
  const readinessOk = missingCore.length === 0 && missingOptional.length === 0;

  return { missingCore, missingOptional, readinessOk };
}

// ------------------------------------------
// Liveness (Railway Healthcheck → siempre 200)
// ------------------------------------------
router.get('/health', (req, res) => {
  const { missingCore, missingOptional, readinessOk } = envStatus();

  const healthData = {
    status: 'ok',
    readiness: readinessOk ? 'ready' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: process.uptime(),
      formatted: formatUptime(process.uptime())
    },
    node: {
      version: process.version,
      platform: process.platform,
      arch: process.arch
    },
    env: {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: process.env.PORT
    },
    missingCore,
    missingOptional
  };

  if (Math.random() < 0.01) {
    logger.debug?.('Health check performed', {
      ip: req.ip,
      uptime: healthData.uptime.formatted
    });
  }

  res.status(200).json({ success: true, data: healthData });
});

// ------------------------------------------
// Detailed (incluye ping opcional a Gemini)
// ------------------------------------------
router.get('/health/detailed', async (req, res) => {
  const start = Date.now();
  let geminiStatus = 'not_configured';
  let geminiResponseTime = null;

  try {
    const memoryUsage = process.memoryUsage();

    if (process.env.GEMINI_API_KEY) {
      geminiStatus = 'skipped';
      // Si quieres activar el ping real descomenta:
      // const { GoogleGenerativeAI } = require('@google/generative-ai');
      // const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      // const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });
      // const t0 = Date.now();
      // try {
      //   await Promise.race([
      //     model.generateContent('Health ping: responde "OK"'),
      //     new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), 5000))
      //   ]);
      //   geminiStatus = 'operational';
      // } catch (e) {
      //   geminiStatus = e.message.includes('Timeout') ? 'timeout' : 'error';
      // } finally {
      //   geminiResponseTime = Date.now() - t0;
      // }
    }

    const payload = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      responseTimeMs: Date.now() - start,
      services: {
        server: 'operational',
        gemini: { status: geminiStatus, responseTimeMs: geminiResponseTime }
      },
      system: {
        memory: {
          rssMB: Math.round(memoryUsage.rss / 1024 / 1024),
          heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024)
        },
        cpu: process.cpuUsage()
      }
    };

    logger.info?.('Detailed health check', {
      ip: req.ip,
      responseTimeMs: payload.responseTimeMs,
      geminiStatus
    });

    res.json({ success: true, data: payload });
  } catch (err) {
    logger.error?.('Detailed health error', { error: err.message, stack: err.stack });
    res.status(503).json({
      success: false,
      error: 'Health check fallido',
      data: { status: 'unhealthy', message: err.message }
    });
  }
});

// ------------------------------------------
// Readiness (200 si todo listo; 503 si falta algo)
// ------------------------------------------
router.get('/ready', (req, res) => {
  const { missingCore, missingOptional, readinessOk } = envStatus();

  if (!readinessOk) {
    return res.status(503).json({
      success: false,
      status: 'not_ready',
      reasons: {
        missingCore,
        missingOptional
      },
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  }

  res.json({
    success: true,
    status: 'ready',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ------------------------------------------
// Liveness (simple)
// ------------------------------------------
router.get('/live', (_req, res) => {
  const isAlive = process.uptime() > 0;
  if (!isAlive) return res.status(503).json({ success: false, status: 'not_alive' });

  res.json({
    success: true,
    status: 'alive',
    uptime: process.uptime(),
    pid: process.pid
  });
});

// ------------------------------------------
// Métricas básicas (JSON o Prometheus-like)
// ------------------------------------------
router.get('/metrics', (req, res) => {
  try {
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();

    const metrics = {
      timestamp: new Date().toISOString(),
      uptime_seconds: process.uptime(),
      memory: {
        rss_bytes: memory.rss,
        heap_total_bytes: memory.heapTotal,
        heap_used_bytes: memory.heapUsed,
        external_bytes: memory.external,
        heap_usage_percent: Math.round((memory.heapUsed / memory.heapTotal) * 100)
      },
      cpu: {
        user_microseconds: cpu.user,
        system_microseconds: cpu.system
      },
      process: {
        pid: process.pid,
        node: process.version,
        platform: process.platform
      }
    };

    if (req.query.format === 'prometheus') {
      let out = '';
      out += `# HELP nodejs_uptime_seconds Process uptime in seconds\n`;
      out += `# TYPE nodejs_uptime_seconds gauge\n`;
      out += `nodejs_uptime_seconds ${metrics.uptime_seconds}\n\n`;
      out += `# HELP nodejs_memory_heap_used_bytes Heap memory used\n`;
      out += `# TYPE nodejs_memory_heap_used_bytes gauge\n`;
      out += `nodejs_memory_heap_used_bytes ${metrics.memory.heap_used_bytes}\n\n`;
      out += `# HELP nodejs_memory_heap_total_bytes Total heap memory\n`;
      out += `# TYPE nodejs_memory_heap_total_bytes gauge\n`;
      out += `nodejs_memory_heap_total_bytes ${metrics.memory.heap_total_bytes}\n`;
      res.set('Content-Type', 'text/plain');
      return res.send(out);
    }

    res.json({ success: true, data: metrics });
  } catch (err) {
    logger.error?.('Metrics error', { error: err.message });
    res.status(500).json({
      success: false,
      error: 'Error obteniendo métricas',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
