module.exports = {
  // Directorio base para resolver módulos
  rootDir: '.',
  
  // Entorno de testing
  testEnvironment: 'node',
  
  // Patrones para encontrar tests
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Directorios a ignorar
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],
  
  // Configuración de coverage
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    'config/**/*.js',
    'middleware/**/*.js',
    'routes/**/*.js',
    'services/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!**/node_modules/**',
    '!**/vendor/**'
  ],
  
  // Directorio de reportes de coverage
  coverageDirectory: 'coverage',
  
  // Reportes de coverage
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html'
  ],
  
  // Umbrales de coverage
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Configuración de setup
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  
  // Timeout para tests
  testTimeout: 10000,
  
  // Variables de entorno para testing
  setupFiles: ['<rootDir>/test/env.js'],
  
  // Transformaciones
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // Mapeo de módulos
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@middleware/(.*)$': '<rootDir>/middleware/$1',
    '^@routes/(.*)$': '<rootDir>/routes/$1',
    '^@services/(.*)$': '<rootDir>/services/$1'
  },
  
  // Configuración para tests de integración
  globalSetup: '<rootDir>/test/global-setup.js',
  globalTeardown: '<rootDir>/test/global-teardown.js',
  
  // Verbose output
  verbose: true,
  
  // Detectar archivos abiertos
  detectOpenHandles: true,
  
  // Forzar salida
  forceExit: true,
  
  // Configuración de reporters
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'test-results',
      outputName: 'junit.xml'
    }]
  ],
  
  // Configuración adicional para CI/CD
  ci: process.env.CI === 'true',
  
  // Cache
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // Configuración de workers
  maxWorkers: process.env.CI ? 2 : '50%',
  
  // Mostrar todos los tests
  passWithNoTests: true
};