const DEFAULT_WORDS = ["cat", "dog", "sun", "map", "pig", "hat", "bus", "cup", "frog", "star", "book", "tree"];
const WORDS_KEY = "wordMixWords";
const DOTS_KEY = "wordMixDots";
const SOUND_KEY = "wordMixSound";

const $ = (id) => document.getElementById(id);
const state = {
  words: loadWords(),
  dots: loadDots(),
  index: 0,
  slots: [],
  bank: [],
  lock: false
};

function loadWords() {
  try {
    const saved = JSON.parse(localStorage.getItem(WORDS_KEY) || "null");
    if (Array.isArray(saved) && saved.length) return saved;
  } catch (e) {}
  return DEFAULT_WORDS.slice();
}

function loadDots() {
  try {
    const saved = JSON.parse(localStorage.getItem(DOTS_KEY) || "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch (e) {
    return {};
  }
}

function parseWords(text) {
  const out = [];
  String(text || "").split(/[\n,;]+/).forEach((raw) => {
    const clean = raw.replace(/[^A-Za-z0-9 ]/g, "").replace(/\s+/g, " ").trim().slice(0, 18);
    if (clean && !out.some((word) => word.toLowerCase() === clean.toLowerCase())) out.push(clean);
  });
  return out.slice(0, 40);
}

(function loadShared() {
  const query = new URLSearchParams(location.search).get("words");
  if (query == null) return;
  const words = parseWords(query);
  if (words.length) {
    state.words = words;
    localStorage.setItem(WORDS_KEY, JSON.stringify(words));
    state.loaded = words.length;
  }
  try { history.replaceState(null, "", location.pathname); } catch (e) {}
})();

function word() { return state.words[state.index] || ""; }

function scramble(items) {
  const mix = items.slice();
  if (mix.length < 2) return mix;
  const same = () => mix.every((item, i) => item === items[i]);
  for (let n = 0; n < 8 && same(); n++) {
    for (let i = mix.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mix[i], mix[j]] = [mix[j], mix[i]];
    }
  }
  if (same()) [mix[0], mix[1]] = [mix[1], mix[0]];
  return mix;
}

function deal() {
  state.lock = false;
  $("board").classList.remove("yes", "shake");
  const tiles = [];
  state.slots = [...word()].map((letter, i) => {
    if (letter === " ") return { space: true };
    const tile = { id: i, letter };
    tiles.push(tile);
    return { tile: null };
  });
  state.bank = scramble(tiles);
  render();
}

function place(tile) {
  if (state.lock) return;
  const slot = state.slots.find((item) => !item.space && !item.tile);
  if (!slot) return;
  slot.tile = tile;
  state.bank = state.bank.filter((item) => item !== tile);
  render();
  if (state.slots.every((item) => item.space || item.tile)) check();
}

function lift(index) {
  if (state.lock) return;
  const slot = state.slots[index];
  if (!slot || !slot.tile) return;
  state.bank.push(slot.tile);
  slot.tile = null;
  render();
}

function check() {
  const made = state.slots.map((item) => (item.space ? " " : item.tile.letter)).join("");
  if (made === word()) {
    state.lock = true;
    state.dots[word()] = 1;
    localStorage.setItem(DOTS_KEY, JSON.stringify(state.dots));
    render();
    $("board").classList.add("yes");
    toast("You made it.", true);
    burst();
    cheer();
    if (soundOn()) speak(word());
    const done = state.words.every((item) => state.dots[item]);
    window.setTimeout(() => {
      if (done) { finish(); return; }
      const start = state.index;
      for (let step = 1; step <= state.words.length; step++) {
        const next = (start + step) % state.words.length;
        if (!state.dots[state.words[next]]) { state.index = next; break; }
      }
      deal();
    }, 1100);
    return;
  }
  $("board").classList.remove("shake");
  void $("board").offsetWidth;
  $("board").classList.add("shake");
  toast("Not yet. Try again.", false);
}

function render() {
  const slots = $("slots");
  const bank = $("bank");
  slots.replaceChildren();
  bank.replaceChildren();
  state.slots.forEach((slot, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slot" + (slot.space ? " space" : slot.tile ? " filled" : "");
    button.textContent = slot.space ? "" : slot.tile ? slot.tile.letter : "";
    button.disabled = !!slot.space;
    if (!slot.space) {
      button.setAttribute("aria-label", slot.tile ? "Take back " + slot.tile.letter : "Empty spot");
      button.addEventListener("click", () => lift(index));
    }
    slots.appendChild(button);
  });
  state.bank.forEach((tile) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tile";
    button.textContent = tile.letter;
    button.setAttribute("aria-label", tile.letter);
    button.addEventListener("click", () => place(tile));
    bank.appendChild(button);
  });
  const words = $("words");
  words.replaceChildren();
  state.words.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip" + (index === state.index ? " on" : "");
    button.textContent = item;
    if (state.dots[item]) {
      const dot = document.createElement("span");
      dot.className = "dot";
      button.appendChild(dot);
    }
    button.addEventListener("click", () => { state.index = index; deal(); });
    words.appendChild(button);
  });
  $("prompt").textContent = word()
    ? "Tap the letters to make the word."
    : "Press and hold Words to add a list.";
  paintSound();
}

function toast(text, ok) {
  const node = $("toast");
  node.hidden = false;
  node.className = "toast " + (ok ? "good" : "bad");
  node.textContent = text;
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => { node.hidden = true; }, 1600);
}

function burst() {
  const box = $("burst");
  box.replaceChildren();
  const colors = ["#2f6fed", "#e36b4f", "#1f9d62", "#e8a317", "#7a4de0"];
  for (let i = 0; i < 24; i++) {
    const star = document.createElement("span");
    star.className = "star";
    star.textContent = "★✦●"[i % 3];
    const angle = (Math.PI * 2 * i) / 24;
    const dist = 80 + (i % 5) * 26;
    star.style.color = colors[i % colors.length];
    star.style.setProperty("--dx", Math.cos(angle) * dist + "px");
    star.style.setProperty("--dy", Math.sin(angle) * dist + "px");
    box.appendChild(star);
  }
  window.setTimeout(() => box.replaceChildren(), 1100);
}

function cheer() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = ctx.currentTime + i * 0.11;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.2, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.3);
  });
  window.setTimeout(() => ctx.close(), 1200);
}

function soundOn() { return localStorage.getItem(SOUND_KEY) === "1"; }
function paintSound() {
  const button = $("soundBtn");
  button.textContent = soundOn() ? "Sound on" : "Sound off";
  button.classList.toggle("active", soundOn());
}
function speak(text) {
  if (!window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.lang = "en-CA";
  window.speechSynthesis.speak(utterance);
}

function hold(button, onHold) {
  let timer = 0;
  let held = false;
  button.addEventListener("contextmenu", (event) => event.preventDefault());
  button.addEventListener("pointerdown", () => {
    held = false;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => { held = true; onHold(); }, 700);
  });
  button.addEventListener("pointerup", () => { if (!held) window.clearTimeout(timer); });
}

function sheet(title, body, build) {
  const overlay = document.createElement("div");
  overlay.className = "sheet";
  const card = document.createElement("div");
  card.className = "card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  const heading = document.createElement("h2");
  heading.textContent = title;
  const copy = document.createElement("p");
  copy.textContent = body;
  card.append(heading, copy);
  const close = () => overlay.remove();
  overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
  build(card, close);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function openWords() {
  const box = document.createElement("textarea");
  box.value = state.words.join("\n");
  box.setAttribute("aria-label", "Word list");
  const link = document.createElement("input");
  link.readOnly = true;
  link.hidden = true;
  link.setAttribute("aria-label", "Share link");
  sheet("Word list", "One word on each line. Press and hold Words so children don't change the list.", (card, close) => {
    card.appendChild(box);
    const row = document.createElement("div");
    row.className = "row";
    const cancel = button("Cancel", close);
    const save = button("Save words", () => {
      const words = parseWords(box.value);
      if (!words.length) return;
      state.words = words;
      state.index = 0;
      localStorage.setItem(WORDS_KEY, JSON.stringify(words));
      close();
      deal();
    });
    save.className = "good";
    const share = button("Share list", async () => {
      const words = parseWords(box.value);
      if (!words.length) return;
      const url = location.origin + location.pathname + "?words=" + words.map(encodeURIComponent).join(",");
      link.value = url;
      link.hidden = false;
      try {
        if (navigator.share) { await navigator.share({ title: "Word Mix", url }); return; }
      } catch (e) { if (e && e.name === "AbortError") return; }
      try { await navigator.clipboard.writeText(url); } catch (err) { link.select(); }
    });
    row.append(cancel, save, share);
    card.append(row, link);
    box.focus();
  });
}

function button(label, onClick) {
  const node = document.createElement("button");
  node.type = "button";
  node.textContent = label;
  node.addEventListener("click", onClick);
  return node;
}

function confirmClear() {
  const count = state.words.filter((item) => state.dots[item]).length;
  sheet(count ? "Clear the green dots?" : "Nothing to clear", count
    ? "Every word will look not unscrambled. The word list stays. This only changes this device."
    : "No words have a green dot yet.", (card, close) => {
    const row = document.createElement("div");
    row.className = "row";
    row.appendChild(button(count ? "Keep dots" : "Close", close));
    if (count) {
      const clear = button("Clear dots", () => {
        state.dots = {};
        localStorage.setItem(DOTS_KEY, JSON.stringify(state.dots));
        close();
        render();
      });
      clear.classList.add("warn");
      row.appendChild(clear);
    }
    card.appendChild(row);
  });
}

function finish() {
  sheet("You unscrambled them", "Every word on the list has a green dot.", (card, close) => {
    const row = document.createElement("div");
    row.className = "row";
    row.appendChild(button("Close", close));
    card.appendChild(row);
  });
}

$("soundBtn").addEventListener("click", () => {
  localStorage.setItem(SOUND_KEY, soundOn() ? "0" : "1");
  paintSound();
});
$("mixBtn").addEventListener("click", () => deal());
$("prev").addEventListener("click", () => {
  state.index = (state.index - 1 + state.words.length) % state.words.length;
  deal();
});
$("next").addEventListener("click", () => {
  state.index = (state.index + 1) % state.words.length;
  deal();
});
hold($("wordsBtn"), openWords);
hold($("clearDots"), confirmClear);

deal();
if (state.loaded) toast("Loaded " + state.loaded + " words.", true);
