// Global teardown para Jest - se ejecuta después de todos los tests

module.exports = async () => {
  console.log('🧹 Limpiando después de tests...');
  
  // Limpiar recursos globales
  // Por ejemplo:
  // await cleanupTestDatabase();
  // await closeConnections();
  
  // Forzar garbage collection si está disponible
  if (global.gc) {
    global.gc();
  }
  
  console.log('✅ Teardown global completado');
};