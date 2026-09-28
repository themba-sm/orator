import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import './styles.css';

// Test-only helper: ?reset=1 clears local storage for a clean-state smoke test.
if (new URLSearchParams(window.location.search).get('reset') === '1') {
  localStorage.clear();
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
