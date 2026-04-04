// Polyfill: html5-qrcode uses performance.clearMarks/clearMeasures which
// may be missing in Safari and some mobile browsers.
if (typeof performance !== 'undefined') {
  if (!performance.clearMarks) performance.clearMarks = () => {};
  if (!performance.clearMeasures) performance.clearMeasures = () => {};
  if (!performance.mark) performance.mark = () => {};
  if (!performance.measure) performance.measure = () => {};
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
