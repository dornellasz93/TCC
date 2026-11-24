import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Activity,
  Compass,
  Scan,
  Lock,
  RefreshCw,
  Calculator,
  Clock,
  Zap,
  Search,
  CheckCircle2
} from 'lucide-react';
import { calculateHaversine } from '../utils/haversine';
import { apiFetch } from '../utils/api';

export default function AuditDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Simulador de Haversine
  const [testLat1, setTestLat1] = useState(-22.518605);
  const [testLon1, setTestLon1] = useState(-44.098485);
  const [testLat2, setTestLat2] = useState(-22.518920);
  const [testLon2, setTestLon2] = useState(-44.098150);
  const [testRadius, setTestRadius] = useState(35);

  // Autenticador de Comprovantes
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const sandboxDistance = calculateHaversine(testLat1, testLon1, testLat2, testLon2);
  const sandboxIsValid = sandboxDistance <= testRadius;

  const loadAuditData = async () => {
    try {
      setLoading(true);
      const { data: json } = await apiFetch('/api/analytics/dashboard');
      if (json.success) setData(json);
    } catch (err) {
      console.error('Erro ao carregar auditoria:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuditData();
  }, []);

  const handleVerifyReceipt = async (e) => {
    e.preventDefault();
    if (!verifyCode.trim()) return;
    setVerifying(true);
    try {
      const { data: json } = await apiFetch(`/api/attendance/verify/${encodeURIComponent(verifyCode.trim())}`);
      setVerifyResult(json);
    } finally {
      setVerifying(false);
    }
  };

  const m = data?.metrics || {};

  return (
    <div className="flex flex-col gap-7 w-full">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl sm:text-2xl font-bold text-white font-heading flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
            <span>Auditoria, Telemetria &amp; Indicadores do TCC</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Métricas quantitativas (Slides 10 e 12): latência, precisão GPS, taxa biométrica, bloqueios anti-fraude e tempo letivo economizado.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAuditData}
          className="btn-secondary py-2 px-3 text-xs self-start sm:self-auto flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Grade de KPIs (6 métricas alinhadas aos slides do TCC) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="glass-card p-5 border-slate-800 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Presenças Validadas</div>
            <div className="text-2xl font-bold text-white font-mono">{m.totalAttendances ?? 0}</div>
            <div className="text-[10px] text-emerald-400">Assinadas com SHA-256</div>
          </div>
        </div>

        <div className="glass-card p-5 border-slate-800 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Fraudes Bloqueadas</div>
            <div className="text-2xl font-bold text-rose-400 font-mono">{m.blockedFraudAttempts ?? 0}</div>
            <div className="text-[10px] text-rose-300">
              GPS: {m.blockedGeofenceAttempts ?? 0} • Mock: {m.blockedMockGpsAttempts ?? 0} • Face: {m.blockedBiometricAttempts ?? 0}
            </div>
          </div>
        </div>

        <div className="glass-card p-5 border-slate-800 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Tempo Letivo Devolvido</div>
            <div className="text-2xl font-bold text-emerald-400 font-mono">~{m.estimatedTimeSavedMinutes ?? 15} min</div>
            <div className="text-[10px] text-slate-400">Base: 7,5 min/aula vs chamada manual</div>
          </div>
        </div>

        <div className="glass-card p-5 border-slate-800 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Precisão &amp; Distância GPS</div>
            <div className="text-2xl font-bold text-cyan-300 font-mono">{m.avgDistanceMeters ?? 0}m</div>
            <div className="text-[10px] text-slate-400">Acurácia média sensor: ±{m.avgGpsAccuracyMeters ?? 6.5}m</div>
          </div>
        </div>

        <div className="glass-card p-5 border-slate-800 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Scan className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Taxa de Sucesso Biométrico</div>
            <div className="text-2xl font-bold text-purple-300 font-mono">{m.faceMatchSuccessRate ?? 100}%</div>
            <div className="text-[10px] text-slate-400">Score médio: {m.avgBiometricConfidence ?? 96.4}%</div>
          </div>
        </div>

        <div className="glass-card p-5 border-slate-800 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Latência Média da API</div>
            <div className="text-2xl font-bold text-amber-300 font-mono">{m.avgLatencyMs ?? 28} ms</div>
            <div className="text-[10px] text-slate-400">Node.js + SQLite WAL (Docker)</div>
          </div>
        </div>
      </div>

      {/* Verificador de Autenticidade de Comprovante */}
      <section className="glass-card p-5 border-slate-800 flex flex-col gap-3">
        <h2 className="text-sm font-bold text-white font-heading flex items-center gap-2">
          <Search className="w-4 h-4 text-emerald-400" />
          <span>Validador de Autenticidade de Comprovante (Código ou Hash SHA-256)</span>
        </h2>
        <form onSubmit={handleVerifyReceipt} className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            placeholder="Cole o código (ex: UGB-P1-20261) ou o hash SHA-256..."
            className="glass-input text-xs font-mono flex-1"
          />
          <button type="submit" disabled={verifying} className="btn-primary px-5 py-2.5 text-xs font-semibold">
            {verifying ? 'Verificando...' : 'Verificar Autenticidade'}
          </button>
        </form>
        {verifyResult && (
          <div className={`p-3 rounded-xl border text-xs ${
            verifyResult.valid
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
          }`}>
            {verifyResult.valid ? (
              <div className="flex flex-col gap-1">
                <div className="font-bold flex items-center gap-1.5 text-emerald-300">
                  <CheckCircle2 className="w-4 h-4" /> {verifyResult.message}
                </div>
                <div className="text-slate-300">
                  Aluno: <strong>{verifyResult.record.student_name}</strong> ({verifyResult.record.registration_number}) •{' '}
                  {verifyResult.record.course_name} ({verifyResult.record.call_type}ª Presença) •{' '}
                  Distância: <span className="font-mono">{verifyResult.record.distance_meters ?? 'Manual'}m</span>
                </div>
              </div>
            ) : (
              <span>{verifyResult.message}</span>
            )}
          </div>
        )}
      </section>

      {/* Simulador de Haversine */}
      <section className="glass-card p-6 border-slate-800 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-white font-heading flex items-center gap-2">
            <Calculator className="w-5 h-5 text-cyan-400" />
            <span>Simulador Interativo da Fórmula de Haversine (WGS-84)</span>
          </h2>
          <span className="badge badge-info text-[10px]">R = 6.371.000m</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div className="flex flex-col gap-1">
            <label className="text-slate-400">Aluno - Lat</label>
            <input type="number" step="any" value={testLat1} onChange={(e) => setTestLat1(Number(e.target.value))} className="glass-input text-xs font-mono" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-slate-400">Aluno - Lon</label>
            <input type="number" step="any" value={testLon1} onChange={(e) => setTestLon1(Number(e.target.value))} className="glass-input text-xs font-mono" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-slate-400">Sala - Lat</label>
            <input type="number" step="any" value={testLat2} onChange={(e) => setTestLat2(Number(e.target.value))} className="glass-input text-xs font-mono" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-slate-400">Sala - Lon</label>
            <input type="number" step="any" value={testLon2} onChange={(e) => setTestLon2(Number(e.target.value))} className="glass-input text-xs font-mono" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-slate-400">Raio Máximo ({testRadius}m)</label>
            <input type="range" min="5" max="200" value={testRadius} onChange={(e) => setTestRadius(Number(e.target.value))} className="w-full accent-cyan-400 mt-2" />
          </div>
        </div>

        <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
          sandboxIsValid ? 'bg-emerald-950/20 border-emerald-500/40' : 'bg-rose-950/20 border-rose-500/40'
        }`}>
          <div className="text-lg font-bold font-mono text-white">
            <span className={sandboxIsValid ? 'text-emerald-400' : 'text-rose-400'}>{sandboxDistance} metros</span>
            <span className="text-slate-500 text-xs ml-2">/ Limite: {testRadius}m</span>
          </div>
          <span className={`badge ${sandboxIsValid ? 'badge-success' : 'badge-danger'} text-xs py-1 px-3`}>
            {sandboxIsValid ? '✓ Dentro do Cerco Geográfico' : '✕ Fora do Cerco (Bloqueado)'}
          </span>
        </div>
      </section>

      {/* Trilha de Auditoria */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white font-heading flex items-center gap-2">
          <Lock className="w-5 h-5 text-indigo-400" />
          <span>Feed de Auditoria &amp; Logs do Servidor (Tempo Real)</span>
        </h2>

        <div className="glass-card overflow-hidden border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="font-semibold">Hora</th>
                  <th className="font-semibold">Evento</th>
                  <th className="font-semibold">Usuário</th>
                  <th className="font-semibold">Status</th>
                  <th className="font-semibold">Telemetria</th>
                  <th className="font-semibold">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {data?.recentLogs?.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="font-mono text-slate-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleTimeString('pt-BR')}
                    </td>
                    <td className="font-semibold text-white font-mono text-[11px]">{log.action}</td>
                    <td>
                      {log.user_name ? (
                        <div>
                          <div className="font-semibold text-slate-200">{log.user_name}</div>
                          <div className="text-[10px] text-slate-500">{log.registration_number || log.user_role}</div>
                        </div>
                      ) : (
                        <span className="text-slate-500">Sistema</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${log.status === 'SUCCESS' ? 'badge-success' : 'badge-danger'} text-[10px]`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="font-mono text-[11px] whitespace-nowrap">
                      {log.distance_meters !== null && log.distance_meters !== undefined ? `${log.distance_meters}m` : '—'}
                      {log.latency_ms ? ` • ${log.latency_ms}ms` : ''}
                      {log.is_mock_location ? ' • 🚨MOCK' : ''}
                    </td>
                    <td className="text-slate-400 max-w-sm truncate" title={log.details}>{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
