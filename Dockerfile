# ==============================================================================
# UGB PRESENÇA — Multi-Stage Production Dockerfile
# Stack: Node.js 22 + Express 5 + SQLite (better-sqlite3) + Portal Web React
# Compatível com servidores domésticos Linux x86_64 e ARM64 (Raspberry Pi, Mini PC)
# ==============================================================================

# --- Stage 1: Build do Portal Web (Vite + React + Tailwind) ---
FROM node:22-alpine AS web-builder
WORKDIR /build/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# --- Stage 2: Compilação das dependências nativas do Back-End (better-sqlite3) ---
FROM node:22-alpine AS server-builder
WORKDIR /build/server

RUN apk add --no-cache python3 make g++
COPY server/package*.json ./
RUN npm ci --omit=dev

# --- Stage 3: Imagem Final Enxuta de Produção ---
FROM node:22-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV HOST=0.0.0.0
ENV DB_PATH=/app/data/presenca_tcc.sqlite
ENV CLIENT_DIST_PATH=/app/public

# Diretório persistente para o volume SQLite
RUN mkdir -p /app/data

# Copia código do servidor + node_modules compilados
COPY --from=server-builder /build/server/node_modules ./node_modules
COPY server/package*.json ./
COPY server/index.js ./
COPY server/database.js ./
COPY server/haversine.js ./
COPY server/antifraud.js ./
COPY server/biometrics.js ./
COPY server/middleware ./middleware
COPY server/routes ./routes

# Copia Portal Web compilado
COPY --from=web-builder /build/client/dist ./public

VOLUME ["/app/data"]
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 5000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "index.js"]
