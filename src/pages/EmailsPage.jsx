import { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { sendClientEmail } from '../lib/emailService';
import { useLanguage } from '../context/LanguageContext';

export default function EmailsPage() {
  const { activeShop, contacts, addOrUpdateContact, removeContact, emailSettings } = useShop();
  const { locale } = useLanguage();
  const it = String(locale).toLowerCase().startsWith('it');

  const [manualEmailForm, setManualEmailForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [manualEmailSending, setManualEmailSending] = useState(false);
  const [manualEmailResult, setManualEmailResult] = useState(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  // Broadcast
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({ subject: '', message: '' });
  const [broadcastLang, setBroadcastLang] = useState('it');
  const [broadcastSelected, setBroadcastSelected] = useState(new Set());
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastProgress, setBroadcastProgress] = useState(null); // { sent, failed, total }
  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '' });
  const [contactFormOpen, setContactFormOpen] = useState(false);

        const filteredContacts = contactSearch.trim()
          ? contacts.filter(c =>
            c.name?.toLowerCase().includes(contactSearch.toLowerCase()) ||
            c.email?.toLowerCase().includes(contactSearch.toLowerCase()) ||
            c.phone?.includes(contactSearch)
          )
          : contacts;
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
              emailCfg: emailSettings,
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
            emailCfg: emailSettings,
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
                <h2 className="text-xl font-bold text-gray-800">{it ? 'Casella Email' : 'Email Box'}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{contacts.length} {it ? 'contatti' : 'contacts'}</p>
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
                  {it ? 'Invio multiplo' : 'Broadcast'}
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
                  {composeOpen ? (it ? 'Chiudi' : 'Close') : (it ? 'Scrivi email' : 'Compose Email')}
                </button>
              </div>
            </div>

            {/* Search bar */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" /></svg>
              <input
                type="text"
                placeholder={it ? 'Cerca per nome, email o telefono…' : 'Search contacts by name, email or phone…'}
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
                      {it ? 'Email multipla' : 'Broadcast Email'}
                    </h3>
                    <p className="text-xs text-purple-500 mt-0.5">{it ? 'Invia un’offerta o un annuncio ai contatti selezionati. Usa' : 'Send an offer or announcement to selected contacts. Use'} <code className="bg-purple-100 px-1 rounded">{'{name}'}</code> {it ? 'per personalizzare.' : 'to personalize.'}</p>
                  </div>
                  {/* Language toggle */}
                  <div className="flex items-center gap-1 bg-white border border-purple-200 rounded-xl p-1">
                    <button onClick={() => setBroadcastLang('it')} className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${broadcastLang === 'it' ? 'bg-purple-600 text-white' : 'text-purple-600 hover:bg-purple-50'}`}>IT</button>
                    <button onClick={() => setBroadcastLang('en')} className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${broadcastLang === 'en' ? 'bg-purple-600 text-white' : 'text-purple-600 hover:bg-purple-50'}`}>EN</button>
                  </div>
                </div>

                {/* Quick Suggestions */}
                <div>
                  <p className="text-xs font-bold text-purple-700 mb-2">{it ? 'Suggerimenti rapidi' : 'Quick Suggestions'}</p>
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
                    placeholder={it ? 'Oggetto *' : 'Subject *'}
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
                    <p className="text-xs font-bold text-gray-600">Select Recipients ({broadcastSelected.size} / {filteredContacts.length} selected)</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setBroadcastSelected(new Set(filteredContacts.map(c => c.id)))}
                        className="text-xs font-semibold text-purple-600 hover:underline">{it ? 'Seleziona tutti' : 'Select All'}</button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => setBroadcastSelected(new Set())}
                        className="text-xs font-semibold text-gray-400 hover:underline">{it ? 'Deseleziona tutti' : 'Deselect All'}</button>
                    </div>
                  </div>
                  {filteredContacts.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">{it ? 'Nessun contatto salvato. Aggiungi prima un contatto.' : 'No saved contacts yet. Add contacts first.'}</p>
                  ) : (
                    <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                      {filteredContacts.map(c => (
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
                      <span className="text-emerald-600">✓ {it ? 'Inviate' : 'Sent'}: {broadcastProgress.sent}</span>
                      {broadcastProgress.failed > 0 && <span className="text-red-500">✗ {it ? 'Fallite' : 'Failed'}: {broadcastProgress.failed}</span>}
                      <span className="text-gray-400">{broadcastProgress.sent + broadcastProgress.failed} / {broadcastProgress.total}</span>
                    </div>
                    {!broadcastSending && broadcastProgress.sent + broadcastProgress.failed === broadcastProgress.total && (
                      <p className="text-center text-xs font-bold text-emerald-600 bg-emerald-50 rounded-xl py-2">
                        ✓ {it ? `Invio completato: ${broadcastProgress.sent} email inviate.` : `Broadcast complete! ${broadcastProgress.sent} email${broadcastProgress.sent !== 1 ? 's' : ''} sent.`}
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
                      {it ? 'Invio…' : 'Sending…'} ({broadcastProgress?.sent + broadcastProgress?.failed || 0}/{broadcastProgress?.total || 0})
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      {it ? `Invia a ${broadcastSelected.size} contatti` : `Send to ${broadcastSelected.size} Contact${broadcastSelected.size !== 1 ? 's' : ''}`}
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
                      placeholder={it ? 'Nome cliente' : 'Client Name'}
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
                    placeholder={it ? 'Indirizzo email *' : 'Email Address *'}
                    value={manualEmailForm.email}
                    onChange={e => setManualEmailForm(f => ({ ...f, email: e.target.value }))}
                    className="px-3.5 py-2.5 rounded-xl border border-amber-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                  <input
                    type="tel"
                    placeholder={it ? 'Numero di telefono' : 'Phone Number'}
                    value={manualEmailForm.phone}
                    onChange={e => setManualEmailForm(f => ({ ...f, phone: e.target.value }))}
                    className="px-3.5 py-2.5 rounded-xl border border-amber-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>
                <input
                  type="text"
                  placeholder={it ? 'Oggetto *' : 'Subject *'}
                  value={manualEmailForm.subject}
                  onChange={e => setManualEmailForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-amber-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 mb-3"
                />
                <textarea
                  rows={4}
                  placeholder={it ? 'Messaggio *' : 'Message *'}
                  value={manualEmailForm.message}
                  onChange={e => setManualEmailForm(f => ({ ...f, message: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-amber-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none mb-3"
                />
                {manualEmailResult && (
                  <div className={`text-xs font-semibold px-3 py-2 rounded-lg mb-3 ${manualEmailResult.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                    }`}>
                    {manualEmailResult.success ? (it ? '✓ Email inviata correttamente!' : '✓ Email sent successfully!') : `✗ ${manualEmailResult.error}`}
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
                    {manualEmailSending ? (it ? 'Invio…' : 'Sending…') : (it ? 'Invia email' : 'Send Email')}
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
                      {it ? 'Salva contatto' : 'Save Contact'}
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
                    <p className="text-xs font-bold text-amber-700 mb-3">{it ? 'Nuovo contatto' : 'New Contact'}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                      <input
                        type="text"
                        placeholder={it ? 'Nome *' : 'Name *'}
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
                        placeholder={it ? 'Telefono' : 'Phone'}
                        value={contactForm.phone}
                        onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                        className="px-3 py-2.5 rounded-xl border border-amber-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleSaveContact} disabled={!contactForm.name || !contactForm.email}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors">{it ? 'Salva contatto' : 'Save Contact'}</button>
                      <button onClick={() => { setContactFormOpen(false); setContactForm({ name: '', email: '', phone: '' }); }}
                        className="px-4 py-2 border border-gray-200 text-gray-600 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors">{it ? 'Annulla' : 'Cancel'}</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setContactFormOpen(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-amber-200 text-amber-500 font-semibold rounded-2xl hover:border-amber-400 hover:bg-amber-50/50 transition-all text-sm">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    {it ? 'Aggiungi nuovo contatto' : 'Add New Contact'}
                  </button>
                )}

                {filteredContacts.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <p className="text-gray-600 font-semibold">{contacts.length === 0 ? (it ? 'Nessun contatto salvato' : 'No saved contacts') : (it ? 'Nessun contatto corrisponde alla ricerca' : 'No contacts match your search')}</p>
                    <p className="text-gray-400 text-sm mt-1">{it ? 'Salva i contatti per compilare rapidamente le email' : 'Save contacts to quickly fill the compose form'}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {filteredContacts.map(c => (
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
}
