import { useState, useRef, useEffect } from 'react';

const DAY_LABELS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];
const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

function toISO(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function DatePicker({ value, onChange, max, min, className = '', inputClassName = '', placement = 'bottom' }) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => {
    if (value) return parseInt(value.split('-')[0]);
    return new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) return parseInt(value.split('-')[1]) - 1;
    return new Date().getMonth();
  });
  const containerRef = useRef(null);

  useEffect(() => {
    if (value) {
      setViewYear(parseInt(value.split('-')[0]));
      setViewMonth(parseInt(value.split('-')[1]) - 1);
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate());

  // Build calendar grid (Mon-first)
  const firstDayOfWeek = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function selectDay(day) {
    const iso = toISO(viewYear, viewMonth, day);
    if (max && iso > max) return;
    if (min && iso < min) return;
    onChange(iso);
    setOpen(false);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  let displayValue = 'Seleziona data';
  if (value) {
    const [y, mo, dy] = value.split('-');
    displayValue = `${dy}/${mo}/${y}`;
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 bg-white border rounded-xl px-4 py-3 text-sm transition-all focus:outline-none
          ${open ? 'border-amber-400 ring-2 ring-amber-200' : 'border-gray-200 hover:border-amber-300'}
          ${inputClassName}`}
      >
        <div className="flex items-center gap-2.5">
          <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className={value ? 'text-gray-800 font-medium' : 'text-gray-400'}>{displayValue}</span>
        </div>
        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown calendar — fixed on mobile, absolute on desktop */}
      {open && (
        <div className={`fixed sm:absolute z-[200] inset-x-2 sm:inset-x-auto sm:right-0 sm:left-auto bottom-4 sm:bottom-auto bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 select-none mx-auto sm:mx-0 ${placement === 'top' ? 'sm:bottom-full sm:mb-2' : 'sm:top-full sm:mt-2'}`}
          style={{ maxWidth: '320px', minWidth: '290px' }}>
          {/* Month/Year navigation */}
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-amber-50 text-gray-500 hover:text-amber-600 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-center">
              <span className="text-sm font-bold text-gray-800">{MONTH_NAMES[viewMonth]}</span>
              <span className="text-sm font-bold text-amber-500 ml-1.5">{viewYear}</span>
            </div>
            <button type="button" onClick={nextMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-amber-50 text-gray-500 hover:text-amber-600 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 mb-1.5">
            {DAY_LABELS.map((d, i) => (
              <div key={i} className="text-center text-[11px] font-bold text-gray-400 py-1 uppercase tracking-wide">
                {d}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const iso = toISO(viewYear, viewMonth, day);
              const isSelected = value === iso;
              const isToday = iso === todayISO;
              const isDisabled = (max && iso > max) || (min && iso < min);
              return (
                <button key={i} type="button" disabled={isDisabled} onClick={() => selectDay(day)}
                  className={`w-full aspect-square flex items-center justify-center text-[13px] rounded-xl font-medium transition-all
                    ${isSelected
                      ? 'bg-linear-to-br from-amber-400 to-amber-500 text-white shadow-md shadow-amber-200 scale-105'
                      : isToday
                        ? 'bg-amber-50 text-amber-600 font-bold ring-1.5 ring-amber-300'
                        : isDisabled
                          ? 'text-gray-200 cursor-not-allowed'
                          : 'text-gray-700 hover:bg-amber-50 hover:text-amber-600 hover:scale-105'
                    }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Today shortcut */}
          <div className="mt-3.5 pt-3 border-t border-gray-100 flex gap-2">
            <button type="button"
              onClick={() => {
                if ((max && todayISO > max) || (min && todayISO < min)) return;
                onChange(todayISO);
                setOpen(false);
                setViewYear(today.getFullYear());
                setViewMonth(today.getMonth());
              }}
              className="flex-1 text-xs font-semibold text-amber-600 hover:text-white py-2 rounded-xl hover:bg-amber-500 transition-all border border-amber-200 hover:border-amber-500">
              Oggi
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="flex-1 text-xs font-semibold text-gray-500 hover:text-gray-700 py-2 rounded-xl hover:bg-gray-50 transition-all border border-gray-200">
              Chiudi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
