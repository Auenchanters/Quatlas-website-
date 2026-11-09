// Where the Avionics cockpit panel (drawn at 1200 × 640) sits in a w × h window: right of the title on a
// wide screen, below it on a narrow one. Shared by the scene and the page (which must know at once
// whether a press is on the panel, to stop it selecting text).
export const PANEL_W = 1200, PANEL_H = 640;
export function panelBox(w, h) {
  const narrow = w < 900, x0 = narrow ? 12 : w * 0.45, y0 = narrow ? h * 0.14 : Math.max(70, h * 0.1);
  const aw = w - 16 - x0, ah = h - 16 - y0, s = Math.min(aw / PANEL_W, ah / PANEL_H);
  return { s, ox: w - 16 - PANEL_W * s, oy: y0 + (ah - PANEL_H * s) / 2 };
}
