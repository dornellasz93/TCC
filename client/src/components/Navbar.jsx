import React from 'react';
import {
  GraduationCap,
  UserCheck,
  Users,
  BarChart3,
  Info,
  LogOut,
  ShieldCheck
} from 'lucide-react';

export default function Navbar({
  currentUser,
  activeTab,
  setActiveTab,
  onOpenAbout,
  onLogout
}) {
  const isTeacher = currentUser?.role === 'teacher' || currentUser?.role === 'admin';

  return (
    <header className="border-b border-slate-800/90 bg-slate-950/95 backdrop-blur-xl sticky top-0 z-40 w-full">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Linha Principal */}
        <div className="flex items-center justify-between h-16 md:h-20 gap-2 sm:gap-4">

          {/* Logotipo e Identificação UGB */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25 border border-blue-400/30 flex-shrink-0">
              <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="text-base sm:text-xl font-bold tracking-tight text-white font-heading whitespace-nowrap">
                  UGB <span className="text-blue-400">PRESENÇA</span>
                </span>
                <span className={`badge ${isTeacher ? 'badge-purple' : 'badge-info'} text-[9px] sm:text-[10px] uppercase font-bold py-0.5 px-2 hidden sm:inline-flex`}>
                  {isTeacher ? 'Portal Docente' : 'Portal do Aluno'}
                </span>
              </div>
            </div>
          </div>

          {/* Navegação por Perfil (Desktop / Tablet) */}
          <nav className="hidden md:flex items-center gap-2 flex-shrink-0">
            {!isTeacher ? (
              <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('student_home')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${activeTab === 'student_home'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Minhas Presenças</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('student_history')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${activeTab === 'student_history'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Extrato</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('teacher_live')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${activeTab === 'teacher_live'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Gerenciar Chamadas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('teacher_audit')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${activeTab === 'teacher_audit'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Auditoria &amp; Telemetria</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onOpenAbout}
              className="px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-cyan-400 hover:bg-slate-800/60 transition-all hidden lg:flex items-center gap-1.5"
            >
              <Info className="w-4 h-4" />
              <span>Sobre o TCC</span>
            </button>
          </nav>

          {/* Identificação do Usuário Autenticado e Logout */}
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 py-1.5 px-2.5 sm:px-3 rounded-xl">
              <img
                src={currentUser?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                alt={currentUser?.name}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full ring-2 ring-blue-500/50 object-cover flex-shrink-0"
              />
              <div className="text-left hidden sm:block">
                <div className="text-xs font-semibold text-white truncate max-w-[140px]">
                  {currentUser?.name}
                </div>
                <div className="text-[10px] text-slate-400">
                  <span className={isTeacher ? 'text-purple-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                    {isTeacher ? 'Docente' : `Aluno (${currentUser?.registration_number})`}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="p-2 sm:px-3 rounded-xl bg-slate-900/90 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 text-xs transition-all flex items-center gap-1.5"
              title="Encerrar sessão"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>

        </div>

        {/* Navegação Compacta em Telas Mobile */}
        <nav className="flex md:hidden pb-3 pt-0.5">
          {!isTeacher ? (
            <div className="grid grid-cols-2 gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 w-full">
              <button
                type="button"
                onClick={() => setActiveTab('student_home')}
                className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 min-w-0 ${activeTab === 'student_home'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                <UserCheck className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">Minhas Presenças</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('student_history')}
                className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 min-w-0 ${activeTab === 'student_history'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                <BarChart3 className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">Extrato</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 w-full">
              <button
                type="button"
                onClick={() => setActiveTab('teacher_live')}
                className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 min-w-0 ${activeTab === 'teacher_live'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                <Users className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">Chamadas</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('teacher_audit')}
                className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 min-w-0 ${activeTab === 'teacher_audit'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">Auditoria</span>
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
