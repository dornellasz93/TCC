import React from 'react';
import { 
  X, 
  GraduationCap, 
  ShieldCheck, 
  Code2, 
  Database, 
  Cpu
} from 'lucide-react';

export default function AboutTccModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="glass-card max-w-2xl w-full border-slate-700 shadow-2xl relative flex flex-col my-8 overflow-hidden">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/70">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-6 h-6 text-blue-400" />
            <div>
              <h2 className="text-base font-bold text-white font-heading">
                Sobre o Projeto de TCC
              </h2>
              <p className="text-[11px] text-slate-400">
                Engenharia de Software • Centro Universitário Geraldo Di Biase (UGB)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 flex flex-col gap-6 text-xs text-slate-300">
          
          {/* Caixa de Título Principal */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/50 to-indigo-950/50 border border-blue-500/30 flex flex-col gap-1.5">
            <span className="badge badge-info text-[10px] self-start">TÍTULO OFICIAL DO PROJETO</span>
            <h3 className="text-sm sm:text-base font-bold text-white font-heading leading-snug mt-1">
              SISTEMA DE REGISTRO DE PRESENÇA ACADÊMICA UTILIZANDO GEOLOCALIZAÇÃO E RECONHECIMENTO FACIAL
            </h3>
            <p className="text-[11px] text-slate-400">
              Volta Redonda - RJ • 2026
            </p>
          </div>

          {/* Autores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-1">
              <div className="text-[10px] text-blue-400 font-semibold uppercase">Autor 1</div>
              <div className="font-bold text-white">Pedro Henrique Teixeira Dornellas Soares de Souza</div>
              <div className="text-[10px] text-slate-400">Curso de Engenharia de Software • UGB</div>
            </div>

            <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-1">
              <div className="text-[10px] text-blue-400 font-semibold uppercase">Autor 2</div>
              <div className="font-bold text-white">Pedro Gabriel da Costa Ribeiro</div>
              <div className="text-[10px] text-slate-400">Curso de Engenharia de Software • UGB</div>
            </div>
          </div>

          {/* Problematização e Objetivos */}
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider text-cyan-400">
              1. Problematização & Objetivos do Estudo
            </h4>
            <p className="text-slate-300 leading-relaxed">
              O controle tradicional de frequência manual consome entre 5 a 10 minutos por aula e está sujeito a fraudes. Este software resolve o problema através da <strong>validação em duas etapas estritas</strong>:
            </p>
            <ul className="list-disc list-inside flex flex-col gap-1 text-slate-400 pl-1">
              <li><strong>Cerco Geográfico (Geofencing via Haversine):</strong> Garante que o aluno esteja fisicamente dentro do raio da sala de aula.</li>
              <li><strong>Reconhecimento Facial com Prova de Vida (Liveness):</strong> Impede o uso de fotos estáticas ou fraudes de identidade.</li>
            </ul>
          </div>

          {/* Detalhamento da Fórmula de Haversine */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-2 font-mono">
            <div className="text-[10px] text-cyan-400 font-bold uppercase font-sans">
              2. Equação da Fórmula de Haversine Aplicada
            </div>
            <div className="text-slate-300 text-[11px] leading-relaxed">
              a = sin²(Δlat / 2) + cos(lat₁) · cos(lat₂) · sin²(Δlon / 2)<br/>
              c = 2 · atan2(√a, √(1 - a))<br/>
              <span className="text-emerald-400 font-bold">d = R · c</span> (onde R = 6.371.000 metros)
            </div>
            <div className="text-[10px] text-slate-400 font-sans">
              Condição de liberação biométrica: <span className="text-white font-mono font-bold">d ≤ R_sala</span> (ex: 35 metros).
            </div>
          </div>

          {/* Arquitetura e Stack */}
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider text-purple-400">
              3. Arquitetura e Stack Tecnológica
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-[11px]">
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 flex flex-col items-center gap-1">
                <Code2 className="w-4 h-4 text-blue-400" />
                <div className="font-bold text-white">React Native</div>
                <div className="text-[9px] text-slate-400">Expo Mobile + Web</div>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 flex flex-col items-center gap-1">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <div className="font-bold text-white">Node.js + Express</div>
                <div className="text-[9px] text-slate-400">API REST + JWT</div>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 flex flex-col items-center gap-1">
                <Database className="w-4 h-4 text-amber-400" />
                <div className="font-bold text-white">SQLite (WAL)</div>
                <div className="text-[9px] text-slate-400">Banco Relacional</div>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 flex flex-col items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <div className="font-bold text-white">Docker + Anti-Fraude</div>
                <div className="text-[9px] text-slate-400">Anti-Mock &amp; Liveness</div>
              </div>
            </div>
          </div>

          {/* Botão de ação */}
          <button
            type="button"
            onClick={onClose}
            className="btn-primary w-full py-2.5 text-xs font-semibold"
          >
            Fechar Painel do TCC
          </button>

        </div>

      </div>
    </div>
  );
}
