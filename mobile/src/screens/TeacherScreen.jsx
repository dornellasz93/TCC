import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { apiRequest } from '../services/api';
import { useCountdown } from '../utils/useCountdown';
import ServerConfigModal from '../components/ServerConfigModal';

function TeacherCallControl({ title, callType, status, expiresAt, presentCount, totalStudents, disabled, onToggle }) {
  const isOpen = status === 'open';
  const countdown = useCountdown(isOpen ? expiresAt : null);

  return (
    <View style={[styles.ctrlCard, isOpen && styles.ctrlCardOpen]}>
      <View style={styles.rowBetween}>
        <Text style={styles.ctrlTitle}>{title}</Text>
        <Text style={styles.ctrlCount}>{presentCount}/{totalStudents}</Text>
      </View>

      {isOpen && (
        <Text style={styles.countdown}>⏳ Aberta — Restam {countdown.formatted}</Text>
      )}

      <TouchableOpacity
        disabled={disabled}
        onPress={onToggle}
        style={[
          styles.ctrlBtn,
          isOpen ? styles.btnWarn : disabled ? styles.btnDisabled : callType === 1 ? styles.btnSuccess : styles.btnPrimary
        ]}
      >
        <Ionicons name={isOpen ? 'stop-circle' : disabled ? 'lock-closed' : 'play-circle'} size={18} color="#fff" />
        <Text style={styles.btnText}>
          {isOpen ? 'Encerrar Chamada' : disabled ? 'Aguardando 1ª Presença' : `Abrir ${callType}ª Presença (20 min)`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function TeacherScreen({ user, onLogout }) {
  const [tab, setTab] = useState('live'); // 'live' | 'audit' - aba ativa
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState(null);
  const [audit, setAudit] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [showServerModal, setShowServerModal] = useState(false);

  const loadSessionDetail = async (id) => {
    const res = await apiRequest(`/api/sessions/${id}`);
    if (res.ok && res.data?.success) {
      setActiveSession(res.data.session);
      setStudents(res.data.students || []);
      setStats(res.data.stats || null);
    }
  };

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    const [resSessions, resAudit] = await Promise.all([
      apiRequest(`/api/sessions?teacherId=${user.id}`),
      apiRequest('/api/analytics/dashboard')
    ]);
    if (resSessions.ok && resSessions.data?.success) {
      const list = resSessions.data.sessions || [];
      setSessions(list);
      if (list.length > 0) {
        const idToLoad = activeSession?.id || list[0].id;
        await loadSessionDetail(idToLoad);
      }
    }
    if (resAudit.ok && resAudit.data?.success) {
      setAudit(resAudit.data);
    }
    setRefreshing(false);
  }, [user.id, activeSession?.id]);

  useEffect(() => {
    loadAll();
    const timer = setInterval(loadAll, 10000);
    return () => clearInterval(timer);
  }, [loadAll]);

  const handleToggle = async (callType) => {
    if (!activeSession) return;
    const endpoint = callType === 1
      ? `/api/sessions/${activeSession.id}/toggle-p1`
      : `/api/sessions/${activeSession.id}/toggle-p2`;
    const res = await apiRequest(endpoint, { method: 'PATCH' });
    if (res.ok && res.data?.success) {
      Alert.alert('Chamada Atualizada', res.data.message);
      loadSessionDetail(activeSession.id);
    } else {
      Alert.alert('Atenção', res.data?.message || 'Não foi possível alterar a chamada.');
    }
  };

  const handleCalibrateRoomWithPhoneGps = async () => {
    if (!activeSession) return;
    setCalibrating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('GPS Negado', 'Permita acesso à localização para calibrar a sala.');
        setCalibrating(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const res = await apiRequest(`/api/rooms/${activeSession.room_id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        })
      });
      if (res.ok && res.data?.success) {
        Alert.alert('GPS da Sala Calibrado!', res.data.message);
        loadSessionDetail(activeSession.id);
      } else {
        Alert.alert('Erro', res.data?.message || 'Falha ao calibrar sala.');
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível capturar o GPS deste celular.');
    } finally {
      setCalibrating(false);
    }
  };

  const handleManualApprove = async (studentId, callType) => {
    if (!activeSession) return;
    const res = await apiRequest('/api/attendance/manual-approve', {
      method: 'POST',
      body: JSON.stringify({
        session_id: activeSession.id,
        student_id: studentId,
        call_type: callType
      })
    });
    if (res.ok && res.data?.success) {
      Alert.alert('Presença Aprovada', res.data.message);
      loadSessionDetail(activeSession.id);
    }
  };

  const canOpenP2 = Boolean(activeSession?.p1_opened_at && activeSession?.status_p1 === 'closed');
  const m = audit?.metrics || {};

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>UGB <Text style={{ color: COLORS.purpleLight }}>DOCENTE</Text></Text>
          <Text style={styles.userSub} numberOfLines={1}>{user.name}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowServerModal(true)} style={styles.iconBtn}>
          <Ionicons name="server-outline" size={19} color={COLORS.cyanLight} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onLogout} style={styles.iconBtn}>
          <Ionicons name="log-out-outline" size={19} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity onPress={() => setTab('live')} style={[styles.tab, tab === 'live' && styles.tabActive]}>
          <Ionicons name="people-outline" size={16} color={tab === 'live' ? '#fff' : COLORS.textMuted} />
          <Text style={[styles.tabText, tab === 'live' && { color: '#fff' }]}>Chamadas</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('audit')} style={[styles.tab, tab === 'audit' && styles.tabActiveAudit]}>
          <Ionicons name="shield-checkmark-outline" size={16} color={tab === 'audit' ? '#fff' : COLORS.textMuted} />
          <Text style={[styles.tabText, tab === 'audit' && { color: '#fff' }]}>Auditoria &amp; KPIs</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadAll} tintColor={COLORS.purpleLight} />}
      >
        {tab === 'live' ? (
          activeSession ? (
            <>
              <View style={styles.card}>
                <Text style={styles.badgeText}>{activeSession.course_code}</Text>
                <Text style={styles.courseTitle}>{activeSession.course_name}</Text>
                <Text style={styles.muted}>
                  📍 {activeSession.room_name} • Raio: {activeSession.custom_radius_meters}m • Limiar Face: {Math.round((activeSession.biometric_threshold || 0.72) * 100)}%
                </Text>

                <TouchableOpacity onPress={handleCalibrateRoomWithPhoneGps} disabled={calibrating} style={styles.calibrateBtn}>
                  {calibrating ? (
                    <ActivityIndicator size="small" color={COLORS.cyanLight} />
                  ) : (
                    <>
                      <Ionicons name="locate" size={16} color={COLORS.cyanLight} />
                      <Text style={styles.calibrateText}>Calibrar GPS desta Sala com Este Celular</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <TeacherCallControl
                title="1ª Presença (Início da Aula)"
                callType={1}
                status={activeSession.status_p1}
                expiresAt={activeSession.p1_expires_at}
                presentCount={stats?.p1PresentCount || 0}
                totalStudents={stats?.totalStudents || 0}
                disabled={false}
                onToggle={() => handleToggle(1)}
              />

              <TeacherCallControl
                title="2ª Presença (Final da Aula)"
                callType={2}
                status={activeSession.status_p2}
                expiresAt={activeSession.p2_expires_at}
                presentCount={stats?.p2PresentCount || 0}
                totalStudents={stats?.totalStudents || 0}
                disabled={activeSession.status_p2 === 'closed' && !canOpenP2}
                onToggle={() => handleToggle(2)}
              />

              <Text style={styles.sectionTitle}>Alunos Matriculados ({students.length})</Text>
              {students.map((st) => {
                const p1Ok = st.p1_status === 'present' || st.p1_status === 'manual_approved';
                const p2Ok = st.p2_status === 'present' || st.p2_status === 'manual_approved';
                return (
                  <View key={st.id} style={styles.studentRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stName}>{st.name}</Text>
                      <Text style={styles.stMeta}>Mat. {st.registration_number}</Text>
                    </View>
                    <View style={styles.stBadges}>
                      <TouchableOpacity
                        disabled={p1Ok}
                        onPress={() => handleManualApprove(st.id, 1)}
                        style={[styles.miniPill, p1Ok ? styles.miniOk : styles.miniAbsent]}
                      >
                        <Text style={[styles.miniText, { color: p1Ok ? COLORS.success : COLORS.danger }]}>
                          P1 {p1Ok ? '✓' : '+'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        disabled={p2Ok}
                        onPress={() => handleManualApprove(st.id, 2)}
                        style={[styles.miniPill, p2Ok ? styles.miniOk : styles.miniAbsent]}
                      >
                        <Text style={[styles.miniText, { color: p2Ok ? COLORS.cyanLight : COLORS.danger }]}>
                          P2 {p2Ok ? '✓' : '+'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </>
          ) : (
            <Text style={styles.muted}>Nenhuma sessão encontrada para este professor.</Text>
          )
        ) : (
          <>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiK}>Presenças</Text>
                <Text style={styles.kpiV}>{m.totalAttendances ?? 0}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiK}>Fraudes Bloq.</Text>
                <Text style={[styles.kpiV, { color: COLORS.danger }]}>{m.blockedFraudAttempts ?? 0}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiK}>Latência API</Text>
                <Text style={[styles.kpiV, { color: COLORS.warning }]}>{m.avgLatencyMs ?? 28}ms</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiK}>Tempo Salvo</Text>
                <Text style={[styles.kpiV, { color: COLORS.success }]}>~{m.estimatedTimeSavedMinutes ?? 15}m</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Logs Recentes de Auditoria</Text>
            {(audit?.recentLogs || []).slice(0, 15).map((log) => (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.logAction}>{log.action}</Text>
                  <Text style={[styles.logStatus, { color: log.status === 'SUCCESS' ? COLORS.success : COLORS.danger }]}>
                    {log.status}
                  </Text>
                </View>
                <Text style={styles.logDetails}>{log.details}</Text>
                <Text style={styles.logMeta}>
                  {log.user_name || 'Sistema'} • {new Date(log.created_at).toLocaleTimeString('pt-BR')}
                  {log.latency_ms ? ` • ${log.latency_ms}ms` : ''}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <ServerConfigModal
        visible={showServerModal}
        onClose={() => setShowServerModal(false)}
        onSaved={loadAll}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  brand: { color: COLORS.text, fontSize: 18, fontWeight: '900' },
  userSub: { color: COLORS.textMuted, fontSize: 12 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tabs: { flexDirection: 'row', padding: 12, gap: 10 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  tabActive: { backgroundColor: COLORS.purple, borderColor: COLORS.purpleLight },
  tabActiveAudit: { backgroundColor: COLORS.cyan, borderColor: COLORS.cyanLight },
  tabText: { color: COLORS.textMuted, fontWeight: '700', fontSize: 13 },
  scroll: { padding: 16, paddingTop: 4, gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 16,
    gap: 8
  },
  badgeText: { color: COLORS.primaryLight, fontSize: 11, fontWeight: '800' },
  courseTitle: { color: COLORS.text, fontSize: 17, fontWeight: '800' },
  muted: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },
  calibrateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(6, 182, 212, 0.14)',
    borderWidth: 1,
    borderColor: COLORS.cyan
  },
  calibrateText: { color: COLORS.cyanLight, fontSize: 12, fontWeight: '800' },
  ctrlCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
    gap: 10
  },
  ctrlCardOpen: { borderColor: COLORS.success, backgroundColor: COLORS.successBg },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  ctrlTitle: { color: COLORS.text, fontSize: 14, fontWeight: '800', flex: 1 },
  ctrlCount: { color: COLORS.success, fontSize: 16, fontWeight: '900', fontFamily: 'monospace' },
  countdown: { color: COLORS.success, fontSize: 12, fontWeight: '800', fontFamily: 'monospace' },
  ctrlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12
  },
  btnSuccess: { backgroundColor: COLORS.success },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnWarn: { backgroundColor: COLORS.warning },
  btnDisabled: { backgroundColor: COLORS.cardAlt, opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  sectionTitle: { color: COLORS.text, fontSize: 15, fontWeight: '800', marginTop: 6 },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13
  },
  stName: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  stMeta: { color: COLORS.textMuted, fontSize: 11, fontFamily: 'monospace' },
  stBadges: { flexDirection: 'row', gap: 6 },
  miniPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  miniOk: { backgroundColor: COLORS.successBg, borderColor: COLORS.success },
  miniAbsent: { backgroundColor: COLORS.dangerBg, borderColor: COLORS.danger },
  miniText: { fontSize: 11, fontWeight: '800', fontFamily: 'monospace' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 14,
    gap: 4
  },
  kpiK: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700' },
  kpiV: { color: COLORS.text, fontSize: 22, fontWeight: '900', fontFamily: 'monospace' },
  logCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
    gap: 4
  },
  logAction: { color: COLORS.text, fontSize: 12, fontWeight: '800', fontFamily: 'monospace', flex: 1 },
  logStatus: { fontSize: 10, fontWeight: '900' },
  logDetails: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },
  logMeta: { color: COLORS.textDim, fontSize: 10 }
});
