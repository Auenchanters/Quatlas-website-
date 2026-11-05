// Splits a stat into digits (which roll) and text (which stays put): '7.25' → 7 . 2 5, '1st' → 1 st.
export function splitStat(value) {
  const out = [];
  for (const ch of String(value ?? '')) {
    if (ch >= '0' && ch <= '9') out.push({ digit: +ch });
    else if (out.length && 'text' in out.at(-1)) out.at(-1).text += ch;
    else out.push({ text: ch });
  }
  return out;
}
