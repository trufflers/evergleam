import { firebaseConfig, UNLOCK_AT } from './firebase-config.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const treeId = params.get('tree');
const UNLOCK = new Date(UNLOCK_AT).getTime();
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

const HUES = ['#ff5d73', '#ffc857', '#7ef0c5', '#7db7ff', '#c59bff', '#fff3d6'];
const HUE_NAMES = ['Rose', 'Gold', 'Mint', 'Ice', 'Lilac', 'Pearl'];
const SHAPE_NAMES = ['Orb', 'Star', 'Heart', 'Moon', 'Snowflake', 'Gem'];
const DARK = HUES.map(h => '#' + [1, 3, 5].map(i => Math.round(parseInt(h.slice(i, i + 2), 16) * .45).toString(16).padStart(2, '0')).join(''));

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
    saveTree: (uid, name) => F.setDoc(F.doc(db, 'trees', uid), { name, at: F.serverTimestamp() }),
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
    saveTree: async (uid, name) => { d.trees[uid] = { name }; save(); },
    watch: (id, cb) => { (watchers[id] ||= []).push(cb); queueMicrotask(() => ping(id)); },
    add: async (id, o, text) => {
      const oid = Math.random().toString(36).slice(2, 10);
      (d.orn[id] ||= []).push({ id: oid, ...o }); (d.msg[id] ||= {})[oid] = text; save(); ping(id); return oid;
    },
    read: async (id, oid) => d.msg[id]?.[oid] || '',
    remove: async (id, oid) => { d.orn[id] = (d.orn[id] || []).filter(o => o.id !== oid); delete d.msg[id]?.[oid]; save(); ping(id); },
  };
}

/* ───────────── the scene ───────────── */

const cv = $('sky'), c = cv.getContext('2d');
let W = 0, H = 0, dpr = 1, cx = 0, topY = 0, TH = 0, R = 0, groundY = 0, skyGrad, lakeGrad;
let rot = 0, vel = 0, last = 0, drag = null;
const BASE = calm ? .04 : .22;

const sprites = {};
function sprite(col) {
  if (sprites[col]) return sprites[col];
  const s = document.createElement('canvas'); s.width = s.height = 64;
  const g = s.getContext('2d'), rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, col); rg.addColorStop(.22, col + 'b0'); rg.addColorStop(.6, col + '2a'); rg.addColorStop(1, col + '00');
  g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  return sprites[col] = s;
}
function strip(col) {
  const s = document.createElement('canvas'); s.width = 1; s.height = 64;
  const g = s.getContext('2d'), lg = g.createLinearGradient(0, 0, 0, 64);
  lg.addColorStop(0, col + '00'); lg.addColorStop(.18, col + 'ff'); lg.addColorStop(1, col + '00');
  g.fillStyle = lg; g.fillRect(0, 0, 1, 64);
  return s;
}
const ribbons = ['#3dffb4', '#4aa8ff', '#b97bff'].map(strip);

const rnd = Math.random, TAU = Math.PI * 2;
const parts = [];
const GREENS = ['#2fe09a', '#7ef0c5', '#1fb7a6', '#56d6ff', '#b8ffd9'];
for (let i = 0; i < 950; i++) parts.push({ h: Math.sqrt(rnd()), a: rnd() * TAU, rf: .5 + rnd() * .5, s: 2.5 + rnd() * 4, col: GREENS[i % 5], ph: rnd() * TAU, tw: .6 + rnd() * 1.6, k: 0 });
for (let s = 0; s < 3; s++) for (let i = 0; i < 200; i++) {
  const h = .05 + (i / 200) * .95;
  parts.push({ h, a: h * 5.5 * TAU * (s === 2 ? -1 : 1) + s * 2.1, rf: 1.03, s: 4.5, col: s === 2 ? '#fff3d6' : '#ffc857', ph: i * .32, tw: 3, k: 1 });
}
for (let i = 0; i < 30; i++) parts.push({ h: .12 + rnd() * .86, a: rnd() * TAU, rf: 1, s: 6 + rnd() * 4, col: HUES[i % 5], ph: rnd() * TAU, tw: .5 + rnd(), k: 0 });

const stars = Array.from({ length: 150 }, () => ({ x: rnd(), y: rnd() * .7, s: .5 + rnd() * 1.3, ph: rnd() * TAU }));
const snow = Array.from({ length: calm ? 30 : 130 }, () => ({ x: rnd(), y: rnd(), s: 1 + rnd() * 2.6, v: .02 + rnd() * .05, ph: rnd() * TAU }));
let sparks = [];

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  cx = W / 2;
  topY = Math.max(H * .2, document.querySelector('.hero').getBoundingClientRect().bottom + 52);
  groundY = H - Math.max(H * .2, 172);
  TH = Math.max(groundY - topY, 160);
  R = Math.min(TH * .42, W * .43);
  skyGrad = c.createLinearGradient(0, 0, 0, H);
  skyGrad.addColorStop(0, '#04071a'); skyGrad.addColorStop(.55, '#0a1634'); skyGrad.addColorStop(1, '#0c2233');
  lakeGrad = c.createLinearGradient(0, groundY, 0, H);
  lakeGrad.addColorStop(0, 'rgba(126,240,197,.09)'); lakeGrad.addColorStop(.08, 'rgba(8,18,40,.55)'); lakeGrad.addColorStop(1, 'rgba(4,7,22,.9)');
}
addEventListener('resize', resize); resize();

function proj(h, a, rf) {
  const ang = a + rot, r = R * (.03 + .97 * h) * (.9 + .1 * Math.sin(h * 20)) * rf, z = Math.sin(ang);
  return { x: cx + Math.cos(ang) * r, y: topY + h * TH + z * r * .2, z };
}

function shapePath(g, shape, r) {
  g.beginPath();
  if (shape === 1) { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * .5 : r * 1.15; g.lineTo(Math.cos(a) * q, Math.sin(a) * q); } g.closePath(); }
  else if (shape === 2) { g.moveTo(0, r); g.bezierCurveTo(-r * 1.7, -r * .1, -r * .7, -r * 1.3, 0, -r * .45); g.bezierCurveTo(r * .7, -r * 1.3, r * 1.7, -r * .1, 0, r); }
  else if (shape === 3) { g.arc(0, 0, r * 1.05, Math.PI * .28, Math.PI * 1.72); g.arc(r * .5, 0, r * .82, Math.PI * 1.42, Math.PI * .58, true); g.closePath(); }
  else if (shape === 5) { g.moveTo(0, -r * 1.2); g.lineTo(r * .85, 0); g.lineTo(0, r * 1.2); g.lineTo(-r * .85, 0); g.closePath(); }
  else g.arc(0, 0, r, 0, TAU);
}
function drawOrn(g, x, y, r, shape, hue, alpha = 1) {
  const col = HUES[hue] || HUES[0];
  g.save(); g.translate(x, y);
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = .6 * alpha;
  g.drawImage(sprite(col), -r * 2.8, -r * 2.8, r * 5.6, r * 5.6);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = alpha;
  if (shape === 4) {
    g.strokeStyle = '#fff'; g.lineWidth = Math.max(1.4, r * .17); g.lineCap = 'round'; g.shadowColor = col; g.shadowBlur = r * .8;
    for (let i = 0; i < 6; i++) {
      g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -r * 1.15);
      g.moveTo(0, -r * .65); g.lineTo(r * .3, -r * .95); g.moveTo(0, -r * .65); g.lineTo(-r * .3, -r * .95); g.stroke();
    }
  } else {
    const gr = g.createRadialGradient(-r * .35, -r * .45, r * .05, 0, 0, r * 1.25);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(.38, col); gr.addColorStop(1, DARK[hue] || DARK[0]);
    g.fillStyle = gr; shapePath(g, shape, r); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = Math.max(.8, r * .07); g.stroke();
  }
  g.restore();
}

let orns = [], shown = [], firstSnap = true;
const born = {};

function frame(ms) {
  requestAnimationFrame(frame);
  const t = ms / 1000, dt = Math.min(.05, t - last || 0); last = t;
  if (!drag) { rot += vel * dt; vel += (BASE - vel) * Math.min(1, dt * 1.2); }
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  c.fillStyle = skyGrad; c.fillRect(0, 0, W, H);

  c.fillStyle = '#fff';
  for (const s of stars) { c.globalAlpha = .25 + .55 * (.5 + .5 * Math.sin(t * 1.3 + s.ph)); c.fillRect(s.x * W, s.y * H, s.s, s.s); }

  c.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 3; k++) for (let x = 0; x < W; x += 5) {
    const y = H * (.04 + .07 * k) + Math.sin(x * .004 + t * .16 + k * 2) * 42 + Math.sin(x * .011 - t * .1 + k) * 18;
    c.globalAlpha = Math.max(0, .12 + .09 * Math.sin(x * .008 + t * .3 + k * 1.7));
    c.drawImage(ribbons[k], x, y, 5, 150 + Math.sin(x * .006 + t * .22 + k) * 70);
  }

  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  c.fillStyle = lakeGrad; c.fillRect(0, groundY, W, H - groundY);
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = .4;
  c.drawImage(sprite('#7ef0c5'), cx - R * 2, groundY - R * .32, R * 4, R * .64);

  shown = [];
  for (let pass = 0; pass < 2; pass++) {
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i], q = proj(p.h, p.a, p.rf);
      if ((q.z >= 0) !== !!pass) continue;
      const depth = (q.z + 1) / 2;
      const tw = p.k ? .35 + .65 * Math.max(0, Math.sin(p.ph - t * 3)) : .55 + .45 * Math.sin(t * p.tw + p.ph);
      const s = p.s * (.65 + .6 * depth) * (R / 150 * .5 + .5), a = (.25 + .75 * depth) * tw;
      c.globalAlpha = a; c.drawImage(sprite(p.col), q.x - s, q.y - s, s * 2, s * 2);
      if (i % 3 === 0) {
        const ry = groundY + (groundY - q.y) * .42 + 6;
        if (ry < H) { c.globalAlpha = a * .16; c.drawImage(sprite(p.col), q.x - s * 1.3, ry - s * .6, s * 2.6, s * 1.2); }
      }
    }
    const or = Math.max(11, Math.min(19, R * .1));
    for (const o of orns) {
      const q = proj(o.h, o.a, 1.06);
      if ((q.z >= 0) !== !!pass) continue;
      const age = born[o.id] ? Math.max(0, t - born[o.id]) : 9;
      const e = Math.min(1, age / .9), pop = age < .9 ? 1 + 2.2 * Math.sin(e * Math.PI) * (1 - e) : 1;
      const y = q.y + Math.sin(t * 1.4 + o.a * 3) * 1.6, r = or * (.72 + .4 * (q.z + 1) / 2) * pop * Math.min(1, e * 3);
      if (r < .5) continue;
      drawOrn(c, q.x, y, r, o.shape, o.hue, .45 + .55 * (q.z + 1) / 2);
      shown.push({ o, x: q.x, y, z: q.z, r });
    }
  }

  // star on top
  c.globalCompositeOperation = 'lighter';
  const sy = topY - 10, pulse = 1 + .1 * Math.sin(t * 2.2), sr = Math.max(34, R * .34) * pulse;
  c.globalAlpha = .8; c.drawImage(sprite('#ffc857'), cx - sr * 1.7, sy - sr * 1.7, sr * 3.4, sr * 3.4);
  c.globalAlpha = 1; c.drawImage(sprite('#fff3d6'), cx - sr * .8, sy - sr * .8, sr * 1.6, sr * 1.6);
  c.save(); c.translate(cx, sy); c.fillStyle = '#fffbe9';
  for (let j = 0; j < 2; j++) {
    c.rotate(j ? Math.PI / 4 + t * .3 : Math.sin(t * .6) * .08); c.globalAlpha = j ? .45 : .95;
    const len = sr * (j ? .7 : 1.25), wd = sr * (j ? .05 : .09);
    for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); c.beginPath(); c.moveTo(0, -len); c.quadraticCurveTo(wd * .4, -wd * .4, wd, 0); c.lineTo(-wd, 0); c.quadraticCurveTo(-wd * .4, -wd * .4, 0, -len); c.fill(); }
  }
  c.restore();

  sparks = sparks.filter(s => (s.life -= dt) > 0);
  for (const s of sparks) {
    s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 160 * dt;
    c.globalAlpha = Math.min(1, s.life * 1.6); c.drawImage(sprite(s.col), s.x - 5, s.y - 5, 10, 10);
  }

  const white = sprite('#ffffff');
  for (const f of snow) {
    f.y += f.v * dt * (calm ? .3 : 1); if (f.y > 1.02) { f.y = -.02; f.x = rnd(); }
    const x = ((f.x + Math.sin(t * .5 + f.ph) * .012 + t * .004) % 1) * W;
    c.globalAlpha = .28 + f.s * .16; c.drawImage(white, x - f.s * 1.6, f.y * H - f.s * 1.6, f.s * 3.2, f.s * 3.2);
  }
}
requestAnimationFrame(frame);

function burst(x, y, col) {
  for (let i = 0; i < 34; i++) { const a = rnd() * TAU, v = 40 + rnd() * 190; sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: .5 + rnd() * .8, col: i % 3 ? col : '#ffffff' }); }
}

cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, x0: e.clientX, y0: e.clientY, t: performance.now(), v: 0 }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => {
  if (!drag) return;
  const now = performance.now(), dx = e.clientX - drag.x, d = -dx / Math.max(R, 60);
  rot += d; drag.v = d / Math.max(.008, (now - drag.t) / 1000); drag.x = e.clientX; drag.t = now;
});
const endDrag = e => {
  if (!drag) return;
  const moved = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
  vel = moved > 6 ? Math.max(-6, Math.min(6, drag.v)) : vel;
  drag = null;
  if (moved > 6) return;
  let best = null, bd = 1e9;
  for (const s of shown) { if (s.z < -.25) continue; const d = Math.hypot(e.clientX - s.x, e.clientY - s.y); if (d < s.r + 14 && d < bd) { bd = d; best = s; } }
  if (best) openOrn(best.o);
};
cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', () => drag = null);

/* ───────────── the app ───────────── */

let store, user = null, tree = null, pendingStart = false, authSeen = false;
const isOwner = () => !!(user && treeId && user.uid === treeId);
const unlocked = () => Date.now() >= UNLOCK || (store?.demo && params.has('unlock'));
const unlockDay = new Date(UNLOCK).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

let toastTimer;
function toast(m) { const el = $('toast'); el.textContent = m; el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), 3400); }
const go = uid => { location.href = location.pathname + '?tree=' + encodeURIComponent(uid) + (params.has('unlock') ? '&unlock' : ''); };
const guard = fn => async (...a) => { try { await fn(...a); } catch (e) { console.error(e); toast(e?.message || 'Something went wrong. Try again?'); } };
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

function countdown() {
  const ms = UNLOCK - Date.now();
  if (unlocked()) return 'open now';
  const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
  return 'opens in ' + (d ? `${d} day${d > 1 ? 's' : ''} ${h} h` : h ? `${h} h ${m} min` : `${m} min`);
}

function render() {
  const title = $('title'), eyebrow = $('eyebrow'), meta = $('meta'), p = $('primary'), s = $('secondary'), auth = $('authBtn');
  $('demoNote').hidden = !store.demo;
  auth.hidden = !user;
  auth.textContent = isOwner() ? 'Sign out' : 'My tree';
  p.hidden = false; s.hidden = true;
  if (!treeId || !tree) {
    eyebrow.textContent = treeId ? 'Nothing planted here yet' : 'A tree made of light';
    title.innerHTML = 'Plant a tree.<br>Let your friends <em>light it.</em>';
    meta.textContent = `They hang ornaments with sealed messages. You open them on ${unlockDay}.`;
    p.textContent = 'Plant my tree';
    $('chips').replaceChildren();
    resize();
    return;
  }
  document.title = `${tree.name}’s tree · Evergleam`;
  eyebrow.textContent = isOwner() ? 'Your tree' : 'You’re invited to decorate';
  title.textContent = ''; const em = document.createElement('em'); em.textContent = tree.name + '’s'; title.append(em, ' tree');
  const n = orns.length;
  meta.textContent = `${n} ornament${n === 1 ? '' : 's'} · ${countdown()}` + (isOwner() && !n ? ' · share your link to get the first one' : '');
  if (isOwner()) p.textContent = 'Share my link';
  else { p.textContent = 'Hang an ornament'; s.hidden = false; s.textContent = 'Plant my own tree'; }
  $('chips').replaceChildren(...orns.map(o => {
    const b = document.createElement('button'), dot = document.createElement('i');
    b.className = 'chip'; b.style.color = HUES[o.hue]; const label = document.createElement('span'); label.style.color = 'var(--ink)'; label.textContent = o.from;
    b.append(dot, label); b.addEventListener('click', () => openOrn(o)); return b;
  }));
  resize();
}
setInterval(() => store && tree && render(), 60000);

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
  await store.saveTree(user.uid, name); go(user.uid);
}));

$('primary').addEventListener('click', guard(async () => {
  if (!treeId || !tree) return startFlow();
  if (!isOwner()) return openHang();
  const url = location.origin + location.pathname + '?tree=' + encodeURIComponent(treeId);
  if (navigator.share) { try { await navigator.share({ title: document.title, text: 'Hang an ornament on my tree', url }); return; } catch {} }
  await navigator.clipboard.writeText(url); toast('Link copied. Send it to your friends!');
}));
$('secondary').addEventListener('click', startFlow);
$('authBtn').addEventListener('click', guard(async () => {
  if (isOwner()) { await store.signOut(); location.href = location.pathname; } else startFlow();
}));

/* hang an ornament */
let pick = { shape: 0, hue: 1 };
function buildPickers() {
  const sp = $('shapePick'), hp = $('huePick');
  const draw = () => sp.querySelectorAll('canvas').forEach((k, i) => { const g = k.getContext('2d'); g.clearRect(0, 0, 88, 88); drawOrn(g, 44, 44, 15, i, pick.hue); });
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
    b.type = 'button'; b.className = 'swatch'; b.title = n; b.setAttribute('aria-label', n); b.style.color = HUES[i]; b.append(d);
    b.addEventListener('click', () => { pick.hue = i; press(); }); hp.append(b);
  });
  press();
}
buildPickers();

function openHang() {
  $('hangSub').textContent = `${tree.name} can’t read it until ${unlockDay}.`;
  $('hangDlg').showModal();
}
function freeSpot() {
  let best = null, bs = -1;
  for (let i = 0; i < 16; i++) {
    const h = .2 + rnd() * .72, a = rnd() * TAU;
    let m = 9; for (const o of orns) { let da = Math.abs(a - o.a) % TAU; if (da > Math.PI) da = TAU - da; m = Math.min(m, Math.hypot((h - o.h) * 3, da * h)); }
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
    rot = Math.PI / 2 - spot.a; vel = 0;
    $('hangDlg').close(); $('textIn').value = '';
    toast(`Hung! It opens on ${unlockDay}.`);
  } finally { btn.disabled = false; }
}));

/* look at an ornament */
let viewing = null;
const openOrn = guard(async o => {
  viewing = o;
  const g = $('viewOrn').getContext('2d'); g.clearRect(0, 0, 240, 240);
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(120, 0); g.lineTo(120, 70); g.stroke();
  drawOrn(g, 120, 128, 44, o.shape, o.hue);
  $('viewFrom').textContent = 'From ' + o.from;
  const txt = $('viewText'); txt.className = 'message sealed';
  $('viewRemove').hidden = !isOwner();
  if (!unlocked()) txt.textContent = isOwner() ? `Sealed. You can open it on ${unlockDay} (${countdown().replace('opens in ', '')} to go).` : `Sealed until ${unlockDay}. Only ${tree.name} will be able to read it.`;
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
    if (tree) store.watch(treeId, list => {
      const now = performance.now() / 1000;
      if (!firstSnap) for (const o of list) if (!orns.some(x => x.id === o.id)) {
        born[o.id] = now;
        setTimeout(() => { const s = shown.find(x => x.o.id === o.id); if (s) burst(s.x, s.y, HUES[o.hue]); }, 120);
      }
      firstSnap = false; orns = list; render();
    });
  }
  store.onAuth(guard(async u => {
    user = u; render();
    if (pendingStart && u) return startFlow();
    if (!authSeen && u && !treeId && await store.getTree(u.uid)) go(u.uid);
    authSeen = true;
  }));
  render();
})();
