import { Panel } from './AdminLayout';
import { AddForm, Crud } from './Crud';
import { api, useApi } from '../lib/api';

export default function Forms() {
  const contact = useApi('/form/condata', { auth: true });
  const funding = useApi('/form/spdata', { auth: true });
  const sponsors = useApi('/spslist/items', { auth: true });
  const auth = { auth: true };
  return (
    <>
      <h1 className="display text-3xl md:text-5xl">Forms &amp; Sponsors</h1>
      <Panel title="Contact Form Data">
        <Crud {...contact} rows={contact.data}
          columns={[{ key: 'name', label: 'Name' }, { key: 'usn', label: 'Usn' }, { key: 'ConNumber', label: 'Contact Number' }, { key: 'message', label: 'Message', wrap: true }, { key: 'createdAtIST', label: 'Date' }]} />
      </Panel>
      <Panel title="Crowdfunding Form Data">
        <Crud {...funding} rows={funding.data}
          columns={[{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'mobile', label: 'Contact Number' }, { key: 'createdAtIST', label: 'Date' }]} />
      </Panel>
      <Panel title="Sponsor">
        <AddForm submitLabel="Add sponsor" fields={[{ key: 'img', label: 'Image link', preview: true }, { key: 'link', label: 'Website link' }]}
          onAdd={async (v) => {
            const res = await api('/spslist/addItems', { method: 'POST', body: v, ...auth });
            await sponsors.reload();
            return res;
          }} />
        <Crud {...sponsors} rows={sponsors.data} empty="No data available!"
          columns={[{ key: 'img', label: 'Image Link', wrap: true, preview: true }, { key: 'link', label: 'Link', wrap: true }]}
          onUpdate={(id, patch) => api(`/spslist/updateItems/${id}`, { method: 'PUT', body: patch, ...auth })}
          onDelete={(id) => api(`/spslist/deleteItems/${id}`, { method: 'DELETE', ...auth })} />
      </Panel>
    </>
  );
}
