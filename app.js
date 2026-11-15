import { firebaseConfig, UNLOCK_AT } from './firebase-config.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const treeId = params.get('tree');
const UNLOCK = new Date(UNLOCK_AT).getTime();
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

const INK = '#5e4636';
const HUES = ['#c9584c', '#e3b04b', '#8fb39a', '#8fb4cf', '#b79ac0', '#f6ead2'];
const HUE_NAMES = ['Berry', 'Mustard', 'Sage', 'Dusty blue', 'Mauve', 'Cream'];
const SHAPE_NAMES = ['Bauble', 'Star', 'Heart', 'Moon', 'Snowflake', 'Gem', 'Bell', 'Candy cane', 'Gingerbread', 'Mitten'];
const TREES = [
  { n: 'Evergreen', a: '#73996a', b: '#587d53' }, { n: 'Sage', a: '#adc6a8', b: '#8dab8b' },
  { n: 'Olive', a: '#8a9655', b: '#6c7940' }, { n: 'Blossom', a: '#ecbcc2', b: '#d6989f' },
  { n: 'Snow', a: '#f7f4ea', b: '#d8d5c6' }, { n: 'Dusty blue', a: '#a3bccd', b: '#829fb3' },
  { n: 'Mauve', a: '#c6aecb', b: '#a78dad' },
];
const LIGHTS = [
  { n: 'Warm', p: ['#f2cf7a', '#fbeecb'] }, { n: 'Rainbow', p: HUES.slice(0, 5) },
  { n: 'Candy', p: ['#e39aa6', '#fffaf0', '#c9584c'] }, { n: 'Icy', p: ['#bcd6e6', '#fffaf0', '#8fb4cf'] },
];
const TOPPERS = ['Star', 'Heart', 'Bow', 'Snowflake'];
const EXTRAS = ['Presents', 'Snowman', 'Fairy lights', 'Sleepy cat', 'Lantern', 'Hot cocoa', 'Snowy branches'];
const DEFAULT_LOOK = { scene: 0, tree: 0, lights: 0, topper: 0, extras: [0, 2, 6] };
const SHOW = [
  DEFAULT_LOOK, { scene: 3, tree: 2, lights: 0, topper: 0, extras: [0, 3, 5] }, { scene: 1, tree: 0, lights: 2, topper: 2, extras: [6] },
  { scene: 4, tree: 1, lights: 1, topper: 0, extras: [0, 1, 2, 6] }, { scene: 2, tree: 4, lights: 2, topper: 1, extras: [0, 4] }, { scene: 5, tree: 5, lights: 3, topper: 3, extras: [1, 6] },
];
let look = { ...DEFAULT_LOOK };

/* ───────────── storage: Firebase when configured, this browser otherwise ───────────── */

async function firebaseStore() {
  const base = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const [{ initializeApp }, A, F] = await Promise.all([
    import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js'),
  ]);
  const app = initializeApp(firebaseConfig), auth = A.getAuth(app), db = F.getFirestore(app);
  const orn = (id, oid) => F.doc(db, 'trees', id, 'ornaments', oid);
  const msg = (id, oid) => F.doc(db, 'trees', id, 'messages', oid);
  return {
    demo: false,
    onAuth: cb => A.onAuthStateChanged(auth, u => cb(u ? { uid: u.uid, name: u.displayName || '' } : null)),
    signIn: () => A.signInWithPopup(auth, new A.GoogleAuthProvider()),
    signOut: () => A.signOut(auth),
    getTree: async id => { const s = await F.getDoc(F.doc(db, 'trees', id)); return s.exists() ? s.data() : null; },
    saveTree: (uid, name, lk) => F.setDoc(F.doc(db, 'trees', uid), { name, look: lk, at: F.serverTimestamp() }),
    watch: (id, cb) => F.onSnapshot(
      F.query(F.collection(db, 'trees', id, 'ornaments'), F.orderBy('at')),
      s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))),
      e => toast(e.message)),
    add: async (id, o, text) => {
      const ref = F.doc(F.collection(db, 'trees', id, 'ornaments')), b = F.writeBatch(db);
      b.set(ref, { ...o, at: F.serverTimestamp() });
      b.set(msg(id, ref.id), { text });
      await b.commit();
      return ref.id;
    },
    read: async (id, oid) => { const s = await F.getDoc(msg(id, oid)); return s.exists() ? s.data().text : ''; },
    remove: async (id, oid) => { const b = F.writeBatch(db); b.delete(orn(id, oid)); b.delete(msg(id, oid)); await b.commit(); },
  };
}

function demoStore() {
  const KEY = 'evergleam-demo';
  let d; try { d = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { d = {}; }
  d.trees ||= {}; d.orn ||= {}; d.msg ||= {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} };
  const authCbs = [], watchers = {};
  const ping = id => (watchers[id] || []).forEach(cb => cb([...(d.orn[id] || [])]));
  return {
    demo: true,
    onAuth: cb => { authCbs.push(cb); queueMicrotask(() => cb(d.user || null)); },
    signIn: async () => { d.user = { uid: 'demo-' + Math.random().toString(36).slice(2, 8), name: '' }; save(); authCbs.forEach(cb => cb(d.user)); },
    signOut: async () => { delete d.user; save(); authCbs.forEach(cb => cb(null)); },
    getTree: async id => d.trees[id] || null,
    saveTree: async (uid, name, lk) => { d.trees[uid] = { name, look: lk }; save(); },
    watch: (id, cb) => { (watchers[id] ||= []).push(cb); queueMicrotask(() => ping(id)); },
    add: async (id, o, text) => {
      const oid = Math.random().toString(36).slice(2, 10);
      (d.orn[id] ||= []).push({ id: oid, ...o }); (d.msg[id] ||= {})[oid] = text; save(); ping(id); return oid;
    },
    read: async (id, oid) => d.msg[id]?.[oid] || '',
    remove: async (id, oid) => { d.orn[id] = (d.orn[id] || []).filter(o => o.id !== oid); delete d.msg[id]?.[oid]; save(); ping(id); },
  };
}

/* ───────────── drawing kit ───────────── */

const cv = $('sky'); let c = cv.getContext('2d');
let W = 0, H = 0, S = 1, dpr = 1, cx = 0, topY = 0, TH = 0, R = 0, groundY = 0, spread = 0, hh = 0;
let rot = 0, vel = 0, last = 0, drag = null;
const BASE = calm ? .05 : .32, TAU = Math.PI * 2, rnd = Math.random;
const pr = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const dark = h => '#' + [1, 3, 5].map(i => Math.round(parseInt(h.slice(i, i + 2), 16) * .72).toString(16).padStart(2, '0')).join('');

const sprites = {};
function sprite(col) {
  if (sprites[col]) return sprites[col];
  const s = document.createElement('canvas'); s.width = s.height = 64;
  const g = s.getContext('2d'), rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, col); rg.addColorStop(.25, col + '99'); rg.addColorStop(.6, col + '2a'); rg.addColorStop(1, col + '00');
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  return sprites[col] = s;
}
const ribbons = ['#3dffb4', '#4aa8ff', '#b97bff'].map(col => {
  const s = document.createElement('canvas'); s.width = 1; s.height = 64;
  const g = s.getContext('2d'), lg = g.createLinearGradient(0, 0, 0, 64);
  lg.addColorStop(0, col + '00'); lg.addColorStop(.18, col + 'ff'); lg.addColorStop(1, col + '00');
  g.fillStyle = lg; g.fillRect(0, 0, 1, 64); return s;
});

const mix = (h, to, m) => '#' + [1, 3, 5].map(i => Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - m) + parseInt(to.slice(i, i + 2), 16) * m).toString(16).padStart(2, '0')).join('');
TREES.forEach(T => { T.c = mix(T.a, '#fffaf0', .3); T.d = dark(T.b); });
// Everything painted on the scene is pulled toward one soft, warm palette.
const RAWC = new Set([INK, '#e9c46a', '#d98880', ...HUES, ...TREES.flatMap(T => [T.a, T.b, T.c, T.d]), ...LIGHTS.flatMap(l => l.p)]);
const toned = {};
function tone(col) {
  if (typeof col !== 'string' || col[0] !== '#' || col.length !== 7 || RAWC.has(col)) return col;
  if (toned[col]) return toned[col];
  const v = [1, 3, 5].map(i => parseInt(col.slice(i, i + 2), 16)), l = .3 * v[0] + .59 * v[1] + .11 * v[2], P = [240, 228, 206];
  return toned[col] = '#' + v.map((x, i) => Math.round((x + (l - x) * .36) * .86 + P[i] * .14).toString(16).padStart(2, '0')).join('');
}
const tonedCtx = new WeakSet();
function toneCtx(ctx) {
  if (tonedCtx.has(ctx)) return; tonedCtx.add(ctx);
  for (const prop of ['fillStyle', 'strokeStyle']) {
    const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, prop);
    Object.defineProperty(ctx, prop, { get() { return d.get.call(this); }, set(v) { d.set.call(this, tone(v)); } });
  }
}
toneCtx(c);
const rgba = (h, a) => `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;
const grain = (() => {
  const g0 = document.createElement('canvas'); g0.width = g0.height = 220; const g = g0.getContext('2d');
  for (let i = 0; i < 3600; i++) { g.fillStyle = i % 2 ? 'rgba(90,60,40,.045)' : 'rgba(255,255,255,.09)'; g.fillRect(rnd() * 220, rnd() * 220, 1 + rnd() * 1.6, 1 + rnd() * 1.6); }
  return g0;
})();
let grainPat;

function paint(fill, lw = 2.1, stroke = INK) {
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (lw) { c.strokeStyle = stroke; c.lineWidth = lw * S; c.lineJoin = c.lineCap = 'round'; c.stroke(); }
}
const circ = (x, y, r) => { c.beginPath(); c.arc(x, y, Math.max(0, r), 0, TAU); };
const ell = (x, y, rx, ry, a = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), a, 0, TAU); };
const box = (x, y, w, h, r = 0) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
const line = (...p) => { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); };
const arcS = (x, y, r, a0, a1, lw = 1.8) => { c.beginPath(); c.arc(x, y, r, a0, a1); paint(null, lw); };
const dot = (x, y, r, col = INK) => { circ(x, y, r); c.fillStyle = col; c.fill(); };
function grad(y0, y1, stops) { const g = c.createLinearGradient(0, y0, 0, y1); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), tone(s))); return g; }
function glow(x, y, r, col, a = 1) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.max(0, a); c.drawImage(sprite(col), x - r, y - r, r * 2, r * 2); c.restore(); }
function sparkle(x, y, r, col) { c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, q = i % 2 ? r * .32 : r; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); c.fillStyle = col; c.fill(); }

function sky(stops) { c.fillStyle = grad(0, groundY, stops); c.fillRect(0, 0, W, H); }
function starsDraw(t, maxY) {
  for (let i = 0; i < 70; i++) {
    const x = pr(i) * W, y = pr(i + 99) * maxY;
    c.globalAlpha = .35 + .65 * Math.abs(Math.sin(t * (.6 + pr(i + 7)) + i));
    if (i % 5 === 0) sparkle(x, y, (3.5 + pr(i) * 3) * S, '#fff6cf'); else dot(x, y, (.9 + pr(i + 3)) * S, '#fff');
  }
  c.globalAlpha = 1;
}
function moon(x, y, r) {
  glow(x, y, r * 3.4, '#fff1c9', .55); circ(x, y, r); paint('#fff4d2');
  dot(x + r * .42, y - r * .42, r * .15, 'rgba(226,196,150,.6)'); dot(x - r * .5, y + r * .45, r * .11, 'rgba(226,196,150,.6)');
  arcS(x - r * .3, y - r * .05, r * .13, .1 * Math.PI, .9 * Math.PI); arcS(x + r * .3, y - r * .05, r * .13, .1 * Math.PI, .9 * Math.PI);
  arcS(x, y + r * .18, r * .12, .15 * Math.PI, .85 * Math.PI);
  dot(x - r * .52, y + r * .2, r * .13, 'rgba(255,140,160,.45)'); dot(x + r * .52, y + r * .2, r * .13, 'rgba(255,140,160,.45)');
}
function hill(y, amp, f, ph, fill, lw = 2.5) {
  c.beginPath(); c.moveTo(-10, H + 10);
  for (let x = -10; x <= W + 30; x += 24) c.lineTo(x, y + Math.sin(x * f / S + ph) * amp + Math.sin(x * f * 2.7 / S + ph * 3) * amp * .3);
  c.lineTo(W + 10, H + 10); c.closePath(); paint(fill, lw);
}
function pine(x, y, h, col) {
  box(x - h * .04, y - h * .14, h * .08, h * .16, 2); paint('#8a5a3c', 2);
  for (let i = 0; i < 3; i++) {
    const by = y - h * .1 - i * h * .26, w = h * .5 * (1 - i * .26), th = h * .42;
    c.beginPath(); c.moveTo(x, by - th); c.lineTo(x + w / 2, by); c.quadraticCurveTo(x, by + th * .14, x - w / 2, by); c.closePath(); paint(col, 2);
    c.beginPath(); c.moveTo(x, by - th); c.lineTo(x + w * .17, by - th * .6); c.quadraticCurveTo(x, by - th * .48, x - w * .17, by - th * .6); c.closePath(); paint('#fff', 0);
  }
}
function pines(n, seed, y, col, hMin = 50, hVar = 40) { for (let i = 0; i < n; i++) pine(pr(i + seed) * W, y + pr(i + seed + 9) * 10 * S, (hMin + pr(i + seed + 5) * hVar) * S, col); }
function smoke(x, y, t) {
  for (let i = 0; i < 4; i++) {
    const p = (t * .22 + i / 4) % 1; c.globalAlpha = (1 - p) * .75;
    dot(x + Math.sin(p * 5 + i) * 7 * S + p * 16 * S, y - p * 74 * S, (5 + p * 11) * S, '#fff');
  }
  c.globalAlpha = 1;
}
function flame(x, y, s, t, k = 0) {
  const cols = ['#ff8a3d', '#e3b04b', '#fff3c4'];
  for (let i = 0; i < 3; i++) {
    const w = s * (1 - i * .28) * (1 + .08 * Math.sin(t * 9 + i * 2 + k)), h = s * 1.7 * (1 - i * .25) * (1 + .12 * Math.sin(t * 7 + i + k * 3)), sx = Math.sin(t * 5 + i + k) * s * .1;
    c.beginPath(); c.moveTo(x - w / 2, y); c.quadraticCurveTo(x - w * .75, y - h * .5, x + sx, y - h); c.quadraticCurveTo(x + w * .75, y - h * .5, x + w / 2, y); c.closePath(); paint(cols[i], i ? 0 : 2);
  }
}
function stringLights(x1, y1, x2, y2, sag, n, t, pal) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + sag * 2;
  c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo(mx, my, x2, y2); paint(null, 1.6);
  for (let i = 1; i < n; i++) {
    const u = i / n, x = (1 - u) * (1 - u) * x1 + 2 * u * (1 - u) * mx + u * u * x2, y = (1 - u) * (1 - u) * y1 + 2 * u * (1 - u) * my + u * u * y2 + 5 * S;
    const col = pal[i % pal.length]; glow(x, y, 14 * S, col, .3 + .35 * Math.sin(t * 3 + i * 1.7) ** 2);
    ell(x, y, 3.4 * S, 4.8 * S); paint(col, 1.4);
  }
}
function house(x, y, w, o = {}, t = 0) {
  const h = w * .6, rh = w * .5, lit = .82 + .18 * Math.sin(t * 2.3 + x);
  box(x + w * .2, y - h - rh * .82, w * .13, rh * .6, 2); paint(o.chim || '#b5654f');
  box(x + w * .18, y - h - rh * .9, w * .17, w * .06, 3); paint('#fff', 2);
  if (o.smoke) smoke(x + w * .265, y - h - rh * .95, t);
  box(x - w / 2, y - h, w, h, 4 * S); paint(o.body || '#f8e4cb');
  c.beginPath(); c.moveTo(x - w * .6, y - h + 2); c.lineTo(x, y - h - rh); c.lineTo(x + w * .6, y - h + 2); c.closePath(); paint(o.roof || '#c9584f');
  line(x - w * .6, y - h + 2, x, y - h - rh, x + w * .6, y - h + 2); paint(null, w * .1 / S + 4); paint(null, w * .1 / S, o.snow || '#fff');
  if (o.ice) for (let k = 0, xx = x - w * .55; xx < x + w * .56; xx += w * .052, k++) { const len = (5 + pr(k + x) * 10) * S; line(xx - 2.4 * S, y - h + 3, xx + 2.4 * S, y - h + 3, xx, y - h + 3 + len); c.closePath(); paint('#eef4f8', 1.1); }
  if (o.lights) { const pal = (LIGHTS[look.lights] || LIGHTS[0]).p; stringLights(x - w * .56, y - h + 8 * S, x, y - h - rh + 12 * S, 2 * S, 6, t, pal); stringLights(x, y - h - rh + 12 * S, x + w * .56, y - h + 8 * S, 2 * S, 6, t + .7, pal); }
  box(x - w * .09, y - h * .56, w * .18, h * .56, [w * .09, w * .09, 0, 0]); paint(o.door || '#8f4f3d');
  dot(x + w * .05, y - h * .26, w * .013);
  circ(x, y - h * .4, w * .042); paint(null, 3, '#3f9d68'); dot(x, y - h * .4 + w * .042, w * .014, '#c9584c');
  for (const sx of [-1, 1]) {
    const wx = x + sx * w * .3 - w * .09, wy = y - h * .68;
    glow(wx + w * .09, wy + w * .09, w * .32, '#e9c46a', .5 * lit);
    box(wx, wy, w * .18, w * .18, 3); paint('#ffe08a');
    line(wx + w * .09, wy, wx + w * .09, wy + w * .18); paint(null, 1.6); line(wx, wy + w * .09, wx + w * .18, wy + w * .09); paint(null, 1.6);
  }
  circ(x, y - h - rh * .36, w * .06); paint('#ffe08a', 2);
}
function cloud(x, y, s) { c.fillStyle = '#fff'; for (const [dx, dy, r] of [[0, 0, 1], [.95, .22, .72], [-.95, .25, .68], [.2, .35, .8]]) { circ(x + dx * s, y + dy * s, r * s); c.fill(); } }

/* ───────────── backgrounds ───────────── */

function mound() {
  const w = Math.min(R * 2.3, W * .48);
  ell(cx, groundY + 20 * S, w, 24 * S); c.fillStyle = 'rgba(140,155,175,.22)'; c.fill();
  ell(cx, groundY + 13 * S, w * .96, 22 * S); c.fillStyle = '#fffdf6'; c.fill();
  ell(cx - w * .3, groundY + 4 * S, w * .3, 7 * S); c.fillStyle = 'rgba(255,255,255,.9)'; c.fill();
}
function sceneCream(t) {
  c.fillStyle = '#f6f0e1'; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 46; i++) {
    const x = pr(i + 200) * W, y = pr(i + 230) * (groundY + 10 * S), k = i % 4;
    if (Math.abs(x - cx) < R * 1.15 && y > topY - 50 * S) continue;
    c.globalAlpha = .45 + .55 * Math.abs(Math.sin(t * (.4 + pr(i)) + i));
    if (k === 0) sparkle(x, y, (5 + pr(i) * 5) * S, '#e3b04b');
    else if (k === 1) { c.save(); c.translate(x, y); c.rotate((pr(i) - .5) * .8); shapePath(c, 2, 5 * S); c.fillStyle = '#8fb39a'; c.fill(); c.restore(); }
    else if (k === 2) { line(x - 4 * S, y - 4 * S, x + 4 * S, y + 4 * S); paint(null, 2.2, '#c9584c'); line(x + 4 * S, y - 4 * S, x - 4 * S, y + 4 * S); paint(null, 2.2, '#c9584c'); }
    else dot(x, y, 2.4 * S, '#d8b998');
  }
  c.globalAlpha = 1; mound();
}
function gingham(col) {
  return () => {
    c.fillStyle = '#f5f1e4'; c.fillRect(0, 0, W, H); c.fillStyle = col;
    const b = 50 * S;
    for (let x = (cx % (2 * b)) - 2.5 * b; x < W; x += 2 * b) c.fillRect(x, 0, b, H);
    for (let y = (groundY % (2 * b)) - 2.5 * b - 2 * b * 20; y < H; y += 2 * b) c.fillRect(0, y, W, b);
    mound();
  };
}
function shootingStar(t) {
  const n = Math.floor(t / 9), p = (t % 9) / .9; if (p > 1) return;
  const x = W * (.12 + pr(n) * .45) + p * 230 * S, y = H * (.05 + pr(n + 1) * .08) + p * 95 * S;
  const g = c.createLinearGradient(x - 80 * S, y - 33 * S, x, y); g.addColorStop(0, 'rgba(255,250,230,0)'); g.addColorStop(1, 'rgba(255,250,230,.95)');
  c.globalAlpha = Math.sin(p * Math.PI); c.strokeStyle = g; c.lineWidth = 2.2 * S; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - 80 * S, y - 33 * S); c.lineTo(x, y); c.stroke(); dot(x, y, 2.2 * S, '#fffaf0'); c.globalAlpha = 1;
}
function tinyHouse(x, y, w, t) {
  glow(x, y - w * .3, w * 1.7, '#e9c46a', .3 + .08 * Math.sin(t * 2));
  box(x - w / 2, y - w * .66, w, w * .66, 1.5 * S); paint('#c9c3dd', 1.3);
  line(x - w * .62, y - w * .64, x, y - w * 1.12, x + w * .62, y - w * .64); c.closePath(); paint('#f4f2fb', 1.3);
  box(x - w * .14, y - w * .46, w * .28, w * .24, S); paint('#f2cf7a', 0);
}
function bush(x, y, r) {
  circ(x - r * .55, y - r * .5, r * .68); paint('#587d53', 1.6); circ(x + r * .55, y - r * .48, r * .72); paint('#587d53', 1.6);
  circ(x, y - r * .82, r * .8); paint('#6f9465', 1.6); ell(x - r * .05, y - r * 1.42, r * .62, r * .28); paint('#fffdf6', 1.3);
  dot(x - r * .35, y - r * .7, r * .12, '#c9584c'); dot(x + r * .3, y - r * .55, r * .12, '#c9584c'); dot(x + r * .05, y - r * .95, r * .12, '#c9584c');
}
function mailbox(x, y) {
  box(x - 2.5 * S, y - 36 * S, 5 * S, 36 * S, 2 * S); paint('#8c6a55', 1.6);
  box(x - 14 * S, y - 50 * S, 28 * S, 16 * S, [8 * S, 8 * S, 2 * S, 2 * S]); paint('#c9584c', 1.6);
  box(x + 10 * S, y - 60 * S, 3.5 * S, 13 * S, S); paint('#e9c46a', 1.2);
  ell(x - S, y - 51 * S, 13 * S, 4 * S); paint('#fffdf6', 1.2);
}
function bird(x, y, dir, t) {
  const hop = Math.max(0, Math.sin(t * 2.1)) ** 10 * 6 * S;
  c.save(); c.translate(x, y - hop); c.scale(dir, 1);
  line(-6 * S, -1 * S, -14 * S, 3 * S, -6 * S, 4 * S); c.closePath(); paint('#a8463c', 1.2);
  ell(0, 0, 8 * S, 6.5 * S); paint('#c9584c', 1.4); circ(5 * S, -5 * S, 4.6 * S); paint('#c9584c', 1.4);
  line(2.5 * S, -8.5 * S, 4.5 * S, -13.5 * S, 7.5 * S, -8.5 * S); c.closePath(); paint('#c9584c', 1.1);
  line(9 * S, -6 * S, 13 * S, -4.5 * S, 9 * S, -3 * S); c.closePath(); paint('#e9c46a', 1); dot(6.3 * S, -5.6 * S, 1.1 * S);
  c.restore();
}
function lampPost(x, y, t) {
  box(x - 3 * S, y - 118 * S, 6 * S, 120 * S, 3 * S); paint('#46557a', 1.8);
  glow(x, y - 130 * S, 70 * S, '#f2cf7a', .75 + .08 * Math.sin(t * 3)); box(x - 11 * S, y - 144 * S, 22 * S, 27 * S, 6 * S); paint('#fbeecb', 1.8);
  box(x - 14 * S, y - 149 * S, 28 * S, 7 * S, 3 * S); paint('#46557a', 1.8); ell(x, y - 150 * S, 13 * S, 4 * S); paint('#fffdf6', 1.2);
  c.beginPath(); c.moveTo(x - 3 * S, y - 96 * S); c.quadraticCurveTo(x - 20 * S, y - 90 * S, x - 12 * S, y - 78 * S); paint(null, 6, '#587d53'); dot(x - 12 * S, y - 78 * S, 4 * S, '#c9584c');
}
function sceneCottage(t) {
  sky(['#1a2152', '#3b3f8c', '#8d70b8', '#f3aabb']); starsDraw(t, groundY * .7); moon(W * .82, Math.max(74 * S, H * .13), 30 * S); shootingStar(t);
  hill(groundY - 96 * S, 14 * S, .004, 3, '#949cd2');
  for (let i = 0, n = Math.round(W / (80 * S)); i < n; i++) {
    const x = (i + pr(i + 300)) * W / n, y = groundY - (90 + pr(i + 310) * 12) * S;
    if (Math.abs(x - cx) > R * 1.05) tinyHouse(x, y, (13 + pr(i + 320) * 8) * S, t + i);
  }
  hill(groundY - 66 * S, 16 * S, .006, 1, '#aab3e6'); pines(Math.round(W / 100) + 4, 20, groundY - 60 * S, '#2f6f72');
  hill(groundY - 28 * S, 10 * S, .008, 4, '#d5dcf7');
  const hw = 150 * S, hx = Math.max(cx - spread * 1.22, hw * .62), hy = groundY - 18 * S;
  pine(hx - hw * .82, hy + 6 * S, 120 * S, '#2f6f72'); pine(hx - hw * .62, hy + 10 * S, 82 * S, '#3f7a6e');
  house(hx, hy, hw, { smoke: 1, ice: 1, lights: 1 }, t);
  bush(hx - hw * .36, hy + 3 * S, 15 * S); bush(hx + hw * .36, hy + 3 * S, 15 * S);
  const fx = Math.min(cx + spread * 1.25, W - 66 * S);
  for (let i = -2; i <= 2; i++) { box(fx + i * 20 * S - 4 * S, groundY - 46 * S, 8 * S, 36 * S, 3 * S); paint('#cfa274', 2); dot(fx + i * 20 * S, groundY - 47 * S, 4.5 * S, '#fff'); }
  box(fx - 50 * S, groundY - 36 * S, 100 * S, 6 * S, 3 * S); paint('#cfa274', 2);
  bird(fx - 22 * S, groundY - 43 * S, 1, t); bird(fx + 24 * S, groundY - 43 * S, -1, t + 1.3);
  if (fx + 78 * S < W) lampPost(fx + 70 * S, groundY - 2 * S, t);
  hill(groundY, 5 * S, .012, 2, '#f6f8ff');
  for (let i = 0; i < 6; i++) { const u = i / 5; ell(hx + u * hw * .5, hy + 8 * S + u * 44 * S, (8 + u * 9) * S, (3.5 + u * 3.5) * S); paint('#e4e1ea', 1.2); }
  mailbox(hx + hw * .78, groundY + 14 * S);
}
function sceneFireside(t) {
  const fy = groundY - 8 * S;
  c.fillStyle = '#bca585'; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,246,228,.10)'; for (let x = 0; x < W; x += 48 * S) c.fillRect(x, 0, 24 * S, fy);
  c.fillStyle = 'rgba(255,240,220,.35)'; for (let i = 0; i < 60; i++) sparkle(((i * 97) % 23) / 23 * W + 12 * S, ((i * 53) % 11) / 11 * fy, 3 * S, 'rgba(255,246,228,.28)');
  c.fillStyle = '#a58e6c'; c.fillRect(0, fy, W, H - fy);
  c.strokeStyle = 'rgba(58,39,72,.22)'; c.lineWidth = 1.5 * S; for (let i = 1; i < 7; i++) { const y = fy + i * i * 6 * S; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  box(-5, fy - 14 * S, W + 10, 16 * S); paint('#fff3e0');
  // window
  const wx = Math.min(cx + spread * 1.18, W - 72 * S), ww = 108 * S, wh = 128 * S, wy = Math.max(H * .3, fy - 300 * S);
  box(wx - ww / 2, wy, ww, wh, 10 * S); paint('#26347a', 0);
  c.save(); c.clip(); moon(wx + ww * .2, wy + wh * .28, 13 * S);
  for (let i = 0; i < 16; i++) dot(wx - ww / 2 + pr(i + 60) * ww, wy + ((pr(i + 80) + t * (.08 + pr(i) * .08)) % 1) * wh, (1.5 + pr(i + 3) * 2) * S, '#fff');
  hill(wy + wh - 16 * S, 4 * S, .03, 1, '#e8ecff', 0); c.restore();
  box(wx - ww / 2, wy, ww, wh, 10 * S); paint(null, 9); paint(null, 5, '#fff3e0');
  line(wx, wy, wx, wy + wh, wx, wy + wh / 2, wx - ww / 2, wy + wh / 2, wx + ww / 2, wy + wh / 2); paint(null, 4, '#fff3e0');
  box(wx - ww / 2 - 9 * S, wy + wh - 2 * S, ww + 18 * S, 11 * S, 4 * S); paint('#fff3e0');
  c.beginPath(); c.moveTo(wx - ww / 2 - 16 * S, wy - 4 * S); c.quadraticCurveTo(wx, wy + 34 * S, wx + ww / 2 + 16 * S, wy - 4 * S); paint(null, 15, '#587d53'); paint(null, 9, '#6f9465');
  for (let i = 0; i <= 8; i++) { const u = i / 8, gx = (1 - u) * (1 - u) * (wx - ww / 2 - 16 * S) + 2 * u * (1 - u) * wx + u * u * (wx + ww / 2 + 16 * S), gy = (1 - u) * (1 - u) * (wy - 4 * S) + 2 * u * (1 - u) * (wy + 34 * S) + u * u * (wy - 4 * S); if (i % 2) dot(gx, gy + 2 * S, 3.2 * S, '#c9584c'); }
  for (const bx of [wx - ww / 2 - 14 * S, wx + ww / 2 + 14 * S]) { ell(bx - 6 * S, wy - 6 * S, 6 * S, 4 * S, -.4); paint('#c9584c', 1.5); ell(bx + 6 * S, wy - 6 * S, 6 * S, 4 * S, .4); paint('#c9584c', 1.5); line(bx, wy - 4 * S, bx - 4 * S, wy + 14 * S); paint(null, 3.5, '#c9584c'); }
  // fireplace
  const px = Math.max(cx - spread * 1.18, 90 * S), pw = 150 * S, ph = 150 * S;
  box(px - pw / 2, fy - ph, pw, ph, 6 * S); paint('#cc6a52');
  c.save(); c.clip(); c.strokeStyle = 'rgba(58,39,72,.28)'; c.lineWidth = 1.5 * S;
  for (let r = 0; r < 8; r++) { const y = fy - ph + r * 19 * S; c.beginPath(); c.moveTo(px - pw / 2, y); c.lineTo(px + pw / 2, y); for (let k = 0; k < 6; k++) { const x = px - pw / 2 + (k + (r % 2) * .5) * 30 * S; c.moveTo(x, y); c.lineTo(x, y + 19 * S); } c.stroke(); }
  c.restore();
  box(px - pw * .3, fy - ph * .62, pw * .6, ph * .62, [pw * .3, pw * .3, 0, 0]); paint('#2a1b2e');
  glow(px, fy - 24 * S, 130 * S, '#ff9a4d', .5 + .1 * Math.sin(t * 8));
  box(px - 32 * S, fy - 13 * S, 64 * S, 11 * S, 5 * S); paint('#8a5a3c', 2);
  flame(px - 11 * S, fy - 11 * S, 24 * S, t, 0); flame(px + 13 * S, fy - 11 * S, 18 * S, t, 2);
  box(px - pw / 2 - 10 * S, fy - ph - 12 * S, pw + 20 * S, 14 * S, 4 * S); paint('#fff3e0');
  for (let i = -1; i <= 1; i++) {
    const x = px + i * 42 * S, y = fy - ph + 3 * S, s = S, col = HUES[(i + 4) % 5];
    c.beginPath(); c.moveTo(x - 7 * s, y); c.lineTo(x + 7 * s, y); c.lineTo(x + 7 * s, y + 20 * s); c.quadraticCurveTo(x + 7 * s, y + 32 * s, x - 6 * s, y + 32 * s);
    c.quadraticCurveTo(x - 17 * s, y + 32 * s, x - 14 * s, y + 24 * s); c.quadraticCurveTo(x - 12 * s, y + 19 * s, x - 7 * s, y + 20 * s); c.closePath(); paint(col, 2);
    box(x - 9 * s, y - 3 * s, 18 * s, 9 * s, 3 * s); paint('#fff', 2);
  }
  stringLights(px - pw / 2 - 6 * S, fy - ph - 12 * S, px + pw / 2 + 6 * S, fy - ph - 12 * S, -11 * S, 7, t, ['#8fb39a', '#c9584c']);
  const frY = fy - ph - 92 * S; box(px - 36 * S, frY, 72 * S, 54 * S, 3 * S); paint('#c9a24d', 2); box(px - 28 * S, frY + 8 * S, 56 * S, 38 * S, 2 * S); paint('#dfe8ee', 1.4);
  line(px - 28 * S, frY + 46 * S, px - 10 * S, frY + 22 * S, px + 2 * S, frY + 36 * S, px + 12 * S, frY + 26 * S, px + 28 * S, frY + 46 * S); c.closePath(); paint('#8fa98a', 1.2); dot(px + 14 * S, frY + 16 * S, 4 * S, '#e9c46a');
  ell(cx, groundY + 30 * S, Math.min(R * 1.7, W * .48), 26 * S); paint('#e6dcc6'); ell(cx, groundY + 30 * S, Math.min(R * 1.45, W * .42), 18 * S); paint(null, 2.2, '#c9584c');
}
function penguin(x, y, s, t) {
  const b = Math.sin(t * 3) * .06;
  c.save(); c.translate(x, y); c.rotate(b);
  ell(-6 * s, 0, 5 * s, 2.5 * s); paint('#ffa63d', 1.5); ell(6 * s, 0, 5 * s, 2.5 * s); paint('#ffa63d', 1.5);
  ell(0, -15 * s, 11 * s, 15 * s); paint('#2f3454'); ell(0, -12 * s, 7 * s, 10.5 * s); paint('#fff', 0);
  dot(-3.5 * s, -21 * s, 1.5 * s); dot(3.5 * s, -21 * s, 1.5 * s); line(-2.5 * s, -17.5 * s, 0, -15 * s, 2.5 * s, -17.5 * s); c.closePath(); paint('#ffa63d', 1.2);
  box(-10 * s, -13 * s, 20 * s, 5 * s, 2 * s); paint('#c9584c', 1.5); box(5 * s, -11 * s, 5 * s, 11 * s, 2 * s); paint('#c9584c', 1.5);
  ell(-12 * s, -13 * s, 3 * s, 8 * s, .5 + b * 3); paint('#2f3454', 1.5); ell(12 * s, -13 * s, 3 * s, 8 * s, -.5 - b * 3); paint('#2f3454', 1.5);
  c.restore();
}
function scenePond(t) {
  sky(['#3a3878', '#8a6cb6', '#f29db3', '#ffd8a6']);
  glow(W * .24, groundY - 130 * S, 170 * S, '#fff1c9', .8); circ(W * .24, groundY - 130 * S, 44 * S); paint('#fff4d6', 0);
  starsDraw(t, groundY * .35);
  const base = groundY - 34 * S, n = Math.max(3, Math.round(W / (260 * S)));
  for (let i = 0; i < n; i++) {
    const x = (i + .5) * W / n + (pr(i + 3) - .5) * 60 * S, w = (300 + pr(i) * 120) * S, h = (150 + pr(i + 7) * 90) * S;
    line(x - w / 2, base + 10, x, base - h, x + w / 2, base + 10); c.closePath(); paint(i % 2 ? '#8576bd' : '#6c5ca6');
    line(x, base - h, x + w * .1, base - h * .74, x + w * .04, base - h * .8, x, base - h * .7, x - w * .05, base - h * .8, x - w * .1, base - h * .74); c.closePath(); paint('#fff', 2);
  }
  hill(groundY - 42 * S, 8 * S, .007, 3, '#c8c4ee'); pines(Math.round(W / 130) + 3, 40, groundY - 38 * S, '#3f6694', 44, 30);
  hill(groundY - 12 * S, 5 * S, .012, 2, '#f7f4ff');
  const px = cx + (W > 700 ? spread * 1.05 : spread * .45), prx = Math.min(spread * .95, 230 * S), py = groundY - 12 * S;
  ell(px, py, prx, 15 * S); paint('#cdeaf8');
  c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.5 * S; c.beginPath(); c.ellipse(px - prx * .2, py - 2 * S, prx * .4, 5 * S, 0, .2, 2.6); c.stroke(); c.beginPath(); c.ellipse(px + prx * .3, py + 3 * S, prx * .3, 4 * S, 0, 3.4, 5.8); c.stroke();
  penguin(px + Math.sin(t * .5) * prx * .6, py + 2 * S, S * .95, t);
  hill(groundY + 8 * S, 4 * S, .012, 5, '#fbf9ff', 0);
}
function sceneVillage(t) {
  sky(['#132a4a', '#2b5f86', '#7fa6b8', '#f8cfa4']); starsDraw(t, groundY * .55); moon(W * .16, Math.max(70 * S, H * .12), 26 * S);
  hill(groundY - 44 * S, 6 * S, .005, 1, '#cfe0f2');
  const cols = [['#f7b7a3', '#7c4a6a'], ['#ffe1a8', '#c9584f'], ['#bfe3d0', '#4f7d8c'], ['#d9c6f5', '#6a5aa8'], ['#f9d6e0', '#b5654f'], ['#c9e4ff', '#52679c']];
  const n = Math.max(3, Math.round(W / (150 * S)));
  for (let i = 0; i < n; i++) house((i + .5) * W / n, groundY - 34 * S, (94 + pr(i + 3) * 30) * S, { body: cols[i % 6][0], roof: cols[i % 6][1], smoke: i % 3 === 1 }, t);
  stringLights(-10, groundY - 168 * S, W + 10, groundY - 168 * S, 16 * S, Math.round(W / (34 * S)), t, LIGHTS[1].p);
  hill(groundY, 5 * S, .012, 2, '#f6f8ff');
  const lx = Math.min(cx + spread * 1.22, W - 44 * S);
  box(lx - 3 * S, groundY - 118 * S, 6 * S, 120 * S, 3 * S); paint('#46557a', 2);
  glow(lx, groundY - 130 * S, 70 * S, '#ffe08a', .8); box(lx - 11 * S, groundY - 144 * S, 22 * S, 27 * S, 6 * S); paint('#ffeaa8'); box(lx - 14 * S, groundY - 149 * S, 28 * S, 7 * S, 3 * S); paint('#46557a', 2);
}
function sceneAurora(t) {
  sky(['#060f2c', '#102a56', '#1d5568']); starsDraw(t, groundY * .8);
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k++) for (let x = 0; x < W; x += 5) {
    const y = H * (.05 + .07 * k) + Math.sin(x * .004 + t * .16 + k * 2) * 42 + Math.sin(x * .011 - t * .1 + k) * 18;
    c.globalAlpha = Math.max(0, .16 + .1 * Math.sin(x * .008 + t * .3 + k * 1.7)); c.drawImage(ribbons[k], x, y, 5, 170 + Math.sin(x * .006 + t * .22 + k) * 70);
  }
  c.restore();
  hill(groundY - 62 * S, 20 * S, .005, 2, '#9fc1e6'); pines(Math.round(W / 120) + 4, 70, groundY - 56 * S, '#215266');
  hill(groundY - 26 * S, 10 * S, .008, 5, '#c9def5');
  const tx = Math.max(cx - spread * 1.2, 80 * S), gy = groundY - 14 * S;
  glow(tx, gy - 34 * S, 130 * S, '#e3b04b', .55 + .08 * Math.sin(t * 3));
  line(tx - 62 * S, gy, tx, gy - 88 * S, tx + 62 * S, gy); c.closePath(); paint('#ff9a5a');
  line(tx - 20 * S, gy, tx, gy - 54 * S, tx + 20 * S, gy); c.closePath(); paint('#ffe9a8');
  line(tx, gy - 88 * S, tx, gy - 104 * S); paint(null, 2.5); line(tx, gy - 104 * S, tx + 14 * S, gy - 99 * S, tx, gy - 94 * S); c.closePath(); paint('#c9584c', 2);
  const fx = Math.min(cx + spread * 1.15, W - 70 * S);
  glow(fx, gy - 16 * S, 100 * S, '#ff9a4d', .6 + .1 * Math.sin(t * 8));
  box(fx - 24 * S, gy - 8 * S, 48 * S, 9 * S, 4 * S); paint('#8a5a3c', 2); flame(fx, gy - 6 * S, 22 * S, t, 1);
  hill(groundY, 5 * S, .012, 2, '#eef5ff');
}
function sceneCandy(t) {
  sky(['#ffb5d5', '#ffd3c4', '#fff3cf']);
  for (let i = 0; i < 6; i++) cloud(((pr(i) * (W + 240) + t * (5 + i % 3 * 4)) % (W + 240)) - 120, H * (.06 + pr(i + 4) * .26), (26 + pr(i + 2) * 20) * S);
  const pastel = ['#b9a5f0', '#8fd8c2', '#ffc78a', '#ff9fbf', '#9fd0ff'], n = Math.max(4, Math.round(W / (150 * S)));
  for (let i = 0; i < n; i++) {
    const x = (i + .5) * W / n + (pr(i + 13) - .5) * 40 * S, r = (62 + pr(i + 30) * 46) * S, y = groundY - 16 * S;
    c.beginPath(); c.arc(x, y, r, Math.PI, 0); c.closePath(); paint(pastel[i % 5]);
    for (let k = 0; k < 9; k++) { const a = Math.PI + pr(i * 9 + k) * Math.PI, q = r * (.25 + pr(i * 5 + k + 2) * .6); sparkle(x + Math.cos(a) * q, y + Math.sin(a) * q, 3.2 * S, 'rgba(255,255,255,.85)'); }
  }
  for (let i = 0; i < Math.max(3, Math.round(W / (240 * S))); i++) {
    const x = pr(i + 51) * W, y = groundY - (70 + pr(i + 6) * 50) * S, r = (17 + pr(i + 8) * 9) * S, col = HUES[i % 5];
    box(x - 2.5 * S, y, 5 * S, groundY - y, 2 * S); paint('#fff', 2); circ(x, y, r); paint(col);
    c.beginPath(); for (let a = 0; a < 12; a += .3) c.lineTo(x + Math.cos(a + t * .6) * r * a / 14, y + Math.sin(a + t * .6) * r * a / 14); paint(null, 2.6, '#fff');
  }
  house(Math.max(cx - spread * 1.22, 84 * S), groundY - 16 * S, 146 * S, { body: '#cf9460', roof: '#935a3c', door: '#c9584c', chim: '#e39aa6', smoke: 1 }, t);
  hill(groundY, 6 * S, .014, 2, '#fff0f6');
  for (let i = 0; i < W / (26 * S); i++) dot(i * 26 * S + 8 * S, groundY + 12 * S + pr(i) * 26 * S, 2.6 * S, HUES[i % 5]);
}
const SCENES = [
  { name: 'Cream paper', draw: sceneCream, indoor: 1, flake: 'rgba(227,176,75,.3)' },
  { name: 'Sage gingham', draw: gingham('rgba(143,170,138,.42)'), indoor: 1, flake: '#fffdf6' },
  { name: 'Berry gingham', draw: gingham('rgba(205,125,125,.32)'), indoor: 1, flake: '#fffdf6' },
  { name: 'Cozy room', draw: sceneFireside, indoor: 1 },
  { name: 'Snowy cottage', draw: sceneCottage, flake: '#fff' }, { name: 'Frozen pond', draw: scenePond, flake: '#fff' },
  { name: 'Village', draw: sceneVillage, flake: '#fff' }, { name: 'Starry camp', draw: sceneAurora, flake: '#fff' }, { name: 'Candyland', draw: sceneCandy, flake: '#fff' },
];

/* ───────────── decorations around the tree ───────────── */

function gift(x, y, w, h, col, rib) {
  box(x, y - h, w, h, 3 * S); paint(col); c.fillStyle = rib; c.fillRect(x + w * .41, y - h + S, w * .18, h - 2 * S);
  box(x - 2 * S, y - h - 5 * S, w + 4 * S, 9 * S, 3 * S); paint(col); c.fillRect(x + w * .41, y - h - 4 * S, w * .18, 7 * S);
  ell(x + w * .5 - 6 * S, y - h - 9 * S, 6 * S, 4 * S, -.5); paint(rib, 1.8); ell(x + w * .5 + 6 * S, y - h - 9 * S, 6 * S, 4 * S, .5); paint(rib, 1.8);
}
function gifts(x, y) {
  gift(x - 34 * S, y, 36 * S, 30 * S, '#c9584c', '#f6ead2'); gift(x + 4 * S, y, 28 * S, 20 * S, '#8fb4cf', '#e3b04b');
  gift(x + R * .5, y + 2 * S, 30 * S, 24 * S, '#8fb39a', '#c9584c'); gift(x + R * .5 + 26 * S, y + 4 * S, 22 * S, 16 * S, '#b79ac0', '#f6ead2');
}
function snowman(x, y, t) {
  const s = S, b = Math.sin(t * 2) * 1.2 * s;
  line(x - 22 * s, y - 34 * s, x - 42 * s, y - 50 * s + b); paint(null, 2.6, '#8a5a3c'); line(x + 22 * s, y - 34 * s, x + 42 * s, y - 52 * s - b); paint(null, 2.6, '#8a5a3c');
  circ(x, y - 24 * s, 27 * s); paint('#fff'); circ(x, y - 64 * s + b * .4, 19 * s); paint('#fff');
  dot(x, y - 30 * s, 2.4 * s); dot(x, y - 18 * s, 2.4 * s);
  const hy = y - 64 * s + b * .4;
  dot(x - 7 * s, hy - 4 * s, 2.2 * s); dot(x + 7 * s, hy - 4 * s, 2.2 * s); arcS(x, hy + 3 * s, 7 * s, .15 * Math.PI, .85 * Math.PI);
  dot(x - 12 * s, hy + 4 * s, 3.4 * s, 'rgba(255,140,160,.5)'); dot(x + 12 * s, hy + 4 * s, 3.4 * s, 'rgba(255,140,160,.5)');
  line(x, hy - 1 * s, x + 15 * s, hy + 2 * s, x, hy + 4 * s); c.closePath(); paint('#ff9a3d', 1.6);
  box(x - 19 * s, hy + 13 * s, 38 * s, 9 * s, 4 * s); paint('#c9584c', 2); box(x + 7 * s, hy + 17 * s, 9 * s, 20 * s, 3 * s); paint('#c9584c', 2);
  box(x - 20 * s, hy - 21 * s, 40 * s, 6 * s, 3 * s); paint(INK, 0); box(x - 13 * s, hy - 40 * s, 26 * s, 21 * s, 3 * s); paint(INK, 0); c.fillStyle = '#c9584c'; c.fillRect(x - 13 * s, hy - 26 * s, 26 * s, 5 * s);
}
function cat(x, y, t) {
  const s = S, b = 1 + .04 * Math.sin(t * 1.6);
  c.beginPath(); c.moveTo(x + 24 * s, y - 8 * s); c.quadraticCurveTo(x + 44 * s, y - 2 * s, x + 30 * s, y + 3 * s); c.quadraticCurveTo(x + 4 * s, y + 6 * s, x - 14 * s, y + 2 * s); paint(null, 8); paint(null, 4.5, '#f6a868');
  ell(x, y - 13 * s, 30 * s, 15 * s * b); paint('#f6a868');
  c.strokeStyle = '#d98445'; c.lineWidth = 2.5 * s; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x + 6 * s + i * 8 * s, y - 20 * s, 8 * s, 3.6, 4.9); c.stroke(); }
  line(x - 33 * s, y - 24 * s, x - 31 * s, y - 37 * s, x - 22 * s, y - 29 * s); c.closePath(); paint('#f6a868', 2); line(x - 17 * s, y - 29 * s, x - 10 * s, y - 37 * s, x - 9 * s, y - 24 * s); c.closePath(); paint('#f6a868', 2);
  circ(x - 21 * s, y - 17 * s, 13 * s); paint('#f6a868');
  arcS(x - 26 * s, y - 18 * s, 3 * s, .1 * Math.PI, .9 * Math.PI); arcS(x - 16 * s, y - 18 * s, 3 * s, .1 * Math.PI, .9 * Math.PI); dot(x - 21 * s, y - 14 * s, 1.5 * s, '#c9584c');
  c.font = `italic 600 ${16 * s}px Cormorant, Georgia, serif`; c.fillStyle = INK;
  for (let i = 0; i < 3; i++) { const p = (t * .3 + i / 3) % 1; c.globalAlpha = 1 - p; c.fillText('z', x - 8 * s + p * 16 * s, y - 34 * s - p * 26 * s); } c.globalAlpha = 1;
}
function lantern(x, y, t) {
  const s = S; glow(x, y - 26 * s, 62 * s, '#e9c46a', .6 + .1 * Math.sin(t * 6));
  c.beginPath(); c.arc(x, y - 50 * s, 9 * s, Math.PI, 0); paint(null, 2.4);
  box(x - 11 * s, y - 42 * s, 22 * s, 34 * s, 5 * s); paint('#fff3c4'); flame(x, y - 12 * s, 8 * s, t, 4);
  box(x - 14 * s, y - 48 * s, 28 * s, 8 * s, 3 * s); paint('#46557a', 2); box(x - 14 * s, y - 9 * s, 28 * s, 9 * s, 3 * s); paint('#46557a', 2);
}
function cocoa(x, y, t) {
  const s = S;
  c.lineWidth = 2.4 * s; c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineCap = 'round';
  for (let i = -1; i <= 1; i += 2) { c.beginPath(); for (let k = 0; k <= 10; k++) { const p = k / 10; c.lineTo(x + i * 6 * s + Math.sin(p * 6 + t * 2 + i) * 4 * s, y - 36 * s - p * 24 * s); } c.stroke(); }
  c.beginPath(); c.arc(x + 17 * s, y - 15 * s, 9 * s, -1.2, 1.2); paint(null, 8); paint(null, 4, '#c9584c');
  box(x - 17 * s, y - 31 * s, 34 * s, 31 * s, [4 * s, 4 * s, 11 * s, 11 * s]); paint('#c9584c');
  c.fillStyle = '#fff'; c.fillRect(x - 16 * s, y - 20 * s, 32 * s, 6 * s);
  ell(x, y - 31 * s, 15 * s, 4.5 * s); paint('#7a4a34', 2); box(x - 9 * s, y - 36 * s, 8 * s, 7 * s, 2 * s); paint('#fff', 1.6); box(x + 1 * s, y - 35 * s, 8 * s, 7 * s, 2 * s); paint('#fff', 1.6);
}

/* ───────────── ornaments ───────────── */

function shapePath(g, shape, r) {
  g.beginPath();
  if (shape === 1) { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * .55 : r * 1.15; g.lineTo(Math.cos(a) * q, Math.sin(a) * q); } g.closePath(); }
  else if (shape === 2) { g.moveTo(0, r); g.bezierCurveTo(-r * 1.7, -r * .1, -r * .7, -r * 1.3, 0, -r * .45); g.bezierCurveTo(r * .7, -r * 1.3, r * 1.7, -r * .1, 0, r); }
  else if (shape === 3) { g.arc(0, 0, r * 1.05, Math.PI * .28, Math.PI * 1.72); g.arc(r * .5, 0, r * .82, Math.PI * 1.42, Math.PI * .58, true); g.closePath(); }
  else if (shape === 5) { g.moveTo(0, -r * 1.2); g.lineTo(r * .85, 0); g.lineTo(0, r * 1.2); g.lineTo(-r * .85, 0); g.closePath(); }
  else if (shape === 6) { g.moveTo(-r * 1, r * .7); g.bezierCurveTo(-r * .55, r * .45, -r * .8, -r * 1.05, 0, -r * 1.05); g.bezierCurveTo(r * .8, -r * 1.05, r * .55, r * .45, r * 1, r * .7); g.closePath(); }
  else if (shape === 9) { g.moveTo(-r * .6, r * .7); g.lineTo(-r * .6, -r * .3); g.quadraticCurveTo(-r * .6, -r * 1.1, .05 * r, -r * 1.1); g.quadraticCurveTo(r * .7, -r * 1.1, r * .7, -r * .3); g.lineTo(r * .7, r * .7); g.closePath(); }
  else g.arc(0, 0, r, 0, TAU);
}
function drawOrn(g, x, y, r, shape, hue, sw = 0, hang = true) {
  const f = HUES[hue] || HUES[0], lw = Math.max(1.5, r * .14);
  const fin = fill => { g.fillStyle = fill; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.lineJoin = g.lineCap = 'round'; g.stroke(); };
  const two = (w, col) => { g.lineJoin = g.lineCap = 'round'; g.lineWidth = w + lw * 2; g.strokeStyle = INK; g.stroke(); g.lineWidth = w; g.strokeStyle = col; g.stroke(); };
  const shine = (sx, sy, a = .7) => { g.beginPath(); g.ellipse(sx, sy, r * .16, r * .28, -.6, 0, TAU); g.fillStyle = `rgba(255,255,255,${a})`; g.fill(); };
  const eye = (ex, ey) => { g.beginPath(); g.arc(ex, ey, r * .075, 0, TAU); g.fillStyle = INK; g.fill(); };
  const smile = (sx, sy, q) => { g.beginPath(); g.arc(sx, sy, q, .15 * Math.PI, .85 * Math.PI); g.strokeStyle = INK; g.lineWidth = lw * .7; g.stroke(); };
  const cap = cy => { g.beginPath(); g.roundRect(-r * .24, cy, r * .48, r * .34, r * .08); fin('#e9c46a'); };
  g.save(); g.translate(x, y);
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .28; g.drawImage(sprite(f), -r * 2.4, -r * 2.4, r * 4.8, r * 4.8); g.restore();
  if (hang) { g.translate(0, -r * 1.7); g.rotate(sw); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, r * .6); g.strokeStyle = INK; g.lineWidth = lw * .7; g.stroke(); g.translate(0, r * 1.7); }
  if (shape === 4) {
    g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, ca = Math.cos(a), sa = Math.sin(a); g.moveTo(0, 0); g.lineTo(ca * r * 1.12, sa * r * 1.12);
      for (const d of [-.5, .5]) { g.moveTo(ca * r * .62, sa * r * .62); g.lineTo(Math.cos(a + d) * r * .95, Math.sin(a + d) * r * .95); } }
    two(r * .2, '#fff'); g.beginPath(); g.arc(0, 0, r * .2, 0, TAU); fin(f);
  } else if (shape === 7) {
    g.beginPath(); g.moveTo(r * .4, r * 1.1); g.lineTo(r * .4, -r * .5); g.arc(-r * .08, -r * .5, r * .48, 0, Math.PI, true); g.lineTo(-r * .56, -r * .15);
    two(r * .4, '#fff'); g.setLineDash([r * .3, r * .34]); g.lineCap = 'butt'; g.lineWidth = r * .4; g.strokeStyle = hue === 5 ? '#c9584c' : f; g.stroke(); g.setLineDash([]);
  } else if (shape === 8) {
    const br = '#cf9460';
    g.beginPath(); g.moveTo(-r * .8, -r * .05); g.lineTo(r * .8, -r * .05); g.moveTo(0, -r * .3); g.lineTo(0, r * .3); g.moveTo(0, r * .25); g.lineTo(-r * .42, r * 1); g.moveTo(0, r * .25); g.lineTo(r * .42, r * 1);
    g.lineJoin = g.lineCap = 'round'; g.lineWidth = r * .5 + lw * 2; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.arc(0, -r * .68, r * .46 + lw, 0, TAU); g.fillStyle = INK; g.fill();
    g.beginPath(); g.moveTo(-r * .8, -r * .05); g.lineTo(r * .8, -r * .05); g.moveTo(0, -r * .3); g.lineTo(0, r * .3); g.moveTo(0, r * .25); g.lineTo(-r * .42, r * 1); g.moveTo(0, r * .25); g.lineTo(r * .42, r * 1);
    g.lineWidth = r * .5; g.strokeStyle = br; g.stroke(); g.beginPath(); g.arc(0, -r * .68, r * .46, 0, TAU); g.fillStyle = br; g.fill();
    eye(-r * .17, -r * .74); eye(r * .17, -r * .74); smile(0, -r * .66, r * .17);
    for (const by of [-.02, .3]) { g.beginPath(); g.arc(0, by * r, r * .1, 0, TAU); g.fillStyle = f; g.fill(); }
  } else {
    if (shape === 0 || shape === 5 || shape === 6) cap(shape === 0 ? -r * 1.24 : shape === 5 ? -r * 1.42 : -r * 1.3);
    if (shape === 9) { g.beginPath(); g.ellipse(-r * .78, -r * .05, r * .34, r * .24, -.5, 0, TAU); fin(f); }
    shapePath(g, shape, r); fin(f);
    if (shape === 0) { g.save(); shapePath(g, 0, r); g.clip(); g.beginPath(); g.moveTo(-r, r * .1); g.quadraticCurveTo(-r * .5, -r * .25, 0, r * .1); g.quadraticCurveTo(r * .5, r * .45, r, r * .1); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = r * .26; g.stroke(); g.restore(); shapePath(g, 0, r); g.strokeStyle = INK; g.lineWidth = lw; g.stroke(); shine(-r * .4, -r * .45); }
    if (shape === 1) { eye(-r * .22, -r * .05); eye(r * .22, -r * .05); smile(0, r * .05, r * .16); }
    if (shape === 2) shine(-r * .5, -r * .35);
    if (shape === 3) { smile(-r * .5, -r * .1, r * .13); }
    if (shape === 5) { g.beginPath(); g.moveTo(-r * .85, 0); g.lineTo(r * .85, 0); g.moveTo(0, -r * 1.2); g.lineTo(-r * .32, 0); g.lineTo(0, r * 1.2); g.lineTo(r * .32, 0); g.closePath(); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = lw * .6; g.stroke(); }
    if (shape === 6) { g.beginPath(); g.arc(0, r * .86, r * .2, 0, TAU); fin('#e9c46a'); shine(-r * .3, -r * .35); }
    if (shape === 9) { g.beginPath(); g.roundRect(-r * .72, r * .5, r * 1.54, r * .5, r * .16); fin('#fff'); }
  }
  g.restore();
}

/* ───────────── the tree ───────────── */

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr;
  S = Math.max(.75, Math.min(1.3, Math.min(W / 420, H / 760)));
  cx = W / 2;
  topY = Math.max(H * .2, document.querySelector('.hero').getBoundingClientRect().bottom + 58 * S);
  groundY = H - Math.max(H * .22, 196);
  TH = Math.max(groundY - topY, 170); topY = groundY - TH;
  R = Math.min(TH * .52, W * .42); spread = Math.min(R * 1.75, W / 2 - 46 * S);
  hh = TH * .91;
  const rs = document.documentElement.style;
  rs.setProperty('--pager-y', topY + hh * .55 + 'px'); rs.setProperty('--pager-w', Math.min(W - 12, R * 2.1 + 120 * S) + 'px');
}
addEventListener('resize', resize); resize();

function proj(h, a) {
  const ang = a + rot, z = Math.sin(ang), r = R * (.26 + .64 * h);
  return { x: cx + Math.cos(ang) * r, y: topY + hh * (.13 + .8 * h) + z * r * .12, z };
}
// [top, bottom, half-width] of each tier as fractions of tree height / radius; tiers overlap like stacked skirts.
const TIERS = [[0, .37, .5], [.19, .58, .7], [.39, .8, .87], [.59, 1, 1.02]];
function tierPath(ty, by, w, i) {
  const h = by - ty, k = 4 + i, bw = 2.04 * w / k, d = Math.min(h * .13, bw * .34), tw = w * (i ? .3 : .08), lip = i ? 0 : h * .1;
  c.beginPath(); c.moveTo(cx - tw, ty + lip);
  c.quadraticCurveTo(cx, ty - h * (i ? .1 : .16), cx + tw, ty + lip);
  c.bezierCurveTo(cx + w * .52, ty + h * .08, cx + w * .9, by - h * .44, cx + w * 1.02, by - d);
  for (let j = 0; j < k; j++) {
    const x0 = cx + w * 1.02 - bw * j, x1 = x0 - bw;
    c.bezierCurveTo(x0 - bw * .02, by + d * 1.55, x1 + bw * .02, by + d * 1.55, x1, by - d);
  }
  c.bezierCurveTo(cx - w * .9, by - h * .44, cx - w * .52, ty + h * .08, cx - tw, ty + lip);
  c.closePath();
  return { k, bw, d };
}
function tierBody(ty, by, w, T, i, snowy) {
  const h = by - ty, { k, bw, d } = tierPath(ty, by, w, i);
  c.fillStyle = T.b; c.fill();
  c.save(); c.clip();
  ell(cx - w * .08, ty + h * .3, w * 1.0, h * .64); c.fillStyle = T.a; c.fill();
  c.globalAlpha = .55; ell(cx - w * .46, ty + h * .42, w * .34, h * .42, .35); c.fillStyle = T.c; c.fill();
  c.lineCap = 'round';
  const n = Math.round(46 + w * h / (230 * S * S));
  for (let j = 0; j < n; j++) {
    const v = pr(i * 77 + j + 9), u = (pr(i * 131 + j) * 2 - 1) * (.3 + .78 * v), x = cx + u * w, y = ty + h * (.04 + v * 1.0);
    const len = (9 + pr(j * 7 + i) * 10) * S, m = j % 5;
    c.strokeStyle = m === 0 ? T.b : m < 3 ? T.c : T.a; c.globalAlpha = m === 0 ? .5 : m < 3 ? .6 : .7; c.lineWidth = (5 + pr(j * 3 + i) * 6) * S;
    c.beginPath(); c.moveTo(x - u * len * .2, y - len * .45); c.quadraticCurveTo(x + u * len * .25, y, x + u * len * .5, y + len * .5); c.stroke();
  }
  c.globalAlpha = 1;
  const g = c.createLinearGradient(0, by - h * .32, 0, by + d); g.addColorStop(0, rgba(T.d, 0)); g.addColorStop(1, rgba(T.d, .5));
  c.fillStyle = g; c.fillRect(cx - w * 1.2, by - h * .32, w * 2.4, h * .5);
  c.restore();
  tierPath(ty, by, w, i); c.strokeStyle = T.d; c.lineWidth = 1.8 * S; c.lineJoin = 'round'; c.stroke();
  if (snowy) {
    for (let j = 0; j < k; j++) {
      if ((j + i) % 2) continue; const xm = cx + w * 1.02 - bw * (j + .5) + (pr(i * 7 + j) - .5) * 4 * S;
      ell(xm, by - d * .2, bw * .3, d * .5, (xm - cx) / w * .25); c.fillStyle = '#fffdf6'; c.fill(); c.strokeStyle = 'rgba(150,160,175,.5)'; c.lineWidth = 1.1 * S; c.stroke();
    }
    for (const sx of [-1, 1]) { ell(cx + sx * w * .55, ty + h * .52, w * .14, h * .07, sx * .5); c.fillStyle = '#fffdf6'; c.fill(); c.strokeStyle = 'rgba(150,160,175,.45)'; c.stroke(); }
  }
}
let treeCache = null, treeKey = '';
function drawTreeBody(snowy) {
  const key = [look.tree, snowy, W, H, dpr, topY, R].join();
  if (key !== treeKey) {
    treeKey = key; treeCache ||= document.createElement('canvas');
    treeCache.width = W * dpr; treeCache.height = H * dpr;
    const main = c; c = treeCache.getContext('2d'); toneCtx(c);
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const T = TREES[look.tree] || TREES[0], yB = topY + hh;
    c.globalAlpha = .13; ell(cx, groundY + 6 * S, R * 1.15, 11 * S); c.fillStyle = INK; c.fill(); c.globalAlpha = 1;
    c.beginPath(); c.moveTo(cx - R * .12, yB - 10 * S); c.lineTo(cx + R * .12, yB - 10 * S); c.lineTo(cx + R * .15, groundY + 4 * S); c.quadraticCurveTo(cx, groundY + 9 * S, cx - R * .15, groundY + 4 * S); c.closePath();
    paint('#8c6a55', 1.8, '#6b4f3f');
    for (let i = TIERS.length - 1; i >= 0; i--) tierBody(topY + hh * TIERS[i][0], topY + hh * TIERS[i][1], R * TIERS[i][2], T, i, snowy);
    c = main;
  }
  c.drawImage(treeCache, 0, 0, W, H);
}
function drawTree(t, snowy) {
  drawTreeBody(snowy);
  // lights
  const pal = (LIGHTS[look.lights] || LIGHTS[0]).p, N = 66; let prev = null;
  for (let i = 0; i < N; i++) {
    const h = .03 + .97 * i / (N - 1), q = proj(h, h * TAU * 3.5);
    if (q.z > 0 && prev) { line(prev.x, prev.y, q.x, q.y); c.globalAlpha = .55; paint(null, 1.6); c.globalAlpha = 1; }
    prev = q.z > 0 ? q : null;
  }
  for (let i = 0; i < N; i += 2) {
    const h = .03 + .97 * i / (N - 1), q = proj(h, h * TAU * 3.5); if (q.z <= .05) continue;
    const col = pal[(i / 2) % pal.length], on = .5 + .5 * Math.sin(t * 3.2 + i * 1.3);
    glow(q.x, q.y + 3 * S, 13 * S, col, .25 + .5 * on); ell(q.x, q.y + 3 * S, 3.3 * S, 4.4 * S); paint(col, 1.3);
  }
  // topper
  const y = topY - 9 * S, r = 19 * S * (1 + .06 * Math.sin(t * 2.4)), k = look.topper;
  glow(cx, y, r * 3.4, '#e9c46a', .7);
  c.save(); c.translate(cx, y); c.rotate(Math.sin(t * 1.2) * .09);
  if (k === 1) { shapePath(c, 2, r); paint('#c9584c', 2.6); }
  else if (k === 2) { for (const sx of [-1, 1]) { ell(sx * r * .7, -r * .05, r * .68, r * .44, sx * .35); paint('#c9584c', 2.6); line(sx * r * .15, r * .2, sx * r * .55, r * 1.05); paint(null, 9); paint(null, 5.5, '#c9584c'); } circ(0, 0, r * .3); paint('#d98880', 2.6); }
  else if (k === 3) { c.restore(); drawOrn(c, cx, y, r * .9, 4, 3, 0, false); c.save(); }
  else { shapePath(c, 1, r); paint('#e9c46a', 2.6); dot(-r * .22, -r * .05, r * .075); dot(r * .22, -r * .05, r * .075); arcS(0, r * .05, r * .16, .15 * Math.PI, .85 * Math.PI, 1.6); }
  c.restore();
  for (let i = 0; i < 3; i++) { const a = t * .9 + i * TAU / 3; c.globalAlpha = .6 + .4 * Math.sin(t * 4 + i); sparkle(cx + Math.cos(a) * r * 1.9, y + Math.sin(a) * r * .9, 4.5 * S, '#fff8d8'); } c.globalAlpha = 1;
}

const PER = 20;
let page = 0;
let orns = [], shown = [], firstSnap = true, sparks = [], cycling = false, showIdx = -1;
const born = {};
const flakes = Array.from({ length: calm ? 30 : 110 }, () => ({ x: rnd(), y: rnd(), s: 1.2 + rnd() * 3, v: .03 + rnd() * .05, ph: rnd() * TAU }));

function frame(ms) {
  requestAnimationFrame(frame);
  const t = ms / 1000, dt = Math.min(.05, t - last || 0); last = t;
  if (!drag) { rot += vel * dt; vel += (BASE - vel) * Math.min(1, dt * 1.2); }
  let fade = 0;
  if (cycling) {
    const p = t % 7, i = Math.floor(t / 7) % SHOW.length;
    fade = p < .4 ? 1 - p / .4 : p > 6.6 ? (p - 6.6) / .4 : 0;
    if (i !== showIdx) { showIdx = i; look = { ...SHOW[i] }; }
  }
  const SC = SCENES[look.scene] || SCENES[0], ex = look.extras || [], has = i => ex.includes(i);
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  SC.draw(t);
  if (has(2)) { const pal = LIGHTS[1].p, y = Math.max(topY + hh * .2, H * .3); stringLights(-10, y, cx, y - 12 * S, 22 * S, Math.max(5, Math.round(cx / (40 * S))), t, pal); stringLights(cx, y - 12 * S, W + 10, y, 22 * S, Math.max(5, Math.round(cx / (40 * S))), t + 1, pal); }

  shown = [];
  const or = Math.max(11, Math.min(18, R * .1));
  const po = orns.slice(page * PER, (page + 1) * PER);
  const ornPass = front => {
    for (const o of po) {
      const q = proj(o.h, o.a); if ((q.z > 0) !== front) continue;
      const age = born[o.id] ? Math.max(0, t - born[o.id]) : 9, e = Math.min(1, age / .9), pop = age < .9 ? 1 + 1.6 * Math.sin(e * Math.PI) * (1 - e) : 1;
      const r = or * (.82 + .18 * q.z) * pop * Math.min(1, e * 3); if (r < .5) continue;
      drawOrn(c, q.x, q.y, r, o.shape, o.hue, Math.sin(t * 1.7 + o.a * 5) * .16);
      shown.push({ o, x: q.x, y: q.y, z: q.z, r });
    }
  };
  ornPass(false); drawTree(t, has(6)); ornPass(true);

  const gy = groundY + 8 * S;
  if (has(4)) lantern(cx - spread * .98, gy, t);
  if (has(3)) cat(cx - spread * .6, gy + 4 * S, t);
  if (has(1)) snowman(cx + spread * .94, gy, t);
  if (has(0)) gifts(cx - R * .3, gy + 4 * S);
  if (has(5)) cocoa(cx + spread * .56, gy + 8 * S, t);

  sparks = sparks.filter(s => (s.life -= dt) > 0);
  for (const s of sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 190 * dt; c.globalAlpha = Math.min(1, s.life * 1.6); sparkle(s.x, s.y, s.r * S, s.col); }
  c.globalAlpha = 1;
  if (SC.flake) for (const f of flakes) {
    f.y += f.v * dt * (calm ? .3 : 1); if (f.y > 1.02) { f.y = -.02; f.x = rnd(); }
    const x = ((f.x + Math.sin(t * .5 + f.ph) * .012 + t * .004) % 1) * W;
    c.globalAlpha = .55 + f.s * .1; dot(x, f.y * H, f.s * S * .9, SC.flake);
  }
  c.globalAlpha = 1; c.fillStyle = grainPat ||= c.createPattern(grain, 'repeat'); c.fillRect(0, 0, W, H);
  if (fade > 0) { c.globalAlpha = fade; c.fillStyle = '#f6f0e1'; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
}
requestAnimationFrame(frame);

function burst(x, y, col) {
  for (let i = 0; i < 26; i++) { const a = rnd() * TAU, v = 50 + rnd() * 190; sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 70, life: .5 + rnd() * .8, r: 3 + rnd() * 5, col: i % 3 ? col : '#ffffff' }); }
}

cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, x0: e.clientX, y0: e.clientY, t: performance.now(), v: 0 }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => {
  if (!drag) return;
  const now = performance.now(), dx = e.clientX - drag.x, d = -dx / Math.max(R, 60);
  rot += d; drag.v = d / Math.max(.008, (now - drag.t) / 1000); drag.x = e.clientX; drag.t = now;
});
cv.addEventListener('pointerup', e => {
  if (!drag) return;
  const moved = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
  vel = moved > 6 ? Math.max(-6, Math.min(6, drag.v)) : vel; drag = null;
  if (moved > 6) return;
  let best = null, bd = 1e9;
  for (const s of shown) { if (s.z <= 0) continue; const d = Math.hypot(e.clientX - s.x, e.clientY - s.y); if (d < s.r + 14 && d < bd) { bd = d; best = s; } }
  if (best) openOrn(best.o);
});
cv.addEventListener('pointercancel', () => drag = null);

/* ───────────── the app ───────────── */

let store, user = null, tree = null, pendingStart = false, authSeen = false, savedLook = null;
const isOwner = () => !!(user && treeId && user.uid === treeId);
const unlocked = () => Date.now() >= UNLOCK || (store?.demo && params.has('unlock'));
const unlockDay = new Date(UNLOCK).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
const int = (v, n, d) => Number.isInteger(v) && v >= 0 && v < n ? v : d;
const cleanLook = l => ({
  scene: int(l?.scene, SCENES.length, 0), tree: int(l?.tree, TREES.length, 0), lights: int(l?.lights, LIGHTS.length, 1), topper: int(l?.topper, TOPPERS.length, 0),
  extras: Array.isArray(l?.extras) ? [...new Set(l.extras.filter(i => Number.isInteger(i) && i >= 0 && i < EXTRAS.length))] : [...DEFAULT_LOOK.extras],
});

let toastTimer;
function toast(m) { const el = $('toast'); el.textContent = m; el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 3400); }
const go = (uid, extra = '') => { location.href = location.pathname + '?tree=' + encodeURIComponent(uid) + (params.has('unlock') ? '&unlock' : '') + extra; };
const guard = fn => async (...a) => { try { await fn(...a); } catch (e) { console.error(e); toast(e?.message || 'Something went wrong. Try again?'); } };
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('dialog.modal').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

function countdown() {
  const ms = UNLOCK - Date.now();
  if (unlocked()) return 'open now';
  const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
  return 'opens in ' + (d ? `${d} day${d > 1 ? 's' : ''} ${h} h` : h ? `${h} h ${m} min` : `${m} min`);
}

function render() {
  const title = $('title'), eyebrow = $('eyebrow'), meta = $('meta'), p = $('primary'), s = $('secondary'), auth = $('authBtn');
  $('demoNote').hidden = !store.demo;
  auth.hidden = !user; auth.textContent = isOwner() ? 'Sign out' : 'My tree';
  p.hidden = false; s.hidden = true;
  if (!treeId || !tree) {
    cycling = true;
    eyebrow.textContent = treeId ? 'Nothing planted here yet' : 'A cozy little tree of your own';
    title.innerHTML = 'Plant a tree.<br>Let your friends <em>decorate it.</em>';
    meta.textContent = `They hang ornaments with sealed notes. You open them on ${unlockDay}.`;
    p.textContent = 'Plant my tree'; $('chips').replaceChildren(); $('pager').hidden = true; resize(); return;
  }
  cycling = false;
  document.title = `${tree.name}’s tree · Evergleam`;
  eyebrow.textContent = isOwner() ? 'Your tree' : 'You’re invited to decorate';
  title.textContent = ''; const em = document.createElement('em'); em.textContent = tree.name + '’s'; title.append(em, ' tree');
  const n = orns.length;
  meta.textContent = `${n} ornament${n === 1 ? '' : 's'}` + (n > PER ? ` · page ${Math.min(page, pages() - 1) + 1} of ${pages()}` : '') + ` · ${countdown()}`;
  s.hidden = false;
  if (isOwner()) { p.textContent = 'Share my link'; s.textContent = 'Decorate'; }
  else { p.textContent = 'Hang an ornament'; s.textContent = 'Plant my own tree'; }
  const np = pages(); page = Math.min(page, np - 1);
  $('pager').hidden = np < 2; $('pgLabel').textContent = `Page ${page + 1} of ${np}`;
  $('pgPrev').disabled = page === 0; $('pgNext').disabled = page >= np - 1;
  $('chips').replaceChildren(...orns.slice(page * PER, (page + 1) * PER).map(o => {
    const b = document.createElement('button'), d = document.createElement('i');
    b.className = 'chip'; d.style.background = HUES[o.hue]; b.append(d, o.from); b.addEventListener('click', () => openOrn(o)); return b;
  }));
  resize();
}
setInterval(() => store && tree && render(), 60000);

const pages = () => Math.max(1, Math.ceil(orns.length / PER));
function flipTo(p) {
  p = Math.max(0, Math.min(pages() - 1, p)); if (p === page) return;
  page = p; const now = performance.now() / 1000;
  orns.slice(page * PER, (page + 1) * PER).forEach((o, i) => { born[o.id] = now + .12 + i * .035; });
  vel = BASE + 3.2; render();
}
$('pgPrev').addEventListener('click', () => flipTo(page - 1));
$('pgNext').addEventListener('click', () => flipTo(page + 1));
addEventListener('keydown', e => {
  if (!tree || document.querySelector('dialog[open]')) return;
  if (e.key === 'ArrowLeft') flipTo(page - 1); else if (e.key === 'ArrowRight') flipTo(page + 1);
});

const startFlow = guard(async () => {
  if (!user) { pendingStart = true; await store.signIn(); return; }
  pendingStart = false;
  if (await store.getTree(user.uid)) return go(user.uid);
  $('nameIn').value = (user.name || '').split(' ')[0];
  $('nameDlg').showModal();
});
$('nameForm').addEventListener('submit', guard(async e => {
  e.preventDefault();
  const name = $('nameIn').value.trim(); if (!name) return;
  await store.saveTree(user.uid, name, { ...DEFAULT_LOOK }); go(user.uid, '&decorate');
}));

$('primary').addEventListener('click', guard(async () => {
  if (!treeId || !tree) return startFlow();
  if (!isOwner()) return openHang();
  const url = location.origin + location.pathname + '?tree=' + encodeURIComponent(treeId);
  if (navigator.share) { try { await navigator.share({ title: document.title, text: 'Hang an ornament on my tree', url }); return; } catch {} }
  await navigator.clipboard.writeText(url); toast('Link copied. Send it to your friends!');
}));
$('secondary').addEventListener('click', () => (isOwner() ? openDeco() : startFlow()));
$('authBtn').addEventListener('click', guard(async () => {
  if (isOwner()) { await store.signOut(); location.href = location.pathname; } else startFlow();
}));

/* decorate (owner) */
function buildDeco() {
  const body = $('decoBody'); body.replaceChildren();
  const group = (label, names, key, multi, dots) => {
    const fs = document.createElement('fieldset'), lg = document.createElement('legend'), row = document.createElement('div');
    lg.textContent = label; row.className = 'opts'; fs.append(lg, row);
    names.forEach((n, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'opt';
      if (dots) { const d = document.createElement('i'); d.style.background = dots[i]; b.append(d); }
      b.append(n);
      const on = () => (multi ? look.extras.includes(i) : look[key] === i);
      b.setAttribute('aria-pressed', on());
      b.addEventListener('click', () => {
        if (multi) look.extras = on() ? look.extras.filter(x => x !== i) : [...look.extras, i]; else look[key] = i;
        row.querySelectorAll('button').forEach((x, j) => x.setAttribute('aria-pressed', multi ? look.extras.includes(j) : look[key] === j));
      });
      row.append(b);
    });
    body.append(fs);
  };
  group('Background', SCENES.map(s => s.name), 'scene');
  group('Tree colour', TREES.map(t => t.n), 'tree', false, TREES.map(t => t.a));
  group('Lights', LIGHTS.map(l => l.n), 'lights', false, LIGHTS.map(l => l.p[0]));
  group('Tree topper', TOPPERS, 'topper');
  group('Around the tree', EXTRAS, 'extras', true);
}
function openDeco() { savedLook = JSON.parse(JSON.stringify(look)); buildDeco(); document.body.classList.add('decorating'); $('decoDlg').show(); }
function closeDeco() { document.body.classList.remove('decorating'); $('decoDlg').close(); }
$('decoCancel').addEventListener('click', () => { look = savedLook; closeDeco(); });
$('decoForm').addEventListener('submit', guard(async e => {
  e.preventDefault();
  await store.saveTree(user.uid, tree.name, look); tree.look = look; closeDeco(); toast('Saved! Your friends will see it like this.');
}));

/* hang an ornament */
let pick = { shape: 0, hue: 0 };
function buildPickers() {
  const sp = $('shapePick'), hp = $('huePick');
  const draw = () => sp.querySelectorAll('canvas').forEach((k, i) => { const g = k.getContext('2d'); g.clearRect(0, 0, 88, 88); drawOrn(g, 44, 48, 17, i, pick.hue, 0, false); });
  const press = () => {
    sp.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', i === pick.shape));
    hp.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', i === pick.hue));
    draw();
  };
  SHAPE_NAMES.forEach((n, i) => {
    const b = document.createElement('button'), k = document.createElement('canvas');
    b.type = 'button'; b.title = n; b.setAttribute('aria-label', n); k.width = k.height = 88; b.append(k);
    b.addEventListener('click', () => { pick.shape = i; press(); }); sp.append(b);
  });
  HUE_NAMES.forEach((n, i) => {
    const b = document.createElement('button'), d = document.createElement('i');
    b.type = 'button'; b.className = 'swatch'; b.title = n; b.setAttribute('aria-label', n); d.style.background = HUES[i]; b.append(d);
    b.addEventListener('click', () => { pick.hue = i; press(); }); hp.append(b);
  });
  press();
}
buildPickers();

function openHang() { $('hangSub').textContent = `${tree.name} can’t read it until ${unlockDay}.`; $('hangDlg').showModal(); }
function freeSpot() {
  let best = null, bs = -1;
  const mates = orns.slice(Math.floor(orns.length / PER) * PER);
  for (let i = 0; i < 16; i++) {
    const h = .1 + rnd() * .88, a = rnd() * TAU;
    let m = 9; for (const o of mates) { let da = Math.abs(a - o.a) % TAU; if (da > Math.PI) da = TAU - da; m = Math.min(m, Math.hypot((h - o.h) * 3, da * h)); }
    if (m > bs) { bs = m; best = { h, a }; }
  }
  return best;
}
$('hangForm').addEventListener('submit', guard(async e => {
  e.preventDefault();
  const from = $('fromIn').value.trim(), text = $('textIn').value.trim();
  if (!from || !text) return;
  const btn = $('hangGo'); btn.disabled = true;
  try {
    const spot = freeSpot();
    await store.add(treeId, { from, shape: pick.shape, hue: pick.hue, h: spot.h, a: spot.a }, text);
    const lp = pages() - 1; if (lp !== page) flipTo(lp); else render();
    rot = Math.PI / 2 - spot.a; vel = 0;
    $('hangDlg').close(); $('textIn').value = '';
    toast(pages() > 1 ? `Hung on page ${page + 1}! It opens on ${unlockDay}.` : `Hung! It opens on ${unlockDay}.`);
  } finally { btn.disabled = false; }
}));

/* look at an ornament */
let viewing = null;
const openOrn = guard(async o => {
  viewing = o;
  const g = $('viewOrn').getContext('2d'); g.clearRect(0, 0, 240, 240);
  drawOrn(g, 120, 138, 46, o.shape, o.hue, 0, true);
  $('viewFrom').textContent = 'From ' + o.from;
  const txt = $('viewText'); txt.className = 'message sealed';
  $('viewRemove').hidden = !isOwner();
  if (!unlocked()) txt.textContent = isOwner() ? `Sealed! You can open it on ${unlockDay} (${countdown().replace('opens in ', '')} to go).` : `Sealed until ${unlockDay}. Only ${tree.name} will be able to read it.`;
  else if (!isOwner()) txt.textContent = `Only ${tree.name} can read this one.`;
  else txt.textContent = 'Unwrapping…';
  $('viewDlg').showModal();
  if (unlocked() && isOwner()) {
    const text = await store.read(treeId, o.id);
    if (viewing === o) { txt.className = 'message'; txt.textContent = text || '(empty)'; }
  }
});
$('viewRemove').addEventListener('click', guard(async () => {
  if (!viewing || !confirm(`Remove the ornament from ${viewing.from}? This can’t be undone.`)) return;
  await store.remove(treeId, viewing.id); $('viewDlg').close(); toast('Ornament removed.');
}));

/* boot */
(async () => {
  try { store = firebaseConfig.apiKey ? await firebaseStore() : demoStore(); }
  catch (e) { console.error(e); store = demoStore(); toast('Couldn’t reach Firebase, so this is preview mode.'); }
  if (treeId) {
    try { tree = await store.getTree(treeId); } catch (e) { console.error(e); toast(e.message); }
    if (tree) {
      look = cleanLook(tree.look);
      store.watch(treeId, list => {
        const now = performance.now() / 1000;
        if (!firstSnap) for (const o of list) if (!orns.some(x => x.id === o.id)) {
          born[o.id] = now;
          setTimeout(() => { const s = shown.find(x => x.o.id === o.id); if (s) burst(s.x, s.y, HUES[o.hue]); }, 150);
        }
        firstSnap = false; orns = list; render();
      });
    }
  }
  store.onAuth(guard(async u => {
    user = u; render();
    if (pendingStart && u) return startFlow();
    if (!authSeen && u && !treeId && await store.getTree(u.uid)) go(u.uid);
    if (!authSeen && isOwner() && tree && params.has('decorate')) { history.replaceState(null, '', location.pathname + '?tree=' + encodeURIComponent(treeId)); openDeco(); }
    authSeen = true;
  }));
  render();
})();
