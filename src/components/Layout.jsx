import { useEffect, useRef, useState } from 'react';
import { revealPage } from '../lib/motion';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Img } from './Img';
import Particles from './Particles';
import SoundToggle from './SoundToggle';
import ThemeCord from './ThemeCord';
import { Facebook, Instagram, LinkedIn, Mail, Menu, Close, YouTube } from './icons';

const NAV = [
  ['/', 'Home'], ['/about', 'About'], ['/team', 'Team'], ['/achievements', 'Achievements'],
  ['/events', 'Events'], ['/gallery', 'Gallery'], ['/support', 'Support'], ['/contact', 'Contact'],
];

// Every public page is a sheet in the set; the title block names it.
export const SHEETS = {
  '/': 'General arrangement', '/about': 'About', '/team': 'Team', '/achievements': 'Achievements',
  '/events': 'Events', '/gallery': 'Gallery', '/support': 'Support', '/contact': 'Contact',
  '/alumini': 'Alumni', '/recruitment': 'Recruitment', '/terms': 'Terms of use',
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
    `block py-2 xl:py-0 no-underline wide text-[0.9375rem] ${isActive ? 'text-signal' : 'hover:text-signal'}`;
  return (
    <header className="border-b border-ink bg-paper sticky top-0 z-40">
      <div className="wrap flex items-center justify-between gap-6 h-16">
        <Link to="/" className="shrink-0" aria-label="Quatlas Aeromodelling, home">
          <Img name="quatlas" eager sizes="96px" className="brand-logo h-10 w-auto mix-blend-multiply" />
        </Link>
        <div className="flex items-center gap-2 xl:gap-4">
          <nav id="nav" aria-label="Main"
            className={`${open ? 'block' : 'hidden'} xl:block absolute xl:static inset-x-0 top-16 bg-paper border-b xl:border-0 border-ink`}>
            <ul className="wrap xl:p-0 xl:flex items-center gap-7 py-3">
              {NAV.map(([to, label]) => <li key={to}><NavLink to={to} end viewTransition className={link}>{label}</NavLink></li>)}
              <li><NavLink to="/login" className="btn btn-sm mt-2 xl:mt-0">Login</NavLink></li>
            </ul>
          </nav>
          <SoundToggle />
          <button className="xl:hidden btn btn-sm" aria-expanded={open} aria-controls="nav" onClick={() => setOpen(!open)}>
            <span className="icon-swap" data-state={open ? 'b' : 'a'}><Menu /><Close /></span><span>Menu</span>
          </button>
          {/* The theme cord hangs through this slot (see --pullcord-right). */}
          <span aria-hidden="true" className="size-11 shrink-0" />
          <ThemeCord />
        </div>
      </div>
    </header>
  );
}

const FOOT = [
  ['Club', [['/about', 'About us'], ['/about#faculty', 'Faculty'], ['/achievements', 'Achievements']]],
  ['Team', [['/team', 'Our team'], ['/alumini', 'Alumni'], ['/recruitment', 'Join us']]],
  ['Support', [['/support', 'Supporters'], ['/support#crowdfunding', 'Crowdfunding']]],
  ['Events', [['/events', 'Upcoming'], ['/events#past', 'Past events']]],
  ['Help', [['/contact#faq', 'FAQs'], ['/contact', 'Send a request'], ['/terms', 'Terms of use']]],
];

function Footer() {
  const { pathname } = useLocation();
  const n = SHEET_KEYS.indexOf(pathname);
  const pad = (v) => String(v).padStart(2, '0');
  return (
    <footer className="mt-24 border-t border-ink bg-sheet">
      <div className="wrap grid gap-10 py-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
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
        <nav aria-label="Footer" className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-x-6 gap-y-8">
          {FOOT.map(([title, links]) => (
            <div key={title}>
              <h2 className="text-sm font-[650] mb-3">{title}</h2>
              <ul className="grid gap-2 text-[0.9375rem] text-ink-2">
                {links.map(([to, label]) =>
                  <li key={label}>{to.startsWith('http')
                    ? <a href={to} target="_blank" rel="noreferrer" className="no-underline hover:text-signal">{label}</a>
                    : <Link to={to} viewTransition className="no-underline hover:text-signal">{label}</Link>}</li>)}
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
            <dt className="data text-ink-2">Issued</dt>
            <dd className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <span>{new Date().getFullYear()} © Quatlas</span>
              <Link to="/terms" className="hover:text-signal">Terms of use</Link>
              {/* A small hidden game, findable if you look. */}
              <Link to="/hangar" className="no-underline text-ink-2 hover:text-signal">secret</Link>
            </dd>
          </div>
        </dl>
      </div>
    </footer>
  );
}

// Keyed by route: its effect runs once the (lazy) page has committed, and cleans up on the way out.
function PageMotion({ children }) {
  const ref = useRef(null);
  useEffect(() => revealPage(ref.current), []);
  return <div ref={ref}>{children}</div>;
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
      <main id="main"><PageMotion key={pathname}><Outlet /></PageMotion></main>
      <Footer />
    </>
  );
}

// Page heading shared by every sheet: big expanded title, optional lede.
export function SheetHead({ title, children }) {
  return (
    <div className="wrap pt-[clamp(4rem,9vw,8rem)] pb-[clamp(3rem,6vw,5rem)] border-b border-rule">
      <h1 data-reveal="words" className="display text-[clamp(2.75rem,6vw,5.5rem)]">{title}</h1>
      {children && <div data-reveal="up" className="mt-6 max-w-2xl text-lg text-ink-2">{children}</div>}
    </div>
  );
}

// Renders the structured copy in src/content/*.json.
export function Copy({ sections, from = 0, to }) {
  return sections.slice(from, to).map((s, i) => (
    <section key={i} className="wrap grid md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-12 gap-y-4 py-10 md:py-14 border-b border-rule">
      {s.heading ? <h2 data-reveal="words" className="wide text-2xl md:text-[1.75rem]">{s.heading}</h2> : <span />}
      <div data-reveal="up" className="copy">
        {s.blocks.map((b, j) => b.type === 'p'
          ? <p key={j}>{b.text}</p>
          : <ul key={j}>{b.items.map((t, k) => <li key={k}>{t}</li>)}</ul>)}
      </div>
    </section>
  ));
}
