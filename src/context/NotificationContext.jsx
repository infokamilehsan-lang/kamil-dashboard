import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const NotificationContext = createContext(null);

// ── Standalone notify helper — call from anywhere without importing context ──
export function notify(type, title, message) {
  window.dispatchEvent(new CustomEvent('app-notify', { detail: { type, title, message } }));
}

const ICONS = {
  success: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const COLORS = {
  success: { icon: 'bg-amber-100 text-amber-600', dot: 'bg-amber-500', bar: 'bg-amber-500', accent: '#f59e0b' },
  error: { icon: 'bg-red-100 text-red-500', dot: 'bg-red-500', bar: 'bg-red-500', accent: '#ef4444' },
  warning: { icon: 'bg-orange-100 text-orange-600', dot: 'bg-orange-500', bar: 'bg-orange-500', accent: '#f97316' },
  info: { icon: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400', bar: 'bg-amber-400', accent: '#f59e0b' },
};

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('app-notifications');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // Persist to localStorage whenever notifications change
  useEffect(() => {
    try { localStorage.setItem('app-notifications', JSON.stringify(notifications)); } catch { }
  }, [notifications]);

  const addNotification = useCallback(({ type, title, message }) => {
    const id = `n-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const now = new Date();
    const timeStr = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false });
    const entry = { id, type: type || 'info', title, message, time: timeStr, read: false };
    setNotifications((prev) => [entry, ...prev].slice(0, 50)); // keep last 50
    // Show toast
    clearTimeout(toastTimer.current);
    setToast(entry);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // Listen for global notify events
  useEffect(() => {
    const handler = (e) => addNotification(e.detail);
    window.addEventListener('app-notify', handler);
    return () => window.removeEventListener('app-notify', handler);
  }, [addNotification]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    try { localStorage.removeItem('app-notifications'); } catch { }
  }, []);
  const dismissToast = useCallback(() => { clearTimeout(toastTimer.current); setToast(null); }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAllRead, clearAll, ICONS, COLORS }}>
      {children}

      {/* ── Toast popup ── */}
      {toast && (
        <div
          className="fixed bottom-5 right-5 z-9999 flex items-start gap-3 bg-white rounded-2xl shadow-2xl p-4 max-w-sm w-full"
          style={{
            animation: 'slideUp 0.3s cubic-bezier(.16,1,.3,1)',
            borderLeft: `4px solid ${(COLORS[toast.type] || COLORS.info).accent}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${(COLORS[toast.type] || COLORS.info).icon}`}>
            {ICONS[toast.type] || ICONS.info}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-sm font-bold text-gray-900 leading-tight">{toast.title}</p>
            {toast.message && <p className="text-xs text-gray-500 mt-0.5 truncate">{toast.message}</p>}
          </div>
          <button onClick={dismissToast} className="text-gray-300 hover:text-gray-500 shrink-0 mt-0.5 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}
