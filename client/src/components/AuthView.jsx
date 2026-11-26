import React, { useState } from 'react';
import { apiFetch } from '../utils/api';
import {
  Lock,
  Mail,
  User,
  Phone,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function AuthView({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [selectedRole, setSelectedRole] = useState('student'); // 'student' | 'teacher'

  // Estado do formulário de login (sem senha padrão hardcoded)
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Estado do formulário de cadastro (público exclusivo para alunos)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regAvatar, setRegAvatar] = useState(
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
  );

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const avatarPresets = [
    { url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', label: 'Avatar 1' },
    { url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', label: 'Avatar 2' },
    { url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150', label: 'Avatar 3' },
    { url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', label: 'Avatar 4' },
    { url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', label: 'Avatar 5' }
  ];

  const handleLoginSubmit = async (e) => {
    e?.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!loginIdentifier.trim() || !loginPassword) {
      setErrorMessage('Por favor, informe matrícula/e-mail e senha.');
      return;
    }

    try {
      setLoading(true);
      const { data } = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          login: loginIdentifier.trim(),
          password: loginPassword,
          expectedRole: selectedRole
        })
      });

      if (data.success && data.user && data.token) {
        setSuccessMessage(data.message);
        setTimeout(() => {
          onLoginSuccess(data.user, data.token);
        }, 300);
      } else {
        setErrorMessage(data.message || 'Erro ao realizar login.');
      }
    } catch {
      setErrorMessage('Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!regName.trim() || !regEmail.trim() || !regNumber.trim() || !regPassword.trim()) {
      setErrorMessage('Preencha todos os campos obrigatórios.');
      return;
    }

    if (regPassword.length < 8) {
      setErrorMessage('A senha deve conter no mínimo 8 caracteres.');
      return;
    }

    try {
      setLoading(true);
      const { data } = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: regName.trim(),
          email: regEmail.trim(),
          registration_number: regNumber.trim(),
          phone: regPhone.trim(),
          password: regPassword,
          role: 'student',
          avatar_url: regAvatar
        })
      });

      if (data.success && data.user && data.token) {
        setSuccessMessage(data.message);
        setTimeout(() => {
          onLoginSuccess(data.user, data.token);
        }, 350);
      } else {
        setErrorMessage(data.message || 'Erro ao criar conta.');
      }
    } catch {
      setErrorMessage('Erro de conexão ao processar cadastro.');
    } finally {
      setLoading(false);
    }
  };

  const isTeacher = mode === 'login' && selectedRole === 'teacher';

  return (
    <div className="min-h-screen flex items-center justify-center py-12 sm:py-16 px-4 sm:px-6 animate-fade-in">
      <div className="max-w-2xl w-full flex flex-col items-center gap-10 sm:gap-12">

        {/* Cabeçalho Principal Limpo */}
        <div className="text-center flex flex-col items-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-heading">
            Sistema de Presença <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">Inteligente</span>
          </h1>
        </div>

        {/* Cartão Principal Glassmórfico de Autenticação */}
        <div className={`glass-card w-full border shadow-2xl overflow-hidden transition-all duration-300 ${isTeacher ? 'border-purple-500/40 bg-slate-900/90 shadow-purple-500/10' : 'border-blue-500/40 bg-slate-900/90 shadow-blue-500/10'
          }`}>

          {/* Seletor Segmentado de Perfil (no modo Login) */}
          {mode === 'login' && (
            <div className="p-6 sm:p-8 bg-slate-950/80 border-b border-slate-800 flex flex-col gap-5">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Selecione seu Tipo de Perfil Acadêmico:</span>
                <span className={`badge ${isTeacher ? 'badge-purple' : 'badge-info'} text-[10px]`}>
                  {isTeacher ? 'Área do Professor' : 'Área do Aluno'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole('student');
                    setErrorMessage(null);
                  }}
                  className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 relative overflow-hidden ${!isTeacher
                      ? 'bg-blue-950/40 border-blue-500/80 shadow-lg shadow-blue-500/20 ring-1 ring-blue-500/40'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 opacity-75'
                    }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold ${!isTeacher ? 'bg-blue-600 text-white shadow-md shadow-blue-600/40' : 'bg-slate-800 text-slate-400'
                    }`}>
                    👨‍🎓
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white font-heading">Aluno / Discente</span>
                      {!isTeacher && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Validação biométrica facial e GPS para 1ª e 2ª presença em sala de aula.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedRole('teacher');
                    setErrorMessage(null);
                  }}
                  className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 relative overflow-hidden ${isTeacher
                      ? 'bg-purple-950/40 border-purple-500/80 shadow-lg shadow-purple-500/20 ring-1 ring-purple-500/40'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 opacity-75'
                    }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold ${isTeacher ? 'bg-purple-600 text-white shadow-md shadow-purple-600/40' : 'bg-slate-800 text-slate-400'
                    }`}>
                    👨‍🏫
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white font-heading">Professor / Docente</span>
                      {isTeacher && <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      Abertura de chamadas de 20 minutos, controle de turmas e relatórios de frequência.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Abas de Alternância de Modo (Login vs Cadastro de Aluno) */}
          <div className="flex border-b border-slate-800 bg-slate-950/40">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
              }}
              className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider text-center transition-all border-b-2 ${mode === 'login'
                  ? isTeacher
                    ? 'border-purple-500 text-purple-400 bg-purple-950/20'
                    : 'border-blue-500 text-blue-400 bg-blue-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
            >
              Entrar (Login)
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('register');
                setSelectedRole('student');
                setErrorMessage(null);
              }}
              className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider text-center transition-all border-b-2 ${mode === 'register'
                  ? 'border-blue-500 text-blue-400 bg-blue-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
            >
              Criar Conta (Aluno)
            </button>
          </div>

          {/* Área de Conteúdo do Formulário */}
          <div className="p-6 sm:p-9 flex flex-col gap-8">

            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2.5 animate-shake">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {mode === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="flex flex-col gap-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    {isTeacher ? 'Matrícula Docente ou E-mail' : 'Matrícula do Aluno ou E-mail'}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder={isTeacher ? 'Ex: DOC-1001 ou wellington@ugb.edu.br' : 'Ex: 2024102278 ou pedro.dornellas@ugb.edu.br'}
                      className="glass-input pl-10 text-xs"
                      autoComplete="username"
                      required
                    />
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300">Senha</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Digite sua senha"
                      className="glass-input pl-10 pr-10 text-xs"
                      autoComplete="current-password"
                      required
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 px-5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-lg transition-all mt-2 ${isTeacher
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/30'
                      : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-blue-600/30'
                    }`}
                >
                  {loading ? (
                    <span>Autenticando...</span>
                  ) : (
                    <>
                      <span>Acessar Portal do {isTeacher ? 'Professor' : 'Aluno'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-5 text-xs">
                <p className="text-[11px] text-slate-400 bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                  O auto-cadastro é exclusivo para <strong>Alunos</strong>. Contas docentes são provisionadas pela administração.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-slate-300">Nome Completo *</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="Ex: Pedro Henrique Dornellas"
                        className="glass-input pl-10 text-xs"
                        required
                      />
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-slate-300">E-mail Acadêmico *</label>
                    <div className="relative">
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="nome@ugb.edu.br"
                        className="glass-input pl-10 text-xs"
                        required
                      />
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-slate-300">Matrícula do Aluno *</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={regNumber}
                        onChange={(e) => setRegNumber(e.target.value)}
                        placeholder="Ex: 2024102283"
                        className="glass-input pl-10 text-xs font-mono"
                        required
                      />
                      <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-slate-300">Celular / WhatsApp</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="(24) 99123-4567"
                        className="glass-input pl-10 text-xs font-mono"
                      />
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-300">Senha de Acesso (mínimo 8 caracteres) *</label>
                  <div className="relative">
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Crie uma senha forte (mín. 8 caracteres)"
                      className="glass-input pl-10 text-xs"
                      minLength={8}
                      autoComplete="new-password"
                      required
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <label className="font-semibold text-slate-300">Escolha um Avatar Inicial</label>
                  <div className="flex items-center gap-3 overflow-x-auto pb-1">
                    {avatarPresets.map((av, idx) => (
                      <img
                        key={idx}
                        src={av.url}
                        alt={av.label}
                        onClick={() => setRegAvatar(av.url)}
                        className={`w-10 h-10 rounded-full object-cover cursor-pointer transition-all ${regAvatar === av.url
                            ? 'ring-2 ring-blue-500 scale-110 shadow-lg'
                            : 'opacity-60 hover:opacity-100'
                          }`}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-lg transition-all mt-2 bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30"
                >
                  {loading ? (
                    <span>Cadastrando...</span>
                  ) : (
                    <>
                      <span>Finalizar Cadastro de Aluno</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
