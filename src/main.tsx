import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Silence AI-Studio-preview iframe noise in DEVELOPMENT ONLY.
// Tree-shaken out of production builds (import.meta.env.DEV is a compile-time constant).
if (import.meta.env.DEV) {
  import('./lib/devErrorFilter.ts').then(({ installDevErrorFilter }) => installDevErrorFilter());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
