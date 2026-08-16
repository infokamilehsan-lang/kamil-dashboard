import { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { useLanguage } from '../context/LanguageContext';
import { useFmt } from '../lib/useFmt';
import { sendClientEmail } from '../lib/emailService';

export default function RepairsPage() {
  const { activeShop, addRepair, updateRepair, deleteRepair, addRepairOrder, updateRepairOrder, deleteRepairOrder, addOrUpdateContact, emailSettings } = useShop();
  const { t, locale } = useLanguage();
  const { fmt, fmtDate, currencyObj } = useFmt();
  const isItalian = String(locale).startsWith('it');

  const [repairFilter, setRepairFilter] = useState('all');
  const [repairSearch, setRepairSearch] = useState('');
  const [repairLocationFilter, setRepairLocationFilter] = useState('all');
  const [repairPaymentFilter, setRepairPaymentFilter] = useState('all');
  const [repairSort, setRepairSort] = useState('newest');
  const [addRepairOpen, setAddRepairOpen] = useState(false);
  const emptyRepairForm = { customerName: '', phone: '', device: '', imei: '', issue: '', partsOrdered: '', partsCost: '', repairCost: '', advance: '', notes: '', email: '', paymentMethod: 'cash', deviceLocation: 'shop' };
  const [repairForm, setRepairForm] = useState(emptyRepairForm);
  const [repairFormError, setRepairFormError] = useState('');
  const [repairDeleteId, setRepairDeleteId] = useState(null);
  const [repairEditId, setRepairEditId] = useState(null);
  const [summaryPopup, setSummaryPopup] = useState(null);
  const [summarySearch, setSummarySearch] = useState('');
  const [custodyOpenId, setCustodyOpenId] = useState(null);

  const [repairPayOpenId, setRepairPayOpenId] = useState(null);
  const [repairPayAmt, setRepairPayAmt] = useState('');
  const [repairPayNote, setRepairPayNote] = useState('');
  const [repairPayError, setRepairPayError] = useState('');
  const [repairPayMethod, setRepairPayMethod] = useState('cash');

  const [orderOpenId, setOrderOpenId] = useState(null); // repairId whose order form is open
  const [orderForm, setOrderForm] = useState({ item: '', cost: '', supplier: '' });
  const [orderFormError, setOrderFormError] = useState('');

  const handleAddRepair = () => {
    if (!repairForm.customerName.trim()) { setRepairFormError(t('customerNameRequired')); return; }
    if (!repairForm.device.trim()) { setRepairFormError(t('deviceRequired')); return; }
    const repairData = {
      customerName: repairForm.customerName.trim(),
      phone: repairForm.phone.trim(),
      device: repairForm.device.trim(),
      imei: repairForm.imei.trim(),
      issue: repairForm.issue.trim(),
      partsOrdered: repairForm.partsOrdered.trim(),
      partsCost: repairForm.partsCost ? Number(repairForm.partsCost) : 0,
      repairCost: repairForm.repairCost ? Number(repairForm.repairCost) : 0,
      advance: repairForm.advance ? Number(repairForm.advance) : 0,
      notes: repairForm.notes.trim(),
      email: repairForm.email.trim(),
      paymentMethod: repairForm.paymentMethod || 'cash',
      deviceLocation: repairForm.deviceLocation || 'shop',
    };
    if (repairEditId) updateRepair(activeShop.id, repairEditId, repairData);
    else addRepair(repairData);
    if (repairForm.phone.trim() || repairForm.email.trim()) {
      addOrUpdateContact({
        name: repairForm.customerName.trim(),
        email: repairForm.email.trim(),
        phone: repairForm.phone.trim(),
      });
    }
    setRepairForm(emptyRepairForm);
    setAddRepairOpen(false);
    setRepairEditId(null);
    setRepairFormError('');
  };

  const printRepair = (repair) => {
    const price = Number(repair.repairCost) || 0;
    const paid = Number(repair.advance) || 0;
    const due = Math.max(0, price - paid);
    const location = repair.deviceLocation || 'shop';
    const locationLabel = location === 'client'
      ? (String(locale).startsWith('it') ? 'Telefono dal cliente' : 'Phone with client')
      : location === 'collected'
        ? (String(locale).startsWith('it') ? 'Ritirato dal cliente' : 'Collected by client')
        : (String(locale).startsWith('it') ? 'Telefono in negozio' : 'Phone in shop');
    const printable = window.open('', '_blank', 'width=760,height=900');
    if (!printable) return;
    const safe = (value) => String(value || '—').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
    let logo = activeShop.image ? `<img class="logo" src="${safe(activeShop.image)}" alt="Logo">` : `<div class="logo fallback">${safe(activeShop.name?.charAt(0)?.toUpperCase())}</div>`;
    const shopInfo = [activeShop.description, [activeShop.address, activeShop.city].filter(Boolean).join(', '), activeShop.phone, activeShop.email]
      .filter(Boolean).map((value) => `<span>${safe(value)}</span>`).join('');
    const businessInfo = [['Ragione sociale', activeShop.ragioneSociale], ['P. IVA', activeShop.partitaIva], ['C.F.', activeShop.codiceFiscale], ['Telefono', activeShop.phone], ['WhatsApp', activeShop.whatsapp], ['Email', activeShop.pec], ['SDI', activeShop.sdiCode], ['REA', activeShop.rea]]
      .filter(([, value]) => value).map(([label, value]) => `<span><b>${label}:</b> ${safe(value)}</span>`).join('');
    logo = `<style>.brand>div+div{display:none}</style><div style="display:flex;align-items:flex-start;gap:12px">${logo}<div style="max-width:430px"><div style="font-size:20px;font-weight:900;letter-spacing:-.04em;margin-bottom:6px">${safe(activeShop.name)}</div>${shopInfo ? `<div style="display:flex;flex-wrap:wrap;gap:3px 9px;font-size:9px;line-height:1.35;color:#4d5732">${shopInfo}</div>` : ''}${businessInfo ? `<div style="display:flex;flex-wrap:wrap;gap:3px 9px;margin-top:6px;padding-top:6px;border-top:1px solid rgba(16,20,8,.14);font-size:8px;line-height:1.35;color:#4d5732">${businessInfo}</div>` : ''}</div></div>`;
    printable.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Repair ${safe(repair.customerName)}</title><style>*{box-sizing:border-box}body{margin:0;background:#f4f6ee;font-family:Inter,Arial,sans-serif;color:#101408}.page{width:100%;max-width:760px;margin:24px auto;background:#fff;border:1px solid #e1e7d3;border-radius:26px;overflow:hidden;box-shadow:0 24px 60px rgba(47,63,10,.12)}header{display:flex;justify-content:space-between;align-items:flex-start;padding:28px;background:linear-gradient(135deg,#c6ff34,#f1fec8)}.brand{display:flex;align-items:center;gap:14px}.logo{width:58px;height:58px;border-radius:16px;object-fit:cover;background:#fff;border:1px solid rgba(16,20,8,.12)}.fallback{display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900}.brand h1{margin:0;font-size:24px;letter-spacing:-.04em}.brand p{margin:5px 0 0;font-size:11px;color:#4d5732}.doc{text-align:right}.doc strong{display:block;font-size:12px}.doc span{display:block;font-size:10px;margin-top:5px;color:#4d5732}.content{padding:26px}.topline{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}.topline h2{margin:0;font-size:18px}.badge{background:#101408;color:#fff;padding:7px 12px;border-radius:999px;font-size:10px;font-weight:800}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.box{border:1px solid #dfe5cd;border-radius:14px;padding:13px;background:#fcfff5}.label{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#697250;font-weight:800}.value{font-size:14px;font-weight:800;margin-top:5px;word-break:break-word}.finance{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}.money{padding:15px;border-radius:15px;background:#f1fec8}.money.due{background:#101408;color:#fff}.money.due .label{color:#cbd4b5}.money strong{display:block;font-size:18px;margin-top:6px}.money.due strong{color:#c6ff34}.notes{margin-top:18px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:42px}.sign{border-top:1px solid #aeb79b;padding-top:7px;font-size:9px;text-transform:uppercase;color:#697250}.footer{margin-top:28px;padding-top:14px;border-top:1px solid #e1e7d3;display:flex;justify-content:space-between;gap:20px;font-size:9px;color:#73786a}@media print{body{background:#fff}.page{margin:0;max-width:none;border:0;border-radius:0;box-shadow:none}header{-webkit-print-color-adjust:exact;print-color-adjust:exact}.money,.badge{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="page"><header><div class="brand">${logo}<div><h1>${safe(activeShop.name)}</h1><p>${safe([activeShop.city,activeShop.phone].filter(Boolean).join(' · '))}</p></div></div><div class="doc"><strong>REPAIR RECEIPT</strong><span>#${safe(String(repair.id).replace('rep-',''))}</span><span>${safe(fmtDate(repair.createdAt))}</span></div></header><div class="content"><div class="topline"><h2>Scheda riparazione</h2><span class="badge">${safe(locationLabel)}</span></div><div class="grid"><div class="box"><div class="label">Cliente / Customer</div><div class="value">${safe(repair.customerName)}</div></div><div class="box"><div class="label">Telefono / Phone</div><div class="value">${safe(repair.phone)}</div></div><div class="box"><div class="label">Dispositivo / Device</div><div class="value">${safe(repair.device)}</div></div><div class="box"><div class="label">IMEI</div><div class="value">${safe(repair.imei)}</div></div><div class="box"><div class="label">Problema / Issue</div><div class="value">${safe(repair.issue)}</div></div><div class="box"><div class="label">Parti / Parts</div><div class="value">${safe(repair.partsOrdered)}</div></div></div><div class="finance"><div class="money"><div class="label">Prezzo / Price</div><strong>${safe(fmt(price))}</strong></div><div class="money"><div class="label">Pagato / Paid</div><strong>${safe(fmt(paid))}</strong></div><div class="money due"><div class="label">Da saldare / Due</div><strong>${safe(fmt(due))}</strong></div></div><div class="box notes"><div class="label">Note</div><div class="value">${safe(repair.notes)}</div></div><div class="signatures"><div class="sign">Firma negozio / Shop signature</div><div class="sign">Firma cliente / Customer signature</div></div><div class="footer"><span>${safe(activeShop.name)}${activeShop.phone ? ` · ${safe(activeShop.phone)}` : ''}</span><span>Stampato / Printed ${safe(new Date().toLocaleString(locale))}</span></div></div></div><script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`);
    printable.document.close();
  };

  const repairWhatsappUrl = (repair) => {
    const messages = {
      pending: `Ciao ${repair.customerName}, la tua riparazione (${repair.device || 'dispositivo'}) è stata registrata da ${activeShop.name}. Ti aggiorneremo presto!`,
      parts_ordered: `Ciao ${repair.customerName}, le parti per il tuo ${repair.device || 'dispositivo'} sono state ordinate. Ti avvisiamo appena arrivano. — ${activeShop.name}`,
      in_progress: `Ciao ${repair.customerName}, la riparazione del tuo ${repair.device || 'dispositivo'} è in corso. Ti aggiorniamo a breve! — ${activeShop.name}`,
      ready: `Ciao ${repair.customerName}, il tuo ${repair.device || 'dispositivo'} è pronto per il ritiro da ${activeShop.name}! Costo riparazione: ${repair.repairCost ? `€${repair.repairCost}` : ''}. Vieni quando vuoi.`,
      delivered: `Ciao ${repair.customerName}, grazie per aver scelto ${activeShop.name}! Il tuo ${repair.device || 'dispositivo'} è stato consegnato.`,
    };
    return `https://wa.me/${repair.phone.replace(/\D/g, '')}?text=${encodeURIComponent(messages[repair.status] || `Ciao ${repair.customerName}, aggiornamento riparazione da ${activeShop.name}.`)}`;
  };

        const repairs = activeShop.repairs || [];
        const statusCfg = {
          pending: { label: t('repairStatus_pending'), color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
          parts_ordered: { label: t('repairStatus_parts_ordered'), color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-400' },
          ready: { label: t('repairStatus_ready'), color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-400' },
          delivered: { label: t('repairStatus_delivered'), color: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
        };
        const nextStatus = { pending: 'parts_ordered', parts_ordered: 'ready', ready: 'delivered' };
        const nextLabel = { pending: t('markPartsOrdered'), parts_ordered: t('markReady'), ready: t('markDelivered') };
        const filtered = repairs.filter((repair) => {
          const query = repairSearch.trim().toLowerCase();
          const searchable = [repair.customerName, repair.phone, repair.email, repair.device, repair.imei, repair.issue, repair.partsOrdered, repair.notes, ...(repair.orders || []).flatMap((order) => [order.item, order.supplier])].filter(Boolean).join(' ').toLowerCase();
          const matchesSearch = !query || searchable.includes(query);
          const matchesStatus = repairFilter === 'all' || repair.status === repairFilter;
          const location = repair.deviceLocation || 'shop';
          const matchesLocation = repairLocationFilter === 'all' || location === repairLocationFilter;
          const total = Number(repair.repairCost) || 0;
          const paid = (Number(repair.advance) || 0) + (repair.payments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
          const due = Math.max(0, total - paid);
          const paymentStatus = due <= 0 && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
          const matchesPayment = repairPaymentFilter === 'all' || paymentStatus === repairPaymentFilter || (repairPaymentFilter === 'due' && due > 0);
          return matchesSearch && matchesStatus && matchesLocation && matchesPayment;
        }).sort((a, b) => {
          if (repairSort === 'oldest') return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
          if (repairSort === 'value_high') return (Number(b.repairCost) || 0) - (Number(a.repairCost) || 0);
          if (repairSort === 'due_high') {
            const due = (repair) => Math.max(0, (Number(repair.repairCost) || 0) - (Number(repair.advance) || 0) - (repair.payments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0));
            return due(b) - due(a);
          }
          return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
        });
        const repairFiltersActive = Boolean(repairSearch) || repairFilter !== 'all' || repairLocationFilter !== 'all' || repairPaymentFilter !== 'all' || repairSort !== 'newest';
        const clearRepairFilters = () => { setRepairSearch(''); setRepairFilter('all'); setRepairLocationFilter('all'); setRepairPaymentFilter('all'); setRepairSort('newest'); };
        const counts = { pending: 0, parts_ordered: 0, ready: 0, delivered: 0 };
        repairs.forEach((r) => { if (counts[r.status] !== undefined) counts[r.status]++; });
        const repairTotals = repairs.reduce((totals, repair) => {
          const price = Number(repair.repairCost) || 0;
          const parts = Number(repair.partsCost) || 0;
          const received = Math.min(Number(repair.advance) || 0, price || Number(repair.advance) || 0);
          totals.value += price;
          totals.parts += parts;
          totals.received += received;
          totals.due += Math.max(0, price - received);
          totals.profit += price - parts;
          return totals;
        }, { value: 0, parts: 0, received: 0, due: 0, profit: 0 });

        return (
          <>
          <div className="space-y-4">
            {/* Summary strip */}
            <div className="section-summary grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              {[
                { key: 'jobs', label: String(locale).startsWith('it') ? 'Lavori totali' : 'Total jobs', val: repairs.length, bg: '#fff' },
                { key: 'value', label: String(locale).startsWith('it') ? 'Valore lavori' : 'Repair value', val: fmt(repairTotals.value), bg: '#f1fec8' },
                { key: 'received', label: String(locale).startsWith('it') ? 'Anticipi ricevuti' : 'Received', val: fmt(repairTotals.received), bg: '#d0f8dc' },
                { key: 'parts', label: String(locale).startsWith('it') ? 'Costo parti' : 'Parts cost', val: fmt(repairTotals.parts), bg: '#fff0a6' },
                { key: 'due', label: String(locale).startsWith('it') ? 'Da saldare' : 'Outstanding', val: fmt(repairTotals.due), bg: '#ffe0e3' },
                { key: 'profit', label: String(locale).startsWith('it') ? 'Profitto stimato' : 'Estimated profit', val: fmt(repairTotals.profit), bg: '#c6ff34', negative: repairTotals.profit < 0 },
              ].map((s) => (
                <button key={s.key} type="button" onClick={() => { setSummaryPopup(s.key); setSummarySearch(''); }} className="rounded-2xl p-3.5 text-center border border-black/10 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md" style={{ background: s.bg }}>
                  <p className={`text-lg sm:text-xl font-black truncate ${s.negative ? 'text-red-600' : 'text-gray-900'}`}>{s.val}</p>
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 mt-1 font-black">{s.label}</p>
                </button>
              ))}
            </div>

            {/* Filter bar */}
            <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="relative flex-1">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                  <input type="search" value={repairSearch} onChange={(event) => setRepairSearch(event.target.value)} placeholder={isItalian ? 'Cerca cliente, telefono, dispositivo, IMEI, problema, ricambio…' : 'Search customer, phone, device, IMEI, issue, part…'} className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 pl-12 pr-4 text-sm font-semibold outline-none transition focus:border-lime-400 focus:bg-white focus:ring-4 focus:ring-lime-100" />
                </div>
                <button onClick={() => setAddRepairOpen(true)} className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black text-black shadow-sm transition-transform hover:-translate-y-0.5" style={{ background: '#c6ff34' }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  {t('addRepairJob')}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                <select value={repairFilter} onChange={(event) => setRepairFilter(event.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-lime-400">
                  <option value="all">{isItalian ? 'Tutti gli stati' : 'All statuses'}</option>
                  <option value="pending">{t('repairStatus_pending')}</option>
                  <option value="parts_ordered">{t('repairStatus_parts_ordered')}</option>
                  <option value="ready">{t('repairStatus_ready')}</option>
                  <option value="delivered">{t('repairStatus_delivered')}</option>
                </select>
                <select value={repairLocationFilter} onChange={(event) => setRepairLocationFilter(event.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-lime-400">
                  <option value="all">{isItalian ? 'Tutte le posizioni' : 'All phone locations'}</option>
                  <option value="shop">{isItalian ? 'Telefono in negozio' : 'Phone in shop'}</option>
                  <option value="client">{isItalian ? 'Telefono dal cliente' : 'Phone with client'}</option>
                  <option value="collected">{isItalian ? 'Ritirato dal cliente' : 'Collected by client'}</option>
                </select>
                <select value={repairPaymentFilter} onChange={(event) => setRepairPaymentFilter(event.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-lime-400">
                  <option value="all">{isItalian ? 'Tutti i pagamenti' : 'All payments'}</option>
                  <option value="paid">{isItalian ? 'Pagato completamente' : 'Fully paid'}</option>
                  <option value="partial">{isItalian ? 'Pagamento parziale' : 'Partially paid'}</option>
                  <option value="unpaid">{isItalian ? 'Non pagato' : 'Unpaid'}</option>
                  <option value="due">{isItalian ? 'Saldo da ricevere' : 'Balance due'}</option>
                </select>
                <select value={repairSort} onChange={(event) => setRepairSort(event.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-lime-400">
                  <option value="newest">{isItalian ? 'Più recenti' : 'Newest first'}</option>
                  <option value="oldest">{isItalian ? 'Più vecchi' : 'Oldest first'}</option>
                  <option value="value_high">{isItalian ? 'Prezzo: alto → basso' : 'Price: high → low'}</option>
                  <option value="due_high">{isItalian ? 'Saldo: alto → basso' : 'Balance: high → low'}</option>
                </select>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
                <span className="text-xs font-bold text-gray-500"><strong className="text-gray-900">{filtered.length}</strong> {isItalian ? `di ${repairs.length} riparazioni` : `of ${repairs.length} repairs`}</span>
                {repairFiltersActive && <button type="button" onClick={clearRepairFilters} className="rounded-xl border border-black/10 px-4 py-2 text-xs font-black hover:bg-gray-50">{isItalian ? 'Azzera tutti i filtri' : 'Clear all filters'}</button>}
              </div>
            </div>

            {/* Empty state */}
            {filtered.length === 0 && !addRepairOpen && (
              <div className="bg-white rounded-2xl py-20 text-center border border-gray-200 shadow-sm">
                <svg className="w-14 h-14 mx-auto mb-4 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-gray-400 font-medium">{t('noRepairsFound')}</p>
                <p className="text-gray-400 text-sm mt-1">{t('startTrackingRepairs')}</p>
              </div>
            )}

            {/* Repair cards — Notes-style grid */}
            {filtered.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                {filtered.map((r) => {
                  const cfg = statusCfg[r.status] || statusCfg.pending;
                  const next = nextStatus[r.status];
                  const repairPrice = Number(r.repairCost) || 0;
                  const partsCost = Number(r.partsCost) || 0;
                  const paid = Number(r.advance) || 0;
                  const due = Math.max(0, repairPrice - paid);
                  const estimatedProfit = repairPrice - partsCost;
                  const pct = repairPrice > 0 ? Math.min(100, Math.round((paid / repairPrice) * 100)) : 0;
                  const fullyPaid = repairPrice > 0 && due === 0;
                  return (
                    <div key={r.id} className="repair-command-card bg-white rounded-2xl shadow-sm border border-gray-200 p-3 space-y-2.5 transition-all">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 text-sm leading-tight">{r.customerName}</p>
                          {r.phone && (
                            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                              {r.phone}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1 ${cfg.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                          {fullyPaid && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-600">{isItalian ? 'Pagato' : 'Paid'} ✓</span>}
                        </div>
                      </div>

                      {/* Device / Issue */}
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-sm text-gray-700 font-medium">
                          <svg className="w-3.5 h-3.5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                          {r.device}
                          {r.issue && <span className="text-gray-400 font-normal text-xs truncate">· {r.issue}</span>}
                        </div>
                        {r.imei && <p className="text-[10px] text-gray-500 font-semibold">IMEI: <span className="font-mono text-gray-700">{r.imei}</span></p>}
                        {r.partsOrdered && (
                          <p className="text-xs text-blue-600 font-medium">{t('parts')}: {r.partsOrdered}</p>
                        )}
                        {r.notes && <p className="text-xs text-gray-400 line-clamp-1">{r.notes}</p>}
                      </div>

                      {/* Financial progress */}
                      <div className="bg-gray-50 rounded-xl px-2.5 py-2 space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold flex-wrap gap-y-1">
                          {r.partsCost > 0 && <span className="text-gray-500">{t('partsCost')}: <span className="text-gray-800">{fmt(r.partsCost)}</span></span>}
                          {r.repairCost > 0 && <span className="text-gray-500">{t('repairCostLabel')}: <span className="text-gray-800">{fmt(r.repairCost)}</span></span>}
                        </div>
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-gray-500">{t('advance')}: <span className="text-emerald-600">{fmt(paid)}</span></span>
                          <span className="text-gray-500">{t('due')}: <span className={due > 0 ? 'text-red-500' : 'text-green-500'}>{fmt(due)}</span></span>
                        </div>
                        <div className="repair-profit-row flex items-center justify-between rounded-lg border px-2.5 py-1.5">
                          <span className="text-xs font-black">{String(locale).startsWith('it') ? 'Profitto stimato' : 'Estimated profit'}</span>
                          <strong className={estimatedProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}>{fmt(estimatedProfit)}</strong>
                        </div>
                        {repairPrice > 0 && (
                          <>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: fullyPaid ? '#22c55e' : 'linear-gradient(to right, #a68a64, #936639)' }} />
                            </div>
                            <p className="text-right text-xs text-gray-400">{pct}% {t('advance')}</p>
                          </>
                        )}
                      </div>

                      {/* Payment history */}
                      {(r.payments || []).length > 0 && (
                        <div className="repair-compact-history space-y-1">
                          {(r.payments || []).map((p) => (
                            <div key={p.id} className="flex items-center justify-between text-xs bg-green-50 border border-green-100 rounded-lg px-2.5 py-1.5">
                              <span className="text-green-700 font-semibold">+{fmt(p.amount)}</span>
                              <span className="text-gray-400">{p.note && <span className="mr-1 text-gray-500">{p.note} ·</span>}{p.date}</span>
                              <button onClick={() => {
                                const payments = (r.payments || []).filter(x => x.id !== p.id);
                                const newAdv = payments.reduce((s, x) => s + (Number(x.amount) || 0), 0) + (Number(r.initialAdvance ?? r.advance) || 0);
                                updateRepair(activeShop.id, r.id, { payments, advance: newAdv });
                              }} className="text-red-300 hover:text-red-500 ml-1">✕</button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Payment inline form */}
                      {repairPayOpenId === r.id && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
                          <p className="text-xs font-bold text-emerald-700">Add Payment</p>
                          <div className="flex gap-1 p-0.5 bg-emerald-100 rounded-lg mb-1">
                            {['cash', 'card'].map((m) => (
                              <button key={m} type="button" onClick={() => setRepairPayMethod(m)}
                                className={`flex-1 py-1.5 text-[10px] font-bold rounded-md flex items-center justify-center gap-1 transition-all ${repairPayMethod === m ? (m === 'cash' ? 'bg-white text-emerald-700 shadow-sm' : 'bg-white text-blue-700 shadow-sm') : 'text-gray-500'}`}>
                                {m === 'cash' ? (
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                ) : (
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                                )}
                                {m === 'cash' ? t('cash') : t('cardPOS')}
                              </button>
                            ))}
                          </div>
                          <div>
                            <input
                              type="number" min="0"
                              className="flex-1 px-2.5 py-2 border border-emerald-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white placeholder-gray-400"
                              placeholder={`Amount (${currencyObj.symbol})*`}
                              value={repairPayAmt}
                              onChange={e => { setRepairPayAmt(e.target.value); setRepairPayError(''); }}
                            />
                          </div>
                          {repairPayError && <p className="text-[10px] text-red-500">{repairPayError}</p>}
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const amt = Number(repairPayAmt);
                                if (!amt || amt <= 0) { setRepairPayError('Enter a valid amount'); return; }
                                const remainingDue = Math.max(0, (Number(r.repairCost) || 0) - (Number(r.advance) || 0));
                                if (Number(r.repairCost) > 0 && amt > remainingDue) { setRepairPayError('Payment cannot exceed remaining balance'); return; }
                                const existing = r.payments || [];
                                const initialAdv = r.initialAdvance ?? (r.advance || 0);
                                // first time: save the original advance as initialAdvance
                                const newPayment = { id: Date.now().toString(), amount: amt, date: new Date().toISOString().split('T')[0], paymentMethod: repairPayMethod };
                                const payments = [...existing, newPayment];
                                const newAdv = Number(initialAdv) + payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                                updateRepair(activeShop.id, r.id, {
                                  payments,
                                  advance: newAdv,
                                  ...(r.initialAdvance === undefined ? { initialAdvance: r.advance || 0 } : {})
                                });
                                setRepairPayAmt(''); setRepairPayNote(''); setRepairPayMethod('cash'); setRepairPayOpenId(null);
                              }}
                              className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors">
                              Save Payment
                            </button>
                            <button onClick={() => { setRepairPayOpenId(null); setRepairPayAmt(''); setRepairPayNote(''); setRepairPayMethod('cash'); setRepairPayError(''); }}
                              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold rounded-lg transition-colors">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Date */}
                      <p className="text-xs text-gray-400">{t('added')} {fmtDate(r.createdAt)}</p>

                      {/* ── Orders Section ── */}
                      <div className="repair-orders-section border-t border-gray-100 pt-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-gray-600 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                            Orders {(r.orders || []).length > 0 && <span className="bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 text-[10px]">{(r.orders || []).length}</span>}
                          </p>
                          <button
                            onClick={() => { setOrderOpenId(orderOpenId === r.id ? null : r.id); setOrderForm({ item: '', cost: '', supplier: '' }); setOrderFormError(''); }}
                            className="text-[10px] font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg transition-colors border border-amber-200">
                            {orderOpenId === r.id ? '✕ Close' : '+ Add Order'}
                          </button>
                        </div>

                        {/* Add order form */}
                        {orderOpenId === r.id && (
                          <div className="bg-amber-50/60 rounded-xl p-3 space-y-2 border border-amber-200">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="col-span-2">
                                <input
                                  className="w-full px-2.5 py-2 border border-amber-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white placeholder-gray-400"
                                  placeholder="Item / Part name *"
                                  value={orderForm.item}
                                  onChange={e => { setOrderForm(f => ({ ...f, item: e.target.value })); setOrderFormError(''); }}
                                />
                              </div>
                              <input
                                type="number" min="0"
                                className="px-2.5 py-2 border border-amber-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white placeholder-gray-400"
                                placeholder={`Cost (${currencyObj.symbol})`}
                                value={orderForm.cost}
                                onChange={e => setOrderForm(f => ({ ...f, cost: e.target.value }))}
                              />
                              <input
                                className="px-2.5 py-2 border border-amber-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white placeholder-gray-400"
                                placeholder="Supplier (optional)"
                                value={orderForm.supplier}
                                onChange={e => setOrderForm(f => ({ ...f, supplier: e.target.value }))}
                              />
                            </div>
                            {orderFormError && <p className="text-[10px] text-red-500">{orderFormError}</p>}
                            <button
                              onClick={() => {
                                if (!orderForm.item.trim()) { setOrderFormError('Item name is required'); return; }
                                addRepairOrder(activeShop.id, r.id, {
                                  item: orderForm.item.trim(),
                                  cost: orderForm.cost ? Number(orderForm.cost) : 0,
                                  supplier: orderForm.supplier.trim(),
                                });
                                setOrderForm({ item: '', cost: '', supplier: '' });
                                setOrderOpenId(null);
                              }}
                              className="w-full py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors">
                              Save Order
                            </button>
                          </div>
                        )}

                        {/* Orders list */}
                        {(r.orders || []).length > 0 && (
                          <div className="repair-compact-history space-y-1.5">
                            {(r.orders || []).map(o => {
                              const received = o.status === 'received';
                              return (
                                <div key={o.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 border text-xs ${received ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'
                                  }`}>
                                  <div className={`w-2 h-2 rounded-full shrink-0 ${received ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-gray-800 truncate">{o.item}</p>
                                    <p className="text-gray-400 text-[10px]">
                                      {o.cost > 0 && <span className="font-bold text-gray-600">{currencyObj.symbol}{Number(o.cost).toLocaleString(locale)} · </span>}
                                      {o.supplier && <span>{o.supplier} · </span>}
                                      {o.date}
                                    </p>
                                  </div>
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${received ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                                    }`}>{received ? 'Received' : 'Ordered'}</span>
                                  {!received && (
                                    <button
                                      onClick={() => updateRepairOrder(activeShop.id, r.id, o.id, { status: 'received' })}
                                      className="text-[10px] font-bold text-white bg-emerald-500 hover:bg-emerald-600 px-2 py-1 rounded-lg transition-colors shrink-0">
                                      ✓
                                    </button>
                                  )}
                                  <button
                                    onClick={() => deleteRepairOrder(activeShop.id, r.id, o.id)}
                                    className="text-red-400 hover:text-red-600 shrink-0 p-0.5">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                </div>
                              );
                            })}
                            {/* Total order cost */}
                            {(r.orders || []).some(o => o.cost > 0) && (
                              <p className="text-right text-[10px] font-bold text-gray-500 pr-1">
                                Total ordered: <span className="text-gray-800">{currencyObj.symbol}{(r.orders || []).reduce((s, o) => s + (Number(o.cost) || 0), 0).toLocaleString(locale)}</span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      {(r.lastCalledAt || r.lastWhatsappAt) && <div className="grid grid-cols-2 gap-1.5 mb-1">
                        {r.lastCalledAt ? <span className="repair-contact-log is-call justify-center">✓ ☎ {String(locale).startsWith('it') ? 'Chiamato' : 'Called'} · {new Date(r.lastCalledAt).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span> : <span />}
                        {r.lastWhatsappAt ? <span className="repair-contact-log is-whatsapp justify-center">✓ ◉ {String(locale).startsWith('it') ? 'Inviato' : 'Sent'} · {new Date(r.lastWhatsappAt).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span> : <span />}
                      </div>}
                      {r.phone && <div className="grid grid-cols-3 gap-1.5 relative">
                        <a href={`tel:${r.phone}`} onClick={() => updateRepair(activeShop.id, r.id, { lastCalledAt: new Date().toISOString() })} className="repair-contact-action is-call"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5.5A2.5 2.5 0 015.5 3H8l2 5-2.5 1.5a14 14 0 007 7L16 14l5 2v2.5a2.5 2.5 0 01-2.5 2.5C10 21 3 14 3 5.5z" /></svg><span>{String(locale).startsWith('it') ? 'Chiama' : 'Call'}</span></a>
                        <a href={repairWhatsappUrl(r)} onClick={() => updateRepair(activeShop.id, r.id, { lastWhatsappAt: new Date().toISOString() })} target="_blank" rel="noopener noreferrer" className="repair-contact-action is-whatsapp"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20 11.5a8 8 0 01-11.8 7L4 20l1.5-4.1A8 8 0 1120 11.5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 8.5c.5 2.5 2 4 4.5 5l1.2-1.2 2 .8c.2.1.3.3.3.5-.2 1.2-1.2 1.9-2.5 1.9-3 0-7-4-7-7C7.5 7.2 8.2 6.2 9.4 6c.2 0 .4.1.5.3l.8 2L9 8.5z" /></svg><span>WhatsApp</span></a>
                        <button type="button" onClick={() => setCustodyOpenId(custodyOpenId === r.id ? null : r.id)} className={`repair-contact-action ${r.deviceLocation === 'collected' ? 'is-collected' : r.deviceLocation === 'client' ? 'is-client' : 'is-shop'}`}>
                          {r.deviceLocation === 'collected' ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12l4 4L19 6" /></svg> : r.deviceLocation === 'client' ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 11l9-8 9 8M5 10v10h14V10M9 20v-6h6v6" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zM10 6h4M11 18h2" /></svg>}
                          <span>{r.deviceLocation === 'collected' ? (String(locale).startsWith('it') ? 'Ritirato' : 'Collected') : r.deviceLocation === 'client' ? (String(locale).startsWith('it') ? 'Dal cliente' : 'With client') : (String(locale).startsWith('it') ? 'In negozio' : 'In shop')}</span>
                        </button>
                        {custodyOpenId === r.id && <div className="repair-custody-menu">
                          <button onClick={() => { updateRepair(activeShop.id, r.id, { deviceLocation: 'client', collectedAt: null, custodyUpdatedAt: new Date().toISOString() }); setCustodyOpenId(null); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 11l9-8 9 8M5 10v10h14V10M9 20v-6h6v6" /></svg><span>{String(locale).startsWith('it') ? 'Telefono dal cliente' : 'Phone with client'}</span></button>
                          <button onClick={() => { updateRepair(activeShop.id, r.id, { deviceLocation: 'shop', collectedAt: null, custodyUpdatedAt: new Date().toISOString() }); setCustodyOpenId(null); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zM10 6h4M11 18h2" /></svg><span>{String(locale).startsWith('it') ? 'Telefono in negozio' : 'Phone in shop'}</span></button>
                          <button onClick={() => { updateRepair(activeShop.id, r.id, { deviceLocation: 'collected', collectedAt: new Date().toISOString(), custodyUpdatedAt: new Date().toISOString(), status: 'delivered' }); setCustodyOpenId(null); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12l4 4L19 6" /></svg><span>{String(locale).startsWith('it') ? 'Ritirato dal cliente' : 'Collected by client'}</span></button>
                        </div>}
                      </div>}
                      {r.collectedAt && <p className="repair-collected-log">✓ {String(locale).startsWith('it') ? 'Ritirato dal cliente' : 'Collected by client'} · {new Date(r.collectedAt).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>}
                      <div className="repair-workflow-actions grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-0.5">
                        {!r.phone && next ? (
                          <button onClick={() => {
                            updateRepair(activeShop.id, r.id, { status: next });
                            if (r.email && (next === 'ready' || next === 'delivered')) {
                              const msgs = {
                                ready: `Dear ${r.customerName},\n\nYour ${r.device} repair is complete and ready for pickup!\nRepair Cost: ${r.repairCost || ''}\n\nPlease visit us at your earliest convenience.\n${activeShop.name}`,
                                delivered: `Dear ${r.customerName},\n\nYour ${r.device} has been delivered. Thank you for choosing us!\n${activeShop.name}`,
                              };
                              sendClientEmail({
                                to: r.email,
                                toName: r.customerName,
                                subject: next === 'ready' ? `Your Repair is Ready! – ${activeShop.name}` : `Repair Delivered – ${activeShop.name}`,
                                message: msgs[next],
                                shopName: activeShop.name,
                                emailCfg: emailSettings,
                              });
                            }
                          }}
                            className="repair-workflow-button is-status">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16M14 6l6 6-6 6" /></svg>
                            {nextLabel[r.status]}
                          </button>
                        ) : (
                          null
                        )}
                        {/* Add Payment Button */}
                        {!fullyPaid && (
                          <button
                            onClick={() => { setRepairPayOpenId(repairPayOpenId === r.id ? null : r.id); setRepairPayAmt(''); setRepairPayNote(''); setRepairPayMethod('cash'); setRepairPayError(''); }}
                            className="repair-workflow-button is-pay">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" /></svg>
                            Pay
                          </button>
                        )}
                        <button onClick={() => {
                          setRepairEditId(r.id);
                          setRepairForm({ customerName: r.customerName || '', phone: r.phone || '', device: r.device || '', imei: r.imei || '', issue: r.issue || '', partsOrdered: r.partsOrdered || '', partsCost: r.partsCost || '', repairCost: r.repairCost || '', advance: r.advance || '', notes: r.notes || '', email: r.email || '', paymentMethod: r.paymentMethod || 'cash', deviceLocation: r.deviceLocation || 'shop' });
                          setRepairFormError('');
                          setAddRepairOpen(true);
                          setTimeout(() => document.querySelector('.repair-edit-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
                        }} className="repair-workflow-button is-edit">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" /></svg><span>{String(locale).startsWith('it') ? 'Modifica' : 'Edit'}</span>
                        </button>
                        <button onClick={() => printRepair(r)} className="repair-workflow-button is-print">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7 8V3h10v5M7 17H5a2 2 0 01-2-2v-5a2 2 0 012-2h14a2 2 0 012 2v5a2 2 0 01-2 2h-2M7 14h10v7H7v-7z" /></svg><span>{String(locale).startsWith('it') ? 'Stampa' : 'Print'}</span>
                        </button>
                        <button onClick={() => setRepairDeleteId(r.id)}
                          className="repair-workflow-button is-delete">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          <span>{String(locale).startsWith('it') ? 'Elimina' : 'Delete'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Repair Form */}
            {addRepairOpen ? (
              <div className="repair-edit-form bg-white rounded-2xl p-6 shadow-sm border-2 border-dashed border-amber-500/30">
                <p className="text-sm font-bold text-amber-400 mb-4">{repairEditId ? (String(locale).startsWith('it') ? 'Modifica riparazione' : 'Edit repair') : t('newRepair')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  {[
                    ['customerName', `${t('customerName')} *`, 'Mario Rossi', 'text'],
                    ['phone', t('phone'), '+39 300-0000000', 'text'],
                    ['device', `${t('deviceModel')} *`, 'iPhone 13 Pro', 'text'],
                    ['imei', 'IMEI', '356789012345678', 'text'],
                    ['issue', t('issueLabel'), 'Schermo rotto', 'text'],
                    ['partsOrdered', t('repairStatus_parts_ordered'), 'Assemblaggio Schermo', 'text'],
                    ['partsCost', `${t('partsCost')} (${currencyObj.symbol})`, '12000', 'number'],
                    ['repairCost', `${t('repairCostLabel')} (${currencyObj.symbol})`, '3000', 'number'],
                    ['advance', `${t('advancePaid')} (${currencyObj.symbol})`, '5000', 'number'],
                    ['email', t('clientEmail'), 'mario@email.com', 'email'],
                  ].map(([key, label, ph, type]) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                      <input
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
                        type={type} min={type === 'number' ? '0' : undefined}
                        value={repairForm[key]}
                        onChange={(e) => { setRepairForm((f) => ({ ...f, [key]: e.target.value })); setRepairFormError(''); }}
                        placeholder={ph}
                        autoFocus={key === 'customerName'}
                      />
                    </div>
                  ))}
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{String(locale).startsWith('it') ? 'Dove si trova il telefono?' : 'Where is the phone?'}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setRepairForm((form) => ({ ...form, deviceLocation: 'shop' }))} className={`px-3 py-2 rounded-xl border text-xs font-bold ${repairForm.deviceLocation === 'shop' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-gray-200 text-gray-500'}`}>▣ {String(locale).startsWith('it') ? 'In negozio' : 'In shop'}</button>
                    <button type="button" onClick={() => setRepairForm((form) => ({ ...form, deviceLocation: 'client' }))} className={`px-3 py-2 rounded-xl border text-xs font-bold ${repairForm.deviceLocation === 'client' ? 'bg-yellow-100 border-yellow-400 text-yellow-700' : 'bg-white border-gray-200 text-gray-500'}`}>⌂ {String(locale).startsWith('it') ? 'Dal cliente' : 'With client'}</button>
                  </div>
                </div>
                {/* Payment Method */}
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('paymentMethod')}</label>
                  <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg w-full sm:w-64">
                    {['cash', 'card'].map((m) => (
                      <button key={m} type="button" onClick={() => setRepairForm((f) => ({ ...f, paymentMethod: m }))}
                        className={`flex-1 py-2 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition-all ${repairForm.paymentMethod === m ? (m === 'cash' ? 'bg-white text-emerald-700 shadow-sm' : 'bg-white text-blue-700 shadow-sm') : 'text-gray-500'}`}>
                        {m === 'cash' ? (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                        )}
                        {m === 'cash' ? t('cash') : t('cardPOS')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{t('notes')}</label>
                  <textarea className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400 resize-none" rows={2} value={repairForm.notes} onChange={(e) => setRepairForm((f) => ({ ...f, notes: e.target.value }))} placeholder={t('additionalNotes')} />
                </div>
                {repairFormError && <p className="text-xs text-red-500 mb-3">{repairFormError}</p>}
                <div className="flex gap-3">
                  <button onClick={() => { setAddRepairOpen(false); setRepairEditId(null); setRepairFormError(''); setRepairForm(emptyRepairForm); }}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm">{t('cancel')}</button>
                  <button onClick={handleAddRepair}
                    className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors text-sm shadow-sm">{repairEditId ? (String(locale).startsWith('it') ? 'Salva modifiche' : 'Save changes') : t('saveRepair')}</button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setRepairEditId(null); setAddRepairOpen(true); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-gray-200 text-gray-400 font-semibold rounded-2xl hover:border-amber-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {t('addRepairJob')}
              </button>
            )}
          </div>
      {summaryPopup && (() => {
        const popupLabels = {
          jobs: String(locale).startsWith('it') ? 'Tutti i lavori' : 'All repair jobs',
          value: String(locale).startsWith('it') ? 'Valore riparazioni' : 'Repair value',
          received: String(locale).startsWith('it') ? 'Pagamenti ricevuti' : 'Payments received',
          parts: String(locale).startsWith('it') ? 'Costi delle parti' : 'Parts costs',
          due: String(locale).startsWith('it') ? 'Saldi da incassare' : 'Outstanding balances',
          profit: String(locale).startsWith('it') ? 'Profitti stimati' : 'Estimated profits',
        };
        const rows = repairs.filter((repair) => {
          if (summaryPopup === 'received') return Number(repair.advance) > 0;
          if (summaryPopup === 'parts') return Number(repair.partsCost) > 0;
          if (summaryPopup === 'due') return Math.max(0, (Number(repair.repairCost) || 0) - (Number(repair.advance) || 0)) > 0;
          return true;
        }).filter((repair) => `${repair.customerName} ${repair.phone} ${repair.device} ${repair.issue}`.toLowerCase().includes(summarySearch.toLowerCase()));
        const rowAmount = (repair) => {
          if (summaryPopup === 'received') return Number(repair.advance) || 0;
          if (summaryPopup === 'parts') return Number(repair.partsCost) || 0;
          if (summaryPopup === 'due') return Math.max(0, (Number(repair.repairCost) || 0) - (Number(repair.advance) || 0));
          if (summaryPopup === 'profit') return (Number(repair.repairCost) || 0) - (Number(repair.partsCost) || 0);
          if (summaryPopup === 'value') return Number(repair.repairCost) || 0;
          return null;
        };
        return <div className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) setSummaryPopup(null); }}>
          <div className="w-full max-w-4xl max-h-[88vh] overflow-hidden bg-white rounded-3xl shadow-2xl border border-black/10 flex flex-col">
            <div className="p-4 sm:p-5 border-b border-black/10 flex items-center justify-between gap-3" style={{ background: '#f1fec8' }}><div><p className="text-[10px] uppercase tracking-wider font-black text-gray-500">{isItalian ? 'Ricerca riparazioni' : 'Repair finder'}</p><h3 className="text-xl font-black">{popupLabels[summaryPopup]}</h3></div><button type="button" onClick={() => setSummaryPopup(null)} className="w-10 h-10 rounded-xl bg-white border border-black/10 font-black">×</button></div>
            <div className="p-3 sm:p-4 border-b border-black/10"><label className="flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2.5 bg-gray-50"><span>⌕</span><input autoFocus value={summarySearch} onChange={(e) => setSummarySearch(e.target.value)} className="w-full bg-transparent outline-none text-sm" placeholder={String(locale).startsWith('it') ? 'Cerca cliente, telefono, modello…' : 'Search customer, phone, model…'} /></label></div>
            <div className="overflow-y-auto p-3 sm:p-4 space-y-2">
              {rows.map((repair) => { const created = new Date(repair.createdAt); const validDate = !Number.isNaN(created.getTime()); const amount = rowAmount(repair); return <button key={repair.id} type="button" onClick={() => { setSummaryPopup(null); setRepairFilter('all'); }} className="w-full grid grid-cols-[1fr_auto] sm:grid-cols-[1.2fr_1fr_auto] gap-3 items-center text-left rounded-2xl border border-black/10 p-3 hover:bg-[#f1fec8] transition-colors"><div className="min-w-0"><p className="font-black text-sm truncate">{repair.device || '—'} <span className="font-medium text-gray-400">· {repair.issue || 'Repair'}</span></p><p className="text-xs text-gray-500 truncate mt-1">{repair.customerName || '—'} · {repair.phone || 'No phone'}</p></div><div className="hidden sm:block"><p className="text-xs font-bold">{fmtDate(repair.createdAt)}</p><p className="text-[10px] text-gray-400 mt-1">{validDate && repair.createdAt?.includes('T') ? created.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : (String(locale).startsWith('it') ? 'Ora non registrata' : 'Time not recorded')}</p></div><div className="text-right"><p className={`font-black text-sm ${amount !== null && amount < 0 ? 'text-red-600' : ''}`}>{amount === null ? '→' : fmt(amount)}</p><p className="text-[10px] text-gray-400 mt-1 sm:hidden">{fmtDate(repair.createdAt)}</p><span className="inline-block text-[9px] font-black px-2 py-1 rounded-full mt-1" style={{ background: '#c6ff34' }}>{statusCfg[repair.status]?.label || repair.status}</span></div></button>; })}
              {!rows.length && <div className="py-16 text-center text-sm text-gray-400">{String(locale).startsWith('it') ? 'Nessun risultato trovato.' : 'No matching repair found.'}</div>}
            </div>
            <div className="p-3 border-t border-black/10 text-center text-xs font-bold text-gray-500">{rows.length} {String(locale).startsWith('it') ? 'risultati' : 'results'}</div>
          </div>
        </div>;
      })()}
      {/* Repair delete confirm */}
      {repairDeleteId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-2">{t('deleteRepair')}</h3>
            <p className="text-sm text-gray-500 mb-6">{t('cannotBeUndone')}</p>
            <div className="flex gap-3">
              <button onClick={() => setRepairDeleteId(null)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors">{t('cancel')}</button>
              <button onClick={() => { deleteRepair(activeShop.id, repairDeleteId); setRepairDeleteId(null); }} className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors">{t('delete')}</button>
            </div>
          </div>
        </div>
      )}


          </>
        );
}
