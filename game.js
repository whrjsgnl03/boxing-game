/* 글러브 터치 — 1인칭 복싱 (Three.js r128) */
(() => {
'use strict';

const T = THREE, V3 = T.Vector3;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeIn = t => t * t;
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// 테스트용 URL 옵션: ?auto=1&speed=4&skill=0.8&stopAt=odown&after=2
const Q = new URLSearchParams(location.search);
const AUTO = Q.has('auto');
const SPEED = Math.max(1, +Q.get('speed') || 1);
const BOT_SKILL = Q.has('skill') ? +Q.get('skill') : .6;
const BOT_RATE = Q.has('rate') ? +Q.get('rate') : 4;
const STOP_AT = Q.get('stopAt'), STOP_AFTER = +Q.get('after') || 0;

window.addEventListener('error', e => {
  $('err').textContent += (e.message || e) + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno + '\n';
});

// ───────────────────────── 렌더러 / 씬 ─────────────────────────
const canvas = $('c');
const renderer = new T.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputEncoding = T.sRGBEncoding;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;

const scene = new T.Scene();
scene.background = new T.Color(0x06070c);
scene.fog = new T.Fog(0x06070c, 9, 26);
const camera = new T.PerspectiveCamera(68, 1, .03, 70);
scene.add(camera);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 1.2 ? 80 : 68;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

function M(color, o) {
  const m = new T.MeshStandardMaterial(Object.assign({ color, roughness: .7, metalness: 0 }, o));
  m.color.convertSRGBToLinear();
  return m;
}
function mesh(g, m, shadow = true) { const x = new T.Mesh(g, m); x.castShadow = shadow; return x; }
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c);
  t.encoding = T.sRGBEncoding;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

const glowTex = canvasTex(128, 128, (g, w, h) => {
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(.25, 'rgba(255,240,200,.7)');
  r.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, h);
});

// ───────────────────────── 경기장 ─────────────────────────
const RING = 3.1;
const crowdFlashes = [];
(function buildArena() {
  const R = RING;
  const hall = new T.Mesh(new T.PlaneGeometry(90, 90), M(0x090a0f, { roughness: 1 }));
  hall.rotation.x = -Math.PI / 2; hall.position.y = -1.05; scene.add(hall);

  const plat = mesh(new T.BoxGeometry(R * 2 + 1.1, 1.05, R * 2 + 1.1), M(0x16203c, { roughness: .9 }), false);
  plat.position.y = -.53; scene.add(plat);

  const tex = canvasTex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#b7c4d4'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${Math.random() < .5 ? 255 : 50},${Math.random() < .5 ? 255 : 60},${90 + Math.random() * 120 | 0},${Math.random() * .035})`;
      g.beginPath(); g.arc(rand(0, w), rand(0, h), rand(8, 70), 0, 7); g.fill();
    }
    g.strokeStyle = '#1f3f86'; g.lineWidth = 14; g.strokeRect(40, 40, w - 80, h - 80);
    g.beginPath(); g.arc(w / 2, h / 2, 232, 0, 7); g.lineWidth = 18; g.stroke();
    g.beginPath(); g.arc(w / 2, h / 2, 202, 0, 7); g.lineWidth = 4; g.strokeStyle = '#c0392b'; g.stroke();
    g.font = '900 92px -apple-system,Helvetica,Arial,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#1f3f86'; g.fillText('GLOVE', w / 2, h / 2 - 52);
    g.fillStyle = '#c0392b'; g.fillText('TOUCH', w / 2, h / 2 + 52);
  });
  const mat = new T.Mesh(new T.PlaneGeometry(R * 2, R * 2), new T.MeshStandardMaterial({ map: tex, roughness: .92 }));
  mat.rotation.x = -Math.PI / 2; mat.receiveShadow = true; scene.add(mat);

  const steel = M(0x9aa0aa, { metalness: .6, roughness: .4 });
  for (const [x, z, c] of [[-R, -R, 0xeeeeee], [R, -R, 0x2456c7], [R, R, 0xeeeeee], [-R, R, 0xc0392b]]) {
    const post = mesh(new T.CylinderGeometry(.07, .07, 1.5, 12), steel); post.position.set(x, .75, z); scene.add(post);
    const pad = mesh(new T.BoxGeometry(.26, 1.08, .26), M(c, { roughness: .6 }));
    pad.position.set(x - Math.sign(x) * .15, .86, z - Math.sign(z) * .15); pad.rotation.y = Math.PI / 4; scene.add(pad);
  }
  const ropeC = [0xc0392b, 0xf0f0f0, 0x2456c7, 0xf0f0f0];
  [.48, .78, 1.08, 1.38].forEach((y, i) => {
    const m = M(ropeC[i], { roughness: .6 });
    for (const [x, z, side] of [[0, -R, 0], [0, R, 0], [-R, 0, 1], [R, 0, 1]]) {
      const r = mesh(new T.CylinderGeometry(.024, .024, R * 2, 8), m, false);
      if (side) r.rotation.x = Math.PI / 2; else r.rotation.z = Math.PI / 2;
      r.position.set(x, y, z); scene.add(r);
    }
  });

  const ctex = canvasTex(2048, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#06070c'); gr.addColorStop(.2, '#06070c'); gr.addColorStop(1, '#0d0f18');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 14; row++) {
      const y = h * .26 + row * 27, sz = 7 + row * .9;
      for (let x = rand(0, 20); x < w; x += sz * rand(2, 2.8)) {
        g.fillStyle = `hsl(${rand(0, 360) | 0},${rand(8, 26) | 0}%,${(5 + Math.random() * 11 + row * .7) | 0}%)`;
        const yy = y + rand(-4, 4);
        g.beginPath(); g.arc(x, yy, sz, 0, 7); g.fill();
        g.fillRect(x - sz * 1.2, yy + sz * .8, sz * 2.4, sz * 2.4);
      }
    }
  });
  ctex.wrapS = T.RepeatWrapping; ctex.repeat.x = 2;
  const crowd = new T.Mesh(new T.CylinderGeometry(15, 17, 9, 48, 1, true), new T.MeshBasicMaterial({ map: ctex, side: T.BackSide, fog: false, toneMapped: false }));
  crowd.position.y = 2.6; scene.add(crowd);

  const rig = new T.Group(); rig.position.y = 6.4; scene.add(rig);
  const truss = M(0x22252e, { metalness: .7, roughness: .5 });
  for (const [x, z, w, d] of [[0, -2, 4.5, .12], [0, 2, 4.5, .12], [-2.2, 0, .12, 4.1], [2.2, 0, .12, 4.1]]) {
    const b = new T.Mesh(new T.BoxGeometry(w, .12, d), truss); b.position.set(x, 0, z); rig.add(b);
  }
  const lampM = new T.MeshBasicMaterial({ color: 0xfff3d6, fog: false });
  for (const [x, z] of [[-1.4, -2], [0, -2], [1.4, -2], [-1.4, 2], [0, 2], [1.4, 2], [-2.2, 0], [2.2, 0]]) {
    const l = new T.Mesh(new T.CylinderGeometry(.22, .3, .18, 16), lampM); l.position.set(x, -.12, z); rig.add(l);
  }

  scene.add(new T.HemisphereLight(0x94a8cc, 0x1c1612, .5));
  const spot = new T.SpotLight(0xfff1dc, 1.7, 32, Math.PI / 4.2, .5, 1.1);
  spot.position.set(0, 7.6, 1.6); spot.target.position.set(0, 0, -.2); scene.add(spot, spot.target);
  spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -.0004;
  spot.shadow.camera.near = 2; spot.shadow.camera.far = 14;
  const rim = new T.DirectionalLight(0x6f8cff, .55); rim.position.set(-3, 4, -5); scene.add(rim);
  const fill = new T.PointLight(0xffd9b0, .55, 12); fill.position.set(.5, 2.6, 3.6); scene.add(fill);

  for (let i = 0; i < 5; i++) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex, blending: T.AdditiveBlending, transparent: true, opacity: 0, fog: false }));
    s.scale.setScalar(.9); scene.add(s); crowdFlashes.push({ s, life: 0 });
  }
})();

// ───────────────────────── 인체 모델 ─────────────────────────
const UP = new V3(0, 1, 0), ZAX = new V3(0, 0, 1);
const _d = new V3(), _p = new V3(), _S = new V3(), _G = new V3(), _E = new V3(), _W = new V3(), _d2 = new V3(), _pole = new V3();

function limb(rA, rB, material) { return mesh(new T.CylinderGeometry(rB, rA, 1, 12), material); }
function setSeg(m, a, b) {
  _d.subVectors(b, a);
  const len = _d.length() || 1e-4;
  m.position.copy(a).addScaledVector(_d, .5);
  m.scale.set(1, len, 1);
  m.quaternion.setFromUnitVectors(UP, _d.multiplyScalar(1 / len));
}
// 2관절 IK: 어깨 S → 손 G, 팔꿈치 위치를 out 에 기록
function solveElbow(S, G, l1, l2, pole, out) {
  _d.subVectors(G, S);
  const dist = _d.length() || 1e-4;
  _d.multiplyScalar(1 / dist);
  const dd = Math.min(dist, l1 + l2 - 1e-3);
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  _p.copy(pole).addScaledVector(_d, -pole.dot(_d));
  if (_p.lengthSq() < 1e-6) _p.set(0, -1, 0);
  _p.normalize();
  out.copy(S).addScaledVector(_d, a).addScaledVector(_p, h);
}
function makeGlove(color, s, scale = 1) {
  const g = new T.Group(), m = M(color, { roughness: .42 });
  const main = mesh(new T.SphereGeometry(.1, 18, 14), m); main.scale.set(1, 1.02, 1.22); g.add(main);
  const thumb = mesh(new T.SphereGeometry(.05, 12, 10), m); thumb.scale.set(1, 1, 1.5); thumb.position.set(-s * .078, -.012, -.01); g.add(thumb);
  const cuff = mesh(new T.CylinderGeometry(.064, .072, .1, 14), M(0xf3f3f3, { roughness: .6 })); cuff.rotation.x = Math.PI / 2; cuff.position.z = -.135; g.add(cuff);
  g.scale.setScalar(scale);
  return g;
}
function bez(p, i, a, v, b, k) { const q = 1 - k; for (let j = 0; j < 3; j++) p[i + j] = q * q * a[i + j] + 2 * q * k * v[j] + k * k * b[i + j]; }

// 포즈 = [off xyz, lean xyz, 왼글러브 xyz, 오른글러브 xyz, 왼팔꿈치 들림, 오른팔꿈치 들림]  (왼=화면 왼쪽, x<0)
function mk(o) {
  const d = Object.assign({ off: [0, 0, 0], lean: [.14, 0, 0], gl: [-.12, 1.6, .27], gr: [.12, 1.58, .24], el: 0, er: 0 }, o);
  const p = new Float32Array(14);
  p.set(d.off, 0); p.set(d.lean, 3); p.set(d.gl, 6); p.set(d.gr, 9); p[12] = d.el; p[13] = d.er;
  return p;
}
const hand = (s, v) => s < 0 ? { gl: v } : { gr: v };
const elb = (s, v) => s < 0 ? { el: v } : { er: v };

class Figure {
  constructor(o) {
    const S = this;
    S.L1 = o.arm || .35; S.speed = o.speed || 1.5; S.sway = o.sway || 0; S.ph = Math.random() * 6;
    S.walkPhase = 0; S.walkAmt = 0; S.fall = 0; S.fallTw = null; S.tw = null; S.dest = null; S.onArrive = null; S.faceT = 0;
    S.ext = 0; S.kick = { rx: 0, rz: 0, y: 0, z: 0, hx: 0 };
    S.pose = new Float32Array(14);
    const root = S.root = new T.Group(); root.rotation.order = 'YXZ'; root.scale.setScalar(o.scale || 1); scene.add(root);
    const skin = M(o.skin, { roughness: .62 });
    const top = o.shirt != null ? M(o.shirt, { roughness: .85 }) : skin;
    const trunk = M(o.trunks, { roughness: .85 });

    const hips = S.hips = new T.Group(); root.add(hips);
    const pelvis = mesh(new T.CylinderGeometry(.168, .15, .27, 18), trunk); pelvis.scale.z = .72; hips.add(pelvis);
    if (o.band != null) { const b = mesh(new T.CylinderGeometry(.171, .171, .055, 18), M(o.band)); b.scale.z = .72; b.position.y = .125; hips.add(b); }

    const torso = S.torso = new T.Group(); torso.position.y = .1; hips.add(torso);
    const chest = mesh(new T.CylinderGeometry(.212, .152, .46, 18), top); chest.scale.z = .62; chest.position.y = .25; torso.add(chest);
    const trap = mesh(new T.SphereGeometry(.212, 18, 10), top); trap.scale.set(1, .3, .62); trap.position.y = .48; torso.add(trap);
    for (const s of [-1, 1]) { const sh = mesh(new T.SphereGeometry(.086, 14, 10), top); sh.position.set(s * .2, .44, 0); torso.add(sh); }
    const neck = mesh(new T.CylinderGeometry(.05, .062, .14, 10), skin); neck.position.y = .54; torso.add(neck);
    if (o.tie) {
      const tm = M(0x111111);
      for (const s of [-1, 1]) { const w = mesh(new T.ConeGeometry(.028, .05, 4), tm, false); w.rotation.z = s * Math.PI / 2; w.position.set(s * .028, .455, .128); torso.add(w); }
    }

    const head = S.head = new T.Group(); head.position.y = .66; torso.add(head);
    const skull = mesh(new T.SphereGeometry(.115, 22, 16), skin); skull.scale.set(1, 1.16, 1.06); head.add(skull);
    if (o.hair != null) {
      const hair = mesh(new T.SphereGeometry(.119, 22, 12, 0, Math.PI * 2, 0, Math.PI * .42), M(o.hair, { roughness: .9 }));
      hair.scale.set(1, 1.16, 1.06); hair.rotation.x = -.3; head.add(hair);
    }
    const dark = M(0x16110e, { roughness: .5 });
    for (const s of [-1, 1]) {
      const eye = new T.Mesh(new T.SphereGeometry(.015, 8, 6), dark); eye.position.set(s * .042, .02, .108); head.add(eye);
      const brow = new T.Mesh(new T.BoxGeometry(.046, .011, .02), dark); brow.position.set(s * .042, .05, .106); brow.rotation.z = s * (o.angry ? .32 : .05); head.add(brow);
      const ear = mesh(new T.SphereGeometry(.026, 8, 6), skin); ear.scale.z = .6; ear.position.set(s * .113, 0, 0); head.add(ear);
    }
    const nose = new T.Mesh(new T.BoxGeometry(.024, .042, .03), skin); nose.position.set(0, -.012, .118); head.add(nose);
    const mouth = new T.Mesh(new T.BoxGeometry(.05, .009, .01), dark); mouth.position.set(0, -.066, .103); head.add(mouth);

    const sleeve = o.shirt != null ? top : skin;
    S.arm = [-1, 1].map(s => {
      const a = { s, upper: limb(.066, .055, sleeve), fore: limb(.052, .044, skin), wrist: o.gloves != null ? .1 : .03 };
      a.hand = o.gloves != null ? makeGlove(o.gloves, s) : mesh(new T.SphereGeometry(.045, 10, 8), skin);
      root.add(a.upper, a.fore, a.hand);
      return a;
    });
    const legM = o.pants != null ? M(o.pants, { roughness: .85 }) : null;
    S.leg = [-1, 1].map(s => {
      const l = {
        s, thigh: limb(.092, .068, legM || trunk), shin: limb(.062, .045, legM || skin),
        foot: mesh(new T.BoxGeometry(.1, .08, .25), M(o.shoes, { roughness: .6 })),
        foot0: new V3(s * (o.stance ? .19 : .13), 0, o.stance ? (s < 0 ? .15 : -.12) : 0),
      };
      root.add(l.thigh, l.shin, l.foot);
      return l;
    });
    if (o.hit) {
      const inv = new T.MeshBasicMaterial({ visible: false });
      S.headHit = new T.Mesh(new T.SphereGeometry(.2, 10, 8), inv); head.add(S.headHit);
      S.bodyHit = new T.Mesh(new T.BoxGeometry(.56, .78, .44), inv); S.bodyHit.position.y = .1; torso.add(S.bodyHit);
      S.headHit.userData.zone = 'head'; S.bodyHit.userData.zone = 'body';
    }
  }
  reset(pos, ry) {
    this.root.position.set(pos.x, 0, pos.z); this.root.rotation.set(0, ry, 0); this.faceT = ry;
    this.dest = null; this.onArrive = null; this.fall = 0; this.fallTw = null; this.tw = null; this.walkAmt = 0; this.ext = 0;
    const k = this.kick; k.rx = k.rz = k.y = k.z = k.hx = 0;
  }
  setPose(p) { this.pose.set(p); this.tw = null; }
  tween(p, dur, ease, opt) {
    this.tw = { from: Float32Array.from(this.pose), to: p, t: 0, dur: Math.max(dur, .001), ease: ease || easeInOut, viaL: opt && opt.viaL, viaR: opt && opt.viaR };
  }
  goTo(v, face, cb) { this.dest = new V3(v.x, 0, v.z); if (face != null) this.faceT = face; this.onArrive = cb || null; }
  fallTo(v, dur) { this.fallTw = { from: this.fall, to: v, t: 0, dur }; }
  update(dt, time) {
    const tw = this.tw;
    if (tw) {
      tw.t += dt;
      const u = Math.min(1, tw.t / tw.dur), k = tw.ease(u), p = this.pose, a = tw.from, b = tw.to;
      for (let i = 0; i < 14; i++) p[i] = a[i] + (b[i] - a[i]) * k;
      if (tw.viaL) bez(p, 6, a, tw.viaL, b, k);
      if (tw.viaR) bez(p, 9, a, tw.viaR, b, k);
      if (u >= 1 && this.tw === tw) this.tw = null;
    }
    if (this.dest) {
      const r = this.root.position, dx = this.dest.x - r.x, dz = this.dest.z - r.z, d = Math.hypot(dx, dz), st = this.speed * dt;
      if (d <= st) { r.x = this.dest.x; r.z = this.dest.z; this.dest = null; const cb = this.onArrive; this.onArrive = null; if (cb) cb(); }
      else { r.x += dx / d * st; r.z += dz / d * st; this.walkPhase += dt * 9.5; }
    }
    if (!this.dest && this.ext > .05) this.walkPhase += dt * 9.5 * this.ext;
    this.walkAmt += ((this.dest ? 1 : this.ext) - this.walkAmt) * (1 - Math.exp(-dt * 10));
    let da = this.faceT - this.root.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da));
    this.root.rotation.y += da * (1 - Math.exp(-dt * 7));
    const f = this.fallTw;
    if (f) {
      f.t += dt; const u = Math.min(1, f.t / f.dur);
      this.fall = f.from + (f.to - f.from) * (f.to > f.from ? easeIn(u) : easeInOut(u));
      if (u >= 1) this.fallTw = null;
    }
    this.root.rotation.x = -this.fall * Math.PI / 2;
    this.root.position.y = this.fall * .13;
    const k = this.kick, dk = Math.exp(-dt * 6.5);
    k.rx *= dk; k.rz *= dk; k.y *= dk; k.z *= dk; k.hx *= dk;
    this.apply(time);
  }
  apply(time) {
    const p = this.pose, k = this.kick, sw = this.sway * (1 - this.fall);
    const sx = Math.sin(time * 1.7 + this.ph) * .05 * sw + Math.sin(time * .83 + this.ph * 2) * .035 * sw;
    const sy = Math.sin(time * 3.4 + this.ph) * .012 * sw;
    const hp = this.hips.position;
    hp.set(p[0] + sx, .98 + p[1] + sy + k.y, p[2] + k.z);
    this.torso.rotation.set(p[3] + k.rx, p[4], p[5] + k.rz - sx * .9);
    this.head.rotation.set(-(p[3] + k.rx) * .55 + k.hx, -p[4] * .7, 0);
    const tq = this.torso.quaternion;
    for (const a of this.arm) {
      const i = a.s < 0 ? 6 : 9, e = a.s < 0 ? p[12] : p[13];
      _S.set(a.s * .2, .44, 0).applyQuaternion(tq); _S.y += .1; _S.add(hp);
      _G.set(p[i] + sx * .7, p[i + 1] + sy + k.y * .5, p[i + 2] + k.z * .5);
      _pole.set(a.s * (.5 + .5 * e), -1 + 1.15 * e, -.35 + .15 * e);
      solveElbow(_S, _G, this.L1, this.L1, _pole, _E);
      setSeg(a.upper, _S, _E);
      _d2.subVectors(_G, _E).normalize();
      _W.copy(_G).addScaledVector(_d2, -a.wrist);
      setSeg(a.fore, _E, _W);
      a.hand.position.copy(_G);
      a.hand.quaternion.setFromUnitVectors(ZAX, _d2);
    }
    for (const l of this.leg) {
      const ph = this.walkPhase + (l.s > 0 ? Math.PI : 0), wa = this.walkAmt;
      _S.set(hp.x + l.s * .1, hp.y - .1, hp.z);
      _G.set(l.foot0.x, .09 + Math.max(0, Math.cos(ph)) * .08 * wa, l.foot0.z + Math.sin(ph) * .17 * wa);
      _pole.set(l.s * .25, 0, 1);
      solveElbow(_S, _G, .47, .47, _pole, _E);
      setSeg(l.thigh, _S, _E); setSeg(l.shin, _E, _G);
      l.foot.position.set(_G.x, _G.y - .05, _G.z + .05);
    }
  }
}

const POSE = {
  guardHigh: mk({}),
  guardLow: mk({ lean: [.1, 0, 0], gl: [-.15, 1.26, .3], gr: [.15, 1.24, .27] }),
  stance: mk({ lean: [.12, 0, 0], gl: [-.16, 1.48, .26], gr: [.15, 1.44, .22] }),
  relax: mk({ lean: [.04, 0, 0], gl: [-.25, 1.08, .1], gr: [.25, 1.08, .1] }),
  touch: mk({ lean: [.12, 0, 0], gl: [-.24, 1.12, .12], gr: [.08, 1.36, .56] }),
  stun: mk({ off: [0, 0, -.1], lean: [-.2, 0, .08], gl: [-.3, 1.32, .12], gr: [.3, 1.26, .1] }),
  fallen: mk({ lean: [-.08, 0, 0], gl: [-.55, 1.4, -.02], gr: [.5, 1.25, -.02], el: .6, er: .6 }),
  victory: mk({ lean: [-.05, 0, 0], gl: [-.36, 2.08, .02], gr: [.36, 2.08, .02] }),
  sad: mk({ lean: [.3, 0, 0], gl: [-.24, 1, .14], gr: [.24, 1, .14] }),
  open: s => mk({ off: [0, -.05, .1], lean: [.3, -s * .2, 0], gl: [-.34, 1.2, .3], gr: [.32, 1.14, .24] }),
  weaveLow: s => mk({ off: [s * .12, -.36, .04], lean: [.46, 0, -s * .1], gl: [-.13 + s * .12, 1.3, .3], gr: [.13 + s * .12, 1.28, .28] }),
  weaveSide: s => mk({ off: [s * .32, -.1, .02], lean: [.22, -s * .2, -s * .26], gl: [-.13 + s * .3, 1.52, .28], gr: [.13 + s * .3, 1.5, .25] }),
  windup(type, s) {
    if (type === 'jab') return mk(Object.assign({ lean: [.06, s * .3, 0] }, hand(s, [s * .17, 1.5, .1])));
    if (type === 'hook') return mk(Object.assign({ off: [s * .05, 0, 0], lean: [.06, s * .45, -s * .06] }, hand(s, [s * .52, 1.56, .16]), elb(s, 1)));
    return mk(Object.assign({ off: [0, -.2, 0], lean: [.36, s * .25, 0] }, hand(s, [s * .2, .98, .22])));
  },
  strike(type, s, z = 1) {
    const via = v => s < 0 ? { viaL: v } : { viaR: v };
    if (type === 'jab') return { pose: mk(Object.assign({ off: [0, 0, .14], lean: [.34, -s * .35, 0] }, hand(s, [s * .04, 1.66, z]))) };
    if (type === 'hook') return { pose: mk(Object.assign({ off: [0, 0, .14], lean: [.25, -s * .6, 0] }, hand(s, [-s * .12, 1.64, z - .05]), elb(s, 1))), opt: via([s * .5, 1.64, z * .8]) };
    return { pose: mk(Object.assign({ off: [0, .04, .14], lean: [.1, -s * .3, 0] }, hand(s, [s * .03, 1.66, z - .04]))), opt: via([s * .12, 1.05, z * .85]) };
  },
};
const RP = {
  neutral: mk({ lean: [.03, 0, 0], gl: [-.27, .95, .05], gr: [.27, .95, .05] }),
  up: mk({ lean: [0, 0, 0], gl: [-.27, .95, .05], gr: [.2, 2, .2] }),
  down: mk({ lean: [.2, 0, 0], gl: [-.27, .95, .05], gr: [.22, 1.2, .55] }),
  leanUp: mk({ lean: [.5, 0, 0], gl: [-.3, 1, .3], gr: [.2, 1.75, .7] }),
  leanDown: mk({ lean: [.62, 0, 0], gl: [-.3, 1, .3], gr: [.22, 1.02, .8] }),
  waveA: mk({ lean: [.05, 0, 0], gl: [-.42, 2.05, .15], gr: [.42, 2.05, .15] }),
  waveB: mk({ lean: [.05, 0, 0], gl: [.12, 2, .2], gr: [-.12, 2, .2] }),
  raise: mk({ lean: [0, 0, 0], gl: [-.27, .95, .05], gr: [.3, 2.08, .05] }),
};

const PLAYER_POS = new V3(0, 1.62, 1.05), LOOK_FIGHT = new V3(0, 1.5, -.1);
const OPP_HOME = new V3(0, 0, -.1), OPP_CORNER = new V3(1.7, 0, -1.9);
const REF_INTRO = new V3(-1.05, 0, -.3), REF_FIGHT = new V3(-1.25, 0, -.7), CENTER = new V3(0, 0, .4);
const faceTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);

let opp = new Figure({ skin: 0xb9805a, trunks: 0x1d4ed8, band: 0xf2f2f2, gloves: 0x2a5fe0, shoes: 0x15171c, hair: 0x1a1512, angry: true, stance: true, hit: true, sway: 1, scale: .96, speed: 1.35 });
const ref = new Figure({ skin: 0xe0b08a, shirt: 0xcfe0f2, trunks: 0x14161c, pants: 0x14161c, shoes: 0x0c0c0e, hair: 0x6a6a6a, tie: true, sway: .35, arm: .33, speed: 1.9 });
const oppMain = opp;   // 1:1 모드의 상대. 난투에서는 opp 가 '지금 노리는 상대'로 바뀐다
let hitMeshes = [opp.headHit, opp.bodyHit];

// ───────────────────────── 1인칭 팔 ─────────────────────────
const HANDS = ['L', 'R'];
const REST = { L: new V3(-.27, -.31, -.52), R: new V3(.27, -.32, -.48) };
const GUARD = { L: new V3(-.115, -.13, -.36), R: new V3(.115, -.13, -.36) };
const LOW = { L: new V3(-.32, -.75, -.3), R: new V3(.32, -.75, -.3) };
const CHEER = { L: new V3(-.3, .1, -.5), R: new V3(.3, .1, -.5) };
const FP = { grp: new T.Group(), arm: {}, cur: { L: REST.L.clone(), R: REST.R.clone() } };
camera.add(FP.grp);
{
  const skin = M(0xd9a377, { roughness: .6 });
  for (const h of HANDS) {
    const s = h === 'L' ? -1 : 1;
    const a = { s, upper: limb(.07, .06, skin), fore: limb(.058, .05, skin), hand: makeGlove(0xd0201a, s, 1.05), sh: new V3(s * .26, -.4, .15) };
    FP.grp.add(a.upper, a.fore, a.hand);
    FP.arm[h] = a;
  }
  FP.grp.traverse(o => { o.castShadow = false; o.frustumCulled = false; });
}

// ───────────────────────── 이펙트 ─────────────────────────
const sweat = [];
{
  const geo = new T.SphereGeometry(.011, 6, 4), mat = new T.MeshBasicMaterial({ color: 0xdfefff, transparent: true, opacity: .85 });
  for (let i = 0; i < 50; i++) { const m = new T.Mesh(geo, mat); m.visible = false; scene.add(m); sweat.push({ m, v: new V3(), life: 0 }); }
}
let sweatI = 0;
function spawnSweat(pos, n, dirX) {
  for (let i = 0; i < n; i++) {
    const s = sweat[sweatI++ % sweat.length];
    s.m.position.copy(pos); s.v.set(rand(-1.2, 1.2) + dirX, rand(.6, 2.4), rand(-1.6, .4)); s.life = rand(.35, .6); s.m.visible = true;
  }
}
const flashSp = new T.Sprite(new T.SpriteMaterial({ map: glowTex, blending: T.AdditiveBlending, depthTest: false, transparent: true, opacity: 0 }));
scene.add(flashSp);
let flashT = 0, flashSize = .45;
function flash(pos, size = .45) { flashSp.position.copy(pos); flashT = .14; flashSize = size; }
function fxUpdate(dt) {
  for (const s of sweat) {
    if (s.life <= 0) continue;
    s.life -= dt; s.v.y -= 7 * dt; s.m.position.addScaledVector(s.v, dt);
    if (s.life <= 0) s.m.visible = false;
  }
  if (flashT > 0) {
    flashT -= dt; const k = clamp(flashT / .14, 0, 1);
    flashSp.material.opacity = k; flashSp.scale.setScalar(flashSize * (1.3 - k * .8));
  } else flashSp.material.opacity = 0;
  for (const c of crowdFlashes) {
    if (c.life > 0) { c.life -= dt; c.s.material.opacity = c.life > 0 ? .9 : 0; }
    else if (Math.random() < dt * (.25 + G.excite * 2)) {
      const a = rand(0, Math.PI * 2);
      c.s.position.set(Math.sin(a) * 14.6, rand(.8, 4.6), Math.cos(a) * 14.6); c.life = .08;
    }
  }
  G.excite = Math.max(0, G.excite - dt * .4);
}

// ───────────────────────── 사운드 (WebAudio 합성) ─────────────────────────
const sfx = (() => {
  let ctx = null, master = null, nb = null, crowdG = null;
  const AC = window.AudioContext || window.webkitAudioContext;
  function init() {
    if (ctx || !AC) { if (ctx && ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = G.muted ? 0 : .8; master.connect(ctx.destination);
      nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = nb; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = .45;
      crowdG = ctx.createGain(); crowdG.gain.value = .035;
      src.connect(bp); bp.connect(crowdG); crowdG.connect(master); src.start();
    } catch (e) { ctx = null; }
  }
  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, .0002), t + a);
    g.gain.exponentialRampToValueAtTime(.0001, t + a + d);
  }
  function noise(dur, type, f1, f2, q, vol, at = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + at, s = ctx.createBufferSource(); s.buffer = nb;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f1, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain(); env(g, t, .004, vol, dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + .06);
  }
  function tone(f1, f2, dur, vol, type = 'sine', at = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + at, o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f1, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain(); env(g, t, .004, vol, dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .06);
  }
  return {
    init,
    setMute(m) { if (master) master.gain.value = m ? 0 : .8; },
    hit(str) { noise(.12, 'lowpass', 1500 * str + 700, 200, 1, .9 * str); tone(150, 45, .17, .9 * str); },
    block() { noise(.07, 'bandpass', 900, 500, 1.2, .5); tone(200, 90, .08, .3); },
    whoosh(big) { noise(big ? .22 : .15, 'bandpass', big ? 500 : 900, big ? 1800 : 2400, 1.5, big ? .2 : .12); },
    tap() { noise(.05, 'bandpass', 1400, 700, 2, .45); tone(260, 140, .07, .3); },
    tick() { tone(660, 0, .06, .12, 'triangle'); },
    fall() { tone(90, 35, .4, 1); noise(.3, 'lowpass', 400, 80, 1, .8); },
    bell(n) {
      for (let i = 0; i < n; i++) {
        const at = i * .42;
        tone(830, 0, 1.5, .26, 'sine', at); tone(1663, 0, 1.1, .12, 'sine', at); tone(2480, 0, .7, .07, 'sine', at); tone(3320, 0, .4, .04, 'sine', at);
        noise(.03, 'highpass', 3000, 0, 1, .2, at);
      }
    },
    cheer(a) {
      G.excite = Math.max(G.excite, a);
      if (!ctx) return;
      const t = ctx.currentTime, g = crowdG.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(.035 + .2 * a, t + .25); g.linearRampToValueAtTime(.035, t + 2.8);
    },
  };
})();
const COUNT_WORDS = ['하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];
function say(txt) {
  if (G.muted || AUTO || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(txt);
    u.lang = 'ko-KR'; u.rate = 1.15; u.pitch = .8; u.volume = .9;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) { /* 음성 미지원 브라우저 */ }
}

// ───────────────────────── 상태 ─────────────────────────
const ROUND_TIME = +Q.get('rt') || 60, ROUNDS = 3;
const DIFF = {
  easy: { name: '쉬움', tele: 1.4, gap: [1.4, 2.6], dmg: .75, adapt: .3, combo: 0, hp: 80, kd: 2, hints: true, chase: 1.25, weave: .07 },
  normal: { name: '보통', tele: 1, gap: [1, 2.1], dmg: 1, adapt: .5, combo: .25, hp: 100, kd: 3, hints: false, chase: 1.6, weave: .18 },
  hard: { name: '어려움', tele: .74, gap: [.7, 1.6], dmg: 1.2, adapt: .72, combo: .5, hp: 120, kd: 3, hints: false, chase: 1.9, weave: .32 },
};
const G = {
  phase: 'boot', diff: Q.get('diff') in DIFF ? Q.get('diff') : 'normal', round: 1, time: ROUND_TIME, t: 0,
  rounds: [], result: null, paused: false, muted: false, frozen: false, stopT: 0,
  hitStop: 0, shake: 0, vign: 0, excite: 0, camKick: 0,
  mode: 'ai', myTouch: false, remTouch: false, myReady: false, remReady: false,
  view: 'fight', refSide: -1, lookPt: new V3(), kf: { fx: 0, fz: -1, rx: 1, rz: 0 }, botT: 0,
  touchReady: false, touch: null, count: 0, countId: 0, getUp: 0, need: 10,
  mouse: new T.Vector2(0, .05), botWait: 0, log: [],
};
const P = { hp: 100, stamina: 100, openT: 0, guardKey: false, keys: { left: false, right: false, duck: false }, mv: { f: false, b: false, l: false, r: false }, dodge: null, dodgeCd: 0, weaveHeat: 0, punch: { L: null, R: null }, kd: 0, lastAct: 9 };
const O = { hp: 100, maxHp: 100, state: 'out', t: 0, dur: 0, next: 1.5, guard: 'high', guardT: 1.5, atk: null, kd: 0, comboLeft: 0, react: null, mode: 'press', modeT: 4, strafe: 0, strafeT: 1, stepLeft: 0 };
const cam = { pos: PLAYER_POS.clone(), look: LOOK_FIGHT.clone(), posT: PLAYER_POS.clone(), lookT: LOOK_FIGHT.clone(), roll: 0, rollT: 0, k: 4 };
// 플레이어 위치. (fx,fz) = 상대를 향한 단위벡터, 오른쪽 = (-fz, fx), d = 상대와의 거리
const PL = { x: 0, z: 1.05, vf: 0, vt: 0, bob: 0, fx: 0, fz: -1, d: 1.15 };
const BOUND = 2.7, MIN_DIST = .82;
function updFrame() {
  const dx = opp.root.position.x - PL.x, dz = opp.root.position.z - PL.z, d = Math.hypot(dx, dz);
  if (d > 1e-3) { PL.fx = dx / d; PL.fz = dz / d; PL.d = d; }
}
function placePlayer() { PL.x = PLAYER_POS.x; PL.z = PLAYER_POS.z; PL.vf = PL.vt = 0; cam.pos.copy(PLAYER_POS); }
const el = {};
for (const id of ['pname', 'oname', 'phlbl', 'ohlbl', 'roster', 'php', 'pst', 'ohp', 'timer', 'roundLbl', 'phits', 'ohits', 'banner', 'floats', 'cross', 'vign', 'overlay', 'panel', 'prompt', 'meterWrap', 'meter', 'hint', 'pause', 'dbg']) el[id] = $(id);

function setPhase(p) { G.phase = p; G.log.push(p); }
const newRound = () => ({ ph: 0, oh: 0, pkd: 0, okd: 0 });
const R = () => G.rounds[G.rounds.length - 1] || newRound();
const fighting = () => G.phase === 'fight' || G.phase === 'ready';
const isPunching = () => !!(P.punch.L || P.punch.R);
const guarding = () => P.guardKey && !isPunching() && !P.dodge && fighting();

let timers = [], tgen = 0;
function after(sec, fn) { timers.push({ t: sec, fn, gen: tgen }); }
function clearTimers() { timers = []; tgen++; }
function runTimers(dt) {
  if (!timers.length) return;
  let due = null;
  for (const t of timers) { t.t -= dt; if (t.t <= 0) (due || (due = [])).push(t); }
  if (due) { timers = timers.filter(t => t.t > 0); for (const t of due) if (t.gen === tgen) t.fn(); }
}

// ───────────────────────── UI ─────────────────────────
function banner(text, cls = '', dur = 1.1) {
  const b = el.banner; b.className = ''; b.textContent = text; void b.offsetWidth;
  b.style.setProperty('--dur', dur + 's'); b.className = 'go ' + cls;
}
function floatText(text, color = '#fff') {
  const d = document.createElement('div');
  d.className = 'float'; d.textContent = text; d.style.color = color; d.style.marginLeft = rand(-80, 80) + 'px';
  el.floats.appendChild(d); setTimeout(() => d.remove(), 950);
  while (el.floats.children.length > 6) el.floats.firstChild.remove();
}
function setPrompt(text) { el.prompt.textContent = text; el.prompt.classList.toggle('show', !!text); }
const HINTS = { jab: '잽!  옆으로 움직이거나 Q / E / Shift', hook: '훅!  Shift 로 숙이거나 위빙(Q ↔ E)', upper: '어퍼컷!  Q / E 또는 옆으로 움직이기' };
function showHint(type) { el.hint.textContent = HINTS[type]; el.hint.classList.add('show'); }
function hideHint() { el.hint.classList.remove('show'); }
function showMeter(on) { el.meterWrap.classList.toggle('show', on); }
function panel(html) {
  el.panel.innerHTML = html; el.overlay.classList.add('show'); document.body.classList.add('menu'); G.botWait = 0;
}
function hideOverlay() { el.overlay.classList.remove('show'); document.body.classList.remove('menu'); }

const hc = {};
function setW(k, node, v) { v = Math.round(clamp(v, 0, 1) * 1000) / 10; if (hc[k] !== v) { hc[k] = v; node.style.width = v + '%'; } }
function setTxt(k, node, v) { if (hc[k] !== v) { hc[k] = v; node.textContent = v; } }
const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
function hudUpdate(rdt) {
  setW('php', el.php, P.hp / 100); setW('pst', el.pst, P.stamina / 100); setW('ohp', el.ohp, O.hp / O.maxHp);
  setTxt('t', el.timer, fmt(Math.ceil(G.time))); setTxt('r', el.roundLbl, 'ROUND ' + G.round);
  if (G.mode === 'brawl') { setTxt('ph', el.phits, BR.myKO); setTxt('oh', el.ohits, ''); brRosterUpdate(); }
  else { const r = R(); setTxt('ph', el.phits, r.ph); setTxt('oh', el.ohits, r.oh); }
  G.vign = Math.max(0, G.vign - rdt * 1.8);
  const low = fighting() && P.hp < 30 ? .22 + .1 * Math.sin(G.t * 6) : 0;
  const v = Math.round(Math.max(G.vign, low) * 100) / 100;
  if (hc.v !== v) { hc.v = v; el.vign.style.opacity = v; }
  if (G.phase === 'pdown') { G.getUp = Math.max(0, G.getUp - rdt * .15); setW('m', el.meter, G.getUp); }
}

function scoreRound(r) {
  let p = 10, o = 10;
  if (r.ph > r.oh) o = 9; else if (r.oh > r.ph) p = 9;
  return [Math.max(6, p - r.pkd), Math.max(6, o - r.okd)];
}
function card() {
  let rows = '', tp = 0, to = 0;
  G.rounds.forEach((r, i) => {
    const [p, o] = scoreRound(r); tp += p; to += o;
    rows += `<tr><td>R${i + 1}</td><td class="me">${r.ph}</td><td class="op">${r.oh}</td><td>${r.okd}</td><td>${r.pkd}</td><td><b class="me">${p}</b> : <b class="op">${o}</b></td></tr>`;
  });
  return {
    tp, to,
    html: `<table class="card"><thead><tr><th></th><th>내 머리 유효타</th><th>상대 머리 유효타</th><th>뺏은 다운</th><th>당한 다운</th><th>점수 (나 : 상대)</th></tr></thead>
      <tbody>${rows}</tbody><tfoot><tr><td colspan="5">합계</td><td><span class="me">${tp}</span> : <span class="op">${to}</span></td></tr></tfoot></table>`,
  };
}

function showTitle(note) {
  NET.send({ t: 'bye' }); brLeave(); NET.close(); G.mode = 'ai';
  clearTimers(); G.countId++; setPhase('title');
  document.body.classList.remove('play');
  canvas.style.filter = ''; setPrompt(''); showMeter(false); hideHint();
  opp.reset(OPP_HOME, 0); opp.setPose(POSE.guardHigh); opp.sway = 1; O.state = 'out';
  ref.reset(REF_FIGHT, faceTo(REF_FIGHT, CENTER)); ref.setPose(RP.neutral);
  panel(`<h1>글러브 <span>터치</span></h1><p class="sub">1인칭 복싱 · ${ROUNDS}라운드</p>
    <div class="keys">
      <div><kbd>W A S D</kbd>이동 (앞뒤 · 좌우로 돌기)</div><div><kbd>마우스</kbd>조준 (머리 / 몸통)</div>
      <div><kbd>좌클릭</kbd>왼손 잽 — 빠름</div><div><kbd>우클릭</kbd>오른손 스트레이트 — 강함</div>
      <div><kbd>Q · E</kbd>기울이기 → 클릭하면 <b>&nbsp;훅</b></div><div><kbd>Shift</kbd>숙이기 → 클릭하면 <b>&nbsp;어퍼컷</b></div>
      <div><kbd>Q ↔ E</kbd>기울인 채 반대쪽 → <b>&nbsp;위빙</b></div><div><kbd>Shift + A · D</kbd>숙인 채 옆으로 → <b>&nbsp;위빙</b></div>
      <div><kbd>Space</kbd>가드 (누르고 있기)</div><div><kbd>P · M</kbd>일시정지 · 소리</div>
    </div>
    <p class="tip"><b>점수는 머리 유효타만.</b> 가드가 올라가 있으면 몸통을 치거나 어퍼컷으로 가드를 뚫으세요.
      훅·어퍼컷은 세지만 바짝 붙어야 닿습니다. 잽·어퍼컷은 옆으로(기울이기나 사이드스텝), 잽·훅은 숙여서 피하고,
      뒤로 빠지면 전부 헛칩니다 — 헛친 직후가 카운터 찬스.
      <b>위빙</b>은 숙이면서 U자로 반대편으로 빠져나오는 동작으로, 잽·훅을 한 번에 흘리고 바로 훅으로 받아칠 수 있습니다(스태미나를 더 씁니다). 노란 스태미나가 바닥나면 주먹이 약해지고 점수도 안 됩니다.</p>
    <div class="diff">${Object.keys(DIFF).map(k => `<button data-d="${k}" class="${k === G.diff ? 'on' : ''}">${DIFF[k].name}</button>`).join('')}</div>
    <button class="primary" id="go">혼자 하기 — AI 상대</button>
    <button class="ghost" id="mp">친구와 온라인 대전 (1 : 1)</button>
    <button class="ghost" id="br">난투 토너먼트 (최대 ${BR_MAX}명)</button><p class="note" id="tnote" style="margin:12px 0 0"></p>`);
  if (typeof note === 'string') $('tnote').textContent = note;
  $('mp').onclick = showLobby; $('br').onclick = () => showBrLobby('');
  el.panel.querySelectorAll('.diff button').forEach(b => b.onclick = () => {
    G.diff = b.dataset.d;
    el.panel.querySelectorAll('.diff button').forEach(x => x.classList.toggle('on', x === b));
  });
  $('go').onclick = startMatch;
}
function showRoundEnd() {
  const pvp = G.mode === 'pvp';
  if (pvp) G.myReady = false;
  panel(`<h2>${G.round}라운드 종료</h2><p class="sub">채점표</p>${card().html}
    <button class="primary" id="go">${pvp ? '준비 완료 — ' : ''}다음 라운드 (${G.round + 1} / ${ROUNDS})</button>`);
  $('go').onclick = pvp ? pvReady : nextRound;
}
function showResult() {
  const r = G.result, c = card(), pvp = G.mode === 'pvp';
  if (pvp) G.myReady = false;
  let title, cls, sub;
  if (r.type === 'KO') {
    title = r.how + (r.winner === 'player' ? ' 승리!' : ' 패배'); cls = r.winner === 'player' ? 'win' : 'lose';
    sub = `${r.round}라운드 ${fmt(r.time)}` + (r.how === 'TKO' ? ' · 한 라운드 3번 다운' : '');
  } else {
    title = r.winner === 'player' ? '판정승!' : r.winner === 'opp' ? '판정패' : '무승부';
    cls = r.winner === 'player' ? 'win' : r.winner === 'opp' ? 'lose' : '';
    sub = `판정 ${c.tp} : ${c.to}`;
  }
  panel(`<h2 class="${cls}">${title}</h2><p class="sub">${sub}</p>${c.html}
    <p class="note">라운드마다 머리를 더 많이 맞힌 쪽이 10점, 상대는 9점 · 다운당하면 −1점</p>
    <button class="primary" id="go">${pvp ? '다시 붙기 (준비 완료)' : '다시 붙기'}</button><button class="ghost" id="menu">${pvp ? '나가기' : '난이도 바꾸기'}</button>`);
  $('go').onclick = pvp ? pvReady : startMatch; $('menu').onclick = () => showTitle();
}

// ───────────────────────── 경기 흐름 ─────────────────────────
function startMatch() {
  G.mode = 'ai'; sfx.init(); clearTimers(); G.countId++; hideOverlay();
  document.body.classList.add('play');
  const D = DIFF[G.diff];
  G.round = 1; G.rounds = [newRound()]; G.result = null; G.time = ROUND_TIME;
  G.touchReady = false; G.touch = null; G.vign = 0; G.shake = 0; G.camKick = 0; G.view = 'fight'; G.refSide = -1;
  Object.assign(P, { hp: 100, stamina: 100, dodge: null, dodgeCd: 0, kd: 0, lastAct: 9 }); P.punch.L = P.punch.R = null;
  Object.assign(O, { hp: D.hp, maxHp: D.hp, state: 'out', t: 0, kd: 0, guard: 'high', comboLeft: 0, react: null, atk: null, mode: 'press', modeT: 4, strafe: 0, strafeT: 1, stepLeft: 0 });
  placePlayer();
  opp.reset(new V3(0, 0, -2.4), 0); opp.setPose(POSE.relax); opp.sway = .3; opp.speed = 1.35;
  ref.reset(REF_INTRO, faceTo(REF_INTRO, CENTER)); ref.setPose(RP.neutral);
  cam.look.set(0, .75, .2); cam.k = 1.7; cam.roll = cam.rollT = 0;
  canvas.style.filter = ''; setPrompt(''); showMeter(false); hideHint();
  FP.cur.L.copy(LOW.L); FP.cur.R.copy(LOW.R);
  setPhase('intro'); sfx.cheer(.5);
  after(.5, () => opp.goTo(OPP_HOME, 0, () => {
    opp.tween(POSE.touch, .45);
    after(.5, () => { G.touchReady = true; setPrompt('클릭해서 글러브 터치'); });
  }));
}
function tryTouch(h) {
  if (!G.touchReady || G.touch) return;
  G.touch = { h, t: 0, hit: false }; setPrompt('');
  if (G.mode === 'pvp' && !G.myTouch) { G.myTouch = true; NET.send({ t: 'touch' }); }
}
function touchUpdate(dt) {
  const tc = G.touch; if (!tc) return;
  tc.t += dt;
  if (!tc.hit && tc.t >= .26) {
    tc.hit = true; sfx.tap();
    opp.arm[1].hand.getWorldPosition(_W); flash(_W, .3);
    opp.kick.rx += .1; opp.kick.z -= .03;
    if (G.mode !== 'pvp') after(.35, () => { opp.tween(POSE.guardHigh, .5); opp.sway = 1; });
  }
  if (tc.t >= .8) {
    G.touch = null; G.touchReady = false;
    if (G.mode !== 'pvp') startRoundIntro();
    else { if (!G.remTouch) setPrompt('상대를 기다리는 중…'); pvCheckTouch(); }
  }
}
function refChop() {
  ref.tween(RP.up, .22);
  after(.3, () => ref.tween(RP.down, .14, easeIn));
  after(.8, () => ref.tween(RP.neutral, .45));
}
function startRoundIntro() {
  setPhase('ready'); G.time = ROUND_TIME; G.view = 'fight';
  cam.rollT = 0; cam.k = 6;
  O.state = 'out'; O.guard = 'high'; opp.tween(POSE.guardHigh, .4); opp.sway = 1;
  banner('ROUND ' + G.round, '', 1.1);
  after(.9, refChop);
  after(1.3, () => { sfx.bell(1); banner('파이트!', 'fight', .8); say('파이트'); beginFight(rand(.9, 1.5)); });
}
function beginFight(delay) {
  setPhase('fight'); cam.k = 14; opp.speed = 1.35;
  oppIdle(); O.next = delay; O.mode = 'press'; O.modeT = rand(3, 6);
}
function endRound() {
  setPhase('roundEnd'); sfx.bell(3); hideHint();
  O.state = 'out'; opp.tween(POSE.relax, .5); opp.sway = .3;
  banner('라운드 종료', '', 1.3);
  after(1.7, G.round >= ROUNDS ? decision : showRoundEnd);
}
function nextRound() {
  hideOverlay();
  G.round++; G.rounds.push(newRound());
  P.hp = Math.min(100, P.hp + 25); P.stamina = 100; O.hp = Math.min(O.maxHp, O.hp + 20);
  placePlayer(); cam.look.copy(LOOK_FIGHT); G.refSide = -1;
  opp.reset(OPP_HOME, 0); opp.setPose(POSE.relax);
  ref.reset(REF_FIGHT, faceTo(REF_FIGHT, CENTER)); ref.setPose(RP.neutral);
  startRoundIntro();
}
function decision() {
  const c = card(), winner = c.tp > c.to ? 'player' : c.to > c.tp ? 'opp' : 'draw';
  setPhase('over'); G.result = { type: '판정', winner };
  const rx = -PL.fz, rz = PL.fx;
  const spot = new V3(clamp(PL.x + PL.fx * .7 - rx * .75, -2.8, 2.8), 0, clamp(PL.z + PL.fz * .7 - rz * .75, -2.8, 2.8));
  ref.goTo(spot, faceTo(spot, new V3(PL.x, 0, PL.z)));
  after(1.1, () => {
    if (winner === 'player') { ref.tween(RP.raise, .5); opp.tween(POSE.sad, .7); sfx.cheer(1); banner('판정승!', 'fight', 1.6); }
    else if (winner === 'opp') { opp.tween(POSE.victory, .6); sfx.cheer(.7); banner('판정패', 'down', 1.6); }
    else banner('무승부', '', 1.6);
  });
  after(3, showResult);
}
function countTick(n, lean) {
  const id = G.countId;
  banner(String(n), 'count', .85); say(COUNT_WORDS[n - 1]); sfx.tick();
  ref.tween(lean ? RP.leanDown : RP.down, .15, easeIn);
  after(.32, () => { if (id === G.countId) ref.tween(lean ? RP.leanUp : RP.up, .4); });
}
function startCount(phase, onTick, onTen) {
  const id = ++G.countId, lean = phase === 'pdown';
  G.count = 0;
  after(.6, () => { if (id === G.countId) ref.tween(lean ? RP.leanUp : RP.up, .5); });
  const tick = () => {
    if (id !== G.countId || G.phase !== phase) return;
    G.count++; countTick(G.count, lean);
    if (onTick && onTick(G.count) === false) return;
    if (G.count >= 10) { onTen(); return; }
    after(1, tick);
  };
  after(1.6, tick);
}
// 쓰러진 상대를 내려다보는 시점 + 심판을 그 옆으로
function downView() {
  const o = opp.root.position, rx = -PL.fz, rz = PL.fx;
  G.lookPt.set(o.x + PL.fx, .55, o.z + PL.fz); G.view = 'odown'; cam.k = 2.5;
  const spot = new V3(clamp(o.x + PL.fx * 1.1 - rx * .9, -2.85, 2.85), 0, clamp(o.z + PL.fz * 1.1 - rz * .9, -2.85, 2.85));
  ref.goTo(spot, faceTo(spot, G.lookPt));
}
function knockOpp() {
  const D = DIFF[G.diff];
  O.hp = 0; O.kd++; R().okd++; O.state = 'down'; O.comboLeft = 0; O.react = null;
  setPhase('odown'); hideHint();
  opp.tween(POSE.fallen, .5, easeOut); opp.fallTo(1, .62);   // 상대는 내 반대쪽(뒤)으로 쓰러진다
  after(.55, () => { sfx.fall(); G.shake = .5; });
  G.hitStop = .28; sfx.cheer(1); banner('다운!', 'down', 1.3);
  downView();
  const upAt = O.kd >= D.kd ? 99 : O.kd === 1 ? randInt(4, 6) : randInt(7, 9);
  startCount('odown', n => { if (n === upAt) { oppRise(); return false; } }, () => finishKO('player'));
}
function oppRise() {
  G.countId++; setPhase('orise');
  opp.fallTo(0, .95); opp.tween(POSE.guardHigh, .95);
  O.hp = O.maxHp * (O.kd === 1 ? .6 : .45);
  after(1.25, resumeFight);
}
function knockPlayer() {
  if (G.mode === 'brawl') { brDie(); return; }
  const pvp = G.mode === 'pvp';
  P.hp = 0; P.kd++; R().pkd++; P.dodge = null; P.punch.L = P.punch.R = null;
  O.comboLeft = 0; if (!pvp) O.state = 'out';
  setPhase('pdown'); hideHint();
  const fx = PL.fx, fz = PL.fz, rx = -fz, rz = fx;
  G.kf = { fx, fz, rx, rz }; G.view = 'pdown'; cam.rollT = .3; cam.k = 5;
  G.lookPt.set(PL.x - rx * .3 + fx * .25, 1.6, PL.z - rz * .3 + fz * .25);
  if (O.state !== 'down') { opp.tween(POSE.relax, .5); opp.sway = .3; }
  if (pvp) NET.send({ t: 'down' });
  else {
    // 상대는 가장 먼 중립 코너로
    let corner = null, best = -1;
    for (const cx of [-1.9, 1.9]) for (const cz of [-1.9, 1.9]) {
      const dd = Math.hypot(cx - PL.x, cz - PL.z);
      if (dd > best) { best = dd; corner = new V3(cx, 0, cz); }
    }
    opp.speed = 2.3;
    opp.goTo(corner, faceTo(opp.root.position, corner), () => { opp.faceT = faceTo(corner, new V3(PL.x, 0, PL.z)); });
  }
  canvas.style.transition = 'filter .25s'; canvas.style.filter = 'blur(6px) brightness(.75)';
  after(.9, () => { if (G.phase === 'pdown') { canvas.style.transition = 'filter 1.6s'; canvas.style.filter = 'blur(1.5px)'; } });
  after(.35, () => { sfx.fall(); G.shake = 1; });
  sfx.cheer(.9); banner('다운!', 'down', 1.3);
  const spot = new V3(clamp(PL.x - rx * .42 + fx * .43, -2.9, 2.9), 0, clamp(PL.z - rz * .42 + fz * .43, -2.9, 2.9));
  ref.goTo(spot, faceTo(spot, new V3(PL.x + rx * .1 - fx * .35, 0, PL.z + rz * .1 - fz * .35)));
  G.getUp = 0; G.need = [12, 22, 36, 55][Math.min(P.kd - 1, 3)];
  const ko = how => { if (G.phase !== 'pdown') return; if (pvp) NET.send({ t: 'ko', how }); finishKO('opp', how); };
  if (R().pkd >= 3) { after(1.6, () => ko('TKO')); return; }
  showMeter(true);
  startCount('pdown', pvp ? n => { NET.send({ t: 'count', n }); } : null, () => ko('KO'));
}
function mash() {
  if (G.phase !== 'pdown' || G.paused) return;
  G.getUp += 1 / G.need;
  if (G.getUp >= 1) playerRise();
}
function playerRise() {
  G.countId++; setPhase('prise'); showMeter(false);
  P.hp = [55, 42, 32, 25][Math.min(P.kd - 1, 3)]; P.stamina = 60;
  G.view = 'fight'; cam.rollT = 0; cam.k = 2.6;
  canvas.style.transition = 'filter .9s'; canvas.style.filter = '';
  ref.tween(RP.neutral, .4);
  if (G.mode === 'pvp') {
    NET.send({ t: 'rise' });
    after(1.5, () => { if (G.phase === 'prise') { NET.send({ t: 'fight', resume: true }); pvFight(true); } });
    return;
  }
  // 상대가 코너에서 내 앞으로 돌아오면 재개
  const o = opp.root.position, dx = o.x - PL.x, dz = o.z - PL.z, d = Math.hypot(dx, dz) || 1;
  const back = new V3(clamp(PL.x + dx / d * 1.35, -2.6, 2.6), 0, clamp(PL.z + dz / d * 1.35, -2.6, 2.6));
  let arrived = false, waited = false;
  const go = () => { if (arrived && waited && G.phase === 'prise') resumeFight(); };
  opp.speed = 2.6;
  opp.goTo(back, faceTo(o, back), () => { arrived = true; go(); });
  after(1.4, () => { waited = true; go(); });
}
function resumeFight() {
  setPhase('ready'); G.view = 'fight'; cam.rollT = 0; cam.k = 6;
  ref.tween(RP.neutral, .4);
  opp.sway = 1; O.guard = 'high'; opp.tween(POSE.guardHigh, .4);
  after(.7, () => { refChop(); banner('파이트!', 'fight', .8); say('파이트'); });
  after(1.1, () => beginFight(rand(.7, 1.3)));
}
function finishKO(winner, how = 'KO') {
  G.countId++; setPhase('over');
  G.result = { type: 'KO', how, winner, round: G.round, time: ROUND_TIME - G.time };
  setPrompt(''); showMeter(false);
  sfx.bell(3); sfx.cheer(1); banner(how === 'TKO' ? 'T.K.O.' : 'K.O.', 'ko', 2.2); say('케이오');
  if (winner === 'opp') opp.tween(POSE.victory, .6);
  let n = 0;
  const wave = () => {
    if (G.phase !== 'over' || n >= 7) { ref.tween(RP.neutral, .5); return; }
    ref.tween(n++ % 2 ? RP.waveA : RP.waveB, .28); after(.3, wave);
  };
  wave();
  after(3.2, showResult);
}

// ───────────────────────── 플레이어 ─────────────────────────
const ray = new T.Raycaster();
function aimRay() {
  ray.setFromCamera(G.mouse, camera);
  const h = ray.intersectObjects(hitMeshes, false);
  return h.length ? { zone: h[0].object.userData.zone, point: h[0].point, obj: h[0].object } : null;
}
// 주먹 종류: 서 있으면 스트레이트, 기울인 채면 훅, 숙인 채면 어퍼컷
const PUNCH = {
  straight: { L: { dur: .27, ti: .11, dmg: 2.2, cost: 5 }, R: { dur: .44, ti: .19, dmg: 5, cost: 10 }, range: 1.45, reach: 1.3 },
  hook: { L: { dur: .48, ti: .2, dmg: 6.5, cost: 12 }, R: { dur: .52, ti: .22, dmg: 7.5, cost: 13 }, range: 1.2, reach: 1.03 },
  upper: { L: { dur: .54, ti: .24, dmg: 8, cost: 15 }, R: { dur: .58, ti: .26, dmg: 9, cost: 16 }, range: 1.1, reach: .94 },
};
function tryPunch(h) {
  if (G.phase !== 'fight' || G.paused || P.punch[h]) return;
  const other = P.punch[h === 'L' ? 'R' : 'L'];
  if (other && other.t < other.ti) return;
  const kind = P.dodge ? (P.dodge.dir === 'duck' ? 'upper' : 'hook') : 'straight';
  const K = PUNCH[kind], spec = K[h], tired = P.stamina < spec.cost;
  P.stamina = Math.max(0, P.stamina - spec.cost); P.lastAct = 0;
  const p = P.punch[h] = Object.assign({ t: 0, kind, range: K.range, reach: K.reach, tired, done: false, start: FP.cur[h].clone(), aim: new V3() }, spec);
  if (G.mode !== 'ai') {
    p.ti *= PV_SLOW[kind]; p.dur *= PV_SLOW[kind];
    const hit = aimRay(), m = { t: 'p', h, k: kind, ti: p.ti, dur: p.dur, z: hit ? hit.zone : 'head' };
    if (G.mode === 'brawl') brToHost(m); else NET.send(m);
  }
  sfx.whoosh(kind !== 'straight' || h === 'R');
}
function moveUpdate(dt) {
  const mv = P.mv;
  const mf = (mv.f ? 1 : 0) - (mv.b ? 1 : 0), ms = (mv.r ? 1 : 0) - (mv.l ? 1 : 0);
  const sp = isPunching() ? .45 : P.dodge ? .4 : P.guardKey ? .55 : 1;
  const k = 1 - Math.exp(-dt * 12);
  PL.vf += (mf * (mf > 0 ? 2 : 1.55) * sp - PL.vf) * k;
  PL.vt += (ms * 1.75 * sp - PL.vt) * k;
  const rx = -PL.fz, rz = PL.fx, o = opp.root.position;
  const wd = P.dodge && P.dodge.dir === 'weave' ? P.dodge : null;   // 위빙하면 그쪽으로 반 걸음 옮겨 간다
  const vt = PL.vt + (wd ? wd.s * 1.1 * Math.sin(Math.PI * Math.min(1, wd.t / WEAVE_T)) : 0);
  let nx = PL.x + (PL.fx * PL.vf + rx * vt) * dt, nz = PL.z + (PL.fz * PL.vf + rz * vt) * dt;
  const dx = nx - o.x, dz = nz - o.z, d = Math.hypot(dx, dz);
  if (d < MIN_DIST && d > 1e-3) { nx = o.x + dx / d * MIN_DIST; nz = o.z + dz / d * MIN_DIST; }
  PL.x = clamp(nx, -BOUND, BOUND); PL.z = clamp(nz, -BOUND, BOUND);
  PL.bob += dt * (Math.abs(PL.vf) + Math.abs(PL.vt)) * 4.4;
  updFrame();
}
const WEAVE_T = .46, WEAVE_COST = 7;
function dodge(dir) {
  if (G.paused || !fighting()) return;
  const d = P.dodge;
  if (d) {   // 회피 중에 반대쪽(숙였을 땐 아무 쪽)을 누르면 위빙
    if (dir === 'duck' || d.dir === dir) return;
    if (d.dir === 'weave') { if ((dir === 'left' ? -1 : 1) !== d.s) d.next = dir; return; }   // 위빙 중이면 이어서 반대로
    weave(dir); return;
  }
  if (P.dodgeCd > 0) return;
  P.dodge = { dir, t: 0, hold: true, rel: 0 };
  P.stamina = Math.max(0, P.stamina - 4); P.lastAct = 0; sfx.whoosh();
}
// 위빙: 지금 자세에서 숙이며 U자를 그려 dir 쪽으로 빠져나온다. 끝나면 그쪽으로 기울인 자세가 된다.
function weave(dir) {
  if (P.stamina < WEAVE_COST) { floatText('지쳤다…', '#e8a81c'); return; }
  const o = dodgeOff(P.dodge);
  P.dodge = { dir: 'weave', s: dir === 'left' ? -1 : 1, t: 0, hold: true, rel: 0, fx: o.ox, fy: o.oy, fr: o.roll, next: null, punched: false };
  P.stamina -= WEAVE_COST; P.lastAct = 0; P.weaveHeat = Math.min(3, P.weaveHeat + 1); sfx.whoosh(true);
}
function dodgeAmt(d) { return d.hold ? easeOut(Math.min(1, d.t / .1)) : 1 - easeInOut(clamp((d.t - d.rel) / .18, 0, 1)); }
const evading = d => d && d.t >= .03 && (d.hold || d.t <= d.rel + .08);
// 회피 중 머리가 어디 있는가 (ox: 오른쪽 +, oy: 아래 -, roll: 화면 기울기)
const _dof = { ox: 0, oy: 0, roll: 0 };
function dodgeOff(d) {
  const o = _dof; o.ox = o.oy = o.roll = 0;
  if (!d) return o;
  if (d.dir === 'weave') {
    const k = Math.min(1, d.t / WEAVE_T), e = easeInOut(k);
    o.ox = d.fx + (d.s * .44 - d.fx) * e; o.roll = d.fr + (-d.s * .16 - d.fr) * e;
    o.oy = -Math.max(-d.fy * (1 - k), .5 * Math.sin(Math.PI * k));
    return o;
  }
  const f = dodgeAmt(d);
  if (d.dir === 'left') { o.ox = -.44 * f; o.roll = .16 * f; }
  else if (d.dir === 'right') { o.ox = .44 * f; o.roll = -.16 * f; }
  else o.oy = -.42 * f;
  return o;
}
// 이 회피로 그 주먹(kind: straight·hook·upper)을 피하는가
function slips(d, kind, head) {
  if (!evading(d)) return false;
  if (d.dir === 'weave') return kind === 'upper' ? d.t > WEAVE_T * .6 : (head || kind === 'straight');   // 어퍼컷은 옆으로 다 빠진 뒤에만
  const duck = d.dir === 'duck';
  return kind === 'straight' ? (!duck || head) : kind === 'hook' ? (duck && head) : !duck;
}
// 상대 화면에 보낼 내 회피 상태: 방향, 기운 정도, 숙인 정도(위빙일 때)
function dodgeNet() {
  const d = P.dodge;
  if (!d) return { dd: '', da: 0, dk: 0 };
  if (d.dir !== 'weave') return { dd: d.dir, da: +dodgeAmt(d).toFixed(2), dk: 0 };
  const o = dodgeOff(d);
  return { dd: o.ox < 0 ? 'left' : 'right', da: +Math.min(1, Math.abs(o.ox) / .44).toFixed(2), dk: +Math.min(1, -o.oy / .42).toFixed(2) };
}
function playerUpdate(dt) {
  P.lastAct += dt; P.dodgeCd = Math.max(0, P.dodgeCd - dt); P.openT = Math.max(0, P.openT - dt);
  P.weaveHeat = Math.max(0, P.weaveHeat - dt * .5);
  const d = P.dodge;
  if (d) {
    d.t += dt; P.lastAct = 0;
    if (d.dir === 'weave') {
      if (d.t >= WEAVE_T) {   // 위빙 끝: 빠져나온 쪽으로 기울인 자세. 키를 누르고 있으면 유지, 반대쪽을 눌러 뒀으면 이어서 위빙
        const dir = d.s < 0 ? 'left' : 'right';
        P.dodge = { dir, t: .3, hold: !!P.keys[dir] && !d.punched, rel: .3 };
        if (d.next) dodge(d.next);
      }
    } else {
      if (d.hold && d.t >= .3 && !P.keys[d.dir]) { d.hold = false; d.rel = d.t; }
      if (!d.hold && d.t >= d.rel + .18) { P.dodge = null; P.dodgeCd = .12; }
    }
  }
  for (const h of HANDS) {
    const p = P.punch[h]; if (!p) continue;
    p.t += dt;
    if (!p.done && p.t >= p.ti) {
      p.done = true;
      // 훅·어퍼컷을 치면 몸이 다시 일어선다
      if (p.kind !== 'straight' && P.dodge && P.dodge.dir === 'weave') P.dodge.punched = true;
      else if (p.kind !== 'straight' && P.dodge && P.dodge.hold) { P.dodge.hold = false; P.dodge.rel = P.dodge.t; }
      if (G.phase === 'fight') resolvePunch(h, p);
    }
    if (p.t >= p.dur && P.punch[h] === p) P.punch[h] = null;
  }
  if (P.lastAct > .5) P.stamina = Math.min(100, P.stamina + (P.guardKey ? 6 : 14) * dt);
}
function resolvePunch(h, p) {
  const hit = aimRay();
  if (G.mode === 'pvp') { netAttack(h, p, hit); return; }
  if (G.mode === 'brawl') { brAttack(h, p, hit); return; }
  const kind = p.kind;
  if (O.state === 'weave' && O.t > .06 && kind !== 'upper' && PL.d <= p.range && (!hit || hit.zone === 'head')) {
    floatText('위빙에 빗나갔다!', '#8d95a8'); O.slipped = true; return;   // 상대가 밑으로 흘렸다
  }
  if (!hit || O.state === 'down' || O.state === 'out') return;
  if (PL.d > p.range) { floatText(kind === 'straight' ? '닿지 않는다' : '더 붙어야 닿는다', '#8d95a8'); return; }
  const D = DIFF[G.diff], st = O.state, side = h === 'L' ? -1 : 1;
  let dmg = p.dmg * (p.tired ? .1 : 1);
  const exposed = st === 'windup' || st === 'strike' || st === 'open' || st === 'stun' || st === 'recover';
  const guarded = !exposed && ((hit.zone === 'head' && O.guard === 'high') || (hit.zone === 'body' && O.guard === 'low'));
  const pierce = guarded && kind === 'upper' && !p.tired;   // 어퍼컷은 가드 사이를 뚫는다
  if (guarded && !pierce) {
    O.hp -= dmg * (kind === 'hook' ? .2 : .1); sfx.block(); floatText('막힘', '#b8c0d0');
    opp.kick.rx -= .04; opp.kick.z -= .02; if (kind === 'hook') opp.kick.rz += side * .1;
  } else {
    const counter = st === 'open', heavy = kind !== 'straight', strong = heavy || h === 'R';
    if (pierce) dmg *= .6;
    if (counter) dmg *= 1.6;
    if (hit.zone === 'body') dmg *= .75;
    O.hp -= dmg;
    if (hit.zone === 'head') {
      if (!p.tired) R().ph++;
      opp.kick.rx -= (kind === 'hook' ? .1 : kind === 'upper' ? .36 : strong ? .3 : .2) * (counter ? 1.3 : 1);
      opp.kick.rz += side * (kind === 'hook' ? .34 : .12); opp.kick.hx -= kind === 'upper' ? .55 : .3; opp.kick.z -= .04;
      spawnSweat(hit.point, strong ? 10 : 5, -side * .8);
    } else { opp.kick.rx += .16; opp.kick.y -= .04; opp.kick.z -= .05; if (kind === 'hook') opp.kick.rz += side * .15; }
    sfx.hit(strong || counter ? 1 : .6); flash(hit.point, heavy ? .65 : strong ? .55 : .38);
    G.hitStop = Math.max(G.hitStop, counter ? .09 : heavy ? .07 : strong ? .05 : .02);
    if (p.tired) floatText('지쳤다…', '#e8a81c');
    else if (pierce) floatText('가드를 뚫었다!', '#ffd34d');
    else if (counter) floatText('카운터!', '#ffd34d');
    else if (heavy) floatText(kind === 'hook' ? '훅!' : '어퍼컷!', '#ffffff');
    if (counter) sfx.cheer(.5);
    const stagger = !p.tired && (counter || pierce || (strong && st === 'windup') || st === 'weave' || (heavy && st === 'idle' && Math.random() < .35));
    if (stagger) {
      if (st === 'windup') floatText('끊었다!', '#7fe3ff');
      else if (st === 'weave') floatText('위빙을 잡았다!', '#7fe3ff');
      O.state = 'stun'; O.t = 0; O.dur = pierce ? .5 : counter ? .34 : .42; O.comboLeft = 0;
      opp.tween(POSE.stun, .12, easeOut); hideHint();
    }
    if (Math.random() < D.adapt) O.react = { g: hit.zone === 'head' ? 'high' : 'low', t: rand(.2, .4) };
  }
  if (O.hp <= 0) knockOpp();
}
function damagePlayer(dmg, clean, score = clean, mag = dmg) {
  P.hp -= dmg; P.lastAct = 0;
  if (score) R().oh++;
  if (clean) {
    G.vign = Math.min(1, .45 + mag / 22); G.shake = Math.min(1, .5 + mag / 20); G.camKick = .12 + mag / 90;
    sfx.hit(clamp(mag / 11, .6, 1.2)); G.hitStop = Math.max(G.hitStop, .05);
    P.punch.L = P.punch.R = null;
  } else { G.shake = .3; G.vign = Math.max(G.vign, .15); sfx.block(); }
  if (P.hp <= 0) knockPlayer();
}

// ───────────────────────── 상대 AI ─────────────────────────
const guardPose = () => O.guard === 'high' ? POSE.guardHigh : POSE.guardLow;
function setGuard(g, dur = .22) { O.guard = g; if (O.state === 'idle') opp.tween(guardPose(), dur); }
function oppIdle() {
  const D = DIFF[G.diff];
  O.state = 'idle'; O.t = 0;
  O.next = rand(D.gap[0], D.gap[1]) * (1 - (G.round - 1) * .12);
  opp.tween(guardPose(), .2);
}
function oppAttack(combo, force) {
  const D = DIFF[G.diff], r = Math.random(), w = G.round === 1 ? [.6, .9] : [.45, .8];
  let type = r < w[0] ? 'jab' : r < w[1] ? 'hook' : 'upper';
  // 내 버릇 읽기: 계속 숙이거나 위빙만 하면 어퍼컷, 계속 기울이거나 옆으로 돌면 훅
  const held = P.dodge && P.dodge.dir !== 'weave' && P.dodge.t > .35 ? P.dodge.dir : null, read = D.adapt + .2;
  if (held === 'duck' || P.weaveHeat > 1.5) { if (Math.random() < read) type = 'upper'; }
  else if (held || Math.abs(PL.vt) > .9) { if (Math.random() < read) type = 'hook'; }
  let s = Math.random() < .5 ? -1 : 1;
  if (force) { type = force.type; s = force.s; }
  O.atk = { type, s }; O.state = 'windup'; O.t = 0; O.stepLeft = .4;
  O.dur = { jab: .36, hook: .52, upper: .6 }[type] * D.tele * (combo ? .78 : 1);
  opp.tween(POSE.windup(type, s), O.dur, easeOut);
  if (!combo && Math.random() < D.combo) O.comboLeft = 1;
  if (D.hints) showHint(type);
}
function oppStrike() {
  const { type, s } = O.atk, sp = POSE.strike(type, s, clamp((PL.d - .19) / .96, .6, 1.3));
  O.state = 'strike'; O.t = 0; O.dur = type === 'jab' ? .11 : .14;
  opp.tween(sp.pose, O.dur, easeIn, sp.opt); sfx.whoosh(type !== 'jab');
}
function oppLand() {
  const { type, s } = O.atk, D = DIFF[G.diff], d = P.dodge;
  hideHint();
  let why = '';
  if (PL.d > 1.42) why = '거리 밖!';
  else if (type !== 'hook' && Math.abs(PL.vt) > 1.15) why = '사이드스텝!';
  else if (slips(d, type === 'jab' ? 'straight' : type, true)) why = d.dir === 'weave' ? '위빙!' : '회피!';
  if (why) {
    O.state = 'open'; O.t = 0; O.dur = why === '위빙!' ? 1.05 : .85; O.comboLeft = 0;
    opp.tween(POSE.open(s), .18, easeOut); floatText(why, '#7fe3ff');
    return;
  }
  const base = { jab: 5, hook: 10, upper: 13 }[type] * D.dmg;
  if (guarding()) {
    P.stamina -= { jab: 6, hook: 10, upper: 13 }[type];
    let m = type === 'upper' ? .3 : .2;
    if (P.stamina <= 0) { P.stamina = 0; m = .6; floatText('가드가 뚫렸다!', '#ff8a80'); }
    damagePlayer(base * m, false);
  } else damagePlayer(base * (type === 'upper' && d && (d.dir === 'duck' || d.dir === 'weave') ? 1.2 : 1), true);
  if (G.phase !== 'fight') return;
  O.state = 'recover'; O.t = 0; O.dur = .3; opp.tween(guardPose(), .3);
}
// 상대의 위빙: 내 주먹(머리로 오는 잽·스트레이트·훅)을 보고 밑으로 흘린 뒤 옆에서 올라온다
function oppWeave() {
  O.state = 'weave'; O.t = 0; O.dur = .5; O.ws = Math.random() < .5 ? -1 : 1; O.wUp = false; O.slipped = false;
  opp.tween(POSE.weaveLow(O.ws), .2, easeOut); sfx.whoosh();
}
function oppAI(dt) {
  O.t += dt;
  switch (O.state) {
    case 'idle':
      for (const h of HANDS) {
        const p = P.punch[h];
        if (!p || p.done || p.seen) continue;
        p.seen = true;
        if (p.kind !== 'upper' && PL.d < p.range + .1 && Math.random() < DIFF[G.diff].weave) { const a = aimRay(); if (!a || a.zone === 'head') { oppWeave(); break; } }
      }
      if (O.state !== 'idle') break;
      O.guardT -= dt;
      if (O.guardT <= 0) { O.guardT = rand(1.2, 2.6); setGuard(Math.random() < .68 ? 'high' : 'low'); }
      if (O.react) { O.react.t -= dt; if (O.react.t <= 0) { setGuard(O.react.g, .16); O.guardT = rand(1, 1.8); O.react = null; } }
      if (PL.d < 1.8) O.next -= dt;
      if (O.next <= 0) {
        if (PL.d < 1.5) oppAttack(false);
        else { O.mode = 'press'; O.modeT = Math.max(O.modeT, 1.5); }   // 멀면 일단 붙는다
      }
      break;
    case 'weave':
      if (!O.wUp && O.t >= .2) { O.wUp = true; opp.tween(POSE.weaveSide(O.ws), .26, easeOut); }
      if (O.t >= O.dur) {   // 흘려 냈으면 올라오면서 훅으로 받아친다
        if (O.slipped && PL.d < 1.5 && Math.random() < DIFF[G.diff].adapt + .2) oppAttack(true, { type: 'hook', s: O.ws });
        else oppIdle();
      }
      break;
    case 'windup': if (O.t >= O.dur) oppStrike(); break;
    case 'strike': if (O.t >= O.dur) oppLand(); break;
    case 'recover':
      if (O.t >= O.dur) { if (O.comboLeft > 0 && PL.d < 1.6) { O.comboLeft--; oppAttack(true); } else { O.comboLeft = 0; oppIdle(); } }
      break;
    case 'open': case 'stun':
      if (O.t >= O.dur) { O.state = 'recover'; O.t = 0; O.dur = .26; opp.tween(guardPose(), .26); }
      break;
  }
  if (G.phase === 'fight') oppMove(dt);
}
function oppMove(dt) {
  const o = opp.root.position, d = PL.d, st = O.state;
  let radial = 0, tang = 0;   // radial > 0 = 나에게 다가옴
  if (st === 'idle') {
    O.modeT -= dt;
    if (O.modeT <= 0) {
      if (O.mode === 'press') { O.mode = 'out'; O.modeT = rand(.9, 1.8); } else { O.mode = 'press'; O.modeT = rand(3, 6); }
    }
    radial = clamp((d - (O.mode === 'press' ? 1.08 : 1.6)) * 3.5, -1.3, DIFF[G.diff].chase);
    O.strafeT -= dt;
    if (O.strafeT <= 0) { O.strafeT = rand(1, 2.4); O.strafe = [-1, 0, 0, 1][randInt(0, 3)] * rand(.4, .8); }
    tang = O.strafe;
  } else if (st === 'windup') { if (d > 1.02 && O.stepLeft > 0) radial = 1.9; }   // 치면서 한 발 들어옴
  else if (st === 'recover') radial = clamp((d - 1.2) * 2, -.8, .6);
  let step = radial * dt;
  if (st === 'windup') { step = Math.min(step, O.stepLeft); O.stepLeft -= step; }
  if (step > 0 && d - step < .9) step = Math.max(0, d - .9);
  o.x = clamp(o.x - PL.fx * step - PL.fz * tang * dt, -2.6, 2.6);
  o.z = clamp(o.z - PL.fz * step + PL.fx * tang * dt, -2.6, 2.6);
  opp.ext = clamp(Math.hypot(radial, tang) / 1.2, 0, 1);
}
function oppFace() {
  const o = opp.root.position;
  if (O.state !== 'down') opp.faceT = Math.atan2(PL.x - o.x, PL.z - o.z);
}
// 심판: 두 선수 옆에서 따라다닌다
function refFollow() {
  const o = opp.root.position, rp = ref.root.position, mx = (PL.x + o.x) / 2, mz = (PL.z + o.z) / 2, rx = -PL.fz, rz = PL.fx;
  const lat = (rp.x - mx) * rx + (rp.z - mz) * rz;
  if (Math.abs(lat) > .6) G.refSide = lat > 0 ? 1 : -1;
  const tx = clamp(mx + rx * 1.3 * G.refSide + PL.fx, -2.85, 2.85), tz = clamp(mz + rz * 1.3 * G.refSide + PL.fz, -2.85, 2.85);
  if (Math.hypot(tx - rp.x, tz - rp.z) > .3) { if (!ref.dest) ref.dest = new V3(); ref.dest.set(tx, 0, tz); ref.onArrive = null; }
  ref.faceT = Math.atan2(mx - rp.x, mz - rp.z);
}

// ───────────────────────── 카메라 / 1인칭 팔 ─────────────────────────
const _look = new V3(), _aim = new V3(), _via = new V3();
function camUpdate(rdt) {
  if (G.phase === 'title' || G.phase === 'boot') {
    const a = G.t * .12 + .6;
    camera.position.set(Math.sin(a) * 6.3, 2.7, Math.cos(a) * 6.3); camera.lookAt(0, 1.1, 0);
    return;
  }
  if (G.view === 'spec') {   // 난투에서 탈락한 뒤: 링 위를 돌며 관전
    const a = G.t * .22;
    camera.position.set(Math.sin(a) * 5.6, 3.5, Math.cos(a) * 5.6); camera.lookAt(0, .9, 0); cam.pos.copy(camera.position);
    return;
  }
  const o = opp.root.position;
  if (G.view === 'pdown') {
    const f = G.kf;
    cam.posT.set(PL.x + f.rx * .1 - f.fx * .35, .3, PL.z + f.rz * .1 - f.fz * .35); cam.lookT.copy(G.lookPt);
  } else {
    cam.posT.set(PL.x, 1.62, PL.z);
    if (G.view === 'odown') cam.lookT.copy(G.lookPt); else cam.lookT.set(o.x, 1.5, o.z);
  }
  const k = 1 - Math.exp(-rdt * cam.k);
  cam.pos.lerp(cam.posT, k); cam.look.lerp(cam.lookT, k); cam.roll += (cam.rollT - cam.roll) * k;
  const { ox, oy, roll } = dodgeOff(P.dodge);
  G.shake = Math.max(0, G.shake - rdt * 3); G.camKick = Math.max(0, G.camKick - rdt * 1.2);
  const sh = G.shake * G.shake * .05;
  const active = fighting() || G.phase === 'intro';
  const breathe = Math.sin(G.t * 2.2) * .006 + (active ? Math.sin(G.t * 5.1) * .004 : 0);
  const bob = Math.abs(Math.sin(PL.bob)) * .024 * Math.min(1, (Math.abs(PL.vf) + Math.abs(PL.vt)) / 1.7);
  const rx = -PL.fz, rz = PL.fx;   // 내 오른쪽
  camera.position.set(cam.pos.x + rx * ox + rand(-sh, sh), cam.pos.y + oy + breathe - bob + rand(-sh, sh), cam.pos.z + rz * ox);
  const m = (active ? 1 : .35) * clamp(PL.d / 1.15, .7, 1.8), lx = G.mouse.x * .18 * m + ox * .55;
  _look.set(cam.look.x + rx * lx, cam.look.y + G.mouse.y * .12 * m + oy * .45 + G.camKick * 1.6, cam.look.z + rz * lx);
  camera.lookAt(_look);
  camera.rotateZ(cam.roll + roll - PL.vt * .012 + rand(-sh, sh) * .6);
}
function fpUpdate(dt) {
  FP.grp.visible = G.phase !== 'title' && G.phase !== 'boot' && G.view !== 'spec';
  if (!FP.grp.visible) return;
  const won = G.phase === 'over' && G.result && G.result.winner === 'player';
  const lowered = G.phase === 'pdown' || (G.phase === 'over' && !won) || (G.phase === 'intro' && cam.look.y < 1.1);
  for (const h of HANDS) {
    const a = FP.arm[h], cur = FP.cur[h], p = P.punch[h], tc = G.touch && G.touch.h === h ? G.touch : null;
    if (tc) {
      opp.arm[1].hand.getWorldPosition(_aim); camera.worldToLocal(_aim); _aim.z += .2;
      const k = tc.t < .26 ? easeOut(tc.t / .26) : 1 - easeInOut(clamp((tc.t - .34) / .4, 0, 1));
      cur.lerpVectors(REST[h], _aim, k);
    } else if (p) {
      if (!p.done) {
        const hit = aimRay();
        if (hit) p.aim.copy(hit.point); else ray.ray.at(1.05, p.aim);
        camera.worldToLocal(p.aim);
        const len = p.aim.length() || 1;
        p.aim.multiplyScalar(Math.min(p.reach, Math.max(0, len - .12)) / len);   // 팔 길이 이상은 안 닿는다
      }
      const k = p.t < p.ti ? easeOut(p.t / p.ti) : 1 - easeInOut(clamp((p.t - p.ti - .03) / (p.dur - p.ti - .03), 0, 1));
      if (p.kind === 'straight') cur.lerpVectors(p.start, p.aim, k);
      else {
        // 훅은 옆으로 크게 돌아서, 어퍼컷은 아래에서 위로
        if (p.kind === 'hook') _via.set(a.s * .64, -.1, -.36); else _via.set(a.s * .16, -.68, -.42);
        const q = 1 - k, A = q * q, B = 2 * q * k, C = k * k, st = p.start, am = p.aim;
        cur.set(A * st.x + B * _via.x + C * am.x, A * st.y + B * _via.y + C * am.y, A * st.z + B * _via.z + C * am.z);
      }
      if (p.t >= p.ti) p.start.lerp(REST[h], 1 - Math.exp(-dt * 20));
    } else {
      const tgt = lowered ? LOW[h] : won ? CHEER[h] : guarding() || (P.dodge && P.dodge.dir === 'weave' && fighting()) ? GUARD[h] : REST[h];
      _aim.copy(tgt); _aim.y += Math.sin(G.t * 2.6 + a.s) * .008 + Math.sin(PL.bob + a.s) * .012 * Math.min(1, Math.abs(PL.vf) + Math.abs(PL.vt));
      cur.lerp(_aim, 1 - Math.exp(-dt * 16));
    }
    if (p && p.kind === 'hook') _pole.set(a.s, .3, .3); else _pole.set(a.s * .8, -1, .2);
    solveElbow(a.sh, cur, .5, .5, _pole, _E);
    setSeg(a.upper, a.sh, _E);
    _d2.subVectors(cur, _E).normalize();
    _W.copy(cur).addScaledVector(_d2, -.1);
    setSeg(a.fore, _E, _W);
    a.hand.position.copy(cur); a.hand.quaternion.setFromUnitVectors(ZAX, _d2);
  }
}

// ───────────────────────── 온라인 대전 (PeerJS / WebRTC) ─────────────────────────
// 각자 자기 캐릭터를 직접 계산한다. 주먹이 맞았는지는 "맞는 쪽"이 판정해서 돌려주고, 시계와 라운드 진행은 방장이 맡는다.
const ROOM_PREFIX = 'glovetouch-v1-', CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const cleanCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
const genCode = () => Array.from({ length: 5 }, () => CODE_CHARS[randInt(0, CODE_CHARS.length - 1)]).join('');
const num = v => typeof v === 'number' && isFinite(v);
const NET = {
  peer: null, conn: null, host: false, code: '', on: false, auto: false, tok: 0, hid: 0, pend: {}, sendT: 0,
  send(m) { const c = this.conn; if (c && c.open) { try { c.send(m); } catch (e) { /* 끊기는 중 */ } } },
  close() {
    const c = this.conn, p = this.peer;
    this.conn = this.peer = null; this.on = false; this.pend = {}; this.tok++;
    try { if (c) c.close(); } catch (e) { /* 이미 닫힘 */ }
    try { if (p) p.destroy(); } catch (e) { /* 이미 닫힘 */ }
  },
};
const RS = { x: 0, z: 0, g: 0, dd: '', da: 0, hp: 100 };        // 상대가 보내온 상태
const RM = { punch: null, T: new Float32Array(14) };             // 상대 캐릭터 애니메이션
const PV_A = new V3(0, 0, .575), PV_B = new V3(0, 0, -.575);     // 방장 / 참가자 시작 위치
const PV_SLOW = { straight: 1.15, hook: 1.45, upper: 1.4 };      // 사람끼리는 보고 피할 틈을 조금 더 준다

// PeerJS 기본 TURN 서버(turn.peerjs.com)는 DNS에서 사라졌다. 중계 서버는 /api/turn 에서 받는다.
const ICE = { servers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }], loaded: false };
function loadIce(cb) {
  if (ICE.loaded) return cb();
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 3000);
  fetch('api/turn', { signal: ctl.signal }).then(r => r.ok ? r.json() : null).then(j => {
    if (j && Array.isArray(j.iceServers) && j.iceServers.length) { ICE.servers = j.iceServers; ICE.loaded = true; }
  }).catch(() => {}).then(() => { clearTimeout(t); cb(); });
}
// ?relay=1 은 테스트용: 중계 서버로만 연결해서 TURN이 실제로 되는지 본다
const peerOpts = () => ({ config: { iceServers: ICE.servers, iceTransportPolicy: Q.has('relay') ? 'relay' : 'all' } });
const P2P_FAIL = '상대와 직접 연결하지 못했습니다. 서로의 네트워크(휴대폰 핫스팟, 학교·회사 와이파이 등)가 막고 있을 수 있어요. 다른 네트워크로 바꿔 다시 시도해 보세요.';
function loadPeer(cb0) {
  const cb = () => loadIce(cb0);
  if (window.Peer) return cb();
  const s = document.createElement('script');
  s.src = 'peerjs.min.js'; s.onload = cb; s.onerror = () => lobbyError('네트워크 모듈을 불러오지 못했습니다.');
  document.head.appendChild(s);
}
function showLobby() {
  NET.close();
  panel(`<h2>온라인 대전</h2><p class="sub">친구와 1 : 1</p>
    <button class="primary" id="mk" data-nobot>방 만들기</button>
    <div class="join"><input id="code" maxlength="8" placeholder="받은 방 코드" autocomplete="off" spellcheck="false"><button id="jn">참가</button></div>
    <button class="ghost" id="menu">돌아가기</button>`);
  const go = () => { const c = cleanCode($('code').value); if (c) joinRoom(c); };
  $('mk').onclick = () => hostRoom('');
  $('jn').onclick = go; $('code').onkeydown = e => { if (e.key === 'Enter') go(); };
  $('menu').onclick = () => showTitle();
}
function lobbyWait(msg, extra = '') {
  panel(`<h2>온라인 대전</h2><p class="sub" id="lmsg"></p>${extra}<button class="ghost" id="menu">취소</button>`);
  $('lmsg').textContent = msg; $('menu').onclick = () => showTitle();
}
function lobbyError(msg) {
  const wasBr = BR.on;
  brLeave(); NET.close();
  panel(`<h2>온라인 대전</h2><p class="tip" id="lmsg"></p>
    <button class="primary" id="re" data-nobot>다시 시도</button><button class="ghost" id="menu">돌아가기</button>`);
  $('lmsg').textContent = msg; $('re').onclick = wasBr ? () => showBrLobby('') : showLobby; $('menu').onclick = () => showTitle();
}
function showHostWait() {
  const link = location.href.split(/[?#]/)[0] + '?room=' + NET.code;
  lobbyWait('상대를 기다리는 중…', `<div class="code">${NET.code}</div>
    <p class="note" style="margin:0 0 10px">이 코드를 알려 주거나, 아래 링크를 보내세요.</p>
    <div class="join"><input id="link" readonly><button id="cp">링크 복사</button></div>`);
  $('link').value = link;
  $('cp').onclick = () => {
    const done = () => { $('cp').textContent = '복사됨!'; };
    $('link').select();
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, () => {});
    else { try { document.execCommand('copy'); done(); } catch (e) { /* 직접 복사 */ } }
  };
}
function showConnected() {
  panel(`<h2 class="win">연결됐습니다!</h2><p class="sub">${NET.host ? '상대가 들어왔습니다' : '방 ' + NET.code + ' 에 들어왔습니다'}</p>
    <p class="tip">둘 다 준비되면 링 위에서 글러브 터치부터 시작합니다. 조작은 혼자 할 때와 같고, 가드(<b>Space</b>)는 머리·몸통을 모두 막아 줍니다.
      잽은 보고 피하기 어려우니 가드와 거리로 버티고, 훅·어퍼컷은 보고 피한 뒤 되받아치세요. 어퍼컷은 가드를 뚫습니다.</p>
    <button class="primary" id="go">준비 완료</button><button class="ghost" id="menu">나가기</button>`);
  $('go').onclick = pvReady; $('menu').onclick = () => showTitle();
}
// 신호 서버 연결. 7초 안에 안 열리면 버리고 다시 시도한다 (최대 5번)
function openPeer(id, onOpen, attempt = 1) {
  const tok = NET.tok, peer = NET.peer = id ? new Peer(id, peerOpts()) : new Peer(peerOpts());
  let opened = false;
  peer.on('open', () => { if (NET.peer === peer) { opened = true; onOpen(peer); } });
  peer.on('error', e => netError(e, peer));
  setTimeout(() => {
    if (opened || NET.peer !== peer || tok !== NET.tok) return;
    NET.peer = null;
    try { peer.destroy(); } catch (e) { /* 이미 닫힘 */ }
    if (attempt >= 5) { lobbyError('서버에 연결하지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.'); return; }
    const lm = $('lmsg'); if (lm) lm.textContent = `연결이 느립니다. 다시 시도 중… (${attempt + 1}/5)`;
    openPeer(id, onOpen, attempt + 1);
  }, 7000);
}
function hostRoom(code) {
  NET.close(); NET.host = true; NET.auto = !cleanCode(code); NET.code = cleanCode(code) || genCode();
  const tok = NET.tok;
  lobbyWait('방을 만드는 중…');
  loadPeer(() => {
    if (tok !== NET.tok) return;
    openPeer(ROOM_PREFIX + NET.code, peer => {
      peer.on('connection', c => {
        if (NET.peer !== peer) return;
        if (NET.on) { c.on('open', () => c.close()); return; }   // 방은 두 명까지
        if (NET.conn) try { NET.conn.close(); } catch (e) { /* 이미 닫힘 */ }   // 연결되다 만 시도가 재접속을 막지 않게
        bindConn(c);
      });
      if (!NET.conn) showHostWait();
    });
  });
}
function joinRoom(code) {
  NET.close(); NET.host = false; NET.code = cleanCode(code);
  if (!NET.code) return showLobby();
  const tok = NET.tok;
  lobbyWait('방 ' + NET.code + ' 에 접속 중…');
  loadPeer(() => {
    if (tok !== NET.tok) return;
    openPeer('', peer => {
      bindConn(peer.connect(ROOM_PREFIX + NET.code, { reliable: true, serialization: 'json' }));
      setTimeout(() => {
        if (NET.peer === peer && !NET.on) lobbyError(P2P_FAIL);
      }, 20000);
    });
  });
}
function netError(e, peer) {
  if (NET.peer !== peer || NET.on) return;   // 경기 중 신호 서버 오류는 무시 (둘 사이 연결은 유지된다)
  const type = e && e.type;
  if (type === 'unavailable-id') { if (!NET.auto) lobbyError('이미 사용 중인 방 코드입니다.'); else if (BR.on) brHost(''); else hostRoom(''); return; }
  lobbyError(type === 'peer-unavailable' ? '방을 찾을 수 없습니다. 코드를 확인해 주세요.' : '연결에 실패했습니다 (' + (type || '알 수 없는 오류') + ').');
}
function bindConn(c) {
  NET.conn = c;
  c.on('open', () => { if (NET.conn !== c) return; NET.on = true; G.myReady = G.remReady = false; showConnected(); });
  c.on('data', m => { if (NET.conn === c) onNet(m); });
  c.on('close', () => { if (NET.conn === c) netLost(); });
  c.on('error', () => { if (NET.conn === c) netLost(); });
}
function netLost() {
  if (!NET.conn) return;
  const was = NET.on;
  NET.close();
  if (was) showTitle('상대와의 연결이 끊어졌습니다.'); else lobbyError('연결에 실패했습니다.');
}
function onNet(m) {
  if (!m || typeof m !== 'object') return;
  const pvp = G.mode === 'pvp';
  switch (m.t) {
    case 's':
      if (num(m.x) && num(m.z)) { RS.x = clamp(m.x, -BOUND, BOUND); RS.z = clamp(m.z, -BOUND, BOUND); }
      RS.g = m.g ? 1 : 0; RS.dd = m.dd === 'left' || m.dd === 'right' || m.dd === 'duck' ? m.dd : '';
      RS.da = num(m.da) ? clamp(m.da, 0, 1) : 0; RS.dk = num(m.dk) ? clamp(m.dk, 0, 1) : 0;
      if (num(m.hp)) RS.hp = clamp(m.hp, 0, 100);
      if (!NET.host && num(m.time) && G.phase === 'fight') G.time = clamp(m.time, 0, ROUND_TIME);
      break;
    case 'ready': G.remReady = true; pvCheckReady(); break;
    case 'start': if (!NET.host) pvStart(); break;
    case 'touch':
      if (pvp && G.phase === 'intro' && !G.remTouch) { G.remTouch = true; opp.kick.rx += .1; opp.kick.z -= .03; sfx.tap(); pvCheckTouch(); }
      break;
    case 'round': if (!NET.host && pvp && num(m.n)) pvRound(clamp(Math.round(m.n), 1, ROUNDS)); break;
    case 'fight':
      if (!pvp) break;
      if (m.resume) { if (G.phase === 'orise' || G.phase === 'odown') pvFight(true); }
      else if (!NET.host && G.phase === 'ready') pvFight(false);
      break;
    case 'p':
      if (pvp && PUNCH[m.k] && num(m.ti) && num(m.dur)) {
        RM.punch = { s: m.h === 'R' ? -1 : 1, kind: m.k, t: 0, ti: clamp(m.ti, .05, .6), dur: clamp(m.dur, .1, 1.2), zone: m.z === 'body' ? 'body' : 'head' };
        if (fighting()) sfx.whoosh(m.k !== 'straight');
      }
      break;
    case 'hit': if (pvp) netDefend(m); break;
    case 'res': if (pvp) netResult(m); break;
    case 'down': if (pvp) pvOppDown(); break;
    case 'count': if (pvp && G.phase === 'odown' && num(m.n)) countTick(clamp(Math.round(m.n), 1, 10), false); break;
    case 'rise': if (pvp) pvOppRise(); break;
    case 'ko': if (pvp && G.phase !== 'over' && G.phase !== 'title') finishKO('player', m.how === 'TKO' ? 'TKO' : 'KO'); break;
    case 'roundEnd': if (!NET.host && pvp) pvRoundEnd(); break;
    case 'bye': netLost(); break;
  }
}

// ── 진행 (방장이 신호를 보내고 양쪽이 같은 함수를 실행)
function pvReady() {
  if (G.myReady) return;
  G.myReady = true; sfx.init(); NET.send({ t: 'ready' });
  const b = $('go'); if (b) { b.textContent = '상대를 기다리는 중…'; b.disabled = true; }
  pvCheckReady();
}
function pvCheckReady() {
  if (!NET.host || !NET.on || !G.myReady || !G.remReady) return;
  G.myReady = G.remReady = false;
  if (G.mode === 'pvp' && G.phase === 'roundEnd') { const n = G.round + 1; NET.send({ t: 'round', n }); pvRound(n); }
  else if (G.phase === 'title' || G.phase === 'over') { NET.send({ t: 'start' }); pvStart(); }
}
function pvPlace() {
  const mine = NET.host ? PV_A : PV_B, theirs = NET.host ? PV_B : PV_A;
  PL.x = mine.x; PL.z = mine.z; PL.vf = PL.vt = 0; cam.pos.set(mine.x, 1.62, mine.z);
  RS.x = theirs.x; RS.z = theirs.z; RS.g = 0; RS.dd = ''; RS.da = 0; RS.dk = 0;
  opp.reset(theirs, faceTo(theirs, mine)); O.state = 'out';
  updFrame();
}
function pvStart() {
  sfx.init(); clearTimers(); G.countId++; hideOverlay();
  document.body.classList.add('play');
  G.mode = 'pvp'; G.round = 1; G.rounds = [newRound()]; G.result = null; G.time = ROUND_TIME;
  G.touchReady = false; G.touch = null; G.myTouch = G.remTouch = false; G.myReady = G.remReady = false;
  G.vign = 0; G.shake = 0; G.camKick = 0; G.view = 'fight'; G.refSide = -1; G.paused = false;
  Object.assign(P, { hp: clamp(+Q.get('hp') || 100, 1, 100), stamina: 100, dodge: null, dodgeCd: 0, kd: 0, lastAct: 9, openT: 0 }); P.punch.L = P.punch.R = null;   // ?hp= 는 테스트용
  Object.assign(O, { hp: 100, maxHp: 100, state: 'out', kd: 0, guard: 'high', comboLeft: 0, react: null, atk: null });
  RS.hp = 100; RM.punch = null; NET.pend = {};
  pvPlace();
  opp.setPose(POSE.touch); opp.sway = .5;
  const rx = -PL.fz, rz = PL.fx, spot = new V3(-rx * 1.05 + PL.fx * .2, 0, -rz * 1.05 + PL.fz * .2);
  ref.reset(spot, faceTo(spot, new V3(0, 0, 0))); ref.setPose(RP.neutral);
  cam.look.set(PL.x + PL.fx * .85, .75, PL.z + PL.fz * .85); cam.k = 1.7; cam.roll = cam.rollT = 0;
  canvas.style.filter = ''; setPrompt(''); showMeter(false); hideHint();
  FP.cur.L.copy(LOW.L); FP.cur.R.copy(LOW.R);
  setPhase('intro'); sfx.cheer(.5);
  after(1.2, () => { if (G.phase === 'intro') { G.touchReady = true; setPrompt('클릭해서 글러브 터치'); } });
  if (NET.host) after(14, () => { if (G.phase === 'intro') pvBegin(); });   // 한쪽이 안 눌러도 시작
}
function pvCheckTouch() { if (NET.host && G.phase === 'intro' && G.myTouch && G.remTouch && !G.touch) pvBegin(); }
function pvBegin() { NET.send({ t: 'round', n: 1 }); pvRound(1); }
function pvRound(n) {
  hideOverlay(); setPrompt(''); G.touch = null; G.touchReady = false; G.myReady = G.remReady = false;
  if (n > 1 && G.rounds.length < n) {
    G.round = n; G.rounds.push(newRound());
    P.hp = Math.min(100, P.hp + 25); P.stamina = 100;
    pvPlace(); cam.look.set(RS.x, 1.5, RS.z);
  }
  P.dodge = null; P.punch.L = P.punch.R = null; RM.punch = null; P.openT = 0;
  setPhase('ready'); G.time = ROUND_TIME; G.view = 'fight'; cam.rollT = 0; cam.k = 6;
  opp.sway = 1; O.state = 'out';
  banner('ROUND ' + G.round, '', 1.1);
  after(.9, refChop);
  if (NET.host) after(1.3, () => { if (G.phase === 'ready') { NET.send({ t: 'fight' }); pvFight(false); } });
}
function pvFight(resume) {
  if (resume) refChop(); else sfx.bell(1);
  banner('파이트!', 'fight', .8); say('파이트');
  setPhase('fight'); G.view = 'fight'; cam.rollT = 0; cam.k = 14;
}
function pvRoundEnd() {
  if (G.phase === 'over' || G.phase === 'roundEnd' || G.phase === 'title') return;
  // 카운트 도중에 종이 울려도 양쪽이 어긋나지 않게 전부 정리한다
  clearTimers(); G.countId++; showMeter(false); setPrompt(''); hideHint();
  canvas.style.transition = 'filter .6s'; canvas.style.filter = '';
  G.view = 'fight'; cam.rollT = 0; cam.k = 4;
  if (O.state === 'down') { O.state = 'out'; opp.fallTo(0, .8); }
  if (P.hp <= 0) P.hp = 25;
  P.dodge = null; P.punch.L = P.punch.R = null; RM.punch = null;
  setPhase('roundEnd'); sfx.bell(3);
  opp.tween(POSE.relax, .5); opp.sway = .3;
  banner('라운드 종료', '', 1.3);
  after(1.7, () => { if (G.round >= ROUNDS) decision(); else showRoundEnd(); });
}
function pvOppDown() {
  if (O.state === 'down') return;
  O.kd++; R().okd++; O.state = 'down'; O.hp = 0; RS.hp = 0; RM.punch = null;
  opp.tween(POSE.fallen, .5, easeOut); opp.fallTo(1, .62);
  after(.55, () => { sfx.fall(); G.shake = .5; });
  sfx.cheer(1); banner('다운!', 'down', 1.3);
  if (G.phase !== 'fight' && G.phase !== 'ready') return;
  setPhase('odown'); downView();
  const id = ++G.countId;
  after(.6, () => { if (id === G.countId) ref.tween(RP.up, .5); });
}
function pvOppRise() {
  if (O.state !== 'down') return;
  O.state = 'out'; G.countId++;
  opp.fallTo(0, .95); opp.tween(POSE.stance, .95); opp.sway = 1;
  if (G.phase === 'odown') { setPhase('orise'); G.view = 'fight'; cam.k = 3; ref.tween(RP.neutral, .4); }
}

// ── 타격 판정
function netAttack(h, p, hit) {
  if (!hit || O.state === 'down') return;
  if (PL.d > p.range) { floatText(p.kind === 'straight' ? '닿지 않는다' : '더 붙어야 닿는다', '#8d95a8'); return; }
  const id = ++NET.hid;
  NET.pend[id] = { h, kind: p.kind, tired: p.tired, zone: hit.zone, point: hit.point.clone() };
  NET.send({ t: 'hit', id, h, k: p.kind, z: hit.zone, tired: !!p.tired });
}
function netDefend(m) {
  defendCore(m, (r, extra) => NET.send(Object.assign({ t: 'res', id: m.id, r, hp: Math.max(0, P.hp) }, extra)), true);
}
// 맞는 쪽의 판정. front = 때린 사람이 내 정면에 있는가 (난투에서 등 뒤 공격은 막거나 피할 수 없다)
function defendCore(m, reply, front) {
  const K = PUNCH[m.k];
  if (!K || !K[m.h] || (m.z !== 'head' && m.z !== 'body')) return;
  if (G.phase !== 'fight') { reply('void'); return; }
  const d = P.dodge, kind = m.k, head = m.z === 'head', tired = !!m.tired;
  let dodged = front && kind !== 'hook' && Math.abs(PL.vt) > 1.15;   // 사이드스텝
  let wv = false;
  if (front && !dodged && slips(d, kind, head)) { dodged = true; wv = d.dir === 'weave'; }
  if (dodged) { floatText(wv ? '위빙!' : '회피!', '#7fe3ff'); reply('dodge'); return; }
  let dmg = K[m.h].dmg * (tired ? .1 : 1) * (head ? 1 : .75), r = front ? 'hit' : 'back';
  const counter = P.openT > 0 && !tired;   // 내가 헛친 직후에 맞으면 더 아프다
  if (counter) dmg *= 1.6;
  if (!front) { dmg *= 1.2; floatText('뒤에서 맞았다!', '#ff8a80'); }
  else if (guarding()) {
    if (kind === 'upper' && !tired) { r = 'pierce'; dmg *= .6; }
    else {
      P.stamina -= { straight: 5, hook: 9, upper: 11 }[kind];
      if (P.stamina <= 0) { P.stamina = 0; r = 'break'; dmg *= .6; floatText('가드가 뚫렸다!', '#ff8a80'); }
      else { r = 'block'; dmg *= kind === 'hook' ? .2 : .1; }
    }
  }
  const clean = r === 'hit' || r === 'pierce';
  damagePlayer(dmg, r !== 'block', G.mode === 'pvp' && head && clean && !tired, dmg * 1.5 + 3);
  reply(r, { counter });
}
function netResult(m) {
  const ph = NET.pend[m.id]; if (!ph) return;
  delete NET.pend[m.id];
  if (num(m.hp) && O.state !== 'down') RS.hp = clamp(m.hp, 0, 100);
  resultFx(m, ph, opp, true);
}
// 때린 쪽 화면의 연출. fig = 맞은 캐릭터
function resultFx(m, ph, fig, score) {
  const { h, kind, tired, zone, point } = ph, side = h === 'L' ? -1 : 1, heavy = kind !== 'straight', strong = heavy || h === 'R';
  if (m.r === 'dodge') { floatText('빗나갔다!', '#8d95a8'); P.openT = .6; return; }
  if (m.r === 'block') { sfx.block(); floatText('막힘', '#b8c0d0'); fig.kick.rx -= .04; fig.kick.z -= .02; return; }
  if (m.r !== 'hit' && m.r !== 'pierce' && m.r !== 'break' && m.r !== 'back') return;
  if (zone === 'head') {
    if (score && m.r !== 'break' && !tired) R().ph++;
    fig.kick.rx -= (kind === 'hook' ? .1 : kind === 'upper' ? .36 : strong ? .3 : .2) * (m.counter ? 1.3 : 1);
    fig.kick.rz += side * (kind === 'hook' ? .34 : .12); fig.kick.hx -= kind === 'upper' ? .55 : .3; fig.kick.z -= .04;
    spawnSweat(point, strong ? 10 : 5, -side * .8);
  } else { fig.kick.rx += .16; fig.kick.y -= .04; fig.kick.z -= .05; if (kind === 'hook') fig.kick.rz += side * .15; }
  sfx.hit(strong || m.counter ? 1 : .6); flash(point, heavy ? .65 : strong ? .55 : .38);
  if (tired) floatText('지쳤다…', '#e8a81c');
  else if (m.r === 'back') floatText('빈틈을 쳤다!', '#ffd34d');
  else if (m.r === 'pierce') floatText('가드를 뚫었다!', '#ffd34d');
  else if (m.counter) floatText('카운터!', '#ffd34d');
  else if (heavy) floatText(kind === 'hook' ? '훅!' : '어퍼컷!', '#ffffff');
  if (m.counter) sfx.cheer(.5);
}

// ── 상대 캐릭터를 받은 상태대로 움직인다
// 받은 상태(가드·기울이기·숙이기·주먹)대로 캐릭터 포즈를 만든다. dist = 그 캐릭터가 노리는 상대까지의 거리
function remotePose(fig, rs, rm, dt, dist) {
  const p = rm.punch, T = rm.T, pose = fig.pose, da = rs.da;
  let kk = 0;
  if (p) {
    p.t += dt;
    kk = p.t < p.ti ? easeOut(p.t / p.ti) : 1 - easeInOut(clamp((p.t - p.ti - .03) / Math.max(.05, p.dur - p.ti - .03), 0, 1));
    if (p.t >= p.dur) rm.punch = null;
  }
  T.set(rs.g ? POSE.guardHigh : POSE.stance);
  const dk = rs.dd === 'duck' ? da : (rs.dk || 0), ln = rs.dd === 'left' ? da : rs.dd === 'right' ? -da : 0;   // 위빙은 둘 다 들어온다
  if (dk) { T[1] -= .32 * dk; T[3] += .3 * dk; T[7] -= .26 * dk; T[10] -= .26 * dk; }
  if (ln) { T[0] += ln * .28; T[5] -= ln * .26; T[6] += ln * .28; T[9] += ln * .28; }
  if (p) { T[2] += .12 * kk; T[3] += .2 * kk; T[4] -= p.s * .35 * kk; if (p.kind === 'hook') T[p.s < 0 ? 12 : 13] = kk; }
  const sm = 1 - Math.exp(-dt * 22);
  for (let i = 0; i < 14; i++) pose[i] += (T[i] - pose[i]) * sm;
  if (p) {
    // 주먹 쥔 손은 앞으로 뻗는다 (훅은 옆으로 돌아서, 어퍼컷은 아래에서)
    const i = p.s < 0 ? 6 : 9, z = clamp((dist - .19) / .96, .6, 1.3), ty = p.zone === 'body' ? 1.28 : 1.66, tx = p.s * .04;
    const bx = T[i], by = T[i + 1], bz = T[i + 2];
    if (p.kind === 'straight') { pose[i] = bx + (tx - bx) * kk; pose[i + 1] = by + (ty - by) * kk; pose[i + 2] = bz + (z - bz) * kk; }
    else {
      const hook = p.kind === 'hook', vx = p.s * (hook ? .52 : .14), vy = hook ? 1.6 : 1, vz = z * (hook ? .6 : .7);
      const q = 1 - kk, A = q * q, B = 2 * q * kk, C = kk * kk;
      pose[i] = A * bx + B * vx + C * tx; pose[i + 1] = A * by + B * vy + C * ty; pose[i + 2] = A * bz + B * vz + C * z;
    }
  }
  fig.tw = null;
}
function remoteUpdate(dt) {
  const o = opp.root.position, k = 1 - Math.exp(-dt * 16), ox = o.x, oz = o.z;
  o.x += (RS.x - o.x) * k; o.z += (RS.z - o.z) * k;
  opp.ext = clamp(Math.hypot(o.x - ox, o.z - oz) / Math.max(dt, 1e-4) / 1.4, 0, 1);
  if (O.state !== 'down') { opp.faceT = Math.atan2(PL.x - o.x, PL.z - o.z); O.hp = RS.hp; }
  if (!fighting() || O.state === 'down') { RM.punch = null; return; }
  remotePose(opp, RS, RM, dt, PL.d);
}
function pvStep(dt, rdt) {
  remoteUpdate(dt);
  if (NET.host && G.phase === 'fight') {
    G.time -= dt;
    if (G.time <= 0) { G.time = 0; NET.send({ t: 'roundEnd' }); pvRoundEnd(); }
  }
  NET.sendT -= rdt;
  if (NET.sendT <= 0) {
    NET.sendT = 1 / 30;
    const dn = dodgeNet(), m = { t: 's', x: +PL.x.toFixed(3), z: +PL.z.toFixed(3), g: guarding() ? 1 : 0, dd: dn.dd, da: dn.da, dk: dn.dk, hp: Math.max(0, Math.round(P.hp * 10) / 10) };
    if (NET.host) m.time = +G.time.toFixed(2);
    NET.send(m);
  }
}

// ───────────────────────── 난투 토너먼트 (여러 명) ─────────────────────────
// 모두가 방장에게 접속하고 방장이 중계한다. 각자 자기 캐릭터를 계산하고, 맞았는지는 맞는 쪽이 판정한다.
// 체력이 0이 되면 그 라운드 탈락. 생존 순위 점수 + KO 점수를 라운드마다 더해 우승자를 가린다.
const BR_PREFIX = 'glovetouch-br1-', BR_MAX = 6, BR_TIME = +Q.get('rt') || 90, BR_ROUNDS = 3;
const BR_COLORS = [
  { hex: 0xd0201a, css: '#ff6a5c', skin: 0xd9a377 }, { hex: 0x2a5fe0, css: '#6aa5ff', skin: 0xb9805a },
  { hex: 0x1f9d55, css: '#4cd08a', skin: 0xe0b08a }, { hex: 0xe8b21c, css: '#ffd34d', skin: 0x8d5a3b },
  { hex: 0x8a3fd6, css: '#b98cff', skin: 0xc68a5f }, { hex: 0xe8701c, css: '#ff9d4d', skin: 0xf0c8a0 },
];
const DDS = ['', 'left', 'right', 'duck'];
const BR = {
  on: false, host: false, me: 0, code: '', name: '', phase: 'lobby',   // lobby | play
  players: [],          // [{ id, name }] — id 는 0~5, 캐릭터 색 번호이기도 하다
  rem: {},              // id → { fig, alive, rs, rm } (나를 뺀 선수들)
  alive: {}, target: -1, lastBy: -1, lastByT: 0, myKO: 0, hid: 0, pend: {}, sendT: 0, pool: [], rrow: {}, lastRows: null,
  conns: {}, hs: {}, order: [], kos: {}, totals: {}, ending: false, live: false,   // 방장 전용
};
const cleanName = v => String(v || '').replace(/[\u0000-\u001f<>&"'`]/g, '').trim().slice(0, 10);
const brName = id => { const q = BR.players.find(x => x.id === id); return q ? q.name : '?'; };
const brPid = v => num(v) && v >= 0 && v < BR_MAX && Math.floor(v) === v;
function brPlayers(list) {
  const out = [];
  if (Array.isArray(list)) for (const q of list) if (q && brPid(q.id) && !out.some(x => x.id === q.id)) out.push({ id: q.id, name: cleanName(q.name) || '선수' + (q.id + 1) });
  return out;
}
function brFig(ci) {
  if (!BR.pool[ci]) {
    const c = BR_COLORS[ci];
    const f = new Figure({ skin: c.skin, trunks: c.hex, band: 0xf2f2f2, gloves: c.hex, shoes: 0x15171c, hair: 0x1a1512, angry: true, stance: true, hit: true, sway: 1, scale: .96 });
    f.headHit.userData.pid = f.bodyHit.userData.pid = ci;
    f.root.visible = false; f.label = null;
    BR.pool[ci] = f;
  }
  return BR.pool[ci];
}
function brLabel(fig, text, css) {
  if (fig.label) { fig.root.remove(fig.label); fig.label.material.map.dispose(); fig.label.material.dispose(); }
  const tex = canvasTex(256, 64, (g, w, h) => {
    g.font = '900 34px -apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 7; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(text, w / 2, h / 2); g.fillStyle = css; g.fillText(text, w / 2, h / 2);
  });
  const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false, fog: false, toneMapped: false }));
  sp.scale.set(.66, .165, 1); sp.position.y = 2.1; sp.renderOrder = 5;
  fig.root.add(sp); fig.label = sp;
}
function brFPColor(ci) {
  for (const h of HANDS) FP.arm[h].hand.children[0].material.color.setHex(ci < 0 ? 0xd0201a : BR_COLORS[ci].hex).convertSRGBToLinear();
}
function brLeave() {
  if (BR.host) for (const id in BR.conns) { const c = BR.conns[id]; try { if (c.open) c.send({ t: 'bye' }); } catch (e) { /* 닫히는 중 */ } }
  const was = BR.on || G.mode === 'brawl';
  Object.assign(BR, { on: false, host: false, me: 0, phase: 'lobby', players: [], rem: {}, alive: {}, target: -1, lastByT: 0, myKO: 0, pend: {}, rrow: {}, lastRows: null, conns: {}, hs: {}, order: [], kos: {}, totals: {}, ending: false, live: false });
  if (!was) return;
  for (const f of BR.pool) if (f) f.root.visible = false;
  opp = oppMain; oppMain.root.visible = true; ref.root.visible = true; hitMeshes = [oppMain.headHit, oppMain.bodyHit];
  brFPColor(-1); G.view = 'fight';
  el.pname.textContent = '나'; el.oname.textContent = '상대'; el.oname.style.color = ''; el.phlbl.textContent = el.ohlbl.textContent = '머리 유효타';
  el.roster.style.display = 'none'; el.roster.textContent = ''; hc.ph = hc.oh = undefined;
}

// ── 로비
function showBrLobby(prefill) {
  NET.send({ t: 'bye' }); brLeave(); NET.close();
  panel(`<h2>난투 토너먼트</h2><p class="sub">최대 ${BR_MAX}명이 한 링에서</p>
    <div class="join"><input id="nick" maxlength="10" placeholder="닉네임" autocomplete="off" spellcheck="false"></div>
    <button class="primary" id="mk" data-nobot style="margin-top:10px">방 만들기</button>
    <div class="join"><input id="code" maxlength="8" placeholder="받은 방 코드" autocomplete="off" spellcheck="false"><button id="jn">참가</button></div>
    <p class="tip" style="margin-top:14px"><b>마지막까지 서 있으면 라운드 승리.</b> 체력이 0이 되면 그 라운드는 탈락해서 관전합니다.
      한 명을 바라보며 싸우다가 <b>Tab</b>(또는 <b>F</b>)으로 상대를 바꾸세요 — 방금 나를 때린 사람이 먼저 잡힙니다.
      가드와 회피는 <b>정면</b>에서 오는 주먹에만 통하니, 등을 보이면 그대로 맞습니다.
      오래 살아남을수록 점수가 높고 KO 한 번마다 +1점, ${BR_ROUNDS}라운드를 합산해 우승자를 가립니다.</p>
    <button class="ghost" id="menu">돌아가기</button>`);
  let saved = ''; try { saved = localStorage.getItem('gt_name') || ''; } catch (e) { /* 저장소 사용 불가 */ }
  $('nick').value = cleanName(saved); if (prefill) $('code').value = cleanCode(prefill);
  const nm = () => { BR.name = cleanName($('nick').value); try { localStorage.setItem('gt_name', BR.name); } catch (e) { /* 저장소 사용 불가 */ } };
  const go = () => { const c = cleanCode($('code').value); if (c) { nm(); brJoin(c); } };
  $('mk').onclick = () => { nm(); brHost(''); };
  $('jn').onclick = go; $('code').onkeydown = e => { if (e.key === 'Enter') go(); };
  $('menu').onclick = () => showTitle();
}
function brLobbyPanel() {
  if (!BR.on || BR.phase !== 'lobby') return;
  const link = location.href.split(/[?#]/)[0] + '?brawl=' + BR.code, n = BR.players.length, need = Math.max(2, +Q.get('need') || 2);
  panel(`<h2>난투 토너먼트</h2><p class="sub">대기실 · ${n} / ${BR_MAX}명</p><div class="code">${BR.code}</div>
    <div class="join"><input id="link" readonly><button id="cp">링크 복사</button></div>
    <div class="plist" id="pl"></div>
    <button class="primary" id="go"></button><button class="ghost" id="menu">나가기</button>`);
  $('link').value = link;
  $('cp').onclick = () => {
    const done = () => { $('cp').textContent = '복사됨!'; };
    $('link').select();
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, () => {});
    else { try { document.execCommand('copy'); done(); } catch (e) { /* 직접 복사 */ } }
  };
  for (const q of BR.players) {
    const row = document.createElement('div'), dot = document.createElement('i'), nm = document.createElement('span');
    dot.style.background = BR_COLORS[q.id].css;
    nm.textContent = q.name + (q.id === 0 ? ' · 방장' : '') + (q.id === BR.me ? ' (나)' : '');
    row.append(dot, nm); $('pl').appendChild(row);
  }
  const go = $('go');
  if (BR.host) {
    go.textContent = n < 2 ? '친구가 들어오기를 기다리는 중…' : `시작 (${n}명)`;
    go.disabled = n < need; if (n < need) go.setAttribute('data-nobot', '');
    go.onclick = () => brHostRound(1, true);
  } else { go.textContent = '방장이 시작하기를 기다리는 중…'; go.disabled = true; go.setAttribute('data-nobot', ''); }
  $('menu').onclick = () => showTitle();
}
function brHost(code) {
  NET.send({ t: 'bye' }); brLeave(); NET.close();
  BR.on = true; BR.host = true; BR.me = 0; BR.phase = 'lobby'; BR.code = cleanCode(code) || genCode();
  NET.host = true; NET.auto = !cleanCode(code);
  BR.players = [{ id: 0, name: BR.name || '선수1' }];
  const tok = NET.tok;
  lobbyWait('방을 만드는 중…');
  loadPeer(() => {
    if (tok !== NET.tok) return;
    openPeer(BR_PREFIX + BR.code, peer => { NET.on = true; peer.on('connection', c => brAccept(c, peer)); brLobbyPanel(); });
  });
}
function brAccept(c, peer) {
  c.on('open', () => {
    if (NET.peer !== peer || !BR.host) return;
    if (BR.phase !== 'lobby' || BR.players.length >= BR_MAX) {
      try { c.send({ t: 'full', started: BR.phase !== 'lobby' }); } catch (e) { /* 닫히는 중 */ }
      setTimeout(() => { try { c.close(); } catch (e) { /* 이미 닫힘 */ } }, 400);
      return;
    }
    let id = 1; while (BR.players.some(q => q.id === id)) id++;
    c.__id = id; BR.conns[id] = c;
    BR.players.push({ id, name: '선수' + (id + 1) });
    try { c.send({ t: 'welcome', id, players: BR.players }); } catch (e) { /* 닫히는 중 */ }
    brLobbyCast();
  });
  c.on('data', m => {
    const id = c.__id;
    if (id == null || BR.conns[id] !== c || !m || typeof m !== 'object') return;
    if (m.t === 'name') { const q = BR.players.find(x => x.id === id), nm = cleanName(m.name); if (q && nm) { q.name = nm; brLobbyCast(); } }
    else if (m.t === 'bye') brHostDrop(id);
    else brHostRecv(id, m);
  });
  c.on('close', () => brHostDrop(c.__id));
  c.on('error', () => brHostDrop(c.__id));
}
function brLobbyCast() { brEmit({ t: 'lobby', players: BR.players }); }
function brHostDrop(id) {
  if (id == null || !BR.conns[id]) return;
  const c = BR.conns[id]; delete BR.conns[id];
  try { c.close(); } catch (e) { /* 이미 닫힘 */ }
  if (BR.phase !== 'lobby' && BR.alive[id]) brHostDead(id, -1);   // 경기 중에 나가면 탈락 처리
  BR.players = BR.players.filter(q => q.id !== id); delete BR.hs[id];
  if (BR.phase === 'lobby') brLobbyCast(); else { brEmit({ t: 'left', id, players: BR.players }); brHostCheckEnd(); }
}
function brJoin(code) {
  NET.send({ t: 'bye' }); brLeave(); NET.close();
  BR.on = true; BR.host = false; BR.phase = 'lobby'; BR.code = cleanCode(code); NET.host = false;
  if (!BR.code) return showBrLobby('');
  const tok = NET.tok;
  lobbyWait('방 ' + BR.code + ' 에 접속 중…');
  loadPeer(() => {
    if (tok !== NET.tok) return;
    openPeer('', peer => {
      const c = NET.conn = peer.connect(BR_PREFIX + BR.code, { reliable: true, serialization: 'json' });
      c.on('open', () => { if (NET.conn !== c) return; NET.on = true; if (BR.name) c.send({ t: 'name', name: BR.name }); });
      c.on('data', m => {
        if (NET.conn !== c || !m || typeof m !== 'object') return;
        if (m.t === 'bye') brLost('방장이 방을 닫았습니다.');
        else if (m.t === 'full') lobbyError(m.started ? '이미 경기가 시작된 방입니다.' : '방이 가득 찼습니다.');
        else brRecv(m);
      });
      c.on('close', () => { if (NET.conn === c) brLost('방과의 연결이 끊어졌습니다.'); });
      c.on('error', () => { if (NET.conn === c) brLost('방과의 연결이 끊어졌습니다.'); });
      setTimeout(() => {
        if (NET.peer === peer && !NET.on) lobbyError(P2P_FAIL);
      }, 20000);
    });
  });
}
function brLost(msg) { if (BR.on) { if (NET.on) showTitle(msg); else lobbyError(msg); } }

// ── 중계 (방장)
function brToHost(m) { if (BR.host) brHostRecv(BR.me, m); else NET.send(m); }
function brDeliver(to, m) {
  if (to === BR.me) { brRecv(m); return; }
  const c = BR.conns[to]; if (c && c.open) { try { c.send(m); } catch (e) { /* 끊기는 중 */ } }
}
function brEmit(m, except) { for (const q of BR.players.slice()) if (q.id !== except) brDeliver(q.id, m); }
function brRow(a, id) {   // [id, x, z, yaw, 가드, 회피방향, 회피정도, 체력, 노리는 상대, 숙인 정도(위빙)]
  if (!Array.isArray(a) || !num(a[1]) || !num(a[2]) || !num(a[3])) return null;
  return [id, clamp(a[1], -BOUND, BOUND), clamp(a[2], -BOUND, BOUND), a[3], a[4] ? 1 : 0, a[5] >= 1 && a[5] <= 3 ? a[5] | 0 : 0,
    num(a[6]) ? clamp(a[6], 0, 1) : 0, num(a[7]) ? clamp(a[7], 0, 100) : 0, brPid(a[8]) ? a[8] : -1, num(a[9]) ? clamp(a[9], 0, 1) : 0];
}
function brHostRecv(from, m) {
  if (!BR.host || !m || typeof m !== 'object') return;
  switch (m.t) {
    case 's': { const row = brRow(m.r, from); if (row && BR.phase === 'play') { BR.hs[from] = row; if (from !== BR.me) brApplyRow(row); } break; }
    case 'p':
      if (PUNCH[m.k] && num(m.ti) && num(m.dur) && BR.alive[from]) brEmit({ t: 'p', from, h: m.h === 'R' ? 'R' : 'L', k: m.k, ti: m.ti, dur: m.dur, z: m.z === 'body' ? 'body' : 'head' }, from);
      break;
    case 'hit':
      if (brPid(m.to) && m.to !== from && BR.alive[m.to] && BR.alive[from] && BR.live && PUNCH[m.k])
        brDeliver(m.to, { t: 'hit', from, id: m.id, h: m.h === 'R' ? 'R' : 'L', k: m.k, z: m.z === 'body' ? 'body' : 'head', tired: !!m.tired });
      else brDeliver(from, { t: 'res', from: m.to, id: m.id, r: 'void' });
      break;
    case 'res': if (brPid(m.to)) brDeliver(m.to, { t: 'res', from, id: m.id, r: String(m.r), hp: m.hp, counter: !!m.counter }); break;
    case 'dead': brHostDead(from, m.by); break;
  }
}
function brHostDead(id, by) {
  if (!BR.alive[id] || BR.phase !== 'play') return;
  BR.order.push(id);
  const killer = brPid(by) && by !== id && BR.players.some(q => q.id === by) ? by : -1;
  if (killer >= 0) BR.kos[killer] = (BR.kos[killer] || 0) + 1;
  if (BR.hs[id]) BR.hs[id][7] = 0;
  brEmit({ t: 'dead', id, by: killer });
  if (!BR.alive[id]) brHostCheckEnd(); else { BR.alive[id] = false; brHostCheckEnd(); }
}
function brHostCheckEnd() {
  if (!BR.host || BR.phase !== 'play' || BR.ending || !BR.live) return;
  if (BR.players.filter(q => BR.alive[q.id]).length > 1) return;
  BR.ending = true;
  after(1.7, brHostEndRound);
}
function brHostRound(n, fresh) {
  if (!BR.host || !BR.on) return;
  if (BR.players.length < 2) { BR.phase = 'lobby'; brLobbyPanel(); return; }
  BR.phase = 'play'; BR.order = []; BR.kos = {}; BR.ending = false; BR.live = false; BR.hs = {};
  if (fresh) BR.totals = {};
  const ids = BR.players.map(q => q.id);
  for (let i = ids.length - 1; i > 0; i--) { const j = randInt(0, i); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const N = ids.length, a0 = Math.random() * Math.PI * 2, rad = N <= 2 ? .6 : 1.9;
  const pos = ids.map((id, i) => { const a = a0 + i / N * Math.PI * 2; return [id, +(Math.sin(a) * rad).toFixed(3), +(Math.cos(a) * rad).toFixed(3)]; });
  brEmit({ t: 'round', n, fresh: !!fresh, pos, players: BR.players });
  after(2.2, () => { if (BR.on && BR.host && BR.phase === 'play' && !BR.live) { BR.live = true; brEmit({ t: 'fight' }); } });
}
function brHostEndRound() {
  if (!BR.host || BR.phase !== 'play') return;
  BR.live = false; BR.ending = true;
  const ids = BR.players.map(q => q.id), hpOf = id => id === BR.me ? Math.max(0, P.hp) : (BR.hs[id] ? BR.hs[id][7] : 0);
  const surv = ids.filter(id => BR.alive[id]).sort((a, b) => hpOf(b) - hpOf(a));     // 살아남은 사람: 체력 많은 순
  const out = BR.order.filter(id => ids.includes(id)).reverse();                    // 탈락자: 늦게 쓰러진 순
  const rank = surv.concat(out.filter(id => !surv.includes(id))), N = rank.length;
  const rows = rank.map((id, i) => {
    const pts = N - 1 - i, ko = BR.kos[id] || 0;
    BR.totals[id] = (BR.totals[id] || 0) + pts + ko;
    return [id, i + 1, pts, ko, BR.totals[id]];
  });
  brEmit({ t: 'roundEnd', n: G.round, rows, last: G.round >= BR_ROUNDS, players: BR.players });
}

// ── 각자 화면 (방장 포함)
function brRecv(m) {
  if (!BR.on || !m || typeof m !== 'object') return;
  switch (m.t) {
    case 'welcome': if (!BR.host && brPid(m.id)) { BR.me = m.id; BR.players = brPlayers(m.players); brLobbyPanel(); } break;
    case 'lobby': BR.players = brPlayers(m.players); brLobbyPanel(); break;
    case 'snap':
      if (Array.isArray(m.a)) for (const a of m.a) { const row = Array.isArray(a) && brPid(a[0]) ? brRow(a, a[0]) : null; if (row && row[0] !== BR.me) brApplyRow(row); }
      if (!BR.host && num(m.time)) G.time = clamp(m.time, 0, BR_TIME);
      break;
    case 'round': brRound(m); break;
    case 'fight': if (G.mode === 'brawl' && G.phase === 'ready') { sfx.bell(1); banner('파이트!', 'fight', .8); say('파이트'); setPhase('fight'); cam.k = 14; } break;
    case 'p': {
      const r = BR.rem[m.from];
      if (r && r.alive && PUNCH[m.k] && num(m.ti) && num(m.dur)) {
        r.rm.punch = { s: m.h === 'R' ? -1 : 1, kind: m.k, t: 0, ti: clamp(m.ti, .05, .6), dur: clamp(m.dur, .1, 1.2), zone: m.z === 'body' ? 'body' : 'head' };
        if (m.from === BR.target || r.rs.tg === BR.me) sfx.whoosh(m.k !== 'straight');
      }
      break;
    }
    case 'hit': if (G.mode === 'brawl') brDefend(m); break;
    case 'res': if (G.mode === 'brawl') brResult(m); break;
    case 'dead': if (G.mode === 'brawl' && brPid(m.id)) brDead(m.id, m.by); break;
    case 'left':
      BR.players = brPlayers(m.players);
      if (G.mode === 'brawl' && brPid(m.id)) { const r = BR.rem[m.id]; if (r) { r.alive = false; r.fig.root.visible = false; delete BR.rem[m.id]; } BR.alive[m.id] = false; brHitList(); brRosterBuild(); if (BR.target === m.id) brPickTarget(false); }
      break;
    case 'roundEnd': if (G.mode === 'brawl') brRoundEnd(m); break;
  }
}
function brApplyRow(row) {
  const r = BR.rem[row[0]]; if (!r) return;
  const rs = r.rs;
  rs.x = row[1]; rs.z = row[2]; rs.yaw = row[3]; rs.g = row[4]; rs.dd = DDS[row[5]]; rs.da = row[6]; rs.tg = row[8]; rs.dk = row[9] || 0;
  if (r.alive) rs.hp = row[7];
}
function brRound(m) {
  if (!Array.isArray(m.pos) || !num(m.n)) return;
  sfx.init(); clearTimers(); G.countId++; hideOverlay();
  document.body.classList.add('play');
  G.mode = 'brawl'; BR.phase = 'play'; BR.players = brPlayers(m.players);
  G.round = clamp(Math.round(m.n), 1, 99); G.rounds = [newRound()]; G.result = null; G.time = BR_TIME;
  G.touch = null; G.touchReady = false; G.vign = 0; G.shake = 0; G.camKick = 0; G.view = 'fight'; G.paused = false;
  Object.assign(P, { hp: clamp(+Q.get('hp') || 100, 1, 100), stamina: 100, dodge: null, dodgeCd: 0, kd: 0, lastAct: 9, openT: 0 }); P.punch.L = P.punch.R = null;   // ?hp= 는 테스트용
  Object.assign(O, { hp: 100, maxHp: 100, state: 'out' });
  if (m.fresh) BR.myKO = 0;
  BR.pend = {}; BR.lastByT = 0; BR.alive = {}; BR.rem = {}; BR.target = -1;
  oppMain.root.visible = false; ref.root.visible = false;
  for (const f of BR.pool) if (f) f.root.visible = false;
  for (const a of m.pos) {
    if (!Array.isArray(a) || !brPid(a[0]) || !num(a[1]) || !num(a[2]) || !BR.players.some(q => q.id === a[0])) continue;
    const id = a[0], x = clamp(a[1], -BOUND, BOUND), z = clamp(a[2], -BOUND, BOUND);
    BR.alive[id] = true;
    if (id === BR.me) { PL.x = x; PL.z = z; PL.vf = PL.vt = 0; cam.pos.set(x, 1.62, z); continue; }
    const fig = brFig(id), yaw = Math.atan2(-x, -z);
    fig.root.visible = true; fig.reset({ x, z }, yaw); fig.setPose(POSE.stance); fig.sway = 1;
    brLabel(fig, brName(id), BR_COLORS[id].css);
    BR.rem[id] = { fig, alive: true, rs: { x, z, yaw, g: 0, dd: '', da: 0, hp: 100, tg: -1 }, rm: { punch: null, T: new Float32Array(14) } };
  }
  brHitList(); brPickTarget(false);
  cam.look.set(0, 1.4, 0); cam.k = 6; cam.roll = cam.rollT = 0;
  brFPColor(BR.me); el.pname.textContent = brName(BR.me); el.phlbl.textContent = 'KO'; el.ohlbl.textContent = '';
  brRosterBuild();
  canvas.style.filter = ''; setPrompt(''); showMeter(false); hideHint();
  FP.cur.L.copy(LOW.L); FP.cur.R.copy(LOW.R);
  setPhase('ready'); banner('ROUND ' + G.round, '', 1.1); sfx.cheer(.6);
}
function brHitList() {
  hitMeshes = [];
  for (const id in BR.rem) { const r = BR.rem[id]; if (r.alive) hitMeshes.push(r.fig.headHit, r.fig.bodyHit); }
}
// 노릴 상대 고르기. cycle = Tab 을 눌렀을 때: 방금 나를 때린 사람 먼저, 아니면 다음으로 가까운 사람
function brPickTarget(cycle) {
  const list = Object.keys(BR.rem).map(Number).filter(id => BR.rem[id].alive)
    .sort((a, b) => { const p = BR.rem[a].fig.root.position, q = BR.rem[b].fig.root.position; return Math.hypot(p.x - PL.x, p.z - PL.z) - Math.hypot(q.x - PL.x, q.z - PL.z); });
  if (!list.length) { BR.target = -1; return; }
  let id = list[0];
  if (cycle) {
    if (BR.lastByT > 0 && BR.lastBy !== BR.target && list.includes(BR.lastBy)) { id = BR.lastBy; BR.lastByT = 0; }
    else id = list[(list.indexOf(BR.target) + 1) % list.length];
  }
  BR.target = id; opp = BR.rem[id].fig; updFrame();
  for (const k in BR.rem) { const lb = BR.rem[k].fig.label; if (lb) lb.visible = +k !== id; }   // 노리는 상대 이름은 위쪽 HUD 에 나온다
  el.oname.textContent = brName(id); el.oname.style.color = BR_COLORS[id].css;
}
function brRosterBuild() {
  const box = el.roster; box.textContent = ''; box.style.display = G.mode === 'brawl' ? 'flex' : 'none'; BR.rrow = {};
  for (const q of BR.players) {
    if (BR.alive[q.id] === undefined) continue;
    const row = document.createElement('div'), dot = document.createElement('i'), nm = document.createElement('span'), bar = document.createElement('span'), fill = document.createElement('i');
    row.className = 'rrow'; dot.className = 'dot'; nm.className = 'rn'; bar.className = 'rbar';
    dot.style.background = BR_COLORS[q.id].css; fill.style.background = BR_COLORS[q.id].css;
    nm.textContent = q.name + (q.id === BR.me ? ' (나)' : '');
    bar.appendChild(fill); row.append(dot, nm, bar); box.appendChild(row);
    BR.rrow[q.id] = { row, fill, w: -1, cls: '' };
  }
}
function brRosterUpdate() {
  for (const id in BR.rrow) {
    const e = BR.rrow[id], n = +id, hp = n === BR.me ? P.hp : (BR.rem[n] ? BR.rem[n].rs.hp : 0);
    const w = BR.alive[n] ? Math.round(clamp(hp, 0, 100)) : 0, cls = 'rrow' + (BR.alive[n] ? '' : ' dead') + (n === BR.target ? ' tg' : '');
    if (e.w !== w) { e.w = w; e.fill.style.width = w + '%'; }
    if (e.cls !== cls) { e.cls = cls; e.row.className = cls; }
  }
}
function brStep(dt, rdt) {
  const acting = G.phase === 'fight' || G.phase === 'ready' || G.phase === 'spec';
  for (const id in BR.rem) {
    const r = BR.rem[id], f = r.fig, o = f.root.position, rs = r.rs, k = 1 - Math.exp(-dt * 16), ox = o.x, oz = o.z;
    o.x += (rs.x - o.x) * k; o.z += (rs.z - o.z) * k;
    f.ext = r.alive ? clamp(Math.hypot(o.x - ox, o.z - oz) / Math.max(dt, 1e-4) / 1.4, 0, 1) : 0;
    if (r.alive) {
      f.faceT = rs.yaw;
      if (acting) {
        let dist = 1.1; const tg = BR.rem[rs.tg];
        if (rs.tg === BR.me) dist = Math.hypot(o.x - PL.x, o.z - PL.z);
        else if (tg) dist = Math.hypot(o.x - tg.fig.root.position.x, o.z - tg.fig.root.position.z);
        remotePose(f, rs, r.rm, dt, dist);
      }
    }
    f.update(dt, G.t);
  }
  if (fighting()) {
    for (const id in BR.rem) {   // 다른 선수와 겹치지 않게
      const r = BR.rem[id]; if (!r.alive) continue;
      const o = r.fig.root.position, dx = PL.x - o.x, dz = PL.z - o.z, d = Math.hypot(dx, dz);
      if (d < MIN_DIST && d > 1e-3) { PL.x = clamp(o.x + dx / d * MIN_DIST, -BOUND, BOUND); PL.z = clamp(o.z + dz / d * MIN_DIST, -BOUND, BOUND); }
    }
    if (!BR.rem[BR.target] || !BR.rem[BR.target].alive) brPickTarget(false);
    updFrame();
  }
  BR.lastByT = Math.max(0, BR.lastByT - dt);
  const tr = BR.rem[BR.target]; O.hp = tr ? tr.rs.hp : 0; O.maxHp = 100;
  if (BR.host && BR.live) {
    G.time -= dt;
    if (G.time <= 0) { G.time = 0; if (!BR.ending) { BR.ending = true; brHostEndRound(); } }
  }
  BR.sendT -= rdt;
  if (BR.sendT <= 0 && BR.phase === 'play') {
    BR.sendT = 1 / 30;
    const dn = dodgeNet(), mine = BR.alive[BR.me];
    const row = [BR.me, +PL.x.toFixed(3), +PL.z.toFixed(3), +Math.atan2(PL.fx, PL.fz).toFixed(3), guarding() ? 1 : 0, DDS.indexOf(dn.dd), dn.da, mine ? Math.max(0, Math.round(P.hp * 10) / 10) : 0, BR.target, dn.dk];
    if (!BR.host) NET.send({ t: 's', r: row });
    else {
      BR.hs[BR.me] = row;
      const msg = { t: 'snap', a: BR.players.map(q => BR.hs[q.id]).filter(Boolean), time: +G.time.toFixed(2) };
      for (const id in BR.conns) { const c = BR.conns[id]; if (c && c.open) { try { c.send(msg); } catch (e) { /* 끊기는 중 */ } } }
    }
  }
}
function brAttack(h, p, hit) {
  if (!hit) return;
  const pid = hit.obj.userData.pid, r = BR.rem[pid];
  if (!r || !r.alive) return;
  const o = r.fig.root.position;
  if (Math.hypot(o.x - PL.x, o.z - PL.z) > p.range) { floatText(p.kind === 'straight' ? '닿지 않는다' : '더 붙어야 닿는다', '#8d95a8'); return; }
  const id = ++BR.hid;
  BR.pend[id] = { h, kind: p.kind, tired: p.tired, zone: hit.zone, point: hit.point.clone(), pid };
  brToHost({ t: 'hit', to: pid, id, h, k: p.kind, z: hit.zone, tired: !!p.tired });
}
function brDefend(m) {
  const r = BR.rem[m.from];
  let front = true;
  if (r) { const o = r.fig.root.position, dx = o.x - PL.x, dz = o.z - PL.z, d = Math.hypot(dx, dz) || 1; front = (dx * PL.fx + dz * PL.fz) / d > .17; }   // 정면 ±80° 안
  if (G.phase === 'fight' && brPid(m.from)) {
    BR.lastBy = m.from; BR.lastByT = 3;
    if (m.from !== BR.target) floatText(brName(m.from) + ' 의 공격!  Tab', BR_COLORS[m.from].css);
  }
  defendCore(m, (res, extra) => brToHost(Object.assign({ t: 'res', to: m.from, id: m.id, r: res, hp: Math.max(0, P.hp) }, extra)), front);
}
function brResult(m) {
  const ph = BR.pend[m.id]; if (!ph) return;
  delete BR.pend[m.id];
  const r = BR.rem[ph.pid]; if (!r) return;
  if (num(m.hp) && r.alive) r.rs.hp = clamp(m.hp, 0, 100);
  resultFx(m, ph, r.fig, false);
}
function brDie() {
  if (G.phase !== 'fight') { P.hp = Math.max(P.hp, 1); return; }
  P.hp = 0; P.dodge = null; P.punch.L = P.punch.R = null;
  setPhase('spec'); hideHint();
  const fx = PL.fx, fz = PL.fz, rx = -fz, rz = fx;
  G.kf = { fx, fz, rx, rz }; G.view = 'pdown'; cam.rollT = .3; cam.k = 5;
  G.lookPt.set(PL.x + fx * .4, 2, PL.z + fz * .4);
  canvas.style.transition = 'filter .25s'; canvas.style.filter = 'blur(5px) brightness(.75)';
  after(.35, () => { sfx.fall(); G.shake = 1; });
  banner('탈락!', 'down', 1.5);
  after(2, () => {
    if (G.mode !== 'brawl' || G.phase !== 'spec') return;
    G.view = 'spec'; cam.rollT = 0; cam.roll = 0; canvas.style.transition = 'filter .6s'; canvas.style.filter = ''; setPrompt('탈락 — 관전 중');
  });
  brToHost({ t: 'dead', by: BR.lastByT > 0 ? BR.lastBy : -1 });
}
function brDead(id, by) {
  if (!BR.alive[id]) return;
  BR.alive[id] = false;
  const r = BR.rem[id];
  if (r && r.alive) {
    r.alive = false; r.rm.punch = null; r.rs.hp = 0;
    r.fig.tween(POSE.fallen, .5, easeOut); r.fig.fallTo(1, .62);
    after(.55, () => sfx.fall());
    brHitList();
  }
  if (id !== BR.me && by === BR.me) { BR.myKO++; banner('K.O.!', 'ko', 1.3); sfx.cheer(1); }
  else { sfx.cheer(.6); if (id !== BR.me) floatText((brPid(by) ? brName(by) + ' ▶ ' : '') + brName(id) + ' 탈락', '#ffd34d'); }
  if (id === BR.target && fighting()) brPickTarget(false);
}
function brRoundEnd(m) {
  if (!Array.isArray(m.rows)) return;
  BR.players = brPlayers(m.players);
  const rows = m.rows.filter(a => Array.isArray(a) && brPid(a[0]) && a.slice(1, 5).every(num)).map(a => a.slice(0, 5));
  BR.lastRows = rows;
  clearTimers(); G.countId++; setPrompt(''); showMeter(false); hideHint();
  canvas.style.transition = 'filter .5s'; canvas.style.filter = '';
  P.dodge = null; P.punch.L = P.punch.R = null; cam.rollT = 0;
  const last = !!m.last, mine = rows.find(a => a[0] === BR.me), won = mine && mine[1] === 1;
  setPhase(last ? 'over' : 'roundEnd'); sfx.bell(3); if (won) sfx.cheer(1);
  banner(won ? '라운드 승리!' : '라운드 종료', won ? 'fight' : '', 1.5);
  after(1.9, () => brScorePanel(rows, last, clamp(Math.round(+m.n) || G.round, 1, 99)));
}
function brScorePanel(rows, last, n) {
  if (G.mode !== 'brawl') return;
  const sorted = rows.slice().sort((a, b) => b[4] - a[4] || a[1] - b[1]);
  panel(`<h2 id="bt" class="${last ? 'win' : ''}"></h2><p class="sub" id="bs"></p>
    <table class="card"><thead><tr><th>순위</th><th>선수</th><th>이번 라운드</th><th>생존 점수</th><th>KO</th><th>합계</th></tr></thead><tbody id="bb"></tbody></table>
    <p class="note">오래 살아남을수록 생존 점수가 높고 KO 한 번마다 +1점 · ${BR_ROUNDS}라운드 합산</p>
    <button class="primary" id="go"></button><button class="ghost" id="menu">나가기</button>`);
  $('bt').textContent = last ? (sorted.length ? brName(sorted[0][0]) + ' 우승!' : '경기 종료') : n + '라운드 결과';
  $('bs').textContent = last ? '최종 순위' : `${n} / ${BR_ROUNDS} 라운드`;
  sorted.forEach((a, i) => {
    const tr = document.createElement('tr');
    [i + 1, brName(a[0]) + (a[0] === BR.me ? ' (나)' : ''), a[1] + '위', a[2], a[3], a[4]].forEach((v, c) => {
      const td = document.createElement('td'); td.textContent = v;
      if (c === 1) { td.style.color = BR_COLORS[a[0]].css; td.style.fontWeight = '800'; }
      if (c === 5) td.style.fontWeight = '900';
      tr.appendChild(td);
    });
    $('bb').appendChild(tr);
  });
  const go = $('go');
  if (BR.host) { go.textContent = last ? '한 번 더 (새 토너먼트)' : '다음 라운드'; go.onclick = () => brHostRound(last ? 1 : n + 1, last); }
  else { go.textContent = '방장을 기다리는 중…'; go.disabled = true; go.setAttribute('data-nobot', ''); }
  $('menu').onclick = () => showTitle();
}

// ───────────────────────── 테스트 봇 ─────────────────────────
const _v = new V3();
function botUpdate(dt) {
  if (el.overlay.classList.contains('show')) {
    if (G.phase === 'over' && Q.has('once')) { G.frozen = true; return; }
    G.botWait += dt;
    if (G.botWait > .5) { G.botWait = -99; const b = el.panel.querySelector('.primary:not([data-nobot])'); if (b) b.click(); }
    return;
  }
  if (G.phase === 'intro' && G.touchReady) tryTouch(Math.random() < .5 ? 'L' : 'R');
  if (G.phase === 'pdown' && Math.random() < dt * 14 * BOT_SKILL) mash();
  const mv = P.mv;
  if (G.phase !== 'fight') { mv.f = mv.b = mv.l = mv.r = false; return; }
  const d = PL.d;
  mv.f = d > 1.04; mv.b = d < .88;
  G.botT -= dt;
  if (G.botT <= 0) { G.botT = rand(.6, 1.6); const r = Math.random(); mv.l = r < .25; mv.r = r > .75; }
  const zone = O.state === 'idle' && O.guard === 'high' ? opp.bodyHit : opp.headHit;
  zone.getWorldPosition(_v).project(camera); G.mouse.set(_v.x, _v.y);
  P.guardKey = false;
  if (!P.dodge && d < 1.1 && Math.random() < dt * .8) dodge(['left', 'right', 'duck'][randInt(0, 2)]);
  else if (P.dodge && P.dodge.t > .12 && Math.random() < dt * (Q.has('weave') ? 12 : 2)) dodge(P.dodge.dir === 'right' || (P.dodge.dir === 'weave' && P.dodge.s > 0) ? 'left' : 'right');   // 위빙
  if (Math.random() < dt * BOT_RATE) tryPunch(Math.random() < .6 ? 'L' : 'R');
  const br = G.mode === 'brawl' ? BR.rem[BR.target] : null;
  const rp = G.mode === 'pvp' ? RM.punch : br ? br.rm.punch : null;
  const incoming = G.mode !== 'ai' ? (rp && rp.t < rp.ti) : (O.state === 'windup' && O.dur - O.t < .2);
  if (incoming && !P.dodge && Math.random() < BOT_SKILL * dt * 30) {
    const t = rp ? rp.kind : O.atk.type; dodge(t === 'hook' ? 'duck' : Math.random() < .5 ? 'left' : 'right');
  }
}

// ───────────────────────── 메인 루프 ─────────────────────────
function step(rdt) {
  if (G.paused || G.frozen) return;
  let dt = rdt;
  if (G.hitStop > 0) { G.hitStop -= rdt; dt *= .06; }
  G.t += dt;
  updFrame();
  if (AUTO) botUpdate(dt);
  runTimers(dt);
  if (G.phase === 'intro') touchUpdate(dt);
  const pvp = G.mode === 'pvp', brawl = G.mode === 'brawl';
  if (fighting()) { moveUpdate(dt); if (!brawl) { if (!pvp) oppFace(); refFollow(); } } else PL.vf = PL.vt = 0;
  if (brawl) brStep(dt, rdt);
  else if (pvp) pvStep(dt, rdt);
  else if (G.phase === 'fight') {
    G.time -= dt; oppAI(dt);
    if (G.time <= 0 && G.phase === 'fight') { G.time = 0; endRound(); }
  } else opp.ext = 0;
  if (G.phase !== 'title' && G.phase !== 'pdown') playerUpdate(dt);
  if (!brawl) { opp.update(dt, G.t); ref.update(dt, G.t); }
  fxUpdate(dt); camUpdate(rdt);
  camera.updateMatrixWorld(); opp.root.updateMatrixWorld(); ref.root.updateMatrixWorld();
  fpUpdate(dt); hudUpdate(rdt);
  if (STOP_AT && G.phase === STOP_AT) { G.stopT += dt; if (G.stopT >= STOP_AFTER) G.frozen = true; }
}
let last = performance.now(), frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(.05, Math.max(.001, (now - last) / 1000)); last = now;
  if (SPEED > 1) for (let i = 0; i < SPEED; i++) step(1 / 60); else step(rdt);
  if (!G.paused && !G.frozen) {
    const hit = fighting() ? aimRay() : null, c = hit ? (PL.d > PUNCH.straight.range ? 'far' : hit.zone) : '';
    if (hc.c !== c) { hc.c = c; el.cross.className = c; }
  }
  renderer.render(scene, camera);
  if (AUTO && frames++ % 20 === 0) {
    el.dbg.textContent = JSON.stringify({ mode: G.mode, net: NET.on, host: NET.host, br: G.mode === 'brawl' ? { me: BR.me, n: BR.players.length, alive: BR.players.filter(q => BR.alive[q.id]).length, ko: BR.myKO, rows: BR.lastRows } : undefined, phase: G.phase, round: G.round, time: +G.time.toFixed(1), php: +P.hp.toFixed(1), ohp: +O.hp.toFixed(1), rounds: G.rounds, result: G.result, pkd: P.kd, okd: O.kd, t: +G.t.toFixed(1), log: G.log.join('>') });
  }
}

// ───────────────────────── 입력 ─────────────────────────
function setPaused(v) {
  if (v && G.mode !== 'ai') return;   // 온라인 대전은 멈출 수 없다
  if (v && !(fighting() || G.phase === 'pdown' || G.phase === 'odown')) return;
  G.paused = v; el.pause.classList.toggle('show', v);
  document.body.classList.toggle('menu', v || el.overlay.classList.contains('show'));
}
const inMenu = () => el.overlay.classList.contains('show') || G.paused;
addEventListener('mousemove', e => {
  G.mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  el.cross.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
});
addEventListener('mousedown', e => {
  sfx.init();
  if (inMenu() || (e.button !== 0 && e.button !== 2)) return;
  e.preventDefault();
  const h = e.button === 0 ? 'L' : 'R';
  if (G.phase === 'intro') tryTouch(h);
  else if (G.phase === 'fight') tryPunch(h);
  else if (G.phase === 'pdown') mash();
});
addEventListener('contextmenu', e => e.preventDefault());
const MOVE_KEYS = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
const DODGE_KEYS = { KeyQ: 'left', KeyE: 'right', ShiftLeft: 'duck', ShiftRight: 'duck', KeyC: 'duck' };
addEventListener('keydown', e => {
  const c = e.code;
  if (e.target && e.target.tagName === 'INPUT') return;
  if (c === 'Space' || c.startsWith('Arrow')) e.preventDefault();
  if (e.repeat) return;
  sfx.init();
  if (c === 'KeyP' || c === 'Escape') { setPaused(!G.paused); return; }
  if (c === 'KeyM') { G.muted = !G.muted; sfx.setMute(G.muted); if (G.muted && 'speechSynthesis' in window) speechSynthesis.cancel(); return; }
  if (inMenu()) return;
  if (c === 'Tab' || c === 'KeyF') { e.preventDefault(); if (G.mode === 'brawl' && fighting()) brPickTarget(true); return; }
  if (MOVE_KEYS[c]) {
    const k = MOVE_KEYS[c]; P.mv[k] = true;
    if ((k === 'l' || k === 'r') && P.dodge && P.dodge.dir === 'duck') dodge(k === 'l' ? 'left' : 'right');   // 숙인 채 옆으로 = 위빙
  }
  if (DODGE_KEYS[c]) { P.keys[DODGE_KEYS[c]] = true; dodge(DODGE_KEYS[c]); }
  if (c === 'Space') P.guardKey = true;
  if (G.phase === 'pdown') mash();
});
addEventListener('keyup', e => {
  const c = e.code;
  if (MOVE_KEYS[c]) P.mv[MOVE_KEYS[c]] = false;
  if (DODGE_KEYS[c]) P.keys[DODGE_KEYS[c]] = false;
  if (c === 'Space') P.guardKey = false;
});
addEventListener('blur', () => {
  P.guardKey = false; P.keys.left = P.keys.right = P.keys.duck = false;
  P.mv.f = P.mv.b = P.mv.l = P.mv.r = false;
  if (!AUTO) setPaused(true);
});

el.cross.style.transform = `translate(${innerWidth / 2}px,${innerHeight * .45}px)`;
window.__game = { G, P, O, opp, ref, cam, NET, RS, RM, BR };
showTitle();
{
  const room = cleanCode(Q.get('room')), brawl = cleanCode(Q.get('brawl'));
  if (room) { if (Q.get('pvp') === 'host') hostRoom(room); else joinRoom(room); }
  else if (brawl) {
    if (!AUTO) showBrLobby(brawl);
    else { BR.name = '봇' + randInt(10, 99); if (Q.has('bhost')) brHost(brawl); else brJoin(brawl); }
  }
}
addEventListener('pagehide', () => { NET.send({ t: 'bye' }); brLeave(); });
requestAnimationFrame(frame);
})();
