import { useState, useEffect, useRef } from 'react';
import { useShop } from '../context/ShopContext';
import { useLanguage } from '../context/LanguageContext';
import { SHOP_TYPES, CURRENCIES } from '../data/initialData';
import AddTransactionModal from './AddTransactionModal';
import DatePicker from './DatePicker';
import WhatsappPage from '../pages/WhatsappPage';
import EmailsPage from '../pages/EmailsPage';
import NotesPage from '../pages/NotesPage';
import TeamPage from '../pages/TeamPage';
import SecondhandPage from '../pages/SecondhandPage';
import InventoryPage from '../pages/InventoryPage';
import RepairsPage from '../pages/RepairsPage';
import AdvancesPage from '../pages/AdvancesPage';
import ReportsPage from '../pages/ReportsPage';
import OverviewPage from '../pages/OverviewPageNew';
import ClientsPage from '../pages/ClientsPage';
import { SIDEBAR_MODULE_IDS } from '../data/sidebarModules';


export default function Dashboard() {
  const heroRef    = useRef(null);
  const heroBlock1 = useRef(null);
  const heroBlock2 = useRef(null);
  const heroBgRef  = useRef(null);
  const { activeShop, addNote, updateNote, deleteNote } = useShop();
  const enabledSidebarModules = new Set(Array.isArray(activeShop?.sidebarModules) ? activeShop.sidebarModules : SIDEBAR_MODULE_IDS);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('dashboard_sidebar_collapsed') === 'true');
  const toggleSidebar = () => setSidebarCollapsed((current) => {
    const next = !current;
    localStorage.setItem('dashboard_sidebar_collapsed', String(next));
    return next;
  });
  const [page, setPageState] = useState(() => {
    const shopId = activeShop?.id;
    if (shopId) {
      return localStorage.getItem(`dashboard_page_${shopId}`) || localStorage.getItem('dashboard_page') || 'overview';
    }
    return localStorage.getItem('dashboard_page') || 'overview';
  });
  const setPage = (p) => {
    const nextPage = p === 'overview' || enabledSidebarModules.has(p) ? p : 'overview';
    const shopId = activeShop?.id;
    if (shopId) localStorage.setItem(`dashboard_page_${shopId}`, nextPage);
    localStorage.setItem('dashboard_page', nextPage);
    setPageState(nextPage);
  };

  // When shop changes, restore that shop's last page (or stay on current if valid)
  const prevShopIdRef = useRef(activeShop?.id);
  useEffect(() => {
    if (!activeShop?.id || activeShop.id === prevShopIdRef.current) return;
    prevShopIdRef.current = activeShop.id;
    const savedPage = localStorage.getItem(`dashboard_page_${activeShop.id}`);
    if (savedPage) {
      // Verify the saved page is available for this shop
      const modules = new Set(Array.isArray(activeShop.sidebarModules) ? activeShop.sidebarModules : SIDEBAR_MODULE_IDS);
      const isValid = savedPage === 'overview' || modules.has(savedPage);
      setPageState(isValid ? savedPage : 'overview');
      localStorage.setItem('dashboard_page', isValid ? savedPage : 'overview');
    }
    // If no saved page for this shop, keep current page (don't reset)
  }, [activeShop?.id, activeShop?.sidebarModules]);

  useEffect(() => {
    if (page !== 'overview' && !enabledSidebarModules.has(page)) setPage('overview');
  }, [activeShop?.id, activeShop?.sidebarModules, page]);

  const [addTxOpen, setAddTxOpen] = useState(false);
  const { addOrUpdateContact } = useShop();
  const { t, locale } = useLanguage();
  const isItalian = String(locale).startsWith('it');

  // Hero banner mouse parallax
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const onMove = (e) => {
      const { width, height, left, top } = hero.getBoundingClientRect();
      const cx = (e.clientX - left - width / 2) / (width / 2);
      const cy = (e.clientY - top  - height / 2) / (height / 2);
      if (heroBlock1.current) heroBlock1.current.style.transform = `translate(${cx * -22}px,${cy * -18}px) rotate(18deg)`;
      if (heroBlock2.current) heroBlock2.current.style.transform = `translate(${cx * 28}px,${cy * 22}px) rotate(-12deg)`;
    };
    const onLeave = () => {
      [heroBlock1, heroBlock2].forEach(r => { if (r.current) r.current.style.transform = ''; });
    };
    hero.addEventListener('mousemove', onMove, { passive: true });
    hero.addEventListener('mouseleave', onLeave);
    return () => { hero.removeEventListener('mousemove', onMove); hero.removeEventListener('mouseleave', onLeave); };
  }, []);

  // Hero background scroll parallax
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (heroBgRef.current) heroBgRef.current.style.transform = `translateY(${y * 0.18}px)`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);


  // Quick Notes state
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteEditId, setNoteEditId] = useState(null); // null = adding new, string = editing
  const [noteForm, setNoteForm] = useState({ name: '', details: '', totalAmount: '', paidAmount: '', appointmentFor: '', appointmentDescription: '', appointmentDate: '', appointmentTime: '', phone: '', email: '' });
  const [noteFormError, setNoteFormError] = useState('');
  const [noteDeleteId, setNoteDeleteId] = useState(null);

  const shopType = SHOP_TYPES.find((t) => t.value === activeShop?.type);
  const currencyObj = CURRENCIES.find((c) => c.code === activeShop?.currency) || CURRENCIES[0];

  const fmtDate = (d) =>
    new Date(d).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });


  if (!activeShop) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <h3 className="text-xl font-bold text-gray-800 mb-2">{t('noShopSelected')}</h3>
        <p className="text-gray-500 text-sm">{t('useShopManagementHint')}</p>
      </div>
    );
  }

  return (
    <div className={`dashboard-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-8`}>

      {/* Shop Hero Banner */}
      <div ref={heroRef} className="hidden dashboard-hero dashboard-hero-new rounded-[1.35rem] overflow-hidden relative">
        {/* Ambient hero effects */}
        <div ref={heroBlock1} className="absolute top-[8%] right-[14%] w-16 h-16 rounded-2xl pointer-events-none" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.09),rgba(255,255,255,0.03))', border: '1px solid rgba(255,255,255,0.16)', transition: 'transform 0.45s cubic-bezier(0.22,1,0.36,1)' }} />
        <div ref={heroBlock2} className="absolute bottom-[18%] right-[5%] w-10 h-10 rounded-xl pointer-events-none" style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.22),rgba(20,184,166,0.1))', border: '1px solid rgba(255,255,255,0.14)', transition: 'transform 0.45s cubic-bezier(0.22,1,0.36,1)' }} />
        <div className="absolute -right-14 -top-14 w-48 h-48 rounded-full pointer-events-none" style={{ border: '1px solid rgba(255,255,255,0.07)' }} />
        <div className="absolute -right-4 top-6 w-24 h-24 rounded-full pointer-events-none" style={{ border: '1px dashed rgba(255,255,255,0.08)' }} />
        <div className="absolute top-[52%] left-[44%] w-4 h-4 rounded-lg pointer-events-none" style={{ border: '1px solid rgba(255,255,255,0.11)' }} />
        <div className="absolute top-[18%] left-[58%] w-3 h-3 rounded-md pointer-events-none" style={{ border: '1px solid rgba(255,255,255,0.08)', animationDelay: '2s' }} />
        <div className="absolute bottom-[22%] left-[50%] w-5 h-5 rounded-xl pointer-events-none" style={{ border: '1px solid rgba(255,255,255,0.09)', animationDelay: '1.5s' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
        {/* Top section — shop info + add button */}
        <div className="hero-main-row px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-4">
            {/* Shop avatar */}
            {activeShop.image ? (
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden ring-2 ring-white/60 shadow-lg shrink-0">
                <img src={activeShop.image} alt={activeShop.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/70 ring-1 ring-black/10 flex items-center justify-center shrink-0 shadow-sm">
                <span className="text-2xl font-black text-gray-900">{activeShop.name?.charAt(0)?.toUpperCase()}</span>
              </div>
            )}
          <div className="">
              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[.18em] text-gray-500 mb-1">{String(locale).startsWith('it') ? 'Area di lavoro' : 'Business workspace'}</p>
              <h1 className="text-xl sm:text-2xl font-black tracking-[-.04em] text-gray-900">{activeShop.name}</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-white/80 text-[11px] font-medium">{t(shopType?.labelKey)}</span>
                {activeShop.city && (
                  <span className="flex items-center gap-1 text-white/60 text-xs">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    {activeShop.city}
                  </span>
                )}
                {activeShop.phone && (
                  <span className="flex items-center gap-1 text-white/60 text-xs">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    {activeShop.phone}
                  </span>
                )}
                <span className="text-white/40 text-[10px]">{t('since')} {fmtDate(activeShop.createdAt)}</span>
              </div>
              {activeShop.description && (
                <p className="text-white/50 text-xs mt-1 max-w-lg line-clamp-1">{activeShop.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => { setNoteEditId(null); setNoteForm({ name: '', details: '', totalAmount: '', paidAmount: '', appointmentFor: '', appointmentDescription: '', appointmentDate: '', appointmentTime: '', phone: '', email: '' }); setNoteFormError(''); setNoteOpen(true); }}
              className="hero-action-secondary relative overflow-hidden flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 font-black rounded-xl transition-all text-xs shrink-0"
            >
              <div className="absolute inset-0" />
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="relative z-10">{isItalian ? 'Nota rapida' : 'Quick Note'}</span>
            </button>
            <button
              onClick={() => setAddTxOpen(true)}
              className="hero-action-primary relative overflow-hidden flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 font-black rounded-xl transition-all text-xs shrink-0"
            >
              <div className="absolute inset-0" />
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="relative z-10">{t('addTransaction')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Independent left navigation */}
      <aside className="dashboard-sidebar">
          <button type="button" onClick={toggleSidebar} className="sidebar-toggle-button" title={sidebarCollapsed ? (String(locale).startsWith('it') ? 'Apri barra laterale' : 'Open sidebar') : (String(locale).startsWith('it') ? 'Chiudi barra laterale' : 'Close sidebar')} aria-label={sidebarCollapsed ? (String(locale).startsWith('it') ? 'Apri barra laterale' : 'Open sidebar') : (String(locale).startsWith('it') ? 'Chiudi barra laterale' : 'Close sidebar')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d={sidebarCollapsed ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'} /></svg>
            <span>{sidebarCollapsed ? (String(locale).startsWith('it') ? 'Apri' : 'Open') : (String(locale).startsWith('it') ? 'Chiudi' : 'Close')}</span>
          </button>
          <div className="hero-tabs flex gap-2 p-1.5 rounded-2xl w-max min-w-full">
            {[
              { id: 'overview', label: t('tab_overview'), icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
              { id: 'inventory', label: t('tab_inventory'), icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg> },
              { id: 'repairs', label: t('tab_repairs'), icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
              { id: 'advances', label: t('tab_advances'), icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
              { id: 'reports', label: t('tab_reports'), icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
              { id: 'team', label: t('tab_team'), icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
              { id: 'secondhand', label: t('tab_secondhand'), icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> },
              { id: 'notes', label: 'Quick Notes', icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
              { id: 'clients', label: isItalian ? 'Clienti' : 'Clients', icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm13 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg> },
              { id: 'emails', label: 'Email Box', icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> },
              { id: 'whatsapp', label: 'WhatsApp', icon: <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg> },
            ].filter((tab) => tab.id === 'overview' || enabledSidebarModules.has(tab.id))
              .map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setPage(tab.id)}
                  style={{
                    transition: 'transform 0.15s cubic-bezier(.4,0,.2,1), box-shadow 0.15s',
                    transform: page === tab.id ? 'scale(1.05)' : 'scale(1)',
                  }}
                  onMouseEnter={e => { if (page !== tab.id) e.currentTarget.style.transform = 'scale(1.05)'; }}
                  onMouseLeave={e => { if (page !== tab.id) e.currentTarget.style.transform = 'scale(1)'; }}
                  onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.95)'; }}
                  onMouseUp={e => { e.currentTarget.style.transform = page === tab.id ? 'scale(1.05)' : 'scale(1.05)'; }}
                  className={`hero-tab flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${page === tab.id
                      ? 'is-active scale-105'
                      : ''
                    }`}
                >
                  <span style={{ display: 'inline-flex' }}>
                    {tab.icon}
                  </span>
                  {tab.label}
                </button>
              ))}
          </div>
      </aside>

      {page === 'overview' && <OverviewPage setPage={setPage} setAddTxOpen={setAddTxOpen} />}
      {page === 'clients' && <ClientsPage />}

      {/* ── REPAIRS PAGE ── */}
      {page === 'repairs' && <RepairsPage />}
      {/* ── ADVANCES PAGE ── */}
      {page === 'advances' && <AdvancesPage />}
      {/* ── REPORTS PAGE ── */}
      {page === 'reports' && <ReportsPage />}

      {/* ── TEAM PAGE ── */}
      {page === 'team' && <TeamPage />}
      {/* ── INVENTORY / SKU PAGE ── */}
      {page === 'inventory' && <InventoryPage />}

      {/* ════════════════ SECONDHAND PAGE ════════════════ */}
      {page === 'secondhand' && <SecondhandPage />}

      {/* ── NOTES PAGE ── */}
      {page === 'notes' && (
        <NotesPage
          setNoteEditId={setNoteEditId}
          setNoteForm={setNoteForm}
          setNoteFormError={setNoteFormError}
          setNoteOpen={setNoteOpen}
          setNoteDeleteId={setNoteDeleteId}
        />
      )}

      {page === 'emails' && <EmailsPage />}

      {page === 'whatsapp' && <WhatsappPage />}


      {addTxOpen && <AddTransactionModal onClose={() => setAddTxOpen(false)} />}

      {/* Quick Note Modal */}
      {noteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 backdrop-blur-sm" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} onMouseDown={(event) => event.target === event.currentTarget && setNoteOpen(false)}>
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl overflow-visible border border-white/60">
            {/* Header */}
            <div className="px-6 sm:px-8 py-5 sm:py-6 rounded-t-[2rem] relative overflow-hidden" style={{ background: 'radial-gradient(circle at 90% 0,rgba(255,255,255,.9),transparent 38%),linear-gradient(135deg, #c6ff34, #f1fec8)' }}>
              <div className="absolute -right-12 -top-16 w-44 h-44 rounded-full border border-black/5" />
              <div className="relative flex items-center gap-3 pr-12">
                <div className="w-10 h-10 rounded-2xl bg-white/70 border border-black/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">{noteEditId ? (isItalian ? 'Modifica nota' : 'Edit Note') : 'Quick Note'}</h2>
                  <p className="text-xs text-gray-600">{noteEditId ? (isItalian ? 'Aggiorna dettagli e importo pagato' : 'Update details and paid amount') : (isItalian ? 'Registra un promemoria, appuntamento o pagamento' : 'Record a reminder, appointment or payment')}</p>
                </div>
              </div>
              <button type="button" onClick={() => { setNoteOpen(false); setNoteEditId(null); setNoteFormError(''); }} className="absolute right-5 sm:right-7 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/75 border border-black/10 flex items-center justify-center text-xl font-bold hover:bg-white transition-colors">×</button>
            </div>
            {/* Form */}
            <div className="px-5 sm:px-8 py-5 sm:py-6 space-y-4">
              {noteFormError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">{noteFormError}</div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">{isItalian ? 'Nome / Beneficiario' : 'Name / Payee'} <span className="text-red-400">*</span></label>
                <input
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
                  placeholder={isItalian ? 'es. Appuntamento, pagamento fornitore…' : 'e.g. Appointment, supplier payment…'}
                  value={noteForm.name}
                  onChange={(e) => setNoteForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{isItalian ? 'Telefono' : 'Phone'}</label>
                  <input
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
                    placeholder="e.g. +39 333 1234567"
                    value={noteForm.phone}
                    onChange={(e) => setNoteForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
                  <input
                    type="email"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
                    placeholder="e.g. cliente@email.com"
                    value={noteForm.email}
                    onChange={(e) => setNoteForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">{isItalian ? 'Dettagli' : 'Details'}</label>
                <textarea
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400 resize-none"
                  rows={2}
                  placeholder={isItalian ? 'Dettagli aggiuntivi…' : 'Additional details…'}
                  value={noteForm.details}
                  onChange={(e) => setNoteForm((f) => ({ ...f, details: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{isItalian ? 'Importo totale' : 'Total Amount'} <span className="text-gray-400 font-normal">({isItalian ? 'opzionale' : 'optional'})</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">{currencyObj?.symbol || '€'}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
                      placeholder="0.00"
                      value={noteForm.totalAmount}
                      onChange={(e) => setNoteForm((f) => ({ ...f, totalAmount: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{isItalian ? 'Pagato finora' : 'Paid So Far'}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">{currencyObj?.symbol || '€'}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
                      placeholder="0.00"
                      value={noteForm.paidAmount}
                      onChange={(e) => setNoteForm((f) => ({ ...f, paidAmount: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              {/* Appointment */}
              <div className="rounded-2xl border border-lime-200 p-4" style={{ background: 'linear-gradient(145deg,#f1fec8,#fff)' }}>
                <div className="flex items-start gap-3 mb-4">
                  <span className="w-10 h-10 rounded-xl bg-[#c6ff34] border border-black/10 flex items-center justify-center shrink-0"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2v12a2 2 0 002-2V7a2 2 0 00-2-2H5" /></svg></span>
                  <div><p className="text-sm font-black">{isItalian ? 'Appuntamento' : 'Appointment'} <span className="ml-1 text-[9px] uppercase tracking-wide text-gray-400">{isItalian ? 'Facoltativo' : 'Optional'}</span></p><p className="text-[11px] text-gray-500 mt-0.5">{isItalian ? 'Imposta giorno e ora per ricordare questo impegno.' : 'Set a day and time to remember this commitment.'}</p></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div className="rounded-xl bg-white border border-black/10 p-3"><label className="block text-[10px] uppercase tracking-wide font-black text-gray-500 mb-2">{isItalian ? 'Appuntamento per' : 'Appointment for'}</label><input value={noteForm.appointmentFor} onChange={(e) => setNoteForm((f) => ({ ...f, appointmentFor: e.target.value }))} placeholder={isItalian ? 'Nome del cliente o persona' : 'Client or person name'} className="w-full px-3 py-2.5 border-0 rounded-xl bg-[#f8ffe8] text-sm focus:outline-none focus:ring-2 focus:ring-lime-300" /></div>
                  <div className="rounded-xl bg-white border border-black/10 p-3"><label className="block text-[10px] uppercase tracking-wide font-black text-gray-500 mb-2">{isItalian ? 'Descrizione appuntamento' : 'Appointment description'}</label><input value={noteForm.appointmentDescription} onChange={(e) => setNoteForm((f) => ({ ...f, appointmentDescription: e.target.value }))} placeholder={isItalian ? 'Motivo dell’appuntamento' : 'Reason for the appointment'} className="w-full px-3 py-2.5 border-0 rounded-xl bg-[#f8ffe8] text-sm focus:outline-none focus:ring-2 focus:ring-lime-300" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white border border-black/10 p-3">
                    <label className="block text-[10px] uppercase tracking-wide font-black text-gray-500 mb-2">{isItalian ? 'Data' : 'Date'}</label>
                    <DatePicker
                      value={noteForm.appointmentDate}
                      onChange={(v) => setNoteForm((f) => ({ ...f, appointmentDate: v }))}
                      placement="top"
                      inputClassName="border-0! bg-[#f8ffe8]! px-3! py-2.5!"
                    />
                  </div>
                  <div className="rounded-xl bg-white border border-black/10 p-3">
                    <label className="block text-[10px] uppercase tracking-wide font-black text-gray-500 mb-2">{isItalian ? 'Ora' : 'Time'}</label>
                    <input
                      type="time"
                      className="w-full px-3 py-2.5 border-0 rounded-xl bg-[#f8ffe8] text-sm font-bold focus:outline-none focus:ring-2 focus:ring-lime-300"
                      value={noteForm.appointmentTime}
                      onChange={(e) => setNoteForm((f) => ({ ...f, appointmentTime: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>
            {/* Footer */}
            <div className="px-5 sm:px-8 pb-6 flex gap-3">
              <button
                onClick={() => { setNoteOpen(false); setNoteEditId(null); setNoteFormError(''); }}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >{t('cancel')}</button>
              <button
                onClick={() => {
                  const hasAppointment = Boolean(noteForm.appointmentFor.trim() || noteForm.appointmentDescription.trim() || noteForm.appointmentDate || noteForm.appointmentTime);
                  if (!noteForm.name.trim() && !hasAppointment) { setNoteFormError(isItalian ? 'Inserisci un nome o i dettagli dell’appuntamento.' : 'Enter a name or appointment details.'); return; }
                  const savedName = noteForm.name.trim() || noteForm.appointmentFor.trim() || noteForm.appointmentDescription.trim() || (isItalian ? 'Appuntamento' : 'Appointment');
                  const total = noteForm.totalAmount ? Number(noteForm.totalAmount) : null;
                  const paid = noteForm.paidAmount ? Number(noteForm.paidAmount) : 0;
                  const apptDate = noteForm.appointmentDate || null;
                  const apptTime = noteForm.appointmentTime || null;
                  if (noteEditId) {
                    updateNote(noteEditId, { name: savedName, details: noteForm.details.trim(), totalAmount: total, paidAmount: paid, appointmentFor: noteForm.appointmentFor.trim(), appointmentDescription: noteForm.appointmentDescription.trim(), appointmentDate: apptDate, appointmentTime: apptTime, phone: noteForm.phone.trim(), email: noteForm.email.trim() });
                    setNoteEditId(null);
                  } else {
                    addNote({ name: savedName, details: noteForm.details.trim(), totalAmount: total, paidAmount: paid, appointmentFor: noteForm.appointmentFor.trim(), appointmentDescription: noteForm.appointmentDescription.trim(), appointmentDate: apptDate, appointmentTime: apptTime, phone: noteForm.phone.trim(), email: noteForm.email.trim() });
                  }
                  if (noteForm.phone.trim() || noteForm.email.trim()) {
                    addOrUpdateContact({
                      name: savedName,
                      email: noteForm.email.trim(),
                      phone: noteForm.phone.trim(),
                    });
                  }
                  setNoteForm({ name: '', details: '', totalAmount: '', paidAmount: '', appointmentFor: '', appointmentDescription: '', appointmentDate: '', appointmentTime: '', phone: '', email: '' });
                  setNoteFormError('');
                  setNoteOpen(false);
                }}
                className="flex-[1.5] px-4 py-3 text-black font-black rounded-xl transition-all text-sm border border-black/10 hover:-translate-y-0.5 hover:shadow-md"
                style={{ backgroundColor: '#c6ff34' }}
              >{noteEditId ? 'Update Note' : 'Save Note'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Note Delete Confirm */}
      {noteDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Delete Note?</h3>
            <p className="text-sm text-gray-500">{t('cannotBeUndone')}</p>
            <div className="flex gap-3">
              <button onClick={() => setNoteDeleteId(null)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors">{t('cancel')}</button>
              <button onClick={() => { deleteNote(noteDeleteId); setNoteDeleteId(null); }} className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors">{t('delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
