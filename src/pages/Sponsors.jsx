import { Copy, SheetHead } from '../components/Layout';
import { RemoteImg } from '../components/RemoteImg';
import { useApi } from '../lib/api';
import sponsors from '../content/sponsors.json';

export default function Sponsors() {
  const [intro, connect, ...rest] = sponsors;
  const ways = rest.slice(0, 3);
  const ours = rest[3];
  const { data: logos } = useApi('/spslist/items', { auth: true });
  return (
    <>
      <SheetHead title="Sponsors"><p>{intro.blocks[0].text}</p></SheetHead>
      <Copy sections={[connect]} />

      <section className="wrap py-12 md:py-16 border-b border-rule">
        <h2 className="wide text-2xl md:text-[1.75rem]">Three Ways To Be A Part Of Quatlas</h2>
        <ol className="mt-10 grid gap-10 lg:grid-cols-3">
          {ways.map((w, i) => (
            <li key={w.heading} className="border-t border-ink pt-5 grid gap-3 content-start">
              <p className="data text-signal">Way {i + 1} of 3</p>
              <h3 className="wide text-xl">{w.heading}</h3>
              <p className="text-ink-2">{w.blocks[0].text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="wrap py-12 md:py-16 grid gap-8">
        <h2 className="display text-4xl md:text-5xl">{ours.heading}</h2>
        <p className="copy text-ink-2">{ours.blocks[0].text}</p>
        {logos?.length > 0 && (
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 border-t border-l border-rule">
            {logos.filter((s) => s.img?.startsWith('http')).map((s) => (
              <li key={s._id} className="border-r border-b border-rule bg-white">
                <a href={s.link?.startsWith('http') ? s.link : undefined} target="_blank" rel="noreferrer" className="grid place-items-center h-32 p-5">
                  <RemoteImg src={s.img} width={320} alt={s.link?.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') || 'Sponsor'} className="logo max-h-full max-w-full object-contain" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
