import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Search, 
  QrCode
} from 'lucide-react';
import ReceiptModal from './ReceiptModal';

export default function StudentHistoryView({ currentUser }) {
  const [history, setHistory] = useState([]);
  const [courseStats, setCourseStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  useEffect(() => {
    if (!currentUser?.id) return;

    fetch(`/api/attendance/history/${currentUser.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setHistory(data.history || []);
          setCourseStats(data.courseStats || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentUser]);

  const filteredHistory = history.filter(h => 
    h.course_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.course_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.session_title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-8 w-full">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl sm:text-2xl font-bold text-white font-heading flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            <span>Extrato Oficial de Presenças Acadêmicas</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Histórico completo de frequências validadas por geolocalização e biometria facial.
          </p>
        </div>
      </div>

      {/* Per-Course Frequency Summary */}
      {courseStats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {courseStats.map((c) => (
            <div key={c.id} className="glass-card p-4 border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="badge badge-info text-[10px] font-mono">{c.code}</span>
                <span className={`font-mono text-sm font-bold ${c.percentage >= 75 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {c.percentage}%
                </span>
              </div>
              <div className="text-xs font-semibold text-white truncate">{c.name}</div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-emerald-400"
                  style={{ width: `${Math.min(100, c.percentage)}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-400">
                {c.attended_calls} de {c.total_calls} chamadas registradas (Mínimo UGB: 75%)
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="glass-card p-4 border-slate-800 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrar por disciplina, código ou tema de aula..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="glass-input text-xs pl-10"
          />
        </div>
      </div>

      {/* Full History Table */}
      <div className="glass-card overflow-hidden border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="font-semibold">Disciplina</th>
                <th className="font-semibold">Tema da Aula</th>
                <th className="font-semibold">Data / Hora</th>
                <th className="font-semibold">Sala / Bloco</th>
                <th className="font-semibold">Distância GPS</th>
                <th className="font-semibold">Status</th>
                <th className="font-semibold text-right">Comprovante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-500">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-800/40 transition-colors">
                    <td>
                      <div className="font-semibold text-white">{h.course_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{h.course_code}</div>
                    </td>
                    <td className="text-slate-300 max-w-xs truncate">
                      {h.session_title}
                    </td>
                    <td className="font-mono">
                      <div>{new Date(h.recorded_at).toLocaleDateString('pt-BR')}</div>
                      <div className="text-[10px] text-slate-400">{new Date(h.recorded_at).toLocaleTimeString('pt-BR')}</div>
                    </td>
                    <td>
                      <div>{h.room_name}</div>
                      <div className="text-[10px] text-slate-400">{h.room_block}</div>
                    </td>
                    <td className="font-mono text-cyan-300">
                      {h.distance_meters !== null ? `${h.distance_meters}m` : 'Manual'}
                    </td>
                    <td>
                      <span className="badge badge-success text-[10px]">
                        {h.status === 'manual_approved' ? 'Manual (Prof)' : 'GPS + Biometria'}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedReceipt(h)}
                        className="btn-secondary py-1.5 px-3 text-[11px] text-blue-300 hover:text-white inline-flex items-center gap-1.5"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Ticket</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Modal */}
      {selectedReceipt && (
        <ReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}

    </div>
  );
}
