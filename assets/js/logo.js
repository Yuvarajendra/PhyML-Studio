/* PhyML Studio mark, alive: a subtle colour scheme chosen at each load, dots that drift along the streamlines, and an eye that blinks. */
(function () {
  /* navy and white, plus schemes taken from the colour maps used for CFD contour plots */
  var PALETTES = [
    { name: 'navy',     bg: '#13213A', line: '#56739A', dot: '#5AA9E0', edge: '#5AA9E0', eye: '#FFFFFF', pupil: '#4FA0D6', ring: 'transparent' },
    { name: 'white',    bg: '#FFFFFF', line: '#A9BBCD', dot: '#2B74AD', edge: '#2B74AD', eye: '#13213A', pupil: '#5AA9E0', ring: 'rgba(19,33,58,0.14)' },
    { name: 'rainbow',  bg: '#0E1D4A', line: ['#2F56C9', '#25B6D9', '#4CC77A', '#E9D24A', '#E0573B'], dot: '#F2F5FA', edge: '#9FB4D8', eye: '#F2F5FA', pupil: '#E0573B', ring: 'transparent' },
    { name: 'coolwarm', bg: '#F5F2EE', line: ['#3B4CC0', '#8DB0FE', '#D9D3CE', '#F49A7B', '#B40426'], dot: '#3B4CC0', edge: '#6E7FD6', eye: '#1C2440', pupil: '#B40426', ring: 'rgba(60,40,40,0.14)' },
    { name: 'viridis',  bg: '#24123A', line: ['#3B528B', '#2C728E', '#21918C', '#5EC962', '#FDE725'], dot: '#FDE725', edge: '#5EC962', eye: '#F4F1E8', pupil: '#21918C', ring: 'transparent' },
    { name: 'thermal',  bg: '#1A0B26', line: ['#57106E', '#9C2964', '#DD513A', '#F98C0A', '#FCCD25'], dot: '#FCF4A3', edge: '#F98C0A', eye: '#F7EFE4', pupil: '#DD513A', ring: 'transparent' }
  ];
  var pal = window.__phymlPalette;
  if (!pal) { pal = PALETTES[Math.floor(Math.random() * PALETTES.length)]; window.__phymlPalette = pal; }
  function setPalette(p) { pal = p; }
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function live(svg, opts) {
    opts = opts || {};
    var rect = svg.querySelector('rect'), paths = [].slice.call(svg.querySelectorAll('path')), lines = [].slice.call(svg.querySelectorAll('line'));
    var circles = [].slice.call(svg.querySelectorAll('circle')), dots = [], eye = null, pupil = null;
    circles.forEach(function (c) { var r = +c.getAttribute('r'); if (r < 2.5) dots.push(c); else if (r > 5) eye = c; else pupil = c; });
    if (rect) { rect.setAttribute('fill', pal.bg); rect.setAttribute('stroke', pal.ring); rect.setAttribute('stroke-width', pal.ring === 'transparent' ? 0 : 1); }
    var uid = 'pg' + Math.random().toString(36).slice(2, 8);
    if (Array.isArray(pal.line)) {
      var NS = 'http://www.w3.org/2000/svg', defs = svg.querySelector('defs') || svg.insertBefore(document.createElementNS(NS, 'defs'), svg.firstChild), g = document.createElementNS(NS, 'linearGradient');
      g.setAttribute('id', uid); g.setAttribute('gradientUnits', 'userSpaceOnUse'); g.setAttribute('x1', '2'); g.setAttribute('x2', '62'); g.setAttribute('y1', '0'); g.setAttribute('y2', '0');
      pal.line.forEach(function (c, i) { var st = document.createElementNS(NS, 'stop'); st.setAttribute('offset', (i / (pal.line.length - 1) * 100) + '%'); st.setAttribute('stop-color', c); g.appendChild(st); });
      defs.appendChild(g);
    }
    paths.forEach(function (p) { p.setAttribute('stroke', Array.isArray(pal.line) ? 'url(#' + uid + ')' : pal.line); });
    lines.forEach(function (l) { l.setAttribute('stroke', pal.edge); });
    dots.forEach(function (d) { d.setAttribute('fill', pal.dot); });
    if (eye) eye.setAttribute('fill', pal.eye);
    if (pupil) pupil.setAttribute('fill', pal.pupil);
    /* each dot rides the streamline it sits on */
    var riders = dots.map(function (d, i) {
      var x = +d.getAttribute('cx'), y = +d.getAttribute('cy'), best = null;
      paths.forEach(function (p) { var L = p.getTotalLength(); for (var s = 0; s <= L; s += 0.5) { var q = p.getPointAtLength(s), e = (q.x - x) * (q.x - x) + (q.y - y) * (q.y - y); if (!best || e < best.e) best = { p: p, s: s, L: L, e: e }; } });
      return { d: d, p: best.p, s0: best.s, L: best.L, ph: (i * 0.618) % 1, x: x, y: y };
    });
    var ends = lines.map(function (l) {
      function near(x, y) { var k = 0, e = 1e9; riders.forEach(function (r, i) { var v = (r.x - x) * (r.x - x) + (r.y - y) * (r.y - y); if (v < e) { e = v; k = i; } }); return k; }
      return { l: l, a: near(+l.getAttribute('x1'), +l.getAttribute('y1')), b: near(+l.getAttribute('x2'), +l.getAttribute('y2')) };
    });
    if (!reduce) {
      var t0 = performance.now();
      (function tick(now) {
        var t = (now - t0) / 1000;
        riders.forEach(function (r) { var s = Math.max(0, Math.min(r.L, r.s0 + 1.1 * Math.sin((t / 4.5 + r.ph) * Math.PI * 2))), q = r.p.getPointAtLength(s); r.d.setAttribute('cx', q.x.toFixed(2)); r.d.setAttribute('cy', q.y.toFixed(2)); r.cx = q.x; r.cy = q.y; });
        ends.forEach(function (e) { var A = riders[e.a], B = riders[e.b]; e.l.setAttribute('x1', A.cx.toFixed(2)); e.l.setAttribute('y1', A.cy.toFixed(2)); e.l.setAttribute('x2', B.cx.toFixed(2)); e.l.setAttribute('y2', B.cy.toFixed(2)); });
        requestAnimationFrame(tick);
      })(t0);
    }
    /* the pupil dilates and constricts now and then, easing like an iris */
    if (pupil && !reduce) {
      var r0 = +pupil.getAttribute('r'), rc = r0;
      (function iris() {
        var target = r0 * (0.62 + Math.random() * 0.72), from = rc, t0 = performance.now(), dur = 700 + Math.random() * 600;
        (function step(now) { var u = Math.min(1, (now - t0) / dur), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; rc = from + (target - from) * e; pupil.setAttribute('r', rc.toFixed(2)); if (u < 1) requestAnimationFrame(step); })(t0);
        setTimeout(iris, 2500 + Math.random() * 4500);
      })();
    }
    /* the blink: random, every 1 to 5 seconds, now and then a double blink */
    var lid = opts.lid;
    if (lid && !reduce) {
      (function blink() {
        var dbl = Math.random() < 0.18;
        lid.animate(dbl ? [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0.08)', offset: 0.18 }, { transform: 'scaleY(1)', offset: 0.42 }, { transform: 'scaleY(0.1)', offset: 0.62 }, { transform: 'scaleY(1)' }]
                        : [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0.08)', offset: 0.4 }, { transform: 'scaleY(1)' }], { duration: dbl ? 420 : 160 + Math.random() * 70, easing: 'ease-in-out' });
        setTimeout(blink, 1000 + Math.random() * 4000);
      })();
    }
  }
  window.PhymlLogo = { live: live, palettes: PALETTES, setPalette: setPalette, get palette() { return pal; } };
})();
