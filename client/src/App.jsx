import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AuthView from './components/AuthView';
import StudentDashboard from './components/StudentDashboard';
import StudentHistoryView from './components/StudentHistoryView';
import TeacherDashboard from './components/TeacherDashboard';
import AuditDashboard from './components/AuditDashboard';
import AboutTccModal from './components/AboutTccModal';
import { RefreshCw, ShieldAlert, Lock, Download } from 'lucide-react';
import {
  apiFetch,
  getStoredUser,
  getAuthToken,
  setAuthSession,
  clearAuthSession,
  demoLoginUser,
  isInsecureRemoteOrigin,
  redirectToHttpsPortal,
  consumeSsoTokenFromHash
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
            // Garante que o usuário armazenado possua um token JWT válido
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
    const init = async () => {
      const restoredUser = await consumeSsoTokenFromHash();
      if (restoredUser) {
        setCurrentUser(restoredUser);
        setActiveTab(restoredUser.role === 'teacher' ? 'teacher_live' : 'student_home');
      }
      await loadUsers();
    };
    init();
  }, []);

  const insecureOrigin = isInsecureRemoteOrigin();

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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white overflow-x-hidden">
        {insecureOrigin && (
          <div className="bg-amber-950/90 border-b border-amber-500/40 px-4 py-2.5 text-xs text-amber-200">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>
                  Conexão <strong>HTTP</strong> detectada: para usar <strong>GPS Real</strong> e <strong>Câmera ao Vivo</strong> no celular, mude para HTTPS.
                </span>
              </div>
              <button
                type="button"
                onClick={() => redirectToHttpsPortal()}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center gap-1.5 self-start sm:self-auto transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Abrir em HTTPS Seguro</span>
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 flex flex-col justify-center">
          <AuthView
            onLoginSuccess={handleLoginSuccess}
            demoUsers={users}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white pb-16 overflow-x-hidden">
      {insecureOrigin && (
        <div className="bg-amber-950/90 border-b border-amber-500/40 px-4 py-2.5 text-xs text-amber-200">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span>
                Conexão <strong>HTTP</strong> detectada: navegadores mobile bloqueiam <strong>GPS Real</strong> e <strong>Câmera ao Vivo</strong> fora de HTTPS.
              </span>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => redirectToHttpsPortal()}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Abrir em HTTPS (Liberar GPS e Câmera)</span>
              </button>
              <a
                href="/api/ssl/ca.crt"
                className="px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-amber-500/30 text-amber-200 text-[11px] flex items-center gap-1"
                title="Opcional: instale o certificado CA local no iOS/Android para não exibir aviso de segurança"
              >
                <Download className="w-3 h-3" />
                <span>CA</span>
              </a>
            </div>
          </div>
        </div>
      )}
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

      {/* Barra Flutuante de Acesso Rápido para Apresentação */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 max-w-[calc(100vw-1.5rem)] overflow-x-auto bg-slate-900/95 backdrop-blur-xl border border-slate-800 py-1.5 px-2.5 sm:px-3 rounded-full shadow-2xl flex items-center gap-1.5 sm:gap-2 text-xs">
        <span className="text-[11px] text-slate-400 font-medium px-1.5 hidden sm:inline flex-shrink-0">
          Alternar Perfil Rápido:
        </span>

        {users.slice(0, 4).map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => handleSwitchUser(u)}
            className={`px-2.5 sm:px-3 py-1 rounded-full text-[11px] font-semibold transition-all flex items-center gap-1 flex-shrink-0 ${currentUser?.id === u.id
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
          >
            <span>{u.role === 'teacher' ? '👨‍🏫' : '👨‍🎓'}</span>
            <span className="truncate max-w-[72px] sm:max-w-[100px]">{u.name.split(' ')[0]}</span>
          </button>
        ))}

        <button
          type="button"
          onClick={handleLogout}
          className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-950/60 text-rose-300 hover:bg-rose-900/60 border border-rose-500/30 transition-all ml-0.5 flex items-center gap-1 flex-shrink-0"
          title="Fazer Logout"
        >
          <span>Sair</span>
        </button>
      </div>

      {isAboutOpen && (
        <AboutTccModal onClose={() => setIsAboutOpen(false)} />
      )}

      <footer className="border-t border-slate-900 bg-slate-950/60 py-5 text-center text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-[11px] text-slate-400">
            Autores: <strong>Pedro Henrique Teixeira Dornellas Soares de Souza</strong> &amp; <strong>Pedro Gabriel da Costa Ribeiro</strong>
          </p>
        </div>
      </footer>
    </div>
  );
}
