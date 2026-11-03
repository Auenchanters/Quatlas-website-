import { Panel } from './AdminLayout';
import { AddForm, Crud } from './Crud';
import { Failed, Loading } from '../components/ui';
import { api, useApi } from '../lib/api';

export default function Team() {
  const teams = useApi('/teams/list', { auth: true, map: (d) => d.data[0]?.teams ?? [] });
  const auth = { auth: true };
  return (
    <>
      <h1 className="display text-3xl md:text-5xl">Team Data</h1>
      <Panel title="Add a recruit">
        <AddForm fields={[{ key: 'year', label: 'Year' }, { key: 'name', label: 'Name' }, { key: 'usn', label: 'Usn' }, { key: 'role', label: 'Role' }, { key: 'phoneNumber', label: 'Phone number', type: 'tel' }]}
          onAdd={async (v) => {
            const res = await api('/teams/add', { method: 'POST', body: v, ...auth });
            await teams.reload();
            return res;
          }} />
      </Panel>
      {teams.loading && !teams.data && <Loading rows={3} />}
      {teams.error && <Failed error={teams.error} retry={teams.reload} />}
      {teams.data?.map((t) => (
        <Panel key={t.year} title={`${t.year}-Batch`}>
          <Crud rows={t.recruitedNames} reload={teams.reload}
            columns={[{ key: 'name', label: 'Name' }, { key: 'usn', label: 'Usn' }, { key: 'role', label: 'Role' }, { key: 'phoneNumber', label: 'Phone Number', type: 'tel' }]}
            onUpdate={(id, patch) => api(`/teams/update/${id}`, { method: 'PUT', body: patch, ...auth })}
            onDelete={(id) => api(`/teams/delete/${id}`, { method: 'DELETE', ...auth })} />
        </Panel>
      ))}
    </>
  );
}
