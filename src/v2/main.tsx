// Pico v2 entry (index.dev.html → production build and dev server). The store, sync and screens live in src/v2/app.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { store } from './app/state';
import './app/app.css';

// A handle for checking things in the browser console while developing.
if (import.meta.env.DEV) Object.assign(window, { pico: { store } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
