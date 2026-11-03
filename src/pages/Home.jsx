import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import Aircraft from '../components/Aircraft';
import { Img } from '../components/Img';
import { Arrow } from '../components/icons';
import { RECORD } from '../content/achievements';

const QUOTES = [
  'Pioneering the skies with precision and passion',
  'Where innovation takes flight',
  'Charting new horizons in aerospace excellence',
  'Innovating the blueprint of tomorrow’s aviation',
];

function Quotes() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % QUOTES.length), 3800);
    return () => clearInterval(t);
  }, []);
  return (
    <p className="text-xl md:text-2xl text-ink-2 min-h-[2lh] md:min-h-[1lh]" aria-live="off">
      <span key={i} className="inline-block animate-[quote_700ms_var(--ease-out-expo)]">{QUOTES[i]}</span>
    </p>
  );
}

const PATHS = [
  ['/about', 'Our Team', 'Embark on an exciting career journey with Quatlas today! Exploring the endless skies, one propeller at a time.'],
  ['/crowdfunding', 'Crowd Funding', 'Support our mission to innovate and create new possibilities in aerospace modeling. Your contribution will help us push the boundaries of technology and design, shaping the future of the industry.'],
  ['/sponsors', 'Official Supporters', 'Join us in pioneering the future of aerospace modeling. Sponsor our project and gain access to unique opportunities and advanced technological insights.'],
];

export default function Home() {
  return (
    <>
      <section className="wrap pt-12 md:pt-20 pb-12 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-end">
        <div className="grid gap-6 @container">
          {/* Sized to the column, not the viewport, so the expanded lettering never overflows. */}
          <h1 className="display leading-[0.92]">
            <span className="block text-[min(15.5cqw,6rem)]">Quatlas</span>
            <span className="block text-[min(8.4cqw,3.25rem)] tracking-[-0.01em]">Aeromodelling</span>
          </h1>
          <p className="wide text-lg">Ramaiah Institute Of Technology</p>
          <Quotes />
          <div className="flex flex-wrap gap-3">
            <Link to="/recruitment" className="btn btn-signal">Join the team <Arrow size={18} /></Link>
            <Link to="/crowdfunding" className="btn">Support the build</Link>
          </div>
        </div>
        <Aircraft />
      </section>

      <section className="wrap py-14 md:py-20 border-t border-rule grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <h2 className="wide text-3xl md:text-4xl">SAE Overview</h2>
        <div className="copy text-[1.0625rem]">
          <p>The SAE Aero Design Competition stands as a pinnacle in the aeromodelling world, epitomizing innovation, engineering prowess, and the thrill of flight. Held annually, it serves as a crucible where aspiring engineers, like those of Quatlas at Ramaiah, forge their passion for aviation into reality. The competition unfolds in various locations, often finding its way to the heart of the American aerospace landscape, with destinations including the likes of Texas or Florida.</p>
          <p>In this high-stakes event, teams are tasked with crafting radio-controlled aircraft to meet precise performance criteria. A symphony of engineering skills is woven into every design: weight optimization, aerodynamic finesse, propulsion efficiency, and structural integrity. Regular, Advanced, and Micro Classes offer distinct challenges, from payload delivery to meeting stringent takeoff and landing requirements. The Design-Build-Fly category adds complexity, with mission profiles evolving each year.</p>
          <p>Participation isn’t merely about winning; it’s a rite of passage where theoretic blueprints gain wings. Collaboration within teams honest leadership and teamwork skills. Exposure to industry experts cultivates a broader understanding of aerospace trends. The SAE Aero Design Competition isn’t just a competition; it’s an odyssey that transcends academia, igniting the fervor for aviation and illuminating the path to engineering excellence. At Quatlas, we invite you to join us on this remarkable journey to the skies.</p>
        </div>
      </section>

      <section className="border-y border-ink bg-sheet">
        <div className="wrap py-14 md:py-20 grid gap-10 lg:grid-cols-2 items-start">
          <div>
            <h2 className="wide text-3xl md:text-4xl">The record, 2015 to 2024</h2>
            <table className="mt-8 w-full text-left">
              <tbody>
                {RECORD.map((r) => (
                  <tr key={r.year} className="border-b border-rule align-baseline">
                    <th scope="row" className="data text-signal py-3 pr-6 font-medium w-16">{r.year}</th>
                    <td className="py-3">{r.title && <span className="font-semibold">{r.title}: </span>}{r.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Link to="/achievements" className="btn mt-8">All achievements <Arrow size={18} /></Link>
          </div>
          <Img name="quatlas-05" sizes="(min-width: 1024px) 40vw, 100vw" alt="The red-and-white Quatlas aircraft, tail number 038, climbing out over a grass field." className="w-full h-auto border border-ink" />
        </div>
      </section>

      <section className="wrap py-14 md:py-20">
        <ul className="border-t border-ink">
          {PATHS.map(([to, title, text]) => (
            <li key={to} className="border-b border-rule">
              <Link to={to} className="group grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_auto] gap-3 lg:gap-10 py-8 no-underline items-baseline">
                <h3 className="display text-[clamp(1.875rem,3.3vw,2.75rem)] group-hover:text-signal transition-colors">{title}</h3>
                <p className="text-ink-2 max-w-xl">{text}</p>
                <span className="wide text-sm inline-flex items-center gap-2 group-hover:text-signal">Learn More <Arrow size={18} /></span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-12 flex flex-wrap items-center gap-x-12 gap-y-6" aria-label="Supporters">
          <Img name="ramaiah" alt="Ramaiah Institute of Technology" sizes="80px" className="logo h-20 w-auto" />
          <Img name="smart" alt="Smart Links Technologies" sizes="160px" className="logo h-14 w-auto" />
          <Img name="sps01" alt="Supporter logo" sizes="120px" className="logo h-14 w-auto" />
          <Img name="dhd" alt="Supporter logo" sizes="160px" className="logo h-14 w-auto" />
        </div>
      </section>
    </>
  );
}
