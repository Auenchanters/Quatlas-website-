import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { SheetHead, MAP_URL } from '../components/Layout';
import { Field, Submit, useSubmit } from '../components/ui';
import { api } from '../lib/api';
import { PEOPLE, TYPES, FAQ } from '../content/contact';

const MAP_EMBED = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3887.0835259698624!2d77.562613474846!3d13.030352813587932!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bae170e309db333%3A0x42bc025a603938d4!2sQuatlas%20Aeromodelling!5e0!3m2!1sen!2sin!4v1718769975645!5m2!1sen!2sin';


// Requests are saved to the dashboard (Forms) and also emailed to the club inbox through FormSubmit.
// FormSubmit's first email to this inbox is an activation link; until someone clicks it, requests
// still reach the dashboard. Set VITE_INBOX to an empty string to switch the email off.
const INBOX = import.meta.env.VITE_INBOX ?? (import.meta.env.MODE === 'mock' ? '' : 'aeromodellingquatlas@gmail.com');


// The map is a 700 KB embed; it loads only when asked for.
function Map() {
  const [show, setShow] = useState(false);
  return show ? (
    <iframe title="Map of Quatlas Aeromodelling, Ramaiah Institute of Technology" src={MAP_EMBED} className="w-full aspect-[4/3] border border-ink" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
  ) : (
    <div className="aspect-[4/3] border border-ink bg-sheet grid place-content-center gap-3 justify-items-center p-6 text-center">
      <p className="text-ink-2">Ramaiah Institute of Technology, Mathikere, Bengaluru</p>
      <div className="flex flex-wrap gap-2 justify-center">
        <button type="button" className="btn btn-sm" onClick={() => setShow(true)}>Show map here</button>
        <a href={MAP_URL} target="_blank" rel="noreferrer" className="btn btn-sm">Open in Google Maps</a>
      </div>
    </div>
  );
}

// Best effort: the dashboard copy is the record, so a failed email never fails the request.
const email = (f) => fetch(`https://formsubmit.co/ajax/${INBOX}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({ _subject: `Quatlas website: ${f.type} from ${f.name}`, _template: 'table', _captcha: 'false', ...f }),
}).catch(() => {});

export default function Contact() {
  const [params] = useSearchParams();
  const asked = params.get('type');
  const empty = { type: TYPES.includes(asked) ? asked : TYPES[0], name: '', email: '', ConNumber: '', usn: '', message: '' };
  const [f, setF] = useState(empty);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const [submit, busy] = useSubmit(async () => {
    // The dashboard stores name, usn, number and message; the type and email ride in the message.
    const res = await api('/form/addcon', { method: 'POST', body: {
      name: f.name, usn: f.usn || '-', ConNumber: f.ConNumber, message: `[${f.type}] ${f.email}\n\n${f.message}`,
    } });
    if (INBOX) email(f);
    setF({ ...empty, type: f.type });
    return res;
  });
  return (
    <>
      <SheetHead title="Contact Us">
        <p>Sponsors, students, press or anyone curious about the aircraft: send a request and it lands with the core team. Quick answers are in the <a href="#faq">FAQs</a>.</p>
      </SheetHead>

      <section className="wrap section grid gap-12 lg:grid-cols-2">
        <div className="grid gap-10 content-start">
          {PEOPLE.map(([name, mail, phone]) => (
            <div key={name} className="border-t border-ink pt-4 grid gap-1">
              <h2 data-reveal="words" className="wide text-xl mb-2">{name}</h2>
              <p><span className="font-[650]">Email: </span><a href={`mailto:${mail}`} className="break-all hover:text-signal">{mail}</a></p>
              <p><span className="font-[650]">Phone: </span><a href={`tel:${phone.replace(/\s/g, '')}`} className="data text-[0.9375rem] hover:text-signal">{phone}</a></p>
            </div>
          ))}
          <div className="border-t border-ink pt-4 grid gap-1">
            <h2 data-reveal="words" className="wide text-xl mb-2">Club inbox</h2>
            <p><a href="mailto:aeromodellingquatlas@gmail.com" className="break-all hover:text-signal">aeromodellingquatlas@gmail.com</a></p>
          </div>
          <Map />
        </div>

        <form id="request" onSubmit={submit} className="grid gap-5 content-start border border-ink bg-sheet p-5 md:p-8 scroll-mt-20">
          <div className="grid gap-1">
            <h2 data-reveal="words" className="wide text-2xl">Send a request</h2>
            <p className="text-ink-2 text-[0.9375rem]">Goes straight to the core team’s inbox.</p>
          </div>
          <Field label="What is it about?" as="select" name="type" value={f.type} onChange={set('type')}>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </Field>
          <Field label="Name" name="name" required autoComplete="name" value={f.name} onChange={set('name')} />
          <Field label="Email" name="email" type="email" required autoComplete="email" value={f.email} onChange={set('email')} />
          <Field label="Phone" name="ConNumber" type="tel" required autoComplete="tel" value={f.ConNumber} onChange={set('ConNumber')} />
          <Field label="USN (students only)" name="usn" value={f.usn} onChange={set('usn')} placeholder="e.g. 1MS22ME002" />
          <Field label="Message" as="textarea" name="message" rows={6} required value={f.message} onChange={set('message')} />
          <Submit busy={busy}>Send request</Submit>
        </form>
      </section>

      <section id="faq" aria-labelledby="faq-h" className="wrap section border-t border-rule grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] scroll-mt-20">
        <h2 data-reveal="words" id="faq-h" className="display text-[clamp(2rem,4vw,3.5rem)]">FAQs</h2>
        <div className="border-t border-ink">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group border-b border-rule">
              <summary className="flex items-center justify-between gap-4 py-5 cursor-pointer list-none wide text-lg [&::-webkit-details-marker]:hidden">
                {q}<span aria-hidden="true" className="data text-signal text-xl transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="pb-6 text-ink-2 max-w-2xl">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
