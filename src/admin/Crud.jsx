import { useState } from 'react';
import { Field, Loading, Failed, useSubmit } from '../components/ui';

// A list the dashboard can add to, edit in place and delete from.
// columns: [{ key, label, type? }]; onUpdate gets only the fields that changed.
export function Crud({ rows, loading, error, reload, columns, onUpdate, onDelete, empty = 'No record available!', deleteLabel = (r) => r[columns[0].key] }) {
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({});
  const [save, saving] = useSubmit(async () => {
    const patch = Object.fromEntries(columns.map((c) => [c.key, draft[c.key]?.trim()]).filter(([k, v]) => v && v !== rows.find((r) => r._id === editing)[k]));
    if (!Object.keys(patch).length) { setEditing(null); return; }
    const res = await onUpdate(editing, patch);
    setEditing(null);
    await reload();
    return res;
  });
  const [remove] = useSubmit(async (row) => {
    if (!confirm(`Delete “${deleteLabel(row)}”? This can’t be undone.`)) return;
    const res = await onDelete(row._id);
    await reload();
    return res;
  });

  if (loading && !rows) return <Loading rows={3} />;
  if (error) return <Failed error={error} retry={reload} />;
  const actions = onUpdate || onDelete;
  return (
    <div className="overflow-x-auto border border-rule bg-paper">
      <table className="table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}{actions && <th><span className="sr-only">Actions</span></th>}</tr>
        </thead>
        <tbody>
          {!rows?.length ? (
            <tr><td colSpan={columns.length + 1} className="text-ink-2">{empty}</td></tr>
          ) : rows.map((r) => editing === r._id ? (
            <tr key={r._id}>
              {columns.map((c) => (
                <td key={c.key}>
                  <input aria-label={c.label} className="input min-h-9 py-1" type={c.type ?? 'text'} value={draft[c.key] ?? ''}
                    onChange={(e) => setDraft({ ...draft, [c.key]: e.target.value })} />
                </td>
              ))}
              <td className="whitespace-nowrap sticky right-0 bg-paper">
                <button className="btn btn-sm btn-signal" onClick={save} disabled={saving}>Save</button>{' '}
                <button className="btn btn-sm" onClick={() => setEditing(null)}>Cancel</button>
              </td>
            </tr>
          ) : (
            <tr key={r._id}>
              {columns.map((c) => <td key={c.key} className={c.wrap ? 'break-all min-w-48' : ''}>{c.render ? c.render(r) : r[c.key]}</td>)}
              {actions && (
                <td className="whitespace-nowrap sticky right-0 bg-paper shadow-[-8px_0_8px_-8px_rgb(22_24_27/0.25)]">
                  {onUpdate && <button className="btn btn-sm" onClick={() => { setEditing(r._id); setDraft(Object.fromEntries(columns.map((c) => [c.key, r[c.key] ?? '']))); }}>Update</button>}{' '}
                  {onDelete && <button className="btn btn-sm btn-danger" onClick={() => remove(r)}>Delete</button>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Inline "add" form: fields: [{ key, label, type?, list? }].
export function AddForm({ fields, onAdd, submitLabel = 'Submit', hint }) {
  const blank = Object.fromEntries(fields.map((f) => [f.key, '']));
  const [v, setV] = useState(blank);
  const [submit, busy] = useSubmit(async () => {
    const res = await onAdd(v);
    setV(blank);
    return res;
  });
  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-end border border-rule bg-sheet p-4">
      {fields.map((f) => (
        <Field key={f.key} label={f.label} type={f.type ?? 'text'} required={f.required !== false} list={f.list}
          value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
      ))}
      <button type="submit" className="btn btn-signal" disabled={busy} aria-busy={busy}>{busy ? 'Saving…' : submitLabel}</button>
      {hint && <p className="text-sm text-ink-2 sm:col-span-2 lg:col-span-3">{hint}</p>}
    </form>
  );
}
