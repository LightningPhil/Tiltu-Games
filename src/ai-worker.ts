import {lifeComputer} from './life.ts';
import { chooseMove } from './ai.ts';
import { generatePuzzle } from './sudoku.ts';
import { chooseChessMove } from './chess.ts';
import { chooseGoMove } from './go.ts';

self.onmessage = event => {
  try {
    const data = event.data;
    if(data.type==='life'){lifeComputer(data.session,data.level);self.postMessage({result:data.session});return;}
    const result = data.type === 'puzzle' ? generatePuzzle(data.size, data.difficulty)
      : data.type === 'chess' ? chooseChessMove(data.session, data.level)
      : data.type === 'go' ? chooseGoMove(data.session, data.level)
      : chooseMove(data.game, data.board, data.player, data.level);
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
