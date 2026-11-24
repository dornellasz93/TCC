import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  CheckCircle2,
  ShieldAlert,
  Radio,
  Compass,
  Scan,
  Sparkles,
  RefreshCw,
  FileCheck2,
  Lock,
  ArrowRight,
  Eye,
  Timer,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import { calculateHaversine, UGB_LOCATIONS } from '../utils/haversine';
import { useCountdown } from '../utils/useCountdown';
import { apiFetch } from '../utils/api';

export default function CheckInModal({ session, student, callType = 1, onClose, onSuccess }) {
  const [step, setStep] = useState(1); // 1: GPS + Anti-Mock, 2: Liveness + Face Match, 3: Receipt

  const expiresAt = callType === 1 ? session?.p1_expires_at : session?.p2_expires_at;
  const countdown = useCountdown(expiresAt, () => {
    alert('O tempo limite de 20 minutos para esta chamada expirou.');
    if (onClose) onClose();
  });

  // Step 1: GPS & Anti-Mock State
  const [gpsMode, setGpsMode] = useState('simulated'); // 'real' | 'simulated'
  const [selectedLocation, setSelectedLocation] = useState(UGB_LOCATIONS[0]);
  const [realCoords, setRealCoords] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [serverBlockFeedback, setServerBlockFeedback] = useState(null);
  const [testingFraud, setTestingFraud] = useState(false);

  const activeStudentLat = gpsMode === 'real' ? realCoords?.latitude : selectedLocation.latitude;
  const activeStudentLng = gpsMode === 'real' ? realCoords?.longitude : selectedLocation.longitude;
  const activeAccuracy = gpsMode === 'real' ? realCoords?.accuracy ?? 12 : selectedLocation.accuracy ?? 5;
  const isMockLocation = gpsMode === 'simulated' ? Boolean(selectedLocation.isMockLocation) : false;

  const maxRadius = session?.custom_radius_meters || 35;
  const currentDistance = (activeStudentLat !== undefined && activeStudentLng !== undefined && activeStudentLat !== null)
    ? calculateHaversine(activeStudentLat, activeStudentLng, session.room_latitude, session.room_longitude)
    : 0;

  const isInsideGeofence = currentDistance <= maxRadius && !isMockLocation;

  // Step 2: Camera, Server Liveness Challenge & Biometrics State
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [streamActive, setStreamActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [livenessChallenge, setLivenessChallenge] = useState(null);
  const [frameBefore, setFrameBefore] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [simulateSpoof, setSimulateSpoof] = useState(null); // null | 'static_photo' | 'wrong_face'
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState(null);

  // Step 3: Digital Receipt State
  const [attendanceData, setAttendanceData] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  const fetchRealGPS = () => {
    setGpsLoading(true);
    setGpsError(null);
    setServerBlockFeedback(null);

    if (!navigator.geolocation) {
      setGpsError('Geolocalização não é suportada pelo seu navegador.');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRealCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy)
        });
        setGpsLoading(false);
      },
      (err) => {
        setGpsError(`Erro ao obter GPS (${err.message}). Dica: no navegador fora de localhost use HTTPS ou o app React Native.`);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (gpsMode === 'real' && !realCoords) {
      fetchRealGPS();
    }
  }, [gpsMode]);

  // Fetch dynamic server liveness challenge when entering Step 2
  const requestLivenessChallenge = async () => {
    try {
      const { ok, data } = await apiFetch('/api/attendance/liveness-challenge', {
        method: 'POST',
        body: JSON.stringify({
          session_id: session.id,
          student_id: student.id,
          call_type: callType
        })
      });
      if (ok && data.success) {
        setLivenessChallenge(data.challenge);
      }
    } catch (err) {
      console.error('Erro ao gerar desafio liveness:', err);
    }
  };

  useEffect(() => {
    if (step === 2) {
      requestLivenessChallenge();
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [step]);

  const captureCanvasFrame = (withWatermark = false) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !video.videoWidth) return null;

    canvas.width = 480;
    canvas.height = Math.round((video.videoHeight / video.videoWidth) * 480);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (withWatermark) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.fillRect(0, canvas.height - 34, canvas.width, 34);
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(
        `UGB • P${callType} • ${student.registration_number} • ${new Date().toLocaleTimeString()} • ${activeStudentLat.toFixed(5)},${activeStudentLng.toFixed(5)}`,
        10,
        canvas.height - 13
      );
    }

    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStreamActive(true);
        // Capture initial pre-challenge frame after 900ms for real 2-frame liveness motion check
        setTimeout(() => {
          const initial = captureCanvasFrame(false);
          if (initial) setFrameBefore(initial);
        }, 900);
      }
    } catch (err) {
      setCameraError('Câmera física indisponível no navegador. Modo fallback de demonstração ativo (para câmera real use HTTPS ou o app React Native).');
      setStreamActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setStreamActive(false);
  };

  const handleCapturePhoto = () => {
    setVerificationError(null);
    const frame = streamActive ? captureCanvasFrame(true) : student.avatar_url;
    setCapturedPhoto(frame || student.avatar_url);
  };

  // Trigger a live fraud-blocking demonstration directly against the server in Step 1!
  const handleTestServerFraudBlock = async () => {
    setTestingFraud(true);
    setServerBlockFeedback(null);
    try {
      const { data } = await apiFetch('/api/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({
          session_id: session.id,
          student_id: student.id,
          call_type: callType,
          student_latitude: activeStudentLat,
          student_longitude: activeStudentLng,
          gps_accuracy_meters: activeAccuracy,
          is_mock_location: isMockLocation,
          photo_evidence: student.avatar_url,
          is_simulated: gpsMode === 'simulated',
          device_info: 'Web Portal (Teste Anti-Fraude)'
        })
      });
      setServerBlockFeedback(
        `🔒 Servidor bloqueou (HTTP 403 - ${data.error_code || 'BLOCKED'}): ${data.message} — Evento gravado na Auditoria!`
      );
    } catch (err) {
      setServerBlockFeedback('Erro ao comunicar com o servidor.');
    } finally {
      setTestingFraud(false);
    }
  };

  // Submit Final 2-Stage Check-In to Backend
  const handleConfirmAttendance = async () => {
    setIsVerifying(true);
    setVerificationError(null);

    try {
      const { ok, data } = await apiFetch('/api/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({
          session_id: session.id,
          student_id: student.id,
          call_type: callType,
          student_latitude: activeStudentLat,
          student_longitude: activeStudentLng,
          gps_accuracy_meters: activeAccuracy,
          is_mock_location: isMockLocation,
          frame_before: frameBefore,
          photo_evidence: capturedPhoto || student.avatar_url,
          liveness_token: livenessChallenge?.token || null,
          liveness_passed: true,
          simulate_spoof: simulateSpoof,
          is_simulated: gpsMode === 'simulated',
          device_info: 'Web Portal (HTML5 Geolocation & Camera)'
        })
      });

      if (!ok || !data.success) {
        // Request a fresh challenge token for retry if biometric/liveness failed
        requestLivenessChallenge();
        throw new Error(`[${data.error_code || 'BLOQUEADO'}] ${data.message || 'Erro ao validar presença no servidor.'}`);
      }

      setAttendanceData(data.attendance);
      setValidationResult(data.validation);

      const qrData = JSON.stringify({
        code: data.validation.verificationCode,
        callType: `${callType}ª Presença`,
        hash: data.validation.verificationHash,
        student: student.name,
        mat: student.registration_number,
        course: session.course_name,
        distance: `${data.validation.distanceMeters}m`,
        faceMatch: `${(data.validation.faceMatchScore * 100).toFixed(1)}%`,
        date: new Date().toISOString()
      });

      const qr = await QRCode.toDataURL(qrData, { width: 220, margin: 1, color: { dark: '#0284c7', light: '#ffffff' } });
      setQrCodeDataUrl(qr);

      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      setStep(3);
      if (onSuccess) onSuccess();
    } catch (err) {
      setVerificationError(err.message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="glass-card max-w-2xl w-full border-slate-700/80 shadow-2xl relative flex flex-col my-6 overflow-hidden">

        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 flex-shrink-0">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-white font-heading">
                  Registro de {callType}ª Presença
                </h2>
                <span className="badge badge-info text-[10px] font-bold">
                  {callType === 1 ? 'Início da Aula' : 'Final da Aula'}
                </span>
                {expiresAt && !countdown.isExpired && (
                  <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded flex items-center gap-1">
                    <Timer className="w-3 h-3 text-emerald-400" />
                    <span>⏳ {countdown.formatted}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {session?.course_name} • {session?.room_name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 pt-4 pb-2 border-b border-slate-800/60 bg-slate-950/50">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className={`flex items-center gap-2 pb-2 border-b-2 font-medium ${step >= 1 ? 'border-blue-500 text-blue-400' : 'border-slate-800 text-slate-500'}`}>
              <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold">1</span>
              <span>GPS &amp; Anti-Mock</span>
            </div>
            <div className={`flex items-center gap-2 pb-2 border-b-2 font-medium ${step >= 2 ? 'border-blue-500 text-blue-400' : 'border-slate-800 text-slate-500'}`}>
              <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold">2</span>
              <span>Face &amp; Liveness</span>
            </div>
            <div className={`flex items-center gap-2 pb-2 border-b-2 font-medium ${step >= 3 ? 'border-emerald-500 text-emerald-400' : 'border-slate-800 text-slate-500'}`}>
              <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold">3</span>
              <span>Comprovante</span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-5">

          {/* STEP 1 */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2.5">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Modo de Captura GPS</span>
                  <Radio className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => { setGpsMode('simulated'); setServerBlockFeedback(null); }}
                    className={`p-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      gpsMode === 'simulated'
                        ? 'bg-blue-600 text-white shadow-md border border-blue-400/30'
                        : 'bg-slate-800/80 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Simulador Campus UGB</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setGpsMode('real'); setServerBlockFeedback(null); fetchRealGPS(); }}
                    className={`p-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      gpsMode === 'real'
                        ? 'bg-blue-600 text-white shadow-md border border-blue-400/30'
                        : 'bg-slate-800/80 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Compass className="w-4 h-4" />
                    <span>GPS Real do Aparelho</span>
                  </button>
                </div>
              </div>

              {gpsMode === 'simulated' ? (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-300">
                    Selecione o cenário de teste (inclui teste de Fake GPS / Anti-Mock):
                  </label>
                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                    {UGB_LOCATIONS.map((loc) => {
                      const isSelected = selectedLocation.id === loc.id;
                      const dist = calculateHaversine(loc.latitude, loc.longitude, session.room_latitude, session.room_longitude);
                      const isWithin = dist <= maxRadius && !loc.isMockLocation;

                      return (
                        <div
                          key={loc.id}
                          onClick={() => { setSelectedLocation(loc); setServerBlockFeedback(null); }}
                          className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                            isSelected
                              ? loc.isMockLocation
                                ? 'bg-rose-950/40 border-rose-500'
                                : 'bg-blue-600/20 border-blue-500'
                              : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="text-sm font-semibold text-white flex items-center gap-2 flex-wrap">
                              <span>{loc.name}</span>
                              {loc.isMockLocation ? (
                                <span className="badge badge-danger text-[10px]">Mock GPS!</span>
                              ) : isWithin ? (
                                <span className="badge badge-success text-[10px]">Dentro do Raio</span>
                              ) : (
                                <span className="badge badge-danger text-[10px]">Fora do Raio</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">{loc.description}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-xs font-mono font-bold text-white">{dist}m</div>
                            <div className="text-[10px] text-slate-500">Haversine</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Compass className="w-4 h-4 text-blue-400" />
                      <span>Telemetria GPS Real</span>
                    </span>
                    <button
                      type="button"
                      onClick={fetchRealGPS}
                      disabled={gpsLoading}
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
                      <span>Atualizar</span>
                    </button>
                  </div>

                  {gpsLoading ? (
                    <div className="p-4 text-center text-slate-400 text-xs">Obtendo coordenadas GPS...</div>
                  ) : realCoords ? (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                        <div className="text-[10px] text-slate-400">Latitude</div>
                        <div className="text-xs font-mono font-bold text-white">{realCoords.latitude.toFixed(6)}</div>
                      </div>
                      <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                        <div className="text-[10px] text-slate-400">Longitude</div>
                        <div className="text-xs font-mono font-bold text-white">{realCoords.longitude.toFixed(6)}</div>
                      </div>
                      <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                        <div className="text-[10px] text-slate-400">Precisão</div>
                        <div className="text-xs font-mono font-bold text-emerald-400">±{realCoords.accuracy}m</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-300 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                      {gpsError || 'Clique em Atualizar ou use o Simulador.'}
                    </div>
                  )}
                </div>
              )}

              {/* Haversine + Anti-Mock Summary */}
              <div className={`p-4 rounded-xl border flex flex-col gap-3 ${
                isInsideGeofence ? 'bg-emerald-950/20 border-emerald-500/40' : 'bg-rose-950/20 border-rose-500/40'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isInsideGeofence ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <ShieldAlert className="w-5 h-5 text-rose-400" />
                    )}
                    <span className="text-sm font-bold text-white font-heading">
                      {isMockLocation
                        ? 'Anti-Mock Location: Fake GPS Detectado!'
                        : isInsideGeofence
                          ? 'Etapa 1 Aprovada (GPS + Anti-Mock OK)'
                          : 'Etapa 1 Bloqueada: Fora do Cerco Geográfico'}
                    </span>
                  </div>
                  <span className={`badge ${isInsideGeofence ? 'badge-success' : 'badge-danger'}`}>
                    {isMockLocation ? 'SPOOFING' : isInsideGeofence ? 'Aprovado' : 'Bloqueado'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400">Distância</div>
                    <div className={`font-mono font-bold ${currentDistance <= maxRadius ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {currentDistance} m
                    </div>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400">Raio Sala</div>
                    <div className="font-mono font-semibold text-blue-400">{maxRadius} m</div>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400">Anti-Mock</div>
                    <div className={`font-mono font-bold ${isMockLocation ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {isMockLocation ? 'DETECTADO' : 'LIMPO'}
                    </div>
                  </div>
                  <div className="bg-slate-900/90 p-2 rounded-lg border border-slate-800">
                    <div className="text-[10px] text-slate-400">Precisão</div>
                    <div className="font-mono text-cyan-300">±{activeAccuracy}m</div>
                  </div>
                </div>

                {serverBlockFeedback && (
                  <div className="text-xs text-rose-200 bg-rose-950/70 p-3 rounded-lg border border-rose-500/50">
                    {serverBlockFeedback}
                  </div>
                )}
              </div>

              {isInsideGeofence ? (
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2"
                >
                  <span>Avançar para Reconhecimento Facial + Prova de Vida</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleTestServerFraudBlock}
                  disabled={testingFraud}
                  className="w-full py-3 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>{testingFraud ? 'Enviando tentativa ao servidor...' : 'Testar Bloqueio Real no Back-End (Registrar na Auditoria)'}</span>
                </button>
              )}
            </div>
          )}

          {/* STEP 2: LIVENESS + FACE MATCH */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              {livenessChallenge && (
                <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/40 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <Eye className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                    <div>
                      <div className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">
                        Desafio Dinâmico de Prova de Vida (Servidor)
                      </div>
                      <div className="font-semibold text-white">{livenessChallenge.challenge_label}</div>
                    </div>
                  </div>
                  <span className="badge badge-info text-[9px] font-mono">Anti-Replay Ativo</span>
                </div>
              )}

              <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video flex items-center justify-center shadow-2xl">
                <canvas ref={canvasRef} className="hidden" />

                {capturedPhoto ? (
                  <div className="relative w-full h-full">
                    <img src={capturedPhoto} alt="Foto Capturada" className="w-full h-full object-cover" />
                    <div className="absolute bottom-3 left-3 right-3 bg-slate-900/90 border border-emerald-500/50 px-3 py-2 rounded-lg text-xs text-emerald-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <CheckCircle2 className="w-4 h-4" />
                        Foto + Par de Quadros Liveness Prontos
                      </span>
                      <button
                        type="button"
                        onClick={() => setCapturedPhoto(null)}
                        className="text-slate-300 hover:text-white underline text-[11px]"
                      >
                        Refazer
                      </button>
                    </div>
                  </div>
                ) : streamActive ? (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
                    <div className="scan-laser" />
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-48 h-60 face-oval-guide success" />
                    </div>
                  </>
                ) : (
                  <div className="p-6 text-center flex flex-col items-center gap-3">
                    <img src={student.avatar_url} alt={student.name} className="w-20 h-20 rounded-full ring-4 ring-blue-500/40 object-cover" />
                    <div className="text-xs text-slate-300 max-w-md">{cameraError || 'Preparando câmera...'}</div>
                  </div>
                )}
              </div>

              {/* Banca Fraud Simulation Switch (Optional) */}
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Simulação para Banca (Opcional):</span>
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: null, label: 'Normal (Aprovar)' },
                    { id: 'static_photo', label: 'Foto Estática (Spoof)' },
                    { id: 'wrong_face', label: 'Rosto Diferente' }
                  ].map((opt) => (
                    <button
                      key={String(opt.id)}
                      type="button"
                      onClick={() => setSimulateSpoof(opt.id)}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                        simulateSpoof === opt.id
                          ? opt.id ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {verificationError && (
                <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/60 text-rose-200 text-xs">
                  {verificationError}
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setCapturedPhoto(null); setVerificationError(null); setStep(1); }}
                  className="btn-secondary py-3 text-xs w-1/3"
                >
                  Voltar ao GPS
                </button>

                {capturedPhoto ? (
                  <button
                    type="button"
                    onClick={handleConfirmAttendance}
                    disabled={isVerifying}
                    className="btn-success py-3 text-sm font-semibold flex-1 flex items-center justify-center gap-2"
                  >
                    {isVerifying ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Validando no Servidor SQLite...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Validar Biometria &amp; Registrar {callType}ª Presença</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCapturePhoto}
                    className="btn-primary py-3 text-sm font-semibold flex-1 flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Executar Desafio e Capturar</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: RECEIPT */}
          {step === 3 && (
            <div className="flex flex-col gap-5">
              <div className="text-center flex flex-col items-center gap-1">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-white font-heading mt-1">
                  {callType}ª Presença Registrada com Sucesso!
                </h3>
                <p className="text-xs text-slate-400">
                  Validação em 2 etapas gravada em {validationResult?.latencyMs ?? 25}ms no SQLite.
                </p>
              </div>

              <div className="ticket-border p-5 rounded-2xl shadow-xl flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-3 gap-2">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Centro Universitário Geraldo Di Biase</div>
                    <div className="text-xs font-semibold text-white">Comprovante Criptográfico • {callType}ª Chamada</div>
                  </div>
                  <span className="badge badge-success text-[10px] font-mono font-bold">
                    {attendanceData?.verification_code}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400">Aluno(a)</div>
                    <div className="font-semibold text-white">{student.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">Mat. {student.registration_number}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Disciplina</div>
                    <div className="font-semibold text-white">{session.course_name}</div>
                    <div className="text-[10px] text-slate-400">{session.room_name}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Geofencing &amp; Anti-Mock</div>
                    <div className="text-emerald-400 font-mono font-medium">
                      {validationResult?.distanceMeters}m / {maxRadius}m (OK)
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Reconhecimento Facial</div>
                    <div className="text-cyan-300 font-mono font-medium">
                      {((validationResult?.faceMatchScore || 0.96) * 100).toFixed(1)}% ({validationResult?.biometricMethod})
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                  {qrCodeDataUrl && (
                    <img src={qrCodeDataUrl} alt="QR Code" className="w-24 h-24 rounded-lg bg-white p-1 flex-shrink-0" />
                  )}
                  <div className="flex-1 text-left min-w-0 flex flex-col gap-1">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
                      <Lock className="w-3 h-3 text-blue-400" />
                      <span>Assinatura SHA-256</span>
                    </div>
                    <div className="font-mono text-[10px] text-slate-300 break-all bg-slate-900 p-2 rounded border border-slate-800">
                      {attendanceData?.verification_hash}
                    </div>
                    <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                      <FileCheck2 className="w-3.5 h-3.5" />
                      <span>Latência: {validationResult?.latencyMs}ms • Verificável em Auditoria</span>
                    </div>
                  </div>
                </div>
              </div>

              <button type="button" onClick={onClose} className="btn-primary w-full py-3 text-sm font-semibold">
                Concluir e Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
