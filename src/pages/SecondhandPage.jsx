import { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { useLanguage } from '../context/LanguageContext';
import { useFmt } from '../lib/useFmt';
import { sendClientEmail } from '../lib/emailService';

export default function SecondhandPage() {
  const { activeShop, addSecondhand, updateSecondhand, deleteSecondhand, addOrUpdateContact, emailSettings } = useShop();
  const { t, lang } = useLanguage();
  const { fmt } = useFmt();

  const [shFilter, setShFilter] = useState('all');
  const [shSearch, setShSearch] = useState('');
  const [shConditionFilter, setShConditionFilter] = useState('all');
  const [shDocumentFilter, setShDocumentFilter] = useState('all');
  const [shSort, setShSort] = useState('newest');
  const [addShOpen, setAddShOpen] = useState(false);
  const emptyShForm = { itemName: '', brand: '', model: '', imei: '', condition: 'Buono', buyPrice: '', sellPrice: '', sellerName: '', sellerPhone: '', sellerEmail: '', sellerAddress: '', sellerFiscalCode: '', documentType: 'Carta d’identità', documentNumber: '', documentExpiry: '', documentFront: '', documentBack: '', productImages: [], notes: '' };
  const [shForm, setShForm] = useState(emptyShForm);
  const [shFormError, setShFormError] = useState('');
  const [shDeleteId, setShDeleteId] = useState(null);
  const [shSellOpen, setShSellOpen] = useState(null);
  const [shSellForm, setShSellForm] = useState({ sellPrice: '', buyerName: '', buyerPhone: '', buyerEmail: '' });
  const [shEditId, setShEditId] = useState(null);
  const [shEditForm, setShEditForm] = useState({});
  const [shViewItem, setShViewItem] = useState(null);
  const [shPreviewFile, setShPreviewFile] = useState(null);
  const normalizeDateInput = (value) => value ? String(value).slice(0, 10) : '';
  const formatDocumentDate = (value) => {
    if (!value) return '—';
    const date = new Date(`${normalizeDateInput(value)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const updateExpiryPart = (part, value) => {
    const current = normalizeDateInput(shForm.documentExpiry);
    const [savedYear = '', savedMonth = '', savedDay = ''] = current.split('-');
    let year = part === 'year' ? value : savedYear;
    let month = part === 'month' ? value : savedMonth;
    let day = part === 'day' ? value : savedDay;
    if (!year || !month || !day) {
      setShForm((form) => ({ ...form, documentExpiry: [year, month, day].join('-') }));
      return;
    }
    const maxDay = new Date(Number(year), Number(month), 0).getDate();
    if (Number(day) > maxDay) day = String(maxDay).padStart(2, '0');
    setShForm((form) => ({ ...form, documentExpiry: `${year}-${month}-${day}` }));
  };
  const readFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      if (!file.type.startsWith('image/')) {
        resolve({ name: file.name, type: file.type, data: reader.result });
        return;
      }
      const image = new Image();
      image.onerror = () => resolve({ name: file.name, type: file.type, data: reader.result });
      image.onload = () => {
        const maxSide = 1400;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve({ name: file.name.replace(/\.[^.]+$/, '.jpg'), type: 'image/jpeg', data: canvas.toDataURL('image/jpeg', 0.76) });
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
  const setDocumentFile = async (key, file) => {
    if (!file) return;
    const saved = await readFile(file);
    setShForm((form) => ({ ...form, [key]: saved }));
  };
  const addProductImages = async (files) => {
    const images = await Promise.all([...files].filter((file) => file.type.startsWith('image/')).slice(0, 6).map(readFile));
    setShForm((form) => ({ ...form, productImages: [...form.productImages, ...images].slice(0, 6) }));
  };

        const items = activeShop.secondhand || [];
        const filtered = items.filter((item) => {
          const query = shSearch.trim().toLowerCase();
          const searchable = [item.itemName, item.brand, item.model, item.imei, item.condition, item.sellerName, item.sellerPhone, item.sellerEmail, item.sellerFiscalCode, item.documentNumber, item.buyerName, item.buyerPhone, item.notes].filter(Boolean).join(' ').toLowerCase();
          const matchesSearch = !query || searchable.includes(query);
          const matchesStatus = shFilter === 'all' || (shFilter === 'in_stock' ? item.status !== 'sold' : item.status === 'sold');
          const matchesCondition = shConditionFilter === 'all' || item.condition === shConditionFilter;
          const expiry = normalizeDateInput(item.documentExpiry);
          const today = new Date().toISOString().slice(0, 10);
          const soon = new Date(); soon.setDate(soon.getDate() + 30);
          const soonKey = soon.toISOString().slice(0, 10);
          const documentStatus = !expiry ? 'missing' : expiry < today ? 'expired' : expiry <= soonKey ? 'expiring' : 'valid';
          const matchesDocument = shDocumentFilter === 'all' || documentStatus === shDocumentFilter;
          return matchesSearch && matchesStatus && matchesCondition && matchesDocument;
        }).sort((a, b) => {
          if (shSort === 'oldest') return String(a.buyDate || '').localeCompare(String(b.buyDate || ''));
          if (shSort === 'buy_high') return (Number(b.buyPrice) || 0) - (Number(a.buyPrice) || 0);
          if (shSort === 'sell_high') return (Number(b.sellPrice) || 0) - (Number(a.sellPrice) || 0);
          if (shSort === 'profit_high') return ((Number(b.sellPrice) || 0) - (Number(b.buyPrice) || 0)) - ((Number(a.sellPrice) || 0) - (Number(a.buyPrice) || 0));
          return String(b.buyDate || '').localeCompare(String(a.buyDate || ''));
        });
        const shFiltersActive = Boolean(shSearch) || shFilter !== 'all' || shConditionFilter !== 'all' || shDocumentFilter !== 'all' || shSort !== 'newest';
        const clearShFilters = () => { setShSearch(''); setShFilter('all'); setShConditionFilter('all'); setShDocumentFilter('all'); setShSort('newest'); };
        const totalInvested = items.filter(i => i.status !== 'sold').reduce((s, i) => s + (i.buyPrice || 0), 0);
        const totalProfit = items.filter(i => i.status === 'sold').reduce((s, i) => s + ((i.sellPrice || 0) - (i.buyPrice || 0)), 0);
        const soldCount = items.filter(i => i.status === 'sold').length;
        const inStockCount = items.filter(i => i.status !== 'sold').length;
        const CONDITIONS = ['Eccellente', 'Buono', 'Discreto', 'Scarso'];
        const conditionColor = { Eccellente: 'bg-emerald-100 text-emerald-700', Buono: 'bg-blue-100 text-blue-700', Discreto: 'bg-amber-100 text-amber-700', Scarso: 'bg-red-100 text-red-700' };
        const conditionLabel = { Eccellente: t('condition_Excellent'), Buono: t('condition_Good'), Discreto: t('condition_Fair'), Scarso: t('condition_Poor') };

        const handleAddSh = () => {
          if (!shForm.itemName.trim()) { setShFormError(t('itemNameIsRequired')); return; }
          if (!shForm.buyPrice) { setShFormError(t('buyPriceIsRequired')); return; }
          const itemData = {
            itemName: shForm.itemName.trim(), brand: shForm.brand.trim(), model: shForm.model.trim(),
            imei: shForm.imei.trim(), condition: shForm.condition,
            buyPrice: Number(shForm.buyPrice),
            sellPrice: shForm.sellPrice === '' ? 0 : Number(shForm.sellPrice),
            sellerName: shForm.sellerName.trim(), sellerPhone: shForm.sellerPhone.trim(),
            sellerEmail: shForm.sellerEmail.trim(),
            sellerAddress: shForm.sellerAddress.trim(), sellerFiscalCode: shForm.sellerFiscalCode.trim(),
            documentType: shForm.documentType, documentNumber: shForm.documentNumber.trim(), documentExpiry: shForm.documentExpiry,
            documentFront: shForm.documentFront, documentBack: shForm.documentBack, productImages: shForm.productImages,
            notes: shForm.notes.trim(),
          };
          if (shEditId) updateSecondhand(activeShop.id, shEditId, itemData);
          else addSecondhand(activeShop.id, { ...itemData, status: 'in_stock', buyDate: new Date().toISOString().split('T')[0] });
          if (shForm.sellerEmail.trim()) {
            addOrUpdateContact({
              name: shForm.sellerName.trim() || 'Seller',
              email: shForm.sellerEmail.trim(),
              phone: shForm.sellerPhone.trim(),
            });
          }
          setShForm(emptyShForm);
          setShEditId(null);
          setAddShOpen(false); setShFormError('');
        };

        const handleSell = (item) => {
          if (!shSellForm.sellPrice) return;
          const profit = Number(shSellForm.sellPrice) - (item.buyPrice || 0);
          updateSecondhand(activeShop.id, item.id, {
            status: 'sold', sellPrice: Number(shSellForm.sellPrice),
            buyerName: shSellForm.buyerName.trim(), buyerPhone: shSellForm.buyerPhone.trim(),
            buyerEmail: shSellForm.buyerEmail.trim(),
            sellDate: new Date().toISOString().split('T')[0],
            profit,
          });
          if (shSellForm.buyerEmail.trim()) {
            addOrUpdateContact({
              name: shSellForm.buyerName.trim() || 'Customer',
              email: shSellForm.buyerEmail.trim(),
              phone: shSellForm.buyerPhone.trim(),
            });
            sendClientEmail({
              to: shSellForm.buyerEmail.trim(),
              toName: shSellForm.buyerName || 'Customer',
              subject: `Purchase Receipt – ${activeShop.name}`,
              message: `Dear ${shSellForm.buyerName || 'Customer'},\n\nThank you for your purchase!\nItem: ${item.itemName}${item.brand ? ' (' + item.brand + ')' : ''}\nSale Price: ${shSellForm.sellPrice}\nDate: ${new Date().toLocaleDateString()}\n\nThank you!\n${activeShop.name}`,
              shopName: activeShop.name,
              emailCfg: emailSettings,
            });
          }
          setShSellOpen(null); setShSellForm({ sellPrice: '', buyerName: '', buyerPhone: '', buyerEmail: '' });
        };

        return (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="section-summary rounded-3xl border border-black/10 bg-white p-4 sm:p-5 shadow-sm">
              <div className="mb-4"><p className="text-[10px] uppercase tracking-[.18em] font-black text-gray-400">{lang === 'it' ? 'Panoramica usato' : 'Secondhand overview'}</p><h2 className="text-xl font-black mt-1">{lang === 'it' ? 'Controllo stock e profitto' : 'Stock & profit control'}</h2></div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: t('inStock'), value: inStockCount, color: 'bg-[#c6ff34] border border-black/10' },
                { label: t('totalSold'), value: soldCount, color: 'bg-[#f1fec8] border border-black/10' },
                { label: t('investedStock'), value: fmt(totalInvested), color: 'bg-white border border-black/10' },
                { label: t('totalProfit'), value: fmt(totalProfit), color: 'bg-[#c6ff34] text-[#101408] border border-black/10' },
              ].map(c => (
                <div key={c.label} className={`rounded-2xl p-4 ${c.color} flex flex-col gap-1`}>
                  <p className="text-2xl font-black">{c.value}</p>
                  <p className="text-[10px] uppercase tracking-wide font-black opacity-60">{c.label}</p>
                </div>
              ))}
              </div>
            </div>

            {/* Toolbar */}
            <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="relative flex-1">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                  <input type="search" value={shSearch} onChange={(event) => setShSearch(event.target.value)} placeholder={lang === 'it' ? 'Cerca prodotto, marca, modello, IMEI, venditore o documento…' : 'Search product, brand, model, IMEI, seller or document…'} className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 pl-12 pr-4 text-sm font-semibold outline-none focus:border-lime-400 focus:bg-white focus:ring-4 focus:ring-lime-100" />
                </div>
                <button onClick={() => setAddShOpen(true)} className="flex h-12 items-center justify-center gap-2 px-5 text-black font-black rounded-xl transition-transform hover:-translate-y-0.5 text-sm shadow-sm" style={{ backgroundColor: '#c6ff34' }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  {t('buyItem')}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                <select value={shFilter} onChange={(event) => setShFilter(event.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-lime-400">
                  <option value="all">{lang === 'it' ? 'Tutti gli articoli' : 'All items'}</option>
                  <option value="in_stock">{t('inStock')}</option>
                  <option value="sold">{t('sold')}</option>
                </select>
                <select value={shConditionFilter} onChange={(event) => setShConditionFilter(event.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-lime-400">
                  <option value="all">{lang === 'it' ? 'Tutte le condizioni' : 'All conditions'}</option>
                  {CONDITIONS.map((condition) => <option key={condition} value={condition}>{conditionLabel[condition] || condition}</option>)}
                </select>
                <select value={shDocumentFilter} onChange={(event) => setShDocumentFilter(event.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-lime-400">
                  <option value="all">{lang === 'it' ? 'Tutti i documenti' : 'All documents'}</option>
                  <option value="valid">{lang === 'it' ? 'Documento valido' : 'Valid document'}</option>
                  <option value="expiring">{lang === 'it' ? 'Scade entro 30 giorni' : 'Expires within 30 days'}</option>
                  <option value="expired">{lang === 'it' ? 'Documento scaduto' : 'Expired document'}</option>
                  <option value="missing">{lang === 'it' ? 'Scadenza mancante' : 'Missing expiry date'}</option>
                </select>
                <select value={shSort} onChange={(event) => setShSort(event.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-lime-400">
                  <option value="newest">{lang === 'it' ? 'Più recenti' : 'Newest first'}</option>
                  <option value="oldest">{lang === 'it' ? 'Più vecchi' : 'Oldest first'}</option>
                  <option value="buy_high">{lang === 'it' ? 'Costo: alto → basso' : 'Buy price: high → low'}</option>
                  <option value="sell_high">{lang === 'it' ? 'Vendita: alto → basso' : 'Sale price: high → low'}</option>
                  <option value="profit_high">{lang === 'it' ? 'Profitto: alto → basso' : 'Profit: high → low'}</option>
                </select>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
                <span className="text-xs font-bold text-gray-500"><strong className="text-gray-900">{filtered.length}</strong> {lang === 'it' ? `di ${items.length} articoli` : `of ${items.length} items`}</span>
                {shFiltersActive && <button type="button" onClick={clearShFilters} className="rounded-xl border border-black/10 px-4 py-2 text-xs font-black hover:bg-gray-50">{lang === 'it' ? 'Azzera tutti i filtri' : 'Clear all filters'}</button>}
              </div>
            </div>

            {/* Items list */}
            {filtered.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                <p className="font-semibold">{t('noItemsFound')}</p>
                <p className="text-sm mt-1">{shFiltersActive ? (lang === 'it' ? 'Prova a cambiare ricerca o filtri.' : 'Try changing the search or filters.') : t('clickBuyItemHint')}</p>
                {shFiltersActive && <button type="button" onClick={clearShFilters} className="mt-4 rounded-xl px-4 py-2 text-xs font-black text-black" style={{ background: '#c6ff34' }}>{lang === 'it' ? 'Mostra tutto' : 'Show everything'}</button>}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(item => {
                  if (false && shEditId === item.id) {
                    return (
                      <div key={item.id} className="bg-white rounded-3xl border-2 border-lime-300 p-5 shadow-md space-y-3">
                        <p className="font-black text-sm mb-1 text-gray-900">{t('editItem')}</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[['itemName', t('itemName')], ['brand', t('brand')], ['model', t('model')], ['imei', t('imeiSerial')]].map(([k, l]) => (
                            <div key={k} className={k === 'itemName' ? 'col-span-2' : ''}>
                              <label className="text-xs text-gray-500 font-medium">{l}</label>
                              <input className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5"
                                value={shEditForm[k] || ''} onChange={e => setShEditForm(f => ({ ...f, [k]: e.target.value }))} />
                            </div>
                          ))}
                          <div>
                            <label className="text-xs text-gray-500 font-medium">{t('condition')}</label>
                            <select className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5"
                              value={shEditForm.condition || 'Buono'} onChange={e => setShEditForm(f => ({ ...f, condition: e.target.value }))}>
                              {CONDITIONS.map(c => <option key={c} value={c}>{conditionLabel[c]}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 font-medium">{t('buyPrice')}</label>
                            <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5"
                              value={shEditForm.buyPrice || ''} onChange={e => setShEditForm(f => ({ ...f, buyPrice: e.target.value }))} />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 font-medium">{t('sellPrice')}</label>
                            <input type="number" min="0" step="0.01" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5"
                              value={shEditForm.sellPrice || ''} onChange={e => setShEditForm(f => ({ ...f, sellPrice: e.target.value }))} />
                          </div>
                          {[['sellerName', t('sellerName')], ['sellerPhone', t('sellerPhone')]].map(([k, l]) => (
                            <div key={k}>
                              <label className="text-xs text-gray-500 font-medium">{l}</label>
                              <input className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5"
                                value={shEditForm[k] || ''} onChange={e => setShEditForm(f => ({ ...f, [k]: e.target.value }))} />
                            </div>
                          ))}
                          <div className="col-span-2">
                            <label className="text-xs text-gray-500 font-medium">{lang === 'it' ? 'Note' : 'Notes'}</label>
                            <input className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5"
                              value={shEditForm.notes || ''} onChange={e => setShEditForm(f => ({ ...f, notes: e.target.value }))} />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => setShEditId(null)} className="flex-1 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">{t('cancel')}</button>
                          <button onClick={() => { updateSecondhand(activeShop.id, item.id, { ...shEditForm, buyPrice: Number(shEditForm.buyPrice), sellPrice: Number(shEditForm.sellPrice) || 0 }); setShEditId(null); }}
                            className="flex-1 py-2 text-black rounded-xl text-sm font-black border border-black/10" style={{ backgroundColor: '#c6ff34' }}>{t('save')}</button>
                        </div>
                      </div>
                    );
                  }
                  const isSold = item.status === 'sold';
                  const profit = isSold ? (item.sellPrice || 0) - (item.buyPrice || 0) : null;
                  return (
                    <div key={item.id} className={`relative overflow-hidden bg-white rounded-3xl shadow-sm border flex flex-col hover:-translate-y-0.5 hover:shadow-xl transition-all ${isSold ? 'border-lime-300' : 'border-gray-200'
                      }`}>
                      <button type="button" onClick={() => setShViewItem(item)} className="relative h-48 w-full overflow-hidden bg-[#f1fec8] flex items-center justify-center">
                        {item.productImages?.[0] ? <img src={item.productImages[0].data} alt={item.itemName} className="w-full h-full object-cover hover:scale-[1.03] transition-transform" /> : <div className="w-16 h-16 rounded-2xl bg-white/70 flex items-center justify-center"><svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="5" y="2" width="14" height="20" rx="3" /><path d="M9 5h6M10 18h4" /></svg></div>}
                        <span className="absolute left-3 top-3 px-2.5 py-1 rounded-full bg-black/70 text-white text-[9px] uppercase tracking-wide font-black">{isSold ? t('sold') : t('inStock')}</span>
                        <span className="absolute right-3 top-3 px-2.5 py-1 rounded-full bg-white/90 text-black text-[9px] font-black">{conditionLabel[item.condition] || item.condition}</span>
                      </button>
                      <div className="p-5 space-y-4 flex-1 flex flex-col">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 text-base leading-tight truncate" style={{ display: 'block' }}>{item.itemName}</p>
                          {(item.brand || item.model) && <p className="text-xs text-gray-400 mt-0.5">{[item.brand, item.model].filter(Boolean).join(' · ')}</p>}
                          {item.imei && <p className="text-xs text-gray-400 font-mono">IMEI: {item.imei}</p>}
                        </div>
                        <span className="text-[9px] uppercase tracking-wide font-black text-gray-400 shrink-0">#{String(item.id || '').slice(-5)}</span>
                      </div>

                      {/* Price info */}
                      <div className="flex items-center gap-3 rounded-2xl px-4 py-3.5 border border-black/5" style={{ background: '#f1fec8' }}>
                        <div className="flex-1">
                          <p className="text-xs text-gray-400 font-medium">{t('boughtFor')}</p>
                          <p className="font-bold text-gray-900">{fmt(item.buyPrice || 0)}</p>
                        </div>
                        {(isSold || Number(item.sellPrice) > 0) && (
                          <>
                            <div className="w-px h-8 bg-black/15" />
                            <div className="flex-1">
                              <p className="text-xs text-gray-500 font-medium">{isSold ? t('soldFor') : t('sellPrice')}</p>
                              <p className="font-bold text-gray-900">{fmt(item.sellPrice || 0)}</p>
                            </div>
                            <div className="w-px h-8 bg-black/15" />
                            <div className="flex-1">
                              <p className="text-xs text-gray-500 font-medium">{isSold ? t('profit') : (lang === 'it' ? 'Profitto stimato' : 'Estimated profit')}</p>
                              <p className={`font-black ${(Number(item.sellPrice) - Number(item.buyPrice)) >= 0 ? 'text-green-700' : 'text-red-500'}`}>{fmt(Number(item.sellPrice) - Number(item.buyPrice))}</p>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Meta */}
                      <div className="grid grid-cols-1 gap-2 text-xs">
                        {item.sellerName && <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2"><span className="text-gray-400">{t('boughtFrom')}</span><strong className="truncate">{item.sellerName}{item.sellerPhone ? ` · ${item.sellerPhone}` : ''}</strong></div>}
                        {isSold && item.buyerName && <p>{t('soldTo')} <span className="text-gray-600 font-medium">{item.buyerName}{item.buyerPhone ? ` · ${item.buyerPhone}` : ''}</span></p>}
                        <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2"><span className="text-gray-400">{t('buyDate')}</span><strong>{item.buyDate || '—'}</strong></div>
                        {item.notes && <p className="italic text-gray-500 line-clamp-2 px-1">{item.notes}</p>}
                      </div>

                      {/* Actions */}
                      <div className="grid grid-cols-4 gap-2 pt-1 mt-auto">
                        {!isSold && (
                          <button onClick={() => { setShSellOpen(item.id); setShSellForm({ sellPrice: item.sellPrice ? String(item.sellPrice) : '', buyerName: '', buyerPhone: '', buyerEmail: '' }); }}
                            className="col-span-4 py-2.5 text-black font-black rounded-xl text-sm transition-colors border border-black/10" style={{ backgroundColor: '#c6ff34' }}>
                            {t('markSold')}
                          </button>
                        )}
                        <button onClick={() => setShViewItem(item)} className="h-10 flex items-center justify-center border border-lime-300 rounded-xl text-gray-800 bg-[#f1fec8] hover:bg-[#c6ff34] transition-colors" title={lang === 'it' ? 'Visualizza dettagli' : 'View details'}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="3" /></svg>
                        </button>
                        <button onClick={() => { setShEditId(item.id); setShForm({ ...emptyShForm, ...item, buyPrice: String(item.buyPrice || ''), documentExpiry: normalizeDateInput(item.documentExpiry), productImages: item.productImages || [], documentFront: item.documentFront || '', documentBack: item.documentBack || '' }); setAddShOpen(true); }}
                          className="h-10 flex items-center justify-center border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => setShDeleteId(item.id)}
                          className="h-10 flex items-center justify-center border border-red-100 rounded-xl text-red-500 hover:bg-red-50 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>

                      {/* Inline sell form */}
                      {shSellOpen === item.id && (
                        <div className="border-t border-gray-200 pt-3 space-y-2">
                          <p className="text-sm font-bold" style={{ color: '#936639' }}>{t('recordSale')}</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="col-span-2">
                              <label className="text-xs text-gray-500 font-medium">{t('sellPriceRequired')}</label>
                              <input type="number" placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5"
                                value={shSellForm.sellPrice} onChange={e => setShSellForm(f => ({ ...f, sellPrice: e.target.value }))} />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 font-medium">{t('buyerName')}</label>
                              <input className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5"
                                value={shSellForm.buyerName} onChange={e => setShSellForm(f => ({ ...f, buyerName: e.target.value }))} />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 font-medium">{t('buyerPhone')}</label>
                              <input className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5"
                                value={shSellForm.buyerPhone} onChange={e => setShSellForm(f => ({ ...f, buyerPhone: e.target.value }))} />
                            </div>
                            <div className="col-span-2">
                              <label className="text-xs text-gray-500 font-medium">{t('buyerEmail')} <span className="text-gray-400">(optional – for auto email)</span></label>
                              <input type="email" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5"
                                placeholder="buyer@email.com"
                                value={shSellForm.buyerEmail} onChange={e => setShSellForm(f => ({ ...f, buyerEmail: e.target.value }))} />
                            </div>
                          </div>
                          {shSellForm.sellPrice && (
                            <div className={`rounded-lg px-3 py-2 text-sm font-semibold ${Number(shSellForm.sellPrice) - (item.buyPrice || 0) >= 0 ? 'bg-amber-50' : 'bg-red-50 text-red-600'
                              }`} style={Number(shSellForm.sellPrice) - (item.buyPrice || 0) >= 0 ? { color: '#936639' } : {}}>
                              {t('profit')}: {fmt(Number(shSellForm.sellPrice) - (item.buyPrice || 0))}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <button onClick={() => setShSellOpen(null)} className="flex-1 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">{t('cancel')}</button>
                            <button onClick={() => handleSell(item)} className="flex-1 py-2 text-white rounded-xl text-sm font-semibold" style={{ backgroundColor: '#936639' }}>{t('confirmSale')}</button>
                          </div>
                        </div>
                      )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Item Modal */}
            {addShOpen && (
              <div className="fixed inset-0 bg-black/45 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[94vh] overflow-y-auto border border-white/40">
                  <div className="sticky top-0 z-10 p-5 sm:p-7 border-b border-black/10 flex items-center justify-between" style={{ background: 'linear-gradient(135deg,#c6ff34,#f1fec8)' }}>
                    <div><p className="text-[10px] uppercase tracking-[.18em] font-black text-gray-600">{lang === 'it' ? 'Inventario usato' : 'Secondhand inventory'}</p><h2 className="text-2xl sm:text-3xl font-black text-gray-900 mt-1">{shEditId ? t('editItem') : t('buySecondhandItem')}</h2><p className="text-xs text-gray-600 mt-1">{lang === 'it' ? 'Aggiungi dettagli del dispositivo, costo di acquisto e dati del venditore.' : 'Add device details, purchase cost and seller information.'}</p></div>
                    <button onClick={() => { setAddShOpen(false); setShEditId(null); setShForm(emptyShForm); setShFormError(''); }} className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/75 border border-black/10 hover:bg-white text-gray-700 shrink-0">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="p-5 sm:p-7 space-y-5">
                    {shFormError && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-2">{shFormError}</p>}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2"><p className="text-[10px] uppercase tracking-[.15em] font-black text-gray-400 mb-1">{lang === 'it' ? 'Informazioni prodotto' : 'Product information'}</p></div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('itemNameRequired')}</label>
                        <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          placeholder="es. iPhone 13 Pro" value={shForm.itemName} onChange={e => setShForm(f => ({ ...f, itemName: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('brand')}</label>
                        <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          placeholder="Apple" value={shForm.brand} onChange={e => setShForm(f => ({ ...f, brand: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('model')}</label>
                        <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          placeholder="13 Pro" value={shForm.model} onChange={e => setShForm(f => ({ ...f, model: e.target.value }))} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('imeiSerialNo')}</label>
                        <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                          placeholder="123456789012345" value={shForm.imei} onChange={e => setShForm(f => ({ ...f, imei: e.target.value }))} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-2">{lang === 'it' ? 'Immagini prodotto' : 'Product images'} · max 6</label>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">{shForm.productImages.map((image, index) => <div key={`${image.name}-${index}`} className="relative h-24 rounded-xl overflow-hidden border border-gray-200 bg-gray-50"><img src={image.data} alt="" className="w-full h-full object-cover" /><button type="button" onClick={() => setShForm((form) => ({ ...form, productImages: form.productImages.filter((_, i) => i !== index) }))} className="absolute top-1 right-1 w-6 h-6 rounded-lg bg-black/65 text-white text-xs">×</button></div>)}{shForm.productImages.length < 6 && <label className="h-24 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-lime-400 text-gray-400"><span className="text-xl">＋</span><span className="text-[9px] font-black">{lang === 'it' ? 'AGGIUNGI FOTO' : 'ADD PHOTO'}</span><input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addProductImages(e.target.files || [])} /></label>}</div>
                      </div>
                      <div className="md:col-span-2 mt-2"><div className="h-px bg-gray-100" /><p className="text-[10px] uppercase tracking-[.15em] font-black text-gray-400 mt-4">{lang === 'it' ? 'Informazioni cliente / venditore' : 'Client / seller information'}</p></div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('condition')}</label>
                        <select className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          value={shForm.condition} onChange={e => setShForm(f => ({ ...f, condition: e.target.value }))}>
                          {CONDITIONS.map(c => <option key={c} value={c}>{conditionLabel[c]}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('buyPriceRequired')}</label>
                        <input type="number" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          placeholder="0" value={shForm.buyPrice} onChange={e => setShForm(f => ({ ...f, buyPrice: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('sellPrice')}</label>
                        <input type="number" min="0" step="0.01" className="w-full border border-lime-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-300"
                          placeholder="0" value={shForm.sellPrice} onChange={e => setShForm(f => ({ ...f, sellPrice: e.target.value }))} />
                        <p className="text-[10px] text-gray-400 mt-1">Prezzo previsto · Expected sale price</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('sellerName')}</label>
                        <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          placeholder="Mario Rossi" value={shForm.sellerName} onChange={e => setShForm(f => ({ ...f, sellerName: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('sellerPhone')}</label>
                        <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          placeholder="+39 320 1234567" value={shForm.sellerPhone} onChange={e => setShForm(f => ({ ...f, sellerPhone: e.target.value }))} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('sellerEmail')} <span className="text-gray-400 font-normal">(optional – auto-save to contacts)</span></label>
                        <input type="email" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          placeholder="seller@email.com" value={shForm.sellerEmail} onChange={e => setShForm(f => ({ ...f, sellerEmail: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{lang === 'it' ? 'Indirizzo' : 'Address'}</label>
                        <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-300" value={shForm.sellerAddress} onChange={e => setShForm(f => ({ ...f, sellerAddress: e.target.value }))} placeholder="Via Roma 10, Milano" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{lang === 'it' ? 'Codice fiscale' : 'Tax code'}</label>
                        <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-lime-300" value={shForm.sellerFiscalCode} onChange={e => setShForm(f => ({ ...f, sellerFiscalCode: e.target.value }))} placeholder="RSSMRA..." />
                      </div>
                      <div className="md:col-span-2 mt-2"><div className="h-px bg-gray-100" /><p className="text-[10px] uppercase tracking-[.15em] font-black text-gray-400 mt-4">{lang === 'it' ? 'Documento cliente' : 'Client document'}</p></div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{lang === 'it' ? 'Tipo documento' : 'Document type'}</label>
                        <select className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white" value={shForm.documentType} onChange={e => setShForm(f => ({ ...f, documentType: e.target.value }))}><option>Carta d’identità</option><option>Patente</option><option>Passaporto</option><option>Permesso di soggiorno</option></select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{lang === 'it' ? 'Numero documento' : 'Document number'}</label>
                        <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm" value={shForm.documentNumber} onChange={e => setShForm(f => ({ ...f, documentNumber: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{lang === 'it' ? 'Data di scadenza' : 'Expiry date'}</label>
                        <div className="grid grid-cols-[.8fr_1.25fr_1fr] gap-2 rounded-2xl border border-gray-200 bg-[#f1fec8] p-2">
                          <select aria-label={lang === 'it' ? 'Giorno' : 'Day'} value={normalizeDateInput(shForm.documentExpiry).split('-')[2] || ''} onChange={(e) => updateExpiryPart('day', e.target.value)} className="h-11 min-w-0 rounded-xl border border-black/10 bg-white px-2 text-sm font-black focus:outline-none focus:ring-2 focus:ring-lime-300"><option value="">{lang === 'it' ? 'Giorno' : 'Day'}</option>{Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, '0')).map((day) => <option key={day} value={day}>{day}</option>)}</select>
                          <select aria-label="Month" value={normalizeDateInput(shForm.documentExpiry).split('-')[1] || ''} onChange={(e) => updateExpiryPart('month', e.target.value)} className="h-11 min-w-0 rounded-xl border border-black/10 bg-white px-2 text-sm font-black focus:outline-none focus:ring-2 focus:ring-lime-300"><option value="">Month</option>{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((month, index) => <option key={month} value={String(index + 1).padStart(2, '0')}>{month}</option>)}</select>
                          <select aria-label="Year" value={normalizeDateInput(shForm.documentExpiry).split('-')[0] || ''} onChange={(e) => updateExpiryPart('year', e.target.value)} className="h-11 min-w-0 rounded-xl border border-black/10 bg-white px-2 text-sm font-black focus:outline-none focus:ring-2 focus:ring-lime-300"><option value="">Year</option>{Array.from({ length: 31 }, (_, index) => String(new Date().getFullYear() + index)).map((year) => <option key={year} value={year}>{year}</option>)}</select>
                        </div>
                        {/^\d{4}-\d{2}-\d{2}$/.test(shForm.documentExpiry) && <div className="flex items-center justify-between mt-1.5"><p className="text-[10px] font-bold text-green-700">Selected: {formatDocumentDate(shForm.documentExpiry)}</p><button type="button" onClick={() => setShForm((form) => ({ ...form, documentExpiry: '' }))} className="text-[10px] font-black text-gray-400 hover:text-red-500">Clear</button></div>}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[['documentFront', 'Document front'], ['documentBack', 'Document back']].map(([key, label]) => <label key={key} className="min-h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-center cursor-pointer hover:border-lime-400 p-2 text-[10px] font-black">{shForm[key] ? <span className="text-green-700">✓ {shForm[key].name}</span> : label}<input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setDocumentFile(key, e.target.files?.[0])} /></label>)}
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{lang === 'it' ? 'Note' : 'Notes'}</label>
                        <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          placeholder={lang === 'it' ? 'Eventuali osservazioni…' : 'Any remarks…'} value={shForm.notes} onChange={e => setShForm(f => ({ ...f, notes: e.target.value }))} />
                      </div>
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                      <button type="button" onClick={() => { setAddShOpen(false); setShEditId(null); setShForm(emptyShForm); setShFormError(''); }} className="sm:w-1/3 py-3.5 border border-gray-200 text-gray-600 font-black rounded-xl hover:bg-gray-50 text-sm">{t('cancel')}</button>
                      <button onClick={handleAddSh} className="flex-1 py-3.5 text-black font-black rounded-xl transition-colors text-sm border border-black/10 shadow-sm" style={{ backgroundColor: '#c6ff34' }}>{shEditId ? t('save') : t('addToStock')}</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Delete confirm */}
            {shDeleteId && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{t('deleteItem')}</h3>
                  <p className="text-sm text-gray-500 mb-6">{t('actionCannotBeUndone')}</p>
                  <div className="flex gap-3">
                    <button onClick={() => setShDeleteId(null)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50">{t('cancel')}</button>
                    <button onClick={() => { deleteSecondhand(activeShop.id, shDeleteId); setShDeleteId(null); }} className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl">{t('delete')}</button>
                  </div>
                </div>
              </div>
            )}
            {shViewItem && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-md p-3 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) setShViewItem(null); }}>
                <div className="w-full max-w-5xl max-h-[94vh] overflow-y-auto rounded-3xl bg-white shadow-2xl">
                  <div className="sticky top-0 z-10 flex items-start justify-between gap-4 p-5 sm:p-7 border-b border-black/10" style={{ background: 'linear-gradient(135deg,#c6ff34,#f1fec8)' }}><div><p className="text-[10px] uppercase tracking-[.18em] font-black text-gray-600">Secondhand item details</p><h2 className="text-2xl sm:text-3xl font-black mt-1">{shViewItem.itemName}</h2><p className="text-xs text-gray-600 mt-1">{[shViewItem.brand, shViewItem.model, shViewItem.imei && `IMEI ${shViewItem.imei}`].filter(Boolean).join(' · ')}</p></div><button onClick={() => setShViewItem(null)} className="w-11 h-11 rounded-xl bg-white/75 border border-black/10 text-xl font-black">×</button></div>
                  <div className="p-5 sm:p-7 space-y-6">
                    {(shViewItem.productImages || []).length > 0 && <section><p className="text-[10px] uppercase tracking-wider font-black text-gray-400 mb-3">Product images</p><div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{shViewItem.productImages.map((image, index) => <button type="button" onClick={() => setShPreviewFile(image)} key={`${image.name}-${index}`} className="relative h-44 rounded-2xl overflow-hidden border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-lime-300"><img src={image.data} alt={image.name || shViewItem.itemName} draggable="false" className="block w-full h-full object-contain pointer-events-none select-none" onError={(event) => { event.currentTarget.style.display = 'none'; }} /><span className="absolute right-2 bottom-2 px-2 py-1 rounded-lg bg-black/65 text-white text-[9px] font-black pointer-events-none">VIEW</span></button>)}</div></section>}
                    <section className="rounded-3xl border border-black/10 p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] uppercase tracking-wider font-black text-gray-400">Product details</p><h3 className="text-lg font-black mt-1">{shViewItem.itemName || '—'}</h3></div><span className="text-[10px] font-black px-3 py-1.5 rounded-full bg-[#c6ff34]">{shViewItem.status === 'sold' ? t('sold') : t('inStock')}</span></div><div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">{[[t('brand'), shViewItem.brand || '—'], [t('model'), shViewItem.model || '—'], [t('imeiSerial'), shViewItem.imei || '—'], [t('condition'), conditionLabel[shViewItem.condition] || shViewItem.condition || '—'], [t('boughtFor'), fmt(shViewItem.buyPrice || 0)], [t('soldFor'), shViewItem.status === 'sold' ? fmt(shViewItem.sellPrice || 0) : '—'], [t('profit'), shViewItem.status === 'sold' ? fmt((Number(shViewItem.sellPrice) || 0) - (Number(shViewItem.buyPrice) || 0)) : '—'], [t('buyDate'), shViewItem.buyDate || '—'], [t('sold'), shViewItem.sellDate || '—']].map(([label, value], index) => <div key={`${label}-${index}`} className={`rounded-2xl border border-black/5 p-4 ${index === 6 && shViewItem.status === 'sold' ? 'bg-[#c6ff34]' : 'bg-[#f1fec8]'}`}><p className="text-[9px] uppercase tracking-wide font-black text-gray-500">{label}</p><p className="text-sm font-black mt-1 break-words">{value}</p></div>)}</div></section>
                    <section><p className="text-[10px] uppercase tracking-wider font-black text-gray-400 mb-3">Client / seller details</p><div className="grid grid-cols-1 md:grid-cols-3 gap-3">{[[t('sellerName'), shViewItem.sellerName || '—'], [t('sellerPhone'), shViewItem.sellerPhone || '—'], [t('sellerEmail'), shViewItem.sellerEmail || '—'], ['Address', shViewItem.sellerAddress || '—'], ['Codice fiscale', shViewItem.sellerFiscalCode || '—']].map(([label, value]) => <div key={label} className="rounded-2xl border border-black/5 p-4 bg-white shadow-sm"><p className="text-[9px] uppercase tracking-wide font-black text-gray-400">{label}</p><p className="text-sm font-black mt-1 break-words">{value}</p></div>)}</div></section>
                    <section className="rounded-2xl border border-black/10 p-4 sm:p-5"><p className="text-[10px] uppercase tracking-wider font-black text-gray-400">Client document</p><div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3"><div><p className="text-xs text-gray-400">{shViewItem.documentType || 'Document'}</p><strong className="text-sm">{shViewItem.documentNumber || '—'}</strong><p className="text-xs text-gray-400 mt-1">Expiry: <strong className="text-gray-800">{formatDocumentDate(shViewItem.documentExpiry)}</strong></p></div>{[['documentFront', 'Document front'], ['documentBack', 'Document back']].map(([key, label]) => shViewItem[key] ? <button type="button" onClick={() => setShPreviewFile(shViewItem[key])} key={key} className="rounded-xl border border-gray-200 p-3 text-xs font-black text-center bg-gray-50">{shViewItem[key].type?.startsWith('image/') ? <img src={shViewItem[key].data} alt="" className="h-28 w-full object-contain mb-2" /> : <span className="block text-3xl mb-2">PDF</span>}{label}</button> : <div key={key} className="rounded-xl border border-dashed border-gray-200 p-3 text-xs text-gray-400 flex items-center justify-center">{label}: —</div>)}</div></section>
                    {shViewItem.notes && <div className="rounded-2xl bg-gray-50 p-4"><p className="text-[9px] uppercase font-black text-gray-400">Notes</p><p className="text-sm mt-1">{shViewItem.notes}</p></div>}
                  </div>
                </div>
              </div>
            )}
            {shPreviewFile && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-8" onMouseDown={(e) => { if (e.target === e.currentTarget) setShPreviewFile(null); }}>
                <div className="relative w-full h-full max-w-6xl max-h-[92vh] flex items-center justify-center">
                  <button type="button" onClick={() => setShPreviewFile(null)} className="absolute top-0 right-0 z-10 w-11 h-11 rounded-xl bg-white text-black text-xl font-black shadow-lg">×</button>
                  {shPreviewFile.type?.startsWith('image/') ? <img src={shPreviewFile.data} alt={shPreviewFile.name || 'Preview'} className="max-w-full max-h-full object-contain rounded-2xl" /> : <iframe title={shPreviewFile.name || 'Document preview'} src={shPreviewFile.data} className="w-full h-[88vh] rounded-2xl bg-white" />}
                  {shPreviewFile.name && <span className="absolute bottom-2 left-1/2 -translate-x-1/2 max-w-[80%] truncate rounded-xl bg-black/70 px-3 py-2 text-xs font-bold text-white">{shPreviewFile.name}</span>}
                </div>
              </div>
            )}
          </div>
        );
}
