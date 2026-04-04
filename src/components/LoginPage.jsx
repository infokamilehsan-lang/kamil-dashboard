import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function LoginPage() {
  const { login, googleLogin } = useAuth();
  const { t, lang, toggleLang } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleBtnRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Initialize Google Sign-In
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response) => {
        setGoogleLoading(true);
        setError('');
        try {
          await googleLogin(response.credential);
        } catch (err) {
          setError(err.message || 'Google login failed');
        } finally {
          setGoogleLoading(false);
        }
      },
    });
    if (googleBtnRef.current) {
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'filled_black',
        size: 'large',
        width: googleBtnRef.current.offsetWidth,
        shape: 'pill',
        text: 'signin_with',
      });
    }
  }, [mounted, googleLogin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      const msg = err.message || err.code || '';
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('password'))
        setError(t('login_invalidCredentials') || 'Email ya password galat hai');
      else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch'))
        setError('Server se connection nahi hua. Backend chal raha hai?');
      else setError(msg || 'Login fail hua');
    } finally {
      setLoading(false);
    }
  };

  const trans = (ms) => ({ transition: `all 0.6s cubic-bezier(0.16,1,0.3,1) ${ms}ms`, opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(24px)' });

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', overflow: 'hidden', background: 'linear-gradient(135deg, #0c0a09 0%, #1c1917 40%, #0c0a09 100%)', width: '100%', height: '100%' }}>

      {/* ═══ BACKGROUND LAYER ═══ */}
      {/* Warm amber glow top-right */}
      <div className="absolute -top-40 -right-40 w-200 h-200 rounded-full opacity-15 animate-float" style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)', filter: 'blur(100px)' }} />
      {/* Emerald glow bottom-left */}
      <div className="absolute -bottom-60 -left-40 w-200 h-200 rounded-full opacity-12 animate-float-reverse" style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)', filter: 'blur(120px)' }} />
      {/* Subtle teal center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-125 h-125 rounded-full opacity-6" style={{ background: 'radial-gradient(circle, #14b8a6 0%, transparent 60%)', filter: 'blur(80px)' }} />

      {/* Noise texture */}
      <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.5\'/%3E%3C/svg%3E")' }} />

      {/* Floating geometric shapes */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-175 h-175 animate-spin-slow opacity-60">
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-amber-400/50" />
        <div className="absolute inset-10 rounded-full border-2 border-dashed border-emerald-400/40" />
        <div className="absolute inset-20 rounded-full border-2 border-dashed border-teal-400/30" />
        {/* Corner dots on outer ring */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-amber-400 rounded-full shadow-lg shadow-amber-400/60" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-emerald-400 rounded-full shadow-lg shadow-emerald-400/60" />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-teal-400 rounded-full shadow-lg shadow-teal-400/60" />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-orange-400 rounded-full shadow-lg shadow-orange-400/60" />
      </div>
      {/* Center glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full animate-pulse" style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.15), transparent 70%)', animationDuration: '4s' }} />

      {/* ═══ LEFT PANEL — IMAGE ═══ */}
      <div className="hidden lg:flex flex-1 items-end justify-start relative z-10 overflow-hidden">
        {/* Top text overlay */}
        <div className="absolute top-12 left-12 z-20" style={trans(0)}>
          {/* Logo */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl blur-xl opacity-30 animate-pulse" style={{ animationDuration: '3s', background: 'linear-gradient(135deg, #f59e0b, #10b981)' }} />
              <img src="/logo.jpg" alt="KF Logo" className="relative w-14 h-14 rounded-2xl object-cover shadow-lg" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">KF Shop Manager</h2>
              <p className="text-stone-600 text-xs font-medium">Business Dashboard</p>
            </div>
          </div>

          <div className="w-2/5 h-1 rounded-full bg-linear-to-r from-amber-500 to-emerald-500 mb-5" />
          <h1 className="text-5xl font-black text-white leading-[1.1] tracking-tight">
            {lang === 'it' ? 'Il Tuo Business,' : 'Your Business,'}
            <br />
            <span className="bg-linear-to-r from-amber-400 via-orange-400 to-emerald-400 bg-clip-text text-transparent">
              {lang === 'it' ? 'Sotto Controllo.' : 'Under Control.'}
            </span>
          </h1>
          <p className="text-stone-500 text-sm mt-4 leading-relaxed max-w-md">
            {lang === 'it'
              ? 'Gestisci vendite, team, riparazioni e inventario da un unico posto.'
              : 'Manage sales, team, repairs and inventory from one place.'}
          </p>
        </div>

        {/* Full-height team image pinned to bottom-left, flush against left edge */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-start" style={trans(200)}>
          <img
            src="/brochure.png"
            alt="Team"
            className="h-[75vh] w-auto max-w-full object-contain object-left-bottom drop-shadow-2xl"
          />
        </div>
      </div>

      {/* ═══ RIGHT PANEL — LOGIN ═══ */}
      <div className="flex-1 flex flex-col justify-center relative z-10 p-4 sm:p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-sm mx-auto">

          {/* Language toggle */}
          <div className="flex justify-end mb-4" style={trans(0)}>
            <button
              onClick={toggleLang}
              className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-stone-800/50 text-stone-500 hover:text-stone-300 border border-stone-700/50 hover:border-stone-600 transition-all duration-300"
            >
              {lang === 'it' ? '🇬🇧 EN' : '🇮🇹 IT'}
            </button>
          </div>

          {/* Mobile-only branding (logo + headline + image) */}
          <div className="lg:hidden mb-4" style={trans(50)}>
            <div className="flex items-center gap-3 mb-2">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl blur-xl opacity-30 animate-pulse" style={{ animationDuration: '3s', background: 'linear-gradient(135deg, #f59e0b, #10b981)' }} />
                <img src="/logo.jpg" alt="KF Logo" className="relative w-10 h-10 rounded-xl object-cover shadow-lg" />
              </div>
              <div>
                <h2 className="text-base font-black text-white tracking-tight">KF Shop Manager</h2>
                <p className="text-stone-600 text-[10px] font-medium">Business Dashboard</p>
              </div>
            </div>
            <div className="w-1/4 h-0.5 rounded-full bg-linear-to-r from-amber-500 to-emerald-500 mb-1" />
            <h1 className="text-2xl font-black text-white leading-[1.1] tracking-tight">
              {lang === 'it' ? 'Il Tuo Business,' : 'Your Business,'}
              <br />
              <span className="bg-linear-to-r from-amber-400 via-orange-400 to-emerald-400 bg-clip-text text-transparent">
                {lang === 'it' ? 'Sotto Controllo.' : 'Under Control.'}
              </span>
            </h1>
            <p className="text-stone-500 text-xs mt-2 leading-relaxed">
              {lang === 'it'
                ? 'Gestisci vendite, team, riparazioni e inventario da un unico posto.'
                : 'Manage sales, team, repairs and inventory from one place.'}
            </p>
          </div>

          {/* Header */}
          <div className="mb-6 sm:mb-10 flex items-end justify-between" style={trans(100)}>
            <div>
              <h3 className="text-2xl font-bold text-white mb-1.5">
                {t('login_welcome')}
              </h3>
              <p className="text-stone-500 text-sm">
                {t('login_signInSubtitle') || 'Enter your credentials to continue'}
              </p>
            </div>
            <img
              src="/brochure.png"
              alt="Team"
              className="lg:hidden h-52 w-auto object-contain drop-shadow-2xl -mr-4 self-end mb-[-4rem]"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 rounded-2xl flex items-start gap-3 animate-fadeInUp" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(239,68,68,0.15)' }}>
                <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <span className="text-red-400/90 text-sm leading-relaxed">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div style={trans(300)}>
              <label className="block text-[11px] font-bold text-stone-500 mb-2 uppercase tracking-[0.12em]">Email</label>
              <div
                className="relative rounded-xl transition-all duration-400"
                style={{
                  background: focusedField === 'email' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                  border: `1.5px solid ${focusedField === 'email' ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.06)'}`,
                  boxShadow: focusedField === 'email' ? '0 0 20px rgba(16,185,129,0.08)' : 'none',
                }}
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                className="w-full px-4 py-3 sm:py-3.5 bg-transparent text-white text-sm placeholder-stone-600 focus:outline-none"
                  placeholder="email@example.com"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div style={trans(400)}>
              <label className="block text-[11px] font-bold text-stone-500 mb-2 uppercase tracking-[0.12em]">Password</label>
              <div
                className="relative rounded-xl transition-all duration-400"
                style={{
                  background: focusedField === 'password' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                  border: `1.5px solid ${focusedField === 'password' ? 'rgba(20,184,166,0.4)' : 'rgba(255,255,255,0.06)'}`,
                  boxShadow: focusedField === 'password' ? '0 0 20px rgba(20,184,166,0.08)' : 'none',
                }}
              >
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  className="w-full px-4 pr-12 py-3 sm:py-3.5 bg-transparent text-white text-sm placeholder-stone-600 focus:outline-none"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-600 hover:text-stone-400 transition-all duration-300 hover:scale-110"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <div className="pt-2" style={trans(450)}>
              <button
                type="submit"
                disabled={loading}
                className="relative w-full py-3.5 sm:py-4 text-white font-bold rounded-xl transition-all duration-500 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.97] overflow-hidden group/s hover:shadow-[0_20px_50px_rgba(245,158,11,0.15)]"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #10b981)' }}
              >
                <div className="absolute inset-0 animate-shimmer bg-size-[200%_100%] pointer-events-none" style={{ backgroundImage: 'linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.2) 50%, transparent 75%)' }} />
                {loading ? (
                  <span className="relative flex items-center justify-center gap-3">
                    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t('login_loading')}
                  </span>
                ) : (
                  <span className="relative flex items-center justify-center gap-2 text-[15px]">
                    {t('login_signIn')}
                    <svg className="w-4 h-4 transition-transform duration-300 group-hover/s:translate-x-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </span>
                )}
              </button>
            </div>
          </form>

          {/* Divider */}
          {GOOGLE_CLIENT_ID && (
            <div className="flex items-center gap-3 my-5" style={trans(500)}>
              <div className="flex-1 h-px bg-stone-700/50" />
              <span className="text-stone-600 text-[11px] font-medium uppercase tracking-wider">
                {lang === 'it' ? 'oppure' : 'or'}
              </span>
              <div className="flex-1 h-px bg-stone-700/50" />
            </div>
          )}

          {/* Google Sign-In */}
          {GOOGLE_CLIENT_ID && (
            <div style={trans(550)}>
              <div ref={googleBtnRef} className="w-full flex justify-center" style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, overflow: 'hidden' }} />
              <button
                type="button"
                onClick={() => {
                  const iframe = googleBtnRef.current?.querySelector('iframe');
                  if (iframe) iframe.contentWindow?.document?.querySelector('div[role=button]')?.click();
                  else googleBtnRef.current?.querySelector('div[role=button]')?.click();
                }}
                className="w-full py-3.5 rounded-xl flex items-center justify-center gap-3 text-sm font-bold text-white transition-all duration-300 hover:shadow-[0_20px_50px_rgba(245,158,11,0.15)] active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #10b981)' }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {lang === 'it' ? 'Accedi con Google' : 'Sign in with Google'}
              </button>
              {googleLoading && (
                <p className="text-center text-stone-500 text-xs mt-2 animate-pulse">
                  {lang === 'it' ? 'Accesso con Google...' : 'Signing in with Google...'}
                </p>
              )}
            </div>
          )}

          {/* Footer */}
          <p className="text-center text-stone-700 text-[11px] mt-10" style={trans(600)}>
            &copy; {new Date().getFullYear()} Dashboard &middot; Secure &amp; Encrypted
          </p>
        </div>
      </div>
    </div>
  );
}
