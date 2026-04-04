import { useState } from 'react';
import { SHOP_TYPES } from '../data/initialData';
import { useShop } from '../context/ShopContext';
import { useLanguage } from '../context/LanguageContext';

const ALL_SERVICES = [
  { id: 'inventory',   labelKey: 'tab_inventory',   descKey: 'svcInventoryDesc',        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg> },
  { id: 'repairs',     labelKey: 'tab_repairs',     descKey: 'svcRepairsDesc',         icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
  { id: 'advances',    labelKey: 'tab_advances',    descKey: 'svcAdvancesDesc',  icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
  { id: 'reports',     labelKey: 'tab_reports',     descKey: 'svcReportsDesc',     icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
  { id: 'team',        labelKey: 'tab_team',        descKey: 'svcTeamDesc',    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
  { id: 'secondhand',  labelKey: 'tab_secondhand',  descKey: 'svcSecondhandDesc',      icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> },
  { id: 'notes',       labelKey: 'tab_notes',       descKey: 'svcNotesDesc',           icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
];

export default function AddShopModal({ onClose }) {
  const { addShop } = useShop();
  const { t } = useLanguage();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [services, setServices] = useState(ALL_SERVICES.map((s) => s.id));
  const [error, setError] = useState('');

  const toggleService = (id) => {
    setServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleStep1 = (e) => {
    e.preventDefault();
    if (!name.trim()) { setError(t('enterShopName')); return; }
    if (!type) { setError(t('selectShopType')); return; }
    setError('');
    setStep(2);
  };

  const handleSubmit = () => {
    if (services.length === 0) { setError(t('selectAtLeastOneService')); return; }
    addShop({ name: name.trim(), type, services });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-6 rounded-t-2xl" style={{ background: 'linear-gradient(135deg, #582f0e, #7f4f24)' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{t('addNewShop')}</h2>
              <p className="text-indigo-100 text-sm mt-0.5">
                {step === 1 ? t('setupNewBusiness') : `${t('selectServices')} — "${name}"`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-indigo-200 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/20"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Step indicator */}
          <div className="flex gap-1.5 mt-4">
            <div className="h-1 flex-1 rounded-full bg-white/80" />
            <div className={`h-1 flex-1 rounded-full transition-all ${step === 2 ? 'bg-white/80' : 'bg-white/30'}`} />
          </div>
        </div>

        {/* Step 1: Name + Type */}
        {step === 1 && (
          <form onSubmit={handleStep1} className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-500 mb-1.5">{t('shopName')}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                placeholder="es. TechZone Elettronica, King's Cuts..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all placeholder-gray-400"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-500 mb-2">{t('businessType')}</label>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {SHOP_TYPES.map((st) => (
                  <button
                    key={st.value}
                    type="button"
                    onClick={() => { setType(st.value); setError(''); }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${
                      type === st.value
                        ? 'border-amber-500 bg-amber-500/10 text-amber-600 ring-1 ring-amber-400'
                        : 'border-gray-200 text-gray-600 hover:border-amber-400 hover:bg-amber-50'
                    }`}
                  >
                    <span className="truncate">{t(st.labelKey)}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors">{t('cancel')}</button>
              <button type="submit" className="flex-1 px-4 py-2.5 hover:opacity-90 text-white font-semibold rounded-xl transition-colors shadow-sm" style={{ backgroundColor: '#f59e0b' }}>{t('next')}</button>
            </div>
          </form>
        )}

        {/* Step 2: Services */}
        {step === 2 && (
          <div className="p-6 space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-500 mb-1">{t('selectServices')}</p>
              <p className="text-xs text-gray-400 mb-3">{t('onlySelectedTabs')}</p>
              <div className="grid grid-cols-2 gap-2">
                {ALL_SERVICES.map((s) => {
                  const on = services.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { toggleService(s.id); setError(''); }}
                      className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                        on
                          ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-400'
                          : 'border-gray-200 hover:border-amber-400 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`shrink-0 mt-0.5 ${on ? 'text-amber-500' : 'text-gray-400'}`}>{s.icon}</div>
                      <div>
                        <p className={`text-sm font-semibold ${on ? 'text-amber-600' : 'text-gray-700'}`}>{t(s.labelKey)}</p>
                        <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{t(s.descKey)}</p>
                      </div>
                      <div className={`ml-auto shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                        on ? 'border-amber-500 bg-amber-500' : 'border-gray-200 bg-white'
                      }`}>
                        {on && <svg className="w-2.5 h-2.5 text-gray-900" viewBox="0 0 10 10" fill="currentColor"><path d="M8.5 2.5L4 7.5 1.5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setStep(1)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors">{t('back')}</button>
              <button type="button" onClick={handleSubmit} className="flex-1 px-4 py-2.5 hover:opacity-90 text-white font-semibold rounded-xl transition-colors shadow-sm" style={{ backgroundColor: '#f59e0b' }}>{t('createShop')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
