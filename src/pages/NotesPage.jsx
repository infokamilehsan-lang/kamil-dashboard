import { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { useLanguage } from '../context/LanguageContext';
import { useFmt } from '../lib/useFmt';

export default function NotesPage({ setNoteEditId, setNoteForm, setNoteFormError, setNoteOpen, setNoteDeleteId }) {
  const { activeShop } = useShop();
  const { locale, lang } = useLanguage();
  const { fmt } = useFmt();
  const [noteSearch, setNoteSearch] = useState('');
  const [noteTypeFilter, setNoteTypeFilter] = useState('all');
  const [notePaymentFilter, setNotePaymentFilter] = useState('all');
  const [noteSort, setNoteSort] = useState('newest');

        const notes = activeShop.notes || [];
        const totalAmt = notes.reduce((s, n) => s + (Number(n.totalAmount ?? n.amount) || 0), 0);
        const totalPaid = notes.reduce((s, n) => s + (Number(n.paidAmount) || 0), 0);
        const totalRem = totalAmt - totalPaid;
        const today = new Date().toISOString().slice(0, 10);
        const appointments = notes.filter((note) => note.appointmentDate);
        const upcomingAppointments = appointments.filter((note) => note.appointmentDate >= today);
        const filteredNotes = notes.filter((note) => {
          const query = noteSearch.trim().toLowerCase();
          const searchable = [note.name, note.details, note.appointmentFor, note.appointmentDescription, note.phone, note.email].filter(Boolean).join(' ').toLowerCase();
          const matchesSearch = !query || searchable.includes(query);
          const total = Number(note.totalAmount ?? note.amount) || 0;
          const paid = Number(note.paidAmount) || 0;
          const remaining = Math.max(0, total - paid);
          const type = note.appointmentDate || note.appointmentFor ? 'appointment' : total > 0 ? 'payment' : 'general';
          const matchesType = noteTypeFilter === 'all' || type === noteTypeFilter;
          const paymentStatus = total <= 0 ? 'no_amount' : remaining <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
          const matchesPayment = notePaymentFilter === 'all' || paymentStatus === notePaymentFilter;
          return matchesSearch && matchesType && matchesPayment;
        }).sort((a, b) => {
          const total = (note) => Number(note.totalAmount ?? note.amount) || 0;
          const remaining = (note) => Math.max(0, total(note) - (Number(note.paidAmount) || 0));
          if (noteSort === 'oldest') return String(a.createdAt || a.date || '').localeCompare(String(b.createdAt || b.date || ''));
          if (noteSort === 'appointment') return String(a.appointmentDate || '9999-12-31').localeCompare(String(b.appointmentDate || '9999-12-31'));
          if (noteSort === 'amount_high') return total(b) - total(a);
          if (noteSort === 'remaining_high') return remaining(b) - remaining(a);
          return String(b.createdAt || b.date || '').localeCompare(String(a.createdAt || a.date || ''));
        });
        const noteFiltersActive = Boolean(noteSearch) || noteTypeFilter !== 'all' || notePaymentFilter !== 'all' || noteSort !== 'newest';
        const clearNoteFilters = () => { setNoteSearch(''); setNoteTypeFilter('all'); setNotePaymentFilter('all'); setNoteSort('newest'); };

        return (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="section-summary grid grid-cols-2 xl:grid-cols-4 gap-3">
              {[
                { label: lang === 'it' ? 'Note totali' : 'Total notes', value: notes.length, detail: lang === 'it' ? 'promemoria salvati' : 'saved reminders', tone: '#fff' },
                { label: lang === 'it' ? 'Appuntamenti' : 'Appointments', value: appointments.length, detail: `${upcomingAppointments.length} ${lang === 'it' ? 'in programma' : 'upcoming'}`, tone: '#c6ff34' },
                { label: lang === 'it' ? 'Importo totale' : 'Total amount', value: fmt(totalAmt), detail: `${lang === 'it' ? 'Pagato' : 'Paid'} ${fmt(totalPaid)}`, tone: '#f1fec8' },
                { label: lang === 'it' ? 'Rimanente' : 'Remaining', value: fmt(totalRem), detail: lang === 'it' ? 'ancora da gestire' : 'still to manage', tone: totalRem > 0 ? '#fff3e8' : '#f1fec8' },
              ].map(c => (
                <div key={c.label} className="relative overflow-hidden rounded-2xl p-4 sm:p-5 shadow-sm border border-black/10 min-h-32 flex flex-col justify-between" style={{ background: c.tone }}>
                  <div className="absolute -right-6 -top-8 w-24 h-24 rounded-full border border-black/5" />
                  <p className="relative text-[10px] uppercase tracking-[.13em] font-black text-gray-500">{c.label}</p>
                  <div className="relative mt-4"><p className="text-2xl sm:text-3xl font-black text-gray-950">{c.value}</p><p className="text-[10px] font-bold text-gray-500 mt-1">{c.detail}</p></div>
                </div>
              ))}
            </div>

            {/* Search & filters */}
            <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="relative flex-1">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                  <input type="search" value={noteSearch} onChange={(event) => setNoteSearch(event.target.value)} placeholder={lang === 'it' ? 'Cerca titolo, persona, descrizione, telefono o email…' : 'Search title, person, description, phone or email…'} className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 pl-12 pr-4 text-sm font-semibold outline-none focus:border-lime-400 focus:bg-white focus:ring-4 focus:ring-lime-100" />
                </div>
                <button onClick={() => { setNoteEditId(null); setNoteForm({ name: '', details: '', totalAmount: '', paidAmount: '', appointmentFor: '', appointmentDescription: '', appointmentDate: '', appointmentTime: '', phone: '', email: '' }); setNoteFormError(''); setNoteOpen(true); }} className="h-12 shrink-0 flex items-center justify-center gap-2 px-5 text-black font-black rounded-xl transition-transform text-sm shadow-sm hover:-translate-y-0.5" style={{ backgroundColor: '#c6ff34' }}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>{lang === 'it' ? 'Aggiungi nota' : 'Add note'}</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select value={noteTypeFilter} onChange={(event) => setNoteTypeFilter(event.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-lime-400">
                  <option value="all">{lang === 'it' ? 'Tutti i tipi' : 'All note types'}</option>
                  <option value="appointment">{lang === 'it' ? 'Appuntamenti' : 'Appointments'}</option>
                  <option value="payment">{lang === 'it' ? 'Pagamenti / denaro' : 'Payments / money'}</option>
                  <option value="general">{lang === 'it' ? 'Promemoria generali' : 'General reminders'}</option>
                </select>
                <select value={notePaymentFilter} onChange={(event) => setNotePaymentFilter(event.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-lime-400">
                  <option value="all">{lang === 'it' ? 'Tutti i pagamenti' : 'All payment statuses'}</option>
                  <option value="paid">{lang === 'it' ? 'Pagato completamente' : 'Fully paid'}</option>
                  <option value="partial">{lang === 'it' ? 'Pagamento parziale' : 'Partially paid'}</option>
                  <option value="unpaid">{lang === 'it' ? 'Non pagato' : 'Unpaid'}</option>
                  <option value="no_amount">{lang === 'it' ? 'Senza importo' : 'No amount'}</option>
                </select>
                <select value={noteSort} onChange={(event) => setNoteSort(event.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-lime-400">
                  <option value="newest">{lang === 'it' ? 'Più recenti' : 'Newest first'}</option>
                  <option value="oldest">{lang === 'it' ? 'Più vecchi' : 'Oldest first'}</option>
                  <option value="appointment">{lang === 'it' ? 'Appuntamento più vicino' : 'Nearest appointment'}</option>
                  <option value="amount_high">{lang === 'it' ? 'Importo: alto → basso' : 'Amount: high → low'}</option>
                  <option value="remaining_high">{lang === 'it' ? 'Rimanente: alto → basso' : 'Remaining: high → low'}</option>
                </select>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
                <span className="text-xs font-bold text-gray-500"><strong className="text-gray-900">{filteredNotes.length}</strong> {lang === 'it' ? `di ${notes.length} note` : `of ${notes.length} notes`}</span>
                {noteFiltersActive && <button type="button" onClick={clearNoteFilters} className="rounded-xl border border-black/10 px-4 py-2 text-xs font-black hover:bg-gray-50">{lang === 'it' ? 'Azzera tutti i filtri' : 'Clear all filters'}</button>}
              </div>
            </div>

            {/* Empty state */}
            {notes.length === 0 && (
              <div className="text-center py-20 text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <p className="font-semibold">{lang === 'it' ? 'Nessuna nota' : 'No notes yet'}</p>
                <p className="text-sm mt-1">{lang === 'it' ? 'Registra promemoria, appuntamenti e pagamenti qui' : 'Record reminders, appointments and payments here'}</p>
              </div>
            )}

            {/* Notes grid */}
            {notes.length > 0 && filteredNotes.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-12 text-center">
                <p className="font-black text-gray-800">{lang === 'it' ? 'Nessuna nota trovata' : 'No notes found'}</p>
                <p className="mt-1 text-sm text-gray-400">{lang === 'it' ? 'Prova a cambiare ricerca o filtri.' : 'Try changing the search or filters.'}</p>
                <button type="button" onClick={clearNoteFilters} className="mt-4 rounded-xl px-5 py-2.5 text-xs font-black text-black" style={{ background: '#c6ff34' }}>{lang === 'it' ? 'Mostra tutto' : 'Show everything'}</button>
              </div>
            )}

            {filteredNotes.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredNotes.map((note) => {
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
                          {(note.appointmentFor || note.appointmentDescription || note.appointmentDate || note.appointmentTime) && (
                            <div className="mt-2 rounded-xl border border-lime-200 bg-[#f1fec8] p-2.5 text-xs">
                              {note.appointmentFor && <p className="font-black text-gray-900">{lang === 'it' ? 'Per' : 'For'}: {note.appointmentFor}</p>}
                              {note.appointmentDescription && <p className="text-gray-600 mt-0.5">{note.appointmentDescription}</p>}
                              <div className="flex items-center gap-1 mt-1.5 font-semibold text-green-800">
                              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              {note.appointmentDate && new Date(note.appointmentDate + 'T00:00:00').toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })}
                              {note.appointmentTime && <span className="ml-1">· {note.appointmentTime}</span>}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{note.date}</span>
                          {fullyPaid && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-600">{lang === 'it' ? 'Pagato' : 'Paid'} ✓</span>}
                        </div>
                      </div>

                      {/* Payment tracking */}
                      {noteTotal > 0 && (
                        <div className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-2">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-gray-500">{lang === 'it' ? 'Pagato' : 'Paid'}: <span className="text-green-700">{fmt(notePaid)}</span></span>
                            <span className="text-gray-500">{lang === 'it' ? 'Rimanente' : 'Remaining'}: <span className={noteRem > 0 ? 'text-red-500' : 'text-green-500'}>{fmt(noteRem > 0 ? noteRem : 0)}</span></span>
                            <span className="text-gray-500">{lang === 'it' ? 'Totale' : 'Total'}: <span className="text-gray-800">{fmt(noteTotal)}</span></span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: fullyPaid ? '#22c55e' : 'linear-gradient(to right, #c6ff34, #8fca16)' }}
                            />
                          </div>
                          <p className="text-right text-xs text-gray-400">{pct}% {lang === 'it' ? 'pagato' : 'paid'}</p>
                        </div>
                      )}
                      {noteTotal === 0 && (
                        <div className="bg-gray-50 rounded-xl px-3 py-2">
                          <p className="text-xs text-gray-400">{lang === 'it' ? 'Nessun importo registrato' : 'No amount recorded'}</p>
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
                              appointmentFor: note.appointmentFor || '',
                              appointmentDescription: note.appointmentDescription || '',
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
                          {lang === 'it' ? 'Modifica' : 'Edit'}
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
}
