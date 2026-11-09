import { Link } from 'react-router';
import { SheetHead } from '../components/Layout';
import { Img } from '../components/Img';
import { RECORD } from '../content/achievements';
import { OVERVIEW } from '../content/overview';
import about from '../content/about.json';

const FACULTY = {
  name: 'Dr. Gururaj Lalagi', role: 'Faculty advisor', dept: 'Department of Mechanical Engineering',
  text: 'Teaches applied thermodynamics, heat transfer, automotive engineering and electric vehicle technology. His research covers heat exchangers, IC engines, biodiesel and CFD.',
  profile: 'https://www.msrit.edu/department/faculty-detail.html?dept=me&ID=44',
};

// The club's history as a pilot's logbook: one line per season, oldest first.
function Logbook() {
  const rows = [...RECORD].sort((a, b) => a.year - b.year);
  return (
    <div tabIndex={0} role="region" aria-label="Club history" className="overflow-x-auto border border-ink">
      <table className="table md:min-w-[40rem]">
        <caption className="sr-only">Club history, one season per row</caption>
        <thead><tr><th>Season</th><th>Aircraft / event</th><th>Logged</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.year}>
              <td className="data text-signal">{r.year}</td>
              <td className="wide">{r.event ?? r.title ?? 'SAE Aero Design'}</td>
              <td>{r.points[0]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function About() {
  const [lede, second] = about[0].blocks;
  return (
    <>
      <SheetHead title="About"><p>{lede.text}</p></SheetHead>
      {/* The photo centred across the page, the write-up under it (as on the team pages). */}
      <section className="wrap section grid gap-10">
        <Img name="event-orientation" eager sizes="(min-width: 1280px) 1200px, 100vw" alt="The Quatlas team on an auditorium stage, two members kneeling behind the aircraft." className="w-full h-auto border border-ink" />
        <div className="grid gap-6 max-w-3xl">
          <h2 data-reveal="words" className="wide text-2xl md:text-[1.75rem]">Club overview</h2>
          <div data-reveal="up" className="copy">{OVERVIEW.map((t) => <p key={t}>{t}</p>)}<p>{second.text}</p></div>
        </div>
      </section>

      <section id="history" className="wrap section border-t border-rule grid gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 data-reveal="words" className="display text-[clamp(2rem,4vw,3.5rem)]">Logbook</h2>
          <Link to="/achievements" className="wide text-sm inline-flex items-center gap-2 hover:text-signal">Full record</Link>
        </div>
        <Logbook />
      </section>

      <section id="faculty" className="wrap section border-t border-rule grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <h2 data-reveal="words" className="display text-[clamp(2rem,4vw,3.5rem)]">Faculty</h2>
        <div className="border-t border-ink pt-5 grid gap-2 content-start">
          <p className="data text-signal">{FACULTY.role}</p>
          <p className="wide text-2xl">{FACULTY.name}</p>
          <p className="text-ink-2">{FACULTY.dept}, Ramaiah Institute of Technology</p>
          <p className="max-w-2xl mt-2">{FACULTY.text}</p>
          <a href={FACULTY.profile} target="_blank" rel="noreferrer" className="btn btn-sm justify-self-start mt-3">Faculty profile</a>
        </div>
      </section>

      <section id="team" className="wrap section border-t border-rule flex flex-wrap items-center justify-between gap-6">
        <p className="wide text-2xl md:text-3xl">Meet the people behind the aircraft</p>
        <Link to="/team" className="btn btn-signal">Our team</Link>
      </section>
    </>
  );
}
