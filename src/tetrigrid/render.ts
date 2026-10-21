import {Game,HIDDEN,WIDTH,TYPES,SHAPES,cells,type Type} from './game.ts';
import type {ArcadePalette} from '../action-renderer.ts';

const hues:Record<Type,string>={I:'#53cbd0',J:'#6d91e6',L:'#e9a065',O:'#d8b84c',S:'#6fb88a',T:'#ad8bd9',Z:'#de8097'};
const ink:Record<Type,string>={I:'#147b82',J:'#375eb4',L:'#a65c24',O:'#896913',S:'#347849',T:'#7751a5',Z:'#ab405b'};
export const pieceColour=(type:Type,neon=true)=>neon?hues[type]:ink[type];
export function preview(type:Type|null):string {
  if(!type)return '<span class="tg-empty">C / Shift</span>';
  const points=SHAPES[type].flatMap((row,y)=>row.flatMap((v,x)=>v?[[x,y]]:[]));
  const minX=Math.min(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1]));
  const w=Math.max(...points.map(p=>p[0]))-minX+1,h=Math.max(...points.map(p=>p[1]))-minY+1;
  return `<svg viewBox="0 0 100 52" role="img" aria-label="${type} piece" class="tg-preview" data-type="${type}" style="--piece:${hues[type]}">${points.map(([x,y])=>`<rect x="${(100-w*16)/2+(x-minX)*16}" y="${(52-h*16)/2+(y-minY)*16}" width="14" height="14" rx="3"/>`).join('')}</svg>`;
}
function block(c:CanvasRenderingContext2D,x:number,y:number,type:Type,p:ArcadePalette,active=false,ghost=false):void {
  if(y<0)return;const colour=pieceColour(type,p.neon||!['classic','woodland'].includes(document.documentElement.dataset.theme??''));
  c.save();c.translate(x*32+2,y*32+2);c.beginPath();c.roundRect(0,0,28,28,4);
  if(ghost){c.strokeStyle=colour;c.globalAlpha=.65;c.lineWidth=1.4;c.setLineDash([3,2]);c.stroke();c.globalAlpha=.08;c.fillStyle=colour;c.fill();c.restore();return;}
  if(active&&p.neon&&!p.reduced){c.shadowColor=colour;c.shadowBlur=8;}
  const wash=c.createLinearGradient(0,0,28,28);wash.addColorStop(0,colour);wash.addColorStop(1,colour+'b8');c.fillStyle=wash;c.fill();c.shadowBlur=0;
  c.strokeStyle=colour;c.globalAlpha=.9;c.lineWidth=1;c.stroke();c.globalAlpha=.45;c.strokeStyle='#fff';c.beginPath();c.moveTo(4,3);c.lineTo(24,3);c.moveTo(3,4);c.lineTo(3,18);c.stroke();
  c.globalAlpha=.75;c.fillStyle='#fff';c.font='600 10px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(type,14,15);c.restore();
}
export interface Visuals {flash:number;rows:number[];drop:{points:[number,number][];distance:number;clock:number}|null;motion:boolean;ghost:boolean;dt:number}
type Position={signature:string;x:number;y:number};const positions=new WeakMap<HTMLCanvasElement,Position>();
export function draw(canvas:HTMLCanvasElement,g:Game,p:ArcadePalette,v:Visuals):void {
  const r=canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);if(!r.width||!r.height)return;
  const w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const c=canvas.getContext('2d');if(!c)return;c.setTransform(w/320,0,0,h/640,0,0);c.clearRect(0,0,320,640);
  const wash=c.createLinearGradient(0,0,320,640);wash.addColorStop(0,p.surface);wash.addColorStop(1,p.bg);c.fillStyle=wash;c.fillRect(0,0,320,640);
  c.strokeStyle=p.line;c.lineWidth=.6;c.globalAlpha=.45;c.beginPath();for(let x=1;x<WIDTH;x++){c.moveTo(x*32,0);c.lineTo(x*32,640);}for(let y=1;y<20;y++){c.moveTo(0,y*32);c.lineTo(320,y*32);}c.stroke();c.globalAlpha=1;
  for(let y=HIDDEN;y<g.board.length;y++)for(let x=0;x<WIDTH;x++){const type=g.board[y][x];if(type)block(c,x,y-HIDDEN,type,p);}
  if(v.drop&&v.motion&&!p.reduced){const a=v.drop.clock/.17;c.globalAlpha=a*.2;c.fillStyle=p.accent;for(const[x,y]of v.drop.points)c.fillRect(x*32+5,Math.max(0,(y-HIDDEN)*32),22,Math.min(v.drop.distance*32,640-(y-HIDDEN)*32));c.globalAlpha=1;}
  if(!g.ended){
    if(v.ghost)for(const[x,y]of cells({...g.active,y:g.ghostY()}))block(c,x,y-HIDDEN,g.active.type,p,false,true);
    const signature=`${g.pieces}:${g.active.type}:${g.canHold}`;let pos=positions.get(canvas);
    if(!pos||pos.signature!==signature)pos={signature,x:g.active.x,y:g.active.y};
    const t=v.motion&&!p.reduced?1-Math.exp(-Math.max(.001,v.dt)*38):1;pos.x+=(g.active.x-pos.x)*t;pos.y+=(g.active.y-pos.y)*t;positions.set(canvas,pos);
    for(const[x,y]of cells({...g.active,x:0,y:0}))block(c,x+pos.x,y+pos.y-HIDDEN,g.active.type,p,true);
    if(g.grounded()){c.strokeStyle=p.accent;c.globalAlpha=Math.min(.9,.2+g.lockClock/600);c.lineWidth=2;for(const[x,y]of cells(g.active))if(y>=HIDDEN)c.strokeRect(x*32+2,(y-HIDDEN)*32+2,28,28);c.globalAlpha=1;}
  }
  if(v.flash>0&&v.motion&&!p.reduced){c.fillStyle=p.accent;c.globalAlpha=Math.min(.45,v.flash*.8);for(const y of v.rows)c.fillRect(0,(y-HIDDEN)*32,320,32);c.globalAlpha=1;}
  if(g.board.slice(HIDDEN,HIDDEN+4).some(row=>row.some(Boolean))){c.fillStyle=p.rival;c.fillRect(0,0,320,3);}
}
