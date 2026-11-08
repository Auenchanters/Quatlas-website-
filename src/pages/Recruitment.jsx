import { Link } from 'react-router';
import { SheetHead } from '../components/Layout';
import { Failed, Loading } from '../components/ui';
import { useApi } from '../lib/api';
import { PARTS } from '../content/aircraft';
import { DO, PROCESS } from '../content/recruitment';

const ROLES = {
  Technical: [
    ['Conceptual design and sizing', 'Turn an idea into a design that can fly: set the size and how the weight is spread.'],
    ['3D CAD modelling', 'Model the aircraft in CAD, refine it and simulate how it performs before anything is built.'],
    ['Fabrication and testing', 'Build the prototypes and test them for performance, stability and safety.'],
  ],
  'Non-Technical': [
    ['Reports and presentations', 'Write up the team’s design and results, and present them.'],
    ['Sponsorships', 'Find sponsors and look after them, so the team has the money and parts it needs.'],
    ['Social media', 'Post about our builds, events and results.'],
    ['Creative design', 'Make the posters and graphics for presentations, campaigns and the club’s look.'],
    ['Website', 'Keep this site current with our projects, events and team.'],
  ],
};

// Internal links stay in the app; "/" or blank means the link isn't published yet.
function ScheduleLink({ href, children }) {
  if (!href || href === '/') return <span className="text-ink-2">To be announced</span>;
  return href.startsWith('/')
    ? <Link to={href} className="btn btn-sm">{children}</Link>
    : <a href={href} target="_blank" rel="noreferrer" className="btn btn-sm btn-signal">{children}</a>;
}

function Schedule() {
  const { data, error, loading, reload } = useApi('/recruit/getDates');
  if (loading) return <Loading rows={4} label="Loading the exam schedule" />;
  if (error) return <Failed error={error} retry={reload} />;
  return data.map((d) => (
    <dl key={d._id} className="grid sm:grid-cols-[14rem_1fr] border-t border-ink [&>dt]:py-4 [&>dd]:py-4 [&>dt]:font-[650] [&>dd]:border-b [&>dt]:sm:border-b [&>*]:border-rule">
      <dt>Exam date and time</dt><dd className="data text-[0.9375rem]">{d.date} &amp; {d.time}</dd>
      <dt>Exam form</dt><dd><ScheduleLink href={d.formLink}>Open the form</ScheduleLink></dd>
      <dt>Project submission</dt><dd className="data text-[0.9375rem]">{d.project}</dd>
      <dt>Results</dt><dd><ScheduleLink href={d.result === '/' ? '/results' : d.result}>Results</ScheduleLink></dd>
    </dl>
  ));
}

export default function Recruitment() {
  return (
    <>
      <SheetHead title={`Recruitment ${new Date().getFullYear()}`}>
        <p>Quatlas is the aeromodelling team of Ramaiah Institute of Technology. We design, build and test aircraft for competitions like SAE Aero Design in the USA, where teams are judged on their design report, presentation and flights. Students from every branch join us, in technical and non-technical roles.</p>
      </SheetHead>

      <section className="wrap section border-b border-rule grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <h2 data-reveal="words" className="wide text-2xl md:text-[1.75rem]">What you’ll do</h2>
        <dl className="grid gap-6">
          {DO.map(([t, d]) => <div key={t}><dt className="font-[650]">{t}</dt><dd className="text-ink-2 mt-1">{d}</dd></div>)}
        </dl>
      </section>

      <section className="wrap section border-b border-rule grid gap-10">
        <h2 data-reveal="words" className="display text-[clamp(2rem,4vw,3.5rem)]">Roles</h2>
        <div className="grid gap-12 lg:grid-cols-2">
          {Object.entries(ROLES).map(([group, roles]) => (
            <div key={group}>
              <h3 className="wide text-xl border-b border-ink pb-3">{group}</h3>
              <dl>
                {roles.map(([t, d]) => (
                  <div key={t} className="py-4 border-b border-rule">
                    <dt className="font-[650]">{t}</dt><dd className="text-ink-2 mt-1">{d}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        <p className="text-ink-2 max-w-2xl">
          Every technical role works on the same aircraft: {Object.values(PARTS).map((p) => p.name.toLowerCase()).join(', ')}. <Link to="/" className="text-signal">See the drawing</Link>.
        </p>
      </section>

      <section className="wrap section border-b border-rule grid gap-8">
        <h2 data-reveal="words" className="wide text-2xl md:text-[1.75rem]">How selection works</h2>
        <ol className="grid gap-8 md:grid-cols-3">
          {PROCESS.map(([t, d], i) => (
            <li key={t} className="border-t border-ink pt-4">
              <p className="data text-signal">Step {i + 1}</p>
              <p className="wide text-xl mt-2">{t}</p>
              <p className="text-ink-2 mt-2">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="wrap section border-b border-rule grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <h2 data-reveal="words" className="wide text-2xl md:text-[1.75rem]">Exam schedule</h2>
        <div><Schedule /></div>
      </section>

      <section className="wrap section grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <h2 data-reveal="words" className="wide text-2xl md:text-[1.75rem]">Stay in touch</h2>
        <p className="copy text-ink-2">Follow our socials and check back here for exam dates and results.</p>
      </section>
    </>
  );
}
