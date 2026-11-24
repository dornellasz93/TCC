import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { getServerUrl, setServerUrl, getDefaultServerUrl, testServerHealth } from '../services/api';

export default function ServerConfigModal({ visible, onClose, onSaved }) {
  const [urlInput, setUrlInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [isHealthy, setIsHealthy] = useState(null);

  useEffect(() => {
    if (visible) {
      getServerUrl().then(setUrlInput);
      setStatusMsg(null);
      setIsHealthy(null);
    }
  }, [visible]);

  const handleTest = async () => {
    setTesting(true);
    setStatusMsg(null);
    const res = await testServerHealth(urlInput);
    setTesting(false);
    if (res.ok && res.data?.status === 'online') {
      setIsHealthy(true);
      setStatusMsg(
        `Servidor Online (${res.latencyMs}ms) • SQLite: ${res.data.database?.users || 0} usuários, ${res.data.database?.sessions || 0} sessões.`
      );
    } else {
      setIsHealthy(false);
      setStatusMsg(res.data?.message || 'Não foi possível alcançar /api/health.');
    }
  };

  const handleSave = async () => {
    const saved = await setServerUrl(urlInput);
    if (onSaved) onSaved(saved);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="server-outline" size={20} color={COLORS.cyanLight} />
              <Text style={styles.title}>Servidor Docker / API</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.desc}>
            Informe o IP local do seu servidor doméstico/notebook (ex: http://192.168.1.50:5000) ou domínio HTTPS (Cloudflare Tunnel).
          </Text>

          <Text style={styles.label}>URL Base do Servidor</Text>
          <TextInput
            value={urlInput}
            onChangeText={setUrlInput}
            placeholder="http://192.168.0.100:5000"
            placeholderTextColor={COLORS.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={styles.input}
          />

          <TouchableOpacity
            onPress={() => setUrlInput(getDefaultServerUrl())}
            style={styles.autoBtn}
          >
            <Ionicons name="sparkles-outline" size={14} color={COLORS.primaryLight} />
            <Text style={styles.autoBtnText}>Detectar IP automático ({getDefaultServerUrl()})</Text>
          </TouchableOpacity>

          {statusMsg && (
            <View style={[styles.statusBox, isHealthy ? styles.statusOk : styles.statusErr]}>
              <Ionicons
                name={isHealthy ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={isHealthy ? COLORS.success : COLORS.danger}
              />
              <Text style={[styles.statusText, { color: isHealthy ? '#a7f3d0' : '#fecdd3' }]}>
                {statusMsg}
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity onPress={handleTest} disabled={testing} style={styles.testBtn}>
              {testing ? (
                <ActivityIndicator size="small" color={COLORS.cyanLight} />
              ) : (
                <>
                  <Ionicons name="pulse-outline" size={16} color={COLORS.cyanLight} />
                  <Text style={styles.testBtnText}>Testar</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
              <Ionicons name="checkmark-outline" size={18} color="#fff" />
              <Text style={styles.saveBtnText}>Salvar &amp; Conectar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'center',
    padding: 20
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 20,
    gap: 12
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  closeBtn: { padding: 4 },
  desc: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18 },
  label: { color: COLORS.text, fontSize: 12, fontWeight: '600', marginTop: 4 },
  input: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 14
  },
  autoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  autoBtnText: { color: COLORS.primaryLight, fontSize: 12, fontWeight: '600' },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1
  },
  statusOk: { backgroundColor: COLORS.successBg, borderColor: COLORS.success },
  statusErr: { backgroundColor: COLORS.dangerBg, borderColor: COLORS.danger },
  statusText: { flex: 1, fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  testBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.cardAlt,
    borderWidth: 1,
    borderColor: COLORS.cyan
  },
  testBtnText: { color: COLORS.cyanLight, fontWeight: '700', fontSize: 13 },
  saveBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primary
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 }
});
