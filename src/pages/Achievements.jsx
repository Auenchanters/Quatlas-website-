import { SheetHead } from '../components/Layout';
import { Img } from '../components/Img';
import { PhotoStrip } from '../components/ui';
import { RECORD } from '../content/achievements';

export default function Achievements() {
  return (
    <>
      <SheetHead title="Iconic Achievements" />
      {RECORD.map((r, n) => (
        <section key={r.year} aria-labelledby={`y${r.year}`} className="wrap py-12 md:py-16 border-b border-rule grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="grid gap-5 content-start">
            <h2 id={`y${r.year}`} className="display text-6xl md:text-7xl text-signal">{r.year}</h2>
            {r.title && <p className="wide text-2xl">{r.title}</p>}
            <ul className="copy">{r.points.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
          <div className="grid gap-2 content-start min-w-0">
            {r.photos.length > 1 ? (
              <PhotoStrip label={`Photos from ${r.year}`}>
                {r.photos.map((p, i) => (
                  <Img key={p} name={p} sizes="(min-width: 1024px) 34vw, 80vw" alt={`${r.title ?? r.year}, photo ${i + 1} of ${r.photos.length}`}
                    className="h-72 md:h-96 w-auto max-w-[85%] object-cover border border-ink" />
                ))}
              </PhotoStrip>
            ) : (
              <Img name={r.photos[0]} eager={n === 0} sizes="(min-width: 1024px) 55vw, 100vw" alt={r.caption ?? `${r.year} photo`} className="w-full h-auto border border-ink" />
            )}
            {r.caption && <p className="data text-ink-2">{r.caption}</p>}
          </div>
        </section>
      ))}
    </>
  );
}
