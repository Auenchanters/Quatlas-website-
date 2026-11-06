// The home page's stats strip, worked out from content so it updates itself when the data does.
// Pure (no imports) so `node --test` can run it.
// counts: the club's own running totals ({ competitions, members }), shown as "25+"; 0 or missing hides one.
export function homeStats(record, counts = {}) {
  if (!record.length) return [];
  const years = record.map((r) => +r.year);
  const stats = [
    { label: 'First entry', value: String(Math.min(...years)) },
  ];
  if (counts.competitions > 0) stats.push({ label: 'Competitions', value: String(counts.competitions), suffix: '+' });
  if (counts.members > 0) stats.push({ label: 'Members', value: String(counts.members), suffix: '+' });
  const best = record.filter((r) => r.payloadKg).sort((a, b) => b.payloadKg - a.payloadKg)[0];
  if (best) stats.push({ label: 'Heaviest payload lifted', value: String(best.payloadKg), suffix: ' kg', note: best.year });
  return stats;
}
