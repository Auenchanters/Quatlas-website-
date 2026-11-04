import { Link, useParams } from 'react-router';
import { SheetHead } from '../components/Layout';
import { Person } from '../components/ui';
import { Arrow } from '../components/icons';
import { SUBTEAMS, membersOf, useTeams } from '../content/teams';
import NotFound from './NotFound';

export default function Subteam() {
  const { slug } = useParams();
  const i = SUBTEAMS.findIndex((s) => s.slug === slug);
  const { data: teams } = useTeams();
  if (i < 0) return <NotFound />;
  const s = SUBTEAMS[i];
  const next = SUBTEAMS[(i + 1) % SUBTEAMS.length];
  const people = teams ? membersOf(teams, s) : [];
  const leads = people.filter((p) => /lead|head/i.test(p.role ?? ''));
  const rest = people.filter((p) => !leads.includes(p));
  return (
    <>
      <SheetHead title={s.name}><p>{s.about}</p></SheetHead>
      <section className="wrap py-12 md:py-16 border-b border-rule grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <h2 className="wide text-2xl">What we do</h2>
        <ul className="grid sm:grid-cols-2 border-t border-l border-rule">
          {s.work.map((w, n) => (
            <li key={w} className="border-r border-b border-rule p-4 grid gap-1">
              <span className="data text-signal">{String(n + 1).padStart(2, '0')}</span>{w}
            </li>
          ))}
        </ul>
      </section>
      <section className="wrap py-12 md:py-16 grid gap-10">
        <h2 className="display text-4xl md:text-5xl">The team</h2>
        {!people.length && <p className="text-ink-2">Members are being added.</p>}
        {leads.length > 0 && (
          <ul className="grid gap-x-5 gap-y-10 grid-cols-2 md:grid-cols-3 md:max-w-4xl">
            {leads.map((p) => <li key={p._id ?? p.name}><Person p={p} big sizes="(min-width: 768px) 28vw, 46vw" /></li>)}
          </ul>
        )}
        {rest.length > 0 && (
          <ul className="grid gap-x-5 gap-y-10 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {rest.map((p) => <li key={p._id ?? p.name}><Person p={p} /></li>)}
          </ul>
        )}
      </section>
      <nav aria-label="Subteams" className="wrap py-10 border-t border-ink flex flex-wrap items-center justify-between gap-4">
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {SUBTEAMS.map((t) => <li key={t.slug}><Link to={`/team/${t.slug}`} aria-current={t.slug === slug ? 'page' : undefined} className={`wide text-sm no-underline ${t.slug === slug ? 'text-signal' : 'hover:text-signal'}`}>{t.name}</Link></li>)}
        </ul>
        <Link to={`/team/${next.slug}`} className="btn btn-sm">Next: {next.name} <Arrow size={16} /></Link>
      </nav>
    </>
  );
}
