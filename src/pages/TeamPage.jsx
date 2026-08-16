import { useState } from 'react';
import { useShop } from '../context/ShopContext';
import { useLanguage } from '../context/LanguageContext';
import { useFmt } from '../lib/useFmt';
import PayMemberModal from '../components/PayMemberModal';

export default function TeamPage() {
  const { activeShop, addTeamMember, updateTeamMember, deleteTeamMember, addOrUpdateContact } = useShop();
  const { t, locale } = useLanguage();
  const { fmt, currencyObj } = useFmt();

  const TEAM_ROLES = [t('role_Manager'), t('role_Technician'), t('role_Cashier'), t('role_Salesperson'), t('role_Barber'), t('role_Chef'), t('role_Waiter'), t('role_SecurityGuard'), t('role_Helper'), t('role_Accountant'), t('role_Receptionist'), t('role_Engineer'), t('role_Other')];

  const [payMember, setPayMember] = useState(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const emptyMember = { name: '', role: 'Tecnico', salary: '', phone: '', email: '', bankName: '', iban: '', accountNo: '', accountHolder: '', photo: '' };
  const [newMember, setNewMember] = useState(emptyMember);
  const [newMemberError, setNewMemberError] = useState('');
  const [editMemberId, setEditMemberId] = useState(null);
  const [editMemberForm, setEditMemberForm] = useState({});
  const readMemberPhoto = (file, setter) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setter((current) => ({ ...current, photo: reader.result }));
    reader.readAsDataURL(file);
  };

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
      photo: newMember.photo || '',
    });
    if (newMember.phone.trim() || newMember.email.trim()) {
      addOrUpdateContact({
        name: newMember.name.trim(),
        email: newMember.email.trim(),
        phone: newMember.phone.trim(),
      });
    }
    setNewMember(emptyMember);
    setAddMemberOpen(false);
    setNewMemberError('');
  };

        const team = activeShop.team || [];
        const activeMembers = team.filter((m) => m.status === 'active');
        const totalPayroll = activeMembers.reduce((s, m) => s + (Number(m.salary) || 0), 0);
        return (
          <>
          <div className="space-y-4">
            {/* Summary */}
            <div className="section-summary rounded-3xl border border-black/10 bg-white p-4 sm:p-5 shadow-sm">
              <div className="flex items-end justify-between gap-3 mb-4"><div><p className="text-[10px] uppercase tracking-[.18em] font-black text-gray-400">{locale === 'it' ? 'Panoramica squadra' : 'Team overview'}</p><h2 className="text-xl font-black mt-1">{locale === 'it' ? 'Persone e retribuzioni' : 'People & payroll'}</h2></div><span className="text-[10px] font-black px-3 py-1.5 rounded-full bg-[#f1fec8]">{activeMembers.length}/{team.length} {locale === 'it' ? 'attivi' : 'active'}</span></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-black/10 p-4 sm:p-5 bg-[#f1fec8]"><p className="text-[9px] uppercase tracking-wider font-black text-gray-500">{t('totalStaff')}</p><strong className="block text-3xl font-black mt-2">{team.length}</strong><p className="text-[10px] text-gray-500 font-bold mt-1">{locale === 'it' ? 'membri registrati' : 'registered members'}</p></div>
                <div className="rounded-2xl border border-black/10 p-4 sm:p-5 bg-[#c6ff34]"><p className="text-[9px] uppercase tracking-wider font-black text-gray-600">{t('active')}</p><strong className="block text-3xl font-black mt-2">{activeMembers.length}</strong><p className="text-[10px] text-gray-600 font-bold mt-1">{team.length - activeMembers.length} {locale === 'it' ? 'in congedo' : 'on leave'}</p></div>
                <div className="rounded-2xl border border-black/10 p-4 sm:p-5 text-white" style={{ background: 'linear-gradient(135deg,#101408,#26320f)' }}><p className="text-[9px] uppercase tracking-wider font-black text-white/55">{t('monthlyPayroll')}</p><strong className="block text-3xl font-black mt-2 truncate">{fmt(totalPayroll)}</strong><p className="text-[10px] text-white/55 font-bold mt-1">{locale === 'it' ? 'costo mensile attivo' : 'active monthly cost'}</p></div>
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
                    <div className="mb-3 rounded-2xl border border-gray-200 p-3 flex items-center gap-3">
                      <div className="w-20 h-20 rounded-xl bg-[#f1fec8] overflow-hidden flex items-center justify-center font-black text-2xl">{editMemberForm.photo ? <img src={editMemberForm.photo} alt="" className="w-full h-full object-cover" /> : editMemberForm.name?.charAt(0)?.toUpperCase()}</div>
                      <label className="flex-1 cursor-pointer rounded-xl border border-dashed border-gray-300 px-4 py-3 text-xs font-black text-center hover:bg-gray-50">{locale === 'it' ? 'Cambia foto' : 'Change photo'}<input type="file" accept="image/*" className="hidden" onChange={(e) => readMemberPhoto(e.target.files?.[0], setEditMemberForm)} /></label>
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
                          photo: editMemberForm.photo || '',
                        });
                        setEditMemberId(null);
                      }} className="flex-1 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-colors">{t('saveChanges')}</button>
                    </div>
                  </div>
                ) : (
                  /* ── Normal View ── */
                  <div className="relative overflow-hidden rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center gap-5" style={{ background: 'linear-gradient(135deg,#fff 0%,#fbfff0 100%)' }}>
                    {/* Avatar */}
                    <div className="w-full md:w-40 h-48 md:h-40 rounded-2xl bg-[#f1fec8] border border-black/10 overflow-hidden flex items-center justify-center shrink-0 text-gray-900 font-black text-5xl shadow-sm">
                      {member.photo ? <img src={member.photo} alt={member.name} className="w-full h-full object-cover" /> : member.name?.charAt(0)?.toUpperCase()}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-bold text-gray-900">{member.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${member.status === 'active' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                          {member.status === 'active' ? 'Attivo' : 'In Congedo'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-3 flex-wrap">
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
                    <div className="grid grid-cols-4 md:flex md:items-center gap-2 shrink-0">
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
                        onClick={() => { setEditMemberId(member.id); setEditMemberForm({ name: member.name, role: member.role, salary: member.salary || '', phone: member.phone || '', bankName: member.bankName || '', iban: member.iban || '', accountNo: member.accountNo || '', accountHolder: member.accountHolder || '', photo: member.photo || '' }); }}
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
                  <div className="col-span-2 rounded-2xl border border-gray-200 p-3 flex items-center gap-3">
                    <div className="w-24 h-24 rounded-xl bg-[#f1fec8] overflow-hidden flex items-center justify-center font-black text-3xl">{newMember.photo ? <img src={newMember.photo} alt="" className="w-full h-full object-cover" /> : (newMember.name?.charAt(0)?.toUpperCase() || '＋')}</div>
                    <label className="flex-1 cursor-pointer rounded-xl border border-dashed border-gray-300 px-4 py-4 text-xs font-black text-center hover:bg-gray-50">{locale === 'it' ? 'Carica foto profilo' : 'Upload profile photo'}<input type="file" accept="image/*" className="hidden" onChange={(e) => readMemberPhoto(e.target.files?.[0], setNewMember)} /></label>
                  </div>
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
                  <button type="button" onClick={() => { setAddMemberOpen(false); setNewMemberError(''); setNewMember(emptyMember); }} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm">{t('cancel')}</button>
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
          {payMember && (
            <PayMemberModal shop={activeShop} member={payMember} onClose={() => setPayMember(null)} />
          )}
          </>
        );
}
