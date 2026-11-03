import { useState } from 'react';
import { Copy, SheetHead } from '../components/Layout';
import { Img } from '../components/Img';
import { Field, Submit, useSubmit } from '../components/ui';
import { api } from '../lib/api';
import content from '../content/crowdfunding.json';

export default function Crowdfunding() {
  const empty = { name: '', email: '', mobile: '' };
  const [f, setF] = useState(empty);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const [submit, busy] = useSubmit(async () => {
    const res = await api('/form/addsp', { method: 'POST', body: f });
    setF(empty);
    return res;
  });
  const [intro, ...rest] = content;
  return (
    <>
      <SheetHead title="Crowdfunding"><p>{intro.blocks[0].text}</p></SheetHead>
      <Copy sections={rest} />
      <section id="upi" className="wrap py-12 md:py-16 grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start">
        <div className="grid gap-4">
          <h2 className="display text-4xl md:text-5xl">Pay Using Upi</h2>
          <Img name="gpay_qr_code" sizes="320px" alt="UPI QR code for paying Quatlas" className="w-full max-w-xs h-auto border border-ink bg-white p-3" />
        </div>
        <form onSubmit={submit} className="grid gap-5 border-t border-ink pt-6">
          <p className="text-ink-2">After you pay, leave your details so the team can thank you and keep you updated.</p>
          <Field label="Name" name="name" required autoComplete="name" value={f.name} onChange={set('name')} />
          <Field label="Email" name="email" type="email" required autoComplete="email" value={f.email} onChange={set('email')} />
          <Field label="Contact Number" name="mobile" type="tel" required autoComplete="tel" value={f.mobile} onChange={set('mobile')} />
          <Submit busy={busy}>Submit</Submit>
        </form>
      </section>
    </>
  );
}
