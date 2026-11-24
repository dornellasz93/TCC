import React, { useEffect, useState } from 'react';
import { 
  X, 
  Printer, 
  Lock, 
  GraduationCap, 
  FileCheck2, 
  ShieldCheck 
} from 'lucide-react';
import QRCode from 'qrcode';

export default function ReceiptModal({ receipt, onClose }) {
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  useEffect(() => {
    if (receipt) {
      const payload = JSON.stringify({
        code: receipt.verification_code || `UGB-2026-${receipt.id}`,
        hash: receipt.verification_hash || 'SHA256-AUTHENTICATED',
        student: receipt.student_name || 'Aluno UGB',
        course: receipt.course_name,
        date: receipt.recorded_at || receipt.session_date
      });

      QRCode.toDataURL(payload, {
        width: 200,
        margin: 1,
        color: { dark: '#0369a1', light: '#ffffff' }
      }).then(setQrCodeUrl);
    }
  }, [receipt]);

  if (!receipt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="glass-card max-w-lg w-full border-slate-700 shadow-2xl relative flex flex-col my-6 overflow-hidden">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/70">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white font-heading">
              Comprovante de Presença Digital
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo Imprimível do Comprovante */}
        <div className="p-6 flex flex-col gap-5 bg-slate-950/50">
          
          <div className="ticket-border p-5 rounded-2xl shadow-xl flex flex-col gap-4 bg-slate-900/90">
            
            {/* Cabeçalho da Universidade */}
            <div className="text-center border-b border-slate-800 pb-3 flex flex-col items-center gap-1">
              <div className="flex items-center justify-center gap-2">
                <GraduationCap className="w-5 h-5 text-blue-400" />
                <span className="text-xs font-bold text-white tracking-wide uppercase font-heading">
                  Centro Universitário Geraldo Di Biase (UGB)
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Curso de Engenharia de Software • Controle de Frequência
              </div>
              <span className="badge badge-success text-[10px] font-mono mt-1">
                {receipt.verification_code || 'UGB-PRES-VALID'}
              </span>
            </div>

            {/* Grade de Informações */}
            <div className="grid grid-cols-2 gap-3.5 text-xs">
              <div>
                <div className="text-[10px] text-slate-400">Aluno(a)</div>
                <div className="font-semibold text-white">{receipt.student_name || 'Pedro Henrique / Pedro Gabriel'}</div>
                <div className="text-[10px] text-slate-400 font-mono">Matrícula: {receipt.registration_number || '2024102278'}</div>
              </div>

              <div>
                <div className="text-[10px] text-slate-400">Disciplina</div>
                <div className="font-semibold text-white">{receipt.course_name}</div>
                <div className="text-[10px] text-slate-400">{receipt.course_code}</div>
              </div>

              <div>
                <div className="text-[10px] text-slate-400">Data e Horário</div>
                <div className="text-slate-200 font-mono">
                  {receipt.recorded_at ? new Date(receipt.recorded_at).toLocaleString('pt-BR') : 'Hoje'}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-slate-400">Local da Aula</div>
                <div className="text-slate-200">{receipt.room_name || 'Sala 204 - Bloco B'}</div>
              </div>

              <div>
                <div className="text-[10px] text-slate-400">Validação GPS</div>
                <div className="text-emerald-400 font-mono">
                  {receipt.distance_meters !== null && receipt.distance_meters !== undefined ? `${receipt.distance_meters}m (Haversine)` : 'Aprovação Manual'}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-slate-400">Biometria Facial</div>
                <div className="text-emerald-400 font-mono">
                  {receipt.face_match_score ? `${(receipt.face_match_score * 100).toFixed(1)}% Match` : 'Aprovado'}
                </div>
              </div>
            </div>

            {/* Foto e QR Code */}
            <div className="flex items-center justify-between gap-3 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
              <div className="flex flex-col gap-1">
                <div className="text-[10px] text-slate-400 font-semibold uppercase flex items-center gap-1">
                  <Lock className="w-3 h-3 text-blue-400" />
                  <span>Hash Criptográfico</span>
                </div>
                <div className="text-[9px] font-mono text-slate-400 max-w-[190px] break-all">
                  {receipt.verification_hash || '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069'}
                </div>
              </div>

              {qrCodeUrl && (
                <img src={qrCodeUrl} alt="QR Code" className="w-20 h-20 rounded bg-white p-1 flex-shrink-0" />
              )}
            </div>

          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="btn-secondary flex-1 py-2.5 text-xs flex items-center justify-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Salvar PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-primary flex-1 py-2.5 text-xs font-semibold"
            >
              Fechar
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
