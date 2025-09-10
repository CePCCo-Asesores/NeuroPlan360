# ==========================================
# NeuroPlan360 - Dockerfile para Railway
# Asistente Pedagógico Neurodivergente
# ==========================================

# Usar imagen oficial de Node.js Alpine (más ligera)
FROM node:18-alpine

# Metadatos del contenedor
LABEL maintainer="CePCCo-Asesores - ND Assistant Team"
LABEL version="1.0.1"
LABEL description="Backend para Asistente de Planeación Inclusiva y Neurodivergente"

# Force rebuild - eliminar cache
RUN echo "Force rebuild $(date)" > /rebuild.txt

# Instalar dependencias del sistema necesarias
RUN apk add --no-cache \
    dumb-init \
    curl \
    tini

# Crear directorio de trabajo
WORKDIR /usr/src/app

# Crear usuario y grupo no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S ndassistant -u 1001 -G nodejs

# Copiar archivos de dependencias primero (para cache de Docker)
COPY package*.json ./

# Configurar npm para producción
ENV NODE_ENV=production
ENV NPM_CONFIG_LOGLEVEL=warn
ENV NPM_CONFIG_PROGRESS=false

# Instalar dependencias de producción
RUN npm install --production --no-optional && \
    npm cache clean --force && \
    rm -rf /tmp/* /var/cache/apk/*

# Copiar código fuente
COPY . .

# Crear estructura de directorios necesarios
RUN mkdir -p logs temp uploads && \
    touch logs/app.log logs/error.log logs/requests.log logs/nd-operations.log

# Configurar permisos correctos
RUN chown -R ndassistant:nodejs /usr/src/app && \
    chmod -R 755 /usr/src/app && \
    chmod -R 766 logs

# Cambiar a usuario no-root
USER ndassistant

# Configurar variables de entorno por defecto
ENV PORT=3001
ENV LOG_LEVEL=info
ENV ENABLE_WEBSOCKETS=true
ENV ENABLE_ADMIN_ROUTES=true
ENV RATE_LIMIT_MAX_REQUESTS=100
ENV RATE_LIMIT_WINDOW_MS=900000
ENV MEMORY_CLEANUP_INTERVAL=3600000
ENV MAX_SESSIONS=1000
ENV GEMINI_TIMEOUT_MS=30000
ENV GEMINI_MAX_RETRIES=3

# Exponer puerto
EXPOSE $PORT

# Configurar health check robusto
HEALTHCHECK --interval=45s \
            --timeout=15s \
            --start-period=120s \
            --retries=5 \
            CMD curl -f http://localhost:${PORT:-3001}/api/health || exit 1

# Configurar señales de proceso para graceful shutdown
STOPSIGNAL SIGTERM

# Comando de inicio con init system para manejo correcto de señales
ENTRYPOINT ["tini", "--"]
CMD ["node", "server.js"]

# Configuración adicional para Railway
ENV RAILWAY_STATIC_URL=""
ENV RAILWAY_GIT_COMMIT_SHA=""
ENV RAILWAY_GIT_BRANCH=""

# Optimizaciones de Node.js para producción
ENV NODE_OPTIONS="--max-old-space-size=512 --optimize-for-size"

# Configurar timezone
ENV TZ=UTC

# Force rebuild indicator
ENV REBUILD_VERSION=1.0.1
