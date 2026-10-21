import { chooseTurnMove } from './turn-games.ts';
import { chooseBackgammonPath } from './backgammon.ts';
import { chooseCribPeg,chooseCribDiscards } from './cribbage.ts';
import { pegHint,slidingHint } from './puzzles.ts';
self.onmessage=event=>{try{const d=event.data;const result=d.type==='turn'?chooseTurnMove(d.session,d.level):d.type==='backgammon'?chooseBackgammonPath(d.session,d.level):d.type==='crib-peg'?chooseCribPeg(d.session):d.type==='crib-discard'?chooseCribDiscards(d.session.hands[0],d.session.dealer===0,d.level):d.type==='pegs'?pegHint(d.session):slidingHint(d.session);self.postMessage({result});}catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}};
