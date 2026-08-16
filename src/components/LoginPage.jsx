import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function LoginPage() {
  const { login, verifyMfa, googleLogin } = useAuth();
  const { t, lang, toggleLang } = useLanguage();

  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [mfaChallenge, setMfaChallenge] = useState(null);
  const [mfaCode, setMfaCode] = useState('');

  const googleBtnRef = useRef(null);
  const googleRenderedRef = useRef(false);

  // Google Sign-In init
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return undefined;

    const initializeGoogle = () => {
      if (!window.google?.accounts?.id || !googleBtnRef.current || googleRenderedRef.current) return false;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          setGoogleLoading(true); setError('');
          try { await googleLogin(response.credential); }
          catch (err) { setError(err.message || 'Google login failed'); }
          finally { setGoogleLoading(false); }
        },
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: Math.max(120, Math.round(googleBtnRef.current.getBoundingClientRect().width)),
        shape: 'pill',
        text: 'signin_with',
      });
      googleRenderedRef.current = true;
      setGoogleReady(true);
      return true;
    };

    const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    const onScriptLoad = () => initializeGoogle();
    if (!initializeGoogle()) script?.addEventListener('load', onScriptLoad, { once: true });

    // Covers mobile reloads where the script load event fires just before the
    // React effect attaches its listener.
    const retryId = window.setInterval(() => {
      if (initializeGoogle()) window.clearInterval(retryId);
    }, 250);
    const stopRetryId = window.setTimeout(() => window.clearInterval(retryId), 10000);

    return () => {
      script?.removeEventListener('load', onScriptLoad);
      window.clearInterval(retryId);
      window.clearTimeout(stopRetryId);
    };
  }, [googleLogin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const response = await login(email, password);
      if (response.mfaRequired || response.mfaSetupRequired) {
        setMfaChallenge(response);
        setMfaCode('');
      }
    }
    catch (err) {
      const msg = err.message || err.code || '';
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('password'))
        setError(t('login_invalidCredentials') || 'Email ya password galat hai');
      else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch'))
        setError('Server se connection nahi hua. Backend chal raha hai?');
      else setError(msg || 'Login fail hua');
    } finally { setLoading(false); }
  };

  const handleMfaSubmit = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(mfaCode)) {
      setError(lang === 'it' ? 'Inserisci il codice di 6 cifre.' : 'Enter the 6-digit code.');
      return;
    }
    setError(''); setLoading(true);
    try { await verifyMfa(mfaChallenge.challengeToken, mfaCode); }
    catch (err) { setError(err.message || (lang === 'it' ? 'Codice non valido.' : 'Invalid authenticator code.')); }
    finally { setLoading(false); }
  };

  const emailActive    = focusedField === 'email'    || email !== '';
  const passwordActive = focusedField === 'password' || password !== '';

  return (
    <div style={{ position: 'relative', minHeight: '100dvh', width: '100%', display: 'flex', overflow: 'hidden', background: '#050505' }}>

      <style>{`
        @keyframes lp-fadeUp   { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        @keyframes lp-shimmer  { 0% { background-position:-200% 0 } 100% { background-position:200% 0 } }
        .lp-fade-up { animation: lp-fadeUp 0.4s ease-out both; }
        .lp-shimmer { animation: lp-shimmer 3s linear infinite; background-size: 200% 100%; }
        .lp-card-stage { perspective: 1200px; }
        .lp-card-3d {
          position: relative;
          isolation: isolate;
          transform: rotateX(2deg) rotateY(-2deg) translateZ(0);
          transform-style: preserve-3d;
          background: linear-gradient(145deg, rgba(38,38,38,.82), rgba(5,5,5,.72));
          border: 1px solid rgba(255,255,255,.18);
          box-shadow: -18px 24px 55px rgba(0,0,0,.52), 0 2px 0 rgba(255,255,255,.15) inset, 0 -1px 0 rgba(0,0,0,.8) inset;
          backdrop-filter: blur(22px) saturate(125%);
          -webkit-backdrop-filter: blur(22px) saturate(125%);
          transition: transform .55s cubic-bezier(.22,1,.36,1), box-shadow .55s ease;
        }
        .lp-card-3d::before {
          content: '';
          position: absolute;
          inset: 1px;
          z-index: -1;
          border-radius: inherit;
          pointer-events: none;
          background: linear-gradient(120deg, rgba(255,255,255,.12), transparent 30%, transparent 70%, rgba(255,255,255,.04));
        }
        .lp-card-3d:hover {
          transform: rotateX(0deg) rotateY(0deg) translateY(-6px) translateZ(18px);
          box-shadow: -8px 32px 70px rgba(0,0,0,.6), 0 2px 0 rgba(255,255,255,.18) inset;
        }
        .lp-field-label {
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: .22em;
          text-shadow: 0 2px 10px rgba(0,0,0,.65);
        }
        .lp-input-wrap {
          transform: translateZ(24px);
          box-shadow: 0 12px 24px rgba(0,0,0,.2), 0 1px 0 rgba(255,255,255,.07) inset;
          transition: transform .35s cubic-bezier(.22,1,.36,1), box-shadow .35s, border-color .3s, background .3s;
        }
        .lp-input-wrap:focus-within {
          transform: translateZ(36px) translateY(-2px);
          box-shadow: 0 18px 34px rgba(0,0,0,.32), 0 0 0 4px rgba(255,255,255,.05), 0 1px 0 rgba(255,255,255,.14) inset;
        }
        .lp-modern-input {
          color: #fff !important;
          caret-color: #fff;
          font-weight: 520;
          letter-spacing: -.015em;
        }
        .lp-modern-input:-webkit-autofill,
        .lp-modern-input:-webkit-autofill:hover,
        .lp-modern-input:-webkit-autofill:focus {
          -webkit-text-fill-color: #fff !important;
          caret-color: #fff;
          transition: background-color 9999s ease-out 0s;
        }
        .lp-submit-3d {
          transform: translateZ(38px);
          box-shadow: 0 6px 0 #b9b9b9, 0 20px 34px rgba(0,0,0,.38), 0 1px 0 #fff inset;
          transition: transform .22s cubic-bezier(.22,1,.36,1), box-shadow .22s ease;
        }
        .lp-submit-3d:hover { transform: translateZ(46px) translateY(-4px); box-shadow: 0 9px 0 #b9b9b9, 0 26px 42px rgba(0,0,0,.44), 0 1px 0 #fff inset; }
        .lp-submit-3d:active { transform: translateZ(30px) translateY(4px); box-shadow: 0 2px 0 #aaa, 0 10px 18px rgba(0,0,0,.35); }
        .lp-submit-text { font-size: 15px; font-weight: 800; letter-spacing: -.025em; }
        .lp-mobile-lang-fixed { display: none; }
        @media (max-width: 640px) {
          .lp-card-3d,
          .lp-card-3d:hover { transform: none; }
          .lp-card-stage .lp-card-3d {
            background: transparent;
            border-color: transparent;
            box-shadow: none;
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
          }
          .lp-card-stage .lp-card-3d::before {
            display: none;
          }
          .lp-welcome-header {
            display: none;
          }
          .lp-mobile-brand {
            position: absolute;
            top: max(1rem, env(safe-area-inset-top));
            left: 1rem;
            z-index: 20;
            margin: 0 !important;
            max-width: calc(100% - 7rem);
          }
          .lp-lang-toggle {
            display: none !important;
          }
          .lp-mobile-lang-fixed {
            display: block;
            position: fixed;
            top: max(4.25rem, calc(env(safe-area-inset-top) + 2.5rem));
            right: 1rem;
            z-index: 9999;
            visibility: visible;
            opacity: 1;
            transform: translateZ(0);
          }
          .lp-field-label {
            color: #fff !important;
            opacity: 1 !important;
          }
          .lp-input-wrap,
          .lp-input-wrap:focus-within,
          .lp-submit-3d,
          .lp-submit-3d:hover {
            transform: none;
          }
          .lp-input-wrap {
            border: 1.5px solid rgba(255,255,255,.78) !important;
            background: rgba(0,0,0,.18) !important;
            box-shadow: 0 0 0 1px rgba(255,255,255,.08), 0 8px 22px rgba(0,0,0,.18) !important;
          }
          .lp-input-wrap:focus-within {
            border-color: #fff !important;
            box-shadow: 0 0 0 3px rgba(255,255,255,.16) !important;
          }
          .lp-input-wrap svg {
            color: #fff !important;
          }
          .lp-modern-input::placeholder {
            color: rgba(255,255,255,.72) !important;
            opacity: 1;
          }
          .lp-login-panel {
            z-index: 10 !important;
            transform: translate3d(0, 0, 1px);
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
          }
          .lp-auth-shift {
            transform: translateY(12rem);
          }
          .lp-mobile-footer {
            position: absolute;
            left: 0;
            right: 0;
            bottom: max(.65rem, env(safe-area-inset-bottom));
            margin: 0 !important;
            z-index: 20;
          }
          .lp-submit-mobile {
            width: 100% !important;
            margin: 0;
            min-height: 44px;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            border: 1px solid #dadce0;
            border-radius: 999px !important;
            background: rgba(255,255,255,.94) !important;
            box-shadow: none !important;
          }
          .lp-action-row {
            display: grid !important;
            grid-template-columns: minmax(0, .38fr) minmax(0, .62fr);
            align-items: stretch;
            gap: .65rem !important;
          }
          .lp-google-inline,
          .lp-google-inline > div {
            min-width: 0;
            width: 100%;
            max-width: 100%;
            overflow: hidden;
          }
          .lp-google-inline iframe {
            max-width: 100% !important;
          }
        }
      `}</style>

      {/* Background video — the black-liquid clip, looping */}
      <video
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={{ zIndex: 0 }}
        autoPlay
        muted
        loop
        playsInline
        poster="/login-bg-poster.jpg"
      >
        <source src="/login-bg-mobile.mp4" media="(max-width: 768px)" type="video/mp4" />
        <source src="/login-bg.mp4" type="video/mp4" />
      </video>

      {/* Light overlay for text legibility + ceiling glow to match the video's top light */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1, background: 'linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.32) 55%, rgba(0,0,0,0.42) 100%)' }} />
      <div className="absolute top-0 left-0 right-0 h-72 pointer-events-none" style={{ zIndex: 1, background: 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 45%, transparent 100%)' }} />

      <button
        type="button"
        onClick={toggleLang}
        className="lp-mobile-lang-fixed px-3 py-1.5 text-[11px] font-bold rounded-lg"
        style={{ background: 'rgba(10,10,10,0.68)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      >
        {lang === 'it' ? '🇬🇧 EN' : '🇮🇹 IT'}
      </button>

      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex flex-1 flex-col justify-start relative z-10 overflow-hidden pt-44 pb-12 pl-20 pr-12">
        <div className="absolute inset-x-0 bottom-0 z-[2] flex items-end justify-center pointer-events-none" aria-hidden="true">
          <div className="absolute bottom-0 left-[12%] right-[4%] h-28 rounded-[50%] blur-3xl" style={{ background: 'rgba(0,0,0,0.72)' }} />
          <img
            src="/team-hero-v2.png"
            alt=""
            width="1536"
            height="1024"
            loading="eager"
            decoding="async"
            className="relative w-[78%] max-w-[700px] h-auto object-contain object-bottom"
            style={{ filter: 'drop-shadow(0 28px 34px rgba(0,0,0,0.65))', transform: 'translate(-12%, 3%)' }}
          />
        </div>

        {/* Brand */}
        <div className="relative z-10" style={{ textShadow: '0 2px 16px rgba(0,0,0,0.6)' }}>
          <div className="flex items-center gap-4 mb-8">
            <img src="/logo.png" alt="KF Logo" className="w-14 h-14 rounded-2xl object-cover shadow-2xl" style={{ border: '1px solid rgba(255,255,255,0.12)' }} />
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">KF Shop Manager</h2>
              <p className="text-stone-300 text-xs font-medium">Business Dashboard</p>
            </div>
          </div>

          <div className="w-10 h-[2px] rounded-full mb-6 bg-white/40" />

          <h1 className="text-5xl font-black text-white leading-[1.1] tracking-tight">
            {lang === 'it' ? 'Il Tuo Business,' : 'Your Business,'}
            <br />
            <span className="text-white/60">{lang === 'it' ? 'Sotto Controllo.' : 'Under Control.'}</span>
          </h1>

          <p className="text-stone-300 text-sm mt-5 leading-relaxed max-w-md">
            {lang === 'it'
              ? <>Gestisci vendite, team, riparazioni<br />e inventario da un unico posto.</>
              : <>Manage sales, team, repairs<br />and inventory from one place.</>}
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="lp-login-panel flex-1 flex flex-col justify-center relative z-10 p-4 sm:p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-sm mx-auto">

          {/* Lang toggle */}
          <div className="lp-lang-toggle flex justify-end mb-4">
            <button onClick={toggleLang} className="px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all duration-300 hover:scale-105" style={{ background: 'rgba(10,10,10,0.55)', border: '1px solid rgba(255,255,255,0.12)', color: '#d6d3d1', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
              {lang === 'it' ? '🇬🇧 EN' : '🇮🇹 IT'}
            </button>
          </div>

          {/* Mobile branding */}
          <div className="lp-mobile-brand lg:hidden mb-6" style={{ textShadow: '0 2px 16px rgba(0,0,0,0.6)' }}>
            <div className="flex items-center gap-3 mb-3">
              <img src="/logo.png" alt="KF Logo" className="w-10 h-10 rounded-xl object-cover shadow-lg" style={{ border: '1px solid rgba(255,255,255,0.12)' }} />
              <div>
                <h2 className="text-base font-black text-white tracking-tight">KF Shop Manager</h2>
                <p className="text-stone-300 text-[10px] font-medium">Business Dashboard</p>
              </div>
            </div>
            <h1 className="text-2xl font-black text-white leading-[1.1] tracking-tight">
              {lang === 'it' ? 'Il Tuo Business,' : 'Your Business,'}<br />
              <span className="text-white/60">{lang === 'it' ? 'Sotto Controllo.' : 'Under Control.'}</span>
            </h1>
          </div>

          {/* Header */}
          <div className="lp-welcome-header mb-6 sm:mb-8" style={{ textShadow: '0 2px 16px rgba(0,0,0,0.6)' }}>
            <h3 className="text-2xl font-bold text-white mb-1.5">{t('login_welcome')}</h3>
            <p className="text-stone-300 text-sm">{t('login_signInSubtitle') || 'Enter your credentials to continue'}</p>
          </div>

          {/* Card */}
          <div className="lp-auth-shift lp-card-stage mb-4">
          <div className="lp-card-3d rounded-[1.6rem] p-5 lg:p-7">
            {error && (
              <div className="mb-5 p-4 rounded-xl flex items-start gap-3 lp-fade-up" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(239,68,68,0.15)' }}>
                  <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                </div>
                <span className="text-red-400/90 text-sm leading-relaxed">{error}</span>
              </div>
            )}

            {mfaChallenge ? (
              <form onSubmit={handleMfaSubmit} className="space-y-5 lp-fade-up">
                <div className="text-center">
                  <div className="mx-auto mb-3 w-12 h-12 rounded-2xl flex items-center justify-center text-xl" style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.16)' }}>⌁</div>
                  <h4 className="text-white text-lg font-black">
                    {mfaChallenge.mfaSetupRequired
                      ? (lang === 'it' ? 'Configura Authenticator' : 'Set up Authenticator')
                      : (lang === 'it' ? 'Verifica in due passaggi' : 'Two-step verification')}
                  </h4>
                  <p className="text-stone-400 text-xs mt-1 leading-relaxed">
                    {mfaChallenge.mfaSetupRequired
                      ? (lang === 'it' ? 'Scansiona il QR con Google o Microsoft Authenticator, poi inserisci il codice.' : 'Scan the QR with Google or Microsoft Authenticator, then enter the code.')
                      : (lang === 'it' ? 'Inserisci il codice mostrato nella tua app Authenticator.' : 'Enter the code shown in your Authenticator app.')}
                  </p>
                </div>

                {mfaChallenge.mfaSetupRequired && mfaChallenge.qrCode && (
                  <div className="rounded-2xl bg-white p-3 mx-auto w-fit shadow-xl">
                    <img src={mfaChallenge.qrCode} alt="Authenticator setup QR code" className="w-44 h-44" />
                  </div>
                )}
                {mfaChallenge.mfaSetupRequired && mfaChallenge.manualKey && (
                  <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)' }}>
                    <p className="text-[9px] uppercase tracking-widest text-stone-500 font-bold">{lang === 'it' ? 'Chiave manuale' : 'Manual setup key'}</p>
                    <code className="block text-[11px] text-stone-200 mt-1 break-all select-all">{mfaChallenge.manualKey}</code>
                  </div>
                )}

                <div>
                  <label className="lp-field-label block mb-2.5 uppercase" style={{ color: '#fff' }}>{lang === 'it' ? 'Codice Authenticator' : 'Authenticator code'}</label>
                  <div className="lp-input-wrap rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,.05)', border: '1.5px solid rgba(255,255,255,.25)' }}>
                    <input
                      value={mfaCode}
                      onChange={(event) => { setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      className="lp-modern-input w-full px-4 py-4 bg-transparent text-center text-2xl tracking-[.45em] focus:outline-none"
                      placeholder="000000"
                    />
                  </div>
                </div>
                <button type="submit" disabled={loading || mfaCode.length !== 6} className="lp-submit-3d w-full py-4 rounded-xl font-black disabled:opacity-30" style={{ background: '#fff', color: '#080808' }}>
                  {loading ? (lang === 'it' ? 'Verifica…' : 'Verifying…') : (lang === 'it' ? 'Verifica e accedi' : 'Verify and sign in')}
                </button>
                <button type="button" onClick={() => { setMfaChallenge(null); setMfaCode(''); setError(''); }} className="w-full text-xs text-stone-400 hover:text-white transition-colors">
                  ← {lang === 'it' ? 'Torna al login' : 'Back to login'}
                </button>
              </form>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="lp-field-label block mb-2.5 uppercase transition-all duration-200" style={{ color: focusedField === 'email' ? '#ffffff' : '#8b93a3' }}>Email</label>
                <div className="lp-input-wrap relative rounded-xl overflow-hidden" style={{ background: focusedField === 'email' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)', border: `1.5px solid ${focusedField === 'email' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.07)'}` }}>
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-300" style={{ color: focusedField === 'email' ? '#e7e5e4' : '#44403c' }}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                  </div>
                  <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)} className="lp-modern-input w-full pl-10 pr-4 py-4 bg-transparent text-white text-base placeholder-stone-500 focus:outline-none" placeholder="email@example.com" required autoFocus />
                  <div style={{ position: 'absolute', bottom: 0, left: emailActive ? '0' : '50%', right: emailActive ? '0' : '50%', height: '2px', background: 'rgba(255,255,255,0.5)', transition: 'left 0.32s cubic-bezier(0.22,1,0.36,1), right 0.32s cubic-bezier(0.22,1,0.36,1)' }} />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="lp-field-label block mb-2.5 uppercase transition-all duration-200" style={{ color: focusedField === 'password' ? '#ffffff' : '#8b93a3' }}>Password</label>
                <div className="lp-input-wrap relative rounded-xl overflow-hidden" style={{ background: focusedField === 'password' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)', border: `1.5px solid ${focusedField === 'password' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.07)'}` }}>
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-300" style={{ color: focusedField === 'password' ? '#e7e5e4' : '#44403c' }}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                  </div>
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)} className="lp-modern-input w-full pl-10 pr-12 py-4 bg-transparent text-white text-base placeholder-stone-500 focus:outline-none" placeholder="••••••••" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-600 hover:text-stone-300 transition-all duration-300 hover:scale-110">
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    )}
                  </button>
                  <div style={{ position: 'absolute', bottom: 0, left: passwordActive ? '0' : '50%', right: passwordActive ? '0' : '50%', height: '2px', background: 'rgba(255,255,255,0.5)', transition: 'left 0.32s cubic-bezier(0.22,1,0.36,1), right 0.32s cubic-bezier(0.22,1,0.36,1)' }} />
                </div>
              </div>

              {/* Login actions */}
              <div className="lp-action-row pt-1 flex flex-col gap-4">
                <button type="submit" disabled={loading} className="lp-submit-mobile lp-submit-3d relative w-full py-4.5 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed overflow-hidden group/s" style={{ background: 'linear-gradient(145deg, #ffffff 0%, #e7e7e7 100%)', color: '#080808' }}>
                  <div className="absolute inset-0 lp-shimmer pointer-events-none" style={{ backgroundImage: 'linear-gradient(110deg, transparent 30%, rgba(0,0,0,0.08) 50%, transparent 70%)' }} />
                  {loading ? (
                    <span className="relative flex items-center justify-center gap-3"><svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" /><path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>{t('login_loading')}</span>
                  ) : (
                    <span className="lp-submit-text relative z-10 flex items-center justify-center gap-3">{t('login_signIn')}<svg className="w-5 h-5 transition-transform duration-300 group-hover/s:translate-x-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg></span>
                  )}
                </button>

                {GOOGLE_CLIENT_ID && (
                  <div className="lp-google-inline relative rounded-xl overflow-hidden" style={{ minHeight: 44, background: 'transparent' }}>
                    {!googleReady && (
                      <div className="absolute inset-0 flex items-center justify-center gap-2 text-black text-xs font-semibold pointer-events-none rounded-xl" style={{ background: 'rgba(255,255,255,.94)' }} aria-hidden="true">
                        <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center font-black" style={{ color: '#4285f4' }}>G</span>
                        <span>Google</span>
                      </div>
                    )}
                    <div ref={googleBtnRef} className="relative z-10 w-full flex justify-center" style={{ minHeight: 44 }} />
                    {googleLoading && <p className="text-center text-xs mt-2 animate-pulse" style={{ color: '#a8a29e' }}>{lang === 'it' ? 'Accesso...' : 'Signing in...'}</p>}
                  </div>
                )}
              </div>
            </form>
            )}
          </div>
          </div>

          <p className="lp-mobile-footer text-center text-[11px] mt-8" style={{ color: '#44403c' }}>
            &copy; {new Date().getFullYear()} Dashboard &middot; Secure &amp; Encrypted
          </p>
        </div>
      </div>
    </div>
  );
}
