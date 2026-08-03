import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import UpdateToast from './components/UpdateToast';
import ChunkLoadErrorBoundary from './components/ChunkLoadErrorBoundary';
import { initUpdateSystem } from './lib/update';
import './index.css';

initUpdateSystem();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChunkLoadErrorBoundary>
      <App />
      <UpdateToast />
    </ChunkLoadErrorBoundary>
  </React.StrictMode>
);
