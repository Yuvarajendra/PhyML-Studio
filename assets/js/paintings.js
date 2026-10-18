/* PhyML Studio gallery paintings, v2.
   Each painting: a detailed underpainting (shapes, light, figures) → coarse-to-fine oil brushwork sampled from it,
   baked once; then a slow animated layer on top. Every motion repeats on a 15 s cycle. */
(function () {
'use strict';
var TAU = Math.PI * 2, LOOP = 15;
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; }; }
function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
function mix(a, b, k) { return a + (b - a) * k; }
function mk(W, H) { var c = document.createElement('canvas'); c.width = W; c.height = H; return c; }
function hex(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
function lamb(x, y, vx, vy, G, rc) { var ex = x - vx, ey = y - vy, q = ex * ex + ey * ey + 1e-3, f = G / (TAU * q) * (1 - Math.exp(-q / (rc * rc))); return [-f * ey, f * ex]; }
function sampler(c) {
  var W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data;
  return function (x, y) { x = x | 0; y = y | 0; if (x < 0) x = 0; else if (x >= W) x = W - 1; if (y < 0) y = 0; else if (y >= H) y = H - 1; var i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
}
function trace(field, x, y, len, steps) {
  var seg = len / steps, h = steps >> 1, bx = x, by = y, back = [], fwd = [];
  for (var s = 0; s < h; s++) { var v = field(bx, by), m = Math.hypot(v[0], v[1]) + 1e-6; bx -= v[0] / m * seg; by -= v[1] / m * seg; back.push(bx, by); }
  bx = x; by = y;
  for (var s2 = 0; s2 < steps - h; s2++) { var v2 = field(bx, by), m2 = Math.hypot(v2[0], v2[1]) + 1e-6; bx += v2[0] / m2 * seg; by += v2[1] / m2 * seg; fwd.push(bx, by); }
  var p = []; for (var i = back.length - 2; i >= 0; i -= 2) p.push(back[i], back[i + 1]); p.push(x, y); return p.concat(fwd);
}
function path(ctx, p) {
  ctx.moveTo(p[0], p[1]);
  for (var i = 2; i < p.length - 2; i += 2) ctx.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2);
  ctx.lineTo(p[p.length - 2], p[p.length - 1]);
}
/* one layer of brushwork: strokes bucketed by quantised colour so thousands draw quickly */
function pass(ctx, o) {
  var B = new Map(), r = o.r;
  for (var i = 0; i < o.n; i++) {
    var s = o.spawn(r); if (!s) continue; var c = o.color(s[0], s[1], r()); if (!c) continue;
    var L = o.len * (0.55 + r() * 0.9), w = r() < 0.5 ? 0 : 1;
    var q = ((clamp(c[0], 0, 255) >> 3) << 10) | ((clamp(c[1], 0, 255) >> 3) << 5) | (clamp(c[2], 0, 255) >> 3), k = q * 2 + w;
    var a = B.get(k); if (!a) { a = []; B.set(k, a); } a.push(trace(o.field, s[0], s[1], L, o.steps || 4));
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  B.forEach(function (arr, k) {
    var w = k & 1, q = k >> 1, R = ((q >> 10) & 31) * 8 + 4, G = ((q >> 5) & 31) * 8 + 4, Bc = (q & 31) * 8 + 4, lw = o.width * (w ? 1.2 : 0.8);
    ctx.globalAlpha = o.alpha; ctx.strokeStyle = 'rgb(' + R + ',' + G + ',' + Bc + ')'; ctx.lineWidth = lw; ctx.beginPath();
    for (var j = 0; j < arr.length; j++) path(ctx, arr[j]); ctx.stroke();
    if (o.hi) { /* impasto: a lit ridge along each stroke */
      ctx.save(); ctx.translate(-lw * 0.2, -lw * 0.22); ctx.globalAlpha = o.hi; ctx.lineWidth = lw * 0.32;
      ctx.strokeStyle = 'rgb(' + Math.min(255, R + 55) + ',' + Math.min(255, G + 55) + ',' + Math.min(255, Bc + 50) + ')';
      ctx.beginPath(); for (var j2 = 0; j2 < arr.length; j2 += 2) path(ctx, arr[j2]); ctx.stroke(); ctx.restore();
    }
  });
  ctx.globalAlpha = 1;
}
function jitter(c, r, amt, hue) {
  var b = (r - 0.5) * amt, h = hue ? (Math.sin(r * 91.7) * hue) : 0;
  return [c[0] + b + h, c[1] + b - h * 0.3, c[2] + b - h * 0.7];
}
/* moving strokes */
function Flow(o) {
  var P = [], r = o.r;
  function mkp() { var s = o.spawn(r); return { x: s[0], y: s[1], age: 0, life: o.life[0] + r() * (o.life[1] - o.life[0]), len: o.len * (0.6 + r() * 0.8), w: r() < 0.5 ? 0 : 1, r: r() }; }
  for (var i = 0; i < o.n; i++) { var p = mkp(); p.age = r() * p.life; P.push(p); }
  return function (ctx, t, dt) {
    var B = new Map();
    for (var k = 0; k < P.length; k++) {
      var p = P[k], v = o.field(p.x, p.y, t); p.x += v[0] * dt; p.y += v[1] * dt; p.age += dt;
      if (p.age > p.life || !o.alive(p.x, p.y)) { P[k] = mkp(); continue; }
      var c = o.color(p.x, p.y, t, p.r); if (!c) continue;
      var a = Math.sin(Math.PI * p.age / p.life), lv = a > 0.66 ? 2 : a > 0.33 ? 1 : 0;
      var q = ((clamp(c[0], 0, 255) >> 4) << 8) | ((clamp(c[1], 0, 255) >> 4) << 4) | (clamp(c[2], 0, 255) >> 4), key = (q * 3 + lv) * 2 + p.w;
      var arr = B.get(key); if (!arr) { arr = []; B.set(key, arr); }
      arr.push(trace(function (x, y) { return o.field(x, y, t); }, p.x, p.y, p.len, 4));
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    B.forEach(function (arr, key) {
      var w = key & 1, z = key >> 1, lv = z % 3, q = (z - lv) / 3;
      ctx.globalAlpha = o.alpha * [0.3, 0.65, 1][lv]; ctx.strokeStyle = 'rgb(' + (((q >> 8) & 15) * 16 + 8) + ',' + (((q >> 4) & 15) * 16 + 8) + ',' + ((q & 15) * 16 + 8) + ')';
      ctx.lineWidth = o.width * (w ? 1.2 : 0.8); ctx.beginPath(); for (var j = 0; j < arr.length; j++) path(ctx, arr[j]); ctx.stroke();
    });
    ctx.globalAlpha = 1;
  };
}
function canvasGrain(W, H, seed, strength) {
  var g = mk(W, H), x = g.getContext('2d'), r = rng(seed), id = x.createImageData(W, H);
  for (var i = 0; i < id.data.length; i += 4) { var v = 128 + (r() - 0.5) * 90; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = strength; }
  x.putImageData(id, 0, 0);
  /* canvas weave */
  x.globalAlpha = 0.05; x.strokeStyle = '#000'; x.lineWidth = 1;
  for (var y = 0; y < H; y += 3) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
  for (var xx = 0; xx < W; xx += 3) { x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx, H); x.stroke(); }
  return g;
}

/* =====================================================================
   I. STARRY NIGHT OVER THE STUDIO  (after Vincent van Gogh, 1889)
   ===================================================================== */
function starry(W, H, base) {
  var r = rng(1889), U = mk(W, H), u = U.getContext('2d'), RG = mk(W, H), g = RG.getContext('2d');
  function reg(id) { return 'rgb(' + id + ',0,0)'; }
  function mtn(x) { var f = x / W; return H * (0.605 + 0.028 * Math.sin(f * 9 + 1) + 0.012 * Math.sin(f * 27) - 0.075 * Math.exp(-Math.pow((f - 0.9) / 0.12, 2)) - 0.04 * Math.exp(-Math.pow((f - 0.64) / 0.1, 2))); }
  function cyp(y) { var s = (y - 0.025 * H) / (H * 0.975); return [W * (0.165 + 0.02 * Math.sin(s * 6.5)), s < 0 ? 0 : W * (0.006 + 0.105 * Math.pow(s, 0.92)) * (1 + 0.13 * Math.sin(s * 31))]; }
  var moon = [0.865 * W, 0.135 * H, 0.046 * W];
  var stars = [[0.07, 0.12, 0.03], [0.25, 0.07, 0.026], [0.41, 0.155, 0.024], [0.6, 0.075, 0.027], [0.715, 0.275, 0.031], [0.36, 0.445, 0.022], [0.065, 0.42, 0.028], [0.955, 0.43, 0.021], [0.53, 0.515, 0.016], [0.49, 0.025, 0.017], [0.885, 0.315, 0.015]].map(function (s) { return [s[0] * W, s[1] * H, s[2] * W]; });
  /* ---- underpainting ---- */
  var sky = u.createLinearGradient(0, 0, 0, H * 0.65); sky.addColorStop(0, '#0d2150'); sky.addColorStop(0.45, '#1b4687'); sky.addColorStop(0.85, '#3e73ab'); sky.addColorStop(1, '#6f9cc0');
  u.fillStyle = sky; u.fillRect(0, 0, W, H); g.fillStyle = reg(0); g.fillRect(0, 0, W, H);
  /* the great swirl and the wave of wind (light bands) */
  u.lineCap = 'round';
  function spiral(cx, cy, r0, r1, turns, dir, col, lw, a) {
    u.strokeStyle = col; u.lineWidth = lw; u.globalAlpha = a; u.beginPath();
    for (var k = 0; k <= 160; k++) { var s = k / 160, ang = dir * s * turns * TAU, rad = mix(r0, r1, s); var x = cx + Math.cos(ang) * rad, y = cy + Math.sin(ang) * rad * 0.8; k ? u.lineTo(x, y) : u.moveTo(x, y); }
    u.stroke(); u.globalAlpha = 1;
  }
  spiral(0.47 * W, 0.33 * H, 0.01 * W, 0.12 * W, 2.2, 1, '#e3edf0', 16, 0.55);
  spiral(0.47 * W, 0.33 * H, 0.03 * W, 0.1 * W, 1.8, 1, '#9fc2e0', 12, 0.6);
  spiral(0.3 * W, 0.37 * H, 0.01 * W, 0.08 * W, 1.6, -1, '#c9dceb', 12, 0.55);
  u.strokeStyle = '#d6e4ea'; u.globalAlpha = 0.5; u.lineWidth = 22; u.beginPath(); u.moveTo(0.05 * W, 0.28 * H);
  u.bezierCurveTo(0.2 * W, 0.18 * H, 0.32 * W, 0.42 * H, 0.47 * W, 0.24 * H); u.bezierCurveTo(0.58 * W, 0.12 * H, 0.66 * W, 0.4 * H, 0.8 * W, 0.36 * H); u.stroke();
  u.lineWidth = 12; u.strokeStyle = '#8eb4da'; u.beginPath(); u.moveTo(0.06 * W, 0.33 * H); u.bezierCurveTo(0.22 * W, 0.24 * H, 0.33 * W, 0.47 * H, 0.5 * W, 0.3 * H); u.bezierCurveTo(0.6 * W, 0.2 * H, 0.7 * W, 0.45 * H, 0.86 * W, 0.42 * H); u.stroke(); u.globalAlpha = 1;
  /* halos */
  function halo(x, y, R, rings) { for (var i = 0; i < rings.length; i++) { u.fillStyle = rings[i][1]; u.beginPath(); u.arc(x, y, R * rings[i][0], 0, TAU); u.fill(); } g.fillStyle = reg(5); g.beginPath(); g.arc(x, y, R * rings[0][0], 0, TAU); g.fill(); }
  halo(moon[0], moon[1], moon[2], [[2.1, '#5f8fbf'], [1.85, '#ece3a8'], [1.55, '#f7efc3'], [1.25, '#e9cf6c'], [1, '#f2a92f'], [0.8, '#fde69a']]);
  u.fillStyle = '#fbe7a0'; u.beginPath(); u.arc(moon[0] - moon[2] * 0.22, moon[1] - moon[2] * 0.05, moon[2] * 0.78, 0, TAU); u.fill();
  stars.forEach(function (s) { halo(s[0], s[1], s[2], [[1.7, '#5a8cc0'], [1.45, '#cfe0e6'], [1.15, '#f2e7ac'], [0.8, '#efcf55'], [0.45, '#fff6d4']]); });
  /* mountains */
  u.fillStyle = '#25466f'; g.fillStyle = reg(1); u.beginPath(); g.beginPath(); u.moveTo(0, H); g.moveTo(0, H);
  for (var x = 0; x <= W; x += 6) { u.lineTo(x, mtn(x)); g.lineTo(x, mtn(x)); } u.lineTo(W, H); g.lineTo(W, H); u.fill(); g.fill();
  u.strokeStyle = '#6f95bd'; u.lineWidth = 5; u.beginPath(); for (var x2 = 0; x2 <= W; x2 += 6) x2 ? u.lineTo(x2, mtn(x2) + 4) : u.moveTo(x2, mtn(x2) + 4); u.stroke();
  u.fillStyle = '#2c5072'; u.beginPath(); u.moveTo(0, H); for (var x3 = 0; x3 <= W; x3 += 6) u.lineTo(x3, mtn(x3) + 0.05 * H + 0.015 * H * Math.sin(x3 / W * 13)); u.lineTo(W, H); u.fill();
  /* village */
  g.fillStyle = reg(2); g.fillRect(0.27 * W, 0.62 * H, 0.73 * W, 0.27 * H);
  var houses = [];
  for (var i = 0; i < 46; i++) { var hx = W * (0.28 + r() * 0.7), hy = mtn(hx) + H * (0.075 + r() * 0.2); houses.push([hx, hy, W * (0.018 + r() * 0.026), r()]); }
  houses.sort(function (a, b) { return a[1] - b[1]; });
  var windows = [];
  houses.forEach(function (h) {
    var hw = h[2], hh = hw * (0.7 + h[3] * 0.5), x0 = h[0] - hw / 2, y0 = h[1] - hh;
    u.fillStyle = ['#6a8790', '#58788a', '#7f979a', '#4f6f80'][(h[3] * 4) | 0]; u.fillRect(x0, y0, hw, hh);
    u.fillStyle = ['#1c2c3d', '#24384a', '#152230'][(h[3] * 3) | 0]; u.beginPath(); u.moveTo(x0 - hw * 0.1, y0); u.lineTo(h[0] + (h[3] - 0.5) * hw * 0.3, y0 - hh * 0.55); u.lineTo(x0 + hw * 1.1, y0); u.closePath(); u.fill();
    u.fillStyle = '#d9c27a'; u.fillRect(x0, y0 - 1, hw, 2);
    var nw = 1 + ((h[3] * 3) | 0); for (var w = 0; w < nw; w++) { var wx = x0 + hw * (0.18 + w * 0.3), wy = y0 + hh * 0.35; u.fillStyle = '#f2b648'; u.fillRect(wx, wy, hw * 0.16, hh * 0.24); windows.push([wx + hw * 0.08, wy + hh * 0.12, hw * 0.16, hh * 0.24]); }
    if (h[3] > 0.55) { u.fillStyle = '#1e3a33'; u.beginPath(); u.ellipse(x0 - hw * 0.3, h[1] - hh * 0.3, hw * 0.45, hh * 0.6, 0, 0, TAU); u.fill(); }
  });
  /* church */
  var cx = 0.565 * W, cb = mtn(cx) + 0.14 * H;
  u.fillStyle = '#2a4058'; u.fillRect(cx - 0.035 * W, cb - 0.06 * H, 0.07 * W, 0.06 * H);
  u.fillStyle = '#16243a'; u.beginPath(); u.moveTo(cx - 0.012 * W, cb - 0.06 * H); u.lineTo(cx, cb - 0.29 * H); u.lineTo(cx + 0.012 * W, cb - 0.06 * H); u.closePath(); u.fill();
  g.fillStyle = reg(6); g.beginPath(); g.moveTo(cx - 0.014 * W, cb - 0.06 * H); g.lineTo(cx, cb - 0.3 * H); g.lineTo(cx + 0.014 * W, cb - 0.06 * H); g.closePath(); g.fill();
  u.strokeStyle = '#6d8fae'; u.lineWidth = 2; u.beginPath(); u.moveTo(cx + 0.002 * W, cb - 0.28 * H); u.lineTo(cx + 0.011 * W, cb - 0.06 * H); u.stroke();
  /* foreground fields and olive bushes */
  u.fillStyle = '#20393a'; g.fillStyle = reg(3); u.beginPath(); g.beginPath(); u.moveTo(0, H); g.moveTo(0, H);
  for (var x4 = 0; x4 <= W; x4 += 8) { var y4 = H * (0.885 - 0.02 * Math.sin(x4 / W * 5 + 0.5)); u.lineTo(x4, y4); g.lineTo(x4, y4); } u.lineTo(W, H); g.lineTo(W, H); u.fill(); g.fill();
  for (var b = 0; b < 30; b++) { var bx = r() * W, by = H * (0.86 + r() * 0.12); u.fillStyle = ['#2f4f3e', '#3b5b46', '#1f3a33'][(r() * 3) | 0]; u.beginPath(); u.ellipse(bx, by, W * (0.015 + r() * 0.02), H * (0.01 + r() * 0.015), 0, 0, TAU); u.fill(); }
  /* cypress */
  function cypPoly(c, scale, col) { c.fillStyle = col; c.beginPath(); for (var y = 0.025 * H; y <= H; y += 4) { var q = cyp(y); c.lineTo(q[0] - q[1] * scale, y); } for (var y2 = H; y2 >= 0.025 * H; y2 -= 4) { var q2 = cyp(y2); c.lineTo(q2[0] + q2[1] * scale, y2); } c.closePath(); c.fill(); }
  cypPoly(u, 1, '#141a12'); cypPoly(g, 1, reg(4)); cypPoly(u, 0.62, '#1f2a17'); cypPoly(u, 0.3, '#2b3a1e');
  u.strokeStyle = '#4c5530'; u.lineWidth = 4; for (var t2 = 0; t2 < 26; t2++) { var yy = H * (0.06 + t2 * 0.036), q3 = cyp(yy), sd = t2 % 2 ? 1 : -1; u.beginPath(); u.moveTo(q3[0] + sd * q3[1] * 0.7, yy + 0.03 * H); u.quadraticCurveTo(q3[0] + sd * q3[1] * 0.2, yy, q3[0] + sd * q3[1] * 0.5, yy - 0.04 * H); u.stroke(); }
  var su = sampler(U), sr = sampler(RG);
  /* ---- fields ---- */
  var Ub = 16, Gc = 2.2 * 16 * TAU * 0.11 * W / 0.63;
  function staticField(x, y) {
    var id = sr(x, y)[0];
    if (id === 4) { var q = cyp(y); return [Math.sin(y * 0.03) * 0.35 + (x - q[0]) / (q[1] + 1) * 0.25, -1]; }
    if (id === 1 || id === 3) { var d = (mtn(x + 4) - mtn(x - 4)) / 8; return [1, d + Math.sin(x * 0.02 + y * 0.03) * 0.25]; }
    if (id === 2) return Math.sin(x * 0.7 + y * 0.3) > 0 ? [1, 0.05] : [0.05, 1];
    if (id === 6) return [0.02, -1];
    var u0 = Ub, v0 = 4 * Math.sin(x / W * 5);
    var a = lamb(x, y, 0.47 * W, 0.33 * H, Gc, 0.11 * W); u0 += a[0]; v0 += a[1];
    var a2 = lamb(x, y, 0.3 * W, 0.37 * H, -Gc * 0.7, 0.08 * W); u0 += a2[0]; v0 += a2[1];
    for (var j = 0; j < stars.length; j++) { var s = stars[j], b = lamb(x, y, s[0], s[1], 3 * Ub * TAU * s[2] / 0.63, s[2] * 1.1); u0 += b[0]; v0 += b[1]; }
    var m = lamb(x, y, moon[0], moon[1], 3 * Ub * TAU * moon[2] / 0.63, moon[2] * 1.3); return [u0 + m[0], v0 + m[1]];
  }
  /* ---- bake the brushwork ---- */
  var S = mk(W, H), s = S.getContext('2d'); s.drawImage(U, 0, 0);
  function any(r) { return [r() * W, r() * H]; }
  function col(J, hue) { return function (x, y, rr) { return jitter(su(x, y), rr, J, hue); }; }
  if (base) { s.drawImage(base, 0, 0, W, H); } else {
  pass(s, { n: 8000, r: r, spawn: any, field: staticField, color: col(30, 10), len: 44, width: 13, alpha: 1, hi: 0.14 });
  pass(s, { n: 16000, r: r, spawn: any, field: staticField, color: col(34, 12), len: 30, width: 8, alpha: 0.95, hi: 0.18 });
  pass(s, { n: 22000, r: r, spawn: any, field: staticField, color: col(38, 12), len: 18, width: 5, alpha: 0.92, hi: 0.2 });
  pass(s, { n: 12000, r: r, spawn: function (rr) { return [W * (0.26 + rr() * 0.74), H * (0.58 + rr() * 0.32)]; }, field: staticField, color: col(30, 8), len: 9, width: 3.2, alpha: 0.95, hi: 0.22 });
  pass(s, { n: 5000, r: r, spawn: function (rr) { var y = H * (0.03 + rr() * 0.97), q = cyp(y); return [q[0] + (rr() - 0.5) * 2 * q[1], y]; }, field: staticField, color: col(36, 14), len: 16, width: 4, alpha: 0.95, hi: 0.18 });
  windows.forEach(function (w) { s.fillStyle = 'rgba(255,214,120,0.95)'; s.fillRect(w[0] - w[2] / 2, w[1] - w[3] / 2, w[2], w[3]); s.fillStyle = 'rgba(255,240,190,0.9)'; s.fillRect(w[0] - w[2] * 0.25, w[1] - w[3] * 0.25, w[2] * 0.5, w[3] * 0.5); });
  var grain = canvasGrain(W, H, 7, 18); s.globalCompositeOperation = 'multiply'; s.drawImage(grain, 0, 0); s.globalCompositeOperation = 'source-over';
  }
  var GS = 6, GW = Math.ceil(W / GS) + 1, GH = Math.ceil(H / GS) + 1, FX = new Float32Array(GW * GH), FY = new Float32Array(GW * GH);
  for (var gy = 0; gy < GH; gy++) for (var gx = 0; gx < GW; gx++) { var fv = staticField(gx * GS, gy * GS); FX[gy * GW + gx] = fv[0]; FY[gy * GW + gx] = fv[1]; }
  function cachedField(x, y) { var i = clamp(Math.round(x / GS), 0, GW - 1), j = clamp(Math.round(y / GS), 0, GH - 1); return [FX[j * GW + i], FY[j * GW + i]]; }
  /* ---- the moving sky: a vortex street shed by the cypress, one pair per 15 s ---- */
  var sp = 0.3 * W, K = 8, span = K * sp / 2, x0 = 0.25 * W, yc = 0.34 * H, am = 0.075 * H, rc = 0.085 * W, Gs = 2.6 * Ub * TAU * rc / 0.63;
  function street(t) { var out = []; for (var k = 0; k < K; k++) { var d = ((k * sp / 2 + sp * (t / LOOP)) % span + span) % span, x = x0 + d, sg = (k % 2) ? -1 : 1, env = clamp(d / (sp * 0.5), 0, 1) * clamp((W * 1.05 - x) / (sp * 0.6), 0, 1); out.push([x, yc + sg * am, sg * Gs * env, env]); } return out; }
  var ST = street(0), lastT = -1;
  /* the street's velocity and brightness, sampled once per frame on a coarse grid */
  var VG = 12, VW = Math.ceil(W / VG) + 1, VH = Math.ceil(H * 0.7 / VG) + 1, VX = new Float32Array(VW * VH), VY = new Float32Array(VW * VH), VS = new Float32Array(VW * VH);
  function prep(t) {
    ST = street(t); lastT = t;
    for (var j = 0; j < VH; j++) for (var i = 0; i < VW; i++) { var x = i * VG, y = j * VG, u0 = 0, v0 = 0, sw = 0;
      for (var k = 0; k < ST.length; k++) { var ex = x - ST[k][0], ey = y - ST[k][1], q = ex * ex + ey * ey + 1e-3, e = Math.exp(-q / (rc * rc)), f = ST[k][2] / (TAU * q) * (1 - e); u0 -= f * ey; v0 += f * ex; sw += ST[k][3] * Math.pow(e, 0.83); }
      var n = j * VW + i; VX[n] = u0; VY[n] = v0; VS[n] = sw; }
  }
  function vidx(x, y) { return clamp(Math.round(y / VG), 0, VH - 1) * VW + clamp(Math.round(x / VG), 0, VW - 1); }
  function skyField(x, y, t) {
    if (t !== lastT) prep(t);
    var f = cachedField(x, y), n = vidx(x, y); return [f[0] * 0.55 + VX[n], f[1] * 0.55 + VY[n]];
  }
  var lightC = [214, 230, 240];
  var flow = Flow({ n: 2500, r: rng(5), len: 28, width: 6.5, alpha: 0.92, life: [3, 6],
    spawn: function (rr) { for (var i = 0; i < 8; i++) { var x = rr() * W, y = rr() * H * 0.66, id = sr(x, y)[0]; if (id === 0 || id === 5) return [x, y]; } return [rr() * W, rr() * 0.3 * H]; },
    alive: function (x, y) { var id = sr(x, y)[0]; return x > -5 && x < W + 5 && y > -5 && (id === 0 || id === 5); },
    field: skyField,
    color: function (x, y, t, rr) { if (t !== lastT) prep(t); var c = jitter(su(x, y), rr, 34, 10), sw = VS[vidx(x, y)]; var k = clamp(sw * 0.55, 0, 0.5) * (rr > 0.35 ? 1 : 0.3); return [mix(c[0], lightC[0], k), mix(c[1], lightC[1], k), mix(c[2], lightC[2], k)]; } });
  var net = [[0, 1], [1, 9], [9, 2], [2, 3], [3, 4], [4, 10], [10, 7], [0, 6], [6, 5], [5, 2], [5, 8], [8, 4], [1, 5]];
  return {
    W: W, H: H, still: S,
    frame: function (ctx, t, dt) {
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.drawImage(S, 0, 0);
      flow(ctx, t, dt);
      ctx.globalCompositeOperation = 'lighter';
      stars.concat([moon]).forEach(function (st, i) { var a = 0.1 + 0.07 * Math.sin(TAU * (t / LOOP) * 2 + i * 1.3); var gg = ctx.createRadialGradient(st[0], st[1], 0, st[0], st[1], st[2] * 2.4); gg.addColorStop(0, 'rgba(255,240,180,' + a + ')'); gg.addColorStop(1, 'rgba(255,240,180,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(st[0], st[1], st[2] * 2.4, 0, TAU); ctx.fill(); });
      ctx.globalCompositeOperation = 'source-over';
      /* the stars are the network's nodes */
      ctx.lineWidth = 1.3; ctx.strokeStyle = 'rgba(250,236,180,0.2)';
      net.forEach(function (e, i) { var a = stars[e[0]], b = stars[e[1]]; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        var ph = ((t / LOOP) * 2 + i * 0.137) % 1; ctx.fillStyle = 'rgba(255,244,200,' + (0.7 * Math.sin(Math.PI * ph)) + ')'; ctx.beginPath(); ctx.arc(mix(a[0], b[0], ph), mix(a[1], b[1], ph), 2.4, 0, TAU); ctx.fill(); });
      windows.forEach(function (w, i) { var fl = 0.12 * Math.sin(TAU * (t / LOOP) * 3 + i * 2.1); if (fl > 0) { ctx.fillStyle = 'rgba(255,220,140,' + fl + ')'; ctx.fillRect(w[0] - w[2], w[1] - w[3], w[2] * 2, w[3] * 2); } });
    }
  };
}

/* =====================================================================
   II. THE FOUNDRY, POURING LIGHT  (in the manner of Claude Monet)
   ===================================================================== */
function foundry(W, H, base) {
  var r = rng(1877), U = mk(W, H), u = U.getContext('2d'), RG = mk(W, H), g = RG.getContext('2d');
  function reg(id) { return 'rgb(' + id + ',0,0)'; }
  var fire = [0.5 * W, 0.83 * H, 0.11 * W, 0.2 * H];
  /* ---- underpainting ---- */
  var bg = u.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#26252d'); bg.addColorStop(0.45, '#3b3436'); bg.addColorStop(0.8, '#4a3a30'); bg.addColorStop(1, '#2e2520'); u.fillStyle = bg; u.fillRect(0, 0, W, H);
  g.fillStyle = reg(0); g.fillRect(0, 0, W, H);
  /* warm air around the fire, cool air under the roof */
  var wa = u.createRadialGradient(fire[0], fire[1] - 0.1 * H, 10, fire[0], fire[1] - 0.1 * H, 0.6 * W); wa.addColorStop(0, 'rgba(255,170,80,0.75)'); wa.addColorStop(0.35, 'rgba(200,110,60,0.35)'); wa.addColorStop(1, 'rgba(60,50,70,0)'); u.fillStyle = wa; u.fillRect(0, 0, W, H);
  /* tall windows on the right */
  for (var wcol = 0; wcol < 3; wcol++) {
    var wx = W * (0.72 + wcol * 0.09), ww = W * 0.075, wy = H * 0.05, wh = H * 0.5;
    var wg = u.createLinearGradient(0, wy, 0, wy + wh); wg.addColorStop(0, '#f1e6c6'); wg.addColorStop(1, '#c9c2ae'); u.fillStyle = wg; u.fillRect(wx, wy, ww, wh);
    u.beginPath(); u.ellipse(wx + ww / 2, wy, ww / 2, ww * 0.35, 0, Math.PI, TAU); u.fill();
    g.fillStyle = reg(3); g.fillRect(wx, wy - ww * 0.35, ww, wh + ww * 0.35);
    u.strokeStyle = '#3b3530'; u.lineWidth = 3; for (var m = 1; m < 6; m++) { u.beginPath(); u.moveTo(wx, wy + wh * m / 6); u.lineTo(wx + ww, wy + wh * m / 6); u.stroke(); } u.beginPath(); u.moveTo(wx + ww / 2, wy - ww * 0.3); u.lineTo(wx + ww / 2, wy + wh); u.stroke();
  }
  /* light shafts from the windows */
  u.globalAlpha = 0.22; u.fillStyle = '#e8dcbc';
  for (var sh = 0; sh < 3; sh++) { var sx = W * (0.72 + sh * 0.09); u.beginPath(); u.moveTo(sx, H * 0.1); u.lineTo(sx + W * 0.075, H * 0.1); u.lineTo(sx - W * 0.25, H * 0.95); u.lineTo(sx - W * 0.4, H * 0.95); u.closePath(); u.fill(); }
  u.globalAlpha = 1;
  /* roof trusses and posts */
  u.strokeStyle = '#1d1b20'; u.lineCap = 'round';
  [[0.0, 0.18, 0.62, 0.0, 16], [0.3, 0.0, 1.0, 0.22, 14], [0.0, 0.05, 1.0, 0.05, 10], [0.5, 0.02, 0.7, 0.2, 9], [0.62, 0.0, 0.62, 0.62, 14], [0.04, 0.0, 0.04, 0.95, 18], [0.96, 0.0, 0.96, 0.95, 14], [0.15, 0.0, 0.25, 0.14, 8], [0.85, 0.12, 1.0, 0.3, 10]].forEach(function (b) { u.lineWidth = b[4]; u.beginPath(); u.moveTo(b[0] * W, b[1] * H); u.lineTo(b[2] * W, b[3] * H); u.stroke(); });
  /* hanging lamps */
  var lamps = [[0.2, 0.32], [0.38, 0.26], [0.58, 0.3], [0.86, 0.24]];
  lamps.forEach(function (l) { u.strokeStyle = '#1a1a1e'; u.lineWidth = 2; u.beginPath(); u.moveTo(l[0] * W, 0); u.lineTo(l[0] * W, l[1] * H); u.stroke();
    u.fillStyle = '#211f22'; u.beginPath(); u.moveTo(l[0] * W - 16, l[1] * H + 12); u.lineTo(l[0] * W + 16, l[1] * H + 12); u.lineTo(l[0] * W + 6, l[1] * H); u.lineTo(l[0] * W - 6, l[1] * H); u.closePath(); u.fill();
    var lg = u.createRadialGradient(l[0] * W, l[1] * H + 16, 1, l[0] * W, l[1] * H + 16, 60); lg.addColorStop(0, 'rgba(255,200,120,0.9)'); lg.addColorStop(1, 'rgba(255,170,90,0)'); u.fillStyle = lg; u.fillRect(l[0] * W - 60, l[1] * H - 44, 120, 120); });
  /* flywheel and belt on the left */
  var fw = [0.15 * W, 0.47 * H, 0.15 * W];
  u.strokeStyle = '#4a3d33'; u.lineWidth = 18; u.beginPath(); u.arc(fw[0], fw[1], fw[2], 0, TAU); u.stroke();
  u.strokeStyle = '#c08a58'; u.lineWidth = 5; u.beginPath(); u.arc(fw[0], fw[1], fw[2] - 6, -1.2, 0.4); u.stroke();
  u.strokeStyle = '#3e332b'; u.lineWidth = 7; for (var sp2 = 0; sp2 < 8; sp2++) { var an = sp2 / 8 * TAU; u.beginPath(); u.moveTo(fw[0], fw[1]); u.lineTo(fw[0] + Math.cos(an) * fw[2], fw[1] + Math.sin(an) * fw[2]); u.stroke(); }
  u.lineWidth = 7; u.beginPath(); u.moveTo(fw[0] - fw[2] * 0.2, fw[1] - fw[2]); u.lineTo(0.3 * W, 0); u.moveTo(fw[0] + fw[2] * 0.2, fw[1] - fw[2]); u.lineTo(0.34 * W, 0); u.stroke();
  /* machine wheel, right foreground */
  var mw = [0.87 * W, 0.76 * H, 0.1 * W];
  u.fillStyle = '#2b2522'; u.beginPath(); u.arc(mw[0], mw[1], mw[2], 0, TAU); u.fill(); u.fillStyle = '#4a3f36'; u.beginPath(); u.arc(mw[0], mw[1], mw[2] * 0.75, 0, TAU); u.fill(); u.fillStyle = '#211c1a'; u.beginPath(); u.arc(mw[0], mw[1], mw[2] * 0.25, 0, TAU); u.fill();
  u.strokeStyle = '#d08a4a'; u.lineWidth = 3; u.beginPath(); u.arc(mw[0], mw[1], mw[2] - 2, 2.4, 3.6); u.stroke();
  u.fillStyle = '#2b2522'; u.fillRect(mw[0], mw[1] - mw[2] * 0.12, W * 0.15, mw[2] * 0.24);
  /* workers: organic silhouettes, rim-lit from the fire */
  function figure(x, y, h, pose, face, rim) {
    var lean = pose === 'hammer' ? 0.1 : pose === 'work' ? 0.12 : pose === 'tongs' ? 0.06 : 0.02;
    function X(dx, dy) { return x + face * (dx + lean * Math.max(0, dy - 0.45)) * h; }
    function Y(dy) { return y - dy * h; }
    function torso(c) { c.beginPath(); c.moveTo(X(-0.115, 0.8), Y(0.8)); c.bezierCurveTo(X(-0.02, 0.84), Y(0.84), X(0.06, 0.84), Y(0.84), X(0.115, 0.8), Y(0.8));
      c.bezierCurveTo(X(0.12, 0.7), Y(0.7), X(0.075, 0.58), Y(0.58), X(0.085, 0.46), Y(0.46)); c.lineTo(X(-0.085, 0.46), Y(0.46));
      c.bezierCurveTo(X(-0.08, 0.58), Y(0.58), X(-0.125, 0.7), Y(0.7), X(-0.115, 0.8), Y(0.8)); c.closePath(); }
    function limb(c, pts, w0, w1) { for (var i = 0; i < pts.length - 1; i++) { c.lineWidth = mix(w0, w1, i / (pts.length - 1)) * h; c.beginPath(); c.moveTo(X(pts[i][0], pts[i][1]), Y(pts[i][1])); c.lineTo(X(pts[i + 1][0], pts[i + 1][1]), Y(pts[i + 1][1])); c.stroke(); } }
    var legs = pose === 'hammer' ? [[[-0.05, 0.47], [-0.11, 0.24], [-0.16, 0.0]], [[0.05, 0.47], [0.12, 0.25], [0.15, 0.0]]] : [[[-0.05, 0.47], [-0.06, 0.24], [-0.07, 0.0]], [[0.05, 0.47], [0.07, 0.24], [0.08, 0.0]]];
    var arms = pose === 'hammer' ? [[[0.1, 0.79], [0.22, 0.68], [0.3, 0.62]], [[-0.08, 0.79], [0.08, 0.66], [0.2, 0.64]]]
      : pose === 'tongs' ? [[[0.1, 0.79], [0.17, 0.64], [0.28, 0.57]], [[-0.09, 0.78], [0.0, 0.64], [0.14, 0.6]]]
      : pose === 'grind' ? [[[0.1, 0.79], [0.2, 0.68], [0.3, 0.66]], [[-0.08, 0.78], [0.06, 0.68], [0.2, 0.66]]]
      : [[[0.1, 0.79], [0.16, 0.62], [0.27, 0.56]], [[-0.09, 0.78], [-0.02, 0.62], [0.12, 0.56]]];
    [[u, '#241a16', '#3b2a21', '#5d4632', '#a0704c'], [g, reg(2), reg(2), reg(2), reg(2)]].forEach(function (L) {
      var c = L[0]; c.lineCap = 'round'; c.strokeStyle = L[2]; legs.forEach(function (l) { limb(c, l, 0.075, 0.05); });
      c.fillStyle = L[1]; torso(c); c.fill();
      c.fillStyle = L[3]; c.beginPath(); c.moveTo(X(-0.07, 0.72), Y(0.72)); c.lineTo(X(0.07, 0.72), Y(0.72)); c.lineTo(X(0.1, 0.24), Y(0.24)); c.lineTo(X(-0.1, 0.24), Y(0.24)); c.closePath(); c.fill();
      c.strokeStyle = L[1]; arms.forEach(function (a) { limb(c, a, 0.06, 0.042); });
      c.fillStyle = L[4]; arms.forEach(function (a) { var e = a[a.length - 1]; c.beginPath(); c.arc(X(e[0], e[1]), Y(e[1]), 0.026 * h, 0, TAU); c.fill(); });
      c.fillStyle = L[4]; c.beginPath(); c.ellipse(X(0.01, 0.89), Y(0.89), 0.045 * h, 0.056 * h, 0, 0, TAU); c.fill();
      c.fillStyle = L[2]; c.beginPath(); c.ellipse(X(0.0, 0.925), Y(0.925), 0.055 * h, 0.03 * h, 0, Math.PI, TAU); c.fill(); c.fillRect(X(face > 0 ? 0 : -0.07, 0.92) , Y(0.925), 0.07 * h, 0.012 * h);
    });
    if (pose === 'hammer') { u.strokeStyle = '#7a5434'; u.lineWidth = 0.018 * h; u.beginPath(); u.moveTo(X(0.18, 0.66), Y(0.66)); u.lineTo(X(0.6, 0.47), Y(0.47)); u.stroke(); u.fillStyle = '#2a2624'; u.save(); u.translate(X(0.6, 0.47), Y(0.47)); u.rotate(face * 0.42); u.fillRect(-0.035 * h, -0.05 * h, 0.07 * h, 0.1 * h); u.restore(); }
    if (pose === 'tongs') { u.strokeStyle = '#2e2a28'; u.lineWidth = 0.01 * h; u.beginPath(); u.moveTo(X(0.27, 0.57), Y(0.57)); u.lineTo(X(0.55, 0.36), Y(0.36)); u.moveTo(X(0.27, 0.58), Y(0.58)); u.lineTo(X(0.56, 0.4), Y(0.4)); u.stroke(); }
    /* rim light on the side that faces the fire */
    u.save(); var side = Math.sign(fire[0] - x) || 1; u.beginPath(); u.rect(side > 0 ? x : x - h, y - h * 1.1, h, h * 1.2); u.clip();
    u.globalAlpha = 0.5; u.strokeStyle = rim; u.lineWidth = Math.max(2, 0.02 * h); torso(u); u.stroke();
    u.beginPath(); u.ellipse(X(0.01, 0.89), Y(0.89), 0.045 * h, 0.056 * h, 0, 0, TAU); u.stroke();
    u.restore();
  }
  /* tool wall and benches behind the workers */
  u.strokeStyle = '#2a2420'; u.lineWidth = 3; for (var tl = 0; tl < 12; tl++) { var tx = W * (0.24 + tl * 0.022), ty = H * 0.36; u.beginPath(); u.moveTo(tx, ty); u.lineTo(tx + (tl % 3 - 1) * 4, ty + H * (0.06 + (tl % 4) * 0.015)); u.stroke(); }
  u.fillStyle = '#2b231e'; u.fillRect(0.7 * W, 0.56 * H, 0.26 * W, 0.025 * H); u.fillRect(0.72 * W, 0.585 * H, 0.012 * W, 0.08 * H); u.fillRect(0.93 * W, 0.585 * H, 0.012 * W, 0.08 * H);
  for (var jar = 0; jar < 6; jar++) { u.fillStyle = ['#4a4038', '#5c5046', '#3a332d'][jar % 3]; u.fillRect(W * (0.72 + jar * 0.035), H * (0.53 - (jar % 2) * 0.012), W * 0.02, H * (0.03 + (jar % 2) * 0.012)); }
  figure(0.89 * W, 0.66 * H, 0.32 * H, 'work', -1, '#c9a070');
  figure(0.77 * W, 0.67 * H, 0.36 * H, 'work', 1, '#d79a5a');
  figure(0.6 * W, 0.72 * H, 0.44 * H, 'tongs', -1, '#f2a24e');
  figure(0.085 * W, 0.76 * H, 0.44 * H, 'grind', 1, '#e0954a');
  figure(0.3 * W, 1.0 * H, 0.7 * H, 'hammer', 1, '#f6aa52');
  /* the grinder's spray of sparks */
  u.strokeStyle = 'rgba(255,200,110,0.8)'; u.lineWidth = 1.5; for (var gsp = 0; gsp < 40; gsp++) { var ga = -0.9 + r() * 1.2, gl = 0.03 * W + r() * 0.08 * W; u.beginPath(); u.moveTo(0.2 * W, 0.47 * H); u.lineTo(0.2 * W + Math.cos(ga) * gl, 0.47 * H + Math.sin(ga) * gl); u.stroke(); }
  /* anvil, logs, buckets */
  u.fillStyle = '#1f1b19'; u.fillRect(0.42 * W, 0.7 * H, 0.08 * W, 0.035 * H); u.fillRect(0.445 * W, 0.735 * H, 0.03 * W, 0.06 * H);
  u.fillStyle = '#3a2c22'; for (var lg2 = 0; lg2 < 6; lg2++) { u.save(); u.translate(W * (0.44 + lg2 * 0.025), H * 0.9); u.rotate(-0.3 + lg2 * 0.12); u.fillRect(-W * 0.05, -6, W * 0.1, 12); u.restore(); }
  for (var bk = 0; bk < 4; bk++) { var bx = W * (0.03 + bk * 0.055), by = H * 0.9; u.fillStyle = '#2d2a28'; u.fillRect(bx, by - 0.08 * H, 0.045 * W, 0.08 * H); u.fillStyle = '#5a5248'; u.beginPath(); u.ellipse(bx + 0.0225 * W, by - 0.08 * H, 0.0225 * W, 0.008 * H, 0, 0, TAU); u.fill(); }
  /* the fire bed */
  g.fillStyle = reg(1); g.beginPath(); g.ellipse(fire[0], fire[1] - fire[3] * 0.35, fire[2] * 1.2, fire[3] * 0.75, 0, 0, TAU); g.fill();
  var fg = u.createRadialGradient(fire[0], fire[1], 2, fire[0], fire[1], fire[2] * 1.4); fg.addColorStop(0, '#fff3c8'); fg.addColorStop(0.3, '#ffbf5a'); fg.addColorStop(0.7, '#d4582a'); fg.addColorStop(1, 'rgba(120,40,20,0)'); u.fillStyle = fg; u.beginPath(); u.ellipse(fire[0], fire[1], fire[2] * 1.4, fire[3] * 0.5, 0, 0, TAU); u.fill();
  /* wet floor: reflections of the windows and the fire, like a rainy street */
  g.fillStyle = reg(4); g.fillRect(0, 0.9 * H, W, 0.1 * H);
  u.globalAlpha = 0.5; for (var rf = 0; rf < 30; rf++) { var rx = W * (0.38 + r() * 0.24), ry = H * (0.9 + r() * 0.08); u.fillStyle = r() < 0.5 ? '#f0a050' : '#ffd890'; u.fillRect(rx, ry, 3 + r() * 6, 0.02 * H + r() * 0.05 * H); }
  for (var rw = 0; rw < 30; rw++) { var rx2 = W * (0.66 + r() * 0.3), ry2 = H * (0.88 + r() * 0.1); u.fillStyle = '#cfc6ad'; u.fillRect(rx2, ry2, 3 + r() * 5, 0.02 * H + r() * 0.05 * H); } u.globalAlpha = 1;
  /* haze of steam and smoke */
  for (var hz = 0; hz < 14; hz++) { var hx = r() * W, hy = H * (0.05 + r() * 0.5), hr = W * (0.08 + r() * 0.14); var hg = u.createRadialGradient(hx, hy, 0, hx, hy, hr); hg.addColorStop(0, 'rgba(165,160,180,0.28)'); hg.addColorStop(1, 'rgba(165,160,180,0)'); u.fillStyle = hg; u.fillRect(hx - hr, hy - hr, hr * 2, hr * 2); }
  var su = sampler(U), sr = sampler(RG);
  function curl(x, y) { return [Math.sin(y * 0.018) + 0.6 * Math.sin(y * 0.043 - x * 0.012), Math.cos(x * 0.016) + 0.5 * Math.cos(x * 0.037 + y * 0.019)]; }
  function staticField(x, y) {
    var id = sr(x, y)[0], hsh = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; hsh -= Math.floor(hsh);
    if (id === 3) return [0.15 * (hsh - 0.5), 1];
    if (id === 2) return [0.35 * (hsh - 0.5), 1];
    if (id === 4 || y > 0.9 * H) return [0.2 * (hsh - 0.5), 1];
    if (id === 1) return [0.6 * (hsh - 0.5), -1];
    var a = (hsh - 0.5) * 1.3 + 0.25 * Math.sin(x * 0.01 + y * 0.013); return [Math.cos(a), Math.sin(a)];
  }
  function warm(c) { return c[0] > c[2] + 40; }
  var S = mk(W, H), s = S.getContext('2d'); s.drawImage(U, 0, 0);
  function any(rr) { return [rr() * W, rr() * H]; }
  function col(J, hue, bc) { return function (x, y, rr) { var c = su(x, y); if (rr < bc) return warm(c) ? jitter([96, 104, 150], rr * 9 % 1, 30) : jitter([214, 150, 90], rr * 9 % 1, 30); return jitter(c, rr, J, hue); }; }
  if (base) { s.drawImage(base, 0, 0, W, H); } else {
  pass(s, { n: 7000, r: r, spawn: any, field: staticField, color: col(28, 7, 0.002), len: 15, width: 13, alpha: 0.65, hi: 0.1, steps: 2 });
  pass(s, { n: 16000, r: r, spawn: any, field: staticField, color: col(32, 8, 0.003), len: 10, width: 7.5, alpha: 0.85, hi: 0.14, steps: 2 });
  pass(s, { n: 32000, r: r, spawn: any, field: staticField, color: col(34, 8, 0.003), len: 6.5, width: 4.2, alpha: 0.9, hi: 0.16, steps: 2 });
  pass(s, { n: 18000, r: r, spawn: function (rr) { return [W * (0.02 + rr() * 0.96), H * (0.2 + rr() * 0.8)]; }, field: staticField, color: col(28, 6, 0.002), len: 4, width: 2.6, alpha: 0.95, hi: 0.2, steps: 2 });
  var grain = canvasGrain(W, H, 11, 18); s.globalCompositeOperation = 'multiply'; s.drawImage(grain, 0, 0); s.globalCompositeOperation = 'source-over';
  }
  /* ---- only the fire moves ---- */
  function flame(x, y, t) {
    var dy = fire[1] - y; if (dy < -fire[3] * 0.15 || dy > fire[3] * 1.05) return 0;
    var hgt = fire[3] * (0.75 + 0.25 * Math.sin(TAU * t / LOOP * 4 + x * 0.04)), s2 = clamp(dy / hgt, 0, 1);
    var wob = Math.sin(y * 0.05 - TAU * t / LOOP * 6 + x * 0.02) * fire[2] * 0.12 * s2;
    var wd = fire[2] * (1.15 - s2 * 0.95), d = Math.abs(x - fire[0] - wob) / wd;
    return clamp((1 - d) * (1 - s2 * 0.7) * 1.4, 0, 1);
  }
  var fcol = [[0.85, [255, 247, 220]], [0.65, [255, 214, 110]], [0.45, [255, 158, 60]], [0.25, [226, 90, 36]], [0.0, [130, 44, 26]]];
  var flow = Flow({ n: 1500, r: rng(13), len: 14, width: 6, alpha: 0.95, life: [0.6, 1.4],
    spawn: function (rr) { return [fire[0] + (rr() - 0.5) * fire[2] * 2.2, fire[1] - rr() * fire[3]]; },
    alive: function (x, y) { return y > fire[1] - fire[3] * 1.15 && Math.abs(x - fire[0]) < fire[2] * 1.3; },
    field: function (x, y, t) { return [Math.sin(y * 0.06 + TAU * t / LOOP * 5) * 14, -38 - 20 * Math.sin(x * 0.05 + TAU * t / LOOP * 3)]; },
    color: function (x, y, t, rr) { var f = flame(x, y, t) * (0.8 + rr * 0.4); if (f < 0.04) return null; for (var i = 0; i < fcol.length; i++) if (f >= fcol[i][0]) return jitter(fcol[i][1], rr, 26, 8); return null; } });
  var sparks = [], rs = rng(77);
  return {
    W: W, H: H, still: S,
    frame: function (ctx, t, dt) {
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.drawImage(S, 0, 0);
      var fl = 0.75 + 0.15 * Math.sin(TAU * t / LOOP * 7) + 0.1 * Math.sin(TAU * t / LOOP * 11.3);
      ctx.globalCompositeOperation = 'lighter';
      var gg = ctx.createRadialGradient(fire[0], fire[1] - fire[3] * 0.4, 5, fire[0], fire[1] - fire[3] * 0.4, W * 0.42); gg.addColorStop(0, 'rgba(255,170,80,' + 0.32 * fl + ')'); gg.addColorStop(0.5, 'rgba(220,110,50,' + 0.1 * fl + ')'); gg.addColorStop(1, 'rgba(200,90,40,0)'); ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      flow(ctx, t, dt);
      ctx.globalCompositeOperation = 'lighter';
      if (dt > 0) for (var n = 0; n < 3; n++) sparks.push([fire[0] + (rs() - 0.5) * fire[2], fire[1] - fire[3] * 0.4, (rs() - 0.5) * 90, -60 - rs() * 110, 0, 1.4 + rs() * 1.8]);
      for (var i = sparks.length - 1; i >= 0; i--) { var sp = sparks[i]; sp[3] += 40 * dt; sp[0] += sp[2] * dt + Math.sin(sp[4] * 3 + i) * 0.3; sp[1] += sp[3] * dt; sp[4] += dt; if (sp[4] > sp[5]) { sparks.splice(i, 1); continue; }
        var a = 1 - sp[4] / sp[5]; ctx.fillStyle = 'rgba(255,' + (190 + 60 * a | 0) + ',110,' + a + ')'; ctx.beginPath(); ctx.arc(sp[0], sp[1], 1.8 + a, 0, TAU); ctx.fill(); }
      /* the fire's light on the wet floor */
      var rg = ctx.createLinearGradient(0, 0.9 * H, 0, H); rg.addColorStop(0, 'rgba(255,150,70,' + 0.12 * fl + ')'); rg.addColorStop(1, 'rgba(255,150,70,0)'); ctx.fillStyle = rg; ctx.fillRect(fire[0] - fire[2] * 1.6, 0.9 * H, fire[2] * 3.2, 0.1 * H);
      ctx.globalCompositeOperation = 'source-over';
    }
  };
}

/* =====================================================================
   III. ANCHORED  (original surrealist study)
   ===================================================================== */
function anchored(W, H) {
  var r = rng(1931), hz = 0.57 * H;
  var BG = mk(W, H), b = BG.getContext('2d');
  /* sky: smooth glazes, low wisps of cloud */
  var sk = b.createLinearGradient(0, 0, 0, hz); sk.addColorStop(0, '#16304a'); sk.addColorStop(0.35, '#3d6f8c'); sk.addColorStop(0.75, '#a7c4c4'); sk.addColorStop(1, '#f3dcaa'); b.fillStyle = sk; b.fillRect(0, 0, W, hz);
  for (var c = 0; c < 9; c++) { var cy = H * (0.1 + r() * 0.35), cx = r() * W, cw = W * (0.15 + r() * 0.3); var cg = b.createLinearGradient(0, cy - 6, 0, cy + 6); cg.addColorStop(0, 'rgba(255,240,220,0)'); cg.addColorStop(0.5, 'rgba(255,240,220,' + (0.12 + r() * 0.15) + ')'); cg.addColorStop(1, 'rgba(255,240,220,0)'); b.fillStyle = cg; b.beginPath(); b.ellipse(cx, cy, cw, 5 + r() * 6, 0, 0, TAU); b.fill(); }
  /* distant mesas */
  b.fillStyle = '#8c7a8a'; b.beginPath(); b.moveTo(0, hz); b.lineTo(0, hz - 0.06 * H); b.lineTo(0.05 * W, hz - 0.068 * H); b.lineTo(0.09 * W, hz - 0.03 * H); b.lineTo(0.18 * W, hz - 0.035 * H); b.lineTo(0.2 * W, hz); b.closePath(); b.fill();
  b.fillStyle = '#a08e98'; b.beginPath(); b.moveTo(0.58 * W, hz); b.lineTo(0.6 * W, hz - 0.02 * H); b.lineTo(0.68 * W, hz - 0.024 * H); b.lineTo(0.7 * W, hz); b.closePath(); b.fill();
  /* the desert floor */
  var gr = b.createLinearGradient(0, hz, 0, H); gr.addColorStop(0, '#e6c993'); gr.addColorStop(0.3, '#c99f6a'); gr.addColorStop(0.75, '#8f6a45'); gr.addColorStop(1, '#5a3f2a'); b.fillStyle = gr; b.fillRect(0, hz, W, H - hz);
  for (var p = 0; p < 160; p++) { var px = r() * W, py = hz + Math.pow(r(), 1.6) * (H - hz), ps = 1 + (py - hz) / (H - hz) * 6 * r(); b.fillStyle = 'rgba(60,38,22,0.35)'; b.beginPath(); b.ellipse(px - ps * 2.5, py + ps * 0.3, ps * 2.6, ps * 0.4, 0, 0, TAU); b.fill(); b.fillStyle = ['#d8bb8c', '#b38a5e', '#e9d2a8'][(r() * 3) | 0]; b.beginPath(); b.ellipse(px, py, ps, ps * 0.6, 0, 0, TAU); b.fill(); }
  /* the broken column (left) */
  var col = [0.19 * W, 0.83 * H, 0.055 * W, 0.37 * H];
  b.fillStyle = 'rgba(60,38,22,0.4)'; b.beginPath(); b.moveTo(col[0] - col[2], col[1]); b.lineTo(col[0] + col[2], col[1]); b.lineTo(col[0] - col[2] - 0.32 * W, col[1] + 0.05 * H); b.lineTo(col[0] - col[2] - 0.36 * W, col[1] + 0.03 * H); b.closePath(); b.fill();
  var cgr = b.createLinearGradient(col[0] - col[2], 0, col[0] + col[2], 0); cgr.addColorStop(0, '#8a7a6c'); cgr.addColorStop(0.35, '#d9cdbd'); cgr.addColorStop(0.7, '#f1e7d8'); cgr.addColorStop(1, '#b4a493'); b.fillStyle = cgr; b.fillRect(col[0] - col[2], col[1] - col[3], col[2] * 2, col[3]);
  b.strokeStyle = 'rgba(90,75,60,0.35)'; b.lineWidth = 2; for (var fl = 1; fl < 8; fl++) { var fx = col[0] - col[2] + col[2] * 2 * fl / 8; b.beginPath(); b.moveTo(fx, col[1] - col[3]); b.lineTo(fx, col[1]); b.stroke(); }
  b.fillStyle = '#c9bba9'; b.fillRect(col[0] - col[2] * 1.3, col[1] - 10, col[2] * 2.6, 12); b.fillStyle = '#e5dacb'; b.beginPath(); b.moveTo(col[0] - col[2], col[1] - col[3]); b.lineTo(col[0] - col[2] * 0.3, col[1] - col[3] - 10); b.lineTo(col[0] + col[2] * 0.4, col[1] - col[3] - 4); b.lineTo(col[0] + col[2], col[1] - col[3] - 12); b.lineTo(col[0] + col[2], col[1] - col[3]); b.closePath(); b.fill();
  /* the obsidian tablet (right) */
  var tab = [0.75 * W, 0.86 * H, 0.2 * W, 0.4 * H];
  b.fillStyle = 'rgba(40,24,14,0.55)'; b.beginPath(); b.moveTo(tab[0] - tab[2] / 2, tab[1]); b.lineTo(tab[0] + tab[2] / 2, tab[1]); b.lineTo(tab[0] - tab[2] / 2 - 0.42 * W, tab[1] + 0.06 * H); b.lineTo(tab[0] - tab[2] / 2 - 0.5 * W, tab[1] + 0.04 * H); b.closePath(); b.fill();
  var tg = b.createLinearGradient(tab[0] - tab[2] / 2, 0, tab[0] + tab[2] / 2, 0); tg.addColorStop(0, '#0f1218'); tg.addColorStop(0.5, '#262c38'); tg.addColorStop(0.52, '#3d4658'); tg.addColorStop(1, '#0d1016'); b.fillStyle = tg;
  b.beginPath(); b.moveTo(tab[0] - tab[2] / 2, tab[1]); b.lineTo(tab[0] - tab[2] / 2, tab[1] - tab[3] + 18); b.quadraticCurveTo(tab[0], tab[1] - tab[3] - 18, tab[0] + tab[2] / 2, tab[1] - tab[3] + 18); b.lineTo(tab[0] + tab[2] / 2, tab[1]); b.closePath(); b.fill();
  b.fillStyle = '#4a5468'; b.fillRect(tab[0] + tab[2] / 2 - 6, tab[1] - tab[3] + 16, 6, tab[3] - 16);
  b.fillStyle = '#2a2e38'; b.fillRect(tab[0] - tab[2] / 2 - 10, tab[1] - 8, tab[2] + 20, 14);
  b.textAlign = 'center'; b.fillStyle = '#e2c27a';
  b.font = 'italic 400 ' + (W * 0.0155) + 'px "IBM Plex Serif", Georgia, serif'; b.fillText('ℒ = ℒdata + λ · ℒphysics', tab[0], tab[1] - tab[3] * 0.72);
  b.font = '500 ' + (W * 0.0098) + 'px "IBM Plex Mono", monospace';
  ['ℒphysics = ‖ ∂u/∂t + (u·∇)u', '+ ∇p/ρ − ν∇²u ‖²', '', '∇·u = 0', 'ρc ∂T/∂t = ∇·(k∇T)', '∇·σ + f = 0'].forEach(function (l, i) { b.fillText(l, tab[0], tab[1] - tab[3] * 0.6 + i * W * 0.021); });
  b.strokeStyle = 'rgba(226,194,122,0.5)'; b.lineWidth = 1; b.beginPath(); b.moveTo(tab[0] - tab[2] * 0.35, tab[1] - tab[3] * 0.67); b.lineTo(tab[0] + tab[2] * 0.35, tab[1] - tab[3] * 0.67); b.stroke();
  /* stakes for the anchor lines */
  var stakes = [[0.6 * W, 0.94 * H, 'gravity'], [0.93 * W, 0.97 * H, 'thermodynamics'], [0.95 * W, 0.74 * H, 'conservation'], [0.55 * W, 0.75 * H, 'momentum']];
  stakes.forEach(function (s) { b.fillStyle = 'rgba(40,24,14,0.45)'; b.beginPath(); b.ellipse(s[0] - 30, s[1] + 2, 32, 3, 0, 0, TAU); b.fill(); b.fillStyle = '#1e2430'; b.beginPath(); b.moveTo(s[0] - 4, s[1]); b.lineTo(s[0], s[1] - 22); b.lineTo(s[0] + 4, s[1]); b.closePath(); b.fill();
    b.font = '500 ' + (W * 0.0095) + 'px "IBM Plex Mono", monospace'; b.fillStyle = 'rgba(40,30,22,0.8)'; b.textAlign = 'center'; b.fillText(s[2], s[0], s[1] + 18); });
  var grain = canvasGrain(W, H, 3, 14);
  /* PyTorch code that melts */
  var code = ['import torch', 'import torch.nn as nn', '', 'model = nn.Sequential(', '    nn.Linear(3, 128), nn.Tanh(),', '    nn.Linear(128, 128), nn.Tanh(),', '    nn.Linear(128, 3))', '', 'opt = torch.optim.Adam(', '    model.parameters(), lr=1e-3)', '', 'for epoch in range(10_000):', '    pred = model(x)', '    loss = ((pred - y)**2).mean()', '    opt.zero_grad()', '    loss.backward()', '    opt.step()', '# no physics. only data.'];
  var SW = Math.round(0.2 * W), SH = Math.round(0.17 * H), SC = mk(SW, SH * 2), sc = SC.getContext('2d');
  sc.fillStyle = '#0f1622'; sc.fillRect(0, 0, SW, SH * 2); sc.font = '500 ' + Math.round(SW * 0.045) + 'px "IBM Plex Mono", monospace'; sc.textBaseline = 'top';
  for (var rep = 0; rep < 2; rep++) code.forEach(function (l, i) { sc.fillStyle = l.indexOf('#') === 0 ? '#8a94a8' : l.indexOf('loss') >= 0 ? '#ffcf7a' : l.indexOf('import') === 0 ? '#c79bff' : '#9fe0c0'; sc.fillText(l, SW * 0.05, rep * SH + i * SW * 0.062 + SW * 0.03); });
  var drips = [];
  /* neurons in the glass orb */
  var orb = [0.47 * W, 0.74 * H, 0.085 * W], neu = []; for (var n = 0; n < 34; n++) { var th = r() * TAU, ph = Math.acos(2 * r() - 1), rr = Math.cbrt(r()) * 0.82; neu.push([Math.sin(ph) * Math.cos(th) * rr, Math.cos(ph) * rr, Math.sin(ph) * Math.sin(th) * rr]); }
  var syn = []; for (var a = 0; a < neu.length; a++) for (var bb = a + 1; bb < neu.length; bb++) { var d = Math.hypot(neu[a][0] - neu[bb][0], neu[a][1] - neu[bb][1], neu[a][2] - neu[bb][2]); if (d < 0.42) syn.push([a, bb]); }
  /* the lattice */
  var lat = []; for (var i = -1; i <= 1; i++) for (var j = -1; j <= 1; j++) for (var k = -1; k <= 1; k++) lat.push([i, j, k]);
  var LC = [tab[0], 0.25 * H], LS = 0.036 * W;
  function lproj(q, t) { var an = (t / LOOP) * (Math.PI / 2), ca = Math.cos(an), sa = Math.sin(an), tl = 0.45; var x = q[0] * ca + q[2] * sa, z = -q[0] * sa + q[2] * ca, y = q[1] * Math.cos(tl) - z * Math.sin(tl); z = q[1] * Math.sin(tl) + z * Math.cos(tl); var kk = 1 + z * 0.07; return [LC[0] + x * LS * kk, LC[1] + y * LS * kk, z, kk]; }
  function sphere(c, x, y, rad, hi, mid, lo) { var g2 = c.createRadialGradient(x - rad * 0.35, y - rad * 0.4, rad * 0.08, x, y, rad); g2.addColorStop(0, hi); g2.addColorStop(0.45, mid); g2.addColorStop(1, lo); c.fillStyle = g2; c.beginPath(); c.arc(x, y, rad, 0, TAU); c.fill(); }
  var sun = [0.86 * W, 0.33 * H, 0.05 * W];
  return {
    W: W, H: H,
    frame: function (c2, t, dt) {
      var ph = (t % LOOP) / LOOP;
      c2.globalCompositeOperation = 'source-over'; c2.globalAlpha = 1; c2.drawImage(BG, 0, 0);
      /* digital sun, low over the horizon */
      var sg = c2.createRadialGradient(sun[0], sun[1], 0, sun[0], sun[1], sun[2] * 3.2); sg.addColorStop(0, 'rgba(255,236,190,0.6)'); sg.addColorStop(1, 'rgba(255,236,190,0)'); c2.fillStyle = sg; c2.fillRect(sun[0] - sun[2] * 3.2, sun[1] - sun[2] * 3.2, sun[2] * 6.4, sun[2] * 6.4);
      c2.save(); c2.beginPath(); c2.arc(sun[0], sun[1], sun[2], 0, TAU); c2.clip(); var sf = c2.createLinearGradient(0, sun[1] - sun[2], 0, sun[1] + sun[2]); sf.addColorStop(0, '#fff7d2'); sf.addColorStop(1, '#f2a45a'); c2.fillStyle = sf; c2.fillRect(sun[0] - sun[2], sun[1] - sun[2], sun[2] * 2, sun[2] * 2);
      c2.fillStyle = '#b9c9c2'; for (var s = 0; s < 6; s++) { var yy = sun[1] + ((s / 6 + ph) % 1) * sun[2]; c2.fillRect(sun[0] - sun[2], yy, sun[2] * 2, 1 + (yy - sun[1]) / sun[2] * 4.5); } c2.restore();
      /* faint grid glowing in the sand */
      c2.strokeStyle = 'rgba(120,225,255,0.1)'; c2.lineWidth = 1;
      for (var gx = -14; gx <= 14; gx++) { c2.beginPath(); c2.moveTo(W / 2, hz); c2.lineTo(W / 2 + gx * W * 0.1, H); c2.stroke(); }
      for (var gy = 0; gy < 10; gy++) { var f = ((gy + ph) % 10) / 10, y = hz + Math.pow(f, 2.3) * (H - hz); c2.globalAlpha = f * 0.9; c2.beginPath(); c2.moveTo(0, y); c2.lineTo(W, y); c2.stroke(); } c2.globalAlpha = 1;
      /* I. the screen of PyTorch code, melting over the column */
      var top = col[1] - col[3] - 6, x0 = col[0] - SW * 0.5, strips = 96, swd = SW / strips, sag = 0.88 + 0.12 * Math.sin(TAU * ph);
      var scroll = ph * SH;
      for (var st2 = 0; st2 < strips; st2++) {
        var sx = x0 + st2 * swd, rel = (sx + swd / 2 - col[0]) / col[2];
        var e = Math.max(0, Math.abs(rel) - 0.85), drop = Math.min(1, e * e * 0.9) * SH * (rel > 0 ? 1.0 : 0.75) * sag;
        var stretch = 1 + drop / SH * 0.9;
        c2.drawImage(SC, st2 * swd, scroll, swd + 0.6, SH, sx, top + drop, swd + 0.6, SH * stretch);
      }
      /* bezel highlight and the drooping lip */
      c2.strokeStyle = 'rgba(220,226,235,0.55)'; c2.lineWidth = 3; c2.beginPath(); c2.moveTo(col[0] - col[2], top); c2.lineTo(col[0] + col[2], top); c2.stroke();
      var lipY = function (rel) { var e = Math.max(0, Math.abs(rel) - 0.85), dr = Math.min(1, e * e * 0.9) * (rel > 0 ? 1.0 : 0.75) * sag; return top + dr * SH + SH * (1 + dr * 0.9); };
      c2.fillStyle = '#0f1622'; for (var dd = 0; dd < 7; dd++) { var rel2 = -1.7 + dd * 0.57, dx = col[0] + rel2 * col[2], ly = lipY(rel2) + 2, ln = 10 + 14 * ((Math.sin(dd * 2.3 + TAU * ph) + 1) / 2); c2.beginPath(); c2.moveTo(dx - 5, ly - 4); c2.quadraticCurveTo(dx, ly + ln, dx + 5, ly - 4); c2.fill();
        if (dt > 0 && ((t * 0.5 + dd * 0.37) % 1) < dt * 0.5) drips.push([dx, ly + ln, 0]); }
      for (var q = drips.length - 1; q >= 0; q--) { var dr = drips[q]; dr[2] += 160 * dt; dr[1] += dr[2] * dt; if (dr[1] > col[1] + 0.02 * H) { drips.splice(q, 1); continue; } c2.fillStyle = '#16202e'; c2.beginPath(); c2.ellipse(dr[0], dr[1], 3, 5, 0, 0, TAU); c2.fill(); }
      var pool = c2.createRadialGradient(col[0] + col[2] * 1.6, col[1] + 0.02 * H, 2, col[0] + col[2] * 1.6, col[1] + 0.02 * H, 0.08 * W); pool.addColorStop(0, '#1f2b3c'); pool.addColorStop(1, '#0f1622'); c2.fillStyle = pool; c2.beginPath(); c2.ellipse(col[0] + col[2] * 1.4, col[1] + 0.02 * H, 0.08 * W * (0.9 + 0.1 * Math.sin(TAU * ph)), 0.014 * H, 0, 0, TAU); c2.fill();
      c2.fillStyle = 'rgba(255,207,122,0.35)'; c2.font = '500 ' + (W * 0.008) + 'px "IBM Plex Mono", monospace'; c2.fillText('loss = nan', col[0] + col[2] * 1.4, col[1] + 0.024 * H);
      /* II. the orb of neurons, sinking and softening into the sand */
      var o = orb; c2.fillStyle = 'rgba(50,30,18,0.4)'; c2.beginPath(); c2.ellipse(o[0] - o[2] * 1.4, o[1] + o[2] * 0.9, o[2] * 1.8, o[2] * 0.18, 0, 0, TAU); c2.fill();
      c2.save(); c2.beginPath(); c2.arc(o[0], o[1], o[2], 0, TAU); c2.clip();
      var og = c2.createRadialGradient(o[0] - o[2] * 0.3, o[1] - o[2] * 0.3, 2, o[0], o[1], o[2]); og.addColorStop(0, 'rgba(230,240,255,0.35)'); og.addColorStop(0.7, 'rgba(120,150,190,0.25)'); og.addColorStop(1, 'rgba(60,80,120,0.55)'); c2.fillStyle = og; c2.fillRect(o[0] - o[2], o[1] - o[2], o[2] * 2, o[2] * 2);
      var an = TAU * ph, ca = Math.cos(an), sa = Math.sin(an), P = neu.map(function (v) { return [o[0] + (v[0] * ca + v[2] * sa) * o[2], o[1] + v[1] * o[2], -v[0] * sa + v[2] * ca]; });
      c2.lineWidth = 1; syn.forEach(function (e, i) { var A = P[e[0]], B = P[e[1]], pulse = 0.5 + 0.5 * Math.sin(TAU * ph * 3 + i); c2.strokeStyle = 'rgba(255,214,150,' + (0.15 + 0.35 * pulse) + ')'; c2.beginPath(); c2.moveTo(A[0], A[1]); c2.lineTo(B[0], B[1]); c2.stroke(); });
      P.forEach(function (p2, i) { var a = 0.6 + 0.4 * Math.sin(TAU * ph * 2 + i); c2.fillStyle = 'rgba(255,226,170,' + a + ')'; c2.beginPath(); c2.arc(p2[0], p2[1], 2 + (p2[2] + 1) * 1.6, 0, TAU); c2.fill(); });
      c2.restore();
      /* the orb's lower edge slumps into a molten pool */
      var mg = c2.createLinearGradient(0, o[1] + o[2] * 0.5, 0, o[1] + o[2] * 1.15); mg.addColorStop(0, 'rgba(201,159,106,0)'); mg.addColorStop(1, 'rgba(160,120,80,0.9)'); c2.fillStyle = mg; c2.beginPath(); c2.ellipse(o[0], o[1] + o[2] * 0.95, o[2] * (1.35 + 0.08 * Math.sin(TAU * ph)), o[2] * 0.2, 0, 0, TAU); c2.fill();
      c2.strokeStyle = 'rgba(255,255,255,0.55)'; c2.lineWidth = 2; c2.beginPath(); c2.arc(o[0], o[1], o[2] - 2, -2.6, -1.6); c2.stroke();
      c2.strokeStyle = 'rgba(30,40,60,0.6)'; c2.lineWidth = 1.2; c2.beginPath(); c2.moveTo(o[0] + o[2] * 0.2, o[1] + o[2] * 0.95); c2.lineTo(o[0] + o[2] * 0.35, o[1] + o[2] * 0.55); c2.lineTo(o[0] + o[2] * 0.25, o[1] + o[2] * 0.3); c2.stroke();
      /* III. the lattice over the tablet: ordered, anchored, unmelting */
      var pts = lat.map(function (q2) { return lproj(q2, t); });
      var corners = [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]];
      c2.globalCompositeOperation = 'lighter';
      corners.forEach(function (cn, a2) { var ci = lat.findIndex(function (q3) { return q3[0] === cn[0] && q3[1] === cn[1] && q3[2] === cn[2]; }), A = pts[ci], S2 = stakes[a2], sh = 0.75 + 0.25 * Math.sin(TAU * ph * 2 + a2);
        c2.strokeStyle = 'rgba(110,235,255,' + 0.16 * sh + ')'; c2.lineWidth = 8; c2.beginPath(); c2.moveTo(A[0], A[1]); c2.lineTo(S2[0], S2[1] - 22); c2.stroke(); c2.strokeStyle = 'rgba(200,250,255,0.95)'; c2.lineWidth = 1.4; c2.stroke(); });
      c2.globalCompositeOperation = 'source-over';
      c2.strokeStyle = 'rgba(215,240,255,0.6)'; c2.lineWidth = 1.2;
      for (var e1 = 0; e1 < lat.length; e1++) for (var e2 = e1 + 1; e2 < lat.length; e2++) { var dd2 = Math.abs(lat[e1][0] - lat[e2][0]) + Math.abs(lat[e1][1] - lat[e2][1]) + Math.abs(lat[e1][2] - lat[e2][2]); if (dd2 !== 1) continue; c2.beginPath(); c2.moveTo(pts[e1][0], pts[e1][1]); c2.lineTo(pts[e2][0], pts[e2][1]); c2.stroke(); }
      pts.map(function (p3, i) { return [p3[2], i]; }).sort(function (x, y) { return x[0] - y[0]; }).forEach(function (o2) { var p4 = pts[o2[1]]; sphere(c2, p4[0], p4[1], W * 0.0085 * p4[3], '#ffffff', '#86ccff', '#1d4a86'); });
      c2.fillStyle = 'rgba(40,24,14,0.25)'; c2.beginPath(); c2.ellipse(LC[0] - 0.2 * W, 0.97 * H, 0.1 * W, 0.012 * H, 0, 0, TAU); c2.fill();
      c2.globalCompositeOperation = 'multiply'; c2.drawImage(grain, 0, 0);
      c2.globalCompositeOperation = 'source-over';
      var vg = c2.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,12,6,0.32)'); c2.fillStyle = vg; c2.fillRect(0, 0, W, H);
    }
  };
}

window.PhyPaintings2 = {
  LOOP: LOOP,
  make: function (kind, canvas, W, H, base) {
    var p = kind === 'starry' ? starry(W, H, base) : kind === 'foundry' ? foundry(W, H, base) : anchored(W, H);
    canvas.width = W; canvas.height = H; var ctx = canvas.getContext('2d');
    return { still: p.still, frame: function (t, dt) { ctx.save(); p.frame(ctx, t, dt); ctx.restore(); } };
  }
};
})();
