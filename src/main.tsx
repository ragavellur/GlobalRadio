import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import UpdateToast from './components/UpdateToast';
import ChunkLoadErrorBoundary from './components/ChunkLoadErrorBoundary';
import { initUpdateSystem } from './lib/update';
import './index.css';

initUpdateSystem();

function applyViewportHeight() {
  const vv = window.visualViewport;
  const vh = vv ? vv.height : window.innerHeight;
  document.documentElement.style.setProperty('--app-vh', `${vh}px`);
  document.documentElement.style.height = `${vh}px`;
  document.body.style.height = `${vh}px`;
}

applyViewportHeight();
window.addEventListener('resize', applyViewportHeight);
window.visualViewport?.addEventListener('resize', applyViewportHeight);
window.visualViewport?.addEventListener('scroll', applyViewportHeight);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChunkLoadErrorBoundary>
      <App />
      <UpdateToast />
    </ChunkLoadErrorBoundary>
  </React.StrictMode>
);
