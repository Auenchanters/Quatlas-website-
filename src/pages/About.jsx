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
    <div className="overflow-x-auto border border-ink">
      <table className="table min-w-[40rem]">
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
      <section className="wrap py-12 md:py-16 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-start">
        <div className="grid gap-6">
          <h2 className="wide text-2xl md:text-[1.75rem]">Club overview</h2>
          <div className="copy">{OVERVIEW.map((t) => <p key={t}>{t}</p>)}<p>{second.text}</p></div>
        </div>
        <Img name="groupPhoto" sizes="(min-width: 1024px) 45vw, 100vw" alt="The Quatlas team in team shirts behind their aircraft at an exhibition stall." className="w-full h-auto border border-ink" />
      </section>

      <section id="history" className="wrap py-12 md:py-16 border-t border-rule grid gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="display text-4xl md:text-5xl">Logbook</h2>
          <Link to="/achievements" className="wide text-sm inline-flex items-center gap-2 hover:text-signal">Full record</Link>
        </div>
        <Logbook />
      </section>

      <section id="faculty" className="wrap py-12 md:py-16 border-t border-rule grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <h2 className="display text-4xl md:text-5xl">Faculty</h2>
        <div className="border-t border-ink pt-5 grid gap-2 content-start">
          <p className="data text-signal">{FACULTY.role}</p>
          <p className="wide text-2xl">{FACULTY.name}</p>
          <p className="text-ink-2">{FACULTY.dept}, Ramaiah Institute of Technology</p>
          <p className="max-w-2xl mt-2">{FACULTY.text}</p>
          <a href={FACULTY.profile} target="_blank" rel="noreferrer" className="btn btn-sm justify-self-start mt-3">Faculty profile</a>
        </div>
      </section>

      <section id="team" className="wrap py-12 md:py-16 border-t border-rule flex flex-wrap items-center justify-between gap-6">
        <p className="wide text-2xl md:text-3xl">Meet the people behind the aircraft</p>
        <Link to="/team" className="btn btn-signal">Our team</Link>
      </section>
    </>
  );
}
