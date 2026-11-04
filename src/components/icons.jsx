// One stroke weight, one grid (24), drawn for this site.
const Icon = ({ children, size = 20, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>
);

export const Instagram = (p) => <Icon {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" /><circle cx="12" cy="12" r="3.8" /><circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" /></Icon>;
export const Facebook = (p) => <Icon {...p}><path d="M14.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4a20 20 0 0 0-2.4-.1c-2.4 0-4 1.4-4 4.1v2.1H8.7v3h2.6V21" /></Icon>;
export const LinkedIn = (p) => <Icon {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="2" /><path d="M8 10.5V16M8 7.8v.1M11.5 16v-5.5M11.5 13c0-1.6 1-2.6 2.3-2.6s2.2.9 2.2 2.6V16" /></Icon>;
export const YouTube = (p) => <Icon {...p}><rect x="2.5" y="5.5" width="19" height="13" rx="3.5" /><path d="m10.2 9.3 4.6 2.7-4.6 2.7z" /></Icon>;
export const Mail = (p) => <Icon {...p}><rect x="3" y="5.5" width="18" height="13" rx="1.5" /><path d="m3.5 6.5 8.5 6.5 8.5-6.5" /></Icon>;
export const Arrow = (p) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>;
export const Menu = (p) => <Icon {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Icon>;
export const Close = (p) => <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>;
export const Sound = (p) => <Icon {...p}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></Icon>;
export const Muted = (p) => <Icon {...p}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="m16 9.5 5 5M21 9.5l-5 5" /></Icon>;
export const Chevron =(p) => <Icon {...p}><path d="m9 6 6 6-6 6" /></Icon>;
export const Sun = (p) => <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></Icon>;
export const Moon = (p) => <Icon {...p}><path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" /></Icon>;
