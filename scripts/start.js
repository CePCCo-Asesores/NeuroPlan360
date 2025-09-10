#!/usr/bin/env node

// Script de inicio personalizado para el servidor ND Assistant
const path = require('path');
const fs = require('fs');

// Verificar que existe el archivo de configuración
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ Archivo .env no encontrado');
  console.log('📋 Copia .env.example a .env y configura las variables necesarias');
  console.log('   cp .env.example .env');
  process.exit(1);
}

// Cargar variables de entorno
require('dotenv').config({ path: envPath });

// Verificar configuración crítica
const requiredVars = ['GEMINI_API_KEY'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Variables de entorno faltantes:', missingVars.join(', '));
  console.log('📝 Asegúrate de configurar estas variables en tu archivo .env');
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  } else {
    console.log('⚠️  Continuando en modo desarrollo...');
  }
}

// Verificar versión de Node.js
const nodeVersion = process.version;
const requiredVersion = 'v16.0.0';
if (nodeVersion < requiredVersion) {
  console.error(`❌ Node.js ${requiredVersion} o superior es requerido. Actual: ${nodeVersion}`);
  process.exit(1);
}

console.log('🚀 Iniciando ND Assistant Backend...');
console.log(`📦 Node.js ${nodeVersion}`);
console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔑 Gemini configurado: ${process.env.GEMINI_API_KEY ? '✅' : '❌'}`);

// Iniciar el servidor
try {
  require('../server');
} catch (error) {
  console.error('❌ Error iniciando servidor:', error.message);
  console.error(error.stack);
  process.exit(1);
}