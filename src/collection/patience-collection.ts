import { rank, red, suit } from '../cards.ts';
export type PatienceVariant='klondike'|'freecell'|'spider';
export interface FreeCellPosition { columns:number[][]; cells:(number|null)[]; foundations:number[][]; moves:number }
export interface FreeCellSession extends FreeCellPosition { deal:number; history:FreeCellPosition[]; elapsed:number }
export interface SpiderCard { id:number; up:boolean }
export interface SpiderPosition { columns:SpiderCard[][]; stock:number[]; completed:number[][]; moves:number; score:number }
export interface SpiderSession extends SpiderPosition { suits:1|2|4; deal:number; history:SpiderPosition[]; elapsed:number }
export interface CollectionCardPlace { area:'column'|'cell'|'foundation'; index:number; at:number }
export interface CollectionCardMove { from:CollectionCardPlace; to:CollectionCardPlace }
function deck(seed:number,count:number):number[]{const a=Array.from({length:count},(_,i)=>i);for(let i=count-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=Math.floor(seed/4294967296*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function newFreeCell(deal=1+Math.floor(Math.random()*999999)):FreeCellSession{const shuffled=deck(deal>>>0,52),columns=Array.from({length:8},()=>[] as number[]);shuffled.forEach((c,i)=>columns[i%8].push(c));return {deal,columns,cells:[null,null,null,null],foundations:[[],[],[],[]],moves:0,history:[],elapsed:0};}
export function freeCellCards(s:FreeCellPosition,from:CollectionCardPlace):number[]{if(from.area==='column')return s.columns[from.index]?.slice(from.at)??[];const card=from.area==='cell'?s.cells[from.index]:s.foundations[from.index]?.at(-1);return card===undefined||card===null?[]:[card];}
export function freeCellCapacity(s:FreeCellPosition,toColumn:number):number{return (s.cells.filter(c=>c===null).length+1)*2**s.columns.filter((c,i)=>!c.length&&i!==toColumn).length;}
export function canMoveFreeCell(s:FreeCellPosition,move:CollectionCardMove):boolean{
  const {from,to}=move;if(from.area==='foundation'||from.area===to.area&&from.index===to.index)return false;
  if(from.index<0||to.index<0||!Number.isInteger(from.at)||from.at<0)return false;
  const cards=freeCellCards(s,from);if(!cards.length)return false;const card=cards[0];
  if(from.area==='column'&&(from.at>=s.columns[from.index]?.length||cards.some((c,i)=>i>0&&(rank(cards[i-1])!==rank(c)+1||red(cards[i-1])===red(c)))))return false;
  if(to.area==='cell')return to.index<4&&cards.length===1&&s.cells[to.index]===null;
  if(to.area==='foundation'){const f=s.foundations[to.index];return !!f&&cards.length===1&&suit(card)===to.index&&rank(card)===f.length+1;}
  const column=s.columns[to.index];return !!column&&cards.length<=freeCellCapacity(s,to.index)&&(!column.length||rank(column.at(-1)!)===rank(card)+1&&red(column.at(-1)!)!==red(card));
}
export function moveFreeCell(s:FreeCellSession,move:CollectionCardMove):boolean{
  if(!canMoveFreeCell(s,move))return false;s.history.push({columns:s.columns.map(c=>c.slice()),cells:s.cells.slice(),foundations:s.foundations.map(f=>f.slice()),moves:s.moves});if(s.history.length>300)s.history.shift();
  const cards=freeCellCards(s,move.from),{from,to}=move;if(from.area==='column')s.columns[from.index].splice(from.at);else if(from.area==='cell')s.cells[from.index]=null;else s.foundations[from.index].pop();
  if(to.area==='column')s.columns[to.index].push(...cards);else if(to.area==='cell')s.cells[to.index]=cards[0];else s.foundations[to.index].push(cards[0]);s.moves++;return true;
}
export function freeCellMoves(s:FreeCellPosition):CollectionCardMove[]{
  const sources:CollectionCardPlace[]=[...s.columns.flatMap((c,index)=>c.map((_,at)=>({area:'column' as const,index,at}))),...s.cells.flatMap((c,index)=>c===null?[]:[{area:'cell' as const,index,at:0}])],targets:CollectionCardPlace[]=[...s.columns.map((_,index)=>({area:'column' as const,index,at:0})),...s.cells.map((_,index)=>({area:'cell' as const,index,at:0})),...s.foundations.map((_,index)=>({area:'foundation' as const,index,at:0}))];return sources.flatMap(from=>targets.filter(to=>canMoveFreeCell(s,{from,to})).map(to=>({from,to})));
}
export function safeFreeCellFoundation(s:FreeCellPosition):CollectionCardMove|null{
  return freeCellMoves(s).find(m=>{if(m.to.area!=='foundation')return false;const c=freeCellCards(s,m.from)[0],r=rank(c);return r<=2||s.foundations.every((f,i)=>i===suit(c)||f.length>=(red(i*13)!==red(c)?r-1:r-2));})??null;
}
export function hintFreeCell(s:FreeCellPosition):CollectionCardMove|null{
  const safe=safeFreeCellFoundation(s);if(safe)return safe;
  const key=(p:FreeCellPosition)=>JSON.stringify([p.columns,p.cells,p.foundations]),history=(s as Partial<FreeCellSession>).history??[],recent=new Set(history.slice(-100).map(key));
  const moves=freeCellMoves(s);return moves.map(m=>{const next:FreeCellSession={columns:s.columns.map(c=>c.slice()),cells:s.cells.slice(),foundations:s.foundations.map(f=>f.slice()),moves:s.moves,deal:1,elapsed:0,history:[]};moveFreeCell(next,m);return {m,value:(recent.has(key(next))?-10000:0)+(m.to.area==='foundation'?20:m.to.area==='column'?8:0)+(m.from.area==='cell'?6:0)+(m.from.area==='column'&&m.from.at===0?7:0)-(m.to.area==='column'&&!s.columns[m.to.index].length?3:0)-(m.to.area==='cell'?4:0)+freeCellCards(s,m.from).length};}).filter(v=>v.value>-9000).sort((a,b)=>b.value-a.value)[0]?.m??null;
}
export function newSpider(suits:1|2|4=1,deal=1+Math.floor(Math.random()*999999)):SpiderSession{const shuffled=deck(deal>>>0,104),columns=Array.from({length:10},()=>[] as SpiderCard[]);for(let i=0;i<54;i++)columns[i%10].push({id:shuffled.pop()!,up:false});columns.forEach(c=>c.at(-1)!.up=true);return {suits,deal,columns,stock:shuffled,completed:[],moves:0,score:500,history:[],elapsed:0};}
export const spiderSuit=(id:number,suits:1|2|4)=>suits===1?0:suits===2?suit(id)%2:suit(id);
export const spiderFace=(id:number,suits:1|2|4)=>spiderSuit(id,suits)*13+rank(id)-1;
export function spiderRun(s:SpiderSession,column:number,at:number):SpiderCard[]{const cards=s.columns[column]?.slice(at)??[];return cards.length&&cards.every((c,i)=>c.up&&(!i||rank(cards[i-1].id)===rank(c.id)+1&&spiderSuit(cards[i-1].id,s.suits)===spiderSuit(c.id,s.suits)))?cards:[];}
export function canMoveSpider(s:SpiderSession,from:number,at:number,to:number):boolean{if(from===to||!s.columns[to])return false;const cards=spiderRun(s,from,at),target=s.columns[to].at(-1);return !!cards.length&&(!target||rank(target.id)===rank(cards[0].id)+1);}
function rememberSpider(s:SpiderSession):void{s.history.push({columns:s.columns.map(c=>c.map(v=>({...v}))),stock:s.stock.slice(),completed:s.completed.map(c=>c.slice()),moves:s.moves,score:s.score});if(s.history.length>300)s.history.shift();}
function completeSpider(s:SpiderSession):void{
  let again=true;while(again){again=false;for(let i=0;i<10;i++){const c=s.columns[i];if(c.length>=13){const at=c.length-13,run=spiderRun(s,i,at);if(run.length===13&&rank(run[0].id)===13&&rank(run[12].id)===1){s.completed.push(c.splice(at).map(v=>v.id));s.score+=100;again=true;}}if(c.length)c.at(-1)!.up=true;}}
}
export function moveSpider(s:SpiderSession,from:number,at:number,to:number):boolean{if(!canMoveSpider(s,from,at,to)||s.completed.length===8)return false;rememberSpider(s);s.columns[to].push(...s.columns[from].splice(at));s.moves++;s.score=Math.max(0,s.score-1);completeSpider(s);return true;}
export function dealSpider(s:SpiderSession):boolean{if(!s.stock.length||s.columns.some(c=>!c.length)||s.completed.length===8)return false;rememberSpider(s);for(let i=0;i<10;i++)s.columns[i].push({id:s.stock.pop()!,up:true});s.moves++;s.score=Math.max(0,s.score-1);completeSpider(s);return true;}
export function spiderMoves(s:SpiderSession):{from:number;at:number;to:number}[]{const moves:{from:number;at:number;to:number}[]=[];s.columns.forEach((column,from)=>column.forEach((_,at)=>{for(let to=0;to<10;to++)if(canMoveSpider(s,from,at,to))moves.push({from,at,to});}));return moves;}
export function hintSpider(s:SpiderSession):{from:number;at:number;to:number}|null{const key=(p:SpiderPosition)=>JSON.stringify([p.columns,p.completed]),recent=new Set(s.history.slice(-100).map(key));return spiderMoves(s).map(m=>{const top=s.columns[m.to].at(-1),cards=s.columns[m.from].slice(m.at),next={...s,columns:s.columns.map(c=>c.map(v=>({...v}))),completed:s.completed.map(c=>c.slice()),stock:s.stock.slice(),history:[]};moveSpider(next,m.from,m.at,m.to);return {m,score:(recent.has(key(next))?-10000:0)+(next.completed.length-s.completed.length)*100+(m.at>0&&!s.columns[m.from][m.at-1].up?30:0)+(top&&spiderSuit(top.id,s.suits)===spiderSuit(cards[0].id,s.suits)?20:0)+(cards.length*2)+(m.at===0?6:0)-(!top?8:0)};}).filter(v=>v.score>-9000).sort((a,b)=>b.score-a.score)[0]?.m??null;}
export function restoreFreeCell(v:unknown):FreeCellSession|null{
  const s=v as FreeCellSession;const valid=(p:FreeCellPosition)=>p&&Array.isArray(p.columns)&&p.columns.length===8&&p.columns.every(c=>Array.isArray(c)&&c.length<=52)&&Array.isArray(p.cells)&&p.cells.length===4&&Array.isArray(p.foundations)&&p.foundations.length===4&&p.foundations.every((f,i)=>Array.isArray(f)&&f.length<=13&&f.every((c,n)=>suit(c)===i&&rank(c)===n+1))&&Number.isInteger(p.moves)&&p.moves>=0&&(()=>{const cards=[...p.columns.flat(),...p.cells.filter(c=>c!==null),...p.foundations.flat()];return cards.length===52&&new Set(cards).size===52&&cards.every(n=>Number.isInteger(n)&&n!==null&&n>=0&&n<52);})();return valid(s)&&Number.isInteger(s.deal)&&s.deal>0&&Number.isInteger(s.elapsed)&&s.elapsed>=0&&Array.isArray(s.history)&&s.history.length<=300&&s.history.every(valid)?structuredClone(s):null;
}
export function restoreSpider(v:unknown):SpiderSession|null{
  const s=v as SpiderSession;const valid=(p:SpiderPosition)=>p&&Array.isArray(p.columns)&&p.columns.length===10&&p.columns.every(c=>Array.isArray(c)&&c.length<=104&&c.every(v=>v&&typeof v.up==='boolean')&&c.every((v,i)=>!i||!c[i-1].up||v.up))&&Array.isArray(p.stock)&&p.stock.length<=50&&p.stock.length%10===0&&Array.isArray(p.completed)&&p.completed.length<=8&&p.completed.every(c=>Array.isArray(c)&&c.length===13&&c.every((id,i)=>rank(id)===13-i&&spiderSuit(id,s.suits)===spiderSuit(c[0],s.suits)))&&Number.isInteger(p.moves)&&p.moves>=0&&Number.isInteger(p.score)&&p.score>=0&&(()=>{const cards=[...p.columns.flat().map(c=>c.id),...p.stock,...p.completed.flat()];return cards.length===104&&new Set(cards).size===104&&cards.every(n=>Number.isInteger(n)&&n>=0&&n<104);})();return s&&[1,2,4].includes(s.suits)&&valid(s)&&Number.isInteger(s.deal)&&s.deal>0&&Number.isInteger(s.elapsed)&&s.elapsed>=0&&Array.isArray(s.history)&&s.history.length<=300&&s.history.every(valid)?structuredClone(s):null;
}
