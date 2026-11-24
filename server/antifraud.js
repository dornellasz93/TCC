/**
 * Módulo Anti-Fraude de Geolocalização (Anti-Mock Location + Validação Haversine)
 * Detecta provedores de GPS falsos (Fake GPS / Mock Provider), telemetria anômala
 * e saltos de velocidade fisicamente impossíveis.
 */

const { calculateHaversineDistance, validateGeofence } = require('./haversine');

/**
 * Avalia a autenticidade da geolocalização e a conformidade com o cerco virtual (Haversine).
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

  // 1. Verificação direta de Anti-Mock Location (location.mocked do Android ou teste simulado de fraude)
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

  // 2. Heurísticas de telemetria GPS real (quando não estiver usando o simulador oficial da demonstração)
  if (!isSimulated && gpsAccuracyMeters !== null && gpsAccuracyMeters !== undefined) {
    const acc = Number(gpsAccuracyMeters);
    // GPS móvel genuíno nunca reporta precisão exata de 0.0m — assinatura típica de falsificadores
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

  // 3. Detecção de deslocamento impossível / anomalia de velocidade (apenas GPS real)
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

  // 4. Validação do cerco virtual (Geofence) via Haversine
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
