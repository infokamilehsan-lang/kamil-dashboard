import { useState, useEffect, Component } from 'react';
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
  render() {
    if (this.state.error) {
      return (
        <div style={{ position: 'fixed', inset: 0, background: '#0c0a09', color: '#f87171', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: 'monospace', fontSize: '13px', gap: '12px' }}>
          <div style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: '16px' }}>App Error</div>
          <div style={{ background: '#1c1917', border: '1px solid #7f1d1d', borderRadius: '8px', padding: '16px', maxWidth: '100%', wordBreak: 'break-all', whiteSpace: 'pre-wrap', maxHeight: '60vh', overflow: 'auto' }}>
            {this.state.error?.message || String(this.state.error)}
            {'\n\n'}
            {this.state.error?.stack}
          </div>
          <button onClick={() => { localStorage.clear(); window.location.reload(); }} style={{ background: '#f59e0b', color: '#000', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: 'bold', cursor: 'pointer' }}>
            Clear & Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { user, loading } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); setSearchQuery(''); }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSearchOpen = () => { setSearchOpen(true); setSearchQuery(''); };

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0c0a09', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <NotificationProvider>
      <ShopProvider>
        <div className="min-h-screen bg-gray-50 overflow-x-hidden" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 48px)' }}>
          <ShopManager onSearchOpen={handleSearchOpen} />
          <Dashboard
            searchOpen={searchOpen}
            setSearchOpen={setSearchOpen}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
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
