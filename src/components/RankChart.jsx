import { RECORD } from '../content/achievements';

// Best placing per year, drawn like a flight-test plot: rank 1 at the top, years along the bottom.
const X0 = 56, X1 = 776, Y0 = 28, Y1 = 248, FIRST = 2015, LAST = 2024, WORST = 30;
const x = (year) => X0 + 36 + ((year - FIRST) / (LAST - FIRST)) * (X1 - X0 - 72);
const y = (rank) => Y0 + ((rank - 1) / (WORST - 1)) * (Y1 - Y0);
const ord = (n) => `${n}${[, 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`;

export default function RankChart() {
  const ranked = RECORD.filter((r) => r.rank).sort((a, b) => a.year - b.year);
  const unranked = RECORD.filter((r) => !r.rank);
  const line = ranked.map((r, i) => `${i ? 'L' : 'M'}${x(+r.year)} ${y(r.rank)}`).join(' ');
  return (
    <figure className="grid gap-3">
      <svg viewBox="0 0 800 290" className="w-full h-auto overflow-visible" role="img"
        aria-label={`Best placing each year: ${ranked.map((r) => `${r.year}, ${ord(r.rank)} ${r.rankIn}`).join('; ')}.`}>
        {[1, 10, 20, 30].map((r) => (
          <g key={r}>
            <line x1={X0} x2={X1} y1={y(r)} y2={y(r)} stroke="var(--color-rule)" strokeDasharray={r === 1 ? undefined : '2 4'} />
            <text x={X0 - 12} y={y(r) + 4} textAnchor="end" className="data" fontSize="12" fill="var(--color-ink-2)">{ord(r)}</text>
          </g>
        ))}
        {Array.from({ length: LAST - FIRST + 1 }, (_, i) => FIRST + i).map((yr) => (
          <text key={yr} x={x(yr)} y={Y1 + 30} textAnchor="middle" className="data" fontSize="12" fill="var(--color-ink-2)">{yr}</text>
        ))}
        <line x1={X0} x2={X1} y1={Y1 + 12} y2={Y1 + 12} stroke="var(--color-ink)" />
        <path d={line} fill="none" stroke="var(--color-ink)" strokeWidth="1.5" strokeLinejoin="round" />
        {ranked.map((r) => (
          <a key={r.year} href={`#y${r.year}`} aria-label={`${r.year}: ${ord(r.rank)} ${r.rankIn}`} className="group">
            <circle cx={x(+r.year)} cy={y(r.rank)} r="14" fill="transparent" />
            <circle cx={x(+r.year)} cy={y(r.rank)} r="5" fill="var(--color-paper)" stroke="var(--color-signal)" strokeWidth="2" className="group-hover:fill-[var(--color-signal)]" />
            <text x={x(+r.year)} y={y(r.rank) - 14} textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--color-ink)">{ord(r.rank)}</text>
            <text x={x(+r.year)} y={y(r.rank) + 24} textAnchor="middle" fontSize="11" className="data" fill="var(--color-ink-2)">{r.rankIn}</text>
          </a>
        ))}
        {unranked.map((r) => (
          <a key={r.year} href={`#y${r.year}`} aria-label={`${r.year}: ${r.summary}`}>
            <line x1={x(+r.year)} x2={x(+r.year)} y1={Y0} y2={Y1 + 12} stroke="var(--color-signal)" strokeDasharray="3 3" />
            <rect x={x(+r.year) - 5} y={Y0 - 5} width="10" height="10" transform={`rotate(45 ${x(+r.year)} ${Y0})`} fill="var(--color-signal)" />
            <text x={x(+r.year) - 10} y={Y0 + 120} textAnchor="end" fontSize="12" fill="var(--color-ink)">{r.event ?? r.title}</text>
            <text x={x(+r.year) - 10} y={Y0 + 136} textAnchor="end" fontSize="11" className="data" fill="var(--color-ink-2)">cleared all rounds</text>
          </a>
        ))}
      </svg>
      <figcaption className="data text-ink-2">Best placing each year at SAE Aero Design: overall where the team was ranked overall, otherwise its best category. Select a point for that year.</figcaption>
    </figure>
  );
}
