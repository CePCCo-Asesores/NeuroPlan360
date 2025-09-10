// Configuración de variables de entorno para testing

process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.HOST = 'localhost';
process.env.GEMINI_API_KEY = 'test-gemini-api-key';
process.env.GEMINI_MODEL = 'gemini-2.0-flash-exp';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:3001';
process.env.JWT_SECRET = 'test-jwt-secret-32-chars-minimum';
process.env.ADMIN_PASSWORD = 'test-admin-password';
process.env.API_SECRET_KEY = 'test-api-secret-key';
process.env.LOG_LEVEL = 'error';
process.env.ENABLE_REQUEST_LOGGING = 'false';
process.env.ENABLE_WEBSOCKETS = 'true';
process.env.ENABLE_ADMIN_ROUTES = 'true';
process.env.ENABLE_FEEDBACK_COLLECTION = 'true';
process.env.ENABLE_ANALYTICS = 'false';
process.env.RATE_LIMIT_WINDOW_MS = '900000';
process.env.RATE_LIMIT_MAX_REQUESTS = '100';
process.env.MEMORY_CLEANUP_INTERVAL = '60000';
process.env.MAX_SESSION_AGE = '3600000';
process.env.MAX_REQUEST_SIZE = '10mb';
process.env.REQUEST_TIMEOUT = '5000';

// Suprimir warnings de deprecation en tests
process.env.NODE_NO_WARNINGS = '1';