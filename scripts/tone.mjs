// The colour a photo shows while it loads: its average colour (sharp's "dominant" picks a histogram
// bin, often a blown-out sky or a black shadow), or null for images with transparency (logos), which
// must not get a box behind them.
export async function tone(img) {
  const { channels, isOpaque } = await img.stats();
  return isOpaque ? `#${channels.slice(0, 3).map((c) => Math.round(c.mean).toString(16).padStart(2, '0')).join('')}` : null;
}
