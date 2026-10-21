import {skillChoice,seededRandom} from '../skill.ts';
import {base,remember,rand,integers} from './common.ts';
import type {Base} from './common.ts';
export type RaceKind='snakes'|'senet'|'ludo'|'ur';
export interface RaceSession extends Base {kind:RaceKind;players:number;pawns:number[][];roll:number;dice:number[];phase:'roll'|'move';sixes:number;last:number[];ludoRoute?:number}
export const LADDERS:Record<number,number>={1:38,4:14,9:31,21:42,28:84,36:44,51:67,71:91,80:100};
export const SNAKES:Record<number,number>={16:6,47:26,49:11,56:53,62:19,64:60,87:24,93:73,95:75,98:78};
export const LUDO_SAFE=[0,8,13,21,26,34,39,47];
export const LUDO_TRACK:number[][]=[[6,1],[6,2],[6,3],[6,4],[6,5],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],[0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[9,8],[10,8],[11,8],[12,8],[13,8],[14,8],[14,7],[14,6],[13,6],[12,6],[11,6],[10,6],[9,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],[6,0]];
export const raceFinish=(kind:RaceKind)=>kind==='snakes'?100:kind==='senet'?30:kind==='ludo'?56:14;
export function newRace(kind:RaceKind,players=2,seed?:number):RaceSession{return {...base(kind,'computer',3,seed),kind,...(kind==='ludo'?{ludoRoute:2}:{}),players:kind==='ludo'?players:kind==='snakes'?players:2,pawns:Array.from({length:kind==='senet'||kind==='ur'?2:players},(_,p)=>Array.from({length:kind==='snakes'?1:kind==='senet'?5:kind==='ludo'?4:7},(_,i)=>kind==='snakes'?0:kind==='senet'?i*2+p:-1)),roll:0,dice:[],phase:'roll',sixes:0,last:[]};}
export const ludoGlobal=(s:RaceSession,p:number,pos:number)=>(pos+(s.players===2?p*26:p*13))%52;
function ludoAt(s:RaceSession,global:number):{p:number;i:number}[]{return s.pawns.flatMap((a,p)=>a.flatMap((n,i)=>n>=0&&n<51&&ludoGlobal(s,p,n)===global?[{p,i}]:[]));}
export function raceDestination(s:RaceSession,index:number):number|null{
 const p=s.turn,at=s.pawns[p][index],roll=s.roll,end=raceFinish(s.kind);if(at===undefined||at===end||s.phase!=='move'||s.result!==null)return null;
 if(s.kind==='snakes')return at+roll<=100?at+roll:null;
 if(s.kind==='ur'){const to=at+roll;if(to>14||!roll||s.pawns[p].some((n,i)=>i!==index&&n===to&&to<14))return null;if(to===7&&s.pawns[1-p].includes(7))return null;return to;}
 if(s.kind==='senet'){
  const to=at+roll;if(at===27&&roll!==3||at===28&&roll!==2||at===29&&roll!==1||to>30||at<25&&to>25)return null;
  if(to<30&&s.pawns[p].some((n,i)=>i!==index&&n===to))return null;
  if(to<30&&s.pawns[1-p].includes(to)&&s.pawns[1-p].some(n=>n<30&&Math.abs(n-to)===1))return null;return to;
 }
 const to=at<0?s.roll===6?0:-2:at+roll;if(to<0||to>56)return null;
 if(to<51){const dest=ludoGlobal(s,p,to),pieces=ludoAt(s,dest);if(!LUDO_SAFE.includes(dest)&&pieces.filter(v=>v.p!==p).length>=2)return null;}return to;
}
export const raceMoves=(s:RaceSession)=>s.pawns[s.turn].flatMap((_,i)=>raceDestination(s,i)===null?[]:[i]);
function next(s:RaceSession,bonus=false):void{if(!bonus){s.turn=(s.turn+1)%s.players;s.sixes=0;}s.phase='roll';}
export function castRace(s:RaceSession,forced?:number[]):boolean{
 if(s.phase!=='roll'||s.result!==null)return false;remember(s,`Player ${s.turn+1} casts`);s.dice=forced?.slice()??Array.from({length:s.kind==='senet'||s.kind==='ur'?4:1},()=>s.kind==='senet'||s.kind==='ur'?rand(s,2):rand(s,6)+1);
 s.roll=s.dice.reduce((a,n)=>a+n,0);if(s.kind==='senet'&&!s.roll)s.roll=5;s.phase='move';s.notice=`${s.kind==='senet'?'Sticks':'Roll'}: ${s.roll}.`;
 if(s.kind==='ludo'){s.sixes=s.roll===6?s.sixes+1:0;if(s.sixes===3){s.notice='Third consecutive six. The roll is forfeited; the next player rolls.';next(s);return true;}}
 if(!raceMoves(s).length){const bonus=s.kind==='ludo'&&s.roll===6;s.notice+=bonus?' No full legal move. Six still earns another roll.':s.roll?' No full legal move. Turn passes.':' No marks face up. Turn passes.';next(s,bonus);}return true;
}
export function moveRace(s:RaceSession,index:number):boolean{
 const to=raceDestination(s,index);if(to===null)return false;const p=s.turn,from=s.pawns[p][index];remember(s,`Player ${p+1}: counter ${index+1}, ${from<0?'start':from+1} → ${to===raceFinish(s.kind)?'home':to+1}`);s.last=[p,index,from,to];let bonus=false;s.pawns[p][index]=to;
 if(s.kind==='snakes'){const final=LADDERS[to]??SNAKES[to]??to;s.pawns[p][index]=final;s.last.push(final);s.notice=LADDERS[to]?`Up the ladder: ${to} → ${final}.`:SNAKES[to]?`Down the snake: ${to} → ${final}.`:`Square ${to}.`;}
 if(s.kind==='ur'){if(to>=4&&to<=11&&to!==7){const captured=s.pawns[1-p].indexOf(to);if(captured>=0){s.pawns[1-p][captured]=-1;s.notice='A rival counter returns to the start.';}}bonus=[3,7,13].includes(to);if(bonus)s.notice+=' A rosette: cast again.';}
 if(s.kind==='senet'){const rival=s.pawns[1-p].indexOf(to);if(to<30&&rival>=0){s.pawns[1-p][rival]=from;s.notice='The two counters exchange houses.';}if(to===26){let rebirth=14;const occupied=s.pawns.flat();while(rebirth>=0&&occupied.includes(rebirth))rebirth--;s.pawns[p][index]=Math.max(0,rebirth);s.notice=`Water! Return to the first open rebirth house (${rebirth+1}).`;}bonus=[1,4,5].includes(s.roll);if(bonus)s.notice+=' Cast again.';}
 if(s.kind==='ludo'){if(to<51){const g=ludoGlobal(s,p,to);if(!LUDO_SAFE.includes(g)){for(const v of ludoAt(s,g))if(v.p!==p){s.pawns[v.p][v.i]=-1;bonus=true;s.sixes=0;s.notice='A rival counter returns to its yard. Roll again.';}}}if(to===56){bonus=true;s.sixes=0;s.notice='One counter home. Roll again.';}bonus||=s.roll===6;if(bonus&&!s.notice)s.notice='A six: roll again.';}
 if(s.pawns[p].every(n=>n===raceFinish(s.kind)))s.result=p;next(s,bonus);return true;
}
export const RACE_LEVELS=[0,0,0,1,2] as const;
const travelCosts=new Map<RaceKind,number[]>();
function raceTravelCosts(kind:RaceKind):number[]{
 const saved=travelCosts.get(kind);if(saved)return saved;
 const end=raceFinish(kind),cost=Array.from({length:end+2},(_,i)=>Math.max(0,end-i+1)),weights=[1,4,6,4,1];cost[end+1]=0;
 // Expected casts to bring one counter home. Staying put on an unusable cast
 // and Senet's water/rebirth and exact-exit houses are part of the equation.
 for(let iteration=0;iteration<1500;iteration++){
  let difference=0;
  for(let pos=end-1;pos>=-1;pos--){
   if(kind==='senet'&&pos<0)continue;let value=1;
   for(let r=0;r<5;r++){
    const roll=kind==='senet'&&!r?5:r;let to=pos+roll;
    if(kind==='senet'){if(pos===27&&roll!==3||pos===28&&roll!==2||pos===29&&roll!==1||to>end||pos<25&&to>25)to=pos;if(to===26)to=14;}
    else if(!roll||to>end)to=pos;
    value+=weights[r]/16*cost[to+1];
   }
   difference=Math.max(difference,Math.abs(cost[pos+1]-value));cost[pos+1]=value;
  }
  if(difference<1e-10)break;
 }
 travelCosts.set(kind,cost);return cost;
}
export function chooseRace(s:RaceSession,level=s.level):number|null{
 const legal=raceMoves(s);if(!legal.length)return null;const rng=seededRandom(s.seed+s.moves*997);if(level<=1)return legal[Math.floor(rng()*legal.length)];
 const p=s.turn,end=raceFinish(s.kind),copy=(v:RaceSession):RaceSession=>({...v,pawns:v.pawns.map(a=>a.slice()),dice:v.dice.slice(),last:v.last.slice(),history:[],records:[]});
 if(s.kind==='ur'||s.kind==='senet'){
  const costs=raceTravelCosts(s.kind),ranked=legal.map(m=>{const n=copy(s);moveRace(n,m);const remaining=n.pawns.map(a=>a.reduce((v,pos)=>v+costs[pos+1],0));return {m,n,value:n.result===p?10000:n.result!==null?-10000:remaining[1-p]-remaining[p]+(n.turn===p?.8:-.8)};}).sort((a,b)=>b.value-a.value);
  if(level>=3&&ranked[0].n.result===p)return ranked[0].m;
  return skillChoice(ranked,level,rng).m;
 }
 const evaluate=(v:RaceSession):number=>{
  if(v.result!==null)return v.result===p?10000:-10000;
  const values=v.pawns.map((a,q)=>a.reduce((n,pos)=>n+(pos===end?end+45:pos<0?-8:pos)+(v.kind==='ur'&&[3,7,13].includes(pos)?7:0)+(v.kind==='senet'&&a.some(x=>x!==pos&&Math.abs(x-pos)===1)?3:0),0));
  return values[p]-values.filter((_,q)=>q!==p).reduce((a,n)=>a+n,0)/(v.players-1);
 };
 const dice=Array.from({length:6},(_,i)=>[[i+1],1]);
 let nodes=0;const abort=Symbol('race budget'),budget=level===5?30000:5000;
 function future(v:RaceSession,d:number):number{
  if(++nodes>budget)throw abort;if(v.result!==null||d<=0)return evaluate(v);
  let total=0,weight=0;for(const [forced,w]of dice as [number[],number][]){const n=copy(v);castRace(n,forced);let value:number;
   if(n.phase==='move'){const outcomes=raceMoves(n).map(m=>{const child=copy(n);moveRace(child,m);return future(child,d-1);});value=n.turn===p?Math.max(...outcomes):Math.min(...outcomes);}
   else value=future(n,d-1);total+=value*w;weight+=w;
  }return total/weight;
 }
 let ranked=legal.map(m=>{const n=copy(s);moveRace(n,m);return {m,n,value:evaluate(n)};}).sort((a,b)=>b.value-a.value);
 if(level>=3&&ranked[0].n.result===p)return ranked[0].m;
 for(let depth=1;depth<=RACE_LEVELS[Math.min(4,level-1)];depth++)try{const complete=ranked.map(v=>({...v,value:future(v.n,depth)}));ranked=complete.sort((a,b)=>b.value-a.value);}catch(e){if(e!==abort)throw e;break;}
 return skillChoice(ranked,level,rng).m;
}
export function validRace(s:RaceSession):boolean{const n=s.kind==='snakes'?1:s.kind==='senet'?5:s.kind==='ludo'?4:7;return [2,3,4].includes(s.players)&&s.pawns.length===s.players&&s.pawns.every(a=>integers(a,n,s.kind==='senet'||s.kind==='snakes'?0:-1,raceFinish(s.kind)))&&s.turn<s.players&&['roll','move'].includes(s.phase)&&Number.isInteger(s.roll)&&s.roll>=0&&s.roll<=6&&integers(s.dice,s.dice.length,0,6)&&s.dice.length<=4&&Number.isInteger(s.sixes)&&s.sixes>=0&&s.sixes<=3&&Array.isArray(s.last)&&s.last.length<=5;}

/** Preserve pre-audit saves while removing the old extra shared-track step. */
export function migrateLudo(s:RaceSession):void{if(s.kind!=='ludo'||s.ludoRoute===2)return;const convert=(n:number)=>n>=51?n-1:n;if(Array.isArray(s.pawns))s.pawns=s.pawns.map(a=>a.map(convert));if(Array.isArray(s.last))s.last=s.last.map((n,i)=>i>=2?convert(n):n);s.ludoRoute=2;}
