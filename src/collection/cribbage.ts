import {skillChoice,seededRandom} from '../skill.ts';
import { rank, suit } from '../cards.ts';
export interface CribScore { points:number; items:{label:string;points:number;cards:number[]}[] }
const value=(card:number)=>Math.min(10,rank(card));
export function scoreCribHand(hand:number[],starter:number,crib=false):CribScore{
  const cards=[...hand,starter],items:CribScore['items']=[];
  for(let mask=1;mask<32;mask++){const group=cards.filter((_,i)=>mask&(1<<i));if(group.length>=2&&group.reduce((n,c)=>n+value(c),0)===15)items.push({label:'Fifteen',points:2,cards:group});}
  for(let a=0;a<5;a++)for(let b=a+1;b<5;b++)if(rank(cards[a])===rank(cards[b]))items.push({label:'Pair',points:2,cards:[cards[a],cards[b]]});
  for(let length=5;length>=3;length--){const runs:number[][]=[];for(let mask=1;mask<32;mask++){const group=cards.filter((_,i)=>mask&(1<<i));if(group.length!==length)continue;const ranks=group.map(rank).sort((a,b)=>a-b);if(new Set(ranks).size===length&&ranks.at(-1)!-ranks[0]===length-1)runs.push(group);}if(runs.length){runs.forEach(group=>items.push({label:`Run of ${length}`,points:length,cards:group}));break;}}
  if(hand.length===4&&hand.every(c=>suit(c)===suit(hand[0]))){const five=suit(starter)===suit(hand[0]);if(five||!crib)items.push({label:five?'Five-card flush':'Four-card flush',points:five?5:4,cards:five?cards:hand});}
  const jack=hand.find(c=>rank(c)===11&&suit(c)===suit(starter));if(jack!==undefined)items.push({label:'One for his nob · Jack matches starter',points:1,cards:[jack,starter]});
  return {points:items.reduce((n,item)=>n+item.points,0),items};
}
export function scorePegging(sequence:number[]):CribScore{
  const items:CribScore['items']=[],total=sequence.reduce((n,c)=>n+value(c),0),last=sequence.at(-1);if(last===undefined||total>31)return {points:0,items};
  if(total===15||total===31)items.push({label:total===15?'Fifteen':'Thirty-one',points:2,cards:sequence.slice()});
  let same=1;for(let i=sequence.length-2;i>=0&&rank(sequence[i])===rank(last);i--)same++;
  if(same>=2)items.push({label:same===4?'Four of a kind':same===3?'Three of a kind':'Pair',points:same*(same-1),cards:sequence.slice(-same)});
  for(let length=sequence.length;length>=3;length--){const group=sequence.slice(-length),ranks=group.map(rank);if(new Set(ranks).size===length&&Math.max(...ranks)-Math.min(...ranks)===length-1){items.push({label:`Run of ${length}`,points:length,cards:group});break;}}
  return {points:items.reduce((n,i)=>n+i.points,0),items};
}
export interface CribPosition { hands:[number[],number[]]; kept:[number[],number[]]; crib:number[]; starter:number|null; stock:number[]; dealer:0|1; turn:0|1; scores:[number,number]; previous:[number,number]; sequence:number[]; played:{card:number;player:0|1}[]; passed:[boolean,boolean]; phase:'discard'|'cut'|'peg'|'show'|'next'|'over'; showIndex:number; handNo:number; seed:number; result:0|1|null; notice:string; lastScore:CribScore|null; lastPlayer:0|1|null }
export interface CribSession extends CribPosition { level:number; history:CribPosition[] }
const snapshot=(s:CribPosition):CribPosition=>{const {history:_history,...position}=s as CribPosition & {history?:unknown};return structuredClone(position);};
function shuffle(s:CribPosition):number[]{const a=Array.from({length:52},(_,i)=>i);for(let i=51;i>0;i--){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;const j=Math.floor(s.seed/4294967296*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function remember(s:CribSession):void{s.history.push(snapshot(s));if(s.history.length>120)s.history.shift();}
function addPoints(s:CribSession,p:0|1,score:CribScore):void{s.previous[p]=s.scores[p];s.scores[p]+=score.points;s.lastScore=score;s.lastPlayer=p;if(s.scores[p]>=121){s.result=p;s.phase='over';s.notice=`${p?'Computer':'You'} reached ${s.scores[p]}. Game won!`;}}
function deal(s:CribSession):void{const deck=shuffle(s);s.hands=[[],[]];for(let i=0;i<12;i++)s.hands[(s.dealer+1+i)%2].push(deck.pop()!);s.hands.forEach(h=>h.sort((a,b)=>rank(a)-rank(b)||suit(a)-suit(b)));s.stock=deck;s.kept=[[],[]];s.crib=[];s.starter=null;s.sequence=[];s.played=[];s.passed=[false,false];s.phase='discard';s.showIndex=-1;s.handNo++;s.lastScore=null;s.notice=`${s.dealer===0?'Your':'Computer’s'} crib. Choose two cards to discard.`;}
export function newCribbage(level=3,seed=Math.floor(Math.random()*0xffffffff)):CribSession{
  const s:CribSession={hands:[[],[]],kept:[[],[]],crib:[],starter:null,stock:[],dealer:(seed%2) as 0|1,turn:0,scores:[0,0],previous:[0,0],sequence:[],played:[],passed:[false,false],phase:'discard',showIndex:-1,handNo:0,seed:seed>>>0,result:null,notice:'',lastScore:null,lastPlayer:null,level,history:[]};deal(s);return s;
}
export function chooseCribDiscards(hand:number[],ownCrib:boolean,level=3):number[]{
  const unknown=Array.from({length:52},(_,i)=>i).filter(c=>!hand.includes(c));let best=-Infinity,choice:number[]=[];
  for(let a=0;a<5;a++)for(let b=a+1;b<6;b++){
    const keep=hand.filter((_,i)=>i!==a&&i!==b),discard=[hand[a],hand[b]],samples=level<=2?unknown.filter((_,i)=>i%7===0):unknown;
    let score=samples.reduce((n,c)=>n+scoreCribHand(keep,c).points,0)/samples.length;
    const cribBias=(rank(discard[0])===rank(discard[1])?1.7:0)+(value(discard[0])+value(discard[1])===15?1.6:0)+discard.filter(c=>rank(c)===5).length*1.3+(Math.abs(rank(discard[0])-rank(discard[1]))===1?.4:0);
    if(level>=4){let state=(hand.reduce((n,c)=>n*53+c,1)+a*79+b*997)>>>0,total=0;const samples=level===5?160:40;for(let i=0;i<samples;i++){const available=unknown.slice(),take=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return available.splice(Math.floor(state/4294967296*available.length),1)[0];};const extra=[take(),take()],cut=take();total+=scoreCribHand([...discard,...extra],cut,true).points;}score+=(ownCrib?1:-1)*total/samples;}
    else score+=(ownCrib?1:-1)*cribBias*(level>=3?1:.3);if(level===1)score=-(a+b);
    if(score>best){best=score;choice=discard;}
  }return choice;
}
export function discardCribbage(s:CribSession,cards:number[]):boolean{
  if(s.phase!=='discard'||cards.length!==2||new Set(cards).size!==2||cards.some(c=>!s.hands[0].includes(c)))return false;remember(s);
  const bot=chooseCribDiscards(s.hands[1],s.dealer===1,s.level);s.crib=[...cards,...bot];s.hands=[s.hands[0].filter(c=>!cards.includes(c)),s.hands[1].filter(c=>!bot.includes(c))];s.kept=[s.hands[0].slice(),s.hands[1].slice()];s.phase='cut';s.notice='Four cards each. Cut the starter card.';return true;
}
export function cutCribbage(s:CribSession):boolean{
  if(s.phase!=='cut')return false;remember(s);s.starter=s.stock.pop()!;s.turn=(1-s.dealer) as 0|1;s.phase='peg';s.notice='Nondealer leads. Play a card without taking the count over 31.';
  if(rank(s.starter)===11){addPoints(s,s.dealer,{points:2,items:[{label:'Two for his heels · Jack starter',points:2,cards:[s.starter]}]});if(s.result===null)s.notice='Jack starter: dealer scores two for his heels. Nondealer leads.';}return true;
}
export const cribPegTotal=(s:CribPosition)=>s.sequence.reduce((n,c)=>n+value(c),0);
export const cribLegalCards=(s:CribPosition,p=s.turn)=>s.phase==='peg'?s.hands[p].filter(c=>value(c)+cribPegTotal(s)<=31):[];
function resetCount(s:CribSession,leader:0|1):void{s.sequence=[];s.passed=[false,false];s.turn=s.hands[leader].length?leader:(1-leader) as 0|1;}
function finishPegging(s:CribSession,last:0|1,exact:boolean):void{
  if(!exact)addPoints(s,last,{points:1,items:[{label:'Last card',points:1,cards:s.sequence.slice(-1)}]});
  if(s.result===null){s.phase='show';s.showIndex=-1;s.notice='Pegging complete. Count the nondealer’s hand first, then dealer, then crib.';}
}
export function playCribbage(s:CribSession,card:number):boolean{
  if(!cribLegalCards(s).includes(card))return false;remember(s);const p=s.turn;s.hands[p].splice(s.hands[p].indexOf(card),1);s.sequence.push(card);s.played.push({card,player:p});s.lastScore=null;s.lastPlayer=p;
  const score=scorePegging(s.sequence);if(score.points)addPoints(s,p,score);if(s.result!==null)return true;
  const exact=cribPegTotal(s)===31;
  if(s.hands.every(h=>!h.length)){finishPegging(s,p,exact);return true;}
  if(exact){s.notice='Thirty-one · two points. Start a fresh count.';resetCount(s,(1-p) as 0|1);return true;}
  const other=(1-p) as 0|1;s.turn=s.passed[other]||!s.hands[other].length?p:other;
  if(!s.hands[s.turn].length)s.turn=other;
  s.notice=`Count ${cribPegTotal(s)}. ${s.turn?'Computer':'Your'} turn${s.passed[other]?'; opponent has said go':''}.`;
  return true;
}
export function goCribbage(s:CribSession):boolean{
  if(s.phase!=='peg'||cribLegalCards(s).length)return false;remember(s);const p=s.turn,other=(1-p) as 0|1;s.passed[p]=true;
  if(s.passed[other]||!s.hands[other].length){const last=s.played.at(-1)?.player??other;addPoints(s,last,{points:1,items:[{label:'Go · last card',points:1,cards:s.sequence.slice(-1)}]});if(s.result===null){s.notice='Go · one for the last card. Start a fresh count.';resetCount(s,(1-last) as 0|1);}}
  else{s.turn=other;s.notice=`${p?'Computer says':'You say'} go. ${other?'Computer continues':'Play every card that fits'}.`;}
  return true;
}
export function countCribbage(s:CribSession):boolean{
  if(s.phase!=='show'||s.starter===null)return false;remember(s);s.showIndex++;
  const player=(s.showIndex===0?1-s.dealer:s.dealer) as 0|1,crib=s.showIndex===2,score=scoreCribHand(crib?s.crib:s.kept[player],s.starter,crib);addPoints(s,player,score);
  if(s.result===null){s.notice=`${crib?'Crib':player?'Computer’s hand':'Your hand'}: ${score.points} points.`;if(s.showIndex===2)s.phase='next';}return true;
}
export function nextCribbageDeal(s:CribSession):boolean{if(s.phase!=='next')return false;remember(s);s.dealer=(1-s.dealer) as 0|1;deal(s);return true;}
export function chooseCribPeg(s:CribSession):number|null{
  const legal=cribLegalCards(s);if(!legal.length)return null;const rng=seededRandom(s.seed+s.played.length*997),actor=s.turn;if(s.level===1)return legal[Math.floor(rng()*legal.length)];const scored:{card:number;value:number}[]=[];
  for(const c of legal){const seq=[...s.sequence,c],total=seq.reduce((n,c)=>n+value(c),0);let n=scorePegging(seq).points*10+(total===31?8:0)+(value(c)===10?1:0)-(total===5||total===21?4:0);
    if(s.level>=3){const seen=[...s.kept[actor],...s.played.map(p=>p.card),...(s.starter===null?[]:[s.starter])];const unknown=Array.from({length:52},(_,i)=>i).filter(i=>!seen.includes(i)&&value(i)+total<=31);if(unknown.length)n-=unknown.reduce((a,i)=>a+scorePegging([...seq,i]).points,0)/unknown.length*(s.level>=4?7:4);if(s.level===5&&unknown.length){const remaining=s.hands[actor].filter(id=>id!==c);n+=unknown.reduce((sum,next)=>{const line=[...seq,next],reply=remaining.filter(id=>line.reduce((n,c)=>n+value(c),0)+value(id)<=31);return sum+(reply.length?Math.max(...reply.map(id=>scorePegging([...line,id]).points)):0);},0)/unknown.length*5;}}
    scored.push({card:c,value:n});
  }return skillChoice(scored.sort((a,b)=>b.value-a.value),s.level,rng).card;
}
export function undoCribbage(s:CribSession):boolean{if(!s.history.length)return false;do{Object.assign(s,s.history.pop()!);}while(s.phase==='peg'&&s.turn===1&&s.history.length);return true;}
export function restoreCribbage(value:unknown):CribSession|null{
  if(!value||typeof value!=='object')return null;const s=value as CribSession;
  const cards=(a:unknown,max=52):a is number[]=>Array.isArray(a)&&a.length<=max&&a.every(n=>Number.isInteger(n)&&n>=0&&n<52);
  const scoreValid=(score:CribScore|null)=>score===null||Boolean(score&&Number.isInteger(score.points)&&score.points>=0&&score.points<=29&&Array.isArray(score.items)&&score.items.length<=32&&score.items.every(i=>i&&typeof i.label==='string'&&i.label.length<120&&Number.isInteger(i.points)&&i.points>=0&&i.points<=29&&cards(i.cards,8))&&score.items.reduce((n,i)=>n+i.points,0)===score.points);
  const valid=(p:CribPosition)=>p&&Array.isArray(p.hands)&&p.hands.length===2&&p.hands.every(h=>cards(h,6))&&Array.isArray(p.kept)&&p.kept.length===2&&p.kept.every(h=>cards(h,4))&&cards(p.crib,4)&&cards(p.stock)&&cards(p.sequence,8)&&[null,...Array.from({length:52},(_,i)=>i)].includes(p.starter)&&[0,1].includes(p.dealer)&&[0,1].includes(p.turn)&&[p.scores,p.previous].every(a=>Array.isArray(a)&&a.length===2&&a.every(n=>Number.isInteger(n)&&n>=0&&n<=150))&&['discard','cut','peg','show','next','over'].includes(p.phase)&&Number.isInteger(p.showIndex)&&p.showIndex>=-1&&p.showIndex<=2&&Number.isInteger(p.seed)&&typeof p.notice==='string'&&p.notice.length<500&&Array.isArray(p.played)&&p.played.length<=8&&p.played.every(v=>v&&cards([v.card],1)&&[0,1].includes(v.player))&&Array.isArray(p.passed)&&p.passed.length===2&&p.passed.every(v=>typeof v==='boolean')&&[null,0,1].includes(p.result)&&new Set([...p.hands.flat(),...p.crib,...p.stock,...p.played.map(v=>v.card),...(p.starter===null?[]:[p.starter])]).size===[...p.hands.flat(),...p.crib,...p.stock,...p.played.map(v=>v.card),...(p.starter===null?[]:[p.starter])].length;
  const complete=(p:CribPosition)=>valid(p)&&scoreValid(p.lastScore)&&[null,0,1].includes(p.lastPlayer)&&Number.isInteger(p.handNo)&&p.handNo>=1&&p.hands.flat().length+p.crib.length+p.stock.length+p.played.length+(p.starter===null?0:1)===52;
  if(!complete(s)||!Number.isInteger(s.level)||s.level<1||s.level>5||!Array.isArray(s.history)||s.history.length>120||!s.history.every(complete))return null;return structuredClone(s);
}
