import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import { initSounds } from './lib/sound';
import './styles.css';

initSounds();

const root = document.getElementById('root');
const app = <StrictMode><BrowserRouter><App /></BrowserRouter></StrictMode>;

// Hydrate only HTML prerendered for this exact URL (prerendering never sees a ?query); anything else renders fresh.
if (root.dataset.route === location.pathname && !location.search) hydrateRoot(root, app);
else { root.textContent = ''; createRoot(root).render(app); }
