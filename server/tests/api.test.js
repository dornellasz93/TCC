/**
 * Automated End-to-End API Test Suite (Node.js built-in fetch + jpeg-js)
 * Tests: Health, Auth + JWT + bcrypt, Room GPS Calibration, Session P1/P2 rules,
 * Anti-Mock Location, Haversine Geofence, Liveness Challenge + Anti-Replay,
 * Real JPEG Biometric Enrollment & Matching, Manual Approval, Receipt Verification,
 * Analytics Telemetry & CSV Export.
 */

const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs');
const jpeg = require('jpeg-js');

// Use isolated temporary SQLite DB for tests
const tempDbPath = path.join(os.tmpdir(), `ugb_tcc_test_${Date.now()}.sqlite`);
process.env.DB_PATH = tempDbPath;
process.env.JWT_SECRET = 'test-secret-key';

const app = require('../index');

function createSyntheticJpeg(seedOffset = 0, variant = 'personA') {
  const width = 96;
  const height = 96;
  const frameData = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (variant === 'personA') {
        // Vertical facial symmetry pattern (bright center forehead/nose, darker sides)
        const dx = Math.abs(x - width / 2) / (width / 2);
        const dy = y / height;
        frameData[idx] = Math.min(255, Math.max(0, Math.floor(215 - dx * 120 + seedOffset)));
        frameData[idx + 1] = Math.min(255, Math.max(0, Math.floor(170 - dx * 95 - dy * 30 + seedOffset)));
        frameData[idx + 2] = Math.min(255, Math.max(0, Math.floor(145 - dx * 80 + seedOffset)));
      } else {
        // Completely inverted horizontal checkerboard / different face geometry
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
    return { status: res.status, data: json };
  };

  try {
    console.log('🧪 1. Testing /api/health...');
    const health = await req('GET', '/api/health');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.data.status, 'online');
    assert.strictEqual(health.data.database.connected, true);

    console.log('🧪 2. Testing Login (bcrypt + JWT) for Student & Teacher...');
    const studentLogin = await req('POST', '/api/auth/login', {
      login: '2024102278',
      password: '123',
      expectedRole: 'student'
    });
    assert.strictEqual(studentLogin.status, 200);
    assert.ok(studentLogin.data.token, 'Student JWT should be returned');
    const studentToken = studentLogin.data.token;
    const studentId = studentLogin.data.user.id;

    const teacherLogin = await req('POST', '/api/auth/login', {
      login: 'DOC-1001',
      password: '123',
      expectedRole: 'teacher'
    });
    assert.strictEqual(teacherLogin.status, 200);
    assert.ok(teacherLogin.data.token, 'Teacher JWT should be returned');
    const teacherToken = teacherLogin.data.token;

    console.log('🧪 3. Testing Real JPEG Biometric Enrollment in SQLite...');
    const faceA1 = createSyntheticJpeg(0, 'personA');
    const faceA2 = createSyntheticJpeg(8, 'personA'); // Slight live motion/expression change
    const faceB = createSyntheticJpeg(0, 'personB');

    const enroll = await req('POST', '/api/auth/enroll-face', { photo_base64: faceA1 }, studentToken);
    assert.strictEqual(enroll.status, 200);
    assert.strictEqual(enroll.data.user.face_registered, true);
    assert.ok(enroll.data.descriptorDimensions > 100);

    console.log('🧪 4. Testing Anti-Mock Location Blocking...');
    const mockAttempt = await req('POST', '/api/attendance/check-in', {
      session_id: 1,
      student_id: studentId,
      call_type: 1,
      student_latitude: -22.518605,
      student_longitude: -44.098485,
      gps_accuracy_meters: 5,
      is_mock_location: true,
      photo_evidence: faceA2
    }, studentToken);
    assert.strictEqual(mockAttempt.status, 403);
    assert.strictEqual(mockAttempt.data.error_code, 'MOCK_LOCATION_DETECTED');

    console.log('🧪 5. Testing Haversine Geofence Blocking (Out of Range)...');
    const farAttempt = await req('POST', '/api/attendance/check-in', {
      session_id: 1,
      student_id: studentId,
      call_type: 1,
      student_latitude: -22.495000,
      student_longitude: -44.115000,
      gps_accuracy_meters: 10,
      is_mock_location: false,
      photo_evidence: faceA2,
      is_simulated: true
    }, studentToken);
    assert.strictEqual(farAttempt.status, 403);
    assert.strictEqual(farAttempt.data.error_code, 'OUT_OF_GEOFENCE');

    console.log('🧪 6. Testing Static-Photo Replay Detection (Liveness)...');
    const ch1 = await req('POST', '/api/attendance/liveness-challenge', {
      session_id: 1,
      student_id: studentId,
      call_type: 1
    }, studentToken);
    assert.strictEqual(ch1.status, 200);
    assert.ok(ch1.data.challenge.token);

    const staticAttempt = await req('POST', '/api/attendance/check-in', {
      session_id: 1,
      student_id: studentId,
      call_type: 1,
      student_latitude: -22.518605,
      student_longitude: -44.098485,
      gps_accuracy_meters: 5,
      frame_before: faceA1,
      photo_evidence: faceA1, // Identical static photo -> must be blocked!
      liveness_token: ch1.data.challenge.token,
      is_simulated: true
    }, studentToken);
    assert.strictEqual(staticAttempt.status, 403);
    assert.strictEqual(staticAttempt.data.error_code, 'STATIC_PHOTO_DETECTED');

    console.log('🧪 7. Testing Biometric Mismatch Blocking (Different Face)...');
    const ch2 = await req('POST', '/api/attendance/liveness-challenge', {
      session_id: 1,
      student_id: studentId,
      call_type: 1
    }, studentToken);
    const mismatchAttempt = await req('POST', '/api/attendance/check-in', {
      session_id: 1,
      student_id: studentId,
      call_type: 1,
      student_latitude: -22.518605,
      student_longitude: -44.098485,
      gps_accuracy_meters: 5,
      frame_before: faceA1,
      photo_evidence: faceB, // Different face -> must be blocked!
      liveness_token: ch2.data.challenge.token,
      is_simulated: true
    }, studentToken);
    assert.strictEqual(mismatchAttempt.status, 403);
    assert.strictEqual(mismatchAttempt.data.error_code, 'BIOMETRIC_MISMATCH');

    console.log('🧪 8. Testing Valid 2-Stage Check-In (GPS + Real Liveness Motion + Face Match)...');
    const ch3 = await req('POST', '/api/attendance/liveness-challenge', {
      session_id: 1,
      student_id: studentId,
      call_type: 1
    }, studentToken);
    const validAttempt = await req('POST', '/api/attendance/check-in', {
      session_id: 1,
      student_id: studentId,
      call_type: 1,
      student_latitude: -22.518600,
      student_longitude: -44.098482,
      gps_accuracy_meters: 4.5,
      frame_before: faceA1,
      photo_evidence: faceA2,
      liveness_token: ch3.data.challenge.token,
      is_simulated: true
    }, studentToken);
    assert.strictEqual(validAttempt.status, 200, JSON.stringify(validAttempt.data));
    assert.strictEqual(validAttempt.data.success, true);
    assert.strictEqual(validAttempt.data.validation.biometricMethod, 'server_descriptor_match');
    assert.ok(validAttempt.data.validation.verificationCode.startsWith('UGB-P1-'));

    console.log('🧪 9. Testing Cryptographic Receipt Verification...');
    const verify = await req('GET', `/api/attendance/verify/${validAttempt.data.validation.verificationCode}`);
    assert.strictEqual(verify.status, 200);
    assert.strictEqual(verify.data.valid, true);

    console.log('🧪 10. Testing Teacher Controls (Config, Room Calibration, Manual Approve, P1->P2, CSV, Analytics)...');
    const cfg = await req('PATCH', '/api/sessions/1/config', {
      custom_radius_meters: 45,
      biometric_threshold: 0.78
    }, teacherToken);
    assert.strictEqual(cfg.status, 200);
    assert.strictEqual(cfg.data.custom_radius_meters, 45);

    const calRoom = await req('PATCH', '/api/rooms/1', {
      latitude: -22.518610,
      longitude: -44.098490
    }, teacherToken);
    assert.strictEqual(calRoom.status, 200);

    const closeP1 = await req('PATCH', '/api/sessions/1/toggle-p1', {}, teacherToken);
    assert.strictEqual(closeP1.status, 200);
    assert.strictEqual(closeP1.data.status_p1, 'closed');

    const openP2 = await req('PATCH', '/api/sessions/1/toggle-p2', {}, teacherToken);
    assert.strictEqual(openP2.status, 200);
    assert.strictEqual(openP2.data.status_p2, 'open');

    const manual = await req('POST', '/api/attendance/manual-approve', {
      session_id: 1,
      student_id: studentId,
      call_type: 2,
      notes: 'Teste automatizado de aprovação manual'
    }, teacherToken);
    assert.strictEqual(manual.status, 200);

    const analytics = await req('GET', '/api/analytics/dashboard');
    assert.strictEqual(analytics.status, 200);
    assert.ok(analytics.data.metrics.blockedMockGpsAttempts >= 1);
    assert.ok(analytics.data.metrics.blockedGeofenceAttempts >= 1);
    assert.ok(analytics.data.metrics.blockedBiometricAttempts >= 1);
    assert.ok(analytics.data.metrics.estimatedTimeSavedMinutes > 0);

    const csv = await req('GET', '/api/analytics/export/1');
    assert.strictEqual(csv.status, 200);
    assert.ok(typeof csv.data === 'string' && csv.data.includes('1ª Presença') && csv.data.includes('2ª Presença'));

    console.log('\n✅ ALL 10 END-TO-END BACKEND TESTS PASSED SUCCESSFULLY!');
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
