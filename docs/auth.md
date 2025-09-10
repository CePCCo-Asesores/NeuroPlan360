# 🔐 Sistema de Autenticación - ND Assistant

## 📋 Resumen

El ND Assistant implementa un sistema de autenticación completo usando **Google OAuth 2.0** + **JWT tokens** que permite:

- ✅ **Login/Registro con Google** (Un solo clic)
- ✅ **Gestión de perfiles** de usuario neurodivergente-específicos
- ✅ **Autenticación opcional** (funciona sin login también)
- ✅ **Estadísticas de usuario** y seguimiento de actividad
- ✅ **Roles y permisos** (user, admin)
- ✅ **Tokens JWT** seguros con renovación automática

## 🚀 Configuración Rápida

### 1. Google Cloud Console Setup

```bash
# 1. Ir a Google Cloud Console
https://console.cloud.google.com/

# 2. Crear nuevo proyecto o usar existente
# 3. Habilitar Google+ API
# 4. Crear credenciales OAuth 2.0
# 5. Configurar URLs autorizadas:
```

**URLs Autorizadas:**
```bash
# Para desarrollo:
http://localhost:3000
http://localhost:3001

# Para producción:
https://tu-dominio.com
https://api.tu-dominio.com
```

### 2. Variables de Entorno

```bash
# En tu .env:
GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-tu_secret_aqui
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback
JWT_SECRET=tu_jwt_secret_muy_seguro_32_chars_minimum
JWT_EXPIRES_IN=7d
```

## 🔄 Flujo de Autenticación

### Diagrama del Flujo:
```
Frontend → Google OAuth → Backend → JWT Token → Frontend
    ↓           ↓           ↓           ↓           ↓
 Login UI → Google Login → Verify Token → Generate JWT → Store Token
```

### Paso a Paso:

1. **Frontend**: Usuario hace clic en "Login con Google"
2. **Google**: Abre popup de autenticación de Google
3. **Google**: Retorna `idToken` al frontend
4. **Frontend**: Envía `idToken` a `POST /api/auth/google`
5. **Backend**: Verifica token con Google
6. **Backend**: Crea o actualiza usuario en sistema
7. **Backend**: Genera JWT token propio
8. **Frontend**: Recibe JWT token y datos de usuario
9. **Frontend**: Almacena token y actualiza UI

## 📡 Endpoints de Autenticación

### POST /api/auth/google
Login/registro con Google OAuth.

**Request:**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsI...",
  "userType": "teacher",
  "customRole": "Educador Especial"
}
```

**Response (Usuario Nuevo):**
```json
{
  "success": true,
  "message": "Usuario registrado exitosamente",
  "data": {
    "user": {
      "id": "uuid-user-id",
      "email": "usuario@gmail.com",
      "name": "Juan Pérez",
      "picture": "https://lh3.googleusercontent.com/...",
      "userType": "teacher",
      "customRole": "Educador Especial",
      "role": "user",
      "isNewUser": true,
      "lastLoginAt": "2024-01-01T12:00:00Z",
      "createdAt": "2024-01-01T12:00:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenExpiresAt": "2024-01-08T12:00:00Z"
  }
}
```

### GET /api/auth/profile
Obtener perfil del usuario autenticado.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-user-id",
      "email": "usuario@gmail.com",
      "name": "Juan Pérez",
      "userType": "teacher",
      "role": "user",
      "loginCount": 5,
      "lastLoginAt": "2024-01-01T12:00:00Z"
    },
    "stats": {
      "plansGenerated": 12,
      "sessionsCreated": 8,
      "feedbackProvided": 3,
      "memberSince": "2024-01-01T12:00:00Z",
      "preferredOutputFormat": "complete"
    },
    "preferences": {
      "notifications": true,
      "language": "es",
      "theme": "light"
    }
  }
}
```

### PUT /api/auth/profile
Actualizar perfil del usuario.

**Request:**
```json
{
  "userType": "therapist",
  "customRole": "Terapeuta Ocupacional",
  "preferences": {
    "notifications": false,
    "theme": "dark"
  }
}
```

### POST /api/auth/refresh
Renovar JWT token.

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "nuevo_jwt_token_aqui",
    "tokenExpiresAt": "2024-01-08T12:00:00Z"
  }
}
```

### POST /api/auth/logout
Cerrar sesión.

### DELETE /api/auth/account
Eliminar cuenta (desactivar).

**Request:**
```json
{
  "confirmPassword": "ELIMINAR_MI_CUENTA"
}
```

## 🔧 Middleware de Autenticación

### verifyToken
Middleware que **requiere** autenticación.

```javascript
const { verifyToken } = require('../middleware/auth');

router.get('/ruta-protegida', verifyToken, (req, res) => {
  // req.user contiene información del usuario
  const userId = req.user.id;
  const userEmail = req.user.email;
});
```

### optionalAuth
Middleware que permite autenticación **opcional**.

```javascript
const { optionalAuth } = require('../middleware/auth');

router.post('/generate-nd-plan', optionalAuth, (req, res) => {
  if (req.user) {
    // Usuario autenticado - registrar estadísticas
    console.log('Plan generado por:', req.user.email);
  } else {
    // Usuario anónimo - funciona igual
    console.log('Plan generado por usuario anónimo');
  }
});
```

### requireRole
Middleware que requiere rol específico.

```javascript
const { requireRole } = require('../middleware/auth');

router.get('/admin-only', 
  verifyToken, 
  requireRole('admin'), 
  (req, res) => {
    // Solo usuarios con role: 'admin'
  }
);

router.get('/multiple-roles', 
  verifyToken, 
  requireRole(['admin', 'premium']), 
  (req, res) => {
    // Usuarios con role: 'admin' O 'premium'
  }
);
```

## 👤 Gestión de Usuarios

### Estructura de Usuario
```javascript
{
  id: "uuid-unique-id",
  googleId: "google-user-id",
  email: "usuario@gmail.com",
  name: "Juan Pérez",
  picture: "https://lh3.googleusercontent.com/...",
  
  // ND Assistant específico
  userType: "teacher|therapist|parent|doctor|mixed|other",
  customRole: "Educador Especial",
  role: "user|admin|premium",
  
  // Estado
  isActive: true,
  emailVerified: true,
  locale: "es",
  
  // Timestamps
  createdAt: "2024-01-01T12:00:00Z",
  updatedAt: "2024-01-01T12:00:00Z",
  lastLoginAt: "2024-01-01T12:00:00Z",
  loginCount: 5,
  
  // Preferencias
  preferences: {
    notifications: true,
    language: "es",
    theme: "light",
    neurodiversityFocus: ["tdah", "autism"]
  },
  
  // Estadísticas
  stats: {
    plansGenerated: 12,
    sessionsCreated: 8,
    feedbackProvided: 3,
    favoriteNeurodiversities: ["tdah", "autism"],
    preferredOutputFormat: "complete",
    lastActivity: "2024-01-01T12:00:00Z"
  }
}
```

### UserService API
```javascript
const UserService = require('../services/UserService');

// Buscar usuarios
const user = await UserService.findById(userId);
const user = await UserService.findByEmail(email);
const user = await UserService.findByGoogleId(googleId);

// Crear/actualizar
const newUser = await UserService.createUser(userData);
const updated = await UserService.updateUser(userId, changes);

// Estadísticas
const stats = await UserService.getUserStats(userId);
await UserService.recordUserActivity(userId, 'plan_generated', metadata);

// Admin functions
const allUsers = await UserService.getAllUsers(filters);
const systemStats = await UserService.getSystemUserStats();
```

## 🔒 Seguridad Implementada

### JWT Tokens
- **Algoritmo**: HS256
- **Expiración**: 7 días (configurable)
- **Renovación**: Automática cuando expira en <24h
- **Payload**: Información básica del usuario (no sensible)

### Rate Limiting
```javascript
// Rutas de auth tienen rate limiting específico
// 10 intentos por IP cada 15 minutos
const authRateLimit = {
  windowMs: 15 * 60 * 1000,
  max: 10
};
```

### Validaciones
- ✅ **Google ID Token** verificado con Google API
- ✅ **JWT signature** verificada con secret
- ✅ **Token expiration** verificada
- ✅ **User active status** verificado
- ✅ **Email verification** requerida

### Logging de Seguridad
```javascript
// Todos los eventos de auth se loggean:
- Login attempts (success/failure)
- Token refresh
- Profile updates
- Account deactivation
- Suspicious activity
```

## 🌐 Integración Frontend

### Ejemplo React Setup
```javascript
// 1. Instalar Google OAuth
npm install @google-oauth/react

// 2. Configurar Google Provider
import { GoogleOAuthProvider } from '@google-oauth/react';

function App() {
  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
      <YourApp />
    </GoogleOAuthProvider>
  );
}

// 3. Componente de Login
import { GoogleLogin } from '@google-oauth/react';

function LoginButton() {
  const handleSuccess = async (credentialResponse) => {
    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken: credentialResponse.credential,
          userType: 'teacher' // u otro
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Almacenar token
        localStorage.setItem('ndToken', data.data.token);
        localStorage.setItem('ndUser', JSON.stringify(data.data.user));
        
        // Redirect o actualizar UI
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <GoogleLogin
      onSuccess={handleSuccess}
      onError={() => console.log('Login Failed')}
      useOneTap
    />
  );
}

// 4. Hook para auth state
function useAuth() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('ndToken'));

  useEffect(() => {
    if (token) {
      // Verificar token y obtener usuario
      fetchProfile();
    }
  }, [token]);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/auth/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.data.user);
      } else {
        // Token inválido, logout
        logout();
      }
    } catch (error) {
      logout();
    }
  };

  const logout = () => {
    localStorage.removeItem('ndToken');
    localStorage.removeItem('ndUser');
    setUser(null);
    setToken(null);
  };

  return { user, token, logout, isAuthenticated: !!user };
}
```

### Interceptor para API calls
```javascript
// Axios interceptor para incluir token automáticamente
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('ndToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar token refresh
axios.interceptors.response.use(
  (response) => {
    // Verificar si hay nuevo token en headers
    const newToken = response.headers['x-new-token'];
    if (newToken) {
      localStorage.setItem('ndToken', newToken);
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado, logout
      localStorage.removeItem('ndToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

## 📊 Estadísticas y Analytics

### Tracking Automático
El sistema registra automáticamente:

```javascript
// Eventos registrados:
- 'plan_generated': Cuando se genera un plan ND
- 'session_created': Cuando se crea una sesión
- 'feedback_provided': Cuando se envía feedback

// Metadata incluida:
- neurodiversities: Array de neurodiversidades usadas
- outputFormat: Formato de salida preferido
- userType: Tipo de usuario
- processingTime: Tiempo de procesamiento
```

### Dashboard de Usuario
```javascript
// GET /api/auth/profile incluye stats:
{
  "stats": {
    "plansGenerated": 12,
    "sessionsCreated": 8,
    "feedbackProvided": 3,
    "memberSince": "2024-01-01",
    "averageSessionsPerMonth": 4,
    "isFrequentUser": true,
    "favoriteNeurodiversities": ["tdah", "autism"],
    "preferredOutputFormat": "complete"
  }
}
```

## 🚨 Troubleshooting

### Errores Comunes

**❌ "Google token inválido"**
```bash
# Verificar:
1. GOOGLE_CLIENT_ID correcto en .env
2. Token no expirado
3. Audiencia correcta en token
```

**❌ "JWT token expirado"**
```bash
# Solución:
1. Frontend debe llamar /api/auth/refresh
2. O hacer logout y re-login
```

**❌ "CORS error en Google login"**
```bash
# Verificar en Google Console:
1. URLs autorizadas incluyen tu dominio
2. Protocolo correcto (http/https)
```

### Debugging
```javascript
// Habilitar logs de auth:
LOG_LEVEL=debug

// Verificar JWT token:
const jwt = require('jsonwebtoken');
const decoded = jwt.decode(token);
console.log('Token payload:', decoded);

// Test manual de Google token:
curl -X POST http://localhost:3001/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"tu_token_aqui","userType":"teacher"}'
```

## 🎯 Roadmap Futuro

### Próximas Features:
- 🔐 **Two-Factor Authentication** (2FA)
- 👥 **Team accounts** (múltiples usuarios por institución)
- 🏆 **Premium roles** con features adicionales
- 📧 **Email notifications** para actividad importante
- 🔄 **OAuth providers adicionales** (Microsoft, Apple)
- 💾 **Database migration** (de memoria a PostgreSQL)

---

**¡Sistema de autenticación completo y listo para producción!** 🚀🔐
