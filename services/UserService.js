const logger = require('../config/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * UserService - Servicio para gestión de usuarios
 * 
 * NOTA: Esta implementación usa memoria (Map) para simplicidad.
 * En producción, cambiar por base de datos (PostgreSQL, MongoDB, etc.)
 */
class UserService {
  constructor() {
    // Storage en memoria (reemplazar por DB en producción)
    this.users = new Map();
    this.usersByGoogleId = new Map();
    this.usersByEmail = new Map();
    
    // Inicializar usuario admin de ejemplo
    this.initializeDefaultUsers();
  }

  // Inicializar usuarios por defecto
  initializeDefaultUsers() {
    // Usuario admin de ejemplo
    const adminUser = {
      id: uuidv4(),
      googleId: 'admin-google-id',
      email: 'admin@nd-assistant.com',
      name: 'Administrador ND',
      picture: 'https://via.placeholder.com/150',
      userType: 'other',
      customRole: 'Administrador del Sistema',
      role: 'admin',
      emailVerified: true,
      locale: 'es',
      familyName: 'ND',
      givenName: 'Administrador',
      isActive: true,
      loginCount: 0,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      preferences: {
        notifications: true,
        language: 'es',
        theme: 'light'
      }
    };

    this.users.set(adminUser.id, adminUser);
    this.usersByGoogleId.set(adminUser.googleId, adminUser);
    this.usersByEmail.set(adminUser.email, adminUser);

    logger.info('Default users initialized', {
      adminUserId: adminUser.id,
      adminEmail: adminUser.email
    });
  }

  // Buscar usuario por ID
  async findById(userId) {
    try {
      const user = this.users.get(userId);
      
      if (user) {
        logger.debug('User found by ID', {
          userId: user.id,
          email: user.email
        });
      }
      
      return user || null;
    } catch (error) {
      logger.error('Error finding user by ID', {
        error: error.message,
        userId
      });
      throw error;
    }
  }

  // Buscar usuario por Google ID
  async findByGoogleId(googleId) {
    try {
      const user = this.usersByGoogleId.get(googleId);
      
      if (user) {
        logger.debug('User found by Google ID', {
          userId: user.id,
          email: user.email,
          googleId
        });
      }
      
      return user || null;
    } catch (error) {
      logger.error('Error finding user by Google ID', {
        error: error.message,
        googleId
      });
      throw error;
    }
  }

  // Buscar usuario por email
  async findByEmail(email) {
    try {
      const user = this.usersByEmail.get(email.toLowerCase());
      
      if (user) {
        logger.debug('User found by email', {
          userId: user.id,
          email: user.email
        });
      }
      
      return user || null;
    } catch (error) {
      logger.error('Error finding user by email', {
        error: error.message,
        email
      });
      throw error;
    }
  }

  // Crear nuevo usuario
  async createUser(userData) {
    try {
      // Verificar que no exista usuario con el mismo Google ID o email
      const existingByGoogleId = await this.findByGoogleId(userData.googleId);
      const existingByEmail = await this.findByEmail(userData.email);

      if (existingByGoogleId) {
        throw new Error(`Usuario ya existe con Google ID: ${userData.googleId}`);
      }

      if (existingByEmail) {
        throw new Error(`Usuario ya existe con email: ${userData.email}`);
      }

      // Crear nuevo usuario
      const newUser = {
        id: uuidv4(),
        googleId: userData.googleId,
        email: userData.email.toLowerCase(),
        name: userData.name,
        picture: userData.picture,
        userType: userData.userType || 'parent',
        customRole: userData.customRole || null,
        role