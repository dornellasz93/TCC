import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme';
import { apiRequest } from '../services/api';

export default function FaceEnrollModal({ visible, student, onClose, onEnrolled }) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [captured, setCaptured] = useState(null); // { uri, base64 }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    setError(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.3,
        exif: false
      });
      if (photo?.base64) {
        setCaptured({
          uri: photo.uri,
          base64: `data:image/jpeg;base64,${photo.base64}`
        });
      }
    } catch (err) {
      setError('Falha ao capturar imagem da câmera. Tente novamente.');
    }
  };

  const handleSave = async () => {
    if (!captured?.base64) return;
    setSaving(true);
    setError(null);
    const res = await apiRequest('/api/auth/enroll-face', {
      method: 'POST',
      body: JSON.stringify({ photo_base64: captured.base64 })
    });
    setSaving(false);

    if (res.ok && res.data?.success) {
      setCaptured(null);
      if (onEnrolled) onEnrolled(res.data.user);
      onClose();
    } else {
      setError(res.data?.message || 'Erro ao cadastrar biometria facial no servidor.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="scan-circle-outline" size={24} color={COLORS.cyanLight} />
            <View>
              <Text style={styles.title}>Cadastro Biométrico Facial</Text>
              <Text style={styles.subtitle}>{student?.name}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={styles.info}>
          Enquadre seu rosto na moldura oval. O servidor Docker extrairá seu vetor biométrico e salvará no SQLite para validar todas as chamadas futuras.
        </Text>

        <View style={styles.cameraBox}>
          {captured ? (
            <Image source={{ uri: captured.uri }} style={styles.preview} />
          ) : !permission?.granted ? (
            <View style={styles.permBox}>
              <Ionicons name="camera-outline" size={42} color={COLORS.primaryLight} />
              <Text style={styles.permText}>Precisamos da permissão da câmera frontal para cadastrar sua biometria.</Text>
              <TouchableOpacity onPress={requestPermission} style={styles.permBtn}>
                <Text style={styles.permBtnText}>Permitir Câmera</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.camera}>
              <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ovalOverlay]}>
                <View style={styles.ovalGuide} />
              </View>
            </View>
          )}
        </View>

        {error && (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
          </View>
        )}

        <View style={styles.actions}>
          {captured ? (
            <>
              <TouchableOpacity onPress={() => setCaptured(null)} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Refazer</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.successBtn}>
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark" size={18} color="#fff" />
                    <Text style={styles.btnText}>Salvar Biometria no SQLite</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              onPress={handleCapture}
              disabled={!permission?.granted}
              style={[styles.primaryBtn, !permission?.granted && { opacity: 0.4 }]}
            >
              <Ionicons name="camera" size={20} color="#fff" />
              <Text style={styles.btnText}>Capturar Rosto de Referência</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 20, paddingTop: 52, gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: COLORS.text, fontSize: 17, fontWeight: '800' },
  subtitle: { color: COLORS.textMuted, fontSize: 12 },
  closeBtn: { padding: 6 },
  info: { color: COLORS.textMuted, fontSize: 13, lineHeight: 19 },
  cameraBox: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.borderLight
  },
  camera: { flex: 1 },
  preview: { flex: 1, resizeMode: 'cover' },
  ovalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ovalGuide: {
    width: 210,
    height: 275,
    borderRadius: 120,
    borderWidth: 3,
    borderColor: COLORS.cyanLight,
    borderStyle: 'dashed'
  },
  permBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  permText: { color: COLORS.textMuted, textAlign: 'center', fontSize: 13 },
  permBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  permBtnText: { color: '#fff', fontWeight: '700' },
  errBox: { backgroundColor: COLORS.dangerBg, borderWidth: 1, borderColor: COLORS.danger, padding: 12, borderRadius: 12 },
  errText: { color: '#fecdd3', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10, paddingBottom: 16 },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    borderRadius: 14
  },
  successBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.success,
    paddingVertical: 15,
    borderRadius: 14
  },
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardAlt,
    paddingVertical: 15,
    borderRadius: 14
  },
  secondaryBtnText: { color: COLORS.text, fontWeight: '700', fontSize: 14 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 }
});
