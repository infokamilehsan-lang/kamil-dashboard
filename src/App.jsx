import { Component } from 'react';
import { ShopProvider } from './context/ShopContext';
import { NotificationProvider } from './context/NotificationContext';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import ShopManager from './components/ShopManager';
import Dashboard from './components/Dashboard';
import LoginPage from './components/LoginPage';
import './index.css';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    console.error('[app:error-boundary]', error, info?.componentStack || '');
  }
  render() {
    if (this.state.error) {
      const domWasModified = this.state.error?.name === 'NotFoundError' || /removeChild|insertBefore/i.test(this.state.error?.message || '');
      return (
        <div style={{ position: 'fixed', inset: 0, background: '#0c0a09', color: '#f87171', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'monospace', fontSize: '13px', gap: '12px' }}>
          <div style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: '16px' }}>{domWasModified ? 'Browser Translation Conflict' : 'App Error'}</div>
          <div style={{ background: '#1c1917', border: '1px solid #7f1d1d', borderRadius: '8px', padding: '16px', maxWidth: '100%', wordBreak: 'break-all', whiteSpace: 'pre-wrap', maxHeight: '60vh', overflow: 'auto' }}>
            {domWasModified ? 'The browser translator or an extension changed the page while it was loading. Disable translation for this website, then reload.' : (this.state.error?.message || String(this.state.error))}
          </div>
          <button onClick={() => window.location.reload()} style={{ background: '#f59e0b', color: '#000', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: 'bold', cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0c0a09', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
        <div className="animate-spin" style={{ width: '36px', height: '36px', border: '3px solid #292524', borderTopColor: '#f59e0b', borderRadius: '50%' }} />
        <p style={{ color: '#57534e', fontSize: '11px', fontWeight: '600', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Loading…</p>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <NotificationProvider>
      <ShopProvider>
        <div className="brand-dashboard min-h-screen overflow-x-hidden" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 48px)' }}>
          <ShopManager />
          <Dashboard />
        </div>
      </ShopProvider>
    </NotificationProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
