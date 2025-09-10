# Usar Node.js 18 LTS como imagen base
FROM node:18-alpine

# Establecer metadatos
LABEL maintainer="ND Assistant Team"
LABEL description="Backend para Asistente de Planeación Inclusiva y Neurodivergente"
LABEL version="1.0.0"

# Crear directorio de aplicación
WORKDIR /usr/src/app

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S ndassistant -u 1001

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production && \
    npm cache clean --force

# Copiar código fuente
COPY --chown=ndassistant:nodejs . .

# Crear directorio de logs con permisos correctos
RUN mkdir -p logs && \
    chown -R ndassistant:nodejs logs && \
    chmod 755 logs

# Instalar dumb-init para manejo correcto de señales
RUN apk add --no-cache dumb-init

# Cambiar a usuario no-root
USER ndassistant

# Exponer puerto
EXPOSE 3001

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3001
ENV LOG_LEVEL=info

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "const http = require('http'); const options = { hostname: 'localhost', port: process.env.PORT || 3001, path: '/api/health', timeout: 2000 }; const req = http.get(options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.on('timeout', () => { req.destroy(); process.exit(1); });"

# Comando de inicio con dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
