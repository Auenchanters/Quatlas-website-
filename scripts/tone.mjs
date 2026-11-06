// The colour a photo shows while it loads: its dominant colour, or null for images with transparency
// (logos), which must not get a box behind them.
export async function tone(img) {
  const { dominant: { r, g, b }, isOpaque } = await img.stats();
  return isOpaque ? `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}` : null;
}
