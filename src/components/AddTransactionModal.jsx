import { useEffect, useMemo, useState, useCallback } from 'react';
import { useShop } from '../context/ShopContext';
import { useLanguage } from '../context/LanguageContext';
import BarcodeScanner from './BarcodeScanner';
import DatePicker from './DatePicker';

const INCOME_CATEGORY_KEYS = ['cat_Sales', 'cat_Services', 'cat_Catering', 'cat_OnlineOrders', 'cat_OtherIncome'];
const EXPENSE_CATEGORY_KEYS = ['cat_Inventory', 'cat_Rent', 'cat_Utilities', 'cat_Payroll', 'cat_Equipment', 'cat_Supplies', 'cat_Marketing', 'cat_Maintenance', 'cat_OtherExpense'];

export default function AddTransactionModal({ onClose }) {
  const { addTransaction, addSkuMovement, updateSecondhand, activeShop } = useShop();
  const { t, locale } = useLanguage();
  const it = String(locale).toLowerCase().startsWith('it');
  const [txType, setTxType] = useState('income');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [saleSkuId, setSaleSkuId] = useState('');
  const [saleSecondhandId, setSaleSecondhandId] = useState('');
  const [saleQty, setSaleQty] = useState('1');
  const [skuPickerOpen, setSkuPickerOpen] = useState(false);
  const [productPickerTab, setProductPickerTab] = useState('inventory');
  const [date, setDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [discountType, setDiscountType] = useState('none'); // 'none' | 'percent' | 'flat'
  const [discountValue, setDiscountValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'card'
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);

  const handleBarcodeScan = useCallback((code) => {
    setDescription(code);
    setError('');
    setScanning(false);
  }, []);

  const categories = txType === 'income' ? INCOME_CATEGORY_KEYS : EXPENSE_CATEGORY_KEYS;

  // Live-compute discount
  const rawAmount = parseFloat(amount) || 0;
  const discVal = parseFloat(discountValue) || 0;
  const discountAmount =
    discountType === 'percent' ? Math.min(rawAmount, (rawAmount * discVal) / 100)
      : discountType === 'flat' ? Math.min(rawAmount, discVal)
        : 0;
  const finalAmount = Math.max(0, rawAmount - discountAmount);
  const skus = activeShop?.skus || [];
  const secondhandItems = (activeShop?.secondhand || []).filter((item) => item.status !== 'sold');
  const isSalesFlow = txType === 'income';
  const selectedSku = skus.find((sk) => sk.id === saleSkuId);
  const selectedSecondhand = secondhandItems.find((item) => item.id === saleSecondhandId);
  const productSalePrice = (item) => Number(item?.sellPrice ?? item?.salePrice ?? item?.price ?? item?.expectedSellPrice ?? item?.buyPrice) || 0;
  const canSyncInventory = txType === 'income' && skus.length > 0;

  const autoMatchedSku = useMemo(() => {
    if (!description.trim() || skus.length === 0) return null;
    const q = description.trim().toLowerCase();
    // 1. Exact barcode match (highest priority — works for scanned barcodes)
    const byBarcode = skus.find((sk) => sk.barcode && sk.barcode.toLowerCase() === q);
    if (byBarcode) return byBarcode;
    // 2. Exact SKU code match
    const byCode = skus.find((sk) => (sk.code || '').toLowerCase() === q);
    if (byCode) return byCode;
    // 3. Partial match by code/name/barcode
    const candidates = skus.filter((sk) => {
      const code = (sk.code || '').toLowerCase();
      const name = (sk.name || '').toLowerCase();
      const barcode = (sk.barcode || '').toLowerCase();
      return (code && q.includes(code)) || (name && q.includes(name)) || (barcode && q.includes(barcode));
    });
    if (candidates.length === 0) return null;
    return [...candidates].sort((a, b) => {
      const aLen = Math.max((a.code || '').length, (a.name || '').length, (a.barcode || '').length);
      const bLen = Math.max((b.code || '').length, (b.name || '').length, (b.barcode || '').length);
      return bLen - aLen;
    })[0];
  }, [description, skus]);

  const parsedSaleQty = useMemo(() => {
    if (!description.trim()) return null;
    const m = description.match(/(?:x|qty|quantity)\s*[:\-]?\s*(\d+)/i)
      || description.match(/(\d+)\s*(pcs|pieces|units?)/i);
    if (!m) return null;
    const qty = Number(m[1]);
    return Number.isFinite(qty) && qty > 0 ? String(Math.floor(qty)) : null;
  }, [description]);

  useEffect(() => {
    if (!autoMatchedSku) return;
    // Auto-select the matched product
    if (!saleSkuId) setSaleSkuId(autoMatchedSku.id);
    // Auto-fill sell price as amount if empty
    if (!amount && autoMatchedSku.sellPrice) {
      setAmount(String(autoMatchedSku.sellPrice));
    }
    // Auto-select Sales category for income if no category selected
    if (isSalesFlow && !category) {
      setCategory('cat_Sales');
    }
    // Auto-set description to product name if description is just a barcode
    if (autoMatchedSku.barcode && description.trim() === autoMatchedSku.barcode) {
      setDescription(autoMatchedSku.name || description);
    }
  }, [autoMatchedSku]);

  useEffect(() => {
    if (!isSalesFlow || !parsedSaleQty) return;
    setSaleQty((prev) => (prev === '1' || !prev ? parsedSaleQty : prev));
  }, [isSalesFlow, parsedSaleQty]);

  useEffect(() => {
    const product = selectedSecondhand || selectedSku;
    if (!product) return;
    const price = productSalePrice(product);
    setAmount(price > 0 ? String(price) : '');
  }, [saleSecondhandId, saleSkuId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description.trim()) { setError(t('descriptionRequired')); return; }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) { setError(t('validAmountRequired')); return; }
    if (!category) { setError(t('selectCategory')); return; }
    if (discountType !== 'none' && discVal <= 0) { setError(t('validDiscountRequired')); return; }
    if (discountType === 'percent' && discVal > 100) { setError(t('discountExceed100')); return; }

    const targetSku = selectedSku || autoMatchedSku;

    if (canSyncInventory && targetSku) {
      const qty = Number(saleQty);
      if (!qty || qty <= 0) { setError('Enter a valid sold quantity'); return; }
      if (qty > Number(targetSku.stock || 0)) { setError('Sold quantity is greater than current stock'); return; }
    }

    if (selectedSecondhand) {
      updateSecondhand(activeShop.id, selectedSecondhand.id, {
        status: 'sold',
        sellPrice: finalAmount,
        sellDate: date,
        paymentMethod,
        soldVia: 'transaction',
      });
    } else {
      addTransaction({
        description: description.trim(),
        amount: finalAmount,
        originalAmount: discountAmount > 0 ? rawAmount : undefined,
        discountType: discountAmount > 0 ? discountType : undefined,
        discountValue: discountAmount > 0 ? discVal : undefined,
        discountAmount: discountAmount > 0 ? discountAmount : undefined,
        type: txType,
        category,
        date,
        paymentMethod,
      });
    }

    // Keep inventory and finance in sync when user records a product sale from Add Transaction.
    if (canSyncInventory && targetSku) {
      const qty = Number(saleQty) || 1;
      const unitPrice = qty > 0 ? Number((finalAmount / qty).toFixed(2)) : Number(targetSku.sellPrice || 0);
      addSkuMovement(activeShop.id, targetSku.id, {
        type: 'out',
        qty,
        note: description.trim() || 'Sold via Add Transaction',
        price: unitPrice,
        skuName: targetSku.name || '',
        buyPrice: Number(targetSku.buyPrice) || 0,
        date,
      });
    }

    onClose();
  };

  return (
    <div className="anim-lbx-bg fixed inset-0 bg-black/55 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="anim-lightbox bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden border border-white/40">
        {/* Header */}
        <div className="p-6 sm:p-7 relative overflow-hidden" style={{ background: 'radial-gradient(circle at 90% 0,rgba(255,255,255,.8),transparent 38%),linear-gradient(135deg,#c6ff34,#f1fec8)' }}>
          <div className="absolute -right-12 -top-16 w-40 h-40 rounded-full border border-black/8" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[.18em] font-black text-gray-600">{t('recordNewEntry')}</p>
              <h2 className="text-2xl font-black tracking-[-.04em] text-gray-900 mt-1">{t('addTransaction')}</h2>
            </div>
            <button onClick={onClose} className="relative w-10 h-10 flex items-center justify-center text-gray-900 transition-colors rounded-full bg-white/65 border border-black/10 hover:bg-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {/* Type Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-gray-100 rounded-2xl border border-black/5">
            {['income', 'expense'].map((tp) => (
              <button
                key={tp}
                type="button"
                onClick={() => {
                  setTxType(tp);
                  setCategory('');
                  setSaleSkuId('');
                  setSaleSecondhandId('');
                  setSaleQty('1');
                  setError('');
                }}
                className={`flex-1 py-2.5 text-sm font-black rounded-xl capitalize transition-all border ${txType === tp
                    ? tp === 'income'
                      ? 'text-gray-950 shadow-md border-lime-400'
                      : 'text-white shadow-md border-red-600'
                    : 'text-gray-500 hover:text-gray-900 border-transparent'
                  }`}
                style={txType === tp ? { background: tp === 'income' ? '#c6ff34' : '#dc2626' } : undefined}
              >
                {tp === 'income' ? t('plusIncomeBtn') : t('minusExpenseBtn')}
              </button>
            ))}
          </div>

          {/* Description */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_.65fr] gap-4 items-start">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t('description')}</label>
            <div className="relative flex gap-2">
              <input
                type="text"
                value={description}
                onChange={(e) => { setDescription(e.target.value); setError(''); }}
                placeholder={t('descriptionPlaceholder')}
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder-gray-400"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setScanning((s) => !s)}
                title={t('scanBarcode')}
                className={`px-3 py-3 rounded-xl border transition-all ${scanning ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100' : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'}`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {scanning ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 12h10" />
                    </>
                  )}
                </svg>
              </button>
            </div>
            {/* Barcode scanner region */}
            <BarcodeScanner
              active={scanning}
              onScan={handleBarcodeScan}
              onError={(msg) => { setError(msg); setScanning(false); }}
              style={{ marginTop: '8px' }}
            />
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t('originalAmount')}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(''); }}
                placeholder="0.00"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">{t('date')}</label>
              <DatePicker value={date} onChange={(v) => setDate(v)} />
            </div>
          </div>
          </div>

          {/* Discount */}
          <div className="border border-lime-200 rounded-2xl p-3 space-y-2" style={{ background: '#f8ffe8' }}>
            <p className="text-xs font-black text-gray-700 uppercase tracking-wide">{t('discount')} <span className="font-normal normal-case text-gray-400">({t('discountOptional')})</span></p>
            {/* Type selector */}
            <div className="flex gap-2">
              {[['none', t('noDiscount')], ['percent', t('percentDiscount')], ['flat', t('flatAmount')]].map(([v, l]) => (
                <button key={v} type="button"
                  onClick={() => { setDiscountType(v); setDiscountValue(''); setError(''); }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${discountType === v
                      ? 'bg-amber-100 text-amber-900 border-amber-500 shadow-sm'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-amber-300'
                    }`}>
                  {l}
                </button>
              ))}
            </div>
            {/* Value input */}
            {discountType !== 'none' && (
              <div className="space-y-2">
                {/* Quick presets — percent only */}
                {discountType === 'percent' && (
                  <div className="flex gap-2">
                    {[10, 20, 30, 50, 100].map((p) => (
                      <button key={p} type="button"
                        onClick={() => { setDiscountValue(String(p)); setError(''); }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${discountValue === String(p)
                            ? 'bg-amber-100 text-amber-900 border-amber-500 shadow-sm'
                            : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50'
                          }`}>
                        {p === 100 ? 'Max' : `${p}%`}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    {discountType === 'percent' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-amber-500">%</span>
                    )}
                    <input
                      type="number" min="0"
                      max={discountType === 'percent' ? 100 : undefined}
                      step={discountType === 'percent' ? '1' : '0.01'}
                      value={discountValue}
                      onChange={(e) => { setDiscountValue(e.target.value); setError(''); }}
                      placeholder={discountType === 'percent' ? 'es. 10' : 'es. 500'}
                      className="w-full px-4 py-2.5 border border-amber-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400 bg-white"
                    />
                  </div>
                  {rawAmount > 0 && discountAmount > 0 && (
                    <div className="text-right shrink-0">
                      <p className="text-xs text-amber-600 font-semibold line-through">{rawAmount.toLocaleString()}</p>
                      <p className="text-sm font-bold text-amber-700">{finalAmount.toLocaleString()} <span className="text-xs font-normal text-amber-500">{t('saved')} {discountAmount.toLocaleString()}</span></p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Final amount pill */}
            {rawAmount > 0 && discountType !== 'none' && discountAmount > 0 && (
              <div className="flex items-center justify-between bg-white border border-amber-100 rounded-xl px-4 py-2.5">
                <span className="text-xs font-semibold text-gray-500">{t('finalAmountToRecord')}</span>
                <span className="text-base font-bold text-amber-700">{finalAmount.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Payment Method — Cash / Card (POS) */}
          {txType === 'income' && (
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">{t('paymentMethod')}</label>
              <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                {['cash', 'card'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
                      paymentMethod === m
                        ? m === 'cash'
                          ? 'bg-emerald-100 text-emerald-800 shadow-sm'
                          : 'bg-blue-100 text-blue-800 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {m === 'cash' ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    )}
                    {m === 'cash' ? t('cash') : t('cardPOS')}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-2">{t('category')}</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategory(cat);
                    if (cat !== 'cat_Sales') {
                      setSaleSkuId('');
                      setSaleSecondhandId('');
                      setSaleQty('1');
                    }
                    setError('');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${category === cat
                      ? txType === 'income'
                        ? 'bg-amber-50 border-amber-400 text-amber-800'
                        : 'bg-amber-50 border-amber-400 text-amber-800'
                      : 'border-gray-200 text-gray-600 hover:border-amber-300 hover:bg-amber-50'
                    }`}
                >
                  {t(cat)}
                </button>
              ))}
            </div>
          </div>

          {isSalesFlow && (skus.length > 0 || secondhandItems.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">{it ? 'Prodotto / Usato' : 'Product / Secondhand'}</label>
                <div className="relative">
                  <button type="button" onClick={() => { setSkuPickerOpen((open) => !open); setProductPickerTab(selectedSecondhand ? 'secondhand' : 'inventory'); }} className="w-full px-3 py-2.5 border border-lime-200 rounded-xl bg-white flex items-center justify-between gap-3 text-left focus:outline-none focus:ring-2 focus:ring-lime-300"><span className="min-w-0">{selectedSecondhand ? <><strong className="block text-xs truncate">{selectedSecondhand.itemName}</strong><span className="block text-[10px] text-gray-400 truncate">Usato · {[selectedSecondhand.brand, selectedSecondhand.model].filter(Boolean).join(' · ')}</span></> : selectedSku ? <><strong className="block text-xs truncate">{selectedSku.name}</strong><span className="block text-[10px] text-gray-400 truncate">{selectedSku.code}{selectedSku.model ? ` · ${selectedSku.model}` : ''} · Stock {Number(selectedSku.stock) || 0}</span></> : <span className="text-sm text-gray-400">Inventario / Usato</span>}</span><svg className={`w-4 h-4 shrink-0 transition-transform ${skuPickerOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6 6 6-6" /></svg></button>
                  {skuPickerOpen && <div className="absolute z-[80] left-0 right-0 bottom-full mb-2 rounded-2xl border border-black/10 bg-white shadow-2xl overflow-hidden"><div className="grid grid-cols-2 gap-1.5 p-2 border-b border-gray-100 bg-white"><button type="button" onClick={() => setProductPickerTab('inventory')} className="px-3 py-2 rounded-xl text-xs font-black" style={{ background: productPickerTab === 'inventory' ? '#c6ff34' : '#f3f4f6' }}>Inventario ({skus.length})</button><button type="button" onClick={() => setProductPickerTab('secondhand')} className="px-3 py-2 rounded-xl text-xs font-black" style={{ background: productPickerTab === 'secondhand' ? '#c6ff34' : '#f3f4f6' }}>Usato ({secondhandItems.length})</button></div><div className="h-52 overflow-y-scroll overscroll-contain p-1.5" style={{ WebkitOverflowScrolling: 'touch' }}><button type="button" onClick={() => { setSaleSkuId(''); setSaleSecondhandId(''); setSkuPickerOpen(false); }} className="w-full rounded-xl px-3 py-2 text-left text-xs font-bold text-gray-400 hover:bg-gray-50">No product link</button>{productPickerTab === 'secondhand' && (secondhandItems.length ? secondhandItems.map((item) => <button type="button" key={item.id} onClick={() => { setSaleSecondhandId(item.id); setSaleSkuId(''); setSkuPickerOpen(false); setCategory('cat_Sales'); setError(''); setDescription(item.itemName || item.model || 'Usato'); setAmount(String(productSalePrice(item) || '')); setSaleQty('1'); }} className="w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-lime-50" style={saleSecondhandId === item.id ? { background: '#c6ff34' } : undefined}><span className="min-w-0"><strong className="block text-xs truncate">{item.itemName || item.model}</strong><span className="block text-[10px] text-gray-400 truncate">{[item.brand, item.model, item.imei].filter(Boolean).join(' · ')}</span></span><span className="shrink-0 px-2 py-1 rounded-lg bg-[#f1fec8] text-[9px] font-black">{productSalePrice(item).toLocaleString('it-IT')}</span></button>) : <p className="p-5 text-center text-xs text-gray-400">Nessun prodotto usato disponibile</p>)}{productPickerTab === 'inventory' && (skus.length ? skus.map((sk) => <button type="button" key={sk.id} onClick={() => { setSaleSkuId(sk.id); setSaleSecondhandId(''); setSkuPickerOpen(false); setError(''); setAmount(String(productSalePrice(sk) || '')); setDescription(sk.name || ''); setCategory('cat_Sales'); }} className="w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-lime-50" style={saleSkuId === sk.id ? { background: '#c6ff34' } : undefined}><span className="min-w-0"><strong className="block text-xs truncate">{sk.name}</strong><span className="block text-[10px] text-gray-400 truncate">{sk.code}{sk.model ? ` · ${sk.model}` : ''}</span></span><span className="shrink-0 text-right"><strong className="block text-[10px]">{productSalePrice(sk).toLocaleString('it-IT')}</strong><small className={`${Number(sk.stock) <= 0 ? 'text-red-500' : 'text-gray-500'} text-[9px] font-black`}>{Number(sk.stock) || 0} stock</small></span></button>) : <p className="p-5 text-center text-xs text-gray-400">Nessun prodotto in inventario</p>)}</div></div>}
                </div>
                {autoMatchedSku && !saleSkuId && (
                  <p className="text-xs text-emerald-700 mt-1">Auto matched: {autoMatchedSku.code} - {autoMatchedSku.name}</p>
                )}
                {autoMatchedSku && saleSkuId === autoMatchedSku.id && (
                  <p className="text-xs text-emerald-700 mt-1">Auto linked from description: {autoMatchedSku.code}</p>
                )}
              </div>
              <div className={selectedSecondhand ? 'hidden' : ''}>
                <label className="block text-sm font-semibold text-gray-600 mb-1.5">Sold Qty</label>
                <input
                  type="number"
                  min="1"
                  value={saleQty}
                  onChange={(e) => { setSaleQty(e.target.value); setError(''); }}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
                {parsedSaleQty && (
                  <p className="text-xs text-emerald-700 mt-1">Detected qty from description: {parsedSaleQty}</p>
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors">
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 text-gray-950 font-black rounded-xl transition-all shadow-sm hover:-translate-y-0.5 hover:shadow-lg border border-black/10"
              style={{ background: '#c6ff34' }}
            >
              {t('add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
