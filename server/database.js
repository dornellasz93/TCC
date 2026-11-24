const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Configurable DB path for Docker volume persistence (/app/data/presenca_tcc.sqlite)
const defaultDbPath = path.join(__dirname, 'data', 'presenca_tcc.sqlite');
const dbPath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : defaultDbPath;

// Ensure parent directory exists
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

// Migrate legacy root DB if present and new path doesn't exist yet
const legacyDbPath = path.join(__dirname, 'presenca_tcc.sqlite');
if (!process.env.DB_PATH && !fs.existsSync(dbPath) && fs.existsSync(legacyDbPath)) {
  try {
    fs.copyFileSync(legacyDbPath, dbPath);
    console.log('📦 Banco SQLite legado migrado para server/data/presenca_tcc.sqlite');
  } catch (err) {
    console.warn('Aviso ao migrar banco legado:', err.message);
  }
}

const db = new Database(dbPath);
db.dbPath = dbPath;

db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

function safeAddColumn(table, colDef) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
  } catch (err) {
    // Column already exists
  }
}

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT CHECK(role IN ('student', 'teacher', 'admin')) NOT NULL DEFAULT 'student',
      registration_number TEXT UNIQUE NOT NULL,
      avatar_url TEXT,
      phone TEXT,
      face_registered INTEGER DEFAULT 0,
      face_reference_photo TEXT,
      face_signature TEXT,
      face_enrolled_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      block TEXT NOT NULL,
      campus TEXT NOT NULL DEFAULT 'Campus Volta Redonda - Aterrado (UGB)',
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      default_radius_meters INTEGER NOT NULL DEFAULT 35,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      teacher_id INTEGER NOT NULL,
      semester TEXT NOT NULL DEFAULT '2026/2',
      room_id INTEGER,
      color TEXT DEFAULT '#2563eb',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (teacher_id) REFERENCES users(id),
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    );

    CREATE TABLE IF NOT EXISTS course_students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(course_id, student_id),
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS class_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      room_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status_p1 TEXT CHECK(status_p1 IN ('open', 'closed')) NOT NULL DEFAULT 'open',
      status_p2 TEXT CHECK(status_p2 IN ('open', 'closed')) NOT NULL DEFAULT 'closed',
      p1_opened_at TEXT,
      p1_expires_at TEXT,
      p1_closed_at TEXT,
      p2_opened_at TEXT,
      p2_expires_at TEXT,
      p2_closed_at TEXT,
      custom_radius_meters INTEGER NOT NULL DEFAULT 35,
      biometric_threshold REAL NOT NULL DEFAULT 0.72,
      call_duration_minutes INTEGER NOT NULL DEFAULT 20,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id),
      FOREIGN KEY (teacher_id) REFERENCES users(id),
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    );

    CREATE TABLE IF NOT EXISTS attendances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      call_type INTEGER CHECK(call_type IN (1, 2)) NOT NULL,
      status TEXT CHECK(status IN ('present', 'absent', 'manual_approved')) NOT NULL DEFAULT 'present',
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      student_latitude REAL,
      student_longitude REAL,
      gps_accuracy_meters REAL,
      is_mock_location INTEGER DEFAULT 0,
      distance_meters REAL,
      liveness_passed INTEGER DEFAULT 1,
      liveness_challenge TEXT,
      face_match_score REAL DEFAULT 0.96,
      biometric_method TEXT DEFAULT 'hybrid_verified',
      processing_latency_ms INTEGER DEFAULT 0,
      photo_evidence TEXT,
      verification_hash TEXT UNIQUE,
      verification_code TEXT,
      ip_address TEXT,
      device_info TEXT,
      notes TEXT,
      UNIQUE(session_id, student_id, call_type),
      FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS liveness_challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      student_id INTEGER NOT NULL,
      session_id INTEGER NOT NULL,
      call_type INTEGER NOT NULL DEFAULT 1,
      challenge_type TEXT NOT NULL,
      challenge_label TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      distance_meters REAL,
      gps_accuracy_meters REAL,
      face_match_score REAL,
      is_mock_location INTEGER DEFAULT 0,
      latency_ms INTEGER,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Idempotent schema migrations for pre-existing databases
  safeAddColumn('users', 'face_reference_photo TEXT');
  safeAddColumn('users', 'face_signature TEXT');
  safeAddColumn('users', 'face_enrolled_at DATETIME');

  safeAddColumn('class_sessions', 'p1_opened_at TEXT');
  safeAddColumn('class_sessions', 'p1_expires_at TEXT');
  safeAddColumn('class_sessions', 'p1_closed_at TEXT');
  safeAddColumn('class_sessions', 'p2_opened_at TEXT');
  safeAddColumn('class_sessions', 'p2_expires_at TEXT');
  safeAddColumn('class_sessions', 'p2_closed_at TEXT');
  safeAddColumn('class_sessions', 'biometric_threshold REAL NOT NULL DEFAULT 0.72');
  safeAddColumn('class_sessions', 'call_duration_minutes INTEGER NOT NULL DEFAULT 20');

  safeAddColumn('attendances', 'gps_accuracy_meters REAL');
  safeAddColumn('attendances', 'is_mock_location INTEGER DEFAULT 0');
  safeAddColumn('attendances', 'liveness_challenge TEXT');
  safeAddColumn('attendances', 'biometric_method TEXT DEFAULT "hybrid_verified"');
  safeAddColumn('attendances', 'processing_latency_ms INTEGER DEFAULT 0');

  safeAddColumn('audit_logs', 'gps_accuracy_meters REAL');
  safeAddColumn('audit_logs', 'face_match_score REAL');
  safeAddColumn('audit_logs', 'is_mock_location INTEGER DEFAULT 0');
  safeAddColumn('audit_logs', 'latency_ms INTEGER');

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    seedDatabase();
  }
}

function seedDatabase() {
  console.log('🌱 Inicializando banco SQLite estruturado com 1ª/2ª Chamada, Biometria e Auditoria (UGB)...');

  const defaultPasswordHash = bcrypt.hashSync('123', 10);

  // 1. Rooms
  const insertRoom = db.prepare(`
    INSERT INTO rooms (name, code, block, campus, latitude, longitude, default_radius_meters, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const roomsData = [
    {
      name: 'Sala 204 - Engenharia de Software',
      code: 'SL-204-BLB',
      block: 'Bloco B',
      campus: 'Campus Volta Redonda - Aterrado (UGB)',
      latitude: -22.518605,
      longitude: -44.098485,
      radius: 35,
      desc: 'Sala de aula das disciplinas de Engenharia e TCC.'
    },
    {
      name: 'Laboratório de Informática 3 (Visão Computacional & IA)',
      code: 'LAB-03-BLC',
      block: 'Bloco C',
      campus: 'Campus Volta Redonda - Aterrado (UGB)',
      latitude: -22.518350,
      longitude: -44.098800,
      radius: 30,
      desc: 'Laboratório com computadores dedicados para testes biométricos.'
    },
    {
      name: 'Auditório Central Prof. Geraldo Di Biase',
      code: 'AUD-CENTRAL',
      block: 'Prédio Administrativo',
      campus: 'Campus Volta Redonda - Aterrado (UGB)',
      latitude: -22.518920,
      longitude: -44.098150,
      radius: 50,
      desc: 'Auditório de bancas de TCC e eventos acadêmicos.'
    }
  ];

  const roomIds = {};
  for (const r of roomsData) {
    const info = insertRoom.run(r.name, r.code, r.block, r.campus, r.latitude, r.longitude, r.radius, r.desc);
    roomIds[r.code] = info.lastInsertRowid;
  }

  // 2. Users (Docentes e Discentes)
  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password, role, registration_number, avatar_url, phone, face_registered)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const usersData = [
    {
      name: 'Prof. Dr. Geraldo Di Biase Filho',
      email: 'geraldo.dibiase@ugb.edu.br',
      role: 'teacher',
      registration: 'DOC-1001',
      avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
      phone: '(24) 99888-1100',
      faceRegistered: 0
    },
    {
      name: 'Profª. Me. Luciana Martins',
      email: 'luciana.martins@ugb.edu.br',
      role: 'teacher',
      registration: 'DOC-1002',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      phone: '(24) 99888-2200',
      faceRegistered: 0
    },
    {
      name: 'Pedro Henrique Teixeira Dornellas Soares de Souza',
      email: 'pedro.dornellas@ugb.edu.br',
      role: 'student',
      registration: '2024102278',
      avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
      phone: '(24) 99123-4567',
      faceRegistered: 0
    },
    {
      name: 'Pedro Gabriel da Costa Ribeiro',
      email: 'pedro.gabriel@ugb.edu.br',
      role: 'student',
      registration: '2024102279',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      phone: '(24) 99234-5678',
      faceRegistered: 0
    },
    {
      name: 'Julya Alcantara Ferreira',
      email: 'julya.alcantara@ugb.edu.br',
      role: 'student',
      registration: '2024102280',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      phone: '(24) 99345-6789',
      faceRegistered: 0
    },
    {
      name: 'Lucas Ferreira da Silva',
      email: 'lucas.silva@ugb.edu.br',
      role: 'student',
      registration: '2024102281',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      phone: '(24) 99456-7890',
      faceRegistered: 0
    },
    {
      name: 'Beatriz Santos Oliveira',
      email: 'beatriz.oliveira@ugb.edu.br',
      role: 'student',
      registration: '2024102282',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
      phone: '(24) 99567-8901',
      faceRegistered: 0
    }
  ];

  const userIds = {};
  for (const u of usersData) {
    const info = insertUser.run(
      u.name,
      u.email,
      defaultPasswordHash,
      u.role,
      u.registration,
      u.avatar,
      u.phone,
      u.faceRegistered
    );
    userIds[u.registration] = info.lastInsertRowid;
  }

  // 3. Courses
  const insertCourse = db.prepare(`
    INSERT INTO courses (name, code, description, teacher_id, semester, room_id, color)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const coursesData = [
    {
      name: 'Trabalho de Conclusão de Curso II',
      code: 'ENG-801',
      desc: 'Desenvolvimento e validação de protótipo de software acadêmico com IA e Geofencing.',
      teacherReg: 'DOC-1001',
      semester: '2026/2',
      roomCode: 'SL-204-BLB',
      color: '#3b82f6'
    },
    {
      name: 'Inteligência Artificial e Visão Computacional',
      code: 'ENG-702',
      desc: 'Processamento de imagens, redes neurais e reconhecimento facial com prova de vida.',
      teacherReg: 'DOC-1002',
      semester: '2026/2',
      roomCode: 'LAB-03-BLC',
      color: '#8b5cf6'
    },
    {
      name: 'Arquitetura e Engenharia de Software',
      code: 'ENG-603',
      desc: 'Padrões arquiteturais, containers Docker, segurança e engenharia de requisitos.',
      teacherReg: 'DOC-1001',
      semester: '2026/2',
      roomCode: 'AUD-CENTRAL',
      color: '#10b981'
    }
  ];

  const courseIds = {};
  for (const c of coursesData) {
    const info = insertCourse.run(
      c.name,
      c.code,
      c.desc,
      userIds[c.teacherReg],
      c.semester,
      roomIds[c.roomCode],
      c.color
    );
    courseIds[c.code] = info.lastInsertRowid;
  }

  // 4. Enroll Students
  const insertEnrollment = db.prepare(`
    INSERT OR IGNORE INTO course_students (course_id, student_id)
    VALUES (?, ?)
  `);

  const studentRegs = ['2024102278', '2024102279', '2024102280', '2024102281', '2024102282'];
  for (const cCode of Object.keys(courseIds)) {
    for (const sReg of studentRegs) {
      insertEnrollment.run(courseIds[cCode], userIds[sReg]);
    }
  }

  // 5. Class Sessions for Today
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const durationMinutes = Number(process.env.CALL_DURATION_MINUTES || 20);
  const p1OpenedAt = now.toISOString();
  const p1ExpiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000).toISOString();

  const insertSession = db.prepare(`
    INSERT INTO class_sessions (
      course_id, teacher_id, room_id, title, date, start_time, end_time,
      status_p1, status_p2, p1_opened_at, p1_expires_at, p1_closed_at,
      p2_opened_at, p2_expires_at, p2_closed_at, custom_radius_meters,
      biometric_threshold, call_duration_minutes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const activeSessionInfo = insertSession.run(
    courseIds['ENG-801'],
    userIds['DOC-1001'],
    roomIds['SL-204-BLB'],
    'Banca TCC: Validação de Geofencing, Anti-Mock e Biometria Facial',
    today,
    '19:00',
    '22:00',
    'open',
    'closed',
    p1OpenedAt,
    p1ExpiresAt,
    null,
    null,
    null,
    null,
    35,
    0.72,
    durationMinutes
  );

  insertSession.run(
    courseIds['ENG-702'],
    userIds['DOC-1002'],
    roomIds['LAB-03-BLC'],
    'Laboratório Prático: Prova de Vida (Liveness) e Visão Computacional',
    today,
    '19:00',
    '22:00',
    'closed',
    'closed',
    null,
    null,
    null,
    null,
    null,
    null,
    30,
    0.75,
    durationMinutes
  );

  // Sample Attendance + Audit Telemetry for initial dashboard richness
  const hash1 = crypto.createHash('sha256').update('p1-2024102279-' + Date.now()).digest('hex');
  db.prepare(`
    INSERT INTO attendances (
      session_id, student_id, call_type, status, student_latitude, student_longitude,
      gps_accuracy_meters, is_mock_location, distance_meters, liveness_passed,
      liveness_challenge, face_match_score, biometric_method, processing_latency_ms,
      verification_hash, verification_code, ip_address, device_info, notes
    ) VALUES (?, ?, 1, 'present', -22.518600, -44.098480, 6.5, 0, 1.2, 1, 'Pisque os olhos duas vezes', 0.964, 'biometric_verified', 42, ?, 'UGB-P1-20261', '192.168.1.45', 'React Native (Expo Go / Android)', '1ª Presença confirmada via GPS (Haversine) + Prova de Vida')
  `).run(activeSessionInfo.lastInsertRowid, userIds['2024102279'], hash1);

  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (user_id, action, status, distance_meters, gps_accuracy_meters, face_match_score, is_mock_location, latency_ms, details, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertAudit.run(
    userIds['2024102279'],
    'CHECKIN_P1_SUCCESS',
    'SUCCESS',
    1.2,
    6.5,
    0.964,
    0,
    42,
    '1ª Presença confirmada em Trabalho de Conclusão de Curso II (1.2m / Raio 35m | Face 96.4%)',
    '192.168.1.45'
  );
  insertAudit.run(
    userIds['2024102281'],
    'CHECKIN_P1_REJECTED_GEOFENCE',
    'BLOCKED',
    142.8,
    9.2,
    null,
    0,
    11,
    'Fraude bloqueada: tentativa de check-in na Portaria/Estacionamento (142.8m > 35m).',
    '192.168.1.88'
  );
  insertAudit.run(
    userIds['2024102282'],
    'CHECKIN_P1_REJECTED_MOCK_GPS',
    'BLOCKED',
    0.8,
    0,
    null,
    1,
    8,
    'Anti-Mock Location acionado: provedor de localização simulada (Fake GPS) detectado no aparelho.',
    '192.168.1.91'
  );

  console.log('✅ Banco SQLite inicializado com sucesso em:', dbPath);
}

function autoCloseExpiredSessions() {
  try {
    const nowIso = new Date().toISOString();

    db.prepare(`
      UPDATE class_sessions
      SET status_p1 = 'closed',
          p1_closed_at = COALESCE(p1_closed_at, p1_expires_at, ?)
      WHERE status_p1 = 'open'
        AND p1_expires_at IS NOT NULL
        AND p1_expires_at <= ?
    `).run(nowIso, nowIso);

    db.prepare(`
      UPDATE class_sessions
      SET status_p2 = 'closed',
          p2_closed_at = COALESCE(p2_closed_at, p2_expires_at, ?)
      WHERE status_p2 = 'open'
        AND p2_expires_at IS NOT NULL
        AND p2_expires_at <= ?
    `).run(nowIso, nowIso);

    // Prune expired unused liveness challenges older than 1 hour
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    db.prepare('DELETE FROM liveness_challenges WHERE expires_at < ?').run(cutoff);
  } catch (err) {
    console.error('Erro ao verificar sessões expiradas:', err);
  }
}

const expirationTimer = setInterval(autoCloseExpiredSessions, 5000);
if (typeof expirationTimer.unref === 'function') {
  expirationTimer.unref();
}

initDatabase();

db.autoCloseExpiredSessions = autoCloseExpiredSessions;
db.seedDatabase = seedDatabase;
module.exports = db;
