const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireTeacher } = require('../middleware/auth');

/**
 * Mitiga CSV Formula Injection (DDE / Excel / LibreOffice) prefixando apóstrofo simples
 * em células que comecem por '=', '+', '-', '@', tabulação ou retorno de carro.
 */
function sanitizeCsvCell(rawValue) {
  let str = String(rawValue ?? '');
  if (/^[\s]*[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

// GET /api/analytics/dashboard - Protegido com requireTeacher e filtrado por escopo do docente
router.get('/dashboard', requireTeacher, (req, res) => {
  try {
    const isAdmin = req.authUser.role === 'admin';
    const teacherId = req.authUser.id;

    const totalStudents = isAdmin
      ? db.prepare(`SELECT COUNT(*) as count FROM users WHERE role = 'student'`).get().count
      : db.prepare(`
          SELECT COUNT(DISTINCT cs.student_id) as count
          FROM course_students cs
          JOIN courses c ON cs.course_id = c.id
          WHERE c.teacher_id = ?
        `).get(teacherId).count;

    const totalTeachers = isAdmin
      ? db.prepare(`SELECT COUNT(*) as count FROM users WHERE role = 'teacher'`).get().count
      : 1;

    const totalCourses = isAdmin
      ? db.prepare(`SELECT COUNT(*) as count FROM courses`).get().count
      : db.prepare(`SELECT COUNT(*) as count FROM courses WHERE teacher_id = ?`).get(teacherId).count;

    const totalSessions = isAdmin
      ? db.prepare(`SELECT COUNT(*) as count FROM class_sessions`).get().count
      : db.prepare(`SELECT COUNT(*) as count FROM class_sessions WHERE teacher_id = ?`).get(teacherId).count;

    const totalAttendances = isAdmin
      ? db.prepare(`SELECT COUNT(*) as count FROM attendances WHERE status IN ('present', 'manual_approved')`).get().count
      : db.prepare(`
          SELECT COUNT(*) as count
          FROM attendances a
          JOIN class_sessions s ON a.session_id = s.id
          WHERE s.teacher_id = ? AND a.status IN ('present', 'manual_approved')
        `).get(teacherId).count;

    const auditScopeClause = isAdmin
      ? ''
      : `AND (
          user_id = ?
          OR user_id IN (
            SELECT cs.student_id FROM course_students cs
            JOIN courses c ON cs.course_id = c.id
            WHERE c.teacher_id = ?
          )
        )`;
    const auditParams = isAdmin ? [] : [teacherId, teacherId];

    const blockedFraudAttempts = db.prepare(
      `SELECT COUNT(*) as count FROM audit_logs WHERE status = 'BLOCKED' ${auditScopeClause}`
    ).get(...auditParams).count;

    const blockedGeofenceAttempts = db.prepare(
      `SELECT COUNT(*) as count FROM audit_logs WHERE status = 'BLOCKED' AND action LIKE '%GEOFENCE%' ${auditScopeClause}`
    ).get(...auditParams).count;

    const blockedMockGpsAttempts = db.prepare(
      `SELECT COUNT(*) as count FROM audit_logs WHERE status = 'BLOCKED' AND (action LIKE '%MOCK%' OR is_mock_location = 1) ${auditScopeClause}`
    ).get(...auditParams).count;

    const blockedBiometricAttempts = db.prepare(
      `SELECT COUNT(*) as count FROM audit_logs WHERE status = 'BLOCKED' AND (action LIKE '%BIOMETRIC%' OR action LIKE '%LIVENESS%') ${auditScopeClause}`
    ).get(...auditParams).count;

    const avgDistance = isAdmin
      ? db.prepare(`
          SELECT AVG(distance_meters) as avg_dist, MIN(distance_meters) as min_dist, MAX(distance_meters) as max_dist
          FROM attendances WHERE status = 'present' AND distance_meters IS NOT NULL
        `).get()
      : db.prepare(`
          SELECT AVG(a.distance_meters) as avg_dist, MIN(a.distance_meters) as min_dist, MAX(a.distance_meters) as max_dist
          FROM attendances a JOIN class_sessions s ON a.session_id = s.id
          WHERE s.teacher_id = ? AND a.status = 'present' AND a.distance_meters IS NOT NULL
        `).get(teacherId);

    const avgGpsAccuracy = isAdmin
      ? db.prepare(`
          SELECT AVG(gps_accuracy_meters) as avg_acc
          FROM attendances WHERE status = 'present' AND gps_accuracy_meters IS NOT NULL AND gps_accuracy_meters > 0
        `).get()
      : db.prepare(`
          SELECT AVG(a.gps_accuracy_meters) as avg_acc
          FROM attendances a JOIN class_sessions s ON a.session_id = s.id
          WHERE s.teacher_id = ? AND a.status = 'present' AND a.gps_accuracy_meters IS NOT NULL AND a.gps_accuracy_meters > 0
        `).get(teacherId);

    const avgBiometricScore = isAdmin
      ? db.prepare(`
          SELECT AVG(face_match_score) as avg_score
          FROM attendances WHERE status = 'present' AND face_match_score IS NOT NULL
        `).get()
      : db.prepare(`
          SELECT AVG(a.face_match_score) as avg_score
          FROM attendances a JOIN class_sessions s ON a.session_id = s.id
          WHERE s.teacher_id = ? AND a.status = 'present' AND a.face_match_score IS NOT NULL
        `).get(teacherId);

    const bioSuccessCount = isAdmin
      ? db.prepare(`SELECT COUNT(*) as count FROM attendances WHERE status = 'present'`).get().count
      : db.prepare(`
          SELECT COUNT(*) as count
          FROM attendances a JOIN class_sessions s ON a.session_id = s.id
          WHERE s.teacher_id = ? AND a.status = 'present'
        `).get(teacherId).count;

    const bioTotalAttempts = bioSuccessCount + blockedBiometricAttempts;
    const faceMatchSuccessRate = bioTotalAttempts > 0
      ? Math.round((bioSuccessCount / bioTotalAttempts) * 1000) / 10
      : 100;

    const latencyStats = db.prepare(`
      SELECT AVG(latency_ms) as avg_ms
      FROM audit_logs
      WHERE latency_ms IS NOT NULL AND latency_ms > 0 ${auditScopeClause}
    `).get(...auditParams);

    const estimatedTimeSavedMinutes = Math.round(totalSessions * 7.5 * 10) / 10;

    // Feed recente de auditoria filtrado pelo escopo do docente (sem vazar IP bruto se não for admin)
    const recentLogs = db.prepare(`
      SELECT l.id, l.user_id, l.action, l.status, l.distance_meters, l.gps_accuracy_meters,
             l.face_match_score, l.is_mock_location, l.latency_ms, l.details, l.created_at,
             u.name as user_name, u.role as user_role, u.registration_number
      FROM audit_logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE 1=1 ${auditScopeClause.replace(/user_id/g, 'l.user_id')}
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT 30
    `).all(...auditParams);

    const recentAttendances = isAdmin
      ? db.prepare(`
          SELECT a.id, a.session_id, a.student_id, a.call_type, a.status, a.recorded_at,
                 a.distance_meters, a.gps_accuracy_meters, a.face_match_score, a.biometric_method,
                 a.processing_latency_ms, a.verification_code, a.verification_hash,
                 u.name as student_name, u.registration_number, c.name as course_name, r.name as room_name
          FROM attendances a
          JOIN users u ON a.student_id = u.id
          JOIN class_sessions s ON a.session_id = s.id
          JOIN courses c ON s.course_id = c.id
          JOIN rooms r ON s.room_id = r.id
          ORDER BY a.recorded_at DESC
          LIMIT 10
        `).all()
      : db.prepare(`
          SELECT a.id, a.session_id, a.student_id, a.call_type, a.status, a.recorded_at,
                 a.distance_meters, a.gps_accuracy_meters, a.face_match_score, a.biometric_method,
                 a.processing_latency_ms, a.verification_code, a.verification_hash,
                 u.name as student_name, u.registration_number, c.name as course_name, r.name as room_name
          FROM attendances a
          JOIN users u ON a.student_id = u.id
          JOIN class_sessions s ON a.session_id = s.id
          JOIN courses c ON s.course_id = c.id
          JOIN rooms r ON s.room_id = r.id
          WHERE s.teacher_id = ?
          ORDER BY a.recorded_at DESC
          LIMIT 10
        `).all(teacherId);

    res.json({
      success: true,
      metrics: {
        totalStudents,
        totalTeachers,
        totalCourses,
        totalSessions,
        totalAttendances,
        blockedFraudAttempts,
        blockedGeofenceAttempts,
        blockedMockGpsAttempts,
        blockedBiometricAttempts,
        avgDistanceMeters: avgDistance?.avg_dist !== null && avgDistance?.avg_dist !== undefined
          ? Math.round(avgDistance.avg_dist * 10) / 10
          : 0,
        minDistanceMeters: avgDistance?.min_dist ?? 0,
        maxDistanceMeters: avgDistance?.max_dist ?? 0,
        avgGpsAccuracyMeters: avgGpsAccuracy?.avg_acc ? Math.round(avgGpsAccuracy.avg_acc * 10) / 10 : 0,
        avgBiometricConfidence: avgBiometricScore?.avg_score ? Math.round(avgBiometricScore.avg_score * 1000) / 10 : 0,
        faceMatchSuccessRate,
        avgLatencyMs: latencyStats?.avg_ms ? Math.round(latencyStats.avg_ms) : 0,
        estimatedTimeSavedMinutes
      },
      recentLogs,
      recentAttendances
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/analytics/export/:sessionId - Protegido com requireTeacher, titularidade e proteção anti-CSV Injection
router.get('/export/:sessionId', requireTeacher, (req, res) => {
  try {
    const sessionId = Number(req.params.sessionId);
    if (!Number.isInteger(sessionId)) {
      return res.status(400).json({ success: false, message: 'ID de sessão inválido.' });
    }

    const session = db.prepare(`
      SELECT s.*, c.name as course_name, c.code as course_code, u.name as teacher_name, r.name as room_name
      FROM class_sessions s
      JOIN courses c ON s.course_id = c.id
      JOIN users u ON s.teacher_id = u.id
      JOIN rooms r ON s.room_id = r.id
      WHERE s.id = ?
    `).get(sessionId);

    if (!session) {
      return res.status(404).json({ success: false, message: 'Sessão não encontrada.' });
    }

    if (req.authUser.role !== 'admin' && session.teacher_id !== req.authUser.id) {
      return res.status(403).json({
        success: false,
        error_code: 'FORBIDDEN_EXPORT',
        message: 'Apenas o docente titular pode exportar a frequência desta sessão.'
      });
    }

    const students = db.prepare(`
      SELECT u.id, u.registration_number, u.name, u.email
      FROM course_students cs
      JOIN users u ON cs.student_id = u.id
      WHERE cs.course_id = ?
      ORDER BY u.name ASC
    `).all(session.course_id);

    const attendances = db.prepare(`
      SELECT student_id, call_type, status, recorded_at, distance_meters, face_match_score, verification_code
      FROM attendances
      WHERE session_id = ?
    `).all(sessionId);

    const map = new Map();
    for (const a of attendances) {
      map.set(`${a.student_id}_${a.call_type}`, a);
    }

    const rows = students.map((st) => {
      const p1 = map.get(`${st.id}_1`);
      const p2 = map.get(`${st.id}_2`);
      const p1Ok = p1 && (p1.status === 'present' || p1.status === 'manual_approved');
      const p2Ok = p2 && (p2.status === 'present' || p2.status === 'manual_approved');
      const total = (p1Ok ? 1 : 0) + (p2Ok ? 1 : 0);

      return {
        'Matrícula': st.registration_number,
        'Nome do Aluno': st.name,
        'E-mail': st.email,
        '1ª Presença': p1Ok ? (p1.status === 'manual_approved' ? 'Manual' : 'Presente') : 'Ausente',
        '1ª Horário': p1?.recorded_at ? new Date(p1.recorded_at).toLocaleTimeString('pt-BR') : 'N/A',
        '1ª Distância (m)': p1?.distance_meters !== null && p1?.distance_meters !== undefined ? `${p1.distance_meters}m` : 'N/A',
        '1ª Biometria (%)': p1?.face_match_score ? `${(p1.face_match_score * 100).toFixed(1)}%` : 'N/A',
        '1ª Código': p1?.verification_code || 'N/A',
        '2ª Presença': p2Ok ? (p2.status === 'manual_approved' ? 'Manual' : 'Presente') : 'Ausente',
        '2ª Horário': p2?.recorded_at ? new Date(p2.recorded_at).toLocaleTimeString('pt-BR') : 'N/A',
        '2ª Distância (m)': p2?.distance_meters !== null && p2?.distance_meters !== undefined ? `${p2.distance_meters}m` : 'N/A',
        '2ª Biometria (%)': p2?.face_match_score ? `${(p2.face_match_score * 100).toFixed(1)}%` : 'N/A',
        '2ª Código': p2?.verification_code || 'N/A',
        'Total Aula': `${total}/2`
      };
    });

    if (rows.length === 0) {
      return res.send('Nenhum aluno matriculado nesta disciplina.');
    }

    const headers = Object.keys(rows[0]);
    const csvContent = [
      `# RELATORIO OFICIAL DE FREQUENCIA ACADEMICA - UGB`,
      `# Disciplina: ${session.course_name} (${session.course_code})`,
      `# Professor: ${session.teacher_name}`,
      `# Data: ${session.date} | Sala: ${session.room_name} | Raio: ${session.custom_radius_meters}m`,
      `# Gerado via Sistema de Presenca UGB (Geofencing Haversine + Biometria Facial)`,
      '',
      headers.join(';'),
      ...rows.map((row) => headers.map((h) => sanitizeCsvCell(row[h])).join(';'))
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=frequencia_${session.course_code}_${session.date}.csv`);
    res.send('\uFEFF' + csvContent);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
