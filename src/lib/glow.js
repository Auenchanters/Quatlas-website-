// Supporter tiles: the faint light under the logo follows the cursor (styles.css, .logo-tile).
export function glow(e) {
  const t = e.currentTarget, r = t.getBoundingClientRect();
  t.style.setProperty('--gx', `${e.clientX - r.left}px`);
  t.style.setProperty('--gy', `${e.clientY - r.top}px`);
}
