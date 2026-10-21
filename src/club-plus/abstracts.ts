import {skillChoice,seededRandom} from '../skill.ts';
import {base,remember,rand,integers} from './common.ts';
import type {Base} from './common.ts';
export type AbstractKind='gomoku'|'nim'|'hex';
export interface AbstractSession extends Base {kind:AbstractKind;board:number[];size:number;heaps:number[];variant:'normal'|'misere'|'subtract';colours:number[];pie:boolean;path:number[];last:number}
export function newAbstract(kind:AbstractKind,size=kind==='gomoku'?15:7,variant:AbstractSession['variant']='normal',seed?:number):AbstractSession{return {...base(kind,'computer',3,seed),kind,size,board:Array(kind==='nim'?0:size*size).fill(0),heaps:variant==='subtract'?[17]:[3,5,7],variant,colours:[1,2],pie:false,path:[],last:-1};}
export function fiveLine(board:number[],size:number,at:number):number[]{const p=board[at];if(!p)return [];for(const [dr,dc]of [[0,1],[1,0],[1,1],[1,-1]]){const line=[at];for(const sign of [-1,1])for(let step=1;step<size;step++){const r=Math.floor(at/size)+dr*step*sign,c=at%size+dc*step*sign;if(r<0||c<0||r>=size||c>=size||board[r*size+c]!==p)break;line.push(r*size+c);}if(line.length>=5)return line;}return [];}
export function hexNeighbours(at:number,size:number):number[]{const r=Math.floor(at/size),c=at%size;return [[r-1,c],[r+1,c],[r,c-1],[r,c+1],[r-1,c+1],[r+1,c-1]].filter(([r,c])=>r>=0&&c>=0&&r<size&&c<size).map(([r,c])=>r*size+c);}
export function hexPath(board:number[],size:number,colour:number):number[]{const queue=Array.from({length:size},(_,i)=>colour===1?i:i*size).filter(i=>board[i]===colour),parent=new Map(queue.map(i=>[i,-1]));for(let head=0;head<queue.length;head++){const at=queue[head];if(colour===1?at>=size*(size-1):at%size===size-1){const path=[];for(let i=at;i!==-1;i=parent.get(i)!)path.push(i);return path;}for(const n of hexNeighbours(at,size))if(board[n]===colour&&!parent.has(n)){parent.set(n,at);queue.push(n);}}return [];}
export function abstractMoves(s:AbstractSession):number[]{if(s.result!==null)return [];if(s.kind==='nim')return s.heaps.flatMap((n,i)=>Array.from({length:s.variant==='subtract'?Math.min(3,n):n},(_,j)=>i*100+j+1));return [...s.board.flatMap((n,i)=>n?[]:[i]),...(s.kind==='hex'&&s.pie&&s.turn===1?[-1]:[])];}
export function playAbstract(s:AbstractSession,at:number):boolean{
 if(s.result!==null)return false;
 if(at===-1&&s.kind==='hex'&&s.pie&&s.turn===1){remember(s,'Player 2 swaps colours');s.colours.reverse();s.pie=false;s.turn=0;s.notice='Colours swapped. Player 1 now connects left to right.';return true;}
 if(!abstractMoves(s).includes(at))return false;const p=s.turn;remember(s,`${p?'Player 2':'Player 1'}: ${s.kind==='nim'?`take ${at%100} from pile ${Math.floor(at/100)+1}`:`${String.fromCharCode(65+at%s.size)}${Math.floor(at/s.size)+1}`}`);
 if(s.kind==='nim'){s.heaps[Math.floor(at/100)]-=at%100;if(s.heaps.every(n=>!n))s.result=s.variant==='misere'?1-p:p;}
 else{s.board[at]=s.colours[p];s.last=at;s.path=s.kind==='gomoku'?fiveLine(s.board,s.size,at):hexPath(s.board,s.size,s.colours[p]);if(s.path.length)s.result=p;else if(s.board.every(Boolean))s.result=-1;s.pie=s.kind==='hex'&&s.moves===1;}
 s.turn=1-p;return true;
}
function gomokuScore(b:number[],size:number,at:number,p:number):number{let total=0;b[at]=p;for(const [dr,dc]of [[0,1],[1,0],[1,1],[1,-1]]){let n=1,open=0;for(const sign of [-1,1])for(let step=1;step<=5;step++){const r=Math.floor(at/size)+dr*step*sign,c=at%size+dc*step*sign;if(r<0||c<0||r>=size||c>=size)break;const v=b[r*size+c];if(v===p)n++;else{if(!v)open++;break;}}total+=n>=5?1e8:n===4?(open===2?1e6:open?100000:0):n===3?(open===2?20000:open?800:0):n===2?(open===2?200:20):open*2;}b[at]=0;return total;}
function searchAbstract(s:AbstractSession,level:number,rootOrder:number[]):number {
 const b=s.board,n=s.size,root=s.colours[s.turn],enemy=s.colours[1-s.turn],gomoku=s.kind==='gomoku',width=level===5?10:6,maxDepth=level===5?4:2,deadline=performance.now()+(level===5?1800:600),abort=Symbol('time');let nodes=0;
 const vacant=()=>b.flatMap((v,i)=>v?[]:[i]);
 const value=()=>{
  if(!gomoku){const own=hexDistance(b,n,root),other=hexDistance(b,n,enemy);return own===0?1e8:other===0?-1e8:other*13-own*15;}
  const available=vacant(),own=available.map(at=>gomokuScore(b,n,at,root)).sort((a,b)=>b-a),other=available.map(at=>gomokuScore(b,n,at,enemy)).sort((a,b)=>b-a);
  return (own[0]??0)+(own[1]??0)*.3+(own[2]??0)*.1-(other[0]??0)-(other[1]??0)*.3-(other[2]??0)*.1;
 };
 const ordered=(colour:number)=>{
  const available=vacant();
  if(gomoku){const ranked=available.map(at=>({at,a:gomokuScore(b,n,at,colour),d:gomokuScore(b,n,at,3-colour)}));const wins=ranked.filter(v=>v.a>=1e8);if(wins.length)return wins.map(v=>v.at);const blocks=ranked.filter(v=>v.d>=1e8);if(blocks.length)return blocks.map(v=>v.at);return ranked.sort((a,b)=>(b.a+b.d*1.1)-(a.a+a.d*1.1)).slice(0,width).map(v=>v.at);}
  return available.map(at=>{b[at]=colour;const score=value();b[at]=0;return {at,score};}).sort((a,b)=>colour===root?b.score-a.score:a.score-b.score).slice(0,width).map(v=>v.at);
 };
 function search(depth:number,colour:number,last:number,alpha:number,beta:number):number {
  if(++nodes>18000||performance.now()>deadline)throw abort;
  const won=gomoku?fiveLine(b,n,last).length:hexPath(b,n,3-colour).length;
  if(won)return (3-colour===root?1:-1)*(1e8+depth);
  if(!depth||!b.includes(0))return value();
  let best=colour===root?-Infinity:Infinity;
  for(const at of ordered(colour)){if(performance.now()>deadline)throw abort;b[at]=colour;let score:number;try{score=search(depth-1,3-colour,at,alpha,beta);}finally{b[at]=0;}if(colour===root){best=Math.max(best,score);alpha=Math.max(alpha,best);}else{best=Math.min(best,score);beta=Math.min(beta,best);}if(alpha>=beta)break;}
  return best;
 }
 let ranked=rootOrder.slice(0,level===5?14:8).map(at=>({at,score:0}));
 for(let depth=1;depth<=maxDepth;depth++){
  try{const completed=ranked.map(v=>{b[v.at]=root;let score:number;try{score=search(depth-1,enemy,v.at,-Infinity,Infinity);}finally{b[v.at]=0;}return {at:v.at,score};});ranked=completed.sort((a,b)=>b.score-a.score);}
  catch(e){if(e!==abort)throw e;break;}
 }
 return skillChoice(ranked,level,seededRandom(s.seed+s.moves*997)).at;
}
export function hexDistance(b:number[],size:number,p:number):number{const d=Array(b.length).fill(1e5),used=new Set<number>();for(let i=0;i<size;i++){const at=p===1?i:i*size;d[at]=b[at]===p?0:b[at]?1e5:1;}for(let step=0;step<b.length;step++){let at=-1;for(let i=0;i<d.length;i++)if(!used.has(i)&&(at<0||d[i]<d[at]))at=i;if(at<0||d[at]>=1e5)break;if(p===1?at>=size*(size-1):at%size===size-1)return d[at];used.add(at);for(const n of hexNeighbours(at,size))d[n]=Math.min(d[n],d[at]+(b[n]===p?0:b[n]?1e5:1));}return 1e5;}
export function chooseAbstract(s:AbstractSession,level=s.level):number|null{
 s={...s,board:s.board.slice()};const allLegal=abstractMoves(s),legal=allLegal.filter(m=>m>=0);if(!allLegal.length)return null;const sample={seed:s.seed+ s.moves*997};if(level===1)return allLegal[rand(sample,allLegal.length)];
 if(s.kind==='nim'){const optimal=legal.filter(m=>{const heaps=s.heaps.slice();heaps[Math.floor(m/100)]-=m%100;if(s.variant==='subtract')return heaps[0]%4===0;const ones=heaps.filter(n=>n===1).length,big=heaps.filter(n=>n>1).length;return s.variant==='misere'&&big===0?ones%2===1:heaps.reduce((a,n)=>a^n,0)===0;});return optimal.length&&rand(sample,100)<[0,35,65,90,100][level-1]?optimal[rand(sample,optimal.length)]:legal[rand(sample,legal.length)];}
 const p=s.colours[s.turn],q=s.colours[1-s.turn],n=s.size;
 if(s.kind==='gomoku'){
  const scores=legal.map(at=>({at,attack:gomokuScore(s.board,n,at,p),defend:gomokuScore(s.board,n,at,q)}));const win=scores.find(m=>m.attack>=1e8);if(win)return win.at;const block=scores.find(m=>m.defend>=1e8);if(block)return block.at;
  const ordered=scores.map(m=>({...m,score:m.attack+m.defend*(level>=3?1.1:.55)-Math.hypot(Math.floor(m.at/n)-(n-1)/2,m.at%n-(n-1)/2)*2})).sort((a,b)=>b.score-a.score);
  // An open four, or two independent closed fours, forces the next win.
  // Creating that threat takes priority over defending an opponent's three.
  const forks=ordered.filter(m=>m.attack>=200000);
  if(forks.length)return skillChoice([...forks,...ordered.filter(m=>!forks.includes(m))],level,seededRandom(s.seed+s.moves*997)).at;
  if(level>=4)return searchAbstract(s,level,ordered.map(m=>m.at));
  return ordered[rand(sample,level===2?Math.min(4,ordered.length):1)].at;
 }
 if(s.pie&&s.turn===1&&level>=3){const stone=s.board.findIndex(Boolean);if(Math.abs(Math.floor(stone/n)-(n-1)/2)+Math.abs(stone%n-(n-1)/2)<n/3)return -1;}
 const scored=legal.map(at=>{s.board[at]=p;const path=hexPath(s.board,n,p),d=hexDistance(s.board,n,p),enemy=hexDistance(s.board,n,q);s.board[at]=0;return {at,score:path.length?1e7:enemy*13-d*15+hexNeighbours(at,n).filter(i=>s.board[i]===p).length*1.5-Math.abs(Math.floor(at/n)-(n-1)/2)*.05};}).sort((a,b)=>b.score-a.score);
 if(level>=4){if(scored[0].score>=1e7)return scored[0].at;return searchAbstract(s,level,scored.map(m=>m.at));}
 return skillChoice(scored,level,seededRandom(s.seed+s.moves*997)).at;
}
export function validAbstract(s:AbstractSession):boolean{return ['gomoku','hex','nim'].includes(s.kind)&&[7,9,11,15,19].includes(s.size)&&integers(s.board,s.kind==='nim'?0:s.size*s.size,0,2)&&Array.isArray(s.heaps)&&s.heaps.length>=1&&s.heaps.length<=5&&s.heaps.every(n=>Number.isInteger(n)&&n>=0&&n<=25)&&['normal','misere','subtract'].includes(s.variant)&&integers(s.colours,2,1,2)&&new Set(s.colours).size===2&&typeof s.pie==='boolean'&&Array.isArray(s.path)&&s.path.every(i=>Number.isInteger(i)&&i>=0&&i<s.board.length);}
