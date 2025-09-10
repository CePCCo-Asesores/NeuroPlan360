# 🧠 Asistente de Planeación Inclusiva y Neurodivergente - Backend

Backend completo para el Asistente de Planeación Inclusiva y Neurodivergente, potenciado por Gemini 2.0 Flash para generar planes educativos y terapéuticos que celebran la neurodiversidad.

## 🌈 Características Principales

### 🎯 **Especialización Neurodivergente**
- **10 tipos de neurodiversidad** soportados: TDAH, Autismo, Dislexia, Discalculia, Disgrafía, Altas Capacidades, Tourette, Dispraxia, Procesamiento Sensorial, Ansiedad
- **Enfoque afirmativo**: Celebra la neurodiversidad como fortaleza natural
- **Adaptaciones específicas** por tipo neurológico
- **Generalización automática** para múltiples entornos

### 🚀 **Tecnología Avanzada**
- **Integración Gemini 2.0 Flash** con reintentos automáticos
- **WebSockets** para actualizaciones en tiempo real
- **Sistema de memoria conversacional** con limpieza automática
- **Rate limiting inteligente** por tipo de operación
- **Logging completo** con múltiples niveles

### 🔧 **Funcionalidades Completas**
- **6 formatos de salida**: Práctico, Completo, ND Plus, Sensorial, Semáforo ND
- **5 tipos de usuario**: Docentes, Terapeutas, Padres, Médicos, Mixtos
- **Sistema de feedback** para mejora continua
- **Exportación** en múltiples formatos
- **Panel de administración** completo

## 📁 Estructura del Proyecto

```
nd-assistant-backend/
├── config/                 # Configuración y logger
│   ├── index.js
│   └── logger.js
├── middleware/             # Middleware personalizado
│   ├── security.js
│   └── validation.js
├── routes/                 # Rutas de la API
│   ├── index.js
│   ├── nd.js              # Rutas principales ND
│   ├── admin.js           # Rutas de administración
│   └── health.js          # Health checks
├── services/               # Lógica de negocio
│   └── NDAssistantProcessor.js
├── logs/                   # Archivos de log
├── .env.example           # Variables de entorno
├── Dockerfile             # Imagen Docker
├── docker-compose.yml     # Orquestación
├── package.json
└── server.js             # Punto de entrada
```

## 🚀 Instalación y Configuración

### Prerrequisitos
- **Node.js 18+**
- **Clave API de Gemini 2.0 Flash**
- **Docker** (opcional)

### 1. Clonar e Instalar
```bash
git clone https://github.com/your-org/nd-assistant-backend.git
cd nd-assistant-backend
npm install
```

### 2. Configurar Variables de Entorno
```bash
cp .env.example .env
```

Editar `.env`:
```bash
# OBLIGATORIO
GEMINI_API_KEY=tu_clave_de_gemini_aqui

# Configuración del servidor
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Configuración opcional
LOG_LEVEL=info
ENABLE_WEBSOCKETS=true
ENABLE_ADMIN_ROUTES=true
ADMIN_PASSWORD=tu_password_admin
```

### 3. Iniciar el Servidor

**Modo Desarrollo:**
```bash
npm run dev
```

**Modo Producción:**
```bash
npm start
```

**Con Docker:**
```bash
docker-compose up -d
```

## 📡 API Endpoints

### 🎯 **Endpoints Principales**

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/generate-nd-plan` | Generar plan neurodivergente |
| `POST` | `/api/regenerate-plan` | Regenerar con nuevos parámetros |
| `GET` | `/api/session/:sessionId` | Obtener información de sesión |
| `POST` | `/api/feedback` | Enviar feedback del plan |
| `POST` | `/api/export-plan` | Exportar plan generado |
| `GET` | `/api/neurodiversities` | Lista de neurodiversidades |

### 🔧 **Endpoints de Administración**

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/admin/stats` | Estadísticas del sistema |
| `GET` | `/api/admin/sessions` | Gestión de sesiones |
| `DELETE` | `/api/admin/sessions/:id` | Eliminar sesión |
| `POST` | `/api/admin/cleanup` | Limpiar sesiones antiguas |
| `GET` | `/api/admin/config` | Configuración del sistema |

### 🏥 **Health Checks**

| Endpoint | Descripción |
|----------|-------------|
| `/api/health` | Health check básico |
| `/api/health/detailed` | Health check con test de Gemini |
| `/api/ready` | Readiness probe (Kubernetes) |
| `/api/live` | Liveness probe (Kubernetes) |
| `/api/metrics` | Métricas para monitoreo |

## 📝 Ejemplo de Uso

### Generar Plan ND

```javascript
const response = await fetch('/api/generate-nd-plan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userType: 'teacher',
    neurodiversities: ['tdah', 'autism'],
    priorityND: 'tdah',
    menuOption: 'create',
    theme: 'matemáticas básicas',
    objectives: 'Enseñar sumas simples',
    ageGroup: '6-8 años',
    sensitivities: 'sensible a sonidos fuertes',
    environments: ['Casa', 'Escuela'],
    caregivers: true,
    outputFormat: 'complete'
  })
});

const result = await response.json();
```

### Respuesta Ejemplo

```json
{
  "success": true,
  "sessionId": "nd_session_1234567890_abc123def",
  "data": {
    "title": "Plan Neurodivergente: TDAH, Autismo",
    "sections": [
      {
        "id": "comprension",
        "title": "Comprensión ND",
        "icon": "🧠",
        "content": "Esta adaptación honra las fortalezas únicas...",
        "order": 1
      },
      // ... más secciones
    ],
    "implementationReady": true,
    "ethicallyApproved": true
  }
}
```

## 🔌 WebSockets

El servidor incluye WebSockets para actualizaciones en tiempo real:

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3001');

// Unirse a una sesión específica
socket.emit('join-session', sessionId);

// Escuchar actualizaciones de estado
socket.on('status-update', (data) => {
  console.log('Estado:', data.status, data.message);
});
```

## 🛡️ Seguridad

### Características Implementadas
- **Rate Limiting** por IP y endpoint
- **Helmet.js** para headers de seguridad
- **CORS** configurado específicamente
- **Validación** exhaustiva de entrada
- **Content Security Policy**
- **Logging de seguridad** completo

### Rate Limits
- **General**: 100 requests/15min
- **Generación de planes**: 10 plans/15min
- **Admin**: 20 requests/15min

## 📊 Monitoreo y Logs

### **Ver Logs en Tiempo Real**
```bash
# Ver todos los logs
npm run logs:tail

# Ver solo errores
npm run logs:error

# Ver requests HTTP
npm run logs:requests

# Ver operaciones ND específicas
npm run logs:nd
```

### Niveles de Log
- **error**: Errores críticos
- **warn**: Advertencias importantes
- **info**: Información general
- **debug**: Información detallada (desarrollo)

### Archivos de Log
- `logs/app.log` - Log general
- `logs/error.log` - Solo errores
- `logs/requests.log` - Requests HTTP
- `logs/nd-operations.log` - Operaciones ND específicas

### Métricas Disponibles
- Tiempo de respuesta promedio
- Tasa de éxito/error
- Uso de memoria
- Estadísticas de Gemini
- Distribución de neurodiversidades

## 🐳 Docker

### Desarrollo Rápido
```bash
docker-compose up -d nd-assistant-backend
```

### Stack Completo con Monitoring
```bash
docker-compose up -d
```

Incluye:
- **Backend ND** (puerto 3001)
- **Redis** para cache (puerto 6379)
- **Nginx** como proxy (puerto 80/443)
- **Prometheus** para métricas (puerto 9090)
- **Grafana** para dashboards (puerto 3000)

## 🧪 Testing

```bash
# Tests unitarios
npm test

# Tests con watch
npm run test:watch

# Coverage
npm run test:coverage
```

## 📈 Escalabilidad

### Configuración Recomendada

**Desarrollo:**
- 1 instancia
- Sin Redis
- Logs en archivo

**Producción:**
- 2+ instancias detrás de load balancer
- Redis para sesiones compartidas
- Logs centralizados
- Monitoreo con Prometheus/Grafana

### Variables de Performance

```bash
# Memoria
MAX_SESSIONS=1000
MEMORY_CLEANUP_INTERVAL=3600000

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000

# Gemini
GEMINI_TIMEOUT_MS=30000
GEMINI_MAX_RETRIES=3
```

## 🐛 Troubleshooting

### Problemas Comunes

**Error: Gemini API Key no configurada**
```bash
# Verificar variable de entorno
echo $GEMINI_API_KEY

# Configurar si falta
export GEMINI_API_KEY="tu_clave_aqui"
```

**Error: Puerto ocupado**
```bash
# Cambiar puerto en .env
PORT=3002

# O matar proceso existente
lsof -ti:3001 | xargs kill -9
```

**Memoria alta**
```bash
# Verificar sesiones activas
curl http://localhost:3001/api/admin/stats

# Limpiar sesiones antiguas
curl -X POST http://localhost:3001/api/admin/cleanup
```

### Logs de Debug

```bash
# Habilitar logs detallados
LOG_LEVEL=debug npm run dev

# Ver logs en tiempo real
tail -f logs/app.log
```

## 🤝 Contribución

### Guías de Desarrollo

1. **Fork** el repositorio
2. **Crear branch** para feature: `git checkout -b feature/nueva-funcionalidad`
3. **Commit** cambios: `git commit -m 'Agregar nueva funcionalidad'`
4. **Push** al branch: `git push origin feature/nueva-funcionalidad`
5. **Abrir Pull Request**

### Standards de Código
- **ESLint** para linting
- **Prettier** para formateo
- **Conventional Commits** para mensajes
- **JSDoc** para documentación

## 📄 Licencia

MIT License - ver [LICENSE](LICENSE) para detalles.

## 👥 Equipo

**ND Assistant Team** - Especialistas en neurodiversidad y tecnología inclusiva

- 🧠 **Enfoque Neurodivergente-Afirmativo**
- 🌈 **Celebrando la diversidad neurológica**
- 🚀 **Tecnología al servicio de la inclusión**

## 🆘 Soporte

- **Documentación**: [docs.nd-assistant.com](https://docs.nd-assistant.com)
- **Issues**: [GitHub Issues](https://github.com/your-org/nd-assistant-backend/issues)
- **Email**: support@nd-assistant.com
- **Discord**: [Comunidad ND Assistant](https://discord.gg/nd-assistant)

---

**🌟 ¡Celebrando la neurodiversidad como una fortaleza natural! 🌟**