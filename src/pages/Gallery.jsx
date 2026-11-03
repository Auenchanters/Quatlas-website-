import { useEffect, useRef, useState } from 'react';
import { SheetHead } from '../components/Layout';
import { RemoteImg, remoteSrc } from '../components/RemoteImg';
import { Failed } from '../components/ui';
import { Chevron, Close } from '../components/icons';
import { useApi } from '../lib/api';

// Full-size view in a native <dialog>: focus trap, Esc and backdrop come with it.
function Viewer({ items, index, onClose, onMove }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  useEffect(() => {
    const key = (e) => { if (e.key === 'ArrowRight') onMove(1); if (e.key === 'ArrowLeft') onMove(-1); };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [onMove]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && ref.current.close()}
      className="m-auto max-w-none max-h-none w-screen h-dvh bg-[#0b0d12]/95 text-[#f2f3ef] backdrop:bg-transparent p-0">
      <div className="h-full grid grid-rows-[auto_1fr] p-3 md:p-6 gap-3">
        <div className="flex items-center justify-between">
          <p className="data">{index + 1} / {items.length}</p>
          <button className="btn btn-sm border-[#f2f3ef] hover:bg-[#f2f3ef] hover:text-[#0b0d12]" onClick={() => ref.current.close()} aria-label="Close"><Close size={18} /></button>
        </div>
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 min-h-0">
          <button className="btn btn-sm border-[#f2f3ef] hover:bg-[#f2f3ef] hover:text-[#0b0d12]" onClick={() => onMove(-1)} aria-label="Previous photo"><Chevron className="rotate-180" size={18} /></button>
          <img src={remoteSrc(items[index].img, 1600)} alt={`Gallery photo ${index + 1}`} className="max-h-full max-w-full m-auto object-contain" />
          <button className="btn btn-sm border-[#f2f3ef] hover:bg-[#f2f3ef] hover:text-[#0b0d12]" onClick={() => onMove(1)} aria-label="Next photo"><Chevron size={18} /></button>
        </div>
      </div>
    </dialog>
  );
}

export default function Gallery() {
  const { data, error, loading, reload } = useApi('/gallery/images', { map: (d) => [...d].reverse() });
  const [open, setOpen] = useState(null);
  const move = (d) => setOpen((i) => (i + d + data.length) % data.length);
  return (
    <>
      <SheetHead title="Gallery" />
      <section className="wrap py-12 md:py-16">
        {loading && (
          <ul role="status" aria-label="Loading photos" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 12 }, (_, i) => <li key={i} className="aspect-[4/3] border border-rule bg-rule/30 animate-pulse" />)}
          </ul>
        )}
        {error && <Failed error={error} retry={reload} />}
        {data && (
          // Fixed-ratio cells: photos arrive from OneDrive with unknown sizes, so nothing reflows as they land.
          <ul className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {data.map((g, i) => (
              <li key={g._id} className="[content-visibility:auto] [contain-intrinsic-size:auto_12rem]">
                <button type="button" onClick={() => setOpen(i)} className="block w-full aspect-[4/3] overflow-hidden border border-ink bg-sheet hover:border-signal"
                  aria-label={`Open photo ${i + 1} of ${data.length}`}>
                  <RemoteImg src={g.img} width={600} sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw" alt="" eager={i < 4} className="size-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {open !== null && <Viewer items={data} index={open} onClose={() => setOpen(null)} onMove={move} />}
    </>
  );
}
