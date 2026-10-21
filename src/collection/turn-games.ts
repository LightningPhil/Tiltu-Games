import {skillChoice} from '../skill.ts';
export type TurnGame = 'noughts' | 'reversi' | 'dots' | 'morris' | 'kalah';
export type Side = 1 | -1;
export interface TurnMove { to: number; from?: number; capture?: boolean }
export interface TurnPosition { board: number[]; turn: Side; result: Side | 0 | null; reserve: [number, number]; phase: 'play' | 'take'; quiet: number; last: number[]; notice: string }
export interface TurnSession extends TurnPosition { kind: TurnGame; mode: 'computer' | 'local'; level: number; history: TurnPosition[]; records: string[]; repetitions: string[]; size: number }
export const sideIndex = (p: Side) => p === 1 ? 0 : 1;
export const opposite = (p: Side): Side => p === 1 ? -1 : 1;
const clonePosition = (s: TurnPosition): TurnPosition => ({ board: s.board.slice(), turn: s.turn, result: s.result, reserve: [...s.reserve], phase: s.phase, quiet: s.quiet, last: s.last.slice(), notice: s.notice });
export function newTurnGame(kind: TurnGame, mode: TurnSession['mode'] = 'computer', level = 3, size = 4): TurnSession {
  const board = Array(kind === 'noughts' ? 9 : kind === 'reversi' ? 64 : kind === 'dots' ? 2 * size * (size + 1) + size * size : kind === 'morris' ? 24 : 14).fill(0);
  if (kind === 'reversi') { board[27] = board[36] = -1; board[28] = board[35] = 1; }
  if (kind === 'kalah') for (let i = 0; i < 14; i++) if (i !== 6 && i !== 13) board[i] = 4;
  return { kind, mode, level, size, board, turn: 1, result: null, reserve: kind === 'morris' ? [9, 9] : [0, 0], phase: 'play', quiet: 0, last: [], notice: '', history: [], records: [], repetitions: [] };
}
export const MORRIS_MILLS = [[0,1,2],[3,4,5],[6,7,8],[9,10,11],[12,13,14],[15,16,17],[18,19,20],[21,22,23],[0,9,21],[3,10,18],[6,11,15],[1,4,7],[16,19,22],[8,12,17],[5,13,20],[2,14,23]];
export const MORRIS_POINTS = [[0,0],[3,0],[6,0],[1,1],[3,1],[5,1],[2,2],[3,2],[4,2],[0,3],[1,3],[2,3],[4,3],[5,3],[6,3],[2,4],[3,4],[4,4],[1,5],[3,5],[5,5],[0,6],[3,6],[6,6]];
export const MORRIS_LINKS = MORRIS_MILLS.flatMap(([a,b,c]) => [[a,b],[b,c]]);
const inMill = (b: number[], i: number) => !!b[i] && MORRIS_MILLS.some(line => line.includes(i) && line.every(n => b[n] === b[i]));
export function reversiFlips(board: number[], at: number, p: Side): number[] {
  if (at < 0 || at >= 64 || board[at]) return [];
  const result: number[] = [];
  for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
    let r = Math.floor(at/8)+dr, c = at%8+dc; const line: number[] = [];
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r*8+c] === -p) { line.push(r*8+c); r += dr; c += dc; }
    if (line.length && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r*8+c] === p) result.push(...line);
  }
  return result;
}
export function dotBoxEdges(size: number, box: number): number[] {
  const r = Math.floor(box/size), c = box%size, horizontal = size*(size+1);
  return [r*size+c,(r+1)*size+c,horizontal+r*(size+1)+c,horizontal+r*(size+1)+c+1];
}
export function turnMoves(s: TurnSession): TurnMove[] {
  if (s.result !== null) return [];
  const b = s.board, p = s.turn;
  if (s.kind === 'noughts') return b.flatMap((n,to) => n ? [] : [{to}]);
  if (s.kind === 'reversi') return b.flatMap((_,to) => reversiFlips(b,to,p).length ? [{to}] : []);
  if (s.kind === 'dots') return b.slice(0,2*s.size*(s.size+1)).flatMap((n,to)=>n?[]:[{to}]);
  if (s.kind === 'kalah') return Array.from({length:6},(_,i)=>i+(p===1?0:7)).filter(i=>b[i]>0).map(to=>({to}));
  if (s.phase === 'take') { const pieces = b.flatMap((n,i)=>n===-p?[i]:[]), unprotected = pieces.filter(i=>!inMill(b,i)); return (unprotected.length?unprotected:pieces).map(to=>({to,capture:true})); }
  const empty = b.flatMap((n,i)=>n?[]:[i]);
  if (s.reserve[sideIndex(p)] > 0) return empty.map(to=>({to}));
  const pieces = b.flatMap((n,i)=>n===p?[i]:[]), flying = pieces.length === 3;
  return pieces.flatMap(from=>empty.filter(to=>flying||MORRIS_LINKS.some(([a,z])=>a===from&&z===to||a===to&&z===from)).map(to=>({from,to})));
}
function positionKey(s: TurnSession): string { return `${s.board.join(',')}/${s.turn}/${s.reserve}/${s.phase}`; }
function finishTurn(s: TurnSession): void {
  const b = s.board;
  if (s.kind === 'noughts') {
    const line = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].find(line=>b[line[0]] && line.every(i=>b[i]===b[line[0]]));
    if (line) { s.result = b[line[0]] as Side; s.last = line; } else if (b.every(Boolean)) s.result = 0;
  }
  if (s.kind === 'reversi' && !turnMoves(s).length) {
    s.turn = opposite(s.turn);
    if (!turnMoves(s).length) { const total = b.reduce((a,n)=>a+n,0); s.result = total===0?0:total>0?1:-1; s.notice = 'Neither player has a legal move. The most discs wins.'; }
    else s.notice += ` ${s.turn === 1 ? 'White' : 'Black'} has no move and passes. ${s.turn === 1 ? 'Black' : 'White'} plays again.`;
  }
  if (s.kind === 'morris' && s.phase === 'play') {
    const remaining = b.filter(n=>n===s.turn).length+s.reserve[sideIndex(s.turn)];
    if (remaining < 3 || !turnMoves(s).length) s.result = opposite(s.turn);
    if (s.result === null && (s.quiet >= 100 || s.repetitions.filter(k=>k===positionKey(s)).length>=3)) { s.result=0; s.notice=s.quiet>=100?'Draw after 50 moves each without a capture.':'Draw by threefold repetition.'; }
  }
}
export function playTurn(s: TurnSession, move: TurnMove, remember = true): boolean {
  const legal = turnMoves(s).find(m=>m.to===move.to&&m.from===move.from&&!!m.capture===!!move.capture); if (!legal) return false;
  if (remember) { s.history.push(clonePosition(s)); if(s.history.length>250){s.history.shift();s.records.shift();} }
  const b=s.board,p=s.turn; s.last=[move.to];s.notice='';s.quiet++;
  if(s.kind==='noughts'){b[move.to]=p;s.turn=opposite(p);}
  else if(s.kind==='reversi'){const flips=reversiFlips(b,move.to,p);b[move.to]=p;flips.forEach(i=>b[i]=p);s.last.push(...flips);s.notice=`${flips.length} disc${flips.length===1?'':'s'} turned.`;s.turn=opposite(p);}
  else if(s.kind==='dots'){
    b[move.to]=p;const start=2*s.size*(s.size+1);let earned=0;
    for(let i=0;i<s.size*s.size;i++)if(!b[start+i]&&dotBoxEdges(s.size,i).every(e=>b[e])){b[start+i]=p;earned++;s.last.push(start+i);}
    if(!earned)s.turn=opposite(p);else s.notice=`${earned} box${earned===1?'':'es'} completed. Play again.`;
    if(b.slice(0,start).every(Boolean)){const score=b.slice(start).reduce((a,n)=>a+n,0);s.result=score===0?0:score>0?1:-1;s.notice=`Every box is claimed. Final score: ${b.slice(start).filter(n=>n===1).length}–${b.slice(start).filter(n=>n===-1).length}.`;}
  } else if(s.kind==='kalah'){
    const own=p===1?6:13,enemy=p===1?13:6;let seeds=b[move.to],at=move.to;b[at]=0;
    while(seeds){at=(at+1)%14;if(at===enemy)continue;b[at]++;seeds--;s.last.push(at);}
    if(at!==own && (p===1?at<6:at>6&&at<13) && b[at]===1 && b[12-at]>0){const caught=b[12-at]+1;b[own]+=caught;b[at]=b[12-at]=0;s.notice=`Captured ${caught} seeds.`;}
    const ended=b.slice(0,6).every(n=>n===0)||b.slice(7,13).every(n=>n===0);
    if(ended){b[6]+=b.slice(0,6).reduce((a,n)=>a+n,0);b[13]+=b.slice(7,13).reduce((a,n)=>a+n,0);for(let i=0;i<14;i++)if(i!==6&&i!==13)b[i]=0;s.result=b[6]===b[13]?0:b[6]>b[13]?1:-1;s.notice+=' Remaining seeds move to their owner’s store.';}
    else if(at===own)s.notice+=' Last seed in your store. Play again.';else s.turn=opposite(p);
  } else if(s.kind==='morris'){
    if(s.phase==='take'){b[move.to]=0;s.phase='play';s.turn=opposite(p);s.quiet=0;s.notice='One opposing man removed.';}
    else {if(move.from!==undefined){b[move.from]=0;s.last.unshift(move.from);}else{s.reserve[sideIndex(p)]--;s.quiet=0;}b[move.to]=p;
      if(inMill(b,move.to)&&b.some(n=>n===-p)){s.phase='take';s.notice='A mill! Choose an opposing man to remove. Men outside mills must be taken first.';}else s.turn=opposite(p);
    }
    s.repetitions.push(positionKey(s));if(s.repetitions.length>300)s.repetitions.shift();
  }
  finishTurn(s);
  if(remember)s.records.push(`${s.mode==='local'?p===1?'Player 1':'Player 2':p===1?'You':'Computer'}: ${move.capture?'remove ':move.from!==undefined?`${move.from+1} → `:''}${move.to+1}${s.notice?' · '+s.notice:''}`);
  return true;
}
export function undoTurn(s: TurnSession): boolean {
  if(!s.history.length)return false;
  do {Object.assign(s,s.history.pop()!);s.records.pop();if(s.kind==='morris')s.repetitions.pop();}while(s.mode==='computer'&&(s.turn===-1||s.phase==='take')&&s.history.length);
  return true;
}
function evaluate(s: TurnSession,p:Side):number{
  if(s.result!==null){const margin=s.kind==='reversi'?s.board.reduce((a,n)=>a+n*p,0):s.kind==='dots'?s.board.slice(2*s.size*(s.size+1)).reduce((a,n)=>a+n*p,0):s.kind==='kalah'?(s.board[6]-s.board[13])*p:0;return (s.result===0?0:s.result===p?100000:-100000)+margin;}
  const b=s.board;
  if(s.kind==='noughts'){return [0,2,6,8].reduce((v,i)=>v+b[i]*p*2,0)+b[4]*p*4;}
  if(s.kind==='reversi'){
    const weights=[100,-28,12,6,6,12,-28,100,-28,-45,-2,-2,-2,-2,-45,-28,12,-2,5,2,2,5,-2,12,6,-2,2,1,1,2,-2,6,6,-2,2,1,1,2,-2,6,12,-2,5,2,2,5,-2,12,-28,-45,-2,-2,-2,-2,-45,-28,100,-28,12,6,6,12,-28,100];
    const empties=b.filter(n=>!n).length;return b.reduce((v,n,i)=>v+n*p*(empties<14?8:1)+n*p*weights[i],0)+7*(b.filter((_,i)=>reversiFlips(b,i,p).length).length-b.filter((_,i)=>reversiFlips(b,i,opposite(p)).length).length);
  }
  if(s.kind==='dots'){const start=2*s.size*(s.size+1);return b.slice(start).reduce((a,n)=>a+n*p*30,0)-Array.from({length:s.size*s.size},(_,i)=>dotBoxEdges(s.size,i).filter(e=>b[e]).length).filter(n=>n===3).length*(s.turn===p?-5:5);}
  if(s.kind==='kalah')return (b[6]-b[13])*p*15+(b.slice(0,6).reduce((a,n)=>a+n,0)-b.slice(7,13).reduce((a,n)=>a+n,0))*p;
  return b.reduce((a,n)=>a+n*p*18,0)+(s.reserve[0]-s.reserve[1])*p*10+MORRIS_MILLS.reduce((v,line)=>{const a=line.filter(i=>b[i]===p).length,z=line.filter(i=>b[i]===-p).length;return v+(z?0:a===3?22:a===2?7:a)-(a?0:z===3?22:z===2?7:z);},0);
}
export function chooseTurnMove(s: TurnSession, level=s.level, random= Math.random): TurnMove | null {
  const moves=turnMoves(s);if(!moves.length)return null;
  if(level<=1)return moves[Math.floor(random()*moves.length)];
  if(s.kind==='dots'&&level>=4&&moves.length<=(level===5?14:8)){
    // Only unplayed edges affect the remaining boxes. Cache that bitmask,
    // rather than the colours/order of already drawn edges.
    const boxes=Array.from({length:s.size*s.size},(_,i)=>dotBoxEdges(s.size,i));
    const edgeBits=new Map(moves.map((m,i)=>[m.to,1<<i]));
    const masks=boxes.map(edges=>edges.reduce((mask,e)=>mask|(edgeBits.get(e)??0),0));
    const affected=moves.map(m=>boxes.flatMap((edges,i)=>edges.includes(m.to)?[i]:[]));
    const memo=new Map<number,number>(),root=s.turn;
    const after=(mask:number,i:number,p:Side):{mask:number;turn:Side;gain:number}=>{
      const next=mask&~(1<<i),taken=affected[i].filter(box=>(mask&masks[box])!==0&&(next&masks[box])===0).length;
      return {mask:next,turn:taken?p:opposite(p),gain:taken*(p===root?1:-1)};
    };
    function exact(mask:number,p:Side):number{
      if(!mask)return 0;const key=mask*2+(p===root?1:0),cached=memo.get(key);if(cached!==undefined)return cached;
      let best=p===root?-Infinity:Infinity;
      for(let i=0;i<moves.length;i++)if(mask&(1<<i)){const n=after(mask,i,p),v=n.gain+exact(n.mask,n.turn);best=p===root?Math.max(best,v):Math.min(best,v);}
      memo.set(key,best);return best;
    }
    const all=(1<<moves.length)-1,ranked=moves.map((m,i)=>{const n=after(all,i,root);return {m,value:n.gain+exact(n.mask,n.turn)};}).sort((a,b)=>b.value-a.value);
    return skillChoice(ranked,level,random).m;
  }
  const p=s.turn,empties=s.board.filter(n=>!n).length,solve=s.kind==='reversi'&&(level===5&&empties<=10||level===4&&empties<=6),depth=solve?empties:s.kind==='noughts'?[0,1,2,5,9][level-1]:[0,1,2,3,5][level-1],budget=solve?300000:[0,150,2500,16000,70000][level-1],deadline=s.kind==='morris'?performance.now()+[0,100,350,800,1800][level-1]:Infinity;let nodes=0;
  const copy=(v:TurnSession):TurnSession=>({...v,...clonePosition(v),history:[],records:[],repetitions:v.repetitions.slice()});
  const abort=Symbol('search budget'),exactCache=new Map<string,number>();
  function search(v:TurnSession,d:number,alpha:number,beta:number):number{
    const key=v.kind==='noughts'?v.board.join(',')+'/'+v.turn+'/'+d:'';if(key&&exactCache.has(key))return exactCache.get(key)!;
    if(++nodes>budget||performance.now()>deadline)throw abort;
    if(v.result!==null)return evaluate(v,p)+(v.result===p?d:v.result===-p?-d:0);
    if(d<=0)return evaluate(v,p);
    const list=turnMoves(v);if(!list.length)return evaluate(v,p);const maximize=v.turn===p;let best=maximize?-Infinity:Infinity;
    if(v.kind==='noughts'){const scores=list.map(m=>{const n=copy(v);playTurn(n,m,false);return search(n,d-1,-Infinity,Infinity);});const value=maximize?Math.max(...scores):Math.min(...scores);exactCache.set(key,value);return value;}
    const ordered=list.map(m=>{if(performance.now()>deadline)throw abort;const n=copy(v);playTurn(n,m,false);return {n,value:evaluate(n,p)};}).sort((a,b)=>maximize?b.value-a.value:a.value-b.value).slice(0,s.kind==='morris'&&d>1?18:s.kind==='dots'&&d>1?22:Infinity);
    for(const {n}of ordered){const value=search(n,d-1,alpha,beta);if(maximize){best=Math.max(best,value);alpha=Math.max(alpha,best);}else{best=Math.min(best,value);beta=Math.min(beta,best);}if(beta<=alpha)break;}
    return best;
  }
  if(s.kind==='kalah'&&level>=4&&s.board.filter((_,i)=>i!==6&&i!==13).reduce((a,n)=>a+n,0)<=(level===5?10:6)){
    const memo=new Map<string,number>(),visiting=new Set<string>();let count=0;
    function exact(v:TurnSession):number{if(++count>300000)throw abort;if(v.result!==null)return (v.board[6]-v.board[13])*p;const key=v.board.join(',')+'/'+v.turn,hit=memo.get(key);if(hit!==undefined)return hit;if(visiting.has(key))return 0;visiting.add(key);const values=turnMoves(v).map(m=>{const n=copy(v);playTurn(n,m,false);return exact(n);});visiting.delete(key);const value=v.turn===p?Math.max(...values):Math.min(...values);memo.set(key,value);return value;}
    try{const solved=moves.map(m=>{const n=copy(s);playTurn(n,m,false);return {m,value:exact(n)};}).sort((a,b)=>b.value-a.value);return skillChoice(solved,level,random).m;}catch(e){if(e!==abort)throw e;}
  }
  let ranked=moves.map(m=>{const n=copy(s);playTurn(n,m,false);return {m,value:evaluate(n,p)};}).sort((a,b)=>b.value-a.value);
  for(let d=1;d<=depth;d++){
    try{const complete=ranked.map(({m})=>{const n=copy(s);playTurn(n,m,false);return {m,value:search(n,d-1,-Infinity,Infinity)};});ranked=complete.sort((a,b)=>b.value-a.value);if(s.kind==='morris'&&ranked[0].value>=100000)break;}
    catch(error){if(error!==abort)throw error;break;}
  }
  // Equal scores are equivalent; lower levels additionally make occasional
  // inaccuracies. Expert always uses a fully completed root comparison.
  const tied=ranked.filter(m=>m.value===ranked[0].value),preferred=tied[Math.floor(random()*tied.length)];
  return skillChoice([preferred,...ranked.filter(m=>m!==preferred)],level,random).m;
}

export function restoreTurn(value:unknown,kind:TurnGame):TurnSession|null{
  if(!value||typeof value!=='object')return null;const s=value as TurnSession,expected=newTurnGame(kind,'computer',3,s.size===3?3:4);
  const valid=(p:TurnPosition)=>p&&Array.isArray(p.board)&&p.board.length===expected.board.length&&p.board.every(n=>Number.isInteger(n)&&n>= (kind==='kalah'?0:-1)&&n<=(kind==='kalah'?48:1))&&(p.turn===1||p.turn===-1)&&[null,0,1,-1].includes(p.result)&&Array.isArray(p.reserve)&&p.reserve.length===2&&p.reserve.every(n=>Number.isInteger(n)&&n>=0&&n<=9)&&['play','take'].includes(p.phase)&&Number.isInteger(p.quiet)&&p.quiet>=0&&Array.isArray(p.last)&&p.last.every(n=>Number.isInteger(n)&&n>=0&&n<expected.board.length)&&typeof p.notice==='string'&&p.notice.length<500;
  if(s.kind!==kind||![3,4].includes(s.size)||!['computer','local'].includes(s.mode)||!Number.isInteger(s.level)||s.level<1||s.level>5||!valid(s)||!Array.isArray(s.history)||s.history.length>250||!s.history.every(valid)||!Array.isArray(s.records)||s.records.length!==s.history.length||!s.records.every(t=>typeof t==='string'&&t.length<600)||!Array.isArray(s.repetitions)||s.repetitions.length>300||!s.repetitions.every(k=>typeof k==='string'&&k.length<300))return null;
  if(kind==='kalah'&&s.board.reduce((a,n)=>a+n,0)!==48)return null;
  return structuredClone(s);
}
