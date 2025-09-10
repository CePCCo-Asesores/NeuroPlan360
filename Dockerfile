# ==========================================
# NeuroPlan360 - Dockerfile para Railway
# Healthcheck optimizado
# ==========================================

FROM node:18-alpine

LABEL maintainer="CePCCo-Asesores - ND Assistant Team"
LABEL version="1.0.0"
LABEL description="Backend para Asistente de Planeación Inclusiva y Neurodivergente"

RUN apk add --no-cache \
    dumb-init \
    curl \
    tini

WORKDIR /usr/src/app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S ndassistant -u 1001 -G nodejs

COPY package*.json ./

ENV NODE_ENV=production
ENV NPM_CONFIG_LOGLEVEL=warn
ENV NPM_CONFIG_PROGRESS=false

RUN npm install --production --no-optional && \
    npm cache clean --force && \
    rm -rf /tmp/* /var/cache/apk/*

COPY . .

RUN mkdir -p logs temp uploads && \
    touch logs/app.log logs/error.log logs/requests.log logs/nd-operations.log

RUN chown -R ndassistant:nodejs /usr/src/app && \
    chmod -R 755 /usr/src/app && \
    chmod -R 766 logs

USER ndassistant

ENV PORT=3001
ENV LOG_LEVEL=info
ENV ENABLE_WEBSOCKETS=true
ENV ENABLE_ADMIN_ROUTES=true

EXPOSE $PORT

# Healthcheck más tolerante con más tiempo de inicio
HEALTHCHECK --interval=45s \
            --timeout=15s \
            --start-period=120s \
            --retries=5 \
            CMD curl -f http://localhost:${PORT:-3001}/api/health || exit 1

STOPSIGNAL SIGTERM

ENTRYPOINT ["tini", "--"]
CMD ["node", "server.js"]
