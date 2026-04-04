import { useState, useRef } from 'react';
import { useShop } from '../context/ShopContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { SHOP_TYPES, CURRENCIES } from '../data/initialData';
import { sendClientEmail } from '../lib/emailService';

const TABS = [
  {
    id: 'general', labelKey: 'tab_general', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21H5a2 2 0 01-2-2V7l7-4 7 4v12a2 2 0 01-2 2z" /></svg>
    )
  },
  {
    id: 'contact', labelKey: 'tab_contact', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
    )
  },
  {
    id: 'preferences', labelKey: 'tab_preferences', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    )
  },
  {
    id: 'cards', labelKey: 'tab_bankCards', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
    )
  },
  {
    id: 'danger', labelKey: 'tab_dangerZone', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
    )
  },
  {
    id: 'email', labelKey: 'emailNotifications', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
    )
  },
  {
    id: 'account', labelKey: 'tab_account', icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
    )
  },
];

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-slate-500 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

const inputCls = "w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all placeholder-slate-600";

const CARD_COLORS = [
  { id: 'blue', from: 'from-blue-500', to: 'to-blue-700', labelKey: 'blue' },
  { id: 'green', from: 'from-emerald-500', to: 'to-teal-600', labelKey: 'green' },
  { id: 'purple', from: 'from-purple-500', to: 'to-violet-500', labelKey: 'purple' },
  { id: 'orange', from: 'from-orange-400', to: 'to-red-500', labelKey: 'orange' },
  { id: 'slate', from: 'from-slate-600', to: 'to-slate-800', labelKey: 'dark' },
];

export default function ShopSettingsModal({ shop, onClose }) {
  const { updateShop, deleteShop, shops, addBankCard, updateBankCard, deleteBankCard, emailSettings: ctxEmailSettings, updateEmailSettings } = useShop();
  const { user, changePassword } = useAuth();
  const { t, locale } = useLanguage();
  const [activeTab, setActiveTab] = useState('general');
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInputRef = useRef(null);

  // Email settings state (synced with Firestore via context)
  const [emailSettings, setEmailSettings] = useState(() => ctxEmailSettings || { enabled: true, ownerEmail: 'infokamilstoreitalia@gmail.com' });
  const [emailSaved, setEmailSaved] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState(null);
  const [testEmailAddr, setTestEmailAddr] = useState(() => (ctxEmailSettings || {}).ownerEmail || 'infokamilstoreitalia@gmail.com');

  const handleSaveEmailSettings = () => {
    updateEmailSettings(emailSettings);
    setEmailSaved(true);
    setTimeout(() => setEmailSaved(false), 2500);
  };

  const handleTestEmail = async () => {
    if (!testEmailAddr) return;
    setEmailTestResult('sending...');
    const res = await sendClientEmail({
      to: testEmailAddr,
      toName: 'Test User',
      subject: `Test Notification – ${shop.name}`,
      message: `This is a test email from ${shop.name}.\nEmail notifications are working correctly!`,
      shopName: shop.name,
    });
    setEmailTestResult(res.success ? 'ok' : res.error || 'failed');
    setTimeout(() => setEmailTestResult(null), 4000);
  };

  // Bank Cards state
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [cardForm, setCardForm] = useState({ bankName: '', cardHolder: '', last4: '', accountNo: '', iban: '', cardType: 'debit', color: 'blue' });
  const [cardFormError, setCardFormError] = useState('');
  const [deleteCardId, setDeleteCardId] = useState(null);
  const [editCardId, setEditCardId] = useState(null);
  const [editCardForm, setEditCardForm] = useState({});

  const bankCards = shop.bankCards || [];

  // Change password state
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const isGoogleUser = user?.providerData?.[0]?.providerId === 'google.com';

  const handleChangePassword = async () => {
    setPwError('');
    setPwSuccess(false);
    if (!pwForm.current || !pwForm.newPw || !pwForm.confirm) {
      setPwError(t('pw_allFieldsRequired')); return;
    }
    if (pwForm.newPw.length < 6) {
      setPwError(t('login_weakPassword')); return;
    }
    if (pwForm.newPw !== pwForm.confirm) {
      setPwError(t('pw_mismatch')); return;
    }
    setPwLoading(true);
    try {
      await changePassword(pwForm.current, pwForm.newPw);
      setPwSuccess(true);
      setPwForm({ current: '', newPw: '', confirm: '' });
      setTimeout(() => setPwSuccess(false), 4000);
    } catch (err) {
      const code = err.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') setPwError(t('pw_wrongCurrent'));
      else if (code === 'auth/weak-password') setPwError(t('login_weakPassword'));
      else setPwError(err.message || 'Error');
    } finally {
      setPwLoading(false);
    }
  };

  const handleAddCard = () => {
    if (!cardForm.bankName.trim()) { setCardFormError('Il nome della banca è obbligatorio.'); return; }
    if (!cardForm.cardHolder.trim()) { setCardFormError("Il nome dell'intestatario è obbligatorio."); return; }
    addBankCard(shop.id, { ...cardForm, last4: cardForm.last4.slice(-4) });
    setCardForm({ bankName: '', cardHolder: '', last4: '', accountNo: '', iban: '', cardType: 'debit', color: 'blue' });
    setCardFormError('');
    setAddCardOpen(false);
  };

  const handleEditCardSave = (cardId) => {
    updateBankCard(shop.id, cardId, editCardForm);
    setEditCardId(null);
  };

  // Form state — all fields
  const [form, setForm] = useState({
    name: shop.name || '',
    type: shop.type || 'other',
    description: shop.description || '',
    ragioneSociale: shop.ragioneSociale || '',
    partitaIva: shop.partitaIva || '',
    codiceFiscale: shop.codiceFiscale || '',
    pec: shop.pec || '',
    sdiCode: shop.sdiCode || '',
    rea: shop.rea || '',
    phone: shop.phone || '',
    email: shop.email || '',
    address: shop.address || '',
    city: shop.city || '',
    country: shop.country || '',
    currency: shop.currency || 'USD',
    taxRate: shop.taxRate || '',
    image: shop.image || '',
  });

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setSaved(false);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm((f) => ({ ...f, image: ev.target.result }));
      setSaved(false);
    };
    reader.readAsDataURL(file);
    // reset input so same file can be re-selected
    e.target.value = '';
  };

  const removeImage = () => {
    setForm((f) => ({ ...f, image: '' }));
    setSaved(false);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    updateShop(shop.id, { ...form, name: form.name.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleDelete = () => {
    deleteShop(shop.id);
    onClose();
  };

  const currencyObj = CURRENCIES.find((c) => c.code === form.currency) || CURRENCIES[0];
  const canDelete = shops.length > 1;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col" style={{maxHeight: '95vh', minHeight: '600px'}}>

        {/* Header */}
        <div className="px-6 py-5 shrink-0" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{t('shopSettingsTitle')}</h2>
              <p className="text-amber-100 text-sm mt-0.5">{shop.name}</p>
            </div>
            <button onClick={onClose} className="text-amber-200 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === tab.id
                    ? 'bg-white text-amber-500 shadow'
                    : 'text-amber-100 hover:text-white hover:bg-white/15'
                  } ${tab.id === 'danger' ? (activeTab === 'danger' ? 'text-red-400' : 'hover:text-red-200') : ''}`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{t(tab.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">

          {/* ── GENERAL ── */}
          {activeTab === 'general' && (
            <div className="space-y-5">

              {/* Profile Image Upload */}
              <Field label={t('shopLogoProfile')}>
                <div className="flex items-center gap-5">
                  {/* Avatar Preview */}
                  <div className="relative shrink-0">
                    <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                      {form.image ? (
                        <img src={form.image} alt="Shop" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-slate-600">
                          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-xs">Nessuna immagine</span>
                        </div>
                      )}
                    </div>
                    {form.image && (
                      <button
                        onClick={removeImage}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-100 hover:bg-red-600 text-gray-900 rounded-full flex items-center justify-center shadow transition-colors"
                        title={t('removeImage')}
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Upload controls */}
                  <div className="flex flex-col gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:border-amber-400 hover:text-amber-500 hover:bg-amber-50 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      {form.image ? t('changeImage') : t('uploadImage')}
                    </button>
                    <p className="text-xs text-slate-500">JPG, PNG, WEBP • Max consigliato: 2MB</p>
                  </div>
                </div>
              </Field>

              <Field label={t('shopName')}>
                <input className={inputCls} value={form.name} onChange={set('name')} placeholder="es. TechZone Electronics" />
              </Field>

              <Field label={t('businessType')}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SHOP_TYPES.map((st) => (
                    <button
                      key={st.value}
                      type="button"
                      onClick={() => { setForm((f) => ({ ...f, type: st.value })); setSaved(false); }}
                      className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${form.type === st.value
                          ? 'border-amber-500 bg-amber-500/10 text-amber-600 ring-1 ring-amber-400'
                          : 'border-gray-200 text-gray-600 hover:border-amber-400 hover:bg-amber-50'
                        }`}
                    >
                      {t(st.labelKey)}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Descrizione" hint="Una breve nota su ciò che il tuo negozio vende o offre.">
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={3}
                  value={form.description}
                  onChange={set('description')}
                  placeholder="es. Elettronica premium, gadget e accessori."
                />
              </Field>

              {/* ── Dati Aziendali ── */}
              <div className="border border-amber-200 bg-amber-50/30 rounded-2xl p-4 space-y-4">
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  {t('businessInfo')}
                </p>

                <Field label={t('ragioneSociale')} hint={t('ragioneSocialeHint')}>
                  <input className={inputCls} value={form.ragioneSociale} onChange={set('ragioneSociale')} placeholder="es. Kamil Store S.R.L." />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={t('partitaIva')}>
                    <input className={inputCls} value={form.partitaIva} onChange={set('partitaIva')} placeholder="es. IT12345678901" maxLength={16} />
                  </Field>
                  <Field label={t('codiceFiscale')}>
                    <input className={inputCls} value={form.codiceFiscale} onChange={set('codiceFiscale')} placeholder="es. RSSMRA85M01H501Z" maxLength={16} />
                  </Field>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={t('pecEmail')} hint={t('pecHint')}>
                    <input className={inputCls} type="email" value={form.pec} onChange={set('pec')} placeholder="es. negozio@pec.it" />
                  </Field>
                  <Field label={t('sdiCode')} hint={t('sdiHint')}>
                    <input className={inputCls} value={form.sdiCode} onChange={set('sdiCode')} placeholder="es. M5UXCR1" maxLength={7} style={{ textTransform: 'uppercase' }} />
                  </Field>
                </div>

                <Field label={t('reaNumber')} hint={t('reaHint')}>
                  <input className={inputCls} value={form.rea} onChange={set('rea')} placeholder="es. RM-1234567" />
                </Field>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 text-xs text-slate-500 space-y-1">
                <p><span className="font-semibold text-gray-600">ID Negozio:</span> {shop.id}</p>
                <p><span className="font-semibold text-gray-600">Creato il:</span> {new Date(shop.createdAt).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p><span className="font-semibold text-gray-600">Transazioni:</span> {shop.transactions?.length || 0} registrazioni</p>
              </div>
            </div>
          )}

          {/* ── CONTACT ── */}
          {activeTab === 'contact' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={t('phoneNumber')}>
                  <input className={inputCls} value={form.phone} onChange={set('phone')} placeholder="+39 555-0000" />
                </Field>
                <Field label={t('emailAddress')}>
                  <input className={inputCls} type="email" value={form.email} onChange={set('email')} placeholder="negozio@esempio.com" />
                </Field>
              </div>

              <Field label={t('streetAddress')}>
                <input className={inputCls} value={form.address} onChange={set('address')} placeholder="Via Roma 123" />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label={t('city')}>
                  <input className={inputCls} value={form.city} onChange={set('city')} placeholder="Roma" />
                </Field>
                <Field label={t('country')}>
                  <input className={inputCls} value={form.country} onChange={set('country')} placeholder="Italia" />
                </Field>
              </div>
            </div>
          )}

          {/* ── PREFERENCES ── */}
          {activeTab === 'preferences' && (
            <div className="space-y-5">
              <Field label={t('currency')} hint="Tutti gli importi nella dashboard verranno visualizzati in questa valuta.">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CURRENCIES.map((cur) => (
                    <button
                      key={cur.code}
                      type="button"
                      onClick={() => { setForm((f) => ({ ...f, currency: cur.code })); setSaved(false); }}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${form.currency === cur.code
                          ? 'border-amber-500 bg-amber-500/10 text-amber-600 ring-1 ring-amber-400'
                          : 'border-gray-200 text-gray-600 hover:border-amber-400 hover:bg-amber-50'
                        }`}
                    >
                      <span className="font-bold text-base w-6 text-center shrink-0">{cur.symbol}</span>
                      <span className="text-xs leading-tight">
                        <span className="block font-semibold">{cur.code}</span>
                        <span className="text-slate-500">{t(cur.labelKey)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label={t('taxRate')} hint="Utilizzata per calcolare l'IVA sulle transazioni (solo visualizzazione).">
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.taxRate}
                  onChange={set('taxRate')}
                  placeholder="es. 8"
                />
              </Field>

              {/* Live Preview */}
              <div className="bg-amber-500/10 border border-amber-200 rounded-2xl p-4">
                <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-3">{t('preview')}</p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('sampleAmount')}:</span>
                  <span className="font-bold text-gray-900">{currencyObj.symbol}1,500.00</span>
                </div>
                {form.taxRate && (
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-600">IVA ({form.taxRate}%):</span>
                    <span className="font-semibold text-gray-700">{currencyObj.symbol}{(1500 * Number(form.taxRate) / 100).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── BANK CARDS ── */}
          {activeTab === 'cards' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">{t('myBankCards')}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Aggiungi le tue carte bancarie per pagare rapidamente gli stipendi</p>
                </div>
                <button
                  onClick={() => { setAddCardOpen(true); setCardFormError(''); }}
                  className="flex items-center gap-1.5 px-3 py-2 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm" style={{ backgroundColor: '#f59e0b' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#d97706'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f59e0b'}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                  {t('addCard')}
                </button>
              </div>

              {/* Add Card Form */}
              {addCardOpen && (
                <div className="border border-amber-400/30 bg-amber-500/5 rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-bold text-amber-500 uppercase tracking-wide">{t('newBankCard')}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">{t('bankName')} *</label>
                      <input className={inputCls} value={cardForm.bankName} onChange={(e) => setCardForm((f) => ({ ...f, bankName: e.target.value }))} placeholder="es. HBL, Meezan" autoFocus />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">{t('cardType')}</label>
                      <select className={inputCls} value={cardForm.cardType} onChange={(e) => setCardForm((f) => ({ ...f, cardType: e.target.value }))}>
                        <option value="debit">{t('debitCard')}</option>
                        <option value="credit">{t('creditCard')}</option>
                        <option value="account">{t('bankAccount')}</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{t('cardHolderName')} *</label>
                    <input className={inputCls} value={cardForm.cardHolder} onChange={(e) => setCardForm((f) => ({ ...f, cardHolder: e.target.value }))} placeholder="es. Kamil Ehsan" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">{t('cardAccountNumber')}</label>
                      <input className={inputCls} value={cardForm.last4} maxLength={4} onChange={(e) => setCardForm((f) => ({ ...f, last4: e.target.value.replace(/\D/g, '') }))} placeholder="4242" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">{t('accountNo')}</label>
                      <input className={inputCls} value={cardForm.accountNo} onChange={(e) => setCardForm((f) => ({ ...f, accountNo: e.target.value }))} placeholder="Opzionale" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{t('ibanOptional')}</label>
                    <input className={inputCls} value={cardForm.iban} onChange={(e) => setCardForm((f) => ({ ...f, iban: e.target.value }))} placeholder="es. PK36SCBL0000001123456702" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{t('cardColor')}</label>
                    <div className="flex gap-2">
                      {CARD_COLORS.map((cc) => (
                        <button key={cc.id} type="button" onClick={() => setCardForm((f) => ({ ...f, color: cc.id }))}
                          className={`w-8 h-8 rounded-lg bg-linear-to-br ${cc.from} ${cc.to} transition-all ${cardForm.color === cc.id ? 'ring-2 ring-offset-2 ring-amber-500 scale-110' : 'opacity-60 hover:opacity-100'}`}
                          title={t(cc.labelKey)}
                        />
                      ))}
                    </div>
                  </div>
                  {cardFormError && <p className="text-xs text-red-500">{cardFormError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => { setAddCardOpen(false); setCardFormError(''); }} className="flex-1 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors">{t('cancel')}</button>
                    <button onClick={handleAddCard} className="flex-1 px-3 py-2 text-white text-sm font-semibold rounded-xl transition-colors" style={{ backgroundColor: '#f59e0b' }}>{t('saveCard')}</button>
                  </div>
                </div>
              )}

              {/* Cards List */}
              {bankCards.length === 0 && !addCardOpen ? (
                <div className="py-10 text-center border-2 border-dashed border-gray-200 rounded-2xl">
                  <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">{t('noBankCardsYet')}</p>
                  <p className="text-xs text-slate-600 mt-1">Clicca "Aggiungi Carta" per aggiungere la tua prima carta</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bankCards.map((card) => {
                    const cc = CARD_COLORS.find((c) => c.id === card.color) || CARD_COLORS[0];
                    const isEditing = editCardId === card.id;
                    return (
                      <div key={card.id} className="border border-gray-200 rounded-2xl overflow-hidden">
                        {/* Visual Card */}
                        <div className={`bg-linear-to-br ${cc.from} ${cc.to} p-4 relative`}>
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-gray-900/70 text-xs font-medium uppercase tracking-wider">{card.cardType}</p>
                              <p className="text-gray-900 font-bold text-base mt-0.5">{card.bankName}</p>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => { setEditCardId(card.id); setEditCardForm({ bankName: card.bankName, cardHolder: card.cardHolder, last4: card.last4, accountNo: card.accountNo || '', iban: card.iban || '', cardType: card.cardType, color: card.color }); }} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/30 flex items-center justify-center transition-colors">
                                <svg className="w-3.5 h-3.5 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button onClick={() => setDeleteCardId(card.id)} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-red-400/60 flex items-center justify-center transition-colors">
                                <svg className="w-3.5 h-3.5 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </div>
                          <div className="mt-4">
                            <p className="text-gray-900 font-mono text-sm tracking-widest">•••• •••• •••• {card.last4 || '????'}</p>
                          </div>
                          <div className="flex items-end justify-between mt-3">
                            <div>
                              <p className="text-gray-900/60 text-xs">Intestatario</p>
                              <p className="text-gray-900 text-sm font-semibold">{card.cardHolder}</p>
                            </div>
                          </div>
                        </div>
                        {/* Edit Form */}
                        {isEditing && (
                          <div className="p-4 space-y-3 bg-gray-50">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">{t('bankName')}</label>
                                <input className={inputCls} value={editCardForm.bankName} onChange={(e) => setEditCardForm((f) => ({ ...f, bankName: e.target.value }))} />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">{t('cardType')}</label>
                                <select className={inputCls} value={editCardForm.cardType} onChange={(e) => setEditCardForm((f) => ({ ...f, cardType: e.target.value }))}>
                                  <option value="debit">{t('debitCard')}</option>
                                  <option value="credit">{t('creditCard')}</option>
                                  <option value="account">{t('bankAccount')}</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">{t('cardHolderName')}</label>
                              <input className={inputCls} value={editCardForm.cardHolder} onChange={(e) => setEditCardForm((f) => ({ ...f, cardHolder: e.target.value }))} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">{t('cardAccountNumber')}</label>
                                <input className={inputCls} value={editCardForm.last4} maxLength={4} onChange={(e) => setEditCardForm((f) => ({ ...f, last4: e.target.value.replace(/\D/g, '') }))} />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">{t('accountNo')}</label>
                                <input className={inputCls} value={editCardForm.accountNo} onChange={(e) => setEditCardForm((f) => ({ ...f, accountNo: e.target.value }))} />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">{t('ibanOptional')}</label>
                              <input className={inputCls} value={editCardForm.iban} onChange={(e) => setEditCardForm((f) => ({ ...f, iban: e.target.value }))} />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">{t('cardColor')}</label>
                              <div className="flex gap-2">
                                {CARD_COLORS.map((cc2) => (
                                  <button key={cc2.id} type="button" onClick={() => setEditCardForm((f) => ({ ...f, color: cc2.id }))}
                                    className={`w-8 h-8 rounded-lg bg-linear-to-br ${cc2.from} ${cc2.to} transition-all ${editCardForm.color === cc2.id ? 'ring-2 ring-offset-2 ring-amber-500 scale-110' : 'opacity-60 hover:opacity-100'}`}
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => setEditCardId(null)} className="flex-1 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-white transition-colors">{t('cancel')}</button>
                              <button onClick={() => handleEditCardSave(card.id)} className="flex-1 px-3 py-2 text-white text-sm font-semibold rounded-xl transition-colors" style={{ backgroundColor: '#f59e0b' }}>{t('saveSettings')}</button>
                            </div>
                          </div>
                        )}
                        {/* Extra info */}
                        {!isEditing && (card.accountNo || card.iban) && (
                          <div className="px-4 py-3 space-y-1.5">
                            {card.accountNo && <div className="flex justify-between text-xs"><span className="text-slate-500">{t('accountNo')}</span><span className="font-mono font-semibold text-gray-700">{card.accountNo}</span></div>}
                            {card.iban && <div className="flex justify-between text-xs"><span className="text-slate-500">{t('iban')}</span><span className="font-mono font-semibold text-gray-700 truncate ml-4">{card.iban}</span></div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Delete Confirm */}
              {deleteCardId && (
                <div className="fixed inset-0 bg-black/50 z-70 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-xs w-full text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </div>
                    <h3 className="text-base font-bold text-gray-900 mb-1">{t('removeCard')}</h3>
                    <p className="text-xs text-slate-500 mb-4">{t('removeCardWarning')}</p>
                    <div className="flex gap-2">
                      <button onClick={() => setDeleteCardId(null)} className="flex-1 px-3 py-2 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 text-sm">{t('cancel')}</button>
                      <button onClick={() => { deleteBankCard(shop.id, deleteCardId); setDeleteCardId(null); }} className="flex-1 px-3 py-2 bg-red-100 hover:bg-red-600 text-gray-900 font-semibold rounded-xl text-sm">{t('deleteForever')}</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── EMAIL NOTIFICATIONS ── */}
          {activeTab === 'email' && (
            <div className="space-y-5">


              {/* Enable toggle */}
              <div className="flex items-center justify-between bg-white border border-gray-200 rounded-2xl px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{t('enableEmailNotifications')}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Auto-send emails when repairs ready, advances cleared, items sold</p>
                </div>
                <button
                  onClick={() => setEmailSettings(s => ({ ...s, enabled: !s.enabled }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${emailSettings.enabled ? 'bg-amber-500' : 'bg-gray-200'
                    }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${emailSettings.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                </button>
              </div>

              {/* Owner email */}
              <Field label="Your Email (receive copies of sent notifications)">
                <input type="email" className={inputCls} placeholder="yourshop@gmail.com"
                  value={emailSettings.ownerEmail || ''}
                  onChange={e => setEmailSettings(s => ({ ...s, ownerEmail: e.target.value }))} />
              </Field>

              {/* Email Logo */}
              <div className="border border-gray-100 rounded-2xl p-4 space-y-3 bg-gray-50/40">
                <p className="text-sm font-bold text-gray-700">Shop Logo in Email</p>
                <Field label="Logo URL" hint="Paste a public image link (from imgbb.com, imgur, etc.)">
                  <input className={inputCls} placeholder="https://i.ibb.co/..."
                    value={emailSettings.shopLogoUrl || ''}
                    onChange={e => setEmailSettings(s => ({ ...s, shopLogoUrl: e.target.value }))} />
                </Field>
                {emailSettings.shopLogoUrl && (
                  <img src={emailSettings.shopLogoUrl} alt="logo preview" className="h-16 rounded-xl object-contain border border-gray-200" />
                )}
              </div>

              {/* Brevo */}
              <div className="border border-emerald-100 rounded-2xl p-4 space-y-3 bg-emerald-50/40">
                <div>
                  <p className="text-sm font-bold text-emerald-800">✉️ Brevo (Recommended)</p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    Free 300 emails/day. No branding footer. EmailJS ki zarurat nahi.
                  </p>
                </div>
                <Field label="Brevo API Key" hint="brevo.com → Settings → SMTP & API → API Keys">
                  <input className={inputCls} placeholder="xkeysib-xxxxxxxxxxxxxxxx"
                    value={emailSettings.brevoApiKey || ''}
                    onChange={e => setEmailSettings(s => ({ ...s, brevoApiKey: e.target.value }))} />
                </Field>
                <Field label="Brevo Sender Email" hint="Must be verified in your Brevo account">
                  <input type="email" className={inputCls} placeholder="yourshop@gmail.com"
                    value={emailSettings.brevoSenderEmail || ''}
                    onChange={e => setEmailSettings(s => ({ ...s, brevoSenderEmail: e.target.value }))} />
                </Field>
                {emailSettings.brevoApiKey
                  ? <p className="text-xs font-semibold text-emerald-600">✓ Brevo active — emails will use Brevo</p>
                  : <p className="text-xs text-gray-400">Brevo key add karo to EmailJS ki zarurat nahi hogi.</p>
                }
              </div>

              {/* Save */}
              <button onClick={handleSaveEmailSettings}
                className="w-full py-2.5 text-white font-semibold rounded-xl text-sm transition-colors" style={{ backgroundColor: '#f59e0b' }}>
                {emailSaved ? '✓ ' + t('emailSettingsSaved') : t('saveSettings')}
              </button>

              {/* Test email */}
              <div className="border-t border-gray-100 pt-4 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Send a test email</p>
                <div className="flex gap-2">
                  <input type="email" className={inputCls + ' flex-1'} placeholder="yourtest@email.com"
                    value={testEmailAddr} onChange={e => setTestEmailAddr(e.target.value)} />
                  <button onClick={handleTestEmail}
                    className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl text-sm transition-colors">
                    {t('testEmail')}
                  </button>
                </div>
                {emailTestResult && (
                  <p className={`text-xs font-semibold px-3 py-2 rounded-xl ${emailTestResult === 'ok' ? 'bg-emerald-50 text-emerald-600'
                      : emailTestResult === 'sending...' ? 'bg-blue-50 text-blue-600'
                        : 'bg-red-50 text-red-500'
                    }`}>
                    {emailTestResult === 'ok' ? '✓ ' + t('testEmailSent') : emailTestResult === 'sending...' ? '⏳ Sending...' : '✗ ' + emailTestResult}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── ACCOUNT / SECURITY ── */}
          {activeTab === 'account' && (
            <div className="space-y-5">
              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                <div className="bg-amber-50 px-5 py-3 border-b border-amber-100">
                  <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    {t('pw_changeTitle')}
                  </h3>
                  <p className="text-xs text-amber-600 mt-0.5">{user?.email}</p>
                </div>
                <div className="p-5 space-y-4">
                  {isGoogleUser ? (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100">
                      <svg className="w-5 h-5 text-blue-500 shrink-0" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      <p className="text-sm text-blue-700">{t('pw_googleAccount')}</p>
                    </div>
                  ) : (
                    <>
                      {pwError && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 font-medium">{pwError}</div>
                      )}
                      {pwSuccess && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-sm text-emerald-600 font-medium flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          {t('pw_changed')}
                        </div>
                      )}
                      <Field label={t('pw_current')}>
                        <input
                          type="password"
                          value={pwForm.current}
                          onChange={(e) => { setPwForm(f => ({ ...f, current: e.target.value })); setPwError(''); }}
                          className={inputCls}
                          placeholder="••••••••"
                        />
                      </Field>
                      <Field label={t('pw_new')}>
                        <input
                          type="password"
                          value={pwForm.newPw}
                          onChange={(e) => { setPwForm(f => ({ ...f, newPw: e.target.value })); setPwError(''); }}
                          className={inputCls}
                          placeholder="••••••••"
                        />
                        <p className="text-xs text-slate-400 mt-1">{t('pw_minChars')}</p>
                      </Field>
                      <Field label={t('pw_confirm')}>
                        <input
                          type="password"
                          value={pwForm.confirm}
                          onChange={(e) => { setPwForm(f => ({ ...f, confirm: e.target.value })); setPwError(''); }}
                          className={inputCls}
                          placeholder="••••••••"
                        />
                      </Field>
                      <button
                        onClick={handleChangePassword}
                        disabled={pwLoading}
                        className="w-full py-2.5 text-white font-semibold rounded-xl transition-all text-sm disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                      >
                        {pwLoading ? t('login_loading') : t('pw_changeBtn')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── DANGER ZONE ── */}
          {activeTab === 'danger' && (
            <div className="space-y-4">
              <div className="border border-red-200 rounded-2xl overflow-hidden">
                <div className="bg-red-500/10 px-5 py-3 border-b border-red-100">
                  <h3 className="text-sm font-bold text-red-700">{t('tab_dangerZone')}</h3>
                  <p className="text-xs text-red-400 mt-0.5">Queste azioni sono irreversibili. Fai attenzione.</p>
                </div>
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{t('deleteThisShop')}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Rimuove permanentemente <span className="font-semibold">{shop.name}</span> e tutte le {shop.transactions?.length || 0} registrazioni di transazioni.
                        {!canDelete && <span className="block text-amber-500 mt-1">Devi avere almeno un negozio. Aggiungi prima un altro negozio.</span>}
                      </p>
                    </div>
                    <button
                      disabled={!canDelete}
                      onClick={() => setConfirmDelete(true)}
                      className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${canDelete
                          ? 'border-red-300 text-red-600 hover:bg-red-100 hover:text-gray-900 hover:border-red-500'
                          : 'border-gray-200 text-slate-600 cursor-not-allowed'
                        }`}
                    >
                      {t('deleteThisShop')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab !== 'danger' && activeTab !== 'cards' && activeTab !== 'email' && activeTab !== 'account' && (
          <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between gap-3 shrink-0">
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-semibold">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {t('savedBang')}
              </span>
            )}
            {!saved && <span />}
            <div className="flex gap-3">
              <button onClick={onClose} className="px-5 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm">
                {t('cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name.trim()}
                className="px-5 py-2.5 disabled:opacity-40 text-white font-semibold rounded-xl transition-colors shadow-sm text-sm" style={{ backgroundColor: '#f59e0b' }}
              >
                {t('saveSettings')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirm Overlay */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Eliminare "{shop.name}"?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              Questa azione eliminerà permanentemente il negozio e tutte le <strong>{shop.transactions?.length || 0}</strong> transazioni. Questa azione non può essere annullata.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors">
                {t('cancel')}
              </button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2.5 bg-red-100 hover:bg-red-600 text-gray-900 font-semibold rounded-xl transition-colors">
                {t('deleteForever')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
