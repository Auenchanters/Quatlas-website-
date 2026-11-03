import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Menu, Close } from '../components/icons';
import { session } from '../lib/api';

const NAV = [
  ['/Data', 'Home'], ['/recruitdata', 'Recruitment'], ['/forms', 'Forms & Sponsors'],
  ['/team', 'Team Data'], ['/links', 'Links'], ['/admin', 'Account'],
];

// Every admin route sits behind this: no token, no dashboard.
export default function AdminLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  if (!session.token) return <Navigate to="/login" replace />;

  const logout = () => { session.clear(); navigate('/'); };
  const link = ({ isActive }) => `block px-3 py-2 no-underline text-[0.9375rem] ${isActive ? 'bg-ink text-paper' : 'hover:bg-rule/40'}`;
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b border-ink bg-sheet">
        <div className="wrap flex items-center justify-between gap-4 h-14">
          <p className="wide">Quatlas Dashboard</p>
          <button className="lg:hidden btn btn-sm" aria-expanded={open} aria-controls="admin-nav" onClick={() => setOpen(!open)}>
            {open ? <Close size={18} /> : <Menu size={18} />}<span>Menu</span>
          </button>
          <nav id="admin-nav" aria-label="Dashboard"
            className={`${open ? 'block' : 'hidden'} lg:block absolute lg:static inset-x-0 top-14 bg-sheet border-b lg:border-0 border-ink z-30`}>
            <ul className="wrap lg:p-0 lg:flex items-center gap-1 py-2">
              {NAV.map(([to, label]) => <li key={to}><NavLink to={to} className={link}>{label}</NavLink></li>)}
              <li><button onClick={logout} className="btn btn-sm lg:ml-3 mt-2 lg:mt-0">Logout</button></li>
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" className="wrap py-8 md:py-10 grid gap-12 flex-1 content-start"><Outlet /></main>
      <footer className="border-t border-rule py-4 wrap text-sm text-ink-2">
        {new Date().getFullYear()} © Quatlas, All Rights Reserved. Designed By Pavan Reddy. Powered By Madhouse
      </footer>
    </div>
  );
}

export function Panel({ title, actions, children }) {
  return (
    <section className="grid gap-4 min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink pb-3">
        <h2 className="wide text-xl md:text-2xl">{title}</h2>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
