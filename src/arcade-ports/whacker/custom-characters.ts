/** Ported from whack-a; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import { isCustomCharacter } from "./game.ts";
import type { CustomCharacterId } from "./game.ts";

export interface CustomCharacter { id: CustomCharacterId; name: string; image: string }
const KEY = "whack-a-party.characters.v1";
export const MAX_CUSTOM_CHARACTERS = 8;
const MAX_STORED_CHARS = 2_000_000;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export function validatePngHeader(bytes: ArrayBuffer) {
  const data = new Uint8Array(bytes);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (data.length < 33 || signature.some((value, index) => data[index] !== value)
    || data[12] !== 73 || data[13] !== 72 || data[14] !== 68 || data[15] !== 82) {
    throw new Error("Choose a valid PNG image.");
  }
  const view = new DataView(bytes);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (!width || !height || width > 8192 || height > 8192 || width * height > 16_777_216) {
    throw new Error("That PNG is too large. Use an image with at most 16 million pixels and sides under 8192 pixels.");
  }
  return { width, height };
}

export function opaqueBounds(pixels: Uint8ClampedArray, width: number, height: number) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (pixels[(y * width + x) * 4 + 3] > 0) {
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  return right < left ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

function validCharacter(value: unknown): value is CustomCharacter {
  if (!value || typeof value !== "object") return false;
  const character = value as CustomCharacter;
  return isCustomCharacter(character.id) && typeof character.name === "string"
    && character.name.trim().length > 0 && character.name.length <= 24
    && typeof character.image === "string" && character.image.length <= 1_000_000
    && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(character.image);
}

export function loadCustomCharacters(): CustomCharacter[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw || raw.length > MAX_STORED_CHARS) return [];
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const ids = new Set<string>();
    return value.filter(validCharacter).filter(character => {
      if (ids.has(character.id)) return false;
      ids.add(character.id); return true;
    }).slice(0, MAX_CUSTOM_CHARACTERS);
  } catch { return []; }
}

function persist(characters: CustomCharacter[]) {
  const data = JSON.stringify(characters);
  if (data.length > MAX_STORED_CHARS) throw new Error("Your custom character gallery is full. Remove an old character before adding this one.");
  try { localStorage.setItem(KEY, data); }
  catch { throw new Error("This browser couldn’t save the character. Free some browser storage or enable local storage, then try again."); }
}

export function saveCustomCharacter(character: CustomCharacter) {
  if (!validCharacter(character)) throw new Error("The character needs a name and a valid PNG image.");
  const characters = loadCustomCharacters().filter(item => item.id !== character.id);
  if (characters.length >= MAX_CUSTOM_CHARACTERS) throw new Error("You can keep eight custom characters. Remove one to make room.");
  // Write first. A failed save must never appear to be a persistent gallery item.
  persist([...characters, character]);
}

export function removeCustomCharacter(id: CustomCharacterId) {
  persist(loadCustomCharacters().filter(character => character.id !== id));
}

/** Resize and trim in the browser, without flattening alpha or sending the photo anywhere. */
export async function prepareCustomPng(file: File) {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Choose a PNG smaller than 8 MB.");
  validatePngHeader(await file.slice(0, 33).arrayBuffer());
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try { await image.decode(); } catch { throw new Error("That PNG couldn’t be opened. Try another image."); }
    const work = document.createElement("canvas");
    const scale = Math.min(1, 512 / image.naturalWidth, 512 / image.naturalHeight);
    work.width = Math.max(1, Math.round(image.naturalWidth * scale));
    work.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = work.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("This browser couldn’t prepare the PNG.");
    context.drawImage(image, 0, 0, work.width, work.height);
    const bounds = opaqueBounds(context.getImageData(0, 0, work.width, work.height).data, work.width, work.height);
    if (!bounds) throw new Error("That PNG is completely transparent. Choose one with a visible character.");
    const output = document.createElement("canvas");
    output.width = 384; output.height = 448;
    const outputContext = output.getContext("2d");
    if (!outputContext) throw new Error("This browser couldn’t prepare the PNG.");
    const fit = Math.min(352 / bounds.width, 416 / bounds.height);
    const width = bounds.width * fit, height = bounds.height * fit;
    outputContext.drawImage(work, bounds.left, bounds.top, bounds.width, bounds.height, (384 - width) / 2, (448 - height) / 2, width, height);
    return output.toDataURL("image/png");
  } finally { URL.revokeObjectURL(url); }
}
