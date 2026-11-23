import { Link } from 'react-router';
import { SheetHead } from '../components/Layout';
import { Pic } from '../components/RemoteImg';
import { RECORD } from '../content/achievements';

export default function Events() {
  return (
    <>
      <SheetHead title="Events"><p>Every competition the team has flown, from the first to the latest.</p></SheetHead>

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
