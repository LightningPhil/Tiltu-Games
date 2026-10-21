import {PLUS_GAMES} from './meta.ts';
import type {PlusGame} from './meta.ts';
import {assertBase} from './common.ts';
import {newAbstract,validAbstract} from './abstracts.ts';
import type {AbstractSession} from './abstracts.ts';
import {newRace,validRace,migrateLudo} from './race.ts';
import type {RaceSession} from './race.ts';
import {newHop,validHop} from './hop.ts';
import type {HopSession} from './hop.ts';
import {newDominoes,validDomino} from './dominoes.ts';
import type {DominoSession} from './dominoes.ts';
import {newTricks,validTricks} from './tricks.ts';
import type {TrickSession} from './tricks.ts';
import {newGin,validGin} from './gin.ts';
import type {GinSession} from './gin.ts';
import {newNumbers,validNumbers} from './numbers.ts';
import type {NumberSession} from './numbers.ts';
import {newLoop,newHashi,validLoop,validHashi} from './networks.ts';
import type {LoopSession,HashiSession} from './networks.ts';
import {newMemory,newWordSearch,validMemory,validWords} from './playful.ts';
import type {MemorySession,WordSession} from './playful.ts';
import {newTangram,validTangram} from './tangrams.ts';
import type {TangramSession} from './tangrams.ts';
export type PlusSession=AbstractSession|RaceSession|HopSession|DominoSession|TrickSession|GinSession|NumberSession|LoopSession|HashiSession|MemorySession|WordSession|TangramSession;
export type PlusStore=Record<PlusGame,PlusSession|null>;
export const emptyPlus=():PlusStore=>Object.fromEntries(PLUS_GAMES.map(k=>[k,null])) as PlusStore;
export const isPlus=(value:string):value is PlusGame=>(PLUS_GAMES as readonly string[]).includes(value);
export const plusHuman=(s:PlusSession)=>'human'in s?s.human:0;
export function newPlus(kind:PlusGame,options:Record<string,any>={},seed?:number):PlusSession{let s:PlusSession;
 switch(kind){case 'gomoku':case 'nim':case 'hex':s=newAbstract(kind,options.size??(kind==='gomoku'?15:7),options.variant??'normal',seed);break;
 case 'snakes':case 'senet':case 'ludo':case 'ur':s=newRace(kind,options.players??2,seed);break;
 case 'chinese':case 'halma':case 'fox':case 'tafl':s=newHop(kind,options.size??(kind==='halma'?16:7),seed);s.human=options.human??0;break;
 case 'dominoes':s=newDominoes(options.variant??'draw',seed);s.target=options.target??s.target;break;
 case 'hearts':case 'spades':case 'whist':s=newTricks(kind,seed);break;
 case 'gin':s=newGin(seed);break;
 case 'futoshiki':case 'skyscrapers':case 'kakuro':s=newNumbers(kind,options.size??(kind==='kakuro'?7:5),options.difficulty??2,seed);break;
 case 'slitherlink':s=newLoop(options.size??5,options.difficulty??2,seed);break;
 case 'hashi':s=newHashi(options.size??9,options.difficulty??2,seed);break;
 case 'memory':s=newMemory(options.pairs??12,seed);s.opponent=options.opponent??'solo';break;
 case 'wordsearch':s=newWordSearch(options.size??12,options.topic??'garden',seed);break;
 case 'tangrams':s=newTangram(options.picture??0,seed);break;}
 s.mode=options.mode??s.mode;s.level=options.level??s.level;return s;
}
function validPosition(s:PlusSession):boolean{switch(s.kind){case 'gomoku':case 'nim':case 'hex':return validAbstract(s);case 'snakes':case 'senet':case 'ludo':case 'ur':return validRace(s);case 'chinese':case 'halma':case 'fox':case 'tafl':return validHop(s);case 'dominoes':return validDomino(s);case 'hearts':case 'spades':case 'whist':return validTricks(s);case 'gin':return validGin(s);case 'futoshiki':case 'skyscrapers':case 'kakuro':return validNumbers(s);case 'slitherlink':return validLoop(s);case 'hashi':return validHashi(s);case 'memory':return validMemory(s);case 'wordsearch':return validWords(s);case 'tangrams':return validTangram(s);}}
export function restorePlus(value:unknown):PlusStore{const out=emptyPlus();if(!value||typeof value!=='object')return out;for(const key of PLUS_GAMES){try{const s=structuredClone((value as Record<string,unknown>)[key]) as PlusSession;if(s?.kind==='ludo'){migrateLudo(s);if(Array.isArray(s.history))s.history.forEach(h=>migrateLudo(h as RaceSession));}if(!assertBase(s,key)||!validPosition(s)||!s.history.every(h=>assertBase({...h,history:[],records:[]},key)&&validPosition(h as PlusSession)))continue;out[key]=structuredClone(s);}catch{/* A damaged game cannot discard another game's progress. */}}return out;}
