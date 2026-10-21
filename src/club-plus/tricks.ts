import {skillChoice,seededRandom} from '../skill.ts';
import {rank,suit,cardName} from '../cards.ts';
import {base,remember,shuffled,rand,integers} from './common.ts';
import type {Base} from './common.ts';
export type TrickKind='hearts'|'spades'|'whist';
export interface TrickPlay {player:number;card:number}
export interface TrickSession extends Base {kind:TrickKind;hands:number[][];trick:TrickPlay[];seen:TrickPlay[];lastTrick:TrickPlay[];logs:{plays:TrickPlay[];winner:number}[];phase:'pass'|'bid'|'play'|'collect'|'moon'|'summary';dealer:number;round:number;trump:number;exposed:number;broken:boolean;bids:number[];taken:number[];handPoints:number[];scores:number[];bags:number[];target:number;summary:string[];moon:number|null}
export const trickRank=(c:number)=>rank(c)===1?14:rank(c);
export const heartPoints=(c:number)=>suit(c)===1?1:c===11?13:0;
const sortHand=(h:number[])=>h.sort((a,b)=>suit(a)-suit(b)||trickRank(a)-trickRank(b));
function deal(s:TrickSession):void{const deck=shuffled(s,Array.from({length:52},(_,i)=>i));s.hands=[[],[],[],[]];let last=0;for(let i=0;i<52;i++){last=deck.pop()!;s.hands[(s.dealer+1+i)%4].push(last);}s.hands.forEach(sortHand);s.exposed=last;s.trump=s.kind==='hearts'?-1:s.kind==='spades'?0:suit(last);s.trick=[];s.seen=[];s.logs=[];s.lastTrick=[];s.broken=false;s.bids=[-1,-1,-1,-1];s.taken=[0,0,0,0];s.handPoints=[0,0,0,0];s.summary=[];s.moon=null;s.round++;
 s.phase=s.kind==='hearts'?(s.round%4===0?'play':'pass'):s.kind==='spades'?'bid':'play';s.turn=s.kind==='hearts'?s.hands.findIndex(h=>h.includes(27)):(s.dealer+1)%4;s.notice=s.phase==='pass'?`Pass three cards ${['','left','right','across'][s.round%4]}. Selections stay private until everyone passes.`:s.phase==='bid'?'Bid your own expected tricks. Zero is Nil.':'The opening lead is ready.';
}
export function newTricks(kind:TrickKind,seed?:number):TrickSession{const s:TrickSession={...base(kind,'computer',3,seed),kind,hands:[],trick:[],seen:[],lastTrick:[],logs:[],phase:'play',dealer:0,round:0,trump:-1,exposed:0,broken:false,bids:[],taken:[],handPoints:[],scores:kind==='hearts'?[0,0,0,0]:[0,0],bags:[0,0],target:kind==='hearts'?100:kind==='spades'?500:5,summary:[],moon:null};deal(s);return s;}
export function chooseHeartPass(hand:number[],level=3):number[]{
 if(level===4)return chooseHeartPass(hand,5);
 const rng=seededRandom(hand.reduce((n,c)=>n*31+c,17)),bySuit=Array.from({length:4},(_,p)=>hand.filter(c=>suit(c)===p));
 if(level===1){const pool=hand.slice(),out:number[]=[];while(out.length<3&&pool.length)out.push(pool.splice(Math.floor(rng()*pool.length),1)[0]);return out;}
 if(level<4){const ranked=hand.slice().sort((a,b)=>{const value=(c:number)=>c===11?60:suit(c)===0&&trickRank(c)>12?45:trickRank(c)+(level>=3&&bySuit[suit(c)].length<=3?12:0)+(suit(c)===1?5:0);return value(b)-value(a);});const out:number[]=[];while(out.length<3){const card=skillChoice(ranked,level,rng);out.push(card);ranked.splice(ranked.indexOf(card),1);}return out;}
 const plans:{cards:number[];value:number}[]=[];
 for(let a=0;a<hand.length-2;a++)for(let b=a+1;b<hand.length-1;b++)for(let c=b+1;c<hand.length;c++){
  const cards=[hand[a],hand[b],hand[c]],keep=hand.filter(v=>!cards.includes(v)),spades=keep.filter(v=>suit(v)===0),risk=keep.reduce((n,v)=>n+(v===11?spades.length>=4?12:65:suit(v)===0&&trickRank(v)>=13?25:suit(v)===1?Math.max(0,trickRank(v)-7)*2:Math.max(0,trickRank(v)-10)*2),0),voids=[2,3].filter(suitId=>!keep.some(v=>suit(v)===suitId)).length;
  plans.push({cards,value:-risk+voids*14+(level===5?keep.filter(v=>suit(v)!==1&&trickRank(v)<=6).length*1.2:0)});
 }return skillChoice(plans.sort((a,b)=>b.value-a.value),level,rng).cards;
}
export function passHearts(s:TrickSession,cards:number[]):boolean{if(s.kind!=='hearts'||s.phase!=='pass'||cards.length!==3||new Set(cards).size!==3||cards.some(c=>!s.hands[0].includes(c)))return false;remember(s,'Pass three cards');const selected=[cards,...s.hands.slice(1).map(h=>chooseHeartPass(h,s.level))],offset=s.round%4===1?1:s.round%4===2?3:2;s.hands=s.hands.map((h,p)=>h.filter(c=>!selected[p].includes(c)));selected.forEach((h,p)=>s.hands[(p+offset)%4].push(...h));s.hands.forEach(sortHand);s.phase='play';s.turn=s.hands.findIndex(h=>h.includes(27));s.notice='Cards passed. The two of clubs leads.';return true;}
export function bidSpades(s:TrickSession,n:number):boolean{if(s.kind!=='spades'||s.phase!=='bid'||!Number.isInteger(n)||n<0||n>13||s.bids[s.turn]!==-1)return false;remember(s,`Player ${s.turn+1} bids ${n===0?'Nil':n}`);s.bids[s.turn]=n;s.turn=(s.turn+1)%4;if(s.bids.every(n=>n>=0)){s.phase='play';s.turn=(s.dealer+1)%4;s.notice='Bids are set. Spades may be led after they are broken, or when only spades remain.';}return true;}
export function estimateBid(hand:number[],level=3):number{const trumps=hand.filter(c=>suit(c)===0),aces=hand.filter(c=>suit(c)!==0&&trickRank(c)===14).length,kings=hand.filter(c=>suit(c)!==0&&trickRank(c)===13&&hand.filter(v=>suit(v)===suit(c)).length<=3).length;const value=aces+kings*.65+trumps.filter(c=>trickRank(c)>=11).length*.8+Math.max(0,trumps.length-3)*.55;if(level>=4&&value<.5&&trumps.length<=2&&hand.every(c=>trickRank(c)<12))return 0;const rng=seededRandom(hand.reduce((n,c)=>n*31+c,71));if(level===1)return Math.floor(rng()*8)+1;let estimate=value;if(level>=4){estimate+=hand.filter(c=>suit(c)!==0&&trickRank(c)===12&&hand.filter(v=>suit(v)===suit(c)).length>=3).length*.35;}if(level===5){const short=[1,2,3].filter(i=>hand.filter(c=>suit(c)===i).length<=1).length;estimate+=Math.min(short,Math.max(0,trumps.length-3))*.6;estimate-=hand.filter(c=>suit(c)!==0&&trickRank(c)===13&&hand.filter(v=>suit(v)===suit(c)).length===1).length*.35;}const error=level===2?(rng()-.5)*3:level===3?(rng()-.5)*1.3:level===4?(rng()-.5)*.5:0;return Math.max(1,Math.min(13,Math.round(estimate+error)));}
export function trickLegal(s:TrickSession,player=s.turn):number[]{if(s.phase!=='play'||s.result!==null)return [];const hand=s.hands[player];if(s.trick.length){const following=hand.filter(c=>suit(c)===suit(s.trick[0].card));if(following.length)return following;if(s.kind==='hearts'&&!s.logs.length){const clean=hand.filter(c=>!heartPoints(c));if(clean.length)return clean;}return hand.slice();}
 if(s.kind==='hearts'&&!s.logs.length)return hand.includes(27)?[27]:[];if((s.kind==='hearts'||s.kind==='spades')&&!s.broken){const forbidden=s.kind==='hearts'?1:0,other=hand.filter(c=>suit(c)!==forbidden);if(other.length)return other;}return hand.slice();}
export function trickWinner(plays:TrickPlay[],trump:number):number{let best=plays[0];for(const play of plays.slice(1)){const a=suit(play.card),b=suit(best.card);if(a===b?trickRank(play.card)>trickRank(best.card):a===trump)best=play;}return best.player;}
export function playTrick(s:TrickSession,card:number):boolean{if(!trickLegal(s).includes(card))return false;const p=s.turn;remember(s,`Player ${p+1}: ${cardName(card)}`);s.hands[p].splice(s.hands[p].indexOf(card),1);const play={player:p,card};s.trick.push(play);s.seen.push(play);if(s.kind==='hearts'&&suit(card)===1||s.kind==='spades'&&suit(card)===0)s.broken=true;
 if(s.trick.length===4){s.turn=trickWinner(s.trick,s.trump);s.phase='collect';s.notice=`Player ${s.turn+1} takes the trick${s.kind==='hearts'?` · ${s.trick.reduce((n,p)=>n+heartPoints(p.card),0)} penalty points`:''}.`;}
 else s.turn=(p+1)%4;return true;}
function matchResult(s:TrickSession):void{if(s.kind==='hearts'&&s.scores.some(n=>n>=s.target)){const low=Math.min(...s.scores),wins=s.scores.flatMap((n,i)=>n===low?[i]:[]);s.result=wins.length===1?wins[0]:-1;}else if(s.kind!=='hearts'&&s.scores.some(n=>n>=s.target)&&s.scores[0]!==s.scores[1])s.result=s.scores[0]>s.scores[1]?0:1;}
function scoreHearts(s:TrickSession,subtract=false):void{if(s.moon!==null){const shooter=s.moon;s.scores=s.scores.map((n,p)=>n+(subtract?p===shooter?-26:0:p===shooter?0:26));s.summary.push(`Player ${shooter+1} shot the moon: ${subtract?'subtract 26 from their score':'add 26 to every opponent'}.`);}else{s.scores=s.scores.map((n,p)=>n+s.handPoints[p]);s.summary=s.handPoints.map((n,p)=>`Player ${p+1}: +${n} penalty points.`);}s.phase='summary';matchResult(s);}
export function scoreSpades(s:TrickSession):void{for(const team of [0,1]){const members=[team,team+2],bid=members.reduce((n,p)=>n+s.bids[p],0),contract=members.filter(p=>s.bids[p]>0).reduce((n,p)=>n+s.taken[p],0),nilBags=members.filter(p=>s.bids[p]===0).reduce((n,p)=>n+s.taken[p],0),over=Math.max(0,contract-bid),bags=over+nilBags;let points=contract>=bid?10*bid+over:-10*bid;for(const p of members)if(s.bids[p]===0)points+=s.taken[p]===0?100:-100;points+=nilBags;s.bags[team]+=bags;const penalty=Math.floor(s.bags[team]/10)*100;s.bags[team]%=10;points-=penalty;s.scores[team]+=points;s.summary.push(`${team===0?'You & North':'East & West'}: bid ${bid}, contract tricks ${contract}; ${points>=0?'+':''}${points}${penalty?` (includes −${penalty} bag penalty)`:''}.`);}matchResult(s);}
export function collectTrick(s:TrickSession):boolean{if(s.phase!=='collect')return false;remember(s,'Collect the trick');const winner=s.turn;s.taken[winner]++;s.handPoints[winner]+=s.trick.reduce((n,p)=>n+heartPoints(p.card),0);s.lastTrick=s.trick.slice();s.logs.push({plays:s.trick.slice(),winner});s.trick=[];s.phase='play';if(s.logs.length===13){s.phase='summary';if(s.kind==='hearts'){s.moon=s.handPoints.findIndex(n=>n===26);if(s.moon===-1)s.moon=null;if(s.moon===0){s.phase='moon';s.notice='You took every penalty card. Choose how to score the moon.';}else scoreHearts(s,s.moon!==null);}else if(s.kind==='spades')scoreSpades(s);else{const totals=[s.taken[0]+s.taken[2],s.taken[1]+s.taken[3]],team=totals[0]>6?0:1,points=totals[team]-6;s.scores[team]+=points;s.summary=[`${team===0?'You & North':'East & West'} won ${totals[team]} tricks: +${points} point${points===1?'':'s'}.`];matchResult(s);}}return true;}
export function chooseMoon(s:TrickSession,subtract:boolean):boolean{if(s.phase!=='moon')return false;remember(s,'Score the moon');scoreHearts(s,subtract);return true;}
export function nextTrickDeal(s:TrickSession):boolean{if(s.phase!=='summary'||s.result!==null)return false;remember(s,'Deal the next hand');s.dealer=(s.dealer+1)%4;deal(s);return true;}
export function chooseTrick(s:TrickSession,level=s.level):number|null{const legal=trickLegal(s);if(!legal.length)return null;const sample={seed:s.seed+s.moves},p=s.turn;if(level===1)return legal[rand(sample,legal.length)];
 if(s.kind==='hearts'&&level===4){const rng=seededRandom(s.seed+s.moves*997);return rng()<.18?legal[Math.floor(rng()*legal.length)]:chooseTrick(s,5);}
 if(s.kind==='whist'&&level===5){const ending=whistEndingValues(s);if(ending)return ending[0].card;}
 const known=new Set([...s.hands[p],...s.seen.map(p=>p.card)]),unseen=Array.from({length:52},(_,i)=>i).filter(c=>!known.has(c));const current=s.trick.length?trickWinner(s.trick,s.trump):-1,partner=(p+2)%4;
 const scored=legal.map(card=>{const plays=[...s.trick,{player:p,card}],wins=trickWinner(plays,s.trump)===p,points=plays.reduce((n,p)=>n+heartPoints(p.card),0),r=trickRank(card),higher=unseen.filter(c=>suit(c)===suit(card)&&trickRank(c)>r).length;let score=0;
 if(s.kind==='hearts'){if(!s.trick.length)score=-r-(higher===0?12:0);else if(!wins)score=r+heartPoints(card)*5;else score=-r-points*(level>=3?14:5);if(suit(card)!==suit(s.trick[0]?.card??card))score+=heartPoints(card)*6+r;if(level>=4&&s.trick.length===3&&!points&&wins)score+=10;if(level===5&&s.handPoints.some((n,i)=>i!==p&&n>=18)&&points&&wins)score+=points*2;}
 else{const nil=s.kind==='spades'&&s.bids[p]===0,protect=s.kind==='spades'&&s.bids[partner]===0&&s.taken[partner]===0,need=s.kind==='spades'?s.bids[p]+s.bids[partner]-s.taken[p]-s.taken[partner]:1;if(nil)score=wins?-80-r:r;else if(current===partner&&!protect)score=-r-(suit(card)===s.trump?10:0);else if(protect&&current===partner)score=wins?80-r:-40+r;else score=wins?(need>0?30:level>=4?-6:10)-r*.25:-r*.35;if(!s.trick.length)score=(higher===0?25:0)+r*.2-(suit(card)===s.trump?3:0)+(level>=4?unseen.filter(c=>suit(c)===suit(card)).length*.4:0);if(level===5&&wins&&s.trick.length<3&&higher>0)score-=higher*2;}
 return {card,score};}).sort((a,b)=>b.score-a.score);const rng=seededRandom(s.seed+s.moves*997);if(level>=4&&s.trick.length<3)for(const option of scored)option.score=option.score*.2+sampleTrickValue(s,option.card,level===5?96:24,rng);scored.sort((a,b)=>b.score-a.score);return skillChoice(scored,level,rng).card;}
/** Read all last-two-card Whist endings consistent with public information. */
export function whistEndingValues(s:TrickSession):{card:number;value:number}[]|null{
 if(s.kind!=='whist'||s.phase!=='play'||s.result!==null||s.hands.some(h=>h.length>2)||trickLegal(s).length<2)return null;
 const p=s.turn,known=new Set([...s.hands[p],...s.seen.map(v=>v.card)]),pool=Array.from({length:52},(_,i)=>i).filter(c=>!known.has(c));if(pool.length>6)return null;
 const voids=Array.from({length:4},()=>new Set<number>());
 for(const plays of [...s.logs.map(l=>l.plays),s.trick])if(plays.length)for(const play of plays)if(suit(play.card)!==suit(plays[0].card))voids[play.player].add(suit(plays[0].card));
 const others=[0,1,2,3].filter(i=>i!==p),assignments:number[][][]=[],hands=Array.from({length:4},()=>[] as number[]);hands[p]=s.hands[p].slice();
 function combinations(a:number[],n:number,start=0,selected:number[]=[]):number[][]{if(!n)return [selected];const out:number[][]=[];for(let i=start;i<=a.length-n;i++)out.push(...combinations(a,n-1,i+1,[...selected,a[i]]));return out;}
 function distribute(i:number,left:number[]):void{
  if(i===others.length){if(!left.length)assignments.push(hands.map(h=>h.slice()));return;}
  const seat=others[i];for(const cards of combinations(left,s.hands[seat].length)){
   if(cards.some(c=>voids[seat].has(suit(c))||c===s.exposed&&seat!==s.dealer))continue;
   if(s.dealer===seat&&left.includes(s.exposed)&&!cards.includes(s.exposed))continue;
   hands[seat]=cards;distribute(i+1,left.filter(c=>!cards.includes(c)));
  }
 }
 distribute(0,pool);if(!assignments.length)return null;
 const memo=new Map<string,number>();
 function solve(hands:number[][],trick:TrickPlay[],turn:number):number{
  const key=hands.map(h=>h.join('.')).join('/')+'|'+trick.map(v=>v.player+'.'+v.card).join('/')+'|'+turn,cached=memo.get(key);if(cached!==undefined)return cached;
  if(!hands.some(h=>h.length)&&!trick.length)return 0;
  const following=trick.length?hands[turn].filter(c=>suit(c)===suit(trick[0].card)):[],legal=following.length?following:hands[turn];let best=turn%2===p%2?-Infinity:Infinity;
  for(const card of legal){
   const next=hands.map(h=>h.slice());next[turn].splice(next[turn].indexOf(card),1);const plays=[...trick,{player:turn,card}];let value:number;
   if(plays.length===4){const winner=trickWinner(plays,s.trump);value=(winner%2===p%2?1:-1)+solve(next,[],winner);}else value=solve(next,plays,(turn+1)%4);
   best=turn%2===p%2?Math.max(best,value):Math.min(best,value);
  }
  memo.set(key,best);return best;
 }
 return trickLegal(s).map(card=>{
  let total=0;for(const h of assignments){const next=h.map(h=>h.slice());next[p].splice(next[p].indexOf(card),1);const plays=[...s.trick,{player:p,card}];if(plays.length===4){const winner=trickWinner(plays,s.trump);total+=(winner%2===p%2?1:-1)+solve(next,[],winner);}else total+=solve(next,plays,(p+1)%4);}
  return {card,value:total/assignments.length};
 }).sort((a,b)=>b.value-a.value);
}
// Determinizations use own cards, public plays, hand sizes, exposed trump and
// publicly demonstrated void suits. Covered hands and stock are never inspected.
export function sampleTrickValue(s:TrickSession,card:number,trials:number,random:()=>number):number{
 const p=s.turn,partner=(p+2)%4,known=new Set([...s.hands[p],...s.seen.map(v=>v.card)]),pool=Array.from({length:52},(_,i)=>i).filter(c=>!known.has(c)),voids=Array.from({length:4},()=>new Set<number>());
 for(const plays of [...s.logs.map(l=>l.plays),s.trick])if(plays.length)for(const play of plays)if(suit(play.card)!==suit(plays[0].card))voids[play.player].add(suit(plays[0].card));
 let total=0,count=0;
 for(let trial=0;trial<trials;trial++){
  let hands:number[][]|null=null;
  for(let attempt=0;attempt<6&&!hands;attempt++){
   const candidate=Array.from({length:4},()=>[] as number[]),left=s.hands.map((h,i)=>i===p?0:h.length),deck=pool.slice();candidate[p]=s.hands[p].slice();
   if(s.kind==='whist'&&s.dealer!==p&&pool.includes(s.exposed)){candidate[s.dealer].push(s.exposed);left[s.dealer]--;deck.splice(deck.indexOf(s.exposed),1);}
   for(let i=deck.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
   // Most constrained cards first avoids contradicting a demonstrated void.
   deck.sort((a,b)=>left.filter((n,i)=>n&&!voids[i].has(suit(a))).length-left.filter((n,i)=>n&&!voids[i].has(suit(b))).length);
   let valid=true;for(const c of deck){const seats=left.flatMap((n,i)=>n>0&&!voids[i].has(suit(c))?[i]:[]);if(!seats.length){valid=false;break;}const seat=seats[Math.floor(random()*seats.length)];candidate[seat].push(c);left[seat]--;}
   if(valid)hands=candidate;
  }if(!hands)continue;
  const plays=[...s.trick,{player:p,card}];while(plays.length<4){const actor=(plays.at(-1)!.player+1)%4,legal=trickLegal({...s,phase:'play',turn:actor,trick:plays,hands},actor);if(!legal.length)break;const leader=trickWinner(plays,s.trump),ranked=legal.map(c=>{const winner=trickWinner([...plays,{player:actor,card:c}],s.trump),r=trickRank(c),points=plays.reduce((n,v)=>n+heartPoints(v.card),heartPoints(c));let value=s.kind==='hearts'?(winner===actor?-points*12-r:r+heartPoints(c)*5):s.kind==='spades'&&s.bids[actor]===0?(winner===actor?-100:r):leader===(actor+2)%4?-r:winner===actor?30-r*.2:-r*.3;return {c,value};}).sort((a,b)=>b.value-a.value);plays.push({player:actor,card:ranked[0].c});}
  if(plays.length!==4)continue;const winner=trickWinner(plays,s.trump),team=winner===p||winner===partner,points=plays.reduce((n,v)=>n+heartPoints(v.card),0),r=trickRank(card);
  let value=s.kind==='hearts'?(winner===p?-points*14-r*.2:r*.25+heartPoints(card)*3):team?30-r*.25:-12-r*.15;
  if(s.kind==='spades'){if(s.bids[p]===0&&s.taken[p]===0)value=winner===p?-100:20+r*.25;else if(s.bids[partner]===0&&s.taken[partner]===0&&winner===partner)value-=100;else if(team&&s.taken[p]+s.taken[partner]>=s.bids[p]+s.bids[partner])value-=25;}
  total+=value;count++;
 }return count?total/count:0;
}
export function validTricks(s:TrickSession):boolean{const plays=(a:TrickPlay[])=>Array.isArray(a)&&a.length<=4&&a.every(p=>p&&integers([p.player,p.card],2,0,51)&&p.player<4)&&new Set(a.map(p=>p.player)).size===a.length;if(!['hearts','spades','whist'].includes(s.kind)||s.hands.length!==4||!s.hands.every(h=>integers(h,h.length,0,51)&&h.length<=13)||!Array.isArray(s.seen)||s.seen.length>52||!s.seen.every(p=>p&&integers([p.player],1,0,3)&&integers([p.card],1,0,51)))return false;const all=[...s.hands.flat(),...s.seen.map(p=>p.card)];return all.length===52&&new Set(all).size===52&&s.turn<4&&['pass','bid','play','collect','moon','summary'].includes(s.phase)&&Array.isArray(s.trick)&&s.trick.length<=4&&s.trick.every(p=>s.seen.some(v=>v.card===p.card&&v.player===p.player))&&integers(s.bids,4,-1,13)&&integers(s.taken,4,0,13)&&integers(s.handPoints,4,0,26)&&integers(s.bags,2,0,9)&&s.scores.length===(s.kind==='hearts'?4:2)&&s.scores.every(Number.isInteger)&&plays(s.lastTrick)&&Array.isArray(s.logs)&&s.logs.length<=13&&s.logs.every(l=>l&&plays(l.plays)&&l.plays.length===4&&Number.isInteger(l.winner)&&l.winner>=0&&l.winner<4)&&Number.isInteger(s.dealer)&&s.dealer>=0&&s.dealer<4&&Number.isInteger(s.round)&&s.round>=1&&Number.isInteger(s.trump)&&s.trump>=-1&&s.trump<=3&&Number.isInteger(s.exposed)&&s.exposed>=0&&s.exposed<52&&Array.isArray(s.summary)&&s.summary.every(v=>typeof v==='string'&&v.length<300)&&typeof s.broken==='boolean';}
