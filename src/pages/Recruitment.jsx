import { Link } from 'react-router';
import { SheetHead } from '../components/Layout';
import { Failed, Loading } from '../components/ui';
import { useApi } from '../lib/api';
import { PARTS } from '../content/aircraft';
import { DO, PROCESS } from '../content/recruitment';

const ROLES = {
  Technical: [
    ['Conceptual Design & Sizing', 'In the Conceptual Design & Sizing phase, we transform innovative ideas into feasible designs by defining key parameters such as dimensions and weight distribution, ensuring our concepts are both creative and viable.'],
    ['3D CAD Modeling', 'During 3D CAD Modeling, we create detailed digital representations of our aircraft using advanced CAD software, refining designs and simulating performance to prepare for fabrication.'],
    ['Fabrication & Testing', 'In the Fabrication & Testing phase, we build our aircraft prototypes and conduct rigorous testing to evaluate performance, stability, and safety, ensuring our final product meets quality benchmarks.'],
  ],
  'Non-Technical': [
    ['Reports & Presentations', 'In Reports & Presentations, we compile and present project data, achievements, and findings, effectively communicating our progress and results to audiences.'],
    ['Sponsorships', 'The Sponsorships team is responsible for seeking and managing partnerships with organizations to secure funding and resources that support our projects and initiatives.'],
    ['Social Media Management', 'Our Social Media Management team engages with the community by creating and sharing content across various platforms, promoting our events and showcasing our achievements.'],
    ['Creative Design', 'In Creative Design, we develop visually appealing materials, including posters and graphics, to enhance our presentations, marketing efforts, and overall club branding.'],
    ['Website Management', 'The Website Management team ensures our online presence is up-to-date and user-friendly, providing information about our projects, events, and team activities to the public.'],
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
      <dt>Exam form link</dt><dd><ScheduleLink href={d.formLink}>Exam form link</ScheduleLink></dd>
      <dt>Project submission</dt><dd className="data text-[0.9375rem]">{d.project}</dd>
      <dt>Results</dt><dd><ScheduleLink href={d.result === '/' ? '/results' : d.result}>Results</ScheduleLink></dd>
    </dl>
  ));
}

export default function Recruitment() {
  return (
    <>
      <SheetHead title={`Recruitment-${new Date().getFullYear()}`}>
        <p>Quatlas Aeromodelling is an exclusive aeromodelling team at Ramaiah Institute of Technology. The team participates in various aeromodelling competitions, including the prestigious SAE Aero Design competition in the USA, where student teams from across India design, build, test, and showcase their innovative aircraft. The designs are judged based on a number of criteria. Quatlas consists of multidisciplinary students working on various subsystems, which are categorized under technical and non-technical roles.</p>
      </SheetHead>

      <section className="wrap section border-b border-rule grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <h2 data-reveal="words" className="wide text-2xl md:text-[1.75rem]">What We Do</h2>
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
        <h2 data-reveal="words" className="wide text-2xl md:text-[1.75rem]">Recruitment Process</h2>
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
        <h2 data-reveal="words" className="wide text-2xl md:text-[1.75rem]">Exam Schedule</h2>
        <div><Schedule /></div>
      </section>

      <section className="wrap section grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <h2 data-reveal="words" className="wide text-2xl md:text-[1.75rem]">Stay Connected</h2>
        <p className="copy text-ink-2">Follow us on our social media channels and check our website for the latest updates and announcements. We look forward to welcoming you to our community of aviation enthusiasts!</p>
      </section>
    </>
  );
}
