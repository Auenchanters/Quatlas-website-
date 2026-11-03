import { Panel } from './AdminLayout';
import { AddForm, Crud } from './Crud';
import { api, useApi } from '../lib/api';

export default function Links() {
  const links = useApi('/links/getLinks', { auth: true });
  const auth = { auth: true };
  return (
    <>
      <h1 className="display text-3xl md:text-5xl">Links</h1>
      <Panel title="Add a link">
        <AddForm fields={[{ key: 'name', label: 'Name' }, { key: 'link', label: 'Link', type: 'url' }]}
          onAdd={async (v) => {
            const res = await api('/links/add', { method: 'POST', body: v, ...auth });
            await links.reload();
            return res;
          }} />
      </Panel>
      <Panel title="All Links">
        <Crud {...links} rows={links.data}
          columns={[{ key: 'name', label: 'Name' }, { key: 'link', label: 'Link', wrap: true, render: (r) => <a href={r.link} target="_blank" rel="noreferrer" className="hover:text-signal">{r.link}</a> }]}
          onUpdate={(id, patch) => api(`/links/update/${id}`, { method: 'PUT', body: patch, ...auth })}
          onDelete={(id) => api(`/links/delete/${id}`, { method: 'DELETE', ...auth })} />
      </Panel>
    </>
  );
}
