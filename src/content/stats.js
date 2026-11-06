// The home page's stats strip: the first entry year from the record, then the club's own figures.
// Pure (no imports) so `node --test` can run it.
// counts: running totals ({ competitions, members }), shown as "25+"; 0 or missing hides one.
// highlight: one result to show last ({ value, label, note }), or none.
export function homeStats(record, counts = {}, highlight) {
  if (!record.length) return [];
  const years = record.map((r) => +r.year);
  const stats = [
    { label: 'First entry', value: String(Math.min(...years)) },
  ];
  if (counts.competitions > 0) stats.push({ label: 'Competitions', value: String(counts.competitions), suffix: '+' });
  if (counts.members > 0) stats.push({ label: 'Members', value: String(counts.members), suffix: '+' });
  if (highlight) stats.push(highlight);
  return stats;
}
