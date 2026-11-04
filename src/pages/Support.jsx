import { useState } from 'react';
import { Link } from 'react-router';
import { SheetHead } from '../components/Layout';
import { Img } from '../components/Img';
import { RemoteImg } from '../components/RemoteImg';
import { Field, Submit, useSubmit } from '../components/ui';
import { Arrow } from '../components/icons';
import { api, useApi } from '../lib/api';
import sponsors from '../content/sponsors.json';
import snapshot from '../content/snapshot.json';

// Official supporters and crowdfunding on one sheet. Logos sit in a still grid, never a ticker.
const WAYS = sponsors.slice(2, 5);
const host = (link) => link?.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');

function Supporters() {
  const { data: logos } = useApi('/spslist/items', { initial: snapshot.sponsors, map: (d) => d.filter((s) => s.img?.startsWith('http')) });
  return (
    <section id="supporters" className="wrap py-12 md:py-16 border-b border-rule grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="display text-4xl md:text-5xl">Official Supporters</h2>
        <p className="data text-ink-2">{logos?.length ?? 0} partners</p>
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 border-t border-l border-rule">
        {logos?.map((s) => (
          <li key={s._id} className="border-r border-b border-rule">
            <a href={s.link?.startsWith('http') ? s.link : undefined} target="_blank" rel="noreferrer"
              className="group grid grid-rows-[1fr_auto] h-44 no-underline">
              <span className="grid place-items-center p-6 bg-white">
                <RemoteImg src={s.img} width={320} alt={host(s.link) || 'Supporter'} className="logo max-h-24 max-w-full object-contain" />
              </span>
              <span className="data text-ink-2 px-3 py-2 border-t border-rule truncate group-hover:text-signal">{host(s.link) || 'Supporter'}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Crowdfunding() {
  const empty = { name: '', email: '', mobile: '' };
  const [f, setF] = useState(empty);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const [submit, busy] = useSubmit(async () => {
    const res = await api('/form/addsp', { method: 'POST', body: f });
    setF(empty);
    return res;
  });
  return (
    <section id="crowdfunding" className="wrap py-12 md:py-16 grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start">
      <div className="grid gap-5">
        <h2 className="display text-4xl md:text-5xl">Crowdfunding</h2>
        <p className="text-ink-2 max-w-md">Every rupee goes into the aircraft and the trip to competition: balsa and carbon, motors and batteries, registration and travel. Scan to pay over UPI, any amount.</p>
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
  );
}

export default function Support() {
  return (
    <>
      <SheetHead title="Support">
        <p>Quatlas is built by students and paid for by people who believe in it. Sponsor the team with parts, money or services, or chip in directly.</p>
      </SheetHead>
      <Supporters />
      <section className="wrap py-12 md:py-16 border-b border-rule">
        <h2 className="wide text-2xl md:text-[1.75rem]">Three ways to sponsor</h2>
        <ol className="mt-10 grid gap-10 lg:grid-cols-3">
          {WAYS.map((w, i) => (
            <li key={w.heading} className="border-t border-ink pt-5 grid gap-3 content-start">
              <p className="data text-signal">Way {i + 1} of 3</p>
              <h3 className="wide text-xl">{w.heading}</h3>
              <p className="text-ink-2">{w.blocks[0].text}</p>
            </li>
          ))}
        </ol>
        <Link to="/contact?type=Sponsorship" className="btn btn-signal mt-10">Talk to us about sponsoring <Arrow size={18} /></Link>
      </section>
      <Crowdfunding />
    </>
  );
}
