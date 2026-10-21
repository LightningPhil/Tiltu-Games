import {cardName,rank,red} from '../cards.ts';
import {dotBoxEdges,MORRIS_MILLS,playTurn,reversiFlips,turnMoves} from './turn-games.ts';
import type {TurnSession,TurnMove} from './turn-games.ts';
import {freeCellCards,canMoveFreeCell,freeCellCapacity,safeFreeCellFoundation,spiderRun,spiderSuit} from './patience-collection.ts';
import type {FreeCellPosition,CollectionCardMove,SpiderSession} from './patience-collection.ts';
import {scorePegging,scoreCribHand} from './cribbage.ts';
import type {CribSession} from './cribbage.ts';
import type {BackgammonSession,BackgammonStep} from './backgammon.ts';
import {backgammonPips,moveBackgammon} from './backgammon.ts';

export function explainTurnHint(s:TurnSession,m:TurnMove):string {
 if(!turnMoves(s).some(v=>v.to===m.to&&v.from===m.from&&!!v.capture===!!m.capture))return 'That move is no longer available. Ask for a fresh hint.';
 const next=structuredClone(s),p=s.turn;playTurn(next,m,false);
 const label=s.kind==='kalah'?`Sow pit ${m.to+1}`:s.kind==='dots'?`Draw edge ${m.to+1}`:s.kind==='morris'?m.capture?`Remove man ${m.to+1}`:m.from===undefined?`Place at point ${m.to+1}`:`Move ${m.from+1} → ${m.to+1}`:`Play at row ${Math.floor(m.to/(s.kind==='noughts'?3:8))+1}, column ${m.to%(s.kind==='noughts'?3:8)+1}`;
 if(next.result===p)return `${label}. This ${s.kind==='noughts'?'completes three in a row':'meets the winning condition'} and wins.`;
 if(next.result===0)return `${label}. This finishes the game as a draw.`;
 if(s.kind==='noughts'){
  const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]],blocks=lines.some(l=>l.includes(m.to)&&l.filter(i=>s.board[i]===-p).length===2),threats=lines.filter(l=>l.filter(i=>next.board[i]===p).length===2&&l.some(i=>!next.board[i])).length;
  return `${label}. ${blocks?'This blocks an immediate opposing three-in-a-row.':threats>1?'This creates a fork: two different winning threats.':threats?'This creates a threat to complete three on your next turn.':m.to===4?'The centre belongs to four potential winning lines.':'Perfect-play search keeps the best available result against every reply.'} The tutor uses full-game search independently of computer difficulty.`;
 }
 if(s.kind==='reversi')return `${label}. It brackets and flips ${reversiFlips(s.board,m.to,p).length} opposing disc(s). ${[0,7,56,63].includes(m.to)?'A corner can never be flipped back.':`The opponent has ${turnMoves({...next,turn:-p as 1|-1}).length} legal replies; the search values future mobility and secure corners, not just this immediate disc gain.`}`;
 if(s.kind==='dots'){
  const boxes=Array.from({length:s.size*s.size},(_,i)=>i).filter(i=>!s.board[2*s.size*(s.size+1)+i]&&dotBoxEdges(s.size,i).every(e=>next.board[e])).length;
  const gifts=Array.from({length:s.size*s.size},(_,i)=>i).filter(i=>dotBoxEdges(s.size,i).filter(e=>next.board[e]).length===3).length;
  return `${label}. ${boxes?`It closes ${boxes} box(es), so you play again.`:`It closes no box and passes the turn. ${gifts?`${gifts} box(es) now have three sides; the search compares the resulting chains.`:'No box is left with three sides, so no immediate box is offered.'}`} Longer chains and keeping control matter more than a single box.`;
 }
 if(s.kind==='morris')return `${label}. ${m.capture?'The removal follows the rule that men outside a mill must be taken first, unless every opposing man is protected.':next.phase==='take'?'This completes a mill of three, earning a legal capture.':`${s.reserve[p===1?0:1]>0?'A reserve man is placed on an empty point.':s.board.filter(v=>v===p).length===3?'With three men you may fly to any empty point.':'The destination is an adjacent empty point.'} The search compares mill threats, material and the opponent’s mobility.`}`;
 const store=p===1?6:13,gain=next.board[store]-s.board[store];
 return `${label}, distributing ${s.board[m.to]} seeds counterclockwise and skipping the opposing store. Your store gains ${gain} seed(s). ${next.notice||'The search compares subsequent captures and store gains.'}`;
}

export function explainFreeCellHint(s:FreeCellPosition,m:CollectionCardMove):string {
 if(!canMoveFreeCell(s,m))return 'That move is no longer legal. Ask for a fresh hint.';
 const cards=freeCellCards(s,m.from),first=cards[0],to=m.to;
 const intro=`Move ${cardName(first)}${cards.length>1?` and its ${cards.length}-card run`:''} to ${to.area==='foundation'?'its foundation':to.area==='cell'?`free cell ${to.index+1}`:`column ${to.index+1}`}.`;
 const reasons:string[]=[];
 if(to.area==='foundation'){const safe=safeFreeCellFoundation(s);reasons.push(safe&&JSON.stringify(safe)===JSON.stringify(m)?'Lower opposite-colour cards are already home, so this card is safe to put away.':'This advances the suit foundation, but can remove a useful building card; compare alternatives first.');}
 else if(to.area==='cell')reasons.push('The empty cell holds exactly one card and exposes the card below. Keeping cells free increases your later run capacity.');
 else {const target=s.columns[to.index].at(-1);reasons.push(target?`It descends one rank onto the opposite colour (${red(target)?'red':'black'} ${rank(target)}).`:'Any card or legal run can start an empty column.');if(cards.length>1)reasons.push(`The ${cards.length}-card alternating run fits your current transfer capacity of ${freeCellCapacity(s,to.index)}.`);}
 if(m.from.area==='cell')reasons.push('This releases a free cell for later manoeuvres.');
 if(m.from.area==='column'&&m.from.at===0)reasons.push('This empties the source column, creating working space.');
 return `${intro} ${reasons.join(' ')} This is a short-range suggestion, not proof that the deal can be won.`;
}

export function explainSpiderHint(s:SpiderSession,m:{from:number;at:number;to:number}):string {
 const cards=spiderRun(s,m.from,m.at),target=s.columns[m.to].at(-1),uncover=m.at>0&&!s.columns[m.from][m.at-1].up;
 return `Move ${cardName(cards[0].id)}${cards.length>1?` and its ${cards.length}-card same-suit run`:''} from column ${m.from+1} to column ${m.to+1}. ${target?`Its leading rank fits one below ${rank(target.id)}. ${spiderSuit(target.id,s.suits)===spiderSuit(cards[0].id,s.suits)?'The suits match, joining a run that can move together.':'Different suits may stack, but cannot move together as one run.'}`:'The empty column accepts any legal run.'} ${uncover?'This uncovers a face-down card.':m.at===0?'This creates an empty working column.':'It rearranges the visible runs; it does not uncover a new card.'} The tutor avoids returning to recent layouts where an alternative exists; it cannot guarantee a winning deal.`;
}

export function explainCribPeg(s:CribSession,c:number):string {
 const total=[...s.sequence,c].reduce((n,v)=>n+Math.min(10,rank(v)),0),score=scorePegging([...s.sequence,c]);
 return `Play ${cardName(c)}. The count becomes ${total}, within 31${score.points?`, scoring ${score.points}: ${score.items.map(i=>i.label).join(', ')}`:', with no immediate points'}. The tutor compares likely opposing scoring replies and your possible follow-up using only your kept cards, the starter and public play.`;
}
export function explainCribDiscard(s:CribSession,cards:number[]):string {
 const kept=s.hands[0].filter(c=>!cards.includes(c)),starters=Array.from({length:52},(_,i)=>i).filter(c=>!s.hands[0].includes(c)),average=starters.reduce((n,c)=>n+scoreCribHand(kept,c).points,0)/starters.length;
 return `Discard ${cards.map(cardName).join(' and ')}; keep ${kept.map(cardName).join(', ')}. The kept hand averages ${average.toFixed(1)} points across all ${starters.length} unseen starter possibilities. The tutor also weighs ${s.dealer===0?'helping your own crib':'avoiding a valuable gift to the opponent’s crib'}. The starter, opponent’s cards and stock order are not inspected; this is an expectation, not a promised score.`;
}
export function explainBackgammonHint(s:BackgammonSession,path:BackgammonStep[]):string {
 const m=path[0];if(!m)return 'No legal checker move remains for these dice.';
 const next=structuredClone(s),p=s.turn,own=p===1?0:1,before=backgammonPips(s,p);for(const step of path)moveBackgammon(next,step);
 const made=next.board.filter(v=>v*p>=2).length-s.board.filter(v=>v*p>=2).length,blots=next.board.filter(v=>v===p).length;
 return `Start ${m.from===24?'by entering from the bar':`at point ${m.from+1}`} → ${m.to===-1?'bear off':`point ${m.to+1}`} using ${m.die}${m.hit?', hitting the opposing blot to the bar':''}. The complete plan is ${path.map(v=>`${v.from===24?'bar':v.from+1} → ${v.to===-1?'off':v.to+1} (${v.die})`).join(', ')}. It uses ${path.length} legal die move(s), satisfying the maximum-dice and higher-die rules. ${next.off[own]>s.off[own]?`It bears off ${next.off[own]-s.off[own]} checker(s). `:''}${made>0?`It creates ${made} more protected point(s). `:''}The pip count falls from ${before} to ${backgammonPips(next,p)}, leaving ${blots} blot(s). Future opposing rolls are weighed; this is not a guaranteed safe line.`;
}
