const amount = (value) => Number(value) || 0;
const dateKey = (value) => (value || '').slice(0, 10);

export function buildFinancialLedger(shop) {
  if (!shop) return [];
  const entries = [];
  const push = (entry) => {
    if (!entry.date || !entry.amount) return;
    entries.push({ ...entry, date: dateKey(entry.date), amount: Math.abs(amount(entry.amount)) });
  };

  (shop.transactions || []).forEach((tx) => push({ id: `tx-${tx.id}`, date: tx.date, type: tx.type === 'expense' ? 'expense' : 'income', amount: tx.amount, source: 'transactions', paymentMethod: tx.paymentMethod }));

  (shop.repairs || []).forEach((repair) => {
    const payments = repair.payments || [];
    const paymentTotal = payments.reduce((sum, payment) => sum + amount(payment.amount), 0);
    const initialPaid = Math.max(0, amount(repair.initialAdvance ?? repair.advance) - (repair.initialAdvance === undefined ? paymentTotal : 0));
    push({ id: `repair-parts-${repair.id}`, date: repair.partsRecordedAt || repair.createdAt, type: 'expense', amount: repair.partsCost, source: 'repairs' });
    push({ id: `repair-initial-${repair.id}`, date: repair.advanceReceivedAt || repair.createdAt, type: 'income', amount: initialPaid, source: 'repairs', paymentMethod: repair.paymentMethod });
    payments.forEach((payment) => push({ id: `repair-payment-${repair.id}-${payment.id}`, date: payment.date, type: 'income', amount: payment.amount, source: 'repairs', paymentMethod: payment.paymentMethod }));
  });

  (shop.advances || []).forEach((advance) => {
    const payments = advance.payments || [];
    const laterPaid = payments.reduce((sum, payment) => sum + amount(payment.amount), 0);
    const initialPaid = Math.max(0, amount(advance.advancePaid) - laterPaid);
    push({ id: `advance-cost-${advance.id}`, date: advance.costRecordedAt || advance.date, type: 'expense', amount: advance.productCost, source: 'advances' });
    push({ id: `advance-initial-${advance.id}`, date: advance.date, type: 'income', amount: initialPaid, source: 'advances', paymentMethod: advance.paymentMethod });
    payments.forEach((payment) => push({ id: `advance-payment-${advance.id}-${payment.id}`, date: payment.date, type: 'income', amount: payment.amount, source: 'advances', paymentMethod: payment.paymentMethod }));
  });

  (shop.skus || []).forEach((sku) => (sku.movements || []).forEach((movement) => {
    if (movement.type === 'out' && /sold via add transaction/i.test(movement.note || '')) return;
    push({ id: `inventory-${sku.id}-${movement.id}`, date: movement.date, type: movement.type === 'in' ? 'expense' : 'income', amount: amount(movement.price) * (amount(movement.qty) || 1), source: 'inventory', paymentMethod: movement.paymentMethod });
  }));

  (shop.secondhand || []).forEach((item) => {
    push({ id: `secondhand-buy-${item.id}`, date: item.buyDate || item.createdAt, type: 'expense', amount: item.buyPrice, source: 'secondhand' });
    if (item.status === 'sold') push({ id: `secondhand-sell-${item.id}`, date: item.sellDate, type: 'income', amount: item.sellPrice, source: 'secondhand' });
  });

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

export function financialSummary(shop, predicate = () => true) {
  const entries = buildFinancialLedger(shop).filter((entry) => predicate(entry.date, entry));
  const income = entries.filter((entry) => entry.type === 'income').reduce((sum, entry) => sum + entry.amount, 0);
  const expense = entries.filter((entry) => entry.type === 'expense').reduce((sum, entry) => sum + entry.amount, 0);
  const profit = income - expense;
  return { entries, income, expense, profit, margin: income > 0 ? Math.round((profit / income) * 100) : 0 };
}
