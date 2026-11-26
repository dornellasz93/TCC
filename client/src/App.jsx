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
  isInsecureRemoteOrigin,
  redirectToHttpsPortal,
  consumeSsoTokenFromHash
} from './utils/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => (getAuthToken() ? getStoredUser() : null));
  const [activeTab, setActiveTab] = useState(() => {
    const saved = getAuthToken() ? getStoredUser() : null;
    return saved?.role === 'teacher' || saved?.role === 'admin' ? 'teacher_live' : 'student_home';
  });
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const syncCurrentUser = async () => {
    const token = getAuthToken();
    if (!token) {
      clearAuthSession();
      setCurrentUser(null);
      setLoading(false);
      return;
    }

    try {
      const { ok, data } = await apiFetch('/api/auth/me');
      if (ok && data.success && data.user) {
        setCurrentUser(data.user);
        setAuthSession(data.user, token);
      } else {
        clearAuthSession();
        setCurrentUser(null);
      }
    } catch (err) {
      console.error('Erro ao validar sessão JWT:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const restoredUser = await consumeSsoTokenFromHash();
      if (restoredUser) {
        setCurrentUser(restoredUser);
        setActiveTab(restoredUser.role === 'teacher' || restoredUser.role === 'admin' ? 'teacher_live' : 'student_home');
        setLoading(false);
        return;
      }
      await syncCurrentUser();
    };
    init();
  }, []);

  const insecureOrigin = isInsecureRemoteOrigin();

  const handleLoginSuccess = (user, token) => {
    setAuthSession(user, token);
    setCurrentUser(user);
    setActiveTab(user.role === 'teacher' || user.role === 'admin' ? 'teacher_live' : 'student_home');
  };

  const handleLogout = () => {
    clearAuthSession();
    setCurrentUser(null);
  };

  const handleUserUpdated = (updatedUser) => {
    setCurrentUser(updatedUser);
    setAuthSession(updatedUser, getAuthToken());
  };

  if (loading && !currentUser) {
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
          <AuthView onLoginSuccess={handleLoginSuccess} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white overflow-x-hidden">
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
