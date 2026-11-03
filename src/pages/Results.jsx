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
      if (res.msg === 'Usn not found!!') return setError(res.msg);
      navigate('/resultPage', { state: { resultData: res } });
    } catch (e) {
      setError(e.message);
    }
  });
  return (
    <>
      <SheetHead title="Quatlas Results">
        <p>For example, use the USN 1MS22ME002-T to search for results, and if any issues arise, please contact the captain for assistance.</p>
      </SheetHead>
      <section className="wrap py-12 md:py-16">
        <form onSubmit={submit} className="grid gap-4 max-w-md">
          <Field label="USN" name="usn" required value={usn} onChange={(e) => setUsn(e.target.value)} placeholder="Enter your usn"
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
      <section className="wrap py-12 md:py-16 grid gap-6 justify-items-start">
        <p className="copy text-xl">
          {selected
            ? `${r.name}(${r.usn}) you are selected for an interview round for the Quatlas Aeromodelling team in the role of ${r.role} and your test score is ${r.score}. Interview timings and dates will be announced shortly.`
            : 'Sorry to inform you that you have not been selected for an interview'}
        </p>
        <Link to="/results" className="btn">Search another USN</Link>
      </section>
    </>
  );
}

export default function Results({ result }) {
  return result ? <Result /> : <Lookup />;
}
