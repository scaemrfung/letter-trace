/*
  TraceKit: shared tracing logic for the Letter Trace pages.
  - Stroke data for every letter (manuscript / ball-and-stick stroke order)
  - Drawing the guide letter, numbered start dots and direction arrows
  - "Show me" stroke animation
  - Accuracy check (stayed on the line + traced the whole letter + order hint)

  Reuse: load this file, then TraceKit.compose("cat") gives a figure for a word,
  TraceKit.layout(...) fits it to a board, TraceKit.place(...) turns it into pixels.
  New shapes (digits 0-9, etc.) go in GLYPHS using the same helpers.

  Letter units: y 0 = top line, 50 = middle line, 100 = baseline, ~141 = tail line.
  x is centred on 0. Arc angles are in degrees, 0 = 3 o'clock, -90 = 12 o'clock,
  and going from a bigger to a smaller angle runs counter-clockwise on screen.
*/
(function (global) {
  "use strict";

  const DEFAULTS = {
    guideWidth: 12,          // thickness of the guide letter, letter units (top line to baseline = 100)
    inkTolerance: 0.11,      // ink is "on the line" within this share of letter height from a stroke's centre (+ half the pen width)
    inkOnLineMin: 0.85,      // share of drawn ink that must be on the line
    coverRadius: 0.08,       // a spot on the letter counts as traced when ink comes this close (share of letter height, + half the pen width)
    coverageMin: 0.80,       // share of the whole letter that must be traced
    strokeCoverageMin: 0.75, // every single stroke (line, curve or dot) must be at least this traced
    orderCheck: "hint",      // "off" | "hint" (friendly tip, still passes) | "strict" (wrong order or direction fails)
    animSpeed: 150,          // Show me speed, letter units per second
    animPause: 380           // Show me pause between strokes, ms
  };
  const COLORS = ["#e36b4f", "#2f6fed", "#1f9d62", "#7a4de0", "#d9480f", "#0b7285"];

  /* ---------- shape helpers (letter units) ---------- */
  function L() { const a = arguments, p = []; for (let i = 0; i < a.length; i += 2) p.push([a[i], a[i + 1]]); return p; }
  function A(cx, cy, rx, ry, a0, a1) {
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 4)), p = [];
    for (let i = 0; i <= n; i++) {
      const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
      p.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
    }
    return p;
  }
  function P() {
    const out = [];
    for (const part of arguments) for (const q of part) {
      const l = out[out.length - 1];
      if (!l || Math.hypot(l[0] - q[0], l[1] - q[1]) > 0.01) out.push(q);
    }
    return out;
  }
  function D(x, y) { return { dot: [x, y] }; }

  // Each letter = list of strokes in the order they are written.
  // A stroke is a list of points (drawn in that direction) or a dot.
  const GLYPHS = {
    A: [L(0, 0, -40, 100), L(0, 0, 40, 100), L(-24, 60, 24, 60)],
    B: [L(-30, 0, -30, 100),
        P(L(-30, 0, 5, 0), A(5, 25, 25, 25, -90, 90), L(5, 50, -30, 50)),
        P(L(-30, 50, 8, 50), A(8, 75, 28, 25, -90, 90), L(8, 100, -30, 100))],
    C: [A(0, 50, 45, 50, -45, -315)],
    D: [L(-35, 0, -35, 100), P(L(-35, 0, -5, 0), A(-5, 50, 40, 50, -90, 90), L(-5, 100, -35, 100))],
    E: [L(-30, 0, -30, 100), L(-30, 0, 30, 0), L(-30, 50, 20, 50), L(-30, 100, 30, 100)],
    F: [L(-28, 0, -28, 100), L(-28, 0, 30, 0), L(-28, 50, 20, 50)],
    G: [A(0, 50, 45, 50, -45, -354), L(44.8, 55, 12, 55)],
    H: [L(-32, 0, -32, 100), L(32, 0, 32, 100), L(-32, 50, 32, 50)],
    I: [L(0, 0, 0, 100), L(-20, 0, 20, 0), L(-20, 100, 20, 100)],
    J: [P(L(20, 0, 20, 72), A(-2, 72, 22, 28, 0, 170))],
    K: [L(-28, 0, -28, 100), L(28, 0, -28, 55, 30, 100)],
    L: [L(-25, 0, -25, 100, 28, 100)],
    M: [L(-40, 0, -40, 100), L(-40, 0, 0, 70, 40, 0, 40, 100)],
    N: [L(-32, 0, -32, 100), L(-32, 0, 32, 100, 32, 0)],
    O: [A(0, 50, 47, 50, -90, -450)],
    P: [L(-30, 0, -30, 100), P(L(-30, 0, 5, 0), A(5, 27, 27, 27, -90, 90), L(5, 54, -30, 54))],
    Q: [A(0, 50, 47, 50, -90, -450), L(14, 70, 40, 100)],
    R: [L(-30, 0, -30, 100), P(L(-30, 0, 5, 0), A(5, 26, 26, 26, -90, 90), L(5, 52, -30, 52), L(-30, 52, 32, 100))],
    S: [P(A(0, 25, 30, 25, -30, -270), A(0, 75, 33, 25, -90, 150))],
    T: [L(0, 0, 0, 100), L(-35, 0, 35, 0)],
    U: [P(L(-32, 0, -32, 68), A(0, 68, 32, 32, 180, 0), L(32, 68, 32, 0))],
    V: [L(-38, 0, 0, 100, 38, 0)],
    W: [L(-48, 0, -24, 100, 0, 0, 24, 100, 48, 0)],
    X: [L(-35, 0, 35, 100), L(35, 0, -35, 100)],
    Y: [L(-35, 0, 0, 50), L(35, 0, 0, 50, 0, 100)],
    Z: [L(-32, 0, 32, 0, -32, 100, 32, 100)],

    a: [A(-2, 75, 24, 25, -40, -400), L(22, 50, 22, 100)],
    b: [L(-22, 0, -22, 100), A(2, 75, 24, 25, 180, 540)],
    c: [A(0, 75, 24, 25, -40, -320)],
    d: [A(-2, 75, 24, 25, -40, -400), L(22, 0, 22, 100)],
    e: [P(L(-24, 75, 24, 75), A(0, 75, 24, 25, 0, -320))],
    f: [P(A(15, 15, 17, 15, -30, -180), L(-2, 15, -2, 100)), L(-20, 50, 18, 50)],
    g: [A(-2, 75, 24, 25, -40, -400), P(L(22, 50, 22, 118), A(2, 118, 20, 22, 0, 165))],
    h: [L(-22, 0, -22, 100), P(A(0, 73, 22, 23, 180, 360), L(22, 73, 22, 100))],
    i: [L(0, 50, 0, 100), D(0, 30)],
    j: [P(L(8, 50, 8, 120), A(-10, 120, 18, 20, 0, 165)), D(8, 30)],
    k: [L(-20, 0, -20, 100), L(20, 50, -20, 78, 22, 100)],
    l: [L(0, 0, 0, 100)],
    m: [L(-36, 50, -36, 100), P(A(-18, 70, 18, 20, 180, 360), L(0, 70, 0, 100)), P(A(18, 70, 18, 20, 180, 360), L(36, 70, 36, 100))],
    n: [L(-22, 50, -22, 100), P(A(0, 72, 22, 22, 180, 360), L(22, 72, 22, 100))],
    o: [A(0, 75, 25, 25, -90, -450)],
    p: [L(-22, 50, -22, 140), A(2, 75, 24, 25, 180, 540)],
    q: [A(-2, 75, 24, 25, -40, -400), P(L(22, 50, 22, 130), A(32, 130, 10, 10, 180, 90), L(32, 140, 40, 134))],
    r: [L(-16, 50, -16, 100), A(4, 70, 20, 20, 180, 315)],
    s: [P(A(0, 62.5, 18, 12.5, -30, -270), A(0, 87.5, 20, 12.5, -90, 150))],
    t: [L(0, 10, 0, 100), L(-20, 50, 20, 50)],
    u: [P(L(-22, 50, -22, 78), A(0, 78, 22, 22, 180, 0), L(22, 78, 22, 50)), L(22, 50, 22, 100)],
    v: [L(-24, 50, 0, 100, 24, 50)],
    w: [L(-36, 50, -18, 100, 0, 50, 18, 100, 36, 50)],
    x: [L(-22, 50, 22, 100), L(22, 50, -22, 100)],
    y: [L(-22, 50, 0, 100), L(22, 50, -18, 140)],
    z: [L(-22, 50, 22, 50, -22, 100, 22, 100)]
  };

  /* ---------- geometry ---------- */
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function densify(pts, step) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(dist(a, b) / step));
      for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    return out;
  }
  function glyphBox(g) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    g.forEach(st => (st.dot ? [st.dot] : st).forEach(p => {
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
    }));
    return { minX, maxX, minY, maxY };
  }

  // Glyph data is drawn on the line centres (0 top, 50 middle, 100 base). The guide has a
  // thickness, so fitToLines() pulls the centre-line in by half that thickness: the visible
  // edge of capitals, digits and tall letters then sits exactly on the top line and baseline,
  // and the body of short letters exactly between the middle line and baseline.
  // Tails (g j p q y) go below the baseline but stay above the tail line.
  function fitToLines(p, lower, W) {
    const ku = (100 - W) / 100, kl = (50 - W) / 50, kd = 0.9, x = p[0], y = p[1];
    if (!lower) return [x * ku, W / 2 + y * ku];
    let fy;
    if (y <= 50) fy = W / 2 + y;                       // tall part of b d f h k l t, i/j dots
    else if (y <= 100) fy = 50 + W / 2 + (y - 50) * kl; // body: middle line to baseline
    else fy = 100 - W / 2 + (y - 100) * kd;            // tail under the baseline
    return [x * kl, fy];
  }

  // Build a figure (one letter or a whole word) in line units.
  function compose(text, opts) {
    opts = opts || {};
    const gap = opts.gap != null ? opts.gap : 26, space = opts.space != null ? opts.space : 50;
    const W = opts.guideWidth || DEFAULTS.guideWidth;
    const strokes = [], letters = [];
    let x = 0, li = 0;
    for (const ch of String(text)) {
      if (ch === " ") { x += space; continue; }
      const g = GLYPHS[ch];
      if (!g) continue;
      const lower = /[a-z]/.test(ch);
      const fg = opts.fit === false ? g : g.map(st => st.dot ? { dot: fitToLines(st.dot, lower, W) } : st.map(p => fitToLines(p, lower, W)));
      const b = glyphBox(fg), dx = x - b.minX;
      fg.forEach((st, k) => {
        const pts = st.dot ? [[st.dot[0] + dx, st.dot[1]]] : densify(st.map(p => [p[0] + dx, p[1]]), 2);
        strokes.push({ pts, dot: !!st.dot, num: k + 1, letter: li, char: ch });
      });
      letters.push({ char: ch, minX: x, maxX: x + b.maxX - b.minX });
      x += b.maxX - b.minX + gap;
      li++;
    }
    const box = glyphBox(strokes.map(s => s.pts));
    return Object.assign({ text: String(text), strokes, letters }, box);
  }

  // Fit a figure to a board: rules are fractions of board height (matches the CSS lines).
  function layout(fig, w, h, opts) {
    opts = opts || {};
    const top = opts.top != null ? opts.top : 0.18, base = opts.base != null ? opts.base : 0.66;
    const topPx = opts.topPx != null ? opts.topPx : h * top, basePx = opts.basePx != null ? opts.basePx : h * base;
    let s = opts.scale || (basePx - topPx) / 100, oy = topPx, sx = s;
    // Too wide for a narrow board (e.g. W in portrait "Both")? Make it a bit narrower so it
    // still fits the lines; only if that isn't enough, shrink it while keeping it on the baseline.
    if (opts.maxWidth && isFinite(fig.minX)) {
      const span = fig.maxX - fig.minX + (opts.pad != null ? opts.pad : DEFAULTS.guideWidth);
      const fit = opts.maxWidth * w / span;
      if (fit < s) {
        sx = Math.max(fit, s * 0.72);
        if (fit < sx) { s = fit / 0.72; sx = fit; oy = basePx - 100 * s; }
      }
    }
    const cx = isFinite(fig.minX) ? (fig.minX + fig.maxX) / 2 : 0;
    const ox = w / 2 - cx * sx;
    return { s, sx, cap: 100 * s, ox, oy, w, h, pt: p => [ox + p[0] * sx, oy + p[1] * s] };
  }

  // Figure -> pixel strokes with arc lengths.
  function place(fig, T) {
    return fig.strokes.map((st, i) => {
      const px = st.pts.map(T.pt), cum = [0];
      for (let k = 1; k < px.length; k++) cum.push(cum[k - 1] + dist(px[k - 1], px[k]));
      const len = cum[cum.length - 1];
      return Object.assign({}, st, { px, cum, len, index: i,
        closed: !st.dot && dist(px[0], px[px.length - 1]) < 0.08 * T.cap });
    });
  }
  function pointAt(st, d) {
    d = Math.max(0, Math.min(st.len, d));
    let k = 1;
    while (k < st.px.length - 1 && st.cum[k] < d) k++;
    const a = st.px[k - 1], b = st.px[k] || a, seg = (st.cum[k] - st.cum[k - 1]) || 1;
    const t = Math.max(0, Math.min(1, (d - st.cum[k - 1]) / seg));
    return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, ang: Math.atan2(b[1] - a[1], b[0] - a[0]), k };
  }
  function strokePath(ctx, st, upto) {
    const end = upto == null ? st.len : upto;
    ctx.moveTo(st.px[0][0], st.px[0][1]);
    for (let k = 1; k < st.px.length && st.cum[k] <= end; k++) ctx.lineTo(st.px[k][0], st.px[k][1]);
    if (end < st.len) { const p = pointAt(st, end); ctx.lineTo(p.x, p.y); }
  }
  const colorOf = st => COLORS[(st.num - 1) % COLORS.length];

  /* ---------- drawing ---------- */
  function guidePath(ctx, placed) {
    ctx.beginPath();
    placed.forEach(st => {
      if (st.dot) { const p = st.px[0]; ctx.moveTo(p[0] - 0.4, p[1]); ctx.lineTo(p[0] + 0.4, p[1]); }
      else strokePath(ctx, st);
    });
  }
  function drawGuide(ctx, placed, T, opts) {
    opts = opts || {};
    const cfg = Object.assign({}, DEFAULTS, opts.cfg), W = cfg.guideWidth * T.s;
    ctx.save();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    guidePath(ctx, placed);
    if (opts.style === "solid") {
      // Outline stays inside the guide thickness so nothing pokes past the lines.
      ctx.strokeStyle = "#a8bacd"; ctx.lineWidth = W; ctx.stroke();
      ctx.strokeStyle = "#d9e3ec"; ctx.lineWidth = Math.max(2, W - 2 * Math.max(1.5, W * 0.07)); ctx.stroke();
    } else {
      ctx.strokeStyle = "rgba(126, 160, 196, 0.13)"; ctx.lineWidth = W; ctx.stroke();
      if (opts.pattern) { ctx.strokeStyle = opts.pattern; ctx.stroke(); }
    }
    ctx.restore();
  }
  function arrowHead(ctx, x, y, ang, a, color) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-a, -a * 0.62); ctx.lineTo(-a * 0.72, 0); ctx.lineTo(-a, a * 0.62); ctx.closePath();
    ctx.fillStyle = color; ctx.strokeStyle = "white"; ctx.lineWidth = Math.max(1.5, a * 0.14); ctx.lineJoin = "round";
    ctx.stroke(); ctx.fill();
    ctx.restore();
  }
  function badgeRadius(T) { return Math.max(12, Math.min(22, T.cap * 0.065)); }
  function drawBadge(ctx, x, y, r, n, color) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r + 2.5, 0, Math.PI * 2); ctx.fillStyle = "white"; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    ctx.fillStyle = "white"; ctx.font = "800 " + Math.round(r * 1.25) + "px 'Avenir Next', Nunito, system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(n), x, y + r * 0.06);
    ctx.restore();
  }
  // Numbered start dots + direction arrows for every stroke.
  function drawOrder(ctx, placed, T) {
    const r = badgeRadius(T), lw = Math.max(2.5, T.cap * 0.012), a = Math.max(11, T.cap * 0.055);
    ctx.save();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    placed.forEach(st => {
      if (st.dot) return;
      const col = colorOf(st);
      ctx.beginPath(); strokePath(ctx, st);
      ctx.setLineDash([lw * 2.4, lw * 2.2]); ctx.strokeStyle = col; ctx.globalAlpha = 0.9; ctx.lineWidth = lw; ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      // Closed shapes (o, a's circle) get arrows part way round so they don't sit on the start or on the next stroke.
      const marks = st.closed ? [0.3, 0.72] : st.len > T.cap * 0.9 ? [0.5, 1] : [1];
      marks.forEach(f => {
        let d = f * st.len;
        if (f < 1) d += a / 2;
        const p = pointAt(st, d), q = pointAt(st, d - Math.min(a, st.len * 0.2));
        arrowHead(ctx, p.x, p.y, Math.atan2(p.y - q.y, p.x - q.x), a, col);
      });
    });
    // Badges last so they sit on top. Shared start points get nudged apart,
    // with a small line back to the real start.
    const spots = [];
    const clash = p => spots.some(o => Math.hypot(o.x - p.x, o.y - p.y) < 2.05 * r);
    const badges = placed.map(st => {
      const s0 = { x: st.px[0][0], y: st.px[0][1] };
      let pos = s0;
      if (clash(s0)) {
        const ahead = st.dot ? { x: s0.x, y: s0.y - 1 } : pointAt(st, Math.min(st.len, r));
        const back = Math.atan2(s0.y - ahead.y, s0.x - ahead.x);
        for (const t of [0, 45, -45, 90, -90, 135, -135, 180]) {
          const ang = back + t * Math.PI / 180, c = { x: s0.x + Math.cos(ang) * 2.2 * r, y: s0.y + Math.sin(ang) * 2.2 * r };
          if (!clash(c)) { pos = c; break; }
        }
      }
      spots.push(pos);
      return { st, s0, pos, col: colorOf(st) };
    });
    badges.forEach(b => {
      if (b.pos === b.s0) return;
      ctx.beginPath(); ctx.moveTo(b.s0.x, b.s0.y); ctx.lineTo(b.pos.x, b.pos.y);
      ctx.strokeStyle = b.col; ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath(); ctx.arc(b.s0.x, b.s0.y, r * 0.42, 0, Math.PI * 2); ctx.fillStyle = b.col; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = "white"; ctx.stroke();
    });
    badges.forEach(b => drawBadge(ctx, b.pos.x, b.pos.y, r, b.st.num, b.col));
    ctx.restore();
  }

  // Animate the strokes in order. drawBase() repaints the guide each frame. Returns a stop function.
  function animate(ctx, placed, T, opts) {
    opts = opts || {};
    const cfg = Object.assign({}, DEFAULTS, opts.cfg);
    const W = cfg.guideWidth * T.s, perMs = cfg.animSpeed * T.s / 1000, r = badgeRadius(T);
    let t = 0;
    const segs = placed.map(st => { const dur = st.dot ? 260 : Math.max(250, st.len / perMs), s = { st, t0: t, t1: t + dur }; t += dur + cfg.animPause; return s; });
    const total = t + 400, start = performance.now();
    let raf = 0, stopped = false;
    function frame(now) {
      if (stopped) return;
      const el = now - start;
      if (opts.drawBase) opts.drawBase();
      ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
      segs.forEach(sg => {
        if (el < sg.t0) return;
        const f = Math.min(1, (el - sg.t0) / (sg.t1 - sg.t0)), col = colorOf(sg.st);
        if (sg.st.dot) {
          const p = sg.st.px[0];
          ctx.beginPath(); ctx.arc(p[0], p[1], W * 0.42 * f, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
        } else {
          ctx.beginPath(); strokePath(ctx, sg.st, sg.st.len * f);
          ctx.strokeStyle = col; ctx.lineWidth = W * 0.55; ctx.stroke();
          if (f < 1) {
            const h = pointAt(sg.st, sg.st.len * f);
            ctx.beginPath(); ctx.arc(h.x, h.y, W * 0.48, 0, Math.PI * 2);
            ctx.fillStyle = "white"; ctx.fill(); ctx.lineWidth = Math.max(3, W * 0.14); ctx.strokeStyle = col; ctx.stroke();
          }
        }
        if (f < 1 || el < sg.t1 + cfg.animPause) drawBadge(ctx, sg.st.px[0][0], sg.st.px[0][1], r, sg.st.num, col);
      });
      ctx.restore();
      if (el < total) raf = requestAnimationFrame(frame);
      else { if (opts.drawBase) opts.drawBase(); if (opts.onDone) opts.onDone(); }
    }
    raf = requestAnimationFrame(frame);
    return function stop() { stopped = true; cancelAnimationFrame(raf); };
  }

  /* ---------- accuracy ---------- */
  function resample(points, step) {
    if (!points.length) return [];
    const out = [points[0]];
    let prev = points[0], carry = 0;
    for (let i = 1; i < points.length; i++) {
      const p = points[i], d = Math.hypot(p.x - prev.x, p.y - prev.y);
      let pos = step - carry;
      while (pos <= d) { out.push({ x: prev.x + (p.x - prev.x) * pos / d, y: prev.y + (p.y - prev.y) * pos / d }); pos += step; }
      carry = (carry + d) % step;
      prev = p;
    }
    return out;
  }

  // drawn: [{points:[{x,y}], size}] in the same pixel space as placed.
  function check(placed, T, drawn, cfgIn) {
    const cfg = Object.assign({}, DEFAULTS, cfgIn);
    const cap = T.cap, ink = [];
    (drawn || []).forEach((s, si) => resample(s.points, 3).forEach(p => ink.push({ x: p.x, y: p.y, si, pr: (s.size || 0) / 2 })));
    const res = { pass: false, reason: null, inkOnLine: 0, coverage: 0, strokeCoverage: [], offPoints: [], missed: [],
      orderOk: true, directionOk: true, wrongWay: [], hint: false, inkCount: ink.length };
    if (!ink.length) { res.reason = "empty"; return res; }
    const gs = [];
    placed.forEach((st, gi) => st.px.forEach((p, k) => gs.push({ x: p[0], y: p[1], gi, d: st.cum[k] })));
    const tolBase = cfg.inkTolerance * cap, covBase = cfg.coverRadius * cap;

    // 1) How much of the ink is on the line?
    let on = 0;
    ink.forEach(p => {
      let best = Infinity, bg = null;
      for (const g of gs) { const d = (g.x - p.x) * (g.x - p.x) + (g.y - p.y) * (g.y - p.y); if (d < best) { best = d; bg = g; } }
      p.near = bg; p.dist = Math.sqrt(best);
      p.on = p.dist <= tolBase + p.pr;
      if (p.on) on++; else res.offPoints.push({ x: p.x, y: p.y, r: p.pr });
    });
    res.inkOnLine = on / ink.length;

    // 2) How much of the letter was traced?
    let covered = 0;
    const per = placed.map(() => ({ n: 0, c: 0 }));
    gs.forEach(g => {
      const ok = ink.some(p => Math.hypot(p.x - g.x, p.y - g.y) <= covBase + p.pr);
      per[g.gi].n++;
      if (ok) { per[g.gi].c++; covered++; } else res.missed.push({ x: g.x, y: g.y, gi: g.gi });
    });
    res.coverage = covered / gs.length;
    res.strokeCoverage = per.map(s => s.c / s.n);

    // 3) Order and direction (forgiving; a hint unless orderCheck is "strict").
    const owner = placed.map((st, gi) => {
      const counts = {};
      ink.forEach(p => { if (p.on && p.near.gi === gi) counts[p.si] = (counts[p.si] || 0) + 1; });
      let bestSi = -1, bestN = 2;
      Object.keys(counts).forEach(si => { if (counts[si] > bestN) { bestN = counts[si]; bestSi = +si; } });
      return bestSi;
    });
    let last = -1;
    owner.forEach(o => { if (o < 0) return; if (o < last) res.orderOk = false; last = Math.max(last, o); });
    placed.forEach((st, gi) => {
      if (st.dot || owner[gi] < 0) return;
      const seq = ink.filter(p => p.on && p.si === owner[gi] && p.near.gi === gi).map(p => p.near.d);
      let pos = 0, neg = 0;
      for (let k = 1; k < seq.length; k++) {
        let dd = seq[k] - seq[k - 1];
        if (st.closed) { if (dd > st.len / 2) dd -= st.len; if (dd < -st.len / 2) dd += st.len; }
        if (dd > 0) pos += dd; else neg -= dd;
      }
      if (neg > pos && neg > 0.3 * st.len) { res.directionOk = false; res.wrongWay.push(gi); }
    });

    if (res.inkOnLine < cfg.inkOnLineMin) res.reason = "off";
    else if (res.coverage < cfg.coverageMin || res.strokeCoverage.some(c => c < cfg.strokeCoverageMin)) res.reason = "partial";
    else if (cfg.orderCheck === "strict" && !(res.orderOk && res.directionOk)) res.reason = "order";
    res.pass = !res.reason;
    res.hint = res.pass && cfg.orderCheck !== "off" && !(res.orderOk && res.directionOk);
    return res;
  }

  // Show where the tracing went off (red) and which parts were missed (orange).
  function drawFeedback(ctx, res, T) {
    if (!res) return;
    ctx.save();
    ctx.fillStyle = "rgba(227, 75, 60, 0.30)";
    res.offPoints.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 5, 0, Math.PI * 2); ctx.fill(); });
    const r = Math.max(4, T.cap * 0.025);
    ctx.fillStyle = "rgba(240, 162, 2, 0.85)";
    res.missed.forEach((p, i) => { if (i % 2) return; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
  }

  global.TraceKit = { DEFAULTS, COLORS, GLYPHS, helpers: { L, A, P, D, densify }, compose, layout, place, pointAt,
    drawGuide, drawOrder, animate, check, drawFeedback, resample };
})(window);
