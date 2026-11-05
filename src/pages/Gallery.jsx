import { useLayoutEffect, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useSearchParams } from 'react-router';
import { SheetHead } from '../components/Layout';
import { RemoteImg, dims, remoteSrc } from '../components/RemoteImg';
import { Failed } from '../components/ui';
import { Chevron, Close } from '../components/icons';
import { useApi } from '../lib/api';
import { motionAllowed } from '../lib/motion';
import { splitGallery } from '../content/gallery-tags';
import snapshot from '../content/snapshot.json';

const TABS = [['aircraft', 'Aircraft'], ['people', 'People']];

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

// Aircraft / People tabs with an underline that slides (and stretches a little while it travels).
function Tabs({ view, counts, onChange }) {
  const list = useRef(null);
  const bar = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    const tab = list.current?.querySelector('[aria-selected="true"]');
    if (!tab) return;
    setPos((old) => {
      if (old && motionAllowed()) bar.current?.animate([{ scale: '1 1' }, { scale: '1.12 1' }, { scale: '1 1' }], { duration: 280, easing: 'ease-in-out' });
      return { x: tab.offsetLeft, w: tab.offsetWidth };
    });
  }, [view]);
  const key = (e) => {
    const i = TABS.findIndex(([v]) => v === view);
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const next = TABS[(i + d + TABS.length) % TABS.length][0];
    onChange(next);
    list.current.querySelector(`#tab-${next}`)?.focus();
  };
  return (
    <div ref={list} role="tablist" aria-label="Gallery sections" onKeyDown={key} className="relative flex gap-8 border-b border-rule">
      {TABS.map(([v, label]) => (
        <button key={v} id={`tab-${v}`} role="tab" type="button" aria-selected={v === view} aria-controls="gallery-panel" tabIndex={v === view ? 0 : -1}
          onClick={() => onChange(v)} className={`wide text-xl md:text-2xl py-4 inline-flex items-baseline gap-2 ${v === view ? '' : 'text-ink-2 hover:text-ink'}`}>
          {label}<span className="data text-ink-2">{counts[v]}</span>
        </button>
      ))}
      <span ref={bar} aria-hidden="true" className="absolute -bottom-px left-0 h-0.5 bg-signal transition-[translate,width] duration-[280ms] ease-in-out"
        style={pos ? { translate: `${pos.x}px 0`, width: pos.w } : { width: 0 }} />
    </div>
  );
}

export default function Gallery() {
  const { data, error, loading, reload } = useApi('/gallery/images', { initial: snapshot.gallery, map: (d) => [...d].reverse() });
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'people' ? 'people' : 'aircraft';
  const sets = useMemo(() => (data ? splitGallery(data) : null), [data]);
  const items = sets?.[view] ?? [];
  const [open, setOpen] = useState(null);
  const move = (d) => setOpen((i) => (i + d + items.length) % items.length);

  const show = (v) => v !== view && setParams(v === 'aircraft' ? {} : { view: v }, { replace: true, preventScrollReset: true });
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
        <Tabs view={view} counts={{ aircraft: sets?.aircraft.length ?? 0, people: sets?.people.length ?? 0 }} onChange={show} />
        {loading && (
          <ul role="status" aria-label="Loading photos" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 12 }, (_, i) => <li key={i} className="aspect-[4/3] border border-rule bg-rule/30 animate-pulse" />)}
          </ul>
        )}
        {error && <Failed error={error} retry={reload} />}
        {sets && (
          <div id="gallery-panel" role="tabpanel" aria-labelledby={`tab-${view}`}>
            {!items.length && <p className="text-ink-2 border border-dashed border-rule p-6">No photos here yet.</p>}
            {/* Columns keep every photo at its own shape, nothing cropped. Sizes come from the local copies,
                so the layout is fixed before a photo arrives; a photo newer than the copy assumes 3:2. */}
            <ul key={view} data-reveal="stagger" className="columns-2 md:columns-3 xl:columns-4 gap-3">
              {items.map((g, i) => {
                const [w, h] = dims(g.img) ?? [3, 2];
                return (
                  <li key={g._id} className="mb-3 break-inside-avoid">
                    <button type="button" data-photo={g._id} onClick={(e) => openAt(i, e.currentTarget)} style={{ aspectRatio: `${w} / ${h}` }}
                      className="press block w-full overflow-hidden border border-ink bg-sheet hover:border-signal focus-visible:border-signal"
                      aria-label={`Open photo ${i + 1} of ${items.length}`}>
                      <RemoteImg src={g.img} width={600} sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw" alt="" eager={i < 4} className="size-full object-cover" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
      {open !== null && items[open] && <Viewer items={items} index={open} onClose={close} onMove={move} />}
    </>
  );
}
