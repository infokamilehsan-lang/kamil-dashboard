import { useState, useRef, useEffect } from 'react';
import { useShop } from '../context/ShopContext';
import { useNotifications } from '../context/NotificationContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { SHOP_TYPES, CATEGORY_BADGE } from '../data/initialData';
import AddShopModal from './AddShopModal';
import ShopSettingsModal from './ShopSettingsModal';
import { getEmailLog, clearEmailLog } from '../lib/emailService';



export default function ShopManager({ onSearchOpen }) {
  const { shops, activeShop, setActiveShopId, deleteShop, syncStatus, brand, updateBrand, downloadBackup } = useShop();
  const { notifications, unreadCount, markAllRead, clearAll, ICONS, COLORS } = useNotifications();
  const { t, locale, lang, toggleLang } = useLanguage();
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [settingsShop, setSettingsShop] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [now, setNow] = useState(new Date());
  const [brandOpen, setBrandOpen] = useState(false);
  const [brandDraft, setBrandDraft] = useState({});
  const brandImgRef = useRef(null);
  const ref = useRef(null);
  const notifRef = useRef(null);
  const [emailBoxOpen, setEmailBoxOpen] = useState(false);
  const [emailLog, setEmailLog] = useState([]);
  const emailBoxRef = useRef(null);

  const openEmailBox = () => {
    setEmailLog(getEmailLog());
    setEmailBoxOpen(true);
  };

  const handleClearEmailLog = () => {
    clearEmailLog();
    setEmailLog([]);
  };

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setDropdownOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (emailBoxRef.current && !emailBoxRef.current.contains(e.target)) setEmailBoxOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const shopType = SHOP_TYPES.find((t) => t.value === activeShop?.type);

  const handleSelect = (shopId) => {
    setActiveShopId(shopId);
    setDropdownOpen(false);
  };

  const handleDelete = (e, shopId) => {
    e.stopPropagation();
    setConfirmDelete(shopId);
  };

  const confirmDeleteShop = () => {
    if (confirmDelete) {
      deleteShop(confirmDelete);
      setConfirmDelete(null);
      setDropdownOpen(false);
    }
  };

  const openBrandEdit = () => {
    setBrandDraft({ name: brand.name || 'ShopManager', image: brand.image || '' });
    setBrandOpen(true);
  };

  const saveBrand = () => {
    const updated = { name: brandDraft.name?.trim() || 'ShopManager', image: brandDraft.image || '' };
    updateBrand(updated);
    setBrandOpen(false);
  };

  const handleBrandImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setBrandDraft((d) => ({ ...d, image: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const brandName = brand.name || 'ShopManager';
  const brandImage = brand.image || '';
  const brandInitials = brandName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'SM';

  const timeStr = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = now.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });

  const syncConfig = {
    saved: { dot: 'bg-violet-100', text: 'text-cyan-400', bg: 'bg-violet-500/10 border-emerald-200', label: t('synced') },
    syncing: { dot: 'bg-blue-100 animate-pulse', text: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-200', label: t('saving') },
    offline: { dot: 'bg-red-100', text: 'text-red-400', bg: 'bg-red-500/10 border-red-200', label: t('offline') },
  };
  const sync = syncConfig[syncStatus] || syncConfig.offline;

  return (
    <>
      {/* ── HEADER BAR ── */}
      <div className="sticky top-0 z-40 shadow-sm" style={{ backgroundColor: '#582f0e', paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="relative flex items-center h-12 sm:h-14 gap-2 sm:gap-3">

            {/* Brand */}
            <button
              onClick={openBrandEdit}
              className="flex items-center gap-2.5 shrink-0 group"
              title={t('editBrand')}
            >
              {brandImage ? (
                <div className="w-8 h-8 rounded-lg overflow-hidden ring-2 ring-amber-500/20 shrink-0">
                  <img src={brandImage} alt={brandName} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-linear-to-br from-cyan-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {brandInitials}
                </div>
              )}
              <span className="hidden sm:block font-extrabold text-sm tracking-wide uppercase transition-all duration-500 hover:tracking-widest hover:scale-105 hover:drop-shadow-lg border-b-2" style={{ color: '#f59e0b', letterSpacing: '0.08em', textShadow: '0 1px 2px rgba(0,0,0,0.2)', borderColor: '#f59e0b', paddingBottom: '2px', background: 'linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b)', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: 'shimmer 3s linear infinite' }}>{brandName}</span>
            </button>

            {/* Divider */}
            <div className="hidden sm:block w-px h-5 bg-white/30 shrink-0" />

            {/* Shop Selector + New Shop */}
            <div className="flex items-center gap-1.5 shrink-0" ref={ref}>
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen((o) => !o)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all border ${dropdownOpen ? 'bg-white/20 text-white border-white/40' : 'text-white/70 hover:text-white bg-white/10 hover:bg-white/20 border-white/20 hover:border-white/40'
                    }`}
                >
                  {activeShop?.image ? (
                    <div className="w-5 h-5 rounded-md overflow-hidden shrink-0">
                      <img src={activeShop.image} alt={activeShop.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: '#f59e0b', boxShadow: '0 2px 8px rgba(245,158,11,0.4)' }}>
                      <span className="text-[9px] font-bold text-white">{activeShop?.name?.charAt(0)?.toUpperCase()}</span>
                    </div>
                  )}
                  <span className="hidden md:inline truncate max-w-28 text-sm font-semibold">{activeShop?.name || t('select')}</span>
                  <svg className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown */}
                {dropdownOpen && (
                  <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-2xl shadow-xl shadow-gray-200/50 z-50 overflow-hidden">
                    <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-slate-700/50">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('yourShops')}</p>
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)' }}>{shops.length}</span>
                    </div>
                    <ul className="max-h-64 overflow-y-auto divide-y divide-slate-800">
                      {shops.map((shop) => {
                        const type = SHOP_TYPES.find((t) => t.value === shop.type);
                        const isActive = shop.id === activeShop?.id;
                        return (
                          <li key={shop.id}>
                            <button
                              onClick={() => handleSelect(shop.id)}
                              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors group ${isActive ? 'bg-amber-500/10' : 'hover:bg-gray-50'
                                }`}
                            >
                              {shop.image ? (
                                <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
                                  <img src={shop.image} alt={shop.name} className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(245,158,11,0.2)' }}>
                                  <span className="text-xs font-bold" style={{ color: '#f59e0b' }}>{shop.name?.charAt(0)?.toUpperCase()}</span>
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{shop.name}</p>
                                <p className="text-xs text-gray-400 truncate">{t(type?.labelKey)}</p>
                              </div>
                              {isActive && (
                                <div className="flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDropdownOpen(false); setSettingsShop(shop); }}
                                    className="p-1 rounded-md hover:bg-amber-100/20 text-gray-400 hover:text-amber-500 transition-colors"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                              {!isActive && shops.length > 1 && (
                                <button
                                  onClick={(e) => handleDelete(e, shop.id)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-red-500/10 text-slate-600 hover:text-red-500"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="p-3 border-t border-slate-700/50">
                      <button
                        onClick={() => { setDropdownOpen(false); setAddModalOpen(true); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-colors"
                        style={{ backgroundColor: '#f59e0b' }}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        {t('addNewShop')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Language toggle */}
              <button
                onClick={toggleLang}
                className="flex items-center justify-center gap-1 px-2 py-1.5 sm:gap-1.5 sm:px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white/70 hover:text-white text-xs font-semibold transition-all shrink-0"
                title={lang === 'it' ? t('switchToEnglish') : t('switchToItalian')}
              >
                {lang === 'it' ? '🇬🇧 EN' : '🇮🇹 IT'}
              </button>

            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Center: Time */}
            <div className="absolute left-1/2 -translate-x-1/2 hidden lg:flex items-center gap-2 pointer-events-none">
              <div className="flex flex-col items-center px-3 py-1 rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm">
                <p className="text-sm font-bold text-white tracking-widest leading-tight" style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.12em' }}>{timeStr}</p>
                <p className="text-[10px] font-medium text-amber-300/80 leading-tight tracking-wide uppercase">{dateStr}</p>
              </div>
            </div>

            {/* Right: Search + Settings + Bell + Lang + Logout + Time */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">

              {/* Search */}
              <button
                onClick={onSearchOpen}
                className="flex items-center justify-center gap-2 w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 rounded-xl transition-all text-left group"
              >
                <svg className="w-3.5 h-3.5 text-white/50 group-hover:text-white shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="hidden sm:inline text-xs text-white/50 group-hover:text-white/70 transition-colors">{t('search')}</span>
                <kbd className="hidden md:inline-flex items-center text-[10px] text-white/40 border border-white/20 bg-white/10 rounded px-1 py-0.5 font-mono">⌘K</kbd>
              </button>

              {/* Settings */}
              <button
                onClick={() => setSettingsShop(activeShop)}
                className="flex items-center justify-center gap-1.5 w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white/70 hover:text-white transition-all shrink-0"
                title={t('shopSettings')}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
                <span className="hidden sm:inline text-xs">{t('settings')}</span>
              </button>

              {/* Email Box */}
              <div className="relative" ref={emailBoxRef}>
                <button
                  onClick={openEmailBox}
                  className={`relative w-8 h-8 flex items-center justify-center rounded-xl border transition-all ${emailBoxOpen ? 'bg-white/20 border-white/40 text-white' : 'bg-white/10 border-white/20 text-white/70 hover:bg-white/20 hover:border-white/40 hover:text-white'
                    }`}
                  title="Email Box"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {emailLog.length > 0 && !emailBoxOpen && (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 flex items-center justify-center bg-amber-500 text-white text-[9px] font-bold rounded-full px-0.5">
                      {emailLog.length > 9 ? '9+' : emailLog.length}
                    </span>
                  )}
                </button>

                {/* Email Box Dropdown */}
                {emailBoxOpen && (
                  <div className="absolute right-0 top-full mt-2 w-96 bg-white border border-amber-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-amber-100" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm font-bold text-white">Email Box</p>
                        {emailLog.length > 0 && (
                          <span className="text-xs font-bold text-amber-700 bg-white/30 px-1.5 py-0.5 rounded-full">{emailLog.length}</span>
                        )}
                      </div>
                      {emailLog.length > 0 && (
                        <button onClick={handleClearEmailLog} className="text-xs text-amber-100 hover:text-white transition-colors font-medium">Clear All</button>
                      )}
                    </div>

                    {/* Email list */}
                    {emailLog.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mb-3">
                          <svg className="w-5 h-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="text-sm font-semibold text-gray-500">No emails sent yet</p>
                        <p className="text-xs text-gray-400 mt-0.5">Sent emails will appear here</p>
                      </div>
                    ) : (
                      <ul className="max-h-96 overflow-y-auto divide-y divide-amber-50">
                        {emailLog.map((em) => {
                          const isFailed = em.status === 'failed';
                          const d = new Date(em.sentAt);
                          const timeLabel = d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                          return (
                            <li key={em.id} className="flex items-start gap-3 px-4 py-3 hover:bg-amber-50/60 transition-colors">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${isFailed ? 'bg-red-100' : 'bg-amber-100'}`}>
                                <svg className={`w-3.5 h-3.5 ${isFailed ? 'text-red-500' : 'text-amber-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-900 truncate">{em.subject}</p>
                                <p className="text-xs text-amber-600 truncate">{em.to}</p>
                                {em.toName && <p className="text-[11px] text-gray-400">{em.toName}</p>}
                                {em.message && <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{em.message}</p>}
                                {isFailed && <p className="text-[11px] text-red-400 mt-0.5">✗ {em.error}</p>}
                              </div>
                              <span className="text-[10px] text-gray-400 shrink-0 mt-0.5 whitespace-nowrap">{timeLabel}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Notification Bell */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => { setNotifOpen((o) => !o); if (!notifOpen) markAllRead(); }}
                  className={`relative w-8 h-8 flex items-center justify-center rounded-xl border transition-all ${notifOpen ? 'bg-white/20 border-white/40 text-white' : 'bg-white/10 border-white/20 text-white/70 hover:bg-white/20 hover:border-white/40 hover:text-white'
                    }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full px-0.5">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown */}
                {notifOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-amber-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-amber-100" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white">{t('notifications')}</p>
                        {notifications.length > 0 && (
                          <span className="text-xs font-bold text-amber-700 bg-white/30 px-1.5 py-0.5 rounded-full">{notifications.length}</span>
                        )}
                      </div>
                      {notifications.length > 0 && (
                        <button onClick={clearAll} className="text-xs text-amber-100 hover:text-white transition-colors font-medium">{t('clearAll')}</button>
                      )}
                    </div>

                    {/* List */}
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mb-3">
                          <svg className="w-5 h-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                        </div>
                        <p className="text-sm font-semibold text-gray-500">{t('allCaughtUp')}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{t('noNotificationsYet')}</p>
                      </div>
                    ) : (
                      <ul className="max-h-80 overflow-y-auto divide-y divide-amber-50">
                        {notifications.map((n) => {
                          const c = COLORS[n.type] || COLORS.info;
                          return (
                            <li key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-amber-50/60 transition-colors">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${c.icon}`}>
                                {ICONS[n.type] || ICONS.info}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-900">{n.title}</p>
                                {n.message && <p className="text-xs text-gray-400 truncate mt-0.5">{n.message}</p>}
                              </div>
                              <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">{n.time}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Backup Download */}
              <button
                onClick={downloadBackup}
                className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/10 hover:bg-emerald-500/20 border border-white/20 hover:border-emerald-500/40 text-white/70 hover:text-emerald-400 transition-all shrink-0"
                title="Download Backup"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>

              {/* Logout */}
              <button
                onClick={logout}
                className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/10 hover:bg-red-500/20 border border-white/20 hover:border-red-500/40 text-white/70 hover:text-red-400 transition-all shrink-0"
                title={t('login_logout')}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>


            </div>

          </div>
        </div>
      </div>

      {/* Add Shop Modal */}
      {addModalOpen && <AddShopModal onClose={() => setAddModalOpen(false)} />}

      {/* Brand Edit Modal */}
      {brandOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-5 border-b border-slate-700/50 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">{t('editBrand')}</h2>
              <button onClick={() => setBrandOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-700 text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-5">
              {/* Image upload */}
              <div className="flex flex-col items-center gap-3">
                <div
                  onClick={() => brandImgRef.current?.click()}
                  className="relative w-20 h-20 rounded-2xl cursor-pointer group overflow-hidden border-2 border-dashed border-gray-200 hover:border-amber-400 transition-colors"
                >
                  {brandDraft.image ? (
                    <img src={brandDraft.image} alt="Brand" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-linear-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                      <span className="text-gray-900 font-bold text-xl">
                        {(brandDraft.name || 'SM').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                </div>
                <input ref={brandImgRef} type="file" accept="image/*" className="hidden" onChange={handleBrandImage} />
                <div className="flex gap-2">
                  <button onClick={() => brandImgRef.current?.click()}
                    className="text-xs font-semibold hover:opacity-80 px-3 py-1.5 rounded-lg transition-colors"
                    style={{ color: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)' }}>
                    {t('uploadLogo')}
                  </button>
                  {brandDraft.image && (
                    <button onClick={() => setBrandDraft(d => ({ ...d, image: '' }))}
                      className="text-xs font-semibold text-red-500 hover:text-red-600 px-3 py-1.5 bg-red-500/10 hover:bg-red-100 rounded-lg transition-colors">
                      {t('remove')}
                    </button>
                  )}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t('brandName')}</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 font-semibold"
                  value={brandDraft.name || ''}
                  onChange={e => setBrandDraft(d => ({ ...d, name: e.target.value }))}
                  placeholder="ShopManager"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setBrandOpen(false)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-500 font-semibold rounded-xl hover:bg-gray-50 text-sm transition-colors">
                  {t('cancel')}
                </button>
                <button onClick={saveBrand}
                  className="flex-1 py-2.5 hover:opacity-90 text-white font-semibold rounded-xl text-sm transition-colors"
                  style={{ backgroundColor: '#f59e0b' }}>
                  {t('save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shop Settings Modal */}
      {settingsShop && <ShopSettingsModal shop={settingsShop} onClose={() => setSettingsShop(null)} />}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-2">{t('deleteShopConfirm')}</h3>
            <p className="text-sm text-gray-500 mb-6">
              {t('deleteShopWarning')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-slate-200 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={confirmDeleteShop}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
