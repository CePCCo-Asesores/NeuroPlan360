#!/usr/bin/env node

// Script para inicializar directorios necesarios del proyecto
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

// Directorios que deben existir
const requiredDirectories = [
  'logs',
  'data',
  'tmp',
  'uploads'
];

// Archivos que deben existir con contenido por defecto
const requiredFiles = [
  {
    path: '.env',
    template: '.env.example',
    required: false
  }
];

console.log('🚀 Inicializando estructura de directorios...\n');

// Crear directorios
requiredDirectories.forEach(dir => {
  const fullPath = path.join(projectRoot, dir);
  
  try {
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`✅ Directorio creado: ${dir}/`);
      
      // Crear archivo .gitkeep para mantener el directorio en git
      const gitkeepPath = path.join(fullPath, '.gitkeep');
      fs.writeFileSync(gitkeepPath, '# Mantener directorio en Git\n');
      
    } else {
      console.log(`📁 Directorio ya existe: ${dir}/`);
    }
  } catch (error) {
    console.error(`❌ Error creando directorio ${dir}:`, error.message);
  }
});

console.log('\n🔧 Verificando archivos de configuración...\n');

// Crear archivos de configuración si no existen
requiredFiles.forEach(file => {
  const fullPath = path.join(projectRoot, file.path);
  const templatePath = path.join(projectRoot, file.template);
  
  try {
    if (!fs.existsSync(fullPath)) {
      if (fs.existsSync(templatePath)) {
        // Copiar desde template
        const templateContent = fs.readFileSync(templatePath, 'utf8');
        fs.writeFileSync(fullPath, templateContent);
        console.log(`✅ Archivo creado desde template: ${file.path}`);
        
        if (file.path === '.env') {
          console.log('⚠️  Recuerda configurar las variables en .env antes de iniciar el servidor');
        }
      } else {
        console.log(`⚠️  Template no encontrado para ${file.path}: ${file.template}`);
      }
    } else {
      console.log(`📄 Archivo ya existe: ${file.path}`);
    }
  } catch (error) {
    if (file.required) {
      console.error(`❌ Error creando archivo ${file.path}:`, error.message);
    } else {
      console.warn(`⚠️  No se pudo crear archivo opcional ${file.path}:`, error.message);
    }
  }
});

console.log('\n🔍 Verificando permisos de escritura...\n');

// Verificar permisos de escritura en directorios críticos
const criticalDirs = ['logs', 'data', 'tmp'];

criticalDirs.forEach(dir => {
  const fullPath = path.join(projectRoot, dir);
  
  try {
    // Intentar escribir un archivo de prueba
    const testFile = path.join(fullPath, 'test-write.tmp');
    fs.writeFileSync(testFile, 'test write permissions');
    fs.unlinkSync(testFile);
    console.log(`✅ Permisos de escritura OK: ${dir}/`);
  } catch (error) {
    console.error(`❌ Sin permisos de escritura en ${dir}/:`, error.message);
    console.log(`🔧 Solución: chmod 755 ${dir}/`);
  }
});

console.log('\n📋 Resumen de inicialización:\n');

// Resumen final
const summary = {
  directories: requiredDirectories.map(dir => {
    const exists = fs.existsSync(path.join(projectRoot, dir));
    return `${exists ? '✅' : '❌'} ${dir}/`;
  }),
  files: requiredFiles.map(file => {
    const exists = fs.existsSync(path.join(projectRoot, file.path));
    return `${exists ? '✅' : '❌'} ${file.path}`;
  })
};

summary.directories.forEach(item => console.log(item));
summary.files.forEach(item => console.log(item));

console.log('\n🎯 Próximos pasos:');
console.log('1. Configurar variables en .env');
console.log('2. npm install (si no lo has hecho)');
console.log('3. npm run dev\n');

console.log('✨ Inicialización completada!\n');

// Verificar si .env está configurado
const envPath = path.join(projectRoot, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const hasGeminiKey = envContent.includes('GEMINI_API_KEY=') && !envContent.includes('GEMINI_API_KEY=your_');
  
  if (!hasGeminiKey) {
    console.log('⚠️  IMPORTANTE: Configura GEMINI_API_KEY en .env antes de iniciar');
  } else {
    console.log('✅ GEMINI_API_KEY configurado en .env');
  }
}