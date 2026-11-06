import { Img } from './Img';

// Columns of photos scrolling endlessly, neighbours in opposite directions (each list is drawn twice,
// so moving it by half loops seamlessly). Hover holds them still; reduced motion leaves them still
// (styles.css stops all CSS animation). Phones get two columns.
const SPEEDS = [48, 60, 54]; // seconds per loop, so the columns never line up

export default function PhotoWall({ photos }) {
  const cols = [0, 1, 2].map((c) => photos.filter((_, i) => i % 3 === c));
  return (
    <div className="wall grid grid-cols-2 md:grid-cols-3 gap-3 h-[clamp(28rem,55vw,42rem)] overflow-hidden">
      {cols.map((list, c) => (
        <div key={c} className={`min-h-0 ${c === 2 ? 'hidden md:block' : ''}`}>
          <ul className="wall-col grid gap-3" style={{ animationDuration: `${SPEEDS[c]}s`, animationDirection: c % 2 ? 'reverse' : 'normal' }}>
            {[...list, ...list].map((name, i) => (
              <li key={i} aria-hidden={i >= list.length || undefined}>
                <Img name={name} sizes="(min-width: 768px) 22vw, 46vw" className="block w-full h-auto border border-ink" />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
