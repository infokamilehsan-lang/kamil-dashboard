import { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { useLanguage } from '../context/LanguageContext';
import { CURRENCIES } from '../data/initialData';
import { sendClientEmail } from '../lib/emailService';
import DatePicker from './DatePicker';

const inputCls = "w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all placeholder-gray-400";

const CARD_COLORS = [
  { id: 'blue',   from: 'from-blue-500',    to: 'to-blue-700' },
  { id: 'green',  from: 'from-emerald-500', to: 'to-teal-600' },
  { id: 'purple', from: 'from-purple-500',  to: 'to-violet-500' },
  { id: 'orange', from: 'from-orange-400',  to: 'to-red-500' },
  { id: 'slate',  from: 'from-slate-600',   to: 'to-slate-800' },
];

export default function PayMemberModal({ shop, member, onClose }) {
  const { addTransactionForShop, updateTeamMember, emailSettings } = useShop();
  const { t, locale } = useLanguage();

  const currencyObj = CURRENCIES.find((c) => c.code === shop.currency) || CURRENCIES[0];

  const [activeTab, setActiveTab] = useState('pay');

  // Payment form
  const [payAmount, setPayAmount] = useState(String(member.salary || ''));
  const [note, setNote] = useState(`${t('salaryNote')} - ${member.name}`);
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [paid, setPaid] = useState(false);
  const [payError, setPayError] = useState('');

  // Bank card selection
  const bankCards = shop.bankCards || [];
  const [selectedCardId, setSelectedCardId] = useState(bankCards[0]?.id || null);

  // Local history (updates immediately on pay without refetch)
  const [localHistory, setLocalHistory] = useState(member.payHistory || []);

  // Bank info edit
  const [editBank, setEditBank] = useState(false);
  const [bank, setBank] = useState({
    bankName:      member.bankName      || '',
    accountHolder: member.accountHolder || '',
    iban:          member.iban          || '',
    accountNo:     member.accountNo     || '',
  });
  const [bankSaved, setBankSaved] = useState(false);

  const handleSaveBank = () => {
    updateTeamMember(shop.id, member.id, bank);
    setBankSaved(true);
    setEditBank(false);
    setTimeout(() => setBankSaved(false), 2500);
  };

  const handlePay = () => {
    if (!payAmount || isNaN(Number(payAmount)) || Number(payAmount) <= 0) {
      setPayError(t('enterValidAmount'));
      return;
    }
    const selectedCard = bankCards.find((c) => c.id === selectedCardId) || null;
    const newEntry = {
      id: `pay-${Date.now()}`,
      date: payDate,
      amount: parseFloat(payAmount),
      note: note.trim() || `${t('salaryNote')} - ${member.name}`,
      paidFromCard: selectedCard ? { id: selectedCard.id, bankName: selectedCard.bankName, last4: selectedCard.last4, cardHolder: selectedCard.cardHolder, color: selectedCard.color } : null,
    };
    addTransactionForShop(shop.id, {
      description: newEntry.note,
      amount: newEntry.amount,
      type: 'expense',
      category: 'Payroll',
      date: newEntry.date,
      clientName: member.name,
    });
    const updatedHistory = [newEntry, ...localHistory];
    updateTeamMember(shop.id, member.id, { payHistory: updatedHistory });
    setLocalHistory(updatedHistory);
    setPaid(true);
    if (member.email) {
      sendClientEmail({
        to: member.email,
        toName: member.name,
        subject: `Salary Paid – ${shop.name}`,
        message: `Dear ${member.name},\n\nYour salary payment has been processed.\nAmount: ${newEntry.amount}\nDate: ${newEntry.date}\n${newEntry.note ? 'Note: ' + newEntry.note + '\n' : ''}\nThank you!\n${shop.name}`,
        shopName: shop.name,
        emailCfg: emailSettings,
      });
    }
  };

  const hasBankInfo = member.bankName || member.iban || member.accountNo;

  // Group history by Year-Month
  const groupedHistory = localHistory.reduce((acc, entry) => {
    const d = new Date(entry.date);
    const key = d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});
  const historyMonths = Object.keys(groupedHistory);
  const totalPaid = localHistory.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  return (
    <div className="anim-lbx-bg fixed inset-0 bg-black/50 backdrop-blur-sm z-60 flex items-center justify-center p-4">
      <div className="anim-lightbox bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="p-6" style={{ background: 'linear-gradient(135deg, #936639, #582f0e)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/30 flex items-center justify-center text-gray-900 font-bold text-lg">
                {member.name?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{member.name}</h2>
                <p className="text-amber-100 text-sm">{member.role} · {currencyObj.symbol}{Number(member.salary || 0).toLocaleString()}/{t('perMonth')}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-900/70 hover:text-gray-900 p-1.5 rounded-xl hover:bg-white/10 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {[
              { id: 'pay', label: t('paySalary') },
              { id: 'history', label: `${t('history')} (${localHistory.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setPaid(false); }}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-amber-700 shadow'
                    : 'text-amber-100 hover:text-white hover:bg-white/15'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* ── HISTORY TAB ── */}
          {activeTab === 'history' && (
            <div className="space-y-4">

              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-amber-50 rounded-2xl p-3 text-center">
                  <p className="text-xl font-bold" style={{ color: '#936639' }}>{localHistory.length}</p>
                  <p className="text-xs text-amber-500 mt-0.5">{t('totalPayments')}</p>
                </div>
                <div className="bg-amber-50 rounded-2xl p-3 text-center">
                  <p className="text-base font-bold" style={{ color: '#936639' }}>{currencyObj.symbol}{totalPaid.toLocaleString()}</p>
                  <p className="text-xs text-amber-500 mt-0.5">{t('totalPaid')}</p>
                </div>
              </div>

              {historyMonths.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-500 font-medium">{t('noPaymentsYet')}</p>
                  <p className="text-xs text-slate-600 mt-1">{t('paymentHint')}</p>
                </div>
              ) : (
                historyMonths.map((month) => (
                  <div key={month}>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{month}</p>
                    <div className="space-y-2">
                      {groupedHistory[month].map((entry) => (
                        <div key={entry.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${entry.paidFromCard ? `bg-linear-to-br ${CARD_COLORS.find(c=>c.id===entry.paidFromCard.color)?.from || 'from-blue-500'} ${CARD_COLORS.find(c=>c.id===entry.paidFromCard.color)?.to || 'to-blue-700'}` : 'bg-amber-100'}`}>
                            {entry.paidFromCard ? (
                              <svg className="w-4 h-4 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                            ) : (
                              <svg className="w-4 h-4" style={{ color: '#936639' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{entry.note}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(entry.date).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                              {entry.paidFromCard && <span className="ml-1.5 text-blue-400 font-medium">· {entry.paidFromCard.bankName} ••{entry.paidFromCard.last4}</span>}
                            </p>
                          </div>
                          <p className="text-sm font-bold shrink-0" style={{ color: '#936639' }}>{currencyObj.symbol}{Number(entry.amount).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── PAY TAB ── */}
          {activeTab === 'pay' && (<>
            {paid ? (
            <PaymentSlip
              member={member}
              amount={payAmount}
              payDate={payDate}
              note={note}
              currencyObj={currencyObj}
              selectedCard={bankCards.find((c) => c.id === selectedCardId) || null}
              onClose={onClose}
            />
          ) : (
            <>
              {/* Bank Details */}
              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M7 6h10a2 2 0 012 2v8a2 2 0 01-2 2H7a2 2 0 01-2-2V8a2 2 0 012-2z" />
                    </svg>
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">{t('bankDetails')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditBank((v) => !v)}
                    className="text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors px-2 py-1 rounded-lg hover:bg-amber-50"
                  >
                    {editBank ? t('cancel') : hasBankInfo ? t('edit') : '+ ' + t('add')}
                  </button>
                </div>

                {editBank ? (
                  <div className="p-4 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">{t('accountHolderName')}</label>
                      <input
                        className={inputCls}
                        value={bank.accountHolder}
                        onChange={(e) => setBank((b) => ({ ...b, accountHolder: e.target.value }))}
                        placeholder="es. Mario Rossi"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">{t('bankName')}</label>
                      <input
                        className={inputCls}
                        value={bank.bankName}
                        onChange={(e) => setBank((b) => ({ ...b, bankName: e.target.value }))}
                        placeholder="es. UniCredit, Intesa Sanpaolo..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">{t('iban')}</label>
                      <input
                        className={inputCls}
                        value={bank.iban}
                        onChange={(e) => setBank((b) => ({ ...b, iban: e.target.value }))}
                        placeholder="es. IT60X0542811101000000123456"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">{t('accountNo')}</label>
                      <input
                        className={inputCls}
                        value={bank.accountNo}
                        onChange={(e) => setBank((b) => ({ ...b, accountNo: e.target.value }))}
                        placeholder="es. IT00 0000 0000 0000"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveBank}
                      className="w-full px-4 py-2.5 text-white font-semibold rounded-xl transition-colors text-sm" style={{ backgroundColor: '#936639' }}
                    >
                      {t('saveBankDetails')}
                    </button>
                  </div>
                ) : hasBankInfo ? (
                  <div className="p-4 space-y-2">
                    {(member.accountHolder || bank.accountHolder) && (
                      <BankRow label="Intestatario" value={member.accountHolder || bank.accountHolder} />
                    )}
                    {(member.bankName || bank.bankName) && (
                      <BankRow label={t('bank')} value={member.bankName || bank.bankName} />
                    )}
                    {(member.iban || bank.iban) && (
                      <BankRow label={t('iban')} value={member.iban || bank.iban} mono />
                    )}
                    {(member.accountNo || bank.accountNo) && (
                      <BankRow label={t('accountNo')} value={member.accountNo || bank.accountNo} mono />
                    )}
                    {bankSaved && (
                        <p className="text-xs font-semibold flex items-center gap-1 mt-2" style={{ color: '#936639' }}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        {t('bankDetailsSaved')}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="px-4 py-5 text-center">
                    <p className="text-xs text-slate-500">{t('noBankDetailsYet')}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{t('clickAddBankInfo')}</p>
                  </div>
                )}
              </div>

              {/* Pay From Bank Card */}
              {bankCards.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Paga Da</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {bankCards.map((card) => {
                      const cc = CARD_COLORS.find((c) => c.id === card.color) || CARD_COLORS[0];
                      const isSelected = selectedCardId === card.id;
                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => setSelectedCardId(isSelected ? null : card.id)}
                          className={`shrink-0 relative rounded-2xl p-3 text-left transition-all w-44 bg-linear-to-br ${cc.from} ${cc.to} ${
                            isSelected ? 'ring-2 ring-offset-2 ring-amber-400 scale-105' : 'opacity-70 hover:opacity-100'
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3" style={{ color: '#936639' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                          )}
                          <p className="text-gray-900/70 text-xs capitalize">{card.cardType}</p>
                          <p className="text-gray-900 font-bold text-sm">{card.bankName}</p>
                          <p className="text-gray-900/80 font-mono text-xs mt-2">•••• {card.last4 || '????'}</p>
                          <p className="text-gray-900/60 text-xs mt-0.5 truncate">{card.cardHolder}</p>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setSelectedCardId(null)}
                      className={`shrink-0 rounded-2xl p-3 text-left transition-all w-32 border-2 border-dashed flex flex-col items-center justify-center gap-1 ${
                        selectedCardId === null ? 'border-amber-400 bg-amber-500/10' : 'border-gray-200 hover:border-amber-300'
                      }`}
                    >
                      <svg className={`w-5 h-5 ${selectedCardId === null ? 'text-amber-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                      <p className={`text-xs font-semibold ${selectedCardId === null ? 'text-amber-600' : 'text-gray-500'}`}>{t('cashOther')}</p>
                    </button>
                  </div>
                </div>
              )}

              {/* Payment Form */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{t('recordPayment')}</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{t('amount')} ({currencyObj.symbol})</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className={inputCls}
                      value={payAmount}
                      onChange={(e) => { setPayAmount(e.target.value); setPayError(''); }}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{t('date')}</label>
                    <DatePicker value={payDate} onChange={(v) => setPayDate(v)} />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">{t('paymentNote')}</label>
                  <input
                    className={inputCls}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={`${t('salaryNote')} - ${member.name}`}
                  />
                </div>

                {payError && (
                  <p className="text-xs text-red-500">{payError}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handlePay}
                    className="flex-1 px-4 py-2.5 text-white font-semibold rounded-xl transition-colors text-sm shadow-sm flex items-center justify-center gap-2" style={{ backgroundColor: '#936639' }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t('recordPayment')}
                  </button>
                </div>
              </div>
            </>
            )}
          </>)}
        </div>
      </div>
    </div>
  );
}

function BankRow({ label, value, mono = false }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-500 shrink-0 w-28">{label}</span>
      <span className={`text-xs font-semibold text-gray-700 flex-1 truncate ${mono ? 'font-mono' : ''}`}>{value}</span>
      <button
        onClick={copy}
        className="shrink-0 text-xs px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 transition-colors"
        title={t('copy')}
      >
        {copied ? t('copied') : t('copy')}
      </button>
    </div>
  );
}

// ── Payment Slip (shown after recording payment) ───────────────────────────
function PaymentSlip({ member, amount, payDate, note, currencyObj, selectedCard, onClose }) {
  const { t, locale } = useLanguage();
  const [copiedAll, setCopiedAll] = useState(false);

  const workerIban      = member.iban       || '';
  const workerAccountNo = member.accountNo  || '';
  const workerBank      = member.bankName   || '';
  const workerHolder    = member.accountHolder || member.name;

  const formattedDate = new Date(payDate).toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  // Full transfer text for copying / sharing
  const transferText =
    `💸 ${t('slip_salaryPayment')} — ${member.name}\n` +
    `${t('slip_amount')}: ${currencyObj.symbol}${Number(amount).toLocaleString()}\n` +
    `${t('slip_date')}: ${formattedDate}\n` +
    `${t('slip_note')}: ${note}\n` +
    `\n👤 ${t('slip_transferTo')}:\n` +
    `${t('slip_name')}: ${workerHolder}\n` +
    (workerBank      ? `${t('slip_bank')}: ${workerBank}\n`       : '') +
    (workerAccountNo ? `${t('slip_accountNo')}: ${workerAccountNo}\n` : '') +
    (workerIban      ? `IBAN: ${workerIban}\n`        : '') +
    (selectedCard    ? `\n💳 ${t('slip_payFrom')}: ${selectedCard.bankName} ••••${selectedCard.last4 || '????'}` : '');

  const handleCopyAll = () => {
    navigator.clipboard.writeText(transferText).then(() => {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
    });
  };

  const handleWhatsApp = () => {
    const encoded = encodeURIComponent(transferText);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const CARD_COLORS_MAP = {
    blue:   { from: 'from-blue-500',    to: 'to-blue-700' },
    green:  { from: 'from-emerald-500', to: 'to-teal-600' },
    purple: { from: 'from-purple-500',  to: 'to-violet-500' },
    orange: { from: 'from-orange-400',  to: 'to-red-500' },
    slate:  { from: 'from-slate-600',   to: 'to-slate-800' },
  };
  const cc = selectedCard ? (CARD_COLORS_MAP[selectedCard.color] || CARD_COLORS_MAP.blue) : null;

  return (
    <div className="space-y-4">
      {/* Success Header */}
      <div className="text-center pt-2">
        <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2">
          <svg className="w-7 h-7" style={{ color: '#936639' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-base font-bold text-gray-900">{t('paymentRecorded')}</p>
        <p className="text-xs text-slate-500 mt-0.5">{t('nowTransfer')}</p>
      </div>

      {/* Payment Slip Card */}
      <div className="border border-gray-200 rounded-2xl overflow-hidden bg-gray-50">
        {/* Amount Band */}
        <div className="px-5 py-4 text-center" style={{ backgroundColor: '#936639' }}>
          <p className="text-amber-100 text-xs font-medium uppercase tracking-wider">{t('amountToTransfer')}</p>
          <p className="text-gray-900 text-3xl font-bold tracking-tight mt-1">
            {currencyObj.symbol}{Number(amount).toLocaleString()}
          </p>
          <p className="text-amber-200 text-xs mt-1">{formattedDate}</p>
        </div>

        <div className="p-4 space-y-3">
          {/* From Card */}
          {selectedCard && cc && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t('payFromCard')}</p>
              <div className={`bg-linear-to-r ${cc.from} ${cc.to} rounded-xl px-4 py-3 flex items-center gap-3`}>
                <svg className="w-5 h-5 text-gray-900/80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 font-bold text-sm">{selectedCard.bankName}</p>
                  <p className="text-gray-900/70 font-mono text-xs">•••• •••• •••• {selectedCard.last4 || '????'}</p>
                </div>
                <p className="text-gray-900/70 text-xs capitalize shrink-0">{selectedCard.cardType}</p>
              </div>
            </div>
          )}

          {/* To Worker */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t('transferTo')}</p>
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 space-y-2">
              <SlipRow label="Nome"       value={workerHolder} />
              {workerBank       && <SlipRow label={t('bank')}      value={workerBank} />}
              {workerAccountNo  && <SlipRow label={t('accountNo')}   value={workerAccountNo} mono />}
              {workerIban       && <SlipRow label={t('iban')}       value={workerIban} mono />}
              {!workerBank && !workerAccountNo && !workerIban && (
                <p className="text-xs text-amber-600 font-medium">⚠ {t('noBankDetailsSaved')}</p>
              )}
            </div>
          </div>

          {/* Note */}
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-slate-500">{t('transferNote')}</p>
            <p className="text-sm font-semibold text-gray-700 mt-0.5">{note}</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleCopyAll}
          className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-amber-300 transition-all"
        >
          {copiedAll ? (
            <>
              <svg className="w-4 h-4" style={{ color: '#936639' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              <span style={{ color: '#936639' }}>{t('copied')}</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              {t('copyDetails')}
            </>
          )}
        </button>

        <button
          onClick={handleWhatsApp}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-[#25D366] hover:bg-[#20c05c] text-gray-900 rounded-xl text-sm font-semibold transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          {t('sendWhatsApp')}
        </button>
      </div>

      <p className="text-xs text-center text-slate-500 pb-1">
        Apri la tua app <strong>{selectedCard?.bankName || 'banca'}</strong> → Trasferisci → incolla i dettagli sopra
      </p>

      <button
        onClick={onClose}
        className="w-full px-4 py-2.5 text-white font-semibold rounded-xl transition-colors text-sm" style={{ backgroundColor: '#936639' }}
      >
        {t('done')}
      </button>
    </div>
  );
}

function SlipRow({ label, value, mono = false }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-slate-500 shrink-0 w-24">{label}</span>
      <span className={`text-xs font-semibold text-gray-700 flex-1 truncate ${mono ? 'font-mono' : ''}`}>{value}</span>
      <button onClick={copy} className="shrink-0 text-xs px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 hover:text-amber-800 transition-colors">
        {copied ? '✓' : t('copy')}
      </button>
    </div>
  );
}
