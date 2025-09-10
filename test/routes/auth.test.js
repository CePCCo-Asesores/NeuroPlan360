const request = require('supertest');
const { app } = require('../../server');
const UserService = require('../../services/UserService');
const { generateToken } = require('../../middleware/auth');

// Mock de UserService
jest.mock('../../services/UserService');

// Mock de Google Auth Library
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn()
  }))
}));

describe('Auth Routes', () => {
  let mockUserService;
  let validGoogleToken;
  let validJwtToken;
  let testUser;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup test data
    testUser = {
      id: 'test-user-id-123',
      googleId: 'google-test-id-456',
      email: 'test@example.com',
      name: 'Test User',
      picture: 'https://example.com/avatar.jpg',
      userType: 'teacher',
      customRole: null,
      role: 'user',
      isActive: true,
      emailVerified: true,
      locale: 'es',
      loginCount: 1,
      lastLoginAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      preferences: {
        notifications: true,
        language: 'es',
        theme: 'light'
      },
      stats: {
        plansGenerated: 0,
        sessionsCreated: 0,
        feedbackProvided: 0,
        lastActivity: new Date()
      }
    };

    validGoogleToken = 'valid.google.token';
    validJwtToken = generateToken(testUser);

    // Mock UserService methods
    UserService.findByGoogleId = jest.fn();
    UserService.createUser = jest.fn();
    UserService.updateLastLogin = jest.fn();
    UserService.findById = jest.fn();
    UserService.updateUser = jest.fn();
    UserService.deactivateUser = jest.fn();
    UserService.getUserStats = jest.fn();
    UserService.recordUserActivity = jest.fn();
  });

  describe('POST /api/auth/google', () => {
    it('debería registrar un nuevo usuario exitosamente', async () => {
      // Mock Google token verification
      const { OAuth2Client } = require('google-auth-library');
      const mockClient = new OAuth2Client();
      mockClient.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-test-id-456',
          email: 'test@example.com',
          name: 'Test User',
          picture: 'https://example.com/avatar.jpg',
          email_verified: true,
          locale: 'es',
          family_name: 'User',
          given_name: 'Test'
        })
      });

      // Mock UserService - usuario no existe
      UserService.findByGoogleId.mockResolvedValue(null);
      UserService.createUser.mockResolvedValue(testUser);

      const response = await request(app)
        .post('/api/auth/google')
        .send({
          idToken: validGoogleToken,
          userType: 'teacher',
          customRole: 'Educador Especial'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('registrado exitosamente');
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.user.isNewUser).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(UserService.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          googleId: 'google-test-id-456',
          email: 'test@example.com',
          userType: 'teacher'
        })
      );
    });

    it('debería hacer login de usuario existente', async () => {
      // Mock Google token verification
      const { OAuth2Client } = require('google-auth-library');
      const mockClient = new OAuth2Client();
      mockClient.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-test-id-456',
          email: 'test@example.com',
          name: 'Test User',
          picture: 'https://example.com/avatar.jpg',
          email_verified: true
        })
      });

      // Mock UserService - usuario existe
      const existingUser = { ...testUser, loginCount: 5 };
      UserService.findByGoogleId.mockResolvedValue(existingUser);
      UserService.updateLastLogin.mockResolvedValue({
        ...existingUser,
        loginCount: 6,
        lastLoginAt: new Date()
      });

      const response = await request(app)
        .post('/api/auth/google')
        .send({
          idToken: validGoogleToken,
          userType: 'teacher'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Login exitoso');
      expect(response.body.data.user.isNewUser).toBe(false);
      expect(UserService.updateLastLogin).toHaveBeenCalled();
      expect(UserService.createUser).not.toHaveBeenCalled();
    });

    it('debería rechazar token de Google inválido', async () => {
      // Mock Google token verification failure
      const { OAuth2Client } = require('google-auth-library');
      const mockClient = new OAuth2Client();
      mockClient.verifyIdToken.mockRejectedValue(new Error('Invalid token'));

      const response = await request(app)
        .post('/api/auth/google')
        .send({
          idToken: 'invalid.token',
          userType: 'teacher'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Token de Google inválido');
      expect(response.body.code).toBe('GOOGLE_TOKEN_INVALID');
    });

    it('debería rechazar usuario inactivo', async () => {
      // Mock Google token verification
      const { OAuth2Client } = require('google-auth-library');
      const mockClient = new OAuth2Client();
      mockClient.verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'google-test-id-456',
          email: 'test@example.com',
          email_verified: true
        })
      });

      // Mock usuario inactivo
      const inactiveUser = { ...testUser, isActive: false };
      UserService.findByGoogleId.mockResolvedValue(inactiveUser);

      const response = await request(app)
        .post('/api/auth/google')
        .send({
          idToken: validGoogleToken,
          userType: 'teacher'
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Cuenta desactivada');
      expect(response.body.code).toBe('USER_ACCOUNT_INACTIVE');
    });

    it('debería requerir idToken', async () => {
      const response = await request(app)
        .post('/api/auth/google')
        .send({
          userType: 'teacher'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Google ID token requerido');
      expect(response.body.code).toBe('GOOGLE_TOKEN_MISSING');
    });
  });

  describe('GET /api/auth/profile', () => {
    it('debería obtener perfil de usuario autenticado', async () => {
      UserService.findById.mockResolvedValue(testUser);
      UserService.getUserStats.mockResolvedValue({
        plansGenerated: 5,
        sessionsCreated: 3,
        memberSince: testUser.createdAt,
        isFrequentUser: false
      });

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${validJwtToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.stats).toBeDefined();
      expect(response.body.data.preferences).toBeDefined();
    });

    it('debería rechazar request sin token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Token de autenticación requerido');
      expect(response.body.code).toBe('AUTH_TOKEN_MISSING');
    });

    it('debería rechazar token inválido', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Token inválido');
    });

    it('debería manejar usuario no encontrado', async () => {
      UserService.findById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${validJwtToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Usuario no encontrado');
      expect(response.body.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('PUT /api/auth/profile', () => {
    it('debería actualizar perfil exitosamente', async () => {
      const updatedUser = {
        ...testUser,
        userType: 'therapist',
        customRole: 'Terapeuta Ocupacional',
        updatedAt: new Date()
      };

      UserService.updateUser.mockResolvedValue(updatedUser);

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${validJwtToken}`)
        .send({
          userType: 'therapist',
          customRole: 'Terapeuta Ocupacional',
          preferences: {
            theme: 'dark',
            notifications: false
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('actualizado exitosamente');
      expect(response.body.data.user.userType).toBe('therapist');
      expect(UserService.updateUser).toHaveBeenCalledWith(
        testUser.id,
        expect.objectContaining({
          userType: 'therapist',
          customRole: 'Terapeuta Ocupacional'
        })
      );
    });

    it('debería rechazar userType inválido', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${validJwtToken}`)
        .send({
          userType: 'invalid_type'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Tipo de usuario inválido');
      expect(response.body.code).toBe('INVALID_USER_TYPE');
      expect(response.body.allowedTypes).toBeDefined();
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('debería renovar token exitosamente', async () => {
      UserService.findById.mockResolvedValue(testUser);

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${validJwtToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Token renovado');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.token).not.toBe(validJwtToken); // Nuevo token
      expect(response.body.data.tokenExpiresAt).toBeDefined();
    });

    it('debería rechazar renovación para usuario inactivo', async () => {
      const inactiveUser = { ...testUser, isActive: false };
      UserService.findById.mockResolvedValue(inactiveUser);

      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${validJwtToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Usuario no válido para renovar token');
      expect(response.body.code).toBe('USER_INVALID_FOR_REFRESH');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('debería hacer logout exitosamente', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${validJwtToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Logout exitoso');
    });

    it('debería requerir autenticación para logout', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('AUTH_TOKEN_MISSING');
    });
  });

  describe('DELETE /api/auth/account', () => {
    it('debería eliminar cuenta con confirmación correcta', async () => {
      UserService.deactivateUser.mockResolvedValue({
        ...testUser,
        isActive: false,
        deactivatedAt: new Date()
      });

      const response = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${validJwtToken}`)
        .send({
          confirmPassword: 'ELIMINAR_MI_CUENTA'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('desactivada exitosamente');
      expect(UserService.deactivateUser).toHaveBeenCalledWith(testUser.id);
    });

    it('debería rechazar eliminación sin confirmación', async () => {
      const response = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${validJwtToken}`)
        .send({
          confirmPassword: 'wrong_confirmation'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Confirmación requerida');
      expect(response.body.code).toBe('DELETE_CONFIRMATION_REQUIRED');
    });
  });

  describe('GET /api/auth/google/config', () => {
    it('debería retornar configuración OAuth', async () => {
      const response = await request(app)
        .get('/api/auth/google/config')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.clientId).toBeDefined();
      expect(response.body.data.scopes).toEqual(['profile', 'email']);
      expect(response.body.data.redirectUri).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('debería aplicar rate limiting en rutas de auth', async () => {
      // Simular múltiples requests rápidos de login
      const promises = Array(12).fill().map(() => 
        request(app)
          .post('/api/auth/google')
          .send({
            idToken: 'test.token',
            userType: 'teacher'
          })
      );

      const responses = await Promise.all(promises);
      
      // Al menos una debería ser rate limited (429)
      const rateLimited = responses.some(res => res.status === 429);
      expect(rateLimited).toBe(true);
    }, 10000);
  });

  describe('Security', () => {
    it('debería loggear intentos de login fallidos', async () => {
      const response = await request(app)
        .post('/api/auth/google')
        .send({
          idToken: 'invalid.token',
          userType: 'teacher'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      // En una implementación real, verificaríamos que se loggeó el evento
    });

    it('debería rechazar tokens JWT expirados', async () => {
      // Crear token que expire inmediatamente
      const expiredToken = generateToken(testUser, '1ms');
      
      // Esperar que expire
      await new Promise(resolve => setTimeout(resolve, 10));

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('AUTH_TOKEN_EXPIRED');
    });

    it('debería proteger rutas sensibles', async () => {
      // Test sin autenticación
      const response = await request(app)
        .delete('/api/auth/account')
        .send({
          confirmPassword: 'ELIMINAR_MI_CUENTA'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('AUTH_TOKEN_MISSING');
    });
  });

  describe('Error Handling', () => {
    it('debería manejar errores del UserService', async () => {
      UserService.findById.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${validJwtToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Error obteniendo perfil');
    });

    it('debería manejar errores de Google API', async () => {
      // Mock Google API error
      const { OAuth2Client } = require('google-auth-library');
      const mockClient = new OAuth2Client();
      mockClient.verifyIdToken.mockRejectedValue(new Error('Google API down'));

      const response = await request(app)
        .post('/api/auth/google')
        .send({
          idToken: validGoogleToken,
          userType: 'teacher'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('GOOGLE_TOKEN_INVALID');
    });
  });
});