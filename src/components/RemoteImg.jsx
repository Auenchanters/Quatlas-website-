import { useState } from 'react';
import copies from '../content/remote-images.json';

// Photos the dashboard links to (OneDrive / Google Drive). `npm run photos` copies them onto the site
// (scripts/remote-images.mjs); a copied link is served from /img/r, a link known to be dead shows the
// placeholder at once, and anything newer than the last copy falls back to the host.

const local = (url) => (copies[url]?.widths ? copies[url] : null);
const localSrc = (c, w) => `/img/r/${c.name}-${c.widths.find((x) => x >= w) ?? c.widths.at(-1)}.webp`;

// The best URL for a photo at width w: the local copy, else the host's own resized rendition.
export function remoteSrc(url, w) {
  const c = local(url);
  if (c) return localSrc(c, w);
  try {
    const u = new URL(url);
    if (u.host === 'drive.google.com') {
      const id = u.pathname.match(/\/d\/([^/]+)/)?.[1] ?? u.searchParams.get('id');
      if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w${w}`;
    }
    // OneDrive resizes only links that already carry width/height; share links (?e=) break if changed.
    if (u.host === '1drv.ms' && u.searchParams.has('width')) {
      u.searchParams.set('width', w);
      u.searchParams.set('height', w);
      return u.href;
    }
  } catch { /* not an absolute URL: fall through */ }
  return url;
}

export function RemoteImg({ src, width = 800, sizes, alt = '', className = '', placeholder = null, eager = false }) {
  const c = local(src);
  const sized = remoteSrc(src, width);
  const [step, setStep] = useState(0);
  if (!/^https?:\/\//.test(src ?? '') || copies[src]?.failed) return placeholder;
  const load = { loading: eager ? 'eager' : 'lazy', fetchPriority: eager ? 'high' : undefined, decoding: 'async', alt, className };
  if (c) {
    return <img {...load} src={sized} width={c.w} height={c.h} sizes={sizes ?? `${width}px`}
      srcSet={c.widths.map((w) => `${localSrc(c, w)} ${w}w`).join(', ')} />;
  }
  // Not copied yet: resized → original → placeholder, so a bad link never shows a broken-image icon.
  const current = step === 0 ? sized : step === 1 && sized !== src ? src : null;
  if (current === null) return placeholder;
  return <img {...load} src={current} onError={() => setStep((s) => (s === 0 && sized !== src ? 1 : 2))} />;
}
