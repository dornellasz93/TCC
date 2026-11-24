import React, { useState } from 'react';
import { apiFetch, demoLoginUser } from '../utils/api';
import { 
  GraduationCap, 
  UserCheck, 
  Users, 
  Lock, 
  Mail, 
  User, 
  Phone, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  Camera,
  MapPin,
  Clock
} from 'lucide-react';

export default function AuthView({ onLoginSuccess, demoUsers = [] }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register' - modo da tela
  const [selectedRole, setSelectedRole] = useState('student'); // 'student' | 'teacher' - papel do usuário

  // Estado do formulário de login
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('123');
  const [showPassword, setShowPassword] = useState(false);

  // Estado do formulário de cadastro
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regAvatar, setRegAvatar] = useState(
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
  );

  // Estado de retorno visual da interface
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Avatares pré-definidos para cadastro rápido
  const avatarPresets = [
    { url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', label: 'Avatar 1' },
    { url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', label: 'Avatar 2' },
    { url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150', label: 'Avatar 3' },
    { url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', label: 'Avatar 4' },
    { url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', label: 'Avatar 5' }
  ];

  // Trata o envio do formulário de login
  const handleLoginSubmit = async (e) => {
    e?.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!loginIdentifier.trim()) {
      setErrorMessage('Por favor, informe a matrícula ou e-mail.');
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

      if (data.success && data.user) {
        setSuccessMessage(data.message);
        setTimeout(() => {
          onLoginSuccess(data.user, data.token);
        }, 400);
      } else {
        setErrorMessage(data.message || 'Erro ao realizar login.');
      }
    } catch (err) {
      setErrorMessage('Erro de conexão com o servidor da UGB.');
    } finally {
      setLoading(false);
    }
  };

  // Trata o envio do formulário de cadastro
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!regName.trim() || !regEmail.trim() || !regNumber.trim() || !regPassword.trim()) {
      setErrorMessage('Preencha todos os campos obrigatórios.');
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
          role: selectedRole,
          avatar_url: regAvatar
        })
      });

      if (data.success && data.user) {
        setSuccessMessage(data.message);
        setTimeout(() => {
          onLoginSuccess(data.user, data.token);
        }, 500);
      } else {
        setErrorMessage(data.message || 'Erro ao criar conta.');
      }
    } catch (err) {
      setErrorMessage('Erro de conexão ao processar cadastro.');
    } finally {
      setLoading(false);
    }
  };

  // Login rápido de demonstração em 1 clique (emite JWT real)
  const handleQuickDemoLogin = async (user) => {
    setSelectedRole(user.role);
    setLoginIdentifier(user.registration_number);
    setLoginPassword('123');
    setLoading(true);
    try {
      const session = await demoLoginUser(user.id);
      if (session) {
        onLoginSuccess(session.user, session.token);
      } else {
        setErrorMessage('Não foi possível autenticar o perfil demo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const isTeacher = selectedRole === 'teacher';

  return (
    <div className="min-h-[90vh] flex items-center justify-center py-8 px-4 sm:px-6 animate-fade-in">
      <div className="max-w-4xl w-full flex flex-col items-center gap-8">
        
        {/* Cabeçalho Institucional Superior */}
        <div className="text-center flex flex-col items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold text-blue-400 shadow-inner">
            <GraduationCap className="w-4 h-4" />
            <span>Centro Universitário Geraldo Di Biase (UGB) • Engenharia de Software</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-heading">
            Sistema de Presença <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">Inteligente</span>
          </h1>

          <p className="text-sm text-slate-400 max-w-xl">
            Autenticação unificada com segmentação de perfis para <strong>Professores</strong> e <strong>Alunos</strong> com validação por GPS Geofencing e Biometria Facial.
          </p>
        </div>

        {/* Cartão Principal Glassmórfico de Autenticação */}
        <div className={`glass-card w-full border shadow-2xl overflow-hidden transition-all duration-300 ${
          isTeacher ? 'border-purple-500/40 bg-slate-900/90 shadow-purple-500/10' : 'border-blue-500/40 bg-slate-900/90 shadow-blue-500/10'
        }`}>
          
          {/* Seletor Segmentado de Perfil (Professor vs Aluno) */}
          <div className="p-4 sm:p-6 bg-slate-950/80 border-b border-slate-800 flex flex-col gap-4">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Selecione seu Tipo de Perfil Acadêmico:</span>
              <span className={`badge ${isTeacher ? 'badge-purple' : 'badge-info'} text-[10px]`}>
                {isTeacher ? 'Área do Professor' : 'Área do Aluno'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Cartão Aluno */}
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('student');
                  setErrorMessage(null);
                  if (mode === 'login' && !loginIdentifier) setLoginIdentifier('2024102278');
                }}
                className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 relative overflow-hidden ${
                  !isTeacher
                    ? 'bg-blue-950/40 border-blue-500/80 shadow-lg shadow-blue-500/20 ring-1 ring-blue-500/40'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 opacity-75'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold ${
                  !isTeacher ? 'bg-blue-600 text-white shadow-md shadow-blue-600/40' : 'bg-slate-800 text-slate-400'
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

              {/* Cartão Professor */}
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('teacher');
                  setErrorMessage(null);
                  if (mode === 'login' && !loginIdentifier) setLoginIdentifier('DOC-1001');
                }}
                className={`p-4 rounded-xl border text-left transition-all flex items-start gap-3.5 relative overflow-hidden ${
                  isTeacher
                    ? 'bg-purple-950/40 border-purple-500/80 shadow-lg shadow-purple-500/20 ring-1 ring-purple-500/40'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 opacity-75'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold ${
                  isTeacher ? 'bg-purple-600 text-white shadow-md shadow-purple-600/40' : 'bg-slate-800 text-slate-400'
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

          {/* Abas de Alternância de Modo (Login vs Cadastro) */}
          <div className="flex border-b border-slate-800 bg-slate-950/40">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
              }}
              className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider text-center transition-all border-b-2 ${
                mode === 'login'
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
                setErrorMessage(null);
              }}
              className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider text-center transition-all border-b-2 ${
                mode === 'register'
                  ? isTeacher
                    ? 'border-purple-500 text-purple-400 bg-purple-950/20'
                    : 'border-blue-500 text-blue-400 bg-blue-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Criar Nova Conta ({isTeacher ? 'Docente' : 'Aluno'})
            </button>
          </div>

          {/* Área de Conteúdo do Formulário */}
          <div className="p-6 sm:p-8 flex flex-col gap-6">

            {/* Alertas de Erro / Sucesso */}
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

            {/* 1. FORMULÁRIO DE LOGIN */}
            {mode === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
                
                {/* Campo Identificador (Matrícula ou E-mail) */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    {isTeacher ? 'Matrícula Docente ou E-mail UGB' : 'Matrícula do Aluno ou E-mail'}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder={isTeacher ? 'Ex: DOC-1001 ou geraldo.dibiase@ugb.edu.br' : 'Ex: 2024102278 ou pedro.dornellas@ugb.edu.br'}
                      className="glass-input pl-10 text-xs"
                      required
                    />
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Campo Senha */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-slate-300">Senha</label>
                    <span className="text-[11px] text-slate-500">Padrão demo: 123</span>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Sua senha de acesso"
                      className="glass-input pl-10 pr-10 text-xs"
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

                {/* Botão Enviar Login */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 px-5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-lg transition-all mt-2 ${
                    isTeacher
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
              /* 2. FORMULÁRIO DE CADASTRO */
              <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-4 text-xs">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Nome */}
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

                  {/* E-mail */}
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
                  {/* Número de Matrícula */}
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-slate-300">
                      {isTeacher ? 'Matrícula Docente *' : 'Matrícula do Aluno *'}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={regNumber}
                        onChange={(e) => setRegNumber(e.target.value)}
                        placeholder={isTeacher ? 'Ex: DOC-1003' : 'Ex: 2024102283'}
                        className="glass-input pl-10 text-xs font-mono"
                        required
                      />
                      <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  {/* Telefone */}
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

                {/* Senha */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-300">Senha de Acesso *</label>
                  <div className="relative">
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Crie uma senha segura"
                      className="glass-input pl-10 text-xs"
                      required
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Seleção de avatar */}
                <div className="flex flex-col gap-2 pt-1">
                  <label className="font-semibold text-slate-300">Escolha um Avatar Inicial</label>
                  <div className="flex items-center gap-3 overflow-x-auto pb-1">
                    {avatarPresets.map((av, idx) => (
                      <img
                        key={idx}
                        src={av.url}
                        alt={av.label}
                        onClick={() => setRegAvatar(av.url)}
                        className={`w-10 h-10 rounded-full object-cover cursor-pointer transition-all ${
                          regAvatar === av.url
                            ? isTeacher
                              ? 'ring-2 ring-purple-500 scale-110 shadow-lg'
                              : 'ring-2 ring-blue-500 scale-110 shadow-lg'
                            : 'opacity-60 hover:opacity-100'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Botão Enviar Cadastro */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 px-5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 shadow-lg transition-all mt-2 ${
                    isTeacher
                      ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                  }`}
                >
                  {loading ? (
                    <span>Cadastrando...</span>
                  ) : (
                    <>
                      <span>Finalizar Cadastro de {isTeacher ? 'Professor' : 'Aluno'}</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>

              </form>
            )}

            {/* Seletor Rápido de Contas de Demonstração (1 Clique) */}
            <div className="pt-4 border-t border-slate-800/80 flex flex-col gap-3">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                <span>Acesso Rápido de Demonstração (Banca TCC)</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {demoUsers.slice(0, 4).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleQuickDemoLogin(u)}
                    className="p-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all flex flex-col gap-1 group"
                  >
                    <div className="flex items-center gap-2">
                      <img src={u.avatar_url} alt={u.name} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                      <span className="text-[10px] font-bold text-white truncate group-hover:text-blue-400">
                        {u.name.split(' ')[0]}
                      </span>
                    </div>
                    <span className={`text-[9px] font-semibold ${u.role === 'teacher' ? 'text-purple-400' : 'text-emerald-400'}`}>
                      {u.role === 'teacher' ? '👨‍🏫 Professor' : '👨‍🎓 Aluno (TCC)'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

          </div>

        </div>

        {/* Pílulas de Recursos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full text-xs text-slate-400">
          <div className="glass-card p-3.5 flex items-center gap-3 border-slate-800">
            <MapPin className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <div>
              <div className="font-semibold text-white">Geofencing Real</div>
              <div className="text-[11px] text-slate-500">Validação Haversine por sala</div>
            </div>
          </div>
          <div className="glass-card p-3.5 flex items-center gap-3 border-slate-800">
            <Camera className="w-5 h-5 text-purple-400 flex-shrink-0" />
            <div>
              <div className="font-semibold text-white">Biometria Facial</div>
              <div className="text-[11px] text-slate-500">Liveness e detecção facial</div>
            </div>
          </div>
          <div className="glass-card p-3.5 flex items-center gap-3 border-slate-800">
            <Clock className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <div className="font-semibold text-white">Janela de 20 Min</div>
              <div className="text-[11px] text-slate-500">1ª e 2ª presença sequenciais</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
