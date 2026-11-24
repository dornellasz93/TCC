const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || '0.0.0.0';
const clientDistPath = process.env.CLIENT_DIST_PATH
  ? path.resolve(process.env.CLIENT_DIST_PATH)
  : path.join(__dirname, '..', 'client', 'dist');

// Security & CORS middlewares
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false
}));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser with 50mb limit for high-res smartphone facial captures + 2-frame liveness pairs
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request telemetry logger
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

// Initialize SQLite database
const db = require('./database');

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/rooms', require('./routes/rooms'));
app.use('/api/analytics', require('./routes/analytics'));

// Health check endpoint (used by Docker HEALTHCHECK & Mobile Server Tester)
app.get('/api/health', (req, res) => {
  try {
    const counts = db.prepare('SELECT (SELECT COUNT(*) FROM users) as users, (SELECT COUNT(*) FROM class_sessions) as sessions').get();
    res.json({
      status: 'online',
      version: '2.0.0',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
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

// Serve Web Portal build (Docker production & local build)
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
}

// API 404 & SPA fallback
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
  app.listen(PORT, HOST, () => {
    console.log(`
========================================================================
🎓 UGB PRESENÇA — SERVIDOR DO PROTÓTIPO DE TCC (v2.0)
📡 Escutando em: http://${HOST}:${PORT}
🩺 Healthcheck:  http://localhost:${PORT}/api/health
🗄️  Banco SQLite: ${db.dbPath}
🔒 Geofencing (Haversine) + Anti-Mock Location + Biometria Facial Ativos
========================================================================
    `);
  });
}

module.exports = app;
