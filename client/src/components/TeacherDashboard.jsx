import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Clock,
  Play,
  Square,
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
  UserPlus,
  UserMinus,
  BookOpen,
  Pencil,
  Trash2
} from 'lucide-react';
import { useCountdown } from '../utils/useCountdown';
import { apiFetch, getAuthToken, isInsecureRemoteOrigin, redirectToHttpsPortal } from '../utils/api';
import ReceiptModal from './ReceiptModal';

function PresenceCard({
  callType,
  title,
  subtitle,
  courseName = '',
  courseCode = '',
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
    <div className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all relative overflow-hidden ${isOpen
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
            {courseName && (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-300">
                <BookOpen className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <span>{courseName}</span>
                {courseCode && <span className="font-mono text-[10px] text-slate-400">({courseCode})</span>}
              </div>
            )}
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
        className={`w-full py-2.5 px-4 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${isOpen
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

  const [calibratingGps, setCalibratingGps] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [switchingCourse, setSwitchingCourse] = useState(false);
  const [statusBanner, setStatusBanner] = useState(null);

  // Modal de Nova Sessão
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [sessionTitle, setSessionTitle] = useState('');
  const [customRadius, setCustomRadius] = useState(35);

  // Modal de Gerenciar / Criar / Editar Turmas e Disciplinas
  const [showCoursesModal, setShowCoursesModal] = useState(false);
  const [allStudents, setAllStudents] = useState([]);
  const [editingCourseId, setEditingCourseId] = useState(null); // null = modo lista, 'new' = criando, number = editando
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [courseSemester, setCourseSemester] = useState('2026/2');
  const [courseRoomId, setCourseRoomId] = useState('');
  const [courseDescription, setCourseDescription] = useState('');
  const [courseColor, setCourseColor] = useState('#3b82f6');
  const [courseStudentIds, setCourseStudentIds] = useState([]);
  const [savingCourse, setSavingCourse] = useState(false);
  const [deletingCourseId, setDeletingCourseId] = useState(null);
  const [courseFormError, setCourseFormError] = useState(null);

  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const loadTeacherData = async () => {
    try {
      setLoading(true);
      const [resCourses, resRooms, resSessions, resUsers] = await Promise.all([
        apiFetch('/api/courses'),
        apiFetch('/api/rooms'),
        apiFetch('/api/sessions'),
        apiFetch('/api/auth/users')
      ]);

      if (resCourses.data.success) {
        const list = resCourses.data.courses || [];
        setCourses(list);
        if (list.length > 0 && !selectedCourseId) {
          setSelectedCourseId(String(list[0].id));
          setSelectedRoomId(String(list[0].room_id || ''));
        }
      }

      if (resRooms.data.success) setRooms(resRooms.data.rooms || []);

      if (resUsers.data.success) {
        const studentsOnly = (resUsers.data.users || []).filter((u) => u.role === 'student');
        setAllStudents(studentsOnly);
      }

      if (resSessions.data.success && resSessions.data.sessions?.length > 0) {
        setSessionsList(resSessions.data.sessions);
        const stillExists = resSessions.data.sessions.some((s) => s.id === activeSession?.id);
        const targetId = stillExists ? activeSession.id : resSessions.data.sessions[0].id;
        await fetchSessionDetails(targetId);
      } else {
        setSessionsList([]);
        setActiveSession(null);
        setSessionStudents([]);
        setSessionStats(null);
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

  const handleExportCsv = async () => {
    if (!activeSession) return;
    setExportingCsv(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/analytics/export/${activeSession.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert(errData.message || 'Erro ao exportar CSV.');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `frequencia_${activeSession.course_code}_${activeSession.date}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Falha ao baixar arquivo CSV.');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleCalibrateRoomGps = () => {
    if (isInsecureRemoteOrigin()) {
      if (window.confirm('O navegador bloqueia o GPS em HTTP. Deseja abrir a versão HTTPS agora para calibrar o GPS real da sala?')) {
        redirectToHttpsPortal();
      }
      return;
    }
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

  const handleRemoveAttendance = async (student, callType) => {
    if (!activeSession) return;
    const confirmed = window.confirm(
      `Tem certeza que deseja remover a ${callType}ª presença de "${student.name}" nesta aula?`
    );
    if (!confirmed) return;

    const { ok, data } = await apiFetch(
      `/api/attendance/${activeSession.id}/${student.id}/${callType}`,
      { method: 'DELETE' }
    );
    if (ok && data.success) {
      showToast(data.message);
      fetchSessionDetails(activeSession.id);
    } else {
      alert(data.message || 'Erro ao remover presença.');
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

  const openNewCourseForm = () => {
    setEditingCourseId('new');
    setCourseFormError(null);
    setCourseName('');
    setCourseCode('');
    setCourseSemester('2026/2');
    setCourseRoomId(rooms[0]?.id ? String(rooms[0].id) : '');
    setCourseDescription('');
    setCourseColor('#3b82f6');
    setCourseStudentIds(allStudents.map((s) => s.id));
  };

  const openEditCourseForm = async (course) => {
    setEditingCourseId(course.id);
    setCourseFormError(null);
    setCourseName(course.name || '');
    setCourseCode(course.code || '');
    setCourseSemester(course.semester || '2026/2');
    setCourseRoomId(course.room_id ? String(course.room_id) : '');
    setCourseDescription(course.description || '');
    setCourseColor(course.color || '#3b82f6');
    setCourseStudentIds(allStudents.map((s) => s.id));

    try {
      const { ok, data } = await apiFetch(`/api/courses/${course.id}`);
      if (ok && data.success && Array.isArray(data.students)) {
        setCourseStudentIds(data.students.map((s) => s.id));
      }
    } catch {
      // mantém seleção atual
    }
  };

  const toggleCourseStudent = (studentId) => {
    setCourseStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const handleSaveCourse = async (e) => {
    e.preventDefault();
    setCourseFormError(null);
    if (!courseName.trim() || !courseCode.trim()) {
      setCourseFormError('Preencha o nome e o código da turma/disciplina.');
      return;
    }

    setSavingCourse(true);
    try {
      const payload = {
        name: courseName.trim(),
        code: courseCode.trim().toUpperCase(),
        semester: courseSemester.trim() || '2026/2',
        room_id: courseRoomId ? Number(courseRoomId) : null,
        description: courseDescription.trim(),
        color: courseColor,
        student_ids: courseStudentIds
      };

      const isNew = editingCourseId === 'new';
      const url = isNew ? '/api/courses' : `/api/courses/${editingCourseId}`;
      const method = isNew ? 'POST' : 'PATCH';

      const { ok, data } = await apiFetch(url, {
        method,
        body: JSON.stringify(payload)
      });

      if (!ok || !data.success) {
        setCourseFormError(data.message || 'Erro ao salvar turma/disciplina.');
        return;
      }

      showToast(data.message);
      setEditingCourseId(null);
      await loadTeacherData();
      if (activeSession?.id) {
        fetchSessionDetails(activeSession.id);
      }
    } catch {
      setCourseFormError('Erro de conexão ao salvar turma/disciplina.');
    } finally {
      setSavingCourse(false);
    }
  };

  const handleDeleteCourse = async (course) => {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir a disciplina "${course.name}" (${course.code})?\n\nTodas as sessões de aula e presenças vinculadas a ela também serão removidas.`
    );
    if (!confirmed) return;

    setDeletingCourseId(course.id);
    setCourseFormError(null);
    try {
      const { ok, data } = await apiFetch(`/api/courses/${course.id}`, {
        method: 'DELETE'
      });
      if (!ok || !data.success) {
        alert(data.message || 'Erro ao excluir disciplina.');
        return;
      }

      if (String(selectedCourseId) === String(course.id)) {
        setSelectedCourseId('');
      }
      if (activeSession?.course_id === course.id) {
        setActiveSession(null);
      }
      showToast(data.message);
      await loadTeacherData();
    } catch {
      alert('Erro de conexão ao excluir disciplina.');
    } finally {
      setDeletingCourseId(null);
    }
  };

  const handleSelectCourseForCall = async (courseIdValue) => {
    const targetCourseId = Number(courseIdValue);
    if (!targetCourseId) return;

    setSelectedCourseId(String(targetCourseId));
    const existingSession = sessionsList.find((s) => Number(s.course_id) === targetCourseId);
    if (existingSession) {
      await fetchSessionDetails(existingSession.id);
      return;
    }

    // Se a disciplina ainda não possui sessão criada hoje, prepara automaticamente uma sessão FECHADA pronta para abrir a chamada
    const course = courses.find((c) => Number(c.id) === targetCourseId);
    const fallbackRoomId = course?.room_id || rooms[0]?.id;
    if (!fallbackRoomId) {
      alert('Nenhuma sala cadastrada para vincular a esta disciplina.');
      return;
    }

    setSwitchingCourse(true);
    try {
      const { ok, data } = await apiFetch('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          course_id: targetCourseId,
          room_id: Number(fallbackRoomId),
          title: `Aula — ${course?.name || 'Disciplina'}`,
          open_p1: false
        })
      });
      if (ok && data.success && data.sessionId) {
        showToast(data.message);
        const resSessions = await apiFetch('/api/sessions');
        if (resSessions.data?.success) {
          setSessionsList(resSessions.data.sessions || []);
        }
        await fetchSessionDetails(data.sessionId);
      } else {
        alert(data.message || 'Não foi possível preparar a chamada para esta disciplina.');
      }
    } finally {
      setSwitchingCourse(false);
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

      {/* Cabeçalho do Perfil do Professor */}
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
            <button
              type="button"
              onClick={() => {
                setEditingCourseId(null);
                setCourseFormError(null);
                setShowCoursesModal(true);
              }}
              className="btn-secondary py-2.5 px-4 text-xs font-semibold flex items-center gap-2 text-purple-300 border-purple-500/40 hover:border-purple-400"
            >
              <BookOpen className="w-4 h-4" />
              <span>Turmas / Disciplinas</span>
            </button>
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

      {/* Seletor de Disciplina para Abertura de Chamada */}
      {courses.length > 0 && (
        <div className="glass-card p-4 sm:p-5 border-slate-800 bg-slate-900/80 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <div>
                <div className="text-xs font-bold text-white uppercase tracking-wider">
                  Disciplina Selecionada para Chamada
                </div>
                <div className="text-[11px] text-slate-400">
                  Escolha qual disciplina deseja gerenciar e abrir/encerrar a 1ª ou 2ª presença.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={activeSession?.course_id || ''}
                onChange={(e) => handleSelectCourseForCall(e.target.value)}
                disabled={switchingCourse}
                className="glass-input text-xs py-2.5 w-full sm:min-w-[280px] sm:max-w-[360px]"
              >
                {!activeSession && (
                  <option value="" className="bg-slate-900 text-slate-400">
                    Selecione uma disciplina...
                  </option>
                )}
                {courses.map((c) => {
                  const latest = sessionsList.find((s) => Number(s.course_id) === Number(c.id));
                  const isLive = latest?.status_p1 === 'open' || latest?.status_p2 === 'open';
                  return (
                    <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                      {c.name} ({c.code}){isLive ? ' • ABERTA' : ''}
                    </option>
                  );
                })}
              </select>
              {switchingCourse && <RefreshCw className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-800/70">
            {courses.map((c) => {
              const isSelected = Number(activeSession?.course_id) === Number(c.id);
              const latest = sessionsList.find((s) => Number(s.course_id) === Number(c.id));
              const isLive = latest?.status_p1 === 'open' || latest?.status_p2 === 'open';
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={switchingCourse}
                  onClick={() => handleSelectCourseForCall(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-2 ${
                    isSelected
                      ? 'bg-blue-600/25 border-blue-400 text-white shadow-sm'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isLive ? '#10b981' : (c.color || '#3b82f6') }}
                  />
                  <span>{c.name}</span>
                  <span className="font-mono text-[10px] text-slate-400">({c.code})</span>
                  {isLive && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      ABERTA
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {activeSession ? (
        <section className="glass-card p-6 border-purple-500/40 bg-slate-900/90 shadow-2xl flex flex-col gap-6">
          {/* Cabeçalho + Exportar + Calibrar */}
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

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={exportingCsv}
                className="px-3 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{exportingCsv ? 'Exportando...' : 'Exportar CSV'}</span>
              </button>

              <button
                type="button"
                onClick={() => fetchSessionDetails(activeSession.id)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Controladores da 1ª e 2ª Chamada */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <PresenceCard
              callType={1}
              title="1ª Presença (Início da Aula)"
              subtitle="Validação por GPS (Haversine + Anti-Mock) e Reconhecimento Facial."
              courseName={activeSession.course_name}
              courseCode={activeSession.course_code}
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
              courseName={activeSession.course_name}
              courseCode={activeSession.course_code}
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

          {/* Tabela de Alunos */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white font-heading flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                <span>Alunos Matriculados ({sessionStudents.length})</span>
              </h3>
              <span className="text-xs text-slate-400">Suporta aprovação e remoção manual de presenças</span>
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
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="badge badge-success text-[10px]">
                                    {st.p1_status === 'manual_approved' ? '✓ Manual' : '✓ Presente'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveAttendance(st, 1)}
                                    className="text-[10px] text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-0.5"
                                    title="Remover 1ª presença deste aluno"
                                  >
                                    <UserMinus className="w-3 h-3" /> Remover
                                  </button>
                                </div>
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
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="badge badge-info text-[10px]">
                                    {st.p2_status === 'manual_approved' ? '✓ Manual' : '✓ Presente'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveAttendance(st, 2)}
                                    className="text-[10px] text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-0.5"
                                    title="Remover 2ª presença deste aluno"
                                  >
                                    <UserMinus className="w-3 h-3" /> Remover
                                  </button>
                                </div>
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
                            <span className={`font-mono font-bold text-xs ${totalScore === 2 ? 'text-emerald-400' : totalScore === 1 ? 'text-amber-400' : 'text-rose-400'
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

      {/* Modal para Criar Nova Sessão */}
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

      {/* Modal para Gerenciar / Criar / Editar Turmas e Disciplinas */}
      {showCoursesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
          <div className="glass-card max-w-2xl w-full border-slate-700 shadow-2xl p-6 flex flex-col gap-5 my-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white font-heading flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-400" />
                <span>
                  {editingCourseId === 'new'
                    ? 'Criar Nova Turma / Disciplina'
                    : editingCourseId
                      ? 'Editar Turma / Disciplina'
                      : 'Minhas Turmas e Disciplinas'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowCoursesModal(false);
                  setEditingCourseId(null);
                  setCourseFormError(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {editingCourseId === null ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400">
                    {courses.length} {courses.length === 1 ? 'disciplina cadastrada' : 'disciplinas cadastradas'}
                  </span>
                  <button
                    type="button"
                    onClick={openNewCourseForm}
                    className="btn-primary py-2 px-3.5 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Nova Turma / Disciplina</span>
                  </button>
                </div>

                {courses.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 bg-slate-950/50 rounded-xl border border-slate-800">
                    Nenhuma turma/disciplina cadastrada ainda. Clique em <strong>Nova Turma / Disciplina</strong> para começar.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5 max-h-[55vh] overflow-y-auto pr-1">
                    {courses.map((c) => (
                      <div
                        key={c.id}
                        className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <span
                            className="w-3 h-10 rounded-full flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: c.color || '#3b82f6' }}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="badge badge-info text-[10px] font-mono">{c.code}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{c.semester || '2026/2'}</span>
                              {c.enrolled_count !== undefined && (
                                <span className="text-[10px] text-emerald-400 font-semibold">
                                  • {c.enrolled_count} aluno(s)
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-bold text-white mt-0.5 truncate">{c.name}</div>
                            <div className="text-[11px] text-slate-400">
                              {c.room_name ? `${c.room_name}${c.room_block ? ` (${c.room_block})` : ''}` : 'Sem sala padrão'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditCourseForm(c)}
                            className="btn-secondary py-2 px-3 text-xs font-semibold flex items-center gap-1.5"
                          >
                            <Pencil className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCourse(c)}
                            disabled={deletingCourseId === c.id}
                            className="py-2 px-3 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/40 text-rose-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
                            title="Excluir disciplina"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{deletingCourseId === c.id ? 'Excluindo...' : 'Excluir'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSaveCourse} className="flex flex-col gap-4 text-xs">
                {courseFormError && (
                  <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/50 text-rose-200">
                    {courseFormError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 flex flex-col gap-1">
                    <label className="text-slate-300 font-semibold">Nome da Turma / Disciplina *</label>
                    <input
                      type="text"
                      value={courseName}
                      onChange={(e) => setCourseName(e.target.value)}
                      placeholder="Ex: Engenharia de Software II"
                      className="glass-input text-xs"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-slate-300 font-semibold">Código *</label>
                    <input
                      type="text"
                      value={courseCode}
                      onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
                      placeholder="Ex: ENG-901"
                      className="glass-input text-xs font-mono uppercase"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 flex flex-col gap-1">
                    <label className="text-slate-300 font-semibold">Sala Padrão</label>
                    <select
                      value={courseRoomId}
                      onChange={(e) => setCourseRoomId(e.target.value)}
                      className="glass-input text-xs"
                    >
                      <option value="" className="bg-slate-900 text-white">Selecione uma sala...</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id} className="bg-slate-900 text-white">
                          {r.name} ({r.block})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-slate-300 font-semibold">Semestre</label>
                    <input
                      type="text"
                      value={courseSemester}
                      onChange={(e) => setCourseSemester(e.target.value)}
                      placeholder="2026/2"
                      className="glass-input text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-slate-300 font-semibold">Descrição</label>
                  <textarea
                    rows={2}
                    value={courseDescription}
                    onChange={(e) => setCourseDescription(e.target.value)}
                    placeholder="Ementa resumida ou observações da turma..."
                    className="glass-input text-xs resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-slate-300 font-semibold">Cor de Identificação</label>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {['#3b82f6', '#8b5cf6', '#10b981', '#06b6d4', '#f59e0b', '#ec4899'].map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setCourseColor(hex)}
                        className={`w-7 h-7 rounded-lg transition-all ${
                          courseColor === hex ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: hex }}
                        title={hex}
                      />
                    ))}
                  </div>
                </div>

                {allStudents.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-300 font-semibold">
                        Alunos Matriculados ({courseStudentIds.length} / {allStudents.length})
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setCourseStudentIds(
                            courseStudentIds.length === allStudents.length ? [] : allStudents.map((s) => s.id)
                          )
                        }
                        className="text-[11px] text-cyan-400 hover:underline"
                      >
                        {courseStudentIds.length === allStudents.length ? 'Desmarcar todos' : 'Selecionar todos'}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                      {allStudents.map((st) => {
                        const checked = courseStudentIds.includes(st.id);
                        return (
                          <label
                            key={st.id}
                            className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                              checked ? 'bg-blue-600/20 border border-blue-500/40 text-white' : 'hover:bg-slate-800/60 text-slate-300 border border-transparent'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCourseStudent(st.id)}
                              className="accent-blue-500"
                            />
                            <span className="truncate font-medium">{st.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono ml-auto">{st.registration_number}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCourseId(null);
                      setCourseFormError(null);
                    }}
                    className="btn-secondary flex-1 py-2.5 text-xs"
                  >
                    Voltar à Lista
                  </button>
                  <button
                    type="submit"
                    disabled={savingCourse}
                    className="btn-primary flex-1 py-2.5 text-xs font-semibold"
                  >
                    {savingCourse
                      ? 'Salvando...'
                      : editingCourseId === 'new'
                        ? 'Criar Turma / Disciplina'
                        : 'Salvar Alterações'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {selectedReceipt && <ReceiptModal receipt={selectedReceipt} onClose={() => setSelectedReceipt(null)} />}
    </div>
  );
}
