/** Ported from whack-a; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import type { Animal, Character, TargetKind } from "./game.ts";

export const CHARACTERS: { id: Character; name: string; note: string; color: string }[] = [
  { id: "bunny", name: "Bunnies", note: "The garden gang", color: "#f9c2cd" },
  { id: "giraffe", name: "Giraffes", note: "Heads above the rest", color: "#f5c967" },
  { id: "unicorn", name: "Unicorns", note: "A little bit magical", color: "#d1b8ef" },
  { id: "monkey", name: "Monkeys", note: "Cheeky little trouble", color: "#ddb18d" },
  { id: "rhino", name: "Rhinos", note: "Big softies", color: "#b7c8d0" },
  { id: "dog", name: "Dogs", note: "Very good bonkers", color: "#ebc4a2" },
  { id: "mole", name: "Moles", note: "The original garden guests", color: "#b8a49b" },
  { id: "kitten", name: "Kittens", note: "Tiny paws, big mischief", color: "#edc298" },
  { id: "mixed", name: "The whole zoo", note: "Everyone’s invited", color: "#b6d6b5" },
];

// Every creature faces the player on the same canvas and baseline. Species never change the hit area.
const bodies: Record<Animal, string> = {
  bunny: `
    <ellipse cx="70" cy="140" rx="33" ry="37" fill="#f4e8db"/>
    <ellipse cx="70" cy="145" rx="22" ry="28" fill="#fffaf1"/>
    <path d="M46 75C36 59 27 17 36 7c10-10 24 32 25 58m18 0C80 33 91-1 101 8c10 10-1 53-9 68" fill="#f4e8db"/>
    <path d="M47 64C41 49 34 18 38 16c5-2 15 28 16 47m32 0c2-20 9-48 13-46 5 3-3 32-9 47" fill="#dfaaa9" stroke="none"/>
    <path d="M43 59c-3-13-6-25-6-33m56 34c4-14 6-27 6-33" stroke="#f9d4ce" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M70 59C49 58 35 71 35 89l-5 6 5 3-2 7 7 2c5 14 17 23 30 23s26-9 31-23l7-2-3-7 5-3-5-6c0-18-14-31-35-30Z" fill="#f4e8db"/>
    <path d="M47 75q6-9 16-10m-20 44 5 5m49-5-5 5" fill="none" stroke="#fffef9" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="58" cy="108" rx="15" ry="10" fill="#fffdf7" stroke="none"/>
    <ellipse cx="82" cy="108" rx="15" ry="10" fill="#fffdf7" stroke="none"/>
    <ellipse cx="70" cy="120" rx="12" ry="6" fill="#fffdf7" stroke="none"/>
    <path d="m41 123 3-5m52 5-3-5" stroke="#c9b9a8" fill="none" stroke-linecap="round"/>
  `,
  giraffe: `<path d="M48 168l4-60h36l4 60" fill="#e9af47"/><path d="M55 127l10-6 7 9-10 8zm23 16l10-8 1 17-9 4" fill="#b57835"/><ellipse cx="38" cy="70" rx="16" ry="9" fill="#e9af47" transform="rotate(25 38 70)"/><ellipse cx="102" cy="70" rx="16" ry="9" fill="#e9af47" transform="rotate(-25 102 70)"/><path d="M55 65l-5-22m35 22l5-22" stroke="#e9af47" stroke-width="8"/><circle cx="50" cy="43" r="6" fill="#a26a33"/><circle cx="90" cy="43" r="6" fill="#a26a33"/><rect x="39" y="58" width="62" height="65" rx="26" fill="#e9af47"/><ellipse cx="70" cy="105" rx="29" ry="19" fill="#f8d993"/><circle cx="59" cy="102" r="3" fill="#a26a33"/><circle cx="81" cy="102" r="3" fill="#a26a33"/>`,
  unicorn: `<path d="M39 166l8-70h46l12 70" fill="#e9d9ef"/><path d="M91 65q32 35 12 98l-19-8 6-72" fill="#c49bdb"/><path d="M100 99l10 2m-13 15l14 3m-17 14l14 5" stroke="#ebaec5" stroke-width="6"/><path d="M45 72L35 43l23 16m37 13l10-29-23 16" fill="#fff8ed"/><path d="M62 60L70 20l8 40" fill="#f5c967" stroke="#b58739" stroke-width="2"/><path d="M66 40l9 4m-11 6l13 4" stroke="#fff0b9" stroke-width="3"/><rect x="38" y="56" width="64" height="68" rx="28" fill="#fff8ed"/><path d="M43 66q27-24 53-4l-12 17-14-12-10 11" fill="#d8abd8"/><ellipse cx="70" cy="107" rx="30" ry="19" fill="#f0bacb"/><circle cx="59" cy="106" r="3" fill="#b57083"/><circle cx="81" cy="106" r="3" fill="#b57083"/>`,
  monkey: `<ellipse cx="70" cy="134" rx="37" ry="38" fill="#956248"/><circle cx="32" cy="87" r="17" fill="#956248"/><circle cx="108" cy="87" r="17" fill="#956248"/><circle cx="32" cy="87" r="10" fill="#e8bc8e"/><circle cx="108" cy="87" r="10" fill="#e8bc8e"/><circle cx="70" cy="88" r="37" fill="#956248"/><path d="M39 85q-3-27 22-18l9 9 9-9q25-9 22 18l-5 26q-26 30-52 0Z" fill="#e8bc8e"/><path d="M63 99q7 6 14 0" fill="none" stroke="#6d4637" stroke-width="3"/><path d="M65 54q2-17 13-13" fill="none" stroke="#956248" stroke-width="7" stroke-linecap="round"/>`,
  rhino: `
    <ellipse cx="70" cy="140" rx="42" ry="37" fill="#a0b4bc"/>
    <path d="M36 116q-5 15 0 31m68-31q5 15 0 31M42 126q28 11 56 0" fill="none" stroke="#748e98" stroke-width="2" stroke-linecap="round"/>
    <path d="M41 73C25 67 20 50 28 40c16 2 26 15 24 30m36 0c-2-15 8-28 24-30 8 10 3 27-13 33" fill="#a0b4bc"/>
    <path d="M39 65Q27 58 30 47q12 4 15 17m50 0q3-13 15-17 3 11-9 18" fill="#718b98" stroke="none"/>
    <path d="M70 58C43 55 29 72 30 94c-3 20 9 33 40 35 31-2 43-15 40-35 1-22-13-39-40-36Z" fill="#a0b4bc"/>
    <path d="M44 99q26-12 52 0c10 10 8 17 1 22q-27 13-54 0c-7-5-9-12 1-22Z" fill="#b8c8cd"/>
    <path d="M62 88q6-11 8-22 2 11 8 22Z" fill="#d5d0bc" stroke="#7c9297" stroke-width="1.5"/>
    <path d="M57 108q10-14 13-30 3 16 13 30-13 8-26 0Z" fill="#ede3cb" stroke="#7c9297" stroke-width="1.6"/>
    <path d="M63 106q5-10 7-20" fill="none" stroke="#fff8e7" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M57 109q13 7 26 0m-46-16q-2 9 2 15m64-15q2 9-2 15m-62 8 6 4m50-4-6 4" fill="none" stroke="#748f99" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M48 66q22-10 44 0" fill="none" stroke="#d9e4e1" stroke-width="3" stroke-linecap="round"/>
  `,
  dog: `<ellipse cx="70" cy="134" rx="37" ry="41" fill="#f6e6cd"/><rect x="40" y="114" width="60" height="10" rx="5" fill="#608a75"/><circle cx="70" cy="126" r="6" fill="#e8b558"/><rect x="34" y="57" width="72" height="66" rx="31" fill="#f6e6cd"/><path d="M41 61q-28-11-25 33t24 2m59-35q28-11 25 33t-24 2" fill="#a37150"/><ellipse cx="52" cy="86" rx="15" ry="22" fill="#b7835a"/><ellipse cx="70" cy="108" rx="26" ry="18" fill="#fff3dc"/><path d="M62 100q8-7 16 0l-8 9Z" fill="#574136"/>`,
  mole: `
    <ellipse cx="70" cy="138" rx="38" ry="39" fill="#5c5351"/>
    <path d="M70 57C45 54 30 70 30 91l-3 9 4 3-1 8 8 3c8 13 21 18 32 18s24-5 32-18l8-3-1-8 4-3-3-9c0-21-15-37-40-34Z" fill="#5c5351"/>
    <path d="m40 73 4-5m5-3 4-2m34 0 4 2m5 3 4 5m-63 34 6 5m-1 4 6 4m49-13-6 5m1 4-6 4M53 129l5 4m24-4-5 4" fill="none" stroke="#b8a295" stroke-width="1.3" stroke-linecap="round" opacity=".65"/>
    <path d="M48 94q22-15 44 0l-12 20q-10 9-20 0Z" fill="#a78c7c"/>
    <path d="M57 96q13-7 26 0l-7 14H64Z" fill="#bba08e" stroke="none"/>
    <path d="M62 119q8 5 16 0" fill="none" stroke="#c3a595" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M49 64q9-5 17-4" fill="none" stroke="#c8b4a1" stroke-width="2" stroke-linecap="round" opacity=".4"/>
  `,
  kitten: `
    <path d="M45 148C16 148 9 135 15 121q4-9 10-4c7 8-8 12 1 19l16 3" fill="none" stroke="#dfa66c" stroke-width="13" stroke-linecap="round"/>
    <path d="m14 130 10 3m-2-17 3 5" fill="none" stroke="#a86c3f" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="70" cy="141" rx="31" ry="37" fill="#dfa66c"/>
    <path d="M51 124q19 12 38 0l-8 37H59Z" fill="#fff1d9" stroke="none"/>
    <path d="M33 78 29 36Q43 39 55 59q15-6 30 0 12-20 26-23l-4 42q9 14 5 24l-7 2 2 6-8 2c-8 10-18 16-29 17-11-1-21-7-29-17l-8-2 2-6-7-2q-4-10 5-24Z" fill="#dfa66c"/>
    <path d="m36 47 3 27 12-12Zm68 0-3 27-12-12Z" fill="#dfa5a0" stroke="none"/>
    <path d="m39 56 3 12 6-5m53-7-3 12-6-5" fill="#f5c1b4" stroke="none"/>
    <path d="m58 62 4 12 8-10 8 10 4-12m-13-5 1 7M34 85l12 5m-13 7 12 3m61-15-12 5m13 7-12 3" fill="none" stroke="#9f663e" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="m43 118 5 4m49-4-5 4m-49 13 9 3m45-3-9 3" fill="none" stroke="#ad7547" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="58" cy="107" rx="15" ry="10" fill="#fff1d9" stroke="none"/>
    <ellipse cx="82" cy="107" rx="15" ry="10" fill="#fff1d9" stroke="none"/>
    <path d="M59 116q11 11 22 0" fill="#fff1d9" stroke="none"/>
  `,
};

let illustrationId = 0;
const coats: Record<Animal, { base: string; light: string; shade: string; blush: string }> = {
  bunny: { base: "#f4e8db", light: "#fffdf5", shade: "#cebcaa", blush: "#ed9aa8" },
  giraffe: { base: "#e9af47", light: "#ffe18b", shade: "#d28b32", blush: "#e79167" },
  unicorn: { base: "#fff8ed", light: "#ffffff", shade: "#d8ccec", blush: "#e99bc8" },
  monkey: { base: "#956248", light: "#bd8a60", shade: "#714633", blush: "#e3a082" },
  rhino: { base: "#a0b4bc", light: "#d0e0df", shade: "#78949e", blush: "#dcafba" },
  dog: { base: "#f6e6cd", light: "#fff8e9", shade: "#d5ba95", blush: "#e5b58e" },
  mole: { base: "#5c5351", light: "#8a7c75", shade: "#3b3536", blush: "#d2a2a5" },
  kitten: { base: "#dfa66c", light: "#ffdaa4", shade: "#bd7d44", blush: "#e7a294" },
};

export function accessorySVG(kind: TargetKind) {
  if (kind !== "party" && kind !== "crown") return "";
  const id = `hat-${++illustrationId}`;
  const gold = `<defs><linearGradient id="${id}" x2=".8" y2="1"><stop stop-color="#fff0a0"/><stop offset=".48" stop-color="#f8c74e"/><stop offset="1" stop-color="#d48c29"/></linearGradient></defs>`;
  return kind === "party" ? `${gold}<g class="party-hat" transform="rotate(-12 70 56)"><path d="M48 58L70 7l22 51Z" fill="#dc785d" stroke="#98563b" stroke-width="1.8"/><path d="M53 46l33 4-4-10-25-5m5-13l15 5" fill="#ffe1a0"/><path d="M70 10l-7 46h-9Z" fill="#fff8c8" opacity=".2"/><ellipse cx="70" cy="58" rx="23" ry="4" fill="#a8553f"/><ellipse cx="70" cy="56" rx="23" ry="4" fill="#f5bd78"/><circle cx="70" cy="8" r="6" fill="url(#${id})"/><circle cx="68" cy="6" r="2" fill="#fff5c9"/></g>`
    : `${gold}<g class="royal-crown"><path d="M45 54l-4-30 18 13L70 15l11 22 18-13-4 30Z" fill="url(#${id})" stroke="#a7762c" stroke-width="1.7" stroke-linejoin="round"/><path d="M47 49h46v8H47Z" fill="#e5a83b" stroke="#a7762c" stroke-width="1.4"/><path d="M48 50h44" stroke="#ffed9d" stroke-width="2"/><path d="M53 39l-6-8 3 15m18-23-7 19" fill="none" stroke="#fff8c8" stroke-width="2.5" opacity=".75"/><path d="M70 37l5 7-5 7-5-7Z" fill="#cc665d" stroke="#a34c4a"/><path d="M68 41l2-2 2 3" stroke="#ffb6a1" stroke-width="1.5" fill="none"/><circle cx="41" cy="24" r="3" fill="#ffe286"/><circle cx="70" cy="15" r="3.5" fill="#ffe286"/><circle cx="99" cy="24" r="3" fill="#ffe286"/></g>`;
}

function speciesFace(animal: Animal, kind: TargetKind): string | null {
  let open: string, closed: string, bonked: string, muzzle: string;
  if (animal === "bunny") {
    open = `<path d="M43 84q5-8 12-2m30 0q7-6 12 2" fill="none" stroke="#d5c4b2" stroke-width="2" stroke-linecap="round"/>
      <ellipse cx="49" cy="87" rx="4.8" ry="6.6" fill="#3d342e"/><ellipse cx="91" cy="87" rx="4.8" ry="6.6" fill="#3d342e"/>
      <ellipse cx="49.8" cy="88" rx="3.2" ry="4.8" fill="#191f1b"/><ellipse cx="90.2" cy="88" rx="3.2" ry="4.8" fill="#191f1b"/>
      <circle cx="47.7" cy="84.5" r="1.5" fill="#fffef5"/><circle cx="89.7" cy="84.5" r="1.5" fill="#fffef5"/>`;
    closed = `<path d="M43 87q6 5 12 0m30 0q6 5 12 0"/>`;
    bonked = `<path d="M43 88q6-7 12 0m30 0q6-7 12 0"/>`;
    muzzle = `<path d="M66 102q4-3 8 0 0 3-4 5-4-2-4-5Z" fill="#ca8f96" stroke="#a9757d" stroke-width=".8"/>
      <path class="critter-smile" d="M70 107v5m0 0q-5 5-10 0m10 0q5 5 10 0" fill="none" stroke="#8a7263" stroke-width="1.3" stroke-linecap="round"/>
      <g fill="none" stroke="#aa9784" stroke-width="1.15" stroke-linecap="round"><path d="m49 105-27-7m27 12-31 0m32 5-25 8m66-18 27-7m-27 12 31 0m-32 5 25 8"/></g>
      <g fill="#baa18a"><circle cx="52" cy="107" r=".9"/><circle cx="56" cy="111" r=".8"/><circle cx="88" cy="107" r=".9"/><circle cx="84" cy="111" r=".8"/></g>`;
  } else if (animal === "rhino") {
    open = `<path d="M40 79q8-5 16-1m28 0q8-4 16 1" fill="none" stroke="#647c83" stroke-width="2.6" stroke-linecap="round"/>
      <ellipse cx="48" cy="86" rx="4.4" ry="5" fill="#34474b"/><ellipse cx="92" cy="86" rx="4.4" ry="5" fill="#34474b"/>
      <ellipse cx="48" cy="86.5" rx="2.8" ry="3.6" fill="#172c30"/><ellipse cx="92" cy="86.5" rx="2.8" ry="3.6" fill="#172c30"/>
      <circle cx="46.8" cy="84.5" r="1.3" fill="#f3f8ec"/><circle cx="90.8" cy="84.5" r="1.3" fill="#f3f8ec"/>`;
    closed = `<path d="M42 86q6 5 12 0m32 0q6 5 12 0"/>`;
    bonked = `<path d="M42 87q6-7 12 0m32 0q6-7 12 0"/>`;
    muzzle = `<ellipse cx="48" cy="111" rx="4.5" ry="3.1" transform="rotate(15 48 111)" fill="#5c747c"/>
      <ellipse cx="92" cy="111" rx="4.5" ry="3.1" transform="rotate(-15 92 111)" fill="#5c747c"/>
      <path d="M42 106q5-4 10-1m36 0q5-3 10 1" fill="none" stroke="#91a7ac" stroke-width="1.5" stroke-linecap="round"/>
      <path class="critter-smile" d="M55 120q15 6 30 0" fill="none" stroke="#627c84" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M37 99q-2 7 1 11m64 0q3-4 1-11" fill="none" stroke="#829ca4" stroke-width="1.2" stroke-linecap="round"/>`;
  } else if (animal === "mole") {
    open = `<ellipse cx="45" cy="87" rx="3.1" ry="3.4" fill="#1b1b1a" stroke="#9d8d80" stroke-width=".6"/>
      <ellipse cx="95" cy="87" rx="3.1" ry="3.4" fill="#1b1b1a" stroke="#9d8d80" stroke-width=".6"/>
      <circle cx="44.2" cy="85.9" r=".85" fill="#f3e9da"/><circle cx="94.2" cy="85.9" r=".85" fill="#f3e9da"/>`;
    closed = `<path d="M41 88q4 3 8 0m42 0q4 3 8 0"/>`;
    bonked = `<path d="M41 88q4-5 8 0m42 0q4-5 8 0"/>`;
    muzzle = `<ellipse cx="70" cy="111" rx="9" ry="6.5" fill="#d79a9d" stroke="#9f7174" stroke-width="1"/>
      <path d="M64 109q6-3 12 0" fill="none" stroke="#edbdba" stroke-width="1.7" stroke-linecap="round"/>
      <ellipse cx="66" cy="112" rx="1.4" ry="1" fill="#9c686e"/><ellipse cx="74" cy="112" rx="1.4" ry="1" fill="#9c686e"/>
      <path class="critter-smile" d="M65 120q5 2 10 0" fill="none" stroke="#5a4540" stroke-width="1.2" stroke-linecap="round"/>
      <path d="m55 106-16-5m16 10-18 1m19 3-14 6m43-15 16-5m-16 10 18 1m-19 3 14 6" fill="none" stroke="#b5a08e" stroke-width=".9" stroke-linecap="round"/>`;
  } else if (animal === "kitten") {
    open = `<path d="M44 84q8-10 20-2-8 12-20 2Zm32-2q12-8 20 2-12 10-20-2Z" fill="#a7bd68" stroke="#624c36" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M55 79q-3 5 0 10 3-5 0-10Zm30 0q-3 5 0 10 3-5 0-10Z" fill="#23382c"/>
      <circle cx="52" cy="82" r="1.3" fill="#fffce7"/><circle cx="82" cy="82" r="1.3" fill="#fffce7"/>
      <path d="M43 83q9-10 21-1m12 0q12-9 21 1" fill="none" stroke="#775237" stroke-width="1.8" stroke-linecap="round"/>`;
    closed = `<path d="M44 84q10 7 20-1m12 0q10 8 20 1m-50 2-2 2m50-2 2 2"/>`;
    bonked = `<path d="M45 86q9-9 18 0m14 0q9-9 18 0"/>`;
    muzzle = `<path d="M64 101q6-3 12 0l-6 7Z" fill="#c47e83" stroke="#9f666b" stroke-width=".8" stroke-linejoin="round"/>
      <path d="m67 102 3 1 3-1" fill="none" stroke="#edb2ac" stroke-width="1.3" stroke-linecap="round"/>
      <path class="critter-smile" d="M70 108v5m0 0q-5 5-10 0m10 0q5 5 10 0" fill="none" stroke="#77573e" stroke-width="1.4" stroke-linecap="round"/>
      <path d="m49 104-29-6m29 11-32 2m33 3-27 10m68-20 29-6m-29 11 32 2m-33 3 27 10" fill="none" stroke="#765c45" stroke-width="1.1" stroke-linecap="round"/>
      <g fill="#b68b62"><circle cx="53" cy="104" r=".85"/><circle cx="58" cy="108" r=".85"/><circle cx="52" cy="111" r=".85"/><circle cx="87" cy="104" r=".85"/><circle cx="82" cy="108" r=".85"/><circle cx="88" cy="111" r=".85"/></g>`;
  } else return null;
  const line = animal === "rhino" ? "#4e6870" : animal === "mole" ? "#b5a08e" : "#705747";
  const eyes = kind === "sleepy"
    ? `<g class="sleepy-eyes" fill="none" stroke="${line}" stroke-width="2" stroke-linecap="round">${closed}</g>`
    : `<g class="eyes-open">${open}</g><g class="eyes-bonk" fill="none" stroke="${line}" stroke-width="2.3" stroke-linecap="round">${bonked}</g>`;
  const sleepMark = kind !== "sleepy" ? "" : `<g fill="#527c87" font-family="Georgia" font-style="italic"><text x="107" y="65" font-size="15">z</text><text x="120" y="48" font-size="11">z</text></g>`;
  return `${eyes}${muzzle}${sleepMark}`;
}

function speciesPaws(animal: Animal, fill: string, shade: string): string | null {
  if (animal === "bunny") return `<g fill="${fill}" stroke="${shade}" stroke-width="1.1"><ellipse cx="49" cy="129" rx="8" ry="13" transform="rotate(-9 49 129)"/><ellipse cx="91" cy="129" rx="8" ry="13" transform="rotate(9 91 129)"/><path d="m46 132 0 4m5-4 0 4m37-4 0 4m5-4 0 4" fill="none" stroke-linecap="round"/></g>`;
  if (animal === "rhino") {
    const foot = `<path d="M38 128q10-5 20 0l2 12H36Z" fill="${fill}"/><path d="M39 134h5v6h-6Zm7 0h5v6h-5Zm7 0h4l1 6h-5Z" fill="#dadbcd" stroke-width=".8"/>`;
    return `<g stroke="${shade}" stroke-width="1.3">${foot}<g transform="translate(140 0) scale(-1 1)">${foot}</g></g>`;
  }
  if (animal === "mole") {
    const paw = `<path d="M43 119c-6-8-16-11-22-7l-6 7q-6 9 0 14c8 8 22 4 29-2l3-7Z" fill="#c1a18e" stroke="#806658" stroke-width="1.2"/>
      <g fill="#e8d7bd" stroke="#88705e" stroke-width=".9" stroke-linejoin="round"><path d="m33 115-4-11q-5-1-4 6l2 9Zm-8 0-9-10q-5 1-1 8l6 8Zm-7 6-11-7q-4 3 1 8l7 5Zm-3 7-11-3q-2 4 4 7l9 2Zm4 6h-9q-2 4 5 5l9-3Z"/></g>
      <path d="m24 120 6 5m-10 2 7 3m-4 4 6-1m8-13-3 7" fill="none" stroke="#967561" stroke-width="1.1" stroke-linecap="round"/>`;
    return `<g>${paw}<g transform="translate(140 0) scale(-1 1)">${paw}</g></g>`;
  }
  if (animal === "kitten") return `<g fill="#fff1d9" stroke="${shade}" stroke-width="1.1"><ellipse cx="49" cy="131" rx="9" ry="9"/><ellipse cx="91" cy="131" rx="9" ry="9"/><path d="M46 131v5m5-5v5m37-5v5m5-5v5" fill="none" stroke-linecap="round"/></g>`;
  return null;
}

export function characterSVG(animal: Animal, kind: TargetKind = "normal") {
  const id = `critter-${++illustrationId}`;
  const coat = coats[animal];
  const shadedBody = bodies[animal].replaceAll(`fill="${coat.base}"`, `fill="url(#${id}-coat)"`);
  const definitions = `<defs><radialGradient id="${id}-coat" cx=".32" cy=".2" r=".95"><stop stop-color="${coat.light}"/><stop offset=".42" stop-color="${coat.base}"/><stop offset="1" stop-color="${coat.shade}"/></radialGradient><radialGradient id="${id}-cheek"><stop stop-color="${coat.blush}" stop-opacity=".75"/><stop offset="1" stop-color="${coat.blush}" stop-opacity="0"/></radialGradient></defs>`;
  const eyes = kind === "sleepy"
    ? `<g class="sleepy-eyes"><path d="M47 85q8 9 16 0m14 0q8 9 16 0" stroke="#59473c" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M49 88l-2 3m14-3l2 3m16-3l-2 3m14-3l2 3" stroke="#59473c" stroke-width="1.5"/><text x="100" y="62" fill="#527c87" font-size="17" font-family="Georgia" font-style="italic">z</text><text x="113" y="46" fill="#527c87" font-size="12" font-family="Georgia" font-style="italic">z</text></g>`
    : `<g class="eyes-open"><ellipse cx="55" cy="85" rx="8.3" ry="10" fill="#fffdf4" stroke="#735947" stroke-width="1.1"/><ellipse cx="85" cy="85" rx="8.3" ry="10" fill="#fffdf4" stroke="#735947" stroke-width="1.1"/><ellipse cx="56.5" cy="86" rx="5.8" ry="7.4" fill="#513e32"/><ellipse cx="83.5" cy="86" rx="5.8" ry="7.4" fill="#513e32"/><ellipse cx="57" cy="88" rx="4" ry="4.5" fill="#2d3028"/><ellipse cx="83" cy="88" rx="4" ry="4.5" fill="#2d3028"/><circle cx="54" cy="82" r="2.6" fill="white"/><circle cx="81" cy="82" r="2.6" fill="white"/><circle cx="59" cy="88" r="1.15" fill="#ffedc9"/><circle cx="86" cy="88" r="1.15" fill="#ffedc9"/><path d="M48 73q7-4 13-1m18 0q7-3 13 1" stroke="#644936" stroke-opacity=".45" stroke-width="2" stroke-linecap="round" fill="none"/></g><g class="eyes-bonk"><path d="M47 86q8-11 16 0m14 0q8-11 16 0" fill="none" stroke="#554234" stroke-width="3.5" stroke-linecap="round"/><path d="M59 110q11 14 22 0" fill="#cc786e" stroke="#785142" stroke-width="1.5"/><path d="M65 118q6-4 12 0" stroke="#f5a39a" stroke-width="3" stroke-linecap="round"/></g>`;
  const hat = accessorySVG(kind);
  const face = speciesFace(animal, kind) ?? `<path d="M45 73q3-11 13-12" fill="none" stroke="#fffaf0" stroke-opacity=".45" stroke-width="3" stroke-linecap="round"/><ellipse cx="43" cy="100" rx="11" ry="7" fill="url(#${id}-cheek)"/><ellipse cx="97" cy="100" rx="11" ry="7" fill="url(#${id}-cheek)"/>${eyes}<path class="critter-smile" d="M62 113q8 7 16 0" fill="none" stroke="#7b5a47" stroke-width="1.8" stroke-linecap="round"/>`;
  const paws = speciesPaws(animal, `url(#${id}-coat)`, coat.shade) ?? (animal === "giraffe" || animal === "unicorn" ? "" : `<g class="critter-paws" fill="url(#${id}-coat)" stroke="${coat.shade}" stroke-width="1.2"><ellipse cx="44" cy="132" rx="10" ry="7" transform="rotate(-12 44 132)"/><ellipse cx="96" cy="132" rx="10" ry="7" transform="rotate(12 96 132)"/><path d="M41 132v3m5-3v3m47-3v3m5-3v3" stroke-linecap="round" opacity=".65"/></g>`);
  return `<svg class="critter-art critter-${animal}" viewBox="0 0 140 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${definitions}<g class="critter-body"><g stroke="#604d3b" stroke-opacity=".26" stroke-width="1.2" stroke-linejoin="round">${shadedBody}</g>${face}${paws}${hat}</g><g class="dizzy-stars" fill="#ffe18b" stroke="#b67d38" stroke-width=".8"><path d="M24 59l2-6 3 5 6 1-5 4v6l-5-4-6 1 3-5Z"/><path d="M111 63l2-5 3 4 5 1-4 3v5l-5-3-5 1 3-5Z"/><circle cx="38" cy="51" r="2.5"/><circle cx="107" cy="49" r="2"/></g></svg>`;
}

export function mixedSVG() {
  return `<span class="mixed-art">${characterSVG("giraffe")}${characterSVG("bunny")}${characterSVG("monkey")}</span>`;
}
