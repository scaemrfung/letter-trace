/*
  Shared page logic for the Letter Trace pages (letters, numbers, spelling):
  boards, finger / Apple Pencil ink, guide drawing, Show me, 1 2 3 steps toggle,
  and the "I traced it" check. Needs tracekit.js first.
*/

/* ===== Tracing check settings (easy to change, used by every page) =====
   Distances are a share of the letter height (top line to baseline), so they
   grow and shrink with the screen. */
const TRACE_RULES = {
  inkOnLineMin: 0.85,      // at least 85% of what the child draws must be on the letter
  inkTolerance: 0.11,      // "on the letter" = within 11% of letter height of a stroke's centre, plus half the pen width
  coverageMin: 0.80,       // at least 80% of the letter must be traced
  strokeCoverageMin: 0.75, // and every stroke (each line, curve or dot) at least 75%
  coverRadius: 0.08,       // a part of the letter counts as traced when ink comes this close
  orderCheck: "hint"       // "off", "hint" (friendly tip, still earns the dot) or "strict" (wrong order = try again)
};
const MESSAGES = {
  empty: "Trace the letter first! ✏️",
  off: "Try again, stay on the line! 🙂",
  partial: "Almost! Trace the whole letter. 🙂",
  order: "Try again! Start at 1 and follow the arrows. 🙂",
  pass: "Great tracing! ⭐",
  passHint: "Great tracing! ⭐<small>Next time, start at 1 and follow the arrows.</small>"
};

const TracePage = (function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const state = {
    color: "#2f6fed",
    size: 16,
    style: "dotted",
    numbers: localStorage.getItem("letterTraceNumbers") !== "0"
  };
  const boards = Array.from(document.querySelectorAll(".board")).map(el => {
    const canvas = el.querySelector("canvas:not(.guide-canvas)"), guide = el.querySelector(".guide-canvas");
    return { el, canvas, guide, ctx: canvas.getContext("2d"), gctx: guide.getContext("2d"),
      strokes: [], current: null, pointer: null, fig: null, T: null, placed: [], feedback: null };
  });
  let cfg = { texts: () => [], render: null, onPass: null, message: null, layout: null };
  const visible = () => boards.filter(b => !b.el.hidden);

  let dotPattern = null;
  function dots(ctx) {
    if (dotPattern) return dotPattern;
    const c = document.createElement("canvas");
    c.width = 14; c.height = 14;
    const g = c.getContext("2d");
    g.fillStyle = "#7f9dba";
    g.beginPath(); g.arc(2, 2, 1.8, 0, Math.PI * 2); g.fill();
    dotPattern = ctx.createPattern(c, "repeat");
    return dotPattern;
  }

  // Centre of the top line and baseline inside a board, so guides sit exactly on the drawn lines.
  function linePx(boardEl) {
    const br = boardEl.getBoundingClientRect();
    const y = cls => {
      const r = boardEl.querySelector(".rule." + cls);
      return r.getBoundingClientRect().top - br.top + parseFloat(getComputedStyle(r).borderTopWidth) / 2;
    };
    return { topPx: y("top"), basePx: y("base") };
  }

  function drawGuide(board, text) {
    const canvas = board.guide;
    const rect = board.el.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    board.gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // The guide is drawn from stroke data, so numbers, arrows and the check line up on every device.
    board.fig = TraceKit.compose(text);
    board.T = cfg.layout ? cfg.layout(board, board.fig, rect)
      : TraceKit.layout(board.fig, rect.width, rect.height, Object.assign({ maxWidth: 0.84 }, linePx(board.el)));
    board.placed = TraceKit.place(board.fig, board.T);
    paintGuide(board);
  }

  function paintGuide(board, opts) {
    const ctx = board.gctx, T = board.T;
    if (!T) return;
    ctx.clearRect(0, 0, T.w, T.h);
    if (document.body.classList.contains("noguide")) return;
    TraceKit.drawGuide(ctx, board.placed, T, { style: state.style, pattern: dots(ctx) });
    if (state.numbers && !(opts && opts.noNumbers)) TraceKit.drawOrder(ctx, board.placed, T);
  }

  let stopShows = [];
  function stopShow() {
    stopShows.forEach(f => f());
    stopShows = [];
    $("showBtn").classList.remove("playing");
    boards.forEach(b => paintGuide(b));
  }
  function showMe() {
    stopShow();
    const active = visible();
    let left = active.length;
    $("showBtn").classList.add("playing");
    active.forEach(b => {
      stopShows.push(TraceKit.animate(b.gctx, b.placed, b.T, {
        drawBase: () => paintGuide(b, { noNumbers: true }),
        onDone: () => {
          paintGuide(b);
          if (--left === 0) { stopShows = []; $("showBtn").classList.remove("playing"); }
        }
      }));
    });
  }

  let toastTimer = 0;
  function toast(html, kind) {
    const t = $("toast");
    t.innerHTML = html;
    t.className = "toast show " + (kind || "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = "toast " + (kind || ""); }, 2600);
  }

  function resize() {
    stopShows.forEach(f => f());
    stopShows = [];
    $("showBtn").classList.remove("playing");
    const texts = cfg.texts();
    boards.forEach((b, i) => {
      if (b.el.hidden) return;
      const rect = b.el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      b.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      b.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      b.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      b.feedback = null;
      drawGuide(b, texts[i] || "");
      redraw(b);
    });
  }

  function redraw(b) {
    const rect = b.canvas.getBoundingClientRect();
    b.ctx.clearRect(0, 0, rect.width, rect.height);
    b.strokes.forEach(s => paint(b.ctx, s));
    if (b.current) paint(b.ctx, b.current);
    if (b.feedback && b.T) TraceKit.drawFeedback(b.ctx, b.feedback, b.T);
  }

  function paint(ctx, stroke) {
    if (!stroke.points.length) return;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length - 1; i++) {
      const midX = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
      const midY = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
      ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, midX, midY);
    }
    const last = stroke.points[stroke.points.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }

  function pos(board, e) {
    const r = board.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  boards.forEach(board => {
    const c = board.canvas;
    c.addEventListener("pointerdown", e => {
      if (board.pointer !== null) return;
      c.setPointerCapture(e.pointerId);
      board.pointer = e.pointerId;
      board.feedback = null;
      board.current = { color: state.color, size: state.size, points: [pos(board, e)] };
      redraw(board);
    });
    c.addEventListener("pointermove", e => {
      if (e.pointerId !== board.pointer || !board.current) return;
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      events.forEach(ev => board.current.points.push(pos(board, ev)));
      redraw(board);
    });
    const end = e => {
      if (e.pointerId !== board.pointer) return;
      if (board.current && board.current.points.length) board.strokes.push(board.current);
      board.current = null;
      board.pointer = null;
      redraw(board);
    };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
  });

  function clearAll() {
    boards.forEach(b => { b.strokes = []; b.current = null; b.feedback = null; });
    const t = $("toast");
    if (t) t.classList.remove("show");
  }

  // Only award the green dot when every visible board was traced on the line.
  function check() {
    const results = visible().map(b => {
      const r = TraceKit.check(b.placed, b.T, b.strokes, TRACE_RULES);
      b.feedback = r.pass ? null : r;
      redraw(b);
      return r;
    });
    const order = ["off", "partial", "order", "empty"];
    const failed = results.filter(r => !r.pass).sort((a, b) => order.indexOf(a.reason) - order.indexOf(b.reason));
    return { pass: !failed.length, reason: failed.length ? failed[0].reason : null, hint: results.some(r => r.hint), results };
  }

  function burst() {
    const box = $("burst");
    box.innerHTML = "";
    for (let i = 0; i < 14; i++) {
      const s = document.createElement("div");
      s.className = "star";
      s.textContent = i % 2 ? "★" : "✦";
      s.style.left = (20 + Math.random() * 60) + "%";
      s.style.top = (40 + Math.random() * 30) + "%";
      s.style.color = ["#2f6fed", "#e36b4f", "#1f9d62", "#f0a202"][i % 4];
      box.appendChild(s);
    }
  }

  const refresh = () => (cfg.render ? cfg.render() : resize());

  function init(options) {
    cfg = Object.assign(cfg, options);
    $("guideBtn").addEventListener("click", () => {
      document.body.classList.toggle("noguide");
      $("guideBtn").classList.toggle("active");
      resize();
    });
    $("styleBtn").addEventListener("click", () => {
      state.style = state.style === "dotted" ? "solid" : "dotted";
      $("styleBtn").textContent = state.style === "dotted" ? "Solid guide" : "Dotted guide";
      refresh();
    });
    $("swatches").addEventListener("click", e => {
      const btn = e.target.closest(".swatch");
      if (!btn) return;
      state.color = btn.dataset.color;
      document.querySelectorAll(".swatch").forEach(s => s.classList.toggle("active", s === btn));
    });
    $("size").addEventListener("input", e => state.size = Number(e.target.value));
    $("clear").addEventListener("click", () => { clearAll(); resize(); });
    $("undo").addEventListener("click", () => {
      boards.forEach(b => { if (b.strokes.length) b.strokes.pop(); b.feedback = null; redraw(b); });
    });
    $("showBtn").addEventListener("click", () => { if (stopShows.length) stopShow(); else showMe(); });
    const numBtn = $("numBtn");
    numBtn.classList.toggle("active", state.numbers);
    numBtn.setAttribute("aria-pressed", String(state.numbers));
    numBtn.addEventListener("click", () => {
      state.numbers = !state.numbers;
      localStorage.setItem("letterTraceNumbers", state.numbers ? "1" : "0");
      numBtn.classList.toggle("active", state.numbers);
      numBtn.setAttribute("aria-pressed", String(state.numbers));
      if (!stopShows.length) boards.forEach(b => paintGuide(b));
    });
    $("done").addEventListener("click", () => {
      const result = check();
      window.lastTraceCheck = result;
      if (!result.pass) {
        toast((cfg.message && cfg.message(result)) || MESSAGES[result.reason] || MESSAGES.off, "oops");
        return;
      }
      toast(result.hint ? MESSAGES.passHint : MESSAGES.pass, "yay");
      if (cfg.onPass) cfg.onPass(result);
      burst();
    });
    window.addEventListener("resize", resize);
  }

  return { state, boards, init, resize, redraw, paintGuide, showMe, stopShow, toast, burst, check, clearAll, linePx };
})();
