import { useState } from 'react';
import { ImgCheck, linkProblem } from './Crud';
import { RemoteImg } from '../components/RemoteImg';
import { Field, useSubmit } from '../components/ui';
import { api } from '../lib/api';
import { isAlumni } from '../content/teams';
import { TEAMS as ROSTER } from '../content/roster';
import manifest from '../content/images.json';

// The site's own address: roster photos are stored in the database as links to the copies the site
// already serves, so they work from any page and RemoteImg treats them as local photos.
export const SITE = 'https://quatlas-website.vercel.app';
const photoLink = (name) => {
  const m = manifest[name];
  return m ? `${SITE}/img/${name}-${m.widths.find((w) => w >= 960) ?? m.widths.at(-1)}.webp` : '';
};
const initials = (n = '') => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const FIELDS = [['name', 'Name'], ['role', 'Role'], ['img', 'Photo link'], ['linkedin', 'LinkedIn link (optional)']];

// One member as a card: photo, name, role, LinkedIn, with Update (edit in place) and Delete.
function Card({ m, reload }) {
  const [draft, setDraft] = useState(null);
  const [save, saving] = useSubmit(async () => {
    const patch = Object.fromEntries(FIELDS.map(([k]) => [k, draft[k]?.trim()]).filter(([k, v]) => v !== undefined && v !== (m[k] ?? '') && (v || k === 'linkedin')));
    if (!Object.keys(patch).length) { setDraft(null); return; }
    if (patch.img && !/^https?:\/\//.test(patch.img)) throw new Error(`Photo link: ${linkProblem(patch.img)}`);
    await api(`/members/updateMember/${m._id}`, { method: 'PUT', auth: true, body: patch });
    setDraft(null);
    await reload();
    return { msg: `${patch.name ?? m.name} updated.` };
  });
  const [remove, removing] = useSubmit(async () => {
    if (!confirm(`Delete “${m.name}”? This can’t be undone.`)) return;
    await api(`/members/deleteMember/${m._id}`, { method: 'DELETE', auth: true });
    await reload();
    return { msg: `${m.name} deleted.` };
  });

  return (
    <li className="grid content-start gap-3 border border-rule bg-paper rounded-[var(--radius-photo)] p-3">
      <div className="aspect-[4/5] overflow-hidden rounded-[var(--radius-photo)] border border-rule bg-sheet">
        <RemoteImg src={draft?.img?.trim() || m.img} width={320} sizes="240px" alt={m.name} className="size-full object-cover object-top"
          placeholder={<span aria-hidden="true" className="size-full grid place-items-center display text-3xl text-ink-2">{initials(m.name)}</span>} />
      </div>
      {draft ? (
        <form onSubmit={save} className="grid gap-3">
          {FIELDS.map(([k, label]) => (
            <div key={k} className="grid gap-2">
              <Field label={label} value={draft[k] ?? ''} required={k === 'name' || k === 'role'} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
              {k === 'img' && <ImgCheck url={draft.img?.trim()} />}
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-sm btn-signal" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" className="btn btn-sm" onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <div className="grid gap-0.5">
            <p className="font-[650] leading-tight">{m.name}</p>
            <p className="text-sm text-ink-2">{m.role}</p>
            {m.linkedin
              ? <a href={m.linkedin} target="_blank" rel="noreferrer" className="text-sm text-signal truncate">LinkedIn</a>
              : <span className="text-sm text-ink-2">No LinkedIn</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-sm" onClick={() => setDraft(Object.fromEntries(FIELDS.map(([k]) => [k, m[k] ?? ''])))}>Update</button>
            <button className="btn btn-sm btn-danger" onClick={remove} disabled={removing}>Delete</button>
          </div>
        </>
      )}
    </li>
  );
}

// A team's members as a grid of photo cards.
export function MemberCards({ team, reload }) {
  if (!team.roleData.length) return <p className="text-ink-2">No members in this team.</p>;
  return (
    <ul className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      {team.roleData.map((m) => <Card key={m._id} m={m} reload={reload} />)}
    </ul>
  );
}

// Compares the database with the club's roster sheet (src/content/roster.js) and, on request,
// replaces every current (non-alumni) member in the database with the roster, photos included.
const key = (team, p) => `${team.trim().toLowerCase()}|${p.name.trim().toLowerCase()}|${(p.role ?? '').trim().toLowerCase()}`;
export function RosterSync({ teams, reload }) {
  const [progress, setProgress] = useState('');
  const current = teams.filter((t) => !isAlumni(t.roleName));
  const inDb = new Set(current.flatMap((t) => t.roleData.map((p) => key(t.roleName, p))));
  const wanted = ROSTER.flatMap((t) => t.roleData.map((p) => ({ roleName: t.roleName, ...p })));
  const missing = wanted.filter((p) => !inDb.has(key(p.roleName, p)));
  const extra = current.flatMap((t) => t.roleData.filter((p) => !wanted.some((w) => key(w.roleName, w) === key(t.roleName, p))).map((p) => ({ ...p, roleName: t.roleName })));
  const people = new Set(wanted.map((p) => p.name)).size;

  const [run, running] = useSubmit(async () => {
    const old = current.flatMap((t) => t.roleData);
    if (!confirm(`Replace the current team in the database?\n\nThis deletes ${old.length} current members (Alumini stays as it is) and adds the ${wanted.length} roster entries (${people} people) with their photos. It can’t be undone.`)) return;
    let step = '';
    const say = (s) => { step = s; setProgress(s); };
    try {
      for (const [i, m] of old.entries()) { say(`Removing ${i + 1} of ${old.length}: ${m.name}`); await api(`/members/deleteMember/${m._id}`, { method: 'DELETE', auth: true }); }
      for (const [i, p] of wanted.entries()) {
        say(`Adding ${i + 1} of ${wanted.length}: ${p.name} (${p.roleName})`);
        await api('/members/addMember', { method: 'POST', auth: true, body: { roleName: p.roleName, name: p.name, role: p.role, img: photoLink(p.img), linkedin: p.linkedin ?? '' } });
      }
    } catch (e) {
      // Whatever was done stays done; running it again starts from the database as it now is.
      throw new Error(`Stopped while ${step.toLowerCase()}: ${e.message} Press the button again to finish.`);
    } finally {
      setProgress(''); await reload();
    }
    return { msg: `Done: the database now holds the roster’s ${wanted.length} entries.` };
  });

  if (!missing.length && !extra.length) return <p className="text-ink-2">The database matches the roster sheet: {people} people across {ROSTER.length} teams.</p>;
  return (
    <div className="grid gap-4 border border-rule bg-sheet rounded-[var(--radius-photo)] p-4">
      <p>
        The database differs from the club’s roster sheet: <strong>{missing.length}</strong> roster {missing.length === 1 ? 'entry is' : 'entries are'} missing
        and <strong>{extra.length}</strong> current {extra.length === 1 ? 'member is' : 'members are'} not on the sheet.
        Replacing loads the roster ({people} people in {ROSTER.length} teams) with the new photos; Alumini is left as it is.
      </p>
      <details className="text-sm text-ink-2">
        <summary className="cursor-pointer">Show the differences</summary>
        <div className="grid gap-3 mt-3 sm:grid-cols-2">
          <div><p className="font-[650] text-ink">Not in the database yet</p><ul>{missing.map((p) => <li key={key(p.roleName, p)}>{p.name}, {p.role} ({p.roleName})</li>)}</ul></div>
          <div><p className="font-[650] text-ink">Would be removed</p><ul>{extra.map((p) => <li key={p._id}>{p.name}, {p.role} ({p.roleName})</li>)}</ul></div>
        </div>
      </details>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-signal" onClick={run} disabled={running}>{running ? 'Working…' : 'Replace the current team with the roster'}</button>
        {progress && <p className="data text-ink-2" aria-live="polite">{progress}</p>}
      </div>
    </div>
  );
}
