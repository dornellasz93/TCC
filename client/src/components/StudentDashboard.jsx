import React, { useState, useEffect } from 'react';
import {
  MapPin,
  CheckCircle2,
  Clock,
  BookOpen,
  QrCode,
  Sparkles,
  ShieldCheck,
  Lock,
  Camera,
  Compass,
  Timer,
  AlertTriangle
} from 'lucide-react';
import { useCountdown } from '../utils/useCountdown';
import { apiFetch } from '../utils/api';
import CheckInModal from './CheckInModal';
import ReceiptModal from './ReceiptModal';
import FaceEnrollModal from './FaceEnrollModal';

// Subcomponente para cada Cartão de Presença no Painel do Aluno
function StudentPresenceCard({
  session,
  callType,
  title,
  status,
  openedAt,
  expiresAt,
  closedAt,
  attendance,
  currentUser,
  onCheckIn,
  onViewReceipt,
  onExpire,
  isBlocked = false,
  blockedReason = ''
}) {
  const isRegistered = attendance?.status === 'present' || attendance?.status === 'manual_approved';
  const isOpen = status === 'open';
  const countdown = useCountdown(isOpen ? expiresAt : null, onExpire);

  // 20 minutos = 1200 segundos
  const progressPercent = isOpen
    ? Math.min(100, Math.max(0, (countdown.totalSeconds / 1200) * 100))
    : 0;

  return (
    <div className={`p-4 rounded-xl border flex flex-col justify-between gap-3.5 transition-all relative overflow-hidden ${
      isRegistered
        ? 'bg-emerald-950/15 border-emerald-500/40'
        : isOpen
          ? 'bg-blue-950/25 border-blue-500/60 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/30'
          : isBlocked
            ? 'bg-slate-950/30 border-slate-800/60 opacity-80'
            : 'bg-slate-950/40 border-slate-800/60 opacity-90'
    }`}>
      
      <div className="flex flex-col gap-2.5">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {title}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isRegistered
                ? `Confirmada com sucesso (${attendance?.distance_meters}m de distância da sala).`
                : isOpen
                  ? 'Chamada liberada pelo professor! Registre seu reconhecimento facial e GPS antes do tempo expirar.'
                  : isBlocked
                    ? blockedReason
                    : closedAt
                      ? `Chamada encerrada às ${new Date(closedAt).toLocaleTimeString('pt-BR')}.`
                      : 'Aguardando professor abrir a chamada no campus.'}
            </p>
          </div>

          {/* Selos (Badges) */}
          {isRegistered ? (
            <span className="badge badge-success text-[10px] flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Confirmada</span>
            </span>
          ) : isOpen ? (
            <span className="badge badge-warning text-[10px] animate-pulse flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
              Aberta Agora
            </span>
          ) : isBlocked ? (
            <span className="badge text-[10px] bg-slate-800 text-slate-400 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" />
              Bloqueada
            </span>
          ) : (
            <span className="badge text-[10px] bg-slate-800 text-slate-400">
              {closedAt ? 'Encerrada' : 'Fechada'}
            </span>
          )}
        </div>

        {/* Contagem Regressiva e Barra de Progresso ao Vivo (Quando a Chamada está Aberta e sem registro) */}
        {!isRegistered && isOpen && (
          <div className="bg-blue-950/50 border border-blue-500/40 rounded-lg p-2.5 flex flex-col gap-1.5 mt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-blue-300 font-medium flex items-center gap-1.5">
                <Timer className="w-3.5 h-3.5 text-blue-400 animate-spin" style={{ animationDuration: '4s' }} />
                <span>Tempo restante para registrar:</span>
              </span>
              <span className="font-mono font-bold text-xs text-blue-300 bg-blue-900/60 px-2 py-0.5 rounded border border-blue-500/40">
                ⏳ {countdown.formatted}
              </span>
            </div>
            {/* Barra de progresso */}
            <div className="w-full bg-slate-800/80 rounded-full h-1 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-cyan-400 h-1 rounded-full transition-all duration-1000"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Botões de Ação */}
      {isRegistered ? (
        <button
          type="button"
          onClick={() => onViewReceipt({
            ...attendance,
            student_name: currentUser.name,
            registration_number: currentUser.registration_number,
            course_name: session.course_name,
            course_code: session.course_code,
            room_name: session.room_name
          })}
          className="btn-secondary w-full py-2 text-xs flex items-center justify-center gap-1.5 text-emerald-400 font-medium hover:bg-emerald-950/30"
        >
          <QrCode className="w-3.5 h-3.5" />
          <span>Ver Comprovante Digital ({callType}ª Presença)</span>
        </button>
      ) : isOpen ? (
        <button
          type="button"
          onClick={onCheckIn}
          className="btn-primary w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/30 animate-pulse"
        >
          <Camera className="w-4 h-4" />
          <span>Registrar {callType}ª Presença (GPS + Reconhecimento Facial)</span>
        </button>
      ) : isBlocked ? (
        <button
          type="button"
          disabled
          className="w-full py-2.5 text-xs rounded-lg bg-slate-800/40 text-slate-500 flex items-center justify-center gap-1.5 border border-slate-800 cursor-not-allowed"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Aguardando Conclusão da 1ª Presença</span>
        </button>
      ) : (
        <button
          type="button"
          disabled
          className="w-full py-2.5 text-xs rounded-lg bg-slate-800/40 text-slate-500 flex items-center justify-center gap-1.5 border border-slate-800 cursor-not-allowed"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{closedAt ? 'Prazo de Registro Finalizado' : 'Aguardando Abertura pelo Docente'}</span>
        </button>
      )}

    </div>
  );
}

export default function StudentDashboard({ currentUser, onUserUpdated }) {
  const [sessions, setSessions] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modais Ativos e Tipo de Chamada Selecionado (1 ou 2)
  const [checkInTarget, setCheckInTarget] = useState(null); // { session, callType: 1 | 2 } - alvo do check-in
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showFaceEnroll, setShowFaceEnroll] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);

      const [{ data: dataSessions }, { data: dataHistory }] = await Promise.all([
        apiFetch('/api/sessions'),
        apiFetch(`/api/attendance/history/${currentUser.id}`)
      ]);

      if (dataSessions.success) {
        setSessions(dataSessions.sessions);
      }
      if (dataHistory.success) {
        setHistory(dataHistory.history);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do aluno:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.id) {
      loadData();
    }
  }, [currentUser]);

  // Consulta periódica autenticada (a cada 8 segundos)
  useEffect(() => {
    if (!currentUser?.id) return;
    const interval = setInterval(() => {
      apiFetch('/api/sessions')
        .then(({ data }) => {
          if (data.success) setSessions(data.sessions);
        })
        .catch((err) => console.error('Erro no polling:', err));
    }, 8000);
    return () => clearInterval(interval);
  }, [currentUser?.id]);

  return (
    <div className="flex flex-col gap-8 w-full animate-fade-in">

      {/* Cabeçalho do Perfil do Aluno */}
      <div className="glass-card p-6 border-slate-800 bg-gradient-to-r from-slate-900/95 via-slate-900/70 to-blue-950/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">

          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <img
                src={currentUser?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                alt={currentUser?.name}
                className="w-16 h-16 rounded-2xl ring-2 ring-blue-500/50 object-cover shadow-lg"
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-950 flex items-center justify-center text-white text-[10px]" title="Biometria Facial Ativa">
                ✓
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-white font-heading">
                  {currentUser?.name}
                </h1>
                <span className="badge badge-info text-xs">Aluno UGB</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400">
                Matrícula: <strong className="font-mono text-slate-200">{currentUser?.registration_number}</strong> • Engenharia de Software
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setShowFaceEnroll(true)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold border flex items-center gap-2 transition-all ${
                currentUser?.face_registered
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40'
                  : 'bg-cyan-600/20 border-cyan-500/50 text-cyan-300 hover:bg-cyan-600/30'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>{currentUser?.face_registered ? 'Biometria Facial Ativa (Atualizar)' : 'Cadastrar Face Real no SQLite'}</span>
            </button>

            <div className="flex items-center gap-3.5 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80">
              <div className="text-left md:text-right">
                <div className="text-[11px] text-slate-400 font-medium">Total de Presenças</div>
                <div className="text-xl font-bold text-emerald-400 font-mono">
                  {history.length} Presenças
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* AULAS DE HOJE E REGISTRO DE 1ª / 2ª PRESENÇA */}
      <section className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white font-heading">
              Aulas de Hoje (Registro de 1ª e 2ª Presença)
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <Timer className="w-3.5 h-3.5 text-blue-400" />
            <span>Janela de 20 min por chamada</span>
          </span>
        </div>

        {sessions.length === 0 ? (
          <div className="glass-card p-10 text-center text-slate-400 flex flex-col items-center gap-3">
            <Clock className="w-9 h-9 text-slate-600" />
            <div className="text-sm font-semibold text-slate-300">Nenhuma aula programada para hoje.</div>
            <p className="text-xs text-slate-500 max-w-md">
              Assim que o professor abrir a turma no campus, as opções de registro de presença aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {sessions.map((s) => {
              // A 2ª Presença fica bloqueada se a 1ª Presença nunca foi aberta ou ainda está aberta
              const isP2Blocked = !s.p1_opened_at || s.status_p1 === 'open';
              const p2BlockedReason = !s.p1_opened_at
                ? 'Aguardando abertura da 1ª chamada pelo professor no início da aula.'
                : s.status_p1 === 'open'
                  ? 'A 1ª presença está em andamento. A 2ª chamada só será liberada após o término da 1ª presença e encerramento da aula.'
                  : '';

              return (
                <div
                  key={s.id}
                  className="glass-card p-6 border border-slate-800 bg-slate-900/90 shadow-xl flex flex-col gap-5"
                >
                  {/* Cabeçalho da Aula */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="badge badge-info text-xs">{s.course_code}</span>
                        <span className="text-xs text-slate-400 font-medium">{s.teacher_name}</span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-white font-heading mt-0.5">
                        {s.course_name}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {s.title}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950/70 py-2 px-3 rounded-lg border border-slate-800/80 self-start sm:self-auto">
                      <MapPin className="w-4 h-4 text-blue-400" />
                      <span>{s.room_name} ({s.room_block})</span>
                    </div>
                  </div>

                  {/* Cartões da 1ª e 2ª Chamada de Presença */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* 1ª PRESENÇA (INÍCIO DA AULA) */}
                    <StudentPresenceCard
                      session={s}
                      callType={1}
                      title="1ª Presença (Início da Aula)"
                      status={s.status_p1}
                      openedAt={s.p1_opened_at}
                      expiresAt={s.p1_expires_at}
                      closedAt={s.p1_closed_at}
                      attendance={s.student_p1}
                      currentUser={currentUser}
                      onCheckIn={() => setCheckInTarget({ session: s, callType: 1 })}
                      onViewReceipt={(receipt) => setSelectedReceipt(receipt)}
                      onExpire={() => loadData()}
                      isBlocked={false}
                    />

                    {/* 2ª PRESENÇA (FINAL DA AULA) */}
                    <StudentPresenceCard
                      session={s}
                      callType={2}
                      title="2ª Presença (Final da Aula)"
                      status={s.status_p2}
                      openedAt={s.p2_opened_at}
                      expiresAt={s.p2_expires_at}
                      closedAt={s.p2_closed_at}
                      attendance={s.student_p2}
                      currentUser={currentUser}
                      onCheckIn={() => setCheckInTarget({ session: s, callType: 2 })}
                      onViewReceipt={(receipt) => setSelectedReceipt(receipt)}
                      onExpire={() => loadData()}
                      isBlocked={isP2Blocked}
                      blockedReason={p2BlockedReason}
                    />

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal de Check-In com Captura Facial e GPS */}
      {checkInTarget && (
        <CheckInModal
          session={checkInTarget.session}
          student={currentUser}
          callType={checkInTarget.callType}
          onClose={() => setCheckInTarget(null)}
          onSuccess={() => {
            loadData();
          }}
        />
      )}

      {/* Modal de Comprovante Digital */}
      {selectedReceipt && (
        <ReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}

      {/* Modal de Cadastro Biométrico Facial */}
      {showFaceEnroll && (
        <FaceEnrollModal
          student={currentUser}
          onClose={() => setShowFaceEnroll(false)}
          onEnrolled={(updated) => {
            if (onUserUpdated) onUserUpdated(updated);
          }}
        />
      )}

    </div>
  );
}
