import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import Aircraft from '../components/Aircraft';
import { Img } from '../components/Img';
import Marquee from '../components/Marquee';
import PhotoWall from '../components/PhotoWall';
import Roll from '../components/Roll';
import { RECORD, FIRST_YEAR, LATEST_YEAR } from '../content/achievements';
import { OVERVIEW } from '../content/overview';
import { UPCOMING, when } from '../content/events';
import { HERO, QUOTES, PATHS, LOGOS, WALL, COUNTS } from '../content/home';
import { homeStats } from '../content/stats';

function Quotes() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % QUOTES.length), 3800);
    return () => clearInterval(t);
  }, []);
  return (
    <p className="text-base md:text-lg text-ink-2 min-h-[2lh] md:min-h-[1lh]" aria-live="off">
      <span key={i} className="inline-block animate-[quote_700ms_var(--ease-out-expo)]">{QUOTES[i]}</span>
    </p>
  );
}

function Stats() {
  return (
    <section aria-label="Quatlas in numbers" className="border-y border-ink">
      <dl className="wrap grid grid-cols-2 lg:grid-cols-4">
        {homeStats(RECORD, COUNTS).map((s, i) => (
          <div key={s.label} className={`py-8 md:py-10 pr-4 grid gap-3 content-start border-rule ${i % 2 ? 'pl-4 md:pl-6 border-l' : ''} ${i > 1 ? 'border-t lg:border-t-0' : ''} ${i === 2 ? 'lg:border-l lg:pl-6' : ''}`}>
            <dt className="data text-ink-2 order-2">{s.label}{s.note && <span className="block mt-1 text-signal">{s.note}</span>}</dt>
            <dd className="display text-[clamp(2.5rem,5vw,4.25rem)] order-1"><Roll value={s.value} suffix={s.suffix} /></dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function Home() {
  return (
    <>
      {/* First screen: the aircraft, big and centred, with the club's name under it. */}
      <section aria-label="The Quatlas 012" className="px-3 md:px-5 pt-3">
        <div data-reveal="up">
          <Aircraft hero>
            <h1 className="display text-center text-balance text-[clamp(1.75rem,4.2vw,3.75rem)] px-4 py-[clamp(0.75rem,2vh,1.5rem)] border-t border-ink">{HERO.place}</h1>
          </Aircraft>
        </div>
      </section>

      <section className="wrap py-[clamp(2.5rem,5vw,4rem)]">
        <div className="grid gap-3 max-w-3xl">
          <p data-reveal="up" className="data text-signal">{HERO.label}</p>
          <h2 data-reveal="words" className="display text-[clamp(1.75rem,3.2vw,2.5rem)]">{HERO.title.join(' ')}</h2>
          <div data-reveal="up"><Quotes /></div>
        </div>
      </section>

      <Stats />

      <section className="wrap section grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <h2 data-reveal="words" className="display text-[clamp(2rem,4vw,3.5rem)]">Club overview</h2>
        <div data-reveal="up" className="copy text-[1.0625rem]">
          <p>{OVERVIEW[0]}</p>
          <p><Link to="/about">More about the club</Link></p>
        </div>
      </section>

      <section aria-labelledby="next" className="wrap pb-[clamp(5rem,10vw,9rem)] grid gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-4">
          <h2 id="next" data-reveal="words" className="display text-[clamp(2rem,4vw,3.5rem)]">Upcoming</h2>
          <Link to="/events" className="wide text-sm inline-flex items-center gap-2 hover:text-signal">All events</Link>
        </div>
        <ul data-reveal="stagger" className="grid gap-8 md:grid-cols-3">
          {UPCOMING.map((e) => (
            <li key={e.title} className="grid gap-1 content-start">
              <p className="data text-signal">{when(e.date)}</p>
              <p className="wide text-lg">{e.title}</p>
              <p className="text-ink-2 text-[0.9375rem]">{e.place}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="wall" className="wrap pb-[clamp(5rem,10vw,9rem)] grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] items-center">
        <div className="grid gap-5 content-center">
          <h2 id="wall" data-reveal="words" className="display text-[clamp(2rem,4vw,3.5rem)]">{WALL.title}</h2>
          <p data-reveal="up" className="text-lg text-ink-2 max-w-md">{WALL.text}</p>
          <Link to="/gallery" className="btn justify-self-start">See the gallery</Link>
        </div>
        <PhotoWall photos={WALL.photos} />
      </section>

      <section className="border-y border-ink bg-sheet">
        <div className="wrap section grid gap-12 lg:grid-cols-2 items-start">
          <div>
            <h2 data-reveal="words" className="display text-[clamp(2rem,4vw,3.5rem)]">The record, {FIRST_YEAR} to {LATEST_YEAR}</h2>
            <table className="mt-10 w-full text-left">
              <tbody data-reveal="stagger">
                {RECORD.map((r) => (
                  <tr key={r.year} className="border-b border-rule align-baseline">
                    <th scope="row" className="wide text-signal text-xl py-4 pr-6 w-20"><Roll value={r.year} /></th>
                    <td className="py-4">{r.title && <span className="font-[650]">{r.title}: </span>}{r.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Link to="/achievements" className="btn mt-10">All achievements</Link>
          </div>
          <div data-reveal="image">
            <Img name="quatlas-05" sizes="(min-width: 1024px) 40vw, 100vw" alt="The red-and-white Quatlas aircraft, tail number 038, climbing out over a grass field." className="w-full h-auto border border-ink" />
          </div>
        </div>
      </section>

      <section className="wrap section">
        <ul data-reveal="stagger" className="border-t border-ink">
          {PATHS.map(([to, title, text]) => (
            <li key={to} className="border-b border-rule">
              <Link to={to} className="group grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_auto] gap-3 lg:gap-10 py-10 no-underline items-baseline">
                <h3 className="display text-[clamp(1.875rem,3.3vw,2.75rem)] group-hover:text-signal transition-colors">{title}</h3>
                <p className="text-ink-2 max-w-xl">{text}</p>
                <span className="wide text-sm inline-flex items-center gap-2 group-hover:text-signal">Learn more</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Supporters" className="pb-[clamp(5rem,10vw,9rem)] grid gap-8">
        <p className="wrap data text-ink-2">Supported by</p>
        <Marquee label="Supporters">
          {LOGOS.map(([name, alt]) => (
            <span key={name} className="logo-tile grid place-items-center h-28 w-56 shrink-0 p-5">
              <Img name={name} alt={alt} sizes="200px" className="logo max-h-20 w-auto max-w-full object-contain" />
            </span>
          ))}
        </Marquee>
      </section>
    </>
  );
}
