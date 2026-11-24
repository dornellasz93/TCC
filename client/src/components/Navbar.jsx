import React from 'react';
import {
  GraduationCap,
  UserCheck,
  Users,
  BarChart3,
  Info,
  Sparkles,
  ChevronDown,
  LogOut,
  ShieldCheck
} from 'lucide-react';

export default function Navbar({
  currentUser,
  allUsers,
  onSwitchUser,
  activeTab,
  setActiveTab,
  onOpenAbout,
  onLogout
}) {
  return (
    <header className="border-b border-slate-800/90 bg-slate-950/95 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">

          {/* Logotipo e Identificação UGB */}
          <div className="flex items-center gap-3.5 flex-shrink-0">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/25 border border-blue-400/30">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white font-heading">
                  UGB <span className="text-blue-400">PRESENÇA</span>
                </span>
                <span className={`badge ${currentUser?.role === 'teacher' ? 'badge-purple' : 'badge-info'} text-[10px] uppercase font-bold py-0.5 px-2`}>
                  {currentUser?.role === 'teacher' ? 'Portal Docente' : 'Portal do Aluno'}
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Centro Universitário Geraldo Di Biase • Engenharia de Software
              </p>
            </div>
          </div>

          {/* Navegação por Perfil */}
          <nav className="flex items-center gap-2">
            {currentUser?.role === 'student' ? (
              <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('student_home')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                    activeTab === 'student_home'
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
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                    activeTab === 'student_history'
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
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                    activeTab === 'teacher_live'
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
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                    activeTab === 'teacher_audit'
                      ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Auditoria & Telemetria</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onOpenAbout}
              className="px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-cyan-400 hover:bg-slate-800/60 transition-all hidden md:flex items-center gap-1.5"
            >
              <Info className="w-4 h-4" />
              <span>Sobre o TCC</span>
            </button>
          </nav>

          {/* Seletor de Perfil e Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative group">
              <div className="flex items-center gap-2.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 py-1.5 px-3 rounded-xl cursor-pointer transition-all shadow-inner">
                <img
                  src={currentUser?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                  alt={currentUser?.name}
                  className="w-8 h-8 rounded-full ring-2 ring-blue-500/50 object-cover flex-shrink-0"
                />
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-semibold text-white truncate max-w-[130px]">
                    {currentUser?.name?.split(' ')[0]} {currentUser?.name?.split(' ')[1]}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    <span className={currentUser?.role === 'teacher' ? 'text-purple-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                      {currentUser?.role === 'teacher' ? '👨‍🏫 Docente' : `👨‍🎓 Aluno (${currentUser?.registration_number})`}
                    </span>
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-transform group-hover:rotate-180" />
              </div>

              {/* Menu Suspenso */}
              <div className="absolute right-0 mt-2 w-72 bg-slate-900/95 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all backdrop-blur-xl">
                <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/80 mb-1 flex items-center justify-between">
                  <span>Alternar Perfil Demo (JWT)</span>
                  <Sparkles className="w-3 h-3 text-blue-400" />
                </div>

                <div className="max-h-60 overflow-y-auto flex flex-col gap-1">
                  {allUsers?.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => onSwitchUser(u)}
                      className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-all ${
                        currentUser?.id === u.id
                          ? 'bg-blue-600/20 border border-blue-500/40 text-white'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <img src={u.avatar_url} alt={u.name} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white truncate">{u.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {u.role === 'teacher' ? '👨‍🏫 Professor' : `👨‍🎓 Aluno • Mat. ${u.registration_number}`}
                        </div>
                      </div>
                      {currentUser?.id === u.id && (
                        <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa] flex-shrink-0"></div>
                      )}
                    </button>
                  ))}
                </div>

                <div className="border-t border-slate-800/80 mt-1 pt-1">
                  <button
                    type="button"
                    onClick={onLogout}
                    className="w-full flex items-center gap-2 p-2 rounded-lg text-left text-rose-400 hover:bg-rose-950/30 text-xs font-semibold transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sair da Conta (Logout)</span>
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="p-2 rounded-xl bg-slate-900/90 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 text-xs transition-all flex items-center gap-1.5"
              title="Encerrar sessão"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}
