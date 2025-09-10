require('dotenv').config();

const config = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3001,
    host: process.env.HOST || 'localhost',
    nodeEnv: process.env.NODE_ENV || 'development',
    requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 30000,
    keepAliveTimeout: parseInt(process.env.KEEP_ALIVE_TIMEOUT) || 5000,
    maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb'
  },

  // API Configuration
  api: {
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
    secretKey: process.env.API_SECRET_KEY,
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3001/api'
  },

  // Frontend Configuration
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3000',
    allowedOrigins: process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:3001']
  },

  // Auth Configuration
  auth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI || process.env.FRONTEND_URL + '/auth/callback'
    },
    jwt: {
      secret: process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      issuer: 'nd-assistant',
      audience: 'nd-assistant-users'
    }
  },

  // Security Configuration
  security: {
    jwtSecret: process.env.JWT_SECRET || 'default-jwt-secret-change-in-production',
    adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
    corsEnabled: true,
    helmetEnabled: true
  },

  // Rate Limiting Configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS === 'true',
    maxSessionsPerIp: parseInt(process.env.MAX_SESSIONS_PER_IP) || 10
  },

  // Memory Management
  memory: {
    cleanupInterval: parseInt(process.env.MEMORY_CLEANUP_INTERVAL) || 60 * 60 * 1000, // 1 hora
    maxSessionAge: parseInt(process.env.MAX_SESSION_AGE) || 60 * 60 * 1000, // 1 hora
    maxSessions: parseInt(process.env.MAX_SESSIONS) || 1000
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs/app.log',
    enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING === 'true',
    enableErrorLogging: true,
    enableDebugLogging: process.env.NODE_ENV === 'development'
  },

  // Feature Flags
  features: {
    websockets: process.env.ENABLE_WEBSOCKETS !== 'false',
    adminRoutes: process.env.ENABLE_ADMIN_ROUTES !== 'false',
    feedbackCollection: process.env.ENABLE_FEEDBACK_COLLECTION !== 'false',
    analytics: process.env.ENABLE_ANALYTICS === 'true'
  },

  // Database Configuration (for future use)
  database: {
    url: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL
  },

  // Email Configuration (for future use)
  email: {
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  },

  // Monitoring Configuration
  monitoring: {
    sentryDsn: process.env.SENTRY_DSN,
    newRelicKey: process.env.NEW_RELIC_LICENSE_KEY
  },

  // Gemini Configuration
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
    maxRetries: 3,
    timeoutMs: 30000,
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_ONLY_HIGH'
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH'
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_ONLY_HIGH'
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_ONLY_HIGH'
      }
    ],
    generationConfig: {
      temperature: 0.7,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 8192
    }
  }
};

// Validación de configuración crítica
const validateConfig = () => {
  const required = [
    'api.geminiApiKey'
  ];

  const missing = required.filter(key => {
    const value = key.split('.').reduce((obj, k) => obj && obj[k], config);
    return !value;
  });

  if (missing.length > 0 && config.server.nodeEnv === 'production') {
    console.error('❌ Configuración faltante:', missing.join(', '));
    process.exit(1);
  }

  if (missing.length > 0 && config.server.nodeEnv !== 'production') {
    console.warn('⚠️  Configuración faltante (modo desarrollo):', missing.join(', '));
  }
};

// Validar configuración al cargar
validateConfig();

module.exports = config;