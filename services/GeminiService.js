// ==========================================
// Servicio Gemini usando API REST directa
// Similar a tu implementación PHP
// ==========================================

const logger = require('../config/logger');

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
    this.enabled = this.apiKey && this.apiKey !== 'test_key_disabled';
    
    if (!this.enabled) {
      logger.warn('Gemini API Key no configurada - funcionando en modo demo');
    } else {
      logger.info('Gemini Service inicializado con API REST directa');
    }
  }

  async generateContent(promptText) {
    if (!this.enabled) {
      return this.getDemoResponse(promptText);
    }

    try {
      const url = `${this.baseUrl}?key=${this.apiKey}`;
      
      const requestData = {
        contents: [
          {
            parts: [
              {
                text: promptText
              }
            ]
          }
        ]
      };

      logger.info('Llamando a Gemini API', {
        model: 'gemini-1.5-flash',
        promptLength: promptText.length
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
        throw new Error('Respuesta inválida de Gemini API');
      }

      const generatedText = result.candidates[0].content.parts[0].text;
      
      logger.info('Respuesta de Gemini recibida exitosamente', {
        responseLength: generatedText.length
      });

      return generatedText;

    } catch (error) {
      logger.error('Error llamando a Gemini API', {
        error: error.message
      });
      
      // Fallback a respuesta demo en caso de error
      return this.getDemoResponse(promptText);
    }
  }

  getDemoResponse(promptText) {
    logger.info('Generando respuesta demo (Gemini no disponible)');
    
    return `
# Plan Neurodivergente - Modo Demo

## Información del Plan
- **Tema**: Basado en "${promptText.substring(0, 100)}..."
- **Estado**: Demo (Gemini API no disponible)
- **Generado**: ${new Date().toISOString()}

## Comprensión Neurodivergente
Este es un plan de ejemplo generado en modo demo. En producción, este contenido sería generado por Gemini AI con adaptaciones específicas para neurodiversidad.

## Estrategias Adaptativas
- Estrategia visual personalizada
- Enfoque sensorial adaptado
- Técnicas de organización
- Sistemas de apoyo

## Implementación
1. Comenzar gradualmente
2. Adaptar según respuesta
3. Monitorear progreso
4. Ajustar estrategias

---
*Nota: Este es contenido de demostración. Configure GEMINI_API_KEY para funcionalidad completa.*
`;
  }

  async testConnection() {
    if (!this.enabled) {
      return { success: false, message: 'API Key no configurada' };
    }

    try {
      const testPrompt = 'Responde solo "OK" si recibes este mensaje.';
      const response = await this.generateContent(testPrompt);
      
      return { 
        success: true, 
        message: 'Conexión exitosa',
        response: response.substring(0, 100)
      };
    } catch (error) {
      return { 
        success: false, 
        message: error.message 
      };
    }
  }
}

module.exports = GeminiService;
