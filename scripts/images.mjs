// Re-encodes assets-src/* into public/img/<name>-<w>.webp and writes src/content/images.json
// (intrinsic size + available widths, so <Img> can set srcset and reserve space).
import sharp from 'sharp';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tone } from './tone.mjs';

const SRC = 'assets-src';
const OUT = 'public/img';
const WIDTHS = [480, 960, 1600];
const LOSSLESS = new Set(['gpay_qr_code']); // QR codes must stay scannable

await mkdir(OUT, { recursive: true });
const manifest = {};

for (const file of await readdir(SRC)) {
  const name = path.parse(file).name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const img = sharp(path.join(SRC, file)).rotate(); // rotate() applies EXIF orientation
  const { width, height } = await img.metadata();
  const widths = WIDTHS.filter((w) => w < width).concat(Math.min(width, 2000));
  for (const w of [...new Set(widths)]) {
    await img
      .clone()
      .resize({ width: w })
      .webp(LOSSLESS.has(name) ? { lossless: true } : { quality: 72 })
      .toFile(path.join(OUT, `${name}-${w}.webp`));
  }
  manifest[name] = { w: width, h: height, widths: [...new Set(widths)], c: (await tone(img.clone())) ?? undefined };
}

await writeFile('src/content/images.json', JSON.stringify(manifest, null, 1));
console.log(`${Object.keys(manifest).length} images`);
