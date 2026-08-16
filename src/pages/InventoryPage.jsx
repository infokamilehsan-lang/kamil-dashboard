import { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { useLanguage } from '../context/LanguageContext';
import { useFmt } from '../lib/useFmt';
import BarcodeScanner from '../components/BarcodeScanner';
import { inventoryMetrics, isLowStock } from '../lib/inventoryMetrics';

export default function InventoryPage() {
  const { activeShop, addSku, updateSku, deleteSku, addSkuMovement } = useShop();
  const { t, locale } = useLanguage();
  const { fmt, fmtDate, currencyObj } = useFmt();
  const isItalian = String(locale || '').toLowerCase().startsWith('it');
  const todayKey = () => new Date().toISOString().slice(0, 10);
  const afterMonths = (date, months = 2) => { const value = new Date(`${date || todayKey()}T12:00:00`); value.setMonth(value.getMonth() + months); return value.toISOString().slice(0, 10); };
  const supplierText = isItalian ? {
    button: 'Fornitore', paid: 'Pagato', due: 'Da pagare', section: 'Fornitore e fattura', account: 'Conto acquisto', company: 'Nome azienda / fornitore', companyPlaceholder: 'Es. ABC Ricambi SRL', total: 'Totale acquisto', alreadyPaid: 'Già pagato', remaining: 'Rimanente', remainingDue: 'Rimanente da pagare', noteInvoice: 'Nota / numero fattura', note: 'Nota', notePlaceholder: 'Numero fattura, scadenza...', image: 'Fattura / ricevuta', upload: 'Carica immagine o PDF', cancel: 'Annulla', save: 'Salva conto', imageAlt: 'Fattura', purchaseDate: 'Data acquisto', dueDate: 'Scadenza pagamento', twoMonths: 'Paga tra 2 mesi', overdue: 'Scaduto', dueSoon: 'In scadenza', pending: 'Da pagare', viewFile: 'Apri documento', pdf: 'Fattura PDF',
  } : {
    button: 'Supplier', paid: 'Paid', due: 'Amount due', section: 'Supplier & invoice', account: 'Purchase account', company: 'Company / supplier name', companyPlaceholder: 'e.g. ABC Parts Ltd', total: 'Purchase total', alreadyPaid: 'Amount paid', remaining: 'Remaining', remainingDue: 'Remaining balance', noteInvoice: 'Note / invoice number', note: 'Note', notePlaceholder: 'Invoice number, due date...', image: 'Invoice / receipt', upload: 'Upload image or PDF', cancel: 'Cancel', save: 'Save account', imageAlt: 'Invoice', purchaseDate: 'Purchase date', dueDate: 'Payment due date', twoMonths: 'Pay in 2 months', overdue: 'Overdue', dueSoon: 'Due soon', pending: 'Pending', viewFile: 'Open document', pdf: 'PDF invoice',
  };

  const [skuSearch, setSkuSearch] = useState('');
  const [skuCatFilter, setSkuCatFilter] = useState('all');
  const [skuStockFilter, setSkuStockFilter] = useState('all');
  const [skuSupplierFilter, setSkuSupplierFilter] = useState('all');
  const [skuSort, setSkuSort] = useState('name');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [addSkuOpen, setAddSkuOpen] = useState(false);
  const emptySkuForm = { name: '', models: '', category: 'Ricambi', description: '', buyPrice: '', sellPrice: '', stock: '', lowStockAt: '5', barcode: '', supplierCompany: '', supplierTotal: '', supplierPaid: '', supplierNote: '', invoiceImage: '', purchaseDate: todayKey(), dueDate: afterMonths(todayKey()) };
  const [skuForm, setSkuForm] = useState(emptySkuForm);
  const [skuFormError, setSkuFormError] = useState('');
  const [skuScanning, setSkuScanning] = useState(false);
  const [scanQueue, setScanQueue] = useState([]);
  const [bulkScanMode, setBulkScanMode] = useState(false);
  const [skuDeleteId, setSkuDeleteId] = useState(null);
  const [skuMoveOpen, setSkuMoveOpen] = useState(null); // skuId
  const [skuMoveForm, setSkuMoveForm] = useState({ type: '', qty: '', note: '', price: '', paymentMethod: 'cash' });
  const [skuMoveError, setSkuMoveError] = useState('');
  const [skuHistoryId, setSkuHistoryId] = useState(null); // skuId whose history is expanded
  const [skuEditId, setSkuEditId] = useState(null);
  const [skuEditForm, setSkuEditForm] = useState({});
  const [supplierOpenId, setSupplierOpenId] = useState(null);
  const [supplierInfoSku, setSupplierInfoSku] = useState(null);
  const [invoicePreview, setInvoicePreview] = useState(null);
  const [supplierForm, setSupplierForm] = useState({ company: '', total: '', paid: '', invoiceImage: '', note: '', purchaseDate: todayKey(), dueDate: afterMonths(todayKey()) });

  const openSupplierAccount = (sku) => {
    setSupplierOpenId(sku.id);
    setSupplierForm({
      company: sku.supplierAccount?.company || '',
      total: String(sku.supplierAccount?.total ?? (((Number(sku.buyPrice) || 0) * (Number(sku.stock) || 0)) || '')),
      paid: String(sku.supplierAccount?.paid ?? ''),
      invoiceImage: sku.supplierAccount?.invoiceImage || '',
      note: sku.supplierAccount?.note || '',
      purchaseDate: sku.supplierAccount?.purchaseDate || todayKey(),
      dueDate: sku.supplierAccount?.dueDate || afterMonths(sku.supplierAccount?.purchaseDate || todayKey()),
    });
  };

  const saveSupplierAccount = (skuId) => {
    const total = Math.max(0, Number(supplierForm.total) || 0);
    const paid = Math.max(0, Number(supplierForm.paid) || 0);
    updateSku(activeShop.id, skuId, { supplierAccount: { ...supplierForm, total, paid, remaining: Math.max(total - paid, 0), updatedAt: new Date().toISOString() } });
    setSupplierOpenId(null);
  };

  const loadInvoiceImage = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSupplierForm((current) => ({ ...current, invoiceImage: reader.result }));
    reader.readAsDataURL(file);
  };
  const isPdf = (value) => String(value || '').startsWith('data:application/pdf');
  const filePreview = (value, compact = false) => isPdf(value)
    ? <div className={`w-full ${compact ? 'h-full' : 'h-44'} flex flex-col items-center justify-center text-gray-900`} style={{ background: '#f1fec8' }}><svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h4" /></svg><strong className="text-xs mt-2">{supplierText.pdf}</strong></div>
    : <img src={value} alt={supplierText.imageAlt} className={`w-full ${compact ? 'h-full object-cover' : 'max-h-56 object-contain'} bg-gray-50`} />;

        const SKU_CATS = ['Ricambi', 'Accessori', 'Telefoni', 'Strumenti', 'Altro'];
        const skuCatLabel = { Ricambi: t('skuCat_Parts'), Accessori: t('skuCat_Accessories'), Telefoni: t('skuCat_Phones'), Strumenti: t('skuCat_Tools'), Altro: t('skuCat_Other') };
        const skus = activeShop.skus || [];
        const filtered = skus.filter((sk) => {
          const matchCat = skuCatFilter === 'all' || sk.category === skuCatFilter;
          const q = skuSearch.trim().toLowerCase();
          const searchable = [sk.name, sk.model, sk.code, sk.barcode, sk.category, sk.description, sk.supplierAccount?.company, sk.supplierAccount?.note].filter(Boolean).join(' ').toLowerCase();
          const matchSearch = !q || searchable.includes(q);
          const stock = Number(sk.stock) || 0;
          const matchStock = skuStockFilter === 'all'
            || (skuStockFilter === 'available' && stock > 0 && !isLowStock(sk))
            || (skuStockFilter === 'low' && isLowStock(sk) && stock > 0)
            || (skuStockFilter === 'out' && stock <= 0);
          const supplier = sk.supplierAccount || {};
          const remaining = Math.max(0, Number(supplier.remaining ?? ((Number(supplier.total) || 0) - (Number(supplier.paid) || 0))) || 0);
          const matchSupplier = skuSupplierFilter === 'all'
            || (skuSupplierFilter === 'linked' && Boolean(supplier.company))
            || (skuSupplierFilter === 'due' && remaining > 0)
            || (skuSupplierFilter === 'paid' && Boolean(supplier.company) && remaining <= 0);
          return matchCat && matchSearch && matchStock && matchSupplier;
        }).sort((a, b) => {
          if (skuSort === 'stock_high') return (Number(b.stock) || 0) - (Number(a.stock) || 0);
          if (skuSort === 'stock_low') return (Number(a.stock) || 0) - (Number(b.stock) || 0);
          if (skuSort === 'value_high') return ((Number(b.stock) || 0) * (Number(b.buyPrice) || 0)) - ((Number(a.stock) || 0) * (Number(a.buyPrice) || 0));
          if (skuSort === 'newest') return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
          return String(a.name || '').localeCompare(String(b.name || ''), locale);
        });
        const inventoryFiltersActive = Boolean(skuSearch) || skuCatFilter !== 'all' || skuStockFilter !== 'all' || skuSupplierFilter !== 'all' || skuSort !== 'name';
        const clearInventoryFilters = () => { setSkuSearch(''); setSkuCatFilter('all'); setSkuStockFilter('all'); setSkuSupplierFilter('all'); setSkuSort('name'); };
        const inventory = inventoryMetrics(skus);
        const { lowStock, totalPurchased, totalSold, totalItems, soldProfit: totalStockProfit } = inventory;

        const handleAddSku = () => {
          if (!skuForm.name.trim()) { setSkuFormError(t('productNameRequired')); return; }
          const openingQty = skuForm.stock ? Number(skuForm.stock) : 0;
          const openingBuy = skuForm.buyPrice ? Number(skuForm.buyPrice) : 0;
          const models = skuForm.models.split(/[\n,]+/).map((model) => model.trim()).filter(Boolean);
          const productNames = models.length ? models.map((model) => `${skuForm.name.trim()} — ${model}`) : [skuForm.name.trim()];
          productNames.forEach((productName, index) => addSku({
            name: productName,
            model: models[index] || '',
            category: skuForm.category,
            description: skuForm.description.trim(),
            barcode: models.length > 1 ? '' : skuForm.barcode.trim(),
            buyPrice: openingBuy,
            sellPrice: skuForm.sellPrice ? Number(skuForm.sellPrice) : 0,
            stock: openingQty,
            lowStockAt: skuForm.lowStockAt ? Number(skuForm.lowStockAt) : 5,
            supplierAccount: {
              company: skuForm.supplierCompany.trim(),
              total: Math.max(0, Number(skuForm.supplierTotal) || 0),
              paid: Math.max(0, Number(skuForm.supplierPaid) || 0),
              remaining: Math.max((Number(skuForm.supplierTotal) || 0) - (Number(skuForm.supplierPaid) || 0), 0),
              note: skuForm.supplierNote.trim(),
              invoiceImage: skuForm.invoiceImage,
              updatedAt: new Date().toISOString(),
              purchaseDate: skuForm.purchaseDate,
              dueDate: skuForm.dueDate || afterMonths(skuForm.purchaseDate),
            },
          }));
          setSkuForm(emptySkuForm);
          setAddSkuOpen(false);
          setSkuFormError('');
        };

        // --- Barcode Scanner for Inventory ---
        const handleSingleScan = () => {
          if (skuScanning && !bulkScanMode) { setSkuScanning(false); return; }
          setBulkScanMode(false);
          setAddSkuOpen(true);
          setSkuScanning(true);
        };

        const handleSingleScanResult = (code) => {
          setSkuForm((f) => ({ ...f, barcode: code }));
          setSkuScanning(false);
        };

        const handleBulkScanResult = (code) => {
          const alreadyInInventory = skus.some((sk) => sk.barcode === code || sk.code === code);
          if (alreadyInInventory) return;
          setScanQueue((prev) => {
            if (prev.some((p) => p.barcode === code)) return prev;
            return [...prev, { barcode: code, name: code, category: 'Altro', buyPrice: '', sellPrice: '', stock: '1', lowStockAt: '5', description: '' }];
          });
        };

        const addAllScannedToInventory = () => {
          scanQueue.forEach((item) => {
            addSku({
              name: item.name.trim() || item.barcode,
              category: item.category,
              description: item.description.trim(),
              barcode: item.barcode,
              buyPrice: item.buyPrice ? Number(item.buyPrice) : 0,
              sellPrice: item.sellPrice ? Number(item.sellPrice) : 0,
              stock: item.stock ? Number(item.stock) : 1,
              lowStockAt: item.lowStockAt ? Number(item.lowStockAt) : 5,
            });
          });
          const count = scanQueue.length;
          setScanQueue([]);
          setSkuScanning(false);
          setBulkScanMode(false);
          if (count > 0) alert(`${count} ${t('itemsAdded')}`);
        };

        const handleSkuMove = (skuId) => {
          const sk = skus.find((s) => s.id === skuId);
          if (!skuMoveForm.type) { setSkuMoveError(isItalian ? 'Scegli Vendita o Nuovo stock.' : 'Choose Sale or New stock.'); return; }
          if (!skuMoveForm.qty || Number(skuMoveForm.qty) <= 0) { setSkuMoveError(isItalian ? 'Inserisci una quantità valida.' : 'Enter a valid quantity.'); return; }
          if (skuMoveForm.type === 'out' && Number(skuMoveForm.qty) > Number(sk?.stock || 0)) { setSkuMoveError(isItalian ? 'Quantità superiore allo stock disponibile.' : 'Quantity exceeds available stock.'); return; }
          addSkuMovement(activeShop.id, skuId, {
            type: skuMoveForm.type,
            qty: Number(skuMoveForm.qty),
            note: skuMoveForm.note.trim(),
            price: skuMoveForm.price ? Number(skuMoveForm.price) : 0,
            skuName: sk?.name || '',
            buyPrice: sk?.buyPrice || 0,
            paymentMethod: skuMoveForm.type === 'out' ? skuMoveForm.paymentMethod : undefined,
          });
          setSkuMoveOpen(null);
          setSkuMoveForm({ type: '', qty: '', note: '', price: '', paymentMethod: 'cash' });
          setSkuMoveError('');
        };

        const handleSkuEdit = (skuId) => {
          updateSku(activeShop.id, skuId, {
            name: skuEditForm.name,
            category: skuEditForm.category,
            description: skuEditForm.description,
            model: skuEditForm.model || '',
            buyPrice: Number(skuEditForm.buyPrice) || 0,
            sellPrice: Number(skuEditForm.sellPrice) || 0,
            lowStockAt: Number(skuEditForm.lowStockAt) || 5,
          });
          setSkuEditId(null);
        };

        return (
          <div className="space-y-5">

            {/* Summary strip */}
            <div className="section-summary grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="rounded-2xl p-5 shadow-sm border border-lime-200" style={{ background: '#f1fec8' }}>
                <p className="text-2xl font-black text-gray-900">{skus.length}</p>
                <p className="text-sm text-gray-500 mt-1 font-medium">{t('productsSKUs')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{totalItems} {t('totalUnits')}</p>
              </div>
              <div className="rounded-2xl p-5 shadow-sm border border-lime-200" style={{ background: '#f1fec8' }}>
                <p className="text-xl font-black text-gray-900">{fmt(totalPurchased)}</p>
                <p className="text-sm text-gray-500 mt-1 font-medium">{isItalian ? 'Totale acquisti' : 'Total purchases'}</p>
                <p className="text-xs text-gray-400 mt-0.5">{isItalian ? 'Tutta la merce acquistata' : 'All products purchased'}</p>
              </div>
              <div className="rounded-2xl p-5 shadow-sm border border-lime-200" style={{ background: '#f1fec8' }}>
                <p className="text-xl font-black text-gray-900">{fmt(totalSold)}</p>
                <p className="text-sm text-gray-500 mt-1 font-medium">{isItalian ? 'Totale vendite' : 'Total sales'}</p>
                <p className="text-xs text-gray-400 mt-0.5">{isItalian ? 'Tutta la merce venduta' : 'All products sold'}</p>
              </div>
              <div className="rounded-2xl p-5 shadow-sm border border-lime-300" style={{ background: '#c6ff34' }}>
                <p className={`text-xl font-black ${totalStockProfit < 0 ? 'text-red-600' : 'text-gray-900'}`}>{fmt(totalStockProfit)}</p>
                <p className="text-sm text-gray-500 mt-1 font-medium">{t('stockProfitOnly')}</p>
                <p className="text-xs text-gray-400 mt-0.5">Sell − Buy × Qty Sold</p>
              </div>
              <div className={`rounded-2xl p-5 shadow-sm border ${lowStock.length > 0 ? 'border-amber-300' : 'border-lime-200'}`} style={{ background: lowStock.length > 0 ? '#fff7dc' : '#f1fec8' }}>
                <p className={`text-2xl font-black ${lowStock.length > 0 ? 'text-amber-700' : 'text-gray-900'}`}>{lowStock.length}</p>
                <p className="text-sm text-gray-500 mt-1 font-medium">{t('lowStockAlerts')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t('atOrBelowThreshold')}</p>
              </div>
            </div>

            {/* Low stock banner */}
            {lowStock.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-3 flex flex-wrap items-center gap-3">
                <svg className="w-5 h-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                <span className="text-sm font-semibold text-red-700">{t('lowStock')}:</span>
                {lowStock.map((sk) => (
                  <span key={sk.id} className="text-xs bg-red-100 text-red-600 font-semibold px-2.5 py-1 rounded-full">
                    {sk.name} — {sk.stock} {t('left')}
                  </span>
                ))}
              </div>
            )}

            {/* Toolbar */}
            <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="relative flex-1">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input className="w-full h-12 pl-12 pr-4 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-lime-100 focus:border-lime-400 placeholder-gray-400 bg-gray-50 focus:bg-white" placeholder={isItalian ? 'Cerca prodotto, SKU, modello, barcode, fornitore…' : 'Search product, SKU, model, barcode, supplier…'} value={skuSearch} onChange={(e) => setSkuSearch(e.target.value)} />
                </div>
                <button onClick={() => setAddSkuOpen(true)} className="flex items-center justify-center gap-1.5 px-5 h-12 text-black text-sm font-black rounded-xl transition-transform hover:-translate-y-0.5 shadow-sm shrink-0" style={{ background: '#c6ff34' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {t('addProduct')}
                </button>
                <button onClick={handleSingleScan} className={`flex items-center justify-center gap-1.5 px-5 h-12 text-sm font-black rounded-xl transition-colors shadow-sm shrink-0 ${skuScanning && !bulkScanMode ? 'bg-red-500 text-white' : 'border border-black/10 bg-white text-gray-900'}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 12h10" />
                </svg>
                {t('scanBarcode')}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                <select value={skuCatFilter} onChange={(e) => setSkuCatFilter(e.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-lime-400">
                  <option value="all">{isItalian ? 'Tutte le categorie' : 'All categories'}</option>
                  {SKU_CATS.map((category) => <option key={category} value={category}>{skuCatLabel[category] || category}</option>)}
                </select>
                <select value={skuStockFilter} onChange={(e) => setSkuStockFilter(e.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-lime-400">
                  <option value="all">{isItalian ? 'Tutti i livelli stock' : 'All stock levels'}</option>
                  <option value="available">{isItalian ? 'Disponibile' : 'In stock'}</option>
                  <option value="low">{isItalian ? 'Scorta bassa' : 'Low stock'}</option>
                  <option value="out">{isItalian ? 'Esaurito' : 'Out of stock'}</option>
                </select>
                <select value={skuSupplierFilter} onChange={(e) => setSkuSupplierFilter(e.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-lime-400">
                  <option value="all">{isItalian ? 'Tutti i fornitori' : 'All suppliers'}</option>
                  <option value="linked">{isItalian ? 'Con fornitore' : 'Has supplier'}</option>
                  <option value="due">{isItalian ? 'Pagamento dovuto' : 'Payment due'}</option>
                  <option value="paid">{isItalian ? 'Fornitore pagato' : 'Supplier paid'}</option>
                </select>
                <select value={skuSort} onChange={(e) => setSkuSort(e.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-lime-400">
                  <option value="name">{isItalian ? 'Ordina: Nome A–Z' : 'Sort: Name A–Z'}</option>
                  <option value="newest">{isItalian ? 'Più recenti' : 'Newest first'}</option>
                  <option value="stock_high">{isItalian ? 'Stock: alto → basso' : 'Stock: high → low'}</option>
                  <option value="stock_low">{isItalian ? 'Stock: basso → alto' : 'Stock: low → high'}</option>
                  <option value="value_high">{isItalian ? 'Valore: alto → basso' : 'Value: high → low'}</option>
                </select>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
                <span className="text-xs font-bold text-gray-500"><strong className="text-gray-900">{filtered.length}</strong> {isItalian ? `di ${skus.length} prodotti` : `of ${skus.length} products`}</span>
                {inventoryFiltersActive && <button type="button" onClick={clearInventoryFilters} className="px-4 py-2 rounded-xl text-xs font-black border border-black/10 hover:bg-gray-50">{isItalian ? 'Azzera tutti i filtri' : 'Clear all filters'}</button>}
              </div>
            </div>

            {/* Empty */}
            {filtered.length === 0 && !addSkuOpen && (
              <div className="bg-white rounded-2xl py-20 text-center border border-gray-200 shadow-sm">
                <svg className="w-14 h-14 mx-auto mb-4 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p className="text-gray-400 font-medium">{t('noProductsFound')}</p>
                <p className="text-gray-400 text-sm mt-1">{skuSearch || skuCatFilter !== 'all' ? t('tryClearingFilter') : t('addFirstSKU')}</p>
              </div>
            )}

            {/* Product cards */}
            {filtered.map((sk) => {
              const isLow = isLowStock(sk);
              const isMoveOpen = skuMoveOpen === sk.id;
              const isHistOpen = skuHistoryId === sk.id;
              const isEditing = skuEditId === sk.id;
              const margin = sk.sellPrice > 0 && sk.buyPrice >= 0
                ? (((sk.sellPrice - sk.buyPrice) / sk.sellPrice) * 100).toFixed(0)
                : null;
              const soldQty = (sk.movements || []).filter(m => m.type === 'out').reduce((s, m) => s + (Number(m.qty) || 0), 0);
              const productProfit = (sk.movements || []).filter(m => m.type === 'out').reduce((s, m) => {
                const salePrice = Number(m.price) || Number(sk.sellPrice) || 0;
                return s + (salePrice - (Number(sk.buyPrice) || 0)) * (Number(m.qty) || 1);
              }, 0);

              return (
                <div key={sk.id} className={`bg-white rounded-2xl shadow-sm border transition-colors ${isLow ? 'border-red-200' : 'border-gray-200 hover:border-indigo-100'
                  }`}>
                  <div className="p-4 sm:p-5">
                    <div className="grid grid-cols-1 md:grid-cols-[150px_minmax(0,1fr)_220px] gap-4 items-stretch">
                      <button type="button" onClick={() => sk.supplierAccount?.invoiceImage && setInvoicePreview(sk.supplierAccount.invoiceImage)} disabled={!sk.supplierAccount?.invoiceImage} className="relative w-full min-h-40 rounded-2xl overflow-hidden border border-black/10 bg-gray-50 group disabled:cursor-default">
                        {sk.supplierAccount?.invoiceImage ? filePreview(sk.supplierAccount.invoiceImage, true) : <div className="w-full h-full flex flex-col items-center justify-center text-gray-400"><svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4-4 4 4 3-3 5 5M4 4h16v16H4z" /></svg><span className="text-[10px] font-bold mt-2">{supplierText.upload}</span></div>}
                        {sk.supplierAccount?.invoiceImage && <span className="absolute left-2 bottom-2 px-2 py-1 rounded-lg bg-black/70 text-white text-[9px] font-bold">{isPdf(sk.supplierAccount.invoiceImage) ? (isItalian ? 'Apri fattura' : 'Open invoice') : (isItalian ? 'Apri foto fattura' : 'Open invoice image')}</span>}
                      </button>
                      {/* Left: info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-lg tracking-wider font-mono">{sk.code}</span>
                          <span className="text-xs font-semibold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg">{sk.category}</span>
                          {isLow && <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-lg flex items-center gap-1"><span className="w-1.5 h-1.5 bg-red-400 rounded-full" />{t('lowStock')}</span>}
                        </div>
                        {isEditing ? (
                          <div className="space-y-2 mt-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-0.5">{isItalian ? 'Nome' : 'Name'}</label>
                                <input className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" value={skuEditForm.name} onChange={(e) => setSkuEditForm((f) => ({ ...f, name: e.target.value }))} />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-0.5">{t('category')}</label>
                                <select className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" value={skuEditForm.category} onChange={(e) => setSkuEditForm((f) => ({ ...f, category: e.target.value }))}>
                                  {SKU_CATS.map((c) => <option key={c} value={c}>{skuCatLabel[c] || c}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-0.5">Prezzo Acquisto ({currencyObj.symbol})</label>
                                <input type="number" min="0" className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" value={skuEditForm.buyPrice} onChange={(e) => setSkuEditForm((f) => ({ ...f, buyPrice: e.target.value }))} />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-0.5">Prezzo Vendita ({currencyObj.symbol})</label>
                                <input type="number" min="0" className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" value={skuEditForm.sellPrice} onChange={(e) => setSkuEditForm((f) => ({ ...f, sellPrice: e.target.value }))} />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-0.5">{t('lowStockAlertAt')}</label>
                                <input type="number" min="0" className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" value={skuEditForm.lowStockAt} onChange={(e) => setSkuEditForm((f) => ({ ...f, lowStockAt: e.target.value }))} />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-0.5">{isItalian ? 'Descrizione' : 'Description'}</label>
                                <input className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" value={skuEditForm.description} onChange={(e) => setSkuEditForm((f) => ({ ...f, description: e.target.value }))} />
                              </div>
                              <div className="col-span-2">
                                <label className="block text-xs font-semibold text-gray-500 mb-0.5">{isItalian ? 'Modello / variante' : 'Model / variant'}</label>
                                <input className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lime-400" placeholder={isItalian ? 'Es. iPhone 15 Pro' : 'e.g. iPhone 15 Pro'} value={skuEditForm.model || ''} onChange={(e) => setSkuEditForm((f) => ({ ...f, model: e.target.value }))} />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => setSkuEditId(null)} className="flex-1 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors">{t('cancel')}</button>
                              <button onClick={() => handleSkuEdit(sk.id)} className="flex-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors">{isItalian ? 'Salva' : 'Save'}</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-base font-bold text-gray-900">{sk.name}</p>
                            {sk.model && <span className="inline-flex mt-1 px-2 py-0.5 rounded-lg text-[10px] font-black border border-lime-200" style={{ background: '#f1fec8' }}>{sk.model}</span>}
                            {sk.description && <p className="text-xs text-gray-400 mt-0.5">{sk.description}</p>}
                            <button type="button" onClick={() => sk.supplierAccount?.company && setSupplierInfoSku(sk)} className="w-full mt-3 rounded-xl border border-lime-200 px-3 py-2.5 text-left" style={{ background: '#f8ffe8' }}>
                              <span className="block text-[9px] uppercase tracking-wider font-black text-gray-500">{supplierText.button}</span>
                              <span className="block text-sm font-black truncate mt-0.5">{sk.supplierAccount?.company || (isItalian ? 'Fornitore non aggiunto' : 'No supplier added')}</span>
                            </button>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
                              <div className="rounded-xl bg-gray-50 border border-black/5 p-2.5"><span className="block text-[9px] uppercase font-bold text-gray-400">{t('buy')}</span><strong className="text-sm">{fmt(sk.buyPrice || 0)}</strong></div>
                              <div className="rounded-xl border border-black/5 p-2.5" style={{ background: '#f1fec8' }}><span className="block text-[9px] uppercase font-bold text-gray-500">{t('sell')}</span><strong className="text-sm text-emerald-700">{fmt(sk.sellPrice || 0)}</strong></div>
                              <div className="rounded-xl bg-gray-50 border border-black/5 p-2.5"><span className="block text-[9px] uppercase font-bold text-gray-400">{t('margin')}</span><strong className="text-sm">{margin !== null ? `${margin}%` : '—'}</strong></div>
                              <div className="rounded-xl bg-gray-50 border border-black/5 p-2.5"><span className="block text-[9px] uppercase font-bold text-gray-400">{t('stockValue')}</span><strong className="text-sm">{fmt((sk.stock || 0) * (sk.buyPrice || 0))}</strong></div>
                              {soldQty > 0 && (
                                <div className={`col-span-2 lg:col-span-4 text-xs px-2.5 py-2 rounded-lg font-semibold ${productProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                                  💰 {t('stockProfitOnly')}: {fmt(productProfit)} <span className="font-normal opacity-70">({soldQty} sold)</span>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Right: stock + actions */}
                      {!isEditing && (
                        <div className="flex flex-col gap-2 shrink-0 md:border-l md:border-gray-100 md:pl-4">
                          <div className={`flex items-center justify-between rounded-2xl px-4 py-3 ${isLow ? 'bg-red-50' : 'bg-amber-500/10'}`}>
                            <p className={`text-3xl font-bold ${isLow ? 'text-red-500' : 'text-amber-400'}`}>{sk.stock || 0}</p>
                            <p className="text-xs font-medium text-gray-400 mt-0.5">{isItalian ? 'in magazzino' : 'in stock'}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl bg-gray-50 p-2.5"><span className="block text-[9px] font-bold text-gray-400">{supplierText.total}</span><strong className="text-sm">{fmt(sk.supplierAccount?.total || 0)}</strong></div>
                            <div className={`rounded-xl p-2.5 ${Number(sk.supplierAccount?.remaining) > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}><span className="block text-[9px] font-bold text-gray-400">{supplierText.remaining}</span><strong className={`text-sm ${Number(sk.supplierAccount?.remaining) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmt(sk.supplierAccount?.remaining || 0)}</strong></div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2 gap-1.5">
                            <button onClick={() => openSupplierAccount(sk)} title="Conto fornitore"
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border border-lime-300 transition-colors" style={{ background: '#f1fec8', color: '#35420c' }}>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M5 7l1-3h12l1 3M5 7v13h14V7M9 11h6M9 15h6" /></svg>
                              {supplierText.button}
                            </button>
                            <button onClick={() => { setSkuMoveOpen(isMoveOpen ? null : sk.id); setSkuMoveForm({ type: '', qty: '', note: '', price: '', paymentMethod: 'cash' }); setSkuMoveError(''); }}
                              className="min-w-0 flex items-center justify-center gap-1 px-2 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-500/20 text-emerald-700 text-[10px] leading-tight font-bold border border-emerald-200 transition-colors text-center whitespace-normal">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg>
                              <span className="min-w-0 break-words">{isItalian ? 'Gestisci stock' : 'Stock action'}</span>
                            </button>
                            <button onClick={() => { setSkuEditId(sk.id); setSkuEditForm({ name: sk.name, model: sk.model || '', category: sk.category, description: sk.description || '', buyPrice: sk.buyPrice || '', sellPrice: sk.sellPrice || '', lowStockAt: sk.lowStockAt || 5 }); }}
                              className="flex items-center justify-center p-2 rounded-xl border border-gray-200 hover:border-amber-400 hover:bg-amber-500/10 text-gray-500 hover:text-amber-500 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button onClick={() => setSkuDeleteId(sk.id)}
                              className="flex items-center justify-center p-2 rounded-xl border border-gray-200 hover:border-red-300 hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                          {sk.movements && sk.movements.length > 0 && (
                            <button onClick={() => setSkuHistoryId(isHistOpen ? null : sk.id)}
                              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors">
                              Cronologia ({sk.movements.length})
                              <svg className={`w-3 h-3 transition-transform ${isHistOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Stock movement form */}
                    {isMoveOpen && !isEditing && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wide">{isItalian ? 'Scegli operazione stock' : 'Choose stock action'}</p>
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{isItalian ? 'Tipo' : 'Type'}</label>
                            <div className="flex gap-2">
                              {[['out', isItalian ? 'Vendita' : 'Sale'], ['in', isItalian ? 'Nuovo stock' : 'New stock']].map(([v, l]) => (
                                <button key={v} onClick={() => {
                                  const defaultPrice = v === 'out' ? (sk.sellPrice || '') : (sk.buyPrice || '');
                                  setSkuMoveForm((f) => ({ ...f, type: v, price: String(defaultPrice) }));
                                }}
                                  className={`px-5 py-3 rounded-2xl text-xs font-black border transition-all ${skuMoveForm.type === v
                                    ? v === 'in' ? 'bg-amber-500 text-white border-amber-500' : 'bg-red-500 text-white border-red-500'
                                    : 'border-gray-200 text-gray-500 hover:border-amber-400'
                                    }`}>{l}</button>
                              ))}
                            </div>
                          </div>
                          {skuMoveForm.type && <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{t('quantity')}</label>
                            <input type="number" min="1" placeholder="e.g. 10"
                              className="w-24 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
                              value={skuMoveForm.qty} onChange={(e) => setSkuMoveForm((f) => ({ ...f, qty: e.target.value }))} autoFocus />
                          </div>}
                          {skuMoveForm.type && <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">
                              {skuMoveForm.type === 'in' ? `Buy Price (${currencyObj.symbol})` : `Sell Price (${currencyObj.symbol})`}
                            </label>
                            <input type="number" min="0" placeholder={t('perUnit')}
                              className="w-28 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
                              value={skuMoveForm.price} onChange={(e) => setSkuMoveForm((f) => ({ ...f, price: e.target.value }))} />
                          </div>}
                          {skuMoveForm.type && <div className="flex-1 min-w-32">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{supplierText.note}</label>
                            <input placeholder={t('supplierReason')}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
                              value={skuMoveForm.note} onChange={(e) => setSkuMoveForm((f) => ({ ...f, note: e.target.value }))} />
                          </div>}
                          {skuMoveForm.type === 'out' && <div><label className="block text-xs font-semibold text-gray-500 mb-1">{isItalian ? 'Pagamento' : 'Payment'}</label><div className="flex rounded-xl border border-gray-200 bg-gray-50 p-1">{[['cash', isItalian ? 'Contanti' : 'Cash'], ['card', 'POS']].map(([method, label]) => <button type="button" key={method} onClick={() => setSkuMoveForm((form) => ({ ...form, paymentMethod: method }))} className={`px-3 py-1.5 rounded-lg text-xs font-black ${skuMoveForm.paymentMethod === method ? 'bg-white shadow-sm text-black' : 'text-gray-400'}`}>{label}</button>)}</div></div>}
                          {skuMoveForm.type && <div className="flex gap-2">
                            <button onClick={() => handleSkuMove(sk.id)}
                              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors">{isItalian ? 'Salva' : 'Save'}</button>
                            <button onClick={() => setSkuMoveOpen(null)}
                              className="px-3 py-2 border border-gray-200 text-gray-500 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">{t('cancel')}</button>
                          </div>}
                        </div>
                        {skuMoveError && <p className="mt-2 text-xs font-bold text-red-500">{skuMoveError}</p>}
                        {/* Live profit preview when selling */}
                        {skuMoveForm.type === 'out' && skuMoveForm.qty > 0 && skuMoveForm.price > 0 && (() => {
                          const qty = Number(skuMoveForm.qty) || 0;
                          const price = Number(skuMoveForm.price) || 0;
                          const cost = (sk.buyPrice || 0) * qty;
                          const rev = price * qty;
                          const profit = rev - cost;
                          return (
                            <div className="mt-3 flex flex-wrap gap-3 p-3 bg-gray-50 rounded-xl text-xs font-semibold">
                              <span className="text-gray-500">{isItalian ? 'Ricavi' : 'Revenue'}: <span className="text-gray-800">{fmt(rev)}</span></span>
                              <span className="text-gray-500">{isItalian ? 'Costo' : 'Cost'}: <span className="text-gray-800">{fmt(cost)}</span></span>
                              <span className={profit >= 0 ? 'text-green-600' : 'text-red-500'}>
                                Profit: {profit >= 0 ? '+' : ''}{fmt(profit)}
                              </span>
                              <span className="text-gray-400">Stock after: {Math.max(0, (sk.stock || 0) - qty)}</span>
                            </div>
                          );
                        })()}
                        {/* Info tag: auto-creates transaction */}
                        {Number(skuMoveForm.price) > 0 && (
                          <p className="mt-2 text-xs text-amber-600 font-medium">
                            ⚡ {skuMoveForm.type === 'in' ? 'An expense will be auto-added to Transactions' : 'A sale income will be auto-added to Transactions'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Movement history */}
                  {isHistOpen && sk.movements && sk.movements.length > 0 && (
                    <div className="border-t border-gray-200 px-5 pb-4 pt-3">
                      <p className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wide">{t('movementHistory')}</p>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {sk.movements.map((mv) => (
                          <div key={mv.id} className="flex items-center gap-3 text-xs">
                            <span className={`w-14 text-center font-bold px-2 py-0.5 rounded-full shrink-0 ${mv.type === 'in' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-500'
                              }`}>{mv.type === 'in' ? '+' : '−'}{mv.qty}</span>
                            <span className="text-gray-400">{fmtDate(mv.date)}</span>
                            {mv.price > 0 && <span className="text-gray-500 font-medium">{fmt(mv.price)}/unit</span>}
                            {mv.type === 'out' && mv.price > 0 && sk.buyPrice > 0 && (
                              <span className={`font-bold ${(mv.price - sk.buyPrice) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {(mv.price - sk.buyPrice) >= 0 ? '+' : ''}{fmt((mv.price - sk.buyPrice) * (mv.qty || 1))} profit
                              </span>
                            )}
                            {mv.note && <span className="text-gray-400 truncate">{mv.note}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Bulk Scan Mode UI */}
            {bulkScanMode && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-blue-400/40 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-blue-600">{t('bulkScanMode')} — {t('scanNextProduct')}</p>
                  <button onClick={() => { setSkuScanning(false); setBulkScanMode(false); }}
                    className="text-red-500 hover:text-red-700 text-xs font-semibold">{t('stopScanning')}</button>
                </div>
                <BarcodeScanner
                  active={skuScanning && bulkScanMode}
                  onScan={handleBulkScanResult}
                  onError={(msg) => console.error(msg)}
                />
                {scanQueue.length > 0 && (
                  <>
                    <p className="text-xs font-bold text-gray-500 uppercase">{t('scannedItems')} ({scanQueue.length})</p>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {scanQueue.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5 border border-gray-200">
                          <span className="text-xs font-mono font-bold text-blue-600 shrink-0">{item.barcode}</span>
                          <input className="flex-1 px-2 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                            placeholder={t('productName')} value={item.name}
                            onChange={(e) => setScanQueue((prev) => prev.map((it, i) => i === idx ? { ...it, name: e.target.value } : it))} />
                          <input type="number" min="0" className="w-20 px-2 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                            placeholder="Qty" value={item.stock}
                            onChange={(e) => setScanQueue((prev) => prev.map((it, i) => i === idx ? { ...it, stock: e.target.value } : it))} />
                          <input type="number" min="0" className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                            placeholder={`Buy ${currencyObj.symbol}`} value={item.buyPrice}
                            onChange={(e) => setScanQueue((prev) => prev.map((it, i) => i === idx ? { ...it, buyPrice: e.target.value } : it))} />
                          <input type="number" min="0" className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                            placeholder={`Sell ${currencyObj.symbol}`} value={item.sellPrice}
                            onChange={(e) => setScanQueue((prev) => prev.map((it, i) => i === idx ? { ...it, sellPrice: e.target.value } : it))} />
                          <button onClick={() => setScanQueue((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-red-400 hover:text-red-600 shrink-0">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setScanQueue([])}
                        className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm">{t('clearList')}</button>
                      <button onClick={addAllScannedToInventory}
                        className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-colors text-sm shadow-sm">{t('addAllToInventory')}</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Add product form */}
            {addSkuOpen && !bulkScanMode ? (
              <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-dashed border-amber-500/30">
                <p className="text-sm font-bold text-amber-400 mb-4">{t('newProductSKU')}</p>
                {/* Scanner region for single scan */}
                <BarcodeScanner
                  active={skuScanning && !bulkScanMode}
                  onScan={handleSingleScanResult}
                  onError={(msg) => setSkuFormError(msg)}
                  style={{ marginBottom: '16px' }}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{t('barcodeField')}</label>
                    <div className="flex gap-2">
                      <input type="text" placeholder="e.g. 8901234567890"
                        className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400 font-mono"
                        value={skuForm.barcode}
                        onChange={(e) => { setSkuForm((f) => ({ ...f, barcode: e.target.value })); setSkuFormError(''); }} />
                      <button type="button" onClick={handleSingleScan}
                        className={`px-3 py-2.5 rounded-xl border transition-all ${skuScanning ? 'bg-red-50 border-red-300 text-red-600' : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          {skuScanning ? (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          ) : (
                            <><path strokeLinecap="round" strokeLinejoin="round" d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" /><path strokeLinecap="round" strokeLinejoin="round" d="M7 12h10" /></>
                          )}
                        </svg>
                      </button>
                    </div>
                  </div>
                  {[
                    ['name', t('productName'), 'Screen Assembly — iPhone 14', 'text'],
                    ['buyPrice', `${t('buyCostPrice')} (${currencyObj.symbol})`, '8500', 'number'],
                    ['sellPrice', `${t('sellPrice')} (${currencyObj.symbol})`, '12000', 'number'],
                    ['stock', t('openingStock'), '10', 'number'],
                    ['lowStockAt', t('lowStockAlertAt'), '3', 'number'],
                  ].map(([key, label, ph, type]) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                      <input type={type} min={type === 'number' ? '0' : undefined} placeholder={ph}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
                        value={skuForm[key]}
                        onChange={(e) => { setSkuForm((f) => ({ ...f, [key]: e.target.value })); setSkuFormError(''); }}
                        autoFocus={key === 'name'} />
                    </div>
                  ))}
                  <div className="sm:col-span-2 rounded-2xl border border-lime-200 p-3" style={{ background: '#f8ffe8' }}>
                    <label className="block text-xs font-black text-gray-700 mb-1">{isItalian ? 'Modelli / varianti (opzionale)' : 'Models / variants (optional)'}</label>
                    <textarea rows="3" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-lime-400" placeholder={isItalian ? 'Un modello per riga, es.\niPhone 13\niPhone 14\niPhone 15 Pro' : 'One model per line, e.g.\niPhone 13\niPhone 14\niPhone 15 Pro'} value={skuForm.models} onChange={(e) => setSkuForm((form) => ({ ...form, models: e.target.value }))} />
                    <p className="text-[10px] text-gray-500 mt-1.5">{isItalian ? 'Ogni modello verrà creato come prodotto/SKU separato con gli stessi prezzi, stock e dati fornitore.' : 'Each model will be created as a separate product/SKU with the same prices, stock and supplier details.'}</p>
                    {skuForm.models.trim() && <span className="inline-block mt-2 px-2.5 py-1 rounded-full text-[10px] font-black" style={{ background: '#c6ff34' }}>{skuForm.models.split(/[\n,]+/).filter((model) => model.trim()).length} {isItalian ? 'SKU da creare' : 'SKUs to create'}</span>}
                  </div>
                  <div className="relative">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{t('category')}</label>
                    <button type="button" onClick={() => setCategoryOpen((open) => !open)} className="w-full flex items-center justify-between gap-3 px-3 py-2.5 border border-lime-200 rounded-xl text-sm font-bold bg-white hover:border-lime-400 focus:outline-none focus:ring-2 focus:ring-lime-300"><span>{skuCatLabel[skuForm.category] || skuForm.category}</span><svg className={`w-4 h-4 transition-transform ${categoryOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6 6 6-6" /></svg></button>
                    {categoryOpen && <div className="absolute z-30 left-0 right-0 top-full mt-2 rounded-2xl border border-black/10 bg-white p-1.5 shadow-2xl">{SKU_CATS.map((category) => <button type="button" key={category} onClick={() => { setSkuForm((form) => ({ ...form, category })); setCategoryOpen(false); }} className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-left hover:bg-lime-50" style={skuForm.category === category ? { background: '#c6ff34' } : undefined}><span>{skuCatLabel[category] || category}</span>{skuForm.category === category && <span>✓</span>}</button>)}</div>}
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{t('descriptionOptional')}</label>
                  <input placeholder="e.g. Compatible with iPhone 14 / 14 Plus"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
                    value={skuForm.description} onChange={(e) => setSkuForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="mb-4 rounded-2xl border border-lime-200 p-4" style={{ background: '#f8ffe8' }}>
                  <div className="flex items-center gap-2 mb-3"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M5 7l1-3h12l1 3M5 7v13h14V7" /></svg><p className="text-xs uppercase tracking-wider font-black">{supplierText.section}</p></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">{supplierText.company}</label><input className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white" placeholder={supplierText.companyPlaceholder} value={skuForm.supplierCompany} onChange={(e) => setSkuForm((form) => ({ ...form, supplierCompany: e.target.value }))} /></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">{supplierText.total}</label><input type="number" min="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white" value={skuForm.supplierTotal} onChange={(e) => setSkuForm((form) => ({ ...form, supplierTotal: e.target.value }))} /></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">{supplierText.alreadyPaid}</label><input type="number" min="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white" value={skuForm.supplierPaid} onChange={(e) => setSkuForm((form) => ({ ...form, supplierPaid: e.target.value }))} /></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">{supplierText.purchaseDate}</label><input type="date" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white" value={skuForm.purchaseDate} onChange={(e) => setSkuForm((form) => ({ ...form, purchaseDate: e.target.value, dueDate: afterMonths(e.target.value) }))} /></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">{supplierText.dueDate}</label><div className="flex gap-1"><input type="date" className="min-w-0 flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white" value={skuForm.dueDate} onChange={(e) => setSkuForm((form) => ({ ...form, dueDate: e.target.value }))} /><button type="button" onClick={() => setSkuForm((form) => ({ ...form, dueDate: afterMonths(form.purchaseDate) }))} className="px-2 rounded-xl border border-lime-300 text-[9px] font-black bg-white">2M</button></div></div>
                    <div className="sm:col-span-2 flex items-center justify-between rounded-xl bg-white border border-black/5 p-3"><span className="text-xs font-bold">{supplierText.remaining}</span><strong>{fmt(Math.max((Number(skuForm.supplierTotal) || 0) - (Number(skuForm.supplierPaid) || 0), 0))}</strong></div>
                    <div className="sm:col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">{supplierText.noteInvoice}</label><input className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white" value={skuForm.supplierNote} onChange={(e) => setSkuForm((form) => ({ ...form, supplierNote: e.target.value }))} /></div>
                    <div className="sm:col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">{supplierText.image}</label><label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-lime-300 bg-white p-3 cursor-pointer text-xs font-bold"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4-4 4 4 3-3 5 5M4 4h16v16H4z" /></svg>{supplierText.upload}<input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setSkuForm((form) => ({ ...form, invoiceImage: reader.result })); reader.readAsDataURL(file); }} /></label>{skuForm.invoiceImage && <div className="relative mt-2">{filePreview(skuForm.invoiceImage)}<button type="button" onClick={() => setSkuForm((form) => ({ ...form, invoiceImage: '' }))} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-500 text-white font-black">×</button></div>}</div>
                  </div>
                </div>
                {skuFormError && <p className="text-xs text-red-500 mb-3">{skuFormError}</p>}
                <div className="flex gap-3">
                  <button onClick={() => { setAddSkuOpen(false); setSkuScanning(false); setSkuFormError(''); setSkuForm(emptySkuForm); }}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm">{t('cancel')}</button>
                  <button onClick={handleAddSku}
                    className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors text-sm shadow-sm">{t('addProduct')}</button>
                </div>
              </div>
            ) : !bulkScanMode && (
              <button onClick={() => setAddSkuOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-gray-200 text-gray-400 font-semibold rounded-2xl hover:border-amber-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {t('addNewProductSKU')}
              </button>
            )}

            {/* SKU delete confirm */}
            {supplierInfoSku && (
              <div className="fixed inset-0 z-[75] bg-black/45 backdrop-blur-sm p-4 flex items-center justify-center" onMouseDown={(event) => event.target === event.currentTarget && setSupplierInfoSku(null)}>
                <div className="w-full max-w-md rounded-3xl bg-white border border-black/10 shadow-2xl overflow-hidden">
                  <div className="p-5 flex items-start justify-between gap-3" style={{ background: 'linear-gradient(135deg,#c6ff34,#f1fec8)' }}><div><p className="text-[10px] uppercase tracking-[.16em] font-black text-gray-600">{supplierText.button}</p><h3 className="text-2xl font-black mt-1">{supplierInfoSku.supplierAccount?.company}</h3></div><button type="button" onClick={() => setSupplierInfoSku(null)} className="w-9 h-9 rounded-full bg-white/75 border border-black/10 font-black">×</button></div>
                  <div className="p-5 space-y-3">
                    <div className="grid grid-cols-3 gap-2"><div className="rounded-xl bg-gray-50 p-3"><span className="block text-[9px] font-bold text-gray-400">{supplierText.total}</span><strong className="text-sm">{fmt(supplierInfoSku.supplierAccount?.total || 0)}</strong></div><div className="rounded-xl bg-emerald-50 p-3"><span className="block text-[9px] font-bold text-gray-400">{supplierText.alreadyPaid}</span><strong className="text-sm text-emerald-700">{fmt(supplierInfoSku.supplierAccount?.paid || 0)}</strong></div><div className="rounded-xl bg-red-50 p-3"><span className="block text-[9px] font-bold text-gray-400">{supplierText.remaining}</span><strong className="text-sm text-red-600">{fmt(supplierInfoSku.supplierAccount?.remaining || 0)}</strong></div></div>
                    <div className="grid grid-cols-2 gap-2"><div className="rounded-xl border border-gray-200 p-3"><span className="block text-[9px] font-bold text-gray-400">{supplierText.purchaseDate}</span><strong className="text-xs">{fmtDate(supplierInfoSku.supplierAccount?.purchaseDate)}</strong></div><div className={`rounded-xl border p-3 ${Number(supplierInfoSku.supplierAccount?.remaining) <= 0 ? 'bg-emerald-50 border-emerald-100' : supplierInfoSku.supplierAccount?.dueDate < todayKey() ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}><span className="block text-[9px] font-bold text-gray-400">{supplierText.dueDate}</span><strong className="text-xs">{Number(supplierInfoSku.supplierAccount?.remaining) <= 0 ? supplierText.paid : `${fmtDate(supplierInfoSku.supplierAccount?.dueDate)} · ${supplierInfoSku.supplierAccount?.dueDate < todayKey() ? supplierText.overdue : supplierText.pending}`}</strong></div></div>
                    {supplierInfoSku.supplierAccount?.note && <div className="rounded-xl border border-gray-200 p-3"><span className="block text-[9px] uppercase font-bold text-gray-400">{supplierText.note}</span><p className="text-sm font-semibold mt-1 whitespace-pre-wrap">{supplierInfoSku.supplierAccount.note}</p></div>}
                    {supplierInfoSku.supplierAccount?.invoiceImage && <button type="button" onClick={() => { setInvoicePreview(supplierInfoSku.supplierAccount.invoiceImage); setSupplierInfoSku(null); }} className="w-full flex items-center gap-3 rounded-xl border border-gray-200 p-2 text-left"><div className="w-14 h-14 rounded-lg overflow-hidden">{filePreview(supplierInfoSku.supplierAccount.invoiceImage, true)}</div><div><strong className="block text-xs">{supplierText.image}</strong><span className="text-[10px] text-gray-400">{isItalian ? 'Apri immagine' : 'View image'} →</span></div></button>}
                    <button type="button" onClick={() => setSupplierInfoSku(null)} className="w-full py-3 rounded-xl font-black border border-black/10" style={{ background: '#c6ff34' }}>{isItalian ? 'Chiudi' : 'Close'}</button>
                  </div>
                </div>
              </div>
            )}

            {invoicePreview && (
              <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center" onMouseDown={(event) => event.target === event.currentTarget && setInvoicePreview(null)}>
                <div className="relative max-w-5xl max-h-[92vh]">
                  {isPdf(invoicePreview) ? <iframe src={invoicePreview} title={supplierText.pdf} className="w-[min(92vw,900px)] h-[86vh] rounded-2xl bg-white shadow-2xl" /> : <img src={invoicePreview} alt={supplierText.imageAlt} className="max-w-full max-h-[88vh] object-contain rounded-2xl shadow-2xl bg-white" />}
                  <button type="button" onClick={() => setInvoicePreview(null)} className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-white text-black shadow-xl font-black text-xl">×</button>
                </div>
              </div>
            )}

            {supplierOpenId && (
              <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onMouseDown={(event) => event.target === event.currentTarget && setSupplierOpenId(null)}>
                <div className="bg-white rounded-3xl shadow-2xl border border-black/10 p-5 sm:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
                  <div className="flex items-start justify-between gap-3 mb-5"><div><p className="text-[10px] uppercase tracking-[.15em] font-black text-gray-400">{supplierText.account}</p><h3 className="text-xl font-black mt-1">{supplierText.section}</h3></div><button onClick={() => setSupplierOpenId(null)} className="w-9 h-9 rounded-full border border-gray-200 font-black">×</button></div>
                  <div className="space-y-3">
                    <div><label className="block text-xs font-bold text-gray-600 mb-1">{supplierText.company}</label><input className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder={supplierText.companyPlaceholder} value={supplierForm.company} onChange={(e) => setSupplierForm((form) => ({ ...form, company: e.target.value }))} /></div>
                    <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-bold text-gray-600 mb-1">{supplierText.total}</label><input type="number" min="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" value={supplierForm.total} onChange={(e) => setSupplierForm((form) => ({ ...form, total: e.target.value }))} /></div><div><label className="block text-xs font-bold text-gray-600 mb-1">{supplierText.alreadyPaid}</label><input type="number" min="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" value={supplierForm.paid} onChange={(e) => setSupplierForm((form) => ({ ...form, paid: e.target.value }))} /></div></div>
                    <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-bold text-gray-600 mb-1">{supplierText.purchaseDate}</label><input type="date" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm" value={supplierForm.purchaseDate} onChange={(e) => setSupplierForm((form) => ({ ...form, purchaseDate: e.target.value, dueDate: afterMonths(e.target.value) }))} /></div><div><label className="block text-xs font-bold text-gray-600 mb-1">{supplierText.dueDate}</label><div className="flex gap-1"><input type="date" className="min-w-0 flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm" value={supplierForm.dueDate} onChange={(e) => setSupplierForm((form) => ({ ...form, dueDate: e.target.value }))} /><button type="button" onClick={() => setSupplierForm((form) => ({ ...form, dueDate: afterMonths(form.purchaseDate) }))} className="px-2 rounded-xl border border-lime-300 text-[9px] font-black">2M</button></div></div></div>
                    <div className="rounded-2xl p-4 flex items-center justify-between" style={{ background: '#f1fec8' }}><span className="text-xs font-black">{supplierText.remainingDue}</span><strong className="text-xl">{fmt(Math.max((Number(supplierForm.total) || 0) - (Number(supplierForm.paid) || 0), 0))}</strong></div>
                    <div><label className="block text-xs font-bold text-gray-600 mb-1">{supplierText.note}</label><textarea rows="2" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none" placeholder={supplierText.notePlaceholder} value={supplierForm.note} onChange={(e) => setSupplierForm((form) => ({ ...form, note: e.target.value }))} /></div>
                    <div><label className="block text-xs font-bold text-gray-600 mb-1">{supplierText.image}</label><label className="flex items-center justify-center gap-2 w-full rounded-2xl border-2 border-dashed border-lime-300 p-4 cursor-pointer hover:bg-lime-50 text-xs font-black"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4-4 4 4 3-3 5 5M4 4h16v16H4z" /></svg>{supplierText.upload}<input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => loadInvoiceImage(e.target.files?.[0])} /></label>{supplierForm.invoiceImage && <div className="relative mt-2">{filePreview(supplierForm.invoiceImage)}<button type="button" onClick={() => setSupplierForm((form) => ({ ...form, invoiceImage: '' }))} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 text-white font-black">×</button></div>}</div>
                  </div>
                  <div className="flex gap-3 mt-5"><button onClick={() => setSupplierOpenId(null)} className="flex-1 px-4 py-2.5 border border-gray-200 font-bold rounded-xl">{supplierText.cancel}</button><button onClick={() => saveSupplierAccount(supplierOpenId)} className="flex-1 px-4 py-2.5 font-black rounded-xl border border-black/10" style={{ background: '#c6ff34' }}>{supplierText.save}</button></div>
                </div>
              </div>
            )}

            {skuDeleteId && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{t('deleteProduct')}</h3>
                  <p className="text-sm text-gray-500 mb-6">{t('deleteProductWarning')}</p>
                  <div className="flex gap-3">
                    <button onClick={() => setSkuDeleteId(null)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors">{t('cancel')}</button>
                    <button onClick={() => { deleteSku(activeShop.id, skuDeleteId); setSkuDeleteId(null); }} className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors">{t('delete')}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
}
