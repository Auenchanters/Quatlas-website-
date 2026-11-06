import { Link } from 'react-router';
import { SheetGrid, SheetHead } from '../components/Layout';
import { Img } from '../components/Img';
import Roll from '../components/Roll';
import { Person, PhotoStrip } from '../components/ui';
import { TEAM_INTRO, TILES, SUBTEAMS, byRole, isAlumni, isCore, membersOf, subteamOf, useTeams } from '../content/teams';
import { TEAMS } from '../content/roster';

// A team's people as a strip you scroll through (not an auto-ticker).
function Strip({ people, label }) {
  if (!people.length) return <p className="text-ink-2 border border-dashed border-rule p-6">Members are being added.</p>;
  return (
    <PhotoStrip label={label}>
      {people.map((p) => <div key={p._id ?? p.name} className="w-[46%] sm:w-[30%] lg:w-[19%]"><Person p={p} sizes="(min-width: 1024px) 19vw, (min-width: 640px) 30vw, 46vw" /></div>)}
    </PhotoStrip>
  );
}

// Alumni from the dashboard, everyone else from the roster.
const countOf = (dashboard, slug) => {
  if (slug !== 'alumni') return membersOf(TEAMS, SUBTEAMS.find((s) => s.slug === slug)).length;
  return dashboard?.filter((t) => isAlumni(t.roleName)).reduce((n, t) => n + t.roleData.length, 0) ?? 0;
};

// One big button per subteam. The name carries over into the team page's title (view transition).
function Tile({ tile, n, count }) {
  return (
    <li>
      <Link to={tile.to} className="press group grid h-full overflow-hidden rounded-[var(--radius-photo)] border border-ink no-underline hover:border-signal">
        <span className="relative aspect-[16/10] overflow-hidden border-b border-ink bg-sheet">
          {/* Part 2 puts each team's live background here. */}
          <SheetGrid className="transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-105" />
          <span className="absolute left-4 top-4 data text-ink-2">Fig. {String(n + 1).padStart(2, '0')}</span>
        </span>
        <span className="flex items-end justify-between gap-4 p-5">
          <span className="display text-[clamp(1.75rem,3vw,2.5rem)] group-hover:text-signal transition-colors" style={{ viewTransitionName: `team-${tile.slug}` }}>{tile.name}</span>
          <span className="data text-ink-2 text-right"><Roll value={count} /><span className="block">{tile.slug === 'alumni' ? 'alumni' : 'members'}</span></span>
        </span>
      </Link>
    </li>
  );
}

export default function Team() {
  const { data: dashboard } = useTeams();
  const core = byRole(TEAMS.filter((t) => isCore(t.roleName)).flatMap((t) => t.roleData));
  const lead = core.slice(0, 2); // captain and vice-captain
  // Roster teams that match no subteam still show, so nobody disappears.
  const other = TEAMS.filter((t) => !isCore(t.roleName) && !subteamOf(t.roleName));
  return (
    <>
      <SheetHead title="Our team"><p>{TEAM_INTRO}</p></SheetHead>

      <figure data-reveal="image" className="wrap pt-12">
        <Img name="event-team-seated" eager sizes="(min-width: 1280px) 1200px, 100vw" alt="The Quatlas team seated together in the stands at an event, wearing event lanyards." className="w-full h-auto border border-ink" />
        <figcaption className="data text-ink-2 mt-2">The team</figcaption>
      </figure>

      <section aria-labelledby="core" className="wrap section border-b border-rule grid gap-10">
        <h2 id="core" data-reveal="words" className="display text-[clamp(2rem,4vw,3.5rem)]">Core team</h2>
        <ul data-reveal="stagger" className="grid gap-x-5 gap-y-10 grid-cols-2 md:max-w-3xl">
          {lead.map((p) => <li key={p._id ?? p.name}><Person p={p} big sizes="(min-width: 768px) 28vw, 46vw" /></li>)}
        </ul>
        {core.length > 3 && (
          <ul data-reveal="stagger" className="grid gap-x-5 gap-y-10 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {core.slice(3).map((p) => <li key={p._id ?? p.name}><Person p={p} /></li>)}
          </ul>
        )}
      </section>

      <section aria-labelledby="subteams" className="wrap section grid gap-10">
        <h2 id="subteams" data-reveal="words" className="display text-[clamp(2rem,4vw,3.5rem)]">Subteams</h2>
        <ul data-reveal="stagger" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TILES.map((t, n) => <Tile key={t.slug} tile={t} n={n} count={countOf(dashboard, t.slug)} />)}
        </ul>
      </section>

      {other.map((t) => (
        <section key={t.roleName} className="wrap section border-t border-rule grid gap-6">
          <h2 data-reveal="words" className="display text-[clamp(2rem,4vw,3.5rem)]">{t.roleName}</h2>
          <Strip people={byRole(t.roleData)} label={`${t.roleName} members`} />
        </section>
      ))}
    </>
  );
}
