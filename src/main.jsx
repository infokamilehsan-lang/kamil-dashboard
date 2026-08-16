// Polyfill: html5-qrcode uses performance.clearMarks/clearMeasures which
// may be missing in Safari and some mobile browsers.
if (typeof performance !== 'undefined') {
  if (!performance.clearMarks) performance.clearMarks = () => {};
  if (!performance.clearMeasures) performance.clearMeasures = () => {};
  if (!performance.mark) performance.mark = () => {};
  if (!performance.measure) performance.measure = () => {};
}

// Keep local development free from an old production PWA cache. A previously
// installed worker can otherwise alternate between stale and current UI files.
if ('serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    window.addEventListener('load', async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
      }
    });
  } else {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => {
          reg.update();
          if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          reg.addEventListener('updatefound', () => {
            const sw = reg.installing;
            if (!sw) return;
            sw.addEventListener('statechange', () => {
              if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                sw.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });
        });
      });
    });
  }
}

import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <App />,
)
