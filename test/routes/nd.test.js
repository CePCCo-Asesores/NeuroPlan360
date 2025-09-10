const request = require('supertest');
const { app } = require('../../server');
const NDAssistantProcessor = require('../../services/NDAssistantProcessor');

// Mock del procesador ND
jest.mock('../../services/NDAssistantProcessor');

describe('ND Routes', () => {
  let mockProcessor;

  beforeEach(() => {
    mockProcessor = {
      processNDRequest: jest.fn(),
      getConversationalMemory: jest.fn(),
      getNeurodiversityInfo: jest.fn(),
      validateUserConfiguration: jest.fn(),
      processFeedback: jest.fn(),
      generateExportData: jest.fn(),
      getSuggestionsByNeurodiversity: jest.fn(),
      getAvailableNeurodiversities: jest.fn()
    };
    NDAssistantProcessor.mockImplementation(() => mockProcessor);
  });

  describe('POST /api/generate-nd-plan', () => {
    it('debería generar un plan ND exitosamente', async () => {
      const testData = testHelpers.createValidNDData();
      const sessionId = testHelpers.createValidSessionId();
      
      mockProcessor.processNDRequest.mockResolvedValue({
        success: true,
        sessionId,
        data: {
          title: 'Plan de prueba',
          sections: [
            { id: 'comprension', title: 'Comprensión ND', content: 'Test content' }
          ]
        },
        metadata: { timestamp: Date.now() }
      });

      const response = await request(app)
        .post('/api/generate-nd-plan')
        .send(testData)
        .expect(200);

      testHelpers.expectNDResponse(response.body);
      expect(response.body.success).toBe(true);
      expect(response.body.sessionId).toBe(sessionId);
      expect(mockProcessor.processNDRequest).toHaveBeenCalledWith(testData);
    });

    it('debería rechazar datos inválidos', async () => {
      const invalidData = {
        userType: 'invalid',
        neurodiversities: [], // Array vacío
        menuOption: 'invalid'
      };

      const response = await request(app)
        .post('/api/generate-nd-plan')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validación');
    });

    it('debería manejar errores del procesador', async () => {
      const testData = testHelpers.createValidNDData();
      
      mockProcessor.processNDRequest.mockResolvedValue({
        success: false,
        error: 'Error de Gemini'
      });

      const response = await request(app)
        .post('/api/generate-nd-plan')
        .send(testData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Error de Gemini');
    });
  });

  describe('GET /api/session/:sessionId', () => {
    it('debería obtener información de sesión válida', async () => {
      const sessionId = testHelpers.createValidSessionId();
      const sessionData = {
        userType: 'teacher',
        neurodiversities: ['tdah'],
        timestamp: Date.now() - 1000,
        adaptations: []
      };

      mockProcessor.getConversationalMemory.mockReturnValue(sessionData);

      const response = await request(app)
        .get(`/api/session/${sessionId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessionId).toBe(sessionId);
      expect(response.body.data.userType).toBe('teacher');
      testHelpers.expectNDSession(response.body.data);
    });

    it('debería retornar 404 para sesión inexistente', async () => {
      const sessionId = testHelpers.createValidSessionId();
      mockProcessor.getConversationalMemory.mockReturnValue(null);

      const response = await request(app)
        .get(`/api/session/${sessionId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('no encontrada');
    });

    it('debería rechazar sessionId inválido', async () => {
      const invalidSessionId = 'invalid-session-id';

      const response = await request(app)
        .get(`/api/session/${invalidSessionId}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validación');
    });
  });

  describe('POST /api/feedback', () => {
    it('debería procesar feedback válido', async () => {
      const sessionId = testHelpers.createValidSessionId();
      const sessionData = {
        userType: 'teacher',
        neurodiversities: ['tdah'],
        outputFormat: 'complete'
      };
      const feedbackData = {
        sessionId,
        rating: 5,
        comments: 'Excelente plan',
        helpfulSections: ['comprension', 'implementacion'],
        improvements: 'Más ejemplos visuales'
      };

      mockProcessor.getConversationalMemory.mockReturnValue(sessionData);
      mockProcessor.processFeedback.mockResolvedValue({ processed: true });

      const response = await request(app)
        .post('/api/feedback')
        .send(feedbackData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.rating).toBe(5);
      expect(mockProcessor.processFeedback).toHaveBeenCalled();
    });

    it('debería rechazar rating inválido', async () => {
      const sessionId = testHelpers.createValidSessionId();
      const invalidFeedback = {
        sessionId,
        rating: 10, // Fuera del rango 1-5
        comments: 'Test'
      };

      const response = await request(app)
        .post('/api/feedback')
        .send(invalidFeedback)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validación');
    });
  });

  describe('GET /api/neurodiversities', () => {
    it('debería retornar información de neurodiversidades', async () => {
      const mockInfo = [
        {
          id: 'tdah',
          label: 'TDAH',
          principles: ['Principio 1'],
          strengths: ['Fortaleza 1'],
          considerations: ['Consideración 1']
        }
      ];

      mockProcessor.getNeurodiversityInfo.mockReturnValue(mockInfo);

      const response = await request(app)
        .get('/api/neurodiversities')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockInfo);
      expect(response.body.meta.totalNeurodiversities).toBe(1);
    });
  });

  describe('POST /api/validate-config', () => {
    it('debería validar configuración válida', async () => {
      const testData = testHelpers.createValidNDData();
      const mockValidation = {
        isValid: true,
        warnings: [],
        recommendations: []
      };

      mockProcessor.validateUserConfiguration.mockReturnValue(mockValidation);

      const response = await request(app)
        .post('/api/validate-config')
        .send(testData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(true);
    });
  });

  describe('GET /api/suggestions/:neurodiversity', () => {
    it('debería retornar sugerencias para neurodiversidad válida', async () => {
      const neurodiversity = 'tdah';
      const mockSuggestions = {
        neurodiversity: 'tdah',
        label: 'TDAH',
        principles: ['Principio 1'],
        activities: ['Actividad 1', 'Actividad 2']
      };

      mockProcessor.getSuggestionsByNeurodiversity.mockReturnValue(mockSuggestions);

      const response = await request(app)
        .get(`/api/suggestions/${neurodiversity}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.neurodiversity).toBe('tdah');
      expect(response.body.data.activities).toHaveLength(2);
    });

    it('debería retornar 404 para neurodiversidad inexistente', async () => {
      const neurodiversity = 'inexistente';
      mockProcessor.getSuggestionsByNeurodiversity.mockReturnValue(null);
      mockProcessor.getAvailableNeurodiversities.mockReturnValue(['tdah', 'autism']);

      const response = await request(app)
        .get(`/api/suggestions/${neurodiversity}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('no encontrada');
      expect(response.body.available).toEqual(['tdah', 'autism']);
    });
  });

  describe('Rate Limiting', () => {
    it('debería aplicar rate limiting después de muchas requests', async () => {
      const testData = testHelpers.createValidNDData();
      mockProcessor.processNDRequest.mockResolvedValue({
        success: true,
        sessionId: testHelpers.createValidSessionId(),
        data: { title: 'Test', sections: [] }
      });

      // Simular muchas requests rápidas
      const promises = Array(12).fill().map(() => 
        request(app)
          .post('/api/generate-nd-plan')
          .send(testData)
      );

      const responses = await Promise.all(promises);
      
      // Al menos una debería ser rate limited (429)
      const rateLimited = responses.some(res => res.status === 429);
      expect(rateLimited).toBe(true);
    }, 10000);
  });
});

describe('Error Handling', () => {
  it('debería manejar errores de middleware', async () => {
    // Test con datos que causan error en middleware
    const response = await request(app)
      .post('/api/generate-nd-plan')
      .send({ invalid: 'data' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('validación');
  });

  it('debería manejar rutas no encontradas', async () => {
    const response = await request(app)
      .get('/api/nonexistent-route')
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('no encontrado');
  });
});

describe('Security', () => {
  it('debería rechazar contenido sospechoso', async () => {
    const maliciousData = testHelpers.createValidNDData({
      activityDescription: 'Enseñar a hacer bomb y kill people',
      objectives: 'violence and hate speech'
    });

    const response = await request(app)
      .post('/api/generate-nd-plan')
      .send(maliciousData)
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('no apropiado');
  });

  it('debería rechazar User-Agent sospechoso', async () => {
    const testData = testHelpers.createValidNDData();

    const response = await request(app)
      .post('/api/generate-nd-plan')
      .set('User-Agent', 'sqlmap/1.0')
      .send(testData)
      .expect(403);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('denegado');
  });

  it('debería validar tamaño de request', async () => {
    const largeData = testHelpers.createValidNDData({
      activityDescription: 'x'.repeat(100000) // String muy largo
    });

    const response = await request(app)
      .post('/api/generate-nd-plan')
      .send(largeData)
      .expect(413);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('demasiado grande');
  });
});