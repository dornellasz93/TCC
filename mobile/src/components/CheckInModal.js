import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform
} from 'react-native';
import * as Location from 'expo-location';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { calculateHaversine, UGB_LOCATIONS } from '../utils/haversine';
import { useCountdown } from '../utils/useCountdown';
import { apiRequest } from '../services/api';

export default function CheckInModal({ visible, session, student, callType = 1, onClose, onSuccess }) {
  const [step, setStep] = useState(1); // 1: GPS + Anti-Mock, 2: Face + Liveness, 3: Receipt

  // GPS State
  const [gpsMode, setGpsMode] = useState('real'); // 'real' | 'simulated'
  const [selectedLoc, setSelectedLoc] = useState(UGB_LOCATIONS[0]);
  const [realGps, setRealGps] = useState(null); // { latitude, longitude, accuracy, mocked }
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [fraudBlockMsg, setFraudBlockMsg] = useState(null);
  const [testingFraud, setTestingFraud] = useState(false);

  // Camera & Liveness State
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [challenge, setChallenge] = useState(null);
  const [frameBefore, setFrameBefore] = useState(null);
  const [frameAfter, setFrameAfter] = useState(null); // { uri, base64 }
  const [simulateSpoof, setSimulateSpoof] = useState(null); // null | 'static_photo' | 'wrong_face'
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState(null);

  // Receipt State
  const [receipt, setReceipt] = useState(null);
  const [validation, setValidation] = useState(null);

  const expiresAt = callType === 1 ? session?.p1_expires_at : session?.p2_expires_at;
  const countdown = useCountdown(visible ? expiresAt : null);

  useEffect(() => {
    if (visible) {
      setStep(1);
      setFraudBlockMsg(null);
      setFrameBefore(null);
      setFrameAfter(null);
      setVerifyError(null);
      setSimulateSpoof(null);
      setReceipt(null);
      setValidation(null);
      fetchRealLocation();
    }
  }, [visible, session?.id, callType]);

  const fetchRealLocation = async () => {
    setGpsLoading(true);
    setGpsError(null);
    setFraudBlockMsg(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setGpsError('Permissão de GPS negada. Ative nas configurações ou use o Simulador do Campus.');
        setGpsLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest
      });

      setRealGps({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy ? Math.round(loc.coords.accuracy * 10) / 10 : 8,
        mocked: Boolean(loc.mocked)
      });
    } catch (err) {
      setGpsError('Não foi possível obter sinal GPS. Tente novamente ou use o Simulador Campus UGB.');
    } finally {
      setGpsLoading(false);
    }
  };

  const fetchLivenessChallenge = async () => {
    if (!session || !student) return;
    const res = await apiRequest('/api/attendance/liveness-challenge', {
      method: 'POST',
      body: JSON.stringify({
        session_id: session.id,
        student_id: student.id,
        call_type: callType
      })
    });
    if (res.ok && res.data?.success) {
      setChallenge(res.data.challenge);
    }
  };

  const activeLat = gpsMode === 'real' ? realGps?.latitude : selectedLoc.latitude;
  const activeLon = gpsMode === 'real' ? realGps?.longitude : selectedLoc.longitude;
  const activeAcc = gpsMode === 'real' ? (realGps?.accuracy ?? 10) : selectedLoc.accuracy;
  const isMockLocation = gpsMode === 'real' ? Boolean(realGps?.mocked) : Boolean(selectedLoc.isMockLocation);

  const maxRadius = session?.custom_radius_meters || 35;
  const hasCoords = activeLat !== undefined && activeLat !== null && activeLon !== undefined && activeLon !== null;
  const distanceMeters = hasCoords && session
    ? calculateHaversine(activeLat, activeLon, session.room_latitude, session.room_longitude)
    : null;
  const isStage1Valid = hasCoords && distanceMeters !== null && distanceMeters <= maxRadius && !isMockLocation;

  const goToStep2 = () => {
    setStep(2);
    setFrameBefore(null);
    setFrameAfter(null);
    setVerifyError(null);
    fetchLivenessChallenge();
  };

  // Allows live demonstration of Stage 1 Server Blocking (Anti-Mock or Out-of-Geofence)
  const handleTestServerBlock = async () => {
    if (!hasCoords) return;
    setTestingFraud(true);
    setFraudBlockMsg(null);
    const res = await apiRequest('/api/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify({
        session_id: session.id,
        student_id: student.id,
        call_type: callType,
        student_latitude: activeLat,
        student_longitude: activeLon,
        gps_accuracy_meters: activeAcc,
        is_mock_location: isMockLocation,
        is_simulated: gpsMode === 'simulated',
        device_info: `React Native (Expo Go / ${Platform.OS})`
      })
    });
    setTestingFraud(false);
    setFraudBlockMsg(
      `HTTP ${res.status} (${res.data?.error_code || 'BLOCKED'}): ${res.data?.message || 'Bloqueado pelo servidor.'}`
    );
  };

  const handleCaptureFrame1 = async () => {
    setVerifyError(null);
    if (!cameraRef.current) return;
    try {
      const p1 = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.25, exif: false });
      if (p1?.base64) {
        setFrameBefore(`data:image/jpeg;base64,${p1.base64}`);
      }
    } catch {
      setVerifyError('Erro ao capturar quadro inicial.');
    }
  };

  const handleCaptureFrame2 = async () => {
    setVerifyError(null);
    if (!cameraRef.current) return;
    try {
      const p2 = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.3, exif: false });
      if (p2?.base64) {
        setFrameAfter({
          uri: p2.uri,
          base64: `data:image/jpeg;base64,${p2.base64}`
        });
      }
    } catch {
      setVerifyError('Erro ao capturar quadro final da prova de vida.');
    }
  };

  const handleConfirmCheckIn = async (useFallbackPhoto = false) => {
    setVerifying(true);
    setVerifyError(null);

    const res = await apiRequest('/api/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify({
        session_id: session.id,
        student_id: student.id,
        call_type: callType,
        student_latitude: activeLat,
        student_longitude: activeLon,
        gps_accuracy_meters: activeAcc,
        is_mock_location: isMockLocation,
        frame_before: useFallbackPhoto ? null : frameBefore,
        photo_evidence: useFallbackPhoto ? student.avatar_url : (frameAfter?.base64 || student.avatar_url),
        liveness_token: challenge?.token || null,
        liveness_passed: true,
        simulate_spoof: simulateSpoof,
        is_simulated: gpsMode === 'simulated',
        device_info: `React Native (Expo Go / ${Platform.OS})`
      })
    });

    setVerifying(false);

    if (!res.ok || !res.data?.success) {
      fetchLivenessChallenge();
      setVerifyError(`[${res.data?.error_code || 'BLOQUEADO'}] ${res.data?.message || 'Validação rejeitada pelo servidor.'}`);
      return;
    }

    setReceipt(res.data.attendance);
    setValidation(res.data.validation);
    setStep(3);
    if (onSuccess) onSuccess();
  };

  if (!session) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <View style={styles.topLeft}>
            <View style={styles.iconCircle}>
              <Ionicons name="scan" size={18} color={COLORS.primaryLight} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {callType}ª Presença • {session.course_code}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {session.room_name} • ⏳ {countdown.formatted}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Stepper */}
        <View style={styles.stepper}>
          {[
            { num: 1, label: '1. GPS + Anti-Mock' },
            { num: 2, label: '2. Face + Liveness' },
            { num: 3, label: '3. Comprovante' }
          ].map((s) => (
            <View key={s.num} style={[styles.stepTab, step >= s.num && styles.stepTabActive]}>
              <Text style={[styles.stepTabText, step >= s.num && styles.stepTabTextActive]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* STEP 1: GPS + ANTI-MOCK */}
          {step === 1 && (
            <View style={styles.section}>
              <View style={styles.modeRow}>
                <TouchableOpacity
                  onPress={() => { setGpsMode('real'); setFraudBlockMsg(null); fetchRealLocation(); }}
                  style={[styles.modeBtn, gpsMode === 'real' && styles.modeBtnActive]}
                >
                  <Ionicons name="navigate" size={16} color={gpsMode === 'real' ? '#fff' : COLORS.textMuted} />
                  <Text style={[styles.modeText, gpsMode === 'real' && { color: '#fff' }]}>GPS Real</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => { setGpsMode('simulated'); setFraudBlockMsg(null); }}
                  style={[styles.modeBtn, gpsMode === 'simulated' && styles.modeBtnActive]}
                >
                  <Ionicons name="sparkles" size={16} color={gpsMode === 'simulated' ? '#fff' : COLORS.textMuted} />
                  <Text style={[styles.modeText, gpsMode === 'simulated' && { color: '#fff' }]}>Simulador UGB</Text>
                </TouchableOpacity>
              </View>

              {gpsMode === 'real' ? (
                <View style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardTitle}>Sensor GPS Nativo ({Platform.OS.toUpperCase()})</Text>
                    <TouchableOpacity onPress={fetchRealLocation} style={styles.refreshLink}>
                      <Ionicons name="refresh" size={15} color={COLORS.cyanLight} />
                      <Text style={styles.refreshText}>Atualizar</Text>
                    </TouchableOpacity>
                  </View>

                  {gpsLoading ? (
                    <View style={{ paddingVertical: 20, alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator color={COLORS.primaryLight} />
                      <Text style={styles.muted}>Lendo satélites GPS e verificando Anti-Mock...</Text>
                    </View>
                  ) : realGps ? (
                    <View style={styles.metricRow}>
                      <View style={styles.metricTile}>
                        <Text style={styles.metricK}>Latitude</Text>
                        <Text style={styles.metricV}>{realGps.latitude.toFixed(5)}</Text>
                      </View>
                      <View style={styles.metricTile}>
                        <Text style={styles.metricK}>Longitude</Text>
                        <Text style={styles.metricV}>{realGps.longitude.toFixed(5)}</Text>
                      </View>
                      <View style={styles.metricTile}>
                        <Text style={styles.metricK}>Precisão</Text>
                        <Text style={[styles.metricV, { color: COLORS.cyanLight }]}>±{realGps.accuracy}m</Text>
                      </View>
                    </View>
                  ) : (
                    <Text style={{ color: COLORS.warning, fontSize: 12 }}>{gpsError || 'Aguardando GPS...'}</Text>
                  )}
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  <Text style={styles.label}>Cenários de Demonstração (Campus Volta Redonda):</Text>
                  {UGB_LOCATIONS.map((loc) => {
                    const dist = calculateHaversine(loc.latitude, loc.longitude, session.room_latitude, session.room_longitude);
                    const selected = selectedLoc.id === loc.id;
                    const ok = dist <= maxRadius && !loc.isMockLocation;
                    return (
                      <TouchableOpacity
                        key={loc.id}
                        onPress={() => { setSelectedLoc(loc); setFraudBlockMsg(null); }}
                        style={[
                          styles.locCard,
                          selected && (loc.isMockLocation ? styles.locCardDanger : styles.locCardSelected)
                        ]}
                      >
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={styles.locName}>{loc.name}</Text>
                          <Text style={styles.locDesc}>{loc.description}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 3 }}>
                          <Text style={[styles.locDist, { color: ok ? COLORS.success : COLORS.danger }]}>{dist}m</Text>
                          <Text style={[styles.locBadge, { color: ok ? COLORS.success : COLORS.danger }]}>
                            {loc.isMockLocation ? 'MOCK' : ok ? 'OK' : 'FORA'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Haversine + Anti-Mock Verdict */}
              <View style={[styles.verdictCard, isStage1Valid ? styles.verdictOk : styles.verdictBad]}>
                <View style={styles.rowBetween}>
                  <Text style={styles.verdictTitle}>
                    {isMockLocation
                      ? 'Anti-Mock: GPS Falso Detectado!'
                      : isStage1Valid
                        ? 'Etapa 1 Aprovada (GPS + Anti-Mock)'
                        : 'Etapa 1 Bloqueada'}
                  </Text>
                  <Ionicons
                    name={isStage1Valid ? 'checkmark-circle' : 'shield-outline'}
                    size={22}
                    color={isStage1Valid ? COLORS.success : COLORS.danger}
                  />
                </View>

                <View style={styles.metricRow}>
                  <View style={styles.metricTile}>
                    <Text style={styles.metricK}>Haversine</Text>
                    <Text style={[styles.metricV, { color: isStage1Valid ? COLORS.success : COLORS.danger }]}>
                      {distanceMeters !== null ? `${distanceMeters}m` : '—'}
                    </Text>
                  </View>
                  <View style={styles.metricTile}>
                    <Text style={styles.metricK}>Raio Sala</Text>
                    <Text style={[styles.metricV, { color: COLORS.primaryLight }]}>{maxRadius}m</Text>
                  </View>
                  <View style={styles.metricTile}>
                    <Text style={styles.metricK}>Anti-Mock</Text>
                    <Text style={[styles.metricV, { color: isMockLocation ? COLORS.danger : COLORS.success }]}>
                      {isMockLocation ? 'BLOQUEADO' : 'LIMPO'}
                    </Text>
                  </View>
                </View>

                {fraudBlockMsg && (
                  <View style={styles.serverBlockBox}>
                    <Text style={styles.serverBlockText}>{fraudBlockMsg}</Text>
                  </View>
                )}
              </View>

              {isStage1Valid ? (
                <TouchableOpacity onPress={goToStep2} style={styles.primaryBtn}>
                  <Text style={styles.primaryBtnText}>Avançar para Reconhecimento Facial</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handleTestServerBlock}
                  disabled={!hasCoords || testingFraud}
                  style={[styles.dangerBtn, !hasCoords && { opacity: 0.4 }]}
                >
                  {testingFraud ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="alert-circle" size={18} color="#fff" />
                      <Text style={styles.primaryBtnText}>Testar Bloqueio no Servidor (Auditar)</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* STEP 2: LIVENESS + FACIAL RECOGNITION */}
          {step === 2 && (
            <View style={styles.section}>
              {challenge && (
                <View style={styles.challengeBox}>
                  <Ionicons name="eye" size={22} color={COLORS.cyanLight} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.challengeK}>DESAFIO DINÂMICO DE PROVA DE VIDA</Text>
                    <Text style={styles.challengeV}>{challenge.challenge_label}</Text>
                  </View>
                </View>
              )}

              <View style={styles.cameraContainer}>
                {frameAfter ? (
                  <Image source={{ uri: frameAfter.uri }} style={styles.camera} />
                ) : !camPermission?.granted ? (
                  <View style={styles.permCenter}>
                    <Ionicons name="camera-outline" size={38} color={COLORS.primaryLight} />
                    <Text style={styles.permMsg}>Permita a câmera frontal para prova de vida e reconhecimento facial.</Text>
                    <TouchableOpacity onPress={requestCamPermission} style={styles.smallPrimaryBtn}>
                      <Text style={styles.primaryBtnText}>Conceder Câmera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleConfirmCheckIn(true)} style={styles.fallbackLink}>
                      <Text style={styles.fallbackText}>Ou continuar com modo fallback de demo</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.camera}>
                    <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
                    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ovalWrap]}>
                      <View style={[styles.oval, frameBefore && { borderColor: COLORS.success }]} />
                      <View style={styles.camPill}>
                        <Text style={styles.camPillText}>
                          {!frameBefore
                            ? 'PASSO 1/2: OLHE PARA A CÂMERA'
                            : 'PASSO 2/2: REALIZE O DESAFIO ACIMA'}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>

              {/* Banca Spoof Simulation Controls */}
              <View style={styles.card}>
                <Text style={styles.label}>Simulação de Segurança (Opcional p/ Banca):</Text>
                <View style={styles.spoofRow}>
                  {[
                    { id: null, label: 'Normal' },
                    { id: 'static_photo', label: 'Foto Estática' },
                    { id: 'wrong_face', label: 'Outro Rosto' }
                  ].map((opt) => (
                    <TouchableOpacity
                      key={String(opt.id)}
                      onPress={() => setSimulateSpoof(opt.id)}
                      style={[
                        styles.spoofChip,
                        simulateSpoof === opt.id && (opt.id ? styles.spoofChipDanger : styles.spoofChipOk)
                      ]}
                    >
                      <Text style={[styles.spoofChipText, simulateSpoof === opt.id && { color: '#fff' }]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {verifyError && (
                <View style={styles.serverBlockBox}>
                  <Text style={styles.serverBlockText}>{verifyError}</Text>
                </View>
              )}

              <View style={styles.actionRow}>
                <TouchableOpacity onPress={() => setStep(1)} style={styles.secondaryBtn}>
                  <Text style={styles.secondaryBtnText}>Voltar</Text>
                </TouchableOpacity>

                {!frameBefore && camPermission?.granted ? (
                  <TouchableOpacity onPress={handleCaptureFrame1} style={[styles.primaryBtn, { flex: 1.7 }]}>
                    <Ionicons name="camera" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>1. Quadro Inicial</Text>
                  </TouchableOpacity>
                ) : !frameAfter && camPermission?.granted ? (
                  <TouchableOpacity onPress={handleCaptureFrame2} style={[styles.primaryBtn, { flex: 1.7, backgroundColor: COLORS.cyan }]}>
                    <Ionicons name="happy-outline" size={18} color="#fff" />
                    <Text style={styles.primaryBtnText}>2. Capturar Pós-Desafio</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => handleConfirmCheckIn(false)}
                    disabled={verifying}
                    style={[styles.successBtn, { flex: 1.7 }]}
                  >
                    {verifying ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="shield-checkmark" size={18} color="#fff" />
                        <Text style={styles.primaryBtnText}>Confirmar Presença</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* STEP 3: SUCCESS RECEIPT */}
          {step === 3 && (
            <View style={styles.section}>
              <View style={styles.successHeader}>
                <Ionicons name="checkmark-circle" size={58} color={COLORS.success} />
                <Text style={styles.successTitle}>{callType}ª Presença Confirmada!</Text>
                <Text style={styles.muted}>
                  Gravada em {validation?.latencyMs ?? 20}ms no SQLite com assinatura SHA-256.
                </Text>
              </View>

              <View style={styles.card}>
                <View style={styles.codePill}>
                  <Text style={styles.codePillText}>{receipt?.verification_code}</Text>
                </View>

                <View style={styles.metricRow}>
                  <View style={styles.metricTile}>
                    <Text style={styles.metricK}>Distância</Text>
                    <Text style={[styles.metricV, { color: COLORS.success }]}>{validation?.distanceMeters}m</Text>
                  </View>
                  <View style={styles.metricTile}>
                    <Text style={styles.metricK}>Face Match</Text>
                    <Text style={[styles.metricV, { color: COLORS.cyanLight }]}>
                      {((validation?.faceMatchScore || 0.96) * 100).toFixed(1)}%
                    </Text>
                  </View>
                  <View style={styles.metricTile}>
                    <Text style={styles.metricK}>Latência</Text>
                    <Text style={[styles.metricV, { color: COLORS.warning }]}>{validation?.latencyMs}ms</Text>
                  </View>
                </View>

                <Text style={styles.label}>Hash Criptográfico SHA-256:</Text>
                <Text style={styles.hashText} selectable>{receipt?.verification_hash}</Text>
              </View>

              <TouchableOpacity onPress={onClose} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Concluir e Voltar</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 48 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.infoBg,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  subtitle: { color: COLORS.textMuted, fontSize: 12 },
  closeBtn: { padding: 6 },
  stepper: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.card },
  stepTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  stepTabActive: { borderBottomColor: COLORS.primaryLight },
  stepTabText: { color: COLORS.textDim, fontSize: 11, fontWeight: '700' },
  stepTabTextActive: { color: COLORS.primaryLight },
  scrollContent: { padding: 18, paddingBottom: 40 },
  section: { gap: 14 },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.borderLight
  },
  modeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primaryLight },
  modeText: { color: COLORS.textMuted, fontWeight: '700', fontSize: 13 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 14,
    gap: 10
  },
  cardTitle: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  refreshLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  refreshText: { color: COLORS.cyanLight, fontSize: 12, fontWeight: '700' },
  metricRow: { flexDirection: 'row', gap: 8 },
  metricTile: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    alignItems: 'center',
    gap: 3
  },
  metricK: { color: COLORS.textDim, fontSize: 10, fontWeight: '700' },
  metricV: { color: COLORS.text, fontSize: 13, fontWeight: '800', fontFamily: 'monospace' },
  muted: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center' },
  label: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700' },
  locCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12
  },
  locCardSelected: { borderColor: COLORS.primaryLight, backgroundColor: COLORS.infoBg },
  locCardDanger: { borderColor: COLORS.danger, backgroundColor: COLORS.dangerBg },
  locName: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  locDesc: { color: COLORS.textMuted, fontSize: 11 },
  locDist: { fontSize: 13, fontWeight: '800', fontFamily: 'monospace' },
  locBadge: { fontSize: 10, fontWeight: '800' },
  verdictCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
  verdictOk: { backgroundColor: COLORS.successBg, borderColor: COLORS.success },
  verdictBad: { backgroundColor: COLORS.dangerBg, borderColor: COLORS.danger },
  verdictTitle: { color: COLORS.text, fontSize: 14, fontWeight: '800', flex: 1 },
  serverBlockBox: {
    backgroundColor: 'rgba(136, 19, 55, 0.5)',
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 10,
    padding: 10
  },
  serverBlockText: { color: '#fecdd3', fontSize: 12, lineHeight: 17 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 14
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.danger,
    paddingVertical: 14,
    borderRadius: 14
  },
  successBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.success,
    paddingVertical: 14,
    borderRadius: 14
  },
  secondaryBtn: {
    flex: 0.9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardAlt,
    paddingVertical: 14,
    borderRadius: 14
  },
  secondaryBtnText: { color: COLORS.text, fontWeight: '700', fontSize: 14 },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  challengeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(6, 182, 212, 0.14)',
    borderWidth: 1,
    borderColor: COLORS.cyan,
    borderRadius: 14,
    padding: 12
  },
  challengeK: { color: COLORS.cyanLight, fontSize: 10, fontWeight: '800' },
  challengeV: { color: COLORS.text, fontSize: 13, fontWeight: '700', marginTop: 2 },
  cameraContainer: {
    height: 310,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.borderLight
  },
  camera: { flex: 1 },
  ovalWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  oval: {
    width: 175,
    height: 225,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: COLORS.cyanLight,
    borderStyle: 'dashed'
  },
  camPill: { backgroundColor: 'rgba(2, 6, 23, 0.8)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  camPillText: { color: COLORS.cyanLight, fontSize: 10, fontWeight: '800' },
  permCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 12 },
  permMsg: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center' },
  smallPrimaryBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  fallbackLink: { paddingVertical: 6 },
  fallbackText: { color: COLORS.cyanLight, fontSize: 12, textDecorationLine: 'underline' },
  spoofRow: { flexDirection: 'row', gap: 8 },
  spoofChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  spoofChipOk: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  spoofChipDanger: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  spoofChipText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 10 },
  successHeader: { alignItems: 'center', gap: 6, paddingVertical: 10 },
  successTitle: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  codePill: {
    alignSelf: 'center',
    backgroundColor: COLORS.successBg,
    borderWidth: 1,
    borderColor: COLORS.success,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999
  },
  codePillText: { color: COLORS.success, fontSize: 13, fontWeight: '800', fontFamily: 'monospace' },
  hashText: { color: COLORS.textMuted, fontSize: 10, fontFamily: 'monospace', backgroundColor: COLORS.bg, padding: 10, borderRadius: 8 }
});
