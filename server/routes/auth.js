const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database');
const { signToken, requireAuth, requireTeacher, requireAdmin } = require('../middleware/auth');
const { extractFaceDescriptor } = require('../biometrics');

function sanitizeUser(user) {
  if (!user) return null;
  const { password, face_signature, face_reference_photo, ...safe } = user;
  return {
    ...safe,
    face_registered: Boolean(user.face_registered && user.face_signature),
    has_reference_photo: Boolean(user.face_reference_photo)
  };
}

function verifyPassword(plain, stored) {
  if (!plain || !stored || typeof stored !== 'string') return false;
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
    return bcrypt.compareSync(plain, stored);
  }
  return false;
}

function isValidHttpsAvatarUrl(rawUrl) {
  if (rawUrl === undefined || rawUrl === null || rawUrl === '') return true;
  if (typeof rawUrl !== 'string' || rawUrl.length > 500) return false;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:') return false;
    if (parsed.username || parsed.password) return false;
    return true;
  } catch {
    return false;
  }
}

// GET /api/auth/me - Retorna o perfil autenticado pelo token JWT atual
router.get('/me', requireAuth, (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.authUser.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    }
    res.json({ success: true, user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/users - Lista apenas alunos vinculados ao docente autenticado (ou todos para admin)
router.get('/users', requireTeacher, (req, res) => {
  try {
    let rows;
    if (req.authUser.role === 'admin') {
      rows = db.prepare(`
        SELECT id, name, email, role, registration_number, avatar_url,
               face_registered, face_enrolled_at,
               CASE WHEN face_signature IS NOT NULL THEN 1 ELSE 0 END as has_signature,
               created_at
        FROM users
        ORDER BY role DESC, name ASC
      `).all();
    } else {
      rows = db.prepare(`
        SELECT DISTINCT u.id, u.name, u.email, u.role, u.registration_number, u.avatar_url,
               u.face_registered, u.face_enrolled_at,
               CASE WHEN u.face_signature IS NOT NULL THEN 1 ELSE 0 END as has_signature,
               u.created_at
        FROM users u
        LEFT JOIN course_students cs ON cs.student_id = u.id
        LEFT JOIN courses c ON cs.course_id = c.id
        WHERE u.id = ? OR c.teacher_id = ?
        ORDER BY u.role DESC, u.name ASC
      `).all(req.authUser.id, req.authUser.id);
    }

    const users = rows.map((u) => ({
      ...u,
      face_registered: Boolean(u.face_registered && u.has_signature)
    }));

    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/register - Cadastro público restrito exclusivamente a alunos (bloqueia autoatribuição docente/admin)
router.post('/register', (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role = 'student',
      registration_number,
      phone,
      avatar_url
    } = req.body;

    if (!name || !email || !password || !registration_number) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, preencha todos os campos obrigatórios (Nome, E-mail, Senha e Matrícula).'
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        error_code: 'WEAK_PASSWORD',
        message: 'A senha deve conter no mínimo 8 caracteres.'
      });
    }

    if (role !== 'student') {
      return res.status(403).json({
        success: false,
        error_code: 'ROLE_ESCALATION_FORBIDDEN',
        message: 'Cadastro público permitido apenas para perfil de Aluno. Contas docentes devem ser criadas pela administração.'
      });
    }

    if (!isValidHttpsAvatarUrl(avatar_url)) {
      return res.status(400).json({
        success: false,
        error_code: 'INVALID_AVATAR_URL',
        message: 'A URL do avatar deve utilizar protocolo HTTPS válido.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanReg = registration_number.trim();

    if (db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail)) {
      return res.status(409).json({
        success: false,
        message: 'Este e-mail já está cadastrado no sistema acadêmico.'
      });
    }

    if (db.prepare('SELECT id FROM users WHERE registration_number = ?').get(cleanReg)) {
      return res.status(409).json({
        success: false,
        message: 'Esta matrícula já está cadastrada no sistema.'
      });
    }

    const defaultAvatar = (avatar_url && avatar_url.trim()) ||
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';

    const hashedPassword = bcrypt.hashSync(String(password), 10);

    const result = db.prepare(`
      INSERT INTO users (name, email, password, role, registration_number, avatar_url, phone, face_registered)
      VALUES (?, ?, ?, 'student', ?, ?, ?, 0)
    `).run(
      name.trim(),
      cleanEmail,
      hashedPassword,
      cleanReg,
      defaultAvatar,
      phone ? phone.trim() : null
    );

    const newUserId = result.lastInsertRowid;

    // Matricula automaticamente o novo aluno nas disciplinas ativas
    const courses = db.prepare('SELECT id FROM courses').all();
    const insertEnrollment = db.prepare('INSERT OR IGNORE INTO course_students (course_id, student_id) VALUES (?, ?)');
    for (const c of courses) {
      insertEnrollment.run(c.id, newUserId);
    }

    const created = db.prepare('SELECT * FROM users WHERE id = ?').get(newUserId);
    const safeUser = sanitizeUser(created);
    const token = signToken(safeUser);

    res.status(201).json({
      success: true,
      message: 'Cadastro de Aluno(a) realizado com sucesso!',
      user: safeUser,
      token
    });
  } catch (err) {
    console.error('Erro no cadastro:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/register-teacher - Provisionamento exclusivo de docentes por administrador autenticado
router.post('/register-teacher', requireAdmin, (req, res) => {
  try {
    const { name, email, password, registration_number, phone, avatar_url } = req.body;
    if (!name || !email || !password || !registration_number || String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Informe nome, e-mail, matrícula e senha com no mínimo 8 caracteres.'
      });
    }
    if (!isValidHttpsAvatarUrl(avatar_url)) {
      return res.status(400).json({ success: false, message: 'URL de avatar inválida (exige HTTPS).' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanReg = registration_number.trim();
    if (db.prepare('SELECT id FROM users WHERE email = ? OR registration_number = ?').get(cleanEmail, cleanReg)) {
      return res.status(409).json({ success: false, message: 'E-mail ou matrícula já cadastrados.' });
    }

    const defaultAvatar = (avatar_url && avatar_url.trim()) ||
      'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80';
    const hashedPassword = bcrypt.hashSync(String(password), 10);

    const result = db.prepare(`
      INSERT INTO users (name, email, password, role, registration_number, avatar_url, phone, face_registered)
      VALUES (?, ?, ?, 'teacher', ?, ?, ?, 0)
    `).run(name.trim(), cleanEmail, hashedPassword, cleanReg, defaultAvatar, phone ? phone.trim() : null);

    const created = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, message: 'Docente cadastrado com sucesso!', user: sanitizeUser(created) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { login, password, expectedRole } = req.body;
    if (!login || !password) {
      return res.status(400).json({ success: false, message: 'Informe a matrícula/e-mail e a senha.' });
    }

    const user = db.prepare(`
      SELECT * FROM users
      WHERE email = ? OR registration_number = ?
    `).get(login.trim().toLowerCase(), login.trim());

    if (!user || !verifyPassword(String(password), user.password)) {
      return res.status(401).json({ success: false, message: 'Credenciais inválidas. Verifique matrícula/e-mail e senha.' });
    }

    if (expectedRole && user.role !== expectedRole && user.role !== 'admin') {
      const roleLabel = expectedRole === 'teacher' ? 'Professor' : 'Aluno';
      const userRoleLabel = user.role === 'teacher' ? 'Professor' : 'Aluno';
      return res.status(403).json({
        success: false,
        message: `Este perfil está cadastrado como "${userRoleLabel}", mas você selecionou a aba de "${roleLabel}".`
      });
    }

    const safeUser = sanitizeUser(user);
    const token = signToken(safeUser);

    res.json({
      success: true,
      message: `Bem-vindo(a), ${user.name}! Autenticação JWT concluída.`,
      user: safeUser,
      token
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/demo-login - Bloqueado em produção; exige flag explícita ENABLE_DEMO_LOGIN=true fora de produção
router.post('/demo-login', (req, res) => {
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DEMO_LOGIN !== 'true') {
    return res.status(403).json({
      success: false,
      error_code: 'DEMO_LOGIN_DISABLED',
      message: 'Login rápido sem senha está desativado neste ambiente por política de segurança.'
    });
  }

  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'ID do usuário de demonstração não informado.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuário demo não encontrado.' });
    }

    const safeUser = sanitizeUser(user);
    const token = signToken(safeUser);

    res.json({
      success: true,
      message: `Perfil demo alterado para ${user.name}.`,
      user: safeUser,
      token
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/enroll-face - Cadastra assinatura biométrica facial real no SQLite
router.post('/enroll-face', requireAuth, (req, res) => {
  try {
    const { photo_base64 } = req.body;
    const userId = req.authUser.id;

    if (!photo_base64 || typeof photo_base64 !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Foto facial em formato JPEG base64 é obrigatória para o cadastro biométrico.'
      });
    }

    const descriptor = extractFaceDescriptor(photo_base64);
    if (!descriptor) {
      return res.status(400).json({
        success: false,
        message: 'Não foi possível extrair o vetor facial da imagem enviada. Certifique-se de capturar uma foto JPEG pela câmera.'
      });
    }

    const nowIso = new Date().toISOString();
    db.prepare(`
      UPDATE users
      SET face_reference_photo = ?,
          face_signature = ?,
          face_registered = 1,
          face_enrolled_at = ?
      WHERE id = ?
    `).run(photo_base64, JSON.stringify(descriptor), nowIso, userId);

    const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, status, details, ip_address)
      VALUES (?, 'BIOMETRIC_FACE_ENROLLED', 'SUCCESS', ?, ?)
    `).run(
      userId,
      `Vetor biométrico facial (${descriptor.length} dimensões) cadastrado no banco SQLite com sucesso.`,
      clientIp
    );

    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

    res.json({
      success: true,
      message: 'Biometria facial cadastrada com sucesso! Suas próximas presenças serão comparadas diretamente com este perfil.',
      descriptorDimensions: descriptor.length,
      user: sanitizeUser(updatedUser)
    });
  } catch (err) {
    console.error('Erro ao cadastrar biometria facial:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/user/:id - Protegido com autenticação e validação de posse/vínculo (anti-IDOR)
router.get('/user/:id', requireAuth, (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId)) {
      return res.status(400).json({ success: false, message: 'ID de usuário inválido.' });
    }

    const isSelf = req.authUser.id === targetId;
    const isAdmin = req.authUser.role === 'admin';
    let isTeacherOfStudent = false;
    if (req.authUser.role === 'teacher' && !isSelf) {
      const link = db.prepare(`
        SELECT 1
        FROM course_students cs
        JOIN courses c ON cs.course_id = c.id
        WHERE cs.student_id = ? AND c.teacher_id = ?
        LIMIT 1
      `).get(targetId, req.authUser.id);
      isTeacherOfStudent = Boolean(link);
    }

    if (!isSelf && !isAdmin && !isTeacherOfStudent) {
      return res.status(403).json({
        success: false,
        error_code: 'FORBIDDEN_OBJECT_ACCESS',
        message: 'Você não tem permissão para consultar dados deste usuário.'
      });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    }

    let enrolledCourses = [];
    if (user.role === 'student') {
      enrolledCourses = db.prepare(`
        SELECT c.*, u.name as teacher_name, r.name as room_name, r.block as room_block
        FROM course_students cs
        JOIN courses c ON cs.course_id = c.id
        JOIN users u ON c.teacher_id = u.id
        LEFT JOIN rooms r ON c.room_id = r.id
        WHERE cs.student_id = ?
      `).all(user.id);
    } else if (user.role === 'teacher') {
      enrolledCourses = db.prepare(`
        SELECT c.*, r.name as room_name, r.block as room_block
        FROM courses c
        LEFT JOIN rooms r ON c.room_id = r.id
        WHERE c.teacher_id = ?
      `).all(user.id);
    }

    res.json({ success: true, user: sanitizeUser(user), courses: enrolledCourses });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
