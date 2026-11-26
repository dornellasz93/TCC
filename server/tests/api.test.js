/**
 * Suíte Automatizada de Testes Ponta a Ponta + Segurança (AppSec) da API
 * Testa: Health, Auth + JWT + bcrypt, Seed (Wellington + 5 alunos), Bloqueio de Demo-Login,
 * Bloqueio de Autoatribuição Docente, Validação de avatar_url, Anti-IDOR (leitura e escrita),
 * Isolamento de Consultas, Anti-Mock, Geofencing Haversine, Liveness Anti-Replay,
 * Biometria JPEG Real, Aprovação Manual, Verificação de Comprovante, Analytics e Anti-CSV Injection.
 */

const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs');
const jpeg = require('jpeg-js');

const tempDbPath = path.join(os.tmpdir(), `ugb_tcc_test_${Date.now()}.sqlite`);
process.env.DB_PATH = tempDbPath;
process.env.JWT_SECRET = 'test-secret-key-with-at-least-32-characters-123456';
process.env.SEED_DEFAULT_PASSWORD = 'TestPassword@2026';

const app = require('../index');

function createSyntheticJpeg(seedOffset = 0, variant = 'personA') {
  const width = 96;
  const height = 96;
  const frameData = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (variant === 'personA') {
        const dx = Math.abs(x - width / 2) / (width / 2);
        const dy = y / height;
        frameData[idx] = Math.min(255, Math.max(0, Math.floor(215 - dx * 120 + seedOffset)));
        frameData[idx + 1] = Math.min(255, Math.max(0, Math.floor(170 - dx * 95 - dy * 30 + seedOffset)));
        frameData[idx + 2] = Math.min(255, Math.max(0, Math.floor(145 - dx * 80 + seedOffset)));
      } else {
        const stripe = ((Math.floor(x / 12) + Math.floor(y / 12)) % 2 === 0) ? 240 : 20;
        frameData[idx] = stripe;
        frameData[idx + 1] = 255 - stripe;
        frameData[idx + 2] = Math.floor((x / width) * 255);
      }
      frameData[idx + 3] = 255;
    }
  }

  const encoded = jpeg.encode({ data: frameData, width, height }, 85);
  return 'data:image/jpeg;base64,' + encoded.data.toString('base64');
}

async function runTests() {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const req = async (method, urlPath, body, token) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${urlPath}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { json = text; }
    return { status: res.status, data: json, headers: res.headers };
  };

  try {
    console.log('🧪 1. Testing /api/health & CSP header...');
    const health = await req('GET', '/api/health');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.data.status, 'online');
    assert.strictEqual(health.data.database.users, 6, 'Seed deve conter exatamente 6 usuários (Wellington + 5 alunos)');
    assert.ok(health.headers.get('content-security-policy'), 'Cabeçalho CSP deve estar ativo');

    console.log('🧪 2. Testing Security Gates (demo-login disabled, role escalation blocked, avatar URL validation, unauth 401)...');
    const demoAttempt = await req('POST', '/api/auth/demo-login', { userId: 1 });
    assert.strictEqual(demoAttempt.status, 403);
    assert.strictEqual(demoAttempt.data.error_code, 'DEMO_LOGIN_DISABLED');

    const teacherRegAttempt = await req('POST', '/api/auth/register', {
      name: 'Intruso',
      email: 'intruso@ugb.edu.br',
      password: 'StrongPassword@123',
      role: 'teacher',
      registration_number: 'DOC-9999'
    });
    assert.strictEqual(teacherRegAttempt.status, 403);
    assert.strictEqual(teacherRegAttempt.data.error_code, 'ROLE_ESCALATION_FORBIDDEN');

    const badAvatarAttempt = await req('POST', '/api/auth/register', {
      name: 'Teste Avatar',
      email: 'avatar@ugb.edu.br',
      password: 'StrongPassword@123',
      role: 'student',
      registration_number: '2024999991',
      avatar_url: 'javascript:alert(1)'
    });
    assert.strictEqual(badAvatarAttempt.status, 400);
    assert.strictEqual(badAvatarAttempt.data.error_code, 'INVALID_AVATAR_URL');

    for (const openPath of ['/api/auth/users', '/api/sessions', '/api/sessions/1', '/api/courses', '/api/rooms', '/api/analytics/dashboard', '/api/analytics/export/1', '/api/attendance/history/2']) {
      const unauth = await req('GET', openPath);
      assert.strictEqual(unauth.status, 401, `${openPath} deve exigir autenticação (401)`);
    }

    const unauthCheckIn = await req('POST', '/api/attendance/check-in', {
      session_id: 1,
      student_id: 2,
      student_latitude: -22.518605,
      student_longitude: -44.098485
    });
    assert.strictEqual(unauthCheckIn.status, 401);

    console.log('🧪 3. Testing Login (bcrypt + JWT) for Student (Pedro Henrique Dornellas) & Teacher (Wellington)...');
    const studentLogin = await req('POST', '/api/auth/login', {
      login: '2024102278',
      password: process.env.SEED_DEFAULT_PASSWORD,
      expectedRole: 'student'
    });
    assert.strictEqual(studentLogin.status, 200);
    assert.strictEqual(studentLogin.data.user.name, 'Pedro Henrique Dornellas');
    const studentToken = studentLogin.data.token;
    const studentId = studentLogin.data.user.id;

    const teacherLogin = await req('POST', '/api/auth/login', {
      login: 'DOC-1001',
      password: process.env.SEED_DEFAULT_PASSWORD,
      expectedRole: 'teacher'
    });
    assert.strictEqual(teacherLogin.status, 200);
    assert.strictEqual(teacherLogin.data.user.name, 'Wellington');
    const teacherToken = teacherLogin.data.token;

    console.log('🧪 4. Testing RBAC & Anti-IDOR Isolation...');
    const studentAnalytics = await req('GET', '/api/analytics/dashboard', null, studentToken);
    assert.strictEqual(studentAnalytics.status, 403);

    const studentExport = await req('GET', '/api/analytics/export/1', null, studentToken);
    assert.strictEqual(studentExport.status, 403);

    const studentSessionDetail = await req('GET', '/api/sessions/1', null, studentToken);
    assert.strictEqual(studentSessionDetail.status, 403);

    const otherHistory = await req('GET', `/api/attendance/history/${studentId + 1}`, null, studentToken);
    assert.strictEqual(otherHistory.status, 403);

    const ownHistory = await req('GET', `/api/attendance/history/${studentId}`, null, studentToken);
    assert.strictEqual(ownHistory.status, 200);

    console.log('🧪 5. Testing Teacher Opening P1 & Real JPEG Biometric Enrollment in SQLite...');
    // Sessões iniciais devem começar fechadas até o professor abrir a 1ª presença
    const initialSession = await req('GET', '/api/sessions/1', null, teacherToken);
    assert.strictEqual(initialSession.status, 200);
    assert.strictEqual(initialSession.data.session.status_p1, 'closed');

    const openP1 = await req('PATCH', '/api/sessions/1/toggle-p1', {}, teacherToken);
    assert.strictEqual(openP1.status, 200);
    assert.strictEqual(openP1.data.status_p1, 'open');

    const faceA1 = createSyntheticJpeg(0, 'personA');
    const faceA2 = createSyntheticJpeg(8, 'personA');
    const faceB = createSyntheticJpeg(0, 'personB');

    const enroll = await req('POST', '/api/auth/enroll-face', { photo_base64: faceA1 }, studentToken);
    assert.strictEqual(enroll.status, 200);
    assert.strictEqual(enroll.data.user.face_registered, true);
    assert.ok(enroll.data.descriptorDimensions > 100);

    console.log('🧪 6. Testing Anti-Mock Location & Geofence Blocking...');
    const mockAttempt = await req('POST', '/api/attendance/check-in', {
      session_id: 1,
      call_type: 1,
      student_latitude: -22.518605,
      student_longitude: -44.098485,
      gps_accuracy_meters: 5,
      is_mock_location: true,
      photo_evidence: faceA2
    }, studentToken);
    assert.strictEqual(mockAttempt.status, 403);
    assert.strictEqual(mockAttempt.data.error_code, 'MOCK_LOCATION_DETECTED');

    const farAttempt = await req('POST', '/api/attendance/check-in', {
      session_id: 1,
      call_type: 1,
      student_latitude: -22.495000,
      student_longitude: -44.115000,
      gps_accuracy_meters: 10,
      is_mock_location: false,
      photo_evidence: faceA2
    }, studentToken);
    assert.strictEqual(farAttempt.status, 403);
    assert.strictEqual(farAttempt.data.error_code, 'OUT_OF_GEOFENCE');

    console.log('🧪 7. Testing Static-Photo Replay & Biometric Mismatch Blocking...');
    const ch1 = await req('POST', '/api/attendance/liveness-challenge', { session_id: 1, call_type: 1 }, studentToken);
    assert.strictEqual(ch1.status, 200);
    const staticAttempt = await req('POST', '/api/attendance/check-in', {
      session_id: 1,
      call_type: 1,
      student_latitude: -22.518605,
      student_longitude: -44.098485,
      gps_accuracy_meters: 5,
      frame_before: faceA1,
      photo_evidence: faceA1,
      liveness_token: ch1.data.challenge.token
    }, studentToken);
    assert.strictEqual(staticAttempt.status, 403);
    assert.strictEqual(staticAttempt.data.error_code, 'STATIC_PHOTO_DETECTED');

    const ch2 = await req('POST', '/api/attendance/liveness-challenge', { session_id: 1, call_type: 1 }, studentToken);
    const mismatchAttempt = await req('POST', '/api/attendance/check-in', {
      session_id: 1,
      call_type: 1,
      student_latitude: -22.518605,
      student_longitude: -44.098485,
      gps_accuracy_meters: 5,
      frame_before: faceA1,
      photo_evidence: faceB,
      liveness_token: ch2.data.challenge.token
    }, studentToken);
    assert.strictEqual(mismatchAttempt.status, 403);
    assert.strictEqual(mismatchAttempt.data.error_code, 'BIOMETRIC_MISMATCH');

    console.log('🧪 8. Testing Valid 2-Stage Check-In & Receipt Verification...');
    const ch3 = await req('POST', '/api/attendance/liveness-challenge', { session_id: 1, call_type: 1 }, studentToken);
    const validAttempt = await req('POST', '/api/attendance/check-in', {
      session_id: 1,
      call_type: 1,
      student_latitude: -22.518600,
      student_longitude: -44.098482,
      gps_accuracy_meters: 4.5,
      frame_before: faceA1,
      photo_evidence: faceA2,
      liveness_token: ch3.data.challenge.token
    }, studentToken);
    assert.strictEqual(validAttempt.status, 200, JSON.stringify(validAttempt.data));
    assert.strictEqual(validAttempt.data.validation.biometricMethod, 'server_descriptor_match');

    const verify = await req('GET', `/api/attendance/verify/${validAttempt.data.validation.verificationCode}`);
    assert.strictEqual(verify.status, 200);
    assert.strictEqual(verify.data.valid, true);
    assert.strictEqual(verify.data.record.photo_evidence, undefined);

    console.log('🧪 9. Testing Teacher Controls, No Base64 Leak & CSV Injection Sanitization...');
    const teacherSession = await req('GET', '/api/sessions/1', null, teacherToken);
    assert.strictEqual(teacherSession.status, 200);
    assert.strictEqual(teacherSession.data.students.length, 5, 'Deve listar os 5 alunos matriculados');
    assert.strictEqual(teacherSession.data.students[0].p1_photo, undefined, 'p1_photo não deve ser vazado na listagem');

    const calRoom = await req('PATCH', '/api/rooms/1', { latitude: -22.518610, longitude: -44.098490 }, teacherToken);
    assert.strictEqual(calRoom.status, 200);

    const closeP1 = await req('PATCH', '/api/sessions/1/toggle-p1', {}, teacherToken);
    assert.strictEqual(closeP1.status, 200);
    const openP2 = await req('PATCH', '/api/sessions/1/toggle-p2', {}, teacherToken);
    assert.strictEqual(openP2.status, 200);

    const manual = await req('POST', '/api/attendance/manual-approve', {
      session_id: 1,
      student_id: studentId,
      call_type: 2,
      notes: 'Teste automatizado de aprovação manual'
    }, teacherToken);
    assert.strictEqual(manual.status, 200);

    // Aluno não pode remover presença; professor titular pode remover e o registro some da sessão
    const studentRemoveAtt = await req('DELETE', `/api/attendance/1/${studentId}/2`, null, studentToken);
    assert.strictEqual(studentRemoveAtt.status, 403);
    const teacherRemoveAtt = await req('DELETE', `/api/attendance/1/${studentId}/2`, null, teacherToken);
    assert.strictEqual(teacherRemoveAtt.status, 200);
    const sessionAfterRemove = await req('GET', '/api/sessions/1', null, teacherToken);
    const removedStudentRow = sessionAfterRemove.data.students.find((s) => s.id === studentId);
    assert.strictEqual(removedStudentRow.p2_status, 'absent', '2ª presença removida deve ficar ausente');

    // Registra aluno com nome contendo fórmula CSV para validar sanitização
    const csvStudent = await req('POST', '/api/auth/register', {
      name: '=SUM(A1:A2)',
      email: 'formula@ugb.edu.br',
      password: 'StrongPassword@123',
      role: 'student',
      registration_number: '2024999999'
    });
    assert.strictEqual(csvStudent.status, 201);

    const analytics = await req('GET', '/api/analytics/dashboard', null, teacherToken);
    assert.strictEqual(analytics.status, 200);
    assert.ok(analytics.data.metrics.blockedMockGpsAttempts >= 1);
    assert.ok(analytics.data.metrics.blockedGeofenceAttempts >= 1);
    assert.ok(analytics.data.metrics.blockedBiometricAttempts >= 1);

    const csv = await req('GET', '/api/analytics/export/1', null, teacherToken);
    assert.strictEqual(csv.status, 200);
    assert.ok(typeof csv.data === 'string' && csv.data.includes("'=SUM(A1:A2)"), 'CSV deve neutralizar fórmulas com apóstrofo');

    console.log('🧪 10. Testing Course Creation & Edition (Teacher RBAC & Validation)...');
    const studentCreateCourse = await req('POST', '/api/courses', {
      name: 'Turma Indevida',
      code: 'INV-001'
    }, studentToken);
    assert.strictEqual(studentCreateCourse.status, 403);

    const createdCourse = await req('POST', '/api/courses', {
      name: 'Segurança de Aplicações Web',
      code: 'ENG-905',
      semester: '2026/2',
      room_id: 1,
      description: 'Auditoria e hardening de APIs.',
      color: '#06b6d4'
    }, teacherToken);
    assert.strictEqual(createdCourse.status, 201, JSON.stringify(createdCourse.data));
    const newCourseId = createdCourse.data.course.id;

    const editedCourse = await req('PATCH', `/api/courses/${newCourseId}`, {
      name: 'Segurança de Aplicações Web e Mobile',
      code: 'ENG-905',
      semester: '2026/2',
      room_id: 2
    }, teacherToken);
    assert.strictEqual(editedCourse.status, 200);
    assert.strictEqual(editedCourse.data.course.name, 'Segurança de Aplicações Web e Mobile');
    assert.strictEqual(editedCourse.data.course.room_id, 2);

    const studentDeleteCourse = await req('DELETE', `/api/courses/${newCourseId}`, null, studentToken);
    assert.strictEqual(studentDeleteCourse.status, 403);

    const deletedCourse = await req('DELETE', `/api/courses/${newCourseId}`, null, teacherToken);
    assert.strictEqual(deletedCourse.status, 200);
    const afterDelete = await req('GET', `/api/courses/${newCourseId}`, null, teacherToken);
    assert.strictEqual(afterDelete.status, 404);

    console.log('\n✅ ALL 10 END-TO-END & SECURITY TESTS PASSED SUCCESSFULLY!');
  } finally {
    server.close();
    const db = require('../database');
    db.close();
    for (const suffix of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(tempDbPath + suffix); } catch {}
    }
  }
}

runTests().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
