'use strict';

// ---------- Config ----------

const APP_VERSION = '1.2.0'; // keep in step with sw.js; ./bump.sh does both

const COLORS = [
  { name: 'red', hex: '#FF4D4D', dark: '#C92A2A' },
  { name: 'orange', hex: '#FF9F1C', dark: '#C76F00' },
  { name: 'yellow', hex: '#FFD60A', dark: '#C9A300' },
  { name: 'green', hex: '#2EC27E', dark: '#1B8A56' },
  { name: 'blue', hex: '#3A86FF', dark: '#1F5FC4' },
  { name: 'purple', hex: '#9B5DE5', dark: '#6C37B0' },
  { name: 'pink', hex: '#FF6FB5', dark: '#D13F86' },
];
const SHAPES = ['circle', 'square', 'triangle', 'star', 'heart', 'hexagon', 'diamond'];
const NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66]; // one per shape type
const SHAPE_COUNT = 7;
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const MAX_STROKES = 400;
const HOLD_MS = 1500;
// Canvas colors per theme. The CSS side of each theme lives in style.css.
const THEMES = {
  light: { bg: '#FFF8EC', grid: 'rgba(43,36,64,0.07)' },
  dark: { bg: '#17142A', grid: 'rgba(255,255,255,0.08)' },
};
let theme = THEMES.light;

// ---------- Settings (per device) ----------

const DEFAULTS = { sound: true, voice: true, seenIntro: false, theme: 'auto', totalPops: 0 };
const settings = loadSettings();

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('doodlepop') || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings() {
  try { localStorage.setItem('doodlepop', JSON.stringify(settings)); } catch { /* private mode */ }
}

// ---------- Helpers ----------

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const nowSec = () => performance.now() / 1000;

function easeOutBack(k) {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
}

// ---------- Canvas + view ----------
// The world is the size of the screen. Zooming scales the whole world
// (drawings and shapes), and panning is clamped so it always fills the screen.

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const view = { scale: 1, x: 0, y: 0 }; // screen = world * scale + offset
let W = 0, H = 0, DPR = 1, unit = 1;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 3);
  W = window.innerWidth;
  H = window.innerHeight;
  unit = clamp(Math.min(W, H) / 400, 0.8, 1.8);
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  clampView();
  for (const s of shapes) {
    s.x = clamp(s.x, s.r, W - s.r);
    s.y = clamp(s.y, s.r, H - s.r);
  }
}

function clampView() {
  view.scale = clamp(view.scale, MIN_ZOOM, MAX_ZOOM);
  view.x = clamp(view.x, W - W * view.scale, 0);
  view.y = clamp(view.y, H - H * view.scale, 0);
}

const toWorld = (x, y) => ({ x: (x - view.x) / view.scale, y: (y - view.y) / view.scale });

// ---------- Shapes ----------

const shapes = [];
const particles = [];

function makeShape() {
  const r = rand(34, 56) * unit;
  const speed = rand(18, 42) * unit;
  const a = rand(0, Math.PI * 2);
  return {
    type: pick(SHAPES),
    color: pick(COLORS),
    r,
    x: rand(r, Math.max(r, W - r)),
    y: rand(r, Math.max(r, H - r)),
    vx: Math.cos(a) * speed,
    vy: Math.sin(a) * speed,
    phase: rand(0, Math.PI * 2),
    blinkEvery: rand(2.5, 5),
    born: nowSec(),
  };
}

function hitShape(w) {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    if (Math.hypot(w.x - s.x, w.y - s.y) < s.r * 1.25) return s; // generous for small fingers
  }
  return null;
}

function popShape(s) {
  const i = shapes.indexOf(s);
  if (i < 0) return;
  shapes.splice(i, 1);
  burst(s);
  playPop(SHAPES.indexOf(s.type));
  say(`${s.color.name} ${s.type}`);
  countPop();
  setTimeout(() => shapes.push(makeShape()), 700);
}

function burst(s) {
  particles.push({ ring: true, x: s.x, y: s.y, r: s.r, color: s.color.hex, life: 1 });
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
    const sp = rand(120, 320) * unit;
    particles.push({
      x: s.x,
      y: s.y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      r: rand(0.12, 0.24) * s.r,
      star: Math.random() < 0.35,
      color: Math.random() < 0.7 ? s.color.hex : pick(COLORS).hex,
      life: 1,
    });
  }
}

function update(dt) {
  for (const s of shapes) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.x < s.r) { s.x = s.r; s.vx = Math.abs(s.vx); }
    if (s.x > W - s.r) { s.x = W - s.r; s.vx = -Math.abs(s.vx); }
    if (s.y < s.r) { s.y = s.r; s.vy = Math.abs(s.vy); }
    if (s.y > H - s.r) { s.y = H - s.r; s.vy = -Math.abs(s.vy); }
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (p.ring) {
      p.r += 260 * unit * dt;
      p.life -= dt * 2.5;
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;
      p.vy = p.vy * 0.97 + 380 * unit * dt;
      p.life -= dt * 1.3;
    }
    if (p.life <= 0) particles.splice(i, 1);
  }
}

// ---------- Drawing (strokes) ----------

const strokes = [];
let colorIndex = -1; // -1 = rainbow
let rainbowNext = 0;

function startStroke(w) {
  let color;
  if (colorIndex < 0) {
    color = COLORS[rainbowNext % COLORS.length].hex;
    rainbowNext++;
  } else {
    color = COLORS[colorIndex].hex;
  }
  const s = { color, width: (12 * unit) / view.scale, pts: [w], path: null, born: nowSec() };
  strokes.push(s);
  if (strokes.length > MAX_STROKES) strokes.shift();
  return s;
}

function addPoint(s, w) {
  const last = s.pts[s.pts.length - 1];
  if (Math.hypot(w.x - last.x, w.y - last.y) < 1.5 / view.scale) return;
  s.pts.push(w);
}

function finishStroke(s) {
  if (s) s.path = strokePath(s.pts);
}

function discardStroke(s) {
  const i = strokes.indexOf(s);
  if (i >= 0) strokes.splice(i, 1);
}

function strokePath(pts) {
  const p = new Path2D();
  p.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 1) {
    p.lineTo(pts[0].x + 0.01, pts[0].y); // a dot
    return p;
  }
  for (let i = 1; i < pts.length - 1; i++) {
    const m = mid(pts[i], pts[i + 1]);
    p.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
  }
  const last = pts[pts.length - 1];
  p.lineTo(last.x, last.y);
  return p;
}

// ---------- Input ----------
// Every finger is tracked on its own, because little hands rest a thumb on the screen.
//  - A finger that lands on a shape pops it, however many other fingers are down.
//  - Other fingers start 'pending'. A pending finger that moves becomes a drawing finger.
//    One that sits still (a resting thumb) is ignored and leaves no mark, and after
//    REST_TIME it has to move REST_SLOP px before it starts drawing.
//  - Pinch-zoom only kicks in when two fingers start moving at about the same time.
//    A still thumb plus a moving finger draws.

const REST_TIME = 0.35; // s
const MOVE_SLOP = 6;
const REST_SLOP = 30;
const PINCH_WINDOW = 0.3; // s: how close together two fingers must start moving to be a pinch

const pointers = new Map(); // id -> { x, y, sx, sy, down, role, stroke, movedAt }
let pinch = null;

function startPinch(a, b) {
  for (const p of [a, b]) {
    if (p.stroke) discardStroke(p.stroke);
    p.stroke = null;
    p.role = 'pinch';
  }
  pinch = {
    a, b,
    d0: Math.max(dist(a, b), 1),
    world: toWorld(mid(a, b).x, mid(a, b).y),
    scale0: view.scale,
  };
}

function updatePinch() {
  const { a, b } = pinch;
  const m = mid(a, b);
  view.scale = clamp((pinch.scale0 * dist(a, b)) / pinch.d0, MIN_ZOOM, MAX_ZOOM);
  view.x = m.x - pinch.world.x * view.scale;
  view.y = m.y - pinch.world.y * view.scale;
  clampView();
}

// Another finger that just started moving too, so the two of them make a pinch.
function pinchPartner(p, t) {
  if (pinch) return null;
  for (const q of pointers.values()) {
    if (q === p) continue;
    if (q.role === 'draw' && t - q.movedAt < PINCH_WINDOW && q.stroke.pts.length < 12) return q;
    if (q.role === 'pending' && Math.hypot(q.x - q.sx, q.y - q.sy) > MOVE_SLOP / 2 && t - q.down < REST_TIME) return q;
  }
  return null;
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  const t = nowSec();
  const p = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, down: t, role: 'pending', stroke: null, movedAt: 0 };
  pointers.set(e.pointerId, p);
  const hit = hitShape(toWorld(e.clientX, e.clientY));
  if (hit) {
    popShape(hit);
    p.role = 'tap';
  }
});

canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  p.x = e.clientX;
  p.y = e.clientY;
  const t = nowSec();

  if (p.role === 'pinch') {
    updatePinch();
    return;
  }

  if (p.role === 'pending') {
    const slop = t - p.down < REST_TIME ? MOVE_SLOP : REST_SLOP;
    if (Math.hypot(p.x - p.sx, p.y - p.sy) < slop) return; // still resting
    const partner = pinchPartner(p, t);
    if (partner) {
      startPinch(partner, p);
      updatePinch();
      return;
    }
    p.role = 'draw';
    p.movedAt = t;
    p.stroke = startStroke(toWorld(p.sx, p.sy));
  }

  if (p.role !== 'draw' && p.role !== 'tap') return;
  const coalesced = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  const events = coalesced.length ? coalesced : [e];
  for (const ev of events) {
    const w = toWorld(ev.clientX, ev.clientY);
    if (p.stroke) addPoint(p.stroke, w);
    const hit = hitShape(w); // dragging across a shape pops it too
    if (hit) popShape(hit);
  }
});

function onPointerEnd(e) {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  pointers.delete(e.pointerId);
  if (p.role === 'draw') {
    finishStroke(p.stroke);
  } else if (p.role === 'pending' && e.type === 'pointerup' && nowSec() - p.down < REST_TIME) {
    finishStroke(startStroke(toWorld(p.sx, p.sy))); // a quick tap leaves a dot
  } else if (p.role === 'pinch' && pinch) {
    // The other pinch finger goes back to resting, so lifting one finger doesn't draw a stray line.
    const other = pinch.a === p ? pinch.b : pinch.a;
    other.role = 'pending';
    other.sx = other.x;
    other.sy = other.y;
    other.down = -Infinity;
    pinch = null;
  }
}
canvas.addEventListener('pointerup', onPointerEnd);
canvas.addEventListener('pointercancel', onPointerEnd);

// Block Safari's own pinch-zoom, double-tap zoom and long-press menus.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// ---------- Rendering ----------

function shapePath(c, type, r) {
  c.beginPath();
  switch (type) {
    case 'circle':
      c.arc(0, 0, r, 0, Math.PI * 2);
      break;
    case 'square': {
      const h = r * 0.85, k = r * 0.3;
      c.moveTo(-h + k, -h);
      c.arcTo(h, -h, h, h, k);
      c.arcTo(h, h, -h, h, k);
      c.arcTo(-h, h, -h, -h, k);
      c.arcTo(-h, -h, h, -h, k);
      break;
    }
    case 'triangle':
      c.moveTo(0, -r * 1.05);
      c.lineTo(r * 1.0, r * 0.75);
      c.lineTo(-r * 1.0, r * 0.75);
      break;
    case 'star':
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 ? r * 0.52 : r * 1.12;
        c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      break;
    case 'heart':
      c.moveTo(0, r * 0.9);
      c.bezierCurveTo(-r * 1.4, -r * 0.05, -r * 0.75, -r * 1.15, 0, -r * 0.5);
      c.bezierCurveTo(r * 0.75, -r * 1.15, r * 1.4, -r * 0.05, 0, r * 0.9);
      break;
    case 'hexagon':
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      break;
    case 'diamond':
      c.moveTo(0, -r * 1.15);
      c.lineTo(r * 0.85, 0);
      c.lineTo(0, r * 1.15);
      c.lineTo(-r * 0.85, 0);
      break;
  }
  c.closePath();
}

// Where the face sits (y offset, size) so it looks centered on each shape.
const FACE = {
  circle: [0, 1], square: [0, 1], triangle: [0.3, 0.7], star: [0.08, 0.7],
  heart: [-0.05, 0.8], hexagon: [0, 0.95], diamond: [0, 0.75],
};

function drawFace(s, t) {
  const [oy, k] = FACE[s.type];
  const r = s.r * k;
  ctx.save();
  ctx.translate(0, s.r * oy);
  const ink = '#2B2440';
  const blinking = (t + s.phase) % s.blinkEvery < 0.13;
  // Pupils look the way the shape is moving
  const sp = Math.hypot(s.vx, s.vy) || 1;
  const lx = (s.vx / sp) * r * 0.06, ly = (s.vy / sp) * r * 0.06;
  for (const ex of [-0.32, 0.32]) {
    if (blinking) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = r * 0.07;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex * r - r * 0.13, -r * 0.14);
      ctx.lineTo(ex * r + r * 0.13, -r * 0.14);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex * r, -r * 0.14, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(ex * r + lx, -r * 0.14 + ly, r * 0.095, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (const cx of [-0.52, 0.52]) {
    ctx.beginPath();
    ctx.arc(cx * r, r * 0.16, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = ink;
  ctx.lineWidth = r * 0.07;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, r * 0.08, r * 0.22, Math.PI * 0.18, Math.PI * 0.82);
  ctx.stroke();
  ctx.restore();
}

function drawShape(s, t) {
  const age = t - s.born;
  const grow = age < 0.45 ? easeOutBack(clamp(age / 0.45, 0, 1)) : 1;
  const squish = Math.sin(t * 2.2 + s.phase) * 0.04;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(Math.sin(t * 1.3 + s.phase) * 0.18);
  ctx.scale(grow * (1 + squish), grow * (1 - squish));
  shapePath(ctx, s.type, s.r);
  ctx.fillStyle = s.color.hex;
  ctx.fill();
  ctx.lineWidth = s.r * 0.09;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = s.color.dark;
  ctx.stroke();
  drawFace(s, t);
  ctx.restore();
}

function drawGrid() {
  // Faint dots give a sense of scale while zoomed in.
  const step = 32 * unit;
  const x0 = Math.floor(-view.x / view.scale / step) * step;
  const y0 = Math.floor(-view.y / view.scale / step) * step;
  const x1 = (W - view.x) / view.scale;
  const y1 = (H - view.y) / view.scale;
  ctx.fillStyle = theme.grid;
  ctx.beginPath();
  for (let x = x0; x <= x1; x += step) {
    for (let y = y0; y <= y1; y += step) {
      ctx.moveTo(x + 1.6, y);
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    }
  }
  ctx.fill();
}

function drawStrokes() {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.stroke(s.path || strokePath(s.pts));
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life, 0, 1);
    if (p.ring) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 6 * unit * p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      shapePath(ctx, p.star ? 'star' : 'circle', p.r);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

let lastT = nowSec();

function frame() {
  const t = nowSec();
  const dt = Math.min(0.05, t - lastT);
  lastT = t;
  update(dt);

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.setTransform(DPR * view.scale, 0, 0, DPR * view.scale, DPR * view.x, DPR * view.y);
  drawGrid();
  drawStrokes();
  for (const s of shapes) drawShape(s, t);
  drawParticles();

  requestAnimationFrame(frame);
}

// ---------- Sound + voice ----------

let audio = null;

function initAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!audio && AC) audio = new AC();
  if (audio && audio.state === 'suspended') audio.resume();
}

function tone(freq, start, len, vol, type) {
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq * 0.6, start);
  o.frequency.exponentialRampToValueAtTime(freq, start + 0.06);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + len);
  o.connect(g).connect(audio.destination);
  o.start(start);
  o.stop(start + len + 0.05);
}

function playPop(i) {
  if (!settings.sound || !audio) return;
  const t = audio.currentTime;
  const f = NOTES[i % NOTES.length];
  tone(f, t, 0.32, 0.3, 'triangle');
  tone(f * 2, t + 0.05, 0.22, 0.08, 'sine'); // sparkle
}

let lastSpoken = 0;

function say(text) {
  if (!settings.voice || !('speechSynthesis' in window)) return;
  const t = nowSec();
  if (t - lastSpoken < 0.6) return; // don't pile up when popping several at once
  lastSpoken = t;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.9;
  u.pitch = 1.3;
  speechSynthesis.speak(u);
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && audio && audio.state === 'suspended') audio.resume();
});

// ---------- UI ----------

const $ = (id) => document.getElementById(id);
const startEl = $('start');
const parentEl = $('parent');

const tpl = $('lockHelpTpl');
for (const el of document.querySelectorAll('.lockHelp')) el.appendChild(tpl.content.cloneNode(true));

// Palette
const palette = $('palette');
function buildPalette() {
  const choices = [{ name: 'rainbow', i: -1 }, ...COLORS.map((c, i) => ({ name: c.name, i, hex: c.hex }))];
  for (const c of choices) {
    const b = document.createElement('button');
    b.setAttribute('aria-label', c.name);
    if (c.i < 0) b.className = 'rainbow';
    else b.style.background = c.hex;
    if (c.i === colorIndex) b.classList.add('on');
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      colorIndex = c.i;
      for (const other of palette.children) other.classList.toggle('on', other === b);
      say(c.name);
    });
    palette.appendChild(b);
  }
}
buildPalette();

// Start screen
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
$('installTip').hidden = !(isIOS && !standalone);
$('lockDetails').open = !settings.seenIntro;

$('play').addEventListener('click', () => {
  initAudio();
  if ('speechSynthesis' in window) speechSynthesis.speak(new SpeechSynthesisUtterance('')); // unlock voice on iOS
  settings.seenIntro = true;
  saveSettings();
  startEl.hidden = true;
});

// Grown-up menu: press and hold the lock button
const hold = $('hold');
let holdTimer = null;
hold.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  hold.classList.add('holding');
  holdTimer = setTimeout(openParent, HOLD_MS);
});
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
  hold.addEventListener(ev, () => {
    clearTimeout(holdTimer);
    hold.classList.remove('holding');
  });
}

function openParent() {
  hold.classList.remove('holding');
  $('optSound').checked = settings.sound;
  $('optVoice').checked = settings.voice;
  $('totalPops').textContent = settings.totalPops.toLocaleString();
  parentEl.hidden = false;
}

$('optSound').addEventListener('change', (e) => { settings.sound = e.target.checked; saveSettings(); });
$('optVoice').addEventListener('change', (e) => { settings.voice = e.target.checked; saveSettings(); });
$('version').textContent = 'Version ' + APP_VERSION;

// Theme: follow the phone's setting ('auto'), or force light/dark.
const darkQuery = matchMedia('(prefers-color-scheme: dark)');

function applyTheme() {
  const name = settings.theme === 'auto' ? (darkQuery.matches ? 'dark' : 'light') : settings.theme;
  theme = THEMES[name];
  document.documentElement.dataset.theme = name;
  document.querySelector('meta[name="theme-color"]').content = theme.bg;
  for (const b of document.querySelectorAll('#optTheme button')) {
    b.classList.toggle('on', b.dataset.theme === settings.theme);
  }
}

darkQuery.addEventListener('change', applyTheme);
for (const b of document.querySelectorAll('#optTheme button')) {
  b.addEventListener('click', () => {
    settings.theme = b.dataset.theme;
    saveSettings();
    applyTheme();
  });
}
applyTheme();

// Pop counter: on screen it counts this visit; the grown-up menu shows the all-time total.
const counterEl = $('counter');
let sessionPops = 0;

function countPop() {
  sessionPops++;
  settings.totalPops++;
  saveSettings();
  $('popCount').textContent = sessionPops;
  counterEl.classList.remove('bump');
  void counterEl.offsetWidth; // restart the bump animation
  counterEl.classList.add('bump');
}

$('resetCount').addEventListener('click', () => {
  sessionPops = 0;
  $('popCount').textContent = 0;
});
$('clear').addEventListener('click', () => {
  strokes.length = 0;
  for (const p of pointers.values()) p.stroke = null;
});
$('resetZoom').addEventListener('click', () => { view.scale = 1; view.x = 0; view.y = 0; });
$('resume').addEventListener('click', () => { initAudio(); parentEl.hidden = true; });

// ---------- Boot ----------

window.addEventListener('resize', resize);
resize();
for (let i = 0; i < SHAPE_COUNT; i++) {
  const s = makeShape();
  s.born -= 1; // already full size behind the start screen
  shapes.push(s);
}
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
