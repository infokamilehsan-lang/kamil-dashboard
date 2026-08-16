import { useEffect, useMemo, useState } from 'react';
import { useShop } from '../context/ShopContext';
import { useLanguage } from '../context/LanguageContext';
import { useFmt } from '../lib/useFmt';
import { buildFinancialLedger, financialSummary } from '../lib/financials';
import { inventoryMetrics } from '../lib/inventoryMetrics';
import { SIDEBAR_MODULE_IDS } from '../data/sidebarModules';

const dayKey = (value) => (value || '').slice(0, 10);
const clientKey = (person = {}) => String(person.phone || person.buyerPhone || '').replace(/\D/g, '') || String(person.email || person.buyerEmail || '').trim().toLowerCase() || String(person.name || person.customerName || person.buyerName || '').trim().toLowerCase();

export default function OverviewPageNew({ setPage, setAddTxOpen }) {
  const { activeShop, contacts } = useShop();
  const { locale } = useLanguage();
  const { fmt, fmtDate } = useFmt();
  const [doneTasks, setDoneTasks] = useState({});
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedDay, setSelectedDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [healthOpen, setHealthOpen] = useState(false);
  const [financePopup, setFinancePopup] = useState(null);
  const [noteSlide, setNoteSlide] = useState(0);
  const [selectedHomeNote, setSelectedHomeNote] = useState(null);
  const it = String(locale || '').toLowerCase().startsWith('it');
  const enabledModules = new Set(Array.isArray(activeShop?.sidebarModules) ? activeShop.sidebarModules : SIDEBAR_MODULE_IDS);
  const hasService = (id) => enabledModules.has(id);
  const taskStorageKey = `overview-tasks-${activeShop?.id || 'shop'}-${new Date().toISOString().slice(0, 10)}`;

  useEffect(() => {
    try { setDoneTasks(JSON.parse(localStorage.getItem(taskStorageKey) || '{}')); } catch { setDoneTasks({}); }
  }, [taskStorageKey]);

  const toggleTask = (id) => {
    setDoneTasks((current) => {
      const next = { ...current, [id]: !current[id] };
      localStorage.setItem(taskStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const data = useMemo(() => {
    const txs = hasService('reports') ? (activeShop?.transactions || []) : [];
    const repairs = hasService('repairs') ? (activeShop?.repairs || []) : [];
    const advances = hasService('advances') ? (activeShop?.advances || []) : [];
    const stock = hasService('inventory') ? (activeShop?.skus || []) : [];
    const secondhand = hasService('secondhand') ? (activeShop?.secondhand || []) : [];
    const notes = hasService('notes') ? (activeShop?.notes || []) : [];
    const today = new Date().toISOString().slice(0, 10);

    const ledger = hasService('reports') ? buildFinancialLedger(activeShop) : [];
    const summary = hasService('reports') ? financialSummary(activeShop) : { income: 0, expense: 0, profit: 0, margin: 0 };
    const revenue = summary.income;
    const expenses = summary.expense;
    const { profit, margin } = summary;

    const terminalRepairStates = ['delivered', 'completed', 'cancelled', 'consegnato', 'annullato'];
    const repairStatus = (repair) => String(repair.status || 'pending').trim().toLowerCase();
    const pendingRepairs = repairs.filter((repair) => !terminalRepairStates.includes(repairStatus(repair)) && repairStatus(repair) !== 'ready');
    const readyRepairs = repairs.filter((repair) => ['ready', 'pronto'].includes(repairStatus(repair)));
    const inventory = inventoryMetrics(stock);
    const lowStock = inventory.lowStock;
    const supplierPayable = stock.reduce((sum, item) => sum + Math.max(0, Number(item.supplierAccount?.remaining) || 0), 0);
    const pendingAdvance = advances.reduce((sum, x) => {
      const total = Number(x.totalAmount ?? x.amount ?? x.salePrice ?? x.price) || 0;
      const paid = Number(x.advancePaid ?? x.paid ?? x.advance) || 0;
      const remaining = x.remaining !== undefined ? Number(x.remaining) || 0 : Math.max(total - paid, 0);
      return sum + Math.max(remaining, 0);
    }, 0);
    const unpaidRepairs = repairs.filter((repair) => {
      if (terminalRepairStates.includes(repairStatus(repair)) && repairStatus(repair) !== 'completed') return false;
      const paid = (Number(repair.advance) || 0) + (repair.payments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
      return Math.max((Number(repair.repairCost) || 0) - paid, 0) > 0;
    });
    const pendingPartOrders = repairs.reduce((count, repair) => count + (repair.orders || []).filter((order) => !['received', 'cancelled'].includes(String(order.status || 'pending').toLowerCase())).length, 0);
    const repairBalance = unpaidRepairs.reduce((sum, repair) => {
      const paid = (Number(repair.advance) || 0) + (repair.payments || []).reduce((paymentSum, payment) => paymentSum + (Number(payment.amount) || 0), 0);
      return sum + Math.max((Number(repair.repairCost) || 0) - paid, 0);
    }, 0);
    const financialRisk = revenue > 0 && profit < 0 ? 1 : 0;
    const noActivity = ledger.length === 0 && repairs.length === 0 && stock.length === 0 && advances.length === 0;
    const attention = pendingRepairs.length + readyRepairs.length + lowStock.length + unpaidRepairs.length + pendingPartOrders + (pendingAdvance > 0 ? 1 : 0) + financialRisk + (noActivity ? 1 : 0);
    const healthPenalty =
      Math.min(pendingRepairs.length * 4, 24) +
      Math.min(readyRepairs.length * 2, 10) +
      Math.min(lowStock.length * 6, 30) +
      Math.min(unpaidRepairs.length * 3, 15) +
      Math.min(pendingPartOrders * 3, 12) +
      (pendingAdvance > 0 ? 8 : 0) +
      (financialRisk ? 25 : 0) +
      (noActivity ? 35 : 0);
    const completedRepairs = repairs.filter((repair) => ['ready', 'pronto', 'delivered', 'completed', 'consegnato'].includes(repairStatus(repair))).length;
    // Health must be earned from real activity; having no open issues alone is not a perfect score.
    const healthBase = 40;
    const activityPoints = Math.min(15, ledger.length * 2);
    const profitPoints = revenue > 0 ? (profit > 0 ? 15 : profit === 0 ? 6 : 0) : 0;
    const marginPoints = profit > 0 ? Math.min(10, Math.max(0, margin) / 4) : 0;
    const repairPoints = Math.min(10, completedRepairs * 2);
    const stockPoints = stock.length > 0 ? Math.max(0, 5 - Math.min(5, lowStock.length)) : 0;
    const cleanOperationsPoints = attention === 0 && !noActivity ? 5 : 0;
    const health = Math.round(Math.max(0, Math.min(100, healthBase + activityPoints + profitPoints + marginPoints + repairPoints + stockPoints + cleanOperationsPoints - healthPenalty)));

    const trend = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const key = date.toISOString().slice(0, 10);
      const income = ledger.filter((x) => x.date === key && x.type === 'income').reduce((s, x) => s + x.amount, 0);
      const expense = ledger.filter((x) => x.date === key && x.type === 'expense').reduce((s, x) => s + x.amount, 0);
      return { key, label: date.toLocaleDateString(locale, { weekday: 'short' }).slice(0, 2), fullLabel: date.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'short' }), income, expense, net: income - expense, count: ledger.filter((x) => x.date === key).length };
    });
    const trendMax = Math.max(...trend.flatMap((x) => [x.income, x.expense]), 1);
    const posEntries = ledger.filter((entry) => entry.type === 'income' && ['card', 'pos', 'carta'].includes(String(entry.paymentMethod || '').toLowerCase()));
    const posTotal = posEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const cashEntries = ledger.filter((entry) => entry.type === 'income' && !['card', 'pos', 'carta'].includes(String(entry.paymentMethod || '').toLowerCase()));
    const cashTotal = cashEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const trendIncome = trend.reduce((sum, day) => sum + day.income, 0);
    const trendExpense = trend.reduce((sum, day) => sum + day.expense, 0);
    const trendNet = trendIncome - trendExpense;
    const bestTrendDay = [...trend].sort((a, b) => b.net - a.net)[0];

    const recent = [
      ...txs.map((x) => ({ id: `tx-${x.id}`, date: x.date, title: x.description || (x.type === 'income' ? (it ? 'Entrata' : 'Income') : (it ? 'Uscita' : 'Expense')), meta: x.category || (it ? 'Transazione' : 'Transaction'), amount: Number(x.amount) || 0, positive: x.type === 'income', page: 'reports' })),
      ...repairs.map((x) => ({ id: `rep-${x.id}`, date: x.updatedAt || x.createdAt, title: `${x.customerName || ''}${x.device ? ` · ${x.device}` : ''}` || (it ? 'Riparazione' : 'Repair'), meta: it ? 'Riparazione' : 'Repair', amount: Number(x.repairCost) || 0, positive: true, page: 'repairs' })),
      ...stock.flatMap((sku) => (sku.movements || []).map((movement) => ({ id: `inv-${sku.id}-${movement.id}`, date: movement.date, title: sku.name || sku.code, meta: movement.type === 'in' ? (it ? 'Nuovo stock' : 'New stock') : (it ? 'Vendita inventario' : 'Inventory sale'), amount: (Number(movement.price) || 0) * (Number(movement.qty) || 1), positive: movement.type === 'out', page: 'inventory' }))),
      ...stock.filter((sku) => sku.supplierAccount?.updatedAt).map((sku) => ({ id: `supplier-${sku.id}`, date: sku.supplierAccount.updatedAt, title: sku.supplierAccount.company || (it ? 'Fornitore' : 'Supplier'), meta: it ? 'Conto fornitore aggiornato' : 'Supplier account updated', amount: Number(sku.supplierAccount.remaining) || 0, positive: false, page: 'inventory' })),
      ...advances.map((advance) => ({ id: `adv-${advance.id}`, date: advance.updatedAt || advance.date, title: advance.customerName || advance.productName || (it ? 'Anticipo' : 'Advance'), meta: it ? 'Anticipo cliente' : 'Customer advance', amount: Number(advance.advancePaid ?? advance.amount) || 0, positive: true, page: 'advances' })),
      ...secondhand.map((item) => ({ id: `used-${item.id}`, date: item.sellDate || item.buyDate || item.createdAt, title: item.itemName || item.model || (it ? 'Usato' : 'Second hand'), meta: item.status === 'sold' ? (it ? 'Usato venduto' : 'Second hand sold') : (it ? 'Usato acquistato' : 'Second hand purchased'), amount: Number(item.status === 'sold' ? item.sellPrice : item.buyPrice) || 0, positive: item.status === 'sold', page: 'secondhand' })),
      ...notes.map((note) => ({ id: `note-${note.id}`, date: note.updatedAt || note.createdAt || note.date, title: note.name || note.title || (it ? 'Nota rapida' : 'Quick note'), meta: it ? 'Nota rapida' : 'Quick note', amount: 0, positive: true, page: 'notes' })),
    ].filter((x) => x.date && hasService(x.page)).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 12);

    const customerOrders = [...advances].sort((a, b) => new Date(b.orderDate || b.createdAt || b.date || 0) - new Date(a.orderDate || a.createdAt || a.date || 0));
    return { revenue, expenses, profit, margin, ledger, today, posEntries, posTotal, cashEntries, cashTotal, inventory, supplierPayable, secondhand, notes, totalRepairs: repairs.length, completedRepairs, pendingRepairs, readyRepairs, lowStock, unpaidRepairs, repairBalance, pendingPartOrders, pendingAdvance, customerOrders, financialRisk, noActivity, attention, health, trend, trendMax, trendIncome, trendExpense, trendNet, bestTrendDay, recent, todayCount: ledger.filter((x) => x.date === today).length };
  }, [activeShop, it, locale]);

  const homeClients = useMemo(() => {
    const map = new Map();
    const add = (person, visit = false) => {
      const key = clientKey(person);
      if (!key) return;
      const current = map.get(key) || { id: person.id || key, name: person.name || person.customerName || person.buyerName || (it ? 'Cliente' : 'Customer'), phone: person.phone || person.buyerPhone || '', email: person.email || person.buyerEmail || '', visits: 0 };
      if (!current.phone) current.phone = person.phone || person.buyerPhone || '';
      if (!current.email) current.email = person.email || person.buyerEmail || '';
      current.visits += visit ? 1 : 0;
      map.set(key, current);
    };
    (contacts || []).forEach((contact) => { add(contact); const saved = map.get(clientKey(contact)); if (saved) saved.visits += (contact.visitLog || []).length; });
    (activeShop?.repairs || []).forEach((item) => add({ ...item, name: item.customerName }, true));
    (activeShop?.advances || []).forEach((item) => add({ ...item, name: item.customerName }, true));
    (activeShop?.secondhand || []).filter((item) => item.status === 'sold').forEach((item) => add({ name: item.buyerName, phone: item.buyerPhone, email: item.buyerEmail }, true));
    return [...map.values()].sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name, locale)).slice(0, 8);
  }, [activeShop, contacts, it, locale]);

  useEffect(() => {
    if (data.notes.length <= 3) { setNoteSlide(0); return undefined; }
    const timer = window.setInterval(() => setNoteSlide((current) => (current + 3) % data.notes.length), 4500);
    return () => window.clearInterval(timer);
  }, [data.notes.length]);

  const visibleHomeNotes = data.notes.length ? Array.from({ length: Math.min(3, data.notes.length) }, (_, offset) => data.notes[(noteSlide + offset) % data.notes.length]).filter(Boolean) : [];

  const attentionItems = [
    ...(hasService('repairs') && data.readyRepairs.length ? [{ page: 'repairs', value: data.readyRepairs.length, title: it ? 'Riparazioni pronte' : 'Repairs ready', copy: it ? 'Avvisa i clienti e completa le consegne.' : 'Notify customers and complete delivery.' }] : []),
    ...(hasService('inventory') && data.lowStock.length ? [{ page: 'inventory', value: data.lowStock.length, title: it ? 'Scorte da riordinare' : 'Stock to reorder', copy: it ? 'Aggiorna lo stock prima di perdere vendite.' : 'Replenish stock before missing sales.' }] : []),
    ...(hasService('advances') && data.pendingAdvance > 0 ? [{ page: 'advances', value: fmt(data.pendingAdvance), title: it ? 'Anticipi aperti' : 'Outstanding advances', copy: it ? 'Controlla i pagamenti ancora da incassare.' : 'Review payments that still need collecting.' }] : []),
  ];
  const dailyTasks = [
    { id: 'cash', label: it ? 'Controlla entrate e uscite di oggi' : 'Review today’s income and expenses', page: 'reports' },
    ...(hasService('repairs') ? [{ id: 'repairs', label: it ? 'Aggiorna le riparazioni aperte' : 'Update open repair statuses', page: 'repairs' }] : []),
    ...(hasService('inventory') ? [{ id: 'stock', label: it ? 'Verifica gli articoli con scorte basse' : 'Check low-stock products', page: 'inventory' }] : []),
    ...(hasService('advances') ? [{ id: 'payments', label: it ? 'Controlla i pagamenti da incassare' : 'Review payments to collect', page: 'advances' }] : []),
    { id: 'customers', label: it ? 'Rispondi ai messaggi dei clienti' : 'Reply to customer messages', page: 'whatsapp' },
  ];
  const completedTasks = dailyTasks.filter((task) => doneTasks[task.id]).length;
  const calendar = useMemo(() => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const mondayOffset = (firstDay.getDay() + 6) % 7;
    const transactions = buildFinancialLedger(activeShop);
    const byDay = {};
    transactions.forEach((tx) => {
      const key = tx.date;
      if (!key?.startsWith(calendarMonth)) return;
      if (!byDay[key]) byDay[key] = { income: 0, expense: 0, count: 0 };
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'income') byDay[key].income += amount;
      else byDay[key].expense += amount;
      byDay[key].count += 1;
    });
    const cells = Array.from({ length: 42 }, (_, index) => {
      const day = index - mondayOffset + 1;
      if (day < 1 || day > daysInMonth) return null;
      const key = `${calendarMonth}-${String(day).padStart(2, '0')}`;
      const totals = byDay[key] || { income: 0, expense: 0, count: 0 };
      return { day, key, ...totals, net: totals.income - totals.expense };
    });
    const monthIncome = Object.values(byDay).reduce((sum, item) => sum + item.income, 0);
    const monthExpense = Object.values(byDay).reduce((sum, item) => sum + item.expense, 0);
    return { cells, byDay, monthIncome, monthExpense, label: firstDay.toLocaleDateString(locale, { month: 'long', year: 'numeric' }) };
  }, [activeShop, calendarMonth, locale]);
  const selectedTotals = calendar.byDay[selectedDay] || { income: 0, expense: 0, count: 0 };
  const moveCalendar = (amount) => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const next = new Date(year, month - 1 + amount, 1);
    const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    setCalendarMonth(nextMonth);
    setSelectedDay(`${nextMonth}-01`);
  };

  return (
    <main className="space-y-5 sm:space-y-6 pb-8">
      <header className="py-1 flex flex-col xl:flex-row xl:items-center gap-3 xl:gap-5">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {activeShop?.image ? <img src={activeShop.image} alt={activeShop.name} className="w-12 h-12 rounded-2xl object-cover border border-black/10 shadow-sm shrink-0" /> : <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shrink-0 border border-black/10" style={{ background: '#c6ff34' }}>{activeShop?.name?.charAt(0)?.toUpperCase() || 'S'}</div>}
          <div className="flex items-center gap-2 shrink-0">
            <h2 className="text-xl sm:text-2xl font-black tracking-[-.045em] text-gray-900 whitespace-nowrap">{activeShop?.name}</h2>
            {activeShop?.type && <span className="px-2.5 py-1 rounded-full text-[9px] uppercase tracking-wider font-black whitespace-nowrap" style={{ background: '#f1fec8' }}>{activeShop.type}</span>}
          </div>
          <div className="min-w-0 flex-1 overflow-hidden shop-info-line">
            <div className="flex items-center gap-4 min-w-max text-[11px] font-semibold text-gray-500 shop-info-track">
              {activeShop?.description && <span>{activeShop.description}</span>}
              {(activeShop?.address || activeShop?.city) && <span>⌖ {[activeShop.address, activeShop.city].filter(Boolean).join(', ')}</span>}
              {activeShop?.phone && <a href={`tel:${activeShop.phone}`} className="hover:text-gray-900">☎ {activeShop.phone}</a>}
              {activeShop?.whatsapp && <a href={`https://wa.me/${String(activeShop.whatsapp).replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="hover:text-gray-900">WhatsApp {activeShop.whatsapp}</a>}
              {activeShop?.email && <a href={`mailto:${activeShop.email}`} className="hover:text-gray-900">✉ {activeShop.email}</a>}
              {activeShop?.ragioneSociale && <span className="shop-business-chip"><strong>{it ? 'Ragione sociale' : 'Company'}:</strong> {activeShop.ragioneSociale}</span>}
              {activeShop?.partitaIva && <span className="shop-business-chip"><strong>P. IVA:</strong> {activeShop.partitaIva}</span>}
              {activeShop?.codiceFiscale && <span className="shop-business-chip"><strong>C.F.:</strong> {activeShop.codiceFiscale}</span>}
              {activeShop?.pec && <span className="shop-business-chip"><strong>Email:</strong> {activeShop.pec}</span>}
              {activeShop?.sdiCode && <span className="shop-business-chip"><strong>SDI:</strong> {activeShop.sdiCode}</span>}
              {activeShop?.rea && <span className="shop-business-chip"><strong>REA:</strong> {activeShop.rea}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {hasService('reports') && <button onClick={() => setPage('reports')} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-gray-200">{it ? 'Report completi' : 'Full reports'}</button>}
          {hasService('reports') && <button onClick={() => setAddTxOpen(true)} className="px-4 py-2.5 rounded-xl text-xs font-black border border-black/10" style={{ background: '#c6ff34' }}>+ {it ? 'Transazione' : 'Transaction'}</button>}
        </div>
      </header>

      {hasService('notes') && <section className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {visibleHomeNotes.length ? visibleHomeNotes.map((note, index) => { const total = Number(note.totalAmount ?? note.amount) || 0; const paid = Number(note.paidAmount) || 0; const remaining = Math.max(total - paid, 0); return <button type="button" key={`${note.id}-${noteSlide}-${index}`} onClick={() => setSelectedHomeNote(note)} className={`${index === 1 ? 'overview-note-attention' : ''} rounded-2xl border border-black/10 bg-white p-3.5 text-left shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all`}><div className="flex items-start gap-3"><span className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center" style={{ background: index === 0 ? '#c6ff34' : '#f1fec8' }}><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h6" /></svg></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="text-xs font-black truncate">{note.name || (it ? 'Nota' : 'Note')}</p>{(note.appointmentDate || note.date) && <span className="text-[8px] font-bold text-gray-400 shrink-0">{fmtDate(note.appointmentDate || note.date)}</span>}</div>{note.appointmentFor && <p className="text-[10px] font-black text-green-800 truncate mt-1">{it ? 'Per' : 'For'}: {note.appointmentFor}</p>}<p className="text-[10px] text-gray-500 line-clamp-2 mt-1 min-h-7">{note.appointmentDescription || note.details || (it ? 'Promemoria salvato' : 'Saved reminder')}</p></div></div><div className="flex items-center gap-1.5 flex-wrap mt-3 pt-2.5 border-t border-black/5">{note.appointmentTime && <span className="px-2 py-1 rounded-lg bg-[#f1fec8] text-[9px] font-black">◷ {note.appointmentTime}</span>}{note.phone && <span className="px-2 py-1 rounded-lg bg-gray-50 text-[9px] font-bold truncate max-w-28">☎ {note.phone}</span>}{total > 0 && <><span className="px-2 py-1 rounded-lg bg-[#f1fec8] text-[9px] font-black">{it ? 'Totale' : 'Total'} {fmt(total)}</span><span className="px-2 py-1 rounded-lg text-[9px] font-black" style={{ background: remaining > 0 ? '#fff0e8' : '#c6ff34' }}>{it ? 'Resta' : 'Due'} {fmt(remaining)}</span></>}</div></button>; }) : <button type="button" onClick={() => setPage('notes')} className="md:col-span-3 rounded-2xl border-2 border-dashed border-gray-200 px-4 py-3 text-left text-xs font-bold text-gray-400 hover:border-lime-300">+ {it ? 'Aggiungi una nota o un appuntamento' : 'Add a note or appointment'}</button>}
      </section>}

      <section className="rounded-3xl border border-black/10 bg-white p-3 sm:p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="flex-1 flex items-center gap-3 rounded-2xl border border-black/10 px-4 py-3" style={{ background: '#f1fec8' }}>
            <span className="w-9 h-9 rounded-xl flex items-center justify-center font-black" style={{ background: '#c6ff34' }}>✓</span>
            <div><p className="text-[10px] uppercase tracking-[.14em] font-black text-gray-500">{it ? 'Stato di oggi' : 'Today status'}</p><p className="text-sm font-black">{data.attention ? `${data.attention} ${it ? 'attività da controllare' : 'items need attention'}` : (it ? 'Tutto sotto controllo' : 'Everything is under control')}</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasService('reports') && <button onClick={() => setAddTxOpen(true)} className="px-3 sm:px-4 py-3 rounded-2xl text-xs font-black border border-black/10" style={{ background: '#c6ff34' }}>+ {it ? 'Vendita' : 'Sale'}</button>}
            {hasService('notes') && <button onClick={() => setPage('notes')} className="px-3 sm:px-4 py-3 rounded-2xl text-xs font-black border border-black/10 bg-white">✎ {it ? 'Nota' : 'Note'}</button>}
            {hasService('whatsapp') && <button onClick={() => setPage('whatsapp')} className="px-3 sm:px-4 py-3 rounded-2xl text-xs font-black border border-black/10 bg-white">◉ WhatsApp</button>}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {hasService('reports') && <article className="xl:col-span-7 rounded-[2rem] p-5 sm:p-7 min-h-[260px] relative overflow-hidden border border-black/10" style={{ background: 'radial-gradient(circle at 85% 10%,rgba(255,255,255,.72),transparent 34%),linear-gradient(135deg,#baff20,#dcff7d 62%,#f1fec8)', boxShadow: '0 24px 60px rgba(91,122,0,.16)' }}>
          <div className="absolute -right-14 -top-20 w-64 h-64 rounded-full border border-black/5" />
          <div className="relative h-full flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-gray-600">{it ? 'Profitto netto' : 'Net profit'}</p><p className="text-4xl sm:text-5xl font-black tracking-[-.055em] mt-2">{fmt(data.profit)}</p></div>
              <span className="px-3 py-1.5 rounded-full text-xs font-black bg-white/70 border border-black/10">{data.margin}% {it ? 'margine' : 'margin'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2.5 mt-auto pt-8">
              {[{ key: 'income', label: it ? 'Entrate' : 'Revenue', value: fmt(data.revenue) }, { key: 'expense', label: it ? 'Uscite' : 'Expenses', value: fmt(data.expenses) }, { key: 'pos', label: it ? 'Pagamenti POS' : 'POS payments', value: fmt(data.posTotal) }].map((x) => <button type="button" onClick={() => setFinancePopup(x.key)} key={x.key} className="rounded-2xl p-3 bg-white/65 border border-black/8 text-left hover:bg-white hover:-translate-y-1 hover:shadow-lg transition-all"><p className="text-[9px] uppercase font-black text-gray-500">{x.label}</p><p className="text-sm sm:text-base font-black mt-1 truncate">{x.value}</p><span className="hidden sm:block text-[8px] font-bold text-gray-400 mt-2">{it ? 'Apri dettagli' : 'View details'}</span></button>)}
            </div>
          </div>
        </article>}

        <article className={`${hasService('reports') ? 'xl:col-span-5' : 'xl:col-span-12'} bg-white rounded-3xl border border-gray-200 p-5 sm:p-6 shadow-sm`}>
          <button type="button" onClick={() => setHealthOpen(true)} className="w-full flex items-center gap-5 text-left rounded-2xl hover:bg-gray-50 transition-colors" title={it ? 'Apri dettagli salute' : 'Open health details'}>
            <div className="w-24 h-24 rounded-full flex items-center justify-center shrink-0" style={{ background: `conic-gradient(#c6ff34 ${data.health * 3.6}deg,#f1fec8 0)` }}><div className="w-[72px] h-[72px] rounded-full bg-white flex flex-col items-center justify-center shadow-inner"><strong className="text-2xl">{data.health}</strong><span className="text-[9px] text-gray-400">/100</span></div></div>
            <div><p className="text-[10px] uppercase tracking-[.16em] font-black text-gray-400">{it ? 'Salute negozio' : 'Shop health'}</p><h3 className="text-xl font-black mt-1">{data.health >= 80 ? (it ? 'Ottima' : 'Excellent') : data.health >= 60 ? (it ? 'Buona' : 'Good') : (it ? 'Da migliorare' : 'Needs attention')}</h3><p className="text-xs text-gray-500 mt-1">{data.attention} {it ? 'priorità aperte' : 'open priorities'}</p></div>
          </button>
          <div className="grid grid-cols-2 gap-2 mt-5">
            {[{ label: it ? 'Riparazioni totali' : 'Total repairs', value: data.totalRepairs, page: 'repairs' }, { label: it ? 'Pronte / completate' : 'Ready / completed', value: data.completedRepairs, page: 'repairs' }, { label: it ? 'Scorte basse' : 'Low stock', value: data.lowStock.length, page: 'inventory' }, { label: it ? 'Da pagare ai fornitori' : 'Supplier balance due', value: fmt(data.supplierPayable), page: 'inventory' }].filter((x) => hasService(x.page)).map((x) => <button key={x.label} onClick={() => setPage(x.page)} className="text-left rounded-2xl p-3 border border-black/5" style={{ background: '#f1fec8' }}><strong className="block text-lg truncate">{x.value}</strong><span className="text-[10px] font-bold text-gray-500">{x.label}</span></button>)}
          </div>
        </article>
      </section>

      {hasService('reports') && <><section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <article className="lg:col-span-7 bg-white rounded-3xl border border-gray-200 p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[.16em] font-black text-gray-400">{it ? 'Ultimi 7 giorni' : 'Last 7 days'}</p><h3 className="text-xl font-black mt-1">{it ? 'Flusso finanziario' : 'Cash flow trend'}</h3></div><button onClick={() => setPage('reports')} className="text-xs font-bold px-3 py-2 rounded-xl" style={{ background: '#f1fec8' }}>{it ? 'Dettagli' : 'Details'}</button></div>
          <div className="h-48 flex items-end gap-2 sm:gap-4 mt-6 border-b border-gray-100">
            {data.trend.map((day) => <div key={day.key} className="flex-1 h-full flex flex-col justify-end items-center gap-1"><div className="w-full flex items-end justify-center gap-1 h-[150px]"><div className="w-[38%] rounded-t-lg min-h-[3px]" title={`${it ? 'Entrate' : 'Income'}: ${fmt(day.income)}`} style={{ height: `${Math.max((day.income / data.trendMax) * 100, 2)}%`, background: '#c6ff34' }} /><div className="w-[38%] rounded-t-lg min-h-[3px]" title={`${it ? 'Uscite' : 'Expense'}: ${fmt(day.expense)}`} style={{ height: `${Math.max((day.expense / data.trendMax) * 100, 2)}%`, background: '#f1fec8', border: '1px solid rgba(16,20,8,.1)' }} /></div><span className="text-[10px] font-bold text-gray-400 py-2 uppercase">{day.label}</span></div>)}
          </div>
          <div className="flex gap-4 mt-3 text-[10px] font-bold text-gray-500"><span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full" style={{ background: '#c6ff34' }} />{it ? 'Entrate' : 'Income'}</span><span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ background: '#f1fec8' }} />{it ? 'Uscite' : 'Expenses'}</span></div>
        </article>

        <article className="lg:col-span-5 bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[.16em] font-black text-gray-400">{it ? 'Aggiornamenti' : 'Updates'}</p><h3 className="text-xl font-black mt-1">{it ? 'Attività recente' : 'Recent activity'}</h3></div><span className="text-xs font-black px-2.5 py-1.5 rounded-full" style={{ background: '#c6ff34' }}>{data.recent.length}</span></div>
          <div className="divide-y divide-gray-100 max-h-[245px] overflow-y-auto overscroll-contain">
            {data.recent.length === 0 ? <p className="p-8 text-center text-sm text-gray-400">{it ? 'Nessuna attività ancora.' : 'No activity yet.'}</p> : data.recent.map((x) => <button type="button" onClick={() => x.page && setPage(x.page)} key={x.id} className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"><span className="w-9 h-9 rounded-xl flex items-center justify-center font-black" style={{ background: x.positive ? '#c6ff34' : '#f1fec8' }}>{x.positive ? '+' : '−'}</span><div className="flex-1 min-w-0"><p className="text-sm font-bold truncate">{x.title}</p><p className="text-[10px] text-gray-400">{x.meta} · {fmtDate(x.date)}</p></div>{x.amount > 0 && <strong className="text-xs shrink-0">{x.positive ? '+' : '−'}{fmt(x.amount)}</strong>}<span className="text-gray-300">→</span></button>)}
          </div>
        </article>
      </section>

      <section className="rounded-3xl border border-black/10 p-5 sm:p-6 text-white" style={{ background: 'linear-gradient(135deg,#101408,#26320f)' }}>
        <div className="flex items-end justify-between gap-3 mb-4"><div><p className="text-[10px] uppercase tracking-[.16em] font-black text-white/50">{it ? 'Incassi negozio' : 'Shop payments'}</p><h3 className="text-xl font-black mt-1">POS &amp; {it ? 'Contanti' : 'Cash'}</h3></div><button type="button" onClick={() => setPage('reports')} className="text-xs font-black px-3 py-2 rounded-xl text-black" style={{ background: '#c6ff34' }}>{it ? 'Report' : 'Reports'} →</button></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><button type="button" onClick={() => setFinancePopup('pos')} className="rounded-2xl p-4 text-left border border-white/10 bg-white/8 hover:bg-white/12"><p className="text-[10px] uppercase font-black text-white/50">POS</p><strong className="block text-3xl mt-2 text-white">{fmt(data.posTotal)}</strong><span className="text-xs text-white/55">{data.posEntries.length} {it ? 'pagamenti' : 'payments'}</span></button><button type="button" onClick={() => setFinancePopup('cash')} className="rounded-2xl p-4 text-left border border-white/10 bg-white/8 hover:bg-white/12"><p className="text-[10px] uppercase font-black text-white/50">{it ? 'Contanti' : 'Cash'}</p><strong className="block text-3xl mt-2 text-white">{fmt(data.cashTotal)}</strong><span className="text-xs text-white/55">{data.cashEntries.length} {it ? 'pagamenti' : 'payments'}</span></button><div className="rounded-2xl p-4 border border-white/10" style={{ background: '#c6ff34', color: '#101408' }}><p className="text-[10px] uppercase font-black opacity-60">{it ? 'Totale incassato' : 'Total received'}</p><strong className="block text-3xl mt-2">{fmt(data.posTotal + data.cashTotal)}</strong><span className="text-xs opacity-60">POS + {it ? 'Contanti' : 'Cash'}</span></div></div>
      </section></>}

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {hasService('advances') && <article className="rounded-3xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="p-5 sm:p-6 border-b border-gray-100 flex items-start justify-between gap-4">
            <div><p className="text-[10px] uppercase tracking-[.16em] font-black text-gray-400">{it ? 'Ordini clienti' : 'Customer orders'}</p><h3 className="text-xl font-black mt-1">{it ? 'Tutti gli ordini' : 'All customer orders'}</h3></div>
            <button type="button" onClick={() => setPage('advances')} className="shrink-0 text-xs font-black px-3 py-2 rounded-xl" style={{ background: '#c6ff34' }}>{data.customerOrders.length} {it ? 'ordini' : 'orders'} →</button>
          </div>
          <div className="max-h-[330px] overflow-y-auto overscroll-contain divide-y divide-gray-100">
            {data.customerOrders.length === 0 ? <div className="p-10 text-center"><span className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center text-xl" style={{ background: '#f1fec8' }}>⌑</span><p className="text-sm font-black mt-3">{it ? 'Nessun ordine cliente' : 'No customer orders yet'}</p><button type="button" onClick={() => setPage('advances')} className="text-xs font-bold mt-2 text-gray-500">{it ? 'Aggiungi il primo ordine' : 'Add the first order'} →</button></div> : data.customerOrders.map((order) => {
              const total = Number(order.totalAmount ?? order.amount) || 0;
              const paid = Number(order.advancePaid ?? order.paid) || 0;
              const remaining = order.remaining !== undefined ? Number(order.remaining) || 0 : Math.max(total - paid, 0);
              const status = String(order.orderStatus || 'ordered').toLowerCase();
              const statusLabel = status === 'arrived' ? (it ? 'Arrivato' : 'Arrived') : ['done', 'cleared', 'completed'].includes(status) ? (it ? 'Completato' : 'Done') : (it ? 'Ordinato' : 'Ordered');
              return <button type="button" key={order.id} onClick={() => setPage('advances')} className="w-full p-4 sm:px-5 text-left hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3"><span className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center" style={{ background: status === 'arrived' ? '#c6ff34' : '#f1fec8' }}><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2l1 4h10l1-4M3 6h18l-1 14H4L3 6z" /><path d="M9 10v1a3 3 0 0 0 6 0v-1" /></svg></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="text-sm font-black truncate">{order.customerName || (it ? 'Cliente' : 'Customer')}</p><span className="shrink-0 text-[9px] uppercase tracking-wide font-black px-2 py-1 rounded-full" style={{ background: status === 'arrived' ? '#c6ff34' : '#f1fec8' }}>{statusLabel}</span></div><p className="text-xs text-gray-500 truncate mt-0.5">{order.description || (it ? 'Ordine cliente' : 'Customer order')}</p><div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] text-gray-500"><span>{fmtDate(order.orderDate || order.createdAt || order.date)}</span>{order.expectedDate && <span>{it ? 'Arrivo' : 'Due'}: {fmtDate(order.expectedDate)}</span>}<strong className="text-gray-900">{it ? 'Saldo' : 'Balance'}: {fmt(remaining)}</strong></div></div></div>
              </button>;
            })}
          </div>
        </article>}

        {(hasService('reports') || hasService('advances') || hasService('inventory') || hasService('repairs')) && <article className={`rounded-3xl border border-black/10 p-5 sm:p-6 ${hasService('advances') ? '' : 'lg:col-span-2'}`} style={{ background: 'linear-gradient(145deg,#f1fec8,#fff)' }}>
          <div><p className="text-[10px] uppercase tracking-[.16em] font-black text-gray-500">{it ? 'Controllo rapido' : 'Quick control'}</p><h3 className="text-xl font-black mt-1">{it ? 'Numeri operativi' : 'Operating numbers'}</h3></div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {[{ label: it ? 'Liquidità netta' : 'Net cash', value: fmt(data.profit), page: 'reports' }, { label: it ? 'Da incassare' : 'To collect', value: fmt(data.pendingAdvance + data.repairBalance), page: 'advances' }, { label: it ? 'Da pagare' : 'To pay', value: fmt(data.supplierPayable), page: 'inventory' }, { label: it ? 'Carico aperto' : 'Open workload', value: data.pendingRepairs.length + data.lowStock.length, page: data.pendingRepairs.length && hasService('repairs') ? 'repairs' : 'inventory' }].filter((item) => hasService(item.page)).map((item) => <button key={item.label} onClick={() => setPage(item.page)} className="rounded-2xl bg-white border border-black/10 p-4 text-left hover:-translate-y-0.5 hover:shadow-md transition-all"><p className="text-[9px] uppercase tracking-wider font-black text-gray-500">{item.label}</p><p className="text-xl font-black mt-1 truncate">{item.value}</p><span className="inline-block text-[10px] font-bold mt-3">{it ? 'Controlla' : 'Check'} →</span></button>)}
          </div>
          {hasService('reports') && <button type="button" onClick={() => setPage('reports')} className="w-full mt-3 py-3 rounded-2xl text-xs font-black border border-black/10" style={{ background: '#c6ff34' }}>{it ? 'Apri analisi completa' : 'Open full analysis'} →</button>}
        </article>}
      </section>

      {hasService('secondhand') && <section className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex items-end justify-between gap-3 mb-4"><div><p className="text-[10px] uppercase tracking-[.16em] font-black text-gray-400">{it ? 'Usato' : 'Secondhand'}</p><h3 className="text-xl font-black mt-1">{it ? 'Tutti i prodotti usati' : 'All secondhand products'}</h3></div><button type="button" onClick={() => setPage('secondhand')} className="text-xs font-black px-3 py-2 rounded-xl shrink-0" style={{ background: '#c6ff34' }}>{data.secondhand.length} {it ? 'prodotti' : 'products'} →</button></div>
        {data.secondhand.length === 0 ? <button type="button" onClick={() => setPage('secondhand')} className="w-full rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center hover:border-lime-300"><span className="block text-sm font-black">{it ? 'Nessun prodotto usato' : 'No secondhand products yet'}</span><span className="block text-xs text-gray-400 mt-1">{it ? 'Aggiungi il primo prodotto' : 'Add the first product'} →</span></button> : <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">{data.secondhand.map((item) => {
          const sold = item.status === 'sold';
          const itemProfit = sold ? (Number(item.sellPrice) || 0) - (Number(item.buyPrice) || 0) : null;
          return <button type="button" key={item.id} onClick={() => setPage('secondhand')} className="rounded-2xl border border-black/10 bg-white p-3.5 text-left hover:-translate-y-0.5 hover:shadow-md transition-all"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm font-black truncate">{item.itemName}</p><p className="text-[11px] text-gray-500 truncate mt-0.5">{[item.brand, item.model].filter(Boolean).join(' · ') || (item.imei ? `IMEI ${item.imei}` : '—')}</p></div><span className="shrink-0 px-2 py-1 rounded-full text-[8px] uppercase font-black" style={{ background: sold ? '#111' : '#c6ff34', color: sold ? '#fff' : '#111' }}>{sold ? (it ? 'Venduto' : 'Sold') : (it ? 'Disponibile' : 'In stock')}</span></div><div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-black/5"><span className="text-[10px] font-bold text-gray-500 truncate">{item.condition || '—'}</span><div className="flex items-center gap-3 text-right"><span><small className="block text-[7px] uppercase font-black text-gray-400">{it ? 'Acquisto' : 'Bought'}</small><strong className="text-xs">{fmt(item.buyPrice || 0)}</strong></span>{sold && <><span><small className="block text-[7px] uppercase font-black text-gray-400">{it ? 'Vendita' : 'Sold'}</small><strong className="text-xs">{fmt(item.sellPrice || 0)}</strong></span><span><small className="block text-[7px] uppercase font-black text-gray-400">{it ? 'Profitto' : 'Profit'}</small><strong className="text-xs text-green-700">{fmt(itemProfit)}</strong></span></>}</div></div></button>;
        })}</div>}
      </section>}

      {hasService('reports') && <section className="rounded-3xl border border-black/10 bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-5">
          <div><p className="text-[10px] uppercase tracking-[.16em] font-black text-gray-400">{it ? 'Contabilità giornaliera' : 'Daily accounts'}</p><h3 className="text-xl sm:text-2xl font-black mt-1 capitalize">{calendar.label}</h3></div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-black/10 overflow-hidden"><button type="button" onClick={() => moveCalendar(-1)} className="px-3 py-2 bg-white font-black">←</button><button type="button" onClick={() => { const today = new Date().toISOString(); setCalendarMonth(today.slice(0, 7)); setSelectedDay(today.slice(0, 10)); }} className="px-3 py-2 text-xs font-black border-x border-black/10" style={{ background: '#f1fec8' }}>{it ? 'Oggi' : 'Today'}</button><button type="button" onClick={() => moveCalendar(1)} className="px-3 py-2 bg-white font-black">→</button></div>
            <button type="button" onClick={() => setAddTxOpen(true)} className="px-4 py-2.5 rounded-xl text-xs font-black border border-black/10" style={{ background: '#c6ff34' }}>+ {it ? 'Movimento' : 'Entry'}</button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
          <div className="min-w-0 w-full">
            <div className="w-full">
              <div className="grid grid-cols-7 gap-1.5 mb-1.5">{(it ? ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'] : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']).map((day) => <div key={day} className="py-2 text-center text-[9px] uppercase tracking-wider font-black text-gray-400">{day}</div>)}</div>
              <div className="grid grid-cols-7 gap-1.5">
                {calendar.cells.map((cell, index) => cell ? <button key={cell.key} type="button" onClick={() => setSelectedDay(cell.key)} className="min-w-0 min-h-[56px] sm:min-h-[92px] rounded-lg sm:rounded-xl border p-1.5 sm:p-2 text-left transition-all hover:-translate-y-0.5" style={{ background: selectedDay === cell.key ? '#c6ff34' : cell.count ? '#f1fec8' : '#fff', borderColor: selectedDay === cell.key ? 'rgba(16,20,8,.28)' : 'rgba(16,20,8,.08)' }}><div className="flex items-center justify-between gap-0.5"><span className="text-[10px] sm:text-xs font-black">{cell.day}</span>{cell.count > 0 && <span className="text-[7px] sm:text-[8px] font-black px-1 sm:px-1.5 py-0.5 rounded-full bg-white/70">{cell.count}</span>}</div>{cell.count > 0 && <div className="hidden sm:block mt-3 space-y-1"><p className="text-[9px] font-bold text-green-700 truncate">+ {fmt(cell.income)}</p><p className="text-[9px] font-bold text-gray-500 truncate">− {fmt(cell.expense)}</p><p className="text-[10px] font-black truncate">= {fmt(cell.net)}</p></div>}{cell.count > 0 && <span className="sm:hidden block w-1.5 h-1.5 rounded-full bg-black mt-2 mx-auto" />}</button> : <div key={`empty-${index}`} className="min-w-0 min-h-[56px] sm:min-h-[92px] rounded-lg sm:rounded-xl bg-gray-50/60" />)}
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-black/10 p-4 sm:p-5" style={{ background: '#f1fec8' }}>
            <p className="text-[10px] uppercase tracking-[.14em] font-black text-gray-500">{it ? 'Giorno selezionato' : 'Selected day'}</p><h4 className="text-lg font-black mt-1">{fmtDate(selectedDay)}</h4>
            <div className="space-y-2 mt-5"><div className="rounded-xl bg-white/70 p-3"><span className="text-[9px] uppercase font-black text-gray-500">{it ? 'Entrate' : 'Income'}</span><strong className="block text-lg mt-1 text-green-700">+ {fmt(selectedTotals.income)}</strong></div><div className="rounded-xl bg-white/70 p-3"><span className="text-[9px] uppercase font-black text-gray-500">{it ? 'Uscite' : 'Expenses'}</span><strong className="block text-lg mt-1">− {fmt(selectedTotals.expense)}</strong></div><div className="rounded-xl p-3 text-white" style={{ background: '#101408' }}><span className="text-[9px] uppercase font-black text-white/50">{it ? 'Risultato netto' : 'Net result'}</span><strong className="block text-xl mt-1" style={{ color: '#c6ff34' }}>{fmt(selectedTotals.income - selectedTotals.expense)}</strong></div></div>
            <p className="text-xs font-bold text-gray-500 mt-4">{selectedTotals.count} {it ? 'movimenti registrati' : 'entries recorded'}</p>
            <div className="border-t border-black/10 mt-5 pt-4"><p className="text-[9px] uppercase font-black text-gray-500">{it ? 'Totale mese' : 'Month total'}</p><div className="flex justify-between text-xs mt-2"><span>{it ? 'Entrate' : 'Income'}</span><strong>{fmt(calendar.monthIncome)}</strong></div><div className="flex justify-between text-xs mt-2"><span>{it ? 'Uscite' : 'Expenses'}</span><strong>{fmt(calendar.monthExpense)}</strong></div><div className="flex justify-between text-sm mt-3 pt-3 border-t border-black/10"><span className="font-black">Net</span><strong>{fmt(calendar.monthIncome - calendar.monthExpense)}</strong></div></div>
          </aside>
        </div>
      </section>}

      {hasService('team') && <section className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-3"><div><p className="text-[9px] uppercase tracking-[.16em] font-black text-gray-400">{it ? 'La tua squadra' : 'Your team'}</p><h3 className="text-base font-black mt-0.5">{it ? 'Profili del personale' : 'Staff profiles'}</h3></div><button type="button" onClick={() => setPage('team')} className="text-[10px] font-black px-3 py-2 rounded-xl shrink-0" style={{ background: '#c6ff34' }}>{it ? 'Gestisci squadra' : 'Manage team'} →</button></div>
        {(activeShop?.team || []).length === 0 ? <button type="button" onClick={() => setPage('team')} className="w-full rounded-xl border-2 border-dashed border-gray-200 p-5 text-center hover:border-lime-300"><span className="block text-xs font-black">{it ? 'Nessun profilo del personale' : 'No staff profiles yet'}</span><span className="block text-[10px] text-gray-400 mt-1">{it ? 'Aggiungi il primo membro' : 'Add your first member'} →</span></button> : <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">{(activeShop.team || []).map((member) => <button type="button" key={member.id} onClick={() => setPage('team')} className="flex items-center gap-3 rounded-xl border border-black/10 p-2.5 text-left hover:-translate-y-0.5 hover:shadow-md transition-all"><div className="w-11 h-11 rounded-xl shrink-0 bg-[#f1fec8] overflow-hidden flex items-center justify-center text-lg font-black">{member.photo ? <img src={member.photo} alt={member.name} className="w-full h-full object-cover" /> : member.name?.charAt(0)?.toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><p className="text-xs font-black truncate">{member.name}</p><span className="w-2 h-2 rounded-full shrink-0" style={{ background: member.status === 'active' ? '#aef01f' : '#d1d5db' }} /></div><p className="text-[10px] text-gray-500 truncate">{member.role || '—'}</p><p className="text-[10px] font-black mt-0.5">{fmt(member.salary || 0)}<span className="font-normal text-gray-400">/{it ? 'mese' : 'mo'}</span></p></div></button>)}</div>}
      </section>}

      {hasService('clients') && <section className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-3"><div><p className="text-[9px] uppercase tracking-[.16em] font-black text-gray-400">{it ? 'Clienti' : 'Clients'}</p><h3 className="text-base font-black mt-0.5">{it ? 'Profili clienti recenti' : 'Recent client profiles'}</h3></div><button type="button" onClick={() => setPage('clients')} className="text-[10px] font-black px-3 py-2 rounded-xl shrink-0" style={{ background: '#c6ff34' }}>{it ? 'Gestisci clienti' : 'Manage clients'} →</button></div>
        {homeClients.length === 0 ? <button type="button" onClick={() => setPage('clients')} className="w-full rounded-xl border-2 border-dashed border-gray-200 p-5 text-center hover:border-lime-300"><span className="block text-xs font-black">{it ? 'Nessun cliente disponibile' : 'No clients available'}</span><span className="block text-[10px] text-gray-400 mt-1">{it ? 'Aggiungi il primo cliente' : 'Add your first client'} →</span></button> : <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">{homeClients.map((client) => <button type="button" key={client.id} onClick={() => setPage('clients')} className="group rounded-xl border border-black/10 p-3 text-left hover:-translate-y-0.5 hover:shadow-md transition-all"><div className="flex items-center gap-2.5"><div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-sm font-black" style={{ background: '#f1fec8' }}>{client.name?.charAt(0)?.toUpperCase()}</div><div className="min-w-0 flex-1"><p className="text-xs font-black truncate">{client.name}</p><p className="text-[9px] text-gray-400 truncate">{client.phone || client.email || '—'}</p></div><span className="text-[9px] font-black rounded-full px-2 py-1" style={{ background: '#c6ff34' }}>{client.visits}</span></div><div className="mt-2.5 flex gap-1">{Array.from({ length: 6 }, (_, index) => <span key={index} className="h-1.5 flex-1 rounded-full" style={{ background: index < client.visits ? '#a3e635' : '#e5e7eb' }} />)}</div><div className="mt-2 flex items-center justify-between text-[8px] uppercase tracking-wider font-black text-gray-400"><span>{client.visits} {it ? 'visite' : 'visits'}</span><span className="text-gray-900">{it ? 'Profilo' : 'Profile'} →</span></div></button>)}</div>}
      </section>}

      {selectedHomeNote && (() => { const total = Number(selectedHomeNote.totalAmount ?? selectedHomeNote.amount) || 0; const paid = Number(selectedHomeNote.paidAmount) || 0; const remaining = Math.max(total - paid, 0); return <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm p-4 flex items-center justify-center" onMouseDown={(event) => event.target === event.currentTarget && setSelectedHomeNote(null)}><div className="w-full max-w-xl rounded-3xl bg-white border border-black/10 shadow-2xl overflow-hidden"><div className="p-5 sm:p-6 flex items-start justify-between gap-3" style={{ background: 'linear-gradient(135deg,#c6ff34,#f1fec8)' }}><div><p className="text-[10px] uppercase tracking-[.16em] font-black text-gray-500">{it ? 'Dettagli nota' : 'Note details'}</p><h3 className="text-2xl font-black mt-1">{selectedHomeNote.name || (it ? 'Nota' : 'Note')}</h3></div><button type="button" onClick={() => setSelectedHomeNote(null)} className="w-10 h-10 rounded-full bg-white/75 border border-black/10 text-xl font-black">×</button></div><div className="p-5 sm:p-6 space-y-3">{selectedHomeNote.details && <div className="rounded-2xl bg-gray-50 p-4"><p className="text-[9px] uppercase font-black text-gray-400">{it ? 'Descrizione nota' : 'Note description'}</p><p className="text-sm mt-1 whitespace-pre-wrap">{selectedHomeNote.details}</p></div>}{(selectedHomeNote.appointmentFor || selectedHomeNote.appointmentDescription || selectedHomeNote.appointmentDate || selectedHomeNote.appointmentTime) && <div className="rounded-2xl border border-lime-200 p-4" style={{ background: '#f1fec8' }}><p className="text-[9px] uppercase font-black text-gray-500">{it ? 'Appuntamento' : 'Appointment'}</p>{selectedHomeNote.appointmentFor && <p className="text-base font-black mt-2">{it ? 'Per' : 'For'}: {selectedHomeNote.appointmentFor}</p>}{selectedHomeNote.appointmentDescription && <p className="text-sm text-gray-600 mt-1">{selectedHomeNote.appointmentDescription}</p>}<div className="flex gap-2 flex-wrap mt-3">{selectedHomeNote.appointmentDate && <span className="px-3 py-1.5 rounded-xl bg-white text-xs font-black">{fmtDate(selectedHomeNote.appointmentDate)}</span>}{selectedHomeNote.appointmentTime && <span className="px-3 py-1.5 rounded-xl bg-[#c6ff34] text-xs font-black">◷ {selectedHomeNote.appointmentTime}</span>}</div></div>}<div className="grid grid-cols-2 gap-3">{selectedHomeNote.phone && <a href={`tel:${selectedHomeNote.phone}`} className="rounded-2xl border border-black/10 p-3 text-xs font-black">☎ {selectedHomeNote.phone}</a>}{selectedHomeNote.email && <a href={`mailto:${selectedHomeNote.email}`} className="rounded-2xl border border-black/10 p-3 text-xs font-black truncate">✉ {selectedHomeNote.email}</a>}</div>{total > 0 && <div className="grid grid-cols-3 gap-2">{[[it ? 'Totale' : 'Total', total], [it ? 'Pagato' : 'Paid', paid], [it ? 'Rimanente' : 'Remaining', remaining]].map(([label, amount]) => <div key={label} className="rounded-2xl p-3" style={{ background: label === (it ? 'Rimanente' : 'Remaining') ? '#c6ff34' : '#f1fec8' }}><p className="text-[8px] uppercase font-black text-gray-500">{label}</p><strong className="text-sm block mt-1">{fmt(amount)}</strong></div>)}</div>}</div><div className="p-4 border-t border-gray-100 flex gap-2"><button type="button" onClick={() => { setSelectedHomeNote(null); setPage('notes'); }} className="flex-1 py-3 rounded-xl font-black border border-black/10" style={{ background: '#c6ff34' }}>{it ? 'Apri Quick Notes' : 'Open Quick Notes'} →</button><button type="button" onClick={() => setSelectedHomeNote(null)} className="px-5 py-3 rounded-xl font-bold border border-gray-200">{it ? 'Chiudi' : 'Close'}</button></div></div></div>; })()}

      {healthOpen && <div className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-sm p-4 flex items-center justify-center" onMouseDown={(event) => event.target === event.currentTarget && setHealthOpen(false)}>
        <div className="w-full max-w-lg rounded-3xl bg-white border border-black/10 shadow-2xl overflow-hidden">
          <div className="p-5 sm:p-6 flex items-center justify-between" style={{ background: 'linear-gradient(135deg,#c6ff34,#f1fec8)' }}><div><p className="text-[10px] uppercase tracking-[.16em] font-black text-gray-600">{it ? 'Salute negozio' : 'Shop health'}</p><h3 className="text-3xl font-black mt-1">{data.health}/100</h3></div><button type="button" onClick={() => setHealthOpen(false)} className="w-10 h-10 rounded-full bg-white/75 border border-black/10 font-black">×</button></div>
          <div className="p-5 sm:p-6 space-y-2">
            {[
              { label: it ? 'Riparazioni attive' : 'Active repairs', value: data.pendingRepairs.length, page: 'repairs' },
              { label: it ? 'Riparazioni pronte' : 'Ready repairs', value: data.readyRepairs.length, page: 'repairs' },
              { label: it ? 'Scorte basse' : 'Low stock', value: data.lowStock.length, page: 'inventory' },
              { label: it ? 'Riparazioni da incassare' : 'Unpaid repairs', value: data.unpaidRepairs.length, page: 'repairs' },
              { label: it ? 'Ordini parti in attesa' : 'Pending parts orders', value: data.pendingPartOrders, page: 'repairs' },
              { label: it ? 'Saldo anticipi' : 'Advance balance', value: fmt(data.pendingAdvance), page: 'advances' },
              { label: it ? 'Rischio finanziario' : 'Financial risk', value: data.financialRisk ? (it ? 'Sì' : 'Yes') : (it ? 'No' : 'No'), page: 'reports' },
            ].map((item) => <button type="button" key={item.label} onClick={() => { setHealthOpen(false); setPage(item.page); }} className="w-full flex items-center justify-between rounded-2xl border border-black/8 px-4 py-3 text-left hover:-translate-y-0.5 transition-all" style={{ background: item.value && item.value !== 'No' ? '#f1fec8' : '#fff' }}><span className="text-xs font-bold">{item.label}</span><strong>{item.value} →</strong></button>)}
            {data.noActivity && <button type="button" onClick={() => { setHealthOpen(false); setAddTxOpen(true); }} className="w-full rounded-2xl p-4 text-left border border-black/10" style={{ background: '#fff7dc' }}><strong className="text-sm">{it ? 'Nessuna attività registrata' : 'No activity recorded'}</strong><p className="text-xs text-gray-500 mt-1">{it ? 'Aggiungi la prima transazione per attivare il punteggio.' : 'Add the first transaction to activate the score.'}</p></button>}
          </div>
        </div>
      </div>}

      {financePopup && (() => {
        const entries = financePopup === 'pos' ? data.posEntries : financePopup === 'cash' ? data.cashEntries : data.ledger.filter((entry) => entry.type === financePopup);
        const title = financePopup === 'pos' ? (it ? 'Dettaglio pagamenti POS' : 'POS payment details') : financePopup === 'cash' ? (it ? 'Dettaglio contanti' : 'Cash payment details') : financePopup === 'income' ? (it ? 'Dettaglio entrate' : 'Revenue details') : (it ? 'Dettaglio uscite' : 'Expense details');
        const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
        return <div className="fixed inset-0 z-[105] bg-black/50 backdrop-blur-sm p-4 flex items-center justify-center" onMouseDown={(event) => event.target === event.currentTarget && setFinancePopup(null)}><div className="w-full max-w-2xl max-h-[88vh] bg-white rounded-3xl overflow-hidden shadow-2xl border border-black/10"><div className="p-5 sm:p-6 flex items-start justify-between gap-3" style={{ background: 'linear-gradient(135deg,#c6ff34,#f1fec8)' }}><div><p className="text-[10px] uppercase tracking-[.16em] font-black text-gray-600">{it ? 'Riepilogo finanziario' : 'Financial summary'}</p><h3 className="text-2xl font-black mt-1">{title}</h3><p className="text-sm font-bold text-gray-600 mt-1">{entries.length} {it ? 'movimenti' : 'entries'} · {fmt(total)}</p></div><button type="button" onClick={() => setFinancePopup(null)} className="w-10 h-10 rounded-full bg-white/75 border border-black/10 font-black text-xl">×</button></div><div className="max-h-[58vh] overflow-y-auto divide-y divide-gray-100">{entries.length ? entries.map((entry) => <div key={entry.id} className="flex items-center gap-3 px-5 py-4"><span className="w-10 h-10 rounded-xl flex items-center justify-center font-black" style={{ background: entry.type === 'income' ? '#c6ff34' : '#f1fec8' }}>{entry.type === 'income' ? '+' : '−'}</span><div className="flex-1 min-w-0"><p className="text-sm font-black capitalize">{entry.source || (it ? 'Movimento' : 'Entry')}</p><p className="text-[10px] text-gray-400">{fmtDate(entry.date)} · {entry.id}</p></div><strong className={entry.type === 'income' ? 'text-emerald-700' : 'text-gray-900'}>{entry.type === 'income' ? '+' : '−'}{fmt(entry.amount)}</strong></div>) : <p className="p-10 text-center text-sm text-gray-400">{it ? 'Nessun movimento disponibile.' : 'No entries available.'}</p>}</div><div className="p-4 border-t border-gray-100 flex gap-2"><button type="button" onClick={() => { setFinancePopup(null); setPage('reports'); }} className="flex-1 py-3 rounded-xl font-black border border-black/10" style={{ background: '#c6ff34' }}>{it ? 'Apri report completo' : 'Open full report'} →</button><button type="button" onClick={() => setFinancePopup(null)} className="px-5 py-3 rounded-xl font-bold border border-gray-200">{it ? 'Chiudi' : 'Close'}</button></div></div></div>;
      })()}

    </main>
  );
}
