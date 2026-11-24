/**
 * Módulo Anti-Fraude de Geolocalização (Anti-Mock Location + Validação Haversine)
 * Detecta provedores de GPS falsos (Fake GPS / Mock Provider), telemetria anômala
 * e saltos de velocidade fisicamente impossíveis.
 */

const { calculateHaversineDistance, validateGeofence } = require('./haversine');

/**
 * Evaluates geolocation authenticity and Haversine geofence compliance.
 */
function validateLocationAntiFraud({
  db,
  studentId,
  studentLat,
  studentLon,
  roomLat,
  roomLon,
  maxRadiusMeters = 35,
  gpsAccuracyMeters = null,
  isMockLocation = false,
  isSimulated = false
}) {
  const lat = Number(studentLat);
  const lon = Number(studentLon);

  if (Number.isNaN(lat) || Number.isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return {
      ok: false,
      errorCode: 'INVALID_COORDINATES',
      auditActionSuffix: 'REJECTED_INVALID_GPS',
      message: 'Coordenadas GPS inválidas recebidas do aparelho.',
      distanceMeters: null,
      isMockDetected: false
    };
  }

  const geoValidation = validateGeofence(lat, lon, roomLat, roomLon, maxRadiusMeters);

  // 1. Direct Anti-Mock Location Check (Android location.mocked or simulated spoof test)
  if (isMockLocation === true || isMockLocation === 'true' || isMockLocation === 1) {
    return {
      ok: false,
      errorCode: 'MOCK_LOCATION_DETECTED',
      auditActionSuffix: 'REJECTED_MOCK_GPS',
      message: 'Fraude Bloqueada (Anti-Mock Location): Provedor de GPS falso/simulado detectado no dispositivo.',
      distanceMeters: geoValidation.distanceMeters,
      validation: geoValidation,
      isMockDetected: true
    };
  }

  // 2. Real GPS Telemetry Heuristics (when not using the official TCC demo simulator)
  if (!isSimulated && gpsAccuracyMeters !== null && gpsAccuracyMeters !== undefined) {
    const acc = Number(gpsAccuracyMeters);
    // Genuine mobile GPS never reports exact 0.0m accuracy — typical signature of spoofers
    if (!Number.isNaN(acc) && acc === 0) {
      return {
        ok: false,
        errorCode: 'MOCK_ACCURACY_ANOMALY',
        auditActionSuffix: 'REJECTED_MOCK_GPS',
        message: 'Fraude Bloqueada (Anti-Mock Location): Precisão GPS artificial (0.0m) característica de aplicativos de Fake GPS.',
        distanceMeters: geoValidation.distanceMeters,
        validation: geoValidation,
        isMockDetected: true
      };
    }

    if (!Number.isNaN(acc) && acc > 250) {
      return {
        ok: false,
        errorCode: 'LOW_GPS_ACCURACY',
        auditActionSuffix: 'REJECTED_LOW_ACCURACY',
        message: `Sinal GPS muito impreciso (±${Math.round(acc)}m). Aproxime-se de uma janela ou aguarde estabilizar o GPS.`,
        distanceMeters: geoValidation.distanceMeters,
        validation: geoValidation,
        isMockDetected: false
      };
    }
  }

  // 3. Impossible Travel / Velocity Anomaly Detection (real GPS only)
  if (!isSimulated && db && studentId) {
    const lastAttendance = db.prepare(`
      SELECT student_latitude, student_longitude, recorded_at
      FROM attendances
      WHERE student_id = ? AND student_latitude IS NOT NULL AND student_longitude IS NOT NULL
      ORDER BY recorded_at DESC
      LIMIT 1
    `).get(studentId);

    if (lastAttendance && lastAttendance.recorded_at) {
      const elapsedSeconds = (Date.now() - new Date(lastAttendance.recorded_at).getTime()) / 1000;
      if (elapsedSeconds > 0 && elapsedSeconds < 120) {
        const jumpMeters = calculateHaversineDistance(
          lastAttendance.student_latitude,
          lastAttendance.student_longitude,
          lat,
          lon
        );
        const speedKmh = (jumpMeters / elapsedSeconds) * 3.6;
        if (jumpMeters > 800 && speedKmh > 180) {
          return {
            ok: false,
            errorCode: 'VELOCITY_SPOOF_DETECTED',
            auditActionSuffix: 'REJECTED_MOCK_GPS',
            message: `Anomalia de deslocamento detectada (${Math.round(jumpMeters)}m em ${Math.round(elapsedSeconds)}s). Possível manipulação de GPS.`,
            distanceMeters: geoValidation.distanceMeters,
            validation: geoValidation,
            isMockDetected: true
          };
        }
      }
    }
  }

  // 4. Haversine Geofence Validation
  if (!geoValidation.isValid) {
    return {
      ok: false,
      errorCode: 'OUT_OF_GEOFENCE',
      auditActionSuffix: 'REJECTED_GEOFENCE',
      message: `Presença Rejeitada: Seu aparelho está a ${geoValidation.distanceMeters} metros da sala. O raio máximo permitido pelo professor é de ${maxRadiusMeters} metros.`,
      distanceMeters: geoValidation.distanceMeters,
      validation: geoValidation,
      isMockDetected: false
    };
  }

  return {
    ok: true,
    distanceMeters: geoValidation.distanceMeters,
    validation: geoValidation,
    isMockDetected: false
  };
}

module.exports = {
  validateLocationAntiFraud
};
