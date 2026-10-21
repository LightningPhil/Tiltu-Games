/** Full gameplay port from whack-a, hosted by Tiltu's Games. */
import type {PortScope,PortHooks} from '../scope.ts';
import {bindScope} from './environment.ts';
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import { WhackGame, DIFFICULTIES, isCustomCharacter } from "./game.ts";
import type { Animal, Character, Difficulty, Target, TargetKind } from "./game.ts";
import { CHARACTERS, accessorySVG, characterSVG, mixedSVG } from "./characters.ts";
import { GameAudio } from "./audio.ts";
import { gardenScene, turfSVG } from "./scenery.ts";
import { legacyScores, loadSettings, saveScore, saveSettings, topScores } from "./storage.ts";
import { loadCustomCharacters, prepareCustomPng, removeCustomCharacter, saveCustomCharacter } from "./custom-characters.ts";
export function createGame(scope:PortScope):PortHooks {
bindScope(scope);
// BEGIN GAME RUNTIME
function el<T extends HTMLElement = HTMLElement>(id: string) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element as T;
}

const preferences = loadSettings();
let customCharacters = loadCustomCharacters();
if (isCustomCharacter(preferences.character) && !customCharacters.some(character => character.id === preferences.character)) preferences.character = "mixed";
let pendingImage: string | null = null;
let uploadGeneration = 0;
let game = new WhackGame(preferences);
const audio = new GameAudio();
audio.enabled = preferences.sound;
audio.musicEnabled = preferences.music;
audio.volume = preferences.volume;
const garden = el("garden");
garden.insertAdjacentHTML("afterbegin", gardenScene());
const picker = el("character-picker");
const overlay = el("board-overlay");
const announcer = el("announcer");
const score = el("score");
const timer = el("timer");
const multiplier = el("multiplier");
const timeFill = el("time-fill");
const boardMessage = el("board-message");
const nameInput = el<HTMLInputElement>("player-name");
const keyLetters = ["Q", "W", "E", "A", "S", "D", "Z", "X", "C"];
let lastFrame = performance.now();
let roundId = "";
let bestBeforeRound = 0;
let lastCountdown = -1;
let lastPhase = game.phase;
let messageUntil = 0;
let resumeCountdown = 0;
let lastTick = -1;
let reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", event => { reducedMotion = event.matches; });
const visuals: { id: number; until: number; result: string; animal: Target["animal"]; kind: Target["kind"] }[] = Array.from({ length: 9 }, () => ({ id: -1, until: 0, result: "", animal: "bunny", kind: "normal" }));

const holes = Array.from({ length: 9 }, (_, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "hole";
  button.dataset.hole = String(index);
  button.innerHTML = `<span class="well-shadow"></span><span class="animal"></span><span class="well-rim">${turfSVG(index)}</span><span class="target-badge"></span><span class="hole-key">${index + 1}<small>${keyLetters[index]}</small></span><span class="impact" aria-hidden="true"></span><span class="hit-feedback" aria-hidden="true"></span>`;
  const strike = () => {
    syncClock();
    if (game.phase !== "playing") return;
    audio.unlock();
    game.whack(index);
    processEvents();
    render();
  };
  // Pointer events cover mouse, pen and touch without a second synthetic click.
  button.addEventListener("pointerdown", event => {
    if (event.button !== 0 || !event.isPrimary || game.phase !== "playing") return;
    event.preventDefault();
    button.focus({ preventScroll: true });
    strike();
  });
  button.addEventListener("click", event => { if (event.detail === 0) strike(); });
  el("holes").append(button);
  return { button, animal: button.querySelector<HTMLElement>(".animal")!, badge: button.querySelector<HTMLElement>(".target-badge")!, impact: button.querySelector<HTMLElement>(".impact")!, feedback: button.querySelector<HTMLElement>(".hit-feedback")! };
});

for (const character of CHARACTERS) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `character-card${character.id === "mixed" ? " mixed-card" : ""}`;
  button.dataset.character = character.id;
  button.style.setProperty("--character-color", character.color);
  button.innerHTML = `<span class="character-art">${character.id === "mixed" ? mixedSVG() : characterArt(character.id)}</span><span class="character-copy"><strong>${character.name}</strong>${character.id === "mixed" ? `<small>${character.note}</small>` : ""}</span><span class="selected-check" aria-hidden="true">✓</span>`;
  button.addEventListener("click", () => { preferences.character = character.id; updateSetup(); });
  picker.append(button);
}

el("difficulty-picker").querySelectorAll<HTMLButtonElement>("button").forEach(button => {
  button.addEventListener("click", () => { preferences.difficulty = button.dataset.difficulty as Difficulty; updateSetup(); });
});
el<HTMLInputElement>("practice").addEventListener("change", event => {
  preferences.mode = (event.target as HTMLInputElement).checked ? "practice" : "timed";
  updateSetup();
});
el("tap-picker").querySelectorAll<HTMLButtonElement>("button").forEach(button => {
  button.addEventListener("click", () => { preferences.attemptsPerPop = Number(button.dataset.taps) as 1 | 2; updateSetup(); });
});

function selectedCharacter(character: Character = preferences.character) {
  return CHARACTERS.find(item => item.id === character) ?? customCharacters.find(item => item.id === character) ?? { id: character, name: "Custom character" };
}

function characterArt(character: Exclude<Character, "mixed">, kind: TargetKind = "normal") {
  if (!isCustomCharacter(character)) return characterSVG(character, kind);
  const custom = customCharacters.find(item => item.id === character);
  if (!custom) return characterSVG("mole", kind);
  // Gallery validation only allows a PNG data URL. Names never enter markup.
  const hat = accessorySVG(kind);
  return `<span class="custom-figure"><img src="${custom.image}" alt="" draggable="false" />${hat ? `<svg class="custom-hat" viewBox="0 0 140 170" aria-hidden="true">${hat}</svg>` : ""}</span>`;
}

function renderCustomMenu() {
  const gallery = el("custom-picker");
  gallery.replaceChildren();
  el("custom-empty").hidden = customCharacters.length > 0;
  for (const custom of customCharacters) {
    const card = document.createElement("div");
    card.className = "custom-card";
    const select = document.createElement("button");
    select.type = "button"; select.className = "character-card"; select.dataset.character = custom.id;
    const art = document.createElement("span"); art.className = "character-art";
    const image = document.createElement("img"); image.src = custom.image; image.alt = "";
    const name = document.createElement("strong"); name.textContent = custom.name;
    art.append(image); select.append(art, name);
    select.setAttribute("aria-pressed", String(preferences.character === custom.id));
    select.addEventListener("click", () => { preferences.character = custom.id; updateSetup(); });
    const remove = document.createElement("button");
    remove.type = "button"; remove.className = "remove-character"; remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove ${custom.name} from custom characters`);
    remove.addEventListener("click", () => {
      try {
        removeCustomCharacter(custom.id);
        customCharacters = loadCustomCharacters();
        if (preferences.character === custom.id) preferences.character = "mixed";
        updateSetup();
        el("upload-status").textContent = `${custom.name} removed from this device.`;
      } catch (error) { el("upload-status").textContent = (error as Error).message; }
    });
    card.append(select, remove); gallery.append(card);
  }
}

el<HTMLInputElement>("custom-file").addEventListener("change", async event => {
  const file = (event.target as HTMLInputElement).files?.[0];
  const generation = ++uploadGeneration;
  pendingImage = null;
  el("upload-draft").hidden = true;
  if (!file) return;
  el("upload-status").textContent = "Preparing your PNG…";
  try {
    const image = await prepareCustomPng(file);
    if (generation !== uploadGeneration) return;
    pendingImage = image;
    el<HTMLImageElement>("custom-preview").src = image;
    el<HTMLInputElement>("custom-name").value = file.name.replace(/\.png$/i, "").slice(0, 24);
    el("upload-draft").hidden = false;
    el("upload-status").textContent = "Looking good! Give your character a name, then save.";
    el<HTMLInputElement>("custom-name").focus({ preventScroll: true });
  } catch (error) { if (generation === uploadGeneration) el("upload-status").textContent = (error as Error).message; }
  finally { if (generation === uploadGeneration) (event.target as HTMLInputElement).value = ""; }
});
el("custom-form").addEventListener("submit", event => {
  event.preventDefault();
  if (!pendingImage) return;
  const name = el<HTMLInputElement>("custom-name").value.trim().slice(0, 24);
  if (!name) { el("upload-status").textContent = "Give your character a name first."; return; }
  try {
    const character = { id: `custom:${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}` as const, name, image: pendingImage };
    saveCustomCharacter(character);
    customCharacters = loadCustomCharacters();
    preferences.character = character.id;
    pendingImage = null;
    el("upload-draft").hidden = true;
    updateSetup();
    el("upload-status").textContent = `${name} saved on this device and ready to play.`;
  } catch (error) { el("upload-status").textContent = (error as Error).message; }
});
el("cancel-upload").addEventListener("click", () => {
  uploadGeneration++;
  pendingImage = null;
  el("upload-draft").hidden = true;
  el("upload-status").textContent = "";
});

function updateSetup() {
  saveSettings(preferences);
  renderCustomMenu();
  if (isCustomCharacter(preferences.character)) el<HTMLDetailsElement>("custom-menu").open = true;
  picker.querySelectorAll<HTMLButtonElement>("button").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.character === preferences.character)));
  el("difficulty-picker").querySelectorAll<HTMLButtonElement>("button").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.difficulty === preferences.difficulty)));
  el("pace-note").textContent = DIFFICULTIES[preferences.difficulty].description;
  el("tap-picker").querySelectorAll<HTMLButtonElement>("button").forEach(button => button.setAttribute("aria-pressed", String(Number(button.dataset.taps) === preferences.attemptsPerPop)));
  el("tap-note").textContent = preferences.attemptsPerPop === 1 ? "One chance. Hits refresh it immediately; misses add a 180 ms delay." : "Two chances. Hits refresh them immediately; misses add a 180 ms delay.";
  el<HTMLInputElement>("practice").checked = preferences.mode === "practice";
  el("start-note").textContent = preferences.mode === "practice" ? "Find your rhythm. Finish whenever you like." : "60 seconds. One very happy garden.";
  el("board-title").textContent = selectedCharacter().name.toUpperCase();
  el("best-difficulty").textContent = preferences.difficulty.toUpperCase();
  el("best").textContent = String(topScores(preferences.difficulty)[0]?.score ?? 0);
  game.settings = { ...preferences };
  renderLeaderboard();
  preview();
}

function preview() {
  const previewAnimals: Animal[] = ["bunny", "giraffe", "unicorn", "monkey", "rhino", "dog", "mole", "kitten", "monkey"];
  holes.forEach((hole, index) => {
    const animal = preferences.character === "mixed" ? previewAnimals[index] : preferences.character;
    const kind = index === 4 ? "crown" : index === 6 ? "party" : index === 8 ? "sleepy" : "normal";
    hole.animal.innerHTML = characterArt(animal, kind);
    hole.button.className = `hole preview kind-${kind}`;
    hole.button.disabled = true;
    hole.button.setAttribute("aria-label", `Hole ${index + 1}`);
    hole.badge.textContent = kind === "sleepy" ? "Zzz · leave me" : kind === "crown" ? "30" : kind === "party" ? "20" : "";
    hole.feedback.textContent = "";
  });
  score.textContent = "0";
  timer.innerHTML = preferences.mode === "practice" ? "∞" : '60<span class="unit">s</span>';
  el("time-label").textContent = preferences.mode === "practice" ? "PRACTICE" : "TIME LEFT";
  timeFill.style.width = "100%";
  multiplier.textContent = "×1";
  garden.classList.remove("fever", "urgent");
  el("fever-banner").hidden = true;
  holes.forEach(hole => hole.impact.replaceChildren());
  el("tap-status").hidden = true;
  el("combo-dots").querySelectorAll("i").forEach(dot => dot.classList.remove("lit"));
}

function startRound() {
  audio.stop();
  audio.unlock();
  el("whack-root").classList.remove("is-setup");
  game = new WhackGame(preferences);
  game.start();
  roundId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  bestBeforeRound = topScores(preferences.difficulty)[0]?.score ?? 0;
  lastFrame = performance.now();
  lastCountdown = -1;
  lastPhase = "idle";
  messageUntil = 0;
  resumeCountdown = 0;
  lastTick = -1;
  holes.forEach(hole => hole.impact.replaceChildren());
  visuals.forEach(visual => { visual.id = -1; visual.until = 0; visual.result = ""; });
  el("setup-panel").hidden = true;
  el("results-panel").hidden = true;
  el("round-panel").hidden = false;
  el("round-character").textContent = selectedCharacter().name;
  el("round-description").textContent = `${DIFFICULTIES[preferences.difficulty].label} · ${preferences.mode === "practice" ? "Practice, at your pace" : "60-second round"}`;
  el("round-art").innerHTML = preferences.character === "mixed" ? mixedSVG() : characterArt(preferences.character, "party");
  boardMessage.textContent = "Ready, steady… bonk!";
  el("pause").hidden = false;
  el("finish-practice").hidden = preferences.mode !== "practice";
  holes[0].button.disabled = false;
  holes[0].button.focus({ preventScroll: true });
  render();
  if (matchMedia("(max-width: 800px)").matches) score.closest(".scoreboard")!.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" });
}

function flash(hole: number, text: string, result: string) {
  const visual = visuals[hole];
  visual.until = game.elapsed + 400;
  visual.result = result;
  const feedback = holes[hole].feedback;
  feedback.getAnimations().forEach(animation => animation.cancel());
  feedback.textContent = text;
  if (!reducedMotion) feedback.animate([
    { opacity: 1, transform: "translate(-50%, 0)" },
    { opacity: 1, transform: "translate(-50%, -7px)", offset: .2 },
    { opacity: 0, transform: "translate(-50%, -32px)" },
  ], { duration: 400, easing: "ease-out" });
  if (result === "bonked" && !reducedMotion) {
    const impact = holes[hole].impact;
    impact.innerHTML = '<span class="impact-ring"></span>';
    const colors = ["#ffed9a", "#f7bd75", "#fff8dc", "#dda0a2"];
    for (let particle = 0; particle < 9; particle++) {
      const spark = document.createElement("i");
      spark.className = "impact-particle";
      const angle = particle / 9 * Math.PI * 2;
      const distance = particle % 2 ? 46 : 66;
      spark.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
      spark.style.setProperty("--dy", `${Math.sin(angle) * distance - 15}px`);
      spark.style.setProperty("--spin", `${particle * 73}deg`);
      spark.style.setProperty("--particle-color", colors[particle % colors.length]);
      impact.append(spark);
    }
  }
}

function processEvents() {
  for (const event of game.drainEvents()) {
    if (event.type === "spawn") {
      // A quick return to the same hole must not inherit an earlier reaction.
      visuals[event.target.hole].until = 0;
      visuals[event.target.hole].result = "";
      holes[event.target.hole].feedback.getAnimations().forEach(animation => animation.cancel());
      holes[event.target.hole].impact.replaceChildren();
      if (event.target.kind !== "sleepy") audio.play("pop", { pan: (event.target.hole % 3 - 1) * .55 });
    } else if (event.type === "hit") {
      const target = event.target;
      Object.assign(visuals[target.hole], { animal: target.animal, kind: target.kind });
      flash(target.hole, `+${event.points}`, "bonked");
      audio.play(target.kind === "crown" ? "crown" : target.kind === "party" ? "bonus" : "hit", { streak: game.stats.streak, pan: (target.hole % 3 - 1) * .55 });
      if (!reducedMotion) score.animate([{ transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 180, easing: "ease-out" });
      if (game.stats.streak % 5 === 0) {
        audio.play("combo", { streak: game.stats.streak });
        boardMessage.textContent = `${game.stats.streak} in a row! ${game.multiplier}× combo. Keep it going.`;
        messageUntil = game.elapsed + 1600;
      }
    } else if (event.type === "miss") {
      flash(event.hole, event.reason === "sleepy" ? "−20 · Zzz!" : "Whoops!", "missed");
      audio.play(event.reason === "sleepy" ? "sleepy" : "miss", { pan: (event.hole % 3 - 1) * .55 });
      boardMessage.textContent = event.reason === "sleepy" ? "Shh… let the sleepy ones snooze. Streak reset." : "Empty hole! Take a breath and rebuild your streak.";
      messageUntil = game.elapsed + 1800;
    } else if (event.type === "escape") {
      flash(event.target.hole, "Too slow!", "escaped");
    } else if (event.type === "fever") {
      audio.play("fever");
      announcer.textContent = "Party fever! Double points for six seconds.";
      boardMessage.textContent = "PARTY FEVER! Every bonk pays double for 6 seconds.";
      messageUntil = game.elapsed + 2000;
    } else if (event.type === "finish") {
      showResults();
    }
  }
}

function syncClock() {
  const now = performance.now();
  const delta = Math.max(0, now - lastFrame);
  lastFrame = now;
  if (resumeCountdown > 0 && game.phase === "paused") {
    resumeCountdown = Math.max(0, resumeCountdown - delta);
    if (resumeCountdown === 0) { game.resume(); audio.play("go"); }
  } else game.advance(delta);
  processEvents();
}

function render() {
  if (game.phase === "idle") return;
  audio.setScene(game.phase === "playing" ? game.fever ? "fever" : "playing" : game.phase === "paused" ? "paused" : "idle");
  score.textContent = game.stats.score.toLocaleString();
  timer.innerHTML = preferences.mode === "practice" ? `${Math.floor(game.elapsed / 1000)}<span class="unit">s</span>` : `${Math.ceil(game.remaining / 1000)}<span class="unit">s</span>`;
  timeFill.style.width = `${preferences.mode === "practice" ? 100 : game.remaining / game.duration * 100}%`;
  multiplier.textContent = `×${game.multiplier}${game.fever ? " ×2" : ""}`;
  el("combo-dots").querySelectorAll("i").forEach((dot, index) => dot.classList.toggle("lit", index < game.stats.streak % 5 || game.multiplier === 4));
  el("hits").textContent = String(game.stats.hits);
  el("accuracy").textContent = game.stats.attempts ? `${game.accuracy}%` : "—";
  el("streak").textContent = String(game.stats.bestStreak);
  const feverRemaining = Math.max(0, game.feverUntil - game.elapsed);
  el("fever-caption").textContent = feverRemaining > 0 ? `Double points! ${Math.ceil(feverRemaining / 1000)}s left` : `${15 - game.stats.streak % 15} more in a row for double points`;
  el("fever-fill").style.width = `${feverRemaining > 0 ? feverRemaining / 6000 * 100 : game.stats.streak % 15 / 15 * 100}%`;
  el("fever-card").classList.toggle("active", feverRemaining > 0);
  garden.classList.toggle("fever", game.fever);
  el("fever-banner").hidden = !game.fever;
  garden.classList.toggle("urgent", preferences.mode === "timed" && game.remaining <= 10000 && game.phase === "playing");
  if (game.phase === "playing" && preferences.mode === "timed") {
    const second = Math.ceil(game.remaining / 1000);
    if (second <= 10 && second > 0 && second !== lastTick) audio.play("tick");
    lastTick = second;
  }
  const tapStatus = el("tap-status");
  tapStatus.hidden = game.phase !== "playing";
  const tapText = game.attemptsLeft === 0 ? "Wait for the next pop-up" : game.elapsed < game.nextAttemptAt ? "Easy… aim your next tap" : !game.hasReadyTarget ? "Waiting for a pop-up" : `${game.attemptsLeft} tap${game.attemptsLeft === 1 ? "" : "s"} ready`;
  if (tapStatus.textContent !== tapText) tapStatus.textContent = tapText;
  tapStatus.classList.toggle("locked", game.attemptsLeft === 0 || game.elapsed < game.nextAttemptAt);

  holes.forEach((hole, index) => {
    const target = game.targets[index];
    const visual = visuals[index];
    const feedback = visual.until > game.elapsed && game.phase !== "finished";
    const bonked = feedback && visual.result === "bonked";
    if (target && visual.id !== target.id) {
      hole.animal.innerHTML = characterArt(target.animal, target.kind);
      visual.id = target.id;
    } else if (bonked && hole.animal.dataset.bonk !== String(visual.until)) {
      hole.animal.innerHTML = characterArt(visual.animal, visual.kind);
      hole.animal.dataset.bonk = String(visual.until);
    }
    hole.button.disabled = game.phase !== "playing";
    hole.button.className = `hole${target ? " up" : ""}${feedback ? ` ${visual.result}` : ""}${target ? ` kind-${target.kind}` : ""}`;
    hole.button.style.setProperty("--life", target ? String(Math.max(0, (target.expires - game.elapsed) / (target.expires - target.born))) : "0");
    hole.badge.textContent = target?.kind === "sleepy" ? "Zzz · leave me" : target?.kind === "crown" ? "30" : target?.kind === "party" ? "20" : "";
    const kindLabel = target?.kind === "sleepy" ? "sleeping, do not whack" : target?.kind === "crown" ? "crown bonus" : target?.kind === "party" ? "party bonus" : "whack now";
    const label = `Hole ${index + 1}, ${target ? `${selectedCharacter(target.animal).name}, ${kindLabel}` : "empty"}`;
    if (hole.button.getAttribute("aria-label") !== label) hole.button.setAttribute("aria-label", label);
  });

  const counting = game.phase === "countdown" || resumeCountdown > 0;
  overlay.hidden = !counting && game.phase !== "paused";
  el("pause-actions").hidden = game.phase !== "paused" || counting;
  if (counting) {
    const count = Math.max(1, Math.ceil((resumeCountdown || game.countdown) / 1000));
    el("overlay-label").textContent = resumeCountdown ? "BACK TO THE PARTY" : "MALLETS AT THE READY";
    el("overlay-title").textContent = String(count);
    el("overlay-description").textContent = "Bonk the pop-ups. Let the sleepy ones snooze.";
    if (count !== lastCountdown) { audio.play("count"); lastCountdown = count; announcer.textContent = `Starting in ${count}`; }
  } else if (game.phase === "paused") {
    el("overlay-label").textContent = "A LITTLE BREATHER";
    el("overlay-title").textContent = "Paused.";
    el("overlay-description").textContent = "Your garden will wait right here.";
  }
  el("round-badge").textContent = game.phase === "paused" ? "TAKE YOUR TIME" : game.phase === "finished" ? "THAT’S A WRAP" : counting ? "GET READY" : game.fever ? "PARTY FEVER · ×2" : preferences.mode === "practice" ? "PRACTICE MAKES HAPPY" : "BONKING IN PROGRESS";
  if (game.phase === "playing" && lastPhase === "countdown") {
    audio.play("go");
    announcer.textContent = "Go! The round has started.";
    holes[0].button.focus({ preventScroll: true });
  }
  if (game.phase === "playing" && game.elapsed > messageUntil && boardMessage.textContent !== "Follow the pop-ups. Build your streak. Watch for Zzz.") {
    boardMessage.textContent = "Follow the pop-ups. Build your streak. Watch for Zzz.";
  }
  lastPhase = game.phase;
}

function showResults() {
  audio.setScene("idle");
  el("round-panel").hidden = true;
  el("results-panel").hidden = false;
  el("pause").hidden = true;
  el("finish-practice").hidden = true;
  const practice = preferences.mode === "practice";
  const record = !practice && game.stats.score > bestBeforeRound;
  audio.play(record ? "record" : "end");
  el("result-medal").innerHTML = `<svg viewBox="0 0 80 90" aria-hidden="true"><defs><linearGradient id="medal-gold" x2=".7" y2="1"><stop stop-color="#fff1ad"/><stop offset="1" stop-color="#d79b38"/></linearGradient></defs><path d="M23 47l-8 38 21-9 7 8 3-32m6-3 11 36-18-11-9 10-3-30" fill="${record ? "#c8785d" : "#7a9a76"}" stroke="${record ? "#a15a45" : "#5c7e57"}" stroke-width="1.5"/><circle cx="40" cy="33" r="28" fill="url(#medal-gold)" stroke="#bb8c3d" stroke-width="2"/><circle cx="40" cy="33" r="22" fill="none" stroke="#fff0ac" stroke-width="2"/><path d="M40 17l5 10 12 2-9 9 2 12-10-6-10 6 2-12-9-9 12-2Z" fill="#fff2b4" stroke="#bf8e3d" stroke-width="1.5"/></svg>`;
  el("result-label").textContent = practice ? "PRACTICE COMPLETE" : record ? "A NEW PERSONAL BEST" : "THAT’S A WRAP";
  el("result-title").textContent = record ? "Garden legend!" : game.accuracy >= 85 && game.stats.hits > 0 ? "Lovely bonking!" : "Another go?";
  el("result-score").textContent = game.stats.score.toLocaleString();
  el("result-subtitle").textContent = practice ? `points in ${Math.floor(game.elapsed / 1000)} seconds of practice` : "points in the bag";
  const rows = [
    ["Good bonks", String(game.stats.hits)], ["Accuracy", `${game.accuracy}%`], ["Best streak", String(game.stats.bestStreak)],
    ["Avg. reaction", game.stats.hits ? `${Math.round(game.stats.reactionTotal / game.stats.hits)} ms` : "—"],
    ["Escaped", String(game.stats.escaped)], ["Sleepy bonks", String(game.stats.sleepyHits)],
  ];
  const container = el("result-stats");
  container.replaceChildren();
  for (const [label, value] of rows) {
    const row = document.createElement("div");
    const term = document.createElement("span");
    const stat = document.createElement("strong");
    term.textContent = label; stat.textContent = value;
    row.append(term, stat); container.append(row);
  }
  el("score-form").hidden = practice;
  nameInput.value = preferences.name;
  if (!practice) persistResult();
  announcer.textContent = `Round finished. ${game.stats.score} points, ${game.accuracy} percent accuracy.`;
  boardMessage.textContent = "Well played! There’s always room for one more round.";
  el("replay").focus({ preventScroll: true });
  if (matchMedia("(max-width: 800px)").matches) el("results-panel").scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" });
}

function persistResult() {
  const stored = saveScore(roundId, preferences.name, game.settings, game.stats, selectedCharacter(game.settings.character).name);
  el("save-status").textContent = stored ? "Score saved on this device." : "Storage unavailable. Scores last for this visit.";
  el("best").textContent = String(topScores(preferences.difficulty)[0]?.score ?? 0);
  renderLeaderboard();
}

function renderLeaderboard() {
  el("leaderboard-pace").textContent = `${preferences.difficulty.toUpperCase()} · ON THIS DEVICE`;
  const list = el("leaderboard-list");
  list.replaceChildren();
  const records = topScores(preferences.difficulty);
  if (!records.length) {
    const empty = document.createElement("li");
    empty.className = "empty-leaderboard";
    empty.textContent = "A fresh patch of garden. Play a timed round to plant your first score.";
    list.append(empty);
  }
  records.forEach((entry, index) => {
    const row = document.createElement("li");
    const rank = document.createElement("span");
    rank.className = "rank"; rank.textContent = String(index + 1).padStart(2, "0");
    const copy = document.createElement("div");
    const name = document.createElement("strong"); name.textContent = entry.name;
    const detail = document.createElement("small"); detail.textContent = `${entry.characterName ?? selectedCharacter(entry.character).name} · ${entry.accuracy}% accuracy`;
    copy.append(name, detail);
    const points = document.createElement("strong"); points.textContent = entry.score.toLocaleString();
    row.append(rank, copy, points);
    list.append(row);
  });
}

function pauseRound() {
  syncClock();
  // Navigation may interrupt the three-second resume countdown while the engine is still paused.
  if (game.phase === "paused") { resumeCountdown = 0; lastCountdown = -1; render(); return; }
  if (game.phase !== "playing" && game.phase !== "countdown") return;
  game.pause();
  resumeCountdown = 0;
  lastCountdown = -1;
  render();
  audio.play("pause");
  el("resume").focus({ preventScroll: true });
  announcer.textContent = "Game paused.";
}

function resumeRound() {
  if (game.phase !== "paused" || resumeCountdown > 0 || document.hidden) return;
  audio.unlock();
  resumeCountdown = 3000;
  lastCountdown = -1;
  lastFrame = performance.now();
  render();
}

function backToSetup() {
  game = new WhackGame(preferences);
  audio.stop();
  el("whack-root").classList.add("is-setup");
  resumeCountdown = 0;
  overlay.hidden = true;
  el("setup-panel").hidden = false;
  el("results-panel").hidden = true;
  el("round-panel").hidden = true;
  el("pause").hidden = true;
  el("finish-practice").hidden = true;
  el("round-badge").textContent = "READY WHEN YOU ARE";
  boardMessage.textContent = "Pick your party. Then let the bonking begin.";
  updateSetup();
  el("start").focus({ preventScroll: true });
}

function renderSound() {
  el("sound-toggle").setAttribute("aria-pressed", String(!audio.enabled));
  el("sound-toggle").setAttribute("aria-label", audio.enabled ? "Mute all sound" : "Enable sound");
  el("sound-label").textContent = audio.enabled ? "Sound on" : "Sound off";
  el("music-toggle").setAttribute("aria-pressed", String(audio.musicEnabled));
  el("music-toggle").setAttribute("aria-label", audio.musicEnabled ? "Turn round music off" : "Turn round music on");
  el("music-label").textContent = audio.musicEnabled ? "Music on" : "Music off";
  el<HTMLInputElement>("volume").value = String(Math.round(audio.volume * 100));
}

el("sound-toggle").addEventListener("click", () => {
  audio.enabled = !audio.enabled;
  preferences.sound = audio.enabled;
  if (audio.enabled) { audio.unlock(); audio.play("count"); }
  saveSettings(preferences);
  renderSound();
});
el("music-toggle").addEventListener("click", () => {
  audio.musicEnabled = !audio.musicEnabled;
  preferences.music = audio.musicEnabled;
  audio.unlock();
  saveSettings(preferences);
  renderSound();
});
el<HTMLInputElement>("volume").addEventListener("input", event => {
  audio.volume = Number((event.target as HTMLInputElement).value) / 100;
  preferences.volume = audio.volume;
  audio.unlock();
  saveSettings(preferences);
});
el("start").addEventListener("click", startRound);
el("replay").addEventListener("click", startRound);
el("pause").addEventListener("click", pauseRound);
el("resume").addEventListener("click", resumeRound);
el("quit").addEventListener("click", backToSetup);
el("change").addEventListener("click", backToSetup);
el("finish-practice").addEventListener("click", () => { syncClock(); game.finish(); processEvents(); render(); });
el("score-form").addEventListener("submit", event => {
  event.preventDefault();
  preferences.name = nameInput.value.trim().slice(0, 16) || "Player";
  nameInput.value = preferences.name;
  saveSettings(preferences);
  persistResult();
});
document.addEventListener("keydown", event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target instanceof HTMLElement && (event.target.matches("input, textarea, select") || event.target.isContentEditable)) return;
  const key = event.key.toUpperCase();
  if (key === "P" || key === "ESCAPE") {
    if (game.phase === "paused") resumeRound(); else pauseRound();
    return;
  }
  const index = /^[1-9]$/.test(key) ? Number(key) - 1 : keyLetters.indexOf(key);
  if (index < 0 || game.phase !== "playing") return;
  event.preventDefault();
  syncClock();
  game.whack(index);
  processEvents();
  render();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (game.phase === "playing" || game.phase === "countdown") pauseRound();
    resumeCountdown = 0;
  }
  lastFrame = performance.now();
});
window.addEventListener("blur", () => {
  if (game.phase === "playing" || game.phase === "countdown") pauseRound();
  resumeCountdown = 0;
});

const legacy = legacyScores();
if (legacy.length) {
  el("legacy-scores").hidden = false;
  for (const entry of legacy) {
    const row = document.createElement("li");
    row.textContent = `${entry.game} · ${entry.name}: ${entry.score}`;
    el("legacy-list").append(row);
  }
}

updateSetup();
renderSound();
function frame() { syncClock(); render(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);

// END GAME RUNTIME

return {pause:()=>{pauseRound();audio.stop();},running:()=>game.phase==='playing',resetClock:()=>{lastFrame=performance.now();}};
}
