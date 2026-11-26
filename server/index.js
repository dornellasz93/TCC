const http = require('http');
const https = require('https');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.set('trust proxy', true);
const PORT = Number(process.env.PORT || 5000);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 5443);
const PUBLIC_HTTPS_PORT = Number(process.env.PUBLIC_HTTPS_PORT || HTTPS_PORT);
const HOST = process.env.HOST || '0.0.0.0';
const clientDistPath = process.env.CLIENT_DIST_PATH
  ? path.resolve(process.env.CLIENT_DIST_PATH)
  : path.join(__dirname, '..', 'client', 'dist');

// Middlewares de segurança e CORS (CSP ativo para bloquear scripts inline/CDNs não autorizados)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://images.unsplash.com'],
      connectSrc: ["'self'"],
      mediaSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: null
    }
  },
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  originAgentCluster: false,
  strictTransportSecurity: false
}));

app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(self), microphone=()');

  // Redireciona automaticamente HTTP -> HTTPS quando acessado via Cloudflare Tunnel / Proxy em domínio público
  if (req.headers['cf-ray'] || req.headers['cf-visitor']) {
    let isHttpOnEdge = req.headers['x-forwarded-proto'] === 'http';
    if (!isHttpOnEdge && typeof req.headers['cf-visitor'] === 'string') {
      isHttpOnEdge = req.headers['cf-visitor'].includes('"scheme":"http"');
    }
    if (isHttpOnEdge && req.headers.host) {
      return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    }
  }

  next();
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Analisador de corpo (body parser) com limite de 50MB para capturas faciais em alta resolução + pares de 2 quadros para prova de vida
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logger de telemetria das requisições
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.originalUrl !== '/api/health') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Inicializa o banco de dados SQLite e o gerenciador HTTPS local
const db = require('./database');
const { createSslManager } = require('./ssl');
const sslManager = createSslManager(path.dirname(db.dbPath));
let activeHttpsServer = null;

// Garante automaticamente que o IP/domínio acessado na LAN conste no certificado TLS (SAN)
app.use((req, res, next) => {
  if (sslManager.available && req.hostname) {
    sslManager.ensureHost(req.hostname, activeHttpsServer);
  }
  next();
});

// Rotas de certificado CA local (permite confiar no HTTPS na LAN sem avisos no iOS/Android)
app.get('/api/ssl/ca.crt', (req, res) => {
  if (!sslManager.available || !fs.existsSync(sslManager.caCertPath)) {
    return res.status(404).json({ success: false, message: 'Certificado CA local não disponível.' });
  }
  res.setHeader('Content-Type', 'application/x-x509-ca-cert');
  res.setHeader('Content-Disposition', 'inline; filename="ugb-presenca-local-ca.crt"');
  return res.sendFile(sslManager.caCertPath);
});

app.get('/api/ssl/prepare', (req, res) => {
  const host = req.query.host || req.hostname;
  if (sslManager.available && host) {
    sslManager.ensureHost(String(host), activeHttpsServer);
  }
  res.json({
    success: true,
    httpsAvailable: Boolean(sslManager.available && activeHttpsServer),
    httpsPort: PUBLIC_HTTPS_PORT
  });
});

// Rotas da API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/analytics', require('./routes/analytics'));

// Endpoint de verificação de saúde (usado pelo HEALTHCHECK do Docker e pelo testador do app mobile)
app.get('/api/health', (req, res) => {
  try {
    const counts = db.prepare('SELECT (SELECT COUNT(*) FROM users) as users, (SELECT COUNT(*) FROM class_sessions) as sessions').get();
    res.json({
      status: 'online',
      version: '2.0.0',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      https: {
        enabled: Boolean(sslManager.available && activeHttpsServer),
        port: PUBLIC_HTTPS_PORT
      },
      database: {
        engine: 'SQLite (WAL)',
        connected: true,
        users: counts.users,
        sessions: counts.sessions
      },
      stack: ['React Native (Expo)', 'React Web', 'Node.js + Express', 'SQLite', 'Docker'],
      project: 'Sistema de Registro de Presença Acadêmica por Geolocalização e Reconhecimento Facial (UGB)',
      authors: [
        'Pedro Henrique Teixeira Dornellas Soares de Souza',
        'Pedro Gabriel da Costa Ribeiro'
      ],
      institution: 'Centro Universitário Geraldo Di Biase (UGB)'
    });
  } catch (err) {
    res.status(503).json({ status: 'degraded', error: err.message });
  }
});

// Serve o build do Portal Web (produção Docker e build local)
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
}

// Fallback de 404 da API e SPA
app.use((req, res) => {
  if (req.url.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'Endpoint da API não encontrado.' });
  }

  const indexPath = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }

  return res.status(200).json({
    status: 'online',
    message: 'API do Protótipo de TCC - UGB ativa. Compile client/ ou conecte o app React Native (Expo).'
  });
});

if (require.main === module) {
  http.createServer(app).listen(PORT, HOST, () => {
    console.log(`
========================================================================
🎓 UGB PRESENÇA — SERVIDOR DO PROTÓTIPO DE TCC (v2.0)
📡 HTTP  (API / Expo): http://${HOST}:${PORT}
🩺 Healthcheck:        http://localhost:${PORT}/api/health
🗄️  Banco SQLite:       ${db.dbPath}
🔒 Geofencing (Haversine) + Anti-Mock Location + Biometria Facial Ativos
========================================================================
    `);
  });

  if (sslManager.available && HTTPS_PORT > 0) {
    const creds = sslManager.getCredentials();
    activeHttpsServer = https.createServer(creds, app);
    activeHttpsServer.listen(HTTPS_PORT, HOST, () => {
      console.log(`🔐 HTTPS (GPS Real + Câmera Web Mobile): https://${HOST}:${HTTPS_PORT}`);
    });
    activeHttpsServer.on('error', (err) => {
      console.warn(`[SSL] Não foi possível iniciar porta HTTPS ${HTTPS_PORT}:`, err.message);
      activeHttpsServer = null;
    });
  }
}

module.exports = app;
