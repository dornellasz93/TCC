import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { apiRequest, getServerUrl, saveAuthSession } from '../services/api';
import ServerConfigModal from '../components/ServerConfigModal';

export default function AuthScreen({ onAuthenticated }) {
  const [role, setRole] = useState('student'); // 'student' | 'teacher'
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [serverUrl, setServerUrlState] = useState('');
  const [showServerModal, setShowServerModal] = useState(false);

  // Demo users fetched from server
  const [demoUsers, setDemoUsers] = useState([]);
  const [serverOnline, setServerOnline] = useState(null);

  // Form states
  const [loginId, setLoginId] = useState('2024102278');
  const [password, setPassword] = useState('123');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadServerInfo = async () => {
    const url = await getServerUrl();
    setServerUrlState(url);
    const res = await apiRequest('/api/auth/users', { method: 'GET', timeoutMs: 5000 });
    if (res.ok && res.data?.success) {
      setDemoUsers(res.data.users || []);
      setServerOnline(true);
    } else {
      setServerOnline(false);
    }
  };

  useEffect(() => {
    loadServerInfo();
  }, []);

  const handleLogin = async () => {
    setError(null);
    if (!loginId.trim() || !password) {
      setError('Informe matrícula/e-mail e senha.');
      return;
    }
    setLoading(true);
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login: loginId.trim(), password, expectedRole: role })
    });
    setLoading(false);

    if (res.ok && res.data?.success && res.data.user) {
      await saveAuthSession(res.data.user, res.data.token);
      onAuthenticated(res.data.user, res.data.token);
    } else {
      setError(res.data?.message || 'Erro ao autenticar.');
    }
  };

  const handleRegister = async () => {
    setError(null);
    if (!regName.trim() || !regEmail.trim() || !regNumber.trim() || !regPassword) {
      setError('Preencha nome, e-mail, matrícula e senha.');
      return;
    }
    setLoading(true);
    const res = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: regName.trim(),
        email: regEmail.trim(),
        registration_number: regNumber.trim(),
        password: regPassword,
        role
      })
    });
    setLoading(false);

    if (res.ok && res.data?.success && res.data.user) {
      await saveAuthSession(res.data.user, res.data.token);
      onAuthenticated(res.data.user, res.data.token);
    } else {
      setError(res.data?.message || 'Erro ao criar conta.');
    }
  };

  const handleQuickDemo = async (user) => {
    setError(null);
    setLoading(true);
    const res = await apiRequest('/api/auth/demo-login', {
      method: 'POST',
      body: JSON.stringify({ userId: user.id })
    });
    setLoading(false);
    if (res.ok && res.data?.success && res.data.user) {
      await saveAuthSession(res.data.user, res.data.token);
      onAuthenticated(res.data.user, res.data.token);
    } else {
      setError(res.data?.message || 'Não foi possível entrar no perfil demo.');
    }
  };

  const isTeacher = role === 'teacher';

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Top Server Status Pill */}
          <TouchableOpacity onPress={() => setShowServerModal(true)} style={styles.serverPill}>
            <View style={[styles.dot, { backgroundColor: serverOnline === true ? COLORS.success : serverOnline === false ? COLORS.danger : COLORS.warning }]} />
            <Text style={styles.serverPillText} numberOfLines={1}>
              {serverOnline ? `Conectado: ${serverUrl}` : `Configurar Servidor Docker (${serverUrl || '...'})`}
            </Text>
            <Ionicons name="settings-outline" size={16} color={COLORS.cyanLight} />
          </TouchableOpacity>

          {/* Brand Header */}
          <View style={styles.brand}>
            <View style={styles.logoCircle}>
              <Ionicons name="school" size={32} color={COLORS.primaryLight} />
            </View>
            <Text style={styles.brandTitle}>UGB PRESENÇA</Text>
            <Text style={styles.brandSub}>
              Geolocalização (Haversine + Anti-Mock) &amp; Reconhecimento Facial • TCC Engenharia de Software
            </Text>
          </View>

          {/* Main Card */}
          <View style={[styles.card, { borderColor: isTeacher ? COLORS.purple : COLORS.primary }]}>
            {/* Role Selector */}
            <View style={styles.roleRow}>
              <TouchableOpacity
                onPress={() => {
                  setRole('student');
                  setLoginId('2024102278');
                  setError(null);
                }}
                style={[styles.roleBtn, !isTeacher && styles.roleBtnStudent]}
              >
                <Ionicons name="person" size={18} color={!isTeacher ? '#fff' : COLORS.textMuted} />
                <Text style={[styles.roleText, !isTeacher && { color: '#fff' }]}>Aluno</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setRole('teacher');
                  setLoginId('DOC-1001');
                  setError(null);
                }}
                style={[styles.roleBtn, isTeacher && styles.roleBtnTeacher]}
              >
                <Ionicons name="briefcase" size={18} color={isTeacher ? '#fff' : COLORS.textMuted} />
                <Text style={[styles.roleText, isTeacher && { color: '#fff' }]}>Professor</Text>
              </TouchableOpacity>
            </View>

            {/* Mode Tabs */}
            <View style={styles.modeTabs}>
              <TouchableOpacity onPress={() => setMode('login')} style={[styles.modeTab, mode === 'login' && styles.modeTabActive]}>
                <Text style={[styles.modeTabText, mode === 'login' && styles.modeTabTextActive]}>ENTRAR</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMode('register')} style={[styles.modeTab, mode === 'register' && styles.modeTabActive]}>
                <Text style={[styles.modeTabText, mode === 'register' && styles.modeTabTextActive]}>CRIAR CONTA</Text>
              </TouchableOpacity>
            </View>

            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {mode === 'login' ? (
              <View style={styles.form}>
                <Text style={styles.label}>{isTeacher ? 'Matrícula Docente ou E-mail' : 'Matrícula ou E-mail'}</Text>
                <TextInput
                  value={loginId}
                  onChangeText={setLoginId}
                  placeholder={isTeacher ? 'DOC-1001' : '2024102278'}
                  placeholderTextColor={COLORS.textDim}
                  autoCapitalize="none"
                  style={styles.input}
                />

                <Text style={styles.label}>Senha (Demo: 123)</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Sua senha"
                  placeholderTextColor={COLORS.textDim}
                  secureTextEntry
                  style={styles.input}
                />

                <TouchableOpacity
                  onPress={handleLogin}
                  disabled={loading}
                  style={[styles.submitBtn, { backgroundColor: isTeacher ? COLORS.purple : COLORS.primary }]}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.submitText}>Entrar como {isTeacher ? 'Professor' : 'Aluno'}</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.form}>
                <Text style={styles.label}>Nome Completo</Text>
                <TextInput value={regName} onChangeText={setRegName} placeholder="Seu nome" placeholderTextColor={COLORS.textDim} style={styles.input} />

                <Text style={styles.label}>E-mail Acadêmico</Text>
                <TextInput value={regEmail} onChangeText={setRegEmail} placeholder="nome@ugb.edu.br" placeholderTextColor={COLORS.textDim} autoCapitalize="none" keyboardType="email-address" style={styles.input} />

                <Text style={styles.label}>Matrícula</Text>
                <TextInput value={regNumber} onChangeText={setRegNumber} placeholder={isTeacher ? 'DOC-1009' : '2024102999'} placeholderTextColor={COLORS.textDim} style={styles.input} />

                <Text style={styles.label}>Senha</Text>
                <TextInput value={regPassword} onChangeText={setRegPassword} placeholder="Crie uma senha" placeholderTextColor={COLORS.textDim} secureTextEntry style={styles.input} />

                <TouchableOpacity
                  onPress={handleRegister}
                  disabled={loading}
                  style={[styles.submitBtn, { backgroundColor: isTeacher ? COLORS.purple : COLORS.primary }]}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Finalizar Cadastro</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* Quick 1-Tap Banca Demo Buttons */}
            {demoUsers.length > 0 && (
              <View style={styles.demoSection}>
                <Text style={styles.demoTitle}>ACESSO RÁPIDO (BANCA TCC)</Text>
                <View style={styles.demoGrid}>
                  {demoUsers.slice(0, 4).map((u) => (
                    <TouchableOpacity key={u.id} onPress={() => handleQuickDemo(u)} style={styles.demoChip}>
                      <Text style={styles.demoName} numberOfLines={1}>{u.name.split(' ')[0]} {u.name.split(' ')[1] || ''}</Text>
                      <Text style={[styles.demoRole, { color: u.role === 'teacher' ? COLORS.purpleLight : COLORS.success }]}>
                        {u.role === 'teacher' ? 'Professor' : `Aluno • ${u.registration_number}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          <Text style={styles.footer}>Centro Universitário Geraldo Di Biase (UGB) • Volta Redonda - RJ • 2026</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <ServerConfigModal
        visible={showServerModal}
        onClose={() => setShowServerModal(false)}
        onSaved={() => loadServerInfo()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 18, gap: 18, paddingBottom: 40 },
  serverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  serverPillText: { flex: 1, color: COLORS.textMuted, fontSize: 12, fontWeight: '600' },
  brand: { alignItems: 'center', gap: 6, marginTop: 4 },
  logoCircle: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: COLORS.infoBg,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandTitle: { color: COLORS.text, fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  brandSub: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 16
  },
  roleRow: { flexDirection: 'row', gap: 10 },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border
  },
  roleBtnStudent: { backgroundColor: COLORS.primary, borderColor: COLORS.primaryLight },
  roleBtnTeacher: { backgroundColor: COLORS.purple, borderColor: COLORS.purpleLight },
  roleText: { color: COLORS.textMuted, fontWeight: '800', fontSize: 14 },
  modeTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modeTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  modeTabActive: { borderBottomColor: COLORS.cyanLight },
  modeTabText: { color: COLORS.textDim, fontSize: 12, fontWeight: '800' },
  modeTabTextActive: { color: COLORS.cyanLight },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.dangerBg,
    borderWidth: 1,
    borderColor: COLORS.danger,
    padding: 12,
    borderRadius: 12
  },
  errorText: { flex: 1, color: '#fecdd3', fontSize: 12 },
  form: { gap: 10 },
  label: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700' },
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
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 6
  },
  submitText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  demoSection: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 14, gap: 10 },
  demoTitle: { color: COLORS.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  demoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  demoChip: {
    width: '48%',
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 12,
    padding: 10,
    gap: 3
  },
  demoName: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  demoRole: { fontSize: 10, fontWeight: '700' },
  footer: { color: COLORS.textDim, fontSize: 11, textAlign: 'center', marginTop: 6 }
});
