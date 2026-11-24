import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AuthView from './components/AuthView';
import StudentDashboard from './components/StudentDashboard';
import StudentHistoryView from './components/StudentHistoryView';
import TeacherDashboard from './components/TeacherDashboard';
import AuditDashboard from './components/AuditDashboard';
import AboutTccModal from './components/AboutTccModal';
import { RefreshCw } from 'lucide-react';
import {
  apiFetch,
  getStoredUser,
  getAuthToken,
  setAuthSession,
  clearAuthSession,
  demoLoginUser
} from './utils/api';

export default function App() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [activeTab, setActiveTab] = useState(() => {
    const saved = getStoredUser();
    return saved?.role === 'teacher' ? 'teacher_live' : 'student_home';
  });
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { ok, data } = await apiFetch('/api/auth/users');
      if (ok && data.success && data.users?.length > 0) {
        setUsers(data.users);

        if (currentUser?.id) {
          const matched = data.users.find((u) => u.id === currentUser.id);
          if (matched) {
            setCurrentUser(matched);
            setAuthSession(matched, getAuthToken());
            // Ensure stored user has a valid JWT token
            if (!getAuthToken()) {
              await demoLoginUser(matched.id);
            }
          }
        }
      }
    } catch (err) {
      console.error('Erro ao buscar usuários do sistema:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleLoginSuccess = (user, token) => {
    setAuthSession(user, token);
    setCurrentUser(user);
    setActiveTab(user.role === 'teacher' ? 'teacher_live' : 'student_home');
    loadUsers();
  };

  const handleLogout = () => {
    clearAuthSession();
    setCurrentUser(null);
  };

  const handleSwitchUser = async (user) => {
    const session = await demoLoginUser(user.id);
    const activeUser = session?.user || user;
    setCurrentUser(activeUser);
    setActiveTab(activeUser.role === 'teacher' ? 'teacher_live' : 'student_home');
  };

  const handleUserUpdated = (updatedUser) => {
    setCurrentUser(updatedUser);
    setAuthSession(updatedUser, getAuthToken());
    loadUsers();
  };

  if (loading && !currentUser && users.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300">
        <div className="text-center flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm font-medium font-heading">
            Carregando Sistema de Presença UGB...
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white">
        <header className="border-b border-slate-800/80 bg-slate-950/90 py-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold">
              🎓
            </div>
            <div>
              <div className="text-sm font-bold text-white font-heading">
                UGB <span className="text-blue-400">PRESENÇA</span>
              </div>
              <div className="text-[10px] text-slate-400">Portal Web + Mobile React Native • Docker & SQLite</div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAboutOpen(true)}
            className="text-xs text-slate-400 hover:text-cyan-400 font-medium transition-colors"
          >
            Sobre o Projeto TCC
          </button>
        </header>

        <main className="flex-1 flex flex-col">
          <AuthView
            onLoginSuccess={handleLoginSuccess}
            demoUsers={users}
          />
        </main>

        {isAboutOpen && (
          <AboutTccModal onClose={() => setIsAboutOpen(false)} />
        )}

        <footer className="border-t border-slate-900 bg-slate-950/60 py-4 text-center text-xs text-slate-500 mt-auto">
          <p>Centro Universitário Geraldo Di Biase (UGB) • Engenharia de Software • 2026</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white pb-16">
      <Navbar
        currentUser={currentUser}
        allUsers={users}
        onSwitchUser={handleSwitchUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAbout={() => setIsAboutOpen(true)}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
        {currentUser?.role === 'student' ? (
          <>
            {activeTab === 'student_home' && (
              <StudentDashboard currentUser={currentUser} onUserUpdated={handleUserUpdated} />
            )}
            {activeTab === 'student_history' && (
              <StudentHistoryView currentUser={currentUser} />
            )}
          </>
        ) : (
          <>
            {activeTab === 'teacher_live' && (
              <TeacherDashboard currentUser={currentUser} />
            )}
            {activeTab === 'teacher_audit' && (
              <AuditDashboard />
            )}
          </>
        )}
      </main>

      {/* Presentation Fast Access Floating Dock */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 backdrop-blur-xl border border-slate-800 py-1.5 px-3 rounded-full shadow-2xl flex items-center gap-2 text-xs">
        <span className="text-[11px] text-slate-400 font-medium px-1.5 hidden sm:inline">
          Alternar Perfil Rápido:
        </span>

        {users.slice(0, 4).map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => handleSwitchUser(u)}
            className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
              currentUser?.id === u.id
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>{u.role === 'teacher' ? '👨‍🏫' : '👨‍🎓'}</span>
            <span className="truncate max-w-[100px]">{u.name.split(' ')[0]}</span>
          </button>
        ))}

        <button
          type="button"
          onClick={handleLogout}
          className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-950/60 text-rose-300 hover:bg-rose-900/60 border border-rose-500/30 transition-all ml-1 flex items-center gap-1"
          title="Fazer Logout"
        >
          <span>Sair</span>
        </button>
      </div>

      {isAboutOpen && (
        <AboutTccModal onClose={() => setIsAboutOpen(false)} />
      )}

      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col gap-1">
          <p>Centro Universitário Geraldo Di Biase (UGB) • Curso de Engenharia de Software • 2026</p>
          <p className="text-[11px] text-slate-400">
            Autores: <strong>Pedro Henrique Teixeira Dornellas Soares de Souza</strong> &amp; <strong>Pedro Gabriel da Costa Ribeiro</strong>
          </p>
        </div>
      </footer>
    </div>
  );
}
