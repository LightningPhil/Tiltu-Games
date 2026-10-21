export interface MahjongTile { id:number; x:number; y:number; z:number; face:number; removed:boolean }
export interface MahjongSnapshot { solution:[number,number][]; tiles:MahjongTile[]; moves:number; shuffles:number; hints:number }
export interface MahjongSession extends MahjongSnapshot { layout:'turtle'|'bridge'|'flat'; seed:number; elapsed:number; history:MahjongSnapshot[]; last:number[] }
export const mahjongName=(face:number)=>face<9?`${face+1} circles`:face<18?`${face-8} bamboo`:face<27?`${face-17} characters`:['East wind','South wind','West wind','North wind','Red dragon','Green dragon','White dragon','Plum blossom','Orchid','Chrysanthemum','Bamboo flower','Spring','Summer','Autumn','Winter'][face-27];
export const mahjongGroup=(face:number)=>face>=38?38:face>=34?34:face;
export const mahjongMatches=(a:number,b:number)=>mahjongGroup(a)===mahjongGroup(b);
export function mahjongFree(tiles:MahjongTile[],id:number):boolean{
  const tile=tiles.find(t=>t.id===id);if(!tile||tile.removed)return false;const others=tiles.filter(t=>!t.removed&&t.id!==id);
  if(others.some(t=>t.z>tile.z&&Math.abs(t.x-tile.x)<1-.001&&Math.abs(t.y-tile.y)<1-.001))return false;
  const left=others.some(t=>t.z===tile.z&&Math.abs(t.y-tile.y)<.99&&Math.abs(t.x-(tile.x-1))<.05),right=others.some(t=>t.z===tile.z&&Math.abs(t.y-tile.y)<.99&&Math.abs(t.x-(tile.x+1))<.05);
  return !left||!right;
}
export function mahjongPairs(s:Pick<MahjongSession,'tiles'>):[number,number][]{const free=s.tiles.filter(t=>mahjongFree(s.tiles,t.id)),pairs:[number,number][]=[];for(let a=0;a<free.length;a++)for(let b=a+1;b<free.length;b++)if(mahjongMatches(free[a].face,free[b].face))pairs.push([free[a].id,free[b].id]);return pairs;}
function layoutTiles(layout:MahjongSession['layout']):MahjongTile[]{
  const points:number[][]=[];
  if(layout==='flat'){for(let y=0;y<8;y++)for(let x=0;x<18;x++)points.push([x,y,0]);}
  else if(layout==='bridge'){
    for(let y=0;y<8;y++)for(let x=0;x<12;x++)points.push([x,y,0]);
    for(let y=1;y<7;y++)for(let x of [1,2,9,10])points.push([x,y,1]);
    for(let y=2;y<6;y++)for(let x of [1,2,9,10])points.push([x,y,2]);
    for(let y=3;y<5;y++)for(let x of [1,2,9,10])points.push([x,y,3]);
  }else{
    const widths=[12,8,10,12,12,10,8,12];for(let y=0;y<8;y++)for(let x=(12-widths[y])/2;x<(12+widths[y])/2;x++)points.push([x+1,y,0]);
    for(const x of [0,13])for(const y of [3,4])points.push([x,y,0]);
    for(let y=1;y<7;y++)for(let x=4;x<10;x++)points.push([x,y,1]);
    for(let y=2;y<6;y++)for(let x=5;x<9;x++)points.push([x,y,2]);
    for(let y=3;y<5;y++)for(let x=6;x<8;x++)points.push([x,y,3]);
  }
  return points.map(([x,y,z],id)=>({id,x,y,z,face:0,removed:false}));
}
function random(s:Pick<MahjongSession,'seed'>):number{s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
function shuffle<T>(s:Pick<MahjongSession,'seed'>,a:T[]):T[]{for(let i=a.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
/** Assign pairs to a legal removal order. Every initial deal has a complete solution. */
function assignSolvable(s:MahjongSession,faces:number[]):boolean{
  const remaining=s.tiles.filter(t=>!t.removed),work=s.tiles.map(t=>({...t})),order:[number,number][]=[];
  while(work.some(t=>!t.removed)){
    const free=shuffle(s,work.filter(t=>mahjongFree(work,t.id)));
    if(free.length<2)return false;const rows=new Map<string,MahjongTile[]>();for(const t of free){const k=t.z+':'+t.y;rows.set(k,[...(rows.get(k)??[]),t]);}const paired=[...rows.values()].filter(a=>a.length>=2).sort((a,b)=>b[0].z-a[0].z);const pair=paired[0]??free;const a=pair[0],b=pair[1];order.push([a.id,b.id]);a.removed=b.removed=true;
  }
  const groups=new Map<number,number[]>();for(const face of faces){const g=mahjongGroup(face);groups.set(g,[...(groups.get(g)??[]),face]);}
  const pairs:number[][]=[];for(const group of groups.values()){shuffle(s,group);while(group.length>=2)pairs.push(group.splice(0,2));if(group.length)return false;}shuffle(s,pairs);
  if(pairs.length!==order.length||remaining.length!==faces.length)return false;
  s.solution=order;order.forEach(([a,b],i)=>{s.tiles.find(t=>t.id===a)!.face=pairs[i][0];s.tiles.find(t=>t.id===b)!.face=pairs[i][1];});return true;
}
export function newMahjong(layout:MahjongSession['layout']='turtle',seed=Math.floor(Math.random()*0xffffffff)):MahjongSession{
  const s:MahjongSession={solution:[],layout,tiles:layoutTiles(layout),seed:seed>>>0,elapsed:0,moves:0,shuffles:0,hints:0,history:[],last:[]};
  const faces=[...Array.from({length:136},(_,i)=>Math.floor(i/4)),...Array.from({length:8},(_,i)=>34+i)];
  if(!assignSolvable(s,faces))throw new Error('Mahjong layout cannot be paired');return s;
}
function remember(s:MahjongSession):void{s.history.push({solution:s.solution.map(p=>[...p]),tiles:s.tiles.map(t=>({...t})),moves:s.moves,shuffles:s.shuffles,hints:s.hints});if(s.history.length>100)s.history.shift();}
export function removeMahjong(s:MahjongSession,a:number,b:number):boolean{
  const x=s.tiles.find(t=>t.id===a),y=s.tiles.find(t=>t.id===b);if(a===b||!x||!y||!mahjongFree(s.tiles,a)||!mahjongFree(s.tiles,b)||!mahjongMatches(x.face,y.face))return false;remember(s);x.removed=y.removed=true;s.moves++;s.last=[a,b];return true;
}
export function shuffleMahjong(s:MahjongSession):boolean{
  const faces=s.tiles.filter(t=>!t.removed).map(t=>t.face);if(!faces.length)return false;remember(s);if(!assignSolvable(s,faces)){const remaining=s.tiles.filter(t=>!t.removed);remaining.forEach((t,i)=>{t.x=i%12;t.y=Math.floor(i/12);t.z=0;});if(!assignSolvable(s,faces)){Object.assign(s,s.history.pop()!);return false;}}s.shuffles++;s.last=[];return true;
}
export function mahjongHint(s:MahjongSession):[number,number]|null{
  const pairs=mahjongPairs(s);if(!pairs.length)return null;const planned=s.solution.find(([a,b])=>!s.tiles[a].removed&&!s.tiles[b].removed&&mahjongFree(s.tiles,a)&&mahjongFree(s.tiles,b)&&mahjongMatches(s.tiles[a].face,s.tiles[b].face));if(planned)return planned;return pairs.map(pair=>{const tiles=s.tiles.map(t=>({...t}));pair.forEach(id=>tiles.find(t=>t.id===id)!.removed=true);return {pair,value:tiles.filter(t=>mahjongFree(tiles,t.id)).length+pair.reduce((n,id)=>n+s.tiles.find(t=>t.id===id)!.z*5,0)};}).sort((a,b)=>b.value-a.value)[0].pair;
}
export function restoreMahjong(v:unknown):MahjongSession|null{
  const s=v as MahjongSession;if(!s||!['turtle','bridge','flat'].includes(s.layout))return null;
  const valid=(p:MahjongSnapshot)=>p&&Array.isArray(p.tiles)&&p.tiles.length===144&&new Set(p.tiles.map(t=>t.id)).size===144&&p.tiles.every((t,i)=>t&&t.id===i&&Number.isFinite(t.x)&&t.x>=0&&t.x<20&&Number.isFinite(t.y)&&t.y>=0&&t.y<12&&Number.isInteger(t.z)&&t.z>=0&&t.z<=4&&Number.isInteger(t.face)&&t.face>=0&&t.face<=41&&typeof t.removed==='boolean')&&Array.isArray(p.solution)&&p.solution.length<=72&&p.solution.every(a=>Array.isArray(a)&&a.length===2&&a.every(i=>Number.isInteger(i)&&i>=0&&i<144))&&Number.isInteger(p.moves)&&p.moves>=0&&Number.isInteger(p.shuffles)&&p.shuffles>=0&&Number.isInteger(p.hints)&&p.hints>=0;
  if(!valid(s)||!Number.isInteger(s.elapsed)||s.elapsed<0||!Number.isInteger(s.seed)||!Array.isArray(s.history)||s.history.length>100||!s.history.every(valid)||!Array.isArray(s.last)||s.last.some(i=>!Number.isInteger(i)||i<0||i>=144))return null;return structuredClone(s);
}
