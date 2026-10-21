// Independent K+P versus K win/draw retrograde reference. No external engine.
// Run: node tests/ai-benchmarks/king-pawn.ts (AI_KPK_CASES controls sample size).
import assert from 'node:assert/strict';
import {Chess,chooseChessMove} from '../../src/chess.ts';
import {seededRandom} from '../../src/skill.ts';

const N=64*64*64*2,valid=new Uint8Array(N),winning=new Uint8Array(N),remaining=new Uint8Array(N),queue=new Int32Array(N),distance=new Uint16Array(N),longest=new Uint16Array(N);
let head=0,tail=0;
const code=(p:number,w:number,b:number,t:number)=>((p*64+w)*64+b)*2+t;
const adjacent=(a:number,b:number)=>Math.max(Math.abs((a>>3)-(b>>3)),Math.abs((a&7)-(b&7)))<=1;
const pawnAttacks=(p:number,b:number)=>(b>>3)===(p>>3)-1&&Math.abs((b&7)-(p&7))===1;
const neighbours=Array.from({length:64},(_,a)=>Array.from({length:64},(_,b)=>b).filter(b=>a!==b&&adjacent(a,b)));
const mark=(i:number,d:number)=>{if(!winning[i]){winning[i]=1;distance[i]=d;queue[tail++]=i;}};
for(let p=8;p<56;p++)for(let w=0;w<64;w++)for(let b=0;b<64;b++){
 if(p===w||p===b||adjacent(w,b))continue;
 const black=code(p,w,b,1);valid[black]=1;remaining[black]=neighbours[b].filter(to=>!adjacent(to,w)&&!pawnAttacks(p,to)).length;
 if(!remaining[black]&&pawnAttacks(p,b))mark(black,0);
 if(pawnAttacks(p,b))continue;
 const white=code(p,w,b,0);valid[white]=1;
 if(p<16){const to=p-8;if(to!==w&&to!==b&&(!adjacent(to,b)||adjacent(to,w)))mark(white,1);}
}
function parent(i:number,d:number){if(!valid[i]||winning[i])return;if((i&1)===0)mark(i,d+1);else{longest[i]=Math.max(longest[i],d+1);if(--remaining[i]===0)mark(i,longest[i]);}}
while(head<tail){const i=queue[head++],turn=i&1,b=(i>>1)&63,w=(i>>7)&63,p=i>>13,d=distance[i];
 if(turn===1){for(const before of neighbours[w])parent(code(p,before,b,0),d);const before=p+8;if(before<56)parent(code(before,w,b,0),d);if((p>>3)===4&&p+8!==w&&p+8!==b)parent(code(p+16,w,b,0),d);}
 else for(const before of neighbours[b])parent(code(p,w,before,1),d);
}
function fen(p:number,w:number,b:number,turn='w'){const rows:string[]=[];for(let r=0;r<8;r++){let row='',empty=0;for(let c=0;c<8;c++){const i=r*8+c,piece=i===p?'P':i===w?'K':i===b?'k':'';if(piece){if(empty)row+=empty;empty=0;row+=piece;}else empty++;}if(empty)row+=empty;rows.push(row);}return rows.join('/')+' '+turn+' - - 0 1';}
const index=(s:string)=>(8-Number(s[1]))*8+'abcdefgh'.indexOf(s[0]);
function keyFor(c:Chess,owner:'w'|'b'){
 const pieces=c.board().flat().filter(p=>p!==null),own=pieces.find(p=>p.type==='k'&&p.color===owner)!,enemy=pieces.find(p=>p.type==='k'&&p.color!==owner)!,pawn=pieces.find(p=>p.type==='p');
 if(!pawn)return -1;const transform=(s:string)=>index(s)^(owner==='b'?56:0);return code(transform(pawn.square),transform(own.square),transform(enemy.square),c.turn()===owner?0:1);
}
function outcome(c:Chess,owner:'w'|'b'='w'):number{
 if(c.isCheckmate())return c.turn()!==owner?1:0;if(c.isDraw())return 0;const key=keyFor(c,owner);if(key>=0)return winning[key];
 const promoted=c.board().flat().find(p=>p&&p.color===owner&&p.type!=='k');if(!promoted||!['q','r'].includes(promoted.type))return 0;
 if(c.turn()!==owner&&c.moves({verbose:true}).some(m=>m.to===promoted.square&&m.captured))return 0;return 1;
}
const candidates:number[]=[];for(let i=0;i<N;i+=2)if(valid[i]&&winning[i])candidates.push(i);
const rng=seededRandom(9827),fixtures:{fen:string;best:number;values:Map<string,number>}[]=[];
const wanted=Number(process.env.AI_KPK_CASES??24);
while(fixtures.length<wanted){const i=candidates[Math.floor(rng()*candidates.length)],b=(i>>1)&63,w=(i>>7)&63,p=i>>13,f=fen(p,w,b);if(fixtures.some(s=>s.fen===f))continue;const c=new Chess(f),values=new Map<string,number>();for(const m of c.moves()){c.move(m);values.set(m,outcome(c));c.undo();}if(new Set(values.values()).size<2)continue;fixtures.push({fen:f,best:Math.max(...values.values()),values});}
const errors=Array(5).fill(0),examples:any[]=[];
for(let i=0;i<fixtures.length;i++){const fixture=fixtures[i],row:any[]=[];for(let level=1;level<=5;level++){const answer=chooseChessMove({startFen:fixture.fen,moves:[]},level,seededRandom(i+73));assert.ok(fixture.values.has(answer.move!));const value=fixture.values.get(answer.move!)!;if(value<fixture.best)errors[level-1]++;row.push({level,...answer,value});}if(row[3].value!==row[4].value)examples.push({fen:fixture.fen,values:Object.fromEntries(fixture.values),row});}
console.log(JSON.stringify({game:'chess-independent-KPK',encoded:N,legal:valid.reduce((a,n)=>a+n,0),winning:tail,positions:fixtures.length,errors,hardExpertDifferences:examples}));

function mirror(f:string){const c=new Chess(f),n=new Chess();n.clear();for(const piece of c.board().flat())if(piece){const at=index(piece.square)^56;n.put({type:piece.type,color:piece.color==='w'?'b':'w'},('abcdefgh'[at&7]+(8-(at>>3))) as any);}return n.fen().replace(' w ',' '+(c.turn()==='w'?'b':'w')+' ');}
let mirrored=0,defenders=0;
for(const fixture of fixtures){const f=mirror(fixture.fen),c=new Chess(f),answer=chooseChessMove({startFen:f,moves:[]},5,seededRandom(73));c.move(answer.move!);assert.equal(outcome(c,'b'),1);mirrored++;}
const drawnDefenders:number[]=[];for(let i=1;i<N;i+=2)if(valid[i]&&!winning[i])drawnDefenders.push(i);
for(let attempts=0;defenders<wanted&&attempts<10000;attempts++){const i=drawnDefenders[Math.floor(rng()*drawnDefenders.length)],b=(i>>1)&63,w=(i>>7)&63,p=i>>13,f=fen(p,w,b,'b'),c=new Chess(f),values=c.moves().map(m=>{c.move(m);const value=outcome(c);c.undo();return value;});if(new Set(values).size<2)continue;const answer=chooseChessMove({startFen:f,moves:[]},5,seededRandom(attempts+73));c.move(answer.move!);assert.equal(outcome(c),0);const reflected=mirror(f),n=new Chess(reflected),a=chooseChessMove({startFen:reflected,moves:[]},5,seededRandom(attempts+73));n.move(a.move!);assert.equal(outcome(n,'b'),0);defenders++;}
const conversions:any[]=[];
const longestFixtures=fixtures.slice().sort((a,b)=>distance[keyFor(new Chess(b.fen),'w')]-distance[keyFor(new Chess(a.fen),'w')]).slice(0,4);
for(const fixture of longestFixtures)for(const reflected of [false,true]){
 const f=reflected?mirror(fixture.fen):fixture.fen,owner=reflected?'b':'w',c=new Chess(f),initial=distance[keyFor(c,owner)];let plies=0;
 while(keyFor(c,owner)>=0&&plies<100){assert.equal(outcome(c,owner),1);const prior=distance[keyFor(c,owner)];let move:string;
  if(c.turn()===owner)move=chooseChessMove({startFen:f,moves:c.history()},5,seededRandom(73+plies)).move!;
  else{const choices=c.moves().map(m=>{c.move(m);const key=keyFor(c,owner),d=key>=0?distance[key]:0,value=outcome(c,owner);c.undo();return {m,d,value};});assert.ok(choices.every(m=>m.value===1));choices.sort((a,b)=>b.d-a.d);move=choices[0].m;}
  c.move(move);plies++;const key=keyFor(c,owner);if(key>=0)assert.equal(distance[key],prior-1,'Conversion distance must decrease against optimal resistance');
 }
 assert.equal(keyFor(c,owner),-1);assert.equal(outcome(c,owner),1);assert.equal(plies,initial);conversions.push({fen:f,plies,initial});
}
console.log(JSON.stringify({game:'chess-KPK-roles-and-conversion',mirroredAttackerPositions:mirrored,drawnDefenderPositions:defenders*2,conversions}));
