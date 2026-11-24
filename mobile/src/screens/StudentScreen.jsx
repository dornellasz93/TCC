import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { apiRequest } from '../services/api';
import { useCountdown } from '../utils/useCountdown';
import CheckInModal from '../components/CheckInModal';
import FaceEnrollModal from '../components/FaceEnrollModal';
import ReceiptModal from '../components/ReceiptModal';
import ServerConfigModal from '../components/ServerConfigModal';

function CallCard({ title, callType, status, expiresAt, closedAt, attendance, isBlocked, blockedReason, onCheckIn, onViewReceipt, onExpire }) {
  const isRegistered = attendance?.status === 'present' || attendance?.status === 'manual_approved';
  const isOpen = status === 'open';
  const countdown = useCountdown(isOpen ? expiresAt : null, onExpire);

  return (
    <View style={[
      styles.callCard,
      isRegistered ? styles.callCardDone : isOpen ? styles.callCardOpen : styles.callCardClosed
    ]}>
      <View style={styles.rowBetween}>
        <Text style={styles.callTitle}>{title}</Text>
        <View style={[
          styles.badge,
          isRegistered ? styles.badgeOk : isOpen ? styles.badgeWarn : styles.badgeDim
        ]}>
          <Text style={[
            styles.badgeText,
            { color: isRegistered ? COLORS.success : isOpen ? COLORS.warning : COLORS.textMuted }
          ]}>
            {isRegistered ? 'CONFIRMADA' : isOpen ? `⏳ ${countdown.formatted}` : isBlocked ? 'BLOQUEADA' : 'FECHADA'}
          </Text>
        </View>
      </View>

      <Text style={styles.callDesc}>
        {isRegistered
          ? `Validada (${attendance.distance_meters ?? 'Manual'}m • ${attendance.face_match_score ? `${(attendance.face_match_score * 100).toFixed(0)}% Face` : 'Manual'})`
          : isOpen
            ? 'Chamada aberta pelo professor! Valide seu GPS e Biometria antes do prazo encerrar.'
            : isBlocked
              ? blockedReason
              : closedAt
                ? `Encerrada às ${new Date(closedAt).toLocaleTimeString('pt-BR')}.`
                : 'Aguardando professor liberar a chamada.'}
      </Text>

      {isRegistered ? (
        <TouchableOpacity onPress={onViewReceipt} style={styles.receiptBtn}>
          <Ionicons name="qr-code-outline" size={16} color={COLORS.success} />
          <Text style={styles.receiptBtnText}>Ver Comprovante ({callType}ª Presença)</Text>
        </TouchableOpacity>
      ) : isOpen ? (
        <TouchableOpacity onPress={onCheckIn} style={styles.checkInBtn}>
          <Ionicons name="scan" size={17} color="#fff" />
          <Text style={styles.checkInBtnText}>Registrar {callType}ª Presença (GPS + Face)</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.lockedBtn}>
          <Ionicons name={isBlocked ? 'lock-closed-outline' : 'time-outline'} size={15} color={COLORS.textDim} />
          <Text style={styles.lockedBtnText}>{isBlocked ? 'Aguardando 1ª Presença' : 'Indisponível no momento'}</Text>
        </View>
      )}
    </View>
  );
}

export default function StudentScreen({ user, onUserUpdated, onLogout }) {
  const [tab, setTab] = useState('classes'); // 'classes' | 'history'
  const [sessions, setSessions] = useState([]);
  const [history, setHistory] = useState([]);
  const [courseStats, setCourseStats] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const [checkInTarget, setCheckInTarget] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showFaceEnroll, setShowFaceEnroll] = useState(false);
  const [showServerModal, setShowServerModal] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setRefreshing(true);
    const [resSessions, resHistory] = await Promise.all([
      apiRequest(`/api/sessions?studentId=${user.id}`),
      apiRequest(`/api/attendance/history/${user.id}`)
    ]);
    if (resSessions.ok && resSessions.data?.success) {
      setSessions(resSessions.data.sessions || []);
    }
    if (resHistory.ok && resHistory.data?.success) {
      setHistory(resHistory.data.history || []);
      setCourseStats(resHistory.data.courseStats || []);
    }
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>UGB <Text style={{ color: COLORS.primaryLight }}>PRESENÇA</Text></Text>
          <Text style={styles.userSub} numberOfLines={1}>
            {user.name} • Mat. {user.registration_number}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowServerModal(true)} style={styles.iconBtn}>
          <Ionicons name="server-outline" size={19} color={COLORS.cyanLight} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onLogout} style={styles.iconBtn}>
          <Ionicons name="log-out-outline" size={19} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity onPress={() => setTab('classes')} style={[styles.tab, tab === 'classes' && styles.tabActive]}>
          <Ionicons name="today-outline" size={16} color={tab === 'classes' ? '#fff' : COLORS.textMuted} />
          <Text style={[styles.tabText, tab === 'classes' && { color: '#fff' }]}>Aulas de Hoje</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('history')} style={[styles.tab, tab === 'history' && styles.tabActive]}>
          <Ionicons name="stats-chart-outline" size={16} color={tab === 'history' ? '#fff' : COLORS.textMuted} />
          <Text style={[styles.tabText, tab === 'history' && { color: '#fff' }]}>Extrato ({history.length})</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} tintColor={COLORS.primaryLight} />}
      >
        {/* Biometric Enrollment Banner */}
        <TouchableOpacity
          onPress={() => setShowFaceEnroll(true)}
          style={[styles.bioBanner, user.face_registered ? styles.bioBannerOk : styles.bioBannerPending]}
        >
          <Ionicons
            name={user.face_registered ? 'shield-checkmark' : 'camera'}
            size={22}
            color={user.face_registered ? COLORS.success : COLORS.cyanLight}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.bioTitle}>
              {user.face_registered ? 'Biometria Facial Ativa no SQLite' : 'Cadastre sua Biometria Facial'}
            </Text>
            <Text style={styles.bioSub}>
              {user.face_registered
                ? 'Toque para atualizar seu vetor biométrico de referência.'
                : 'Toque para capturar sua face real pela câmera frontal.'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>

        {tab === 'classes' ? (
          sessions.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="time-outline" size={40} color={COLORS.textDim} />
              <Text style={styles.emptyText}>Nenhuma aula ativa no momento.</Text>
            </View>
          ) : (
            sessions.map((s) => {
              const isP2Blocked = !s.p1_opened_at || s.status_p1 === 'open';
              const blockedReason = !s.p1_opened_at
                ? 'A 1ª presença ainda não foi aberta pelo professor.'
                : 'A 2ª presença será liberada após o encerramento da 1ª chamada.';

              return (
                <View key={s.id} style={styles.sessionCard}>
                  <View style={styles.rowBetween}>
                    <View style={styles.coursePill}>
                      <Text style={styles.coursePillText}>{s.course_code}</Text>
                    </View>
                    <Text style={styles.roomText}>{s.room_block} • Raio {s.custom_radius_meters}m</Text>
                  </View>

                  <Text style={styles.courseName}>{s.course_name}</Text>
                  <Text style={styles.sessionSub}>{s.title}</Text>
                  <Text style={styles.roomMeta}>
                    📍 {s.room_name} • {s.teacher_name}
                  </Text>

                  <CallCard
                    title="1ª Presença (Início da Aula)"
                    callType={1}
                    status={s.status_p1}
                    expiresAt={s.p1_expires_at}
                    closedAt={s.p1_closed_at}
                    attendance={s.student_p1}
                    isBlocked={false}
                    onExpire={loadData}
                    onCheckIn={() => setCheckInTarget({ session: s, callType: 1 })}
                    onViewReceipt={() => setSelectedReceipt({
                      ...s.student_p1,
                      call_type: 1,
                      student_name: user.name,
                      registration_number: user.registration_number,
                      course_name: s.course_name,
                      room_name: s.room_name
                    })}
                  />

                  <CallCard
                    title="2ª Presença (Final da Aula)"
                    callType={2}
                    status={s.status_p2}
                    expiresAt={s.p2_expires_at}
                    closedAt={s.p2_closed_at}
                    attendance={s.student_p2}
                    isBlocked={isP2Blocked}
                    blockedReason={blockedReason}
                    onExpire={loadData}
                    onCheckIn={() => setCheckInTarget({ session: s, callType: 2 })}
                    onViewReceipt={() => setSelectedReceipt({
                      ...s.student_p2,
                      call_type: 2,
                      student_name: user.name,
                      registration_number: user.registration_number,
                      course_name: s.course_name,
                      room_name: s.room_name
                    })}
                  />
                </View>
              );
            })
          )
        ) : (
          <View style={{ gap: 12 }}>
            {courseStats.map((c) => (
              <View key={c.id} style={styles.statCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.courseNameSmall}>{c.name}</Text>
                  <Text style={[styles.pctText, { color: c.percentage >= 75 ? COLORS.success : COLORS.warning }]}>
                    {c.percentage}%
                  </Text>
                </View>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${Math.min(100, c.percentage)}%` }]} />
                </View>
                <Text style={styles.mutedLeft}>{c.attended_calls} de {c.total_calls} chamadas registradas</Text>
              </View>
            ))}

            <Text style={styles.sectionTitle}>Histórico Detalhado</Text>
            {history.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma presença registrada ainda.</Text>
            ) : (
              history.map((h) => (
                <TouchableOpacity
                  key={h.id}
                  onPress={() => setSelectedReceipt({ ...h, student_name: user.name, registration_number: user.registration_number })}
                  style={styles.histCard}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.histCourse}>{h.course_name} ({h.call_type}ª)</Text>
                    <Text style={styles.histSub}>
                      {new Date(h.recorded_at).toLocaleString('pt-BR')} • {h.distance_meters !== null ? `${h.distance_meters}m` : 'Manual'}
                    </Text>
                  </View>
                  <Ionicons name="qr-code-outline" size={20} color={COLORS.primaryLight} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <CheckInModal
        visible={Boolean(checkInTarget)}
        session={checkInTarget?.session}
        student={user}
        callType={checkInTarget?.callType || 1}
        onClose={() => setCheckInTarget(null)}
        onSuccess={loadData}
      />

      <FaceEnrollModal
        visible={showFaceEnroll}
        student={user}
        onClose={() => setShowFaceEnroll(false)}
        onEnrolled={(updated) => {
          if (onUserUpdated) onUserUpdated(updated);
        }}
      />

      <ReceiptModal
        visible={Boolean(selectedReceipt)}
        receipt={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
      />

      <ServerConfigModal
        visible={showServerModal}
        onClose={() => setShowServerModal(false)}
        onSaved={loadData}
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
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primaryLight },
  tabText: { color: COLORS.textMuted, fontWeight: '700', fontSize: 13 },
  scroll: { padding: 16, paddingTop: 4, gap: 14, paddingBottom: 40 },
  bioBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1
  },
  bioBannerOk: { backgroundColor: COLORS.successBg, borderColor: COLORS.success },
  bioBannerPending: { backgroundColor: 'rgba(6, 182, 212, 0.12)', borderColor: COLORS.cyan },
  bioTitle: { color: COLORS.text, fontSize: 13, fontWeight: '800' },
  bioSub: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  sessionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 16,
    gap: 10
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  coursePill: { backgroundColor: COLORS.infoBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  coursePillText: { color: COLORS.primaryLight, fontSize: 11, fontWeight: '800' },
  roomText: { color: COLORS.textMuted, fontSize: 11, fontFamily: 'monospace' },
  courseName: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  sessionSub: { color: COLORS.textMuted, fontSize: 12 },
  roomMeta: { color: COLORS.textDim, fontSize: 11, marginBottom: 4 },
  callCard: { borderRadius: 14, borderWidth: 1, padding: 13, gap: 10 },
  callCardOpen: { backgroundColor: COLORS.infoBg, borderColor: COLORS.primaryLight },
  callCardDone: { backgroundColor: COLORS.successBg, borderColor: COLORS.success },
  callCardClosed: { backgroundColor: COLORS.bg, borderColor: COLORS.border },
  callTitle: { color: COLORS.text, fontSize: 13, fontWeight: '800', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeOk: { backgroundColor: 'rgba(16,185,129,0.2)' },
  badgeWarn: { backgroundColor: 'rgba(245,158,11,0.2)' },
  badgeDim: { backgroundColor: COLORS.cardAlt },
  badgeText: { fontSize: 10, fontWeight: '800', fontFamily: 'monospace' },
  callDesc: { color: COLORS.textMuted, fontSize: 12, lineHeight: 17 },
  checkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 12
  },
  checkInBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.success,
    paddingVertical: 10,
    borderRadius: 12
  },
  receiptBtnText: { color: COLORS.success, fontSize: 12, fontWeight: '800' },
  lockedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.card,
    paddingVertical: 10,
    borderRadius: 12
  },
  lockedBtnText: { color: COLORS.textDim, fontSize: 12, fontWeight: '600' },
  empty: { paddingVertical: 40, alignItems: 'center', gap: 8 },
  emptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center' },
  statCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 8
  },
  courseNameSmall: { color: COLORS.text, fontSize: 13, fontWeight: '700', flex: 1 },
  pctText: { fontSize: 14, fontWeight: '800', fontFamily: 'monospace' },
  barBg: { height: 6, backgroundColor: COLORS.bg, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: COLORS.success, borderRadius: 4 },
  mutedLeft: { color: COLORS.textMuted, fontSize: 11 },
  sectionTitle: { color: COLORS.text, fontSize: 15, fontWeight: '800', marginTop: 6 },
  histCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14
  },
  histCourse: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  histSub: { color: COLORS.textMuted, fontSize: 11 }
});
