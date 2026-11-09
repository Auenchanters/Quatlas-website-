import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import { initSounds } from './lib/sound';
import './styles.css';

// Prerendered pages already asked for the fonts after their first paint; this covers the SPA shell and dev.
import('./fonts.css');
initSounds();

const root = document.getElementById('root');
const app = <StrictMode><BrowserRouter><App /></BrowserRouter></StrictMode>;

// Hydrate only HTML prerendered for this exact URL (prerendering never sees a ?query); anything else renders fresh.
if (root.dataset.route === location.pathname && !location.search) hydrateRoot(root, app);
else {
  // The shell's default title and description would outrank the page's own (React adds those after them).
  document.querySelectorAll('head > title, head > meta[name="description"]').forEach((e) => e.remove());
  root.textContent = ''; createRoot(root).render(app);
}
