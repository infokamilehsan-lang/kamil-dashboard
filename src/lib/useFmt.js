import { useShop } from '../context/ShopContext';
import { useLanguage } from '../context/LanguageContext';
import { CURRENCIES } from '../data/initialData';

/* Shared currency + date formatting for all dashboard pages */
export function useFmt() {
  const { activeShop } = useShop();
  const { locale } = useLanguage();
  const currencyObj = CURRENCIES.find((c) => c.code === activeShop?.currency) || CURRENCIES[0];
  const fmt = (n) =>
    `${n < 0 ? '-' : ''}${currencyObj.symbol}${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.abs(n))}`;
  const fmtDate = (d) =>
    new Date(d).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  return { fmt, fmtDate, currencyObj };
}
