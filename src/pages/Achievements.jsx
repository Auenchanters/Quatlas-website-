import { SheetHead } from '../components/Layout';
import { Pic, widthAt } from '../components/RemoteImg';
import Roll from '../components/Roll';
import { PhotoStrip } from '../components/ui';
import { RECORD, FIRST_YEAR } from '../content/achievements';

// Every competition as a vertical timeline: a rail with a dot per year, newest first.
export default function Achievements() {
  return (
    <>
      <SheetHead title="Achievements"><p>Every competition since the team’s first entry in {FIRST_YEAR}.</p></SheetHead>
      <ol className="wrap section grid gap-[clamp(4rem,8vw,7rem)]">
        {RECORD.map((r, n) => (
          <li key={r.year} aria-labelledby={`y${r.year}`}
            className="relative pl-8 md:pl-14 grid gap-8 scroll-mt-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] before:absolute before:left-[5px] md:before:left-[11px] before:top-3 before:-bottom-[clamp(4rem,8vw,7rem)] before:w-px before:bg-rule last:before:bottom-0">
            <span aria-hidden="true" className="absolute left-0 md:left-1.5 top-3 size-[11px] rounded-full bg-signal ring-4 ring-paper" />
            <div className="grid gap-5 content-start">
              <h2 id={`y${r.year}`} className="display text-signal text-[clamp(3.5rem,7vw,5.5rem)] leading-none"><Roll value={r.year} /></h2>
              {r.title && <p data-reveal="words" className="wide text-2xl">{r.title}</p>}
              <ul data-reveal="stagger" className="copy">{r.points.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
            {r.photos?.length > 0 && (
              <div className="grid gap-2 content-start min-w-0">
                {r.photos.length > 1 ? (
                  <PhotoStrip label={`Photos from ${r.year}`}>
                    {r.photos.map((p, i) => (
                      <div key={p} data-reveal="image" className="max-w-[85%]">
                        <Pic name={p} sizes={widthAt(p, 384) ? `(min-width: 768px) ${widthAt(p, 384)}px, ${widthAt(p, 288)}px` : '(min-width: 1024px) 34vw, 80vw'} alt={`${r.title ?? r.year}, photo ${i + 1} of ${r.photos.length}`}
                          className="h-72 md:h-96 w-auto object-cover border border-ink" />
                      </div>
                    ))}
                  </PhotoStrip>
                ) : (
                  <div data-reveal="image">
                    <Pic name={r.photos[0]} eager={n === 0} sizes="(min-width: 1024px) 55vw, 100vw" alt={r.caption ?? `${r.year} photo`} className="w-full h-auto border border-ink" />
                  </div>
                )}
                {r.caption && <p className="data text-ink-2">{r.caption}</p>}
              </div>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}
