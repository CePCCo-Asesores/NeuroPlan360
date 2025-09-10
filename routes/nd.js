const express = require('express');
const router = express.Router();
const NDAssistantProcessor = require('../services/NDAssistantProcessor');
const { validations, fullValidation } = require('../middleware/validation');
const { planGenerationLimit, sessionSecurity } = require('../middleware/security');
const logger = require('../config/logger');

// Instancia del procesador ND
const ndProcessor = new NDAssistantProcessor();

// Ruta principal para generar planes ND
router.post('/generate-nd-plan', 
  planGenerationLimit,
  fullValidation(validations.generatePlan.schema),
  sessionSecurity,
  async (req, res) => {
    const startTime = Date.now();
    let sessionId = null;

    try {
      logger.ndOperation('generate_plan_start', null, req.body.userType, req.body.neurodiversities, {
        menuOption: req.body.menuOption,
        outputFormat: req.body.outputFormat,
        ip: req.ip
      });

      // Procesar solicitud
      const result = await ndProcessor.processNDRequest(req.body);
      sessionId = result.sessionId;

      if (result.success) {
        const processingTime = Date.now() - startTime;
        
        // Registrar actividad del usuario si está autenticado
        if (req.user) {
          try {
            await UserService.recordUserActivity(req.user.id, 'plan_generated', {
              neurodiversities: req.body.neurodiversities,
              outputFormat: req.body.outputFormat,
              userType: req.body.userType,
              processingTime
            });
          } catch (activityError) {
            logger.warn('Failed to record user activity', {
              userId: req.user.id,
              error: activityError.message
            });
          }
        }
        
        logger.ndOperation('generate_plan_success', sessionId, req.body.userType, req.body.neurodiversities, {
          processingTime: `${processingTime}ms`,
          outputFormat: req.body.outputFormat,
          sectionsGenerated: result.data.sections?.length || 0,
          userId: req.user?.id
        });

        res.json(result);
      } else {
        logger.ndError(new Error(result.error), sessionId, {
          userType: req.body.userType,
          neurodiversities: req.body.neurodiversities,
          processingTime: `${Date.now() - startTime}ms`
        });

        res.status(500).json(result);
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.ndError(error, sessionId, {
        userType: req.body.userType,
        neurodiversities: req.body.neurodiversities,
        processingTime: `${processingTime}ms`,
        stackTrace: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        sessionId,
        timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error retrieving neurodiversity info', {
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Error obteniendo información de neurodiversidades',
      timestamp: new Date().toISOString()
    });
  }
});

// Ruta para validar configuración del usuario
router.post('/validate-config', 
  validations.generatePlan,
  (req, res) => {
    try {
      const validation = ndProcessor.validateUserConfiguration(req.body);
      
      logger.debug('Configuration validated', {
        userType: req.body.userType,
        neurodiversities: req.body.neurodiversities,
        isValid: validation.isValid,
        ip: req.ip
      });

      res.json({
        success: true,
        data: validation,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error validating configuration', {
        error: error.message,
        userType: req.body.userType,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Error validando configuración',
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Ruta para obtener sugerencias basadas en neurodiversidad
router.get('/suggestions/:neurodiversity', (req, res) => {
  try {
    const { neurodiversity } = req.params;
    const suggestions = ndProcessor.getSuggestionsByNeurodiversity(neurodiversity);
    
    if (!suggestions) {
      return res.status(404).json({
        success: false,
        error: 'Neurodiversidad no encontrada',
        available: ndProcessor.getAvailableNeurodiversities(),
        timestamp: new Date().toISOString()
      });
    }

    logger.debug('Suggestions requested', {
      neurodiversity,
      ip: req.ip,
      suggestionsCount: suggestions.activities?.length || 0
    });

    res.json({
      success: true,
      data: suggestions,
      meta: {
        neurodiversity,
        lastUpdated: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error getting suggestions', {
      error: error.message,
      neurodiversity: req.params.neurodiversity,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Error obteniendo sugerencias',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;toISOString()
      });
    }
  }
);

// Ruta para regenerar plans con nuevos parámetros
router.post('/regenerate-plan',
  planGenerationLimit,
  validations.regeneratePlan,
  sessionSecurity,
  async (req, res) => {
    const startTime = Date.now();
    const { sessionId, newOutputFormat, additionalContext } = req.body;

    try {
      logger.ndOperation('regenerate_plan_start', sessionId, null, null, {
        newOutputFormat,
        additionalContext: !!additionalContext
      });

      // Obtener datos originales
      const originalData = ndProcessor.getConversationalMemory(sessionId);
      if (!originalData) {
        logger.warn('Session not found for regeneration', {
          sessionId,
          ip: req.ip,
          requestTime: new Date().toISOString()
        });

        return res.status(404).json({
          success: false,
          error: 'Sesión no encontrada',
          details: 'La sesión puede haber expirado o no existir',
          sessionId,
          timestamp: new Date().toISOString()
        });
      }

      // Combinar datos originales con nuevos parámetros
      const updatedData = {
        ...originalData,
        outputFormat: newOutputFormat || originalData.outputFormat,
        additionalContext: additionalContext || ''
      };

      const result = await ndProcessor.processNDRequest(updatedData);
      
      const processingTime = Date.now() - startTime;
      
      if (result.success) {
        logger.ndOperation('regenerate_plan_success', sessionId, originalData.userType, originalData.neurodiversities, {
          processingTime: `${processingTime}ms`,
          newOutputFormat,
          sectionsGenerated: result.data.sections?.length || 0
        });

        res.json(result);
      } else {
        logger.ndError(new Error(result.error), sessionId, {
          operation: 'regeneration',
          processingTime: `${processingTime}ms`
        });

        res.status(500).json(result);
      }

    } catch (error) {
      logger.ndError(error, sessionId, {
        operation: 'regeneration',
        processingTime: `${Date.now() - startTime}ms`
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        sessionId,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Ruta para obtener información de sesión
router.get('/session/:sessionId',
  validations.sessionParams,
  sessionSecurity,
  (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const memory = ndProcessor.getConversationalMemory(sessionId);
      
      if (memory) {
        logger.debug('Session retrieved', {
          sessionId,
          userType: memory.userType,
          neurodiversities: memory.neurodiversities,
          age: `${Math.round((Date.now() - memory.timestamp) / 1000 / 60)}m`
        });

        res.json({
          success: true,
          data: {
            sessionId,
            userType: memory.userType,
            customRole: memory.customRole,
            neurodiversities: memory.neurodiversities,
            priorityND: memory.priorityND,
            timestamp: memory.timestamp,
            adaptations: memory.adaptations,
            age: Date.now() - memory.timestamp,
            isActive: (Date.now() - memory.timestamp) < (60 * 60 * 1000) // 1 hora
          },
          timestamp: new Date().toISOString()
        });
      } else {
        logger.warn('Session not found', {
          sessionId,
          ip: req.ip
        });

        res.status(404).json({
          success: false,
          error: 'Sesión no encontrada',
          details: 'La sesión puede haber expirado o no existir',
          sessionId,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Error retrieving session', {
        error: error.message,
        sessionId: req.params.sessionId,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        sessionId: req.params.sessionId,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Ruta para feedback
router.post('/feedback',
  validations.feedback,
  sessionSecurity,
  async (req, res) => {
    try {
      const { sessionId, rating, comments, helpfulSections, improvements } = req.body;
      
      // Verificar que la sesión existe
      const sessionData = ndProcessor.getConversationalMemory(sessionId);
      if (!sessionData) {
        return res.status(404).json({
          success: false,
          error: 'Sesión no encontrada para feedback',
          sessionId,
          timestamp: new Date().toISOString()
        });
      }

      // En producción, esto se almacenaría en base de datos
      const feedbackData = {
        sessionId,
        rating,
        comments: comments || '',
        helpfulSections: helpfulSections || [],
        improvements: improvements || '',
        userType: sessionData.userType,
        neurodiversities: sessionData.neurodiversities,
        outputFormat: sessionData.outputFormat,
        timestamp: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      };

      logger.info('Feedback received', feedbackData);

      // Procesar feedback para mejoras futuras
      await ndProcessor.processFeedback(feedbackData);

      res.json({
        success: true,
        message: 'Feedback recibido correctamente',
        data: {
          sessionId,
          rating,
          processed: true
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error processing feedback', {
        error: error.message,
        sessionId: req.body.sessionId,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Error procesando feedback',
        sessionId: req.body.sessionId,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Ruta para exportar plan
router.post('/export-plan',
  validations.exportPlan,
  sessionSecurity,
  async (req, res) => {
    try {
      const { sessionId, format = 'json' } = req.body;
      
      const sessionData = ndProcessor.getConversationalMemory(sessionId);
      if (!sessionData) {
        return res.status(404).json({
          success: false,
          error: 'Sesión no encontrada para exportación',
          sessionId,
          timestamp: new Date().toISOString()
        });
      }

      logger.ndOperation('export_plan', sessionId, sessionData.userType, sessionData.neurodiversities, {
        format,
        ip: req.ip
      });

      // Generar datos para exportación
      const exportData = await ndProcessor.generateExportData(sessionId, format);

      res.json({
        success: true,
        data: exportData,
        meta: {
          sessionId,
          format,
          generatedAt: new Date().toISOString(),
          downloadUrl: `/api/download/${sessionId}?format=${format}`,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 horas
        }
      });

    } catch (error) {
      logger.ndError(error, req.body.sessionId, {
        operation: 'export',
        format: req.body.format
      });

      res.status(500).json({
        success: false,
        error: 'Error exportando plan',
        sessionId: req.body.sessionId,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Ruta para obtener información sobre neurodiversidades
router.get('/neurodiversities', (req, res) => {
  try {
    const neurodiversityInfo = ndProcessor.getNeurodiversityInfo();
    
    logger.debug('Neurodiversity info requested', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      count: neurodiversityInfo.length
    });

    res.json({
      success: true,
      data: neurodiversityInfo,
      meta: {
        totalNeurodiversities: neurodiversityInfo.length,
        lastUpdated: new Date().toISOString(),
        version: '1.0.0'
      },
      timestamp: new Date().