const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAuth, requireTeacher } = require('../middleware/auth');

const SESSION_SELECT = `
  SELECT
    s.*,
    c.name as course_name,
    c.code as course_code,
    c.color as course_color,
    u.name as teacher_name,
    r.name as room_name,
    r.code as room_code,
    r.block as room_block,
    r.campus as room_campus,
    r.latitude as room_latitude,
    r.longitude as room_longitude,
    (SELECT COUNT(*) FROM course_students cs WHERE cs.course_id = s.course_id) as total_students,
    (SELECT COUNT(DISTINCT student_id) FROM attendances a WHERE a.session_id = s.id AND a.call_type = 1 AND a.status IN ('present', 'manual_approved')) as p1_count,
    (SELECT COUNT(DISTINCT student_id) FROM attendances a WHERE a.session_id = s.id AND a.call_type = 2 AND a.status IN ('present', 'manual_approved')) as p2_count
  FROM class_sessions s
  JOIN courses c ON s.course_id = c.id
  JOIN users u ON s.teacher_id = u.id
  JOIN rooms r ON s.room_id = r.id
`;

// GET /api/sessions - Lista sessões estritamente filtradas pelo usuário autenticado (anti-IDOR e isolamento)
router.get('/', requireAuth, (req, res) => {
  try {
    if (typeof db.autoCloseExpiredSessions === 'function') {
      db.autoCloseExpiredSessions();
    }

    const { id: authUserId, role: authRole } = req.authUser;
    let sessions = [];

    if (authRole === 'student') {
      sessions = db.prepare(`
        ${SESSION_SELECT}
        JOIN course_students cs_rel ON cs_rel.course_id = s.course_id AND cs_rel.student_id = ?
        WHERE s.id IN (
          SELECT MAX(id) FROM class_sessions GROUP BY course_id
        )
        ORDER BY s.id DESC
      `).all(authUserId);

      const studentAttendances = db.prepare(`
        SELECT session_id, call_type, status, recorded_at, distance_meters,
               face_match_score, biometric_method, processing_latency_ms,
               verification_code, verification_hash
        FROM attendances
        WHERE student_id = ?
      `).all(authUserId);

      const attendanceMap = new Map();
      for (const a of studentAttendances) {
        if (!attendanceMap.has(a.session_id)) attendanceMap.set(a.session_id, {});
        if (a.call_type === 1) attendanceMap.get(a.session_id).p1 = a;
        if (a.call_type === 2) attendanceMap.get(a.session_id).p2 = a;
      }

      for (const s of sessions) {
        s.student_p1 = attendanceMap.get(s.id)?.p1 || null;
        s.student_p2 = attendanceMap.get(s.id)?.p2 || null;
      }
    } else if (authRole === 'teacher') {
      sessions = db.prepare(`
        ${SESSION_SELECT}
        WHERE s.teacher_id = ?
        ORDER BY s.id DESC
      `).all(authUserId);
    } else {
      sessions = db.prepare(`
        ${SESSION_SELECT}
        ORDER BY s.id DESC
      `).all();
    }

    res.json({ success: true, sessions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sessions/:id - Detalhes da sessão (restrito ao docente titular; sem vazar photo_evidence em Base64)
router.get('/:id', requireTeacher, (req, res) => {
  try {
    if (typeof db.autoCloseExpiredSessions === 'function') {
      db.autoCloseExpiredSessions();
    }

    const sessionId = Number(req.params.id);
    if (!Number.isInteger(sessionId)) {
      return res.status(400).json({ success: false, message: 'ID de sessão inválido.' });
    }

    const session = db.prepare(`
      SELECT
        s.*,
        c.name as course_name,
        c.code as course_code,
        c.color as course_color,
        u.name as teacher_name,
        r.name as room_name,
        r.code as room_code,
        r.block as room_block,
        r.campus as room_campus,
        r.latitude as room_latitude,
        r.longitude as room_longitude
      FROM class_sessions s
      JOIN courses c ON s.course_id = c.id
      JOIN users u ON s.teacher_id = u.id
      JOIN rooms r ON s.room_id = r.id
      WHERE s.id = ?
    `).get(sessionId);

    if (!session) {
      return res.status(404).json({ success: false, message: 'Sessão de aula não encontrada.' });
    }

    if (req.authUser.role !== 'admin' && session.teacher_id !== req.authUser.id) {
      return res.status(403).json({
        success: false,
        error_code: 'FORBIDDEN_SESSION_ACCESS',
        message: 'Acesso negado: esta sessão pertence a outro docente.'
      });
    }

    const students = db.prepare(`
      SELECT u.id, u.name, u.registration_number, u.email, u.avatar_url,
             CASE WHEN u.face_signature IS NOT NULL THEN 1 ELSE 0 END as face_enrolled
      FROM course_students cs
      JOIN users u ON cs.student_id = u.id
      WHERE cs.course_id = ?
      ORDER BY u.name ASC
    `).all(session.course_id);

    // Seleciona apenas metadados de presença — omite photo_evidence (Base64 biométrico) e coordenadas cruas
    const attendances = db.prepare(`
      SELECT student_id, call_type, status, recorded_at, distance_meters,
             face_match_score, biometric_method, verification_code, verification_hash
      FROM attendances
      WHERE session_id = ?
    `).all(sessionId);

    const attendanceMap = new Map();
    for (const a of attendances) {
      attendanceMap.set(`${a.student_id}_${a.call_type}`, a);
    }

    const studentList = students.map((st) => {
      const p1 = attendanceMap.get(`${st.id}_1`) || null;
      const p2 = attendanceMap.get(`${st.id}_2`) || null;
      return {
        ...st,
        p1_status: p1 ? p1.status : 'absent',
        p1_recorded_at: p1?.recorded_at || null,
        p1_distance: p1?.distance_meters ?? null,
        p1_face_score: p1?.face_match_score ?? null,
        p1_method: p1?.biometric_method || null,
        p1_code: p1?.verification_code || null,
        p1_hash: p1?.verification_hash || null,
        p2_status: p2 ? p2.status : 'absent',
        p2_recorded_at: p2?.recorded_at || null,
        p2_distance: p2?.distance_meters ?? null,
        p2_face_score: p2?.face_match_score ?? null,
        p2_method: p2?.biometric_method || null,
        p2_code: p2?.verification_code || null,
        p2_hash: p2?.verification_hash || null
      };
    });

    const p1PresentCount = studentList.filter((s) => s.p1_status === 'present' || s.p1_status === 'manual_approved').length;
    const p2PresentCount = studentList.filter((s) => s.p2_status === 'present' || s.p2_status === 'manual_approved').length;
    const totalStudents = studentList.length;

    res.json({
      success: true,
      session,
      students: studentList,
      stats: {
        totalStudents,
        p1PresentCount,
        p2PresentCount,
        p1Percentage: totalStudents > 0 ? Math.round((p1PresentCount / totalStudents) * 100) : 0,
        p2Percentage: totalStudents > 0 ? Math.round((p2PresentCount / totalStudents) * 100) : 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sessions - Professor abre uma nova aula apenas em disciplinas de sua titularidade
router.post('/', requireTeacher, (req, res) => {
  try {
    const {
      course_id,
      room_id,
      title,
      custom_radius_meters,
      biometric_threshold = 0.72,
      call_duration_minutes = 20,
      open_p1 = false
    } = req.body;

    const course = db.prepare('SELECT id, name, teacher_id, room_id FROM courses WHERE id = ?').get(course_id);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Disciplina não encontrada.' });
    }
    if (req.authUser.role !== 'admin' && course.teacher_id !== req.authUser.id) {
      return res.status(403).json({
        success: false,
        error_code: 'FORBIDDEN_COURSE_ACCESS',
        message: 'Você não tem permissão para abrir aulas em disciplinas de outro docente.'
      });
    }

    const teacher_id = req.authUser.id;
    const effectiveRoomId = room_id || course.room_id || db.prepare('SELECT id FROM rooms ORDER BY id ASC LIMIT 1').get()?.id;
    const room = db.prepare('SELECT id, default_radius_meters FROM rooms WHERE id = ?').get(effectiveRoomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Sala não encontrada.' });
    }

    const radius = Number(custom_radius_meters) || room.default_radius_meters || 35;
    const duration = Math.max(1, Math.min(120, Number(call_duration_minutes) || 20));
    const threshold = Math.max(0.5, Math.min(0.98, Number(biometric_threshold) || 0.72));

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const startTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const endHour = new Date(now.getTime() + 1000 * 60 * 60 * 3);
    const endTime = `${String(endHour.getHours()).padStart(2, '0')}:${String(endHour.getMinutes()).padStart(2, '0')}`;

    const shouldOpenP1 = Boolean(open_p1);
    const statusP1 = shouldOpenP1 ? 'open' : 'closed';
    const p1OpenedAt = shouldOpenP1 ? now.toISOString() : null;
    const p1ExpiresAt = shouldOpenP1 ? new Date(now.getTime() + duration * 60 * 1000).toISOString() : null;

    const result = db.prepare(`
      INSERT INTO class_sessions (
        course_id, teacher_id, room_id, title, date, start_time, end_time,
        status_p1, status_p2, p1_opened_at, p1_expires_at, p1_closed_at,
        p2_opened_at, p2_expires_at, p2_closed_at, custom_radius_meters,
        biometric_threshold, call_duration_minutes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'closed', ?, ?, NULL, NULL, NULL, NULL, ?, ?, ?)
    `).run(
      course_id,
      teacher_id,
      room.id,
      title || `Aula — ${course.name}`,
      today,
      startTime,
      endTime,
      statusP1,
      p1OpenedAt,
      p1ExpiresAt,
      radius,
      threshold,
      duration
    );

    res.status(201).json({
      success: true,
      message: shouldOpenP1
        ? `Aula iniciada com sucesso! 1ª Presença aberta por ${duration} minutos.`
        : `Sessão preparada para "${course.name}" (chamadas fechadas, prontas para abertura).`,
      sessionId: result.lastInsertRowid,
      status_p1: statusP1,
      p1_opened_at: p1OpenedAt,
      p1_expires_at: p1ExpiresAt
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/sessions/:id/config - Apenas docente titular da sessão
router.patch('/:id/config', requireTeacher, (req, res) => {
  try {
    const sessionId = Number(req.params.id);
    const { custom_radius_meters, biometric_threshold } = req.body;

    const session = db.prepare('SELECT * FROM class_sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Sessão não encontrada.' });
    }
    if (req.authUser.role !== 'admin' && session.teacher_id !== req.authUser.id) {
      return res.status(403).json({
        success: false,
        error_code: 'FORBIDDEN_SESSION_ACCESS',
        message: 'Apenas o docente titular pode configurar esta sessão.'
      });
    }

    const newRadius = custom_radius_meters !== undefined
      ? Math.max(5, Math.min(500, Number(custom_radius_meters)))
      : session.custom_radius_meters;
    const newThreshold = biometric_threshold !== undefined
      ? Math.max(0.5, Math.min(0.98, Number(biometric_threshold)))
      : session.biometric_threshold;

    db.prepare(`
      UPDATE class_sessions
      SET custom_radius_meters = ?, biometric_threshold = ?
      WHERE id = ?
    `).run(newRadius, newThreshold, sessionId);

    res.json({
      success: true,
      message: `Parâmetros atualizados: Raio GPS ${newRadius}m | Limiar Biométrico ${Math.round(newThreshold * 100)}%.`,
      custom_radius_meters: newRadius,
      biometric_threshold: newThreshold
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/sessions/:id/toggle-p1 - Apenas docente titular da sessão
router.patch('/:id/toggle-p1', requireTeacher, (req, res) => {
  try {
    if (typeof db.autoCloseExpiredSessions === 'function') {
      db.autoCloseExpiredSessions();
    }

    const sessionId = Number(req.params.id);
    const session = db.prepare('SELECT * FROM class_sessions WHERE id = ?').get(sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Sessão não encontrada.' });
    if (req.authUser.role !== 'admin' && session.teacher_id !== req.authUser.id) {
      return res.status(403).json({
        success: false,
        error_code: 'FORBIDDEN_SESSION_ACCESS',
        message: 'Apenas o docente titular pode abrir ou encerrar esta chamada.'
      });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const durationMin = session.call_duration_minutes || 20;

    if (session.status_p1 === 'closed') {
      const p1ExpiresAt = new Date(now.getTime() + durationMin * 60 * 1000).toISOString();
      db.prepare(`
        UPDATE class_sessions
        SET status_p1 = 'open', p1_opened_at = ?, p1_expires_at = ?, p1_closed_at = NULL
        WHERE id = ?
      `).run(nowIso, p1ExpiresAt, sessionId);

      return res.json({
        success: true,
        status_p1: 'open',
        p1_opened_at: nowIso,
        p1_expires_at: p1ExpiresAt,
        p1_closed_at: null,
        message: `1ª Presença ABERTA! Os alunos têm ${durationMin} minutos para registrar presença.`
      });
    } else {
      db.prepare(`
        UPDATE class_sessions
        SET status_p1 = 'closed', p1_closed_at = ?
        WHERE id = ?
      `).run(nowIso, sessionId);

      return res.json({
        success: true,
        status_p1: 'closed',
        p1_closed_at: nowIso,
        message: '1ª Presença ENCERRADA com sucesso.'
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/sessions/:id/toggle-p2 - Apenas docente titular da sessão
router.patch('/:id/toggle-p2', requireTeacher, (req, res) => {
  try {
    if (typeof db.autoCloseExpiredSessions === 'function') {
      db.autoCloseExpiredSessions();
    }

    const sessionId = Number(req.params.id);
    const session = db.prepare('SELECT * FROM class_sessions WHERE id = ?').get(sessionId);
    if (!session) return res.status(404).json({ success: false, message: 'Sessão não encontrada.' });
    if (req.authUser.role !== 'admin' && session.teacher_id !== req.authUser.id) {
      return res.status(403).json({
        success: false,
        error_code: 'FORBIDDEN_SESSION_ACCESS',
        message: 'Apenas o docente titular pode abrir ou encerrar esta chamada.'
      });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const durationMin = session.call_duration_minutes || 20;

    if (session.status_p2 === 'closed') {
      if (!session.p1_opened_at) {
        return res.status(400).json({
          success: false,
          message: 'A 2ª presença não pode ser aberta porque a 1ª presença precisa ser aberta no início da aula primeiro.'
        });
      }

      if (session.status_p1 === 'open') {
        return res.status(400).json({
          success: false,
          message: 'A 2ª presença não pode ser aberta enquanto a 1ª presença ainda estiver aberta.'
        });
      }

      const p2ExpiresAt = new Date(now.getTime() + durationMin * 60 * 1000).toISOString();
      db.prepare(`
        UPDATE class_sessions
        SET status_p2 = 'open', p2_opened_at = ?, p2_expires_at = ?, p2_closed_at = NULL
        WHERE id = ?
      `).run(nowIso, p2ExpiresAt, sessionId);

      return res.json({
        success: true,
        status_p2: 'open',
        p2_opened_at: nowIso,
        p2_expires_at: p2ExpiresAt,
        p2_closed_at: null,
        message: `2ª Presença ABERTA! Os alunos têm ${durationMin} minutos para registrar a presença final.`
      });
    } else {
      db.prepare(`
        UPDATE class_sessions
        SET status_p2 = 'closed', p2_closed_at = ?
        WHERE id = ?
      `).run(nowIso, sessionId);

      return res.json({
        success: true,
        status_p2: 'closed',
        p2_closed_at: nowIso,
        message: '2ª Presença ENCERRADA com sucesso.'
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
