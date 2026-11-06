import { useState } from 'react';
import { ImgCheck, linkProblem } from './Crud';
import { RemoteImg } from '../components/RemoteImg';
import { Field, useSubmit } from '../components/ui';
import { api } from '../lib/api';

// The live server won't add a member without a LinkedIn link, so anyone without their own gets the club's page.
export const CLUB_LINKEDIN = 'https://www.linkedin.com/company/quatlas-aeromodelling';
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
