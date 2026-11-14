/**
 * হ্যান্ড ম্যাপ রেন্ডারার — অনুমোদিত ডিজাইন B (design-previews/06-handmap.html) থেকে নেওয়া।
 * - হাতে আঁকা ধাঁচের দাগ (প্রতিটি রেকর্ডে একই "হাত" — seed করা random)
 * - দাগ নম্বর, প্রতিটি বাহুর ফুট-ইঞ্চি, শতক, কোণে উত্তর তীর, দখলদারের নাম, চৌহদ্দি, নোট
 * - লেখা কখনো দাগ বা অন্য লেখার উপর পড়ে না (SAT overlap + segment hit পরীক্ষা)
 * ফল: <svg>-এর ভেতরের markup (string)। viewBox 0 0 340 452।
 */

export type Pt = [number, number];

export interface HandMapRecord {
  id: string;
  name: string;
  dag: string;
  mouza: string;
  note: string;
  /** চৌহদ্দি: উত্তরে, পূর্বে, দক্ষিণে, পশ্চিমে */
  nb: string[];
  /** ফুটে; y নিচের দিকে = দক্ষিণ */
  pts: Pt[];
  /** প্রতিটি বাহু (pts[i] → pts[i+1]) ফুটে */
  len: number[];
  sq: number;
  date: string; // দেখানোর জন্য প্রস্তুত বাংলা তারিখ
  amin: string;
}

export interface HandMapOptions {
  ink: InkKey;
  rough: boolean;
  hatch: boolean;
  chau: boolean;
}

export type InkKey = 'black' | 'blue' | 'green' | 'pencil';

export const INK: Record<InkKey, { c: string; w: number; op: number }> = {
  black: { c: '#1f2937', w: 2, op: 1 },
  blue: { c: '#1e3a8a', w: 2, op: 1 },
  green: { c: '#065f46', w: 2.2, op: 1 },
  pencil: { c: '#57534e', w: 1.5, op: 0.9 },
};

export const MAP_W = 340;
export const MAP_H = 452;
export const PAPER = '#fffdf5';

const MAP = { x0: 6, y0: 58, x1: 334, y1: 380 };
const FIT = { x0: 56, y0: 104, x1: 284, y1: 336 };
const SIDE_DIR = ['উত্তরে', 'পূর্বে', 'দক্ষিণে', 'পশ্চিমে'];

export const BN = (s: string | number) => String(s).replace(/[0-9]/g, (x) => '০১২৩৪৫৬৭৮৯'[+x]);
export const fmtNum = (v: number, d = 2) =>
  BN(Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
export const ftInBn = (ft: number) => {
  const t = Math.round(ft * 12);
  return `${BN(Math.floor(t / 12))}′ ${BN(t % 12)}″`;
};
const esc = (s: string) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

export function mulberry(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
export const shoelace = (P: Pt[]) =>
  Math.abs(
    P.reduce((s, p, i) => {
      const q = P[(i + 1) % P.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0)
  ) / 2;

/* ---------------- লেখার মাপ (Noto Sans Bengali) ---------------- */
let mctx: CanvasRenderingContext2D | null = null;
const MC = new Map<string, number>();
export function resetMeasureCache() {
  MC.clear();
}
export function measure(t: string, size: number, weight: number): number {
  const k = `${t}|${size}|${weight}`;
  const hit = MC.get(k);
  if (hit !== undefined) return hit;
  if (!mctx && typeof document !== 'undefined') mctx = document.createElement('canvas').getContext('2d');
  let w = t.length * size * 0.55;
  if (mctx) {
    mctx.font = `${weight} ${size}px "Noto Sans Bengali", sans-serif`;
    w = mctx.measureText(t).width || w;
  }
  MC.set(k, w);
  return w;
}

/* ---------------- জ্যামিতি ---------------- */
type Box = { x: number; y: number; w: number; h: number; a: number };
type Label = Box & { t: string; size: number; weight: number; key?: string; fill?: string };

function corners(L: Box): Pt[] {
  const c = Math.cos(L.a);
  const s = Math.sin(L.a);
  const hw = L.w / 2;
  const hh = L.h / 2;
  return ([
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ] as Pt[]).map(([x, y]) => [L.x + x * c - y * s, L.y + x * s + y * c] as Pt);
}
function overlap(A: Box, B: Box) {
  const ca = corners(A);
  const cb = corners(B);
  for (const L of [A, B])
    for (const [ax, ay] of [
      [Math.cos(L.a), Math.sin(L.a)],
      [-Math.sin(L.a), Math.cos(L.a)],
    ]) {
      let a1 = 1e9;
      let a2 = -1e9;
      let b1 = 1e9;
      let b2 = -1e9;
      for (const [x, y] of ca) {
        const p = x * ax + y * ay;
        a1 = Math.min(a1, p);
        a2 = Math.max(a2, p);
      }
      for (const [x, y] of cb) {
        const p = x * ax + y * ay;
        b1 = Math.min(b1, p);
        b2 = Math.max(b2, p);
      }
      if (a2 < b1 || b2 < a1) return false;
    }
  return true;
}
function segHit(L: Box, p: Pt, q: Pt) {
  const c = Math.cos(-L.a);
  const s = Math.sin(-L.a);
  const tr = ([x, y]: Pt): Pt => {
    const dx = x - L.x;
    const dy = y - L.y;
    return [dx * c - dy * s, dx * s + dy * c];
  };
  const [x0, y0] = tr(p);
  const [x1, y1] = tr(q);
  const hw = L.w / 2;
  const hh = L.h / 2;
  const dx = x1 - x0;
  const dy = y1 - y0;
  let t0 = 0;
  let t1 = 1;
  const P = [-dx, dx, -dy, dy];
  const Q = [x0 + hw, hw - x0, y0 + hh, hh - y0];
  for (let i = 0; i < 4; i++) {
    if (P[i] === 0) {
      if (Q[i] < 0) return false;
    } else {
      const r = Q[i] / P[i];
      if (P[i] < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return true;
}
const inside = (pt: Pt, P: Pt[]) => {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i];
    const [xj, yj] = P[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const inMap = (L: Box) => corners(L).every(([x, y]) => x >= MAP.x0 && x <= MAP.x1 && y >= MAP.y0 && y <= MAP.y1);

export function rough(x1: number, y1: number, x2: number, y2: number, rnd: () => number, on: boolean, amp = 1.3) {
  const f = (v: number) => v.toFixed(1);
  if (!on) return `M${f(x1)},${f(y1)}L${f(x2)},${f(y2)}`;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  const ex = (x2 - x1) / len;
  const ey = (y2 - y1) / len;
  const j = () => (rnd() - 0.5) * 2 * amp;
  let d = '';
  for (let k = 0; k < 2; k++) {
    const bend = (rnd() - 0.5) * Math.min(len * 0.03, 5);
    const o1 = rnd() * 3;
    const o2 = rnd() * 3;
    d += `M${f(x1 - ex * o1 + j())},${f(y1 - ey * o1 + j())}Q${f((x1 + x2) / 2 + nx * bend + j())},${f(
      (y1 + y2) / 2 + ny * bend + j()
    )} ${f(x2 + ex * o2 + j())},${f(y2 + ey * o2 + j())}`;
  }
  return d;
}

/* ---------------- মূল আঁকা ---------------- */
export function renderHandMap(r: HandMapRecord, o: HandMapOptions, uid = 'hm', paper = PAPER): string {
  const ink = INK[o.ink];
  const rnd = mulberry(hashStr(r.id + o.ink));
  const R = o.rough;
  const out: string[] = [];
  const obs: Box[] = [];
  const halo = `paint-order="stroke" stroke="${paper}" stroke-width="5" stroke-linejoin="round"`;
  const FONT = `font-family="'Noto Sans Bengali', sans-serif"`;
  const text = (L: Label, extra = '') =>
    `<text x="${L.x.toFixed(1)}" y="${L.y.toFixed(1)}" font-size="${L.size}" font-weight="${L.weight}" fill="${
      L.fill || ink.c
    }" text-anchor="middle" dominant-baseline="central" ${
      L.a ? `transform="rotate(${((L.a * 180) / Math.PI).toFixed(1)} ${L.x.toFixed(1)} ${L.y.toFixed(1)})"` : ''
    } ${L.key ? `data-edit="${L.key}"` : ''} ${halo} ${extra}>${esc(L.t)}</text>`;
  const mk = (t: string, size: number, weight: number, x: number, y: number, a = 0, key = ''): Label => ({
    t,
    size,
    weight,
    x,
    y,
    a,
    key,
    w: measure(t, size, weight) + 8,
    h: size + 8,
  });

  /* কাগজ, শিরোনাম, নিচের তথ্য */
  out.push(`<g ${FONT}>`);
  out.push(`<rect width="${MAP_W}" height="${MAP_H}" fill="${paper}"/>`);
  out.push(`<text x="14" y="26" font-size="18" font-weight="800" fill="${ink.c}">হ্যান্ড ম্যাপ</text>`);
  out.push(
    `<text x="326" y="26" font-size="13" font-weight="700" fill="${ink.c}" text-anchor="end" opacity=".8">${esc(r.date)}</text>`
  );
  out.push(
    `<text x="14" y="46" font-size="14" font-weight="700" fill="${ink.c}" data-edit="mouza">মৌজা: ${esc(r.mouza || '—')} · দাগ: ${esc(
      r.dag || '—'
    )}</text>`
  );
  out.push(`<path d="${rough(10, 54, 330, 54, rnd, R, 0.8)}" stroke="${ink.c}" stroke-width="1.2" fill="none" opacity=".55"/>`);
  out.push(`<path d="${rough(10, 384, 330, 384, rnd, R, 0.8)}" stroke="${ink.c}" stroke-width="1.2" fill="none" opacity=".55"/>`);
  const words = ('নোট: ' + (r.note || '—')).split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (measure(t, 13, 600) > 312 && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  lines.push(cur);
  lines
    .slice(0, 2)
    .forEach((l, i) =>
      out.push(
        `<text x="14" y="${403 + i * 18}" font-size="13" font-weight="600" fill="${ink.c}" data-edit="note">${esc(
          i === 1 && lines.length > 2 ? l + ' …' : l
        )}</text>`
      )
    );
  out.push(
    `<text x="14" y="443" font-size="12" font-weight="600" fill="${ink.c}" opacity=".7" data-edit="amin">আমিন: ${esc(
      r.amin
    )} · স্কেল ছাড়া হাতে আঁকা নকশা</text>`
  );

  /* উত্তর তীর — উপরের ডান কোণে */
  obs.push({ x: 312, y: 88, w: 40, h: 56, a: 0 });
  out.push(`<g stroke="${ink.c}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="${rough(312, 112, 312, 70, rnd, R, 0.6)}"/><path d="M304 80 L312 66 L320 80" fill="${ink.c}" fill-opacity=".85"/></g>
    <text x="312" y="124" font-size="13" font-weight="800" fill="${ink.c}" text-anchor="middle" dominant-baseline="central">উত্তর</text>`);

  /* চৌহদ্দি — চার কিনারায় */
  if (o.chau) {
    const cx = (MAP.x0 + MAP.x1) / 2;
    const cy = (FIT.y0 + FIT.y1) / 2;
    const pos: [number, number, number][] = [
      [cx, MAP.y0 + 12, 0],
      [MAP.x1 - 11, cy, Math.PI / 2],
      [cx, MAP.y1 - 12, 0],
      [MAP.x0 + 11, cy, -Math.PI / 2],
    ];
    r.nb.forEach((n, i) => {
      if (!n || !n.trim()) return;
      const L = mk(`${SIDE_DIR[i]}: ${n.trim()}`, 13, 700, ...pos[i], 'nb' + i);
      obs.push(L);
      out.push(text(L, 'opacity=".85"'));
    });
  }

  /* মাঝের বাক্স (নাম / দাগ / শতক) */
  const dec = r.sq / 435.6;
  const rows: [string, number, number, string][] = [
    [r.name || '—', 15, 800, 'name'],
    ['দাগ: ' + (r.dag || '—'), 13, 700, 'dag'],
    [fmtNum(dec) + ' শতক', 14, 800, 'area'],
  ];
  const bw = Math.max(...rows.map((x) => measure(x[0], x[1], x[2]))) + 12;
  const bh = 58;
  const fits = (L: Box, P: Pt[], E: [Pt, Pt][]) =>
    corners(L).every((c) => inside(c, P)) && !E.some(([p, q]) => segHit(L, p, q)) && !obs.some((b) => overlap(L, b));
  const cand: Pt[] = [[0, 0]];
  for (let rr = 6; rr < 80; rr += 6)
    for (let k = 0; k < 8; k++) cand.push([Math.cos((k * Math.PI) / 4) * rr, Math.sin((k * Math.PI) / 4) * rr]);

  const layout = (F: typeof FIT) => {
    const xs = r.pts.map((p) => p[0]);
    const ys = r.pts.map((p) => p[1]);
    const bx0 = Math.min(...xs);
    const bx1 = Math.max(...xs);
    const by0 = Math.min(...ys);
    const by1 = Math.max(...ys);
    const sc = Math.min((F.x1 - F.x0) / (bx1 - bx0 || 1), (F.y1 - F.y0) / (by1 - by0 || 1));
    const ox = (F.x0 + F.x1) / 2 - ((bx0 + bx1) / 2) * sc;
    const oy = (F.y0 + F.y1) / 2 - ((by0 + by1) / 2) * sc;
    const P: Pt[] = r.pts.map(([x, y]) => [ox + x * sc, oy + y * sc]);
    const E: [Pt, Pt][] = P.map((p, i) => [p, P[(i + 1) % P.length]]);
    let gx = 0;
    let gy = 0;
    let s2 = 0;
    E.forEach(([p, q]) => {
      const f = p[0] * q[1] - q[0] * p[1];
      gx += (p[0] + q[0]) * f;
      gy += (p[1] + q[1]) * f;
      s2 += f;
    });
    const G: Pt = s2 ? [gx / (3 * s2), gy / (3 * s2)] : [(F.x0 + F.x1) / 2, (F.y0 + F.y1) / 2];
    let blk: Box | null = null;
    for (const [dx, dy] of cand) {
      const L = { x: G[0] + dx, y: G[1] + dy, w: bw, h: bh, a: 0 };
      if (fits(L, P, E)) {
        blk = L;
        break;
      }
    }
    return { P, E, G, blk };
  };

  /* নাম জমির ভেতরে না ধরলে নকশা একটু ছোট করে নাম পাশে */
  let LY = layout(FIT);
  if (!LY.blk) LY = layout({ x0: FIT.x0 - 6, y0: FIT.y0, x1: FIT.x1 - bw - 8, y1: FIT.y1 });
  const outside = !LY.blk;
  const { P, E, G } = LY;
  const pathD = 'M' + P.map((p) => p.map((v) => v.toFixed(1)).join(',')).join('L') + 'Z';
  out.push(`<clipPath id="cl${uid}"><path d="${pathD}"/></clipPath>`);
  out.push(`<path d="${pathD}" fill="${ink.c}" fill-opacity=".05"/>`);
  if (o.hatch) {
    const px0 = Math.min(...P.map((p) => p[0]));
    const px1 = Math.max(...P.map((p) => p[0]));
    const py0 = Math.min(...P.map((p) => p[1]));
    const py1 = Math.max(...P.map((p) => p[1]));
    let h = '';
    for (let k = px0 - (py1 - py0); k < px1; k += 11) h += rough(k, py1, k + (py1 - py0), py0, rnd, R, 0.7);
    out.push(`<path d="${h}" stroke="${ink.c}" stroke-width=".9" fill="none" opacity=".28" clip-path="url(#cl${uid})"/>`);
  }
  out.push(
    `<g stroke="${ink.c}" stroke-width="${ink.w}" fill="none" stroke-linecap="round" opacity="${ink.op}">${E.map(
      ([p, q]) => `<path d="${rough(p[0], p[1], q[0], q[1], rnd, R)}"/>`
    ).join('')}</g>`
  );
  out.push(P.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="${ink.c}"/>`).join(''));

  const cost = (L: Box) => {
    let c = 0;
    if (!inMap(L)) c += 1000;
    for (const b of obs) if (overlap(L, b)) c += 100;
    for (const [p, q] of E) if (segHit(L, p, q)) c += 100;
    return c;
  };

  let blk = LY.blk;
  if (!blk) {
    const px0 = Math.min(...P.map((p) => p[0]));
    const px1 = Math.max(...P.map((p) => p[0]));
    let best: Box | null = null;
    let bc = 1e9;
    for (const side of [1, -1])
      for (const dy of [0, -40, 40, -80, 80])
        for (const gap of [34, 26, 44, 18, 56]) {
          const L = { x: side > 0 ? px1 + gap + bw / 2 : px0 - gap - bw / 2, y: G[1] + dy, w: bw, h: bh, a: 0 };
          const c = cost(L) + Math.abs(dy) * 0.1 + gap * 0.05;
          if (c < bc) {
            bc = c;
            best = L;
          }
        }
    blk = best as Box;
  }
  obs.push(blk);
  if (outside) {
    const dx = G[0] - blk.x;
    const dy = G[1] - blk.y;
    const t = Math.min(Math.abs(blk.w / 2 / (dx || 1e-6)), Math.abs(blk.h / 2 / (dy || 1e-6)));
    const sx = blk.x + dx * t * 1.06;
    const sy = blk.y + dy * t * 1.06;
    const ln = Math.hypot(dx, dy) || 1;
    out.push(
      `<path d="${rough(sx, sy, G[0] - (dx / ln) * 4, G[1] - (dy / ln) * 4, rnd, R, 0.6)}" stroke="${ink.c}" stroke-width="1.3" fill="none" stroke-dasharray="4 4"/><circle cx="${G[0].toFixed(
        1
      )}" cy="${G[1].toFixed(1)}" r="3.5" fill="${ink.c}"/>`
    );
    out.push(
      `<rect x="${(blk.x - blk.w / 2).toFixed(1)}" y="${(blk.y - blk.h / 2).toFixed(1)}" width="${blk.w.toFixed(1)}" height="${blk.h}" rx="10" fill="${paper}" stroke="${ink.c}" stroke-width="1.2"/>`
    );
  }
  rows.forEach(([t, s, w, k], i) =>
    out.push(text({ t, size: s, weight: w, x: blk!.x, y: blk!.y - 18 + i * 18, a: 0, w: 0, h: 0, key: k }))
  );

  /* বাহুর মাপ — দাগের পাশে, বাইরে; দাগ বা অন্য লেখার উপর নয় */
  E.forEach(([p, q], i) => {
    if (!(r.len[i] > 0)) return;
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    let n: Pt = [dy / len, -dx / len];
    const mid: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (inside([mid[0] + n[0] * 4, mid[1] + n[1] * 4], P)) n = [-n[0], -n[1]];
    let a = Math.atan2(dy, dx);
    if (a > Math.PI / 2) a -= Math.PI;
    if (a < -Math.PI / 2) a += Math.PI;
    if (Math.abs(a) > Math.PI / 3) a = 0; // খাড়া বাহু → লেখা সোজা, পড়তে সহজ
    const t = ftInBn(r.len[i]);
    const w = measure(t, 14, 800) + 8;
    const h = 22;
    const ext =
      (Math.abs(n[0] * Math.cos(a) + n[1] * Math.sin(a)) * w) / 2 +
      (Math.abs(-n[0] * Math.sin(a) + n[1] * Math.cos(a)) * h) / 2;
    let best: Label | null = null;
    let bc = 1e9;
    let idx = 0;
    outer: for (const off of [2, 8, 15, 24, 34].map((v) => v + ext))
      for (const tt of [0.5, 0.4, 0.6, 0.3, 0.7, 0.22, 0.78]) {
        const L: Label = { t, size: 14, weight: 800, x: p[0] + dx * tt + n[0] * off, y: p[1] + dy * tt + n[1] * off, w, h, a, key: 'len' };
        const c = cost(L) + idx++ * 0.01;
        if (c < bc) {
          bc = c;
          best = L;
        }
        if (c < 1) break outer;
      }
    if (best) {
      obs.push(best);
      out.push(text(best));
    }
  });

  out.push('</g>');
  return out.join('');
}

/** ছোট থাম্বনেইল (তালিকার জন্য) */
export function thumbPoints(pts: Pt[], size = 44, pad = 4): string {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const s = (size - pad * 2) / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1);
  return pts.map(([x, y]) => `${(pad + (x - Math.min(...xs)) * s).toFixed(1)},${(pad + (y - Math.min(...ys)) * s).toFixed(1)}`).join(' ');
}

/** কলমের নমুনা (টাইলে) */
export function styleSample(roughOn: boolean, ink: InkKey) {
  const rnd = mulberry(7);
  return `<path d="${rough(6, 24, 50, 22, rnd, roughOn, 1.2)}${rough(6, 24, 14, 6, rnd, roughOn, 1.2)}${rough(
    14,
    6,
    48,
    8,
    rnd,
    roughOn,
    1.2
  )}" stroke="${INK[ink].c}" stroke-width="${INK[ink].w}" fill="none" stroke-linecap="round"/>`;
}
