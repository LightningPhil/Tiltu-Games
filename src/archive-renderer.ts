import {hostile,patrolNavigation,patrolSector,patrolStorms,patrolTractorRange,RELAY,SECTOR_SIZE,EMP_HALF_ANGLE} from './archive-patrol.ts';
import type {SalvageSession,Vessel,VesselKind,PatrolChassis} from './archive-patrol.ts';
import type {ArcadePalette} from './action-renderer.ts';

interface Trail {x:number;y:number;}
interface Scene {x:number;y:number;time:number;trail:Trail[];tracks:Map<number,Trail[]>;}
const scenes=new WeakMap<HTMLCanvasElement,Scene>();
export function transferPatrolScene(previous:HTMLCanvasElement|null,next:HTMLCanvasElement|null):void {if(previous&&next&&previous!==next){const view=scenes.get(previous);if(view)scenes.set(next,view);}}
export interface PatrolRenderInput {thrust?:boolean|number;tractor?:boolean;}
export function flightView(canvas:HTMLCanvasElement,s?:SalvageSession):{width:number;height:number} {
  const r=canvas.getBoundingClientRect(),height=650/(s?.zoom??.8);return{width:height*r.width/Math.max(1,r.height),height};
}
function scene(canvas:HTMLCanvasElement,s:SalvageSession):Scene {
  let state=scenes.get(canvas);if(!state){state={x:s.x,y:s.y,time:s.elapsed,trail:[],tracks:new Map()};scenes.set(canvas,state);}return state;
}
function mapMetrics(canvas:HTMLCanvasElement,s:SalvageSession){const view=flightView(canvas,s),fs=view.height/Math.max(1,canvas.clientHeight),size=Math.min(canvas.clientWidth<500?88:118,canvas.clientWidth*.26)*fs;return{...view,fs,size,x:view.width-size-16*fs,y:16*fs};}
export function patrolMapPoint(canvas:HTMLCanvasElement,s:SalvageSession,x:number,y:number):{x:number;y:number}|null {
  const r=canvas.getBoundingClientRect(),m=mapMetrics(canvas,s),px=(x-r.left)*m.width/r.width,py=(y-r.top)*m.height/r.height;
  return px>=m.x&&px<=m.x+m.size&&py>=m.y&&py<=m.y+m.size?{x:(px-m.x)/m.size*SECTOR_SIZE,y:(py-m.y)/m.size*SECTOR_SIZE}:null;
}
function polygon(c:CanvasRenderingContext2D,points:number[]):void {c.beginPath();for(let i=0;i<points.length;i+=2){if(!i)c.moveTo(points[i],points[i+1]);else c.lineTo(points[i],points[i+1]);}c.closePath();}
function circle(c:CanvasRenderingContext2D,x:number,y:number,r:number,fill:string|CanvasGradient|CanvasPattern):void{c.fillStyle=fill;c.beginPath();c.arc(x,y,Math.max(.1,r),0,Math.PI*2);c.fill();}
function glow(c:CanvasRenderingContext2D,x:number,y:number,r:number,colour:string,alpha=.3):void {
  c.save();c.globalAlpha=alpha;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,colour);g.addColorStop(1,'transparent');circle(c,x,y,r,g);c.restore();
}
function jet(c:CanvasRenderingContext2D,x:number,y:number,length:number,p:ArcadePalette,time:number,hot=false):void {
  c.save();c.translate(x,y);const wave=p.reduced?1:1+Math.sin(time*71+x)*.1;
  if(p.neon)glow(c,-length*.4,0,length,p.accent,.35);
  c.globalAlpha=.4;c.fillStyle=hot?p.rival:p.accent;polygon(c,[1,-6,-length*wave,0,1,6]);c.fill();c.globalAlpha=.9;
  c.fillStyle=p.accent;polygon(c,[0,-3,-length*.72*wave,0,0,3]);c.fill();c.fillStyle=p.text;polygon(c,[0,-1.4,-length*.38,0,0,1.4]);c.fill();c.restore();
}
export function shipOutline(c:CanvasRenderingContext2D,kind:VesselKind|'pilot',chassis:PatrolChassis='ranger',role?:string):void {
  if(kind==='pilot')polygon(c,chassis==='swift'?[37,0,-21,28,-12,8,-25,0,-12,-8,-21,-28]:chassis==='bulwark'?[28,0,9,20,-18,28,-28,16,-24,0,-28,-16,-18,-28,9,-20]:[34,0,0,19,-23,25,-16,7,-25,0,-16,-7,-23,-25,0,-19]);
  else if(kind==='carrier')polygon(c,[67,0,37,38,-26,48,-59,30,-65,0,-59,-30,-26,-48,37,-38]);
  else if(kind==='warden')polygon(c,[30,0,8,25,-24,22,-29,10,-18,0,-29,-10,-24,-22,8,-25]);
  else if(kind==='courier')polygon(c,[29,0,17,18,-21,18,-32,8,-32,-8,-21,-18,17,-18]);
  else polygon(c,role==='sniper'?[39,0,-20,11,-15,29,-29,26,-30,-26,-15,-29,-20,-11]:role==='gunship'?[30,0,12,23,-25,28,-33,14,-19,0,-33,-14,-25,-28,12,-23]:[31,0,9,17,-22,22,-15,4,-24,0,-15,-4,-22,-22,9,-17]);
}
export function drawPatrolShip(c:CanvasRenderingContext2D,kind:VesselKind|'pilot',p:ArcadePalette,colour:string,time:number,options:{chassis?:PatrolChassis;role?:string;thrust?:number;hit?:boolean;phase?:number}={}):void {
  const carrier=kind==='carrier';c.save();
  const thrust=options.thrust??0;if(thrust>.05){if(carrier)for(const y of [-27,0,27])jet(c,-57,y,22+thrust*22,p,time);else if(kind==='courier'){jet(c,-28,-11,18+thrust*16,p,time);jet(c,-28,11,18+thrust*16,p,time);}else for(const y of kind==='pilot'?[-13,13]:[-10,10])jet(c,-19,y,12+thrust*22,p,time,thrust>1);}
  c.shadowColor='#0007';c.shadowBlur=7;c.shadowOffsetY=4;shipOutline(c,kind,options.chassis,options.role);c.fillStyle=p.raised;c.fill();c.shadowBlur=0;c.shadowOffsetY=0;
  const metal=c.createLinearGradient(-25,-30,25,30);metal.addColorStop(0,p.surface);metal.addColorStop(.46,p.raised);metal.addColorStop(1,p.bg);c.fillStyle=metal;c.fill();
  c.strokeStyle=options.hit?p.text:colour;c.lineWidth=options.hit?2.6:1.7;c.stroke();
  c.save();shipOutline(c,kind,options.chassis,options.role);c.clip();
  c.fillStyle=colour;c.globalAlpha=.3;polygon(c,carrier?[65,0,5,-38,-40,-38,-22,-8,0,0]:[34,0,-20,-25,-14,-6,0,0]);c.fill();
  c.globalAlpha=.14;c.fillStyle=p.text;polygon(c,carrier?[-50,-26,45,-25,15,-4,-57,-4]:[-18,-20,23,-4,-17,-5]);c.fill();
  c.globalAlpha=.26;c.fillStyle='#000';polygon(c,carrier?[-55,8,45,8,12,38,-50,27]:[30,1,-18,20,-12,4]);c.fill();c.restore();
  c.strokeStyle=colour;c.lineWidth=1;c.globalAlpha=.65;
  if(carrier){
    for(const y of [-27,27]){c.fillStyle=p.surface;c.fillRect(-31,y-8,55,16);c.strokeRect(-31,y-8,55,16);c.fillStyle=colour;c.globalAlpha=.5;c.fillRect(-26,y-5,25,3);c.globalAlpha=.8;}
    circle(c,0,0,19,p.bg);c.strokeStyle=colour;c.lineWidth=3;c.beginPath();c.arc(0,0,19,0,6.28);c.stroke();
    if(p.neon)glow(c,0,0,32,colour,.4);circle(c,0,0,options.phase===2?13:9,colour);circle(c,0,0,4,p.text);
    for(const y of [-36,36]){c.save();c.translate(26,y);circle(c,0,0,6,p.surface);c.fillStyle=colour;c.fillRect(0,-2,17,4);c.restore();}
  }else if(kind==='courier'){
    for(const x of [-16,-4,8]){c.fillStyle=colour;c.globalAlpha=.4;c.fillRect(x,-9,8,18);c.strokeRect(x,-9,8,18);}c.globalAlpha=1;circle(c,21,0,3,p.text);
  }else{
    c.fillStyle=p.surface;polygon(c,kind==='pilot'?[21,0,0,-6,-7,0,0,6]:[18,0,-1,-6,-7,0,-1,6]);c.fill();c.strokeStyle=colour;c.stroke();c.fillStyle=colour;c.globalAlpha=.9;polygon(c,[16,0,1,-3,-3,0,1,3]);c.fill();
    c.globalAlpha=.8;c.fillStyle=colour;c.fillRect(-16,-15,11,3);c.fillRect(-16,12,11,3);
    if(kind==='warden'){c.lineWidth=1.3;c.strokeStyle=p.text;polygon(c,[-7,-4,-1,-4,1,0,-4,5,-9,0]);c.stroke();}
    if(options.role==='gunship'){c.fillStyle=p.muted;c.fillRect(0,-21,24,4);c.fillRect(0,17,24,4);}
    if(options.role==='sniper'){c.fillStyle=colour;c.fillRect(-6,-2,40,4);}
  }
  c.globalAlpha=options.hit?.35:1;if(options.hit){shipOutline(c,kind,options.chassis,options.role);c.fillStyle=p.text;c.fill();}
  c.globalAlpha=1;c.restore();
}

function drawBackground(c:CanvasRenderingContext2D,s:SalvageSession,p:ArcadePalette,w:number,h:number,ox:number,oy:number):void {
  c.fillStyle=p.bg;c.fillRect(0,0,w,h);
  const atmosphere=c.createRadialGradient(w*.45,h*.55,0,w*.45,h*.55,Math.max(w,h));atmosphere.addColorStop(0,p.raised);atmosphere.addColorStop(1,p.bg);c.fillStyle=atmosphere;c.fillRect(0,0,w,h);
  for(let layer=0;layer<3;layer++){const count=layer===0?80:45;for(let i=0;i<count;i++){
    const x=(((i*317.71+s.sectorSeed%811+layer*121)-ox*(.08+layer*.13))%(w+100)+w+100)%(w+100),y=(((i*i*19.83+layer*211)-oy*(.08+layer*.13))%(h+100)+h+100)%(h+100);
    c.globalAlpha=.13+layer*.12+(i%5)*.035;circle(c,x,y,layer===2&&i%7===0?1.4:.65,p.muted);
  }}c.globalAlpha=1;
  for(let i=0;i<3;i++){const x=(i*537+s.sectorSeed%421-ox*.14)%(w+700),y=(i*237+s.sector*85-oy*.14)%(h+500);glow(c,x,y,270+i*50,i%2?p.rival:p.accent,p.neon?.07:.045);}
  // A distant, shaded planetary crescent gives each region a recognisable horizon.
  const px=w*.78-ox*.06,py=-125-oy*.05,r=180+s.sector*12;c.save();c.globalAlpha=.09;
  const planet=c.createRadialGradient(px-r*.35,py+r*.4,5,px,py,r);planet.addColorStop(0,p.accent);planet.addColorStop(.6,p.muted);planet.addColorStop(1,p.bg);circle(c,px,py,r,planet);c.globalAlpha=.13;c.strokeStyle=p.accent;c.lineWidth=1;c.beginPath();c.ellipse(px,py+30,r*1.2,r*.25,-.25,0,6.28);c.stroke();c.restore();
  c.strokeStyle=p.line;c.globalAlpha=.15;c.lineWidth=.7;
  for(let x=Math.floor(ox/200)*200;x<ox+w;x+=200){c.beginPath();c.moveTo(x-ox,0);c.lineTo(x-ox,h);c.stroke();}for(let y=Math.floor(oy/200)*200;y<oy+h;y+=200){c.beginPath();c.moveTo(0,y-oy);c.lineTo(w,y-oy);c.stroke();}c.globalAlpha=1;
  c.strokeStyle=p.rival;c.lineWidth=2;c.globalAlpha=.45;c.setLineDash([12,10]);c.strokeRect(-ox,-oy,SECTOR_SIZE,SECTOR_SIZE);c.setLineDash([]);c.globalAlpha=1;
}
function drawRelay(c:CanvasRenderingContext2D,s:SalvageSession,p:ArcadePalette,fs:number):void {
  c.save();c.translate(RELAY.x,RELAY.y);const t=p.reduced?0:s.elapsed;
  glow(c,0,0,170,p.accent,p.neon?.12:.05);circle(c,0,0,105,p.bg);c.strokeStyle=p.line;c.lineWidth=14;c.beginPath();c.arc(0,0,101,0,6.28);c.stroke();
  c.strokeStyle=p.accent;c.lineWidth=1.5;c.globalAlpha=.4;c.beginPath();c.arc(0,0,109,0,6.28);c.stroke();c.globalAlpha=1;
  for(let i=0;i<6;i++){c.save();c.rotate(i*Math.PI/3);const metal=c.createLinearGradient(45,-20,95,20);metal.addColorStop(0,p.raised);metal.addColorStop(1,p.surface);c.fillStyle=metal;
    polygon(c,[47,-17,85,-22,101,-10,101,10,85,22,47,17]);c.fill();c.strokeStyle=p.muted;c.lineWidth=1;c.stroke();c.strokeStyle=p.accent;c.lineWidth=2;c.beginPath();c.moveTo(70,-14);c.lineTo(87,-14);c.stroke();c.fillStyle=p.line;c.fillRect(54,-10,7,20);c.restore();}
  c.save();c.rotate(t*.09);c.strokeStyle=p.accent;c.globalAlpha=.55;c.lineWidth=2;c.setLineDash([12,22]);c.beginPath();c.arc(0,0,63,0,6.28);c.stroke();c.setLineDash([]);c.restore();
  const core=c.createRadialGradient(-8,-8,1,0,0,37);core.addColorStop(0,p.text);core.addColorStop(.2,p.accent);core.addColorStop(1,p.surface);circle(c,0,0,35,core);c.strokeStyle=p.accent;c.lineWidth=2;c.beginPath();c.arc(0,0,36,0,6.28);c.stroke();
  c.strokeStyle=p.accent;c.globalAlpha=.3;c.lineWidth=1;c.setLineDash([3,10]);c.beginPath();c.arc(0,0,145,0,6.28);c.stroke();c.setLineDash([]);c.globalAlpha=1;
  c.fillStyle=p.accent;c.font=`${10*fs}px system-ui`;c.textAlign='center';c.fillText(s.arcade?'WORKSHOP · OPTIONAL REPAIRS · G':Math.hypot(s.x-900,s.y-900)<110?'SAFE HARBOUR  ·  DOCK E':'ARCHIVE RELAY',0,127);c.restore();
}
function drawRock(c:CanvasRenderingContext2D,r:SalvageSession['rocks'][number],p:ArcadePalette,t:number):void {
  c.save();c.translate(r.x,r.y);c.rotate(r.rotation+(p.reduced?0:t*.018));const points=[];
  for(let k=0;k<11;k++){const a=k/11*Math.PI*2,size=r.r*(.79+((k*7+Math.floor(r.rotation*10))%6)*.037);points.push(Math.cos(a)*size,Math.sin(a)*size);}
  const mineral=c.createRadialGradient(-r.r*.4,-r.r*.4,0,r.r*.1,r.r*.1,r.r*1.3);mineral.addColorStop(0,p.muted);mineral.addColorStop(.52,p.raised);mineral.addColorStop(1,p.bg);
  polygon(c,points);c.fillStyle=mineral;c.fill();c.strokeStyle=p.muted;c.lineWidth=.9;c.stroke();c.save();c.clip();
  for(let i=0;i<4;i++){const a=i*2.33+r.rotation,d=r.r*(.1+i*.12),x=Math.cos(a)*d,y=Math.sin(a)*d,cr=r.r*(.09+i*.025);circle(c,x+1,y+1,cr+1,'#0003');circle(c,x,y,cr,p.surface);c.globalAlpha=.4;c.strokeStyle=p.muted;c.lineWidth=.7;c.beginPath();c.arc(x,y,cr,.4,3.8);c.stroke();c.globalAlpha=1;}
  if(r.ore){c.strokeStyle=p.accent;c.lineWidth=1.5;c.globalAlpha=.7;c.beginPath();c.moveTo(-r.r*.7,3);c.lineTo(-r.r*.2,-r.r*.3);c.lineTo(r.r*.15,1);c.lineTo(r.r*.7,-r.r*.2);c.stroke();}c.restore();c.restore();
}

function drawResources(c:CanvasRenderingContext2D,s:SalvageSession,p:ArcadePalette,fs:number,input:PatrolRenderInput):void {
  for(const cache of s.arcade?.caches??[]){
    c.save();c.translate(cache.x,cache.y);const colour=cache.volatile?p.rival:p.accent;
    if(p.neon)glow(c,0,0,48,colour,.2);c.shadowColor='#0007';c.shadowBlur=8;c.fillStyle=cache.hit>0?p.text:p.surface;c.strokeStyle=colour;c.lineWidth=2;
    polygon(c,[-23,-20,16,-20,24,-12,24,20,-16,20,-23,12]);c.fill();c.stroke();c.shadowBlur=0;
    c.globalAlpha=.23;c.fillStyle=colour;c.fillRect(-19,-16,39,8);c.fillRect(-19,9,39,7);c.globalAlpha=1;
    if(cache.volatile){polygon(c,[0,-12,12,10,-12,10]);c.stroke();c.fillStyle=colour;c.fillRect(-1.5,-4,3,7);circle(c,0,7,1.5,colour);}
    else{c.fillStyle=colour;c.fillRect(-8,-7,16,3);c.fillRect(-8,0,16,3);c.fillRect(-8,7,11,3);}
    c.fillStyle=colour;c.font=`600 ${8*fs}px system-ui`;c.textAlign='center';c.fillText(cache.volatile?'BLAST CACHE':'SUPPLY CACHE',0,-29);
    if(cache.hp<cache.maxHp){c.fillStyle=p.surface;c.fillRect(-23,27,46,4);c.fillStyle=colour;c.fillRect(-23,27,46*cache.hp/cache.maxHp,4);}c.restore();
  }
  for(const r of s.relics){if(r.collected)continue;c.save();c.translate(r.x,r.y);c.rotate(p.reduced?0:Math.sin(s.elapsed*1.4+r.id)*.07);
    if(s.arcade){
      glow(c,0,0,35,p.accent,p.neon?.32:.12);c.fillStyle=p.surface;c.strokeStyle=p.accent;c.lineWidth=2;
      polygon(c,[0,-16,13,-6,10,10,0,17,-10,10,-13,-6]);c.fill();c.stroke();
      c.fillStyle=p.accent;c.globalAlpha=.6;polygon(c,[0,-12,9,-4,6,8,0,12]);c.fill();c.globalAlpha=1;
      c.strokeStyle=p.text;c.lineWidth=1.5;c.beginPath();c.moveTo(-7,-5);c.lineTo(0,-11);c.lineTo(6,-6);c.stroke();
    }else{
    if(p.neon)glow(c,0,0,31,p.accent,.22);c.fillStyle=p.surface;c.strokeStyle=p.accent;c.lineWidth=1.4;polygon(c,[-12,-16,4,-16,13,-7,13,16,-12,16]);c.fill();c.stroke();
    c.fillStyle=p.accent;c.globalAlpha=.18;c.fillRect(-9,-12,10,23);c.globalAlpha=1;c.beginPath();c.moveTo(4,-16);c.lineTo(4,-7);c.lineTo(13,-7);c.stroke();
    c.fillStyle=p.accent;if(r.kind===0){c.fillRect(-6,1,13,2);c.fillRect(-6,6,9,2);}else if(r.kind===1){polygon(c,[-5,-1,7,5,-5,11]);c.stroke();}else if(r.kind===2){c.beginPath();c.arc(0,5,6,0,6.28);c.stroke();}else{polygon(c,[-7,8,-1,-1,7,8]);c.stroke();}}c.restore();
    const d=Math.hypot(r.x-s.x,r.y-s.y),range=patrolTractorRange(s,input.tractor);
    if(d<range&&d>32){c.save();c.strokeStyle=p.accent;c.globalAlpha=.25;c.lineWidth=1;c.setLineDash([5,8]);c.lineDashOffset=-s.elapsed*45;c.beginPath();c.moveTo(s.x,s.y);c.quadraticCurveTo((s.x+r.x)/2+Math.sin(s.elapsed*3)*18,(s.y+r.y)/2,r.x,r.y);c.stroke();c.restore();}
  }
  for(const b of s.mission.beacons){c.save();c.translate(b.x,b.y);const colour=b.scanned?p.muted:p.accent;
    circle(c,0,6,22,p.surface);c.strokeStyle=colour;c.lineWidth=1.2;c.beginPath();c.ellipse(0,6,22,12,0,0,6.28);c.stroke();
    c.fillStyle=p.raised;polygon(c,[-8,5,-5,-18,5,-18,8,5]);c.fill();c.stroke();c.beginPath();c.moveTo(0,-16);c.lineTo(0,-32);c.stroke();circle(c,0,-32,4,colour);
    c.save();c.translate(0,-24);c.rotate(p.reduced?0:s.elapsed*.7);c.strokeStyle=colour;c.beginPath();c.ellipse(0,0,17,6,0,0,6.28);c.stroke();c.restore();
    if(b.scanned){c.strokeStyle=colour;c.lineWidth=2;c.beginPath();c.moveTo(-7,2);c.lineTo(-2,7);c.lineTo(9,-5);c.stroke();}
    else if(b.progress>0){c.strokeStyle=p.accent;c.lineWidth=3;c.beginPath();c.arc(0,0,30,-Math.PI/2,-Math.PI/2+b.progress*Math.PI*2);c.stroke();}
    if(!b.scanned&&Math.hypot(b.x-s.x,b.y-s.y)<125){c.fillStyle=p.accent;c.font=`${10*fs}px system-ui`;c.textAlign='center';c.fillText(`HOLD F TO SCAN  ${Math.round(b.progress*100)}%`,0,39);}
    c.restore();
  }
  for(const pwr of s.pickups){c.save();c.translate(pwr.x,pwr.y);const colour=pwr.kind==='overdrive'?p.rival:p.accent;
    if(p.neon)glow(c,0,0,25,colour,.22);c.fillStyle=p.surface;c.strokeStyle=colour;c.lineWidth=1.5;polygon(c,[0,-13,13,0,0,13,-13,0]);c.fill();c.stroke();c.fillStyle=colour;
    if(pwr.kind==='repair'){c.fillRect(-2,-7,4,14);c.fillRect(-7,-2,14,4);}else if(pwr.kind==='energy'||pwr.kind==='overdrive'){polygon(c,[1,-8,-5,1,0,1,-2,8,6,-2,1,-2]);c.fill();}else if(pwr.kind==='shield'){polygon(c,[-6,-6,6,-6,6,1,0,8,-6,1]);c.stroke();}else if(pwr.kind==='magnet'){c.lineWidth=3;c.beginPath();c.arc(0,0,6,0,Math.PI);c.moveTo(-6,0);c.lineTo(-6,-6);c.moveTo(6,0);c.lineTo(6,-6);c.stroke();}else{c.font='bold 15px system-ui';c.textAlign='center';c.fillText('¢',0,5);}
    if(pwr.kind==='overdrive'||pwr.kind==='magnet'){c.font=`600 ${8*fs}px system-ui`;c.textAlign='center';c.fillText(pwr.kind==='overdrive'?'OVERDRIVE':'MAGNET',0,-21);}c.restore();
  }
}
function drawStorms(c:CanvasRenderingContext2D,s:SalvageSession,p:ArcadePalette,fs:number):void {
  for(const storm of patrolStorms(s)){if(!storm.warning&&!storm.active)continue;c.save();c.translate(storm.x,storm.y);c.strokeStyle=p.rival;c.fillStyle=p.rival;c.globalAlpha=storm.active?.08:.025;c.beginPath();c.arc(0,0,storm.r,0,6.28);c.fill();c.globalAlpha=storm.active?.7:.35;c.lineWidth=1.5;c.setLineDash(storm.active?[]:[6,10]);c.stroke();c.setLineDash([]);
    if(storm.active){for(let i=0;i<7;i++){const a=s.elapsed*.5+i*.9;c.globalAlpha=.15;c.beginPath();c.arc(Math.cos(a)*25,Math.sin(a)*25,storm.r*.65,a,a+1.8);c.stroke();}}
    c.globalAlpha=.85;c.font=`${10*fs}px system-ui`;c.textAlign='center';c.fillText(storm.active?'ION STORM':'ION SURGE IN '+Math.ceil(12-storm.phase)+'s',0,-storm.r-12);c.restore();}
}
function drawRadar(c:CanvasRenderingContext2D,canvas:HTMLCanvasElement,s:SalvageSession,p:ArcadePalette,ox:number,oy:number):void {
  const m=mapMetrics(canvas,s),scale=m.size/1800,nav=patrolNavigation(s);c.save();c.fillStyle=p.surface;c.globalAlpha=.94;c.fillRect(m.x-7*m.fs,m.y-7*m.fs,m.size+14*m.fs,m.size+30*m.fs);c.globalAlpha=1;c.strokeStyle=p.line;c.lineWidth=m.fs;c.strokeRect(m.x,m.y,m.size,m.size);
  c.save();c.beginPath();c.rect(m.x,m.y,m.size,m.size);c.clip();c.globalAlpha=.1;c.fillStyle=p.accent;c.fillRect(m.x+ox*scale,m.y+oy*scale,m.width*scale,m.height*scale);c.globalAlpha=.4;c.strokeStyle=p.accent;c.strokeRect(m.x+ox*scale,m.y+oy*scale,m.width*scale,m.height*scale);c.globalAlpha=1;
  c.strokeStyle=p.accent;c.lineWidth=m.fs;c.beginPath();c.arc(m.x+900*scale,m.y+900*scale,RELAY.radius*scale,0,6.28);c.stroke();
  for(const r of s.relics)if(!r.collected)circle(c,m.x+r.x*scale,m.y+r.y*scale,1.5*m.fs,p.accent);
  for(const cache of s.arcade?.caches??[]){c.strokeStyle=cache.volatile?p.rival:p.accent;c.strokeRect(m.x+cache.x*scale-2*m.fs,m.y+cache.y*scale-2*m.fs,4*m.fs,4*m.fs);}
  for(const b of s.mission.beacons)if(!b.scanned){c.strokeStyle=p.muted;c.strokeRect(m.x+b.x*scale-2*m.fs,m.y+b.y*scale-2*m.fs,4*m.fs,4*m.fs);}
  for(const v of s.ships){const x=m.x+v.x*scale,y=m.y+v.y*scale;c.fillStyle=hostile(s,v)?p.rival:p.muted;if(v.kind==='carrier'){polygon(c,[x,y-4*m.fs,x+4*m.fs,y,x,y+4*m.fs,x-4*m.fs,y]);c.fill();}else circle(c,x,y,v.kind==='courier'?2.5*m.fs:1.8*m.fs,c.fillStyle as string);}
  c.strokeStyle=p.text;c.lineWidth=m.fs;c.beginPath();c.arc(m.x+nav.x*scale,m.y+nav.y*scale,5*m.fs,0,6.28);c.stroke();
  const px=m.x+s.x*scale,py=m.y+s.y*scale;c.save();c.translate(px,py);c.rotate(s.angle);c.fillStyle=p.text;polygon(c,[5*m.fs,0,-3*m.fs,-3*m.fs,-2*m.fs,0,-3*m.fs,3*m.fs]);c.fill();c.restore();c.restore();
  c.fillStyle=p.muted;c.font=`${8.5*m.fs}px system-ui`;c.textAlign='left';c.fillText('RADAR · CLICK TO SET COURSE',m.x,m.y+m.size+15*m.fs);c.restore();
}
function drawNavigation(c:CanvasRenderingContext2D,s:SalvageSession,p:ArcadePalette,w:number,h:number,ox:number,oy:number,fs:number):void {
  const target=patrolNavigation(s),x=target.x-ox,y=target.y-oy,px=s.x-ox,py=s.y-oy;
  c.save();c.strokeStyle=p.accent;c.fillStyle=p.accent;c.lineWidth=1.2*fs;c.textAlign='center';c.font=`${10*fs}px system-ui`;
  if(x>45*fs&&x<w-45*fs&&y>45*fs&&y<h-45*fs){if(target.kind!=='relay'||target.distance>145){c.globalAlpha=.5;c.setLineDash([4*fs,7*fs]);c.beginPath();c.arc(x,y,target.kind==='hostiles'?58:31,0,6.28);c.stroke();c.setLineDash([]);c.globalAlpha=.9;c.fillText(`${target.name.toUpperCase()} · ${Math.round(target.distance)} m`,x,y+48);}}
  else{const a=Math.atan2(y-py,x-px),rx=Math.max(60,w/2-48*fs),ry=Math.max(60,h/2-45*fs),t=1/Math.max(Math.abs(Math.cos(a))/rx,Math.abs(Math.sin(a))/ry),ax=w/2+Math.cos(a)*t,ay=h/2+Math.sin(a)*t;
    c.save();c.translate(ax,ay);c.rotate(a);polygon(c,[8*fs,0,-5*fs,-5*fs,-2*fs,0,-5*fs,5*fs]);c.fill();c.restore();c.font=`${9*fs}px system-ui`;c.textAlign=ax>w/2?'right':'left';c.fillText(`${target.name} · ${Math.round(target.distance)} m`,ax+(ax>w/2?-12:12)*fs,ay+3*fs);}
  c.restore();
}
export function drawSalvage(canvas:HTMLCanvasElement,s:SalvageSession,p:ArcadePalette,controls:boolean|PatrolRenderInput=false):void {
  const input=typeof controls==='boolean'?{thrust:controls}:controls,r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;
  const dpr=Math.min(2,devicePixelRatio||1),width=Math.round(r.width*dpr),height=Math.round(r.height*dpr);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  const c=canvas.getContext('2d');if(!c)return;const {width:w,height:h}=flightView(canvas,s),fs=h/r.height,state=scene(canvas,s),dt=Math.min(.1,Math.max(0,s.elapsed-state.time));
  state.time=s.elapsed;const look=s.paused?0:.22,ease=p.reduced?1:1-Math.exp(-dt*6);state.x+=(s.x+s.vx*look-state.x)*ease;state.y+=(s.y+s.vy*look-state.y)*ease;
  const ox=state.x-w/2,oy=state.y-h/2;c.setTransform(width/w,0,0,height/h,0,0);c.clearRect(0,0,w,h);drawBackground(c,s,p,w,h,ox,oy);
  c.save();c.translate(-ox,-oy);drawStorms(c,s,p,fs);
  for(const rock of s.rocks)if(rock.x>ox-70&&rock.x<ox+w+70&&rock.y>oy-70&&rock.y<oy+h+70)drawRock(c,rock,p,s.elapsed);
  drawRelay(c,s,p,fs);drawResources(c,s,p,fs,input);
  for(const warp of s.warps){c.save();c.translate(warp.x,warp.y);const progress=1-warp.clock/2.4;c.strokeStyle=p.rival;c.lineWidth=2;c.globalAlpha=.5;for(let i=0;i<3;i++){c.beginPath();c.ellipse(0,0,12+progress*35+i*8,(12+progress*35+i*8)*.65,s.elapsed+i,0,6.28);c.stroke();}c.restore();}
  if(dt>0){state.trail.push({x:s.x,y:s.y});if(state.trail.length>28)state.trail.shift();}
  if(!p.reduced&&Math.hypot(s.vx,s.vy)>70){c.strokeStyle=p.accent;c.lineWidth=s.boostTime>0?4:1.7;c.globalAlpha=s.boostTime>0?.35:.13;c.beginPath();state.trail.forEach((q,i)=>i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y));c.stroke();c.globalAlpha=1;}
  for(const b of s.bolts){c.save();c.translate(b.x,b.y);c.rotate(Math.atan2(b.vy,b.vx));const colour=b.owner>0?p.rival:p.accent;
    if(b.kind==='heavy'){if(p.neon)glow(c,0,0,14,colour,.4);circle(c,0,0,6,colour);circle(c,1,-1,2,p.text);}
    else{c.strokeStyle=colour;c.lineWidth=b.kind==='lance'?3:b.owner>0?3:2.5;c.lineCap='round';c.beginPath();c.moveTo(3,0);c.lineTo(b.kind==='lance'?-45:-13,0);c.stroke();c.strokeStyle=p.text;c.lineWidth=1;c.beginPath();c.moveTo(2,0);c.lineTo(b.kind==='lance'?-34:-7,0);c.stroke();}c.restore();}
  for(const v of s.ships){if(v.x<ox-100||v.x>ox+w+100||v.y<oy-100||v.y>oy+h+100)continue;const enemy=hostile(s,v),disabled=(v.disabledFor??0)>0,colour=disabled?p.accent:enemy?p.rival:p.accent;
    c.save();c.translate(v.x,v.y);c.rotate(v.angle);drawPatrolShip(c,v.kind,p,colour,s.elapsed,{role:v.role,thrust:disabled?0:Math.min(1,Math.hypot(v.vx,v.vy)/110),hit:(v.hit??0)>0,phase:v.phase});c.restore();
    if(disabled){c.save();c.strokeStyle=p.accent;c.lineWidth=1.7;c.globalAlpha=.75;c.setLineDash([4,5]);c.beginPath();c.arc(v.x,v.y,v.kind==='carrier'?78:44,p.reduced?0:s.elapsed*.7,(p.reduced?0:s.elapsed*.7)+Math.PI*1.8);c.stroke();c.setLineDash([]);c.font=`600 ${10*fs}px system-ui`;c.textAlign='center';c.fillStyle=p.accent;c.fillText(`EMP · ${Math.ceil(v.disabledFor!)}s`,v.x,v.y-(v.kind==='carrier'?92:55+(v.id%2)*13));c.restore();}
    const barWidth=v.kind==='carrier'?100:42;if(v.hp<(v.maxHp??v.hp)||v.kind==='carrier'){c.fillStyle=p.surface;c.fillRect(v.x-barWidth/2,v.y+(v.kind==='carrier'?62:37),barWidth,4);c.fillStyle=colour;c.fillRect(v.x-barWidth/2,v.y+(v.kind==='carrier'?62:37),barWidth*v.hp/(v.maxHp??v.hp),4);}
    if((v.charge??0)>0){c.save();c.strokeStyle=colour;c.globalAlpha=.2+v.charge!*.5;c.lineWidth=2;c.beginPath();c.arc(v.x,v.y,v.kind==='carrier'?76:38,-Math.PI/2,-Math.PI/2+v.charge!*6.28);c.stroke();c.restore();}
    if(v.kind==='courier'||v.kind==='carrier'){c.fillStyle=colour;c.font=`${9*fs}px system-ui`;c.textAlign='center';c.fillText(v.kind==='courier'?s.courierSaved?'COURIER SAFE':v.active?'COURIER · STAY CLOSE':'STRANDED COURIER':`COMMAND CARRIER · ${v.phase===2?'CORE EXPOSED':'ARMOURED'}`,v.x,v.y-(v.kind==='carrier'?70:39));}
  }
  c.save();c.translate(s.x,s.y);c.rotate(s.angle);drawPatrolShip(c,'pilot',p,p.accent,s.elapsed,{chassis:s.chassis,thrust:s.boostTime>0?2:Number(input.thrust??s.engineThrottle),hit:s.hitFlash>.12});
  // A fixed gunsight shows exactly where the nose is pointing; it never follows a target or cursor.
  c.strokeStyle=p.accent;c.globalAlpha=.42;c.lineWidth=1;c.setLineDash([3,9]);c.beginPath();c.moveTo(55,0);c.lineTo(220,0);c.stroke();c.setLineDash([]);c.beginPath();c.moveTo(230,-6);c.lineTo(236,0);c.lineTo(230,6);c.stroke();
  if(s.pulseCooldown===0){c.globalAlpha=.16;c.beginPath();c.arc(0,0,140,-EMP_HALF_ANGLE,EMP_HALF_ANGLE);c.stroke();}c.restore();
  if(s.shield>0){c.strokeStyle=p.accent;c.globalAlpha=s.invulnerable>0?.55:s.hitFlash>0?.7:.12;c.lineWidth=s.hitFlash>0?2.5:1;c.beginPath();c.ellipse(s.x,s.y,43,38,s.angle,0,6.28);c.stroke();c.globalAlpha=1;}
  if(s.arcade?.overdrive){c.save();c.strokeStyle=p.rival;c.lineWidth=2;c.globalAlpha=.65;c.setLineDash([8,12]);c.lineDashOffset=-s.elapsed*35;c.beginPath();c.arc(s.x,s.y,49,0,Math.PI*2);c.stroke();c.restore();}
  for(const particle of s.particles){const ratio=Math.min(1,particle.life/(particle.maxLife??.7));c.save();c.globalAlpha=ratio;
    if(particle.kind==='text'){c.font=`600 ${11*fs}px system-ui`;c.textAlign='center';c.fillStyle=particle.friendly?p.accent:p.rival;c.fillText(particle.text??'',particle.x,particle.y);}
    else if(particle.kind==='blast'){const radius=(1-ratio)*90+12;glow(c,particle.x,particle.y,radius,p.rival,ratio*.6);c.strokeStyle=p.rival;c.lineWidth=2;c.beginPath();c.arc(particle.x,particle.y,radius,0,6.28);c.stroke();}
    else if(particle.kind==='pulse'){c.strokeStyle=p.accent;c.lineWidth=2;c.beginPath();c.arc(particle.x,particle.y,(1-ratio)*260,0,6.28);c.stroke();}
    else{c.fillStyle=particle.kind==='collect'?p.accent:p.rival;c.fillRect(particle.x,particle.y,particle.size??2,particle.size??2);}c.restore();}
  for(const wave of s.empPulses){c.save();c.translate(wave.x,wave.y);c.rotate(wave.angle);c.strokeStyle=p.accent;c.fillStyle=p.accent;const outer=Math.max(1,wave.distance),inner=Math.max(0,outer-35),alpha=1-wave.distance/720;
    c.globalAlpha=alpha*.13;c.beginPath();c.arc(0,0,outer,-EMP_HALF_ANGLE,EMP_HALF_ANGLE);c.arc(0,0,inner,EMP_HALF_ANGLE,-EMP_HALF_ANGLE,true);c.closePath();c.fill();
    c.globalAlpha=alpha*.9;c.lineWidth=3;c.beginPath();c.arc(0,0,outer,-EMP_HALF_ANGLE,EMP_HALF_ANGLE);c.stroke();c.lineWidth=1;c.globalAlpha=alpha*.5;for(const side of [-1,1]){c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(EMP_HALF_ANGLE)*outer,side*Math.sin(EMP_HALF_ANGLE)*outer);c.stroke();}c.restore();}
  c.restore();drawNavigation(c,s,p,w,h,ox,oy,fs);drawRadar(c,canvas,s,p,ox,oy);
  if(s.hitFlash>0&&!p.reduced){c.save();c.strokeStyle=p.rival;c.globalAlpha=s.hitFlash*1.3;c.lineWidth=8*fs;c.strokeRect(3*fs,3*fs,w-6*fs,h-6*fs);c.restore();}
  c.fillStyle=p.muted;c.globalAlpha=.55;c.font=`${9*fs}px system-ui`;c.textAlign='left';c.fillText(`${patrolSector(s).name.toUpperCase()}  /  ${Math.round(s.x)}, ${Math.round(s.y)}`,14*fs,h-14*fs);c.globalAlpha=1;
}
