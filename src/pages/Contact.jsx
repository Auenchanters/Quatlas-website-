import { useState } from 'react';
import { SheetHead, MAP_URL } from '../components/Layout';
import { Field, Submit, useSubmit } from '../components/ui';
import { api } from '../lib/api';

const MAP_EMBED = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3887.0835259698624!2d77.562613474846!3d13.030352813587932!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bae170e309db333%3A0x42bc025a603938d4!2sQuatlas%20Aeromodelling!5e0!3m2!1sen!2sin!4v1718769975645!5m2!1sen!2sin';

const PEOPLE = [
  // The old page listed "urstrulypuneethgmail.com" (missing the @); corrected here.
  ['Team leader - Puneeth L', 'urstrulypuneeth@gmail.com', '+91 91488 43472'],
  ['Non Tech - Pavan A', 'pavan.aashok1234gh@gmail.com', '+91 7676475397'],
];

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

export default function Contact() {
  const empty = { name: '', usn: '', ConNumber: '', message: '' };
  const [f, setF] = useState(empty);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const [submit, busy] = useSubmit(async () => {
    const res = await api('/form/addcon', { method: 'POST', body: f });
    setF(empty);
    return res;
  });
  return (
    <>
      <SheetHead title="Contact Us">
        <p>Are you a student with a passion for flight and innovation? <strong className="text-ink">Quatlas Aeromodelling</strong>, the official team of RIT, is seeking enthusiastic members to join us as we compete in the annual SAE Aero Design Competition in the USA. This is your opportunity to work on cutting-edge projects, gain invaluable experience, and proudly represent our college on an international stage. Join us at Quatlas Aeromodelling and help us achieve new milestones in aeromodelling excellence!</p>
      </SheetHead>

      <section className="wrap py-12 md:py-16 grid gap-12 lg:grid-cols-2">
        <div className="grid gap-10 content-start">
          {PEOPLE.map(([name, email, phone]) => (
            <div key={name} className="border-t border-ink pt-4 grid gap-1">
              <h2 className="wide text-xl mb-2">{name}</h2>
              <p><span className="font-semibold">Email: </span><a href={`mailto:${email}`} className="break-all hover:text-signal">{email}</a></p>
              <p><span className="font-semibold">Contact Number: </span><a href={`tel:${phone.replace(/\s/g, '')}`} className="data text-[0.9375rem] hover:text-signal">{phone}</a></p>
            </div>
          ))}
          <div className="border-t border-ink pt-4">
            <h2 className="wide text-xl mb-2">Registered Address</h2>
            <p className="text-ink-2 max-w-md">ESB II , 119, R&amp;D - 1 Laboratory, Quatlas-RIT Ramaiah Institute of Technology MSR Nagar, MSRIT Post, Mathikere Bangalore-560054</p>
          </div>
          <Map />
        </div>

        <form onSubmit={submit} className="grid gap-5 content-start border border-ink bg-sheet p-5 md:p-8">
          <h2 className="wide text-2xl">Send a query</h2>
          <Field label="Name" name="name" required autoComplete="name" value={f.name} onChange={set('name')} />
          <Field label="Usn" name="usn" required value={f.usn} onChange={set('usn')} placeholder="e.g. 1MS22ME002" />
          <Field label="Contact Number" name="ConNumber" type="tel" required autoComplete="tel" value={f.ConNumber} onChange={set('ConNumber')} />
          <Field label="Message" as="textarea" name="message" rows={6} value={f.message} onChange={set('message')} />
          <Submit busy={busy}>Submit</Submit>
        </form>
      </section>
    </>
  );
}
