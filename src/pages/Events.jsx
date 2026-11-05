import { Link } from 'react-router';
import { SheetHead } from '../components/Layout';
import { Pic } from '../components/RemoteImg';
import { RECORD } from '../content/achievements';
import { UPCOMING, when } from '../content/events';

export default function Events() {
  return (
    <>
      <SheetHead title="Events"><p>What the team is building towards next, and every competition it has already flown.</p></SheetHead>

      <section aria-labelledby="upcoming" className="wrap section border-b border-rule grid gap-8">
        <h2 data-reveal="words" id="upcoming" className="display text-[clamp(2rem,4vw,3.5rem)]">Upcoming</h2>
        <ol className="border-t border-ink">
          {UPCOMING.map((e) => (
            <li key={e.title} className="border-b border-rule py-6 grid gap-3 md:grid-cols-[12rem_minmax(0,1fr)_auto] md:gap-8 items-baseline">
              <p className="data text-signal">{when(e.date)}</p>
              <div className="grid gap-1">
                <h3 className="wide text-xl">{e.title}</h3>
                <p className="text-ink-2 max-w-2xl">{e.text}</p>
                <p className="data text-ink-2 text-sm">{e.place}</p>
              </div>
              {e.link && (e.link[0].startsWith('http')
                ? <a href={e.link[0]} target="_blank" rel="noreferrer" className="btn btn-sm justify-self-start">{e.link[1]}</a>
                : <Link to={e.link[0]} className="btn btn-sm justify-self-start">{e.link[1]}</Link>)}
            </li>
          ))}
        </ol>
      </section>

      <section id="past" aria-labelledby="past-h" className="wrap section grid gap-8">
        <h2 data-reveal="words" id="past-h" className="display text-[clamp(2rem,4vw,3.5rem)]">Past competitions</h2>
        <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {RECORD.map((r) => (
            <li key={r.year}>
              <Link to={`/achievements#y${r.year}`} className="group grid gap-3 no-underline">
                {r.photos?.[0] && <Pic name={r.photos[0]} sizes="(min-width: 1024px) 30vw, (min-width: 640px) 46vw, 100vw" alt="" className="w-full aspect-[3/2] object-cover border border-ink group-hover:border-signal" />}
                <p className="data text-signal">{r.year}</p>
                <p className="wide text-lg group-hover:text-signal">{r.title ?? 'SAE Aero Design'}</p>
                <p className="text-ink-2">{r.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
