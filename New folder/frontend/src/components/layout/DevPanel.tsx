import React, { useState, useEffect } from 'react';
import { Terminal, Activity, FileText, Key, CheckCircle, XCircle, Copy, Check, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getApiCallHistory, ApiCallLog } from '../../api/client';
import { API_CONFIG } from '../../api/config';

interface ServiceHealthStatus {
  name: string;
  port: number;
  healthUrl: string;
  docsUrl: string;
  isUp: boolean | null;
  responseTimeMs?: number;
}

export const DevPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'health' | 'jwt' | 'logs'>('health');
  const [logs, setLogs] = useState<ApiCallLog[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { token, decodedToken } = useAuth();

  const [services, setServices] = useState<ServiceHealthStatus[]>([
    { name: 'Identity & KYC', port: 4003, healthUrl: API_CONFIG.identity.healthUrl, docsUrl: API_CONFIG.identity.docsUrl, isUp: null },
    { name: 'Equipment Service', port: 4001, healthUrl: API_CONFIG.equipment.healthUrl, docsUrl: API_CONFIG.equipment.docsUrl, isUp: null },
    { name: 'Booking Service', port: 4002, healthUrl: API_CONFIG.booking.healthUrl, docsUrl: API_CONFIG.booking.docsUrl, isUp: null },
    { name: 'Payment & Deposit', port: 4004, healthUrl: API_CONFIG.payment.healthUrl, docsUrl: API_CONFIG.payment.docsUrl, isUp: null },
    { name: 'Handover & Return', port: 4005, healthUrl: API_CONFIG.handover.healthUrl, docsUrl: API_CONFIG.handover.docsUrl, isUp: null },
    { name: 'Claims & Reviews', port: 4006, healthUrl: API_CONFIG.claims.healthUrl, docsUrl: API_CONFIG.claims.docsUrl, isUp: null },
  ]);

  const checkHealth = async () => {
    const updated = await Promise.all(
      services.map(async (svc) => {
        const start = Date.now();
        try {
          const res = await fetch(svc.healthUrl, { method: 'GET', signal: AbortSignal.timeout(2500) });
          return {
            ...svc,
            isUp: res.ok,
            responseTimeMs: Date.now() - start,
          };
        } catch {
          return {
            ...svc,
            isUp: false,
            responseTimeMs: Date.now() - start,
          };
        }
      })
    );
    setServices(updated);
  };

  useEffect(() => {
    if (isOpen) {
      setLogs(getApiCallHistory());
      checkHealth();
    }
  }, [isOpen]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Only render in development or test
  if (!import.meta.env.DEV) return null;

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 left-5 z-40 bg-slate-900 text-brand-400 hover:text-white p-2.5 rounded-2xl shadow-elevated border border-slate-700 flex items-center gap-2 text-xs font-mono font-semibold transition-all hover:scale-105 active:scale-95"
        title="Open Developer Diagnostic Panel"
      >
        <Terminal className="w-4 h-4" />
        <span>DevPanel</span>
      </button>

      {/* Drawer Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 text-slate-200 border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden font-mono text-xs">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5 text-brand-400">
                <Terminal className="w-5 h-5" />
                <h3 className="font-bold text-sm tracking-wide text-white">AgriRent Developer Diagnostics</h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={checkHealth}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                  title="Refresh status"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-800 bg-slate-950/30">
              <button
                onClick={() => setActiveTab('health')}
                className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 ${
                  activeTab === 'health' ? 'bg-slate-800 text-brand-400 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                Services Health ({services.filter((s) => s.isUp).length}/6)
              </button>
              <button
                onClick={() => setActiveTab('jwt')}
                className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 ${
                  activeTab === 'jwt' ? 'bg-slate-800 text-brand-400 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Key className="w-3.5 h-3.5" />
                Decoded JWT Claims
              </button>
              <button
                onClick={() => {
                  setLogs(getApiCallHistory());
                  setActiveTab('logs');
                }}
                className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 ${
                  activeTab === 'logs' ? 'bg-slate-800 text-brand-400 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                API Activity Logs ({logs.length})
              </button>
            </div>

            {/* Tab Contents */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {activeTab === 'health' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {services.map((svc) => (
                    <div
                      key={svc.port}
                      className="p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          {svc.isUp === true && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                          {svc.isUp === false && <XCircle className="w-4 h-4 text-rose-400" />}
                          {svc.isUp === null && <span className="w-4 h-4 rounded-full bg-slate-700 animate-pulse" />}
                          <span className="font-bold text-white">{svc.name}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">Port :{svc.port} • {svc.responseTimeMs || 0}ms</p>
                      </div>

                      <a
                        href={svc.docsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-brand-400 text-[11px] font-semibold"
                      >
                        Swagger /docs
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'jwt' && (
                <div className="space-y-3">
                  {token ? (
                    <>
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] break-all">
                        <span className="text-slate-500">Raw Bearer Token:</span>
                        <p className="text-slate-300 mt-1">{token.substring(0, 48)}...</p>
                      </div>

                      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                        <span className="text-slate-500 text-[11px]">Decoded Payload:</span>
                        <pre className="text-emerald-400 text-xs mt-2 overflow-x-auto">
                          {JSON.stringify(decodedToken, null, 2)}
                        </pre>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No active user session. Please log in to inspect JWT claims.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'logs' && (
                <div className="space-y-2">
                  {logs.length === 0 ? (
                    <p className="text-slate-500 text-center py-6">No API calls recorded yet.</p>
                  ) : (
                    logs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl flex items-center justify-between gap-3 text-[11px]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                              log.method === 'GET'
                                ? 'bg-blue-900/60 text-blue-400'
                                : log.method === 'POST'
                                ? 'bg-emerald-900/60 text-emerald-400'
                                : 'bg-amber-900/60 text-amber-400'
                            }`}
                          >
                            {log.method}
                          </span>
                          <span className={`font-bold ${log.status >= 400 || log.status === 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                            {log.status || 'ERR'}
                          </span>
                          <span className="text-slate-400 truncate max-w-[280px] sm:max-w-md">{log.url}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-slate-500 text-[10px]">{log.durationMs}ms</span>
                          <button
                            onClick={() => copyToClipboard(log.correlationId, log.id)}
                            className="p-1 text-slate-500 hover:text-brand-400 transition-colors"
                            title="Copy correlationId"
                          >
                            {copiedId === log.id ? <Check className="w-3.5 h-3.5 text-brand-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
