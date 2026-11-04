import { useRef, useState } from 'react';
import { RemoteImg } from './RemoteImg';
import { Chevron, LinkedIn } from './icons';
import { toast } from '../lib/toast';

// Submit handler with a busy flag; reports the server's message as a toast.
export function useSubmit(fn) {
  const [busy, setBusy] = useState(false);
  const run = async (e) => {
    e?.preventDefault?.();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fn(e);
      if (res?.msg) toast.success(res.msg);
      return res;
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return [run, busy];
}

export function Field({ label, as = 'input', className = '', ...props }) {
  const Tag = as;
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      <Tag className="input" {...props} />
    </label>
  );
}

export function Submit({ busy, children, className = 'btn btn-signal' }) {
  return <button type="submit" className={className} disabled={busy} aria-busy={busy}>{busy ? 'Sending…' : children}</button>;
}

export function Loading({ rows = 3, label = 'Loading' }) {
  return (
    <div role="status" aria-label={label} className="grid gap-3">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="h-5 bg-rule/50 animate-pulse" style={{ width: `${90 - i * 15}%` }} />)}
    </div>
  );
}

export function Failed({ error, retry }) {
  return (
    <div role="alert" className="border border-signal p-4 grid gap-3 justify-items-start">
      <p className="text-signal-ink">{error}</p>
      {retry && <button className="btn btn-sm" onClick={retry}>Try again</button>}
    </div>
  );
}

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

// One member card: photo, name, role, LinkedIn. `big` for the captain's row.
export function Person({ p, big = false, sizes }) {
  return (
    <div className="grid gap-2 content-start">
      <div className="aspect-[4/5] border border-ink bg-sheet overflow-hidden">
        <RemoteImg src={p.img} width={big ? 640 : 480} sizes={sizes ?? '(min-width: 1280px) 18vw, (min-width: 1024px) 23vw, (min-width: 640px) 31vw, 47vw'} alt={p.name} className="size-full object-cover"
          placeholder={<span aria-hidden="true" className="size-full grid place-items-center display text-4xl text-ink-2">{initials(p.name)}</span>} />
      </div>
      <p className={`wide leading-tight mt-1 ${big ? 'text-xl' : ''}`}>{p.name}</p>
      <p className="text-sm text-ink-2 leading-snug">{p.role}</p>
      {p.linkedin && p.linkedin.startsWith('http') && (
        <a href={p.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm justify-self-start hover:text-signal">
          <LinkedIn size={16} /> LinkedIn<span className="sr-only">: {p.name}</span>
        </a>
      )}
    </div>
  );
}

// Team and alumni directory.
export function People({ people }) {
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-5 gap-y-10">
      {people.map((p) => <li key={p._id ?? p.name}><Person p={p} /></li>)}
    </ul>
  );
}

// Horizontal, scroll-snapped strip of photos; buttons scroll by one frame.
export function PhotoStrip({ children, label }) {
  const ref = useRef(null);
  const by = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  return (
    <div className="grid gap-3">
      <div ref={ref} tabIndex={0} aria-label={label} role="region"
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 [&>*]:snap-start [&>*]:shrink-0">
        {children}
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn btn-sm" onClick={() => by(-1)} aria-label="Previous photos"><Chevron className="rotate-180" size={18} /></button>
        <button type="button" className="btn btn-sm" onClick={() => by(1)} aria-label="Next photos"><Chevron size={18} /></button>
      </div>
    </div>
  );
}
