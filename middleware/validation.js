const Joi = require('joi');
const logger = require('../config/logger');

// Esquemas de validación
const schemas = {
  // Validación para generar plan ND
  generatePlan: Joi.object({
    userType: Joi.string()
      .valid('teacher', 'therapist', 'parent', 'doctor', 'mixed', 'other')
      .required()
      .messages({
        'any.required': 'El tipo de usuario es requerido',
        'any.only': 'El tipo de usuario debe ser válido'
      }),

    customRole: Joi.string()
      .max(100)
      .when('userType', {
        is: Joi.string().valid('mixed', 'other'),
        then: Joi.string().required(),
        otherwise: Joi.string().optional()
      })
      .messages({
        'string.max': 'El rol personalizado no puede exceder 100 caracteres',
        'any.required': 'El rol personalizado es requerido para usuarios mixtos u otros'
      }),

    neurodiversities: Joi.array()
      .items(
        Joi.string().valid(
          'tdah', 'autism', 'dyslexia', 'dyscalculia', 'dysgraphia',
          'giftedness', 'tourette', 'dyspraxia', 'sensory', 'anxiety',
          'none', 'other', 'unsure'
        )
      )
      .min(1)
      .max(5)
      .required()
      .messages({
        'array.min': 'Debe seleccionar al menos una neurodiversidad',
        'array.max': 'No puede seleccionar más de 5 neurodiversidades',
        'any.required': 'Las neurodiversidades son requeridas'
      }),

    priorityND: Joi.string()
      .valid(
        'tdah', 'autism', 'dyslexia', 'dyscalculia', 'dysgraphia',
        'giftedness', 'tourette', 'dyspraxia', 'sensory', 'anxiety',
        'none', 'other', 'unsure'
      )
      .optional(),

    menuOption: Joi.string()
      .valid('adapt', 'create', 'review', 'consult', 'evaluate', 'universal')
      .required()
      .messages({
        'any.required': 'La opción de menú es requerida',
        'any.only': 'La opción de menú debe ser válida'
      }),

    // Campos condicionales según menuOption
    activityDescription: Joi.string()
      .max(2000)
      .when('menuOption', {
        is: Joi.string().valid('adapt', 'review', 'consult'),
        then: Joi.string().required(),
        otherwise: Joi.string().optional()
      })
      .messages({
        'string.max': 'La descripción no puede exceder 2000 caracteres',
        'any.required': 'La descripción de la actividad es requerida para esta opción'
      }),

    theme: Joi.string()
      .max(200)
      .when('menuOption', {
        is: 'create',
        then: Joi.string().required(),
        otherwise: Joi.string().optional()
      })
      .messages({
        'string.max': 'El tema no puede exceder 200 caracteres',
        'any.required': 'El tema es requerido para crear una actividad'
      }),

    objectives: Joi.string()
      .max(1000)
      .when('menuOption', {
        is: 'create',
        then: Joi.string().required(),
        otherwise: Joi.string().optional()
      })
      .messages({
        'string.max': 'Los objetivos no pueden exceder 1000 caracteres',
        'any.required': 'Los objetivos son requeridos para crear una actividad'
      }),

    ageGroup: Joi.string()
      .max(100)
      .required()
      .messages({
        'string.max': 'El grupo de edad no puede exceder 100 caracteres',
        'any.required': 'El grupo de edad es requerido'
      }),

    sensitivities: Joi.string()
      .max(1000)
      .optional()
      .messages({
        'string.max': 'Las sensibilidades no pueden exceder 1000 caracteres'
      }),

    skillsCheck: Joi.boolean()
      .default(false),

    environments: Joi.array()
      .items(
        Joi.string().valid('Casa', 'Escuela/Trabajo', 'Espacios públicos', 'Terapia/Consultorio')
      )
      .max(4)
      .default([])
      .messages({
        'array.max': 'No puede seleccionar más de 4 entornos'
      }),

    caregivers: Joi.boolean()
      .default(false),

    timeConstraints: Joi.string()
      .max(500)
      .optional()
      .messages({
        'string.max': 'Las limitaciones de tiempo no pueden exceder 500 caracteres'
      }),

    urgentAspects: Joi.string()
      .max(1000)
      .optional()
      .messages({
        'string.max': 'Los aspectos urgentes no pueden exceder 1000 caracteres'
      }),

    outputFormat: Joi.string()
      .valid('practical', 'complete', 'ndplus', 'sensory', 'traffic')
      .required()
      .messages({
        'any.required': 'El formato de salida es requerido',
        'any.only': 'El formato de salida debe ser válido'
      })
  }),

  // Validación para regenerar plan
  regeneratePlan: Joi.object({
    sessionId: Joi.string()
      .pattern(/^nd_session_\d+_[a-z0-9]+$/)
      .required()
      .messages({
        'string.pattern.base': 'El sessionId no tiene el formato correcto',
        'any.required': 'El sessionId es requerido'
      }),

    newOutputFormat: Joi.string()
      .valid('practical', 'complete', 'ndplus', 'sensory', 'traffic')
      .optional(),

    additionalContext: Joi.string()
      .max(1000)
      .optional()
      .messages({
        'string.max': 'El contexto adicional no puede exceder 1000 caracteres'
      })
  }),

  // Validación para feedback
  feedback: Joi.object({
    sessionId: Joi.string()
      .pattern(/^nd_session_\d+_[a-z0-9]+$/)
      .required()
      .messages({
        'string.pattern.base': 'El sessionId no tiene el formato correcto',
        'any.required': 'El sessionId es requerido'
      }),

    rating: Joi.number()
      .min(1)
      .max(5)
      .required()
      .messages({
        'number.min': 'La calificación debe ser mínimo 1',
        'number.max': 'La calificación debe ser máximo 5',
        'any.required': 'La calificación es requerida'
      }),

    comments: Joi.string()
      .max(2000)
      .optional()
      .messages({
        'string.max': 'Los comentarios no pueden exceder 2000 caracteres'
      }),

    helpfulSections: Joi.array()
      .items(
        Joi.string().valid(
          'comprension', 'evaluaciones', 'implementacion', 
          'generalizacion', 'capacitacion', 'tecnologia'
        )
      )
      .max(6)
      .optional()
      .messages({
        'array.max': 'No puede seleccionar más de 6 secciones útiles'
      }),

    improvements: Joi.string()
      .max(1000)
      .optional()
      .messages({
        'string.max': 'Las sugerencias de mejora no pueden exceder 1000 caracteres'
      })
  }),

  // Validación para export
  exportPlan: Joi.object({
    sessionId: Joi.string()
      .pattern(/^nd_session_\d+_[a-z0-9]+$/)
      .required()
      .messages({
        'string.pattern.base': 'El sessionId no tiene el formato correcto',
        'any.required': 'El sessionId es requerido'
      }),

    format: Joi.string()
      .valid('json', 'pdf', 'docx', 'txt')
      .default('json')
  }),

  // Validación para parámetros de sesión
  sessionParams: Joi.object({
    sessionId: Joi.string()
      .pattern(/^nd_session_\d+_[a-z0-9]+$/)
      .required()
      .messages({
        'string.pattern.base': 'El sessionId no tiene el formato correcto',
        'any.required': 'El sessionId es requerido'
      })
  })
};

// Middleware de validación
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const startTime = Date.now();
    
    try {
      const dataToValidate = property === 'params' ? req.params : 
                           property === 'query' ? req.query : 
                           req.body;

      const { error, value } = schema.validate(dataToValidate, {
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true
      });

      if (error) {
        const validationErrors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));

        logger.warn('Validation Error', {
          endpoint: req.path,
          method: req.method,
          ip: req.ip,
          errors: validationErrors,
          requestBody: req.body,
          userAgent: req.get('User-Agent')
        });

        return res.status(400).json({
          success: false,
          error: 'Error de validación',
          details: validationErrors,
          timestamp: new Date().toISOString()
        });
      }

      // Actualizar request con datos validados y limpios
      if (property === 'params') {
        req.params = value;
      } else if (property === 'query') {
        req.query = value;
      } else {
        req.body = value;
      }

      const validationTime = Date.now() - startTime;
      logger.debug('Validation Success', {
        endpoint: req.path,
        validationTime: `${validationTime}ms`,
        dataSize: JSON.stringify(dataToValidate).length
      });

      next();

    } catch (err) {
      logger.error('Validation Middleware Error', {
        error: err.message,
        stack: err.stack,
        endpoint: req.path,
        method: req.method
      });

      res.status(500).json({
        success: false,
        error: 'Error interno de validación',
        timestamp: new Date().toISOString()
      });
    }
  };
};

// Validaciones específicas para cada endpoint
const validations = {
  generatePlan: validate(schemas.generatePlan),
  regeneratePlan: validate(schemas.regeneratePlan),
  feedback: validate(schemas.feedback),
  exportPlan: validate(schemas.exportPlan),
  sessionParams: validate(schemas.sessionParams, 'params')
};

// Validación personalizada para IP y User Agent
const validateClientInfo = (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent');

  if (!clientIp) {
    logger.security('Missing Client IP', null, null, {
      endpoint: req.path,
      headers: req.headers
    });
  }

  if (!userAgent || userAgent.length < 10) {
    logger.security('Suspicious User Agent', clientIp, userAgent, {
      endpoint: req.path,
      method: req.method
    });
  }

  req.clientInfo = {
    ip: clientIp,
    userAgent: userAgent,
    timestamp: Date.now()
  };

  next();
};

// Validación de contenido sensible
const validateSensitiveContent = (req, res, next) => {
  const sensitiveFields = ['activityDescription', 'objectives', 'theme', 'comments', 'urgentAspects'];
  const suspiciousPatterns = [
    /\b(kill|death|suicide|harm|violence)\b/gi,
    /\b(drug|alcohol|weapon|bomb)\b/gi,
    /\b(hate|racist|discriminat)\b/gi
  ];

  try {
    for (const field of sensitiveFields) {
      const content = req.body[field];
      if (typeof content === 'string') {
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(content)) {
            logger.security('Sensitive Content Detected', req.clientInfo?.ip, req.clientInfo?.userAgent, {
              field,
              content: content.substring(0, 100),
              pattern: pattern.toString(),
              endpoint: req.path
            });

            return res.status(400).json({
              success: false,
              error: 'Contenido no apropiado detectado',
              details: 'El contenido enviado no es apropiado para un asistente educativo',
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    }
    next();
  } catch (error) {
    logger.error('Content Validation Error', {
      error: error.message,
      endpoint: req.path
    });
    next();
  }
};

// Validación de tamaño de request
const validateRequestSize = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = parseInt(req.get('Content-Length') || '0');
    const maxSizeBytes = parseSize(maxSize);

    if (contentLength > maxSizeBytes) {
      logger.security('Request Too Large', req.clientInfo?.ip, req.clientInfo?.userAgent, {
        contentLength,
        maxSize: maxSizeBytes,
        endpoint: req.path
      });

      return res.status(413).json({
        success: false,
        error: 'Request demasiado grande',
        details: `El tamaño máximo permitido es ${maxSize}`,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
};

// Función auxiliar para parsear tamaños
function parseSize(size) {
  const units = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
  const match = size.toString().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([kmg]?b)$/);
  
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';
  
  return Math.floor(value * (units[unit] || 1));
}

// Middleware compuesto para validación completa
const fullValidation = (schema) => {
  return [
    validateClientInfo,
    validateRequestSize(),
    validate(schema),
    validateSensitiveContent
  ];
};

module.exports = {
  schemas,
  validate,
  validations,
  validateClientInfo,
  validateSensitiveContent,
  validateRequestSize,
  fullValidation
};