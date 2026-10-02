/**
 * glass-fragment.js — glyph-shaped liquid-glass fragment for the vendored
 * shuding/liquid-glass Shader, with real per-stroke lens physics.
 *
 * Library contract: fragment(uv) → {x, y} — the source coordinates (0..1)
 * the pixel at uv samples from.
 *
 * What makes it READ as liquid glass (the iOS clock signatures):
 *   1. Per-stroke refraction — each glyph is its own lens: displacement
 *      runs along the stroke's LOCAL normal (from the ink distance field's
 *      gradient), strongest just inside the stroke edge and easing to zero
 *      at the stroke center. This bends the wallpaper around every stroke
 *      border, like light through a rounded glass rod.
 *   2. Convex sampling — pixels sample FROM the outside toward the inside
 *      at the edges (the demo's "sampling toward the center" convex rule),
 *      magnifying the wallpaper where the stroke meets the background —
 *      that's what makes the rim read as thickness.
 */

/** Two-pass chamfer distance transform (1 = ink, 0 = background). */
export function distanceTransform(bin, w, h) {
  const INF = 1e6;
  const dist = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) dist[i] = bin[i] ? INF : 0;
  const D1 = 1, D2 = Math.SQRT2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!bin[i]) continue;
      let d = dist[i];
      if (y > 0) {
        d = Math.min(d, dist[(y - 1) * w + x] + D1);
        if (x > 0) d = Math.min(d, dist[(y - 1) * w + x - 1] + D2);
        if (x < w - 1) d = Math.min(d, dist[(y - 1) * w + x + 1] + D2);
      }
      if (x > 0) d = Math.min(d, dist[i - 1] + D1);
      dist[i] = d;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!bin[i]) continue;
      let d = dist[i];
      if (y < h - 1) {
        d = Math.min(d, dist[(y + 1) * w + x] + D1);
        if (x > 0) d = Math.min(d, dist[(y + 1) * w + x - 1] + D2);
        if (x < w - 1) d = Math.min(d, dist[(y + 1) * w + x + 1] + D2);
      }
      if (x < w - 1) d = Math.min(d, dist[i + 1] + D1);
      dist[i] = d;
    }
  }
  return dist;
}

/** The library's own smoothStep easing. */
export function libSmoothStep(a, b, t) {
  t = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Compose a canvas font string from computed styles — getComputedStyle().font
 * returns '' in Chromium when line-height isn't shorthand-serializable.
 */
export function canvasFont(cs) {
  return `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily.split(',')[0]}`;
}

/**
 * Rasterize text to a PNG (glyph alpha) for the lens overlay's mask.
 * Geometry EXACTLY matches the overlay box (w×h) — no padding, or the ink
 * double-shifts when the mask stretches onto the element box.
 */
export async function renderGlyphMask({ text, w, h, fontCss, letterSpacing = 0 }) {
  const cw = Math.max(2, Math.ceil(w));
  const ch = Math.max(2, Math.ceil(h));
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext('2d');
  // MUST mirror the DOM's letter-spacing: without it the canvas draws the
  // string wider than the element box and every glyph drifts right — the
  // last digits land outside the mask ink (the half-cut '0' bug).
  if (letterSpacing) ctx.letterSpacing = `${letterSpacing}px`;
  ctx.font = fontCss;
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(text);
  const ascent = m.fontBoundingBoxAscent || ch * 0.77;
  const emH = (m.fontBoundingBoxAscent || 0) + (m.fontBoundingBoxDescent || 0);
  const halfLeading = Math.max(0, (ch - emH) / 2);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, 2, halfLeading + ascent);
  return c.toDataURL('image/png');
}

/**
 * Build the Shader fragment: per-stroke lens physics.
 * @returns {Promise<(uv) => {x, y}>}
 */
export async function buildGlassFragment({ text, w, h, fontCss, rim = 0.3, maxPull = 0.05, letterSpacing = 0 }) {
  const cw = Math.max(2, Math.ceil(w));
  const ch = Math.max(2, Math.ceil(h));
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (letterSpacing) ctx.letterSpacing = `${letterSpacing}px`;
  ctx.font = fontCss;
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(text);
  const ascent = m.fontBoundingBoxAscent || ch * 0.77;
  const emH = (m.fontBoundingBoxAscent || 0) + (m.fontBoundingBoxDescent || 0);
  const halfLeading = Math.max(0, (ch - emH) / 2);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, 2, halfLeading + ascent);

  const alpha = ctx.getImageData(0, 0, cw, ch).data;
  const bin = new Uint8Array(cw * ch);
  for (let i = 0; i < cw * ch; i++) bin[i] = alpha[i * 4 + 3] > 127 ? 1 : 0;

  const dist = distanceTransform(bin, cw, ch);
  let maxDepth = 1;
  for (let i = 0; i < cw * ch; i++) if (bin[i] && dist[i] < 1e5) maxDepth = Math.max(maxDepth, dist[i]);

  // The bend zone: fraction of the stroke half-width, capped (wide glyph
  // counters should not get a rim hundreds of px wide on thick strokes)
  const rimPx = Math.max(2, Math.min(rim * maxDepth, maxDepth * 0.55));

  return (uv) => {
    const xF = uv.x * cw - 0.5;
    const yF = uv.y * ch - 0.5;
    const x = Math.max(0, Math.min(cw - 1, Math.round(xF)));
    const y = Math.max(0, Math.min(ch - 1, Math.round(yF)));
    const i = y * cw + x;

    if (!bin[i]) return { x: uv.x, y: uv.y }; // outside ink: identity

    const d = dist[i];
    const t = Math.min(d / rimPx, 1); // 0 at stroke edge → 1 at bend-zone end

    // local stroke normal from the distance-field gradient (central diff)
    const gx =
      dist[y * cw + Math.min(x + 1, cw - 1)] -
      dist[y * cw + Math.max(x - 1, 0)];
    const gy =
      dist[Math.min(y + 1, ch - 1) * cw + x] -
      dist[Math.max(y - 1, 0) * cw + x];
    const len = Math.hypot(gx, gy) || 1;
    const nx = gx / len;
    const ny = gy / len;

    // Convex rod model: at the very edge, sample INWARD (toward stroke
    // center) — the outside wallpaper gets pulled into the stroke (edge
    // magnification); deeper, ease back to identity. The demo's
    // smoothStep easing over that profile is what gives the liquid feel.
    const edgeBend = libSmoothStep(1, 0, t); // 1 at edge → 0 at zone end
    const pull = edgeBend * maxPull;

    // sample from the OUTER side: source = pixel + normal * pull
    // (normal points INTO the stroke, so we go against it to grab the
    // surrounding wallpaper — convex magnification at the boundary)
    const sx2 = uv.x - nx * pull;
    const sy2 = uv.y - ny * pull;
    // slight inward shift at depth for the rod's magnification:
    const inner = libSmoothStep(0.4, 1, t) * maxPull * 0.35;
    return { x: sx2 + nx * inner, y: sy2 + ny * inner };
  };
}

/**
 * Build the specular rim-light PNG: white catch-lights along the TOP edges
 * of every stroke + dark shading under the BOTTOM edges (glass thickness),
 * alpha-faded over a tight band at the stroke boundary.
 * letterSpacing must mirror the DOM's tracking — same drift rule as the mask.
 */
export async function renderSpecular({ text, w, h, fontCss, band = 0.45, letterSpacing = 0 }) {
  const cw = Math.max(2, Math.ceil(w));
  const ch = Math.max(2, Math.ceil(h));
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (letterSpacing) ctx.letterSpacing = `${letterSpacing}px`;
  ctx.font = fontCss;
  ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(text);
  const ascent = m.fontBoundingBoxAscent || ch * 0.77;
  const emH = (m.fontBoundingBoxAscent || 0) + (m.fontBoundingBoxDescent || 0);
  const halfLeading = Math.max(0, (ch - emH) / 2);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, 2, halfLeading + ascent);

  const alpha = ctx.getImageData(0, 0, cw, ch).data;
  const bin = new Uint8Array(cw * ch);
  for (let i = 0; i < cw * ch; i++) bin[i] = alpha[i * 4 + 3] > 127 ? 1 : 0;
  const dist = distanceTransform(bin, cw, ch);
  // outside-ink distance via inverted mask (for the outer glow band)
  const binInv = new Uint8Array(cw * ch);
  for (let i = 0; i < cw * ch; i++) binInv[i] = bin[i] ? 0 : 1;
  const distOut = distanceTransform(binInv, cw, ch);

  let maxDepth = 1;
  for (let i = 0; i < cw * ch; i++) if (bin[i] && dist[i] < 1e5) maxDepth = Math.max(maxDepth, dist[i]);
  const zone = Math.max(2, band * maxDepth);

  const out = ctx.createImageData(cw, ch);
  const o = out.data;
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const i = y * cw + x;
      const ii = i * 4;

      const inside = bin[i] === 1;
      const d = inside ? dist[i] : distOut[i];
      if (d > zone) continue;
      const falloff = 1 - d / zone;

      // edge orientation: does the ink lie above or below?
      const gradY = inside
        ? dist[Math.min(y + 1, ch - 1) * cw + x] - dist[Math.max(y - 1, 0) * cw + x]
        : distOut[Math.min(y + 1, ch - 1) * cw + x] - distOut[Math.max(y - 1, 0) * cw + x];
      const topFacing = inside ? gradY < 0 : gradY > 0;

      if (topFacing) {
        // white catch-light on top edges
        o[ii] = 255; o[ii + 1] = 255; o[ii + 2] = 255;
        o[ii + 3] = Math.round(230 * Math.pow(falloff, 1.2));
      } else {
        // dark thickness shading under bottom edges
        o[ii] = 8; o[ii + 1] = 20; o[ii + 2] = 32;
        o[ii + 3] = Math.round(110 * Math.pow(falloff, 1.6));
      }
      o[ii + 3] = inside ? o[ii + 3] : 0; // outer band not painted (soft edge live in the lens)
    }
  }
  ctx.putImageData(out, 0, 0);
  return c.toDataURL('image/png');
}