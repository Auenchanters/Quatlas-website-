import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Panel } from './AdminLayout';
import { Field, Submit, useSubmit } from '../components/ui';
import { Otp } from '../pages/Auth';
import { api, session } from '../lib/api';

const auth = { auth: true };

function Overview() {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(session.get('name') ?? '');
  const [save, saving] = useSubmit(async () => {
    const res = await api(`/auth/updateUsername/${session.get('id')}`, { method: 'PUT', body: { NewName: name.trim() }, ...auth });
    session.set({ name: res.username });
    setEditing(false);
    return res;
  });
  const [remove, removing] = useSubmit(async () => {
    if (!confirm('Delete your account? You will be signed out and this can’t be undone.')) return;
    const res = await api(`/auth/deleteAccount/${session.get('id')}`, { method: 'DELETE', ...auth });
    session.clear();
    navigate('/');
    return res;
  });
  const row = 'grid sm:grid-cols-[10rem_1fr_auto] gap-3 items-center py-4 border-b border-rule';
  return (
    <Panel title="Personal Info">
      <div>
        <form className={row} onSubmit={save}>
          <span className="font-[650]">Name</span>
          {editing
            ? <input aria-label="Name" className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            : <span>{session.get('name')}</span>}
          {editing
            ? <span className="flex gap-2"><button className="btn btn-sm btn-signal" disabled={saving}>Save</button><button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>Cancel</button></span>
            : <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>Update</button>}
        </form>
        <div className={row}><span className="font-[650]">Email</span><span className="break-all">{session.get('email')}</span><Link to="/updateEmail" className="btn btn-sm">Update</Link></div>
        <div className={row}><span className="font-[650]">Password</span><span aria-label="hidden">•••••••••</span><Link to="/updatePassword" className="btn btn-sm">Update</Link></div>
      </div>
      <button className="btn btn-danger justify-self-start" onClick={remove} disabled={removing}>Delete Account</button>
    </Panel>
  );
}

// Email and password changes both send an OTP, then confirm it on /verify.
function Change({ kind }) {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const email = kind === 'email';
  const [submit, busy] = useSubmit(async () => {
    const res = await api(`/auth/otpverification/${session.get('id')}`, { method: 'POST', ...auth,
      body: email ? { NewEmail: value, NewPassword: '', Purpose: 'email-change' } : { NewEmail: '', NewPassword: value, Purpose: 'password-reset' } });
    navigate('/verify');
    return res;
  });
  return (
    <Panel title={email ? 'Email' : 'Password'}>
      <p className="text-ink-2 max-w-lg">{email ? 'You’ll use this email to receive messages, sign in, and recover your account.' : 'You’ll use this password to sign in, and recover your account.'}</p>
      <form onSubmit={submit} className="grid gap-4 max-w-md">
        <Field label={email ? 'New email' : 'New password'} type={email ? 'email' : 'password'} required autoComplete={email ? 'email' : 'new-password'}
          value={value} onChange={(e) => setValue(e.target.value)} />
        <p className="text-sm text-ink-2">{email ? 'A verification code will be sent to this email' : 'A verification code will be sent to registered email for updating password'}</p>
        <Submit busy={busy} className="btn btn-signal justify-self-start">Update</Submit>
      </form>
    </Panel>
  );
}

function Verify() {
  const navigate = useNavigate();
  return (
    <Panel title="OTP Verification">
      <div className="max-w-md">
        <Otp onVerify={async (userotp) => {
          const res = await api(`/auth/updateEmailOrPassword/${session.get('id')}`, { method: 'PUT', body: { userotp }, ...auth });
          navigate('/Data');
          return res;
        }} />
      </div>
    </Panel>
  );
}

export default function Account({ view }) {
  if (view === 'email') return <Change kind="email" />;
  if (view === 'password') return <Change kind="password" />;
  if (view === 'verify') return <Verify />;
  return <Overview />;
}
