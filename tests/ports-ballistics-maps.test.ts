import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Battle } from '../src/arcade-ports/ballistics/game.ts';
import { createSeededRandom, generateMap, HEIGHT, MAP_GENERATOR_VERSION, MAP_KINDS, MAP_STORAGE_KEY, parseMapCode, randomMapCode, readMapPreferences, rememberMap, WIDTH } from '../src/arcade-ports/ballistics/maps.ts';

function fingerprint(code: string) {
    const map = generateMap(code);
    return createHash('sha256').update(map.pixels).update(JSON.stringify(map.spawns)).digest('hex');
}

test('six-digit codes preserve zeros, accept pasted whitespace, and reject invalid input', () => {
    for (const code of ['000000', '000001', '042069', '999999']) assert.equal(parseMapCode(code), code);
    assert.equal(parseMapCode(' 012345\n'), '012345');
    for (const code of ['', '1', '12345', '1234567', '-12345', '12.345', '1e0000', '１２３４５６', 'abcdef', '12 345', '00000x']) {
        assert.equal(parseMapCode(code), null);
        assert.throws(() => generateMap(code), RangeError);
    }
});

test('version 1 golden fingerprints pin terrain and starting positions permanently', () => {
    assert.equal(MAP_GENERATOR_VERSION, 1);
    assert.equal(WIDTH, 1920); assert.equal(HEIGHT, 720);
    const fixtures = {
        '000000': '845d0d70c4e99ffa4c0d3d22663097b06143ca78676293fbe5fa31c361fde5d3',
        '000001': '8b8a13370cd9fb40ed39e81ab1a468e7327ec78098ebd9df0a115d3d8a314b2e',
        '000003': 'c8352d403aa2a4765c7ef306243694bd172745ab770850b2fc6bead2d889983b',
        '042069': 'f070d601c5fced273a8c319d04679cecb711ad43f0f29499cca7d7349d119f52',
        '123456': 'e897f11bc6f7cd3616d10ffd8339ca4152f8882388daaf35a77b222fcd271613',
        '654321': 'd41014acf3ef89f6eca552ef0d888d19bdac20b2ca1453941f01699363a4c041',
        '999999': 'bee55ba8a59f46528649746ae977a956b3b4b4ec0970709d8b20feda7d4df146',
    };
    for (const [code, expected] of Object.entries(fixtures)) assert.equal(fingerprint(code), expected, code);
});

test('regenerating a code is identical regardless of other maps or live randomness', () => {
    const before = generateMap('042069');
    for (let i = 0; i < 5; i++) generateMap(String(i).padStart(6, '0'));
    for (let i = 0; i < 100; i++) Math.random();
    const after = generateMap('042069');
    assert.deepEqual(before.pixels, after.pixels);
    assert.deepEqual(before.spawns, after.spawns);
    const a = new Battle('042069', () => 0.1);
    const b = new Battle('042069', () => 0.9);
    assert.deepEqual(a.terrain.pixels, b.terrain.pixels);
    assert.deepEqual(a.units, b.units);
    assert.notEqual(a.wind, b.wind);
});

test('named random streams repeat exactly and remain independent', () => {
    const a = createSeededRandom('000000', 'terrain-v1');
    const b = createSeededRandom('000000', 'terrain-v1');
    const c = createSeededRandom('000000', 'spawns-v1');
    const values = Array.from({ length: 200 }, () => a());
    assert.deepEqual(values, Array.from({ length: 200 }, () => b()));
    assert.notDeepEqual(values, Array.from({ length: 200 }, () => c()));
    assert.ok(values.every(value => value >= 0 && value < 1));
});

test('a thousand distributed codes have valid terrain, safe shelves, balanced spawns, and varied maps', () => {
    const kinds = new Set<string>();
    const hashes = new Set<string>();
    for (let i = 0; i < 1000; i++) {
        const code = String((i * 7919) % 1000000).padStart(6, '0');
        const map = generateMap(code);
        kinds.add(map.kind);
        assert.equal(map.pixels.length, WIDTH * HEIGHT);
        assert.equal(map.spawns.length, 6);
        for (const team of [0, 1]) assert.equal(map.spawns.filter(s => s.team === team).length, 3);
        for (const spawn of map.spawns) {
            assert.ok(spawn.x >= 120 && spawn.x <= WIDTH - 120);
            assert.ok(spawn.y >= 275 && spawn.y <= 520);
            for (let dx = -35; dx <= 35; dx++) {
                assert.equal(map.pixels[(spawn.y + 10) * WIDTH + spawn.x + dx], 1, `Support ${code}`);
                assert.equal(map.pixels[(spawn.y - 9) * WIDTH + spawn.x + dx], 0, `Headroom ${code}`);
            }
        }
        for (let third = 0; third < 3; third++) {
            const pair = map.spawns.filter(s => Math.floor(s.x / 640) === third);
            assert.equal(pair.length, 2); assert.notEqual(pair[0].team, pair[1].team);
        }
        if (i < 100) {
            const hash = createHash('sha256').update(map.pixels).digest('hex');
            assert.equal(hashes.has(hash), false, `Duplicate terrain ${code}`); hashes.add(hash);
        }
    }
    assert.deepEqual([...kinds].sort(), [...MAP_KINDS].sort());
});

test('destroying a map does not change its code or the pristine regenerated version', () => {
    const a = new Battle('000001');
    const b = new Battle('000001');
    a.explode(a.active.x, a.active.y, 60, 48);
    assert.notDeepEqual(a.terrain.pixels, b.terrain.pixels);
    const rematch = new Battle(a.mapCode);
    assert.deepEqual(rematch.terrain.pixels, b.terrain.pixels);
    assert.equal(a.mapCode, '000001');
});

test('random codes include valid zero-padded values and can all be recalled', () => {
    const codes = Array.from({ length: 100 }, () => randomMapCode());
    assert.ok(codes.every(code => parseMapCode(code) === code));
    assert.ok(new Set(codes).size > 90);
});

test('recent maps persist, deduplicate, move recalled codes to the front, and cap at eight', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); } };
    let recent: string[] = [];
    for (let i = 0; i < 12; i++) recent = rememberMap(storage, String(i).padStart(6, '0'), recent).recent;
    assert.equal(recent.length, 8);
    const saved = rememberMap(storage, '000007', recent);
    assert.equal(saved.recent[0], '000007');
    assert.equal(saved.recent.length, 8);
    assert.equal(saved.recent.filter(code => code === '000007').length, 1);
    assert.deepEqual(readMapPreferences(storage), saved);
});

test('missing, corrupt, restricted, and malformed storage do not break map generation', () => {
    assert.equal(readMapPreferences(undefined), null);
    assert.equal(readMapPreferences({ getItem: () => '{oops' }), null);
    assert.equal(readMapPreferences({ getItem: () => JSON.stringify({ selected: 123456 }) }), null);
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); } };
    assert.equal(readMapPreferences(broken), null);
    assert.deepEqual(rememberMap(broken, '000001', ['000001', 'bad']), { selected: '000001', recent: ['000001'] });
    const dirty = { getItem: (key: string) => key === MAP_STORAGE_KEY ? JSON.stringify({ selected: '000001', recent: ['bad', '000001', 123456, '000001', ' 042069 '] }) : null };
    assert.deepEqual(readMapPreferences(dirty), { selected: '000001', recent: ['000001', '042069'] });
});
