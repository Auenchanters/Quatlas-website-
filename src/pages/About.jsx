import { SheetHead } from '../components/Layout';
import { Img } from '../components/Img';
import { Failed, Loading, People } from '../components/ui';
import { useApi } from '../lib/api';
import about from '../content/about.json';

export default function About() {
  const { data: teams, error, loading, reload } = useApi('/members/memberData', {
    map: (d) => d[0].teams.filter((t) => t.roleName.toLowerCase() !== 'alumini'),
  });
  const [lede, ...rest] = about[0].blocks;
  return (
    <>
      <SheetHead title="About"><p>{lede.text}</p></SheetHead>
      <section className="wrap py-12 md:py-16 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-start">
        <div className="copy">{rest.map((b, i) => <p key={i}>{b.text}</p>)}</div>
        <Img name="groupPhoto" sizes="(min-width: 1024px) 45vw, 100vw" alt="The Quatlas team in team shirts behind their aircraft at an exhibition stall." className="w-full h-auto border border-ink" />
      </section>

      <section id="team" className="wrap py-12 md:py-16 border-t border-rule grid gap-14">
        <h2 className="display text-4xl md:text-5xl">Our Team</h2>
        {loading && <Loading rows={4} label="Loading the team" />}
        {error && <Failed error={error} retry={reload} />}
        {teams?.map((t) => (
          <div key={t.roleName} className="grid gap-6">
            <h3 className="wide text-2xl border-b border-ink pb-3">{t.roleName}-Team</h3>
            <People people={t.roleData} />
          </div>
        ))}
      </section>
    </>
  );
}
