import { EXTRA_NONOGRAM_PICTURES } from './nonogram-art.ts';
export interface SlidingSession { size:3|4|5; board:number[]; start:number[]; history:number[][]; moves:number; elapsed:number; paused:boolean; completed:boolean; seed:number }
export function slidingSolved(board:number[]):boolean{return board.every((n,i)=>n===(i+1)%board.length);}
export function slidingNeighbours(board:number[],size:number):number[]{const at=board.indexOf(0);return [at-size,at+size,at%size?at-1:-1,at%size<size-1?at+1:-1].filter(i=>i>=0&&i<board.length);}
export function newSliding(size:3|4|5=4,random=Math.random):SlidingSession{
  const board=Array.from({length:size*size},(_,i)=>(i+1)%(size*size));let previous=-1;
  // A long legal walk from the solved board guarantees reachable parity at every size.
  for(let n=0;n<size*size*120;n++){const choices=slidingNeighbours(board,size).filter(i=>i!==previous),to=choices[Math.floor(random()*choices.length)],empty=board.indexOf(0);[board[to],board[empty]]=[board[empty],board[to]];previous=empty;}
  if(slidingSolved(board)){const to=slidingNeighbours(board,size)[0],empty=board.indexOf(0);[board[to],board[empty]]=[board[empty],board[to]];}
  return {size,board,start:board.slice(),history:[],moves:0,elapsed:0,paused:false,completed:false,seed:Math.floor(random()*0xffffffff)};
}
export function moveSliding(s:SlidingSession,at:number):boolean{
  if(s.paused||s.completed||!slidingNeighbours(s.board,s.size).includes(at))return false;s.history.push(s.board.slice());if(s.history.length>1000)s.history.shift();const empty=s.board.indexOf(0);[s.board[at],s.board[empty]]=[s.board[empty],s.board[at]];s.moves++;s.completed=slidingSolved(s.board);return true;
}
export function slidingDistance(board:number[],size:number):number{return board.reduce((n,v,i)=>v?n+Math.abs(Math.floor(i/size)-Math.floor((v-1)/size))+Math.abs(i%size-(v-1)%size):n,0);}
export function slidingHint(s:SlidingSession):number|null{
  if(s.paused||s.completed)return null;const b=s.board.slice(),size=s.size,start=slidingDistance(b,size);let bound=start,visited=0;const limit=180000,path:number[]=[],seen=new Set<string>();
  function search(cost:number,bound:number,previous:number):number{const h=slidingDistance(b,size),f=cost+h;if(f>bound)return f;if(!h)return -1;if(++visited>limit)return Infinity;let next=Infinity;const empty=b.indexOf(0),choices=slidingNeighbours(b,size).filter(i=>i!==previous).sort((a,z)=>{const va=b[a],vz=b[z];return (Math.abs(Math.floor(empty/size)-Math.floor((va-1)/size))+Math.abs(empty%size-(va-1)%size))-(Math.abs(Math.floor(empty/size)-Math.floor((vz-1)/size))+Math.abs(empty%size-(vz-1)%size));});
    for(const at of choices){[b[at],b[empty]]=[b[empty],b[at]];const key=b.join(',');if(!seen.has(key)){seen.add(key);path.push(at);const value=search(cost+1,bound,empty);if(value===-1)return -1;path.pop();seen.delete(key);next=Math.min(next,value);}[b[at],b[empty]]=[b[empty],b[at]];}return next;
  }
  while(bound<=start+18&&visited<limit){seen.clear();seen.add(b.join(','));const value=search(0,bound,-1);if(value===-1)return path[0];if(!Number.isFinite(value))break;bound=value;}
  // A small beam can plan through temporary distance increases. Avoid layouts
  // already visited by the player; a purely greedy fallback oscillates forever.
  const recent=new Set(s.history.slice(-100).map(b=>b.join(','))),known=new Set([s.board.join(',')]);
  let beam=[{board:s.board,first:-1,previous:-1}],best:{first:number;score:number}|null=null;
  for(let depth=1;depth<=10;depth++){
    const next:{board:number[];first:number;previous:number;score:number}[]=[];
    for(const node of beam){const empty=node.board.indexOf(0);for(const at of slidingNeighbours(node.board,size)){
      if(at===node.previous)continue;const board=node.board.slice();[board[at],board[empty]]=[board[empty],board[at]];const key=board.join(',');if(known.has(key)||recent.has(key))continue;known.add(key);
      const d=slidingDistance(board,size),first=node.first<0?at:node.first,score=d+depth*.3;if(!d)return first;
      if(!best||score<best.score)best={first,score};next.push({board,first,previous:empty,score});
    }}beam=next.sort((a,b)=>a.score-b.score).slice(0,96);if(!beam.length)break;
  }
  return best?.first??slidingNeighbours(s.board,size)[0]??null;
}
export const PEG_POINTS=Array.from({length:49},(_,i)=>[Math.floor(i/7),i%7]).filter(([r,c])=>(r>=2&&r<=4)||(c>=2&&c<=4));
export interface PegMove { from:number; over:number; to:number }
export const PEG_JUMPS:PegMove[]=PEG_POINTS.flatMap(([r,c],from)=>[[-1,0],[1,0],[0,-1],[0,1]].flatMap(([dr,dc])=>{const over=PEG_POINTS.findIndex(([y,x])=>y===r+dr&&x===c+dc),to=PEG_POINTS.findIndex(([y,x])=>y===r+2*dr&&x===c+2*dc);return to>=0&&over>=0?[{from,over,to}]:[];}));
export interface PegSession { board:number[]; start:number[]; history:number[][]; layout:'english'|'diamond'; moves:number; last:PegMove|null }
export function newPegs(layout:PegSession['layout']='english'):PegSession{const board=PEG_POINTS.map(([r,c])=>layout==='diamond'?(Math.abs(r-3)+Math.abs(c-3)<=2?1:0):1);board[PEG_POINTS.findIndex(([r,c])=>r===3&&c===3)]=0;return {board,start:board.slice(),history:[],layout,moves:0,last:null};}
export function pegMoves(s:Pick<PegSession,'board'>):PegMove[]{return PEG_JUMPS.filter(m=>s.board[m.from]&&s.board[m.over]&&!s.board[m.to]);}
export function movePeg(s:PegSession,from:number,to:number):boolean{const m=pegMoves(s).find(m=>m.from===from&&m.to===to);if(!m)return false;s.history.push(s.board.slice());s.board[from]=s.board[m.over]=0;s.board[to]=1;s.moves++;s.last={...m};return true;}
export function pegHint(s:PegSession):PegMove|null{
  const moves=pegMoves(s);if(!moves.length)return null;const failed=new Set<bigint>();let nodes=0;const center=PEG_POINTS.findIndex(([r,c])=>r===3&&c===3),bits=(b:number[])=>b.reduce((v,n,i)=>n?v|(1n<<BigInt(i)):v,0n),start=bits(s.board);
  const jumpBits=PEG_JUMPS.map(m=>({m,from:1n<<BigInt(m.from),over:1n<<BigInt(m.over),to:1n<<BigInt(m.to)}));
  function solve(board:bigint):boolean{if((board&(board-1n))===0n)return board===(1n<<BigInt(center));if(++nodes>180000||failed.has(board))return false;for(const j of jumpBits)if(board&j.from&&board&j.over&&!(board&j.to)&&solve(board^j.from^j.over^j.to))return true;failed.add(board);return false;}
  for(const m of moves){const next=start^(1n<<BigInt(m.from))^(1n<<BigInt(m.over))^(1n<<BigInt(m.to));if(solve(next))return m;}
  return moves.map(m=>{const b=s.board.slice();b[m.from]=b[m.over]=0;b[m.to]=1;const spread=b.reduce((n,v,i)=>n+v*(Math.abs(PEG_POINTS[i][0]-3)+Math.abs(PEG_POINTS[i][1]-3)),0);return {m,value:pegMoves({board:b}).length*2-spread};}).sort((a,b)=>b.value-a.value)[0].m;
}
export const NONO_PICTURES=[
 {name:'A little heart',rows:['01110','11111','11111','01110','00100']},
 {name:'Sail away',rows:['00100','00110','00111','11111','11111']},
 {name:'A quiet tree',rows:['00100','01110','11111','00100','00100']},
 {name:'Coffee break',rows:['00000','11110','10111','11110','01100']},
 {name:'Butterfly',rows:['10001','11011','11111','11011','10001']},
 {name:'Evening cottage',rows:['0001100000','0011110000','0111111000','1111111100','0111111000','0101101000','0101101000','0111111000','0000000000','1111111111']},
 {name:'Mountain moon',rows:['0000001100','0000011110','0000011110','0000001100','0001000000','0011100100','0111111110','1111111111','0000000000','1111111111']},
 {name:'Tulip',rows:['0000000000','0010010010','0011111110','0011111110','0001111100','0000111000','0000010000','0011010110','0001111100','0000010000']},
 {name:'The lighthouse',rows:['000000010000000','000000111000000','000001111100000','000000111000000','000000101000000','000000111000000','000000111000000','000000111000000','000000101000000','000000111000000','000000111000000','000001111100000','001111111111000','111111111111111','000000000000000']},
 ...EXTRA_NONOGRAM_PICTURES,
];
export const lineClues=(line:number[]):number[]=>{const result:number[]=[];let run=0;for(const n of [...line,0]){if(n)run++;else if(run){result.push(run);run=0;}}return result.length?result:[0];};
export function nonogramLines(solution:number[],size:number):{rows:number[][];cols:number[][]}{return {rows:Array.from({length:size},(_,r)=>lineClues(solution.slice(r*size,(r+1)*size))),cols:Array.from({length:size},(_,c)=>lineClues(Array.from({length:size},(_,r)=>solution[r*size+c])))};}
export function linePossibilities(clues:number[],length:number,known:number[]=Array(length).fill(0)):number[][]{
  if(clues.length===1&&clues[0]===0)return known.some(n=>n===1)?[]:[Array(length).fill(-1)];const output:number[][]=[];
  function place(group:number,at:number,line:number[]):void{if(group===clues.length){const full=[...line,...Array(length-line.length).fill(-1)];if(full.every((n,i)=>!known[i]||known[i]===n))output.push(full);return;}const remaining=clues.slice(group+1).reduce((a,n)=>a+n,0)+clues.length-group-1;for(let start=at;start<=length-clues[group]-remaining;start++){let next=[...line,...Array(start-line.length).fill(-1),...Array(clues[group]).fill(1)];if(next.some((n,i)=>known[i]&&known[i]!==n))continue;if(group+1<clues.length)next.push(-1);place(group+1,next.length,next);}}
  place(0,0,[]);return output;
}
export function solveNonogram(rows:number[][],cols:number[][],input:number[],limit=2):{count:number;solution:number[]|null}{
  const size=rows.length;let count=0,solution:number[]|null=null,nodes=0;
  function walk(board:number[]):void{if(count>=limit||++nodes>15000)return;let changed=true;
    while(changed){changed=false;for(let axis=0;axis<2;axis++)for(let n=0;n<size;n++){const indices=Array.from({length:size},(_,i)=>axis?i*size+n:n*size+i),poss=linePossibilities((axis?cols:rows)[n],size,indices.map(i=>board[i]));if(!poss.length)return;for(let i=0;i<size;i++)if(!board[indices[i]]&&poss.every(p=>p[i]===poss[0][i])){board[indices[i]]=poss[0][i];changed=true;}}}
    const unknown=board.indexOf(0);if(unknown<0){count++;solution??=board.slice();return;}for(const value of [1,-1]){const next=board.slice();next[unknown]=value;walk(next);}
  }walk(input.slice());return {count,solution};
}
export interface NonogramSession { size:number; picture:number; solution:number[]; cells:number[]; history:number[][]; elapsed:number; paused:boolean; mistakes:number; hints:number }
export function newNonogram(picture=0):NonogramSession{const art=NONO_PICTURES[(picture+NONO_PICTURES.length)%NONO_PICTURES.length],size=art.rows.length;return {size,picture,solution:art.rows.join('').split('').map(Number),cells:Array(size*size).fill(0),history:[],elapsed:0,paused:false,mistakes:0,hints:0};}
export function nonogramSolved(s:NonogramSession):boolean{return s.cells.length===s.solution.length&&s.cells.every((n,i)=>[-1,0,1].includes(n)&&(n===1)===!!s.solution[i]);}
export function markNonogram(s:NonogramSession,indices:number[],mark:1|-1|0):boolean{if(s.paused||nonogramSolved(s)||![-1,0,1].includes(mark))return false;const valid=[...new Set(indices)].filter(i=>Number.isInteger(i)&&i>=0&&i<s.cells.length);if(!valid.some(i=>s.cells[i]!==mark))return false;s.history.push(s.cells.slice());if(s.history.length>300)s.history.shift();valid.forEach(i=>s.cells[i]=mark);return true;}
export function nonogramHint(s:NonogramSession):{at:number;value:1|-1;reason:string}|null{
  if(s.paused||nonogramSolved(s))return null;
  const wrong=s.cells.findIndex((n,i)=>n!==0&&(n===1)!==!!s.solution[i]);if(wrong>=0)return {at:wrong,value:s.solution[wrong]?1:-1,reason:`Row ${Math.floor(wrong/s.size)+1}, column ${wrong%s.size+1} conflicts with the checked picture. ${s.solution[wrong]?'Fill':'Cross'} this square before following other clues. This correction uses the solution; it is not a deduction from the current working.`};
  const {rows,cols}=nonogramLines(s.solution,s.size);
  for(let axis=0;axis<2;axis++)for(let n=0;n<s.size;n++){const indices=Array.from({length:s.size},(_,i)=>axis?i*s.size+n:n*s.size+i),poss=linePossibilities((axis?cols:rows)[n],s.size,indices.map(i=>s.cells[i]));for(let i=0;i<s.size;i++)if(!s.cells[indices[i]]&&poss.length&&poss.every(p=>p[i]===poss[0][i]))return {at:indices[i],value:poss[0][i] as 1|-1,reason:`Every legal arrangement of ${axis?'column':'row'} ${n+1} ${poss[0][i]===1?'fills':'leaves empty'} this square.`};}
  return null;
}
export function restoreSliding(v:unknown):SlidingSession|null{const s=v as SlidingSession;if(!s||![3,4,5].includes(s.size))return null;const good=(a:unknown)=>Array.isArray(a)&&a.length===s.size*s.size&&new Set(a).size===a.length&&a.every(n=>Number.isInteger(n)&&n>=0&&n<a.length);return good(s.board)&&good(s.start)&&Array.isArray(s.history)&&s.history.length<=1000&&s.history.every(good)&&Number.isInteger(s.moves)&&s.moves>=0&&Number.isInteger(s.elapsed)&&s.elapsed>=0&&typeof s.paused==='boolean'?{...structuredClone(s),completed:slidingSolved(s.board)}:null;}
export function restorePegs(v:unknown):PegSession|null{const s=v as PegSession;const good=(a:unknown)=>Array.isArray(a)&&a.length===33&&a.every(n=>n===0||n===1);return s&&good(s.board)&&good(s.start)&&['english','diamond'].includes(s.layout)&&Array.isArray(s.history)&&s.history.length<=32&&s.history.every(good)&&Number.isInteger(s.moves)&&s.moves>=0?structuredClone(s):null;}
export function restoreNonogram(v:unknown):NonogramSession|null{const s=v as NonogramSession;if(!s||!Number.isInteger(s.picture)||s.picture<0||s.picture>=NONO_PICTURES.length)return null;const source=newNonogram(s.picture),good=(a:unknown)=>Array.isArray(a)&&a.length===source.cells.length&&a.every(n=>n===0||n===1||n===-1);return s.size===source.size&&JSON.stringify(s.solution)===JSON.stringify(source.solution)&&good(s.cells)&&Array.isArray(s.history)&&s.history.length<=300&&s.history.every(good)&&Number.isInteger(s.elapsed)&&s.elapsed>=0&&typeof s.paused==='boolean'&&Number.isInteger(s.hints)&&s.hints>=0?structuredClone(s):null;}
