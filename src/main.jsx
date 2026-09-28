import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// --- temporary diagnostic overlay: surfaces uncaught errors visibly ---
function showDiagError(msg) {
  let el = document.getElementById('orator-diag');
  if (!el) {
    el = document.createElement('div');
    el.id = 'orator-diag';
    el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;max-height:40vh;overflow:auto;background:#300;color:#fff;font:11px monospace;padding:10px;z-index:99999;white-space:pre-wrap;';
    document.body.appendChild(el);
  }
  el.textContent += msg + '\n\n';
}
window.addEventListener('error', (e) => showDiagError('ERROR: ' + (e.error?.stack || e.message)));
window.addEventListener('unhandledrejection', (e) => showDiagError('REJECTION: ' + (e.reason?.stack || e.reason)));
// --- end diagnostic ---

if (new URLSearchParams(window.location.search).get('reset') === '1') {
  localStorage.clear();
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
