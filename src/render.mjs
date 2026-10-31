import { THEMES } from './themes.mjs';

// Layout
export const PITCH = 15; // px per day cell
const X0 = 34;
const Y0 = 72;
const ROWS = 7;

// Timeline (fractions of one loop). The ghost sweeps the graph from SWEEP_START to
// SWEEP_END, dives into the longest streak, then sinks. Everything resets at 1.
const SWEEP_START = 0.035;
const SWEEP_END = 0.74;
const DIVE = 0.85;
const SINK = 0.93;

const f = (n) => String(+Number(n).toFixed(2));
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

// Linear keyframe lookup, used for static frames (`at`) so frames match the SMIL timeline.
function lerp(kt, vals, t) {
  if (t <= kt[0]) return vals[0];
  for (let i = 1; i < kt.length; i++) {
    if (t <= kt[i]) {
      const k = (t - kt[i - 1]) / (kt[i] - kt[i - 1] || 1);
      return vals[i - 1].map((v, j) => v + (vals[i][j] - v) * k);
    }
  }
  return vals[vals.length - 1];
}

const keyTimes = (kt) => kt.map(f).join(';');
const keyVals = (vals) => vals.map((v) => v.map(f).join(' ')).join(';');

// <g> whose transform follows keyframes (animated) or sits at time `at` (frame mode).
function motion(type, kt, vals, dur, at, inner) {
  if (at === undefined) {
    return `<g><animateTransform attributeName="transform" type="${type}" dur="${dur}s" repeatCount="indefinite" keyTimes="${keyTimes(kt)}" values="${keyVals(vals)}"/>${inner}</g>`;
  }
  return `<g transform="${type}(${lerp(kt, vals, at).map(f).join(' ')})">${inner}</g>`;
}

function fade(kt, vals, dur, at, inner) {
  if (at === undefined) {
    return `<g><animate attributeName="opacity" dur="${dur}s" repeatCount="indefinite" keyTimes="${keyTimes(kt)}" values="${keyVals(vals)}"/>${inner}</g>`;
  }
  return `<g opacity="${f(lerp(kt, vals, at)[0])}">${inner}</g>`;
}

export function analyse(weeks) {
  const days = weeks.flatMap((wk, w) => wk.map((d, i) => ({ ...d, w, row: d.weekday ?? i })));
  let best = { len: 0, start: 0 };
  let cur = 0;
  let start = 0;
  days.forEach((d, i) => {
    if (d.count > 0) {
      if (cur === 0) start = i;
      cur++;
      if (cur > best.len) best = { len: cur, start };
    } else cur = 0;
  });
  const mid = best.len ? days[best.start + Math.floor((best.len - 1) / 2)] : null;
  return { days, total: days.reduce((s, d) => s + d.count, 0), streak: best.len, mid };
}

/**
 * @param {object} o
 * @param {Array<Array<{date:string,count:number,level:number,weekday:number}>>} o.weeks
 * @param {string} o.username
 * @param {'dark'|'light'} [o.theme]
 * @param {number} [o.duration] loop length in seconds
 * @param {number} [o.at] 0..1 → render a single static frame instead of an animation
 */
export function render({ weeks, username, theme = 'dark', duration = 28, at }) {
  const T = THEMES[theme] ?? THEMES.dark;
  const animated = at === undefined;
  const n = weeks.length;
  const W = X0 + n * PITCH + 30;
  const H = Y0 + ROWS * PITCH + 52;
  const { total, streak, mid } = analyse(weeks);
  const rand = rng(hash(username));

  const cx = (w) => X0 + w * PITCH + PITCH / 2;
  const base = (row) => Y0 + row * PITCH + PITCH - 1;
  const riseAt = (w) => Math.max(0.012, SWEEP_START + (SWEEP_END - SWEEP_START) * (n > 1 ? w / (n - 1) : 0) - 0.008);
  const ghostY = (w) => Y0 + 50 + Math.sin(w * 0.42) * 30;

  // ───────────────────────── defs ─────────────────────────
  const radial = (id, color, op) =>
    `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${op}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;

  const defs = `<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.skyTop}"/><stop offset="1" stop-color="${T.skyBottom}"/></linearGradient>
${radial('gPumpkin', T.glow, 0.85)}${radial('gGhost', T.ghostGlow, 0.5)}${radial('gMoon', T.moonGlow, 0.35)}${radial('gFog', T.fog, T.fogOpacity)}
<clipPath id="frame"><rect width="${W}" height="${H}" rx="14"/></clipPath>
<g id="t1"><path d="M-4.5 0V-3.5Q-4.5 -7 0 -7Q4.5 -7 4.5 -3.5V0Z" fill="${T.stone[0]}" stroke="${T.stoneEdge}" stroke-width=".7"/></g>
<g id="t2"><path d="M-5 0V-7A5 5 0 0 1 5 -7V0Z" fill="${T.stone[1]}" stroke="${T.stoneEdge}" stroke-width=".7"/><path d="M0 -10.3V-5M-2.3 -8.3H2.3" stroke="${T.carve}" stroke-width="1.1" fill="none"/></g>
<g id="t3"><path d="M-5.6 0V-7.6A5.6 5.6 0 0 1 5.6 -7.6V0Z" fill="${T.stone[2]}" stroke="${T.stoneEdge}" stroke-width=".7"/><path d="M0 -11.8V-5.6M-2.6 -9.6H2.6" stroke="${T.carve}" stroke-width="1.2" fill="none"/><path d="M-3 -2.2H3" stroke="${T.carve}" stroke-width=".8"/></g>
<g id="t4"><ellipse cx="-3.7" cy="-5.6" rx="3.5" ry="5" fill="${T.pumpkinDark}"/><ellipse cx="3.7" cy="-5.6" rx="3.5" ry="5" fill="${T.pumpkinDark}"/><ellipse cx="0" cy="-5.6" rx="4.4" ry="5.3" fill="${T.pumpkin}"/><path d="M-.9 -10.8L-.5 -13.4H1.2L.9 -10.8Z" fill="${T.stem}"/><path d="M-3.5 -7.2L-1.6 -7.2L-2.55 -8.9ZM1.6 -7.2L3.5 -7.2L2.55 -8.9ZM-3.2 -4.4L-1.6 -3.2L0 -4.2L1.6 -3.2L3.2 -4.4L1.8 -5.6H-1.8Z" fill="${T.face}"/></g>
<g id="bat"><path d="M0 0C-3 -4 -7 -4 -11 -1C-8 -1 -7 1 -5 3C-4 1 -2 1 0 3C2 1 3 1 5 3C7 1 8 -1 11 -1C7 -4 3 -4 0 0Z" fill="${T.bat}" stroke="${T.batEdge}" stroke-width=".6"/></g>
</defs>`;

  // ───────────────────────── sky ─────────────────────────
  let stars = '';
  for (let i = 0; i < 80; i++) {
    const x = rand() * W;
    const y = rand() * (H - 30);
    const r = 0.45 + rand() * 0.95;
    const op = y < Y0 - 8 ? 0.85 : 0.35;
    const tw = animated
      ? `<animate attributeName="opacity" values="${f(op * 0.25)};${f(op)};${f(op * 0.25)}" dur="${f(2 + rand() * 4)}s" begin="-${f(rand() * 5)}s" repeatCount="indefinite"/>`
      : '';
    stars += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${T.star}" opacity="${f(op)}">${tw}</circle>`;
  }

  const moon = `<g transform="translate(${W - 66} 36)"><circle r="38" fill="url(#gMoon)"/><path d="M0 -17A17 17 0 1 0 0 17A22 22 0 0 1 0 -17Z" fill="${T.moon}"/></g>`;

  // ───────────────────────── graveyard ─────────────────────────
  let ground = '';
  let graves = '';
  weeks.forEach((wk, w) => {
    wk.forEach((d, i) => {
      const row = d.weekday ?? i;
      const x = cx(w);
      const by = base(row);
      ground += `<ellipse cx="${f(x)}" cy="${f(by - 0.4)}" rx="${d.level > 0 ? 5.6 : 2.4}" ry="${d.level > 0 ? 1.5 : 0.9}" fill="${T.shadow}"/>`;
      if (d.level === 0) return;

      let inner = '';
      if (d.level === 4) {
        const flick = animated
          ? `<animate attributeName="opacity" values=".5;1;.65;.95;.5" dur="${f(1.3 + rand() * 1.4)}s" begin="-${f(rand() * 2)}s" repeatCount="indefinite"/>`
          : '';
        inner += `<circle cy="-6" r="13" fill="url(#gPumpkin)">${flick}</circle>`;
      }
      inner += `<use href="#t${d.level}"/>`;
      if (d.level === 3) {
        const flick = animated
          ? `<animate attributeName="opacity" values=".45;1;.6;.9;.45" dur="${f(0.9 + rand() * 1.1)}s" begin="-${f(rand())}s" repeatCount="indefinite"/>`
          : '';
        inner += `<path d="M0 -22.5Q2.5 -18.6 0 -15.6Q-2.5 -18.6 0 -22.5Z" fill="${T.wisp}">${flick}</path>`;
      }

      const r = riseAt(w);
      const kt = [0, r, r + 0.02, r + 0.035, 0.93, 0.97, 1];
      const sc = [[1, 0], [1, 0], [1.14, 1.2], [1, 1], [1, 1], [1, 0], [1, 0]];
      const label = `${d.count} contribution${d.count === 1 ? '' : 's'} on ${d.date}`;
      graves += `<g transform="translate(${f(x)} ${f(by)})"><title>${esc(label)}</title>${motion('scale', kt, sc, duration, at, inner)}</g>`;
    });
  });

  // ───────────────────────── fog ─────────────────────────
  const fogY = Y0 + ROWS * PITCH - 8;
  const fogDrift = (cxv, rx, ry, dx, dy, d) =>
    animated
      ? `<ellipse cx="${f(cxv)}" cy="${f(fogY)}" rx="${rx}" ry="${ry}" fill="url(#gFog)"><animateTransform attributeName="transform" type="translate" values="0 0;${dx} ${dy};0 0" dur="${f(d)}s" repeatCount="indefinite"/></ellipse>`
      : `<ellipse cx="${f(cxv + dx / 2)}" cy="${f(fogY + dy / 2)}" rx="${rx}" ry="${ry}" fill="url(#gFog)"/>`;
  const fog = fogDrift(W * 0.3, 210, 30, 80, -4, duration / 2) + fogDrift(W * 0.78, 170, 26, -90, 3, duration / 4);

  // ───────────────────────── bats ─────────────────────────
  const batRuns = [
    { t0: 0.1, t1: 0.3, y0: 30, y1: 22, left: true },
    { t0: 0.46, t1: 0.66, y0: 20, y1: 40, left: false },
    { t0: 0.7, t1: 0.9, y0: 44, y1: 26, left: true },
  ];
  const bats = batRuns
    .map((b) => {
      const xa = b.left ? -30 : W + 30;
      const xb = b.left ? W + 30 : -30;
      const flap = animated
        ? `<g><animateTransform attributeName="transform" type="scale" values="1 1;1 .4;1 1" dur="0.38s" repeatCount="indefinite"/><use href="#bat"/></g>`
        : '<use href="#bat"/>';
      return motion('translate', [0, b.t0, b.t1, 1], [[xa, b.y0], [xa, b.y0], [xb, b.y1], [xb, b.y1]], duration, at, flap);
    })
    .join('');

  // ───────────────────────── ghost ─────────────────────────
  const sx = mid ? cx(mid.w) : W / 2;
  const sy = mid ? base(mid.row) - 6 : Y0 + 50;
  const pts = [[0, X0 - 34, ghostY(0)]];
  for (let w = 0; w < n; w++) pts.push([SWEEP_START + (SWEEP_END - SWEEP_START) * (n > 1 ? w / (n - 1) : 0), cx(w), ghostY(w)]);
  pts.push([DIVE, sx, sy - 16], [SINK, sx, sy + 5], [1, sx, sy + 5]);
  const gKt = pts.map((p) => p[0]);
  const gVals = pts.map((p) => [p[1], p[2]]);

  const eyeBlink = animated
    ? '<animate attributeName="ry" values="2.6;2.6;.2;2.6;2.6" keyTimes="0;.46;.5;.54;1" dur="4.2s" repeatCount="indefinite"/>'
    : '';
  const mouth = animated ? '<animate attributeName="ry" values="2.8;1.5;2.8" dur="1.3s" repeatCount="indefinite"/>' : '';
  const ghostArt = `<circle r="26" fill="url(#gGhost)"/><path d="M-11 10V-3A11 11 0 0 1 11 -3V10Q7.33 15 3.67 10T-3.67 10T-11 10Z" fill="${T.ghost}" stroke="${T.ghostEdge}" stroke-width="1"/><ellipse cx="-4" cy="-3.5" rx="2" ry="2.6" fill="${T.ghostEye}">${eyeBlink}</ellipse><ellipse cx="4" cy="-3.5" rx="2" ry="2.6" fill="${T.ghostEye}">${eyeBlink}</ellipse><ellipse cx="0" cy="3" rx="2" ry="2.8" fill="${T.ghostEye}">${mouth}</ellipse>`;
  const bob = animated
    ? `<g><animateTransform attributeName="transform" type="translate" values="0 -2;0 2;0 -2" dur="1.6s" repeatCount="indefinite"/>${ghostArt}</g>`
    : `<g>${ghostArt}</g>`;
  const sunk = motion('scale', [0, DIVE, SINK, 1], [[1, 1], [1, 1], [0.25, 0.25], [0.25, 0.25]], duration, at, bob);
  const faded = fade([0, SWEEP_START, 0.88, SINK, 1], [[0], [1], [1], [0], [0]], duration, at, sunk);
  const ghost = motion('translate', gKt, gVals, duration, at, faded);

  // glow where the longest streak is buried
  const ring = mid
    ? fade([0, 0.8, 0.86, 0.93, 0.97, 1], [[0], [0], [0.9], [0.9], [0], [0]], duration, at,
        `<circle cx="${f(sx)}" cy="${f(sy)}" r="26" fill="url(#gPumpkin)"/>`)
    : '';

  // ───────────────────────── text ─────────────────────────
  const font = `font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace"`;
  const plural = (k, w) => `${k} ${w}${k === 1 ? '' : 's'}`;
  const title = `<text x="${X0}" y="31" ${font} font-size="13" font-weight="700" letter-spacing="2.5" fill="${T.text}">The graveyard of @${esc(username)}</text>`;
  const stats = `<text x="${X0}" y="${H - 17}" ${font} font-size="11" fill="${T.textDim}">${plural(total, 'contribution')} buried   |   longest haunting: ${plural(streak, 'day')}</text>`;
  const legendY = H - 17;
  const legend =
    `<text x="${W - 150}" y="${legendY}" ${font} font-size="10" fill="${T.textDim}" text-anchor="end">fewer</text>` +
    [1, 2, 3, 4].map((l, i) => `<use href="#t${l}" transform="translate(${W - 132 + i * 22} ${legendY + 1}) scale(.9)"/>`).join('') +
    `<text x="${W - 54}" y="${legendY}" ${font} font-size="10" fill="${T.textDim}">more</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Animated Halloween contribution graph for ${esc(username)}: a ghost drifts over the graph and every contribution becomes a tombstone or a glowing pumpkin.">
${defs}
<g clip-path="url(#frame)">
<rect width="${W}" height="${H}" fill="url(#sky)"/>
${stars}${moon}${bats}${title}
${ground}${graves}${fog}${ring}${ghost}
${stats}${legend}
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="none" stroke="${T.border}"/>
</svg>
`;
}
