import { useState } from 'react';
import copies from '../content/remote-images.json';
import manifest from '../content/images.json';
import { Img } from './Img';

// Photos the dashboard links to (OneDrive / Google Drive). `npm run photos` copies them onto the site
// (scripts/remote-images.mjs); a copied link is served from /img/r, a link known to be dead shows the
// placeholder at once, and anything newer than the last copy falls back to the host.

// A dashboard link copied to /img/r, or the name of a photo kept in the repo (assets-src → /img).
// A link to one of the site's own photos (…/img/<name>-<width>.webp, as the dashboard stores the roster) is local too.
const ownPhoto = (src) => { const m = /\/img\/([\w-]+?)-\d+\.webp$/.exec(src ?? ''); return m && manifest[m[1]] ? m[1] : null; };
const local = (src) => {
  if (copies[src]?.widths) return copies[src];
  const name = manifest[src] ? src : ownPhoto(src);
  return name ? { ...manifest[name], name, dir: '/img' } : null;
};
const localSrc = (c, w) => `${c.dir ?? '/img/r'}/${c.name}-${c.widths.find((x) => x >= w) ?? c.widths.at(-1)}.webp`;

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
    if (u.host === '1drv.ms') return `/api/img?w=${w}&url=${encodeURIComponent(url)}`; // share link: only the relay can open it
  } catch { /* not an absolute URL: fall through */ }
  return url;
}

// Width / height of the local copy, for laying out before the photo arrives.
export const dims = (url) => { const c = local(url); return c ? [c.w, c.h] : null; };

// Keyed by src: a new link (say, a photo just updated in the dashboard) starts its fallback chain afresh.
export function RemoteImg(props) {
  return <Photo key={props.src} {...props} />;
}

function Photo({ src, width = 800, sizes, alt = '', className = '', placeholder = null, eager = false }) {
  const c = local(src);
  const sized = remoteSrc(src, width);
  const [step, setStep] = useState(0);
  // …/img/none is the dashboard's "no photo yet" (the server needs some link): straight to the initials.
  if ((!c && !/^https?:\/\//.test(src ?? '')) || copies[src]?.failed || src.endsWith('/img/none')) return placeholder;
  const load = { loading: eager ? 'eager' : 'lazy', fetchPriority: eager ? 'high' : undefined, decoding: 'async', alt, className };
  if (c) {
    return <img {...load} src={sized} width={c.w} height={c.h} sizes={sizes ?? `${width}px`} style={c.c ? { backgroundColor: c.c } : undefined}
      srcSet={c.widths.map((w) => `${localSrc(c, w)} ${w}w`).join(', ')} />;
  }
  // Not copied yet: the host's own resized link → the site's relay (api/img.js, which also opens OneDrive
  // share links) → placeholder, so a bad link never shows a broken-image icon.
  const chain = [...new Set([sized !== src && sized, `/api/img?w=${width}&url=${encodeURIComponent(src)}`].filter(Boolean))];
  if (step >= chain.length) return placeholder;
  return <img {...load} src={chain[step]} onError={() => setStep((s) => s + 1)} />;
}

// A photo by local name ('gg01') or by dashboard link, for lists that mix both.
// Width-for-height: the CSS width (px) a photo shown at a fixed height h takes, from its known aspect.
export const widthAt = (name, h) => { const d = /^https?:\/\//.test(name) ? dims(name) : manifest[name] && [manifest[name].w, manifest[name].h]; return d ? Math.round((h * d[0]) / d[1]) : null; };

export function Pic({ name, width = 800, ...p }) {
  return /^https?:\/\//.test(name) ? <RemoteImg src={name} width={width} {...p} /> : <Img name={name} {...p} />;
}
