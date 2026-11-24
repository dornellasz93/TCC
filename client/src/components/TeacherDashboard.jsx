import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Clock,
  Play,
  Square,
  Sliders,
  PlusCircle,
  RefreshCw,
  FileSpreadsheet,
  QrCode,
  CheckCircle2,
  Users,
  Lock,
  Timer,
  ShieldCheck,
  Crosshair,
  UserPlus
} from 'lucide-react';
import { useCountdown } from '../utils/useCountdown';
import { apiFetch } from '../utils/api';
import ReceiptModal from './ReceiptModal';

function PresenceCard({
  callType,
  title,
  subtitle,
  status,
  expiresAt,
  closedAt,
  presentCount = 0,
  totalStudents = 0,
  percentage = 0,
  onToggle,
  isDisabled = false,
  disabledReason = '',
  onExpired
}) {
  const isOpen = status === 'open';
  const countdown = useCountdown(isOpen ? expiresAt : null, onExpired);
  const progressPercent = isOpen ? Math.min(100, Math.max(0, (countdown.totalSeconds / 1200) * 100)) : 0;

  return (
    <div className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all relative overflow-hidden ${
      isOpen
        ? 'bg-emerald-950/20 border-emerald-500/50 shadow-xl ring-1 ring-emerald-500/30'
        : isDisabled
          ? 'bg-slate-950/30 border-slate-800/60 opacity-80'
          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
    }`}>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-white font-heading">{title}</span>
              {isOpen ? (
                <span className="badge badge-success text-[10px] animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                  ABERTA
                </span>
              ) : isDisabled ? (
                <span className="badge text-[10px] bg-slate-800 text-slate-400 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  BLOQUEADA
                </span>
              ) : (
                <span className="badge text-[10px] bg-slate-800 text-slate-400">FECHADA</span>
              )}
            </div>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>

          <div className="text-right flex-shrink-0">
            <div className={`text-xl font-bold font-mono ${callType === 1 ? 'text-emerald-400' : 'text-cyan-400'}`}>
              {presentCount} / {totalStudents}
            </div>
            <div className="text-[10px] text-slate-400">Presentes ({percentage}%)</div>
          </div>
        </div>

        {isOpen && (
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-300 font-medium flex items-center gap-1.5">
                <Timer className="w-4 h-4 text-emerald-400" />
                <span>Tempo restante:</span>
              </span>
              <span className="font-mono font-bold text-sm text-emerald-400 bg-emerald-900/60 px-2.5 py-0.5 rounded-md border border-emerald-500/40">
                ⏳ {countdown.formatted}
              </span>
            </div>
            <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-1.5 rounded-full transition-all duration-1000"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {!isOpen && (
          <div className="text-xs text-slate-400 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/80 flex items-center gap-2">
            {isDisabled ? (
              <>
                <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="text-amber-300/90 text-[11px]">{disabledReason}</span>
              </>
            ) : closedAt ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-[11px]">Encerrada às {new Date(closedAt).toLocaleTimeString('pt-BR')}.</span>
              </>
            ) : (
              <>
                <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-[11px]">Pronta para abertura (janela de 20 min).</span>
              </>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={isDisabled}
        onClick={onToggle}
        className={`w-full py-2.5 px-4 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
          isOpen
            ? 'bg-amber-600/90 hover:bg-amber-600 text-white shadow-md'
            : isDisabled
              ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed border border-slate-800'
              : callType === 1
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
        }`}
      >
        {isOpen ? (
          <><Square className="w-4 h-4" /><span>Encerrar Chamada Agora</span></>
        ) : isDisabled ? (
          <><Lock className="w-4 h-4" /><span>Abertura Bloqueada</span></>
        ) : (
          <><Play className="w-4 h-4" /><span>Abrir {callType}ª Presença (20 Min)</span></>
        )}
      </button>
    </div>
  );
}

export default function TeacherDashboard({ currentUser }) {
  const [courses, setCourses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [sessionsList, setSessionsList] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [sessionStudents, setSessionStudents] = useState([]);
  const [sessionStats, setSessionStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Live Calibration State (Radius & Biometric Threshold)
  const [radiusInput, setRadiusInput] = useState(35);
  const [thresholdInput, setThresholdInput] = useState(72);
  const [savingConfig, setSavingConfig] = useState(false);
  const [calibratingGps, setCalibratingGps] = useState(false);
  const [statusBanner, setStatusBanner] = useState(null);

  // New Session Modal
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [customRadius, setCustomRadius] = useState(35);

  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const loadTeacherData = async () => {
    try {
      setLoading(true);
      const [resUser, resRooms, resSessions] = await Promise.all([
        apiFetch(`/api/auth/user/${currentUser.id}`),
        apiFetch('/api/rooms'),
        apiFetch(`/api/sessions?teacherId=${currentUser.id}`)
      ]);

      if (resUser.data.success) {
        setCourses(resUser.data.courses || []);
        if (resUser.data.courses?.length > 0 && !selectedCourseId) {
          setSelectedCourseId(resUser.data.courses[0].id);
          setSelectedRoomId(resUser.data.courses[0].room_id || '');
        }
      }

      if (resRooms.data.success) setRooms(resRooms.data.rooms || []);

      if (resSessions.data.success && resSessions.data.sessions?.length > 0) {
        setSessionsList(resSessions.data.sessions);
        const targetId = activeSession?.id || resSessions.data.sessions[0].id;
        await fetchSessionDetails(targetId);
      } else {
        setSessionsList([]);
        setActiveSession(null);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do professor:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionDetails = async (sessionId) => {
    try {
      const { data } = await apiFetch(`/api/sessions/${sessionId}`);
      if (data.success) {
        setActiveSession(data.session);
        setSessionStudents(data.students);
        setSessionStats(data.stats);
        setRadiusInput(data.session.custom_radius_meters || 35);
        setThresholdInput(Math.round((data.session.biometric_threshold || 0.72) * 100));
      }
    } catch (err) {
      console.error('Erro ao buscar detalhes da sessão:', err);
    }
  };

  useEffect(() => {
    if (currentUser?.id) loadTeacherData();
  }, [currentUser]);

  useEffect(() => {
    if (!activeSession?.id) return;
    const interval = setInterval(() => fetchSessionDetails(activeSession.id), 8000);
    return () => clearInterval(interval);
  }, [activeSession?.id]);

  const showToast = (msg) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(null), 4500);
  };

  const handleToggleP1 = async () => {
    if (!activeSession) return;
    const { data } = await apiFetch(`/api/sessions/${activeSession.id}/toggle-p1`, { method: 'PATCH' });
    if (data.success) {
      showToast(data.message);
      fetchSessionDetails(activeSession.id);
    } else {
      alert(data.message || 'Erro ao alterar 1ª presença.');
    }
  };

  const handleToggleP2 = async () => {
    if (!activeSession) return;
    const { data } = await apiFetch(`/api/sessions/${activeSession.id}/toggle-p2`, { method: 'PATCH' });
    if (data.success) {
      showToast(data.message);
      fetchSessionDetails(activeSession.id);
    } else {
      alert(data.message || 'Erro ao alterar 2ª presença.');
    }
  };

  const handleSaveConfig = async () => {
    if (!activeSession) return;
    setSavingConfig(true);
    try {
      const { data } = await apiFetch(`/api/sessions/${activeSession.id}/config`, {
        method: 'PATCH',
        body: JSON.stringify({
          custom_radius_meters: Number(radiusInput),
          biometric_threshold: Number(thresholdInput) / 100
        })
      });
      if (data.success) {
        showToast(data.message);
        fetchSessionDetails(activeSession.id);
      }
    } finally {
      setSavingConfig(false);
    }
  };

  const handleCalibrateRoomGps = () => {
    if (!activeSession || !navigator.geolocation) {
      alert('Geolocalização não disponível neste navegador. Use HTTPS ou calibre pelo app React Native!');
      return;
    }
    setCalibratingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { data } = await apiFetch(`/api/rooms/${activeSession.room_id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude
            })
          });
          if (data.success) {
            showToast(data.message);
            fetchSessionDetails(activeSession.id);
          } else {
            alert(data.message);
          }
        } finally {
          setCalibratingGps(false);
        }
      },
      (err) => {
        alert(`Erro ao obter GPS (${err.message}).`);
        setCalibratingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleManualApprove = async (studentId, callType) => {
    if (!activeSession) return;
    const { data } = await apiFetch('/api/attendance/manual-approve', {
      method: 'POST',
      body: JSON.stringify({
        session_id: activeSession.id,
        student_id: studentId,
        call_type: callType,
        notes: 'Aprovação manual docente (tratamento de falso negativo / bateria)'
      })
    });
    if (data.success) {
      showToast(data.message);
      fetchSessionDetails(activeSession.id);
    } else {
      alert(data.message || 'Erro ao aprovar manualmente.');
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!selectedCourseId || !selectedRoomId) return;
    const { data } = await apiFetch('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({
        course_id: Number(selectedCourseId),
        room_id: Number(selectedRoomId),
        title: sessionTitle || 'Aula Teórica e Prática',
        custom_radius_meters: Number(customRadius)
      })
    });
    if (data.success) {
      setShowNewSessionModal(false);
      setSessionTitle('');
      showToast(data.message);
      await loadTeacherData();
      fetchSessionDetails(data.sessionId);
    } else {
      alert(data.message || 'Erro ao abrir aula.');
    }
  };

  const canOpenP2 = activeSession?.p1_opened_at && activeSession?.status_p1 === 'closed';
  const disabledReasonP2 = !activeSession?.p1_opened_at
    ? 'A 1ª presença precisa ser aberta e encerrada primeiro.'
    : activeSession?.status_p1 === 'open'
      ? 'Encerre a 1ª presença ou aguarde os 20 min para liberar a 2ª chamada.'
      : '';

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in">
      {statusBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2 shadow-lg">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{statusBanner}</span>
        </div>
      )}

      {/* Teacher Profile Header */}
      <div className="glass-card p-6 border-slate-800 bg-gradient-to-r from-slate-900/95 via-slate-900/70 to-purple-950/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src={currentUser?.avatar_url}
              alt={currentUser?.name}
              className="w-16 h-16 rounded-2xl ring-2 ring-purple-500/50 object-cover flex-shrink-0"
            />
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-white font-heading">{currentUser?.name}</h1>
                <span className="badge badge-purple text-xs">Portal do Professor</span>
              </div>
              <p className="text-xs text-slate-400">
                Matrícula: <strong className="font-mono text-slate-200">{currentUser?.registration_number}</strong> • UGB Engenharia de Software
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {sessionsList.length > 1 && (
              <select
                value={activeSession?.id || ''}
                onChange={(e) => fetchSessionDetails(Number(e.target.value))}
                className="glass-input text-xs py-2.5 max-w-[240px]"
              >
                {sessionsList.map((s) => (
                  <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                    {s.course_code} • {s.date} (#{s.id})
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => setShowNewSessionModal(true)}
              className="btn-primary py-2.5 px-4 text-xs font-semibold flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nova Aula</span>
            </button>
          </div>
        </div>
      </div>

      {activeSession ? (
        <section className="glass-card p-6 border-purple-500/40 bg-slate-900/90 shadow-2xl flex flex-col gap-6">
          {/* Header + Export + Calibrate */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="badge badge-info text-xs">{activeSession.course_code}</span>
                <span className="text-xs text-slate-400 font-mono">Data: {activeSession.date}</span>
              </div>
              <h2 className="text-xl font-bold text-white font-heading">{activeSession.course_name}</h2>
              <p className="text-xs text-slate-300 flex items-center gap-1.5 flex-wrap">
                <MapPin className="w-3.5 h-3.5 text-purple-400" />
                <span>
                  <strong>{activeSession.room_name} ({activeSession.room_block})</strong> • GPS: <span className="font-mono text-cyan-300">{activeSession.room_latitude?.toFixed(5)}, {activeSession.room_longitude?.toFixed(5)}</span>
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCalibrateRoomGps}
                disabled={calibratingGps}
                className="px-3 py-2 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center gap-1.5"
                title="Define as coordenadas desta sala como a sua posição GPS atual (ótimo para testar ao vivo na sala da banca)"
              >
                <Crosshair className={`w-3.5 h-3.5 ${calibratingGps ? 'animate-spin' : ''}`} />
                <span>{calibratingGps ? 'Calibrando...' : 'Calibrar GPS da Sala Aqui'}</span>
              </button>

              <a
                href={`/api/analytics/export/${activeSession.id}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Exportar CSV</span>
              </a>

              <button
                type="button"
                onClick={() => fetchSessionDetails(activeSession.id)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Live Threshold Tuning Bar (Slide 10: Triangulação GPS + Biometria) */}
          <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-4 items-center text-xs">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-slate-300 font-semibold">
                <span className="flex items-center gap-1"><Sliders className="w-3.5 h-3.5 text-blue-400" /> Tolerância Geofence</span>
                <span className="font-mono text-blue-400">{radiusInput}m</span>
              </div>
              <input
                type="range"
                min="10"
                max="150"
                step="5"
                value={radiusInput}
                onChange={(e) => setRadiusInput(Number(e.target.value))}
                className="w-full accent-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-slate-300 font-semibold">
                <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-purple-400" /> Limiar Biométrico (Threshold)</span>
                <span className="font-mono text-purple-400">{thresholdInput}%</span>
              </div>
              <input
                type="range"
                min="60"
                max="95"
                step="1"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(Number(e.target.value))}
                className="w-full accent-purple-500"
              />
            </div>

            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="btn-secondary py-2.5 text-xs font-semibold text-cyan-300 hover:text-white"
            >
              {savingConfig ? 'Salvando...' : 'Aplicar Parâmetros de Triangulação'}
            </button>
          </div>

          {/* 1ª & 2ª Call Controllers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <PresenceCard
              callType={1}
              title="1ª Presença (Início da Aula)"
              subtitle="Validação por GPS (Haversine + Anti-Mock) e Reconhecimento Facial."
              status={activeSession.status_p1}
              expiresAt={activeSession.p1_expires_at}
              closedAt={activeSession.p1_closed_at}
              presentCount={sessionStats?.p1PresentCount || 0}
              totalStudents={sessionStats?.totalStudents || 0}
              percentage={sessionStats?.p1Percentage || 0}
              onToggle={handleToggleP1}
              isDisabled={false}
              onExpired={() => fetchSessionDetails(activeSession.id)}
            />
            <PresenceCard
              callType={2}
              title="2ª Presença (Final da Aula)"
              subtitle="Confirmação de permanência do discente no encerramento da aula."
              status={activeSession.status_p2}
              expiresAt={activeSession.p2_expires_at}
              closedAt={activeSession.p2_closed_at}
              presentCount={sessionStats?.p2PresentCount || 0}
              totalStudents={sessionStats?.totalStudents || 0}
              percentage={sessionStats?.p2Percentage || 0}
              onToggle={handleToggleP2}
              isDisabled={activeSession.status_p2 === 'closed' && !canOpenP2}
              disabledReason={disabledReasonP2}
              onExpired={() => fetchSessionDetails(activeSession.id)}
            />
          </div>

          {/* Students Table */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white font-heading flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                <span>Alunos Matriculados ({sessionStudents.length})</span>
              </h3>
              <span className="text-xs text-slate-400">Suporta aprovação manual para falsos negativos</span>
            </div>

            <div className="glass-card overflow-hidden border-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="font-semibold">Aluno(a)</th>
                      <th className="font-semibold">1ª Presença</th>
                      <th className="font-semibold">2ª Presença</th>
                      <th className="font-semibold">Total</th>
                      <th className="font-semibold text-right">Comprovante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {sessionStudents.map((st) => {
                      const isP1 = st.p1_status === 'present' || st.p1_status === 'manual_approved';
                      const isP2 = st.p2_status === 'present' || st.p2_status === 'manual_approved';
                      const totalScore = (isP1 ? 1 : 0) + (isP2 ? 1 : 0);

                      return (
                        <tr key={st.id} className="hover:bg-slate-800/40 transition-colors">
                          <td>
                            <div className="flex items-center gap-3">
                              <img src={st.avatar_url} alt={st.name} className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-700" />
                              <div>
                                <div className="font-semibold text-white">{st.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  Mat. {st.registration_number} {st.face_enrolled ? '• 🧬 Face SQLite' : ''}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>
                            {isP1 ? (
                              <div>
                                <span className="badge badge-success text-[10px]">
                                  {st.p1_status === 'manual_approved' ? '✓ Manual' : '✓ Presente'}
                                </span>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  {st.p1_distance !== null ? `${st.p1_distance}m` : 'Docente'}
                                  {st.p1_face_score ? ` • ${(st.p1_face_score * 100).toFixed(0)}%` : ''}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="badge badge-danger text-[10px]">Ausente</span>
                                <button
                                  type="button"
                                  onClick={() => handleManualApprove(st.id, 1)}
                                  className="text-[10px] text-cyan-400 hover:underline flex items-center gap-0.5"
                                  title="Aprovar 1ª presença manualmente"
                                >
                                  <UserPlus className="w-3 h-3" /> Aprovar
                                </button>
                              </div>
                            )}
                          </td>

                          <td>
                            {isP2 ? (
                              <div>
                                <span className="badge badge-info text-[10px]">
                                  {st.p2_status === 'manual_approved' ? '✓ Manual' : '✓ Presente'}
                                </span>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  {st.p2_distance !== null ? `${st.p2_distance}m` : 'Docente'}
                                  {st.p2_face_score ? ` • ${(st.p2_face_score * 100).toFixed(0)}%` : ''}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="badge badge-danger text-[10px]">Ausente</span>
                                <button
                                  type="button"
                                  onClick={() => handleManualApprove(st.id, 2)}
                                  className="text-[10px] text-cyan-400 hover:underline flex items-center gap-0.5"
                                  title="Aprovar 2ª presença manualmente"
                                >
                                  <UserPlus className="w-3 h-3" /> Aprovar
                                </button>
                              </div>
                            )}
                          </td>

                          <td>
                            <span className={`font-mono font-bold text-xs ${
                              totalScore === 2 ? 'text-emerald-400' : totalScore === 1 ? 'text-amber-400' : 'text-rose-400'
                            }`}>
                              {totalScore} / 2
                            </span>
                          </td>

                          <td className="text-right">
                            {(isP1 || isP2) && (
                              <button
                                type="button"
                                onClick={() => setSelectedReceipt({
                                  student_name: st.name,
                                  registration_number: st.registration_number,
                                  course_name: activeSession.course_name,
                                  course_code: activeSession.course_code,
                                  room_name: activeSession.room_name,
                                  recorded_at: st.p2_recorded_at || st.p1_recorded_at,
                                  distance_meters: st.p2_distance ?? st.p1_distance,
                                  verification_code: st.p2_code || st.p1_code,
                                  verification_hash: st.p2_hash || st.p1_hash,
                                  face_match_score: st.p2_face_score || st.p1_face_score
                                })}
                                className="text-blue-400 hover:text-blue-300 text-xs inline-flex items-center gap-1 font-medium"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                                <span>Ticket</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="glass-card p-12 text-center border-slate-800 flex flex-col items-center gap-4">
          <Clock className="w-10 h-10 text-purple-400" />
          <h2 className="text-lg font-bold text-white">Nenhuma sessão aberta</h2>
          <button type="button" onClick={() => setShowNewSessionModal(true)} className="btn-primary py-2.5 px-5 text-xs">
            Abrir Nova Aula
          </button>
        </div>
      )}

      {/* Create New Session Modal */}
      {showNewSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-card max-w-lg w-full border-slate-700 shadow-2xl p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white font-heading flex items-center gap-2">
                <Play className="w-5 h-5 text-blue-400" />
                <span>Iniciar Nova Aula</span>
              </h3>
              <button type="button" onClick={() => setShowNewSessionModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreateSession} className="flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-slate-300 font-semibold">Disciplina</label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => {
                    setSelectedCourseId(e.target.value);
                    const c = courses.find((item) => String(item.id) === e.target.value);
                    if (c?.room_id) setSelectedRoomId(c.room_id);
                  }}
                  className="glass-input text-xs"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-300 font-semibold">Sala / Campus UGB</label>
                <select value={selectedRoomId} onChange={(e) => setSelectedRoomId(e.target.value)} className="glass-input text-xs">
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id} className="bg-slate-900 text-white">
                      {r.name} ({r.block}) — Raio {r.default_radius_meters}m
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-300 font-semibold">Tema da Aula</label>
                <input
                  type="text"
                  placeholder="Ex: Banca de TCC - Validação em Sala"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  className="glass-input text-xs"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-slate-300 font-semibold">Raio Geofence Inicial: {customRadius}m</label>
                <input type="range" min="15" max="150" step="5" value={customRadius} onChange={(e) => setCustomRadius(Number(e.target.value))} className="accent-blue-500" />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button type="button" onClick={() => setShowNewSessionModal(false)} className="btn-secondary flex-1 py-2.5 text-xs">Cancelar</button>
                <button type="submit" className="btn-primary flex-1 py-2.5 text-xs font-semibold">Abrir Aula</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedReceipt && <ReceiptModal receipt={selectedReceipt} onClose={() => setSelectedReceipt(null)} />}
    </div>
  );
}
