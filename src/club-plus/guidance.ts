import {cardName,rank,suit} from '../cards.ts';
import type {PlusSession} from './store.ts';
import type {plusSuggestion} from './suggestion.ts';
import {abstractMoves,fiveLine,hexDistance,playAbstract} from './abstracts.ts';
import {hopGoal,hopMoves,moveHop} from './hop.ts';
import {raceDestination,raceFinish,moveRace} from './race.ts';
import {DOMINO_TILES,dominoMoves,dominoOpenTotal,playDomino} from './dominoes.ts';
import {trickLegal,trickWinner,heartPoints} from './tricks.ts';
import {ginDiscardChoices,ginLayout} from './gin.ts';

export type PlusSuggestion=ReturnType<typeof plusSuggestion>;
const square=(at:number,n:number)=>`row ${Math.floor(at/n)+1}, column ${at%n+1}`;
const practice='The tutor compares possible replies with a bounded search; this is a suggestion, not a guaranteed win.';
/** Explain verifiable features of the chosen legal action, using only public information. */
export function explainPlusSuggestion(s:PlusSession,result:PlusSuggestion):string {
 if(result.cards&&s.kind==='hearts')return `Consider passing ${result.cards.map(cardName).join(', ')}. These cards were selected from your hand to reduce penalty exposure and awkward high cards. Passing changes your suit lengths; inspect the three cards you receive before choosing a plan.`;
 if(!result.command)return result.notice??'Review the visible position and the rules before the next move.';
 const [action,a,b]=result.command.split(':'),at=Number(a);
 if(action==='abstract'&&(s.kind==='nim'||s.kind==='hex'||s.kind==='gomoku')){
  if(!abstractMoves(s).includes(at))return 'That suggestion is no longer legal. Ask for a fresh hint.';
  const next=structuredClone(s),p=s.turn;playAbstract(next,at);
  if(s.kind==='nim'){
   const pile=Math.floor(at/100),take=at%100,heaps=next.heaps.filter(Boolean),xor=heaps.reduce((v,n)=>v^n,0);
   const losing=s.variant==='subtract'?heaps.every(n=>n%4===0):s.variant==='misere'&&heaps.every(n=>n===1)?heaps.length%2===1:xor===0;
   return `Take ${take} object${take===1?'':'s'} from pile ${pile+1}, leaving ${next.heaps.join(', ')}. ${next.result!==null?next.result===p?'This takes the last object and wins.':'The last object loses in this variant.':losing?s.variant==='subtract'?'Leaving a multiple of four lets you answer each take with enough to make four.':s.variant==='misere'&&heaps.every(n=>n===1)?'An odd number of single objects makes the opponent take the last one.':`The pile sizes now have nim-sum ${xor}: their binary sizes add without carrying to zero (XOR). Any opposing take changes that balance; you can answer by restoring it.${s.variant==='misere'?' When only single objects remain, leave an odd number for the opponent.':''}`:'No move from this position forces a win against perfect replies. This is a legal resistance move; watch for an opponent mistake.'}`;
  }
  if(at===-1)return 'Use the pie rule to swap colours. The opening stone is central and useful, so taking its colour is the tutor’s preferred response. You exchange connection goals; no extra stone is placed.';
  if(next.result===p)return `Play at ${square(at,s.size)}. This completes your ${s.kind==='hex'?'connection between both goal sides':'line of at least five stones'} and wins.`;
  if(s.kind==='gomoku'){
   const enemy=s.colours[1-p],probe=s.board.slice();probe[at]=enemy;const blocks=fiveLine(probe,s.size,at).length>0;
   const threats=next.board.flatMap((v,i)=>{if(v)return [];const board=next.board.slice();board[i]=s.colours[p];return fiveLine(board,s.size,i).length?[i]:[];});
   return `Place at ${square(at,s.size)}. ${blocks?'The opponent would complete five on this point next turn, so this blocks that immediate threat.':threats.length?`It creates ${threats.length} immediate winning point${threats.length===1?'':'s'} for your next turn; check whether your opponent has a faster threat.`:'It builds connected lines while considering the opponent’s replies.'} ${practice}`;
  }
  const before=hexDistance(s.board,s.size,s.colours[p]),after=hexDistance(next.board,s.size,s.colours[p]);
  return `Place at ${square(at,s.size)}. Your cheapest unblocked connection needs ${after} more empty point${after===1?'':'s'}${after<before?`, down from ${before}`:''}. This measures a possible route, not a forced win: the opponent can occupy it. ${practice}`;
 }
 if(action==='hop-move'&&['chinese','halma','fox','tafl'].includes(s.kind)){
  const board=s as Extract<PlusSession,{kind:'chinese'|'halma'|'fox'|'tafl'}>,to=Number(b),m=hopMoves(board).find(m=>m.from===at&&m.to===to);if(!m)return 'That route is no longer available. Ask for a fresh hint.';
  const next=structuredClone(board),p=s.turn;moveHop(next,at,to);
  const route=`Move from point ${at+1} to ${to+1}${m.path.length>2?` via ${m.path.slice(1,-1).map(i=>i+1).join(' → ')}`:''}.`;
  if(next.result===p)return `${route} This reaches the winning condition in the current position. ${next.notice}`;
  if(board.kind==='chinese'||board.kind==='halma'){
   const goal=hopGoal(board,p),before=goal.filter(i=>board.board[i]===p+1).length,after=goal.filter(i=>next.board[i]===p+1).length;
   return `${route} ${m.path.length>2?`Each of its ${m.path.length-1} hops crosses an occupied point into an empty landing. `:''}${after>before?'This brings another piece into the target camp.':goal.includes(at)?'This rearranges a piece inside the target camp to make room for others.':'This develops a route toward the target camp.'} ${after} of ${goal.length} target points will hold your pieces. Hops do not capture. ${practice}`;
  }
  const captured=board.board.filter(Boolean).length-next.board.filter(Boolean).length;
  return `${route} ${captured?`It captures ${captured} opposing piece${captured===1?'':'s'}.`:board.kind==='fox'?`The fox will have ${hopMoves(next,1).length} legal escape or capture moves. The search weighs ${p===0?'closing its net':'keeping escape routes open'}.`:board.board[at]===3?`The king changes its escape lanes; ${hopMoves(next,0).filter(m=>next.board[m.from]===3).length} legal king slides remain. It must reach a corner to escape.`:'The move changes the blocking lines and possible sandwich captures around the king.'} ${practice}`;
 }
 if(action==='race-roll')return 'Cast first. Advice must use the result actually rolled; the tutor cannot know future casts.';
 if(action==='race-move'&&['snakes','senet','ludo','ur'].includes(s.kind)){
  const race=s as Extract<PlusSession,{kind:'snakes'|'senet'|'ludo'|'ur'}>,to=raceDestination(race,at);if(to===null)return 'That counter cannot use this roll. Ask for a fresh hint.';
  const next=structuredClone(race);moveRace(next,at);const from=race.pawns[race.turn][at],home=to===raceFinish(race.kind);
  return `Move counter ${at+1} ${from<0?'from the start':`from ${race.kind==='ludo'?'route step':'house'} ${from+1}`} ${home?'home':`to ${race.kind==='ludo'?'route step':'house'} ${to+1}`} using the ${race.roll} rolled. ${home?'An exact finish removes this counter from danger. ':''}${next.notice||'The search balances advancement with the chance of being sent back.'} Future rolls are compared by their probabilities, not read from the game’s random sequence.`;
 }
 if(s.kind==='dominoes'){
  if(action==='domino-draw')return 'None of your tiles matches an open end. Draw until a tile fits or the boneyard is empty; you cannot pass while a draw is required.';
  if(action==='domino-pass')return 'No tile fits, and this variant has no available draw. Passing is the legal action.';
  if(action==='domino-play'){
   const end=Number(b) as 0|1,m=dominoMoves(s).find(m=>m.tile===at&&m.end===end);if(!m)return 'That tile does not fit now. Ask for a fresh hint.';
   const next=structuredClone(s);playDomino(next,m);const remaining=s.hands[s.turn].filter(t=>t!==at),left=next.chain[0].left,right=next.chain.at(-1)!.right,matches=remaining.filter(t=>DOMINO_TILES[t].includes(left)||DOMINO_TILES[t].includes(right)).length,total=dominoOpenTotal(next);
   return `Play ${DOMINO_TILES[at].join('–')} ${s.chain.length?`on the ${end?'right':'left'}, matching ${end?s.chain.at(-1)!.right:s.chain[0].left}`:'as the required opening tile'}. ${s.variant==='fives'?`The exposed ends total ${total}${total>0&&total%5===0?`, scoring ${total} points`:', so this placement earns no multiple-of-five bonus'}. `:''}${remaining.length?`${matches} remaining tile${matches===1?'':'s'} match the new ends; this helps retain options without inspecting your opponent’s hand.`:'This empties your hand and ends the round.'}`;
  }
 }
 if(s.kind==='hearts'||s.kind==='spades'||s.kind==='whist'){
  if(action==='spades-bid')return `Consider bidding ${at===0?'Nil':at+' tricks'}. You hold ${s.hands[s.turn].filter(c=>rank(c)===1).length} ace(s) and ${s.hands[s.turn].filter(c=>suit(c)===0).length} spades. The estimate weighs high-card winners, trump length and short suits. ${at===0?'Nil wins a bonus only if you take no tricks.':'Your bid joins your partner’s contract; overtricks create bags.'} Hidden hands and the future deal are not used.`;
  if(action==='trick-card'){
   if(!trickLegal(s).includes(at))return 'That card cannot be played now. Ask for a fresh hint.';
   const plays=[...s.trick,{player:s.turn,card:at}],winner=trickWinner(plays,s.trump),last=plays.length===4,following=s.trick.length&&s.hands[s.turn].some(c=>suit(c)===suit(s.trick[0].card));
   const why=s.kind==='hearts'?`${plays.reduce((n,p)=>n+heartPoints(p.card),0)} penalty points are on this trick. ${winner===s.turn?'This card is currently winning, so weigh the risk of collecting penalties.':last?'This card loses the completed trick, so its penalty points go to another player.':'This card currently avoids the lead; later players may still change the winner.'}`:winner===s.turn?`This ${last?'wins':'currently leads'} the trick${last?'':'; players still to act may overtake it'}.`:winner%2===s.turn%2?'Your partner is currently winning; this preserves your stronger cards where possible.':'It does not currently win; the search compares saving winners against spending trump.';
   return `Play ${cardName(at)}. ${following?'You must follow the led suit.':s.trick.length?'You have no card in the led suit, so you may discard or use trump.':'This is a legal lead under the current suit-breaking rules.'} ${why} Advice uses your hand and public play; unseen cards are sampled, not inspected.`;
  }
 }
 if(s.kind==='gin'){
  if(action==='gin-play'){
   const m=ginDiscardChoices(s).find(m=>m.card===at);if(!m)return 'That discard is unavailable; a picked-up discard cannot be returned immediately.';
   return `Discard ${cardName(at)}${b==='1'?' and '+(m.layout.points?'knock':'declare Gin'):''}. This leaves ${m.layout.points} deadwood point${m.layout.points===1?'':'s'} and ${m.layout.melds.length} completed meld${m.layout.melds.length===1?'':'s'}. ${b==='1'?m.layout.points?'Knocking is legal at 10 or less; the opponent can lay off and may undercut you.':'Zero deadwood earns the Gin bonus and prevents layoffs.':'The search also weighs future improvements and cards your opponent visibly picked up; keeping a draw can be worth a little extra deadwood.'}`;
  }
  if(action==='gin-draw'||action==='gin-pass'){
   if(s.forcedStock)return 'Both players passed the opening upcard. The next draw must come from stock.';
   const up=s.discard.at(-1),current=ginLayout(s.hands[s.turn]).points;
   if(up===undefined)return 'The discard pile is empty, so draw from stock.';
   const best=Math.min(...s.hands[s.turn].map(c=>ginLayout([...s.hands[s.turn],up].filter(v=>v!==c)).points));
   return `${action==='gin-pass'?'Pass the opening upcard':a==='discard'?`Take the visible ${cardName(up)}`:'Draw from stock'}. The visible upcard can leave ${best} deadwood after a legal discard, compared with ${current} now. ${action==='gin-pass'?'The tutor prefers keeping the option of a stock draw.':a==='discard'?'The tutor prefers that known option to the average unseen draw.':'The tutor prefers the average unseen draw to that known option.'} The actual stock order and opposing hand are not inspected.`;
  }
 }
 if(s.kind==='memory'&&action==='memory'){
  const partner=s.known.findIndex((face,i)=>i!==at&&!s.matched[i]&&face>=0&&face===s.known[at]);
  return s.known[at]>=0&&partner>=0?`Turn tile ${at+1}. Its face was revealed earlier and matches tile ${partner+1}${s.flipped.includes(partner)?', which is already face up':'; turn that one next'}.`:`Explore tile ${at+1}. No remembered matching pair is available; this is a legal exploratory choice, not a prediction of the covered face.`;
 }
 return result.notice??'Review the visible position and rules before the next move.';
}
