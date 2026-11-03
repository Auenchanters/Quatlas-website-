import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Img } from './Img';
import Particles from './Particles';
import SoundToggle from './SoundToggle';
import { Facebook, Instagram, LinkedIn, Mail, Menu, Close, YouTube } from './icons';

const NAV = [
  ['/', 'Home'], ['/about', 'About'], ['/contact', 'Contact Us'], ['/achievements', 'Achievements'],
  ['/sponsors', 'Sponsors'], ['/alumini', 'Alumni'], ['/gallery', 'Gallery'],
];

// Every public page is a sheet in the set; the title block names it.
export const SHEETS = {
  '/': 'General arrangement', '/about': 'About', '/achievements': 'Achievements', '/sponsors': 'Sponsors',
  '/crowdfunding': 'Crowdfunding', '/contact': 'Contact', '/alumini': 'Alumni', '/gallery': 'Gallery',
  '/recruitment': 'Recruitment', '/privacy': 'Privacy policy', '/terms': 'Terms of use',
};
const SHEET_KEYS = Object.keys(SHEETS);

const SOCIAL = [
  ['https://www.instagram.com/quatlasaeromodelling', 'Instagram', Instagram],
  ['https://www.facebook.com/quatlas', 'Facebook', Facebook],
  ['https://www.linkedin.com/company/quatlas-aeromodelling', 'LinkedIn', LinkedIn],
  ['https://www.youtube.com/@QuatlasAeromodellingMSRIT', 'YouTube', YouTube],
  ['mailto:aeromodellingquatlas@gmail.com', 'Email', Mail],
];

export const MAP_URL = 'https://maps.app.goo.gl/4qKM3Hg6Sv5HNQHJ7';

function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  const link = ({ isActive }) =>
    `block py-2 lg:py-0 no-underline wide text-[0.9375rem] ${isActive ? 'text-signal' : 'hover:text-signal'}`;
  return (
    <header className="border-b border-ink bg-paper sticky top-0 z-40">
      <div className="wrap flex items-center justify-between gap-6 h-16">
        <Link to="/" className="shrink-0" aria-label="Quatlas Aeromodelling, home">
          <Img name="quatlas" eager sizes="96px" className="brand-logo h-10 w-auto mix-blend-multiply" />
        </Link>
        <div className="flex items-center gap-2 lg:gap-4">
          <nav id="nav" aria-label="Main"
            className={`${open ? 'block' : 'hidden'} lg:block absolute lg:static inset-x-0 top-16 bg-paper border-b lg:border-0 border-ink`}>
            <ul className="wrap lg:p-0 lg:flex items-center gap-7 py-3">
              {NAV.map(([to, label]) => <li key={to}><NavLink to={to} end className={link}>{label}</NavLink></li>)}
              <li><NavLink to="/login" className="btn btn-sm mt-2 lg:mt-0">Login</NavLink></li>
            </ul>
          </nav>
          <SoundToggle />
          <button className="lg:hidden btn btn-sm" aria-expanded={open} aria-controls="nav" onClick={() => setOpen(!open)}>
            {open ? <Close /> : <Menu />}<span>Menu</span>
          </button>
        </div>
      </div>
    </header>
  );
}

const FOOT = [
  ['Quick links', [['/contact', 'Contact us'], ['/privacy', 'Privacy'], ['/terms', 'Terms of use']]],
  ['Sponsors', [['/sponsors', 'Sponsors'], ['/contact', 'Query']]],
  ['About', [['/about', 'About us'], ['https://www.msrit.edu/department/faculty-detail.html?dept=me&ID=44', 'Faculty'], ['/about#team', 'Team']]],
  ['Crowdfunding', [['/crowdfunding', 'Pay via UPI'], ['/crowdfunding', 'Info']]],
  ['Events', [['/recruitment', 'Recruitment']]],
];

function Footer() {
  const { pathname } = useLocation();
  const n = SHEET_KEYS.indexOf(pathname);
  const pad = (v) => String(v).padStart(2, '0');
  return (
    <footer className="mt-24 border-t border-ink bg-sheet">
      <div className="wrap grid gap-10 py-12 md:grid-cols-[1.3fr_2fr]">
        <div className="grid gap-5 content-start">
          <p className="max-w-sm text-ink-2">
            Quatlas, a distinguished Aerospace Modelling group hailing from Ramaiah Institute of Technology in Bangalore, Karnataka IN.
          </p>
          <ul className="flex gap-1">
            {SOCIAL.map(([href, label, I]) => (
              <li key={label}>
                <a href={href} aria-label={label} className="grid place-items-center size-11 hover:text-signal" target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
                  <I />
                </a>
              </li>
            ))}
          </ul>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-8">
          {FOOT.map(([title, links]) => (
            <div key={title}>
              <h2 className="text-sm font-semibold mb-3">{title}</h2>
              <ul className="grid gap-2 text-[0.9375rem] text-ink-2">
                {links.map(([to, label]) =>
                  <li key={label}>{to.startsWith('http')
                    ? <a href={to} target="_blank" rel="noreferrer" className="no-underline hover:text-signal">{label}</a>
                    : <Link to={to} className="no-underline hover:text-signal">{label}</Link>}</li>)}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      {/* Title block, as on a drawing sheet. */}
      <div className="border-t border-ink">
        <dl className="wrap grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1.4fr] text-sm">
          <div className="py-4 pr-4 md:border-r border-rule col-span-2 md:col-span-1">
            <dt className="data text-ink-2">Address</dt>
            <dd className="mt-1">
              Ramaiah Institute of Technology, M S Ramaiah Nagar, Mathikere, Bengaluru, Karnataka IN 560054.{' '}
              <a href={MAP_URL} target="_blank" rel="noreferrer" className="text-signal">Locate on map</a>
            </dd>
          </div>
          <div className="py-4 md:px-4 border-t md:border-t-0 md:border-r border-rule">
            <dt className="data text-ink-2">Sheet</dt>
            <dd className="mt-1 wide">{SHEETS[pathname] ?? 'Quatlas'}</dd>
          </div>
          <div className="py-4 pl-4 md:px-4 border-t md:border-t-0 border-l md:border-l-0 md:border-r border-rule">
            <dt className="data text-ink-2">No.</dt>
            <dd className="mt-1 data text-ink">{n >= 0 ? `${pad(n + 1)} / ${pad(SHEET_KEYS.length)}` : '—'}</dd>
          </div>
          <div className="py-4 md:pl-4 border-t md:border-t-0 border-rule col-span-2 md:col-span-1">
            <dt className="data text-ink-2">Drawn by</dt>
            <dd className="mt-1">Designed and developed by Pavan Reddy · {new Date().getFullYear()} © Quatlas, All Rights Reserved.</dd>
          </div>
        </dl>
      </div>
    </footer>
  );
}

export default function Layout() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 btn bg-paper">Skip to content</a>
      <Particles />
      <Header />
      <main id="main"><Outlet /></main>
      <Footer />
    </>
  );
}

// Page heading shared by every sheet: big expanded title, optional lede.
export function SheetHead({ title, children }) {
  return (
    <div className="wrap pt-14 md:pt-20 pb-10 md:pb-14 border-b border-rule">
      <h1 className="display text-[clamp(2.5rem,8vw,5.75rem)]">{title}</h1>
      {children && <div className="mt-6 max-w-2xl text-lg text-ink-2">{children}</div>}
    </div>
  );
}

// Renders the structured copy in src/content/*.json.
export function Copy({ sections, from = 0, to }) {
  return sections.slice(from, to).map((s, i) => (
    <section key={i} className="wrap grid md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-12 gap-y-4 py-10 md:py-14 border-b border-rule">
      {s.heading ? <h2 className="wide text-2xl md:text-[1.75rem]">{s.heading}</h2> : <span />}
      <div className="copy">
        {s.blocks.map((b, j) => b.type === 'p'
          ? <p key={j}>{b.text}</p>
          : <ul key={j}>{b.items.map((t, k) => <li key={k}>{t}</li>)}</ul>)}
      </div>
    </section>
  ));
}
