// Test setup para Jest
const { beforeAll, afterAll, beforeEach, afterEach } = require('@jest/globals');

// Configurar timeout global
jest.setTimeout(10000);

// Configurar variables de entorno para testing
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.GEMINI_API_KEY = 'test-api-key';
process.env.ADMIN_PASSWORD = 'test-admin-password';

// Suprimir logs durante testing
const originalConsole = { ...console };

beforeAll(() => {
  // Silenciar console durante tests excepto errores críticos
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.debug = jest.fn();
  // Mantener console.error para debugging
});

afterAll(() => {
  // Restaurar console
  Object.assign(console, originalConsole);
});

// Limpiar entre tests
beforeEach(() => {
  // Limpiar mocks
  jest.clearAllMocks();
  
  // Limpiar variables de entorno modificadas en tests
  delete process.env.TEST_VAR;
});

afterEach(() => {
  // Limpiar timers
  jest.clearAllTimers();
  
  // Limpiar event listeners
  process.removeAllListeners('test-event');
});

// Mocks globales
jest.mock('../config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  ndOperation: jest.fn(),
  ndError: jest.fn(),
  geminiCall: jest.fn(),
  websocket: jest.fn(),
  security: jest.fn(),
  performance: jest.fn(),
  stream: {
    write: jest.fn()
  }
}));

// Mock para Gemini API
jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: jest.fn().mockReturnValue('Respuesta de prueba de Gemini')
        }
      })
    })
  }))
}));

// Mock para Socket.IO
jest.mock('socket.io', () => ({
  Server: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
    close: jest.fn()
  }))
}));

// Utilidades para testing
global.testHelpers = {
  // Crear request mock
  createMockReq: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    ip: '127.0.0.1',
    get: jest.fn((header) => {
      const headers = {
        'user-agent': 'test-agent',
        'content-type': 'application/json',
        ...overrides.headers
      };
      return headers[header.toLowerCase()];
    }),
    ...overrides
  }),

  // Crear response mock
  createMockRes: () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.set = jest.fn().mockReturnValue(res);
    res.get = jest.fn();
    return res;
  },

  // Crear next mock
  createMockNext: () => jest.fn(),

  // Esperar por promesa
  waitFor: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),

  // Crear datos de test ND válidos
  createValidNDData: (overrides = {}) => ({
    userType: 'teacher',
    neurodiversities: ['tdah'],
    menuOption: 'create',
    theme: 'matemáticas',
    objectives: 'enseñar sumas básicas',
    ageGroup: '6-8 años',
    outputFormat: 'practical',
    ...overrides
  }),

  // Crear sessionId de test válido
  createValidSessionId: () => `nd_session_${Date.now()}_test123`,

  // Verificar estructura de respuesta ND
  expectNDResponse: (response) => {
    expect(response).toHaveProperty('success');
    expect(response).toHaveProperty('timestamp');
    if (response.success) {
      expect(response).toHaveProperty('data');
      expect(response).toHaveProperty('sessionId');
    } else {
      expect(response).toHaveProperty('error');
    }
  },

  // Verificar estructura de sesión ND
  expectNDSession: (session) => {
    expect(session).toHaveProperty('userType');
    expect(session).toHaveProperty('neurodiversities');
    expect(Array.isArray(session.neurodiversities)).toBe(true);
    expect(session).toHaveProperty('timestamp');
    expect(typeof session.timestamp).toBe('number');
  }
};

// Configurar process handlers para testing
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

module.exports = {};