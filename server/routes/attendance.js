const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../database');
const { requireAuth, requireTeacher } = require('../middleware/auth');
const { validateLocationAntiFraud } = require('../antifraud');
const { createLivenessChallenge, verifyBiometrics } = require('../biometrics');

function isSimulationAllowed() {
  return process.env.ALLOW_SIMULATION_MODE === 'true' && process.env.NODE_ENV !== 'production';
}

// POST /api/attendance/liveness-challenge - Emite desafio dinâmico único de prova de vida (exige aluno autenticado e matriculado)
router.post('/liveness-challenge', requireAuth, (req, res) => {
  try {
    if (req.authUser.role !== 'student') {
      return res.status(403).json({
        success: false,
        error_code: 'STUDENT_ONLY',
        message: 'Apenas alunos autenticados podem solicitar desafios de prova de vida.'
      });
    }

    const { session_id, call_type = 1 } = req.body;
    const effectiveStudentId = req.authUser.id;

    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: 'Informe session_id para gerar o desafio de prova de vida.'
      });
    }

    const session = db.prepare('SELECT id, course_id FROM class_sessions WHERE id = ?').get(session_id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Sessão de aula não encontrada.' });
    }

    const enrolled = db.prepare(
      'SELECT 1 FROM course_students WHERE course_id = ? AND student_id = ?'
    ).get(session.course_id, effectiveStudentId);

    if (!enrolled) {
      return res.status(403).json({
        success: false,
        error_code: 'NOT_ENROLLED',
        message: 'Você não está matriculado na disciplina desta sessão.'
      });
    }

    const challenge = createLivenessChallenge(db, effectiveStudentId, Number(session_id), Number(call_type));
    res.json({
      success: true,
      challenge
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/attendance/check-in - Validação em 2 Etapas com JWT obrigatório e validação de matrícula
router.post('/check-in', requireAuth, (req, res) => {
  const startMs = Date.now();
  try {
    if (typeof db.autoCloseExpiredSessions === 'function') {
      db.autoCloseExpiredSessions();
    }

    if (req.authUser.role !== 'student') {
      return res.status(403).json({
        success: false,
        error_code: 'STUDENT_ONLY',
        message: 'Apenas alunos autenticados podem registrar presença via check-in.'
      });
    }

    const {
      session_id,
      call_type = 1,
      student_latitude,
      student_longitude,
      gps_accuracy_meters = null,
      is_mock_location = false,
      photo_evidence,
      frame_before = null,
      liveness_token = null,
      liveness_passed = true,
      simulate_spoof = null,
      device_info = 'Smartphone / React Native (Expo)',
      is_simulated = false
    } = req.body;

    // Identidade derivada exclusivamente do JWT assinado (ignora student_id enviado pelo body)
    const effectiveStudentId = req.authUser.id;
    const allowSim = isSimulationAllowed();
    const effectiveIsSimulated = allowSim ? Boolean(is_simulated) : false;
    const effectiveSimulateSpoof = allowSim ? simulate_spoof : null;

    if (!session_id) {
      return res.status(400).json({ success: false, message: 'Dados incompletos (sessão ausente).' });
    }

    if (student_latitude === undefined || student_longitude === undefined) {
      return res.status(400).json({ success: false, message: 'Coordenadas GPS do aparelho celular não informadas.' });
    }

    // 1. Busca o aluno, a sessão e valida matrícula na disciplina
    const student = db.prepare('SELECT * FROM users WHERE id = ?').get(effectiveStudentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Aluno não encontrado no sistema acadêmico.' });
    }

    const session = db.prepare(`
      SELECT
        s.*,
        c.name as course_name,
        c.code as course_code,
        r.name as room_name,
        r.latitude as room_lat,
        r.longitude as room_lng,
        r.default_radius_meters
      FROM class_sessions s
      JOIN courses c ON s.course_id = c.id
      JOIN rooms r ON s.room_id = r.id
      WHERE s.id = ?
    `).get(session_id);

    if (!session) {
      return res.status(404).json({ success: false, message: 'Sessão de aula não encontrada.' });
    }

    const enrollment = db.prepare(
      'SELECT 1 FROM course_students WHERE course_id = ? AND student_id = ?'
    ).get(session.course_id, effectiveStudentId);

    if (!enrollment) {
      return res.status(403).json({
        success: false,
        error_code: 'NOT_ENROLLED',
        message: 'Presença bloqueada: você não está matriculado nesta disciplina.'
      });
    }

    const now = new Date();
    const durationMin = session.call_duration_minutes || 20;

    // 2. Valida se a chamada específica (1ª ou 2ª) está aberta e dentro da janela de tempo
    if (Number(call_type) === 1) {
      if (session.status_p1 !== 'open' || (session.p1_expires_at && new Date(session.p1_expires_at) <= now)) {
        if (typeof db.autoCloseExpiredSessions === 'function') db.autoCloseExpiredSessions();
        return res.status(400).json({
          success: false,
          error_code: 'CALL_CLOSED',
          message: `A 1ª presença (início da aula) não está aberta ou o prazo limite de ${durationMin} minutos já expirou.`
        });
      }
    } else if (Number(call_type) === 2) {
      if (session.status_p2 !== 'open' || (session.p2_expires_at && new Date(session.p2_expires_at) <= now)) {
        if (typeof db.autoCloseExpiredSessions === 'function') db.autoCloseExpiredSessions();
        return res.status(400).json({
          success: false,
          error_code: 'CALL_CLOSED',
          message: `A 2ª presença (final da aula) não está aberta ou o prazo limite de ${durationMin} minutos já expirou.`
        });
      }
    } else {
      return res.status(400).json({ success: false, message: 'Tipo de chamada inválido (use 1 ou 2).' });
    }

    // 3. Verifica registro duplicado de presença
    const existing = db.prepare(`
      SELECT * FROM attendances WHERE session_id = ? AND student_id = ? AND call_type = ?
    `).get(session_id, effectiveStudentId, call_type);

    if (existing && (existing.status === 'present' || existing.status === 'manual_approved')) {
      return res.status(400).json({
        success: false,
        error_code: 'ALREADY_CHECKED_IN',
        message: `Você já registrou a sua ${call_type}ª presença nesta aula!`,
        attendance: existing
      });
    }

    const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const maxRadius = session.custom_radius_meters || session.default_radius_meters || 35;

    // 4. ETAPA 1: Anti-Mock Location + Cerco Virtual Haversine
    const locationCheck = validateLocationAntiFraud({
      db,
      studentId: effectiveStudentId,
      studentLat: student_latitude,
      studentLon: student_longitude,
      roomLat: session.room_lat,
      roomLon: session.room_lng,
      maxRadiusMeters: maxRadius,
      gpsAccuracyMeters: gps_accuracy_meters,
      isMockLocation: is_mock_location,
      isSimulated: effectiveIsSimulated
    });

    if (!locationCheck.ok) {
      const latencyMs = Date.now() - startMs;
      db.prepare(`
        INSERT INTO audit_logs (
          user_id, action, status, distance_meters, gps_accuracy_meters,
          is_mock_location, latency_ms, details, ip_address
        )
        VALUES (?, ?, 'BLOCKED', ?, ?, ?, ?, ?, ?)
      `).run(
        effectiveStudentId,
        `CHECKIN_P${call_type}_${locationCheck.auditActionSuffix}`,
        locationCheck.distanceMeters,
        gps_accuracy_meters !== null ? Number(gps_accuracy_meters) : null,
        locationCheck.isMockDetected ? 1 : 0,
        latencyMs,
        `${locationCheck.message} | Disciplina: ${session.course_name}`,
        clientIp
      );

      return res.status(403).json({
        success: false,
        stage: 1,
        error_code: locationCheck.errorCode,
        message: locationCheck.message,
        validation: locationCheck.validation || null,
        latencyMs
      });
    }

    // 5. ETAPA 2: Prova de Vida + Reconhecimento Facial (sem confiar em face_match_score enviado pelo cliente)
    const bioThreshold = Number(session.biometric_threshold || process.env.BIOMETRIC_THRESHOLD || 0.72);
    const biometricCheck = verifyBiometrics({
      db,
      user: student,
      sessionId: Number(session_id),
      callType: Number(call_type),
      photoBase64: photo_evidence,
      frameBeforeBase64: frame_before,
      livenessToken: liveness_token,
      livenessPassedClient: Boolean(liveness_passed),
      threshold: bioThreshold,
      simulateSpoof: effectiveSimulateSpoof,
      requireStrictBiometrics: !allowSim
    });

    if (!biometricCheck.ok) {
      const latencyMs = Date.now() - startMs;
      const actionSuffix = biometricCheck.errorCode.includes('LIVENESS') || biometricCheck.errorCode.includes('STATIC') || biometricCheck.errorCode.includes('REPLAY')
        ? 'REJECTED_LIVENESS'
        : 'REJECTED_BIOMETRICS';

      db.prepare(`
        INSERT INTO audit_logs (
          user_id, action, status, distance_meters, gps_accuracy_meters,
          face_match_score, is_mock_location, latency_ms, details, ip_address
        )
        VALUES (?, ?, 'BLOCKED', ?, ?, ?, 0, ?, ?, ?)
      `).run(
        effectiveStudentId,
        `CHECKIN_P${call_type}_${actionSuffix}`,
        locationCheck.distanceMeters,
        gps_accuracy_meters !== null ? Number(gps_accuracy_meters) : null,
        biometricCheck.faceMatchScore,
        latencyMs,
        `${biometricCheck.message} | Disciplina: ${session.course_name}`,
        clientIp
      );

      return res.status(403).json({
        success: false,
        stage: 2,
        error_code: biometricCheck.errorCode,
        message: biometricCheck.message,
        validation: {
          distanceMeters: locationCheck.distanceMeters,
          faceMatchScore: biometricCheck.faceMatchScore,
          threshold: bioThreshold,
          method: biometricCheck.method
        },
        latencyMs
      });
    }

    // 6. Gera assinatura criptográfica (SHA-256) e código de verificação
    const timestamp = new Date().toISOString();
    const hashPayload = `${effectiveStudentId}|${session_id}|P${call_type}|${student_latitude}|${student_longitude}|${biometricCheck.faceMatchScore}|${timestamp}|${crypto.randomBytes(8).toString('hex')}`;
    const verificationHash = crypto.createHash('sha256').update(hashPayload).digest('hex');
    const randomSuffix = crypto.randomInt(10000, 99999);
    const verificationCode = `UGB-P${call_type}-${randomSuffix}`;
    const latencyMs = Date.now() - startMs;

    const note = `${call_type}ª Presença validada via GPS (Anti-Mock OK) + Biometria (${locationCheck.distanceMeters}m | ${(biometricCheck.faceMatchScore * 100).toFixed(1)}%)`;

    // 7. Persiste a presença no SQLite
    db.prepare(`
      INSERT INTO attendances (
        session_id, student_id, call_type, status, recorded_at,
        student_latitude, student_longitude, gps_accuracy_meters, is_mock_location,
        distance_meters, liveness_passed, liveness_challenge, face_match_score,
        biometric_method, processing_latency_ms, photo_evidence,
        verification_hash, verification_code, ip_address, device_info, notes
      ) VALUES (?, ?, ?, 'present', ?, ?, ?, ?, 0, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id, student_id, call_type) DO UPDATE SET
        status = 'present',
        recorded_at = excluded.recorded_at,
        student_latitude = excluded.student_latitude,
        student_longitude = excluded.student_longitude,
        gps_accuracy_meters = excluded.gps_accuracy_meters,
        distance_meters = excluded.distance_meters,
        liveness_challenge = excluded.liveness_challenge,
        face_match_score = excluded.face_match_score,
        biometric_method = excluded.biometric_method,
        processing_latency_ms = excluded.processing_latency_ms,
        photo_evidence = excluded.photo_evidence,
        verification_hash = excluded.verification_hash,
        verification_code = excluded.verification_code
    `).run(
      session_id,
      effectiveStudentId,
      call_type,
      timestamp,
      Number(student_latitude),
      Number(student_longitude),
      gps_accuracy_meters !== null ? Number(gps_accuracy_meters) : null,
      locationCheck.distanceMeters,
      biometricCheck.challengeLabel || null,
      biometricCheck.faceMatchScore,
      biometricCheck.method,
      latencyMs,
      photo_evidence || null,
      verificationHash,
      verificationCode,
      clientIp,
      device_info,
      note
    );

    // 8. Registra log de auditoria de sucesso com telemetria completa
    db.prepare(`
      INSERT INTO audit_logs (
        user_id, action, status, distance_meters, gps_accuracy_meters,
        face_match_score, is_mock_location, latency_ms, details, ip_address
      )
      VALUES (?, ?, 'SUCCESS', ?, ?, ?, 0, ?, ?, ?)
    `).run(
      effectiveStudentId,
      `CHECKIN_P${call_type}_SUCCESS`,
      locationCheck.distanceMeters,
      gps_accuracy_meters !== null ? Number(gps_accuracy_meters) : null,
      biometricCheck.faceMatchScore,
      latencyMs,
      `${call_type}ª Presença confirmada em ${session.course_name} (${locationCheck.distanceMeters}m / Raio ${maxRadius}m | Face ${(biometricCheck.faceMatchScore * 100).toFixed(1)}% | ${latencyMs}ms)`,
      clientIp
    );

    const recordedAttendance = db.prepare(`
      SELECT id, session_id, student_id, call_type, status, recorded_at,
             distance_meters, gps_accuracy_meters, liveness_passed, liveness_challenge,
             face_match_score, biometric_method, processing_latency_ms,
             verification_hash, verification_code, notes
      FROM attendances
      WHERE session_id = ? AND student_id = ? AND call_type = ?
    `).get(session_id, effectiveStudentId, call_type);

    res.json({
      success: true,
      message: `${call_type}ª Presença registrada com sucesso!`,
      call_type,
      attendance: recordedAttendance,
      validation: {
        distanceMeters: locationCheck.distanceMeters,
        maxRadiusMeters: maxRadius,
        gpsAccuracyMeters: gps_accuracy_meters !== null ? Number(gps_accuracy_meters) : null,
        antiMockPassed: true,
        livenessPassed: true,
        livenessChallenge: biometricCheck.challengeLabel,
        faceMatchScore: biometricCheck.faceMatchScore,
        biometricThreshold: bioThreshold,
        biometricMethod: biometricCheck.method,
        latencyMs,
        verificationCode,
        verificationHash
      },
      session: {
        title: session.title,
        courseName: session.course_name,
        roomName: session.room_name
      }
    });
  } catch (err) {
    console.error('Erro no check-in:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/attendance/manual-approve - Aprovação manual restrita ao docente titular e alunos matriculados
router.post('/manual-approve', requireTeacher, (req, res) => {
  try {
    const { session_id, student_id, call_type = 1, notes = 'Aprovação manual pelo docente em sala de aula' } = req.body;

    if (!session_id || !student_id) {
      return res.status(400).json({ success: false, message: 'Informe session_id e student_id.' });
    }

    const session = db.prepare('SELECT id, course_id, teacher_id FROM class_sessions WHERE id = ?').get(session_id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Sessão não encontrada.' });
    }

    if (req.authUser.role !== 'admin' && session.teacher_id !== req.authUser.id) {
      return res.status(403).json({
        success: false,
        error_code: 'FORBIDDEN_SESSION_ACCESS',
        message: 'Apenas o docente titular pode aprovar presenças nesta sessão.'
      });
    }

    const enrolled = db.prepare(
      'SELECT 1 FROM course_students WHERE course_id = ? AND student_id = ?'
    ).get(session.course_id, student_id);

    if (!enrolled) {
      return res.status(403).json({
        success: false,
        error_code: 'NOT_ENROLLED',
        message: 'O aluno informado não está matriculado nesta disciplina.'
      });
    }

    const timestamp = new Date().toISOString();
    const hashPayload = `MANUAL|${req.authUser.id}|${student_id}|${session_id}|P${call_type}|${timestamp}`;
    const verificationHash = crypto.createHash('sha256').update(hashPayload).digest('hex');
    const verificationCode = `UGB-MAN-P${call_type}-${crypto.randomInt(1000, 9999)}`;
    const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';

    db.prepare(`
      INSERT INTO attendances (
        session_id, student_id, call_type, status, recorded_at,
        distance_meters, liveness_passed, face_match_score, biometric_method,
        verification_hash, verification_code, ip_address, device_info, notes
      ) VALUES (?, ?, ?, 'manual_approved', ?, NULL, 0, NULL, 'teacher_manual_override', ?, ?, ?, 'Portal Docente', ?)
      ON CONFLICT(session_id, student_id, call_type) DO UPDATE SET
        status = 'manual_approved',
        recorded_at = excluded.recorded_at,
        biometric_method = 'teacher_manual_override',
        verification_hash = excluded.verification_hash,
        verification_code = excluded.verification_code,
        notes = excluded.notes
    `).run(session_id, student_id, call_type, timestamp, verificationHash, verificationCode, clientIp, notes);

    db.prepare(`
      INSERT INTO audit_logs (user_id, action, status, details, ip_address)
      VALUES (?, ?, 'SUCCESS', ?, ?)
    `).run(
      req.authUser.id,
      `MANUAL_APPROVAL_P${call_type}`,
      `Docente aprovou manualmente a ${call_type}ª presença do aluno ID ${student_id} na sessão #${session_id}. Motivo: ${notes}`,
      clientIp
    );

    res.json({
      success: true,
      message: `${call_type}ª Presença aprovada manualmente com registro em auditoria.`,
      verificationCode,
      verificationHash
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/attendance/:sessionId/:studentId/:callType - Remoção manual de presença pelo docente titular com log de auditoria
router.delete('/:sessionId/:studentId/:callType', requireTeacher, (req, res) => {
  try {
    const sessionId = Number(req.params.sessionId);
    const studentId = Number(req.params.studentId);
    const callType = Number(req.params.callType);

    if (!Number.isInteger(sessionId) || !Number.isInteger(studentId) || ![1, 2].includes(callType)) {
      return res.status(400).json({
        success: false,
        message: 'Parâmetros inválidos (informe sessionId, studentId e callType 1 ou 2).'
      });
    }

    const session = db.prepare('SELECT id, course_id, teacher_id FROM class_sessions WHERE id = ?').get(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Sessão não encontrada.' });
    }

    if (req.authUser.role !== 'admin' && session.teacher_id !== req.authUser.id) {
      return res.status(403).json({
        success: false,
        error_code: 'FORBIDDEN_SESSION_ACCESS',
        message: 'Apenas o docente titular pode remover presenças nesta sessão.'
      });
    }

    const existing = db.prepare(`
      SELECT a.id, a.status, u.name as student_name
      FROM attendances a
      JOIN users u ON a.student_id = u.id
      WHERE a.session_id = ? AND a.student_id = ? AND a.call_type = ?
    `).get(sessionId, studentId, callType);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `Nenhuma ${callType}ª presença encontrada para este aluno nesta aula.`
      });
    }

    db.prepare(
      'DELETE FROM attendances WHERE session_id = ? AND student_id = ? AND call_type = ?'
    ).run(sessionId, studentId, callType);

    const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, status, details, ip_address)
      VALUES (?, ?, 'SUCCESS', ?, ?)
    `).run(
      req.authUser.id,
      `MANUAL_REMOVAL_P${callType}`,
      `Docente removeu manualmente a ${callType}ª presença de ${existing.student_name} (ID ${studentId}) na sessão #${sessionId}.`,
      clientIp
    );

    res.json({
      success: true,
      message: `${callType}ª Presença de ${existing.student_name} removida com registro em auditoria.`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/attendance/verify/:code - Endpoint de verificação criptográfica de comprovante (sem photo_evidence/GPS/IP)
router.get('/verify/:code', (req, res) => {
  try {
    const query = req.params.code.trim();
    const record = db.prepare(`
      SELECT
        a.id, a.session_id, a.call_type, a.status, a.recorded_at,
        a.distance_meters, a.face_match_score, a.biometric_method,
        a.verification_code, a.verification_hash,
        u.name as student_name,
        u.registration_number,
        s.title as session_title,
        s.date as session_date,
        c.name as course_name,
        c.code as course_code,
        r.name as room_name,
        r.block as room_block
      FROM attendances a
      JOIN users u ON a.student_id = u.id
      JOIN class_sessions s ON a.session_id = s.id
      JOIN courses c ON s.course_id = c.id
      JOIN rooms r ON s.room_id = r.id
      WHERE a.verification_code = ? OR a.verification_hash = ?
    `).get(query, query);

    if (!record) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: 'Nenhum comprovante encontrado para o código ou hash SHA-256 informado.'
      });
    }

    res.json({
      success: true,
      valid: true,
      message: 'Comprovante autêntico verificado na base criptográfica da UGB.',
      record
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/attendance/history/:studentId - Protegido com requireAuth e posse estrita (omite photo_evidence, GPS bruto e IP)
router.get('/history/:studentId', requireAuth, (req, res) => {
  try {
    const studentId = Number(req.params.studentId);
    if (!Number.isInteger(studentId)) {
      return res.status(400).json({ success: false, message: 'ID de aluno inválido.' });
    }

    const isSelf = req.authUser.id === studentId;
    const isAdmin = req.authUser.role === 'admin';
    let isTeacherOfStudent = false;
    if (req.authUser.role === 'teacher') {
      const link = db.prepare(`
        SELECT 1
        FROM course_students cs
        JOIN courses c ON cs.course_id = c.id
        WHERE cs.student_id = ? AND c.teacher_id = ?
        LIMIT 1
      `).get(studentId, req.authUser.id);
      isTeacherOfStudent = Boolean(link);
    }

    if (!isSelf && !isAdmin && !isTeacherOfStudent) {
      return res.status(403).json({
        success: false,
        error_code: 'FORBIDDEN_HISTORY_ACCESS',
        message: 'Você não tem permissão para consultar o histórico de presenças deste aluno.'
      });
    }

    const history = db.prepare(`
      SELECT
        a.id, a.session_id, a.student_id, a.call_type, a.status, a.recorded_at,
        a.distance_meters, a.face_match_score, a.biometric_method,
        a.processing_latency_ms, a.verification_code, a.verification_hash, a.notes,
        s.title as session_title,
        s.date as session_date,
        s.start_time,
        s.end_time,
        c.name as course_name,
        c.code as course_code,
        u.name as teacher_name,
        r.name as room_name,
        r.block as room_block
      FROM attendances a
      JOIN class_sessions s ON a.session_id = s.id
      JOIN courses c ON s.course_id = c.id
      JOIN users u ON s.teacher_id = u.id
      JOIN rooms r ON s.room_id = r.id
      WHERE a.student_id = ?
      ORDER BY a.recorded_at DESC
    `).all(studentId);

    const courseStats = db.prepare(`
      SELECT
        c.id,
        c.name,
        c.code,
        c.color,
        (SELECT COUNT(*) * 2 FROM class_sessions s WHERE s.course_id = c.id) as total_calls,
        (SELECT COUNT(*) FROM attendances a
         JOIN class_sessions s ON a.session_id = s.id
         WHERE s.course_id = c.id AND a.student_id = ? AND a.status IN ('present', 'manual_approved')) as attended_calls
      FROM course_students cs
      JOIN courses c ON cs.course_id = c.id
      WHERE cs.student_id = ?
      ORDER BY c.name ASC
    `).all(studentId, studentId).map((c) => ({
      ...c,
      percentage: c.total_calls > 0 ? Math.round((c.attended_calls / c.total_calls) * 100) : 100
    }));

    res.json({ success: true, history, courseStats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
