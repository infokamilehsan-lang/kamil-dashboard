import { useState, useMemo, useEffect, useRef } from 'react';
import { useShop } from '../context/ShopContext';
import { useLanguage } from '../context/LanguageContext';
import { SHOP_TYPES, CATEGORY_COLORS, CATEGORY_BADGE, CURRENCIES } from '../data/initialData';
import AddTransactionModal from './AddTransactionModal';
import PayMemberModal from './PayMemberModal';
import BarcodeScanner from './BarcodeScanner';
import DatePicker from './DatePicker';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sendClientEmail, getEmailLog, clearEmailLog } from '../lib/emailService';

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
  // If original value is formatted string (e.g. "€1,250"), show animated number with same prefix/suffix
  const prefix = raw ? raw.replace(/[\d,. ]+.*$/, '') : '';
  const formatted = display >= 1000
    ? prefix + (display / 1000).toFixed(1) + 'k'
    : prefix + (isFloat ? display.toFixed(2) : Math.round(display).toString());

  return <span className={`animate-flash-value tabular-nums ${className}`}>{formatted}</span>;
}

/* Mini animated SVG sparkline */
function MiniSparkline({ values = [], color = '#34d399', delay = 0, colorClass = '' }) {
  const W = 160, H = 40, PAD = 4;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => {
    const x = PAD + (i / (values.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v / max) * (H - PAD * 2));
    return [x, y];
  });
  // smooth bezier path
  const path = pts.reduce((acc, [x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px, py] = pts[i - 1];
    const cx = (px + x) / 2;
    return `${acc} C${cx},${py} ${cx},${y} ${x},${y}`;
  }, '');
  const areaPath = `${path} L${pts[pts.length-1][0]},${H} L${pts[0][0]},${H} Z`;
  const id = `spark-${color.replace(/[^a-z0-9]/gi,'')}-${delay}`;
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="spark-svg" style={{ animationDelay: `${delay}ms` }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <path d={areaPath} fill={`url(#${id})`} />
      {/* Line */}
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="spark-line" style={{ '--spark-delay': `${delay}ms` }} />
      {/* Last dot pulse */}
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="3" fill={color} className="spark-dot" style={{ animationDelay: `${delay + 500}ms` }} />
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="5" fill={color} opacity="0.25" className="spark-pulse" style={{ animationDelay: `${delay + 500}ms` }} />
    </svg>
  );
}

export default function Dashboard({ searchOpen, setSearchOpen, searchQuery, setSearchQuery }) {
  const { activeShop, addTeamMember, updateTeamMember, deleteTeamMember, addTransactionForShop,
    addRepair, updateRepair, deleteRepair, addRepairOrder, updateRepairOrder, deleteRepairOrder, addAdvance, updateAdvance, deleteAdvance,
    addSku, updateSku, deleteSku, addSkuMovement,
    addSecondhand, updateSecondhand, deleteSecondhand,
    addNote, updateNote, deleteNote } = useShop();
  const [page, setPageState] = useState(() => {
    const shopId = activeShop?.id;
    if (shopId) {
      return localStorage.getItem(`dashboard_page_${shopId}`) || localStorage.getItem('dashboard_page') || 'overview';
    }
    return localStorage.getItem('dashboard_page') || 'overview';
  });
  const setPage = (p) => {
    const shopId = activeShop?.id;
    if (shopId) localStorage.setItem(`dashboard_page_${shopId}`, p);
    localStorage.setItem('dashboard_page', p);
    setPageState(p);
  };

  // When shop changes, restore that shop's last page (or stay on current if valid)
  const prevShopIdRef = useRef(activeShop?.id);
  useEffect(() => {
    if (!activeShop?.id || activeShop.id === prevShopIdRef.current) return;
    prevShopIdRef.current = activeShop.id;
    const savedPage = localStorage.getItem(`dashboard_page_${activeShop.id}`);
    if (savedPage) {
      // Verify the saved page is available for this shop
      const alwaysAvailable = ['overview', 'emails', 'whatsapp'];
      const isValid = alwaysAvailable.includes(savedPage) || !activeShop.services || activeShop.services.includes(savedPage);
      setPageState(isValid ? savedPage : 'overview');
      localStorage.setItem('dashboard_page', isValid ? savedPage : 'overview');
    }
    // If no saved page for this shop, keep current page (don't reset)
  }, [activeShop?.id, activeShop?.services]);

  const [manualEmailForm, setManualEmailForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [manualEmailSending, setManualEmailSending] = useState(false);
  const [manualEmailResult, setManualEmailResult] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [contactsRefresh, setContactsRefresh] = useState(0);
  const [contactSearch, setContactSearch] = useState('');
  // Broadcast
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({ subject: '', message: '' });
  const [broadcastLang, setBroadcastLang] = useState('it');
  const [broadcastSelected, setBroadcastSelected] = useState(new Set());
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState(null); // { sent, failed, total }

  // WhatsApp Box
  const [waOpen, setWaOpen] = useState(false);
  const [waForm, setWaForm] = useState({ message: '' });
  const [waLang, setWaLang] = useState('it');
  const [waSelected, setWaSelected] = useState(new Set());
  const [waComposeOpen, setWaComposeOpen] = useState(false);
  const [waComposeForm, setWaComposeForm] = useState({ name: '', phone: '', message: '' });
  const [waSearch, setWaSearch] = useState('');
  const [waLinks, setWaLinks] = useState([]);
  const [waSending, setWaSending] = useState(false);
  const [waSentCount, setWaSentCount] = useState(0);

  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '' });
  const [contactFormOpen, setContactFormOpen] = useState(false);
  const [emailCfgOpen, setEmailCfgOpen] = useState(false);
  const [emailCfgForm, setEmailCfgForm] = useState({ serviceId: '', templateId: '', publicKey: '', ownerEmail: 'infokamilstoreitalia@gmail.com' });
  const [emailCfgSaved, setEmailCfgSaved] = useState(false);
  const [addTxOpen, setAddTxOpen] = useState(false);
  const [txDetailModal, setTxDetailModal] = useState(null); // null | 'income' | 'expense'
  const [summaryDate, setSummaryDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const summaryDateRef = useRef(null);
  const summaryMonthRef = useRef(null);
  const [summaryMode, setSummaryMode] = useState('daily'); // 'daily' | 'monthly' | 'alltime'
  const [summaryMonth, setSummaryMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filter, setFilter] = useState('all');
  const [deleteId, setDeleteId] = useState(null);
  const [payMember, setPayMember] = useState(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', role: 'Tecnico', salary: '', phone: '', email: '', bankName: '', iban: '', accountNo: '', accountHolder: '' });
  const [newMemberError, setNewMemberError] = useState('');
  const [editMemberId, setEditMemberId] = useState(null);
  const [editMemberForm, setEditMemberForm] = useState({});
  const { deleteTransaction, contacts, addOrUpdateContact, removeContact, emailSettings, updateEmailSettings } = useShop();
  const { t, locale } = useLanguage();

  // Sync emailCfgForm from Firestore emailSettings
  useEffect(() => {
    if (emailSettings) {
      setEmailCfgForm({
        serviceId: emailSettings.serviceId || '',
        templateId: emailSettings.templateId || '',
        publicKey: emailSettings.publicKey || '',
        ownerEmail: emailSettings.ownerEmail || 'infokamilstoreitalia@gmail.com'
      });
    }
  }, [emailSettings]);

  const TEAM_ROLES = [t('role_Manager'), t('role_Technician'), t('role_Cashier'), t('role_Salesperson'), t('role_Barber'), t('role_Chef'), t('role_Waiter'), t('role_SecurityGuard'), t('role_Helper'), t('role_Accountant'), t('role_Receptionist'), t('role_Engineer'), t('role_Other')];

  // Repairs state
  const [repairFilter, setRepairFilter] = useState('all');
  const [addRepairOpen, setAddRepairOpen] = useState(false);
  const [repairForm, setRepairForm] = useState({ customerName: '', phone: '', device: '', issue: '', partsOrdered: '', partsCost: '', repairCost: '', advance: '', notes: '', email: '' });
  const [repairFormError, setRepairFormError] = useState('');
  const [repairDeleteId, setRepairDeleteId] = useState(null);
  // Repair payment system
  const [repairPayOpenId, setRepairPayOpenId] = useState(null);
  const [repairPayAmt, setRepairPayAmt] = useState('');
  const [repairPayNote, setRepairPayNote] = useState('');
  const [repairPayError, setRepairPayError] = useState('');
  // Order system per repair
  const [orderOpenId, setOrderOpenId] = useState(null); // repairId whose order form is open
  const [orderForm, setOrderForm] = useState({ item: '', cost: '', supplier: '' });
  const [orderFormError, setOrderFormError] = useState('');

  // Advances state
  const [addAdvanceOpen, setAddAdvanceOpen] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({ customerName: '', phone: '', description: '', totalAmount: '', advancePaid: '', productCost: '', email: '' });
  const [advanceFormError, setAdvanceFormError] = useState('');
  const [advancePayOpen, setAdvancePayOpen] = useState(null);
  const [advancePayAmt, setAdvancePayAmt] = useState('');
  const [advanceCostOpen, setAdvanceCostOpen] = useState(null);
  const [advanceCostAmt, setAdvanceCostAmt] = useState('');
  const [advanceDeleteId, setAdvanceDeleteId] = useState(null);

  // Reports state
  const [reportView, setReportView] = useState('daily');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));

  // SKU / Inventory state
  const [skuSearch, setSkuSearch] = useState('');
  const [skuCatFilter, setSkuCatFilter] = useState('all');
  const [addSkuOpen, setAddSkuOpen] = useState(false);
  const [skuForm, setSkuForm] = useState({ name: '', category: 'Ricambi', description: '', buyPrice: '', sellPrice: '', stock: '', lowStockAt: '5', barcode: '' });
  const [skuFormError, setSkuFormError] = useState('');
  const [skuScanning, setSkuScanning] = useState(false);
  const [scanQueue, setScanQueue] = useState([]);
  const [bulkScanMode, setBulkScanMode] = useState(false);
  const [skuDeleteId, setSkuDeleteId] = useState(null);
  const [skuMoveOpen, setSkuMoveOpen] = useState(null); // skuId
  const [skuMoveForm, setSkuMoveForm] = useState({ type: 'in', qty: '', note: '', price: '' });
  const [skuHistoryId, setSkuHistoryId] = useState(null); // skuId whose history is expanded
  const [skuEditId, setSkuEditId] = useState(null);
  const [skuEditForm, setSkuEditForm] = useState({});

  // Secondhand state
  const [shFilter, setShFilter] = useState('all');

  // Quick Notes state
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteEditId, setNoteEditId] = useState(null); // null = adding new, string = editing
  const [noteForm, setNoteForm] = useState({ name: '', details: '', totalAmount: '', paidAmount: '', appointmentDate: '', appointmentTime: '', phone: '', email: '' });
  const [noteFormError, setNoteFormError] = useState('');
  const [noteDeleteId, setNoteDeleteId] = useState(null);
  const [addShOpen, setAddShOpen] = useState(false);
  const [shForm, setShForm] = useState({ itemName: '', brand: '', model: '', imei: '', condition: 'Buono', buyPrice: '', sellerName: '', sellerPhone: '', sellerEmail: '', notes: '' });
  const [shFormError, setShFormError] = useState('');
  const [shDeleteId, setShDeleteId] = useState(null);
  const [shSellOpen, setShSellOpen] = useState(null);
  const [shSellForm, setShSellForm] = useState({ sellPrice: '', buyerName: '', buyerPhone: '', buyerEmail: '' });
  const [shEditId, setShEditId] = useState(null);
  const [shEditForm, setShEditForm] = useState({});

  // Global search state is managed by App.jsx and passed as props

  const shopType = SHOP_TYPES.find((t) => t.value === activeShop?.type);
  const hasService = (serviceId) => !activeShop?.services || activeShop.services.includes(serviceId);
  const gradient = CATEGORY_COLORS[activeShop?.type] || 'from-amber-500 to-purple-700';
  const badge = CATEGORY_BADGE[activeShop?.type] || 'bg-slate-100 text-slate-700';
  const currencyObj = CURRENCIES.find((c) => c.code === activeShop?.currency) || CURRENCIES[0];

  // WhatsApp Send All — step-by-step wizard (no auto-navigate, user taps each)

  const { revenue, expenses, profit, txCount } = useMemo(() => {
    const txs = activeShop?.transactions || [];
    const sh = activeShop?.secondhand || [];
    const repairs = activeShop?.repairs || [];
    const advances = activeShop?.advances || [];
    const skus = activeShop?.skus || [];

    const txIncome = txs.filter((t) => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const txExpense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);

    // Secondhand
    const shIncome = sh.filter((i) => i.status === 'sold').reduce((s, i) => s + (Number(i.sellPrice) || 0), 0);
    const shExpense = sh.reduce((s, i) => s + (Number(i.buyPrice) || 0), 0);

    // Repairs: parts cost = expense; advance + repair fee (when done) = income
    const repExpense = repairs.reduce((s, r) => s + (Number(r.partsCost) || 0), 0);
    const repIncome = repairs.reduce((s, r) => {
      let inc = Number(r.advance) || 0;
      if (['ready', 'delivered', 'completed'].includes(r.status)) inc += Number(r.repairCost) || 0;
      return s + inc;
    }, 0);

    // Advances: advancePaid received from client = income; additional payments = also income; productCost = expense
    const advExpense = advances.reduce((s, a) => s + (Number(a.productCost) || 0), 0);
    const advIncome = advances.reduce((s, a) => s + (Number(a.advancePaid) || 0), 0)
      + advances.flatMap((a) => (a.payments || []).map((p) => Number(p.amount) || 0)).reduce((s, v) => s + v, 0);

    // Inventory movements: stock-in with price = expense; stock-out with price = income
    const invExpense = skus.flatMap((sk) =>
      (sk.movements || []).filter((m) => m.type === 'in').map((m) => {
        const unitPrice = Number(m.price) || Number(sk.buyPrice) || 0;
        return unitPrice * (Number(m.qty) || 1);
      })
    ).reduce((s, v) => s + v, 0);
    const invIncome = skus.flatMap((sk) =>
      (sk.movements || []).filter((m) => m.type === 'out').map((m) => {
        const unitPrice = Number(m.price) || Number(sk.sellPrice) || 0;
        return unitPrice * (Number(m.qty) || 1);
      })
    ).reduce((s, v) => s + v, 0);

    const revenue = txIncome + shIncome + repIncome + advIncome;
    const expenses = txExpense + shExpense + repExpense + advExpense;
    return { revenue, expenses, profit: revenue - expenses, txCount: txs.length };
  }, [activeShop]);

  const filteredTx = useMemo(() => {
    const txs = activeShop?.transactions || [];
    const secondhand = activeShop?.secondhand || [];
    const repairs = activeShop?.repairs || [];
    const advances = activeShop?.advances || [];
    const skus = activeShop?.skus || [];

    // ── Secondhand rows ──
    const shBuyRows = secondhand.map((i) => ({
      id: `sh-buy-${i.id}`, _source: 'secondhand', _shItem: i,
      type: 'expense', amount: Number(i.buyPrice) || 0,
      date: i.buyDate || '',
      description: `SH Buy: ${i.itemName}${i.brand ? ` (${i.brand})` : ''}`,
      category: 'Secondhand Buy',
    }));
    const shSellRows = secondhand.filter((i) => i.status === 'sold').map((i) => ({
      id: `sh-sell-${i.id}`, _source: 'secondhand', _shItem: i,
      type: 'income', amount: Number(i.sellPrice) || 0,
      date: i.sellDate || '',
      description: `SH Sold: ${i.itemName}${i.brand ? ` (${i.brand})` : ''}`,
      category: 'Secondhand Sold',
    }));

    // ── Repair rows ──
    const repairRows = repairs.flatMap((r) => {
      const rows = [];
      if (Number(r.partsCost) > 0)
        rows.push({
          id: `rep-parts-${r.id}`, _source: 'repair', _repairItem: r,
          type: 'expense', amount: Number(r.partsCost),
          date: (r.partsRecordedAt || r.createdAt || '').slice(0, 10),
          description: `Parts: ${r.device}${r.partsOrdered ? ` — ${r.partsOrdered}` : ''}`,
          category: 'Repair Parts'
        });
      if (Number(r.advance) > 0)
        rows.push({
          id: `rep-adv-${r.id}`, _source: 'repair', _repairItem: r,
          type: 'income', amount: Number(r.advance),
          date: (r.advanceReceivedAt || r.createdAt || '').slice(0, 10),
          description: `Repair Advance: ${r.customerName} — ${r.device}`,
          category: 'Repair Advance'
        });
      if (Number(r.repairCost) > 0 && ['ready', 'delivered', 'completed'].includes(r.status))
        rows.push({
          id: `rep-fee-${r.id}`, _source: 'repair', _repairItem: r,
          type: 'income', amount: Number(r.repairCost),
          date: (r.feeReceivedAt || r.updatedAt || r.createdAt || '').slice(0, 10),
          description: `Repair Fee: ${r.customerName} — ${r.device}`,
          category: 'Repair Fee'
        });
      return rows;
    });

    // ── Advance rows ──
    const advanceRows = advances.flatMap((a) => {
      const rows = [];
      if (Number(a.advancePaid) > 0)
        rows.push({
          id: `adv-given-${a.id}`, _source: 'advance', _advItem: a,
          type: 'expense', amount: Number(a.advancePaid),
          date: (a.date || '').slice(0, 10),
          description: `Advance Given: ${a.customerName}${a.description ? ` — ${a.description}` : ''}`,
          category: 'Advance Given'
        });
      (a.payments || []).forEach((p) =>
        rows.push({
          id: `adv-pay-${a.id}-${p.id}`, _source: 'advance', _advItem: a,
          type: 'income', amount: Number(p.amount) || 0,
          date: (p.date || '').slice(0, 10),
          description: `Advance Received: ${a.customerName}`,
          category: 'Advance Received'
        })
      );
      return rows;
    });

    // ── Inventory movement rows ──
    const inventoryRows = skus.flatMap((sku) =>
      (sku.movements || []).map((m) => {
        const unitPrice = Number(m.price) || (m.type === 'in' ? (Number(sku.buyPrice) || 0) : (Number(sku.sellPrice) || 0));
        return ({
          id: `inv-${sku.id}-${m.id}`, _source: 'inventory', _skuItem: sku, _movement: m,
          type: m.type === 'in' ? 'expense' : 'income',
          amount: unitPrice * (Number(m.qty) || 1),
          date: (m.date || '').slice(0, 10),
          description: m.type === 'in'
            ? `Stock In: ${sku.name} ×${m.qty}${m.note ? ` (${m.note})` : ''}`
            : `Stock Sold: ${sku.name} ×${m.qty}${m.note ? ` (${m.note})` : ''}`,
          category: m.type === 'in' ? 'Stock Purchase' : 'Stock Sale',
        });
      }).filter((row) => row.amount > 0)
    );

    const all = [...txs, ...shBuyRows, ...shSellRows, ...repairRows, ...advanceRows, ...inventoryRows]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    if (filter === 'income') return all.filter((t) => t.type === 'income');
    if (filter === 'expense') return all.filter((t) => t.type === 'expense');
    return all;
  }, [activeShop, filter]);

  const fmt = (n) =>
    `${n < 0 ? '-' : ''}${currencyObj.symbol}${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.abs(n))}`;

  const fmtDate = (d) =>
    new Date(d).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });

  const handleAddMember = () => {
    if (!newMember.name.trim()) { setNewMemberError(t('nameRequired')); return; }
    addTeamMember({
      name: newMember.name.trim(),
      role: newMember.role,
      salary: newMember.salary ? Number(newMember.salary) : 0,
      phone: newMember.phone.trim(),
      email: newMember.email.trim(),
      bankName: newMember.bankName.trim(),
      iban: newMember.iban.trim(),
      accountNo: newMember.accountNo.trim(),
      accountHolder: newMember.accountHolder.trim(),
    });
    if (newMember.phone.trim() || newMember.email.trim()) {
      addOrUpdateContact({
        name: newMember.name.trim(),
        email: newMember.email.trim(),
        phone: newMember.phone.trim(),
      });
    }
    setNewMember({ name: '', role: 'Tecnico', salary: '', phone: '', email: '', bankName: '', iban: '', accountNo: '', accountHolder: '' });
    setAddMemberOpen(false);
    setNewMemberError('');
  };

  const handleAddRepair = () => {
    if (!repairForm.customerName.trim()) { setRepairFormError(t('customerNameRequired')); return; }
    if (!repairForm.device.trim()) { setRepairFormError(t('deviceRequired')); return; }
    addRepair({
      customerName: repairForm.customerName.trim(),
      phone: repairForm.phone.trim(),
      device: repairForm.device.trim(),
      issue: repairForm.issue.trim(),
      partsOrdered: repairForm.partsOrdered.trim(),
      partsCost: repairForm.partsCost ? Number(repairForm.partsCost) : 0,
      repairCost: repairForm.repairCost ? Number(repairForm.repairCost) : 0,
      advance: repairForm.advance ? Number(repairForm.advance) : 0,
      notes: repairForm.notes.trim(),
      email: repairForm.email.trim(),
    });
    if (repairForm.phone.trim() || repairForm.email.trim()) {
      addOrUpdateContact({
        name: repairForm.customerName.trim(),
        email: repairForm.email.trim(),
        phone: repairForm.phone.trim(),
      });
    }
    setRepairForm({ customerName: '', phone: '', device: '', issue: '', partsOrdered: '', partsCost: '', repairCost: '', advance: '', notes: '', email: '' });
    setAddRepairOpen(false);
    setRepairFormError('');
  };

  const handleAddAdvance = () => {
    if (!advanceForm.customerName.trim()) { setAdvanceFormError(t('customerNameRequired')); return; }
    if (!advanceForm.totalAmount) { setAdvanceFormError(t('totalAmountRequired')); return; }
    const total = Number(advanceForm.totalAmount);
    const paid = Number(advanceForm.advancePaid) || 0;
    addAdvance({
      customerName: advanceForm.customerName.trim(),
      phone: advanceForm.phone.trim(),
      description: advanceForm.description.trim(),
      totalAmount: total,
      advancePaid: paid,
      productCost: Number(advanceForm.productCost) || 0,
      remaining: total - paid,
      status: paid >= total ? 'cleared' : paid > 0 ? 'partial' : 'pending',
      email: advanceForm.email.trim(),
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
      });
    }
    setAdvanceForm({ customerName: '', phone: '', description: '', totalAmount: '', advancePaid: '', productCost: '', email: '' });
    setAddAdvanceOpen(false);
    setAdvanceFormError('');
  };

  const handleAdvancePay = (adv) => {
    const extra = Number(advancePayAmt);
    if (!extra || extra <= 0) return;
    const newPaid = (adv.advancePaid || 0) + extra;
    const newRemaining = Math.max(0, (adv.totalAmount || 0) - newPaid);
    const newStatus = newRemaining <= 0 ? 'cleared' : 'partial';
    const payment = { id: `p-${Date.now()}`, amount: extra, date: new Date().toISOString().split('T')[0] };
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
      });
    }
    setAdvancePayAmt('');
    setAdvancePayOpen(null);
  };

  const handleAdvanceCost = (adv) => {
    const cost = Number(advanceCostAmt);
    if (!advanceCostAmt || cost < 0) return;
    updateAdvance(activeShop.id, adv.id, { productCost: cost });
    setAdvanceCostAmt('');
    setAdvanceCostOpen(null);
  };

  if (!activeShop) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <h3 className="text-xl font-bold text-gray-800 mb-2">{t('noShopSelected')}</h3>
        <p className="text-gray-500 text-sm">{t('useShopManagementHint')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* Shop Hero Banner */}
      <div className="rounded-3xl overflow-hidden shadow-xl" style={{ backgroundColor: '#7f4f24' }}>
        {/* Top section — shop info + add button */}
        <div className="px-5 sm:px-7 pt-5 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Shop avatar */}
            {activeShop.image ? (
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl overflow-hidden ring-2 ring-white/20 shadow-lg shrink-0">
                <img src={activeShop.image} alt={activeShop.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white/10 ring-2 ring-white/15 flex items-center justify-center shrink-0">
                <span className="text-xl font-bold text-white/80">{activeShop.name?.charAt(0)?.toUpperCase()}</span>
              </div>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">{activeShop.name}</h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-white/80 text-[11px] font-medium">{t(shopType?.labelKey)}</span>
                {activeShop.city && (
                  <span className="flex items-center gap-1 text-white/60 text-xs">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    {activeShop.city}
                  </span>
                )}
                {activeShop.phone && (
                  <span className="flex items-center gap-1 text-white/60 text-xs">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    {activeShop.phone}
                  </span>
                )}
                <span className="text-white/40 text-[10px]">{t('since')} {fmtDate(activeShop.createdAt)}</span>
              </div>
              {activeShop.description && (
                <p className="text-white/50 text-xs mt-1 max-w-lg line-clamp-1">{activeShop.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => { setNoteEditId(null); setNoteForm({ name: '', details: '', totalAmount: '', paidAmount: '', appointmentDate: '', appointmentTime: '', phone: '', email: '' }); setNoteFormError(''); setNoteOpen(true); }}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-xl transition-all text-xs sm:text-sm shadow-lg shadow-amber-500/25 shrink-0"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Quick Note
            </button>
            <button
              onClick={() => setAddTxOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-xl transition-all text-xs sm:text-sm shadow-lg shadow-amber-500/25 shrink-0"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              {t('addTransaction')}
            </button>
          </div>
        </div>

        {/* Bottom section — tabs */}
        <div className="px-5 sm:px-7 pb-3 overflow-x-auto">
          <div className="flex gap-2.5">
            {[
              { id: 'overview', label: t('tab_overview'), icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
              { id: 'inventory', label: t('tab_inventory'), icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg> },
              { id: 'repairs', label: t('tab_repairs'), icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
              { id: 'advances', label: t('tab_advances'), icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
              { id: 'reports', label: t('tab_reports'), icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
              { id: 'team', label: t('tab_team'), icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
              { id: 'secondhand', label: t('tab_secondhand'), icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> },
              { id: 'notes', label: 'Quick Notes', icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
              { id: 'emails', label: 'Email Box', icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> },
              { id: 'whatsapp', label: 'WhatsApp', icon: <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg> },
            ].filter((tab) => tab.id === 'overview' || tab.id === 'emails' || tab.id === 'whatsapp' || !activeShop.services || activeShop.services.includes(tab.id))
              .map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setPage(tab.id)}
                  style={{
                    transition: 'transform 0.15s cubic-bezier(.4,0,.2,1), box-shadow 0.15s',
                    transform: page === tab.id ? 'scale(1.05)' : 'scale(1)',
                  }}
                  onMouseEnter={e => { if (page !== tab.id) e.currentTarget.style.transform = 'scale(1.05)'; }}
                  onMouseLeave={e => { if (page !== tab.id) e.currentTarget.style.transform = 'scale(1)'; }}
                  onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.95)'; }}
                  onMouseUp={e => { e.currentTarget.style.transform = page === tab.id ? 'scale(1.05)' : 'scale(1.05)'; }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${page === tab.id
                      ? 'bg-amber-500 text-white shadow-md shadow-amber-400/40 scale-105'
                      : 'bg-white text-[#582F0E] shadow-sm hover:shadow-md hover:scale-105'
                    }`}
                >
                  <span style={{ display: 'inline-flex' }}>
                    {tab.icon}
                  </span>
                  {tab.label}
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* ── OVERVIEW PAGE ── */}
      {page === 'overview' && (<>

        {/* ── SUMMARY ── */}
        {(() => {
          const d0 = new Date();
          const realToday = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${String(d0.getDate()).padStart(2, '0')}`;
          const today = summaryDate;
          // match helper
          const matchDate = (dateStr) => {
            if (!dateStr) return false;
            const s = (dateStr || '').slice(0, 10);
            if (summaryMode === 'daily')   return s === summaryDate;
            if (summaryMode === 'monthly') return s.slice(0, 7) === summaryMonth;
            return true; // alltime
          };
          const isToday = summaryMode === 'daily' && summaryDate === realToday;
          const txs = activeShop.transactions || [];
          const repairs = activeShop.repairs || [];
          const advances = activeShop.advances || [];
          const secondhand = activeShop.secondhand || [];
          const skus = activeShop.skus || [];

          // helper
          const d = (v) => (v || '').slice(0, 10);

          // ── Filtered figures (daily / monthly / alltime via matchDate) ──
          const todayTxIncome = txs.filter((t) => matchDate(t.date) && t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
          const todayTxExpense = txs.filter((t) => matchDate(t.date) && t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
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
          const todayInvExpense = skus.flatMap((sk) =>
            (sk.movements || []).filter((m) => m.type === 'in' && matchDate(m.date)).map((m) => {
              const unitPrice = Number(m.price) || Number(sk.buyPrice) || 0;
              return unitPrice * (Number(m.qty) || 1);
            })
          ).reduce((s, v) => s + v, 0);
          const todayInvIncome = skus.flatMap((sk) =>
            (sk.movements || []).filter((m) => m.type === 'out' && matchDate(m.date)).map((m) => {
              const unitPrice = Number(m.price) || Number(sk.sellPrice) || 0;
              return unitPrice * (Number(m.qty) || 1);
            })
          ).reduce((s, v) => s + v, 0);
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

            const inc = txInc + shInc + repInc + advInc;
            const exp = txExp + shExp + repExp + advExp;
            return { inc, exp, profit: inc - exp };
          });
          const spark7Inc = last7.map((d) => d.inc);
          const spark7Exp = last7.map((d) => d.exp);
          const spark7Prof = last7.map((d) => Math.max(d.profit, 0));

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
          const otherCats = ['general','repairs','advances','secondhand','contacts'].filter(
            (c) => rows.some((r) => r.cat === c)
          );

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
            <div className="rounded-3xl overview-section-animate" style={{ animationDelay: '0ms' }}>
            <div className="rounded-3xl overflow-hidden shadow-xl" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
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
              <div className="p-4 flex flex-col gap-4">

                {/* ── Main 3: Income / Expenses / Net Profit ── */}
                <div className="grid grid-cols-3 gap-3">
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
                    const clickable = isIncome || isExpenses;
                    const handleClick = clickable
                      ? () => setTxDetailModal(isIncome ? 'income' : 'expense')
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
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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

                  const hasGeneral   = rows.some((r) => r.cat === 'general');
                  const hasAdvances  = rows.some((r) => r.cat === 'advances');
                  const hasContacts  = rows.some((r) => r.cat === 'contacts');
                  const topCats      = ['general','advances','contacts'].filter((c) => rows.some((r) => r.cat === c));

                  // Render category header as a col-span-full row
                  const renderHeader = (cat, startIdx) => {
                    const meta = catMeta[cat];
                    return (
                      <div key={`hdr-${cat}`} className="col-span-full cat-label-animate flex items-center gap-2.5" style={{ animationDelay: `${startIdx * 60}ms` }}>
                        <div className="flex items-center gap-2 bg-white rounded-xl px-2.5 py-1.5 border border-slate-200 shadow-sm">
                          <div className="w-5 h-5 rounded-lg bg-slate-100 flex items-center justify-center">
                            <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">{meta.icon}</svg>
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">{meta.label}</span>
                        </div>
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-[9px] font-bold text-slate-300">{rows.filter((r) => r.cat === cat).length}</span>
                      </div>
                    );
                  };

                  return (
                    <>
                      {/* GENERAL + ADVANCES + CONTACTS — single flat row, no headers */}
                      {topCats.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
              <div className="mx-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">

                {/* Income sparkline */}
                <div className="kpi-card accent-emerald summary-card-animate rounded-2xl overflow-hidden bg-white" style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.07)', animationDelay: '450ms' }}>
                  <div className="h-0.75 bg-linear-to-r from-emerald-300 via-emerald-400 to-emerald-500 opacity-90" />
                  <div className="px-3.5 py-3 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">7-Day Income</span>
                      <span className="text-[10px] font-black text-emerald-600">{fmt(spark7Inc.reduce((a, b) => a + b, 0))}</span>
                    </div>
                    <MiniSparkline values={spark7Inc} color="#34d399" delay={0} />
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
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

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

        {/* ── Transaction History Report ── */}
        {(() => {
          const allTxs = activeShop?.transactions || [];
          const secondhand = activeShop?.secondhand || [];
          const repairs = activeShop?.repairs || [];
          const advances = activeShop?.advances || [];
          const skus = activeShop?.skus || [];

          // ── Summary totals ──
          const txIncome = allTxs.filter((t) => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
          const txExpense = allTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);

          const shBought = secondhand;
          const shSold = secondhand.filter((i) => i.status === 'sold');
          const shBoughtCost = shBought.reduce((s, i) => s + (Number(i.buyPrice) || 0), 0);
          const shSoldRev = shSold.reduce((s, i) => s + (Number(i.sellPrice) || 0), 0);

          const repPartsExp = repairs.reduce((s, r) => s + (Number(r.partsCost) || 0), 0);
          const repAdvInc = repairs.reduce((s, r) => s + (Number(r.advance) || 0), 0);
          const repFeeInc = repairs.filter((r) => ['ready', 'delivered', 'completed'].includes(r.status)).reduce((s, r) => s + (Number(r.repairCost) || 0), 0);

          const advGiven = advances.reduce((s, a) => s + (Number(a.advancePaid) || 0), 0);
          const advReceived = advances.flatMap((a) => (a.payments || []).map((p) => Number(p.amount) || 0)).reduce((s, v) => s + v, 0);

          const allMovements = skus.flatMap((sk) => (sk.movements || []).filter((m) => Number(m.price) > 0).map((m) => ({ ...m, skuName: sk.name, skuCode: sk.code })));
          const invIn = allMovements.filter((m) => m.type === 'in');
          const invOut = allMovements.filter((m) => m.type === 'out');
          const invInExp = invIn.reduce((s, m) => s + ((Number(m.price) || 0) * (Number(m.qty) || 1)), 0);
          const invOutInc = invOut.reduce((s, m) => s + ((Number(m.price) || 0) * (Number(m.qty) || 1)), 0);

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
              extra: tx.discountAmount > 0
                ? `${tx.discountType === 'percent' ? `${tx.discountValue}% off` : 'Flat off'} — saved ${fmt(tx.discountAmount)}`
                : null,
              deleteFn: () => setDeleteId(tx.id),
            });
          });

          // Repair jobs — each repair becomes one or more entries (parts, advance, fee)
          repairs.forEach((r) => {
            const repDate = r.createdAt || '';
            const statusMap = { ready: 'bg-emerald-100 text-emerald-700', delivered: 'bg-gray-100 text-gray-500', completed: 'bg-blue-100 text-blue-700', parts_ordered: 'bg-sky-100 text-sky-700', in_progress: 'bg-amber-100 text-amber-700', pending: 'bg-orange-100 text-orange-700', cancelled: 'bg-red-100 text-red-600' };
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
                <div className="flex items-center justify-between px-5 py-3.5" style={{ background: 'linear-gradient(135deg, #6b3a1f 0%, #936639 100%)' }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    </div>
                    <div>
                      <h2 className="text-xs font-extrabold text-white uppercase tracking-wider">{t('transactionHistory')}</h2>
                      <p className="text-[10px] text-white/45 leading-tight">Unified timeline — all modules</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {['all', 'income', 'expense'].map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold capitalize transition-all ${filter === f
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
                  <div className="flex items-center justify-between px-5 py-2.5 bg-gray-50 border-b border-gray-100">
                    <span className="text-[10px] font-semibold text-gray-400">{filtered.length} {t('entries')}</span>
                    <div className="flex items-center gap-3">
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

      </>)}

      {/* Add Transaction Modal */}
      {addTxOpen && <AddTransactionModal onClose={() => setAddTxOpen(false)} />}

      {/* Income / Expense Detail Modal */}
      {txDetailModal && (() => {
        const isIncome = txDetailModal === 'income';
        const allTxs = activeShop?.transactions || [];
        const secondhand = activeShop?.secondhand || [];
        const repairs = activeShop?.repairs || [];
        const advances = activeShop?.advances || [];
        const skus = activeShop?.skus || [];

        const rows = [];

        // Direct transactions
        allTxs.filter(t => t.type === txDetailModal).forEach(t => rows.push({
          id: t.id, date: t.date, description: t.description || t.clientName || '—',
          amount: Number(t.amount) || 0, category: t.category || '—', source: 'Transaction',
        }));

        if (isIncome) {
          // Secondhand sold
          secondhand.filter(i => i.status === 'sold').forEach(i => rows.push({
            id: `sh-${i.id}`, date: i.sellDate || '', description: `SH Sold: ${i.itemName}${i.brand ? ` (${i.brand})` : ''}`,
            amount: Number(i.sellPrice) || 0, category: 'Secondhand Sold', source: 'Secondhand',
          }));
          // Repairs income
          repairs.forEach(r => {
            if (Number(r.advance) > 0)
              rows.push({ id: `rep-adv-${r.id}`, date: (r.advanceReceivedAt || r.createdAt || '').slice(0, 10), description: `Repair Advance: ${r.customerName} — ${r.device}`, amount: Number(r.advance), category: 'Repair Advance', source: 'Repair' });
            if (Number(r.repairCost) > 0 && ['ready', 'delivered', 'completed'].includes(r.status))
              rows.push({ id: `rep-fee-${r.id}`, date: (r.feeReceivedAt || r.updatedAt || r.createdAt || '').slice(0, 10), description: `Repair Fee: ${r.customerName} — ${r.device}`, amount: Number(r.repairCost), category: 'Repair Fee', source: 'Repair' });
          });
          // Advances income
          advances.forEach(a => {
            if (Number(a.advancePaid) > 0)
              rows.push({ id: `adv-${a.id}`, date: (a.date || '').slice(0, 10), description: `Advance Received: ${a.customerName}${a.description ? ` — ${a.description}` : ''}`, amount: Number(a.advancePaid), category: 'Advance', source: 'Advance' });
            (a.payments || []).forEach(p => rows.push({ id: `adv-pay-${p.id}`, date: (p.date || '').slice(0, 10), description: `Payment from ${a.customerName}`, amount: Number(p.amount) || 0, category: 'Advance Payment', source: 'Advance' }));
          });
          // Inventory out (sales)
          skus.forEach(sk => (sk.movements || []).filter(m => m.type === 'out').forEach(m => {
            const amt = (Number(m.price) || Number(sk.sellPrice) || 0) * (Number(m.qty) || 1);
            if (amt > 0) rows.push({ id: `inv-${m.id}`, date: (m.date || '').slice(0, 10), description: `Stock Sold: ${sk.name} ×${m.qty}`, amount: amt, category: 'Stock Sale', source: 'Inventory' });
          }));
        } else {
          // Secondhand buy
          secondhand.forEach(i => rows.push({ id: `sh-buy-${i.id}`, date: i.buyDate || '', description: `SH Buy: ${i.itemName}${i.brand ? ` (${i.brand})` : ''}`, amount: Number(i.buyPrice) || 0, category: 'Secondhand Buy', source: 'Secondhand' }));
          // Repairs expense
          repairs.filter(r => Number(r.partsCost) > 0).forEach(r => rows.push({ id: `rep-parts-${r.id}`, date: (r.partsRecordedAt || r.createdAt || '').slice(0, 10), description: `Parts: ${r.device}${r.partsOrdered ? ` — ${r.partsOrdered}` : ''}`, amount: Number(r.partsCost), category: 'Repair Parts', source: 'Repair' }));
          // Advances expense
          advances.filter(a => Number(a.productCost) > 0).forEach(a => rows.push({ id: `adv-cost-${a.id}`, date: (a.date || '').slice(0, 10), description: `Product Cost: ${a.customerName}`, amount: Number(a.productCost), category: 'Advance Cost', source: 'Advance' }));
          // Inventory in (purchases)
          skus.forEach(sk => (sk.movements || []).filter(m => m.type === 'in').forEach(m => {
            const amt = (Number(m.price) || Number(sk.buyPrice) || 0) * (Number(m.qty) || 1);
            if (amt > 0) rows.push({ id: `inv-${m.id}`, date: (m.date || '').slice(0, 10), description: `Stock In: ${sk.name} ×${m.qty}`, amount: amt, category: 'Stock Purchase', source: 'Inventory' });
          }));
        }

        rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const total = rows.reduce((s, r) => s + r.amount, 0);
        const grad = isIncome
          ? 'linear-gradient(135deg, #34d399 0%, #10b981 60%, #059669 100%)'
          : 'linear-gradient(135deg, #f87171 0%, #ef4444 60%, #dc2626 100%)';

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">

              {/* Header */}
              <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ background: grad }}>
                <div>
                  <h2 className="text-lg font-black text-white">{isIncome ? 'Income' : 'Expenses'} — Full Detail</h2>
                  <p className="text-white/70 text-xs mt-0.5">{rows.length} records · Total: {fmt(total)}</p>
                </div>
                <button onClick={() => setTxDetailModal(null)} className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Source filter badges */}
              {/* List */}
              <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
                {rows.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 text-sm">No {txDetailModal} records yet.</div>
                ) : rows.map(row => (
                  <div key={row.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 hover:bg-gray-100 transition-colors">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isIncome ? 'bg-emerald-100' : 'bg-red-100'}`}>
                      <svg className={`w-4 h-4 ${isIncome ? 'text-emerald-600' : 'text-red-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {isIncome
                          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                          : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />}
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{row.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-400">{row.date ? fmtDate(row.date) : '—'}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white border border-gray-200 text-gray-500 font-medium">{row.source}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white border border-gray-200 text-gray-500">{row.category}</span>
                      </div>
                    </div>
                    <p className={`text-sm font-black shrink-0 ${isIncome ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(row.amount)}</p>
                  </div>
                ))}
              </div>

              {/* Footer total */}
              <div className="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between shrink-0 bg-gray-50">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Total {isIncome ? 'Income' : 'Expenses'}</span>
                <span className={`text-lg font-black ${isIncome ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(total)}</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Quick Note Modal */}
      {noteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg, #936639, #582f0e)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{noteEditId ? 'Edit Note' : 'Quick Note'}</h2>
                  <p className="text-xs text-amber-100">{noteEditId ? 'Update payment details & paid amount' : 'Record a payment or financial movement'}</p>
                </div>
              </div>
            </div>
            {/* Form */}
            <div className="px-6 py-5 space-y-4">
              {noteFormError && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">{noteFormError}</div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Name / Payee <span className="text-red-400">*</span></label>
                <input
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
                  placeholder="e.g. Electricity bill, Supplier payment…"
                  value={noteForm.name}
                  onChange={(e) => setNoteForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Telefono</label>
                  <input
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
                    placeholder="e.g. +39 333 1234567"
                    value={noteForm.phone}
                    onChange={(e) => setNoteForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email</label>
                  <input
                    type="email"
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
                    placeholder="e.g. cliente@email.com"
                    value={noteForm.email}
                    onChange={(e) => setNoteForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Details</label>
                <textarea
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400 resize-none"
                  rows={2}
                  placeholder="Additional details about this payment…"
                  value={noteForm.details}
                  onChange={(e) => setNoteForm((f) => ({ ...f, details: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Total Amount <span className="text-gray-400 font-normal">(optional)</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">{currencyObj?.symbol || '€'}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
                      placeholder="0.00"
                      value={noteForm.totalAmount}
                      onChange={(e) => setNoteForm((f) => ({ ...f, totalAmount: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Paid So Far</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">{currencyObj?.symbol || '€'}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
                      placeholder="0.00"
                      value={noteForm.paidAmount}
                      onChange={(e) => setNoteForm((f) => ({ ...f, paidAmount: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              {/* Appointment */}
              <div className="border-t border-gray-100 pt-4">
                <label className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Appointment <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Date</label>
                    <DatePicker
                      value={noteForm.appointmentDate}
                      onChange={(v) => setNoteForm((f) => ({ ...f, appointmentDate: v }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Time</label>
                    <input
                      type="time"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                      value={noteForm.appointmentTime}
                      onChange={(e) => setNoteForm((f) => ({ ...f, appointmentTime: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </div>
            {/* Footer */}
            <div className="px-6 pb-5 flex gap-3">
              <button
                onClick={() => { setNoteOpen(false); setNoteEditId(null); setNoteFormError(''); }}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >{t('cancel')}</button>
              <button
                onClick={() => {
                  if (!noteForm.name.trim()) { setNoteFormError('Name / Payee is required.'); return; }
                  const total = noteForm.totalAmount ? Number(noteForm.totalAmount) : null;
                  const paid = noteForm.paidAmount ? Number(noteForm.paidAmount) : 0;
                  const apptDate = noteForm.appointmentDate || null;
                  const apptTime = noteForm.appointmentTime || null;
                  if (noteEditId) {
                    updateNote(noteEditId, { name: noteForm.name.trim(), details: noteForm.details.trim(), totalAmount: total, paidAmount: paid, appointmentDate: apptDate, appointmentTime: apptTime, phone: noteForm.phone.trim(), email: noteForm.email.trim() });
                    setNoteEditId(null);
                  } else {
                    addNote({ name: noteForm.name.trim(), details: noteForm.details.trim(), totalAmount: total, paidAmount: paid, appointmentDate: apptDate, appointmentTime: apptTime, phone: noteForm.phone.trim(), email: noteForm.email.trim() });
                  }
                  if (noteForm.phone.trim() || noteForm.email.trim()) {
                    addOrUpdateContact({
                      name: noteForm.name.trim(),
                      email: noteForm.email.trim(),
                      phone: noteForm.phone.trim(),
                    });
                  }
                  setNoteForm({ name: '', details: '', totalAmount: '', paidAmount: '', appointmentDate: '', appointmentTime: '', phone: '', email: '' });
                  setNoteFormError('');
                  setNoteOpen(false);
                }}
                className="flex-1 px-4 py-2.5 text-white font-semibold rounded-xl transition-colors text-sm"
                style={{ backgroundColor: '#936639' }}
              >{noteEditId ? 'Update Note' : 'Save Note'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Note Delete Confirm */}
      {noteDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Delete Note?</h3>
            <p className="text-sm text-gray-500">{t('cannotBeUndone')}</p>
            <div className="flex gap-3">
              <button onClick={() => setNoteDeleteId(null)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors">{t('cancel')}</button>
              <button onClick={() => { deleteNote(noteDeleteId); setNoteDeleteId(null); }} className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors">{t('delete')}</button>
            </div>
          </div>
        </div>
      )}



      {/* ── REPAIRS PAGE ── */}
      {page === 'repairs' && (() => {
        const repairs = activeShop.repairs || [];
        const statusCfg = {
          pending: { label: t('repairStatus_pending'), color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
          parts_ordered: { label: t('repairStatus_parts_ordered'), color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-400' },
          ready: { label: t('repairStatus_ready'), color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-400' },
          delivered: { label: t('repairStatus_delivered'), color: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
        };
        const nextStatus = { pending: 'parts_ordered', parts_ordered: 'ready', ready: 'delivered' };
        const nextLabel = { pending: t('markPartsOrdered'), parts_ordered: t('markReady'), ready: t('markDelivered') };
        const filtered = repairFilter === 'all' ? repairs : repairs.filter((r) => r.status === repairFilter);
        const counts = { pending: 0, parts_ordered: 0, ready: 0, delivered: 0 };
        repairs.forEach((r) => { if (counts[r.status] !== undefined) counts[r.status]++; });

        return (
          <div className="space-y-4">
            {/* Summary strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { key: 'pending', label: t('repairStatus_pending'), val: counts.pending, bg: 'bg-amber-50', tc: '' },
                { key: 'parts_ordered', label: t('repairStatus_parts_ordered'), val: counts.parts_ordered, bg: 'bg-amber-50/50', tc: '' },
                { key: 'ready', label: t('repairStatus_ready'), val: counts.ready, bg: 'bg-amber-50/50', tc: '' },
                { key: 'delivered', label: t('repairStatus_delivered'), val: counts.delivered, bg: 'bg-gray-50', tc: 'text-gray-400' },
              ].map((s) => (
                <button key={s.key} onClick={() => setRepairFilter(repairFilter === s.key ? 'all' : s.key)}
                  className={`rounded-2xl p-4 text-center border-2 transition-all ${repairFilter === s.key ? 'border-amber-400 ring-2 ring-amber-500/20' : 'border-transparent'} ${s.bg}`}>
                  <p className={`text-3xl font-bold ${s.tc}`} style={s.tc === '' ? { color: '#936639' } : {}}>{s.val}</p>
                  <p className="text-xs text-gray-500 mt-0.5 font-medium">{s.label}</p>
                </button>
              ))}
            </div>

            {/* Filter bar */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2 bg-white rounded-2xl p-1.5 shadow-sm border border-gray-200 w-fit">
                {[['all', t('all')], ['pending', t('repairStatus_pending')], ['parts_ordered', t('repairStatus_parts_ordered')], ['ready', t('repairStatus_ready')], ['delivered', t('repairStatus_delivered')]].map(([key, lbl]) => (
                  <button key={key} onClick={() => setRepairFilter(key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${repairFilter === key ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
                    {lbl}
                  </button>
                ))}
              </div>
              <button onClick={() => setAddRepairOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {t('addRepairJob')}
              </button>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((r) => {
                  const cfg = statusCfg[r.status] || statusCfg.pending;
                  const next = nextStatus[r.status];
                  const total = (r.partsCost || 0) + (r.repairCost || 0);
                  const due = Math.max(0, (r.repairCost || 0) - (r.advance || 0));
                  const pct = (r.repairCost || 0) > 0 ? Math.min(100, Math.round(((r.advance || 0) / (r.repairCost || 0)) * 100)) : 0;
                  const fullyPaid = total > 0 && due === 0;
                  return (
                    <div key={r.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 space-y-3 hover:border-amber-200 transition-colors">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 text-base leading-tight">{r.customerName}</p>
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
                          {fullyPaid && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-600">Paid ✓</span>}
                        </div>
                      </div>

                      {/* Device / Issue */}
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-sm text-gray-700 font-medium">
                          <svg className="w-3.5 h-3.5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                          {r.device}
                          {r.issue && <span className="text-gray-400 font-normal text-xs truncate">· {r.issue}</span>}
                        </div>
                        {r.partsOrdered && (
                          <p className="text-xs text-blue-600 font-medium">{t('parts')}: {r.partsOrdered}</p>
                        )}
                        {r.notes && <p className="text-xs text-gray-400 line-clamp-1">{r.notes}</p>}
                      </div>

                      {/* Financial progress */}
                      <div className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-2">
                        <div className="flex justify-between text-xs font-semibold flex-wrap gap-y-1">
                          {r.partsCost > 0 && <span className="text-gray-500">{t('partsCost')}: <span className="text-gray-800">{fmt(r.partsCost)}</span></span>}
                          {r.repairCost > 0 && <span className="text-gray-500">{t('repairCostLabel')}: <span className="text-gray-800">{fmt(r.repairCost)}</span></span>}
                        </div>
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-gray-500">{t('advance')}: <span className="text-emerald-600">{fmt(r.advance || 0)}</span></span>
                          <span className="text-gray-500">{t('due')}: <span className={due > 0 ? 'text-red-500' : 'text-green-500'}>{fmt(due)}</span></span>
                        </div>
                        {total > 0 && (
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
                        <div className="space-y-1">
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
                          <div className="flex gap-2">
                            <input
                              type="number" min="0"
                              className="flex-1 px-2.5 py-2 border border-emerald-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white placeholder-gray-400"
                              placeholder={`Amount (${currencyObj.symbol})*`}
                              value={repairPayAmt}
                              onChange={e => { setRepairPayAmt(e.target.value); setRepairPayError(''); }}
                            />
                            <input
                              className="flex-1 px-2.5 py-2 border border-emerald-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white placeholder-gray-400"
                              placeholder="Note (optional)"
                              value={repairPayNote}
                              onChange={e => setRepairPayNote(e.target.value)}
                            />
                          </div>
                          {repairPayError && <p className="text-[10px] text-red-500">{repairPayError}</p>}
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const amt = Number(repairPayAmt);
                                if (!amt || amt <= 0) { setRepairPayError('Enter a valid amount'); return; }
                                const existing = r.payments || [];
                                const initialAdv = r.initialAdvance ?? (r.advance || 0);
                                // first time: save the original advance as initialAdvance
                                const newPayment = { id: Date.now().toString(), amount: amt, note: repairPayNote.trim(), date: new Date().toISOString().split('T')[0] };
                                const payments = [...existing, newPayment];
                                const newAdv = Number(initialAdv) + payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                                updateRepair(activeShop.id, r.id, {
                                  payments,
                                  advance: newAdv,
                                  ...(r.initialAdvance === undefined ? { initialAdvance: r.advance || 0 } : {})
                                });
                                setRepairPayAmt(''); setRepairPayNote(''); setRepairPayOpenId(null);
                              }}
                              className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors">
                              Save Payment
                            </button>
                            <button onClick={() => { setRepairPayOpenId(null); setRepairPayAmt(''); setRepairPayNote(''); setRepairPayError(''); }}
                              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold rounded-lg transition-colors">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Date */}
                      <p className="text-xs text-gray-400">{t('added')} {fmtDate(r.createdAt)}</p>

                      {/* ── Orders Section ── */}
                      <div className="border-t border-gray-100 pt-3 space-y-2">
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
                          <div className="space-y-1.5">
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
                      <div className="flex gap-2 pt-1">
                        {next ? (
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
                              });
                            }
                          }}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 text-xs font-bold border border-amber-500/30 rounded-xl transition-colors">
                            {nextLabel[r.status]}
                          </button>
                        ) : (
                          <div className="flex-1" />
                        )}
                        {/* Add Payment Button */}
                        {!fullyPaid && (
                          <button
                            onClick={() => { setRepairPayOpenId(repairPayOpenId === r.id ? null : r.id); setRepairPayAmt(''); setRepairPayNote(''); setRepairPayError(''); }}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 text-xs font-bold border border-emerald-500/30 rounded-xl transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                            Pay
                          </button>
                        )}
                        {/* WhatsApp Message Button */}                        {r.phone && (() => {
                          const statusMsgs = {
                            pending: `Ciao ${r.customerName}, la tua riparazione (${r.device || 'dispositivo'}) è stata registrata da ${activeShop.name}. Ti aggiorneremo presto!`,
                            parts_ordered: `Ciao ${r.customerName}, le parti per il tuo ${r.device || 'dispositivo'} sono state ordinate. Ti avvisiamo appena arrivano. — ${activeShop.name}`,
                            in_progress: `Ciao ${r.customerName}, la riparazione del tuo ${r.device || 'dispositivo'} è in corso. Ti aggiorniamo a breve! — ${activeShop.name}`,
                            ready: `Ciao ${r.customerName}, il tuo ${r.device || 'dispositivo'} è pronto per il ritiro da ${activeShop.name}! Costo riparazione: ${r.repairCost ? `€${r.repairCost}` : ''}. Vieni quando vuoi.`,
                            delivered: `Ciao ${r.customerName}, grazie per aver scelto ${activeShop.name}! Il tuo ${r.device || 'dispositivo'} è stato consegnato. Per qualsiasi problema siamo qui.`,
                            completed: `Ciao ${r.customerName}, grazie per aver scelto ${activeShop.name}! La tua riparazione è completata. A presto!`,
                          };
                          const msg = statusMsgs[r.status] || `Ciao ${r.customerName}, aggiornamento riparazione da ${activeShop.name}.`;
                          const phone = r.phone.replace(/\D/g, '');
                          const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
                          return (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Invia su WhatsApp"
                              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-600 text-xs font-bold border border-green-500/30 rounded-xl transition-colors">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                              </svg>
                              WA
                            </a>
                          );
                        })()}
                        <button onClick={() => setRepairDeleteId(r.id)}
                          className="p-2 border border-red-100 rounded-xl text-red-400 hover:bg-red-50 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Repair Form */}
            {addRepairOpen ? (
              <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-dashed border-amber-500/30">
                <p className="text-sm font-bold text-amber-400 mb-4">{t('newRepair')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  {[
                    ['customerName', `${t('customerName')} *`, 'Mario Rossi', 'text'],
                    ['phone', t('phone'), '+39 300-0000000', 'text'],
                    ['device', `${t('deviceModel')} *`, 'iPhone 13 Pro', 'text'],
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
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{t('notes')}</label>
                  <textarea className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400 resize-none" rows={2} value={repairForm.notes} onChange={(e) => setRepairForm((f) => ({ ...f, notes: e.target.value }))} placeholder={t('additionalNotes')} />
                </div>
                {repairFormError && <p className="text-xs text-red-500 mb-3">{repairFormError}</p>}
                <div className="flex gap-3">
                  <button onClick={() => { setAddRepairOpen(false); setRepairFormError(''); setRepairForm({ customerName: '', phone: '', device: '', issue: '', partsOrdered: '', partsCost: '', repairCost: '', advance: '', notes: '', email: '' }); }}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm">{t('cancel')}</button>
                  <button onClick={handleAddRepair}
                    className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors text-sm shadow-sm">{t('saveRepair')}</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddRepairOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-gray-200 text-gray-400 font-semibold rounded-2xl hover:border-amber-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {t('addRepairJob')}
              </button>
            )}
          </div>
        );
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

      {/* ── ADVANCES PAGE ── */}
      {page === 'advances' && (() => {
        const advances = activeShop.advances || [];
        const totalReceived = advances.reduce((s, a) => s + (a.advancePaid || 0), 0);
        const totalPending = advances.reduce((s, a) => s + (a.remaining || 0), 0);
        const totalBilled = advances.reduce((s, a) => s + (a.totalAmount || 0), 0);
        const statusCfg = {
          pending: { color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
          partial: { color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-400' },
          cleared: { color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-400' },
        };
        return (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 text-center">
                <p className="text-2xl font-bold" style={{ color: '#936639' }}>{advances.length}</p>
                <p className="text-sm text-gray-400 mt-1">{t('totalRecords')}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 text-center">
                <p className="text-xl font-bold" style={{ color: '#936639' }}>{fmt(totalReceived)}</p>
                <p className="text-sm text-gray-400 mt-1">{t('received')}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 text-center">
                <p className="text-xl font-bold text-red-500">{fmt(totalPending)}</p>
                <p className="text-sm text-gray-400 mt-1">{t('remaining')}</p>
              </div>
            </div>

            {/* Add button */}
            <div className="flex justify-end">
              <button onClick={() => setAddAdvanceOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {t('newAdvanceEntry')}
              </button>
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
            {advances.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {advances.map((adv) => {
                  const cfg = statusCfg[adv.status] || statusCfg.pending;
                  const pct = adv.totalAmount > 0 ? Math.min((adv.advancePaid / adv.totalAmount) * 100, 100) : 0;
                  const isPayOpen = advancePayOpen === adv.id;
                  const isCostOpen = advanceCostOpen === adv.id;
                  const fullyCleared = adv.status === 'cleared';
                  return (
                    <div key={adv.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 space-y-3 hover:border-amber-200 transition-colors">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 text-base leading-tight">{adv.customerName}</p>
                          {adv.phone && <p className="text-xs text-gray-400 mt-0.5">{adv.phone}</p>}
                          {adv.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{adv.description}</p>}
                          <div className="flex items-center gap-1 mt-1">
                              <svg className="w-3 h-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" /></svg>
                              <span className="text-xs text-gray-400">Costo prodotti:</span>
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
                          {fullyCleared && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-600">Paid ✓</span>}
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-2">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-gray-500">{t('received')}: <span style={{ color: '#936639' }}>{fmt(adv.advancePaid || 0)}</span></span>
                          <span className="text-gray-500">{t('remaining')}: <span className={adv.remaining > 0 ? 'text-red-500' : 'text-green-500'}>{fmt(adv.remaining || 0)}</span></span>
                          <span className="text-gray-500">{t('totalLabel')}: <span className="text-gray-800">{fmt(adv.totalAmount || 0)}</span></span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: fullyCleared ? '#22c55e' : 'linear-gradient(to right, #a68a64, #936639)' }} />
                        </div>
                        <p className="text-right text-xs text-gray-400">{pct.toFixed(0)}% {t('received')}</p>
                      </div>

                      {/* Payment history */}
                      {adv.payments && adv.payments.length > 0 && (
                        <div className="border-t border-gray-100 pt-2 space-y-1">
                          <p className="text-xs font-semibold text-gray-400">{t('paymentHistory')}</p>
                          {adv.payments.map((p) => (
                            <div key={p.id} className="flex justify-between text-xs text-gray-500">
                              <span>{fmtDate(p.date)}</span>
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
                            className="px-3 py-2 text-white text-xs font-semibold rounded-xl transition-colors" style={{ backgroundColor: '#a68a64' }}>Salva</button>
                          <button onClick={() => setAdvanceCostOpen(null)}
                            className="px-3 py-2 border border-gray-200 text-gray-500 text-xs font-medium rounded-xl hover:bg-gray-50 transition-colors">{t('cancel')}</button>
                        </div>
                      )}

                      {/* Inline add payment input */}
                      {isPayOpen && (
                        <div className="pt-1 border-t border-gray-100 flex items-center gap-2">
                          <input
                            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
                            type="number" min="1" placeholder={`Amount (${currencyObj.symbol})`}
                            value={advancePayAmt} onChange={(e) => setAdvancePayAmt(e.target.value)}
                            autoFocus
                          />
                          <button onClick={() => handleAdvancePay(adv)}
                            className="px-3 py-2 text-white text-xs font-semibold rounded-xl transition-colors" style={{ backgroundColor: '#a68a64' }}>{t('add')}</button>
                          <button onClick={() => setAdvancePayOpen(null)}
                            className="px-3 py-2 border border-gray-200 text-gray-500 text-xs font-medium rounded-xl hover:bg-gray-50 transition-colors">{t('cancel')}</button>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        {!fullyCleared ? (
                          <button onClick={() => { setAdvancePayOpen(isPayOpen ? null : adv.id); setAdvancePayAmt(''); }}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors text-xs font-semibold">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            {t('addPayment')}
                          </button>
                        ) : (
                          <div className="flex-1" />
                        )}
                        <button onClick={() => setAdvanceDeleteId(adv.id)}
                          className="p-2 border border-red-100 rounded-xl text-red-400 hover:bg-red-50 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
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
                    ['advancePaid', `${t('advancePaid')} (${currencyObj.symbol})`, '10000', 'number'],
                    ['productCost', `Costo Prodotti (${currencyObj.symbol})`, '5000', 'number'],
                    ['email', t('clientEmail'), 'mario@email.com', 'email'],
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
                {advanceFormError && <p className="text-xs text-red-500 mb-3">{advanceFormError}</p>}
                <div className="flex gap-3">
                  <button onClick={() => { setAddAdvanceOpen(false); setAdvanceFormError(''); setAdvanceForm({ customerName: '', phone: '', description: '', totalAmount: '', advancePaid: '', productCost: '', email: '' }); }}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm">{t('cancel')}</button>
                  <button onClick={handleAddAdvance}
                    className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors text-sm shadow-sm">{t('saveEntry')}</button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

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

      {/* ── REPORTS PAGE ── */}
      {page === 'reports' && (() => {
        const repairs = activeShop.repairs || [];
        const advances = activeShop.advances || [];
        const txs = activeShop.transactions || [];
        const skus = activeShop.skus || [];
        const secondhand = activeShop.secondhand || [];
        const team = activeShop.team || [];

        const d = (v) => (v || '').slice(0, 10);

        const isInPeriod = (dateStr) => {
          const s = d(dateStr);
          if (!s) return false;
          if (reportView === 'daily') return s === reportDate;
          if (reportView === 'monthly') return s.startsWith(reportMonth);
          return true;
        };

        // ── Transactions ──
        const periodTxIncome = txs.filter((t) => isInPeriod(t.date) && t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const periodTxExpense = txs.filter((t) => isInPeriod(t.date) && t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const periodTxs = txs.filter((t) => isInPeriod(t.date));

        // ── Repairs ──
        const periodRepairs = repairs.filter((r) => isInPeriod(r.createdAt));
        const periodRepairedDone = repairs.filter((r) => isInPeriod(r.updatedAt) && ['ready', 'delivered', 'completed'].includes(r.status));
        const repPartsExpense = periodRepairs.reduce((s, r) => s + (Number(r.partsCost) || 0), 0);
        const repAdvanceIncome = periodRepairs.reduce((s, r) => s + (Number(r.advance) || 0), 0);
        const repFeeIncome = periodRepairedDone.reduce((s, r) => s + (Number(r.repairCost) || 0), 0);

        // ── Advances ──
        const periodAdvances = advances.filter((a) => isInPeriod(a.date));
        const advGiven = periodAdvances.reduce((s, a) => s + (Number(a.advancePaid) || 0), 0);
        const periodAdvPayments = advances.flatMap((a) => (a.payments || []).filter((p) => isInPeriod(p.date)));
        const advReceived = periodAdvPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const advDueTotal = advances.reduce((s, a) => s + (Number(a.remaining) || 0), 0);

        // ── Inventory ──
        const periodMovements = skus.flatMap((sk) =>
          (sk.movements || []).filter((m) => isInPeriod(m.date)).map((m) => ({ ...m, skuName: sk.name, skuCode: sk.code }))
        );
        const invStockIn = periodMovements.filter((m) => m.type === 'in');
        const invStockOut = periodMovements.filter((m) => m.type === 'out');
        const invInExpense = invStockIn.reduce((s, m) => s + ((Number(m.price) || 0) * (Number(m.qty) || 1)), 0);
        const invOutIncome = invStockOut.reduce((s, m) => s + ((Number(m.price) || 0) * (Number(m.qty) || 1)), 0);
        const invTotalInQty = invStockIn.reduce((s, m) => s + (Number(m.qty) || 0), 0);
        const invTotalOutQty = invStockOut.reduce((s, m) => s + (Number(m.qty) || 0), 0);

        // ── Secondhand ──
        const shBought = secondhand.filter((i) => isInPeriod(i.buyDate));
        const shSold = secondhand.filter((i) => i.status === 'sold' && isInPeriod(i.sellDate));
        const shBoughtCost = shBought.reduce((s, i) => s + (Number(i.buyPrice) || 0), 0);
        const shSoldRevenue = shSold.reduce((s, i) => s + (Number(i.sellPrice) || 0), 0);
        const shProfit = shSold.reduce((s, i) => s + ((Number(i.sellPrice) || 0) - (Number(i.buyPrice) || 0)), 0);

        // ── Team payroll (all active, period-independent context) ──
        const activeTeam = team.filter((m) => m.status === 'active');
        const totalPayroll = activeTeam.reduce((s, m) => s + (Number(m.salary) || 0), 0);

        // ── Grand P&L ──
        const grandIncome = periodTxIncome + repAdvanceIncome + repFeeIncome + advReceived + invOutIncome + shSoldRevenue;
        const grandExpense = periodTxExpense + repPartsExpense + advGiven + invInExpense + shBoughtCost;
        const grandProfit = grandIncome - grandExpense;

        const hasAnyData = periodTxs.length > 0 || periodRepairs.length > 0 || periodAdvances.length > 0
          || periodMovements.length > 0 || shBought.length > 0 || shSold.length > 0;

        const statusBadge = (status) => {
          const m = { ready: 'bg-emerald-100 text-emerald-700', delivered: 'bg-gray-100 text-gray-500', completed: 'bg-blue-100 text-blue-700', parts_ordered: 'bg-sky-100 text-sky-700', in_progress: 'bg-amber-100 text-amber-700', pending: 'bg-orange-100 text-orange-700', cancelled: 'bg-red-100 text-red-600' };
          const cls = m[status] || 'bg-gray-100 text-gray-500';
          const label = { parts_ordered: t('status_parts_ordered'), in_progress: t('status_in_progress'), ready: t('status_ready'), delivered: t('status_delivered'), pending: t('status_pending'), completed: t('status_completed') }[status] || (status.charAt(0).toUpperCase() + status.slice(1));
          return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${cls}`}>{label}</span>;
        };

        const periodLabel = reportView === 'daily'
          ? fmtDate(reportDate)
          : reportView === 'monthly'
            ? new Date(reportMonth + '-01').toLocaleDateString(locale, { month: 'long', year: 'numeric' })
            : 'All Time';

        const downloadPDF = () => {
          const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
          const brandColor = [147, 102, 57];
          const w = doc.internal.pageSize.getWidth();

          // Compute all data for a given period mode independently of reportView
          const computePeriodData = (mode) => {
            const inP = (dateStr) => {
              const s = (dateStr || '').slice(0, 10);
              if (!s) return false;
              if (mode === 'daily') return s === reportDate;
              if (mode === 'monthly') return s.startsWith(reportMonth);
              return true;
            };
            const pTxIncome = txs.filter((t) => inP(t.date) && t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
            const pTxExpense = txs.filter((t) => inP(t.date) && t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
            const pTxs = txs.filter((t) => inP(t.date));
            const pRepairs = repairs.filter((r) => inP(r.createdAt));
            const pRepDone = repairs.filter((r) => inP(r.updatedAt) && ['ready', 'delivered', 'completed'].includes(r.status));
            const repPartsExp = pRepairs.reduce((s, r) => s + (Number(r.partsCost) || 0), 0);
            const repAdvInc = pRepairs.reduce((s, r) => s + (Number(r.advance) || 0), 0);
            const repFeeInc = pRepDone.reduce((s, r) => s + (Number(r.repairCost) || 0), 0);
            const pAdvances = advances.filter((a) => inP(a.date));
            const advGiv = pAdvances.reduce((s, a) => s + (Number(a.advancePaid) || 0), 0);
            const advRec = advances.flatMap((a) => (a.payments || []).filter((p) => inP(p.date))).reduce((s, p) => s + (Number(p.amount) || 0), 0);
            const pMovements = skus.flatMap((sk) => (sk.movements || []).filter((mv) => inP(mv.date)).map((mv) => ({ ...mv, skuName: sk.name })));
            const invInExp = pMovements.filter((m) => m.type === 'in').reduce((s, m) => s + ((Number(m.price) || 0) * (Number(m.qty) || 1)), 0);
            const invOutInc = pMovements.filter((m) => m.type === 'out').reduce((s, m) => s + ((Number(m.price) || 0) * (Number(m.qty) || 1)), 0);
            const pShBought = secondhand.filter((i) => inP(i.buyDate));
            const pShSold = secondhand.filter((i) => i.status === 'sold' && inP(i.sellDate));
            const shBCost = pShBought.reduce((s, i) => s + (Number(i.buyPrice) || 0), 0);
            const shSRev = pShSold.reduce((s, i) => s + (Number(i.sellPrice) || 0), 0);
            const income = pTxIncome + repAdvInc + repFeeInc + advRec + invOutInc + shSRev;
            const expense = pTxExpense + repPartsExp + advGiv + invInExp + shBCost;
            return { pTxs, pRepairs, pAdvances, pMovements, income, expense, profit: income - expense };
          };

          const periods = [
            { mode: 'daily', label: 'Daily Report', sub: fmtDate(reportDate) },
            { mode: 'monthly', label: 'Monthly Report', sub: new Date(reportMonth + '-01').toLocaleDateString(locale, { month: 'long', year: 'numeric' }) },
            { mode: 'all', label: 'All Time Report', sub: 'All Time' },
          ];

          periods.forEach(({ mode, label, sub }, idx) => {
            if (idx > 0) doc.addPage();

            // Per-section header banner
            doc.setFillColor(...brandColor);
            doc.rect(0, 0, w, 28, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(15);
            doc.setFont('helvetica', 'bold');
            doc.text(activeShop.name || 'Shop Report', 14, 12);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(`${label} — ${sub}`, 14, 20);
            doc.text(`Generated: ${new Date().toLocaleDateString()}`, w - 14, 20, { align: 'right' });

            const { pTxs, pRepairs, pAdvances, pMovements, income, expense, profit } = computePeriodData(mode);
            let y = 36;

            // P&L Summary
            doc.setTextColor(...brandColor);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('Net Profit / Loss Summary', 14, y);
            y += 4;
            autoTable(doc, {
              startY: y,
              head: [['Category', 'Amount']],
              body: [
                ['Total Income', fmt(income)],
                ['Total Expenses', fmt(expense)],
                ['Net Profit / Loss', (profit >= 0 ? '+' : '') + fmt(profit)],
              ],
              headStyles: { fillColor: brandColor, textColor: 255, fontStyle: 'bold' },
              bodyStyles: { fontSize: 9 },
              alternateRowStyles: { fillColor: [253, 246, 234] },
              margin: { left: 14, right: 14 },
            });
            y = doc.lastAutoTable.finalY + 10;

            // Transactions
            if (pTxs.length > 0) {
              doc.setTextColor(...brandColor); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
              doc.text('Transactions', 14, y); y += 4;
              autoTable(doc, {
                startY: y,
                head: [['Date', 'Description', 'Category', 'Type', 'Amount']],
                body: pTxs.map((tx) => [fmtDate(tx.date), tx.description || '', tx.category || '', tx.type, (tx.type === 'income' ? '+' : '-') + fmt(tx.amount)]),
                headStyles: { fillColor: brandColor, textColor: 255, fontStyle: 'bold' },
                bodyStyles: { fontSize: 8 }, alternateRowStyles: { fillColor: [253, 246, 234] }, margin: { left: 14, right: 14 },
              });
              y = doc.lastAutoTable.finalY + 10;
            }

            // Repairs
            if (pRepairs.length > 0) {
              doc.setTextColor(...brandColor); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
              doc.text('Repair Jobs', 14, y); y += 4;
              autoTable(doc, {
                startY: y,
                head: [['Customer', 'Device', 'Status', 'Parts Cost', 'Advance', 'Repair Fee']],
                body: pRepairs.map((r) => [r.customerName, r.device || '', r.status || '', fmt(r.partsCost || 0), fmt(r.advance || 0), fmt(r.repairCost || 0)]),
                headStyles: { fillColor: brandColor, textColor: 255, fontStyle: 'bold' },
                bodyStyles: { fontSize: 8 }, alternateRowStyles: { fillColor: [253, 246, 234] }, margin: { left: 14, right: 14 },
              });
              y = doc.lastAutoTable.finalY + 10;
            }

            // Advances
            if (pAdvances.length > 0) {
              doc.setTextColor(...brandColor); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
              doc.text('Advances', 14, y); y += 4;
              autoTable(doc, {
                startY: y,
                head: [['Customer', 'Date', 'Total', 'Paid', 'Remaining']],
                body: pAdvances.map((a) => [a.customerName, fmtDate(a.date), fmt(a.totalAmount || 0), fmt(a.advancePaid || 0), fmt(a.remaining || 0)]),
                headStyles: { fillColor: brandColor, textColor: 255, fontStyle: 'bold' },
                bodyStyles: { fontSize: 8 }, alternateRowStyles: { fillColor: [253, 246, 234] }, margin: { left: 14, right: 14 },
              });
              y = doc.lastAutoTable.finalY + 10;
            }

            // Inventory
            if (pMovements.length > 0) {
              doc.setTextColor(...brandColor); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
              doc.text('Inventory Movements', 14, y); y += 4;
              autoTable(doc, {
                startY: y,
                head: [['Date', 'Item', 'Type', 'Qty', 'Price']],
                body: pMovements.map((m) => [fmtDate(m.date), m.skuName || '', m.type === 'in' ? 'Stock In' : 'Stock Out', m.qty, fmt((Number(m.price) || 0) * (Number(m.qty) || 1))]),
                headStyles: { fillColor: brandColor, textColor: 255, fontStyle: 'bold' },
                bodyStyles: { fontSize: 8 }, alternateRowStyles: { fillColor: [253, 246, 234] }, margin: { left: 14, right: 14 },
              });
              y = doc.lastAutoTable.finalY + 10;
            }

            // Team Payroll — only in All Time section
            if (mode === 'all' && activeTeam.length > 0) {
              doc.setTextColor(...brandColor); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
              doc.text('Team & Payroll', 14, y); y += 4;
              autoTable(doc, {
                startY: y,
                head: [['Name', 'Role', 'Status', 'Salary/Month']],
                body: team.map((m) => [m.name, m.role || '', m.status || '', fmt(m.salary || 0)]),
                foot: [['', '', 'Total Payroll', fmt(totalPayroll)]],
                headStyles: { fillColor: brandColor, textColor: 255, fontStyle: 'bold' },
                footStyles: { fillColor: [230, 210, 185], textColor: [80, 40, 10], fontStyle: 'bold' },
                bodyStyles: { fontSize: 8 }, alternateRowStyles: { fillColor: [253, 246, 234] }, margin: { left: 14, right: 14 },
              });
            }
          });

          // Page footer on every page
          const pageCount = doc.internal.getNumberOfPages();
          for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(180, 150, 100);
            doc.text(`${activeShop.name} · Complete Report · Page ${i} of ${pageCount}`, w / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
          }

          doc.save(`${activeShop.name}_complete_report_${new Date().toISOString().slice(0, 10)}.pdf`);
        };

        const printReport = () => {
          const brandHex = '#936639';
          const periods = [
            { mode: 'daily', label: 'Daily Report', sub: fmtDate(reportDate) },
            { mode: 'monthly', label: 'Monthly Report', sub: new Date(reportMonth + '-01').toLocaleDateString(locale, { month: 'long', year: 'numeric' }) },
            { mode: 'all', label: 'All Time Report', sub: 'All Time' },
          ];

          const tableHtml = (head, rows, foot = null) => {
            const thCells = head.map((h) => `<th>${h}</th>`).join('');
            const trRows = rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('');
            const footRow = foot ? `<tfoot><tr>${foot.map((c) => `<td><b>${c}</b></td>`).join('')}</tr></tfoot>` : '';
            return `<table><thead><tr>${thCells}</tr></thead><tbody>${trRows}</tbody>${footRow}</table>`;
          };

          const sectionsHtml = periods.map(({ mode, label, sub }) => {
            const { pTxs, pRepairs, pAdvances, pMovements, income, expense, profit } = (() => {
              const inP = (dateStr) => {
                const s = (dateStr || '').slice(0, 10);
                if (!s) return false;
                if (mode === 'daily') return s === reportDate;
                if (mode === 'monthly') return s.startsWith(reportMonth);
                return true;
              };
              const pTxIncome = txs.filter((t) => inP(t.date) && t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
              const pTxExpense = txs.filter((t) => inP(t.date) && t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
              const pTxs = txs.filter((t) => inP(t.date));
              const pRepairs = repairs.filter((r) => inP(r.createdAt));
              const pRepDone = repairs.filter((r) => inP(r.updatedAt) && ['ready', 'delivered', 'completed'].includes(r.status));
              const repPartsExp = pRepairs.reduce((s, r) => s + (Number(r.partsCost) || 0), 0);
              const repAdvInc = pRepairs.reduce((s, r) => s + (Number(r.advance) || 0), 0);
              const repFeeInc = pRepDone.reduce((s, r) => s + (Number(r.repairCost) || 0), 0);
              const pAdvances = advances.filter((a) => inP(a.date));
              const advGiv = pAdvances.reduce((s, a) => s + (Number(a.advancePaid) || 0), 0);
              const advRec = advances.flatMap((a) => (a.payments || []).filter((p) => inP(p.date))).reduce((s, p) => s + (Number(p.amount) || 0), 0);
              const pMovements = skus.flatMap((sk) => (sk.movements || []).filter((mv) => inP(mv.date)).map((mv) => ({ ...mv, skuName: sk.name })));
              const invInExp = pMovements.filter((m) => m.type === 'in').reduce((s, m) => s + ((Number(m.price) || 0) * (Number(m.qty) || 1)), 0);
              const invOutInc = pMovements.filter((m) => m.type === 'out').reduce((s, m) => s + ((Number(m.price) || 0) * (Number(m.qty) || 1)), 0);
              const pShBought = secondhand.filter((i) => inP(i.buyDate));
              const pShSold = secondhand.filter((i) => i.status === 'sold' && inP(i.sellDate));
              const shBCost = pShBought.reduce((s, i) => s + (Number(i.buyPrice) || 0), 0);
              const shSRev = pShSold.reduce((s, i) => s + (Number(i.sellPrice) || 0), 0);
              const income = pTxIncome + repAdvInc + repFeeInc + advRec + invOutInc + shSRev;
              const expense = pTxExpense + repPartsExp + advGiv + invInExp + shBCost;
              return { pTxs, pRepairs, pAdvances, pMovements, income, expense, profit: income - expense };
            })();

            const profitColor = profit >= 0 ? '#16a34a' : '#dc2626';
            let html = `
              <div class="section">
                <div class="section-header">
                  <div class="section-title">${label}</div>
                  <div class="section-sub">${sub}</div>
                </div>
                <h3>Net Profit / Loss Summary</h3>
                ${tableHtml(['Category', 'Amount'], [
              ['Total Income', fmt(income)],
              ['Total Expenses', fmt(expense)],
              [`<b>Net P&amp;L</b>`, `<b style="color:${profitColor}">${profit >= 0 ? '+' : ''}${fmt(profit)}</b>`],
            ])}`;

            if (pTxs.length > 0) {
              html += `<h3>Transactions</h3>${tableHtml(
                ['Date', 'Description', 'Category', 'Type', 'Amount'],
                pTxs.map((tx) => [fmtDate(tx.date), tx.description || '', tx.category || '', tx.type, (tx.type === 'income' ? '+' : '-') + fmt(tx.amount)])
              )}`;
            }
            if (pRepairs.length > 0) {
              html += `<h3>Repair Jobs</h3>${tableHtml(
                ['Customer', 'Device', 'Status', 'Parts Cost', 'Advance', 'Repair Fee'],
                pRepairs.map((r) => [r.customerName, r.device || '', r.status || '', fmt(r.partsCost || 0), fmt(r.advance || 0), fmt(r.repairCost || 0)])
              )}`;
            }
            if (pAdvances.length > 0) {
              html += `<h3>Advances</h3>${tableHtml(
                ['Customer', 'Date', 'Total', 'Paid', 'Remaining'],
                pAdvances.map((a) => [a.customerName, fmtDate(a.date), fmt(a.totalAmount || 0), fmt(a.advancePaid || 0), fmt(a.remaining || 0)])
              )}`;
            }
            if (pMovements.length > 0) {
              html += `<h3>Inventory Movements</h3>${tableHtml(
                ['Date', 'Item', 'Type', 'Qty', 'Price'],
                pMovements.map((m) => [fmtDate(m.date), m.skuName || '', m.type === 'in' ? 'Stock In' : 'Stock Out', m.qty, fmt((Number(m.price) || 0) * (Number(m.qty) || 1))])
              )}`;
            }
            if (mode === 'all' && activeTeam.length > 0) {
              html += `<h3>Team &amp; Payroll</h3>${tableHtml(
                ['Name', 'Role', 'Status', 'Salary/Month'],
                team.map((m) => [m.name, m.role || '', m.status || '', fmt(m.salary || 0)]),
                ['', '', 'Total Payroll', fmt(totalPayroll)]
              )}`;
            }
            html += `</div>`;
            return html;
          }).join('');

          const win = window.open('', '_blank');
          win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
            <title>${activeShop.name || 'Shop'} — Complete Report</title>
            <style>
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body { font-family: Arial, sans-serif; font-size: 12px; color: #222; padding: 20px; }
              .report-header { background: ${brandHex}; color: #fff; padding: 16px 20px; border-radius: 8px; margin-bottom: 24px; }
              .report-header h1 { font-size: 20px; font-weight: bold; }
              .report-header p { font-size: 11px; margin-top: 4px; opacity: 0.85; }
              .section { margin-bottom: 36px; page-break-inside: avoid; }
              .section-header { background: #582f0e; color: #fff; padding: 10px 14px; border-radius: 6px; margin-bottom: 12px; }
              .section-title { font-size: 15px; font-weight: bold; }
              .section-sub { font-size: 10px; opacity: 0.8; margin-top: 2px; }
              h3 { font-size: 12px; color: ${brandHex}; margin: 14px 0 6px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
              thead tr { background: ${brandHex}; color: #fff; }
              thead th { padding: 6px 8px; text-align: left; font-size: 11px; }
              tbody tr:nth-child(even) { background: #fdf6ea; }
              tbody td { padding: 5px 8px; border-bottom: 1px solid #e8d5b7; font-size: 11px; }
              tfoot td { padding: 6px 8px; background: #e6d2b9; font-size: 11px; font-weight: bold; }
              .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #b49060; }
              @media print {
                body { padding: 10px; }
                .section { page-break-after: always; }
                .section:last-child { page-break-after: auto; }
              }
            </style>
          </head><body>
            <div class="report-header">
              <h1>${activeShop.name || 'Shop Report'}</h1>
              <p>Complete Report — Daily · Monthly · All Time &nbsp;|&nbsp; Generated: ${new Date().toLocaleDateString()}</p>
            </div>
            ${sectionsHtml}
            <div class="footer">${activeShop.name} &middot; Complete Report &middot; ${new Date().toLocaleDateString()}</div>
          </body></html>`);
          win.document.close();
          win.focus();
          setTimeout(() => { win.print(); }, 400);
        };

        return (
          <div className="space-y-6">

            {/* Period toggle + picker */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
              <div className="flex gap-2 bg-gray-100 rounded-xl p-1 w-fit">
                {[['daily', t('daily')], ['monthly', t('monthly')], ['all', t('allTime')]].map(([v, l]) => (
                  <button key={v} onClick={() => setReportView(v)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${reportView === v ? 'bg-white shadow text-amber-300' : 'text-gray-500'}`}>
                    {l}
                  </button>
                ))}
              </div>
              {reportView === 'daily' && (
                <DatePicker value={reportDate} onChange={(v) => setReportDate(v)} className="w-44" />
              )}
              {reportView === 'monthly' && (
                <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 text-gray-700 font-medium" />
              )}
              <span className="text-sm text-gray-400 font-medium">
                {reportView === 'daily' ? fmtDate(reportDate)
                  : reportView === 'monthly' ? new Date(reportMonth + '-01').toLocaleDateString(locale, { month: 'long', year: 'numeric' })
                    : t('completeOverview')}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={printReport}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-colors shadow-sm"
                  style={{ backgroundColor: '#582f0e' }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print
                </button>
                <button
                  onClick={downloadPDF}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-colors shadow-sm"
                  style={{ backgroundColor: '#936639' }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download PDF
                </button>
              </div>
            </div>

            {/* ── Report Header Banner ── */}
            <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-200">
              <div className="flex items-center justify-between px-6 py-4" style={{ background: 'linear-gradient(135deg, #7a4f2a 0%, #a06835 100%)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.18)' }}>
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-black text-white uppercase tracking-wider">{activeShop.name || 'Shop'} — Full Report</h2>
                    <p className="text-[11px] text-white/60 font-medium leading-tight">
                      {reportView === 'daily'
                        ? `Daily · ${fmtDate(reportDate)}`
                        : reportView === 'monthly'
                          ? `Monthly · ${new Date(reportMonth + '-01').toLocaleDateString(locale, { month: 'long', year: 'numeric' })}`
                          : 'All-Time Overview'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full ${grandProfit >= 0 ? 'bg-emerald-500/30 text-emerald-200' : 'bg-red-500/30 text-red-200'}`}>
                    {grandProfit >= 0 ? '▲ Profitable' : '▼ At Loss'}
                  </span>
                  <span className="text-[10px] text-white/50 font-medium">Generated: {new Date().toLocaleDateString()}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100 bg-amber-50/50">
                {[
                  { label: t('totalIncome'), val: fmt(grandIncome), color: 'text-emerald-600' },
                  { label: t('totalExpenses'), val: fmt(grandExpense), color: 'text-red-500' },
                  { label: t('netProfit'), val: (grandProfit >= 0 ? '+' : '') + fmt(grandProfit), color: grandProfit >= 0 ? 'text-amber-600' : 'text-red-500' },
                  { label: t('transactions'), val: periodTxs.length + ' entries', color: 'text-blue-600' },
                ].map((s) => (
                  <div key={s.label} className="flex flex-col items-center py-3 gap-0.5">
                    <span className={`text-base font-black ${s.color}`}>{s.val}</span>
                    <span className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Module Summary Cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { label: t('transactions'), value: fmt(periodTxIncome - periodTxExpense), sub: `${periodTxs.length} ${t('entries')}`, color: 'text-blue-600', bg: 'bg-blue-500/100/10' },
                { label: t('tab_repairs'), value: fmt(repFeeIncome + repAdvanceIncome - repPartsExpense), sub: `${periodRepairs.length} ${t('repairJobs')}`, color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: t('tab_advances'), value: fmt(advReceived - advGiven), sub: `${periodAdvances.length} ${t('entries')}`, color: 'text-purple-600', bg: 'bg-purple-500/100/10' },
                { label: t('tab_inventory'), value: fmt(invOutIncome - invInExpense), sub: `${t('stockIn')} ${invTotalInQty} / ${t('stockOut')} ${invTotalOutQty}`, color: 'text-sky-600', bg: 'bg-sky-500/100/10' },
                { label: t('cat_Payroll'), value: fmt(totalPayroll), sub: `${activeTeam.length} ${t('activeEmployees')}`, color: 'text-rose-600', bg: 'bg-rose-500/100/10' },
              ].map((c) => (
                <div key={c.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
                  <div className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center mb-2`}>
                    <div className={`w-2.5 h-2.5 rounded-full ${c.color.replace('text-', 'bg-')}`} />
                  </div>
                  <p className={`text-lg font-bold leading-tight ${c.color}`}>{c.value}</p>
                  <p className="text-xs font-semibold text-gray-500 mt-0.5">{c.label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{c.sub}</p>
                </div>
              ))}
            </div>

            {/* ── Transactions ── */}
            {periodTxs.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-800">{t('transactions')}</h3>
                  <div className="flex gap-3 text-xs font-semibold">
                    <span className="text-emerald-600">+{fmt(periodTxIncome)}</span>
                    <span className="text-red-500">-{fmt(periodTxExpense)}</span>
                  </div>
                </div>
                <div className="divide-y divide-gray-200">
                  {periodTxs.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${t.type === 'income' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{t.description}</p>
                        <p className="text-xs text-gray-400">{fmtDate(t.date)} · {t.category}</p>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ${t.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Repairs ── */}
            {periodRepairs.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-800">{t('repairJobs')}</h3>
                  <div className="flex gap-3 text-xs font-semibold">
                    <span className="text-emerald-600">{t('income')}: +{fmt(repFeeIncome + repAdvanceIncome)}</span>
                    <span className="text-red-500">{t('parts')}: -{fmt(repPartsExpense)}</span>
                  </div>
                </div>
                <div className="divide-y divide-gray-200">
                  {periodRepairs.map((r) => (
                    <div key={r.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900">{r.customerName}</p>
                          {statusBadge(r.status)}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{r.device}{r.issue ? ` · ${r.issue}` : ''}</p>
                        {r.partsOrdered && <p className="text-xs text-blue-400 mt-0.5">{t('parts')}: {r.partsOrdered}</p>}
                      </div>
                      <div className="text-right shrink-0 space-y-0.5">
                        {Number(r.partsCost) > 0 && <p className="text-xs text-red-400 font-semibold">-{fmt(r.partsCost)} {t('report_partsAbbr')}</p>}
                        {Number(r.advance) > 0 && <p className="text-xs text-amber-400 font-semibold">+{fmt(r.advance)} {t('report_advAbbr')}</p>}
                        {Number(r.repairCost) > 0 && <p className="text-xs text-emerald-600 font-semibold">+{fmt(r.repairCost)} {t('report_repAbbr')}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Advances ── */}
            {periodAdvances.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-800">{t('tab_advances')}</h3>
                  <div className="flex gap-3 text-xs font-semibold">
                    <span className="text-red-500">{t('given')}: -{fmt(advGiven)}</span>
                    <span className="text-emerald-600">{t('received')}: +{fmt(advReceived)}</span>
                    {advDueTotal > 0 && <span className="text-amber-500">{t('toSettle')}: {fmt(advDueTotal)}</span>}
                  </div>
                </div>
                <div className="divide-y divide-gray-200">
                  {periodAdvances.map((a) => (
                    <div key={a.id} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{a.customerName}</p>
                        {a.description && <p className="text-xs text-gray-400 mt-0.5">{a.description}</p>}
                        <p className="text-xs text-gray-400 mt-0.5">{fmtDate(a.date)}</p>
                      </div>
                      <div className="text-right shrink-0 space-y-0.5">
                        <p className="text-xs text-gray-500">{t('report_total')}: <span className="font-bold text-gray-700">{fmt(a.totalAmount)}</span></p>
                        <p className="text-xs text-emerald-600 font-semibold">{t('report_paid')}: {fmt(a.advancePaid)}</p>
                        {Number(a.remaining) > 0 && <p className="text-xs text-red-400 font-semibold">{t('report_remaining')}: {fmt(a.remaining)}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Inventory Movements ── */}
            {periodMovements.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-800">{t('inventoryMovements')}</h3>
                  <div className="flex gap-3 text-xs font-semibold">
                    <span className="text-sky-600">{t('stockIn')} ×{invTotalInQty} · -{fmt(invInExpense)}</span>
                    <span className="text-emerald-600">{t('sold')} ×{invTotalOutQty} · +{fmt(invOutIncome)}</span>
                  </div>
                </div>
                <div className="divide-y divide-gray-200">
                  {periodMovements.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${m.type === 'in' ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {m.type === 'in' ? t('stockIn') : t('stockOut')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{m.skuName} <span className="text-gray-400 font-normal">×{m.qty}</span></p>
                        <p className="text-xs text-gray-400">{m.skuCode}{m.note ? ` · ${m.note}` : ''} · {fmtDate(m.date)}</p>
                      </div>
                      {Number(m.price) > 0 && (
                        <span className={`text-sm font-bold shrink-0 ${m.type === 'in' ? 'text-red-400' : 'text-emerald-600'}`}>
                          {m.type === 'in' ? '-' : '+'}{fmt((Number(m.price) || 0) * (Number(m.qty) || 1))}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Secondhand ── */}
            {(shBought.length > 0 || shSold.length > 0) && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-800">{t('tab_secondhand')}</h3>
                  <div className="flex gap-3 text-xs font-semibold">
                    <span className="text-emerald-400">{t('report_bought')}: -{fmt(shBoughtCost)}</span>
                    <span className="text-emerald-600">{t('sold')}: +{fmt(shSoldRevenue)}</span>
                    <span className={shProfit >= 0 ? 'text-amber-400' : 'text-red-500'}>{t('profit')}: {fmt(shProfit)}</span>
                  </div>
                </div>
                <div className="divide-y divide-gray-200">
                  {[...shBought.map((i) => ({ ...i, _type: 'bought' })), ...shSold.map((i) => ({ ...i, _type: 'sold' }))
                  ].sort((a, b) => (b.buyDate || '').localeCompare(a.buyDate || '')).map((item) => {
                    const isSold = item._type === 'sold';
                    const profit = isSold ? (Number(item.sellPrice) || 0) - (Number(item.buyPrice) || 0) : null;
                    return (
                      <div key={`${item._type}-${item.id}`} className="flex items-center gap-3 px-5 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${isSold ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/20 text-emerald-300'}`}>
                          {isSold ? t('sold') : t('report_bought')}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800">{item.itemName}{item.brand ? ` · ${item.brand}` : ''}</p>
                          <p className="text-xs text-gray-400">{item.condition}{item.model ? ` · ${item.model}` : ''}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-gray-500">{t('cost')}: {fmt(item.buyPrice)}</p>
                          {isSold && <p className="text-xs text-emerald-600 font-semibold">{t('sold')}: {fmt(item.sellPrice)}</p>}
                          {isSold && <p className={`text-xs font-bold ${profit >= 0 ? 'text-amber-400' : 'text-red-500'}`}>{profit >= 0 ? '+' : ''}{fmt(profit)}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Team / Payroll ── */}
            {activeTeam.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-800">{t('teamAndPayroll')}</h3>
                  <span className="text-xs font-semibold text-rose-600">{t('monthly')}: {fmt(totalPayroll)}</span>
                </div>
                <div className="divide-y divide-gray-200">
                  {team.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-300 font-bold text-sm shrink-0">
                        {m.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-800">{m.name}</p>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${m.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {m.status === 'active' ? t('activeStatus') : t('onLeave')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">{m.role}{m.phone ? ` · ${m.phone}` : ''}</p>
                      </div>
                      <p className="text-sm font-bold text-gray-700 shrink-0">{fmt(m.salary || 0)}<span className="text-xs font-normal text-gray-400">{t('perMonth')}</span></p>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-xs text-gray-500">{activeTeam.length} {t('report_activeCount')} · {team.length - activeTeam.length} {t('report_leaveCount')}</span>
                  <span className="text-sm font-bold text-rose-600">{fmt(totalPayroll)}{t('perMonth')}</span>
                </div>
              </div>
            )}

            {!hasAnyData && (
              <div className="bg-white rounded-2xl py-16 text-center border border-gray-200 shadow-sm">
                <svg className="w-12 h-12 mx-auto mb-3 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-400 font-medium">{t('noDataForPeriod')}</p>
                <p className="text-gray-400 text-sm mt-1">{t('addAnyActivity')}</p>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── TEAM PAGE ── */}
      {page === 'team' && (() => {
        const team = activeShop.team || [];
        const activeMembers = team.filter((m) => m.status === 'active');
        const totalPayroll = activeMembers.reduce((s, m) => s + (Number(m.salary) || 0), 0);
        return (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 text-center">
                <p className="text-3xl font-bold text-amber-400">{team.length}</p>
                <p className="text-sm text-gray-500 mt-1">{t('totalStaff')}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 text-center">
                <p className="text-3xl font-bold" style={{ color: '#936639' }}>{activeMembers.length}</p>
                <p className="text-sm text-gray-500 mt-1">{t('active')}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 text-center">
                <p className="text-xl font-bold text-amber-600">{fmt(totalPayroll)}</p>
                <p className="text-sm text-gray-500 mt-1">{t('monthlyPayroll')}</p>
              </div>
            </div>

            {/* Members */}
            {team.length === 0 && !addMemberOpen && (
              <div className="bg-white rounded-2xl py-20 text-center border border-gray-200 shadow-sm">
                <svg className="w-14 h-14 mx-auto mb-4 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-gray-400 font-medium">{t('noTeamMembers')}</p>
                <p className="text-gray-400 text-sm mt-1">{t('addFirstStaff')}</p>
              </div>
            )}

            {team.map((member) => (
              <div key={member.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 flex flex-col gap-4">
                {editMemberId === member.id ? (
                  /* ── Inline Edit Form ── */
                  <div>
                    <p className="text-xs font-bold text-amber-400 mb-3 uppercase tracking-wide">{t('editMember')}</p>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      {[
                        ['name', `${t('fullName')} *`, 'text'],
                        ['phone', t('phone'), 'text'],
                        ['salary', `${t('monthlySalary')} (${currencyObj.symbol}/${t('perMonth')})`, 'number'],
                        ['bankName', t('bankName'), 'text'],
                        ['iban', t('iban'), 'text'],
                        ['accountNo', t('accountNo'), 'text'],
                        ['accountHolder', t('accountHolder'), 'text'],
                      ].map(([key, label, type]) => (
                        <div key={key} className={key === 'iban' || key === 'name' ? 'col-span-2' : ''}>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                          <input type={type} min={type === 'number' ? '0' : undefined}
                            value={editMemberForm[key] || ''}
                            onChange={(e) => setEditMemberForm((f) => ({ ...f, [key]: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        </div>
                      ))}
                    </div>
                    <div className="mb-3">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">{t('role')}</label>
                      <select value={editMemberForm.role || 'Technician'}
                        onChange={(e) => setEditMemberForm((f) => ({ ...f, role: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white">
                        {TEAM_ROLES.map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditMemberId(null)}
                        className="flex-1 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors">{t('cancel')}</button>
                      <button onClick={() => {
                        updateTeamMember(activeShop.id, member.id, {
                          name: editMemberForm.name,
                          role: editMemberForm.role,
                          salary: Number(editMemberForm.salary) || 0,
                          phone: editMemberForm.phone,
                          bankName: editMemberForm.bankName,
                          iban: editMemberForm.iban,
                          accountNo: editMemberForm.accountNo,
                          accountHolder: editMemberForm.accountHolder,
                        });
                        setEditMemberId(null);
                      }} className="flex-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors">{t('saveChanges')}</button>
                    </div>
                  </div>
                ) : (
                  /* ── Normal View ── */
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-300 font-bold text-lg">
                      {member.name?.charAt(0)?.toUpperCase()}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-bold text-gray-900">{member.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${member.status === 'active' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                          {member.status === 'active' ? 'Attivo' : 'In Congedo'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 flex-wrap">
                        <span className="text-sm text-amber-400 font-medium">{member.role}</span>
                        {member.phone && <span className="text-sm text-gray-400">{member.phone}</span>}
                        <span className="text-sm font-bold text-gray-700">{fmt(member.salary || 0)}<span className="font-normal text-gray-400">/{t('perMonth')}</span></span>
                        <span className="text-xs text-gray-400">{t('joined')} {new Date(member.joinDate).toLocaleDateString(locale === 'en' ? 'en-US' : 'it-IT', { month: 'short', year: 'numeric' })}</span>
                      </div>
                      {(member.bankName || member.iban) && (
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {member.bankName && <span className="text-xs text-gray-400">{member.bankName}</span>}
                          {member.iban && <span className="text-xs font-mono text-gray-400">{member.iban}</span>}
                        </div>
                      )}
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setPayMember(member)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-bold transition-colors shadow-sm" style={{ backgroundColor: '#936639' }}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {t('pay')}
                      </button>
                      <button
                        onClick={() => { setEditMemberId(member.id); setEditMemberForm({ name: member.name, role: member.role, salary: member.salary || '', phone: member.phone || '', bankName: member.bankName || '', iban: member.iban || '', accountNo: member.accountNo || '', accountHolder: member.accountHolder || '' }); }}
                        className="p-2 rounded-xl border border-gray-200 hover:border-amber-400 hover:bg-amber-500/10 text-gray-400 hover:text-amber-400 transition-colors"
                        title={t('edit')}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => updateTeamMember(activeShop.id, member.id, { status: member.status === 'active' ? 'on-leave' : 'active' })}
                        className="p-2 rounded-xl border border-gray-200 hover:border-amber-300 hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors"
                        title={member.status === 'active' ? t('markOnLeave') : t('markActive')}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteTeamMember(activeShop.id, member.id)}
                        className="p-2 rounded-xl border border-gray-200 hover:border-red-300 hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                        title="Rimuovi"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add Member */}
            {addMemberOpen ? (
              <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-dashed border-amber-500/30">
                <p className="text-sm font-bold text-amber-400 mb-4">{t('newStaffMember')}</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{t('fullName')} *</label>
                    <input className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400" value={newMember.name} onChange={(e) => { setNewMember((m) => ({ ...m, name: e.target.value })); setNewMemberError(''); }} placeholder="Mario Rossi" autoFocus />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{t('phone')}</label>
                    <input className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400" value={newMember.phone} onChange={(e) => setNewMember((m) => ({ ...m, phone: e.target.value }))} placeholder="+39 320 0000000" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                    <input type="email" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400" value={newMember.email} onChange={(e) => setNewMember((m) => ({ ...m, email: e.target.value }))} placeholder="mario@example.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{t('accountHolder')}</label>
                    <input className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400" value={newMember.accountHolder} onChange={(e) => setNewMember((m) => ({ ...m, accountHolder: e.target.value }))} placeholder="Mario Rossi" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{t('bankName')}</label>
                    <input className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400" value={newMember.bankName} onChange={(e) => setNewMember((m) => ({ ...m, bankName: e.target.value }))} placeholder="UniCredit, Intesa Sanpaolo..." />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{t('iban')}</label>
                    <input className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400" value={newMember.iban} onChange={(e) => setNewMember((m) => ({ ...m, iban: e.target.value }))} placeholder="IT60X0542..." />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{t('accountNo')}</label>
                    <input className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400" value={newMember.accountNo} onChange={(e) => setNewMember((m) => ({ ...m, accountNo: e.target.value }))} placeholder="1234-5678-9012" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">{t('role')}</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {TEAM_ROLES.map((r) => (
                      <button key={r} type="button" onClick={() => setNewMember((m) => ({ ...m, role: r }))} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${newMember.role === r ? 'border-amber-500 bg-amber-500/10 text-amber-300' : 'border-gray-200 text-gray-500 hover:border-amber-400'}`}>{r}</button>
                    ))}
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{t('monthlySalary')} ({currencyObj.symbol})</label>
                  <input className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400" type="number" min="0" value={newMember.salary} onChange={(e) => setNewMember((m) => ({ ...m, salary: e.target.value }))} placeholder="35000" />
                </div>
                {newMemberError && <p className="text-xs text-red-500 mb-3">{newMemberError}</p>}
                <div className="flex gap-3">
                  <button type="button" onClick={() => { setAddMemberOpen(false); setNewMemberError(''); setNewMember({ name: '', role: 'Technician', salary: '', phone: '', email: '', bankName: '', iban: '', accountNo: '', accountHolder: '' }); }} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm">{t('cancel')}</button>
                  <button type="button" onClick={handleAddMember} className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors text-sm shadow-sm">{t('addMember')}</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setAddMemberOpen(true)} className="w-full flex items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-gray-200 text-gray-400 font-semibold rounded-2xl hover:border-amber-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                {t('addStaffMember')}
              </button>
            )}
          </div>
        );
      })()}

      {/* Pay Member Modal */}
      {payMember && (
        <PayMemberModal shop={activeShop} member={payMember} onClose={() => setPayMember(null)} />
      )}

      {/* ── GLOBAL SEARCH OVERLAY ── */}
      {searchOpen && (() => {
        const q = searchQuery.trim().toLowerCase();
        const highlight = (text) => {
          if (!q || !text) return text;
          const idx = String(text).toLowerCase().indexOf(q);
          if (idx === -1) return text;
          return <>{String(text).slice(0, idx)}<mark className="bg-amber-500/100/30 text-amber-900 rounded px-0.5">{String(text).slice(idx, idx + q.length)}</mark>{String(text).slice(idx + q.length)}</>;
        };
        const matches = (val) => val && String(val).toLowerCase().includes(q);

        const txResults = q ? (activeShop.transactions || []).filter((t) =>
          matches(t.description) || matches(t.clientName) || matches(t.deviceModel) || matches(t.issue) || matches(t.category) || matches(t.date)
        ) : [];

        const repairResults = q ? (activeShop.repairs || []).filter((r) =>
          matches(r.customerName) || matches(r.phone) || matches(r.device) || matches(r.issue) || matches(r.partsOrdered) || matches(r.status)
        ) : [];

        const advanceResults = q ? (activeShop.advances || []).filter((a) =>
          matches(a.customerName) || matches(a.phone) || matches(a.description)
        ) : [];

        const skuResults = q ? (activeShop.skus || []).filter((sk) =>
          matches(sk.name) || matches(sk.code) || matches(sk.category) || matches(sk.description)
        ) : [];

        const secondhandResults = q ? (activeShop.secondhand || []).filter((sh) =>
          matches(sh.itemName) || matches(sh.brand) || matches(sh.model) || matches(sh.imei) ||
          matches(sh.sellerName) || matches(sh.sellerPhone) || matches(sh.buyerName) || matches(sh.buyerPhone) || matches(sh.notes)
        ) : [];

        const teamResults = q ? (activeShop.team || []).filter((m) =>
          matches(m.name) || matches(m.phone) || matches(m.role) || matches(m.bankName) || matches(m.iban) || matches(m.accountNo) || matches(m.accountHolder)
        ) : [];

        const totalResults = txResults.length + repairResults.length + advanceResults.length + skuResults.length + secondhandResults.length + teamResults.length;
        const STATUS_LABEL = { pending: 'In Attesa', parts_ordered: 'Parti Ordinate', ready: 'Pronto', delivered: 'Consegnato' };
        const STATUS_COLOR = { pending: 'bg-orange-100 text-orange-600', parts_ordered: 'bg-blue-100 text-blue-600', ready: 'bg-emerald-100 text-emerald-600', delivered: 'bg-gray-100 text-gray-500' };

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex flex-col items-center pt-16 px-4 pb-6" onClick={() => setSearchOpen(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {/* Search input */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200">
                <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="flex-1 text-base text-gray-800 placeholder-gray-400 focus:outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
                <button onClick={() => setSearchOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors ml-1">
                  <span className="text-xs font-semibold border border-gray-200 rounded px-1.5 py-0.5">ESC</span>
                </button>
              </div>

              {/* Results */}
              <div className="overflow-y-auto max-h-[65vh]">
                {/* Empty state */}
                {!q && (
                  <div className="py-16 text-center">
                    <svg className="w-12 h-12 mx-auto mb-3 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <p className="text-gray-400 font-medium text-sm">{t('typeToSearch')}</p>
                    <p className="text-gray-400 text-xs mt-1">{t('searchModules')}</p>
                  </div>
                )}
                {q && totalResults === 0 && (
                  <div className="py-16 text-center">
                    <p className="text-gray-500 font-medium">{t('noResultsFor')} &ldquo;{searchQuery}&rdquo;</p>
                    <p className="text-gray-400 text-xs mt-1">{t('tryDifferent')}</p>
                  </div>
                )}

                {/* Transactions */}
                {txResults.length > 0 && (
                  <div>
                    <div className="px-5 py-2 bg-gray-50 border-b border-gray-200 sticky top-0">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('transactions')}</span>
                      <span className="ml-2 text-xs font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">{txResults.length}</span>
                    </div>
                    {txResults.map((tx) => (
                      <button key={tx.id} className="w-full flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left border-b border-gray-200 last:border-0"
                        onClick={() => { setPage('overview'); setSearchOpen(false); }}>
                        <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${tx.type === 'income' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{highlight(tx.description)}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                            {tx.clientName && <span className="text-xs text-amber-400">{highlight(tx.clientName)}</span>}
                            {tx.deviceModel && <span className="text-xs text-gray-400">{highlight(tx.deviceModel)}</span>}
                            {tx.issue && <span className="text-xs text-orange-400 truncate max-w-48">{highlight(tx.issue)}</span>}
                            <span className="text-xs text-gray-400">{fmtDate(tx.date)}</span>
                          </div>
                        </div>
                        <span className={`text-sm font-bold shrink-0 ${tx.type === 'income' ? 'text-emerald-500' : 'text-red-500'}`}>{tx.type === 'income' ? '+' : '−'}{fmt(tx.amount)}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Repairs */}
                {repairResults.length > 0 && (
                  <div>
                    <div className="px-5 py-2 bg-gray-50 border-b border-gray-200 sticky top-0">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('tab_repairs')}</span>
                      <span className="ml-2 text-xs font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">{repairResults.length}</span>
                    </div>
                    {repairResults.map((r) => (
                      <button key={r.id} className="w-full flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left border-b border-gray-200 last:border-0"
                        onClick={() => { setPage('repairs'); setSearchOpen(false); }}>
                        <div className="mt-1 w-2.5 h-2.5 rounded-full bg-purple-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{highlight(r.customerName)}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                            {r.phone && <span className="text-xs text-amber-400 font-mono">{highlight(r.phone)}</span>}
                            {r.device && <span className="text-xs text-gray-400">{highlight(r.device)}</span>}
                            {r.issue && <span className="text-xs text-orange-400 truncate max-w-48">{highlight(r.issue)}</span>}
                          </div>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[r.status] || 'bg-gray-100 text-gray-500'}`}>{STATUS_LABEL[r.status] || r.status}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Advances */}
                {advanceResults.length > 0 && (
                  <div>
                    <div className="px-5 py-2 bg-gray-50 border-b border-gray-200 sticky top-0">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('tab_advances')}</span>
                      <span className="ml-2 text-xs font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">{advanceResults.length}</span>
                    </div>
                    {advanceResults.map((a) => {
                      const paid = (a.payments || []).reduce((s, p) => s + p.amount, 0) + (a.advancePaid || 0);
                      const remaining = Math.max(0, (a.totalAmount || 0) - paid);
                      return (
                        <button key={a.id} className="w-full flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left border-b border-gray-200 last:border-0"
                          onClick={() => { setPage('advances'); setSearchOpen(false); }}>
                          <div className="mt-1 w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{highlight(a.customerName)}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                              {a.phone && <span className="text-xs text-amber-400 font-mono">{highlight(a.phone)}</span>}
                              {a.description && <span className="text-xs text-gray-400 truncate max-w-48">{highlight(a.description)}</span>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-gray-500">Totale: <span className="font-bold text-gray-700">{fmt(a.totalAmount || 0)}</span></p>
                            <p className="text-xs text-red-500 font-semibold">Da Saldare: {fmt(remaining)}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* SKUs */}
                {skuResults.length > 0 && (
                  <div>
                    <div className="px-5 py-2 bg-gray-50 border-b border-gray-200 sticky top-0">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('tab_inventory')}</span>
                      <span className="ml-2 text-xs font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">{skuResults.length}</span>
                    </div>
                    {skuResults.map((sk) => (
                      <button key={sk.id} className="w-full flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left border-b border-gray-200 last:border-0"
                        onClick={() => { setPage('inventory'); setSearchOpen(false); }}>
                        <div className="mt-1 w-2.5 h-2.5 rounded-full bg-blue-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold font-mono text-amber-500">{highlight(sk.code)}</span>
                            <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{sk.category}</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 mt-0.5">{highlight(sk.name)}</p>
                          {sk.description && <p className="text-xs text-gray-400">{highlight(sk.description)}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-lg font-bold ${sk.stock <= (sk.lowStockAt || 5) ? 'text-red-500' : 'text-amber-400'}`}>{sk.stock || 0}</p>
                          <p className="text-xs text-gray-400">{t('inStockLower')}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Secondhand */}
                {secondhandResults.length > 0 && (
                  <div>
                    <div className="px-5 py-2 bg-gray-50 border-b border-gray-200 sticky top-0">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('tab_secondhand')}</span>
                      <span className="ml-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">{secondhandResults.length}</span>
                    </div>
                    {secondhandResults.map((sh) => {
                      const isSold = sh.status === 'sold';
                      return (
                        <button key={sh.id} className="w-full flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left border-b border-gray-200 last:border-0"
                          onClick={() => { setPage('secondhand'); setSearchOpen(false); }}>
                          <div className="mt-1 w-2.5 h-2.5 rounded-full bg-violet-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{highlight(sh.itemName)}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                              {(sh.brand || sh.model) && <span className="text-xs text-gray-400">{[sh.brand, sh.model].filter(Boolean).join(' · ')}</span>}
                              {sh.imei && <span className="text-xs font-mono text-gray-400">{highlight(sh.imei)}</span>}
                              {sh.sellerName && <span className="text-xs text-amber-400">{highlight(sh.sellerName)}</span>}
                              {sh.buyerName && <span className="text-xs text-emerald-500">{highlight(sh.buyerName)}</span>}
                            </div>
                          </div>
                          <div className="text-right shrink-0 space-y-1">
                            <span className={`block text-xs font-bold px-2 py-0.5 rounded-full ${isSold ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{isSold ? t('sold') : t('inStock')}</span>
                            <p className="text-xs text-gray-500 font-semibold">{fmt(isSold ? sh.sellPrice : sh.buyPrice)}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Team */}
                {teamResults.length > 0 && (
                  <div>
                    <div className="px-5 py-2 bg-gray-50 border-b border-gray-200 sticky top-0">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('tab_team')}</span>
                      <span className="ml-2 text-xs font-bold text-pink-500 bg-pink-500/100/10 px-1.5 py-0.5 rounded-full">{teamResults.length}</span>
                    </div>
                    {teamResults.map((m) => (
                      <button key={m.id} className="w-full flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left border-b border-gray-200 last:border-0"
                        onClick={() => { setPage('team'); setSearchOpen(false); }}>
                        <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-pink-600">{m.name?.charAt(0)?.toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{highlight(m.name)}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                            <span className="text-xs text-gray-400">{m.role}</span>
                            {m.phone && <span className="text-xs text-amber-400 font-mono">{highlight(m.phone)}</span>}
                            {m.bankName && <span className="text-xs text-gray-400">{highlight(m.bankName)}</span>}
                            {m.iban && <span className="text-xs font-mono text-gray-400">{highlight(m.iban)}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-gray-700">{fmt(m.salary || 0)}</p>
                          <p className="text-xs text-gray-400">{t('salary')}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Footer hint */}
                {q && totalResults > 0 && (
                  <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                    <span className="text-xs text-gray-400">{totalResults} {totalResults !== 1 ? t('results') : t('result')} &ldquo;{searchQuery}&rdquo;</span>
                    <span className="text-xs text-gray-400">{t('clickResultToJump')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── INVENTORY / SKU PAGE ── */}
      {page === 'inventory' && (() => {
        const SKU_CATS = ['Ricambi', 'Accessori', 'Telefoni', 'Strumenti', 'Altro'];
        const skuCatLabel = { Ricambi: t('skuCat_Parts'), Accessori: t('skuCat_Accessories'), Telefoni: t('skuCat_Phones'), Strumenti: t('skuCat_Tools'), Altro: t('skuCat_Other') };
        const skus = activeShop.skus || [];
        const filtered = skus.filter((sk) => {
          const matchCat = skuCatFilter === 'all' || sk.category === skuCatFilter;
          const q = skuSearch.toLowerCase();
          const matchSearch = !q || sk.name?.toLowerCase().includes(q) || sk.code?.toLowerCase().includes(q) || sk.barcode?.toLowerCase().includes(q);
          return matchCat && matchSearch;
        });
        const lowStock = skus.filter((sk) => sk.stock <= (sk.lowStockAt || 5));
        const totalStockValue = skus.reduce((s, sk) => s + (sk.stock || 0) * (sk.buyPrice || 0), 0);
        const totalSellValue = skus.reduce((s, sk) => s + (sk.stock || 0) * (sk.sellPrice || 0), 0);
        const totalItems = skus.reduce((s, sk) => s + (sk.stock || 0), 0);
        const totalStockProfit = skus.reduce((total, sk) => {
          const soldProfit = (sk.movements || []).filter(m => m.type === 'out').reduce((s, m) => {
            const salePrice = Number(m.price) || Number(sk.sellPrice) || 0;
            const costPrice = Number(sk.buyPrice) || 0;
            return s + (salePrice - costPrice) * (Number(m.qty) || 1);
          }, 0);
          return total + soldProfit;
        }, 0);

        const handleAddSku = () => {
          if (!skuForm.name.trim()) { setSkuFormError(t('productNameRequired')); return; }
          const openingQty = skuForm.stock ? Number(skuForm.stock) : 0;
          const openingBuy = skuForm.buyPrice ? Number(skuForm.buyPrice) : 0;
          addSku({
            name: skuForm.name.trim(),
            category: skuForm.category,
            description: skuForm.description.trim(),
            barcode: skuForm.barcode.trim(),
            buyPrice: openingBuy,
            sellPrice: skuForm.sellPrice ? Number(skuForm.sellPrice) : 0,
            stock: openingQty,
            lowStockAt: skuForm.lowStockAt ? Number(skuForm.lowStockAt) : 5,
          });
          setSkuForm({ name: '', category: 'Ricambi', description: '', buyPrice: '', sellPrice: '', stock: '', lowStockAt: '5', barcode: '' });
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

        const handleBulkScan = () => {
          if (bulkScanMode) { setSkuScanning(false); setBulkScanMode(false); return; }
          setBulkScanMode(true);
          setAddSkuOpen(false);
          setSkuScanning(true);
        };

        const bulkScannedRef = new Set(scanQueue.map((q) => q.barcode));
        const handleBulkScanResult = (code) => {
          if (bulkScannedRef.has(code)) return;
          const alreadyInInventory = skus.some((sk) => sk.barcode === code || sk.code === code);
          if (alreadyInInventory) return;
          bulkScannedRef.add(code);
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
          if (!skuMoveForm.qty || Number(skuMoveForm.qty) <= 0) return;
          const sk = skus.find((s) => s.id === skuId);
          addSkuMovement(activeShop.id, skuId, {
            type: skuMoveForm.type,
            qty: Number(skuMoveForm.qty),
            note: skuMoveForm.note.trim(),
            price: skuMoveForm.price ? Number(skuMoveForm.price) : 0,
            skuName: sk?.name || '',
            buyPrice: sk?.buyPrice || 0,
          });
          setSkuMoveOpen(null);
          setSkuMoveForm({ type: 'in', qty: '', note: '', price: '' });
        };

        const handleSkuEdit = (skuId) => {
          updateSku(activeShop.id, skuId, {
            name: skuEditForm.name,
            category: skuEditForm.category,
            description: skuEditForm.description,
            buyPrice: Number(skuEditForm.buyPrice) || 0,
            sellPrice: Number(skuEditForm.sellPrice) || 0,
            lowStockAt: Number(skuEditForm.lowStockAt) || 5,
          });
          setSkuEditId(null);
        };

        return (
          <div className="space-y-5">

            {/* Summary strip */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
                <p className="text-2xl font-bold" style={{ color: '#936639' }}>{skus.length}</p>
                <p className="text-sm text-gray-500 mt-1 font-medium">{t('productsSKUs')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{totalItems} {t('totalUnits')}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
                <p className="text-xl font-bold" style={{ color: '#936639' }}>{fmt(totalStockValue)}</p>
                <p className="text-sm text-gray-500 mt-1 font-medium">{t('stockValueCost')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t('atBuyPrice')}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
                <p className="text-xl font-bold" style={{ color: '#936639' }}>{fmt(totalSellValue)}</p>
                <p className="text-sm text-gray-500 mt-1 font-medium">{t('stockValueSell')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t('atSellPrice')}</p>
              </div>
              <div className={`rounded-2xl p-5 shadow-sm border ${totalStockProfit > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-gray-200'}`}>
                <p className={`text-xl font-bold ${totalStockProfit > 0 ? 'text-emerald-600' : totalStockProfit < 0 ? 'text-red-500' : 'text-gray-400'}`}>{fmt(totalStockProfit)}</p>
                <p className="text-sm text-gray-500 mt-1 font-medium">{t('stockProfitOnly')}</p>
                <p className="text-xs text-gray-400 mt-0.5">Sell − Buy × Qty Sold</p>
              </div>
              <div className={`rounded-2xl p-5 shadow-sm border ${lowStock.length > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-gray-200'}`}>
                <p className={`text-2xl font-bold ${lowStock.length > 0 ? 'text-red-500' : 'text-gray-400'}`}>{lowStock.length}</p>
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
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 max-w-xs">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400 bg-white"
                  placeholder={t('searchByNameOrCode')}
                  value={skuSearch} onChange={(e) => setSkuSearch(e.target.value)}
                />
              </div>
              {/* Category filter */}
              <div className="flex gap-1.5 flex-wrap">
                {['all', ...SKU_CATS].map((c) => (
                  <button key={c} onClick={() => setSkuCatFilter(c)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${skuCatFilter === c ? 'bg-amber-500 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-200 hover:border-amber-400'
                      }`}>
                    {c === 'all' ? t('all') : skuCatLabel[c] || c}
                  </button>
                ))}
              </div>
              <button onClick={() => setAddSkuOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm shrink-0 ml-auto">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {t('addProduct')}
              </button>
              <button onClick={handleSingleScan}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors shadow-sm shrink-0 ${skuScanning && !bulkScanMode ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-emerald-500 hover:bg-emerald-600 text-white'}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 12h10" />
                </svg>
                {t('scanBarcode')}
              </button>
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
              const isLow = sk.stock <= (sk.lowStockAt || 5);
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
                  <div className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
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
                                <label className="block text-xs font-semibold text-gray-500 mb-0.5">Nome</label>
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
                                <label className="block text-xs font-semibold text-gray-500 mb-0.5">Descrizione</label>
                                <input className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" value={skuEditForm.description} onChange={(e) => setSkuEditForm((f) => ({ ...f, description: e.target.value }))} />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => setSkuEditId(null)} className="flex-1 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors">{t('cancel')}</button>
                              <button onClick={() => handleSkuEdit(sk.id)} className="flex-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors">Salva</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-base font-bold text-gray-900">{sk.name}</p>
                            {sk.description && <p className="text-xs text-gray-400 mt-0.5">{sk.description}</p>}
                            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm">
                              <div className="text-gray-500">{t('buy')} <span className="font-bold text-gray-800">{fmt(sk.buyPrice || 0)}</span></div>
                              <div className="text-gray-500">{t('sell')} <span className="font-bold text-emerald-600">{fmt(sk.sellPrice || 0)}</span></div>
                              {margin !== null && <div className="text-gray-400 text-xs">{t('margin')} <span className="font-semibold text-amber-400">{margin}%</span></div>}
                              <div className="text-gray-500">{t('stockValue')} <span className="font-semibold text-blue-600">{fmt((sk.stock || 0) * (sk.buyPrice || 0))}</span></div>
                              {soldQty > 0 && (
                                <div className={`text-xs px-2.5 py-1 rounded-lg font-semibold ${productProfit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                                  💰 {t('stockProfitOnly')}: {fmt(productProfit)} <span className="font-normal opacity-70">({soldQty} sold)</span>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Right: stock + actions */}
                      {!isEditing && (
                        <div className="flex flex-col items-center gap-3 shrink-0">
                          <div className={`text-center rounded-2xl px-5 py-3 ${isLow ? 'bg-red-50' : 'bg-amber-500/10'}`}>
                            <p className={`text-3xl font-bold ${isLow ? 'text-red-500' : 'text-amber-400'}`}>{sk.stock || 0}</p>
                            <p className="text-xs font-medium text-gray-400 mt-0.5">in magazzino</p>
                          </div>
                          <div className="flex gap-1.5">
                            <button onClick={() => { setSkuMoveOpen(isMoveOpen ? null : sk.id); setSkuMoveForm({ type: 'in', qty: '', note: '', price: String(sk.buyPrice || '') }); }}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-500/20 text-emerald-700 text-xs font-bold border border-emerald-200 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg>
                              {t('stock')}
                            </button>
                            <button onClick={() => { setSkuEditId(sk.id); setSkuEditForm({ name: sk.name, category: sk.category, description: sk.description || '', buyPrice: sk.buyPrice || '', sellPrice: sk.sellPrice || '', lowStockAt: sk.lowStockAt || 5 }); }}
                              className="p-1.5 rounded-xl border border-gray-200 hover:border-amber-400 hover:bg-amber-500/10 text-gray-400 hover:text-amber-400 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button onClick={() => setSkuDeleteId(sk.id)}
                              className="p-1.5 rounded-xl border border-gray-200 hover:border-red-300 hover:bg-red-50 text-gray-400 hover:text-red-400 transition-colors">
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
                        <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wide">{t('stockMovement')}</p>
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo</label>
                            <div className="flex gap-2">
                              {[['in', t('stockIn')], ['out', t('stockOut')]].map(([v, l]) => (
                                <button key={v} onClick={() => {
                                  const defaultPrice = v === 'out' ? (sk.sellPrice || '') : (sk.buyPrice || '');
                                  setSkuMoveForm((f) => ({ ...f, type: v, price: String(defaultPrice) }));
                                }}
                                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${skuMoveForm.type === v
                                    ? v === 'in' ? 'bg-amber-500 text-white border-amber-500' : 'bg-red-500 text-white border-red-500'
                                    : 'border-gray-200 text-gray-500 hover:border-amber-400'
                                    }`}>{l}</button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">{t('quantity')}</label>
                            <input type="number" min="1" placeholder="e.g. 10"
                              className="w-24 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
                              value={skuMoveForm.qty} onChange={(e) => setSkuMoveForm((f) => ({ ...f, qty: e.target.value }))} autoFocus />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">
                              {skuMoveForm.type === 'in' ? `Buy Price (${currencyObj.symbol})` : `Sell Price (${currencyObj.symbol})`}
                            </label>
                            <input type="number" min="0" placeholder={t('perUnit')}
                              className="w-28 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
                              value={skuMoveForm.price} onChange={(e) => setSkuMoveForm((f) => ({ ...f, price: e.target.value }))} />
                          </div>
                          <div className="flex-1 min-w-32">
                            <label className="block text-xs font-semibold text-gray-500 mb-1">Nota</label>
                            <input placeholder={t('supplierReason')}
                              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
                              value={skuMoveForm.note} onChange={(e) => setSkuMoveForm((f) => ({ ...f, note: e.target.value }))} />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleSkuMove(sk.id)}
                              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors">Salva</button>
                            <button onClick={() => setSkuMoveOpen(null)}
                              className="px-3 py-2 border border-gray-200 text-gray-500 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">{t('cancel')}</button>
                          </div>
                        </div>
                        {/* Live profit preview when selling */}
                        {skuMoveForm.type === 'out' && skuMoveForm.qty > 0 && skuMoveForm.price > 0 && (() => {
                          const qty = Number(skuMoveForm.qty) || 0;
                          const price = Number(skuMoveForm.price) || 0;
                          const cost = (sk.buyPrice || 0) * qty;
                          const rev = price * qty;
                          const profit = rev - cost;
                          return (
                            <div className="mt-3 flex flex-wrap gap-3 p-3 bg-gray-50 rounded-xl text-xs font-semibold">
                              <span className="text-gray-500">Revenue: <span className="text-gray-800">{fmt(rev)}</span></span>
                              <span className="text-gray-500">Cost: <span className="text-gray-800">{fmt(cost)}</span></span>
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
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{t('category')}</label>
                    <select className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                      value={skuForm.category} onChange={(e) => setSkuForm((f) => ({ ...f, category: e.target.value }))}>
                      {SKU_CATS.map((c) => <option key={c} value={c}>{skuCatLabel[c] || c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{t('descriptionOptional')}</label>
                  <input placeholder="e.g. Compatible with iPhone 14 / 14 Plus"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-gray-400"
                    value={skuForm.description} onChange={(e) => setSkuForm((f) => ({ ...f, description: e.target.value }))} />
                </div>
                {skuFormError && <p className="text-xs text-red-500 mb-3">{skuFormError}</p>}
                <div className="flex gap-3">
                  <button onClick={() => { setAddSkuOpen(false); setSkuScanning(false); setSkuFormError(''); setSkuForm({ name: '', category: 'Ricambi', description: '', buyPrice: '', sellPrice: '', stock: '', lowStockAt: '5', barcode: '' }); }}
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
      })()}

      {/* ════════════════ SECONDHAND PAGE ════════════════ */}
      {page === 'secondhand' && (() => {
        const items = activeShop.secondhand || [];
        const filtered = shFilter === 'in_stock' ? items.filter(i => i.status !== 'sold')
          : shFilter === 'sold' ? items.filter(i => i.status === 'sold')
            : items;
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
          addSecondhand(activeShop.id, {
            itemName: shForm.itemName.trim(), brand: shForm.brand.trim(), model: shForm.model.trim(),
            imei: shForm.imei.trim(), condition: shForm.condition,
            buyPrice: Number(shForm.buyPrice),
            sellerName: shForm.sellerName.trim(), sellerPhone: shForm.sellerPhone.trim(),
            sellerEmail: shForm.sellerEmail.trim(),
            notes: shForm.notes.trim(), status: 'in_stock',
            buyDate: new Date().toISOString().split('T')[0],
          });
          if (shForm.sellerEmail.trim()) {
            addOrUpdateContact({
              name: shForm.sellerName.trim() || 'Seller',
              email: shForm.sellerEmail.trim(),
              phone: shForm.sellerPhone.trim(),
            });
          }
          setShForm({ itemName: '', brand: '', model: '', imei: '', condition: 'Buono', buyPrice: '', sellerName: '', sellerPhone: '', sellerEmail: '', notes: '' });
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
            });
          }
          setShSellOpen(null); setShSellForm({ sellPrice: '', buyerName: '', buyerPhone: '', buyerEmail: '' });
        };

        return (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: t('inStock'), value: inStockCount, color: 'bg-white border border-gray-200', numStyle: { color: '#936639' } },
                { label: t('totalSold'), value: soldCount, color: 'bg-white border border-gray-200', numStyle: { color: '#936639' } },
                { label: t('investedStock'), value: fmt(totalInvested), color: 'bg-white border border-gray-200', numStyle: { color: '#936639' } },
                { label: t('totalProfit'), value: fmt(totalProfit), color: 'bg-white border border-gray-200', numStyle: { color: '#936639' } },
              ].map(c => (
                <div key={c.label} className={`rounded-2xl p-4 shadow-sm ${c.color} flex flex-col gap-1`}>
                  <p className="text-2xl font-bold" style={c.numStyle}>{c.value}</p>
                  <p className="text-xs font-semibold opacity-70">{c.label}</p>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-1.5 bg-white rounded-xl p-1 shadow-sm border border-gray-200">
                {[['all', t('all')], ['in_stock', t('inStock')], ['sold', t('sold')]].map(([v, l]) => (
                  <button key={v} onClick={() => setShFilter(v)}
                    style={shFilter === v ? { backgroundColor: '#936639' } : {}}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${shFilter === v ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}>{l}</button>
                ))}
              </div>
              <button onClick={() => setAddShOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 text-white font-semibold rounded-xl transition-all text-sm shadow-sm"
                style={{ backgroundColor: '#936639' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {t('buyItem')}
              </button>
            </div>

            {/* Items list */}
            {filtered.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                <p className="font-semibold">{t('noItemsFound')}</p>
                <p className="text-sm mt-1">{t('clickBuyItemHint')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(item => {
                  if (shEditId === item.id) {
                    return (
                      <div key={item.id} className="bg-white rounded-2xl border-2 p-4 shadow-md space-y-3" style={{ borderColor: '#936639' }}>
                        <p className="font-bold text-sm mb-1" style={{ color: '#936639' }}>{t('editItem')}</p>
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
                          {[['sellerName', t('sellerName')], ['sellerPhone', t('sellerPhone')]].map(([k, l]) => (
                            <div key={k}>
                              <label className="text-xs text-gray-500 font-medium">{l}</label>
                              <input className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5"
                                value={shEditForm[k] || ''} onChange={e => setShEditForm(f => ({ ...f, [k]: e.target.value }))} />
                            </div>
                          ))}
                          <div className="col-span-2">
                            <label className="text-xs text-gray-500 font-medium">Note</label>
                            <input className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mt-0.5"
                              value={shEditForm.notes || ''} onChange={e => setShEditForm(f => ({ ...f, notes: e.target.value }))} />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => setShEditId(null)} className="flex-1 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">{t('cancel')}</button>
                          <button onClick={() => { updateSecondhand(activeShop.id, item.id, { ...shEditForm, buyPrice: Number(shEditForm.buyPrice) }); setShEditId(null); }}
                            className="flex-1 py-2 text-white rounded-xl text-sm font-semibold" style={{ backgroundColor: '#936639' }}>{t('save')}</button>
                        </div>
                      </div>
                    );
                  }
                  const isSold = item.status === 'sold';
                  const profit = isSold ? (item.sellPrice || 0) - (item.buyPrice || 0) : null;
                  return (
                    <div key={item.id} className={`bg-white rounded-2xl shadow-sm border p-4 space-y-3 ${isSold ? 'border-amber-200' : 'border-gray-200'
                      }`}>
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 text-base leading-tight truncate">{item.itemName}</p>
                          {(item.brand || item.model) && <p className="text-xs text-gray-400 mt-0.5">{[item.brand, item.model].filter(Boolean).join(' · ')}</p>}
                          {item.imei && <p className="text-xs text-gray-400 font-mono">IMEI: {item.imei}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${conditionColor[item.condition] || 'bg-gray-100 text-gray-600'}`}>{conditionLabel[item.condition] || item.condition}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isSold ? 'bg-amber-100 text-amber-700' : 'bg-amber-50'
                            }`} style={isSold ? {} : { color: '#936639' }}>{isSold ? t('sold') : t('inStock')}</span>
                        </div>
                      </div>

                      {/* Price info */}
                      <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                        <div className="flex-1">
                          <p className="text-xs text-gray-400 font-medium">{t('boughtFor')}</p>
                          <p className="font-bold text-gray-900">{fmt(item.buyPrice || 0)}</p>
                        </div>
                        {isSold && (
                          <>
                            <div className="w-px h-8 bg-stone-600" />
                            <div className="flex-1">
                              <p className="text-xs text-gray-400 font-medium">{t('soldFor')}</p>
                              <p className="font-bold text-gray-900">{fmt(item.sellPrice || 0)}</p>
                            </div>
                            <div className="w-px h-8 bg-stone-600" />
                            <div className="flex-1">
                              <p className="text-xs text-gray-400 font-medium">{t('profit')}</p>
                              <p className={`font-bold ${profit >= 0 ? '' : 'text-red-500'}`} style={profit >= 0 ? { color: '#936639' } : {}}>{fmt(profit)}</p>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Meta */}
                      <div className="text-xs text-gray-400 space-y-0.5">
                        {item.sellerName && <p>{t('boughtFrom')} <span className="text-gray-600 font-medium">{item.sellerName}{item.sellerPhone ? ` · ${item.sellerPhone}` : ''}</span></p>}
                        {isSold && item.buyerName && <p>{t('soldTo')} <span className="text-gray-600 font-medium">{item.buyerName}{item.buyerPhone ? ` · ${item.buyerPhone}` : ''}</span></p>}
                        <p>{t('buyDate')} {item.buyDate} {isSold && item.sellDate ? `· ${t('sold')}: ${item.sellDate}` : ''}</p>
                        {item.notes && <p className="italic text-gray-400">{item.notes}</p>}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        {!isSold && (
                          <button onClick={() => { setShSellOpen(item.id); setShSellForm({ sellPrice: '', buyerName: '', buyerPhone: '', buyerEmail: '' }); }}
                            className="flex-1 py-2 text-white font-semibold rounded-xl text-sm transition-colors" style={{ backgroundColor: '#936639' }}>
                            {t('markSold')}
                          </button>
                        )}
                        <button onClick={() => { setShEditId(item.id); setShEditForm({ itemName: item.itemName, brand: item.brand || '', model: item.model || '', imei: item.imei || '', condition: item.condition || 'Buono', buyPrice: item.buyPrice, sellerName: item.sellerName || '', sellerPhone: item.sellerPhone || '', notes: item.notes || '' }); }}
                          className="p-2 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => setShDeleteId(item.id)}
                          className="p-2 border border-red-100 rounded-xl text-red-400 hover:bg-red-50 transition-colors">
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
                  );
                })}
              </div>
            )}

            {/* Add Item Modal */}
            {addShOpen && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                  <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-900">{t('buySecondhandItem')}</h2>
                    <button onClick={() => { setAddShOpen(false); setShFormError(''); }} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="p-6 space-y-4">
                    {shFormError && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-4 py-2">{shFormError}</p>}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
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
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('imeiSerialNo')}</label>
                        <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                          placeholder="123456789012345" value={shForm.imei} onChange={e => setShForm(f => ({ ...f, imei: e.target.value }))} />
                      </div>
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
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('sellerName')}</label>
                        <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          placeholder="Mario Rossi" value={shForm.sellerName} onChange={e => setShForm(f => ({ ...f, sellerName: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('sellerPhone')}</label>
                        <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          placeholder="+39 320 1234567" value={shForm.sellerPhone} onChange={e => setShForm(f => ({ ...f, sellerPhone: e.target.value }))} />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{t('sellerEmail')} <span className="text-gray-400 font-normal">(optional – auto-save to contacts)</span></label>
                        <input type="email" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          placeholder="seller@email.com" value={shForm.sellerEmail} onChange={e => setShForm(f => ({ ...f, sellerEmail: e.target.value }))} />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Note</label>
                        <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                          placeholder="Any remarks..." value={shForm.notes} onChange={e => setShForm(f => ({ ...f, notes: e.target.value }))} />
                      </div>
                    </div>
                    <button onClick={handleAddSh}
                      className="w-full py-3 text-white font-bold rounded-xl transition-colors text-sm"
                      style={{ backgroundColor: '#936639' }}>
                      {t('addToStock')}
                    </button>
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
          </div>
        );
      })()}

      {/* ── NOTES PAGE ── */}
      {page === 'notes' && (() => {
        const notes = activeShop.notes || [];
        const totalAmt = notes.reduce((s, n) => s + (Number(n.totalAmount ?? n.amount) || 0), 0);
        const totalPaid = notes.reduce((s, n) => s + (Number(n.paidAmount) || 0), 0);
        const totalRem = totalAmt - totalPaid;
        const today = new Date().toISOString().split('T')[0];
        const todayTotal = notes.filter((n) => n.date === today).reduce((s, n) => s + (Number(n.totalAmount ?? n.amount) || 0), 0);

        return (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Notes', value: notes.length, numStyle: { color: '#936639' } },
                { label: 'Total Amount', value: fmt(totalAmt), numStyle: { color: '#936639' } },
                { label: 'Total Paid', value: fmt(totalPaid), numStyle: { color: '#22c55e' } },
                { label: 'Remaining', value: fmt(totalRem), numStyle: { color: '#ef4444' } },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 flex flex-col gap-1">
                  <p className="text-2xl font-bold" style={c.numStyle}>{c.value}</p>
                  <p className="text-xs font-semibold text-gray-400">{c.label}</p>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div className="flex justify-end">
              <button
                onClick={() => { setNoteEditId(null); setNoteForm({ name: '', details: '', totalAmount: '', paidAmount: '', phone: '', email: '' }); setNoteFormError(''); setNoteOpen(true); }}
                className="flex items-center gap-2 px-5 py-2.5 text-white font-semibold rounded-xl transition-all text-sm shadow-sm"
                style={{ backgroundColor: '#936639' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Note
              </button>
            </div>

            {/* Empty state */}
            {notes.length === 0 && (
              <div className="text-center py-20 text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <p className="font-semibold">No notes yet</p>
                <p className="text-sm mt-1">Record payments, expenses, and financial movements here</p>
              </div>
            )}

            {/* Notes grid */}
            {notes.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {notes.map((note) => {
                  const noteTotal = Number(note.totalAmount ?? note.amount) || 0;
                  const notePaid = Number(note.paidAmount) || 0;
                  const noteRem = noteTotal - notePaid;
                  const pct = noteTotal > 0 ? Math.min(100, Math.round((notePaid / noteTotal) * 100)) : 0;
                  const fullyPaid = noteTotal > 0 && notePaid >= noteTotal;
                  return (
                    <div key={note.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 space-y-3 hover:border-amber-200 transition-colors">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 text-base leading-tight">{note.name}</p>
                          {note.details && <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{note.details}</p>}
                          {(note.appointmentDate || note.appointmentTime) && (
                            <div className="flex items-center gap-1 mt-1.5 text-xs font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-lg w-fit">
                              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              {note.appointmentDate && new Date(note.appointmentDate + 'T00:00:00').toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })}
                              {note.appointmentTime && <span className="ml-1">· {note.appointmentTime}</span>}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{note.date}</span>
                          {fullyPaid && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-600">Paid ✓</span>}
                        </div>
                      </div>

                      {/* Payment tracking */}
                      {noteTotal > 0 && (
                        <div className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-2">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-gray-500">Paid: <span style={{ color: '#936639' }}>{fmt(notePaid)}</span></span>
                            <span className="text-gray-500">Remaining: <span className={noteRem > 0 ? 'text-red-500' : 'text-green-500'}>{fmt(noteRem > 0 ? noteRem : 0)}</span></span>
                            <span className="text-gray-500">Total: <span className="text-gray-800">{fmt(noteTotal)}</span></span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: fullyPaid ? '#22c55e' : 'linear-gradient(to right, #a68a64, #936639)' }}
                            />
                          </div>
                          <p className="text-right text-xs text-gray-400">{pct}% paid</p>
                        </div>
                      )}
                      {noteTotal === 0 && (
                        <div className="bg-gray-50 rounded-xl px-3 py-2">
                          <p className="text-xs text-gray-400">No amount recorded</p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => {
                            setNoteEditId(note.id);
                            setNoteForm({
                              name: note.name,
                              details: note.details || '',
                              totalAmount: noteTotal > 0 ? String(noteTotal) : '',
                              paidAmount: notePaid > 0 ? String(notePaid) : '',
                              appointmentDate: note.appointmentDate || '',
                              appointmentTime: note.appointmentTime || '',
                              phone: note.phone || '',
                              email: note.email || '',
                            });
                            setNoteFormError('');
                            setNoteOpen(true);
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors text-xs font-semibold"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => setNoteDeleteId(note.id)}
                          className="p-2 border border-red-100 rounded-xl text-red-400 hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {page === 'emails' && (() => {
        const filteredContacts = contactSearch.trim()
          ? contacts.filter(c =>
            c.name?.toLowerCase().includes(contactSearch.toLowerCase()) ||
            c.email?.toLowerCase().includes(contactSearch.toLowerCase()) ||
            c.phone?.includes(contactSearch)
          )
          : contacts;
        const emailCfg = emailSettings;
        const isDisabled = emailCfg.enabled === false;
        const isUnconfigured = !emailCfg.serviceId || !emailCfg.templateId || !emailCfg.publicKey;

        const BROADCAST_TEMPLATES = [
          {
            label: '📢 Special Offer',
            subject: `Special Offer from ${activeShop?.name}!`,
            message: `Dear {name},\n\nWe have an exclusive special offer just for you!\n\n🎁 [Describe your offer here]\n\nValid until: [Date]\n\nVisit us or call us to avail this offer.\n\nThank you for being our valued customer!\n${activeShop?.name}`,
          },
          {
            label: '🏷️ Discount Package',
            subject: `Exclusive Discount for You – ${activeShop?.name}`,
            message: `Dear {name},\n\nAs our valued customer, we are offering you an exclusive discount!\n\n💰 Discount: [X]% off on all services/products\n📅 Valid till: [Date]\n\nDon't miss this amazing deal!\n\n${activeShop?.name}`,
          },
          {
            label: '🆕 New Arrival',
            subject: `New Arrivals at ${activeShop?.name}!`,
            message: `Dear {name},\n\nWe are excited to announce new arrivals at our store!\n\n✨ [Describe new products/services]\n📍 Visit us: [Address]\n\nCome check it out today!\n\n${activeShop?.name}`,
          },
          {
            label: '🎉 Event / Sale',
            subject: `Big Sale at ${activeShop?.name} – Don't Miss Out!`,
            message: `Dear {name},\n\nWe are hosting a BIG SALE event!\n\n🎉 Date: [Date]\n📍 Location: [Address]\n💸 Up to [X]% off on everything\n\nBring this email for extra discount!\n\n${activeShop?.name}`,
          },
        ];

        const handleBroadcastSend = async () => {
          if (!broadcastForm.subject.trim() || !broadcastForm.message.trim()) return;
          const targets = contacts.filter(c => broadcastSelected.has(c.id));
          if (targets.length === 0) return;
          setBroadcastSending(true);
          setBroadcastProgress({ sent: 0, failed: 0, total: targets.length });
          let sent = 0; let failed = 0;
          for (const c of targets) {
            const personalMessage = broadcastForm.message.replace(/\{name\}/g, c.name || 'Customer');
            const res = await sendClientEmail({
              to: c.email,
              toName: c.name,
              subject: broadcastForm.subject,
              message: personalMessage,
              shopName: activeShop?.name,
            });
            if (res.success) sent++; else failed++;
            setBroadcastProgress({ sent, failed, total: targets.length });
            await new Promise(r => setTimeout(r, 400));
          }
          setBroadcastSending(false);
        };

        const handleManualSend = async () => {
          if (!manualEmailForm.email || !manualEmailForm.subject || !manualEmailForm.message) return;
          setManualEmailSending(true);
          setManualEmailResult(null);
          const res = await sendClientEmail({
            to: manualEmailForm.email,
            toName: manualEmailForm.name || manualEmailForm.email,
            subject: manualEmailForm.subject,
            message: `${manualEmailForm.phone ? `Phone: ${manualEmailForm.phone}\n` : ''}${manualEmailForm.message}`,
            shopName: activeShop?.name,
          });
          setManualEmailSending(false);
          setManualEmailResult(res);
          setManualEmailForm({ name: '', email: '', phone: '', subject: '', message: '' });
        };

        const handleSaveContact = () => {
          if (!contactForm.email || !contactForm.name) return;
          addOrUpdateContact({ name: contactForm.name.trim(), email: contactForm.email.trim(), phone: contactForm.phone.trim() });
          setContactForm({ name: '', email: '', phone: '' });
          setContactFormOpen(false);
        };

        return (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Email Box</h2>
                <p className="text-sm text-gray-500 mt-0.5">{contacts.length} contacts</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setBroadcastOpen(v => !v);
                    setBroadcastProgress(null);
                    setBroadcastSelected(new Set());
                    setBroadcastForm({ subject: '', message: '' });
                    setComposeOpen(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-sm transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                  Broadcast
                </button>
                <button
                  onClick={() => { setComposeOpen(v => !v); setManualEmailResult(null); setBroadcastOpen(false); }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-xl text-sm transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {composeOpen
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    }
                  </svg>
                  {composeOpen ? 'Close' : 'Compose Email'}
                </button>
              </div>
            </div>

            {/* Search bar */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" /></svg>
              <input
                type="text"
                placeholder="Search contacts by name, email or phone..."
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
              {contactSearch && (
                <button onClick={() => setContactSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>

            {/* Broadcast Panel */}
            {broadcastOpen && (
              <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-purple-800 text-sm flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                      Broadcast Email
                    </h3>
                    <p className="text-xs text-purple-500 mt-0.5">Send an offer or announcement to all selected contacts. Use <code className="bg-purple-100 px-1 rounded">{'{name}'}</code> to personalize.</p>
                  </div>
                  {/* Language toggle */}
                  <div className="flex items-center gap-1 bg-white border border-purple-200 rounded-xl p-1">
                    <button onClick={() => setBroadcastLang('it')} className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${broadcastLang === 'it' ? 'bg-purple-600 text-white' : 'text-purple-600 hover:bg-purple-50'}`}>IT</button>
                    <button onClick={() => setBroadcastLang('en')} className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${broadcastLang === 'en' ? 'bg-purple-600 text-white' : 'text-purple-600 hover:bg-purple-50'}`}>EN</button>
                  </div>
                </div>

                {/* Quick Suggestions */}
                <div>
                  <p className="text-xs font-bold text-purple-700 mb-2">Quick Suggestions</p>
                  <div className="flex flex-wrap gap-2">
                    {(broadcastLang === 'en' ? [
                      { label: 'Offer', subject: `An update from ${activeShop?.name || 'us'}`, message: `Dear {name},\n\nwe have something special for you.\n\n[Write your offer or promotion here]\n\nFeel free to contact us for more information.\n\nThank you,\n${activeShop?.name || 'Our Shop'}` },
                      { label: 'New Arrivals', subject: `New arrivals at ${activeShop?.name || 'us'}`, message: `Dear {name},\n\nwe are pleased to inform you that new products are now available.\n\n[Describe the new items]\n\nCome visit us whenever you like.\n\nSee you soon,\n${activeShop?.name || 'Our Shop'}` },
                      { label: 'Event', subject: `Invitation from ${activeShop?.name || 'us'}`, message: `Dear {name},\n\nwe would like to invite you to our upcoming event.\n\nDate: [Date]\nLocation: [Address]\n\nWe look forward to seeing you.\n\n${activeShop?.name || 'Our Shop'}` },
                      { label: 'Thank You', subject: `Thank you from ${activeShop?.name || 'us'}`, message: `Dear {name},\n\nthank you for your trust and for being our valued customer.\n\nWe are always here to help.\n\nKind regards,\n${activeShop?.name || 'Our Shop'}` },
                      { label: 'Reminder', subject: `Reminder from ${activeShop?.name || 'us'}`, message: `Dear {name},\n\nthis is a friendly reminder that your order or appointment is pending.\n\nPlease contact us for any information.\n\n${activeShop?.name || 'Our Shop'}` },
                      { label: 'Repair Ready', subject: `Your repair is ready — ${activeShop?.name || 'us'}`, message: `Dear {name},\n\nwe are happy to inform you that your repair is ready for pickup.\n\nYou can come and collect your device during our opening hours.\n\nThank you,\n${activeShop?.name || 'Our Shop'}` },
                      { label: 'Order Ready', subject: `Your order has arrived — ${activeShop?.name || 'us'}`, message: `Dear {name},\n\nwe are pleased to let you know that your order has arrived and is ready for pickup.\n\nThank you for your patience,\n${activeShop?.name || 'Our Shop'}` },
                      { label: 'Payment Due', subject: `Payment reminder — ${activeShop?.name || 'us'}`, message: `Dear {name},\n\nwe would like to remind you that there is a pending payment on your account.\n\nPlease contact us to resolve this at your earliest convenience.\n\nBest regards,\n${activeShop?.name || 'Our Shop'}` },
                      { label: 'Warranty Expiring', subject: `Your warranty is expiring — ${activeShop?.name || 'us'}`, message: `Dear {name},\n\nwe would like to inform you that the warranty on your device is about to expire.\n\nContact us for more information on how to extend or protect it.\n\nBest regards,\n${activeShop?.name || 'Our Shop'}` },
                      { label: 'Shop Closed', subject: `Important notice from ${activeShop?.name || 'us'}`, message: `Dear {name},\n\nplease note that our shop will be closed from [Start Date] to [End Date].\n\nWe will reopen on [Reopening Date].\n\nThank you for your understanding,\n${activeShop?.name || 'Our Shop'}` },
                      { label: 'New Hours', subject: `Updated opening hours — ${activeShop?.name || 'us'}`, message: `Dear {name},\n\nwe would like to inform you that our opening hours have been updated.\n\nNew hours:\nMon–Fri: [hours]\nSat: [hours]\n\nWe look forward to serving you,\n${activeShop?.name || 'Our Shop'}` },
                      { label: 'Review Request', subject: `Your feedback matters — ${activeShop?.name || 'us'}`, message: `Dear {name},\n\nthank you for choosing ${activeShop?.name || 'us'}! We hope your experience was great.\n\nWe would really appreciate a short review from you. Your feedback helps us improve.\n\n[Review link or instructions]\n\nThank you for your time,\n${activeShop?.name || 'Our Shop'}` },
                      { label: 'Refer a Friend', subject: `Refer a friend — ${activeShop?.name || 'us'}`, message: `Dear {name},\n\nwe are very happy to have you as our customer!\n\nRefer a friend and you both receive a special benefit:\n\n[Describe referral offer]\n\nJust mention your name when they visit.\n\nThank you,\n${activeShop?.name || 'Our Shop'}` },
                      { label: 'Seasonal Promo', subject: `Special season offer — ${activeShop?.name || 'us'}`, message: `Dear {name},\n\nwarm greetings for the season!\n\nTo celebrate, we are offering you an exclusive promotion:\n\n[Describe the seasonal offer]\n\nValid until: [Date]\n\n${activeShop?.name || 'Our Shop'}` },
                      { label: 'Appointment', subject: `Appointment confirmation — ${activeShop?.name || 'us'}`, message: `Dear {name},\n\nwe confirm your appointment with us.\n\nDate: [Date]\nTime: [Time]\nLocation: [Address]\n\nIf you need to reschedule, please contact us in advance.\n\nSee you soon,\n${activeShop?.name || 'Our Shop'}` },
                      { label: 'Back in Stock', subject: `Back in stock — ${activeShop?.name || 'us'}`, message: `Dear {name},\n\ngreat news! The item you were interested in is back in stock.\n\nProduct: [Product name]\n\nCome pick it up before it runs out again.\n\n${activeShop?.name || 'Our Shop'}` },
                      { label: 'Price Update', subject: `Price update notice — ${activeShop?.name || 'us'}`, message: `Dear {name},\n\nplease note that some of our prices will be updated starting from [Date].\n\nWe remain committed to offering you the best value and quality.\n\nFor any questions please contact us.\n\n${activeShop?.name || 'Our Shop'}` },
                      { label: 'Survey', subject: `Quick survey — ${activeShop?.name || 'us'}`, message: `Dear {name},\n\nwe value your opinion and would like to ask a couple of questions about your recent experience.\n\nIt only takes 2 minutes:\n\n[Survey link]\n\nThank you!\n\n${activeShop?.name || 'Our Shop'}` },
                    ] : [
                      { label: 'Offerta', subject: `Un aggiornamento da ${activeShop?.name || 'noi'}`, message: `Caro {name},\n\nabbiamo qualcosa di speciale per te.\n\n[Scrivi qui la tua offerta o promozione]\n\nSiamo disponibili per qualsiasi informazione.\n\nGrazie,\n${activeShop?.name || 'Il nostro negozio'}` },
                      { label: 'Novità', subject: `Novità da ${activeShop?.name || 'noi'}`, message: `Caro {name},\n\nsiamo lieti di informarti che sono disponibili nuovi prodotti.\n\n[Descrivi i nuovi articoli]\n\nVieni a trovarci quando vuoi.\n\nA presto,\n${activeShop?.name || 'Il nostro negozio'}` },
                      { label: 'Evento', subject: `Invito da ${activeShop?.name || 'noi'}`, message: `Caro {name},\n\nVorremmo invitarti a un nostro evento.\n\nData: [Data]\nLuogo: [Indirizzo]\n\nSaremmo felici di vederti.\n\n${activeShop?.name || 'Il nostro negozio'}` },
                      { label: 'Grazie', subject: `Grazie da ${activeShop?.name || 'noi'}`, message: `Caro {name},\n\ngrazie per la tua fiducia e per essere nostro cliente.\n\nSiamo sempre a tua disposizione.\n\nCon stima,\n${activeShop?.name || 'Il nostro negozio'}` },
                      { label: 'Promemoria', subject: `Promemoria da ${activeShop?.name || 'noi'}`, message: `Caro {name},\n\nti ricordiamo che il tuo ordine o appuntamento è in attesa.\n\nContattaci per qualsiasi informazione.\n\n${activeShop?.name || 'Il nostro negozio'}` },
                      { label: 'Riparazione pronta', subject: `La tua riparazione è pronta — ${activeShop?.name || 'noi'}`, message: `Caro {name},\n\nsiamo lieti di informarti che la tua riparazione è pronta per il ritiro.\n\nPuoi venire a ritirare il tuo dispositivo durante i nostri orari di apertura.\n\nPer qualsiasi informazione non esitare a contattarci.\n\nGrazie,\n${activeShop?.name || 'Il nostro negozio'}` },
                      { label: 'Ordine pronto', subject: `Il tuo ordine è arrivato — ${activeShop?.name || 'noi'}`, message: `Caro {name},\n\nti informiamo che il tuo ordine è arrivato ed è pronto per il ritiro.\n\nVieni a trovарci quando vuoi.\n\nGrazie per la tua pazienza,\n${activeShop?.name || 'Il nostro negozio'}` },
                      { label: 'Pagamento scaduto', subject: `Promemoria pagamento — ${activeShop?.name || 'noi'}`, message: `Caro {name},\n\nti ricordiamo che risulta un pagamento in sospeso per il tuo account.\n\nTi preghiamo di contattarci per regolarizzare la situazione.\n\nSiamo a tua disposizione,\n${activeShop?.name || 'Il nostro negozio'}` },
                      { label: 'Garanzia in scadenza', subject: `La tua garanzia sta per scadere — ${activeShop?.name || 'noi'}`, message: `Caro {name},\n\nti informiamo che la garanzia del tuo dispositivo sta per scadere.\n\nContattaci per maggiori informazioni su come rinnovarla o proteggerlo.\n\nSiamo sempre a tua disposizione,\n${activeShop?.name || 'Il nostro negozio'}` },
                      { label: 'Chiusura / Ferie', subject: `Comunicazione importante da ${activeShop?.name || 'noi'}`, message: `Caro {name},\n\nti informiamo che il nostro negozio sarà chiuso dal [Data inizio] al [Data fine] per ferie.\n\nRiapriremo regolarmente il [Data riapertura].\n\nGrazie per la comprensione,\n${activeShop?.name || 'Il nostro negozio'}` },
                      { label: 'Nuovo orario', subject: `Aggiornamento orari — ${activeShop?.name || 'noi'}`, message: `Caro {name},\n\nti informiamo che i nostri orari di apertura sono stati aggiornati.\n\nNuovi orari:\nLun–Ven: [orario]\nSab: [orario]\n\nSiamo felici di servirti,\n${activeShop?.name || 'Il nostro negozio'}` },
                      { label: 'Recensione', subject: `La tua opinione conta — ${activeShop?.name || 'noi'}`, message: `Gentile {name},\n\ngrazie per aver scelto ${activeShop?.name || 'noi'}! Speriamo che la tua esperienza sia stata ottima.\n\nCi farebbe molto piacere ricevere una tua breve recensione. Il tuo feedback ci aiuta a migliorare.\n\n[Link o istruzioni per la recensione]\n\nGrazie per il tuo tempo,\n${activeShop?.name || 'Il Nostro Negozio'}` },
                      { label: 'Porta un Amico', subject: `Porta un amico da noi — ${activeShop?.name || 'noi'}`, message: `Gentile {name},\n\nsiamo felici di averti come cliente!\n\nPorta un amico e riceverete entrambi un beneficio speciale:\n\n[Descrivi l'offerta referral]\n\nBasta che menzioni il tuo nome quando viene a trovarci.\n\nGrazie,\n${activeShop?.name || 'Il Nostro Negozio'}` },
                      { label: 'Promo Stagionale', subject: `Offerta speciale di stagione — ${activeShop?.name || 'noi'}`, message: `Gentile {name},\n\ncari auguri per questa stagione!\n\nPer festeggiare, ti offriamo una promozione esclusiva:\n\n[Descrivi l'offerta stagionale]\n\nValida fino al: [Data]\n\n${activeShop?.name || 'Il Nostro Negozio'}` },
                      { label: 'Appuntamento', subject: `Conferma appuntamento — ${activeShop?.name || 'noi'}`, message: `Gentile {name},\n\nconfermiamo il tuo appuntamento con noi.\n\nData: [Data]\nOra: [Ora]\nLuogo: [Indirizzo]\n\nSe hai bisogno di spostarlo, contattaci in anticipo.\n\nA presto,\n${activeShop?.name || 'Il Nostro Negozio'}` },
                      { label: 'Di Nuovo Disponibile', subject: `Di nuovo disponibile — ${activeShop?.name || 'noi'}`, message: `Gentile {name},\n\nottima notizia! L'articolo che ti interessava e' di nuovo disponibile.\n\nProdotto: [Nome prodotto]\n\nVieni a ritirarlo prima che finisca.\n\n${activeShop?.name || 'Il Nostro Negozio'}` },
                      { label: 'Aggiornamento Prezzi', subject: `Aggiornamento prezzi — ${activeShop?.name || 'noi'}`, message: `Gentile {name},\n\nti informiamo che alcuni prezzi verranno aggiornati a partire dal [Data].\n\nRestiamo impegnati a offrirti il miglior rapporto qualita-prezzo.\n\nPer qualsiasi domanda contattaci.\n\n${activeShop?.name || 'Il Nostro Negozio'}` },
                      { label: 'Sondaggio', subject: `Sondaggio veloce — ${activeShop?.name || 'noi'}`, message: `Gentile {name},\n\napprezziamo la tua opinione e vorremmo farti qualche domanda sulla tua recente esperienza.\n\nCi vogliono solo 2 minuti:\n\n[Link sondaggio]\n\nGrazie!\n\n${activeShop?.name || 'Il Nostro Negozio'}` },
                    ]).map((tpl, i) => (
                      <button key={i}
                        onClick={() => setBroadcastForm({ subject: tpl.subject, message: tpl.message })}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-purple-200 text-purple-700 hover:bg-purple-100 transition-colors">
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject & Message */}
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Subject *"
                    value={broadcastForm.subject}
                    onChange={e => setBroadcastForm(f => ({ ...f, subject: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-purple-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
                  />
                  <textarea
                    rows={5}
                    placeholder="Message * (use {name} to personalize for each contact)"
                    value={broadcastForm.message}
                    onChange={e => setBroadcastForm(f => ({ ...f, message: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-purple-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                  />
                </div>

                {/* Contact selector */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-600">Select Recipients ({broadcastSelected.size} / {contacts.length} selected)</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setBroadcastSelected(new Set(contacts.map(c => c.id)))}
                        className="text-xs font-semibold text-purple-600 hover:underline">Select All</button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => setBroadcastSelected(new Set())}
                        className="text-xs font-semibold text-gray-400 hover:underline">Deselect All</button>
                    </div>
                  </div>
                  {contacts.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No saved contacts yet. Add contacts first.</p>
                  ) : (
                    <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                      {contacts.map(c => (
                        <label key={c.id} className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${broadcastSelected.has(c.id) ? 'bg-purple-100 border-purple-300' : 'bg-white border-gray-100 hover:border-purple-200'
                          }`}>
                          <input
                            type="checkbox"
                            className="accent-purple-600 w-4 h-4"
                            checked={broadcastSelected.has(c.id)}
                            onChange={e => {
                              const s = new Set(broadcastSelected);
                              e.target.checked ? s.add(c.id) : s.delete(c.id);
                              setBroadcastSelected(s);
                            }}
                          />
                          <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-xs shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-xs">{c.name}</p>
                            <p className="text-purple-600 text-[11px] truncate">{c.email}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Progress */}
                {broadcastProgress && (
                  <div className="space-y-2">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.round(((broadcastProgress.sent + broadcastProgress.failed) / broadcastProgress.total) * 100)}%`,
                          background: 'linear-gradient(to right, #9333ea, #7c3aed)',
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-emerald-600">✓ Sent: {broadcastProgress.sent}</span>
                      {broadcastProgress.failed > 0 && <span className="text-red-500">✗ Failed: {broadcastProgress.failed}</span>}
                      <span className="text-gray-400">{broadcastProgress.sent + broadcastProgress.failed} / {broadcastProgress.total}</span>
                    </div>
                    {!broadcastSending && broadcastProgress.sent + broadcastProgress.failed === broadcastProgress.total && (
                      <p className="text-center text-xs font-bold text-emerald-600 bg-emerald-50 rounded-xl py-2">
                        ✓ Broadcast complete! {broadcastProgress.sent} email{broadcastProgress.sent !== 1 ? 's' : ''} sent.
                      </p>
                    )}
                  </div>
                )}

                {/* Send button */}
                <button
                  onClick={handleBroadcastSend}
                  disabled={broadcastSending || broadcastSelected.size === 0 || !broadcastForm.subject.trim() || !broadcastForm.message.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-colors shadow-sm"
                >
                  {broadcastSending ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Sending... ({broadcastProgress?.sent + broadcastProgress?.failed || 0}/{broadcastProgress?.total || 0})
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Send to {broadcastSelected.size} Contact{broadcastSelected.size !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Compose Form (collapsible) */}
            {composeOpen && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Client Name"
                      value={manualEmailForm.name}
                      onChange={e => setManualEmailForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-amber-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
                    />
                    {/* Contacts quick-pick */}
                    {contacts.length > 0 && (
                      <select
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-amber-600 bg-transparent border-none outline-none cursor-pointer"
                        value=""
                        onChange={e => {
                          const c = contacts.find(x => x.id === e.target.value);
                          if (c) setManualEmailForm(f => ({ ...f, name: c.name, email: c.email, phone: c.phone || f.phone }));
                        }}
                      >
                        <option value="">📋</option>
                        {contacts.map(c => (
                          <option key={c.id} value={c.id}>{c.name} &lt;{c.email}&gt;</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <input
                    type="email"
                    placeholder="Email Address *"
                    value={manualEmailForm.email}
                    onChange={e => setManualEmailForm(f => ({ ...f, email: e.target.value }))}
                    className="px-3.5 py-2.5 rounded-xl border border-amber-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    value={manualEmailForm.phone}
                    onChange={e => setManualEmailForm(f => ({ ...f, phone: e.target.value }))}
                    className="px-3.5 py-2.5 rounded-xl border border-amber-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Subject *"
                  value={manualEmailForm.subject}
                  onChange={e => setManualEmailForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-amber-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 mb-3"
                />
                <textarea
                  rows={4}
                  placeholder="Message *"
                  value={manualEmailForm.message}
                  onChange={e => setManualEmailForm(f => ({ ...f, message: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-amber-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none mb-3"
                />
                {manualEmailResult && (
                  <div className={`text-xs font-semibold px-3 py-2 rounded-lg mb-3 ${manualEmailResult.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                    }`}>
                    {manualEmailResult.success ? '✓ Email sent successfully!' : `✗ ${manualEmailResult.error}`}
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleManualSend}
                    disabled={manualEmailSending || !manualEmailForm.email || !manualEmailForm.subject || !manualEmailForm.message}
                    className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-colors shadow-sm"
                  >
                    {manualEmailSending ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                    {manualEmailSending ? 'Sending...' : 'Send Email'}
                  </button>
                  {manualEmailForm.name && manualEmailForm.email && (
                    <button
                      onClick={() => {
                        addOrUpdateContact({ name: manualEmailForm.name, email: manualEmailForm.email, phone: manualEmailForm.phone });
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white border border-amber-300 hover:bg-amber-50 text-amber-700 font-semibold rounded-xl text-sm transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Save Contact
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* CONTACTS */}
            {(
              <div className="space-y-3">
                {/* Add Contact Form */}
                {contactFormOpen ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
                    <p className="text-xs font-bold text-amber-700 mb-3">New Contact</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                      <input
                        type="text"
                        placeholder="Name *"
                        value={contactForm.name}
                        onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                        className="px-3 py-2.5 rounded-xl border border-amber-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
                      />
                      <input
                        type="email"
                        placeholder="Email *"
                        value={contactForm.email}
                        onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                        className="px-3 py-2.5 rounded-xl border border-amber-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
                      />
                      <input
                        type="tel"
                        placeholder="Phone"
                        value={contactForm.phone}
                        onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                        className="px-3 py-2.5 rounded-xl border border-amber-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleSaveContact} disabled={!contactForm.name || !contactForm.email}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors">Save Contact</button>
                      <button onClick={() => { setContactFormOpen(false); setContactForm({ name: '', email: '', phone: '' }); }}
                        className="px-4 py-2 border border-gray-200 text-gray-600 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setContactFormOpen(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-amber-200 text-amber-500 font-semibold rounded-2xl hover:border-amber-400 hover:bg-amber-50/50 transition-all text-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add New Contact
                  </button>
                )}

                {contacts.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <p className="text-gray-600 font-semibold">No saved contacts</p>
                    <p className="text-gray-400 text-sm mt-1">Save contacts to quickly fill the compose form</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {contacts.map(c => (
                      <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 space-y-2 hover:border-amber-200 transition-colors">
                        {/* Header */}
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-700 font-bold text-sm">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 text-sm leading-tight truncate">{c.name}</p>
                            <p className="text-amber-600 text-[11px] truncate">{c.email}</p>
                            {c.phone && <p className="text-gray-400 text-[11px]">{c.phone}</p>}
                          </div>
                        </div>
                        {/* Actions */}
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => { setManualEmailForm(f => ({ ...f, name: c.name, email: c.email, phone: c.phone || '' })); setComposeOpen(true); }}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-[11px] font-semibold transition-colors border border-amber-200"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            Email
                          </button>
                          <button
                            onClick={() => { removeContact(c.id); }}
                            className="p-1.5 border border-red-100 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {page === 'whatsapp' && (() => {
        void waSearch;
        const waFilteredContacts = waSearch.trim()
          ? contacts.filter(c =>
            c.name?.toLowerCase().includes(waSearch.toLowerCase()) ||
            c.phone?.includes(waSearch) ||
            c.email?.toLowerCase().includes(waSearch.toLowerCase())
          )
          : contacts;

        const formatWaNum = (phone) => {
          if (!phone) return '';
          let n = phone.replace(/[^\d+]/g, '');
          if (n.startsWith('+')) return n.slice(1);
          if (n.startsWith('00')) return n.slice(2);
          return n;
        };

        const openWaLink = (phone, msg) => {
          const num = formatWaNum(phone);
          if (!num) return;
          window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
        };

        const handleWaGenerate = () => {
          const targets = contacts.filter(c => waSelected.has(c.id) && c.phone);
          setWaLinks(targets.map(c => ({
            id: c.id, name: c.name, phone: c.phone,
            message: waForm.message.replace(/\{name\}/g, c.name || 'Cliente'),
          })));
        };

        const WA_IT = [
          { label: 'Offerta', message: `Ciao {name},\n\nhai una promozione speciale da ${activeShop?.name || 'noi'}:\n\n[Descrivi qui l'offerta]\n\nVieni a trovarci oppure rispondi per info.` },
          { label: 'Novità', message: `Ciao {name},\n\nnuovi prodotti disponibili da ${activeShop?.name || 'noi'}!\n\n[Descrivi i nuovi articoli]\n\nPassaci a dare un'occhiata!` },
          { label: 'Riparazione pronta', message: `Ciao {name},\n\nla tua riparazione è pronta per il ritiro da ${activeShop?.name || 'noi'}.\n\nSiamo aperti negli orari abituali. Per info rispondi a questo messaggio.` },
          { label: 'Ordine pronto', message: `Ciao {name},\n\nil tuo ordine è arrivato!\n\nPuoi passare a ritirarlo da ${activeShop?.name || 'noi'}.` },
          { label: 'Pagamento', message: `Ciao {name},\n\nti ricordiamo che risulta un pagamento in sospeso.\n\nContattaci per regolarizzare la situazione.\n\n${activeShop?.name || 'Il nostro negozio'}` },
          { label: 'Promemoria', message: `Ciao {name},\n\necco un promemoria da ${activeShop?.name || 'noi'}:\n\n[Dettaglio promemoria]\n\nSiamo a tua disposizione.` },
          { label: 'Grazie', message: `Ciao {name},\n\ngrazie per aver scelto ${activeShop?.name || 'noi'}!\n\nSiamo felici di averti come cliente.` },
          { label: 'Garanzia', message: `Ciao {name},\n\nla garanzia del tuo dispositivo sta per scadere.\n\nContattaci per maggiori info.\n\n${activeShop?.name || 'Il nostro negozio'}` },
          { label: 'Chiusura', message: `Ciao {name},\n\n${activeShop?.name || 'Il nostro negozio'} sarà chiuso dal [Data inizio] al [Data fine].\nRiapriremo il [Data riapertura]. Grazie!` },
          { label: 'Nuovo orario', message: `Ciao {name},\n\nnuovi orari da ${activeShop?.name || 'noi'}:\n\nLun-Ven: [orario]\nSab: [orario]` },
          { label: 'Recensione', message: `Ciao {name}, grazie per aver scelto ${activeShop?.name || 'noi'}! Potresti lasciarci una breve recensione? Ci aiuta molto. Grazie!` },
          { label: 'Porta un Amico', message: `Ciao {name}! Porta un amico da noi e riceverete entrambi un vantaggio speciale. Basta che menzioni il tuo nome. Ti aspettiamo!` },
          { label: 'Appuntamento', message: `Ciao {name}, confermiamo il tuo appuntamento per il [Data] alle [Ora] presso ${activeShop?.name || 'noi'}. Per qualsiasi modifica scrivici. A presto!` },
          { label: 'Promo Stagionale', message: `Ciao {name}! Solo per questa stagione hai diritto a un'offerta esclusiva da ${activeShop?.name || 'noi'}. Vieni a trovarci per tutti i dettagli!` },
          { label: 'Di Nuovo Disponibile', message: `Ciao {name}, ottima notizia! L'articolo che cercavi e' di nuovo disponibile da ${activeShop?.name || 'noi'}. Affrettati, potrebbe finire!` },
          { label: 'Aggiornamento Prezzi', message: `Ciao {name}, ti informiamo che dal [Data] alcuni prezzi saranno aggiornati. Per qualsiasi dubbio siamo a disposizione. Grazie per la tua fiducia in ${activeShop?.name || 'noi'}!` },
          { label: 'Sondaggio', message: `Ciao {name}! Ci farebbe piacere sapere la tua opinione sulla tua recente visita da ${activeShop?.name || 'noi'}. Ci vogliono solo 2 minuti: [link]. Grazie!` },
        ];
        const WA_EN = [
          { label: 'Offer', message: `Hi {name},\n\nyou have a special offer from ${activeShop?.name || 'us'}:\n\n[Describe the offer]\n\nCome visit us or reply for more info.` },
          { label: 'New Arrivals', message: `Hi {name},\n\nnew products available at ${activeShop?.name || 'us'}!\n\n[Describe the new items]\n\nCome check them out.` },
          { label: 'Repair Ready', message: `Hi {name},\n\nyour repair is ready for pickup at ${activeShop?.name || 'us'}.\n\nWe are open during regular hours. Reply for more info.` },
          { label: 'Order Ready', message: `Hi {name},\n\nyour order has arrived!\n\nYou can pick it up at ${activeShop?.name || 'us'}.` },
          { label: 'Payment', message: `Hi {name},\n\nwe would like to remind you of a pending payment on your account.\n\nPlease contact us to resolve this.\n\n${activeShop?.name || 'Our Shop'}` },
          { label: 'Reminder', message: `Hi {name},\n\na friendly reminder from ${activeShop?.name || 'us'}:\n\n[Reminder details]\n\nFeel free to reach out.` },
          { label: 'Thank You', message: `Hi {name},\n\nthank you for choosing ${activeShop?.name || 'us'}!\n\nWe appreciate having you as our customer.` },
          { label: 'Warranty', message: `Hi {name},\n\nthe warranty on your device is about to expire.\n\nContact us for more info.\n\n${activeShop?.name || 'Our Shop'}` },
          { label: 'Shop Closed', message: `Hi {name},\n\n${activeShop?.name || 'Our Shop'} will be closed from [Start Date] to [End Date].\nWe reopen on [Reopening Date]. Thank you!` },
          { label: 'New Hours', message: `Hi {name},\n\nnew opening hours at ${activeShop?.name || 'us'}:\n\nMon-Fri: [hours]\nSat: [hours]` },
          { label: 'Review Request', message: `Hi {name}, thank you for choosing ${activeShop?.name || 'us'}! Could you leave us a short review? It means a lot to us. Thank you!` },
          { label: 'Refer a Friend', message: `Hi {name}! Bring a friend to ${activeShop?.name || 'us'} and you will both receive a special benefit. Just mention your name when they visit. See you soon!` },
          { label: 'Appointment', message: `Hi {name}, your appointment at ${activeShop?.name || 'us'} is confirmed for [Date] at [Time]. Need to reschedule? Just message us. See you soon!` },
          { label: 'Seasonal Promo', message: `Hi {name}! This season we have a special offer just for you at ${activeShop?.name || 'us'}. Come visit us to find out more!` },
          { label: 'Back in Stock', message: `Hi {name}, great news! The item you were looking for is back in stock at ${activeShop?.name || 'us'}. Come get it before it is gone!` },
          { label: 'Price Update', message: `Hi {name}, just a heads-up: from [Date] some of our prices will be updated at ${activeShop?.name || 'us'}. Any questions, we are here to help. Thank you!` },
          { label: 'Survey', message: `Hi {name}! We would love to hear about your recent visit to ${activeShop?.name || 'us'}. It only takes 2 min: [link]. Thank you so much!` },
        ];
        const waSuggestions = waLang === 'en' ? WA_EN : WA_IT;
        const WA_ICON_PATH = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z";
        const WaIcon = ({ className = 'w-4 h-4' }) => <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d={WA_ICON_PATH} /></svg>;

        return (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-800">WhatsApp Box</h2>
                <p className="text-sm text-gray-500 mt-0.5">{contacts.length} contacts</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setWaOpen(v => !v); setWaLinks([]); setWaSelected(new Set()); setWaForm({ message: '' }); setWaComposeOpen(false); }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl text-sm transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                  Broadcast
                </button>
                <button
                  onClick={() => { setWaComposeOpen(v => !v); setWaOpen(false); }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl text-sm transition-colors shadow-sm"
                >
                  <WaIcon />
                  {waComposeOpen ? 'Close' : 'Compose'}
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" /></svg>
              <input
                type="text"
                placeholder="Search contacts by name, phone or email..."
                value={waSearch}
                onChange={e => setWaSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-300"
              />
              {waSearch && (
                <button onClick={() => setWaSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>

            {/* Broadcast Panel */}
            {waOpen && (
              <div className="rounded-2xl border border-green-200 bg-green-50/40 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-green-800 text-sm flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                      Broadcast WhatsApp
                    </h3>
                    <p className="text-xs text-green-600 mt-0.5">Generate WhatsApp links for selected contacts. Use <code className="bg-green-100 px-1 rounded">{'{name}'}</code> to personalize.</p>
                  </div>
                  <div className="flex items-center gap-1 bg-white border border-green-200 rounded-xl p-1">
                    <button onClick={() => setWaLang('it')} className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${waLang === 'it' ? 'bg-green-600 text-white' : 'text-green-700 hover:bg-green-50'}`}>IT</button>
                    <button onClick={() => setWaLang('en')} className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${waLang === 'en' ? 'bg-green-600 text-white' : 'text-green-700 hover:bg-green-50'}`}>EN</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold text-green-700 mb-2">Quick Suggestions</p>
                    <div className="flex flex-wrap gap-2">
                      {waSuggestions.map((tpl, i) => (
                        <button key={i} onClick={() => setWaForm({ message: tpl.message })}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-green-200 text-green-700 hover:bg-green-100 transition-colors">
                          {tpl.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-600">Select Recipients ({waSelected.size} / {contacts.filter(c => c.phone).length} with phone)</p>
                    <div className="flex gap-2">
                      <button onClick={() => setWaSelected(new Set(contacts.filter(c => c.phone).map(c => c.id)))} className="text-xs font-semibold text-green-600 hover:underline">Select All</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => setWaSelected(new Set())} className="text-xs font-semibold text-gray-400 hover:underline">Deselect All</button>
                    </div>
                  </div>
                </div>

                <textarea rows={5}
                  placeholder="Message * (use {name} to personalize)"
                  value={waForm.message}
                  onChange={e => setWaForm({ message: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-green-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"
                />

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-gray-600">Select Recipients ({waSelected.size} / {contacts.filter(c => c.phone).length} with phone)</p>
                    <div className="flex gap-2">
                      <button onClick={() => setWaSelected(new Set(contacts.filter(c => c.phone).map(c => c.id)))} className="text-xs font-semibold text-green-600 hover:underline">Select All</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => setWaSelected(new Set())} className="text-xs font-semibold text-gray-400 hover:underline">Deselect All</button>
                    </div>
                  </div>
                  {contacts.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No saved contacts yet.</p>
                  ) : (
                    <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                      {contacts.map(c => (
                        <label key={c.id} className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${!c.phone ? 'opacity-40 cursor-not-allowed bg-gray-50 border-gray-100' :
                            waSelected.has(c.id) ? 'bg-green-100 border-green-300' : 'bg-white border-gray-100 hover:border-green-200'
                          }`}>
                          <input type="checkbox" className="accent-green-600 w-4 h-4" disabled={!c.phone}
                            checked={waSelected.has(c.id)}
                            onChange={e => {
                              if (!c.phone) return;
                              const s = new Set(waSelected);
                              e.target.checked ? s.add(c.id) : s.delete(c.id);
                              setWaSelected(s);
                            }}
                          />
                          <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center text-green-700 font-bold text-xs shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-xs">{c.name}</p>
                            <p className={`text-[11px] truncate ${c.phone ? 'text-green-600' : 'text-gray-400'}`}>{c.phone || 'No phone number'}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {waLinks.length > 0 && (
                  <div className="rounded-xl border border-green-200 bg-white p-3 space-y-2">
                    {/* Step-by-step mode */}
                    {waSending ? (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-green-700">
                            {waSentCount >= waLinks.length ? '✓ All sent!' : `Sending ${waSentCount + 1} / ${waLinks.length}`}
                          </p>
                          <button
                            onClick={() => { setWaSending(false); setWaSentCount(0); }}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >✕ Close</button>
                        </div>
                        <div className="w-full bg-green-100 rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full transition-all duration-300" style={{ width: `${(waSentCount / waLinks.length) * 100}%` }} />
                        </div>
                        {/* Current contact card */}
                        {waSentCount < waLinks.length && (() => {
                          const current = waLinks[waSentCount];
                          const num = current.phone ? current.phone.replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^00/, '') : '';
                          const waUrl = `https://wa.me/${num}?text=${encodeURIComponent(current.message)}`;
                          return (
                            <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 text-center space-y-3">
                              <p className="text-lg font-bold text-gray-800">{current.name}</p>
                              <p className="text-sm text-green-600">{current.phone}</p>
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full py-3 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-bold rounded-xl text-base transition-colors shadow-lg"
                              >
                                <WaIcon className="w-5 h-5" />
                                Open WhatsApp
                              </a>
                              <button
                                onClick={() => setWaSentCount(c => c + 1)}
                                className="flex items-center justify-center gap-2 w-full py-2.5 bg-orange-500 hover:bg-orange-400 active:bg-orange-600 text-white font-bold rounded-xl text-sm transition-colors"
                              >
                                {waSentCount + 1 < waLinks.length
                                  ? `Next → ${waLinks[waSentCount + 1]?.name}`
                                  : 'Done ✓'
                                }
                              </button>
                            </div>
                          );
                        })()}
                        {waSentCount >= waLinks.length && (
                          <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 text-center">
                            <p className="text-2xl">✅</p>
                            <p className="font-bold text-green-700 mt-1">All {waLinks.length} messages sent!</p>
                          </div>
                        )}
                        {/* Sent list */}
                        <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                          {waLinks.map((l, i) => (
                            <div key={l.id} className={`flex items-center gap-2 py-1 px-2 rounded-lg text-xs ${
                              i < waSentCount ? 'bg-green-100 text-green-700' : i === waSentCount ? 'bg-amber-50 text-amber-700 font-bold' : 'text-gray-400'
                            }`}>
                              <span>{i < waSentCount ? '✓' : i === waSentCount ? '→' : `${i + 1}.`}</span>
                              <span className="truncate">{l.name}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      /* Normal list mode */
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-green-700">{waLinks.length} link{waLinks.length !== 1 ? 's' : ''} ready</p>
                          <button
                            onClick={() => { setWaSending(true); setWaSentCount(0); }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                          >
                            <WaIcon className="w-3.5 h-3.5" />
                            Send All ({waLinks.length})
                          </button>
                        </div>
                        <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                          {waLinks.map((l, i) => (
                            <div key={l.id} className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-lg border bg-green-50 border-green-100">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xs font-bold text-green-700 shrink-0">{i + 1}.</span>
                                <div className="min-w-0">
                                  <p className="font-semibold text-gray-800 text-xs truncate">{l.name}</p>
                                  <p className="text-green-600 text-[11px]">{l.phone}</p>
                                </div>
                              </div>
                              <button onClick={() => openWaLink(l.phone, l.message)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-bold transition-colors shrink-0">
                                <WaIcon className="w-3 h-3" />
                                Open
                              </button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <button onClick={handleWaGenerate}
                  disabled={waSelected.size === 0 || !waForm.message.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-colors shadow-sm"
                >
                  <WaIcon />
                  Generate Links for {waSelected.size} Contact{waSelected.size !== 1 ? 's' : ''}
                </button>
              </div>
            )}

            {/* Compose Panel */}
            {waComposeOpen && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div className="relative">
                    <input type="text" placeholder="Client Name"
                      value={waComposeForm.name}
                      onChange={e => setWaComposeForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-300"
                    />
                    {contacts.filter(c => c.phone).length > 0 && (
                      <select className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-green-600 bg-transparent border-none outline-none cursor-pointer"
                        value=""
                        onChange={e => {
                          const c = contacts.find(x => x.id === e.target.value);
                          if (c) setWaComposeForm(f => ({ ...f, name: c.name, phone: c.phone || f.phone }));
                        }}
                      >
                        <option value="">📋</option>
                        {contacts.filter(c => c.phone).map(c => (
                          <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <input type="tel" placeholder="Phone Number * (e.g. +39 333 1234567)"
                    value={waComposeForm.phone}
                    onChange={e => setWaComposeForm(f => ({ ...f, phone: e.target.value }))}
                    className="px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-300"
                  />
                </div>
                <textarea rows={4} placeholder="Message *"
                  value={waComposeForm.message}
                  onChange={e => setWaComposeForm(f => ({ ...f, message: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-300 resize-none mb-3"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      if (!waComposeForm.phone || !waComposeForm.message) return;
                      openWaLink(waComposeForm.phone, waComposeForm.message);
                      setWaComposeForm({ name: '', phone: '', message: '' });
                    }}
                    disabled={!waComposeForm.phone || !waComposeForm.message}
                    className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-colors shadow-sm"
                  >
                    <WaIcon />
                    Open WhatsApp
                  </button>
                  {waComposeForm.name && waComposeForm.phone && (
                    <button
                      onClick={() => { addOrUpdateContact({ name: waComposeForm.name, email: '', phone: waComposeForm.phone }); }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white border border-green-300 hover:bg-green-50 text-green-700 font-semibold rounded-xl text-sm transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      Save Contact
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* CONTACTS */}
            <div className="space-y-3">
              {contactFormOpen ? (
                <div className="rounded-2xl border border-green-200 bg-green-50/40 p-4">
                  <p className="text-xs font-bold text-green-700 mb-3">New Contact</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                    <input type="text" placeholder="Name *" value={contactForm.name}
                      onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                      className="px-3 py-2.5 rounded-xl border border-green-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-300"
                    />
                    <input type="email" placeholder="Email" value={contactForm.email}
                      onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                      className="px-3 py-2.5 rounded-xl border border-green-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-300"
                    />
                    <input type="tel" placeholder="Phone *" value={contactForm.phone}
                      onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                      className="px-3 py-2.5 rounded-xl border border-green-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-300"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => {
                      if (!contactForm.name || (!contactForm.email && !contactForm.phone)) return;
                      addOrUpdateContact({ name: contactForm.name.trim(), email: contactForm.email.trim(), phone: contactForm.phone.trim() });
                      setContactForm({ name: '', email: '', phone: '' });
                      setContactFormOpen(false);
                    }} disabled={!contactForm.name || (!contactForm.email && !contactForm.phone)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors">Save Contact</button>
                    <button onClick={() => { setContactFormOpen(false); setContactForm({ name: '', email: '', phone: '' }); }}
                      className="px-4 py-2 border border-gray-200 text-gray-600 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setContactFormOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-green-200 text-green-500 font-semibold rounded-2xl hover:border-green-400 hover:bg-green-50/50 transition-all text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Add New Contact
                </button>
              )}

              {waFilteredContacts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
                    <WaIcon className="w-7 h-7 text-green-400" />
                  </div>
                  <p className="text-gray-600 font-semibold">No saved contacts</p>
                  <p className="text-gray-400 text-sm mt-1">Add contacts to send WhatsApp messages</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {waFilteredContacts.map(c => (
                    <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 space-y-2 hover:border-green-200 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center shrink-0 text-green-700 font-bold text-sm">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 text-sm leading-tight truncate">{c.name}</p>
                          {c.phone
                            ? <p className="text-green-600 text-[11px]">{c.phone}</p>
                            : <p className="text-gray-300 text-[11px]">no phone</p>
                          }
                          {c.email && <p className="text-gray-400 text-[11px] truncate">{c.email}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        {c.phone ? (
                          <button
                            onClick={() => { setWaComposeForm({ name: c.name, phone: c.phone, message: '' }); setWaComposeOpen(true); setWaOpen(false); }}
                            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-[11px] font-semibold transition-colors border border-green-200"
                          >
                            <WaIcon className="w-3 h-3" />
                            WhatsApp
                          </button>
                        ) : (
                          <span className="flex-1 text-center text-gray-300 text-[11px] py-1.5">no phone</span>
                        )}
                        <button
                          onClick={() => { removeContact(c.id); }}
                          className="p-1.5 border border-red-100 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

    </div>
  );
}
