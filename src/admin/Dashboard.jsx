import { useEffect, useState } from 'react';
import { Panel } from './AdminLayout';
import { AddForm, Crud } from './Crud';
import { Failed, Loading } from '../components/ui';
import { api, session, useApi } from '../lib/api';
import { toast } from '../lib/toast';
import { SUBTEAMS } from '../content/teams';
import { MemberCards, RosterSync } from './Members';

const IMG_HINT = `Photo links: a Google Drive file shared as “Anyone with the link”, a OneDrive embed link ending in ?width=…, or a photo already on the site (https://quatlas-website.vercel.app/img/…). Check the preview: if it says “No image”, the site shows initials instead. The team name decides where a member appears: Core, ${SUBTEAMS.map((t) => t.name).join(', ')}, or Alumini. Someone in two teams is added once per team.`;

const ORDER = ['core', ...SUBTEAMS.map((t) => t.name.toLowerCase())];
const rank = (name) => { const n = name.trim().toLowerCase(), i = ORDER.indexOf(n); return /^alumi?ni$/.test(n) ? 99 : i < 0 ? 50 : i; };

export default function Dashboard() {
  const [welcome, setWelcome] = useState('');
  useEffect(() => {
    api('/auth/dashboard', { auth: true })
      .then((u) => {
        session.set({ name: u.username, email: u.email, id: u.id });
        setWelcome(`Welcome ${u.username}`);
      })
      .catch((e) => toast.error(`${e.message.toUpperCase()} : SIGN IN AGAIN`));
  }, []);

  const members = useApi('/members/memberData', { map: (d) => d[0].teams });
  const gallery = useApi('/gallery/images');
  const auth = { auth: true };

  return (
    <>
      <h1 className="display text-3xl md:text-5xl">{welcome || 'Dashboard'}</h1>

      <Panel title="Add a member">
        <datalist id="team-names">{[...new Set(['Core', ...SUBTEAMS.map((t) => t.name), 'Alumini', ...(members.data?.map((t) => t.roleName) ?? [])])].map((n) => <option key={n} value={n} />)}</datalist>
        <AddForm hint={IMG_HINT}
          fields={[{ key: 'roleName', label: 'Team name', list: 'team-names' }, { key: 'name', label: 'Name' }, { key: 'role', label: 'Role' }, { key: 'img', label: 'Image link', preview: true }, { key: 'linkedin', label: 'LinkedIn link (optional)', required: false }]}
          onAdd={async (v) => {
            await api('/members/addMember', { method: 'POST', auth: true, body: v });
            await members.reload();
            return { msg: `Successfully added ${v.name} to teamInfo data` };
          }} />
      </Panel>

      {members.data && (
        <Panel title="Current team and the roster sheet">
          <RosterSync teams={members.data} reload={members.reload} />
        </Panel>
      )}

      {/* Teams in the site's order (Core, the subteams, anything else, Alumini last); empty ones hidden. */}
      {members.data?.filter((t) => t.roleData.length).sort((a, b) => rank(a.roleName) - rank(b.roleName)).map((t) => (
        <Panel key={t.roleName} title={`${t.roleName} · ${t.roleData.length}`}>
          <MemberCards team={t} reload={members.reload} />
        </Panel>
      ))}
      {members.loading && !members.data && <Loading rows={4} label="Loading members" />}
      {members.error && <Failed error={members.error} retry={members.reload} />}

      <Panel title="Gallery">
        <AddForm submitLabel="Add image" hint={IMG_HINT} fields={[{ key: 'img', label: 'Image link', preview: true }]}
          onAdd={async (v) => {
            await api('/gallery/addImage', { method: 'POST', body: v, ...auth });
            await gallery.reload();
            return { msg: 'Successfully added image' };
          }} />
        <Crud rows={gallery.data} loading={gallery.loading} error={gallery.error} reload={gallery.reload}
          columns={[{ key: 'img', label: 'Image Link', wrap: true, preview: true }]}
          onDelete={(id) => api(`/gallery/delete/${id}`, { method: 'DELETE', ...auth }).then(() => ({ msg: 'Successfully deleted image.' }))} />
      </Panel>
    </>
  );
}
