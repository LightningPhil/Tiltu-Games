import {newPlus} from './store.ts';
import type {PlusSession} from './store.ts';
import {chooseAbstract} from './abstracts.ts';
import {chooseRace} from './race.ts';
import {chooseHop} from './hop.ts';
import {chooseDomino,dominoMoves} from './dominoes.ts';
import {chooseTrick,chooseHeartPass,estimateBid} from './tricks.ts';
import {chooseGinDraw,chooseGinDiscard} from './gin.ts';
import {chooseMemory} from './playful.ts';
import {numberHint} from './numbers.ts';
export function plusSuggestion(s:PlusSession,level=s.level):{command?:string;cards?:number[];entry?:{at:number;value:number;reason:string};notice?:string}{switch(s.kind){
 case 'gomoku':case 'nim':case 'hex':{const n=chooseAbstract(s,level);return n===null?{}:{command:'abstract:'+n};}
 case 'snakes':case 'ludo':case 'senet':case 'ur':{if(s.phase==='roll')return {command:'race-roll'};const n=chooseRace(s,level);return n===null?{}:{command:'race-move:'+n};}
 case 'chinese':case 'halma':case 'fox':case 'tafl':{const m=chooseHop(s,level);return m?{command:`hop-move:${m.from}:${m.to}`}:{notice:'No legal move remains.'};}
 case 'dominoes':{const m=chooseDomino(s,level);return {command:m?`domino-play:${m.tile}:${m.end}`:s.variant!=='block'&&s.stock.length?'domino-draw':'domino-pass'};}
 case 'hearts':case 'spades':case 'whist':if(s.phase==='pass')return {cards:chooseHeartPass(s.hands[0],level),notice:'Consider passing these high-risk cards. Keep a useful suit structure and avoid gifting control.'};if(s.phase==='bid')return {command:`spades-bid:${estimateBid(s.hands[s.turn],level)}`,notice:'This estimate uses the high cards and spade length in your own hand.'};{const c=chooseTrick(s,level);return c===null?{notice:'Review the visible score, previous trick and rules while this hand finishes.'}:{command:'trick-card:'+c};}
 case 'gin':if(s.phase==='draw'||s.phase==='offer'){const source=chooseGinDraw(s,level);return source===null?{}:{command:source==='pass'?'gin-pass':'gin-draw:'+source};}{const m=chooseGinDiscard(s,level);return m?{command:`gin-play:${m.card}:${m.knock?1:0}`}:{notice:'Review the melds, layoffs and scoring shown for this hand.'};}
 case 'memory':{const n=chooseMemory(s,level);return n===null?{}:{command:'memory:'+n};}
 case 'kakuro':case 'futoshiki':case 'skyscrapers':{const entry=numberHint(s);return entry?{entry}:{};}
 default:return {};
}}
