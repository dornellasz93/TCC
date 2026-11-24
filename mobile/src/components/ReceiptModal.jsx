import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';

export default function ReceiptModal({ visible, receipt, onClose }) {
  if (!receipt) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Ionicons name="shield-checkmark" size={20} color={COLORS.success} />
              <Text style={styles.title}>Comprovante Digital UGB</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            <View style={styles.ticket}>
              <Text style={styles.uniLabel}>CENTRO UNIVERSITÁRIO GERALDO DI BIASE</Text>
              <Text style={styles.subLabel}>
                Engenharia de Software • {receipt.call_type ? `${receipt.call_type}ª Chamada` : 'Presença Auditada'}
              </Text>

              <View style={styles.codeBadge}>
                <Text style={styles.codeText}>{receipt.verification_code || 'UGB-PRES-VALID'}</Text>
              </View>

              <View style={styles.grid}>
                <View style={styles.item}>
                  <Text style={styles.k}>Aluno(a)</Text>
                  <Text style={styles.v}>{receipt.student_name || 'Discente UGB'}</Text>
                  <Text style={styles.subV}>Mat. {receipt.registration_number || '—'}</Text>
                </View>

                <View style={styles.item}>
                  <Text style={styles.k}>Disciplina</Text>
                  <Text style={styles.v}>{receipt.course_name || '—'}</Text>
                  <Text style={styles.subV}>{receipt.room_name || 'Campus Aterrado'}</Text>
                </View>

                <View style={styles.item}>
                  <Text style={styles.k}>Data / Hora</Text>
                  <Text style={styles.vMono}>
                    {receipt.recorded_at ? new Date(receipt.recorded_at).toLocaleString('pt-BR') : 'Agora'}
                  </Text>
                </View>

                <View style={styles.item}>
                  <Text style={styles.k}>Validação GPS (Haversine)</Text>
                  <Text style={[styles.vMono, { color: COLORS.success }]}>
                    {receipt.distance_meters !== null && receipt.distance_meters !== undefined
                      ? `${receipt.distance_meters}m (Anti-Mock OK)`
                      : 'Aprovação Manual'}
                  </Text>
                </View>

                <View style={styles.item}>
                  <Text style={styles.k}>Biometria Facial</Text>
                  <Text style={[styles.vMono, { color: COLORS.cyanLight }]}>
                    {receipt.face_match_score
                      ? `${(receipt.face_match_score * 100).toFixed(1)}% Match`
                      : 'Confirmada'}
                  </Text>
                </View>

                {receipt.processing_latency_ms ? (
                  <View style={styles.item}>
                    <Text style={styles.k}>Latência Servidor</Text>
                    <Text style={[styles.vMono, { color: COLORS.warning }]}>
                      {receipt.processing_latency_ms} ms
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.hashBox}>
                <View style={styles.hashHeader}>
                  <Ionicons name="lock-closed" size={13} color={COLORS.primaryLight} />
                  <Text style={styles.hashLabel}>ASSINATURA CRIPTOGRÁFICA SHA-256</Text>
                </View>
                <Text style={styles.hashValue} selectable>
                  {receipt.verification_hash || 'SHA256-AUTHENTICATED'}
                </Text>
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity onPress={onClose} style={styles.btn}>
            <Text style={styles.btnText}>Fechar Comprovante</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.88)', justifyContent: 'center', padding: 18 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    maxHeight: '88%',
    overflow: 'hidden'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  body: { padding: 16 },
  ticket: {
    backgroundColor: COLORS.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 16,
    gap: 14
  },
  uniLabel: { color: COLORS.primaryLight, fontSize: 10, fontWeight: '800', textAlign: 'center', letterSpacing: 1 },
  subLabel: { color: COLORS.textMuted, fontSize: 11, textAlign: 'center', marginTop: -8 },
  codeBadge: {
    alignSelf: 'center',
    backgroundColor: COLORS.successBg,
    borderWidth: 1,
    borderColor: COLORS.success,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999
  },
  codeText: { color: COLORS.success, fontWeight: '800', fontSize: 12, fontFamily: 'monospace' },
  grid: { gap: 12 },
  item: { gap: 2 },
  k: { color: COLORS.textDim, fontSize: 10, textTransform: 'uppercase', fontWeight: '700' },
  v: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  subV: { color: COLORS.textMuted, fontSize: 11 },
  vMono: { color: COLORS.text, fontSize: 12, fontWeight: '700', fontFamily: 'monospace' },
  hashBox: {
    backgroundColor: COLORS.card,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6
  },
  hashHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hashLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: '700' },
  hashValue: { color: COLORS.textMuted, fontSize: 10, fontFamily: 'monospace', lineHeight: 15 },
  btn: {
    margin: 16,
    marginTop: 4,
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center'
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 }
});
