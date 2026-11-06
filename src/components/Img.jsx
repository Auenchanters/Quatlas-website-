import manifest from '../content/images.json';

// Local image from public/img, with srcset and intrinsic size so nothing shifts while loading, and its
// dominant colour behind it (images.json `c`) so the space reads as the photo before it arrives.
export function Img({ name, alt = '', sizes = '100vw', eager = false, className = '' }) {
  const m = manifest[name];
  if (!m) return null;
  const src = (w) => `/img/${name}-${w}.webp`;
  return (
    <img
      src={src(m.widths[Math.min(1, m.widths.length - 1)])}
      srcSet={m.widths.map((w) => `${src(w)} ${w}w`).join(', ')}
      sizes={sizes} width={m.w} height={m.h} alt={alt}
      loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined} decoding="async"
      className={className} style={m.c ? { backgroundColor: m.c } : undefined}
    />
  );
}
