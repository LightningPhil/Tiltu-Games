// A reproducible, colour-balanced strength check. Node 22.18+ runs this directly.
// Draws count as half a point. This is a regression sample, not a rating claim.
import assert from 'node:assert/strict';
import { chooseMove } from '../src/ai.ts';
import { applyMove, drawReason, initialBoard, legalMoves, other, positionKey, winner } from '../src/rules.ts';
import type { DraughtsMove, DuelGame, Player } from '../src/rules.ts';

function random(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
const seedCount = Number(process.env.AI_SEEDS ?? 3);
const summary: unknown[] = [];
for (const game of ['four', 'draughts'] as DuelGame[]) {
  for (let lower = 1; lower < 5; lower++) {
    let wins = 0, losses = 0, draws = 0, maxDepth = [0, 0], totalNodes = [0, 0], moves = [0, 0];
    const start = performance.now();
    for (let seed = 1; seed <= seedCount; seed++) for (const higherSide of [1, -1] as Player[]) {
      const rng = random(5700 + seed), openingRng = random(1200 + seed);
      let board = initialBoard(game), turn: Player = 1, quiet = 0, outcome: Player | 0 | null = null;
      const positions = [positionKey(board, turn)];
      // Identical random opening in each colour-paired game prevents opening bias.
      for (let ply = 0; ply < (game === 'four' ? 4 : 6); ply++) {
        const legal = legalMoves(game, board, turn), move = legal[Math.floor(openingRng() * legal.length)];
        board = applyMove(game, board, turn, move); turn = other(turn); positions.push(positionKey(board, turn));
      }
      for (let ply = 0; ply < (game === 'four' ? 42 : 180); ply++) {
        outcome = winner(game, board, turn);
        if (outcome !== null) break;
        const index = turn === higherSide ? 1 : 0, level = lower + index;
        const answer = chooseMove(game, board, turn, level, rng);
        assert(answer.move !== null);
        assert(legalMoves(game, board, turn).some(m => JSON.stringify(m) === JSON.stringify(answer.move)));
        maxDepth[index] = Math.max(maxDepth[index], answer.depth); totalNodes[index] += answer.nodes; moves[index]++;
        if (game === 'draughts') {
          const m = answer.move as DraughtsMove;
          quiet = m.captures.length || Math.abs(board[m.from]) === 1 ? 0 : quiet + 1;
        }
        board = applyMove(game, board, turn, answer.move!); turn = other(turn); positions.push(positionKey(board, turn));
        outcome = winner(game, board, turn);
        if (outcome !== null) break;
        if (game === 'draughts' && drawReason(positions, quiet)) { outcome = 0; break; }
      }
      if (outcome === higherSide) wins++; else if (outcome === other(higherSide)) losses++; else draws++;
    }
    const result = { game, higher: lower + 1, lower, wins, draws, losses, points: wins + draws / 2,
      games: seedCount * 2, maxDepth, averageNodes: totalNodes.map((n, i) => Math.round(n / moves[i])), seconds: Math.round((performance.now() - start) / 1000) };
    summary.push(result);
    console.log(JSON.stringify(result));
    assert(wins > losses, `${game}: level ${lower + 1} did not outperform level ${lower} in the paired sample`);
  }
}
console.log(`Strength check passed: ${seedCount * 16} colour-balanced matches.`);
