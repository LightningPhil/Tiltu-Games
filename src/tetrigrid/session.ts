import {Game, type Mode, type Snapshot} from './game.ts';

/** Plain data only: the collection owns storage; a controller owns the live engine. */
export interface BlocksSession {
  version:2; run:Snapshot; ended:Game['ended']; phase:'ready'|'playing'|'over'|'won';
  paused:boolean; elapsed:number; resultRecorded:boolean;
}
export function newBlocks(mode:Mode='marathon'):BlocksSession {
  return {version:2,run:new Game(mode).snapshot(),ended:null,phase:'ready',paused:true,elapsed:0,resultRecorded:false};
}
export function restoreBlocks(value:unknown):BlocksSession|null {
  if(!value||typeof value!=='object')return null;
  const s=value as BlocksSession;
  if(s.version!==2||!['ready','playing','over','won'].includes(s.phase)||![null,'topout','complete'].includes(s.ended)||typeof s.resultRecorded!=='boolean')return null;
  if((s.phase==='over')!==(s.ended==='topout')||(s.phase==='won')!==(s.ended==='complete'))return null;
  const game=Game.restore(s.run,s.ended);if(!game)return null;
  return {version:2,run:game.snapshot(),ended:game.ended,phase:s.phase,paused:true,elapsed:game.elapsed/1000,resultRecorded:s.resultRecorded};
}
