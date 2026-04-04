import { useState, useEffect } from 'react';
import { ShopProvider } from './context/ShopContext';
import { NotificationProvider } from './context/NotificationContext';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import ShopManager from './components/ShopManager';
import Dashboard from './components/Dashboard';
import LoginPage from './components/LoginPage';
import './index.css';

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
    <LanguageProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LanguageProvider>
  );
}
