import type {Chess} from 'chess.js';

// Generated locally on first use: exact king-and-pawn versus king reachability.
// Covers safe promotion, opposition, rook-pawn draws, stalemate and pawn capture.
let table:{winning:Uint8Array;distance:Uint16Array}|undefined;
const code=(p:number,w:number,b:number,t:number)=>((p*64+w)*64+b)*2+t;
const adjacent=(a:number,b:number)=>Math.max(Math.abs((a>>3)-(b>>3)),Math.abs((a&7)-(b&7)))<=1;
const attacks=(p:number,b:number)=>(b>>3)===(p>>3)-1&&Math.abs((b&7)-(p&7))===1;
function bitbase(){
 if(table)return table;
 const count=64*64*64*2,valid=new Uint8Array(count),winning=new Uint8Array(count),distance=new Uint16Array(count),remaining=new Uint8Array(count),longest=new Uint16Array(count),queue=new Int32Array(count);
 const neighbours=Array.from({length:64},(_,a)=>Array.from({length:64},(_,b)=>b).filter(b=>a!==b&&adjacent(a,b)));let head=0,tail=0;
 const mark=(i:number,d:number)=>{if(!winning[i]){winning[i]=1;distance[i]=d;queue[tail++]=i;}};
 for(let p=8;p<56;p++)for(let w=0;w<64;w++)for(let b=0;b<64;b++){
  if(p===w||p===b||adjacent(w,b))continue;
  const black=code(p,w,b,1);valid[black]=1;remaining[black]=neighbours[b].filter(to=>!adjacent(to,w)&&!attacks(p,to)).length;
  if(!remaining[black]&&attacks(p,b))mark(black,0);
  if(attacks(p,b))continue;
  const white=code(p,w,b,0);valid[white]=1;
  if(p<16){const to=p-8;if(to!==w&&to!==b&&(!adjacent(to,b)||adjacent(to,w)))mark(white,1);}
 }
 function parent(i:number,d:number){
  if(!valid[i]||winning[i])return;
  if((i&1)===0)mark(i,d+1);
  else{longest[i]=Math.max(longest[i],d+1);if(--remaining[i]===0)mark(i,longest[i]);}
 }
 while(head<tail){
  const i=queue[head++],turn=i&1,b=(i>>1)&63,w=(i>>7)&63,p=i>>13,d=distance[i];
  if(turn===1){for(const before of neighbours[w])parent(code(p,before,b,0),d);const before=p+8;if(before<56)parent(code(before,w,b,0),d);if((p>>3)===4&&p+8!==w&&p+8!==b)parent(code(p+16,w,b,0),d);}
  else for(const before of neighbours[b])parent(code(p,w,before,1),d);
 }
 return table={winning,distance};
}
const index=(square:string)=>(8-Number(square[1]))*8+'abcdefgh'.indexOf(square[0]);
export function kingPawnMove(chess:Chess):string|null{
 const pieces=chess.board().flat().filter(p=>p!==null),pawn=pieces.find(p=>p.type==='p');
 if(pieces.length!==3||!pawn||Number(chess.fen().split(' ')[4])>80)return null;
 const owner=pawn.color,actor=chess.turn(),data=bitbase(),moves=chess.moves({verbose:true});let best=-Infinity,answer:string|null=null;
 for(const move of moves){
  chess.move(move);let won=0,distance=0;
  try{
   if(chess.isCheckmate())won=chess.turn()!==owner?1:0;
   else if(!chess.isDraw()){
    const now=chess.board().flat().filter(p=>p!==null),remaining=now.find(p=>p.type==='p');
    if(remaining){
     const transform=(square:string)=>index(square)^(owner==='b'?56:0),own=now.find(p=>p.type==='k'&&p.color===owner)!,enemy=now.find(p=>p.type==='k'&&p.color!==owner)!;
     const key=code(transform(remaining.square),transform(own.square),transform(enemy.square),chess.turn()===owner?0:1);won=data.winning[key];distance=data.distance[key];
    }else{
     const promoted=now.find(p=>p.color===owner&&['q','r'].includes(p.type));
     if(promoted&&!(chess.turn()!==owner&&chess.moves({verbose:true}).some(m=>m.to===promoted.square&&m.captured)))won=1;
    }
   }
  }finally{chess.undo();}
  const score=actor===owner?won*100000-distance:-won*100000+distance;
  if(score>best){best=score;answer=move.san;}
 }
 return answer;
}
