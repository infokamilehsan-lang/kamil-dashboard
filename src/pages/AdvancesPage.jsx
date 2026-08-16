import { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { useLanguage } from '../context/LanguageContext';
import { useFmt } from '../lib/useFmt';
import { sendClientEmail } from '../lib/emailService';

export default function AdvancesPage() {
  const { activeShop, addAdvance, updateAdvance, deleteAdvance, addOrUpdateContact, emailSettings } = useShop();
  const { t, locale } = useLanguage();
  const { fmt, fmtDate, currencyObj } = useFmt();
  const it = String(locale || '').toLowerCase().startsWith('it');
  const today = () => new Date().toISOString().slice(0, 10);
  const fmtContactTime = (value) => value ? new Intl.DateTimeFormat(it ? 'it-IT' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '';

  const [addAdvanceOpen, setAddAdvanceOpen] = useState(false);
  const emptyAdvanceForm = { customerName: '', phone: '', description: '', totalAmount: '', advancePaid: '', productCost: '', email: '', paymentMethod: 'cash', orderDate: today(), expectedDate: '' };
  const [advanceForm, setAdvanceForm] = useState(emptyAdvanceForm);
  const [advanceFormError, setAdvanceFormError] = useState('');
  const [advancePayOpen, setAdvancePayOpen] = useState(null);
  const [advancePayAmt, setAdvancePayAmt] = useState('');
  const [advancePayMethod, setAdvancePayMethod] = useState('cash');
  const [advanceCostOpen, setAdvanceCostOpen] = useState(null);
  const [advanceCostAmt, setAdvanceCostAmt] = useState('');
  const [advanceDeleteId, setAdvanceDeleteId] = useState(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState('all');
  const [orderArrivalFilter, setOrderArrivalFilter] = useState('all');
  const [orderSort, setOrderSort] = useState('newest');

  const handleAddAdvance = () => {
    if (!advanceForm.customerName.trim()) { setAdvanceFormError(t('customerNameRequired')); return; }
    if (!advanceForm.totalAmount) { setAdvanceFormError(t('totalAmountRequired')); return; }
    const total = Number(advanceForm.totalAmount);
    // Blank payment means the customer paid the full total; enter a smaller value for a partial advance.
    const paid = advanceForm.advancePaid === '' ? total : (Number(advanceForm.advancePaid) || 0);
    if (total <= 0) { setAdvanceFormError(t('totalAmountRequired')); return; }
    if (paid < 0 || paid > total) { setAdvanceFormError('Advance paid cannot exceed total amount'); return; }
    addAdvance({
      customerName: advanceForm.customerName.trim(),
      phone: advanceForm.phone.trim(),
      description: advanceForm.description.trim(),
      totalAmount: total,
      advancePaid: paid,
      productCost: Number(advanceForm.productCost) || 0,
      remaining: Math.max(0, total - paid),
      status: paid >= total ? 'cleared' : paid > 0 ? 'partial' : 'pending',
      email: advanceForm.email.trim(),
      paymentMethod: advanceForm.paymentMethod || 'cash',
      orderDate: advanceForm.orderDate || today(),
      expectedDate: advanceForm.expectedDate || '',
      orderStatus: 'ordered',
      payments: paid > 0 ? [{ id: `initial-${Date.now()}`, amount: paid, date: advanceForm.orderDate || today(), paymentMethod: advanceForm.paymentMethod || 'cash', initial: true }] : [],
    });
    if (advanceForm.phone.trim() || advanceForm.email.trim()) {
      addOrUpdateContact({
        name: advanceForm.customerName.trim(),
        email: advanceForm.email.trim(),
        phone: advanceForm.phone.trim(),
      });
    }
    if (advanceForm.email.trim()) {
      sendClientEmail({
        to: advanceForm.email.trim(),
        toName: advanceForm.customerName.trim(),
        subject: `Advance Confirmation – ${activeShop?.name}`,
        message: `Dear ${advanceForm.customerName.trim()},\n\nYour advance has been recorded.\nDescription: ${advanceForm.description.trim() || 'N/A'}\nTotal Amount: ${total}\nAdvance Paid: ${paid}\nRemaining: ${total - paid}\n\nThank you!\n${activeShop?.name}`,
        shopName: activeShop?.name,
        emailCfg: emailSettings,
      });
    }
    setAdvanceForm(emptyAdvanceForm);
    setAddAdvanceOpen(false);
    setAdvanceFormError('');
  };

  const handleAdvancePay = (adv) => {
    const extra = Number(advancePayAmt);
    if (!extra || extra <= 0) return;
    const currentRemaining = Math.max(0, Number(adv.remaining ?? ((adv.totalAmount || 0) - (adv.advancePaid || 0))) || 0);
    if (extra > currentRemaining) return;
    const newPaid = (adv.advancePaid || 0) + extra;
    const newRemaining = Math.max(0, (adv.totalAmount || 0) - newPaid);
    const newStatus = newRemaining <= 0 ? 'cleared' : 'partial';
    const payment = { id: `p-${Date.now()}`, amount: extra, date: new Date().toISOString().split('T')[0], paymentMethod: advancePayMethod };
    updateAdvance(activeShop.id, adv.id, {
      advancePaid: newPaid,
      remaining: newRemaining,
      status: newStatus,
      payments: [...(adv.payments || []), payment],
    });
    if (newStatus === 'cleared' && adv.email) {
      sendClientEmail({
        to: adv.email,
        toName: adv.customerName,
        subject: `Account Cleared – ${activeShop.name}`,
        message: `Dear ${adv.customerName},\n\nYour account has been fully cleared.\nTotal paid: ${adv.totalAmount}\n\nThank you for your business!\n${activeShop.name}`,
        shopName: activeShop.name,
        emailCfg: emailSettings,
      });
    }
    setAdvancePayAmt('');
    setAdvancePayMethod('cash');
    setAdvancePayOpen(null);
  };

  const handleAdvanceCost = (adv) => {
    const cost = Number(advanceCostAmt);
    if (!advanceCostAmt || cost < 0) return;
    updateAdvance(activeShop.id, adv.id, { productCost: cost });
    setAdvanceCostAmt('');
    setAdvanceCostOpen(null);
  };

        const advances = activeShop.advances || [];
        const totalOrderValue = advances.reduce((s, a) => s + (Number(a.totalAmount) || 0), 0);
        const totalReceived = advances.reduce((s, a) => s + (Number(a.advancePaid) || 0), 0);
        const totalPending = advances.reduce((s, a) => {
          const total = Number(a.totalAmount) || 0;
          const paid = Number(a.advancePaid) || 0;
          return s + Math.max(0, a.remaining !== undefined ? (Number(a.remaining) || 0) : total - paid);
        }, 0);
        const totalProductCost = advances.reduce((s, a) => s + (Number(a.productCost) || 0), 0);
        const estimatedProfit = totalOrderValue - totalProductCost;
        const pendingOrders = advances.filter((a) => {
          const total = Number(a.totalAmount) || 0;
          const paid = Number(a.advancePaid) || 0;
          return Math.max(0, a.remaining !== undefined ? (Number(a.remaining) || 0) : total - paid) > 0;
        }).length;
        const searchTerm = orderSearch.trim().toLowerCase();
        const todayKey = today();
        const filteredAdvances = advances.filter((order) => {
          const searchable = [order.customerName, order.phone, order.description, order.email, order.orderStatus, order.paymentMethod].filter(Boolean).join(' ').toLowerCase();
          const matchesSearch = !searchTerm || searchable.includes(searchTerm);
          const total = Number(order.totalAmount) || 0;
          const paid = Number(order.advancePaid) || 0;
          const remaining = Math.max(0, order.remaining !== undefined ? Number(order.remaining) || 0 : total - paid);
          const paymentStatus = remaining <= 0 && total > 0 ? 'cleared' : paid > 0 ? 'partial' : 'pending';
          const matchesPayment = orderPaymentFilter === 'all' || paymentStatus === orderPaymentFilter;
          const expected = String(order.expectedDate || '').slice(0, 10);
          const arrivalStatus = !expected ? 'no_date' : expected < todayKey ? 'overdue' : expected === todayKey ? 'today' : 'upcoming';
          const matchesArrival = orderArrivalFilter === 'all' || arrivalStatus === orderArrivalFilter;
          return matchesSearch && matchesPayment && matchesArrival;
        }).sort((a, b) => {
          const remaining = (order) => Math.max(0, Number(order.remaining ?? ((Number(order.totalAmount) || 0) - (Number(order.advancePaid) || 0))) || 0);
          if (orderSort === 'oldest') return String(a.orderDate || a.date || '').localeCompare(String(b.orderDate || b.date || ''));
          if (orderSort === 'arrival') return String(a.expectedDate || '9999-12-31').localeCompare(String(b.expectedDate || '9999-12-31'));
          if (orderSort === 'balance_high') return remaining(b) - remaining(a);
          if (orderSort === 'profit_high') return ((Number(b.totalAmount) || 0) - (Number(b.productCost) || 0)) - ((Number(a.totalAmount) || 0) - (Number(a.productCost) || 0));
          return String(b.orderDate || b.date || '').localeCompare(String(a.orderDate || a.date || ''));
        });
        const orderFiltersActive = Boolean(orderSearch) || orderPaymentFilter !== 'all' || orderArrivalFilter !== 'all' || orderSort !== 'newest';
        const clearOrderFilters = () => { setOrderSearch(''); setOrderPaymentFilter('all'); setOrderArrivalFilter('all'); setOrderSort('newest'); };
        const statusCfg = {
          pending: { color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
          partial: { color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-400' },
          cleared: { color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-400' },
        };
        return (
          <>
          <div className="space-y-4">
            {/* Summary */}
            <div className="section-summary rounded-3xl border border-black/10 bg-white p-4 sm:p-5 shadow-sm">
              <div className="flex items-end justify-between gap-3 mb-4"><div><p className="text-[10px] uppercase tracking-[.18em] font-black text-gray-400">{it ? 'Riepilogo ordini' : 'Order overview'}</p><h2 className="text-xl font-black mt-1">{it ? 'Controllo clienti e profitti' : 'Customers & profit control'}</h2></div><span className="text-xs font-black px-3 py-1.5 rounded-full" style={{ background: '#c6ff34' }}>{advances.length} {it ? 'ordini' : 'orders'}</span></div>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                {[
                  { label: it ? 'Ordini totali' : 'Total orders', value: advances.length, note: it ? 'registrati' : 'recorded', tone: '#f1fec8', icon: '▣' },
                  { label: it ? 'Valore ordini' : 'Order value', value: fmt(totalOrderValue), note: it ? 'prezzo totale' : 'total price', tone: '#f1fec8', icon: '↗' },
                  { label: it ? 'Incassato' : 'Received', value: fmt(totalReceived), note: it ? 'pagato dai clienti' : 'paid by customers', tone: '#c6ff34', icon: '✓' },
                  { label: it ? 'Saldo da ricevere' : 'Balance due', value: fmt(totalPending), note: `${pendingOrders} ${it ? 'ordini aperti' : 'open orders'}`, tone: totalPending > 0 ? '#fff4dc' : '#f1fec8', icon: '◷' },
                  { label: it ? 'Costo prodotti' : 'Product cost', value: fmt(totalProductCost), note: it ? 'costo acquisti' : 'purchase cost', tone: '#f5f5f2', icon: '□' },
                  { label: it ? 'Profitto stimato' : 'Estimated profit', value: fmt(estimatedProfit), note: it ? 'valore meno costi' : 'value minus costs', tone: estimatedProfit >= 0 ? '#c6ff34' : '#ffe4e4', icon: '◎' },
                ].map((item) => <div key={item.label} className="min-w-0 rounded-2xl border border-black/10 p-4" style={{ background: item.tone }}><p className="text-[9px] uppercase tracking-wider font-black text-gray-600">{item.label}</p><strong className="block text-xl sm:text-2xl font-black mt-2 truncate">{item.value}</strong><p className="text-[10px] text-gray-500 font-bold mt-1 truncate">{item.note}</p></div>)}
              </div>
            </div>

            {/* Add button */}
            <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="relative flex-1">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                  <input type="search" value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} placeholder={it ? 'Cerca cliente, telefono, email, prodotto o metodo pagamento…' : 'Search customer, phone, email, product or payment method…'} className="w-full h-12 pl-12 pr-4 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold outline-none focus:bg-white focus:border-lime-400 focus:ring-4 focus:ring-lime-100" />
                </div>
                <button onClick={() => setAddAdvanceOpen(true)} className="h-12 flex items-center justify-center gap-2 px-5 text-black text-sm font-black rounded-xl transition-transform hover:-translate-y-0.5 shadow-sm shrink-0" style={{ background: '#c6ff34' }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  {t('newAdvanceEntry')}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select value={orderPaymentFilter} onChange={(event) => setOrderPaymentFilter(event.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-lime-400">
                  <option value="all">{it ? 'Tutti i pagamenti' : 'All payments'}</option>
                  <option value="pending">{it ? 'Non pagato' : 'Unpaid'}</option>
                  <option value="partial">{it ? 'Pagamento parziale' : 'Partially paid'}</option>
                  <option value="cleared">{it ? 'Pagato completamente' : 'Fully paid'}</option>
                </select>
                <select value={orderArrivalFilter} onChange={(event) => setOrderArrivalFilter(event.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-lime-400">
                  <option value="all">{it ? 'Tutte le date di arrivo' : 'All arrival dates'}</option>
                  <option value="overdue">{it ? 'Arrivo in ritardo' : 'Overdue arrival'}</option>
                  <option value="today">{it ? 'Arrivo oggi' : 'Arriving today'}</option>
                  <option value="upcoming">{it ? 'Arrivo futuro' : 'Upcoming arrival'}</option>
                  <option value="no_date">{it ? 'Senza data prevista' : 'No expected date'}</option>
                </select>
                <select value={orderSort} onChange={(event) => setOrderSort(event.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-lime-400">
                  <option value="newest">{it ? 'Più recenti' : 'Newest first'}</option>
                  <option value="oldest">{it ? 'Più vecchi' : 'Oldest first'}</option>
                  <option value="arrival">{it ? 'Arrivo più vicino' : 'Nearest arrival'}</option>
                  <option value="balance_high">{it ? 'Saldo: alto → basso' : 'Balance: high → low'}</option>
                  <option value="profit_high">{it ? 'Profitto: alto → basso' : 'Profit: high → low'}</option>
                </select>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
                <span className="text-xs font-bold text-gray-500"><strong className="text-gray-900">{filteredAdvances.length}</strong> {it ? `di ${advances.length} ordini` : `of ${advances.length} orders`}</span>
                {orderFiltersActive && <button type="button" onClick={clearOrderFilters} className="px-4 py-2 rounded-xl border border-black/10 text-xs font-black hover:bg-gray-50">{it ? 'Azzera tutti i filtri' : 'Clear all filters'}</button>}
              </div>
            </div>

            {/* Empty state */}
            {advances.length === 0 && !addAdvanceOpen && (
              <div className="bg-white rounded-2xl py-20 text-center border border-gray-200 shadow-sm">
                <svg className="w-14 h-14 mx-auto mb-4 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-gray-400 font-medium">{t('noAdvancesYet')}</p>
                <p className="text-gray-400 text-sm mt-1">{t('trackAdvancePaymentsHere')}</p>
              </div>
            )}

            {/* Advance cards — Notes-style grid */}
            {advances.length > 0 && filteredAdvances.length === 0 && (
              <div className="bg-white rounded-2xl py-12 text-center border border-gray-200"><p className="text-sm font-black">{it ? 'Nessun ordine trovato' : 'No orders found'}</p><p className="text-xs text-gray-400 mt-1">{it ? 'Prova a cambiare ricerca o filtri.' : 'Try changing the search or filters.'}</p><button type="button" onClick={clearOrderFilters} className="mt-3 px-4 py-2 rounded-xl text-xs font-black" style={{ background: '#c6ff34' }}>{it ? 'Mostra tutti gli ordini' : 'Show all orders'}</button></div>
            )}
            {filteredAdvances.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAdvances.map((adv) => {
                  const cfg = statusCfg[adv.status] || statusCfg.pending;
                  const totalAmount = Number(adv.totalAmount) || 0;
                  const storedRemaining = adv.remaining !== undefined ? Math.max(0, Number(adv.remaining) || 0) : null;
                  const receivedAmount = adv.advancePaid !== undefined ? Math.max(0, Number(adv.advancePaid) || 0) : Math.max(0, totalAmount - (storedRemaining ?? totalAmount));
                  const remainingAmount = storedRemaining ?? Math.max(0, totalAmount - receivedAmount);
                  const pct = totalAmount > 0 ? Math.min(Math.max((receivedAmount / totalAmount) * 100, 0), 100) : 0;
                  const isPayOpen = advancePayOpen === adv.id;
                  const isCostOpen = advanceCostOpen === adv.id;
                  const fullyCleared = totalAmount > 0 && (remainingAmount <= 0 || receivedAmount >= totalAmount);
                  // Payment and delivery are separate: a fully-paid order still waits for arrival and collection.
                  const orderStatus = adv.orderStatus || 'ordered';
                  const paymentHistory = adv.payments?.length ? adv.payments : (receivedAmount > 0 ? [{ id: `initial-${adv.id}`, amount: receivedAmount, date: adv.orderDate || adv.date, paymentMethod: adv.paymentMethod || 'cash', initial: true }] : []);
                  const balanceLine = Number(adv.remaining || 0) > 0
                    ? (it ? `Puoi passare per il ritiro e saldare ${fmt(adv.remaining || 0)}.` : `You can collect it and pay the remaining ${fmt(adv.remaining || 0)}.`)
                    : (it ? 'Il pagamento è già completo: puoi passare per il ritiro.' : 'Payment is already complete; you can collect it.');
                  const whatsappText = encodeURIComponent(it ? `Ciao ${adv.customerName}, il tuo ordine ${adv.description || ''} è arrivato presso ${activeShop.name}. ${balanceLine}` : `Hi ${adv.customerName}, your order ${adv.description || ''} has arrived at ${activeShop.name}. ${balanceLine}`);
                  return (
                    <div key={adv.id} className="h-full bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex flex-col gap-3 hover:border-amber-200 transition-colors">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 text-base leading-tight">{adv.customerName}</p>
                          {adv.phone && <p className="text-xs text-gray-400 mt-0.5">{adv.phone}</p>}
                          {adv.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{adv.description}</p>}
                          <div className="flex items-center gap-1 mt-1">
                              <svg className="w-3 h-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" /></svg>
                              <span className="text-xs text-gray-400">{it ? 'Costo prodotti' : 'Product cost'}:</span>
                              <span className="text-xs font-bold text-amber-600">{adv.productCost > 0 ? fmt(adv.productCost) : '—'}</span>
                              <button onClick={() => { setAdvanceCostOpen(isCostOpen ? null : adv.id); setAdvanceCostAmt(adv.productCost > 0 ? String(adv.productCost) : ''); }} className="ml-1.5 p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-500 hover:bg-amber-100 transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1 ${cfg.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {adv.status === 'cleared' ? t('cleared') : adv.status === 'partial' ? t('partial') : t('pending')}
                          </span>
                          {fullyCleared && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-600">{it ? 'Pagato' : 'Paid'} ✓</span>}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px]"><div className="rounded-xl bg-gray-50 p-2.5"><span className="block text-gray-400 font-bold">{it ? 'Data ordine' : 'Order date'}</span><strong>{fmtDate(adv.orderDate || adv.date)}</strong></div><div className="rounded-xl bg-gray-50 p-2.5"><span className="block text-gray-400 font-bold">{it ? 'Arrivo previsto' : 'Expected arrival'}</span><strong>{adv.expectedDate ? fmtDate(adv.expectedDate) : '—'}</strong></div></div>

                      {/* Progress */}
                      <div className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-2">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-gray-500">{t('received')}: <span style={{ color: '#936639' }}>{fmt(receivedAmount)}</span></span>
                          <span className="text-gray-500">{t('remaining')}: <span className={remainingAmount > 0 ? 'text-red-500' : 'text-green-500'}>{fmt(remainingAmount)}</span></span>
                          <span className="text-gray-500">{t('totalLabel')}: <span className="text-gray-800">{fmt(totalAmount)}</span></span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: fullyCleared ? '#22c55e' : 'linear-gradient(to right, #a68a64, #936639)' }} />
                        </div>
                        <p className="text-right text-xs text-gray-400">{pct.toFixed(0)}% {t('received')}</p>
                      </div>

                      {/* Payment history */}
                      {paymentHistory.length > 0 && (
                        <div className="border-t border-gray-100 pt-2 space-y-1">
                          <p className="text-xs font-semibold text-gray-400">{t('paymentHistory')}</p>
                          {paymentHistory.map((p) => (
                            <div key={p.id} className="flex justify-between text-xs text-gray-500">
                              <span>{fmtDate(p.date)}{p.initial ? ` · ${it ? 'Pagamento iniziale' : 'Initial payment'}` : ''}</span>
                              <span className="font-semibold" style={{ color: '#a68a64' }}>+{fmt(p.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Date */}
                      <p className="text-xs text-gray-400">{fmtDate(adv.date)}</p>

                      {/* Inline edit product cost */}
                      {isCostOpen && (
                        <div className="pt-1 border-t border-gray-100 flex items-center gap-2">
                          <input
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
                            type="number" min="0" placeholder={`Costo prodotti (${currencyObj.symbol})`}
                            value={advanceCostAmt} onChange={(e) => setAdvanceCostAmt(e.target.value)}
                            autoFocus
                          />
                          <button onClick={() => handleAdvanceCost(adv)}
                            className="px-3 py-2 text-white text-xs font-semibold rounded-xl transition-colors" style={{ backgroundColor: '#a68a64' }}>{it ? 'Salva' : 'Save'}</button>
                          <button onClick={() => setAdvanceCostOpen(null)}
                            className="px-3 py-2 border border-gray-200 text-gray-500 text-xs font-medium rounded-xl hover:bg-gray-50 transition-colors">{t('cancel')}</button>
                        </div>
                      )}

                      {/* Inline add payment input */}
                      {isPayOpen && (
                        <div className="pt-2 border-t border-gray-100 space-y-2">
                          <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg">
                            {['cash', 'card'].map((m) => (
                              <button key={m} type="button" onClick={() => setAdvancePayMethod(m)}
                                className={`flex-1 py-1.5 text-[10px] font-bold rounded-md flex items-center justify-center gap-1 transition-all ${advancePayMethod === m ? (m === 'cash' ? 'bg-white text-emerald-700 shadow-sm' : 'bg-white text-blue-700 shadow-sm') : 'text-gray-500'}`}>
                                {m === 'cash' ? (
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                ) : (
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                                )}
                                {m === 'cash' ? t('cash') : t('cardPOS')}
                              </button>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              className="col-span-2 min-w-0 w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
                              type="number" min="1" placeholder={`Amount (${currencyObj.symbol})`}
                              value={advancePayAmt} onChange={(e) => setAdvancePayAmt(e.target.value)}
                              autoFocus
                            />
                            <button onClick={() => handleAdvancePay(adv)}
                              className="h-11 min-w-0 w-full px-2 text-white text-xs font-bold rounded-xl transition-colors truncate" style={{ backgroundColor: '#a68a64' }}>{t('add')}</button>
                            <button onClick={() => { setAdvancePayOpen(null); setAdvancePayMethod('cash'); }}
                              className="h-11 min-w-0 w-full px-2 border border-gray-200 text-gray-500 text-xs font-bold rounded-xl hover:bg-gray-50 transition-colors truncate">{t('cancel')}</button>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="grid grid-cols-1 gap-2 pt-1 mt-auto">
                        {adv.phone && <>
                          <a href={`tel:${adv.phone}`} onClick={() => updateAdvance(activeShop.id, adv.id, { lastCalledAt: new Date().toISOString() })} className="min-h-10 min-w-0 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black">
                            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92z" /></svg>
                            <span className="min-w-0 text-center"><span className="block truncate">{it ? 'Chiama' : 'Call'}</span>{adv.lastCalledAt && <span className="block mt-0.5 text-[8px] font-bold opacity-65 leading-tight">{it ? 'Chiamato' : 'Called'} · {fmtContactTime(adv.lastCalledAt)}</span>}</span>
                          </a>
                          <a href={`https://wa.me/${String(adv.phone).replace(/\D/g, '')}?text=${whatsappText}`} target="_blank" rel="noreferrer" onClick={() => updateAdvance(activeShop.id, adv.id, { lastWhatsappAt: new Date().toISOString() })} className="min-h-10 min-w-0 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 text-[10px] font-black">
                            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2a9.84 9.84 0 0 0-8.52 14.77L2 22l5.38-1.41A9.96 9.96 0 0 0 12.04 22 9.92 9.92 0 0 0 12.04 2Zm0 18.32a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.19.84.85-3.11-.2-.32a8.17 8.17 0 1 1 7.02 3.91Zm4.49-6.13c-.25-.12-1.46-.72-1.68-.8-.23-.08-.39-.12-.56.12-.16.25-.64.8-.78.97-.15.16-.29.18-.54.06-.25-.12-1.04-.38-1.99-1.23a7.47 7.47 0 0 1-1.38-1.72c-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.83-.2-.49-.41-.42-.56-.43h-.47c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.57.12.17 1.75 2.67 4.24 3.75.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.17.2-.58.2-1.08.14-1.18-.06-.1-.22-.16-.47-.28Z" /></svg>
                            <span className="min-w-0 text-center"><span className="block truncate">WhatsApp</span>{adv.lastWhatsappAt && <span className="block mt-0.5 text-[8px] font-bold opacity-65 leading-tight">{it ? 'Inviato' : 'Sent'} · {fmtContactTime(adv.lastWhatsappAt)}</span>}</span>
                          </a>
                        </>}
                        <button onClick={() => setAdvanceDeleteId(adv.id)}
                          className="min-h-10 min-w-0 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 border border-red-200 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors text-[10px] font-black">
                          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" /></svg>
                          <span className="truncate">{it ? 'Elimina' : 'Delete'}</span>
                        </button>
                        {!fullyCleared && (
                          <button onClick={() => { setAdvancePayOpen(isPayOpen ? null : adv.id); setAdvancePayAmt(''); setAdvancePayMethod('cash'); }}
                            className="h-10 min-w-0 w-full flex items-center justify-center gap-1.5 px-2 border border-blue-200 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-[10px] leading-tight font-black text-center">
                            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M16 15h2M12 15h.01" /><path d="M19 2v6M16 5h6" /></svg>
                            <span className="min-w-0">{t('addPayment')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Advance form */}
            {addAdvanceOpen && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-dashed border-amber-500/30">
                <p className="text-sm font-bold text-amber-400 mb-4">{t('newCustomerAdvance')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  {[
                    ['customerName', `${t('customerName')} *`, 'Mario Rossi', 'text'],
                    ['phone', t('phone'), '+39 300-0000000', 'text'],
                    ['totalAmount', `${t('totalAmount')} (${currencyObj.symbol}) *`, '25000', 'number'],
                    ['advancePaid', `${t('advancePaid')} (${currencyObj.symbol}) · ${it ? 'vuoto = pagamento completo' : 'blank = full payment'}`, it ? 'Lascia vuoto se pagato tutto' : 'Leave blank if fully paid', 'number'],
                    ['productCost', `Costo Prodotti (${currencyObj.symbol})`, '5000', 'number'],
                    ['email', t('clientEmail'), 'mario@email.com', 'email'],
                    ['orderDate', it ? 'Data ordine' : 'Order date', '', 'date'],
                    ['expectedDate', it ? 'Arrivo previsto' : 'Expected arrival', '', 'date'],
                  ].map(([key, label, ph, type]) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                      <input
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
                        type={type} min={type === 'number' ? '0' : undefined}
                        value={advanceForm[key]}
                        onChange={(e) => { setAdvanceForm((f) => ({ ...f, [key]: e.target.value })); setAdvanceFormError(''); }}
                        placeholder={ph} autoFocus={key === 'customerName'}
                      />
                    </div>
                  ))}
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{t('descriptionDevice')}</label>
                  <input className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
                    value={advanceForm.description} onChange={(e) => setAdvanceForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder={t('advanceRepairPlaceholder')} />
                </div>
                {/* Payment Method */}
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t('paymentMethod')}</label>
                  <div className="flex gap-1 p-0.5 bg-gray-100 rounded-lg w-full sm:w-64">
                    {['cash', 'card'].map((m) => (
                      <button key={m} type="button" onClick={() => setAdvanceForm((f) => ({ ...f, paymentMethod: m }))}
                        className={`flex-1 py-2 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition-all ${advanceForm.paymentMethod === m ? (m === 'cash' ? 'bg-white text-emerald-700 shadow-sm' : 'bg-white text-blue-700 shadow-sm') : 'text-gray-500'}`}>
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
                {advanceFormError && <p className="text-xs text-red-500 mb-3">{advanceFormError}</p>}
                <div className="flex gap-3">
                  <button onClick={() => { setAddAdvanceOpen(false); setAdvanceFormError(''); setAdvanceForm(emptyAdvanceForm); }}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm">{t('cancel')}</button>
                  <button onClick={handleAddAdvance}
                    className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors text-sm shadow-sm">{t('saveEntry')}</button>
                </div>
              </div>
            )}
          </div>
      {/* Advance delete confirm */}
      {advanceDeleteId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-2">{t('deleteAdvance')}</h3>
            <p className="text-sm text-gray-500 mb-6">{t('cannotBeUndone')}</p>
            <div className="flex gap-3">
              <button onClick={() => setAdvanceDeleteId(null)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors">{t('cancel')}</button>
              <button onClick={() => { deleteAdvance(activeShop.id, advanceDeleteId); setAdvanceDeleteId(null); }} className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors">{t('delete')}</button>
            </div>
          </div>
        </div>
      )}



          </>
        );
}
