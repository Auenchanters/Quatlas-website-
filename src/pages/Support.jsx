import { useState } from 'react';
import { Link } from 'react-router';
import { SheetHead } from '../components/Layout';
import { Img } from '../components/Img';
import { RemoteImg } from '../components/RemoteImg';
import Marquee from '../components/Marquee';
import Roll from '../components/Roll';
import { Field, Submit, useSubmit } from '../components/ui';
import { api, useApi } from '../lib/api';
import { motionAllowed } from '../lib/motion';
import { toast } from '../lib/toast';
import { upiLink } from '../lib/upi';
import sponsors from '../content/sponsors.json';
import snapshot from '../content/snapshot.json';
import { INTRO, CROWDFUNDING, UPI } from '../content/support';

// Official supporters and crowdfunding on one sheet.
const WAYS = sponsors.slice(2, 5);
const host = (link) => link?.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');

// Two rows gliding in opposite directions. Under 8 logos, both rows carry all of them.
const rowsOf = (logos) => (logos.length < 8 ? [logos, [...logos].reverse()] : [logos.filter((_, i) => i % 2 === 0), logos.filter((_, i) => i % 2)]);

function Tile({ s }) {
  return (
    <a href={s.link?.startsWith('http') ? s.link : undefined} target="_blank" rel="noreferrer"
      className="press grid place-items-center h-28 w-56 shrink-0 p-5 bg-[var(--color-plate)] border border-rule hover:border-ink transition-colors">
      <RemoteImg src={s.img} width={320} alt={host(s.link) || 'Supporter'} className="logo max-h-20 max-w-full object-contain" />
    </a>
  );
}

function Supporters() {
  const { data: logos } = useApi('/spslist/items', { initial: snapshot.sponsors, map: (d) => d.filter((s) => s.img?.startsWith('http')) });
  return (
    <section id="supporters" className="section border-b border-rule grid gap-12">
      <div className="wrap flex flex-wrap items-end justify-between gap-4">
        <h2 data-reveal="words" className="display text-[clamp(2rem,4vw,3.5rem)]">Official supporters</h2>
        <p className="data text-ink-2"><Roll value={logos?.length ?? 0} /> partners</p>
      </div>
      {logos?.length > 0 && (
        <div className="grid gap-4">
          {rowsOf(logos).map((row, i) => (
            <Marquee key={i} label={i ? 'Supporters, second row' : 'Supporters'} reverse={i === 1} decorative={i === 1 && logos.length < 8}>
              {row.map((s) => <Tile key={s._id} s={s} />)}
            </Marquee>
          ))}
        </div>
      )}
    </section>
  );
}

function Pay() {
  const copy = async (e) => {
    const b = e.currentTarget;
    try {
      await navigator.clipboard.writeText(UPI.pa);
      toast.success('UPI ID copied');
      if (motionAllowed()) b.animate([{ scale: 1 }, { scale: 1.08 }, { scale: 1 }], { duration: 300, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    } catch {
      toast.error(`Couldn't copy. The UPI ID is ${UPI.pa}`);
    }
  };
  return (
    <div className="grid gap-4 justify-items-start">
      <Img name="gpay_qr_code" sizes="320px" alt={`UPI QR code: pays ${UPI.pn}`} className="w-full max-w-xs h-auto border border-ink" />
      <p className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="data text-ink-2">UPI ID</span>
        <span className="font-mono break-all">{UPI.pa}</span>
        <button type="button" className="btn btn-sm" onClick={copy}>Copy</button>
      </p>
      {/* On a phone you can't scan your own screen: open the UPI app directly. */}
      <a href={upiLink(UPI)} className="btn btn-signal hidden pointer-coarse:inline-flex">Pay with a UPI app</a>
    </div>
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
    <section id="crowdfunding" className="wrap section grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start">
      <div className="grid gap-6">
        <h2 data-reveal="words" className="display text-[clamp(2rem,4vw,3.5rem)]">{CROWDFUNDING.heading}</h2>
        <p data-reveal="up" className="text-ink-2 max-w-md">{CROWDFUNDING.text}</p>
        <Pay />
      </div>
      <form data-reveal="up" onSubmit={submit} className="grid gap-5 border-t border-ink pt-6">
        <p className="text-ink-2">{CROWDFUNDING.after}</p>
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
      <SheetHead title="Support"><p>{INTRO}</p></SheetHead>
      <Supporters />
      <section className="wrap section border-b border-rule">
        <h2 data-reveal="words" className="display text-[clamp(2rem,4vw,3.5rem)]">Three ways to sponsor</h2>
        <ol data-reveal="stagger" className="mt-12 grid gap-10 lg:grid-cols-3">
          {WAYS.map((w, i) => (
            <li key={w.heading} className="border-t border-ink pt-5 grid gap-3 content-start">
              <p className="data text-signal">Way {i + 1} of 3</p>
              <h3 className="wide text-xl">{w.heading}</h3>
              <p className="text-ink-2">{w.blocks[0].text}</p>
            </li>
          ))}
        </ol>
        <Link to="/contact?type=Sponsorship" className="btn btn-signal mt-12">Talk to us about sponsoring</Link>
      </section>
      <Crowdfunding />
    </>
  );
}
