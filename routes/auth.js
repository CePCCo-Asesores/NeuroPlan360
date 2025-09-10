const express = require('express');
const router = express.Router();
const { 
  verifyGoogleToken, 
  generateToken, 
  verifyToken, 
  authRateLimit, 
  authLogging,
  refreshToken 
} = require('../middleware/auth');
const UserService = require('../services/UserService');
const logger = require('../config/logger');
const config = require('../config');

// Aplicar middleware a todas las rutas de auth
router.use(authLogging);

// Ruta para login/registro con Google
router.post('/google', 
  authRateLimit,
  verifyGoogleToken,
  async (req, res) => {
    try {
      const { googleUser } = req;
      const { userType, customRole } = req.body; // Datos adicionales del frontend
      
      logger.info('Google auth attempt', {
        email: googleUser.email,
        name: googleUser.name,
        userType: userType,
        ip: req.ip
      });

      // Buscar o crear usuario
      let user = await UserService.findByGoogleId(googleUser.googleId);
      
      if (!user) {
        // Usuario nuevo - registrar
        user = await UserService.createUser({
          googleId: googleUser.googleId,
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture,
          userType: userType || 'parent', // Default a parent si no se especifica
          customRole: customRole || null,
          emailVerified: googleUser.emailVerified,
          locale: googleUser.locale || 'es',
          familyName: googleUser.familyName,
          givenName: googleUser.givenName,
          role: 'user', // Role del sistema (user, admin, premium)
          isActive: true,
          loginCount: 1,
          lastLoginAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        });

        logger.info('New user registered via Google', {
          userId: user.id,
          email: user.email,
          userType: user.userType,
          ip: req.ip
        });

        // Emitir evento de nuevo usuario
        if (global.emitStatusUpdate) {
          global.emitStatusUpdate('admin', 'new_user', 'Nuevo usuario registrado', {
            userId: user.id,
            email: user.email,
            userType: user.userType
          });
        }
      } else {
        // Usuario existente - actualizar último login
        user = await UserService.updateLastLogin(user.id, {
          lastLoginAt: new Date(),
          loginCount: user.loginCount + 1,
          picture: googleUser.picture, // Actualizar foto de perfil
          name: googleUser.name // Actualizar nombre si cambió
        });

        logger.info('Existing user logged in', {
          userId: user.id,
          email: user.email,
          loginCount: user.loginCount,
          ip: req.ip
        });
      }

      // Verificar si el usuario está activo
      if (!user.isActive) {
        logger.warn('Inactive user attempted login', {
          userId: user.id,
          email: user.email,
          ip: req.ip
        });

        return res.status(403).json({
          success: false,
          error: 'Cuenta desactivada. Contacta al administrador.',
          code: 'USER_ACCOUNT_INACTIVE',
          timestamp: new Date().toISOString()
        });
      }

      // Generar JWT token
      const token = generateToken(user, '7d');

      // Respuesta exitosa
      res.json({
        success: true,
        message: user.loginCount === 1 ? 'Usuario registrado exitosamente' : 'Login exitoso',
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            picture: user.picture,
            userType: user.userType,
            customRole: user.customRole,
            role: user.role,
            isNewUser: user.loginCount === 1,
            lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt
          },
          token: token,
          tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Google auth error', {
        error: error.message,
        stack: error.stack,
        email: req.googleUser?.email,
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Error interno durante autenticación',
        code: 'AUTH_INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Ruta para logout
router.post('/logout',
  verifyToken,
  async (req, res) => {
    try {
      const { user } = req;

      logger.info('User logged out', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });

      // Aquí podrías agregar el token a una blacklist si quisieras
      // Para simplificar, confiamos en que el frontend elimine el token

      res.json({
        success: true,
        message: 'Logout exitoso',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Logout error', {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Error durante logout',
        code: 'LOGOUT_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Ruta para obtener perfil del usuario actual
router.get('/profile',
  verifyToken,
  refreshToken,
  async (req, res) => {
    try {
      const { user } = req;
      
      // Obtener información completa del usuario
      const fullUser = await UserService.findById(user.id);
      
      if (!fullUser) {
        return res.status(404).json({
          success: false,
          error: 'Usuario no encontrado',
          code: 'USER_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }

      // Obtener estadísticas del usuario
      const userStats = await UserService.getUserStats(user.id);

      res.json({
        success: true,
        data: {
          user: {
            id: fullUser.id,
            email: fullUser.email,
            name: fullUser.name,
            picture: fullUser.picture,
            userType: fullUser.userType,
            customRole: fullUser.customRole,
            role: fullUser.role,
            isActive: fullUser.isActive,
            emailVerified: fullUser.emailVerified,
            locale: fullUser.locale,
            createdAt: fullUser.createdAt,
            lastLoginAt: fullUser.lastLoginAt,
            loginCount: fullUser.loginCount
          },
          stats: userStats,
          preferences: fullUser.preferences || {}
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Get profile error', {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Error obteniendo perfil',
        code: 'PROFILE_GET_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Ruta para actualizar perfil
router.put('/profile',
  verifyToken,
  async (req, res) => {
    try {
      const { user } = req;
      const { userType, customRole, preferences } = req.body;

      // Validar datos de entrada
      const allowedUserTypes = ['teacher', 'therapist', 'parent', 'doctor', 'mixed', 'other'];
      if (userType && !allowedUserTypes.includes(userType)) {
        return res.status(400).json({
          success: false,
          error: 'Tipo de usuario inválido',
          code: 'INVALID_USER_TYPE',
          allowedTypes: allowedUserTypes,
          timestamp: new Date().toISOString()
        });
      }

      // Actualizar usuario
      const updatedUser = await UserService.updateUser(user.id, {
        userType: userType || undefined,
        customRole: customRole || undefined,
        preferences: preferences || undefined,
        updatedAt: new Date()
      });

      logger.info('User profile updated', {
        userId: user.id,
        email: user.email,
        changes: { userType, customRole, hasPreferences: !!preferences },
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Perfil actualizado exitosamente',
        data: {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            picture: updatedUser.picture,
            userType: updatedUser.userType,
            customRole: updatedUser.customRole,
            role: updatedUser.role,
            preferences: updatedUser.preferences,
            updatedAt: updatedUser.updatedAt
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Update profile error', {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Error actualizando perfil',
        code: 'PROFILE_UPDATE_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Ruta para refrescar token
router.post('/refresh',
  verifyToken,
  async (req, res) => {
    try {
      const { user } = req;
      
      // Verificar que el usuario sigue siendo válido
      const currentUser = await UserService.findById(user.id);
      
      if (!currentUser || !currentUser.isActive) {
        return res.status(401).json({
          success: false,
          error: 'Usuario no válido para renovar token',
          code: 'USER_INVALID_FOR_REFRESH',
          timestamp: new Date().toISOString()
        });
      }

      // Generar nuevo token
      const newToken = generateToken(currentUser, '7d');

      logger.info('Token refreshed', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Token renovado exitosamente',
        data: {
          token: newToken,
          tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          user: {
            id: currentUser.id,
            email: currentUser.email,
            name: currentUser.name,
            picture: currentUser.picture,
            role: currentUser.role
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Token refresh error', {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Error renovando token',
        code: 'TOKEN_REFRESH_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Ruta para eliminar cuenta
router.delete('/account',
  verifyToken,
  async (req, res) => {
    try {
      const { user } = req;
      const { confirmPassword } = req.body;

      // Por seguridad, requerir confirmación
      if (confirmPassword !== 'ELIMINAR_MI_CUENTA') {
        return res.status(400).json({
          success: false,
          error: 'Confirmación requerida: envía confirmPassword: "ELIMINAR_MI_CUENTA"',
          code: 'DELETE_CONFIRMATION_REQUIRED',
          timestamp: new Date().toISOString()
        });
      }

      // Marcar usuario como inactivo en lugar de eliminar
      await UserService.deactivateUser(user.id);

      logger.warn('User account deactivated', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: 'Cuenta desactivada exitosamente',
        data: {
          note: 'Tu cuenta ha sido desactivada. Contacta al soporte si necesitas reactivarla.'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Account deletion error', {
        error: error.message,
        userId: req.user?.id,
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Error eliminando cuenta',
        code: 'ACCOUNT_DELETE_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Ruta para obtener configuración de Google OAuth (para el frontend)
router.get('/google/config', (req, res) => {
  res.json({
    success: true,
    data: {
      clientId: config.auth.google.clientId,
      scopes: ['profile', 'email'],
      redirectUri: config.auth.google.redirectUri || config.frontend.url
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;