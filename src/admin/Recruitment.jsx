import { useEffect, useState } from 'react';
import { Panel } from './AdminLayout';
import { Crud } from './Crud';
import { Field, Failed, Loading, useSubmit } from '../components/ui';
import { api, RECRUIT_SHEET, useApi } from '../lib/api';

const auth = { auth: true };
const team = (r) => r['Technical Team'] || r['Non Technical Team'] || 'Not applicable';

// A button that opens a small form in place: used for test link, interview slots, extra member, final mail.
function Action({ label, fields, onRun, danger }) {
  const [open, setOpen] = useState(false);
  const blank = Object.fromEntries(fields.map((f) => [f.key, '']));
  const [v, setV] = useState(blank);
  const [run, busy] = useSubmit(async () => {
    const res = await onRun(v);
    setOpen(false);
    setV(blank);
    return res;
  });
  if (!open) return <button className={`btn btn-sm ${danger ? 'btn-danger' : ''}`} onClick={() => setOpen(true)}>{label}</button>;
  return (
    <form onSubmit={run} className="basis-full grid gap-3 sm:grid-cols-2 lg:grid-cols-3 items-end border border-rule bg-sheet p-4">
      {fields.map((f) => <Field key={f.key} label={f.label} type={f.type ?? 'text'} required={f.required !== false} placeholder={f.placeholder}
        value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />)}
      <div className="flex gap-2">
        <button type="submit" className="btn btn-sm btn-signal" disabled={busy} aria-busy={busy}>{busy ? 'Sending…' : label}</button>
        <button type="button" className="btn btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

function Dates() {
  const dates = useApi('/recruit/getDates', { map: (d) => d.slice(-1) });
  return (
    <Panel title="Recruitment Dates">
      <Crud {...dates} rows={dates.data}
        columns={[{ key: 'date', label: 'Date' }, { key: 'time', label: 'Time' }, { key: 'formLink', label: 'Form Link', wrap: true }, { key: 'project', label: 'Project Deadline Time' }, { key: 'result', label: 'Result Link', wrap: true }]}
        deleteLabel={(r) => `the ${r.date} schedule`}
        onUpdate={(id, patch) => api(`/recruit/updateDates/${id}`, { method: 'PUT', body: patch, ...auth })}
        onDelete={(id) => api(`/recruit/deleteDates/${id}`, { method: 'DELETE', ...auth })} />
    </Panel>
  );
}

function Applications() {
  const sheet = useApi('', { url: RECRUIT_SHEET });
  const [importData, importing] = useSubmit(() => api('/hiring/addData', { method: 'POST', ...auth }));
  return (
    <Panel title={`Recruitment Form Data${sheet.data ? `: ${sheet.data.length} applications` : ''}`}
      actions={<>
        <button className="btn btn-sm" onClick={importData} disabled={importing} aria-busy={importing}>Add data</button>
        <Action label="Send test link" fields={[{ key: 'testLink', label: 'Test link', type: 'url' }]}
          onRun={(v) => api('/hiring/testLink', { method: 'POST', body: v, ...auth }).then((r) => ({ msg: r.msg || 'Test link sent successfully!' }))} />
      </>}>
      <Crud {...sheet} rows={sheet.data?.map((r, i) => ({ _id: i, ...r }))} empty="No records available!"
        columns={[{ key: 'Name', label: 'Name' }, { key: 'Usn', label: 'Usn' }, { key: 'Branch & Semester', label: 'Branch & Semester' }, { key: 'Email', label: 'Email' }, { key: 'Phone Number', label: 'Phone Number' },
          { key: 'Technical Team', label: 'Technical Team', render: (r) => r['Technical Team'] || 'Not applicable' },
          { key: 'Non Technical Team', label: 'Non Technical Team', render: (r) => r['Non Technical Team'] || 'Not applicable' }, { key: 'Are you', label: 'Are you' }]} />
    </Panel>
  );
}

function Interviews() {
  const [state, setState] = useState({ list: null, error: null });
  const load = async () => {
    try {
      const r = await api('/hiring/getschedules', auth);
      setState({ list: r.list[0]?.mails ?? [], error: null });
    } catch (e) {
      setState((s) => ({ list: s.list, error: e.message }));
    }
  };
  // The old dashboard refreshed every 100 s while open; kept.
  useEffect(() => { load(); const t = setInterval(load, 100_000); return () => clearInterval(t); }, []);

  const [mail] = useSubmit((r) => api('/hiring/interviewMails', { method: 'POST', ...auth,
    body: { name: r.Name, mail: r.Email, date: r['Interview Date'], time: r.Time, subsystem: r['Technical Team'] ?? r['Non Technical Team'] ?? 'Not Assigned' } }));
  const [select] = useSubmit(async (r) => {
    const res = await api(`/hiring/updateSelecttion/${r._id}`, { method: 'PUT', ...auth, body: { statusValue: r.Status === 'yes' ? 'no' : 'yes' } });
    await load();
    return res;
  });
  const [wipe, wiping] = useSubmit(async () => {
    if (!confirm('Delete all hiring data? Every application, schedule and selection is removed. This can’t be undone.')) return;
    const res = await api('/hiring/deleteHiringData', { method: 'DELETE', ...auth });
    await load();
    return res;
  });

  const { list, error } = state;
  const selected = list?.filter((r) => r.Status === 'yes') ?? [];
  const scheduled = (r) => !!r['Interview Date'];
  return (
    <>
      <Panel title="Interview Schedules"
        actions={<>
          <Action label="Add Members" fields={[
            { key: 'Name', label: 'Name' }, { key: 'Usn', label: 'USN' }, { key: 'BranchAndSemester', label: 'Branch & Semester' }, { key: 'Email', label: 'Email', type: 'email' },
            { key: 'PhoneNumber', label: 'Phone Number', type: 'tel' }, { key: 'TechnicalTeam', label: 'Technical Team' }, { key: 'NonTechnicalTeam', label: 'Non Technical Team' },
            { key: 'AreYou', label: 'Hosteller / Day Scholar' }, { key: 'Score', label: 'Score', type: 'number' }]}
            onRun={async (v) => { const r = await api('/hiring/addextra', { method: 'POST', body: v, ...auth }); await load(); return r; }} />
          <Action label="Schedule Interviews" fields={[
            { key: 'date', label: 'Interview date', placeholder: 'e.g. 15 Dec 2026' }, { key: 'startTime', label: 'Start time', type: 'time' }, { key: 'endTime', label: 'End time', type: 'time' },
            { key: 'interval', label: 'Minutes per slot', type: 'number', placeholder: '15' }, { key: 'capacity', label: 'Candidates per slot', type: 'number' },
            { key: 'score', label: 'Minimum score to qualify', type: 'number' }]}
            onRun={async (v) => { const r = await api('/hiring/interview', { method: 'POST', body: v, ...auth }); await load(); return r; }} />
          <button className="btn btn-sm btn-danger" onClick={wipe} disabled={wiping}>Delete Data</button>
        </>}>
        {!list && !error && <Loading rows={3} />}
        {error && <Failed error={error} retry={load} />}
        {list && (
          <Crud rows={list} reload={load} columns={[
            { key: 'Name', label: 'Name' }, { key: 'Branch & Semester', label: 'Branch & Semester' }, { key: 'team', label: 'Team', render: team },
            { key: 'Interview Date', label: 'Interview Date', render: (r) => r['Interview Date'] || 'Awaiting scheduling' },
            { key: 'Time', label: 'Interview Time', render: (r) => r.Time || 'Awaiting scheduling' },
            { key: 'actions', label: 'Mail / Select', render: (r) => scheduled(r) ? (
              <span className="flex gap-2">
                <button className="btn btn-sm" onClick={() => mail(r)}>Send Mail</button>
                <button className={`btn btn-sm ${r.Status === 'yes' ? 'btn-signal' : ''}`} aria-pressed={r.Status === 'yes'} onClick={() => select(r)}>
                  {r.Status === 'yes' ? 'Unselect' : 'Select'}
                </button>
              </span>) : <span className="text-ink-2">Awaiting scheduling</span> },
          ]} />
        )}
      </Panel>

      <Panel title={`Final Selection List${selected.length ? `: ${selected.length}` : ''}`}
        actions={<Action label="Send Mail" fields={[{ key: 'groupLink', label: 'Group link', type: 'url' }]}
          onRun={(v) => api('/hiring/finalMail', { method: 'POST', body: v, ...auth })} />}>
        <Crud rows={selected} reload={load} empty="Awaiting selection"
          columns={[{ key: 'Name', label: 'Name' }, { key: 'Branch & Semester', label: 'Branch' }, { key: 'team', label: 'Role', render: team }, { key: 'Email', label: 'Email' }, { key: 'Phone Number', label: 'Phone Number' }]} />
      </Panel>
    </>
  );
}

export default function Recruitment() {
  return (
    <>
      <h1 className="display text-3xl md:text-5xl">Recruitment</h1>
      <Dates />
      <Applications />
      <Interviews />
    </>
  );
}
