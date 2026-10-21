import {skillChoice,seededRandom} from '../skill.ts';
import {bearoffWinChance} from './bearoff.ts';
import { opposite, sideIndex } from './turn-games.ts';
import type { Side } from './turn-games.ts';
export interface BackgammonStep { from:number; to:number; die:number; hit:boolean }
export interface BackgammonPosition { board:number[]; bar:[number,number]; off:[number,number]; turn:Side; dice:number[]; rolled:number[]; phase:'opening'|'roll'|'move'|'double'|'finished'; cube:number; cubeOwner:Side|0; offeredBy:Side|0; result:Side|null; points:number; seed:number; last:BackgammonStep|null; notice:string }
export interface BackgammonSession extends BackgammonPosition { mode:'computer'|'local'; level:number; history:BackgammonPosition[]; records:string[] }
const snapshot=(s:BackgammonPosition):BackgammonPosition=>{const {history:_history,records:_records,mode:_mode,level:_level,...p}=s as BackgammonPosition & Partial<Pick<BackgammonSession,'history'|'records'|'mode'|'level'>>;return {...p,board:s.board.slice(),bar:[...s.bar],off:[...s.off],dice:s.dice.slice(),rolled:s.rolled.slice(),last:s.last?{...s.last}:null};};
export function newBackgammon(mode:BackgammonSession['mode']='computer',level=3,seed=Math.floor(Math.random()*0xffffffff)):BackgammonSession{
  const board=Array(24).fill(0);for(const [i,n]of [[23,2],[12,5],[7,3],[5,5],[0,-2],[11,-5],[16,-3],[18,-5]])board[i]=n;
  return {board,bar:[0,0],off:[0,0],turn:1,dice:[],rolled:[],phase:'opening',cube:1,cubeOwner:0,offeredBy:0,result:null,points:0,seed:seed>>>0,last:null,notice:'Roll one die each. The higher roll starts and uses both dice.',mode,level,history:[],records:[]};
}
function randomDie(s:BackgammonSession):number{s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return 1+Math.floor(s.seed/4294967296*6);}
function remember(s:BackgammonSession,label:string):void{s.history.push(snapshot(s));s.records.push(label);if(s.history.length>300){s.history.shift();s.records.shift();}}
export function backgammonSingleSteps(s:BackgammonPosition,die:number):BackgammonStep[]{
  const p=s.turn,own=sideIndex(p),b=s.board,froms=s.bar[own]?[24]:b.flatMap((n,i)=>n*p>0?[i]:[]);
  const home=s.bar[own]===0&&b.every((n,i)=>n*p<=0||(p===1?i<=5:i>=18));
  return froms.flatMap(from=>{
    const to=from===24?(p===1?24-die:die-1):from-p*die;
    if(to>=0&&to<24)return b[to]*p>=-1?[{from,to,die,hit:b[to]===-p}]:[];
    if(!home||from===24)return [];
    const distance=p===1?from+1:24-from;
    const farther=b.some((n,i)=>n*p>0&&(p===1?i>from:i<from));
    return die===distance||die>distance&&!farther?[{from,to:-1,die,hit:false}]:[];
  });
}
function apply(s:BackgammonPosition,m:BackgammonStep):void{
  const p=s.turn,own=sideIndex(p),rival=1-own;
  if(m.from===24)s.bar[own]--;else s.board[m.from]-=p;
  if(m.to===-1)s.off[own]++;else{if(s.board[m.to]===-p){s.board[m.to]=0;s.bar[rival]++;}s.board[m.to]+=p;}
  s.dice.splice(s.dice.indexOf(m.die),1);s.last={...m};
}
/** Legal continuations use as many dice as possible, and the higher die if only one fits. */
export function backgammonPaths(s:BackgammonPosition):BackgammonStep[][]{
  if(s.phase!=='move'||!s.dice.length)return [];
  function walk(v:BackgammonPosition):BackgammonStep[][]{
    const paths:BackgammonStep[][]=[];
    for(const die of new Set(v.dice))for(const step of backgammonSingleSteps(v,die)){const n=snapshot(v);apply(n,step);const tails=walk(n);if(tails.length)for(const tail of tails)paths.push([step,...tail]);else paths.push([step]);}
    return paths;
  }
  const paths=walk(s),max=Math.max(0,...paths.map(p=>p.length));let filtered=paths.filter(p=>p.length===max);
  if(max===1&&new Set(s.dice).size>1){const high=Math.max(...filtered.map(p=>p[0].die));filtered=filtered.filter(p=>p[0].die===high);}
  const seen=new Set<string>();return filtered.filter(p=>{const key=p.map(m=>`${m.from}:${m.to}:${m.die}`).join('/');if(seen.has(key))return false;seen.add(key);return true;});
}
export function backgammonMoves(s:BackgammonPosition):BackgammonStep[]{const seen=new Set<string>();return backgammonPaths(s).flatMap(p=>{const m=p[0],key=`${m.from}:${m.to}:${m.die}`;return seen.has(key)?[]:(seen.add(key),[m]);});}
function endRoll(s:BackgammonSession):void{s.turn=opposite(s.turn);s.phase='roll';s.dice=[];s.notice+=' Next player rolls.';}
export function rollBackgammon(s:BackgammonSession,forced?:[number,number]):boolean{
  if(s.phase!=='opening'&&s.phase!=='roll')return false;if(forced&&forced.some(n=>!Number.isInteger(n)||n<1||n>6))return false;
  remember(s,'Roll dice');let a=forced?.[0]??randomDie(s),b=forced?.[1]??randomDie(s);
  if(s.phase==='opening'){if(a===b){s.rolled=[a,b];s.notice='Opening roll tied. Roll one die each again.';return true;}s.turn=a>b?1:-1;s.notice=`${s.turn===1?'Player 1':'Player 2'} starts using ${a} and ${b}.`;}
  else s.notice=a===b?`Doubles: play ${a} four times.`:`Rolled ${a} and ${b}.`;
  s.rolled=[a,b];s.dice=a===b?[a,a,a,a]:[a,b];s.phase='move';s.last=null;
  if(!backgammonMoves(s).length){s.notice+=' No legal moves; turn passes.';endRoll(s);}return true;
}
export function moveBackgammon(s:BackgammonSession,step:BackgammonStep):boolean{
  const legal=backgammonMoves(s).find(m=>m.from===step.from&&m.to===step.to&&m.die===step.die);if(!legal)return false;
  remember(s,`${s.turn===1?'Player 1':'Player 2'}: ${legal.from===24?'bar':legal.from+1} → ${legal.to===-1?'off':legal.to+1} (${legal.die})${legal.hit?' · hit':''}`);apply(s,legal);
  s.notice=legal.hit?'A blot hit. It must re-enter from the bar.':legal.to===-1?'Checker borne off.':'Checker moved.';
  const own=sideIndex(s.turn),rival=1-own;
  if(s.off[own]===15){const home=s.board.some((n,i)=>n*s.turn<0&&(s.turn===1?i<6:i>=18));const multiplier=s.off[rival]?1:s.bar[rival]||home?3:2;s.result=s.turn;s.points=s.cube*multiplier;s.phase='finished';s.notice=`${multiplier===3?'Backgammon':multiplier===2?'Gammon':'Game'} · ${s.points} point${s.points===1?'':'s'}.`;}
  else if(!s.dice.length||!backgammonMoves(s).length)endRoll(s);
  return true;
}
export function offerBackgammonDouble(s:BackgammonSession):boolean{if(s.phase!=='roll'||!Number.isFinite(s.cube*4)||s.cubeOwner!==0&&s.cubeOwner!==s.turn)return false;remember(s,'Double offered');s.phase='double';s.offeredBy=s.turn;s.notice=`Double offered to ${s.cube*2}. Opponent: accept or concede the current ${s.cube} point${s.cube===1?'':'s'}.`;return true;}
export function answerBackgammonDouble(s:BackgammonSession,accept:boolean):boolean{if(s.phase!=='double'||!s.offeredBy)return false;remember(s,accept?'Double accepted':'Double declined');if(accept){s.cube*=2;s.cubeOwner=opposite(s.offeredBy);s.phase='roll';s.notice='Double accepted. The player who offered it rolls.';}else{s.result=s.offeredBy;s.points=s.cube;s.phase='finished';s.notice=`Double declined · ${s.points} point${s.points===1?'':'s'} conceded.`;}s.offeredBy=0;return true;}
export function undoBackgammon(s:BackgammonSession):boolean{if(!s.history.length)return false;do{Object.assign(s,s.history.pop()!);s.records.pop();}while(s.mode==='computer'&&s.turn===-1&&s.history.length);return true;}
export function backgammonPips(s:BackgammonPosition,p:Side):number{return s.bar[sideIndex(p)]*25+s.board.reduce((n,v,i)=>n+(v*p>0?Math.abs(v)*(p===1?i+1:24-i):0),0);}
function strength(s:BackgammonPosition,p:Side):number{
  const own=sideIndex(p),rival=1-own;let v=(s.off[own]-s.off[rival])*22+(backgammonPips(s,opposite(p))-backgammonPips(s,p))*.6+(s.bar[rival]-s.bar[own])*15;
  s.board.forEach((n,i)=>{if(n*p===1){const danger=s.board.reduce((a,z,j)=>a+(z*p<0&&(i-j)*p>0&&(i-j)*p<=12?Math.abs(z)/(Math.abs(i-j)+1):0),0);v-=danger*4;}if(n*p>=2)v+=4+((p===1?5-i:i-18)>=0?2:0);});return v;
}
export function chooseBackgammonPath(s:BackgammonSession,level=s.level,random=Math.random):BackgammonStep[]{
  const paths=backgammonPaths(s);if(!paths.length)return [];if(level===1)return paths[Math.floor(random()*paths.length)];
  const home=(p:Side)=>!s.bar[sideIndex(p)]&&s.board.every((n,i)=>n*p<=0||(p===1?i<6:i>=18));
  if(home(1)&&home(-1)&&s.board.reduce((n,v)=>n+Math.abs(v),0)<=6){
    const deadline=performance.now()+[0,250,600,1200,2400][level-1],abort=Symbol('bear-off budget'),stop=()=>{if(performance.now()>deadline)throw abort;};
    const counts=(v:BackgammonPosition,p:Side)=>Array.from({length:6},(_,i)=>Math.max(0,v.board[p===1?i:23-i]*p));
    try{const ranked=paths.map(path=>{const n=snapshot(s);path.forEach(m=>apply(n,m));const own=counts(n,s.turn),enemy=counts(n,opposite(s.turn));return {path,value:own.some(Boolean)?1-bearoffWinChance(enemy,own,stop):1};}).sort((a,b)=>b.value-a.value);return skillChoice(ranked,level,random).path;}catch(e){if(e!==abort)throw e;}
  }
  const p=s.turn,ranked=paths.map(path=>{const n=snapshot(s);path.forEach(m=>apply(n,m));return {path,n,value:strength(n,p)};}).sort((a,b)=>b.value-a.value);
  const candidates=level>=4?ranked.slice(0,level===5?12:5):ranked;
  if(level>=4){for(const candidate of candidates){let expected=0;for(let a=1;a<=6;a++)for(let b=a;b<=6;b++){const n=snapshot(candidate.n);n.turn=opposite(p);n.phase='move';n.dice=a===b?[a,a,a,a]:[a,b];const replies=backgammonPaths(n);let worst=strength(n,p);for(const reply of replies){const r=snapshot(n);reply.forEach(m=>apply(r,m));worst=Math.min(worst,strength(r,p));}expected+=worst*(a===b?1:2)/36;}candidate.value=expected;}}
  candidates.sort((a,b)=>b.value-a.value);return skillChoice(level>=4?candidates:ranked,level,random).path;
}
export function backgammonCubeDecision(s:BackgammonSession,level=s.level,random=seededRandom(s.seed+s.records.length*97)):{offer:boolean;accept:boolean}{
 const p=s.phase==='double'&&s.offeredBy?opposite(s.offeredBy):s.turn,own=sideIndex(p),lead=backgammonPips(s,opposite(p))-backgammonPips(s,p),race=s.board.every((n,i)=>n*p<=0||!s.board.some((v,j)=>v*p<0&&(i-j)*p>0)),position=strength(s,p),win=Math.max(.02,Math.min(.98,.5+lead/(race?150:220)+(s.bar[1-own]-s.bar[own])*.10+(s.off[own]-s.off[1-own])*.01));
 const noise=level<=1?(random()-.5)*.8:level===2?(random()-.5)*.35:level===3?(random()-.5)*.12:level===4?(random()-.5)*.035:0;
 const equity=win+noise,owned=s.cubeOwner===0||s.cubeOwner===s.turn;
 return {offer:s.phase==='roll'&&owned&&Number.isFinite(s.cube*4)&&equity>(level>=4?.73:.8)&&(level<5||position>10),accept:equity>=(level===5?.25:level===4?.28:.32)};
}
export function restoreBackgammon(value:unknown):BackgammonSession|null{
  if(!value||typeof value!=='object')return null;const s=value as BackgammonSession;
  const valid=(p:BackgammonPosition)=>p&&Array.isArray(p.board)&&p.board.length===24&&p.board.every(n=>Number.isInteger(n)&&Math.abs(n)<=15)&&[p.bar,p.off].every(a=>Array.isArray(a)&&a.length===2&&a.every(n=>Number.isInteger(n)&&n>=0&&n<=15))&&[1,-1].includes(p.turn)&&[p.dice,p.rolled].every(a=>Array.isArray(a)&&a.length<=4&&a.every(n=>Number.isInteger(n)&&n>=1&&n<=6))&&['opening','roll','move','double','finished'].includes(p.phase)&&Number.isFinite(p.cube)&&p.cube>=1&&Number.isInteger(Math.log2(p.cube))&&[0,1,-1].includes(p.cubeOwner)&&[0,1,-1].includes(p.offeredBy)&&[null,1,-1].includes(p.result)&&Number.isInteger(p.seed)&&typeof p.notice==='string'&&p.notice.length<500&&[1,-1].every(side=>p.board.filter(n=>n*side>0).reduce((a,n)=>a+Math.abs(n),0)+p.bar[side===1?0:1]+p.off[side===1?0:1]===15);
  if(!valid(s)||!['computer','local'].includes(s.mode)||!Number.isInteger(s.level)||s.level<1||s.level>5||!Array.isArray(s.history)||s.history.length>300||!s.history.every(valid)||!Array.isArray(s.records)||s.records.length!==s.history.length||!s.records.every(t=>typeof t==='string'&&t.length<200))return null;return structuredClone(s);
}
