import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { SheetHead } from '../components/Layout';
import { Field, Submit, useSubmit } from '../components/ui';
import { api } from '../lib/api';

function Lookup() {
  const navigate = useNavigate();
  const [usn, setUsn] = useState('');
  const [error, setError] = useState('');
  const [submit, busy] = useSubmit(async () => {
    setError('');
    try {
      const res = await api('/results/check', { method: 'POST', body: { usn: usn.trim().toUpperCase() } });
      if (res.msg === 'Usn not found!!') return setError('We couldn’t find that USN. Check it and try again.');
      navigate('/resultPage', { state: { resultData: res } });
    } catch (e) {
      setError(e.message);
    }
  });
  return (
    <>
      <SheetHead title="Recruitment results">
        <p>Enter your USN in this format: 1MS22ME002-T. If something looks wrong, contact the captain.</p>
      </SheetHead>
      <section className="wrap section">
        <form onSubmit={submit} className="grid gap-4 max-w-md">
          <Field label="USN" name="usn" required value={usn} onChange={(e) => setUsn(e.target.value)} placeholder="1MS22ME002-T"
            className="[&_.input]:data [&_.input]:text-base [&_.input]:uppercase" aria-invalid={!!error} aria-describedby={error ? 'usn-error' : undefined} />
          {error && <p id="usn-error" role="alert" className="text-signal-ink">{error}</p>}
          <Submit busy={busy} className="btn btn-signal justify-self-start">Search</Submit>
        </form>
      </section>
    </>
  );
}

function Result() {
  const r = useLocation().state?.resultData;
  if (!r) return <Navigate to="/results" replace />;
  const selected = r.status?.toLowerCase() === 'selected';
  return (
    <>
      <SheetHead title={selected ? 'Congratulations' : 'Result'} />
      <section className="wrap section grid gap-6 justify-items-start">
        <p className="copy text-xl">
          {selected
            ? `${r.name} (${r.usn}), you’re through to the interview round for ${r.role}. Your test score is ${r.score}. We’ll announce interview dates and times soon.`
            : 'You haven’t been selected for an interview this time. Thank you for applying.'}
        </p>
        <Link to="/results" className="btn">Search another USN</Link>
      </section>
    </>
  );
}

export default function Results({ result }) {
  return result ? <Result /> : <Lookup />;
}
