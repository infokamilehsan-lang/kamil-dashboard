import { useState, useMemo, useEffect, useRef } from 'react';
import { useShop } from '../context/ShopContext';
import { useLanguage } from '../context/LanguageContext';
import { useFmt } from '../lib/useFmt';
import { inventoryMetrics } from '../lib/inventoryMetrics';
import DatePicker from '../components/DatePicker';

function StatCard({ label, value, sub, trend }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        {trend !== undefined && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
      <p className="text-sm font-medium text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

/* Count-up number animation */
function CountUp({ to, duration = 900, className = '' }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const target = parseFloat(String(to).replace(/[^0-9.-]/g, '')) || 0;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(target * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to, duration]);

  const isFloat = String(to).includes('.');
  const raw = typeof to === 'string' ? to : null;
  const prefix = raw ? raw.replace(/[\d,. ]+.*$/, '') : '';
  const formatted = display >= 1000
    ? prefix + (display / 1000).toFixed(1) + 'k'
    : prefix + (isFloat ? display.toFixed(2) : Math.round(display).toString());

  return <span className={`animate-flash-value tabular-nums ${className}`}>{formatted}</span>;
}

/* Mini animated SVG sparkline */
function MiniSparkline({ values = [], color = '#34d399', delay = 0 }) {
  const W = 200, H = 56, PAD = 6;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => {
    const x = PAD + (i / (values.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v / max) * (H - PAD * 2));
    return [x, y];
  });
  const path = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
  const areaPath = `${path} L${pts[pts.length-1][0]},${H} L${pts[0][0]},${H} Z`;
  const id = `spark-${color.replace(/[^a-z0-9]/gi,'')}-${delay}`;
  const glowId = `glow-${id}`;
  const gridLines = [0.25, 0.5, 0.75].map((f) => H - PAD - f * (H - PAD * 2));
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="spark-svg" style={{ animationDelay: `${delay}ms` }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="60%" stopColor={color} stopOpacity="0.08" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {gridLines.map((gy, i) => (
        <line key={i} x1={PAD} y1={gy} x2={W - PAD} y2={gy} stroke="rgba(0,0,0,0.04)" strokeWidth="0.5" strokeDasharray="4,3" />
      ))}
      {pts.map(([x], i) => (
        <line key={`v${i}`} x1={x} y1={PAD} x2={x} y2={H - PAD} stroke="rgba(0,0,0,0.025)" strokeWidth="0.5" />
      ))}
      <path d={areaPath} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.2" filter={`url(#${glowId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        className="spark-line" style={{ '--spark-delay': `${delay}ms` }} />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 0 : 1.8} fill="white" stroke={color} strokeWidth="1.2" opacity="0.6" />
      ))}
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="3.5" fill={color} className="spark-dot" style={{ animationDelay: `${delay + 500}ms` }} />
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="7" fill={color} opacity="0.2" className="spark-pulse" style={{ animationDelay: `${delay + 500}ms` }} />
      <line x1={pts[pts.length-1][0]} y1={PAD} x2={pts[pts.length-1][0]} y2={H - PAD} stroke={color} strokeWidth="0.5" strokeDasharray="2,2" opacity="0.4" />
      <line x1={PAD} y1={pts[pts.length-1][1]} x2={W - PAD} y2={pts[pts.length-1][1]} stroke={color} strokeWidth="0.5" strokeDasharray="2,2" opacity="0.3" />
    </svg>
  );
}

export default function OverviewPage({ setPage, setAddTxOpen }) {
  const { activeShop, deleteTransaction, contacts } = useShop();
  const { t, locale } = useLanguage();
  const { fmt, fmtDate } = useFmt();

  const hasService = (serviceId) => !activeShop?.services || activeShop.services.includes(serviceId);

  const [txDetailModal, setTxDetailModal] = useState(null); // null | 'income' | 'expense'
  const [posPopupOpen, setPosPopupOpen] = useState(false);
  const [summaryDate, setSummaryDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const summaryMonthRef = useRef(null);
  const [summaryMode, setSummaryMode] = useState('daily'); // 'daily' | 'monthly' | 'alltime'
  const [summaryMonth, setSummaryMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filter, setFilter] = useState('all');
  const [deleteId, setDeleteId] = useState(null);

  const { revenue, expenses, profit, posCard, posCash } = useMemo(() => {
    const txs = activeShop?.transactions || [];
    const sh = activeShop?.secondhand || [];
    const repairs = activeShop?.repairs || [];
    const advances = activeShop?.advances || [];

    const txIncome = txs.filter((t) => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const txExpense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);

    const shIncome = sh.filter((i) => i.status === 'sold').reduce((s, i) => s + (Number(i.sellPrice) || 0), 0);
    const shExpense = sh.reduce((s, i) => s + (Number(i.buyPrice) || 0), 0);

    const repExpense = repairs.reduce((s, r) => s + (Number(r.partsCost) || 0), 0);
    const repIncome = repairs.reduce((s, r) => {
      let inc = Number(r.advance) || 0;
      if (['ready', 'delivered', 'completed'].includes(r.status)) inc += Number(r.repairCost) || 0;
      return s + inc;
    }, 0);

    const advExpense = advances.reduce((s, a) => s + (Number(a.productCost) || 0), 0);
    const advIncome = advances.reduce((s, a) => s + (Number(a.advancePaid) || 0), 0)
      + advances.flatMap((a) => (a.payments || []).map((p) => Number(p.amount) || 0)).reduce((s, v) => s + v, 0);

    const revenue = txIncome + shIncome + repIncome + advIncome;
    const expenses = txExpense + shExpense + repExpense + advExpense;

    const posCard = txs.filter(t => t.type === 'income' && t.paymentMethod === 'card').reduce((s, t) => s + (Number(t.amount) || 0), 0)
      + repairs.reduce((s, r) => {
        let c = 0;
        if (r.paymentMethod === 'card') c += (Number(r.advance) || 0);
        (r.payments || []).forEach(p => { if (p.paymentMethod === 'card') c += (Number(p.amount) || 0); });
        if (r.paymentMethod === 'card' && ['ready', 'delivered', 'completed'].includes(r.status)) c += (Number(r.repairCost) || 0);
        return s + c;
      }, 0)
      + advances.flatMap(a => (a.payments || []).filter(p => p.paymentMethod === 'card').map(p => Number(p.amount) || 0)).reduce((s, v) => s + v, 0);
    const posCash = revenue - posCard;

    return { revenue, expenses, profit: revenue - expenses, posCard, posCash };
  }, [activeShop]);

  const commandCenter = useMemo(() => {
    const txs = activeShop?.transactions || [];
    const repairs = activeShop?.repairs || [];
    const advances = activeShop?.advances || [];
    const skus = activeShop?.skus || [];
    const today = new Date().toISOString().slice(0, 10);
    const todayTx = txs.filter((item) => (item.date || '').slice(0, 10) === today);
    const pendingRepairs = repairs.filter((item) => !['ready', 'delivered', 'completed', 'cancelled'].includes(item.status));
    const readyRepairs = repairs.filter((item) => item.status === 'ready');
    const lowStock = inventoryMetrics(skus).lowStock;
    const pendingAdvance = advances.reduce((sum, item) => {
      const paid = (Number(item.advancePaid) || 0)
        + (item.payments || []).reduce((total, payment) => total + (Number(payment.amount) || 0), 0);
      return sum + Math.max((Number(item.totalAmount ?? item.sellPrice ?? item.productCost) || 0) - paid, 0);
    }, 0);
    const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;
    const attentionCount = pendingRepairs.length + readyRepairs.length + lowStock.length + (pendingAdvance > 0 ? 1 : 0);
    const healthScore = Math.max(18, Math.min(100,
      82
      + (profit >= 0 ? 8 : -18)
      - Math.min(lowStock.length * 3, 18)
      - Math.min(pendingRepairs.length * 2, 12)
      - (pendingAdvance > 0 ? 4 : 0)
    ));
    return { todayTx, pendingRepairs, readyRepairs, lowStock, pendingAdvance, margin, attentionCount, healthScore };
  }, [activeShop, revenue, profit]);

  const isItalian = String(locale || '').toLowerCase().startsWith('it');

        return (
          <>

        {/* ── BUSINESS COMMAND CENTER ── */}
        <section className="overview-command-center space-y-4 sm:space-y-5 mb-5 sm:mb-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.18em] mb-3" style={{ background: '#f1fec8', color: '#101408', border: '1px solid rgba(16,20,8,.1)' }}>
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-50" style={{ background: '#c6ff34' }} /><span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: '#8fbd13' }} /></span>
                {isItalian ? 'Centro operativo live' : 'Live business command center'}
              </div>
              <h2 className="text-3xl sm:text-4xl font-black tracking-[-0.045em] text-gray-900">
                {isItalian ? 'Panoramica intelligente' : 'Smart overview'}
              </h2>
              <p className="text-sm text-gray-500 mt-1.5 max-w-2xl">
                {isItalian ? 'Numeri chiave, attività e priorità del negozio in un unico posto.' : 'Key numbers, activity and store priorities in one focused workspace.'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setPage('reports')} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-gray-200 text-gray-800 shadow-sm">
                {isItalian ? 'Apri report' : 'Open reports'}
              </button>
              <button onClick={() => setAddTxOpen(true)} className="px-4 py-2.5 rounded-xl text-xs font-black text-gray-900 shadow-lg" style={{ background: '#c6ff34', border: '1px solid rgba(16,20,8,.14)' }}>
                + {isItalian ? 'Nuova transazione' : 'New transaction'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            <div className="xl:col-span-7 rounded-3xl p-5 sm:p-7 relative overflow-hidden min-h-[245px]" style={{ background: 'linear-gradient(135deg,#c6ff34 0%,#dfff86 62%,#f1fec8 100%)', border: '1px solid rgba(16,20,8,.1)', boxShadow: '0 22px 55px rgba(95,130,0,.17)' }}>
              <div className="absolute -right-14 -top-20 w-64 h-64 rounded-full border border-black/5" />
              <div className="absolute right-10 bottom-8 w-24 h-24 rounded-full border border-black/5" />
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-600">{isItalian ? 'Profitto totale' : 'Total net profit'}</p>
                    <p className="text-4xl sm:text-5xl font-black tracking-[-0.055em] text-gray-900 mt-2"><CountUp to={fmt(profit)} /></p>
                  </div>
                  <span className="px-3 py-1.5 rounded-full text-xs font-black bg-white/70 border border-black/10 text-gray-900">{commandCenter.margin}% {isItalian ? 'margine' : 'margin'}</span>
                </div>
                <div className="mt-auto grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-8">
                  {[
                    { label: isItalian ? 'Entrate' : 'Revenue', value: fmt(revenue) },
                    { label: isItalian ? 'Uscite' : 'Expenses', value: fmt(expenses) },
                    { label: isItalian ? 'Oggi' : 'Today', value: `${commandCenter.todayTx.length} ${isItalian ? 'mov.' : 'moves'}` },
                  ].map((metric) => (
                    <div key={metric.label} className="rounded-2xl px-3.5 py-3 bg-white/55 border border-black/5 backdrop-blur-sm">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500">{metric.label}</p>
                      <p className="text-sm sm:text-base font-black text-gray-900 mt-1 truncate">{metric.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="xl:col-span-5 grid sm:grid-cols-2 xl:grid-cols-1 gap-4">
              <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm flex items-center gap-5">
                <div className="relative w-24 h-24 shrink-0 flex items-center justify-center rounded-full" style={{ background: `conic-gradient(#c6ff34 ${commandCenter.healthScore * 3.6}deg, #f1fec8 0)` }}>
                  <div className="w-[72px] h-[72px] rounded-full bg-white flex flex-col items-center justify-center shadow-inner">
                    <span className="text-2xl font-black text-gray-900">{commandCenter.healthScore}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">/ 100</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[.16em] font-black text-gray-400">{isItalian ? 'Salute negozio' : 'Shop health'}</p>
                  <h3 className="text-xl font-black text-gray-900 mt-1">{commandCenter.healthScore >= 80 ? (isItalian ? 'Ottima' : 'Excellent') : commandCenter.healthScore >= 60 ? (isItalian ? 'Buona' : 'Good') : (isItalian ? 'Da migliorare' : 'Needs attention')}</h3>
                  <p className="text-xs text-gray-500 mt-1">{commandCenter.attentionCount} {isItalian ? 'elementi richiedono attenzione' : 'items need attention'}</p>
                </div>
              </div>

              <div className="rounded-3xl p-5 border border-gray-200" style={{ background: '#f1fec8' }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[.16em] font-black text-gray-500">{isItalian ? 'Priorità' : 'Attention queue'}</p>
                    <h3 className="text-lg font-black text-gray-900 mt-0.5">{isItalian ? 'Cosa controllare' : 'What to check'}</h3>
                  </div>
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black bg-white border border-black/5">{commandCenter.attentionCount}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: isItalian ? 'Riparazioni attive' : 'Active repairs', value: commandCenter.pendingRepairs.length, page: 'repairs' },
                    { label: isItalian ? 'Pronte' : 'Ready', value: commandCenter.readyRepairs.length, page: 'repairs' },
                    { label: isItalian ? 'Scorte basse' : 'Low stock', value: commandCenter.lowStock.length, page: 'inventory' },
                    { label: isItalian ? 'Saldo anticipi' : 'Advance balance', value: fmt(commandCenter.pendingAdvance), page: 'advances' },
                  ].map((item) => (
                    <button key={item.label} onClick={() => setPage(item.page)} className="text-left rounded-2xl p-3 bg-white border border-black/5 hover:-translate-y-0.5 transition-transform">
                      <p className="text-lg font-black text-gray-900 truncate">{item.value}</p>
                      <p className="text-[10px] font-bold text-gray-500 mt-0.5 leading-tight">{item.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 p-3 sm:p-4 shadow-sm">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-[10px] font-black uppercase tracking-[.16em] text-gray-400 px-2 shrink-0">{isItalian ? 'Azioni rapide' : 'Quick actions'}</span>
              {[
                { label: isItalian ? 'Transazione' : 'Transaction', action: () => setAddTxOpen(true) },
                ...(hasService('inventory') ? [{ label: isItalian ? 'Inventario' : 'Inventory', action: () => setPage('inventory') }] : []),
                ...(hasService('repairs') ? [{ label: isItalian ? 'Riparazioni' : 'Repairs', action: () => setPage('repairs') }] : []),
                ...(hasService('team') ? [{ label: 'Team', action: () => setPage('team') }] : []),
                { label: isItalian ? 'Note rapide' : 'Quick notes', action: () => setPage('notes') },
                { label: 'WhatsApp', action: () => setPage('whatsapp') },
              ].map((item, index) => (
                <button key={item.label} onClick={item.action} className="shrink-0 inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold border border-gray-200 text-gray-800" style={{ background: index === 0 ? '#c6ff34' : index % 2 ? '#f1fec8' : '#fff' }}>
                  <span className="text-base leading-none">+</span>{item.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── SUMMARY ── */}
        {(() => {
          const d0 = new Date();
          const realToday = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${String(d0.getDate()).padStart(2, '0')}`;
          // match helper
          const matchDate = (dateStr) => {
            if (!dateStr) return false;
            const s = (dateStr || '').slice(0, 10);
            if (summaryMode === 'daily')   return s === summaryDate;
            if (summaryMode === 'monthly') return s.slice(0, 7) === summaryMonth;
            return true; // alltime
          };
          const txs = activeShop.transactions || [];
          const repairs = activeShop.repairs || [];
          const advances = activeShop.advances || [];
          const secondhand = activeShop.secondhand || [];
          const skus = activeShop.skus || [];

          // ── Filtered figures (daily / monthly / alltime via matchDate) ──
          const todayTxIncome = txs.filter((t) => matchDate(t.date) && t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
          const todayTxExpense = txs.filter((t) => matchDate(t.date) && t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
          const todayCardIncome = txs.filter((t) => matchDate(t.date) && t.type === 'income' && t.paymentMethod === 'card').reduce((s, t) => s + (Number(t.amount) || 0), 0);
          const todayPosCard = todayCardIncome
            + repairs.reduce((s, r) => {
                let c = 0;
                if (r.paymentMethod === 'card' && matchDate(r.advanceReceivedAt || r.createdAt)) c += (Number(r.advance) || 0);
                (r.payments || []).forEach(p => { if (p.paymentMethod === 'card' && matchDate(p.date)) c += (Number(p.amount) || 0); });
                if (r.paymentMethod === 'card' && ['ready', 'delivered', 'completed'].includes(r.status) && matchDate(r.feeReceivedAt || r.updatedAt || r.createdAt)) c += (Number(r.repairCost) || 0);
                return s + c;
              }, 0)
            + advances.flatMap(a => (a.payments || []).filter(p => p.paymentMethod === 'card' && matchDate(p.date)).map(p => Number(p.amount) || 0)).reduce((s, v) => s + v, 0);
          const todayShIncome = secondhand.filter((i) => i.status === 'sold' && matchDate(i.sellDate)).reduce((s, i) => s + (Number(i.sellPrice) || 0), 0);
          const todayShExpense = secondhand.filter((i) => matchDate(i.buyDate)).reduce((s, i) => s + (Number(i.buyPrice) || 0), 0);
          const todayRepExpense = repairs
            .filter((r) => matchDate(r.partsRecordedAt || r.createdAt))
            .reduce((s, r) => s + (Number(r.partsCost) || 0), 0);
          const todayRepIncome = repairs
            .filter((r) => matchDate(r.feeReceivedAt || r.updatedAt || r.createdAt) && ['ready', 'delivered', 'completed'].includes(r.status))
            .reduce((s, r) => s + (Number(r.repairCost) || 0), 0)
            + repairs
              .filter((r) => matchDate(r.advanceReceivedAt || r.createdAt) && !['ready', 'delivered', 'completed'].includes(r.status))
              .reduce((s, r) => s + (Number(r.advance) || 0), 0);
          const todayAdvExpense = advances.filter((a) => matchDate(a.date)).reduce((s, a) => s + (Number(a.productCost) || 0), 0);
          const todayAdvIncome = advances.filter((a) => matchDate(a.date)).reduce((s, a) => s + (Number(a.advancePaid) || 0), 0)
            + advances.flatMap((a) => (a.payments || []).filter((p) => matchDate(p.date)).map((p) => Number(p.amount) || 0)).reduce((s, v) => s + v, 0);
          const todayInvMoves = skus.reduce((count, sk) => count + (sk.movements || []).filter((m) => matchDate(m.date)).length, 0);

          const todayIncome =
            todayTxIncome
            + (hasService('secondhand') ? todayShIncome : 0)
            + (hasService('repairs') ? todayRepIncome : 0)
            + (hasService('advances') ? todayAdvIncome : 0);
          const todayExpense =
            todayTxExpense
            + (hasService('secondhand') ? todayShExpense : 0)
            + (hasService('repairs') ? todayRepExpense : 0)
            + (hasService('advances') ? todayAdvExpense : 0);
          const todayProfit = todayIncome - todayExpense;

          const todayRepairs = repairs.filter((r) => matchDate(r.createdAt) || matchDate(r.updatedAt)).length;
          const todayReady = repairs.filter((r) => matchDate(r.updatedAt) && ['ready', 'delivered', 'completed'].includes(r.status)).length;
          const todayAdv = todayAdvIncome;
          const todayTx = txs.filter((t) => matchDate(t.date)).length;
          const todayShBought = secondhand.filter((i) => matchDate(i.buyDate)).length;
          const todayShSold = secondhand.filter((i) => i.status === 'sold' && matchDate(i.sellDate)).length;
          const todayShProfit = secondhand.filter((i) => i.status === 'sold' && matchDate(i.sellDate)).reduce((s, i) => s + ((Number(i.sellPrice) || 0) - (Number(i.buyPrice) || 0)), 0);
          const todayRepProfit = repairs
            .filter((r) => matchDate(r.feeReceivedAt || r.updatedAt || r.createdAt) || matchDate(r.partsRecordedAt || r.createdAt))
            .reduce((s, r) => {
              const fee = ['ready', 'delivered', 'completed'].includes(r.status) ? (Number(r.repairCost) || 0) : 0;
              return s + fee - (Number(r.partsCost) || 0);
            }, 0);

          // isToday is computed above based on summaryDate vs realToday

          const income = todayIncome;
          const expense = todayExpense;
          const profit = todayProfit;
          const calcStockSaleProfit = () => {
            return skus.reduce((acc, sk) => {
              const outMovements = (sk.movements || []).filter((m) => m.type === 'out' && matchDate(m.date));
              const revenue = outMovements.reduce((s, m) => {
                const unitSell = Number(m.price) || Number(sk.sellPrice) || 0;
                return s + (unitSell * (Number(m.qty) || 1));
              }, 0);
              const cost = outMovements.reduce((s, m) => {
                const unitCost = Number(m.buyPrice) || Number(sk.buyPrice) || 0;
                return s + (unitCost * (Number(m.qty) || 1));
              }, 0);
              return { revenue: acc.revenue + revenue, cost: acc.cost + cost };
            }, { revenue: 0, cost: 0 });
          };
          const stockResult = calcStockSaleProfit();
          const stockSalesValue = stockResult.revenue;
          const stockSoldCost = stockResult.cost;
          const stockProfit = stockSalesValue - stockSoldCost;
          const repIn = todayRepairs;
          const repDone = todayReady;
          const adv = todayAdv;
          const txCount = todayTx + (hasService('inventory') ? todayInvMoves : 0);
          const shBought = todayShBought;
          const shSold = todayShSold;
          const shProfit = todayShProfit;
          const repProfit = todayRepProfit;
          const repIncome = todayRepIncome;

          const savedContactsCount = contacts.length;

          // ── Last 7 days sparkline (all sources) ──
          const last7 = Array.from({ length: 7 }, (_, i) => {
            const dt = new Date(); dt.setDate(dt.getDate() - (6 - i));
            const ds = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
            const md = (v) => (v || '').slice(0, 10) === ds;

            const txInc = txs.filter((t) => t.date === ds && t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
            const txExp = txs.filter((t) => t.date === ds && t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);

            const shInc = hasService('secondhand') ? secondhand.filter((it) => it.status === 'sold' && md(it.sellDate)).reduce((s, it) => s + (Number(it.sellPrice) || 0), 0) : 0;
            const shExp = hasService('secondhand') ? secondhand.filter((it) => md(it.buyDate)).reduce((s, it) => s + (Number(it.buyPrice) || 0), 0) : 0;

            const repExp = hasService('repairs') ? repairs.filter((r) => md(r.partsRecordedAt || r.createdAt)).reduce((s, r) => s + (Number(r.partsCost) || 0), 0) : 0;
            const repInc = hasService('repairs') ? (
              repairs.filter((r) => md(r.feeReceivedAt || r.updatedAt || r.createdAt) && ['ready','delivered','completed'].includes(r.status)).reduce((s, r) => s + (Number(r.repairCost) || 0), 0)
              + repairs.filter((r) => md(r.advanceReceivedAt || r.createdAt) && !['ready','delivered','completed'].includes(r.status)).reduce((s, r) => s + (Number(r.advance) || 0), 0)
            ) : 0;

            const advExp = hasService('advances') ? advances.filter((a) => md(a.date)).reduce((s, a) => s + (Number(a.productCost) || 0), 0) : 0;
            const advInc = hasService('advances') ? (
              advances.filter((a) => md(a.date)).reduce((s, a) => s + (Number(a.advancePaid) || 0), 0)
              + advances.flatMap((a) => (a.payments || []).filter((p) => md(p.date)).map((p) => Number(p.amount) || 0)).reduce((s, v) => s + v, 0)
            ) : 0;

            // Card payment tracking per day
            const txCardInc = txs.filter((t) => t.date === ds && t.type === 'income' && t.paymentMethod === 'card').reduce((s, t) => s + (Number(t.amount) || 0), 0);
            const txCardExp = txs.filter((t) => t.date === ds && t.type === 'expense' && t.paymentMethod === 'card').reduce((s, t) => s + (Number(t.amount) || 0), 0);
            const repCardInc = hasService('repairs') ? (
              repairs.filter((r) => md(r.feeReceivedAt || r.updatedAt || r.createdAt) && ['ready','delivered','completed'].includes(r.status) && r.paymentMethod === 'card').reduce((s, r) => s + (Number(r.repairCost) || 0), 0)
              + repairs.filter((r) => md(r.advanceReceivedAt || r.createdAt) && !['ready','delivered','completed'].includes(r.status) && r.paymentMethod === 'card').reduce((s, r) => s + (Number(r.advance) || 0), 0)
            ) : 0;
            const advCardInc = hasService('advances') ? advances.flatMap((a) => (a.payments || []).filter((p) => md(p.date) && p.paymentMethod === 'card').map((p) => Number(p.amount) || 0)).reduce((s, v) => s + v, 0) : 0;
            const cardInc = txCardInc + repCardInc + advCardInc;
            const cardExp = txCardExp;

            const inc = txInc + shInc + repInc + advInc;
            const exp = txExp + shExp + repExp + advExp;
            return { inc, exp, profit: inc - exp, cardInc, cardExp };
          });
          const spark7Inc = last7.map((d) => d.inc);
          const spark7Exp = last7.map((d) => d.exp);
          const total7Inc = spark7Inc.reduce((a, b) => a + b, 0);
          const total7Exp = spark7Exp.reduce((a, b) => a + b, 0);
          const total7CardInc = last7.reduce((s, d) => s + d.cardInc, 0);
          const total7CardExp = last7.reduce((s, d) => s + d.cardExp, 0);
          const total7CashInc = total7Inc - total7CardInc;
          const total7CashExp = total7Exp - total7CardExp;

          // ── Ring progress ──
          const ringTotal = income + expense > 0 ? income + expense : 1;
          const ringIncomePct = Math.min(income / ringTotal, 1);
          const RING_R = 28;
          const RING_CIRC = 2 * Math.PI * RING_R;
          const ringOffset = RING_CIRC * (1 - ringIncomePct);

          const rows = [
            ...(hasService('inventory') ? [{ cat: 'general', label: t('stockProfitOnly'), value: fmt(stockProfit), color: stockProfit >= 0 ? 'text-emerald-600' : 'text-red-500', bg: stockProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 9v1m0 0c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> }] : []),
            { cat: 'main', label: t('income'), value: fmt(income), color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" /> },
            { cat: 'main', label: t('expenses'), value: fmt(expense), color: 'text-red-500', bg: 'bg-red-50', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" /> },
            { cat: 'main', label: t('netProfit'), value: fmt(profit), color: profit >= 0 ? 'text-amber-400' : 'text-red-500', bg: profit >= 0 ? 'bg-amber-500/10' : 'bg-red-50', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
            { cat: 'general', label: t('transactions'), value: txCount, color: 'text-blue-600', bg: 'bg-blue-500/100/10', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /> },
            ...(hasService('repairs') ? [
              { cat: 'repairs', label: t('repairsIn'), value: repIn, color: 'text-amber-600', bg: 'bg-amber-50', icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></> },
              { cat: 'repairs', label: t('repaired'), value: repDone, color: 'text-emerald-700', bg: 'bg-emerald-50', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /> },
              { cat: 'repairs', label: t('repairProfit'), value: fmt(repProfit), color: repProfit >= 0 ? 'text-emerald-600' : 'text-red-500', bg: repProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 9v1m0 0c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
              { cat: 'repairs', label: t('repairIn'), value: fmt(repIncome), color: 'text-teal-600', bg: 'bg-teal-50', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /> },
            ] : []),
            ...(hasService('advances') ? [{ cat: 'advances', label: t('advanceIn'), value: fmt(adv), color: 'text-purple-600', bg: 'bg-purple-500/100/10', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /> }] : []),
            ...(hasService('secondhand') && secondhand.length > 0 ? [
              { cat: 'secondhand', label: t('shBought'), value: shBought, color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /> },
              { cat: 'secondhand', label: t('shSold'), value: shSold, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /> },
              { cat: 'secondhand', label: t('shProfit'), value: fmt(shProfit), color: shProfit >= 0 ? 'text-amber-400' : 'text-red-500', bg: shProfit >= 0 ? 'bg-amber-500/10' : 'bg-red-50', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 9v1m0 0c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
            ] : []),
            ...(hasService('reports') ? [{ cat: 'contacts', label: 'Saved Contacts', value: savedContactsCount, color: 'text-sky-500', bg: 'bg-sky-50', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /> }] : []),
          ];

          const catMeta = {
            general:    { label: 'General',    accent: 'bg-blue-400', text: 'text-blue-500',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
            repairs:    { label: t('tab_repairs'),   accent: 'bg-amber-400', text: 'text-amber-600',
              icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></> },
            advances:   { label: t('tab_advances'),  accent: 'bg-purple-400', text: 'text-purple-600',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /> },
            secondhand: { label: t('tab_secondhand'), accent: 'bg-emerald-400', text: 'text-emerald-600',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /> },
            contacts:   { label: 'Contacts',   accent: 'bg-sky-400', text: 'text-sky-500',
              icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /> },
          };
          const accentBg = (bg) => {
            if (bg.includes('emerald')) return 'bg-emerald-400';
            if (bg.includes('red'))     return 'bg-red-400';
            if (bg.includes('amber'))   return 'bg-amber-400';
            if (bg.includes('blue'))    return 'bg-blue-400';
            if (bg.includes('purple'))  return 'bg-purple-400';
            if (bg.includes('teal'))    return 'bg-teal-400';
            if (bg.includes('sky'))     return 'bg-sky-400';
            return 'bg-amber-400';
          };
          const accentCls = (bg) => {
            if (bg.includes('emerald')) return 'accent-emerald';
            if (bg.includes('red'))     return 'accent-red';
            if (bg.includes('amber'))   return 'accent-amber';
            if (bg.includes('blue'))    return 'accent-blue';
            if (bg.includes('purple'))  return 'accent-purple';
            if (bg.includes('teal'))    return 'accent-teal';
            if (bg.includes('sky'))     return 'accent-sky';
            return 'accent-amber';
          };
          const topGrad = (bg) => {
            if (bg.includes('emerald')) return 'from-emerald-300 via-emerald-400 to-emerald-500';
            if (bg.includes('red'))     return 'from-red-300 via-red-400 to-red-500';
            return 'from-amber-300 via-amber-400 to-amber-500';
          };

          return (
            <div className="rounded-2xl sm:rounded-3xl overview-section-animate" style={{ animationDelay: '0ms' }}>
            <div className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
              {/* Header — pill tabs + date picker */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-3 py-3 bg-white border-b border-gray-100 gap-2">
                {/* Mode tabs */}
                <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5 w-full sm:w-auto">
                  {[['daily', t('daily')], ['monthly', t('monthly')], ['alltime', t('allTime')]].map(([m, label]) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSummaryMode(m)}
                      className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${summaryMode === m ? 'bg-white text-amber-500 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Date / Month picker */}
                <div className="flex items-center gap-2">
                  {summaryMode === 'daily' && (
                    <DatePicker
                      value={summaryDate}
                      max={realToday}
                      onChange={(v) => v && setSummaryDate(v)}
                      className="w-full sm:w-44"
                    />
                  )}
                  {summaryMode === 'monthly' && (
                    <>
                      <input
                        ref={summaryMonthRef}
                        type="month"
                        value={summaryMonth}
                        max={realToday.slice(0,7)}
                        onChange={(e) => e.target.value && setSummaryMonth(e.target.value)}
                        className="sr-only"
                      />
                      <button
                        onClick={() => { try { summaryMonthRef.current.showPicker(); } catch { summaryMonthRef.current.click(); } }}
                        className="text-sm font-bold text-gray-800 px-3 py-2 rounded-xl border border-gray-200 bg-white shadow-sm flex items-center gap-1.5 w-full sm:w-auto"
                      >
                        <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        {new Date(summaryMonth + '-01T00:00:00').toLocaleDateString(locale, { month: 'short', year: 'numeric' })}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Metric cards */}
              <div className="p-2.5 sm:p-4 flex flex-col gap-3 sm:gap-4">

                {/* ── Main 3 + POS: Income / Expenses / Net Profit / POS ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                  {rows.filter(r => r.cat === 'main').map((r, i) => {
                    const isIncome   = r.bg.includes('emerald');
                    const isExpenses = r.bg.includes('red') && !r.bg.includes('amber');
                    const isFull     = isIncome || isExpenses;
                    const fullGrad   = isIncome
                      ? 'linear-gradient(135deg, #34d399 0%, #10b981 50%, #059669 100%)'
                      : 'linear-gradient(135deg, #f87171 0%, #ef4444 50%, #dc2626 100%)';
                    const fullShadow = isIncome
                      ? '0 8px 28px rgba(16,185,129,0.45)'
                      : '0 8px 28px rgba(239,68,68,0.4)';
                    const isProfit   = !isIncome && !isExpenses && r.bg.includes('amber');
                    const clickable = isIncome || isExpenses || isProfit;
                    const handleClick = clickable
                      ? () => setTxDetailModal(isIncome ? 'income' : isExpenses ? 'expense' : 'profit')
                      : undefined;
                    return (
                      <div
                        key={r.label}
                        onClick={handleClick}
                        className={`kpi-card summary-card-animate group relative rounded-2xl overflow-hidden select-none ${clickable ? 'cursor-pointer' : 'cursor-default'} ${isFull ? (isIncome ? 'accent-emerald' : 'accent-red') : accentCls(r.bg)}`}
                        style={isFull
                          ? { background: fullGrad, animationDelay: `${i * 60}ms`, boxShadow: fullShadow }
                          : { background: '#ffffff', border: '1px solid #e2e8f0', animationDelay: `${i * 60}ms`, boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }
                        }
                      >
                        {isFull ? (
                          <>
                            <div className="px-4 pt-4 pb-4 flex items-center justify-between gap-2">
                              <div>
                                <p className="text-xl sm:text-2xl font-black text-white leading-none tracking-tight mb-1.5">
                                  <CountUp to={r.value} />
                                </p>
                                <p className="text-[9px] font-black text-white/75 uppercase tracking-[0.18em]">{r.label}</p>
                              </div>
                              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-white/20 shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:bg-white/30">
                                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">{r.icon}</svg>
                              </div>
                            </div>
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none shimmer-sweep" />
                          </>
                        ) : (
                          <>
                            <div className={`h-0.75 bg-linear-to-r ${topGrad(r.bg)} opacity-90`} />
                            <div className="px-4 pt-4 pb-4">
                              <div className="flex items-end justify-between gap-2 mb-2">
                                <p className={`text-2xl font-black leading-none tracking-tight ${r.color}`}><CountUp to={r.value} /></p>
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 ${r.bg}`}>
                                  <svg className={`w-4 h-4 ${r.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">{r.icon}</svg>
                                </div>
                              </div>
                              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{r.label}</p>
                            </div>
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl shimmer-sweep" />
                          </>
                        )}
                      </div>
                    );
                  })}

                  {/* POS Payment Card */}
                  <div
                    onClick={() => setPosPopupOpen(true)}
                    className="kpi-card summary-card-animate group relative rounded-2xl overflow-hidden select-none cursor-pointer"
                    style={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%)', animationDelay: '180ms', boxShadow: '0 8px 28px rgba(59,130,246,0.4)' }}
                  >
                    <div className="px-4 pt-4 pb-4 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xl sm:text-2xl font-black text-white leading-none tracking-tight mb-1.5">
                          <CountUp to={fmt(todayPosCard)} />
                        </p>
                        <p className="text-[9px] font-black text-white/75 uppercase tracking-[0.18em]">POS / CARD</p>
                      </div>
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-white/20 shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:bg-white/30">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      </div>
                    </div>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none shimmer-sweep" />
                  </div>
                </div>

                {/* ── Categorized other metrics ── */}
                {(() => {
                  let globalIdx = 3;

                  // Helper to render a single category block
                  const renderCat = (cat) => {
                    const catRows = rows.filter((r) => r.cat === cat);
                    if (!catRows.length) return null;
                    const meta = catMeta[cat];
                    const startIdx = globalIdx;
                    globalIdx += catRows.length;
                    return (
                      <div key={cat} className="flex flex-col gap-1.5">
                        {/* Category section header */}
                        <div className="cat-label-animate flex items-center gap-2" style={{ animationDelay: `${startIdx * 60}ms` }}>
                          <div className="flex items-center gap-1.5 bg-white rounded-lg px-2 py-1 border border-slate-200 shadow-sm">
                            <svg className="w-2.5 h-2.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">{meta.icon}</svg>
                            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{meta.label}</span>
                          </div>
                          <div className="flex-1 h-px bg-slate-200" />
                        </div>
                        {/* Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                          {catRows.map((r, i) => (
                            <div
                              key={r.label}
                              className={`metric-card summary-card-animate group relative rounded-2xl overflow-hidden cursor-default select-none ${accentCls(r.bg)}`}
                              style={{ background: '#ffffff', border: '1px solid #e2e8f0', animationDelay: `${(startIdx + i) * 60}ms`, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}
                            >
                              <div className={`absolute left-0 top-0 bottom-0 w-0.5 group-hover:w-1 rounded-l-2xl ${accentBg(r.bg)} opacity-60 group-hover:opacity-100 transition-all duration-300`} />
                              <div className="px-4 pt-3.5 pb-3.5">
                                <div className="flex items-start justify-between gap-1 mb-2">
                                  <p className={`text-lg font-black leading-none tracking-tight ${r.color}`}><CountUp to={r.value} /></p>
                                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:rotate-12 ${r.bg}`}>
                                    <svg className={`w-3 h-3 ${r.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">{r.icon}</svg>
                                  </div>
                                </div>
                                <p className="text-[9px] font-semibold text-gray-400 leading-tight uppercase tracking-wide">{r.label}</p>
                              </div>
                              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl shimmer-sweep" />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  };

                  const topCats      = ['general','advances','contacts'].filter((c) => rows.some((r) => r.cat === c));

                  return (
                    <>
                      {/* GENERAL + ADVANCES + CONTACTS — single flat row, no headers */}
                      {topCats.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                          {topCats.map((cat) => {
                            const catRows = rows.filter((r) => r.cat === cat);
                            const startIdx = globalIdx;
                            globalIdx += catRows.length;
                            return catRows.map((r, i) => (
                              <div
                                key={r.label}
                                className={`metric-card summary-card-animate group relative rounded-2xl overflow-hidden cursor-default select-none ${accentCls(r.bg)}`}
                                style={{ background: '#ffffff', border: '1px solid #e2e8f0', animationDelay: `${(startIdx + i) * 60}ms`, boxShadow: '0 2px 10px rgba(0,0,0,0.06)' }}
                              >
                                <div className={`absolute left-0 top-0 bottom-0 w-0.5 group-hover:w-1 rounded-l-2xl ${accentBg(r.bg)} opacity-60 group-hover:opacity-100 transition-all duration-300`} />
                                <div className="px-4 pt-3.5 pb-3.5">
                                  <div className="flex items-start justify-between gap-1 mb-2">
                                    <p className={`text-lg font-black leading-none tracking-tight ${r.color}`}><CountUp to={r.value} /></p>
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:rotate-12 ${r.bg}`}>
                                      <svg className={`w-3 h-3 ${r.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">{r.icon}</svg>
                                    </div>
                                  </div>
                                  <p className="text-[9px] font-semibold text-gray-400 leading-tight uppercase tracking-wide">{r.label}</p>
                                </div>
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl shimmer-sweep" />
                              </div>
                            ));
                          })}
                        </div>
                      )}
                      {/* Repairs + Secondhand stacked below */}
                      {['repairs','secondhand'].filter((c) => rows.some((r) => r.cat === c)).map((cat) => renderCat(cat))}
                    </>
                  );
                })()}
              </div>

              {/* ── Sparkline + Ring row ── */}
              <div className="mx-2.5 sm:mx-4 mb-3 sm:mb-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">

                {/* Income sparkline */}
                <div className="kpi-card accent-emerald summary-card-animate rounded-2xl overflow-hidden bg-white" style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.07)', animationDelay: '450ms' }}>
                  <div className="h-0.75 bg-linear-to-r from-emerald-300 via-emerald-400 to-emerald-500 opacity-90" />
                  <div className="px-3.5 py-3 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">7-Day Income</span>
                      <span className="text-[10px] font-black text-emerald-600">{fmt(spark7Inc.reduce((a, b) => a + b, 0))}</span>
                    </div>
                    <MiniSparkline values={spark7Inc} color="#34d399" delay={0} />
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap">
                      <div className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100">
                        <span className="text-[7px] sm:text-[8px]">💳</span>
                        <span className="text-[7px] sm:text-[8px] font-black text-blue-600 tabular-nums">{fmt(total7CardInc)}</span>
                        <span className={`text-[7px] font-black ${total7CardInc > 0 ? 'text-emerald-500' : 'text-gray-400'}`}>{total7CardInc > 0 ? '▲' : '–'}</span>
                        {total7Inc > 0 && <span className="text-[7px] font-bold text-blue-400 tabular-nums">{Math.round((total7CardInc / total7Inc) * 100)}%</span>}
                      </div>
                      <div className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100">
                        <span className="text-[7px] sm:text-[8px]">💵</span>
                        <span className="text-[7px] sm:text-[8px] font-black text-emerald-700 tabular-nums">{fmt(total7CashInc)}</span>
                        <span className={`text-[7px] font-black ${total7CashInc > 0 ? 'text-emerald-500' : 'text-gray-400'}`}>{total7CashInc > 0 ? '▲' : '–'}</span>
                        {total7Inc > 0 && <span className="text-[7px] font-bold text-emerald-400 tabular-nums">{Math.round((total7CashInc / total7Inc) * 100)}%</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expense sparkline */}
                <div className="kpi-card accent-red summary-card-animate rounded-2xl overflow-hidden bg-white" style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.07)', animationDelay: '510ms' }}>
                  <div className="h-0.75 bg-linear-to-r from-red-300 via-red-400 to-red-500 opacity-90" />
                  <div className="px-3.5 py-3 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">7-Day Expense</span>
                      <span className="text-[10px] font-black text-red-500">{fmt(spark7Exp.reduce((a, b) => a + b, 0))}</span>
                    </div>
                    <MiniSparkline values={spark7Exp} color="#f87171" delay={100} />
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap">
                      <div className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100">
                        <span className="text-[7px] sm:text-[8px]">💳</span>
                        <span className="text-[7px] sm:text-[8px] font-black text-blue-600 tabular-nums">{fmt(total7CardExp)}</span>
                        <span className={`text-[7px] font-black ${total7CardExp > 0 ? 'text-red-500' : 'text-gray-400'}`}>{total7CardExp > 0 ? '▼' : '–'}</span>
                        {total7Exp > 0 && <span className="text-[7px] font-bold text-blue-400 tabular-nums">{Math.round((total7CardExp / total7Exp) * 100)}%</span>}
                      </div>
                      <div className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-red-50 border border-red-100">
                        <span className="text-[7px] sm:text-[8px]">💵</span>
                        <span className="text-[7px] sm:text-[8px] font-black text-red-600 tabular-nums">{fmt(total7CashExp)}</span>
                        <span className={`text-[7px] font-black ${total7CashExp > 0 ? 'text-red-500' : 'text-gray-400'}`}>{total7CashExp > 0 ? '▼' : '–'}</span>
                        {total7Exp > 0 && <span className="text-[7px] font-bold text-red-400 tabular-nums">{Math.round((total7CashExp / total7Exp) * 100)}%</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ring: income ratio */}
                <div className="kpi-card accent-amber summary-card-animate rounded-2xl overflow-hidden bg-white" style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.07)', animationDelay: '570ms' }}>
                  <div className="h-0.75 bg-linear-to-r from-amber-300 via-amber-400 to-amber-500 opacity-90" />
                  <div className="px-3.5 py-2.5 flex items-center gap-3">
                    <div className="relative shrink-0">
                      <svg width="68" height="68" viewBox="0 0 68 68" className="-rotate-90">
                        <circle cx="34" cy="34" r={RING_R} stroke="rgba(0,0,0,0.06)" strokeWidth="7" fill="none" />
                        <circle cx="34" cy="34" r={RING_R} stroke="rgba(239,68,68,0.5)" strokeWidth="7" fill="none"
                          strokeDasharray={RING_CIRC} strokeDashoffset={RING_CIRC * ringIncomePct} strokeLinecap="round" />
                        <circle cx="34" cy="34" r={RING_R} stroke="rgba(16,185,129,0.9)" strokeWidth="7" fill="none"
                          strokeDasharray={RING_CIRC} strokeDashoffset={ringOffset} strokeLinecap="round"
                          className="ring-draw" style={{ '--stroke-total': RING_CIRC, '--stroke-offset': ringOffset }} />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[10px] font-black text-gray-700 leading-none">{Math.round(ringIncomePct * 100)}%</span>
                        <span className="text-[8px] text-gray-400 leading-none mt-0.5">inc</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        <span className="text-[9px] text-gray-400 truncate">Income</span>
                        <span className="ml-auto text-[10px] font-bold text-emerald-600">{fmt(income)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                        <span className="text-[9px] text-gray-400 truncate">Expense</span>
                        <span className="ml-auto text-[10px] font-bold text-red-500">{fmt(expense)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 border-t border-gray-100 pt-1 mt-0.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                        <span className="text-[9px] text-gray-400 truncate">Net</span>
                        <span className={`ml-auto text-[10px] font-black ${profit >= 0 ? 'text-amber-500' : 'text-red-500'}`}>{profit >= 0 ? '+' : ''}{fmt(profit)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                        <span className="text-[9px] text-gray-400 truncate">💳 POS</span>
                        <span className="ml-auto text-[10px] font-bold text-blue-500">{fmt(posCard)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                        <span className="text-[9px] text-gray-400 truncate">💵 Cash</span>
                        <span className="ml-auto text-[10px] font-bold text-gray-500">{fmt(posCash)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          );
        })()}

        {/* ── POS Payment Overview Card ── */}
        {(() => {
          const txs = activeShop.transactions || [];
          const repairs = activeShop.repairs || [];
          const advances = activeShop.advances || [];

          // ── Build unified income entries with paymentMethod ──
          const posEntries = [];

          // 1. Regular transactions (income only)
          txs.filter((t) => t.type === 'income').forEach((t) => {
            posEntries.push({ amount: Number(t.amount) || 0, method: t.paymentMethod || 'cash', date: t.date || '', description: t.description || '—', category: t.category || '', id: t.id });
          });

          // 2. Repair income: advance (initial) + payments + repairCost (when done)
          repairs.forEach((r) => {
            const initAdv = Number(r.initialAdvance ?? r.advance ?? 0);
            // Initial advance recorded at creation
            if (initAdv > 0) {
              posEntries.push({ amount: initAdv, method: r.paymentMethod || 'cash', date: (r.advanceReceivedAt || r.createdAt || '').slice(0, 10), description: `Repair Advance: ${r.customerName} — ${r.device}`, category: 'Repair', id: `rep-adv-${r.id}` });
            }
            // Individual payments added later
            (r.payments || []).forEach((p) => {
              posEntries.push({ amount: Number(p.amount) || 0, method: p.paymentMethod || 'cash', date: p.date || '', description: `Repair Payment: ${r.customerName}`, category: 'Repair', id: `rep-pay-${r.id}-${p.id}` });
            });
            // Repair fee (when status is ready/delivered/completed)
            if (Number(r.repairCost) > 0 && ['ready', 'delivered', 'completed'].includes(r.status)) {
              posEntries.push({ amount: Number(r.repairCost), method: r.paymentMethod || 'cash', date: (r.feeReceivedAt || r.updatedAt || r.createdAt || '').slice(0, 10), description: `Repair Fee: ${r.customerName}`, category: 'Repair', id: `rep-fee-${r.id}` });
            }
          });

          // 3. Advance income: initial advancePaid + subsequent payments
          advances.forEach((a) => {
            if (Number(a.advancePaid) > 0) {
              posEntries.push({ amount: Number(a.advancePaid), method: a.paymentMethod || 'cash', date: (a.date || '').slice(0, 10), description: `Advance: ${a.customerName}`, category: 'Advance', id: `adv-init-${a.id}` });
            }
            (a.payments || []).forEach((p) => {
              posEntries.push({ amount: Number(p.amount) || 0, method: p.paymentMethod || 'cash', date: p.date || '', description: `Advance Payment: ${a.customerName}`, category: 'Advance', id: `adv-pay-${a.id}-${p.id}` });
            });
          });

          const allCardEntries = posEntries.filter((e) => e.method === 'card');
          const allCashEntries = posEntries.filter((e) => e.method !== 'card');
          const totalCard = allCardEntries.reduce((s, e) => s + e.amount, 0);
          const totalCash = allCashEntries.reduce((s, e) => s + e.amount, 0);
          const totalAll = totalCard + totalCash;
          const cardPct = totalAll > 0 ? Math.round((totalCard / totalAll) * 100) : 0;
          const cashPct = totalAll > 0 ? 100 - cardPct : 0;

          // Last 5 card entries
          const recentCard = [...allCardEntries].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);

          // Per-day totals for last 7 days
          const last7 = Array.from({ length: 7 }, (_, i) => {
            const dt = new Date(); dt.setDate(dt.getDate() - (6 - i));
            const ds = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
            const dayCard = allCardEntries.filter((e) => (e.date || '').slice(0, 10) === ds).reduce((s, e) => s + e.amount, 0);
            const dayCash = allCashEntries.filter((e) => (e.date || '').slice(0, 10) === ds).reduce((s, e) => s + e.amount, 0);
            return { ds, card: dayCard, cash: dayCash };
          });
          const maxDay = Math.max(...last7.map((d) => d.card + d.cash), 1);

          return (
            <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-200 overview-section-animate" style={{ animationDelay: '60ms' }}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5" style={{ background: 'linear-gradient(135deg, #7a4f2a 0%, #a06835 100%)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xs font-extrabold text-white uppercase tracking-wider">{t('posPayments')}</h2>
                    <p className="text-[10px] text-white/45 leading-tight">{t('cashVsCard')}</p>
                  </div>
                </div>
              </div>

              {/* Summary strip */}
              <div className="grid grid-cols-3 divide-x divide-gray-100 bg-gray-50 border-b border-gray-100">
                <div className="px-4 py-3 text-center">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase">{t('cardPOS')}</p>
                  <p className="text-sm font-black text-blue-600">{fmt(totalCard)}</p>
                  <p className="text-[9px] text-blue-400">{allCardEntries.length} txn · {cardPct}%</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase">{t('cash')}</p>
                  <p className="text-sm font-black text-emerald-600">{fmt(totalCash)}</p>
                  <p className="text-[9px] text-emerald-400">{allCashEntries.length} txn · {cashPct}%</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase">{t('total')}</p>
                  <p className="text-sm font-black text-gray-800">{fmt(totalAll)}</p>
                  <p className="text-[9px] text-gray-400">{posEntries.length} txn</p>
                </div>
              </div>

              {/* Progress bar */}
              {totalAll > 0 && (
                <div className="px-5 py-3 bg-white border-b border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      <span className="text-[10px] font-bold text-blue-600">{t('cardPOS')} {cardPct}%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-[10px] font-bold text-emerald-600">{t('cash')} {cashPct}%</span>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden flex">
                    <div className="h-full bg-blue-500 rounded-l-full transition-all" style={{ width: `${cardPct}%` }} />
                    <div className="h-full bg-emerald-500 rounded-r-full transition-all" style={{ width: `${cashPct}%` }} />
                  </div>
                </div>
              )}

              {/* 7-day mini chart */}
              <div className="px-5 py-3 bg-white border-b border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">{t('last7Days')}</p>
                <div className="flex items-end gap-1.5" style={{ height: 48 }}>
                  {last7.map((d, i) => {
                    const total = d.card + d.cash;
                    const h = total > 0 ? Math.max((total / maxDay) * 48, 4) : 2;
                    const cardH = total > 0 ? (d.card / total) * h : 0;
                    const cashH = h - cardH;
                    const dayLabel = new Date(d.ds + 'T00:00:00').toLocaleDateString(locale, { weekday: 'narrow' });
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className="w-full flex flex-col items-stretch rounded-md overflow-hidden" style={{ height: h }}>
                          {cashH > 0 && <div className="bg-emerald-400" style={{ height: cashH }} />}
                          {cardH > 0 && <div className="bg-blue-500" style={{ height: cardH }} />}
                        </div>
                        <span className="text-[8px] text-gray-400">{dayLabel}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent card transactions */}
              {recentCard.length > 0 && (
                <div className="bg-white">
                  <p className="px-5 pt-3 text-[10px] font-bold text-gray-400 uppercase">{t('recentCardPayments')}</p>
                  <div className="divide-y divide-gray-50">
                    {recentCard.map((tx) => (
                      <div key={tx.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-blue-50/30 transition-colors">
                        <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                          <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">{tx.description || '—'}</p>
                          <p className="text-[9px] text-gray-400">{tx.date ? fmtDate(tx.date) : '—'}{tx.category ? ` · ${tx.category}` : ''}</p>
                        </div>
                        <span className="text-xs font-black text-blue-600">+{fmt(Number(tx.amount) || 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {totalAll === 0 && (
                <div className="px-5 py-8 text-center bg-white">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-2">
                    <svg className="w-5 h-5 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-500">{t('noPosPayments')}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t('noPosPaymentsSub')}</p>
                </div>
              )}
            </div>
          );
        })()}

        {/* Secondhand Overview Card */}
        {hasService('secondhand') && activeShop.secondhand && activeShop.secondhand.length > 0 && (() => {
          const items = activeShop.secondhand;
          const inStock = items.filter((i) => i.status !== 'sold');
          const sold = items.filter((i) => i.status === 'sold');
          const invested = inStock.reduce((s, i) => s + (i.buyPrice || 0), 0);
          const totalSellRev = sold.reduce((s, i) => s + (i.sellPrice || 0), 0);
          const totalProfit = sold.reduce((s, i) => s + ((i.sellPrice || 0) - (i.buyPrice || 0)), 0);
          const recent = [...items].sort((a, b) => (b.buyDate || '').localeCompare(a.buyDate || '')).slice(0, 5);
          const condColor = { Excellent: 'bg-emerald-100 text-emerald-700', Good: 'bg-amber-100 text-amber-700', Fair: 'bg-amber-100 text-amber-700', Poor: 'bg-red-100 text-red-700' };
          return (
            <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-200 overview-section-animate" style={{ animationDelay: '80ms' }}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5" style={{ background: 'linear-gradient(135deg, #7a4f2a 0%, #a06835 100%)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">{t('tab_secondhand')}</h3>
                    <p className="text-[10px] text-white/50 leading-tight">{items.length} total items</p>
                  </div>
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full text-amber-200" style={{ background: 'rgba(245,158,11,0.30)' }}>{items.length} items</span>
                </div>
                <button onClick={() => setPage('secondhand')} className="flex items-center gap-1 text-[10px] font-bold text-white/70 hover:text-white transition-colors">
                  {t('viewAll')}
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 bg-white border-b border-gray-100">
                {[
                  { label: t('inStock'), value: inStock.length, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: t('sold'), value: sold.length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: t('investedStock'), value: fmt(invested), color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: t('totalProfit'), value: fmt(totalProfit), color: totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500', bg: totalProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
                ].map((s, i) => (
                  <div key={s.label} className="summary-card-animate flex flex-col items-center py-3.5 px-3 text-center border-r border-gray-100 last:border-r-0 hover:bg-amber-50/50 transition-colors"
                    style={{ animationDelay: `${i * 55}ms` }}>
                    <span className={`text-base font-black ${s.color}`}>{s.value}</span>
                    <span className="text-[10px] font-medium text-gray-400 mt-0.5">{s.label}</span>
                  </div>
                ))}
              </div>

              {/* Recent items */}
              <div className="bg-white divide-y divide-gray-50">
                {recent.map((item, idx) => {
                  const isSold = item.status === 'sold';
                  const profit = isSold ? (item.sellPrice || 0) - (item.buyPrice || 0) : null;
                  return (
                    <div key={item.id} className="summary-card-animate flex items-center gap-3 px-5 py-3 hover:bg-amber-50/40 transition-colors"
                      style={{ animationDelay: `${(idx + 4) * 40}ms` }}>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isSold ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                        <svg className={`w-4 h-4 ${isSold ? 'text-emerald-600' : 'text-amber-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          {isSold
                            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />}
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold text-gray-800 truncate">{item.itemName}</p>
                          {item.brand && <span className="text-[10px] text-gray-400">{item.brand}</span>}
                          {item.condition && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${condColor[item.condition] || 'bg-gray-100 text-gray-500'}`}>{item.condition}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-gray-400">Buy: {fmt(item.buyPrice)}</span>
                          {isSold && <span className="text-[10px] text-gray-400">· Sell: {fmt(item.sellPrice)}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${isSold ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {isSold ? 'Sold' : 'Available'}
                        </span>
                        {isSold && profit !== null && (
                          <p className={`text-[10px] font-bold mt-0.5 ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {profit >= 0 ? '+' : ''}{fmt(profit)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              {sold.length > 0 && (
                <div className="px-5 py-2.5 bg-emerald-50 border-t border-emerald-100 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-emerald-600">Total Sales Revenue</span>
                  <span className="text-xs font-black text-emerald-700">{fmt(totalSellRev)}</span>
                </div>
              )}
            </div>
          );
        })()}
        {/* ── Team + Revenue: 2-card single column ── */}
        {(hasService('team') && activeShop.team && activeShop.team.length > 0) || revenue > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">

            {/* TEAM CARD */}
            {hasService('team') && activeShop.team && activeShop.team.length > 0 && (() => {
              const activeMembers = activeShop.team.filter((m) => m.status === 'active');
              const totalPayroll = activeMembers.reduce((s, m) => s + (Number(m.salary) || 0), 0);
              const COLORS = ['#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#06b6d4','#ec4899','#84cc16'];
              return (
                <div
                  className="overview-section-animate rounded-2xl overflow-hidden shadow-lg border border-gray-200 cursor-pointer group hover:border-amber-300 transition-all duration-200"
                  style={{ animationDelay: '120ms' }}
                  onClick={() => setPage('team')}
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between px-5 py-3.5" style={{ background: 'linear-gradient(135deg, #7a4f2a 0%, #a06835 100%)' }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.18)' }}>
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">{t('tab_team')}</h3>
                        <p className="text-[10px] text-white/50 leading-tight">{activeMembers.length} {t('active')} · {activeShop.team.length} total</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[9px] text-white/50 uppercase tracking-wide">{t('monthlyPayroll')}</p>
                        <p className="text-xs font-black text-white">{fmt(totalPayroll)}</p>
                      </div>
                      <svg className="w-3.5 h-3.5 text-white/60 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 bg-amber-50/60 border-b border-gray-100">
                    {[
                      { label: 'Total', val: activeShop.team.length, color: 'text-gray-800' },
                      { label: t('active'), val: activeMembers.length, color: 'text-emerald-600' },
                      { label: 'Inactive', val: activeShop.team.length - activeMembers.length, color: 'text-red-500' },
                    ].map((s) => (
                      <div key={s.label} className="flex flex-col items-center gap-0.5 py-3">
                        <span className={`text-lg font-black leading-none ${s.color}`}>{s.val}</span>
                        <span className="text-[9px] text-gray-400 uppercase tracking-widest">{s.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Member chips */}
                  <div className="bg-white px-5 py-4 flex flex-wrap gap-2">
                    {activeShop.team.map((member, idx) => (
                      <div
                        key={member.id}
                        className={`summary-card-animate flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200 hover:scale-105 ${member.status === 'active' ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}
                        style={{ animationDelay: `${120 + idx * 45}ms` }}
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-xs shrink-0"
                          style={{ background: COLORS[idx % COLORS.length] }}>
                          {member.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-800 leading-tight">{member.name}</p>
                          <p className="text-[9px] text-gray-400 leading-tight">{member.role}</p>
                        </div>
                        <div className={`w-1.5 h-1.5 rounded-full ml-0.5 shrink-0 ${member.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-300'}`} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* REVENUE VS EXPENSES CARD */}
            {revenue > 0 && (() => {
              const total = revenue + expenses;
              const revPct = total > 0 ? (revenue / total) * 100 : 50;
              const expPct = total > 0 ? (expenses / total) * 100 : 50;
              const netPct = total > 0 ? Math.abs(profit / total) * 100 : 0;
              return (
                <div
                  className="overview-section-animate rounded-2xl overflow-hidden shadow-lg border border-gray-200"
                  style={{ animationDelay: '160ms' }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-3.5" style={{ background: 'linear-gradient(135deg, #7a4f2a 0%, #a06835 100%)' }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.18)' }}>
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">{t('revenueVsExpenses')}</h3>
                    </div>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${profit >= 0 ? 'bg-emerald-500/30 text-emerald-200' : 'bg-red-500/30 text-red-200'}`}>
                      {profit >= 0 ? t('profitable') : t('runningAtLoss')}
                    </span>
                  </div>

                  {/* Big numbers row */}
                  <div className="grid grid-cols-3 bg-amber-50/60 border-b border-gray-100">
                    <div className="flex flex-col items-start gap-0.5 px-5 py-3">
                      <span className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">{t('revenue')}</span>
                      <span className="text-sm font-black text-emerald-600 tabular-nums">{fmt(revenue)}</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5 py-3">
                      <span className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">{t('netProfit')}</span>
                      <span className={`text-sm font-black tabular-nums ${profit >= 0 ? 'text-amber-600' : 'text-red-500'}`}>{profit >= 0 ? '+' : ''}{fmt(profit)}</span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 px-5 py-3">
                      <span className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">{t('expenses')}</span>
                      <span className="text-sm font-black text-red-500 tabular-nums">{fmt(expenses)}</span>
                    </div>
                  </div>

                  {/* Animated bars */}
                  <div className="bg-white px-5 py-4 flex flex-col gap-3">
                    {/* Revenue bar */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{t('revenue')}</span>
                        <span className="text-[10px] font-black text-emerald-600">{revPct.toFixed(0)}%</span>
                      </div>
                      <div className="h-2.5 rounded-full overflow-hidden bg-gray-100">
                        <div className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${revPct}%`, background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
                      </div>
                    </div>
                    {/* Expenses bar */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{t('expenses')}</span>
                        <span className="text-[10px] font-black text-red-500">{expPct.toFixed(0)}%</span>
                      </div>
                      <div className="h-2.5 rounded-full overflow-hidden bg-gray-100">
                        <div className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${expPct}%`, background: 'linear-gradient(90deg, #ef4444, #f87171)' }} />
                      </div>
                    </div>
                    {/* Net bar */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{t('netProfit')}</span>
                        <span className={`text-[10px] font-black ${profit >= 0 ? 'text-amber-600' : 'text-red-500'}`}>{netPct.toFixed(0)}%</span>
                      </div>
                      <div className="h-2.5 rounded-full overflow-hidden bg-gray-100">
                        <div className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${netPct}%`, background: profit >= 0 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #ef4444, #f87171)' }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>
        ) : null}

        {/* ── Reports Overview Card (Current Month) ── */}
        {hasService('reports') && (() => {
          const txs = activeShop.transactions || [];
          const repairs = activeShop.repairs || [];
          const advances = activeShop.advances || [];
          const skus = activeShop.skus || [];
          const secondhand = activeShop.secondhand || [];
          const team = activeShop.team || [];

          const now = new Date();
          const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          const inMonth = (v) => (v || '').slice(0, 7) === curMonth;
          const monthLabel = now.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

          // Transactions
          const mTxIncome = txs.filter((t) => inMonth(t.date) && t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
          const mTxExpense = txs.filter((t) => inMonth(t.date) && t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
          const mTxCount = txs.filter((t) => inMonth(t.date)).length;
          const mTxCardIncome = txs.filter((t) => inMonth(t.date) && t.type === 'income' && t.paymentMethod === 'card').reduce((s, t) => s + (Number(t.amount) || 0), 0);
          const mTxCardExpense = txs.filter((t) => inMonth(t.date) && t.type === 'expense' && t.paymentMethod === 'card').reduce((s, t) => s + (Number(t.amount) || 0), 0);

          // Repairs
          const mRepairs = repairs.filter((r) => inMonth(r.createdAt));
          const mRepDone = repairs.filter((r) => inMonth(r.updatedAt) && ['ready','delivered','completed'].includes(r.status));
          const mRepParts = mRepairs.reduce((s, r) => s + (Number(r.partsCost) || 0), 0);
          const mRepAdv = mRepairs.reduce((s, r) => s + (Number(r.advance) || 0), 0);
          const mRepFee = mRepDone.reduce((s, r) => s + (Number(r.repairCost) || 0), 0);
          const mRepCardInc = mRepairs.filter((r) => r.paymentMethod === 'card').reduce((s, r) => s + (Number(r.advance) || 0), 0)
            + mRepDone.filter((r) => r.paymentMethod === 'card').reduce((s, r) => s + (Number(r.repairCost) || 0), 0);

          // Advances
          const mAdvances = advances.filter((a) => inMonth(a.date));
          const mAdvGiven = mAdvances.reduce((s, a) => s + (Number(a.advancePaid) || 0), 0);
          const mAdvPayments = advances.flatMap((a) => (a.payments || []).filter((p) => inMonth(p.date)));
          const mAdvReceived = mAdvPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
          const mAdvDue = advances.reduce((s, a) => s + (Number(a.remaining) || 0), 0);
          const mAdvCardInc = mAdvPayments.filter((p) => p.paymentMethod === 'card').reduce((s, p) => s + (Number(p.amount) || 0), 0);

          // Inventory
          const mMov = skus.flatMap((sk) => (sk.movements || []).filter((m) => inMonth(m.date)).map((m) => ({ ...m, skuName: sk.name })));
          const mInvIn = mMov.filter((m) => m.type === 'in');
          const mInvOut = mMov.filter((m) => m.type === 'out');
          const mInvInExp = mInvIn.reduce((s, m) => s + ((Number(m.price) || 0) * (Number(m.qty) || 1)), 0);
          const mInvOutInc = mInvOut.reduce((s, m) => s + ((Number(m.price) || 0) * (Number(m.qty) || 1)), 0);

          // Secondhand
          const mShBought = secondhand.filter((i) => inMonth(i.buyDate));
          const mShSold = secondhand.filter((i) => i.status === 'sold' && inMonth(i.sellDate));
          const mShBoughtCost = mShBought.reduce((s, i) => s + (Number(i.buyPrice) || 0), 0);
          const mShSoldRev = mShSold.reduce((s, i) => s + (Number(i.sellPrice) || 0), 0);

          // Team
          const mActiveTeam = team.filter((m) => m.status === 'active');
          const mPayroll = mActiveTeam.reduce((s, m) => s + (Number(m.salary) || 0), 0);

          // Grand totals
          const gIncome = mTxIncome + mRepAdv + mRepFee + mAdvReceived + mInvOutInc + mShSoldRev;
          const gExpense = mTxExpense + mRepParts + mAdvGiven + mInvInExp + mShBoughtCost;
          const gProfit = gIncome - gExpense;
          const gCardIncome = mTxCardIncome + mRepCardInc + mAdvCardInc;
          const gCashIncome = gIncome - gCardIncome;
          const gCardExpense = mTxCardExpense;
          const gCashExpense = gExpense - gCardExpense;

          const hasData = mTxCount > 0 || mRepairs.length > 0 || mAdvances.length > 0 || mMov.length > 0 || mShBought.length > 0 || mShSold.length > 0;

          const incPct = gIncome + gExpense > 0 ? Math.round((gIncome / (gIncome + gExpense)) * 100) : 50;

          const modules = [
            { label: t('transactions'), income: mTxIncome, expense: mTxExpense, count: mTxCount, unit: t('entries'), color: 'blue', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /> },
            ...(hasService('repairs') ? [{ label: t('tab_repairs'), income: mRepAdv + mRepFee, expense: mRepParts, count: mRepairs.length, unit: 'jobs', color: 'amber', icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></> }] : []),
            ...(hasService('advances') ? [{ label: t('tab_advances'), income: mAdvReceived, expense: mAdvGiven, count: mAdvances.length, unit: t('entries'), color: 'purple', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /> }] : []),
            ...(hasService('inventory') ? [{ label: t('tab_inventory'), income: mInvOutInc, expense: mInvInExp, count: mMov.length, unit: 'movements', color: 'sky', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /> }] : []),
            ...(hasService('secondhand') ? [{ label: t('tab_secondhand'), income: mShSoldRev, expense: mShBoughtCost, count: mShBought.length + mShSold.length, unit: 'items', color: 'emerald', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /> }] : []),
          ];

          const colorMap = { blue: { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-400', bar: '#3b82f6' }, amber: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-400', bar: '#f59e0b' }, purple: { bg: 'bg-purple-50', text: 'text-purple-600', dot: 'bg-purple-400', bar: '#8b5cf6' }, sky: { bg: 'bg-sky-50', text: 'text-sky-600', dot: 'bg-sky-400', bar: '#0ea5e9' }, emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-400', bar: '#10b981' } };

          return (
            <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-200 overview-section-animate" style={{ animationDelay: '200ms' }}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3.5" style={{ background: 'linear-gradient(135deg, #7a4f2a 0%, #a06835 100%)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">{t('tab_reports')} — {monthLabel}</h3>
                    <p className="text-[10px] text-white/50 leading-tight">{activeShop.name || 'Shop'} · Monthly Snapshot</p>
                  </div>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${gProfit >= 0 ? 'bg-emerald-500/30 text-emerald-200' : 'bg-red-500/30 text-red-200'}`}>
                    {gProfit >= 0 ? '▲ Profitable' : '▼ At Loss'}
                  </span>
                </div>
                <button onClick={() => setPage('reports')} className="flex items-center gap-1 text-[10px] font-bold text-white/70 hover:text-white transition-colors">
                  {t('viewAll')}
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>

              {/* Grand P&L strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100 bg-amber-50/50">
                {[
                  { label: t('totalIncome'), val: fmt(gIncome), color: 'text-emerald-600' },
                  { label: t('totalExpenses'), val: fmt(gExpense), color: 'text-red-500' },
                  { label: t('netProfit'), val: (gProfit >= 0 ? '+' : '') + fmt(gProfit), color: gProfit >= 0 ? 'text-amber-600' : 'text-red-500' },
                  { label: t('transactions'), val: `${mTxCount} entries`, color: 'text-blue-600' },
                ].map((s) => (
                  <div key={s.label} className="summary-card-animate flex flex-col items-center py-3 gap-0.5">
                    <span className={`text-base font-black ${s.color}`}>{s.val}</span>
                    <span className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold">{s.label}</span>
                  </div>
                ))}
              </div>

              {/* POS Card vs Cash strip */}
              <div className="bg-white border-b border-gray-100 px-5 py-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-bold text-blue-500">💳 Card: {fmt(gCardIncome)}</span>
                    <span className="text-[9px] font-bold text-gray-500">💵 Cash: {fmt(gCashIncome)}</span>
                  </div>
                  <span className="text-[9px] text-gray-400">{t('income')}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-gray-100 mb-2">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${gIncome > 0 ? Math.round((gCardIncome / gIncome) * 100) : 0}%`, background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }} />
                </div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-bold text-blue-500">💳 Card: {fmt(gCardExpense)}</span>
                    <span className="text-[9px] font-bold text-gray-500">💵 Cash: {fmt(gCashExpense)}</span>
                  </div>
                  <span className="text-[9px] text-gray-400">{t('expenses')}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-gray-100">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${gExpense > 0 ? Math.round((gCardExpense / gExpense) * 100) : 0}%`, background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }} />
                </div>
              </div>

              {/* Income vs Expense ratio bar */}
              <div className="bg-white border-b border-gray-100 px-5 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-bold text-emerald-600">{t('income')} {incPct}%</span>
                  <span className="text-[9px] font-bold text-red-500">{t('expenses')} {100 - incPct}%</span>
                </div>
                <div className="h-3 rounded-full overflow-hidden bg-red-200 flex">
                  <div className="h-full rounded-l-full transition-all duration-700" style={{ width: `${incPct}%`, background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
                </div>
              </div>

              {/* Module breakdown */}
              {hasData ? (
                <div className="bg-white divide-y divide-gray-50">
                  {modules.map((mod) => {
                    const c = colorMap[mod.color];
                    const net = mod.income - mod.expense;
                    const barMax = Math.max(mod.income, mod.expense, 1);
                    return (
                      <div key={mod.label} className="px-5 py-3 hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center shrink-0`}>
                            <svg className={`w-3.5 h-3.5 ${c.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">{mod.icon}</svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-bold ${c.text}`}>{mod.label}</span>
                              <span className={`text-xs font-black ${net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{net >= 0 ? '+' : ''}{fmt(net)}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-[10px] text-emerald-500 font-semibold">+{fmt(mod.income)}</span>
                              <span className="text-[10px] text-red-400 font-semibold">-{fmt(mod.expense)}</span>
                              <span className="text-[10px] text-gray-400 ml-auto">{mod.count} {mod.unit}</span>
                            </div>
                          </div>
                        </div>
                        {/* Mini income/expense bars */}
                        <div className="flex gap-1.5 ml-10">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-gray-100">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.round((mod.income / barMax) * 100)}%`, background: '#10b981' }} />
                          </div>
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-gray-100">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.round((mod.expense / barMax) * 100)}%`, background: '#ef4444' }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Payroll row */}
                  {hasService('team') && mActiveTeam.length > 0 && (
                    <div className="px-5 py-3 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                          <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-rose-600">{t('cat_Payroll')}</span>
                            <span className="text-xs font-black text-rose-600">{fmt(mPayroll)}</span>
                          </div>
                          <span className="text-[10px] text-gray-400">{mActiveTeam.length} {t('activeEmployees')} · monthly</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Advance due reminder */}
                  {mAdvDue > 0 && (
                    <div className="px-5 py-2.5 bg-orange-50/60 flex items-center gap-2">
                      <span className="text-[10px]">⚠️</span>
                      <span className="text-[10px] font-bold text-orange-600">Outstanding Advance Due: {fmt(mAdvDue)}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white text-center py-10">
                  <p className="text-sm text-gray-400 font-medium">No transactions this month yet</p>
                </div>
              )}

              {/* Footer */}
              <div className="bg-gray-50 border-t border-gray-100 px-5 py-2.5 flex items-center justify-between">
                <span className="text-[9px] text-gray-400">Generated: {new Date().toLocaleDateString()}</span>
                <button onClick={() => setPage('reports')} className="text-[10px] font-bold hover:underline" style={{ color: '#936639' }}>
                  Open Full Report →
                </button>
              </div>
            </div>
          );
        })()}

        {/* ── Transaction History Report ── */}
        {(() => {
          const allTxs = activeShop?.transactions || [];
          const secondhand = activeShop?.secondhand || [];
          const repairs = activeShop?.repairs || [];
          const advances = activeShop?.advances || [];
          const skus = activeShop?.skus || [];

          // ── Summary totals ──
          const txIncome = allTxs.filter((t) => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
          // Card income from transactions
          const txCardIncomeOnly = allTxs.filter((t) => t.type === 'income' && t.paymentMethod === 'card').reduce((s, t) => s + (Number(t.amount) || 0), 0);
          // Card income from repairs (advance + payments + repairCost)
          const repCardIncome = repairs.reduce((s, r) => {
            let c = 0;
            if (r.paymentMethod === 'card') c += (Number(r.advance) || 0);
            (r.payments || []).forEach((p) => { if (p.paymentMethod === 'card') c += (Number(p.amount) || 0); });
            if (r.paymentMethod === 'card' && ['ready', 'delivered', 'completed'].includes(r.status)) c += (Number(r.repairCost) || 0);
            return s + c;
          }, 0);
          // Card income from advance payments received
          const advCardIncome = advances.flatMap((a) => (a.payments || []).filter((p) => p.paymentMethod === 'card').map((p) => Number(p.amount) || 0)).reduce((s, v) => s + v, 0);
          const txCardIncome = txCardIncomeOnly + repCardIncome + advCardIncome;

          const repAdvInc = repairs.reduce((s, r) => s + (Number(r.advance) || 0), 0);
          const repFeeInc = repairs.filter((r) => ['ready', 'delivered', 'completed'].includes(r.status)).reduce((s, r) => s + (Number(r.repairCost) || 0), 0);

          const advReceived = advances.flatMap((a) => (a.payments || []).map((p) => Number(p.amount) || 0)).reduce((s, v) => s + v, 0);

          const totalIncomeAll = txIncome + repAdvInc + repFeeInc + advReceived;
          const txCashIncome = totalIncomeAll - txCardIncome;

          const allMovements = skus.flatMap((sk) => (sk.movements || []).filter((m) => Number(m.price) > 0).map((m) => ({ ...m, skuName: sk.name, skuCode: sk.code })));

          // ── Build unified entries list ──
          const entries = [];

          // Regular transactions
          allTxs.forEach((tx) => {
            entries.push({
              id: `tx-${tx.id}`,
              date: tx.date || '',
              flow: tx.type, // 'income' | 'expense'
              amount: Number(tx.amount) || 0,
              label: tx.description || '—',
              sub1: [tx.clientName, tx.deviceModel].filter(Boolean).join(' · '),
              sub2: tx.category || '',
              badge: tx.type === 'income' ? 'Entrata' : 'Uscita',
              badgeCls: tx.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600',
              dotCls: tx.type === 'income' ? 'bg-emerald-400' : 'bg-red-400',
              paymentMethod: tx.paymentMethod || null,
              extra: tx.discountAmount > 0
                ? `${tx.discountType === 'percent' ? `${tx.discountValue}% off` : 'Flat off'} — saved ${fmt(tx.discountAmount)}`
                : null,
              deleteFn: () => setDeleteId(tx.id),
            });
          });

          // Repair jobs — each repair becomes one or more entries (parts, advance, fee)
          repairs.forEach((r) => {
            const repDate = r.createdAt || '';
            const statusMap = { ready: 'bg-emerald-100 text-emerald-700', delivered: 'bg-emerald-100 text-emerald-700', completed: 'bg-blue-100 text-blue-700', parts_ordered: 'bg-sky-100 text-sky-700', in_progress: 'bg-amber-100 text-amber-700', pending: 'bg-orange-100 text-orange-700', cancelled: 'bg-red-100 text-red-600' };
            const statusLabel = { parts_ordered: 'Parti Ordinate', in_progress: 'In Corso', ready: 'Pronto', delivered: 'Consegnato', pending: 'In Attesa', completed: 'Completato' }[r.status] || (r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : '');
            const statusCls = statusMap[r.status] || 'bg-gray-100 text-gray-500';
            const device = [r.device, r.issue].filter(Boolean).join(' · ');

            if (Number(r.partsCost) > 0) {
              entries.push({
                id: `rep-parts-${r.id}`,
                date: repDate,
                flow: 'expense',
                amount: Number(r.partsCost),
                label: r.customerName || '—',
                sub1: device,
                sub2: r.phone || '',
                badge: t('badge_repairParts'),
                badgeCls: 'bg-orange-100 text-orange-700',
                dotCls: 'bg-orange-400',
                extra: null,
              });
            }
            if (Number(r.advance) > 0) {
              entries.push({
                id: `rep-adv-${r.id}`,
                date: repDate,
                flow: 'income',
                amount: Number(r.advance),
                label: r.customerName || '—',
                sub1: device,
                sub2: r.phone || '',
                badge: t('badge_repairAdvance'),
                badgeCls: 'bg-amber-100 text-amber-700',
                dotCls: 'bg-amber-400',
                paymentMethod: r.paymentMethod || null,
                extra: null,
              });
            }
            if (Number(r.repairCost) > 0 && ['ready', 'delivered', 'completed'].includes(r.status)) {
              entries.push({
                id: `rep-fee-${r.id}`,
                date: repDate,
                flow: 'income',
                amount: Number(r.repairCost),
                label: r.customerName || '—',
                sub1: device,
                sub2: r.phone || '',
                badge: t('badge_repairFee'),
                badgeCls: 'bg-blue-100 text-blue-700',
                dotCls: 'bg-blue-400',
                paymentMethod: r.paymentMethod || null,
                extra: statusLabel ? `Stato: ${statusLabel}` : null,
                extraCls: statusCls,
              });
            }
            // If no amounts recorded at all, still show as an entry
            if (Number(r.partsCost) === 0 && Number(r.advance) === 0 && Number(r.repairCost) === 0) {
              entries.push({
                id: `rep-bare-${r.id}`,
                date: repDate,
                flow: null,
                amount: 0,
                label: r.customerName || '—',
                sub1: device,
                sub2: r.phone || '',
                badge: t('badge_repairJob'),
                badgeCls: `${statusCls}`,
                dotCls: 'bg-gray-300',
                extra: statusLabel ? `Stato: ${statusLabel}` : null,
              });
            }
          });

          // Advances
          advances.forEach((a) => {
            const pct = a.totalAmount > 0 ? Math.min(((a.advancePaid || 0) / a.totalAmount) * 100, 100) : 0;
            if (Number(a.advancePaid) > 0) {
              entries.push({
                id: `adv-given-${a.id}`,
                date: a.date || '',
                flow: 'expense',
                amount: Number(a.advancePaid),
                label: a.customerName || '—',
                sub1: a.description || '',
                sub2: a.phone || '',
                badge: t('badge_advanceGiven'),
                badgeCls: 'bg-purple-100 text-purple-700',
                dotCls: 'bg-purple-400',
                paymentMethod: a.paymentMethod || null,
                extra: `Totale: ${fmt(a.totalAmount || 0)} · ${pct.toFixed(0)}% ricevuto`,
                pct,
              });
            }
            (a.payments || []).forEach((p, pi) => {
              entries.push({
                id: `adv-rcv-${a.id}-${pi}`,
                date: p.date || a.date || '',
                flow: 'income',
                amount: Number(p.amount) || 0,
                label: a.customerName || '—',
                sub1: a.description || '',
                sub2: a.phone || '',
                badge: t('badge_advanceReceived'),
                badgeCls: 'bg-teal-100 text-teal-700',
                dotCls: 'bg-teal-400',
                paymentMethod: p.paymentMethod || null,
                extra: null,
              });
            });
          });

          // Inventory movements
          allMovements.forEach((m) => {
            const isIn = m.type === 'in';
            entries.push({
              id: `inv-${m.id || Math.random()}`,
              date: m.date || '',
              flow: isIn ? 'expense' : 'income',
              amount: (Number(m.price) || 0) * (Number(m.qty) || 1),
              label: m.skuName || '—',
              sub1: `×${m.qty}${m.note ? ' · ' + m.note : ''}`,
              sub2: m.skuCode || '',
              badge: isIn ? t('badge_stockInEntry') : t('badge_stockOutEntry'),
              badgeCls: isIn ? 'bg-sky-100 text-sky-700' : 'bg-cyan-100 text-cyan-700',
              dotCls: isIn ? 'bg-sky-400' : 'bg-cyan-400',
              extra: null,
            });
          });

          // Secondhand — buy entry
          secondhand.forEach((i) => {
            entries.push({
              id: `sh-buy-${i.id}`,
              date: i.buyDate || '',
              flow: 'expense',
              amount: Number(i.buyPrice) || 0,
              label: `${i.itemName || '—'}${i.brand ? ' — ' + i.brand : ''}`,
              sub1: i.sellerName ? `${t('badge_seller')}: ${i.sellerName}` : '',
              sub2: i.model || '',
              badge: t('badge_shBuy'),
              badgeCls: 'bg-emerald-500/20 text-emerald-300',
              dotCls: 'bg-violet-400',
              extra: null,
            });
            if (i.status === 'sold') {
              const pl = (Number(i.sellPrice) || 0) - (Number(i.buyPrice) || 0);
              entries.push({
                id: `sh-sell-${i.id}`,
                date: i.sellDate || i.buyDate || '',
                flow: 'income',
                amount: Number(i.sellPrice) || 0,
                label: `${i.itemName || '—'}${i.brand ? ' — ' + i.brand : ''}`,
                sub1: i.buyerName ? `${t('badge_buyer')}: ${i.buyerName}` : '',
                sub2: i.model || '',
                badge: t('badge_shSold'),
                badgeCls: 'bg-emerald-100 text-emerald-700',
                dotCls: 'bg-emerald-500',
                extra: `P&L: ${pl >= 0 ? '+' : ''}${fmt(pl)}`,
                extraCls: pl >= 0 ? 'text-emerald-600' : 'text-red-500',
              });
            }
          });

          // ── Filter by income/expense ──
          const filtered = entries.filter((e) => {
            if (filter === 'all') return true;
            return e.flow === filter;
          }).sort((a, b) => (b.date || '').localeCompare(a.date || '') || 0);

          const totalIncome = filtered.filter(e => e.flow === 'income').reduce((s, e) => s + e.amount, 0);
          const totalExpense = filtered.filter(e => e.flow === 'expense').reduce((s, e) => s + e.amount, 0);

          return (
            <div className="space-y-3 overview-section-animate" style={{ animationDelay: '200ms' }}>

              {/* ── Header ── */}
              <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-200">
                <div className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-3.5" style={{ background: 'linear-gradient(135deg, #6b3a1f 0%, #936639 100%)' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    </div>
                    <div>
                      <h2 className="text-[10px] sm:text-xs font-extrabold text-white uppercase tracking-wider">{t('transactionHistory')}</h2>
                      <p className="text-[9px] sm:text-[10px] text-white/45 leading-tight hidden sm:block">Unified timeline — all modules</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                    {['all', 'income', 'expense'].map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-2 sm:px-2.5 py-1 rounded-lg text-[9px] sm:text-[10px] font-bold capitalize transition-all ${filter === f
                          ? f === 'income' ? 'bg-emerald-500/40 text-emerald-200' : f === 'expense' ? 'bg-red-500/40 text-red-200' : 'bg-white/20 text-white'
                          : 'text-white/50 hover:bg-white/10 hover:text-white'}`}
                      >
                        {f === 'all' ? t('all') : f === 'income' ? t('plusIncome') : t('minusExpense')}
                      </button>
                    ))}
                    <button
                      onClick={() => setAddTxOpen(true)}
                      className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-white text-[10px] font-bold rounded-lg transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                      {t('add')}
                    </button>
                  </div>
                </div>

                {/* Running totals strip */}
                {filtered.length > 0 && (
                  <div className="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-2.5 bg-gray-50 border-b border-gray-100">
                    <span className="text-[9px] sm:text-[10px] font-semibold text-gray-400">{filtered.length} {t('entries')}</span>
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      <span className="text-xs font-black text-emerald-600">+{fmt(totalIncome)}</span>
                      <span className="text-[10px] text-gray-300">·</span>
                      <span className="text-xs font-black text-red-500">-{fmt(totalExpense)}</span>
                      <span className="text-[10px] text-gray-300">·</span>
                      <span className={`text-xs font-black ${totalIncome - totalExpense >= 0 ? 'text-amber-600' : 'text-red-500'}`}>
                        {t('net')} {totalIncome - totalExpense >= 0 ? '+' : ''}{fmt(totalIncome - totalExpense)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Cash vs Card breakdown */}
                {(txCardIncome > 0 || txCashIncome > 0) && (
                  <div className="flex items-center gap-3 px-5 py-2 bg-white border-b border-gray-100">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span className="text-[10px] font-bold text-emerald-700">{t('cash')}: {fmt(txCashIncome)}</span>
                    </div>
                    <span className="text-[10px] text-gray-300">·</span>
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                      <span className="text-[10px] font-bold text-blue-700">{t('cardPOS')}: {fmt(txCardIncome)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Unified Timeline ── */}
              {filtered.length === 0 ? (
                <div className="bg-white rounded-2xl py-16 text-center border border-gray-200 shadow-sm">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-5 h-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  </div>
                  <p className="text-gray-500 text-sm font-semibold">{t('noTransactionsYet')}</p>
                  <p className="text-gray-400 text-xs mt-1">{t('clickAddFirstEntry')}</p>
                </div>
              ) : (
                <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-lg bg-white">
                  <div className="divide-y divide-gray-50">
                    {filtered.map((e, idx) => (
                      <div key={e.id} className="summary-card-animate flex items-start gap-3 px-4 sm:px-5 py-3 hover:bg-amber-50/30 transition-colors group"
                        style={{ animationDelay: `${Math.min(idx, 12) * 30}ms` }}>

                        {/* Left color bar */}
                        <div className="flex flex-col items-center pt-1 shrink-0 gap-1">
                          <div className={`w-1.5 h-full rounded-full ${e.dotCls} opacity-80`} style={{ minHeight: '8px' }} />
                        </div>

                        {/* Main content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-bold text-gray-800 leading-tight">{e.label}</p>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${e.badgeCls}`}>{e.badge}</span>
                            {e.paymentMethod && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-0.5 ${e.paymentMethod === 'card' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-50 text-emerald-600'}`}>
                                {e.paymentMethod === 'card' ? (
                                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                                ) : (
                                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                )}
                                {e.paymentMethod === 'card' ? t('cardPOS') : t('cash')}
                              </span>
                            )}
                          </div>
                          {e.sub1 && <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{e.sub1}</p>}
                          {e.sub2 && <p className="text-[10px] text-gray-300 mt-0.5 leading-snug">{e.sub2}</p>}
                          {e.extra && <p className={`text-[10px] mt-0.5 font-semibold ${e.extraCls || 'text-amber-500'}`}>{e.extra}</p>}
                          {e.pct !== undefined && (
                            <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden w-28">
                              <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${e.pct}%` }} />
                            </div>
                          )}
                          <p className="text-[9px] text-gray-300 mt-0.5">{e.date ? fmtDate(e.date) : '—'}</p>
                        </div>

                        {/* Right: amount + delete */}
                        <div className="shrink-0 flex flex-col items-end gap-1 pt-0.5">
                          {e.amount > 0 && (
                            <span className={`text-xs font-black tabular-nums ${e.flow === 'income' ? 'text-emerald-600' : e.flow === 'expense' ? 'text-red-500' : 'text-gray-400'}`}>
                              {e.flow === 'income' ? '+' : e.flow === 'expense' ? '-' : ''}{fmt(e.amount)}
                            </span>
                          )}
                          {e.deleteFn && (
                            <button
                              onClick={e.deleteFn}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          );
        })()}

        {/* Delete Transaction confirm */}
        {deleteId && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
              <h3 className="text-lg font-bold text-gray-900 mb-2">{t('deleteTransaction')}</h3>
              <p className="text-sm text-gray-500 mb-6">{t('cannotBeUndone')}</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors">{t('cancel')}</button>
                <button onClick={() => { deleteTransaction(deleteId); setDeleteId(null); }} className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors">{t('delete')}</button>
              </div>
            </div>
          </div>
        )}





      {/* POS Payment Detail Popup */}
      {posPopupOpen && (() => {
        const txs = activeShop?.transactions || [];
        const repairs = activeShop?.repairs || [];
        const advances = activeShop?.advances || [];

        const cardEntries = [];
        const cashEntries = [];

        txs.filter(t => t.type === 'income').forEach(t => {
          const entry = { description: t.description || '—', amount: Number(t.amount) || 0, date: t.date || '', category: t.category || 'Transaction' };
          if (t.paymentMethod === 'card') cardEntries.push(entry); else cashEntries.push(entry);
        });
        repairs.forEach(r => {
          if (Number(r.advance) > 0) {
            const entry = { description: `${r.customerName} — ${r.device} (Advance)`, amount: Number(r.advance), date: r.createdAt?.slice(0,10) || '', category: 'Repair' };
            if (r.paymentMethod === 'card') cardEntries.push(entry); else cashEntries.push(entry);
          }
          (r.payments || []).forEach(p => {
            const entry = { description: `${r.customerName} — Payment`, amount: Number(p.amount) || 0, date: p.date || '', category: 'Repair' };
            if (p.paymentMethod === 'card') cardEntries.push(entry); else cashEntries.push(entry);
          });
          if (Number(r.repairCost) > 0 && ['ready','delivered','completed'].includes(r.status)) {
            const entry = { description: `${r.customerName} — ${r.device} (Fee)`, amount: Number(r.repairCost), date: r.createdAt?.slice(0,10) || '', category: 'Repair' };
            if (r.paymentMethod === 'card') cardEntries.push(entry); else cashEntries.push(entry);
          }
        });
        advances.forEach(a => {
          if (Number(a.advancePaid) > 0) {
            const entry = { description: `${a.customerName} — Advance`, amount: Number(a.advancePaid), date: a.date?.slice(0,10) || '', category: 'Advance' };
            if (a.paymentMethod === 'card') cardEntries.push(entry); else cashEntries.push(entry);
          }
          (a.payments || []).forEach(p => {
            const entry = { description: `${a.customerName} — Payment`, amount: Number(p.amount) || 0, date: p.date || '', category: 'Advance' };
            if (p.paymentMethod === 'card') cardEntries.push(entry); else cashEntries.push(entry);
          });
        });

        const totalCard = cardEntries.reduce((s, e) => s + e.amount, 0);
        const totalCash = cashEntries.reduce((s, e) => s + e.amount, 0);
        const totalAll = totalCard + totalCash;
        const cardPct = totalAll > 0 ? Math.round((totalCard / totalAll) * 100) : 0;

        return (
          <div className="fixed inset-0 z-9999 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPosPopupOpen(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                    <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-white">{t('posPayments')}</h2>
                    <p className="text-[10px] text-white/60">{t('cashVsCard')}</p>
                  </div>
                </div>
                <button onClick={() => setPosPopupOpen(false)} className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Summary strip */}
              <div className="grid grid-cols-3 divide-x divide-gray-100 bg-gray-50 border-b border-gray-100">
                <div className="px-4 py-3 text-center">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase">{t('cardPOS')}</p>
                  <p className="text-lg font-black text-blue-600">{fmt(totalCard)}</p>
                  <p className="text-[9px] text-blue-400">{cardEntries.length} txn · {cardPct}%</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase">{t('cash')}</p>
                  <p className="text-lg font-black text-emerald-600">{fmt(totalCash)}</p>
                  <p className="text-[9px] text-emerald-400">{cashEntries.length} txn · {totalAll > 0 ? 100 - cardPct : 0}%</p>
                </div>
                <div className="px-4 py-3 text-center">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase">{t('total')}</p>
                  <p className="text-lg font-black text-gray-800">{fmt(totalAll)}</p>
                  <p className="text-[9px] text-gray-400">{cardEntries.length + cashEntries.length} txn</p>
                </div>
              </div>

              {/* Progress bar */}
              {totalAll > 0 && (
                <div className="px-5 py-3 bg-white border-b border-gray-100">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      <span className="text-[10px] font-bold text-blue-600">{t('cardPOS')} {cardPct}%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-[10px] font-bold text-emerald-600">{t('cash')} {totalAll > 0 ? 100 - cardPct : 0}%</span>
                    </div>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden flex">
                    <div className="h-full bg-blue-500 transition-all" style={{ width: `${cardPct}%` }} />
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${totalAll > 0 ? 100 - cardPct : 0}%` }} />
                  </div>
                </div>
              )}

              {/* Card transactions list */}
              <div className="flex-1 overflow-y-auto">
                {cardEntries.length > 0 && (
                  <div className="px-5 pt-3 pb-1">
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                      Card Payments ({cardEntries.length})
                    </p>
                    {[...cardEntries].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((e, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                          <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">{e.description}</p>
                          <p className="text-[9px] text-gray-400">{e.date ? fmtDate(e.date) : '—'} · {e.category}</p>
                        </div>
                        <span className="text-xs font-black text-blue-600">+{fmt(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {cashEntries.length > 0 && (
                  <div className="px-5 pt-3 pb-1">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      Cash Payments ({cashEntries.length})
                    </p>
                    {[...cashEntries].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((e, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                          <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">{e.description}</p>
                          <p className="text-[9px] text-gray-400">{e.date ? fmtDate(e.date) : '—'} · {e.category}</p>
                        </div>
                        <span className="text-xs font-black text-emerald-600">+{fmt(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {cardEntries.length === 0 && cashEntries.length === 0 && (
                  <div className="px-5 py-10 text-center">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-gray-500">{t('noPosPayments')}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t('noPosPaymentsSub')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Income / Expense / Profit Detail Modal */}
      {txDetailModal && (() => {
        const isIncome = txDetailModal === 'income';
        const isExpense = txDetailModal === 'expense';
        const isProfit = txDetailModal === 'profit';
        const allTxs = activeShop?.transactions || [];
        const secondhand = activeShop?.secondhand || [];
        const repairs = activeShop?.repairs || [];
        const advances = activeShop?.advances || [];
        const skus = activeShop?.skus || [];

        const incomeRows = [];
        const expenseRows = [];

        // Direct transactions
        allTxs.filter(t => t.type === 'income').forEach(t => incomeRows.push({
          id: t.id, date: t.date, description: t.description || t.clientName || '—',
          amount: Number(t.amount) || 0, category: t.category || '—', source: 'Transaction', paymentMethod: t.paymentMethod || null, flow: 'income',
        }));
        allTxs.filter(t => t.type === 'expense').forEach(t => expenseRows.push({
          id: t.id, date: t.date, description: t.description || t.clientName || '—',
          amount: Number(t.amount) || 0, category: t.category || '—', source: 'Transaction', paymentMethod: t.paymentMethod || null, flow: 'expense',
        }));

        // Secondhand
        secondhand.filter(i => i.status === 'sold').forEach(i => incomeRows.push({
          id: `sh-${i.id}`, date: i.sellDate || '', description: `SH Sold: ${i.itemName}${i.brand ? ` (${i.brand})` : ''}`,
          amount: Number(i.sellPrice) || 0, category: 'Secondhand Sold', source: 'Secondhand', flow: 'income',
        }));
        secondhand.forEach(i => expenseRows.push({
          id: `sh-buy-${i.id}`, date: i.buyDate || '', description: `SH Buy: ${i.itemName}${i.brand ? ` (${i.brand})` : ''}`,
          amount: Number(i.buyPrice) || 0, category: 'Secondhand Buy', source: 'Secondhand', flow: 'expense',
        }));

        // Repairs
        repairs.forEach(r => {
          if (Number(r.advance) > 0)
            incomeRows.push({ id: `rep-adv-${r.id}`, date: (r.advanceReceivedAt || r.createdAt || '').slice(0, 10), description: `Repair Advance: ${r.customerName} — ${r.device}`, amount: Number(r.advance), category: 'Repair Advance', source: 'Repair', paymentMethod: r.paymentMethod || null, flow: 'income' });
          if (Number(r.repairCost) > 0 && ['ready', 'delivered', 'completed'].includes(r.status))
            incomeRows.push({ id: `rep-fee-${r.id}`, date: (r.feeReceivedAt || r.updatedAt || r.createdAt || '').slice(0, 10), description: `Repair Fee: ${r.customerName} — ${r.device}`, amount: Number(r.repairCost), category: 'Repair Fee', source: 'Repair', paymentMethod: r.paymentMethod || null, flow: 'income' });
          if (Number(r.partsCost) > 0)
            expenseRows.push({ id: `rep-parts-${r.id}`, date: (r.partsRecordedAt || r.createdAt || '').slice(0, 10), description: `Parts: ${r.device}${r.partsOrdered ? ` — ${r.partsOrdered}` : ''}`, amount: Number(r.partsCost), category: 'Repair Parts', source: 'Repair', flow: 'expense' });
        });

        // Advances
        advances.forEach(a => {
          if (Number(a.advancePaid) > 0)
            incomeRows.push({ id: `adv-${a.id}`, date: (a.date || '').slice(0, 10), description: `Advance Received: ${a.customerName}${a.description ? ` — ${a.description}` : ''}`, amount: Number(a.advancePaid), category: 'Advance', source: 'Advance', paymentMethod: a.paymentMethod || null, flow: 'income' });
          (a.payments || []).forEach(p => incomeRows.push({ id: `adv-pay-${p.id}`, date: (p.date || '').slice(0, 10), description: `Payment from ${a.customerName}`, amount: Number(p.amount) || 0, category: 'Advance Payment', source: 'Advance', paymentMethod: p.paymentMethod || null, flow: 'income' }));
          if (Number(a.productCost) > 0)
            expenseRows.push({ id: `adv-cost-${a.id}`, date: (a.date || '').slice(0, 10), description: `Product Cost: ${a.customerName}`, amount: Number(a.productCost), category: 'Advance Cost', source: 'Advance', flow: 'expense' });
        });

        // Inventory
        skus.forEach(sk => (sk.movements || []).forEach(m => {
          const isIn = m.type === 'in';
          const price = Number(m.price) || (isIn ? Number(sk.buyPrice) : Number(sk.sellPrice)) || 0;
          const amt = price * (Number(m.qty) || 1);
          if (amt > 0) {
            const entry = { id: `inv-${m.id}`, date: (m.date || '').slice(0, 10), description: `${isIn ? 'Stock In' : 'Stock Sold'}: ${sk.name} ×${m.qty}`, amount: amt, category: isIn ? 'Stock Purchase' : 'Stock Sale', source: 'Inventory', flow: isIn ? 'expense' : 'income' };
            if (isIn) expenseRows.push(entry); else incomeRows.push(entry);
          }
        }));

        const rows = isIncome ? incomeRows : isExpense ? expenseRows : [...incomeRows.map(r => ({ ...r })), ...expenseRows.map(r => ({ ...r }))];
        rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        const totalInc = incomeRows.reduce((s, r) => s + r.amount, 0);
        const totalExp = expenseRows.reduce((s, r) => s + r.amount, 0);
        const total = isIncome ? totalInc : isExpense ? totalExp : totalInc - totalExp;

        const relevantRows = isProfit ? rows : rows;
        const cardTotal = relevantRows.filter(r => r.paymentMethod === 'card').reduce((s, r) => s + r.amount, 0);
        const cashTotal = relevantRows.filter(r => r.paymentMethod !== 'card').reduce((s, r) => s + r.amount, 0);
        const cardCount = relevantRows.filter(r => r.paymentMethod === 'card').length;
        const cashCount = relevantRows.length - cardCount;
        const sumForPct = cardTotal + cashTotal;
        const cardPctDetail = sumForPct > 0 ? Math.round((cardTotal / sumForPct) * 100) : 0;

        const grad = isIncome
          ? 'linear-gradient(135deg, #34d399 0%, #10b981 60%, #059669 100%)'
          : isExpense
            ? 'linear-gradient(135deg, #f87171 0%, #ef4444 60%, #dc2626 100%)'
            : total >= 0
              ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 60%, #d97706 100%)'
              : 'linear-gradient(135deg, #f87171 0%, #ef4444 60%, #dc2626 100%)';
        const modalTitle = isIncome ? 'Income — Full Detail' : isExpense ? 'Expenses — Full Detail' : 'Net Profit — Full Detail';

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">

              {/* Header */}
              <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ background: grad }}>
                <div>
                  <h2 className="text-lg font-black text-white">{modalTitle}</h2>
                  <p className="text-white/70 text-xs mt-0.5">{rows.length} records · {isProfit ? `Income: ${fmt(totalInc)} · Expenses: ${fmt(totalExp)} · Net: ${fmt(total)}` : `Total: ${fmt(total)}`}</p>
                </div>
                <button onClick={() => setTxDetailModal(null)} className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Profit Summary Strip */}
              {isProfit && (
                <div className="shrink-0 border-b border-gray-100">
                  <div className="grid grid-cols-3 divide-x divide-gray-100 bg-gray-50">
                    <div className="px-4 py-2.5 text-center">
                      <p className="text-[9px] text-gray-400 font-semibold uppercase">{t('income')}</p>
                      <p className="text-sm font-black text-emerald-600">{fmt(totalInc)}</p>
                      <p className="text-[8px] text-emerald-400">{incomeRows.length} txn</p>
                    </div>
                    <div className="px-4 py-2.5 text-center">
                      <p className="text-[9px] text-gray-400 font-semibold uppercase">{t('expenses')}</p>
                      <p className="text-sm font-black text-red-500">{fmt(totalExp)}</p>
                      <p className="text-[8px] text-red-400">{expenseRows.length} txn</p>
                    </div>
                    <div className="px-4 py-2.5 text-center">
                      <p className="text-[9px] text-gray-400 font-semibold uppercase">{t('netProfit')}</p>
                      <p className={`text-sm font-black ${total >= 0 ? 'text-amber-500' : 'text-red-500'}`}>{fmt(total)}</p>
                      <p className="text-[8px] text-gray-400">{rows.length} txn</p>
                    </div>
                  </div>
                  <div className="px-5 py-2 flex items-center gap-3">
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[9px] font-bold text-emerald-600">{t('income')} {totalInc + totalExp > 0 ? Math.round((totalInc / (totalInc + totalExp)) * 100) : 0}%</span></div>
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /><span className="text-[9px] font-bold text-red-500">{t('expenses')} {totalInc + totalExp > 0 ? Math.round((totalExp / (totalInc + totalExp)) * 100) : 0}%</span></div>
                  </div>
                  <div className="px-5 pb-2.5">
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden flex">
                      <div className="h-full bg-emerald-500 transition-all" style={{ width: `${totalInc + totalExp > 0 ? Math.round((totalInc / (totalInc + totalExp)) * 100) : 0}%` }} />
                      <div className="h-full bg-red-400 transition-all" style={{ width: `${totalInc + totalExp > 0 ? Math.round((totalExp / (totalInc + totalExp)) * 100) : 0}%` }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Card vs Cash Breakdown */}
              {!isProfit && total > 0 && (
                <div className="shrink-0 border-b border-gray-100">
                  <div className="grid grid-cols-3 divide-x divide-gray-100 bg-gray-50">
                    <div className="px-4 py-2.5 text-center">
                      <p className="text-[9px] text-gray-400 font-semibold uppercase">CARD / POS</p>
                      <p className="text-sm font-black text-blue-600">{fmt(cardTotal)}</p>
                      <p className="text-[8px] text-blue-400">{cardCount} txn · {cardPctDetail}%</p>
                    </div>
                    <div className="px-4 py-2.5 text-center">
                      <p className="text-[9px] text-gray-400 font-semibold uppercase">{t('cash')}</p>
                      <p className="text-sm font-black text-emerald-600">{fmt(cashTotal)}</p>
                      <p className="text-[8px] text-emerald-400">{cashCount} txn · {total > 0 ? 100 - cardPctDetail : 0}%</p>
                    </div>
                    <div className="px-4 py-2.5 text-center">
                      <p className="text-[9px] text-gray-400 font-semibold uppercase">{t('total')}</p>
                      <p className="text-sm font-black text-gray-800">{fmt(total)}</p>
                      <p className="text-[8px] text-gray-400">{rows.length} txn</p>
                    </div>
                  </div>
                  <div className="px-5 py-2 flex items-center gap-3">
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-[9px] font-bold text-blue-600">{t('cardPOS')} {cardPctDetail}%</span></div>
                    <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[9px] font-bold text-emerald-600">{t('cash')} {total > 0 ? 100 - cardPctDetail : 0}%</span></div>
                  </div>
                  <div className="px-5 pb-2.5">
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden flex">
                      <div className="h-full bg-blue-500 transition-all" style={{ width: `${cardPctDetail}%` }} />
                      <div className="h-full bg-emerald-500 transition-all" style={{ width: `${total > 0 ? 100 - cardPctDetail : 0}%` }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Source filter badges */}
              {/* List */}
              <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
                {rows.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 text-sm">No {txDetailModal} records yet.</div>
                ) : rows.map(row => {
                  const rowIsIncome = isProfit ? row.flow === 'income' : isIncome;
                  return (
                  <div key={row.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 hover:bg-gray-100 transition-colors">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${rowIsIncome ? 'bg-emerald-100' : 'bg-red-100'}`}>
                      <svg className={`w-4 h-4 ${rowIsIncome ? 'text-emerald-600' : 'text-red-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {rowIsIncome
                          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                          : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />}
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{row.description}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-gray-400">{row.date ? fmtDate(row.date) : '—'}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white border border-gray-200 text-gray-500 font-medium">{row.source}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white border border-gray-200 text-gray-500">{row.category}</span>
                        {row.paymentMethod && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${row.paymentMethod === 'card' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-50 text-emerald-600'}`}>
                            {row.paymentMethod === 'card' ? '💳 Card' : '💵 Cash'}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className={`text-sm font-black shrink-0 ${rowIsIncome ? 'text-emerald-600' : 'text-red-500'}`}>{rowIsIncome ? '+' : '-'}{fmt(row.amount)}</p>
                  </div>
                  );
                })}
              </div>

              {/* Footer total */}
              <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between shrink-0 bg-gray-50">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{isProfit ? `Net Profit` : `Total ${isIncome ? 'Income' : 'Expenses'}`}</span>
                <span className={`text-lg font-black ${isProfit ? (total >= 0 ? 'text-amber-500' : 'text-red-500') : isIncome ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(total)}</span>
              </div>
            </div>
          </div>
        );
      })()}

          </>
        );}
