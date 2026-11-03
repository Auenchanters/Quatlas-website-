import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import './styles.css';

const root = document.getElementById('root');
const app = <StrictMode><BrowserRouter><App /></BrowserRouter></StrictMode>;

// Hydrate only HTML prerendered for this exact route; any other route renders fresh.
if (root.dataset.route === location.pathname) hydrateRoot(root, app);
else { root.textContent = ''; createRoot(root).render(app); }
