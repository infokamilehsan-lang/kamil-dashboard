import { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { useLanguage } from '../context/LanguageContext';

const WA_ICON_PATH = "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z";
const WaIcon = ({ className = 'w-4 h-4' }) => <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d={WA_ICON_PATH} /></svg>;

export default function WhatsappPage() {
  const { activeShop, contacts, addOrUpdateContact, removeContact } = useShop();
  const { locale } = useLanguage();
  const it = String(locale).toLowerCase().startsWith('it');

  // WhatsApp Box state
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
                  {waComposeOpen ? (it ? 'Chiudi' : 'Close') : (it ? 'Scrivi' : 'Compose')}
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" /></svg>
              <input
                type="text"
                placeholder={it ? 'Cerca per nome, telefono o email…' : 'Search contacts by name, phone or email…'}
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
                    <p className="text-xs font-bold text-green-700 mb-2">{it ? 'Suggerimenti rapidi' : 'Quick Suggestions'}</p>
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
                      <button onClick={() => setWaSelected(new Set(contacts.filter(c => c.phone).map(c => c.id)))} className="text-xs font-semibold text-green-600 hover:underline">{it ? 'Seleziona tutti' : 'Select All'}</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => setWaSelected(new Set())} className="text-xs font-semibold text-gray-400 hover:underline">{it ? 'Deseleziona tutti' : 'Deselect All'}</button>
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
                    <p className="text-xs text-gray-400 text-center py-4">{it ? 'Nessun contatto salvato.' : 'No saved contacts yet.'}</p>
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
                    <input type="text" placeholder={it ? 'Nome cliente' : 'Client Name'}
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
                  <input type="tel" placeholder={it ? 'Numero di telefono * (es. +39 333 1234567)' : 'Phone Number * (e.g. +39 333 1234567)'}
                    value={waComposeForm.phone}
                    onChange={e => setWaComposeForm(f => ({ ...f, phone: e.target.value }))}
                    className="px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-300"
                  />
                </div>
                <textarea rows={4} placeholder={it ? 'Messaggio *' : 'Message *'}
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
                    {it ? 'Apri WhatsApp' : 'Open WhatsApp'}
                  </button>
                  {waComposeForm.name && waComposeForm.phone && (
                    <button
                      onClick={() => { addOrUpdateContact({ name: waComposeForm.name, email: '', phone: waComposeForm.phone }); }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white border border-green-300 hover:bg-green-50 text-green-700 font-semibold rounded-xl text-sm transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      {it ? 'Salva contatto' : 'Save Contact'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* CONTACTS */}
            <div className="space-y-3">
              {contactFormOpen ? (
                <div className="rounded-2xl border border-green-200 bg-green-50/40 p-4">
                  <p className="text-xs font-bold text-green-700 mb-3">{it ? 'Nuovo contatto' : 'New Contact'}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                    <input type="text" placeholder={it ? 'Nome *' : 'Name *'} value={contactForm.name}
                      onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                      className="px-3 py-2.5 rounded-xl border border-green-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-300"
                    />
                    <input type="email" placeholder="Email" value={contactForm.email}
                      onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                      className="px-3 py-2.5 rounded-xl border border-green-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-300"
                    />
                    <input type="tel" placeholder={it ? 'Telefono *' : 'Phone *'} value={contactForm.phone}
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
                      className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors">{it ? 'Salva contatto' : 'Save Contact'}</button>
                    <button onClick={() => { setContactFormOpen(false); setContactForm({ name: '', email: '', phone: '' }); }}
                      className="px-4 py-2 border border-gray-200 text-gray-600 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors">{it ? 'Annulla' : 'Cancel'}</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setContactFormOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-green-200 text-green-500 font-semibold rounded-2xl hover:border-green-400 hover:bg-green-50/50 transition-all text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  {it ? 'Aggiungi nuovo contatto' : 'Add New Contact'}
                </button>
              )}

              {waFilteredContacts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
                    <WaIcon className="w-7 h-7 text-green-400" />
                  </div>
                  <p className="text-gray-600 font-semibold">{it ? 'Nessun contatto salvato' : 'No saved contacts'}</p>
                  <p className="text-gray-400 text-sm mt-1">{it ? 'Aggiungi contatti per inviare messaggi WhatsApp' : 'Add contacts to send WhatsApp messages'}</p>
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
}
