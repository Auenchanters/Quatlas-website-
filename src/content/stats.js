// The home page's stats strip, worked out from content so it updates itself when the data does.
// Pure (no imports) so `node --test` can run it.
export function homeStats(record, members) {
  if (!record.length) return [];
  const years = record.map((r) => +r.year);
  const stats = [
    { label: 'First entry', value: String(Math.min(...years)) },
    { label: 'Competitions', value: String(record.length) },
  ];
  if (members > 0) stats.push({ label: 'Members', value: String(members) });
  const best = record.filter((r) => r.payloadKg).sort((a, b) => b.payloadKg - a.payloadKg)[0];
  if (best) stats.push({ label: 'Heaviest payload lifted', value: String(best.payloadKg), suffix: ' kg', note: best.year });
  return stats;
}
