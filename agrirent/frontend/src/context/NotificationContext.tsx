import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, Copy, Check } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  correlationId?: string;
  timestamp: string;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  addNotification: (
    type: NotificationType,
    title: string,
    message: string,
    correlationId?: string
  ) => void;
  showNotification: (
    type: NotificationType,
    message: string,
    correlationId?: string
  ) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const addNotification = (
    type: NotificationType,
    title: string,
    message: string,
    correlationId?: string
  ) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newItem: NotificationItem = {
      id,
      type,
      title,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
    };

    setNotifications((prev) => [newItem, ...prev.slice(0, 4)]);

    // Auto-dismiss after 6 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 6000);
  };

  const showNotification = (
    type: NotificationType,
    message: string,
    correlationId?: string
  ) => {
    const title =
      type === 'success'
        ? 'Success'
        : type === 'error'
        ? 'Action Required'
        : type === 'warning'
        ? 'Notice'
        : 'Information';
    addNotification(type, title, message, correlationId);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = () => setNotifications([]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        showNotification,
        removeNotification,
        clearAll,
      }}
    >
      {children}

      {/* Floating Notification Toast Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-full px-4 pointer-events-none">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`pointer-events-auto rounded-2xl p-4 shadow-elevated border flex items-start gap-3 transition-all duration-200 animate-in slide-in-from-bottom-5 ${
              n.type === 'success'
                ? 'bg-white border-brand-200 text-slate-800'
                : n.type === 'error'
                ? 'bg-white border-rose-200 text-slate-800'
                : n.type === 'warning'
                ? 'bg-white border-amber-200 text-slate-800'
                : 'bg-white border-blue-200 text-slate-800'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {n.type === 'success' && <CheckCircle2 className="w-5 h-5 text-brand-600" />}
              {n.type === 'error' && <XCircle className="w-5 h-5 text-rose-600" />}
              {n.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
              {n.type === 'info' && <Info className="w-5 h-5 text-blue-600" />}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-slate-900">{n.title}</h4>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{n.message}</p>

              {n.correlationId && n.correlationId !== 'unknown' && (
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-mono truncate">Ref: {n.correlationId}</span>
                  <button
                    onClick={() => copyToClipboard(n.correlationId!, n.id)}
                    className="inline-flex items-center gap-1 hover:text-slate-800 transition-colors ml-2 font-medium"
                    title="Copy correlation reference"
                  >
                    {copiedId === n.id ? (
                      <>
                        <Check className="w-3 h-3 text-brand-600" />
                        <span className="text-brand-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => removeNotification(n.id)}
              className="text-slate-400 hover:text-slate-600 text-xs p-1"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export function useNotification(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
