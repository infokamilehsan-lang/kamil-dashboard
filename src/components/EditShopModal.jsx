import { useState } from 'react';
import { SHOP_TYPES } from '../data/initialData';
import { useShop } from '../context/ShopContext';
import { useLanguage } from '../context/LanguageContext';

export default function EditShopModal({ shop, onClose }) {
  const { updateShop } = useShop();
  const { t } = useLanguage();
  const [name, setName] = useState(shop.name);
  const [type, setType] = useState(shop.type);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) { setError(t('shopNameRequired')); return; }
    if (!type) { setError(t('selectBusinessType')); return; }
    updateShop(shop.id, { name: name.trim(), type });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-linear-to-r from-cyan-500 to-purple-600 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{t('editShop')}</h2>
              <p className="text-indigo-100 text-sm mt-0.5">{t('updateShopDetails')}</p>
            </div>
            <button
              onClick={onClose}
              className="text-indigo-200 hover:text-gray-900 transition-colors p-1 rounded-lg hover:bg-indigo-400/30"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Shop Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-1.5">{t('shopName')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="es. TechZone Electronics..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent transition-all placeholder-slate-600"
              autoFocus
            />
          </div>

          {/* Shop Type */}
          <div>
            <label className="block text-sm font-semibold text-slate-200 mb-2">{t('businessType')}</label>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
              {SHOP_TYPES.map((st) => (
                <button
                  key={st.value}
                  type="button"
                  onClick={() => { setType(st.value); setError(''); }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${
                    type === st.value
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400'
                      : 'border-gray-200 text-gray-600 hover:border-cyan-400 hover:bg-cyan-100/10/50'
                  }`}
                >
                  <span className="truncate">{t(st.labelKey)}</span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-slate-200 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-cyan-100 hover:bg-cyan-600 text-white font-semibold rounded-xl transition-colors shadow-sm"
            >
              {t('saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
