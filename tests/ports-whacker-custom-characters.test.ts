import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCustomCharacters, opaqueBounds, removeCustomCharacter, saveCustomCharacter, validatePngHeader } from "../src/arcade-ports/whacker/custom-characters.ts";
import { loadSettings, saveSettings } from "../src/arcade-ports/whacker/storage.ts";

function storage(value?: string, blocked = false) {
  const data = new Map(value ? [["whack-a-party.characters.v1", value]] : []);
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem(key: string) { return data.get(key) ?? null; },
    setItem(key: string, value: string) { if (blocked) throw new Error("Full"); data.set(key, value); },
  } });
  return data;
}
const character = { id: "custom:person" as const, name: "My person", image: "data:image/png;base64,iVBORw0KGgo=" };

test("PNG headers reject disguised non-PNG files and excessive dimensions", () => {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  bytes.set([73, 72, 68, 82], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 800); view.setUint32(20, 1200);
  assert.deepEqual(validatePngHeader(bytes.buffer), { width: 800, height: 1200 });
  assert.throws(() => validatePngHeader(new ArrayBuffer(12)), /valid PNG/);
  view.setUint32(16, 9000);
  assert.throws(() => validatePngHeader(bytes.buffer), /too large/);
  view.setUint32(16, 8192); view.setUint32(20, 8192);
  assert.throws(() => validatePngHeader(bytes.buffer), /too large/);
  bytes[0] = 0;
  assert.throws(() => validatePngHeader(bytes.buffer), /valid PNG/);
});

test("transparent margins trim to visible pixels, including translucent edges", () => {
  const pixels = new Uint8ClampedArray(4 * 4 * 4);
  assert.equal(opaqueBounds(pixels, 4, 4), null);
  pixels[(1 * 4 + 1) * 4 + 3] = 1;
  pixels[(2 * 4 + 2) * 4 + 3] = 255;
  assert.deepEqual(opaqueBounds(pixels, 4, 4), { left: 1, top: 1, width: 2, height: 2 });
});

test("saved custom PNGs and selection are recalled on a later load", () => {
  const data = storage();
  saveCustomCharacter(character);
  assert.deepEqual(loadCustomCharacters(), [character]);
  assert.ok(data.get("whack-a-party.characters.v1")!.includes(character.image));
  saveSettings({ character: character.id, difficulty: "relaxed", mode: "timed", name: "Player", sound: false, attemptsPerPop: 1 });
  assert.equal(loadSettings().character, character.id);
  assert.equal(loadSettings().attemptsPerPop, 1);
  removeCustomCharacter(character.id);
  assert.deepEqual(loadCustomCharacters(), []);
});

test("corrupt galleries, duplicate IDs and unsafe image URLs are handled safely", () => {
  storage("broken json");
  assert.deepEqual(loadCustomCharacters(), []);
  storage(JSON.stringify([character, character, { ...character, id: "custom:other", image: 'javascript:alert(1)' }]));
  assert.deepEqual(loadCustomCharacters(), [character]);
  assert.throws(() => saveCustomCharacter({ ...character, image: 'data:image/svg+xml,<svg onload="alert(1)"/>' }), /valid PNG/);
});

test("failed saves and oversized galleries preserve existing characters", () => {
  const initial = JSON.stringify([character]);
  const data = storage(initial, true);
  assert.throws(() => saveCustomCharacter({ ...character, id: "custom:new" }), /couldn’t save/);
  assert.equal(data.get("whack-a-party.characters.v1"), initial);
  storage();
  for (let index = 0; index < 8; index++) saveCustomCharacter({ ...character, id: `custom:${index}` });
  assert.throws(() => saveCustomCharacter(character), /eight custom/);
  assert.equal(loadCustomCharacters().length, 8);
});

test("default and invalid tap allowances recover to two; new built-ins remain selectable", () => {
  const data = storage();
  data.set("whack-a-party.settings.v1", JSON.stringify({ character: "kitten", attemptsPerPop: 99 }));
  assert.equal(loadSettings().character, "kitten");
  assert.equal(loadSettings().attemptsPerPop, 2);
  data.set("whack-a-party.settings.v1", JSON.stringify({ character: "mole", attemptsPerPop: 1 }));
  assert.equal(loadSettings().character, "mole");
  assert.equal(loadSettings().attemptsPerPop, 1);
});
