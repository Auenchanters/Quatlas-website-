import { Link } from 'react-router';
import { SheetHead } from '../components/Layout';
import { Img } from '../components/Img';
import { Failed, Person, PhotoStrip } from '../components/ui';
import { SUBTEAMS, byRole, isAlumni, isCore, membersOf, subteamOf, useTeams } from '../content/teams';

// A subteam's people as a strip you scroll through (not an auto-ticker).
function Strip({ people, label }) {
  if (!people.length) return <p className="text-ink-2 border border-dashed border-rule p-6">Members are being added.</p>;
  return (
    <PhotoStrip label={label}>
      {people.map((p) => <div key={p._id ?? p.name} className="w-[46%] sm:w-[30%] lg:w-[19%]"><Person p={p} sizes="(min-width: 1024px) 19vw, (min-width: 640px) 30vw, 46vw" /></div>)}
    </PhotoStrip>
  );
}

export default function Team() {
  const { data: teams, error, reload } = useTeams();
  const core = byRole(teams?.filter((t) => isCore(t.roleName)).flatMap((t) => t.roleData) ?? []);
  const lead = core.slice(0, 3);
  // Teams in the data that match no subteam still show, so nobody disappears.
  const other = teams?.filter((t) => !isCore(t.roleName) && !isAlumni(t.roleName) && !subteamOf(t.roleName)) ?? [];
  return (
    <>
      <SheetHead title="Our Team">
        <p>Students from every branch at Ramaiah, organised the way an aircraft is: one core team and five subteams that each own a part of the build.</p>
      </SheetHead>

      <figure className="wrap pt-12">
        <Img name="groupPhoto" eager sizes="(min-width: 1280px) 1200px, 100vw" alt="The Quatlas team in team shirts behind their aircraft at an exhibition stall." className="w-full h-auto border border-ink" />
        <figcaption className="data text-ink-2 mt-2">The team, with the aircraft</figcaption>
      </figure>

      {error && !teams && <div className="wrap py-10"><Failed error={error} retry={reload} /></div>}

      <section aria-labelledby="core" className="wrap py-12 md:py-16 border-b border-rule grid gap-10">
        <h2 id="core" className="display text-4xl md:text-5xl">Core Team</h2>
        <ul className="grid gap-x-5 gap-y-10 grid-cols-2 md:grid-cols-3 md:max-w-4xl">
          {lead.map((p) => <li key={p._id ?? p.name}><Person p={p} big sizes="(min-width: 768px) 28vw, 46vw" /></li>)}
        </ul>
        {core.length > 3 && (
          <ul className="grid gap-x-5 gap-y-10 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {core.slice(3).map((p) => <li key={p._id ?? p.name}><Person p={p} /></li>)}
          </ul>
        )}
      </section>

      {SUBTEAMS.map((s) => (
        <section key={s.slug} aria-labelledby={s.slug} className="wrap py-12 md:py-16 border-b border-rule grid gap-6">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-baseline">
            <h2 id={s.slug} className="display text-3xl md:text-4xl">{s.name}</h2>
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <p className="text-ink-2 max-w-xl">{s.about}</p>
              <Link to={`/team/${s.slug}`} className="wide text-sm inline-flex items-center gap-2 hover:text-signal">Meet {s.name}</Link>
            </div>
          </div>
          <Strip people={teams ? membersOf(teams, s) : []} label={`${s.name} members`} />
        </section>
      ))}

      {other.map((t) => (
        <section key={t.roleName} className="wrap py-12 md:py-16 border-b border-rule grid gap-6">
          <h2 className="display text-3xl md:text-4xl">{t.roleName}</h2>
          <Strip people={byRole(t.roleData)} label={`${t.roleName} members`} />
        </section>
      ))}

      <section className="wrap py-12 md:py-16 flex flex-wrap items-center justify-between gap-6">
        <p className="wide text-2xl md:text-3xl">The people who flew before us</p>
        <Link to="/alumini" className="btn">Alumni</Link>
      </section>
    </>
  );
}
