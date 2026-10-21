import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Chess, chessCaptures, chessEngine, chessOutcome, CHESS_LEVELS, chooseChessMove, newChess, playChess, undoChess } from '../src/chess.ts';
import { defaultOptions } from '../src/state.ts';
import { chessArena } from '../src/advanced-view.ts';

const local = () => ({ ...defaultOptions(), mode: 'local' as const });
test('chess opens with twenty legal moves and rejects moves exposing the king', () => {
  const s = newChess(local()), engine = chessEngine(s);
  assert.equal(engine.moves().length, 20);
  const pinned = new Chess('4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1');
  assert(!pinned.moves({ square: 'e2' }).includes('Rd2'));
  assert.throws(() => playChess(s, { from: 'e2', to: 'e5' }));
  assert.equal(s.moves.length, 0);
});
test('castling is legal only with a clear, unattacked route and retained rights', () => {
  const castle = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  assert(castle.moves().includes('O-O')); assert(castle.moves().includes('O-O-O'));
  const move = castle.move('O-O');
  assert(move.isKingsideCastle()); assert.equal(castle.get('g1')?.type, 'k'); assert.equal(castle.get('f1')?.type, 'r');
  const attacked = new Chess('r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1');
  assert(!attacked.moves().includes('O-O'));
});
test('en passant removes the passed pawn and all four promotion choices exist', () => {
  const s = newChess(local());
  for (const move of ['e4', 'a6', 'e5', 'd5']) playChess(s, move);
  const ep = playChess(s, 'exd6');
  assert(ep.isEnPassant()); assert.equal(chessEngine(s).get('d5'), undefined);
  const p = new Chess('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
  assert.deepEqual(p.moves({ square: 'a7', verbose: true }).map(m => m.promotion).sort(), ['b', 'n', 'q', 'r']);
  p.move({ from: 'a7', to: 'a8', promotion: 'n' }); assert.equal(p.get('a8')?.type, 'n');
});
test('checkmate, stalemate, repetition and fifty-move draws have clear results', () => {
  const s = newChess(local());
  for (const m of ['f3', 'e5', 'g4', 'Qh4#']) playChess(s, m);
  assert.equal(s.result, -1); assert.equal(s.reason, 'Checkmate'); assert.deepEqual(s.scores, [0, 1, 0]);
  assert(undoChess(s)); assert.equal(s.result, null); assert.deepEqual(s.scores, [0, 0, 0]);
  assert.equal(chessOutcome(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')).reason, 'Stalemate');
  const repeat = newChess(local());
  for (const m of ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']) playChess(repeat, m);
  assert.equal(repeat.reason, 'Threefold repetition');
  assert.match(chessOutcome(new Chess('4k2r/8/8/8/8/8/8/R3K3 w - - 100 51')).reason, /50 moves/);
});
test('chess undo versus the computer rewinds a complete human turn and reply', () => {
  const s = newChess(defaultOptions()); playChess(s, 'e4'); playChess(s, 'e5');
  assert(undoChess(s)); assert.equal(s.moves.length, 0);
  const black = newChess({ ...defaultOptions(), human: -1 }); playChess(black, 'e4');
  assert.equal(undoChess(black), false); playChess(black, 'e5'); playChess(black, 'Nf3');
  assert(undoChess(black)); assert.deepEqual(black.moves, ['e4']);
});
test('captured pieces follow both sides of an exchange, undo and restored move history', () => {
  const s = newChess(local());
  const captures = () => chessCaptures(chessEngine(s).history({ verbose: true }));
  assert.deepEqual(captures(), { white: [], black: [] });
  for (const move of ['e4', 'd5', 'exd5', 'Qxd5']) playChess(s, move);
  assert.deepEqual(captures(), { white: ['p'], black: ['p'] });
  const restored = JSON.parse(JSON.stringify(s));
  assert.deepEqual(chessCaptures(chessEngine(restored).history({ verbose: true })), captures());
  assert(undoChess(s));
  assert.deepEqual(captures(), { white: ['p'], black: [] });
  assert(undoChess(s));
  assert.deepEqual(captures(), { white: [], black: [] });
});
test('capture lists include en passant and promoted pieces without treating promotion as a capture', () => {
  const ep = newChess(local());
  for (const move of ['e4', 'a6', 'e5', 'd5', 'exd6']) playChess(ep, move);
  assert.deepEqual(chessCaptures(chessEngine(ep).history({ verbose: true })), { white: ['p'], black: [] });
  const promoted = new Chess('1r2k3/P7/8/8/8/8/8/4K3 w - - 0 1');
  promoted.move('a8=Q');
  assert.deepEqual(chessCaptures(promoted.history({ verbose: true })), { white: [], black: [] });
  promoted.move('Rxa8');
  assert.deepEqual(chessCaptures(promoted.history({ verbose: true })), { white: [], black: ['q'] });
});
test('chess shows the captured piece colours and names in a panel beside the board', () => {
  const s = newChess(local());
  for (const move of ['e4', 'd5', 'exd5']) playChess(s, move);
  const view = chessArena(s, { canPlay: true, busy: false, selected: null, focus: 0, message: '' });
  assert(view.indexOf('class="chess-captures"') > view.indexOf('class="chess-board"'));
  assert.match(view, /Taken by White<\/h3><p class="capture-count">1 piece/);
  assert.match(view, /class="captured-piece chess-black" role="img" aria-label="Black pawn"/);
  assert.match(view, /Taken by Black<\/h3><p class="capture-count">0 pieces/);
});
test('all five chess levels return legal moves and higher settings take mate in one', () => {
  const start = newChess(defaultOptions());
  for (let level = 1; level <= 5; level++) {
    const answer = chooseChessMove(start, level, () => .31);
    assert(chessEngine(start).moves().includes(answer.move!));
    if (level > 1) assert(CHESS_LEVELS[level - 1].depth > CHESS_LEVELS[level - 2].depth);
  }
  const mate = { startFen: '7k/5Q2/6K1/8/8/8/8/8 w - - 0 1', moves: [] };
  for (let level = 2; level <= 5; level++) {
    const answer = chooseChessMove(mate, level, () => .4), engine = chessEngine(mate);
    engine.move(answer.move!); assert(engine.isCheckmate());
  }
});
