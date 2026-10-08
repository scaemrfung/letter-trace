/* Names, today's set, sound, and the finished screen. Shared by every page. */
const ClassKit = (function () {
  "use strict";
  const NAMES = "letterTraceNames";
  const WHO = "letterTraceWho";
  const SOUND = "letterTraceSound";
  const PROGRESS_KEYS = ["letterTraceProgress", "numberTraceProgress", "spellingProgress"];
  let onChange = function () {};
  let finishCopy = { title: "You traced them", body: "" };

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || ""); }
    catch (e) { return null; }
  }

  function names() {
    const n = read(NAMES);
    return Array.isArray(n) ? n.filter(s => typeof s === "string" && s) : [];
  }

  function who() {
    const list = names();
    if (!list.length) return "";
    const w = localStorage.getItem(WHO) || "";
    return list.indexOf(w) >= 0 ? w : list[0];
  }

  function label() { return who() || "Everyone"; }

  function isBag(data) {
    return !!data && typeof data === "object" && !Array.isArray(data) &&
      Object.keys(data).every(k => data[k] && typeof data[k] === "object" && !Array.isArray(data[k]));
  }

  function bag(key) {
    let data = read(key);
    if (!data || typeof data !== "object" || Array.isArray(data)) data = {};
    if (!isBag(data)) data = { "": data };
    const name = who();
    if (!data[name] || typeof data[name] !== "object") data[name] = {};
    return data;
  }

  function mine(key) { return bag(key)[who()]; }

  function saveMine(key, progress) {
    const data = bag(key);
    data[who()] = progress;
    localStorage.setItem(key, JSON.stringify(data));
  }

  function parseNames(text) {
    const out = [];
    String(text || "").split(/[\n,;]+/).forEach(raw => {
      const clean = raw.replace(/[^A-Za-z0-9 '\-]/g, "").replace(/\s+/g, " ").trim().slice(0, 16);
      if (clean && !out.some(n => n.toLowerCase() === clean.toLowerCase())) out.push(clean);
    });
    return out.slice(0, 40);
  }

  function saveNames(list) {
    const prev = names();
    localStorage.setItem(NAMES, JSON.stringify(list));
    if (!prev.length && list.length) {
      PROGRESS_KEYS.forEach(key => {
        const data = bag(key);
        if (data[""] && Object.keys(data[""]).length) {
          data[list[0]] = Object.assign({}, data[""], data[list[0]] || {});
          delete data[""];
          localStorage.setItem(key, JSON.stringify(data));
        }
      });
    }
    if (!list.length) localStorage.removeItem(WHO);
    else if (list.indexOf(localStorage.getItem(WHO)) < 0) localStorage.setItem(WHO, list[0]);
    paint();
    onChange();
  }

  function today(key) {
    const items = String(localStorage.getItem(key) || "").split(",").map(s => s.trim()).filter(Boolean);
    return items.length ? items : null;
  }

  function saveToday(key, items) {
    if (!items || !items.length) localStorage.removeItem(key);
    else localStorage.setItem(key, items.join(","));
    onChange();
  }

  function soundOn() { return localStorage.getItem(SOUND) === "1"; }

  function speak(text) {
    if (!soundOn() || !window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    u.lang = "en-CA";
    window.speechSynthesis.speak(u);
  }

  function hold(button, onHold, hint) {
    let timer = 0, held = false;
    button.addEventListener("contextmenu", e => e.preventDefault());
    button.addEventListener("pointerdown", () => {
      held = false;
      clearTimeout(timer);
      timer = setTimeout(() => { held = true; onHold(); }, 700);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(ev => button.addEventListener(ev, () => {
      clearTimeout(timer);
      if (ev === "pointerup" && !held && hint) TracePage.toast(hint);
    }));
    button.addEventListener("click", e => { if (e.detail === 0) onHold(); });
  }

  function dialog(title, bodyNode, actions) {
    const overlay = document.createElement("div");
    overlay.className = "clear-dots";
    const card = document.createElement("div");
    card.className = "clear-dots-card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    const heading = document.createElement("h2");
    heading.textContent = title;
    const note = document.createElement("p");
    note.textContent = bodyNode;
    card.append(heading, note);
    if (actions.before) card.appendChild(actions.before);
    const row = document.createElement("div");
    row.className = "row";
    actions.buttons.forEach(spec => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = spec.label;
      if (spec.className) b.className = spec.className;
      b.addEventListener("click", () => { if (spec.run() !== false) overlay.remove(); });
      row.appendChild(b);
    });
    card.appendChild(row);
    overlay.appendChild(card);
    overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    return overlay;
  }

  function showFinish() {
    dialog(finishCopy.title, finishCopy.body, { buttons: [{ label: "Close", run: function () {} }] });
    if (window.TracePage && TracePage.burst) TracePage.burst();
  }

  function setFinished(on, copy) {
    if (copy) finishCopy = copy;
    const b = document.getElementById("finishedBtn");
    if (b) b.hidden = !on;
  }

  function paint() {
    const row = document.getElementById("kids");
    if (!row) return;
    row.innerHTML = "";
    const list = names();
    const current = who();
    (list.length ? list : ["Everyone"]).forEach(name => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = name;
      const selected = list.length ? name === current : true;
      b.classList.toggle("active", selected);
      if (list.length) b.addEventListener("click", () => {
        localStorage.setItem(WHO, name);
        paint();
        onChange();
      });
      row.appendChild(b);
    });
    const sound = document.getElementById("soundBtn");
    if (sound) {
      sound.textContent = soundOn() ? "Sound on" : "Sound off";
      sound.classList.toggle("active", soundOn());
    }
  }

  function openNames() {
    const box = document.createElement("textarea");
    box.value = names().join("\n");
    box.setAttribute("aria-label", "Children's names");
    dialog("Children's names", "One name on each line. Press and hold Names so children don't change the list.", {
      before: box,
      buttons: [
        { label: "Cancel", run: function () {} },
        { label: "Save names", className: "good", run: function () { saveNames(parseNames(box.value)); } }
      ]
    });
    box.focus();
  }

  function openToday(spec) {
    const picked = new Set((today(spec.key) || []).map(spec.norm));
    const grid = document.createElement("div");
    grid.className = "choice-grid";
    spec.choices.forEach(choice => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = choice;
      const on = picked.has(spec.norm(choice));
      b.classList.toggle("active", on);
      b.addEventListener("click", () => b.classList.toggle("active"));
      grid.appendChild(b);
    });
    dialog(spec.title, "Pick a few, or leave them all on to show the whole set.", {
      before: grid,
      buttons: [
        { label: "Cancel", run: function () {} },
        { label: "All", run: function () { saveToday(spec.key, null); } },
        {
          label: "Save",
          className: "good",
          run: function () {
            const chosen = Array.from(grid.querySelectorAll("button.active")).map(b => spec.norm(b.textContent));
            saveToday(spec.key, chosen.length === spec.choices.length ? null : chosen);
          }
        }
      ]
    });
  }

  function mount(opts) {
    onChange = opts.onChange || function () {};
    const bar = document.createElement("div");
    bar.className = "classbar";
    bar.innerHTML = '<div class="kids" id="kids"></div><div class="seg" id="classTools"></div>';
    const tools = bar.querySelector("#classTools");
    const sound = document.createElement("button");
    sound.id = "soundBtn";
    sound.type = "button";
    sound.addEventListener("click", () => {
      localStorage.setItem(SOUND, soundOn() ? "0" : "1");
      paint();
    });
    const namesBtn = document.createElement("button");
    namesBtn.id = "namesBtn";
    namesBtn.type = "button";
    namesBtn.textContent = "Names";
    hold(namesBtn, openNames, "Teachers: press and hold to edit names");
    tools.append(sound, namesBtn);
    if (opts.today) {
      const todayBtn = document.createElement("button");
      todayBtn.type = "button";
      todayBtn.textContent = "Today";
      hold(todayBtn, () => openToday(opts.today), "Teachers: press and hold to pick today's set");
      tools.appendChild(todayBtn);
    }
    const done = document.createElement("button");
    done.id = "finishedBtn";
    done.type = "button";
    done.className = "good";
    done.textContent = "Finished";
    done.hidden = true;
    done.addEventListener("click", showFinish);
    tools.appendChild(done);
    document.querySelector("header").insertAdjacentElement("afterend", bar);
    paint();
  }

  return { who, label, mine, saveMine, today, saveToday, saveNames, speak, hold, mount, setFinished, showFinish };
})();
