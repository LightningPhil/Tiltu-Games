import {skillChoice,seededRandom} from '../skill.ts';
import {base,remember,rand,integers,gridNeighbours} from './common.ts';
import type {Base} from './common.ts';
export type HopKind='chinese'|'halma'|'fox'|'tafl';
export interface HopSession extends Base {kind:HopKind;size:number;board:number[];human:number;last:number[];positions:string[]}
export interface HopMove {from:number;to:number;path:number[];captured?:number}
export const STAR_POINTS:number[][]=[];for(let r=-8;r<=8;r++)for(let q=-8;q<=8;q++){const t=-q-r;if([q,r,t].filter(n=>Math.abs(n)<=4).length>=2)STAR_POINTS.push([q,r]);}
export const FOX_POINTS:number[][]=[];for(let r=0;r<7;r++)for(let c=0;c<7;c++)if((r>=2&&r<=4)||(c>=2&&c<=4))FOX_POINTS.push([c,r]);
const CORNERS=[0,6,42,48],THRONE=24;
export function halmaCamp(size:number,side:number):number[]{const rows=size===16?[5,5,4,3,2]:[4,3,2,1],out:number[]=[];rows.forEach((count,r)=>{for(let c=0;c<count;c++)out.push(side?(size-1-r)*size+size-1-c:r*size+c);});return out;}
export const hopGoal=(s:HopSession,p:number)=>s.kind==='chinese'?STAR_POINTS.flatMap(([,r],i)=>p===0?r>4?[i]:[]:r< -4?[i]:[]):halmaCamp(s.size,1-p);
export function newHop(kind:HopKind,size=kind==='halma'?16:7,seed?:number):HopSession{const board=Array(kind==='chinese'?STAR_POINTS.length:kind==='fox'?33:size*size).fill(0),s:HopSession={...base(kind,'computer',3,seed),kind,size,board,human:0,last:[],positions:[]};if(kind==='chinese')STAR_POINTS.forEach(([,r],i)=>{if(r< -4)board[i]=1;if(r>4)board[i]=2;});if(kind==='halma')for(const p of [0,1])halmaCamp(size,p).forEach(i=>board[i]=p+1);if(kind==='fox'){FOX_POINTS.forEach(([,r],i)=>{if(r>=4)board[i]=1;});board[FOX_POINTS.findIndex(([c,r])=>c===3&&r===3)]=2;}if(kind==='tafl'){[3,10,21,22,26,27,38,45].forEach(i=>board[i]=2);[17,23,25,31].forEach(i=>board[i]=1);board[24]=3;s.turn=1;}s.positions=[hopPosition(s)];return s;}
const owner=(v:number)=>v===3?0:v-1;
function hopPosition(s:HopSession):string{return s.board.join('')+'/'+s.turn;}
export function hopMoves(s:HopSession,player=s.turn):HopMove[]{if(s.result!==null)return [];const moves:HopMove[]=[];
 if(s.kind==='tafl'){for(let from=0;from<49;from++)if(s.board[from]&&owner(s.board[from])===player){for(const [dr,dc]of [[1,0],[-1,0],[0,1],[0,-1]])for(let step=1;step<7;step++){const r=Math.floor(from/7)+dr*step,c=from%7+dc*step,to=r*7+c;if(r<0||c<0||r>6||c>6||s.board[to])break;if(s.board[from]!==3&&(to===THRONE||CORNERS.includes(to)))continue;moves.push({from,to,path:[from,to]});}}return moves;}
 const coords=s.kind==='chinese'?STAR_POINTS:s.kind==='fox'?FOX_POINTS:Array.from({length:s.board.length},(_,i)=>[i%s.size,Math.floor(i/s.size)]),map=new Map(coords.map((p,i)=>[p.join(','),i])),directions=s.kind==='chinese'?[[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]]:[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],goals=new Set(hopGoal(s,player));
 for(let from=0;from<s.board.length;from++)if(s.board[from]===player+1){const [x,y]=coords[from];const validDir=(dx:number,dy:number)=>s.kind!=='fox'||(!dx||!dy||(x+y)%2===0);for(const [dx,dy]of directions){if(!validDir(dx,dy)||s.kind==='fox'&&player===0&&dy>0)continue;const to=map.get([x+dx,y+dy].join(','));if(to!==undefined&&!s.board[to]&&(!(s.kind==='chinese'||s.kind==='halma')||!goals.has(from)||goals.has(to)))moves.push({from,to,path:[from,to]});if(s.kind==='fox'&&player===1){const landing=map.get([x+2*dx,y+2*dy].join(','));if(to!==undefined&&s.board[to]===1&&landing!==undefined&&!s.board[landing])moves.push({from,to:landing,path:[from,landing],captured:to});}}
  if(s.kind==='fox')continue;const visited=new Set([from]),queue:{at:number;path:number[]}[]=[{at:from,path:[from]}];for(let head=0;head<queue.length;head++){const item=queue[head],[cx,cy]=coords[item.at];for(const [dx,dy]of directions){const over=map.get([cx+dx,cy+dy].join(',')),to=map.get([cx+2*dx,cy+2*dy].join(','));if(over===undefined||over===from||!s.board[over]||to===undefined||visited.has(to)||s.board[to]||goals.has(item.at)&&!goals.has(to))continue;const path=[...item.path,to];visited.add(to);queue.push({at:to,path});moves.push({from,to,path});}}
 }return moves;
}
function taflCapture(s:HopSession,to:number,p:number):number[]{const captures:number[]=[];for(const near of gridNeighbours(to,7)){const n=s.board[near];if(!n||owner(n)===p||n===3)continue;const beyond=near+(near-to);if(beyond<0||beyond>=49||Math.abs((beyond%7)-(near%7))+Math.abs(Math.floor(beyond/7)-Math.floor(near/7))!==1)continue;const hostile=s.board[beyond]&&owner(s.board[beyond])===p||CORNERS.includes(beyond)||(beyond===THRONE&&(n===2||!s.board[beyond]));if(hostile)captures.push(near);}captures.forEach(i=>s.board[i]=0);
 const king=s.board.indexOf(3);if(p===1&&king>=0){if(king===THRONE){if(gridNeighbours(king,7).every(i=>s.board[i]===2)){s.board[king]=0;captures.push(king);}}else for(const d of [1,7]){const a=king-d,b=king+d;if(a>=0&&b<49&&(d!==1||Math.floor(a/7)===Math.floor(b/7))&&(s.board[a]===2||CORNERS.includes(a))&&(s.board[b]===2||CORNERS.includes(b))&&(to===a||to===b)){s.board[king]=0;captures.push(king);break;}}}return captures;}
function encircled(s:HopSession):boolean{const queue=s.board.flatMap((v,i)=>v!==2&&(i<7||i>=42||i%7===0||i%7===6)?[i]:[]),seen=new Set(queue);for(let head=0;head<queue.length;head++)for(const n of gridNeighbours(queue[head],7))if(s.board[n]!==2&&!seen.has(n)){seen.add(n);queue.push(n);}return !s.board.some((v,i)=>(v===1||v===3)&&seen.has(i));}
export function moveHop(s:HopSession,from:number,to:number):boolean{const move=hopMoves(s).find(m=>m.from===from&&m.to===to);return move?applyHop(s,move,true):false;}
function applyHop(s:HopSession,move:HopMove,record=false,detectBlock=true):boolean{const {from,to}=move,p=s.turn;if(record)remember(s,`Player ${p+1}: ${from+1} → ${to+1}${move.path.length>2?` · ${move.path.length-1} hops`:''}`);s.board[to]=s.board[from];s.board[from]=0;s.last=move.path;
 if(move.captured!==undefined){s.board[move.captured]=0;s.notice='One goose captured.';}
 if(s.kind==='tafl'){const caught=taflCapture(s,to,p);if(caught.length)s.notice=`${caught.length} ${caught.length===1?'piece':'pieces'} captured.`;if(s.board.indexOf(3)<0||encircled(s))s.result=1;else if(CORNERS.includes(s.board.indexOf(3)))s.result=0;}
 if(s.kind==='fox'){if(s.board.filter(n=>n===1).length<=2)s.result=1;else if(!hopMoves(s,1).length)s.result=0;}
 if(s.kind==='chinese'||s.kind==='halma'){const goal=hopGoal(s,p);if(goal.every(i=>s.board[i]===p+1))s.result=p;}
 s.turn=1-p;
 if((s.kind==='chinese'||s.kind==='halma')&&s.result===null){const target=hopGoal(s,s.turn);if(target.every(i=>s.board[i])&&target.some(i=>s.board[i]===s.turn+1)){s.result=s.turn;s.notice='The target camp is full, including your own pieces. The published anti-blocking rule wins at the start of your turn.';}}
 if(detectBlock&&s.result===null&&!hopMoves(s).length)s.result=p;
 if(s.kind==='tafl'){const key=hopPosition(s);s.positions.push(key);if(s.positions.filter(v=>v===key).length>=3){s.result=1-p;s.notice='The player repeating a position for the third time loses.';}if(s.positions.length>500)s.positions.shift();}return true;
}
const hopProgress=(s:HopSession,p:number)=>{const goals=hopGoal(s,p);return s.board.reduce((sum,v,i)=>{if(v!==p+1)return sum;if(s.kind==='chinese'){const [x,y]=STAR_POINTS[i];return sum+(p===0?y:-y)*4-Math.abs(x+y/2)*.15+(goals.includes(i)?15:0);}const r=Math.floor(i/s.size),c=i%s.size;return sum+(p===0?r+c:2*(s.size-1)-r-c)*2+(goals.includes(i)?20:0);},0);};
function evaluateHop(s:HopSession,p:number):number{if(s.result!==null)return s.result===p?1e6:-1e6;if(s.kind==='chinese'||s.kind==='halma')return hopProgress(s,p)-hopProgress(s,1-p);if(s.kind==='fox'){const geese=s.board.filter(v=>v===1).length,mob=hopMoves(s,1).length;return (p===0?1:-1)*(geese*45-mob*7);}const king=s.board.indexOf(3),r=Math.floor(king/7),c=king%7,escape=Math.min(r+c,r+6-c,6-r+c,12-r-c),material=s.board.reduce((n,v)=>n+(v===1?30:v===2?-12:0),0),mob=hopMoves(s,0).filter(m=>s.board[m.from]===3).length;return (p===0?1:-1)*(material-escape*18+mob*4);}
export const HOP_LEVELS=[{depth:0,nodes:0,width:0},{depth:1,nodes:150,width:8},{depth:2,nodes:1500,width:10},{depth:3,nodes:6000,width:12},{depth:4,nodes:18000,width:16}] as const;
export function chooseHop(s:HopSession,level=s.level):HopMove|null{
 const legal=hopMoves(s);if(!legal.length)return null;
 const rng=seededRandom(s.seed+s.moves*997),index=Math.max(0,Math.min(4,level-1)),config=HOP_LEVELS[index];if(level<=1)return legal[Math.floor(rng()*legal.length)];
 const p=s.turn,copy=(v:HopSession):HopSession=>({...v,board:v.board.slice(),positions:v.positions.slice(),last:v.last.slice(),history:[],records:[]}),advance=(v:HopSession,m:HopMove)=>{const n=copy(v);applyHop(n,m,false,false);return n;};
 if(s.kind==='chinese'||s.kind==='halma'){
  const goals=new Set(hopGoal(s,p));
  if(s.board.filter((v,i)=>v===p+1&&!goals.has(i)).length<=2){
   const deadline=performance.now()+300,proven:HopMove[]=[];
   const canFinish=(v:HopSession)=>hopMoves(v,p).some(m=>[...goals].every(at=>at===m.to||at!==m.from&&v.board[at]===p+1));
   for(const move of legal){
    if(performance.now()>deadline)break;const n=advance(s,move);
    if(n.result!==null){if(n.result===p){if(level>=3)return move;proven.push(move);}continue;}
    if(!canFinish(n))continue;let complete=true;
    for(const reply of hopMoves(n)){
     if(performance.now()>deadline){complete=false;break;}
     const v=advance(n,reply);if(v.result!==null?v.result!==p:!canFinish(v)){complete=false;break;}
    }
    if(complete)proven.push(move);
   }
   if(proven.length){const keys=new Set(proven.map(m=>m.from+':'+m.to));return skillChoice([...proven,...legal.filter(m=>!keys.has(m.from+':'+m.to))],level,rng);}
  }
 }
 let nodes=0;const deadline=performance.now()+[0,100,350,850,1800][index],abort=Symbol('hop budget'),cache=new Map<string,{d:number;value:number}>();
 const ordered=(v:HopSession,limit=Infinity)=>{
  let moves=hopMoves(v);if(moves.length>limit){const goals=new Set(hopGoal(v,v.turn)),rank=(m:HopMove)=>{if(v.kind==='chinese'){const a=STAR_POINTS[m.from],b=STAR_POINTS[m.to];return (v.turn===0?b[1]-a[1]:a[1]-b[1])*4+(goals.has(m.to)?15:0)-(goals.has(m.from)?15:0);}if(v.kind==='halma')return (v.turn===0?1:-1)*(Math.floor(m.to/v.size)+m.to%v.size-Math.floor(m.from/v.size)-m.from%v.size)*2+(goals.has(m.to)?20:0)-(goals.has(m.from)?20:0);return (m.captured!==undefined?100:0)+(v.board[m.from]===3&&CORNERS.includes(m.to)?100000:0);};moves=moves.sort((a,b)=>rank(b)-rank(a)).slice(0,limit);}
  return moves.map(m=>{const n=advance(v,m);return {m,n,value:evaluateHop(n,p)};}).sort((a,b)=>v.turn===p?b.value-a.value:a.value-b.value);
 };
 function search(v:HopSession,d:number,alpha:number,beta:number):number{
  if(++nodes>config.nodes||performance.now()>deadline)throw abort;if(v.result!==null||d<=0)return evaluateHop(v,p);
  const key=v.board.join('')+'/'+v.turn+'/'+d,hit=s.kind==='tafl'?undefined:cache.get(key);if(hit&&hit.d>=d)return hit.value;
  const startA=alpha,startB=beta,list=ordered(v,config.width);if(!list.length)return v.turn===p?-1e6:1e6;const max=v.turn===p;let best=max?-Infinity:Infinity,cut=false;
  for(const {n}of list){const value=search(n,d-1,alpha,beta);if(max){best=Math.max(best,value);alpha=Math.max(alpha,best);}else{best=Math.min(best,value);beta=Math.min(beta,best);}if(beta<=alpha){cut=true;break;}}
  if(!cut&&best>startA&&best<startB&&s.kind!=='tafl')cache.set(key,{d,value:best});return best;
 }
 let ranked=ordered(s);const wins=ranked.filter(v=>v.n.result===p);if(wins.length&&level>=3)return wins[0].m;
 for(let d=2;d<=config.depth;d++){
  try{const iteration=ranked.map(v=>({...v,value:search(v.n,d-1,-Infinity,Infinity)}));ranked=iteration.sort((a,b)=>b.value-a.value);}
  catch(e){if(e!==abort)throw e;break;}
 }
 return skillChoice(ranked,level,rng).m;
}
export function validHop(s:HopSession):boolean{const length=s.kind==='chinese'?121:s.kind==='fox'?33:s.kind==='tafl'?49:s.size*s.size;return [7,10,16].includes(s.size)&&integers(s.board,length,0,s.kind==='tafl'?3:2)&&s.turn<2&&[0,1].includes(s.human)&&integers(s.last,s.last.length,0,length-1)&&s.last.length<=121&&Array.isArray(s.positions)&&s.positions.length<=500&&s.positions.every(v=>typeof v==='string'&&v.length<300);}
