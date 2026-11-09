import { useLayoutEffect, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { SheetHead } from '../components/Layout';
import { RemoteImg, remoteSrc } from '../components/RemoteImg';
import { Failed } from '../components/ui';
import { Chevron, Close } from '../components/icons';
import { useApi } from '../lib/api';
import { motionAllowed } from '../lib/motion';
import { REPO_PHOTOS, visible } from '../content/gallery-tags';
import snapshot from '../content/snapshot.json';

// Runs a DOM change as a view transition where the browser has them (and motion is allowed).
function transition(change, cls) {
  if (!document.startViewTransition || !motionAllowed()) return change();
  if (cls) document.documentElement.classList.add(cls);
  const t = document.startViewTransition(() => flushSync(change));
  t.ready.catch(() => {});
  t.finished.catch(() => {}).finally(() => cls && document.documentElement.classList.remove(cls));
}

// Full-size view in a native <dialog>: focus trap and backdrop come with it. It grows out of the
// thumbnail you clicked and shrinks back into the one you're on when it closes (view-transition-name).
function Viewer({ items, index, onClose, onMove }) {
  const ref = useRef(null);
  useLayoutEffect(() => { const d = ref.current; d.showModal(); return () => d.close(); }, []); // close() hands focus back
  useEffect(() => {
    const key = (e) => { if (e.key === 'ArrowRight') onMove(1); if (e.key === 'ArrowLeft') onMove(-1); };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [onMove]);
  return (
    <dialog ref={ref} data-lenis-prevent onCancel={(e) => { e.preventDefault(); onClose(); }} onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto max-w-none max-h-none w-screen h-dvh bg-[#0b0d12]/95 text-[#f2f3ef] backdrop:bg-transparent p-0">
      <div className="h-full grid grid-rows-[auto_1fr] p-3 md:p-6 gap-3">
        <div className="flex items-center justify-between">
          <p className="data">{index + 1} / {items.length}</p>
          <button className="btn btn-sm border-[#f2f3ef] hover:bg-[#f2f3ef] hover:text-[#0b0d12]" onClick={onClose} aria-label="Close"><Close size={18} /></button>
        </div>
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 min-h-0">
          <button className="btn btn-sm border-[#f2f3ef] hover:bg-[#f2f3ef] hover:text-[#0b0d12]" onClick={() => onMove(-1)} aria-label="Previous photo"><Chevron className="rotate-180" size={18} /></button>
          <img src={remoteSrc(items[index].img, 1600)} alt={`Gallery photo ${index + 1}`} style={{ viewTransitionName: 'photo' }} className="max-h-full max-w-full m-auto object-contain" />
          <button className="btn btn-sm border-[#f2f3ef] hover:bg-[#f2f3ef] hover:text-[#0b0d12]" onClick={() => onMove(1)} aria-label="Next photo"><Chevron size={18} /></button>
        </div>
      </div>
    </dialog>
  );
}

export default function Gallery() {
  const { data, error, loading, reload } = useApi('/gallery/images', { initial: snapshot.gallery, map: (d) => [...d].reverse() });
  const all = useMemo(() => (data ? visible([...REPO_PHOTOS, ...data]) : null), [data]);
  const items = all ?? [];
  const [open, setOpen] = useState(null);
  const move = (d) => setOpen((i) => (i + d + items.length) % items.length);

  const openAt = (i, el) => {
    el.style.viewTransitionName = 'photo';
    transition(() => { el.style.viewTransitionName = ''; setOpen(i); });
  };
  const close = () => {
    const thumb = document.querySelector(`[data-photo="${items[open]?._id}"]`);
    transition(() => { setOpen(null); if (thumb) thumb.style.viewTransitionName = 'photo'; }, 'vt-close');
    setTimeout(() => thumb && (thumb.style.viewTransitionName = ''), 400);
  };

  return (
    <>
      <SheetHead title="Gallery"><p>The aircraft we’ve built and flown, and the people who built them.</p></SheetHead>
      <section className="wrap section pt-12 grid gap-10">
        {loading && !all && ( // only before the first photos: a refresh keeps the ones on screen
          <ul role="status" aria-label="Loading photos" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 12 }, (_, i) => <li key={i} className="aspect-[4/3] border border-rule bg-rule/30 animate-pulse" />)}
          </ul>
        )}
        {error && <Failed error={error} retry={reload} />}
        {all && (
          <div id="gallery-panel">
            {!items.length && <p className="text-ink-2 border border-dashed border-rule p-6">No photos here yet.</p>}
            {/* Even rows of 4:3 tiles, all one height; the last row's tiles widen to fill it, so no gap is left.
                A photo that would sit alone in the last row takes the one before it along, so it ends in a pair.
                The viewer shows each photo uncropped. */}
            <ul data-reveal="stagger" className="@container flex flex-wrap gap-3">
              {items.map((g, i) => (
                <li key={g._id} className="grow basis-[calc(50%-0.375rem)] md:basis-[calc(33.333%-0.5rem)] xl:basis-[calc(25%-0.5625rem)] h-[calc((100cqw-0.75rem)/2*0.75)] md:h-[calc((100cqw-1.5rem)/3*0.75)] xl:h-[calc((100cqw-2.25rem)/4*0.75)] md:max-xl:[&:nth-last-child(2):nth-child(3n)]:basis-[40%] md:max-xl:[&:nth-child(3n+1):last-child]:basis-[40%] xl:[&:nth-last-child(2):nth-child(4n)]:basis-[40%] xl:[&:nth-child(4n+1):last-child]:basis-[40%]">
                  <button type="button" data-photo={g._id} onClick={(e) => openAt(i, e.currentTarget)}
                    className="press block size-full overflow-hidden rounded-[var(--radius-photo)] border border-ink bg-sheet hover:border-signal focus-visible:border-signal"
                    aria-label={`Open photo ${i + 1} of ${items.length}`}>
                    <RemoteImg src={g.img} width={600} sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw" alt="" eager={i < 4} className="size-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      {open !== null && items[open] && <Viewer items={items} index={open} onClose={close} onMove={move} />}
    </>
  );
}
