// Polyfill: html5-qrcode uses performance.clearMarks/clearMeasures which
// may be missing in Safari and some mobile browsers.
if (typeof performance !== 'undefined') {
  if (!performance.clearMarks) performance.clearMarks = () => {};
  if (!performance.clearMeasures) performance.clearMeasures = () => {};
  if (!performance.mark) performance.mark = () => {};
  if (!performance.measure) performance.measure = () => {};
}

// Force SW update: when a new service worker takes control, reload immediately
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => {
        reg.update();
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
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

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
