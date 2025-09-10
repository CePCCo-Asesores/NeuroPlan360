// Global setup para Jest - se ejecuta antes de todos los tests

module.exports = async () => {
  // Configurar variables de entorno globales para todos los tests
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  
  // Suprimir warnings de Node.js durante testing
  process.env.NODE_NO_WARNINGS = '1';
  
  // Configurar timeout para operaciones globales
  jest.setTimeout(10000);
  
  console.log('🧪 Iniciando suite de tests ND Assistant...');
  
  // Aquí se podrían inicializar bases de datos de test, etc.
  // Por ejemplo:
  // await setupTestDatabase();
  // await seedTestData();
  
  console.log('✅ Setup global completado');
};