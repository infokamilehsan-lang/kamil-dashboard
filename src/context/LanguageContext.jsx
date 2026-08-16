import { createContext, useContext, useState, useCallback } from 'react';
import translations from '../i18n/translations';

const LanguageContext = createContext();

const LANG_KEY = 'dashboard_language';

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try { return localStorage.getItem(LANG_KEY) || 'it'; } catch { return 'it'; }
  });

  const setLang = useCallback((l) => {
    setLangState(l);
    try { localStorage.setItem(LANG_KEY, l); } catch {}
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'it' ? 'en' : 'it');
  }, [lang, setLang]);

  const t = useCallback((key) => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[lang] || entry['en'] || key;
  }, [lang]);

  const locale = lang === 'it' ? 'it-IT' : 'en-US';

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t, locale }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be inside LanguageProvider');
  return ctx;
}

// Standalone getter for use outside React (e.g. ShopContext notify calls)
export function getLang() {
  try { return localStorage.getItem(LANG_KEY) || 'it'; } catch { return 'it'; }
}

export function tStatic(key) {
  const entry = translations[key];
  if (!entry) return key;
  const lang = getLang();
  return entry[lang] || entry['en'] || key;
}
