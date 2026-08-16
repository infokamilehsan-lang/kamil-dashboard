import { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { useLanguage } from '../context/LanguageContext';
import { useFmt } from '../lib/useFmt';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import DatePicker from '../components/DatePicker';
import { financialSummary } from '../lib/financials';

export default function ReportsPage() {
  const { activeShop } = useShop();
  const { t, locale } = useLanguage();
  const { fmt, fmtDate } = useFmt();

  const [reportView, setReportView] = useState('daily');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [reportSection, setReportSection] = useState('all');
  const [reportSearch, setReportSearch] = useState('');
  const [reportFilter, setReportFilter] = useState('all');
  const it = String(locale).startsWith('it');

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
        const periodLedger = financialSummary(activeShop, (date) => isInPeriod(date));
        const grandIncome = periodLedger.income;
        const grandExpense = periodLedger.expense;
        const grandProfit = periodLedger.profit;

        const hasAnyData = periodTxs.length > 0 || periodRepairs.length > 0 || periodAdvances.length > 0
          || periodMovements.length > 0 || shBought.length > 0 || shSold.length > 0;
        const sectionHasData = reportSection === 'all' ? hasAnyData : ({ transactions: periodTxs.length, repairs: periodRepairs.length, advances: periodAdvances.length, inventory: periodMovements.length, secondhand: shBought.length + shSold.length, team: activeTeam.length }[reportSection] || 0) > 0;

        const matchesSearch = (record) => {
          const query = reportSearch.trim().toLowerCase();
          if (!query) return true;
          return Object.values(record || {}).some((value) => ['string', 'number'].includes(typeof value) && String(value).toLowerCase().includes(query));
        };
        const filteredTxs = periodTxs.filter((item) => matchesSearch(item) && (reportFilter === 'all' || item.type === reportFilter));
        const filteredRepairs = periodRepairs.filter((item) => matchesSearch(item) && (reportFilter === 'all' || item.status === reportFilter));
        const filteredAdvances = periodAdvances.filter((item) => {
          const paymentStatus = Number(item.remaining) > 0 ? 'pending' : 'completed';
          return matchesSearch(item) && (reportFilter === 'all' || item.status === reportFilter || paymentStatus === reportFilter);
        });
        const filteredMovements = periodMovements.filter((item) => matchesSearch(item) && (reportFilter === 'all' || (reportFilter === 'stock_in' && item.type === 'in') || (reportFilter === 'stock_out' && item.type === 'out')));
        const filteredSecondhand = [...shBought.map((item) => ({ ...item, _type: 'bought' })), ...shSold.map((item) => ({ ...item, _type: 'sold' }))]
          .filter((item) => matchesSearch(item) && (reportFilter === 'all' || item._type === reportFilter || item.status === reportFilter))
          .sort((a, b) => (b.buyDate || '').localeCompare(a.buyDate || ''));
        const filteredTeam = team.filter((item) => matchesSearch(item) && (reportFilter === 'all' || item.status === reportFilter));
        const visibleResultCount = reportSection === 'transactions' ? filteredTxs.length
          : reportSection === 'repairs' ? filteredRepairs.length
            : reportSection === 'advances' ? filteredAdvances.length
              : reportSection === 'inventory' ? filteredMovements.length
                : reportSection === 'secondhand' ? filteredSecondhand.length
                  : reportSection === 'team' ? filteredTeam.length
                    : filteredTxs.length + filteredRepairs.length + filteredAdvances.length + filteredMovements.length + filteredSecondhand.length + filteredTeam.length;

        const statusBadge = (status) => {
          const m = { ready: 'bg-emerald-100 text-emerald-700', delivered: 'bg-gray-100 text-gray-500', completed: 'bg-blue-100 text-blue-700', parts_ordered: 'bg-sky-100 text-sky-700', in_progress: 'bg-amber-100 text-amber-700', pending: 'bg-orange-100 text-orange-700', cancelled: 'bg-red-100 text-red-600' };
          const cls = m[status] || 'bg-gray-100 text-gray-500';
          const label = { parts_ordered: t('status_parts_ordered'), in_progress: t('status_in_progress'), ready: t('status_ready'), delivered: t('status_delivered'), pending: t('status_pending'), completed: t('status_completed') }[status] || (status.charAt(0).toUpperCase() + status.slice(1));
          return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${cls}`}>{label}</span>;
        };

        const legacyDownloadPDF = () => {
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
            const ledger = financialSummary(activeShop, (date) => inP(date));
            const income = ledger.income;
            const expense = ledger.expense;
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

        const downloadPDF = () => {
          const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
          const lime = [198, 255, 52];
          const vanilla = [241, 254, 200];
          const ink = [16, 20, 8];
          const muted = [92, 101, 77];
          const width = doc.internal.pageSize.getWidth();
          const periodLabel = reportView === 'daily'
            ? fmtDate(reportDate)
            : reportView === 'monthly'
              ? new Date(`${reportMonth}-01`).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
              : (it ? 'Tutto il periodo' : 'All time');
          const stockCost = skus.reduce((sum, sku) => sum + ((Number(sku.stock) || 0) * (Number(sku.buyPrice) || 0)), 0);

          const header = (title, subtitle = periodLabel) => {
            doc.setFillColor(...lime);
            doc.rect(0, 0, width, 43, 'F');
            doc.setTextColor(...ink);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(15);
            doc.text(activeShop.name || 'Shop Manager', 14, 10);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.8);
            const legalName = activeShop.ragioneSociale || activeShop.name || '';
            const taxDetails = [
              activeShop.partitaIva && `P.IVA: ${activeShop.partitaIva}`,
              activeShop.codiceFiscale && `C.F.: ${activeShop.codiceFiscale}`,
              activeShop.rea && `REA: ${activeShop.rea}`,
            ].filter(Boolean).join('  |  ');
            const address = [activeShop.address, activeShop.city, activeShop.country].filter(Boolean).join(', ');
            const contacts = [
              activeShop.phone && `${it ? 'Tel' : 'Phone'}: ${activeShop.phone}`,
              activeShop.whatsapp && `WhatsApp: ${activeShop.whatsapp}`,
              activeShop.email && `Email: ${activeShop.email}`,
              activeShop.pec && `Email: ${activeShop.pec}`,
              activeShop.sdiCode && `SDI: ${activeShop.sdiCode}`,
            ].filter(Boolean).join('  |  ');
            if (legalName) doc.text(`${it ? 'Ragione sociale' : 'Legal name'}: ${legalName}`.slice(0, 105), 14, 17);
            if (taxDetails) doc.text(taxDetails.slice(0, 105), 14, 23);
            if (address) doc.text(`${it ? 'Indirizzo' : 'Address'}: ${address}`.slice(0, 105), 14, 29);
            if (contacts) doc.text(contacts.slice(0, 105), 14, 35);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text(title, width - 14, 11, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text(subtitle, width - 14, 19, { align: 'right' });
            doc.setFontSize(6.8);
            doc.text(`${it ? 'Generato' : 'Generated'}: ${new Date().toLocaleDateString(locale)}`, width - 14, 27, { align: 'right' });
          };
          const newSection = (title, subtitle) => {
            doc.addPage();
            header(title, subtitle);
          };
          const metricCards = (items, top = 50) => {
            const gap = 4;
            const cardWidth = (width - 28 - gap * (items.length - 1)) / items.length;
            items.forEach(([label, value], index) => {
              const x = 14 + index * (cardWidth + gap);
              doc.setFillColor(...vanilla);
              doc.setDrawColor(211, 225, 166);
              doc.roundedRect(x, top, cardWidth, 24, 3, 3, 'FD');
              doc.setTextColor(...muted);
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(6.8);
              doc.text(String(label).toUpperCase(), x + 4, top + 7);
              doc.setTextColor(...ink);
              doc.setFontSize(11.5);
              doc.text(String(value), x + 4, top + 17);
            });
            return top + 31;
          };
          const detailTable = (head, rows, startY, foot) => autoTable(doc, {
            startY,
            head: [head],
            body: rows.length ? rows : [[it ? 'Nessun dato nel periodo selezionato' : 'No data in selected period', ...head.slice(1).map(() => '')]],
            foot: foot ? [foot] : undefined,
            theme: 'grid',
            headStyles: { fillColor: ink, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
            bodyStyles: { fontSize: 7, textColor: ink, cellPadding: 2.2 },
            alternateRowStyles: { fillColor: [248, 252, 236] },
            footStyles: { fillColor: vanilla, textColor: ink, fontStyle: 'bold' },
            margin: { left: 14, right: 14, bottom: 16 },
          });

          header(it ? '01 · TRANSAZIONI' : '01 · TRANSACTIONS');
          let y = metricCards([[it ? 'Entrate' : 'Income', fmt(periodTxIncome)], [it ? 'Uscite' : 'Expenses', fmt(periodTxExpense)], [it ? 'Saldo' : 'Balance', fmt(periodTxIncome - periodTxExpense)]]);
          detailTable([it ? 'Data' : 'Date', it ? 'Descrizione' : 'Description', it ? 'Categoria' : 'Category', it ? 'Metodo' : 'Method', it ? 'Importo' : 'Amount'], periodTxs.map((tx) => [fmtDate(tx.date), tx.description || '-', tx.category || '-', tx.paymentMethod || '-', `${tx.type === 'expense' ? '-' : '+'}${fmt(tx.amount || 0)}`]), y, [it ? 'Totale' : 'Total', '', '', '', fmt(periodTxIncome - periodTxExpense)]);

          newSection(it ? '02 · RIPARAZIONI' : '02 · REPAIRS');
          const repairCollected = periodRepairs.reduce((sum, repair) => sum + (Number(repair.advance) || 0) + (repair.payments || []).reduce((s, payment) => s + (Number(payment.amount) || 0), 0), 0);
          y = metricCards([[it ? 'Lavori' : 'Jobs', periodRepairs.length], [it ? 'Incassato' : 'Collected', fmt(repairCollected)], [it ? 'Parti' : 'Parts', fmt(repPartsExpense)], [it ? 'Profitto stimato' : 'Est. profit', fmt(repairCollected - repPartsExpense)]]);
          detailTable([it ? 'Cliente' : 'Customer', it ? 'Dispositivo' : 'Device', 'IMEI', it ? 'Stato' : 'Status', it ? 'Totale' : 'Total', it ? 'Pagato' : 'Paid', it ? 'Resta' : 'Due'], periodRepairs.map((repair) => {
            const paid = (Number(repair.advance) || 0) + (repair.payments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
            const total = Number(repair.repairCost) || 0;
            return [repair.customerName || '-', repair.device || '-', repair.imei || '-', repair.status || '-', fmt(total), fmt(paid), fmt(Math.max(0, total - paid))];
          }), y);

          newSection(it ? '03 · ORDINI CLIENTI' : '03 · CUSTOMER ORDERS');
          const ordersTotal = periodAdvances.reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0);
          const ordersPaid = periodAdvances.reduce((sum, order) => sum + (Number(order.advancePaid) || 0) + (order.payments || []).reduce((s, payment) => s + (Number(payment.amount) || 0), 0), 0);
          const ordersCost = periodAdvances.reduce((sum, order) => sum + (Number(order.productCost) || 0), 0);
          y = metricCards([[it ? 'Ordini' : 'Orders', periodAdvances.length], [it ? 'Vendite' : 'Sales', fmt(ordersTotal)], [it ? 'Ricevuto' : 'Received', fmt(ordersPaid)], [it ? 'Rimane' : 'Remaining', fmt(Math.max(0, ordersTotal - ordersPaid))]]);
          detailTable([it ? 'Cliente' : 'Customer', it ? 'Prodotto' : 'Product', it ? 'Data' : 'Date', it ? 'Arrivo' : 'Arrival', it ? 'Stato' : 'Status', it ? 'Costo' : 'Cost', it ? 'Totale' : 'Total', it ? 'Resta' : 'Due'], periodAdvances.map((order) => {
            const paid = (Number(order.advancePaid) || 0) + (order.payments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
            return [order.customerName || '-', order.productName || order.description || '-', fmtDate(order.date), fmtDate(order.expectedDate || order.expectedArrival), order.status || '-', fmt(order.productCost || 0), fmt(order.totalAmount || 0), fmt(Math.max(0, (Number(order.totalAmount) || 0) - paid))];
          }), y, [it ? 'Totali' : 'Totals', '', '', '', '', fmt(ordersCost), fmt(ordersTotal), fmt(Math.max(0, ordersTotal - ordersPaid))]);

          newSection(it ? '04 · INVENTARIO' : '04 · INVENTORY');
          y = metricCards([[it ? 'Prodotti / SKU' : 'Products / SKU', skus.length], [it ? 'Carico' : 'Stock in', invTotalInQty], [it ? 'Venduto' : 'Stock out', invTotalOutQty], [it ? 'Valore attuale' : 'Current value', fmt(stockCost)]]);
          detailTable([it ? 'Data' : 'Date', 'SKU', it ? 'Prodotto' : 'Product', it ? 'Movimento' : 'Movement', it ? 'Qtà' : 'Qty', it ? 'Prezzo unitario' : 'Unit price', it ? 'Totale' : 'Total'], periodMovements.map((movement) => [fmtDate(movement.date), movement.skuCode || '-', movement.skuName || '-', movement.type === 'in' ? (it ? 'Carico' : 'Stock in') : (it ? 'Vendita' : 'Stock out'), movement.qty || 0, fmt(movement.price || 0), fmt((Number(movement.price) || 0) * (Number(movement.qty) || 1))]), y);

          newSection(it ? '05 · USATO' : '05 · SECONDHAND');
          const periodSecondhand = secondhand.filter((item) => isInPeriod(item.buyDate) || (item.status === 'sold' && isInPeriod(item.sellDate)));
          y = metricCards([[it ? 'Acquistati' : 'Bought', shBought.length], [it ? 'Venduti' : 'Sold', shSold.length], [it ? 'Costo acquisti' : 'Purchase cost', fmt(shBoughtCost)], [it ? 'Profitto' : 'Profit', fmt(shProfit)]]);
          detailTable([it ? 'Prodotto' : 'Product', 'IMEI', it ? 'Acquistato da' : 'Bought from', it ? 'Data' : 'Date', it ? 'Stato' : 'Status', it ? 'Costo' : 'Buy', it ? 'Vendita' : 'Sell', it ? 'Profitto' : 'Profit'], periodSecondhand.map((item) => [item.name || item.productName || '-', item.imei || '-', item.sellerName || item.customerName || '-', fmtDate(item.buyDate), item.status || '-', fmt(item.buyPrice || 0), item.status === 'sold' ? fmt(item.sellPrice || 0) : '-', item.status === 'sold' ? fmt((Number(item.sellPrice) || 0) - (Number(item.buyPrice) || 0)) : '-']), y);

          newSection(it ? '06 · TEAM E STIPENDI' : '06 · TEAM & PAYROLL', it ? 'Situazione attuale' : 'Current position');
          y = metricCards([[it ? 'Personale' : 'Total staff', team.length], [it ? 'Attivi' : 'Active', activeTeam.length], [it ? 'Stipendi mensili' : 'Monthly payroll', fmt(totalPayroll)]]);
          detailTable([it ? 'Nome' : 'Name', it ? 'Ruolo' : 'Role', it ? 'Telefono' : 'Phone', it ? 'Stato' : 'Status', it ? 'Stipendio mensile' : 'Monthly salary'], team.map((member) => [member.name || '-', member.role || '-', member.phone || '-', member.status || '-', fmt(member.salary || 0)]), y, [it ? 'Totale' : 'Total', '', '', '', fmt(totalPayroll)]);

          const pages = doc.internal.getNumberOfPages();
          for (let page = 1; page <= pages; page += 1) {
            doc.setPage(page);
            doc.setTextColor(...muted);
            doc.setFontSize(7.5);
            doc.text(`${activeShop.name || 'Shop Manager'} · ${periodLabel} · ${it ? 'Pagina' : 'Page'} ${page}/${pages}`, width / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
          }
          doc.save(`${activeShop.name || 'shop'}_complete_report_${new Date().toISOString().slice(0, 10)}.pdf`);
        };

        const legacyPrintReport = () => {
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
              const ledger = financialSummary(activeShop, (date) => inP(date));
              const income = ledger.income;
              const expense = ledger.expense;
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

            <div className="rounded-2xl border border-black/10 bg-white p-2 shadow-sm overflow-x-auto">
              <div className="flex gap-2 min-w-max">{[
                ['all', it ? 'Tutto' : 'Everything'],
                ['transactions', it ? 'Transazioni' : 'Transactions'],
                ['repairs', it ? 'Riparazioni' : 'Repairs'],
                ['advances', it ? 'Ordini clienti' : 'Customer orders'],
                ['inventory', it ? 'Inventario' : 'Inventory'],
                ['secondhand', it ? 'Usato' : 'Secondhand'],
                ['team', it ? 'Squadra' : 'Team'],
              ].map(([value, label]) => <button type="button" key={value} onClick={() => setReportSection(value)} className="px-4 py-2.5 rounded-xl text-xs font-black border border-transparent transition-all" style={{ background: reportSection === value ? '#c6ff34' : '#f7f7f5', borderColor: reportSection === value ? 'rgba(0,0,0,.12)' : 'transparent' }}>{label}</button>)}</div>
            </div>
            ${sectionsHtml}
            <div class="footer">${activeShop.name} &middot; Complete Report &middot; ${new Date().toLocaleDateString()}</div>
          </body></html>`);
          win.document.close();
          win.focus();
          setTimeout(() => { win.print(); }, 400);
        };

        const printReport = () => {
          const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
          const periodLabel = reportView === 'daily'
            ? fmtDate(reportDate)
            : reportView === 'monthly'
              ? new Date(`${reportMonth}-01`).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
              : (it ? 'Tutto il periodo' : 'All time');
          const cards = (items) => `<div class="metrics">${items.map(([label, value]) => `<div class="metric"><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`).join('')}</div>`;
          const table = (headers, rows, footer) => `<div class="table-wrap"><table><thead><tr>${headers.map((head) => `<th>${esc(head)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}" class="empty">${it ? 'Nessun dato nel periodo selezionato' : 'No data in selected period'}</td></tr>`}</tbody>${footer ? `<tfoot><tr>${footer.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr></tfoot>` : ''}</table></div>`;
          const companyHeader = (title) => `<header class="company-header"><div class="company"><h1>${esc(activeShop.name || 'Shop Manager')}</h1><p><b>${it ? 'Ragione sociale' : 'Legal name'}:</b> ${esc(activeShop.ragioneSociale || activeShop.name || '-')}</p><p>${[activeShop.partitaIva && `P.IVA: ${activeShop.partitaIva}`, activeShop.codiceFiscale && `C.F.: ${activeShop.codiceFiscale}`, activeShop.rea && `REA: ${activeShop.rea}`].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ')}</p><p>${esc([activeShop.address, activeShop.city, activeShop.country].filter(Boolean).join(', '))}</p><p>${[activeShop.phone && `${it ? 'Tel' : 'Phone'}: ${activeShop.phone}`, activeShop.whatsapp && `WhatsApp: ${activeShop.whatsapp}`, activeShop.email && `Email: ${activeShop.email}`, activeShop.pec && `Email: ${activeShop.pec}`, activeShop.sdiCode && `SDI: ${activeShop.sdiCode}`].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ')}</p></div><div class="report-name"><h2>${esc(title)}</h2><p>${esc(periodLabel)}</p><span>${it ? 'Generato' : 'Generated'}: ${esc(new Date().toLocaleDateString(locale))}</span></div></header>`;
          const section = (title, metricItems, tableHtml) => `<section class="report-page">${companyHeader(title)}${cards(metricItems)}${tableHtml}</section>`;

          const repairCollected = periodRepairs.reduce((sum, repair) => sum + (Number(repair.advance) || 0) + (repair.payments || []).reduce((s, payment) => s + (Number(payment.amount) || 0), 0), 0);
          const ordersTotal = periodAdvances.reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0);
          const ordersPaid = periodAdvances.reduce((sum, order) => sum + (Number(order.advancePaid) || 0) + (order.payments || []).reduce((s, payment) => s + (Number(payment.amount) || 0), 0), 0);
          const ordersCost = periodAdvances.reduce((sum, order) => sum + (Number(order.productCost) || 0), 0);
          const stockCost = skus.reduce((sum, sku) => sum + ((Number(sku.stock) || 0) * (Number(sku.buyPrice) || 0)), 0);
          const periodSecondhand = secondhand.filter((item) => isInPeriod(item.buyDate) || (item.status === 'sold' && isInPeriod(item.sellDate)));

          const pages = [
            section(it ? '01 · TRANSAZIONI' : '01 · TRANSACTIONS', [[it ? 'Entrate' : 'Income', fmt(periodTxIncome)], [it ? 'Uscite' : 'Expenses', fmt(periodTxExpense)], [it ? 'Saldo' : 'Balance', fmt(periodTxIncome - periodTxExpense)]], table([it ? 'Data' : 'Date', it ? 'Descrizione' : 'Description', it ? 'Categoria' : 'Category', it ? 'Metodo' : 'Method', it ? 'Importo' : 'Amount'], periodTxs.map((tx) => [fmtDate(tx.date), tx.description || '-', tx.category || '-', tx.paymentMethod || '-', `${tx.type === 'expense' ? '-' : '+'}${fmt(tx.amount || 0)}`]), [it ? 'Totale' : 'Total', '', '', '', fmt(periodTxIncome - periodTxExpense)])),
            section(it ? '02 · RIPARAZIONI' : '02 · REPAIRS', [[it ? 'Lavori' : 'Jobs', periodRepairs.length], [it ? 'Incassato' : 'Collected', fmt(repairCollected)], [it ? 'Costo parti' : 'Parts cost', fmt(repPartsExpense)], [it ? 'Profitto stimato' : 'Est. profit', fmt(repairCollected - repPartsExpense)]], table([it ? 'Cliente' : 'Customer', it ? 'Dispositivo' : 'Device', 'IMEI', it ? 'Stato' : 'Status', it ? 'Totale' : 'Total', it ? 'Pagato' : 'Paid', it ? 'Resta' : 'Due'], periodRepairs.map((repair) => { const paid = (Number(repair.advance) || 0) + (repair.payments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0); const total = Number(repair.repairCost) || 0; return [repair.customerName || '-', repair.device || '-', repair.imei || '-', repair.status || '-', fmt(total), fmt(paid), fmt(Math.max(0, total - paid))]; }))),
            section(it ? '03 · ORDINI CLIENTI' : '03 · CUSTOMER ORDERS', [[it ? 'Ordini' : 'Orders', periodAdvances.length], [it ? 'Vendite' : 'Sales', fmt(ordersTotal)], [it ? 'Ricevuto' : 'Received', fmt(ordersPaid)], [it ? 'Rimane' : 'Remaining', fmt(Math.max(0, ordersTotal - ordersPaid))]], table([it ? 'Cliente' : 'Customer', it ? 'Prodotto' : 'Product', it ? 'Data' : 'Date', it ? 'Arrivo' : 'Arrival', it ? 'Stato' : 'Status', it ? 'Costo' : 'Cost', it ? 'Totale' : 'Total', it ? 'Resta' : 'Due'], periodAdvances.map((order) => { const paid = (Number(order.advancePaid) || 0) + (order.payments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0); return [order.customerName || '-', order.productName || order.description || '-', fmtDate(order.date), fmtDate(order.expectedDate || order.expectedArrival), order.status || '-', fmt(order.productCost || 0), fmt(order.totalAmount || 0), fmt(Math.max(0, (Number(order.totalAmount) || 0) - paid))]; }), [it ? 'Totali' : 'Totals', '', '', '', '', fmt(ordersCost), fmt(ordersTotal), fmt(Math.max(0, ordersTotal - ordersPaid))])),
            section(it ? '04 · INVENTARIO' : '04 · INVENTORY', [[it ? 'Prodotti / SKU' : 'Products / SKU', skus.length], [it ? 'Carico' : 'Stock in', invTotalInQty], [it ? 'Venduto' : 'Stock out', invTotalOutQty], [it ? 'Valore attuale' : 'Current value', fmt(stockCost)]], table([it ? 'Data' : 'Date', 'SKU', it ? 'Prodotto' : 'Product', it ? 'Movimento' : 'Movement', it ? 'Qtà' : 'Qty', it ? 'Prezzo' : 'Price', it ? 'Totale' : 'Total'], periodMovements.map((movement) => [fmtDate(movement.date), movement.skuCode || '-', movement.skuName || '-', movement.type === 'in' ? (it ? 'Carico' : 'Stock in') : (it ? 'Vendita' : 'Stock out'), movement.qty || 0, fmt(movement.price || 0), fmt((Number(movement.price) || 0) * (Number(movement.qty) || 1))]))),
            section(it ? '05 · USATO' : '05 · SECONDHAND', [[it ? 'Acquistati' : 'Bought', shBought.length], [it ? 'Venduti' : 'Sold', shSold.length], [it ? 'Costo acquisti' : 'Purchase cost', fmt(shBoughtCost)], [it ? 'Profitto' : 'Profit', fmt(shProfit)]], table([it ? 'Prodotto' : 'Product', 'IMEI', it ? 'Acquistato da' : 'Bought from', it ? 'Data' : 'Date', it ? 'Stato' : 'Status', it ? 'Costo' : 'Buy', it ? 'Vendita' : 'Sell', it ? 'Profitto' : 'Profit'], periodSecondhand.map((item) => [item.name || item.productName || '-', item.imei || '-', item.sellerName || item.customerName || '-', fmtDate(item.buyDate), item.status || '-', fmt(item.buyPrice || 0), item.status === 'sold' ? fmt(item.sellPrice || 0) : '-', item.status === 'sold' ? fmt((Number(item.sellPrice) || 0) - (Number(item.buyPrice) || 0)) : '-']))),
            section(it ? '06 · TEAM E STIPENDI' : '06 · TEAM & PAYROLL', [[it ? 'Personale' : 'Total staff', team.length], [it ? 'Attivi' : 'Active', activeTeam.length], [it ? 'Stipendi mensili' : 'Monthly payroll', fmt(totalPayroll)]], table([it ? 'Nome' : 'Name', it ? 'Ruolo' : 'Role', it ? 'Telefono' : 'Phone', it ? 'Stato' : 'Status', it ? 'Stipendio' : 'Salary'], team.map((member) => [member.name || '-', member.role || '-', member.phone || '-', member.status || '-', fmt(member.salary || 0)]), [it ? 'Totale' : 'Total', '', '', '', fmt(totalPayroll)])),
          ].join('');

          const win = window.open('', '_blank');
          if (!win) return;
          win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(activeShop.name || 'Shop')} — Report</title><style>
            @page{size:A4 portrait;margin:9mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#101408;background:#eef2e5}.report-page{width:100%;min-height:270mm;background:#fff;padding:0 0 12mm;page-break-after:always}.report-page:last-child{page-break-after:auto}.company-header{min-height:43mm;padding:8mm 10mm;background:#c6ff34;display:flex;justify-content:space-between;gap:12mm}.company{max-width:65%;font-size:8px;line-height:1.55}.company h1{font-size:23px;margin:0 0 5px;letter-spacing:-.5px}.company p{margin:1px 0}.report-name{text-align:right;white-space:nowrap}.report-name h2{font-size:16px;margin:2px 0 8px}.report-name p{font-size:11px;font-weight:700;margin:0 0 5px}.report-name span{font-size:8px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:4mm;padding:8mm 10mm 5mm}.metric{background:#f1fec8;border:1px solid #d3e1a6;border-radius:4mm;padding:5mm;min-height:23mm}.metric small{display:block;color:#5c654d;font-size:7px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4mm}.metric strong{font-size:16px}.table-wrap{padding:2mm 10mm 0;overflow:hidden}table{width:100%;border-collapse:separate;border-spacing:0;font-size:8px;border:1px solid #dce2d2;border-radius:3mm;overflow:hidden}thead{background:#101408;color:#fff}th,td{text-align:left;padding:3mm 2.5mm;border-bottom:1px solid #e4e8dd;vertical-align:top}th{font-size:7px;text-transform:uppercase;letter-spacing:.3px}tbody tr:nth-child(even){background:#f8fcec}tfoot{background:#f1fec8;font-weight:800}.empty{text-align:center;padding:14mm;color:#7a8270}@media print{body{background:#fff}.report-page{min-height:auto}.company-header{-webkit-print-color-adjust:exact;print-color-adjust:exact}.metric,thead,tfoot,tbody tr:nth-child(even){-webkit-print-color-adjust:exact;print-color-adjust:exact}}
          </style></head><body>${pages}</body></html>`);
          win.document.close();
          win.focus();
          setTimeout(() => win.print(), 350);
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
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-black text-sm font-black transition-colors shadow-sm border border-black/10 bg-white"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print
                </button>
                <button
                  onClick={downloadPDF}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-black text-sm font-black transition-colors shadow-sm border border-black/10"
                  style={{ backgroundColor: '#c6ff34' }}
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
              <div className="flex items-center justify-between px-6 py-4" style={{ background: 'linear-gradient(135deg, #c6ff34 0%, #f1fec8 100%)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white/70 border border-black/10">
                    <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-black text-black uppercase tracking-wider">{activeShop.name || 'Shop'} — {it ? 'Report completo' : 'Full Report'}</h2>
                    <p className="text-[11px] text-gray-600 font-medium leading-tight">
                      {reportView === 'daily'
                        ? `Daily · ${fmtDate(reportDate)}`
                        : reportView === 'monthly'
                          ? `Monthly · ${new Date(reportMonth + '-01').toLocaleDateString(locale, { month: 'long', year: 'numeric' })}`
                          : 'All-Time Overview'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full ${grandProfit >= 0 ? 'bg-white/70 text-green-800' : 'bg-red-100 text-red-700'}`}>
                    {grandProfit >= 0 ? '▲ Profitable' : '▼ At Loss'}
                  </span>
                  <span className="text-[10px] text-gray-500 font-medium">Generated: {new Date().toLocaleDateString()}</span>
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
            <div className="section-summary grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
              {[
                { id: 'transactions', label: t('transactions'), value: fmt(periodTxIncome - periodTxExpense), sub: `${periodTxs.length} ${t('entries')}`, color: 'text-blue-600', bg: 'bg-blue-50' },
                { id: 'repairs', label: t('tab_repairs'), value: fmt(repFeeIncome + repAdvanceIncome - repPartsExpense), sub: `${periodRepairs.length} ${t('repairJobs')}`, color: 'text-amber-600', bg: 'bg-amber-50' },
                { id: 'advances', label: t('tab_advances'), value: fmt(advReceived - advGiven), sub: `${periodAdvances.length} ${t('entries')}`, color: 'text-purple-600', bg: 'bg-purple-50' },
                { id: 'inventory', label: t('tab_inventory'), value: fmt(invOutIncome - invInExpense), sub: `${t('stockIn')} ${invTotalInQty} / ${t('stockOut')} ${invTotalOutQty}`, color: 'text-sky-600', bg: 'bg-sky-50' },
                { id: 'secondhand', label: t('tab_secondhand'), value: fmt(shProfit), sub: `${shBought.length} ${it ? 'acquistati' : 'bought'} / ${shSold.length} ${it ? 'venduti' : 'sold'}`, color: 'text-green-700', bg: 'bg-lime-50' },
                { id: 'team', label: t('cat_Payroll'), value: fmt(totalPayroll), sub: `${activeTeam.length} ${t('activeEmployees')}`, color: 'text-rose-600', bg: 'bg-rose-50' },
              ].map((c) => (
                <button type="button" onClick={() => setReportSection(c.id)} key={c.label} className="bg-white rounded-2xl p-4 shadow-sm border text-left hover:-translate-y-0.5 hover:shadow-md transition-all" style={{ borderColor: reportSection === c.id ? '#a6df1e' : '#e5e7eb', background: reportSection === c.id ? '#f8ffe8' : '#fff' }}>
                  <div className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center mb-2`}>
                    <div className={`w-2.5 h-2.5 rounded-full ${c.color.replace('text-', 'bg-')}`} />
                  </div>
                  <p className={`text-lg font-bold leading-tight ${c.color}`}>{c.value}</p>
                  <p className="text-xs font-semibold text-gray-500 mt-0.5">{c.label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{c.sub}</p>
                </button>
              ))}
            </div>

            {/* ── Search & Filters ── */}
            <div className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="relative flex-1 min-w-0">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                  <input
                    type="search"
                    value={reportSearch}
                    onChange={(event) => setReportSearch(event.target.value)}
                    placeholder={it ? 'Cerca cliente, prodotto, IMEI, telefono, descrizione…' : 'Search customer, product, IMEI, phone, description…'}
                    className="w-full h-12 rounded-xl border border-gray-200 bg-gray-50 pl-12 pr-4 text-sm font-semibold outline-none transition focus:border-lime-400 focus:bg-white focus:ring-4 focus:ring-lime-100"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select value={reportFilter} onChange={(event) => setReportFilter(event.target.value)} className="h-12 min-w-48 rounded-xl border border-gray-200 bg-white px-4 text-sm font-black outline-none focus:border-lime-400">
                    <option value="all">{it ? 'Tutti gli stati / tipi' : 'All statuses / types'}</option>
                    <option value="income">{it ? 'Entrate' : 'Income'}</option>
                    <option value="expense">{it ? 'Uscite' : 'Expenses'}</option>
                    <option value="pending">{it ? 'In attesa' : 'Pending'}</option>
                    <option value="completed">{it ? 'Completato / Pagato' : 'Completed / Paid'}</option>
                    <option value="ready">{it ? 'Pronto' : 'Ready'}</option>
                    <option value="stock_in">{it ? 'Carico magazzino' : 'Stock in'}</option>
                    <option value="stock_out">{it ? 'Vendita magazzino' : 'Stock out'}</option>
                    <option value="bought">{it ? 'Usato acquistato' : 'Secondhand bought'}</option>
                    <option value="sold">{it ? 'Venduto' : 'Sold'}</option>
                    <option value="active">{it ? 'Attivo' : 'Active'}</option>
                    <option value="inactive">{it ? 'Non attivo' : 'Inactive'}</option>
                  </select>
                  {(reportSearch || reportFilter !== 'all') && <button type="button" onClick={() => { setReportSearch(''); setReportFilter('all'); }} className="h-12 px-5 rounded-xl border border-black/10 font-black text-sm hover:bg-gray-50">{it ? 'Azzera filtri' : 'Clear filters'}</button>}
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 px-1 text-[11px] font-bold text-gray-500">
                <span>{visibleResultCount} {it ? 'risultati trovati' : 'results found'}</span>
                <span>{it ? 'Ricerca nel periodo selezionato' : 'Searching selected period'}</span>
              </div>
            </div>

            {/* ── Transactions ── */}
            {sectionHasData && visibleResultCount === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-12 text-center">
                <p className="font-black text-gray-800">{it ? 'Nessun risultato trovato' : 'No matching results'}</p>
                <p className="mt-1 text-sm text-gray-400">{it ? 'Prova a cambiare ricerca o filtro.' : 'Try changing the search or filter.'}</p>
                <button type="button" onClick={() => { setReportSearch(''); setReportFilter('all'); }} className="mt-4 rounded-xl px-5 py-2.5 text-sm font-black border border-black/10" style={{ background: '#c6ff34' }}>{it ? 'Mostra tutto' : 'Show everything'}</button>
              </div>
            )}

            {(reportSection === 'all' || reportSection === 'transactions') && filteredTxs.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-800">{t('transactions')}</h3>
                  <div className="flex gap-3 text-xs font-semibold">
                    <span className="text-emerald-600">+{fmt(periodTxIncome)}</span>
                    <span className="text-red-500">-{fmt(periodTxExpense)}</span>
                  </div>
                </div>
                <div className="divide-y divide-gray-200">
                  {filteredTxs.map((t) => (
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
            {(reportSection === 'all' || reportSection === 'repairs') && filteredRepairs.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-800">{t('repairJobs')}</h3>
                  <div className="flex gap-3 text-xs font-semibold">
                    <span className="text-emerald-600">{t('income')}: +{fmt(repFeeIncome + repAdvanceIncome)}</span>
                    <span className="text-red-500">{t('parts')}: -{fmt(repPartsExpense)}</span>
                  </div>
                </div>
                <div className="divide-y divide-gray-200">
                  {filteredRepairs.map((r) => (
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
            {(reportSection === 'all' || reportSection === 'advances') && filteredAdvances.length > 0 && (
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
                  {filteredAdvances.map((a) => (
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
            {(reportSection === 'all' || reportSection === 'inventory') && filteredMovements.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-800">{t('inventoryMovements')}</h3>
                  <div className="flex gap-3 text-xs font-semibold">
                    <span className="text-sky-600">{t('stockIn')} ×{invTotalInQty} · -{fmt(invInExpense)}</span>
                    <span className="text-emerald-600">{t('sold')} ×{invTotalOutQty} · +{fmt(invOutIncome)}</span>
                  </div>
                </div>
                <div className="divide-y divide-gray-200">
                  {filteredMovements.map((m) => (
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
            {(reportSection === 'all' || reportSection === 'secondhand') && filteredSecondhand.length > 0 && (
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
                  {filteredSecondhand.map((item) => {
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
            {(reportSection === 'all' || reportSection === 'team') && filteredTeam.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-800">{t('teamAndPayroll')}</h3>
                  <span className="text-xs font-semibold text-rose-600">{t('monthly')}: {fmt(totalPayroll)}</span>
                </div>
                <div className="divide-y divide-gray-200">
                  {filteredTeam.map((m) => (
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

            {!sectionHasData && (
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
}
