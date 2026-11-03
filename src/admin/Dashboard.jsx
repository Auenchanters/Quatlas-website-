import { useEffect, useState } from 'react';
import { Panel } from './AdminLayout';
import { AddForm, Crud } from './Crud';
import { Failed, Loading } from '../components/ui';
import { api, session, useApi } from '../lib/api';
import { toast } from '../lib/toast';

const IMG_HINT = 'Image links: use a direct image link (Google Drive “/file/d/…” links or OneDrive embed links with ?width=). OneDrive share links ending in ?e=… open a web page, not an image, and show up blank.';

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
        <datalist id="team-names">{members.data?.map((t) => <option key={t.roleName} value={t.roleName} />)}</datalist>
        <AddForm hint={IMG_HINT}
          fields={[{ key: 'roleName', label: 'Team name', list: 'team-names' }, { key: 'name', label: 'Name' }, { key: 'role', label: 'Role' }, { key: 'img', label: 'Image link' }, { key: 'linkedin', label: 'LinkedIn link' }]}
          onAdd={async (v) => {
            await api('/members/addMember', { method: 'POST', auth: true, body: v });
            await members.reload();
            return { msg: `Successfully added ${v.name} to teamInfo data` };
          }} />
      </Panel>

      {members.data?.map((t) => (
        <Panel key={t.roleName} title={t.roleName}>
          <Crud rows={t.roleData} reload={members.reload}
            columns={[{ key: 'name', label: 'Name' }, { key: 'role', label: 'Role' }, { key: 'img', label: 'Image Link', wrap: true }, { key: 'linkedin', label: 'Linkedin Link', wrap: true }]}
            onUpdate={(id, patch) => api(`/members/updateMember/${id}`, { method: 'PUT', body: patch, ...auth }).then(() => ({ msg: 'Member updated.' }))}
            onDelete={(id) => api(`/members/deleteMember/${id}`, { method: 'DELETE', ...auth }).then(() => ({ msg: 'Successfully deleted data.' }))} />
        </Panel>
      ))}
      {members.loading && !members.data && <Loading rows={4} label="Loading members" />}
      {members.error && <Failed error={members.error} retry={members.reload} />}

      <Panel title="Gallery">
        <AddForm submitLabel="Add image" hint={IMG_HINT} fields={[{ key: 'img', label: 'Image link' }]}
          onAdd={async (v) => {
            await api('/gallery/addImage', { method: 'POST', body: v, ...auth });
            await gallery.reload();
            return { msg: 'Successfully added image' };
          }} />
        <Crud rows={gallery.data} loading={gallery.loading} error={gallery.error} reload={gallery.reload}
          columns={[{ key: 'img', label: 'Image Link', wrap: true }]}
          onDelete={(id) => api(`/gallery/delete/${id}`, { method: 'DELETE', ...auth }).then(() => ({ msg: 'Successfully deleted image.' }))} />
      </Panel>
    </>
  );
}
