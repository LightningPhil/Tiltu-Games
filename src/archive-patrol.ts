/** Archive Patrol's deterministic simulation. Rendering never consumes this random stream. */
export const SECTOR_SIZE = 1800;
export const RELAY = {x:900,y:900,radius:145};
export const EMP_RECHARGE = 18;
export const EMP_RANGE = 580;
export const EMP_HALF_ANGLE = Math.PI / 6;
export type VesselKind = 'raider' | 'warden' | 'courier' | 'carrier';
export type RaiderRole = 'skirmisher' | 'gunship' | 'sniper';
export type PatrolWeapon = 'blaster' | 'scatter' | 'lance';
export type PatrolChassis = 'ranger' | 'swift' | 'bulwark';
export type WaypointKind = 'auto' | 'relay' | 'fragments' | 'beacons' | 'courier' | 'hostiles' | 'point';
export interface Vessel {
  id:number;kind:VesselKind;x:number;y:number;vx:number;vy:number;angle:number;hp:number;cooldown:number;
  role?:RaiderRole;maxHp?:number;hit?:number;charge?:number;active?:boolean;credited?:boolean;phase?:number;arming?:boolean;disabledFor?:number;
}
export interface EMPPulse {x:number;y:number;angle:number;distance:number;hitIds:number[];}
export interface Bolt {
  x:number;y:number;vx:number;vy:number;life:number;owner:number;damage:number;
  kind?:PatrolWeapon|'enemy'|'heavy';radius?:number;pierce?:number;hitIds?:number[];
}
export interface Mote {x:number;y:number;vx:number;vy:number;life:number;kind:'spark'|'collect'|'pulse'|'blast'|'text';text?:string;maxLife?:number;size?:number;friendly?:boolean;}
export interface Relic {id:number;x:number;y:number;kind:number;collected:boolean;}
export interface Rock {x:number;y:number;r:number;rotation:number;hp?:number;ore?:boolean;}
export interface Pickup {id:number;x:number;y:number;kind:'repair'|'energy'|'shield'|'credits'|'overdrive'|'magnet';life:number;}
export interface SupplyCache {id:number;x:number;y:number;hp:number;maxHp:number;volatile:boolean;hit:number;}
export interface PatrolArcade {version:1;wave:number;rest:number;cleared:boolean;finishClock:number;caches:SupplyCache[];overdrive:number;magnet:number;autoFire:boolean;}
export interface Beacon {id:number;x:number;y:number;progress:number;scanned:boolean;}
export interface Warp {x:number;y:number;clock:number;role:RaiderRole;kind?:'carrier';}
export interface PatrolLog {text:string;time:number;kind:'info'|'good'|'warning';}
export interface PatrolMission {beacons:Beacon[];bossDefeated:boolean;bossRequired:boolean;rewards:string[];bounty:number;courierLost:boolean;}
export interface PatrolStats {shots:number;hits:number;damage:number;fragments:number;boosts:number;}
export interface PatrolCheckpoint {sector:number;seed:number;credits:number;score:number;kills:number;rescues:number;upgrades:SalvageSession['upgrades'];nextId?:number;snapshot?:SalvageSession;}
export interface SalvageSession {
  seed:number;sector:number;difficulty:number;hull:number;shield:number;energy:number;credits:number;score:number;best:number;
  x:number;y:number;vx:number;vy:number;angle:number;elapsed:number;cooldown:number;pulseCooldown:number;invulnerable:number;
  phase:'ready'|'flying'|'docked'|'lost'|'complete';paused:boolean;cargo:number;delivered:number;quota:number;reputation:number;
  kills:number;sectorKills:number;rescues:number;courierSaved:boolean;upgrades:{engine:number;weapon:number;shield:number;tractor:number};
  ships:Vessel[];bolts:Bolt[];particles:Mote[];relics:Relic[];rocks:Rock[];notice:string;noticeTime:number;nextId:number;
  version:2;sectorSeed:number;sectorTime:number;boostCooldown:number;boostTime:number;shieldDelay:number;hitFlash:number;
  weapon:PatrolWeapon;chassis:PatrolChassis;flight:'direct'|'classic';autoTractor:boolean;safety:boolean;aimAssist:boolean;
  zoom:number;waypoint:{kind:WaypointKind;x?:number;y?:number};mission:PatrolMission;pickups:Pickup[];warps:Warp[];
  combo:number;comboClock:number;waveClock:number;log:PatrolLog[];stats:PatrolStats;checkpoint:PatrolCheckpoint|null;retries:number;
  arcade?:PatrolArcade;
  angularVelocity:number;engineThrottle:number;empPulses:EMPPulse[];flightVersion:1;
}
export interface FlightInput {
  turn:number;thrust:number;strafe:number;fire:boolean;tractor:boolean;pulse:boolean;aim:number|null;
  moveX?:number;moveY?:number;brake?:boolean;boost?:boolean;scan?:boolean;
}
export const PATROL_SECTORS = [
  {name:'Quiet Array',region:'The outer archive',brief:'Recover the scattered fragments. Your relay is a safe harbour.',colour:0,rocks:15},
  {name:'Glass Reef',region:'Survey territory',brief:'A broken survey network waits among the asteroids. Scan its beacons for a bonus.',colour:1,rocks:25},
  {name:'Relay Siege',region:'Contested space',brief:'A carrier blocks the route. Recover the archive and disable it before departure.',colour:2,rocks:18},
  {name:'Drift Garden',region:'Courier passage',brief:'Find the stranded courier. Stay close to escort it through the raiders.',colour:3,rocks:22},
  {name:'Ion Wake',region:'Unstable transmission',brief:'Ion storms cycle across the outer fields. Watch their warning rings and keep moving.',colour:4,rocks:25},
  {name:'Last Light',region:'The central vault',brief:'Restore the final archive and bring down the command carrier. Make every upgrade count.',colour:5,rocks:20},
] as const;
export const WEAPON_INFO = {
  blaster:{name:'Twinlight',detail:'Precise, efficient bolts. Twin barrels at weapon level 2.',cost:4,cooldown:.19},
  scatter:{name:'Scatter',detail:'Five close-range pellets. A wide spread that shreds nearby targets.',cost:9,cooldown:.36},
  lance:{name:'Lance',detail:'A fast, piercing rail shot. Line up targets and fire.',cost:12,cooldown:.59},
} as const;
export const CHASSIS_INFO = {
  ranger:{name:'Ranger',detail:'Balanced flight and shields. A dependable all-rounder.',speed:1,shield:100,tractor:0},
  swift:{name:'Swift',detail:'Faster, lighter and agile. Less shield capacity.',speed:1.2,shield:80,tractor:0},
  bulwark:{name:'Bulwark',detail:'Stronger shields and a wider tractor. A little slower.',speed:.87,shield:125,tractor:35},
} as const;
const random=(s:{seed:number})=>((s.seed=Math.imul(s.seed,1664525)+1013904223>>>0)/4294967296);
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const angleDelta=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const emptyStats=():PatrolStats=>({shots:0,hits:0,damage:0,fragments:0,boosts:0});
export const maxPatrolShield=(s:SalvageSession)=>CHASSIS_INFO[s.chassis].shield+s.upgrades.shield*25;
export const patrolEMPCharge=(s:SalvageSession)=>clamp(1-s.pulseCooldown/EMP_RECHARGE,0,1);
export const patrolUpgradeCost=(s:SalvageSession,key:keyof SalvageSession['upgrades'])=>(s.arcade?100:60)*(s.upgrades[key]+1);
export const patrolSector=(s:SalvageSession)=>PATROL_SECTORS[s.sector-1];
export const hostile=(s:SalvageSession,v:Vessel)=>v.kind==='raider'||v.kind==='carrier'||v.kind==='warden'&&s.reputation>=3;
export const sectorComplete=(s:SalvageSession)=>s.delivered>=s.quota&&(!s.mission.bossRequired||s.mission.bossDefeated)&&(!s.arcade||s.arcade.cleared);
export const patrolMultiplier=(s:SalvageSession)=>s.comboClock>0?1+Math.min(3,Math.floor(s.combo/5)):1;
export const patrolTractorRange=(s:SalvageSession,extended=false)=>(s.arcade?.cleared?SECTOR_SIZE:s.arcade?.magnet?320:extended?250:s.autoTractor?(s.arcade?165:105):30)+s.upgrades.tractor*35+CHASSIS_INFO[s.chassis].tractor;
const newArcade=(autoFire=false):PatrolArcade=>({version:1,wave:1,rest:0,cleared:false,finishClock:0,caches:[],overdrive:0,magnet:0,autoFire});
export function patrolObjective(s:SalvageSession):{title:string;detail:string;wave:string} {
  const a=s.arcade,enemies=s.ships.filter(v=>v.hp>0&&hostile(s,v)).length+s.warps.length;
  if(!a)return {title:s.cargo+s.delivered>=s.quota?'Return to the relay':`Collect ${s.quota-s.cargo-s.delivered} cores`,detail:'Shoot raiders and collect their salvage.',wave:'Recovery patrol'};
  if(a.cleared)return {title:s.delivered<s.quota?'Sector clear · collecting the loot':'Sector secured!',detail:'All remaining cores are drawn to your ship. Upgrades open automatically.',wave:'3 / 3 WAVES CLEARED'};
  if(a.rest>0)return {title:`Next wave in ${Math.ceil(a.rest)}s`,detail:'Scoop up the loot. Break supply caches for more cores and power-ups.',wave:`WAVE ${a.wave} / 3 CLEARED`};
  return {title:enemies?`Blast the raiders · ${enemies} left`:'Incoming raiders',detail:'Steer your nose towards a target. Space or click fires forward. E or right-click launches your secondary EMP.',wave:`WAVE ${a.wave} / 3`};
}
function announce(s:SalvageSession,text:string,kind:PatrolLog['kind']='info',seconds=5):void {
  s.notice=text;s.noticeTime=seconds;
  if(s.log.at(-1)?.text!==text)s.log.push({text,time:s.elapsed,kind});s.log=s.log.slice(-7);
}
function reward(s:SalvageSession,id:string,credits:number,text:string):void {
  if(s.mission.rewards.includes(id))return;s.mission.rewards.push(id);s.credits+=credits;s.score+=credits*3;
  announce(s,`${text} +${credits} credits.`,'good',6);floating(s,s.x,s.y-38,`+${credits} cr`,true);
}
export function burst(s:SalvageSession,x:number,y:number,kind:Mote['kind']='spark',count=12):void {
  for(let i=0;i<count;i++){const a=random(s)*Math.PI*2,v=25+random(s)*125,life=kind==='pulse'?.65:kind==='blast'?.75:.25+random(s)*.4;s.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life,maxLife:life,kind,size:kind==='blast'?35:1.5+random(s)*2});}
}
function floating(s:SalvageSession,x:number,y:number,text:string,friendly=false):void{s.particles.push({x,y,vx:0,vy:-25,life:1.1,maxLife:1.1,kind:'text',text,friendly});}
function position(s:SalvageSession,min=260,clearance=50):[number,number] {
  let x=200,y=200;for(let i=0;i<120;i++){x=100+random(s)*1600;y=100+random(s)*1600;
    if(Math.hypot(x-900,y-900)>min&&!s.rocks.some(r=>Math.hypot(x-r.x,y-r.y)<r.r+clearance))return[x,y];}
  for(let y=100;y<=1700;y+=100)for(let x=100;x<=1700;x+=100)if(Math.hypot(x-900,y-900)>min&&!s.rocks.some(r=>Math.hypot(x-r.x,y-r.y)<r.r+clearance))return[x,y];return[100,100];
}
function vessel(s:SalvageSession,kind:VesselKind,x:number,y:number,role:RaiderRole='skirmisher'):Vessel {
  const hp=kind==='carrier'?(s.arcade?520+s.sector*75:650+s.sector*100):kind==='raider'?s.arcade?(role==='gunship'?48:24)+s.sector*7+s.difficulty*3+(s.arcade.wave-1)*12:role==='gunship'?65+s.sector*5:role==='sniper'?30+s.sector*3:30+s.sector*4:kind==='courier'?125:110;
  return {id:s.nextId++,kind,role,x,y,vx:0,vy:0,angle:0,hp,maxHp:hp,cooldown:s.arcade?(s.arcade.wave===1?1.8:Math.max(.65,1.4-s.difficulty*.14))+random(s)*.3:1.5+random(s)*2,hit:0,charge:0,active:kind!=='courier',phase:0};
}
function dropCores(s:SalvageSession,x:number,y:number,count:number):void {
  for(let i=0;i<count;i++){const a=i/count*Math.PI*2;s.relics.push({id:s.nextId++,x:clamp(x+Math.cos(a)*(count===1?0:24),30,1770),y:clamp(y+Math.sin(a)*(count===1?0:24),30,1770),kind:2,collected:false});}
}
function spawnArcadeWave(s:SalvageSession,immediate=false):void {
  const a=s.arcade!;const count=a.wave*2+Math.floor((s.sector-1)/2)+Math.floor((s.difficulty-1)/2);
  const boss=a.wave===3&&s.mission.bossRequired;
  for(let i=0;i<count;i++){
    const angle=immediate?-Math.PI/2+(i-(count-1)/2)*.52:random(s)*Math.PI*2;
    let x=clamp(s.x+Math.cos(angle)*(immediate?255:320),90,1710),y=clamp(s.y+Math.sin(angle)*(immediate?255:320),90,1710);
    if(immediate)s.rocks=s.rocks.filter(r=>Math.hypot(x-r.x,y-r.y)>=r.r+55);
    else if(s.rocks.some(r=>Math.hypot(x-r.x,y-r.y)<r.r+55)){
      for(let attempt=0;attempt<40;attempt++){const a=random(s)*Math.PI*2;x=clamp(s.x+Math.cos(a)*320,90,1710);y=clamp(s.y+Math.sin(a)*320,90,1710);if(s.rocks.every(r=>Math.hypot(x-r.x,y-r.y)>=r.r+55))break;}
      s.rocks=s.rocks.filter(r=>Math.hypot(x-r.x,y-r.y)>=r.r+55);
    }
    const role:RaiderRole=i%3===2&&s.sector>1?'sniper':i%3===1&&a.wave>1?'gunship':'skirmisher';
    if(boss&&i===0)s.warps.push({x,y,clock:2.4,role,kind:'carrier'});
    else if(immediate)s.ships.push(vessel(s,'raider',x,y,role));
    else s.warps.push({x,y,clock:1.8,role});
  }
  announce(s,boss?'FINAL WAVE · Break the carrier and scoop its core burst.':`WAVE ${a.wave} / 3 · Blast raiders. Collect their cores.`,'warning',4);
}
function populateArcade(s:SalvageSession):void {
  s.arcade=newArcade(s.arcade?.autoFire);s.quota=8+s.sector*4;
  // Keep the opening encounter in view and remove passive allies doing the player's shooting.
  s.ships=[];s.relics=[];s.mission.beacons=s.sector===2?s.mission.beacons:[];
  for(let i=0;i<3;i++)dropCores(s,900+(i-1)*35,580-i*12,1);
  for(let i=0;i<7;i++){
    let [x,y]=i===0?[1080,620]:i===1?[730,540]:position(s,240,55);
    if(s.rocks.some(r=>Math.hypot(x-r.x,y-r.y)<r.r+45))[x,y]=position(s,240,55);
    s.arcade.caches.push({id:s.nextId++,x,y,hp:30,maxHp:30,volatile:i%3===1,hit:0});
  }
  for(const rock of s.rocks){rock.hp=rock.ore?30:45;}
  spawnArcadeWave(s,true);
}
export function newSalvage(difficulty=2,seed=(Math.random()*4294967296)>>>0,best=0):SalvageSession {
  const s:SalvageSession={seed,sector:1,difficulty:clamp(Math.round(difficulty),1,5),hull:100,shield:100,energy:100,credits:0,score:0,best,
    x:900,y:900,vx:0,vy:0,angle:-Math.PI/2,elapsed:0,cooldown:0,pulseCooldown:0,invulnerable:2,phase:'ready',paused:true,cargo:0,delivered:0,quota:6,reputation:0,
    kills:0,sectorKills:0,rescues:0,courierSaved:false,upgrades:{engine:0,weapon:0,shield:0,tractor:0},ships:[],bolts:[],particles:[],relics:[],rocks:[],notice:'',noticeTime:8,nextId:1,
    version:2,sectorSeed:seed,sectorTime:0,boostCooldown:0,boostTime:0,shieldDelay:0,hitFlash:0,weapon:'blaster',chassis:'ranger',flight:'classic',autoTractor:true,safety:true,aimAssist:false,
    zoom:.8,waypoint:{kind:'auto'},mission:{beacons:[],bossDefeated:false,bossRequired:false,rewards:[],bounty:0,courierLost:false},pickups:[],warps:[],combo:0,comboClock:0,waveClock:30,log:[],stats:emptyStats(),checkpoint:null,retries:0,
    angularVelocity:0,engineThrottle:0,empPulses:[],flightVersion:1};
  s.arcade=newArcade();s.x=900;s.y=650;populateSector(s);return s;
}
export function populateSector(s:SalvageSession):void {
  const initialId=s.nextId;
  s.sectorSeed=s.seed;s.ships=[];s.bolts=[];s.particles=[];s.empPulses=[];s.angularVelocity=0;s.engineThrottle=0;s.rocks=[];s.relics=[];s.pickups=[];s.warps=[];s.cargo=0;s.delivered=0;s.sectorKills=0;s.courierSaved=false;s.quota=5+s.sector;
  s.sectorTime=0;s.waveClock=30;s.combo=0;s.comboClock=0;s.stats=emptyStats();s.waypoint={kind:'auto'};
  s.mission={beacons:[],bossDefeated:false,bossRequired:s.sector===3||s.sector===6,rewards:[],bounty:0,courierLost:false};
  for(let i=0;i<patrolSector(s).rocks;i++){const[x,y]=position(s,320,48),r=17+random(s)*30;s.rocks.push({x,y,r,rotation:random(s)*Math.PI*2,hp:35+r,ore:i%5===0});}
  for(let i=0;i<s.quota+5;i++){const[x,y]=i===0&&s.sector===1?[900,680]:position(s,250,38);s.relics.push({id:s.nextId++,x,y,kind:i%4,collected:false});}
  for(let i=0;i<3+s.sector+s.difficulty;i++){const[x,y]=position(s,600,60);s.ships.push(vessel(s,i===0&&s.mission.bossRequired?'carrier':'raider',x,y,(i%3===2&&s.sector>1)?'sniper':i%3===1?'gunship':'skirmisher'));}
  for(let i=0;i<3;i++){const[x,y]=position(s,400,45);s.ships.push(vessel(s,i===2?'courier':'warden',x,y));}
  for(let i=0;i<3;i++){const[x,y]=position(s,380,65);s.mission.beacons.push({id:s.nextId++,x,y,progress:0,scanned:false});}
  if(s.arcade)populateArcade(s);
  s.checkpoint={sector:s.sector,seed:s.sectorSeed,credits:s.credits,score:s.score,kills:s.kills,rescues:s.rescues,upgrades:{...s.upgrades},nextId:initialId};
  announce(s,s.arcade?`${patrolSector(s).name} · Three waves. Blast raiders and caches; scoop ${s.quota} cores. All loot banks immediately.`:`${patrolSector(s).name}: recover ${s.quota} fragments${s.mission.bossRequired?' and disable the carrier':''}.`,'info',8);
}
export function retrySalvage(s:SalvageSession):boolean {
  if(s.phase!=='lost'||!s.checkpoint)return false;
  if(s.arcade){
    // Banked really means banked: rejoin the remaining fight, rather than regenerating paid loot.
    s.retries++;s.best=Math.max(s.best,s.score);s.phase='ready';s.paused=true;s.x=900;s.y=650;s.vx=s.vy=0;s.angle=-Math.PI/2;
    s.hull=100;s.shield=maxPatrolShield(s);s.energy=100;s.invulnerable=3;s.cooldown=s.pulseCooldown=s.boostCooldown=s.boostTime=s.shieldDelay=s.hitFlash=0;
    s.bolts=[];s.particles=[];s.empPulses=[];s.angularVelocity=s.engineThrottle=0;s.combo=s.comboClock=0;s.arcade.overdrive=s.arcade.magnet=0;
    announce(s,`Ship repaired. Rejoin wave ${s.arcade.wave}. Your loot, credits and cleared enemies are saved.`,'good',5);return true;
  }
  const c=s.checkpoint,retries=s.retries+1,best=s.best;
  if(c.snapshot){const elapsed=s.elapsed,settings={weapon:s.weapon,chassis:s.chassis,flight:s.flight,autoTractor:s.autoTractor,safety:s.safety,aimAssist:s.aimAssist,zoom:s.zoom};Object.assign(s,structuredClone(c.snapshot),settings,{checkpoint:c,retries,best,elapsed,phase:'ready',paused:true,x:900,y:900,vx:0,vy:0,hull:100,energy:100,invulnerable:3,boostTime:0,boostCooldown:0,pulseCooldown:0,cooldown:0,shieldDelay:0,bolts:[],particles:[]});s.shield=maxPatrolShield(s);return true;}
  s.sector=c.sector;s.seed=c.seed;s.credits=c.credits;s.score=c.score;s.kills=c.kills;s.rescues=c.rescues;s.upgrades={...c.upgrades};s.nextId=c.nextId??1;
  populateSector(s);s.retries=retries;s.best=best;s.x=s.y=900;s.vx=s.vy=0;s.angle=-Math.PI/2;s.hull=100;s.shield=maxPatrolShield(s);s.energy=100;s.boostCooldown=s.boostTime=s.pulseCooldown=s.cooldown=s.shieldDelay=0;s.invulnerable=3;s.phase='ready';s.paused=true;s.reputation=0;return true;
}
function recordCheckpoint(s:SalvageSession):void {
  const snapshot=structuredClone({...s,checkpoint:null,bolts:[],particles:[],warps:s.arcade?s.warps:[]});
  s.checkpoint={sector:s.sector,seed:s.seed,credits:s.credits,score:s.score,kills:s.kills,rescues:s.rescues,upgrades:{...s.upgrades},nextId:s.nextId,snapshot};
}
export function setPatrolWaypoint(s:SalvageSession,kind:WaypointKind,x?:number,y?:number):void {
  if(kind==='point'&&(!Number.isFinite(x)||!Number.isFinite(y)))return;s.waypoint=kind==='point'?{kind,x:clamp(x!,30,1770),y:clamp(y!,30,1770)}:{kind};
}
export interface NavigationTarget {x:number;y:number;name:string;kind:WaypointKind;distance:number;}
export function patrolNavigation(s:SalvageSession):NavigationTarget {
  let kind=s.waypoint.kind;if(kind==='auto')kind=s.arcade?(!s.arcade.cleared&&s.arcade.rest===0?'hostiles':'fragments'):s.cargo+s.delivered>=s.quota?(s.mission.bossRequired&&!s.mission.bossDefeated?'hostiles':'relay'):'fragments';
  let target:{x:number;y:number;name:string}|undefined;
  const nearest=<T extends {x:number;y:number}>(items:T[])=>items.slice().sort((a,b)=>distance(a,s)-distance(b,s))[0];
  if(kind==='fragments'){const r=nearest(s.relics.filter(r=>!r.collected));if(r)target={...r,name:s.arcade?'Salvage core':'Archive fragment'};else if(s.arcade?.caches.length)target={...nearest(s.arcade.caches.filter(c=>c.hp>0)),name:'Supply cache · shoot it'};}
  if(kind==='beacons'){const b=nearest(s.mission.beacons.filter(b=>!b.scanned));if(b)target={...b,name:'Survey beacon'};}
  if(kind==='courier'){const v=s.ships.find(v=>v.kind==='courier'&&!s.courierSaved);if(v)target={...v,name:v.active?'Escort courier':'Stranded courier'};}
  if(kind==='hostiles'){const v=nearest(s.ships.filter(v=>hostile(s,v)&&v.kind==='carrier'));const any=v??nearest(s.ships.filter(v=>hostile(s,v)));if(any)target={...any,name:any.kind==='carrier'?'Command carrier':'Raider'};}
  if(kind==='point')target={x:s.waypoint.x!,y:s.waypoint.y!,name:'Your waypoint'};
  if(!target)target={...RELAY,name:s.arcade?'Workshop · optional repairs':'Archive relay'};return {...target,kind,distance:distance(s,target)};
}

export function damagePilot(s:SalvageSession,amount:number):void {
  if(s.invulnerable>0||s.phase!=='flying'||!Number.isFinite(amount)||amount<=0)return;
  if(s.difficulty===1)amount*=.6;
  const blocked=Math.min(s.shield,amount);s.shield-=blocked;s.hull=Math.max(0,s.hull-(amount-blocked));s.invulnerable=.25;s.shieldDelay=4;s.hitFlash=.25;s.stats.damage+=amount;
  burst(s,s.x,s.y,'spark',5);if(s.hull<=30&&s.hull>0&&s.noticeTime<1)announce(s,'Hull critical. Follow the relay marker for free repairs.','warning',5);
  if(!s.hull){s.phase='lost';s.paused=true;s.best=Math.max(s.best,s.score);announce(s,'Ship disabled. Retry this sector with your banked upgrades, or begin a new expedition.','warning',8);burst(s,s.x,s.y,'blast',20);}
}
function damageVessel(s:SalvageSession,v:Vessel,amount:number,owner:number):void {
  if(v.hp<=0)return;v.maxHp??=v.hp;if(v.kind==='carrier')amount*=v.hp>v.maxHp*.65?.65:v.hp>v.maxHp*.32?.8:1;v.hp=Math.max(0,v.hp-amount);v.hit=.12;
  if(owner===0){v.credited=true;s.stats.hits++;if(!hostile(s,v)){s.reputation++;announce(s,'Friendly fire! Enable IFF safety in Flight settings to protect friendly ships.','warning');}}
  if(v.kind==='carrier'||owner===0)floating(s,v.x,v.y-24,String(Math.round(amount)),false);
}
function launchBolt(s:SalvageSession,x:number,y:number,a:number,owner:number,kind:Bolt['kind']='enemy',spread=0):void {
  if(!s.arcade&&owner<=0&&Math.hypot(x-900,y-900)<RELAY.radius)return;
  const friendly=owner===0,level=s.upgrades.weapon,weapon=s.weapon;
  const speed=friendly?weapon==='lance'?1100:weapon==='scatter'?590:710:owner===-1?340:kind==='heavy'?180+s.difficulty*24:220+s.difficulty*42;
  s.bolts.push({x:x+Math.cos(a)*24,y:y+Math.sin(a)*24,vx:Math.cos(a+spread)*speed+(friendly?s.vx*.35:0),vy:Math.sin(a+spread)*speed+(friendly?s.vy*.35:0),life:friendly?weapon==='scatter'?.5:weapon==='lance'?.9:1.05:3.2,owner,
    damage:(friendly?weapon==='lance'?39+level*8:weapon==='scatter'?8+level*2:(15+level*4)*(level>=2?.64:1):owner===-1?9:kind==='heavy'?16+s.difficulty*3:6+s.difficulty*2)*(friendly&&s.arcade?.overdrive?1.3:1),kind:friendly?weapon:kind,radius:friendly?weapon==='lance'?2.5:3:kind==='heavy'?6:4,pierce:friendly&&weapon==='lance'?2:0,hitIds:[]});
}
export function fireSalvage(s:SalvageSession):boolean {
  const info=WEAPON_INFO[s.weapon],cost=s.arcade?0:info.cost;if(s.paused||s.phase!=='flying'||s.cooldown>0||s.energy<cost||!s.arcade&&distance(s,RELAY)<RELAY.radius)return false;
  const a=s.angle,spreads=s.weapon==='scatter'?[-.23,-.115,0,.115,.23]:s.weapon==='blaster'&&s.upgrades.weapon>=2?[-.035,.035]:[0];
  for(const spread of spreads)launchBolt(s,s.x,s.y,a,0,s.weapon,spread);
  s.cooldown=info.cooldown/(1+s.upgrades.weapon*.14)*(s.arcade?.overdrive ? .55 : 1);s.energy-=cost;s.stats.shots++;return true;
}
export function pulseSalvage(s:SalvageSession):boolean {
  if(s.paused||s.phase!=='flying'||s.pulseCooldown>0||!s.arcade&&distance(s,RELAY)<RELAY.radius)return false;
  s.pulseCooldown=EMP_RECHARGE;s.empPulses.push({x:s.x,y:s.y,angle:s.angle,distance:0,hitIds:[]});
  announce(s,'EMP away · Forward cone disables raiders for 5s, carriers for 3s. Recharging for 18s.','info',4);return true;
}
function updateEMP(s:SalvageSession,dt:number):void {
  for(const wave of s.empPulses){
    wave.distance=Math.min(EMP_RANGE,wave.distance+780*dt);
    const covers=(q:{x:number;y:number})=>distance(q,wave)<=wave.distance&&Math.abs(angleDelta(Math.atan2(q.y-wave.y,q.x-wave.x)-wave.angle))<=EMP_HALF_ANGLE;
    for(const v of s.ships)if(v.hp>0&&hostile(s,v)&&!wave.hitIds.includes(v.id)&&covers(v)){
      wave.hitIds.push(v.id);v.disabledFor=v.kind==='carrier'?3:5;v.charge=0;v.arming=false;v.cooldown=Math.max(v.cooldown,.8);
      floating(s,v.x,v.y-36,v.kind==='carrier'?'EMP · 3s':'EMP · 5s',true);
    }
    for(const b of s.bolts)if(b.owner>0&&covers(b))b.life=0;
  }
  s.empPulses=s.empPulses.filter(w=>w.distance<EMP_RANGE);
}
export function boostSalvage(s:SalvageSession,_dx?:number,_dy?:number):boolean {
  if(s.paused||s.phase!=='flying'||s.boostCooldown>0||s.energy<18)return false;
  s.energy-=18;s.boostCooldown=3.2;s.boostTime=.55;s.invulnerable=Math.max(s.invulnerable,.16);s.stats.boosts++;
  burst(s,s.x-Math.cos(s.angle)*15,s.y-Math.sin(s.angle)*15,'collect',4);return true;
}
export function dockSalvage(s:SalvageSession):boolean {
  if(s.phase!=='flying'||distance(s,RELAY)>110)return false;
  s.phase='docked';s.paused=true;s.vx=s.vy=s.angularVelocity=s.engineThrottle=0;const cargo=s.cargo;s.delivered+=cargo;s.credits+=cargo*30;s.score+=cargo*100;s.cargo=0;
  s.hull=100;s.shield=maxPatrolShield(s);s.energy=100;s.boostCooldown=s.boostTime=s.shieldDelay=0;s.reputation=Math.max(0,s.reputation-1);s.best=Math.max(s.best,s.score);
  announce(s,cargo?`${cargo} fragments archived. +${cargo*30} credits. Repairs complete.`:'Docked. Hull, shields and energy restored.','good');recordCheckpoint(s);return true;
}
export function upgradeSalvage(s:SalvageSession,key:keyof SalvageSession['upgrades']):boolean {
  if(s.phase!=='docked'||!Object.hasOwn(s.upgrades,key)||s.upgrades[key]>=3)return false;
  const cost=patrolUpgradeCost(s,key);if(s.credits<cost)return false;s.credits-=cost;s.upgrades[key]++;if(key==='shield')s.shield=maxPatrolShield(s);recordCheckpoint(s);return true;
}
export function selectPatrolWeapon(s:SalvageSession,weapon:PatrolWeapon):boolean {
  if(!Object.hasOwn(WEAPON_INFO,weapon)||s.phase==='lost'||s.phase==='complete')return false;s.weapon=weapon;return true;
}
export function selectPatrolChassis(s:SalvageSession,chassis:PatrolChassis):boolean {
  if(!Object.hasOwn(CHASSIS_INFO,chassis)||!['ready','docked'].includes(s.phase))return false;s.chassis=chassis;s.shield=maxPatrolShield(s);return true;
}
export function nextSector(s:SalvageSession):boolean {
  if(s.phase!=='docked'||!sectorComplete(s))return false;
  if(s.sector===6){s.phase='complete';s.paused=true;s.score+=1500;s.best=Math.max(s.best,s.score);announce(s,'The archive is whole again. All six sectors restored.','good',10);return true;}
  s.sector++;s.x=900;s.y=s.arcade?650:900;s.vx=s.vy=0;s.hull=100;s.shield=maxPatrolShield(s);s.energy=100;s.invulnerable=3;s.boostCooldown=s.pulseCooldown=s.shieldDelay=0;populateSector(s);s.phase=s.arcade?'ready':'docked';return true;
}
/** Time until the next active storm is visible in the same rings used by the renderer. */
export function patrolStorms(s:SalvageSession):{x:number;y:number;r:number;warning:boolean;active:boolean;phase:number}[] {
  if(s.sector!==5)return [];return [0,1,2].map(i=>{const a=(s.sectorSeed%1000)/1000*6.28+i*2.094,phase=(s.sectorTime+i*4.6)%15;return{x:900+Math.cos(a)*510,y:900+Math.sin(a)*510,r:115,warning:phase>=9&&phase<12,active:phase>=12,phase};});
}
/** Swept segment/circle hit fraction; high-speed shots cannot tunnel through a ship. */
export function patrolSegmentHit(x0:number,y0:number,x1:number,y1:number,x:number,y:number,r:number):number {
  const dx=x1-x0,dy=y1-y0,fx=x0-x,fy=y0-y,a=dx*dx+dy*dy,c=fx*fx+fy*fy-r*r;if(c<=0)return 0;if(a<1e-10)return Infinity;
  const b=2*(fx*dx+fy*dy),disc=b*b-4*a*c;if(disc<0)return Infinity;const t=(-b-Math.sqrt(disc))/(2*a);return t>=0&&t<=1?t:Infinity;
}
function updateProjectiles(s:SalvageSession,dt:number):void {
  for(const b of s.bolts){if(b.life<=0)continue;const travel=Math.min(dt,b.life),x0=b.x,y0=b.y,x1=x0+b.vx*travel,y1=y0+b.vy*travel;b.life-=dt;
    const candidates:{t:number;type:'rock'|'ship'|'pilot'|'relay'|'cache';object?:Rock|Vessel|SupplyCache}[]=[];
    for(const r of s.rocks){if((r.hp??1)<=0)continue;const t=patrolSegmentHit(x0,y0,x1,y1,r.x,r.y,r.r+(b.radius??2));if(t!==Infinity)candidates.push({t,type:'rock',object:r});}
    if(b.owner>0){const t=patrolSegmentHit(x0,y0,x1,y1,s.x,s.y,15+(b.radius??3));if(t!==Infinity)candidates.push({t,type:'pilot'});
      if(!s.arcade){const safe=patrolSegmentHit(x0,y0,x1,y1,900,900,145);if(safe!==Infinity)candidates.push({t:safe,type:'relay'});}}
    if(b.owner===0)for(const cache of s.arcade?.caches??[]){if(cache.hp<=0)continue;const t=patrolSegmentHit(x0,y0,x1,y1,cache.x,cache.y,25+(b.radius??2));if(t!==Infinity)candidates.push({t,type:'cache',object:cache});}
    for(const v of s.ships){if(v.hp<=0||v.id===b.owner||b.hitIds?.includes(v.id))continue;
      if(b.owner>0&&hostile(s,v)||b.owner===-1&&!hostile(s,v)||b.owner===0&&s.safety&&!hostile(s,v))continue;
      const t=patrolSegmentHit(x0,y0,x1,y1,v.x,v.y,(v.kind==='carrier'?42:18)+(b.radius??2));if(t!==Infinity)candidates.push({t,type:'ship',object:v});}
    candidates.sort((a,b)=>a.t-b.t);let ended=false;
    for(const hit of candidates){b.x=x0+(x1-x0)*hit.t;b.y=y0+(y1-y0)*hit.t;
      if(hit.type==='rock'){const r=hit.object as Rock;r.hp??=35+r.r;r.hp-=b.damage;burst(s,b.x,b.y,'spark',3);ended=true;}
      if(hit.type==='cache'){const cache=hit.object as SupplyCache;cache.hp-=b.damage;cache.hit=.15;burst(s,b.x,b.y,'spark',5);ended=true;}
      if(hit.type==='pilot'){damagePilot(s,b.damage);ended=true;}
      if(hit.type==='relay'){burst(s,b.x,b.y,'collect',2);ended=true;}
      if(hit.type==='ship'){const v=hit.object as Vessel;damageVessel(s,v,b.damage,b.owner);burst(s,b.x,b.y,'spark',4);(b.hitIds??=[]).push(v.id);if((b.pierce??0)>0)b.pierce!--;else ended=true;}
      if(ended){b.life=0;break;}
    }
    if(!ended){b.x=x1;b.y=y1;}
  }
  s.bolts=s.bolts.filter(b=>b.life>0&&b.x>=0&&b.y>=0&&b.x<=1800&&b.y<=1800).slice(-200);
}
function steerVessel(s:SalvageSession,v:Vessel,tx:number,ty:number,pace:number,dt:number,orbit=0):void {
  const a=Math.atan2(ty-v.y,tx-v.x);v.angle+=clamp(angleDelta(a-v.angle),-dt*3.8,dt*3.8);
  let desiredX=Math.cos(a+orbit)*pace,desiredY=Math.sin(a+orbit)*pace;
  for(const rock of s.rocks){const d=distance(v,rock),limit=rock.r+75;if(d<limit&&d>.01){const strength=(1-d/limit)*pace*2.8;desiredX+=(v.x-rock.x)/d*strength;desiredY+=(v.y-rock.y)/d*strength;}}
  for(const other of s.ships){if(other.id===v.id)continue;const d=distance(v,other);if(d>0&&d<55){desiredX+=(v.x-other.x)/d*50;desiredY+=(v.y-other.y)/d*50;}}
  const ease=1-Math.exp(-dt*3);v.vx+=(desiredX-v.vx)*ease;v.vy+=(desiredY-v.vy)*ease;v.x=clamp(v.x+v.vx*dt,35,1765);v.y=clamp(v.y+v.vy*dt,35,1765);
  if(!s.arcade&&hostile(s,v)&&distance(v,RELAY)<185){const a=Math.atan2(v.y-900,v.x-900);v.x=900+Math.cos(a)*185;v.y=900+Math.sin(a)*185;}
}
function updateVessels(s:SalvageSession,dt:number):void {
  for(const v of s.ships){if(v.hp<=0)continue;v.maxHp??=v.hp;v.hit=Math.max(0,(v.hit??0)-dt);
    if((v.disabledFor??0)>0){
      v.disabledFor=Math.max(0,v.disabledFor!-dt);v.charge=0;v.arming=false;
      v.vx*=Math.exp(-dt*3);v.vy*=Math.exp(-dt*3);v.x=clamp(v.x+v.vx*dt,35,1765);v.y=clamp(v.y+v.vy*dt,35,1765);
      continue;
    }
    v.cooldown-=dt;const enemy=hostile(s,v),d=distance(v,s);
    if(v.kind==='courier'){
      if(!v.active&&d<230){v.active=true;announce(s,'Courier found. Stay within 420 m and guide it home.','good',6);}
      if(v.active&&!s.courierSaved){if(distance(v,RELAY)<100){s.courierSaved=true;s.rescues++;reward(s,'courier',50,'Courier safely escorted.');}
        else if(d<420||distance(v,RELAY)<220)steerVessel(s,v,900,900,82,dt);else{v.vx*=Math.exp(-dt*3);v.vy*=Math.exp(-dt*3);}}
      continue;
    }
    if(!enemy){const rival=s.ships.filter(q=>hostile(s,q)&&q.hp>0).sort((a,b)=>distance(a,v)-distance(b,v))[0];
      if(rival){steerVessel(s,v,rival.x,rival.y,108,dt,distance(v,rival)<240?1.1:0);if(distance(v,rival)<560&&v.cooldown<=0){launchBolt(s,v.x,v.y,Math.atan2(rival.y-v.y,rival.x-v.x),-1);v.cooldown=.85;}}
      else steerVessel(s,v,900+Math.cos(s.elapsed*.15+v.id)*170,900+Math.sin(s.elapsed*.15+v.id)*170,60,dt);continue;
    }
    const friends=s.ships.filter(q=>!hostile(s,q)&&q.hp>0&&(q.kind!=='courier'||q.active&&!s.courierSaved)&&distance(q,v)<500&&distance(q,RELAY)>145);
    const threats:[SalvageSession|Vessel,number][]=[...friends.map(q=>[q,distance(q,v)*(q.kind==='courier'?.8:1)] as [Vessel,number]),...(s.arcade||distance(s,RELAY)>145?[[s,distance(s,v)] as [SalvageSession,number]]:[])];
    threats.sort((a,b)=>a[1]-b[1]);const target=threats[0]?.[0]??s,range=distance(v,target),role=v.role??'skirmisher';
    const pace=v.kind==='carrier'?34+s.difficulty*3:role==='gunship'?53+s.difficulty*10+s.sector*2:role==='sniper'?62+s.difficulty*10:85+s.difficulty*13+s.sector*3;
    const preferred=v.kind==='carrier'?330:role==='sniper'?460:role==='gunship'?270:190;
    const orbit=range<preferred*.72?Math.PI:range<preferred*1.13?(v.id%2?1.1:-1.1):0;
    steerVessel(s,v,target.x,target.y,pace,dt,orbit);
    const canFire=range<(role==='sniper'?800:610)&&(s.arcade||distance(target,RELAY)>145)&&s.sectorTime>2;
    if(canFire&&!v.arming&&v.cooldown<.55)v.cooldown=.55;v.arming=canFire;
    v.charge=canFire&&v.cooldown<.55?clamp(1-v.cooldown/.55,0,1):0;
    if(canFire&&v.cooldown<=0){
      const lead=s.difficulty>=2?range/(220+s.difficulty*42)*(.25+s.difficulty*.1):0;
      const a=Math.atan2(target.y+target.vy*lead-v.y,target.x+target.vx*lead-v.x);
      const phase=v.kind==='carrier'?v.hp<v.maxHp*.32?2:v.hp<v.maxHp*.65?1:0:0;
      if(v.kind==='carrier'&&phase>(v.phase??0)){v.phase=phase;announce(s,phase===2?'Carrier core exposed. Keep moving through its spread.':'Carrier launching reinforcements. Watch the warp rings.','warning');
        if(s.ships.length+s.warps.length<24)for(const side of [-1,1])s.warps.push({x:clamp(v.x+side*100,80,1720),y:clamp(v.y+80,80,1720),clock:2,role:'skirmisher'});}
      const spread=v.kind==='carrier'?(phase===2?[-.45,-.225,0,.225,.45]:[-.25,0,.25]):role==='gunship'?s.arcade?[-.13,0,.13]:[-.11,.11]:[0];
      for(const delta of spread)launchBolt(s,v.x,v.y,a,v.id,v.kind==='carrier'?'heavy':'enemy',delta);
      v.cooldown=Math.max(.65,3.5-s.difficulty*.44-s.sector*.08)+(role==='sniper'?.65:0);v.charge=0;
    }
    if(d<(v.kind==='carrier'?52:30))damagePilot(s,v.kind==='carrier'?25:13);
  }
}

function collectResources(s:SalvageSession,input:FlightInput,dt:number):void {
  const range=patrolTractorRange(s,input.tractor);
  for(const r of s.relics){if(r.collected)continue;const d=distance(s,r);if(d>=range)continue;
    if(d<34){r.collected=true;if(s.arcade){s.delivered++;s.credits+=12;}else s.cargo++;s.stats.fragments++;s.combo=s.comboClock>0?s.combo+1:1;s.comboClock=6;
      const points=s.arcade?25*patrolMultiplier(s):Math.round(25*(1+Math.min(4,s.combo-1)*.25));s.score+=points;burst(s,r.x,r.y,'collect',8);floating(s,r.x,r.y-15,s.arcade?'+1 CORE · +12 cr':s.combo>1?`+${points} · chain ${s.combo}`:`+${points}`,true);
      if(s.arcade)continue;
      if(s.cargo+s.delivered===s.quota)announce(s,s.mission.bossRequired&&!s.mission.bossDefeated?'Recovery quota secured. Disable the carrier, then return home.':'Quota secured. Press H for the relay, then G to dock.','good',6);
      else if(s.noticeTime<1)announce(s,`Fragment secured. ${s.cargo} aboard. Hold F for a wider tractor beam.`,'good',2);
    }else{const pull=(s.arcade?.cleared?6:input.tractor?5:3.5)*dt;r.x+=(s.x-r.x)*pull;r.y+=(s.y-r.y)*pull;}
  }
  for(const p of s.pickups){p.life-=dt;const wanted=p.kind==='repair'?s.hull<97:p.kind==='energy'?s.energy<90:p.kind==='shield'?s.shield<maxPatrolShield(s)-5:true,d=distance(p,s);
    if(wanted&&d<range){if(d<32){p.life=0;if(p.kind==='repair')s.hull=Math.min(100,s.hull+35);if(p.kind==='energy')s.energy=Math.min(100,s.energy+45);if(p.kind==='shield')s.shield=Math.min(maxPatrolShield(s),s.shield+50);if(p.kind==='credits')s.credits+=s.arcade?8:20;
        if(p.kind==='overdrive'&&s.arcade){s.arcade.overdrive=12;announce(s,'OVERDRIVE · Faster fire and +30% damage for 12 seconds.','good',3);}
        if(p.kind==='magnet'&&s.arcade){s.arcade.magnet=20;announce(s,'LOOT MAGNET · Sweep up cores from twice as far for 20 seconds.','good',3);}
        floating(s,p.x,p.y,p.kind==='overdrive'?'OVERDRIVE 12s':p.kind==='magnet'?'MAGNET 20s':p.kind==='credits'?s.arcade?'+8 cr':'+20 cr':p.kind==='repair'?'+35 hull':p.kind==='energy'?'+45 energy':'+50 shield',true);burst(s,p.x,p.y,'collect',6);
      }else{p.x+=(s.x-p.x)*dt*4;p.y+=(s.y-p.y)*dt*4;}}
  }
  s.pickups=s.pickups.filter(p=>p.life>0).slice(-60);if(s.relics.length>140)s.relics=s.relics.filter(r=>!r.collected);
  for(const b of s.mission.beacons){if(b.scanned)continue;
    if((input.scan||input.tractor)&&distance(b,s)<125){b.progress=Math.min(1,b.progress+dt/1.6);if(b.progress>=1){b.scanned=true;burst(s,b.x,b.y,'pulse',1);s.score+=100;s.credits+=20;announce(s,`Survey beacon ${s.mission.beacons.filter(q=>q.scanned).length} / 3 mapped. +20 credits.`,'good');}}
  }
  if(s.mission.beacons.length===3&&s.mission.beacons.every(b=>b.scanned))reward(s,'survey',90,'Survey network restored.');
}
function finishDestruction(s:SalvageSession):void {
  // Chain reactions are resolved once per cache, including caches caught by an earlier explosion.
  if(s.arcade){let cache:SupplyCache|undefined;while((cache=s.arcade.caches.find(c=>c.hp<=0))){
    s.arcade.caches=s.arcade.caches.filter(c=>c!==cache);dropCores(s,cache.x,cache.y,3);burst(s,cache.x,cache.y,'blast',1);
    s.pickups.push({id:s.nextId++,x:cache.x,y:cache.y,kind:cache.volatile?'overdrive':'magnet',life:100});
    floating(s,cache.x,cache.y-34,cache.volatile?'CHAIN BLAST!':'CACHE OPEN · 3 CORES',true);
    if(cache.volatile){for(const v of s.ships)if(hostile(s,v)&&distance(v,cache)<170)damageVessel(s,v,100,0);for(const other of s.arcade.caches)if(distance(other,cache)<145)other.hp=0;burst(s,cache.x,cache.y,'pulse',1);}
  }}
  for(const v of s.ships.filter(v=>v.hp<=0)){
    burst(s,v.x,v.y,'blast',1);burst(s,v.x,v.y,'spark',v.kind==='carrier'?36:15);
    if(v.kind==='raider'||v.kind==='carrier'){
      if(v.credited){s.kills++;s.sectorKills++;s.mission.bounty++;if(s.arcade){s.combo=s.comboClock>0?s.combo+1:1;s.comboClock=6;}const points=(v.kind==='carrier'?700:120)*(s.arcade?patrolMultiplier(s):1);s.score+=points;s.credits+=v.kind==='carrier'?100:s.arcade?8:18;floating(s,v.x,v.y-20,`+${points}`,true);}
      dropCores(s,v.x,v.y,s.arcade?v.kind==='carrier'?8:2:1);
      if(s.arcade)s.pickups.push({id:s.nextId++,x:v.x+20,y:v.y,kind:s.sectorKills===3||s.sectorKills%7===0?'overdrive':'credits',life:100});
      if(v.kind==='carrier'){s.mission.bossDefeated=true;reward(s,'carrier',120,'Carrier disabled. The jump route is open.');}
      if(random(s)<(s.arcade?s.difficulty<=2?.45:.25:.68))s.pickups.push({id:s.nextId++,x:v.x+15,y:v.y-15,kind:s.hull<60?'repair':random(s)<.5?'energy':'shield',life:100});
    }else if(v.kind==='courier'&&!s.courierSaved){s.mission.courierLost=true;announce(s,'Courier lost. Its rescue was optional; the archive can still be restored.','warning',5);}
  }
  if(s.mission.bounty>=3)reward(s,'bounty',s.arcade?30:60,'Three raiders defeated. Patrol bounty earned.');
  s.ships=s.ships.filter(v=>v.hp>0);
  for(const r of s.rocks.filter(r=>(r.hp??1)<=0)){burst(s,r.x,r.y,'spark',12);if(r.ore){s.pickups.push({id:s.nextId++,x:r.x,y:r.y,kind:'credits',life:120});if(s.arcade)dropCores(s,r.x,r.y,2);}}
  s.rocks=s.rocks.filter(r=>(r.hp??1)>0);
}
function updateArcade(s:SalvageSession,dt:number):void {
  const a=s.arcade;if(!a)return;
  a.overdrive=Math.max(0,a.overdrive-dt);a.magnet=Math.max(0,a.magnet-dt);for(const c of a.caches)c.hit=Math.max(0,c.hit-dt);
  const enemies=s.ships.some(v=>v.hp>0&&hostile(s,v))||s.warps.length>0;
  if(!enemies&&!a.cleared){
    if(a.wave===3){a.cleared=true;a.rest=0;announce(s,'SECTOR CLEAR! Loot sweep engaged. Your upgrades open automatically.','good',6);burst(s,s.x,s.y,'pulse',1);
      // A recovered old save can have fewer enemies/cores. Never strand it below the target.
      const available=s.relics.filter(r=>!r.collected).length;if(s.delivered+available<s.quota)dropCores(s,s.x,s.y-80,s.quota-s.delivered-available);
    }else if(a.rest===0){a.rest=4;announce(s,`WAVE ${a.wave} CLEAR · Scoop the loot. Next wave in 4 seconds.`,'good',4);}
    else{a.rest=Math.max(0,a.rest-dt);if(a.rest===0){a.wave++;spawnArcadeWave(s);}}
  }
  if(a.cleared&&s.delivered>=s.quota){a.finishClock+=dt;if(a.finishClock>=2.5){
    s.phase='docked';s.paused=true;s.vx=s.vy=0;s.hull=100;s.shield=maxPatrolShield(s);s.energy=100;s.best=Math.max(s.best,s.score);
    announce(s,`SECTOR SECURED · ${s.delivered} cores banked. Spend your credits, then launch the next sector.`,'good',8);recordCheckpoint(s);
  }}
}
function updatePilot(s:SalvageSession,input:FlightInput,dt:number):void {
  const speedFactor=CHASSIS_INFO[s.chassis].speed,braking=!!input.brake||input.thrust<0;
  // The pilot alone steers the nose. Old screen-axis and mouse-aim fields are intentionally ignored.
  const turn=clamp(input.turn,-1,1),turnRate=2.8*(s.chassis==='swift'?1.12:s.chassis==='bulwark'?.9:1);
  s.angularVelocity+=(turn*turnRate-s.angularVelocity)*(1-Math.exp(-dt/(turn?.16:.11)));
  s.angle=angleDelta(s.angle+s.angularVelocity*dt);
  const throttle=braking?0:clamp(input.thrust,0,1);
  s.engineThrottle+=(throttle-s.engineThrottle)*(1-Math.exp(-dt/.18));
  if(input.boost&&!braking)boostSalvage(s);
  const fx=Math.cos(s.angle),fy=Math.sin(s.angle),forward=s.vx*fx+s.vy*fy,side=-s.vx*fy+s.vy*fx;
  const lateral=side*Math.exp(-dt*(braking?4.5:2.1)),drag=Math.exp(-dt*(braking?4.5:.35));
  const cruiseMax=(310+s.upgrades.engine*45)*speedFactor;
  const acceleration=braking?0:(s.boostTime>0?1100:throttle>0&&Math.hypot(s.vx,s.vy)<cruiseMax?s.engineThrottle*(320+s.upgrades.engine*85):0)*speedFactor;
  const speedForward=forward*drag+acceleration*dt;
  s.vx=fx*speedForward-fy*lateral;s.vy=fy*speedForward+fx*lateral;
  const speed=Math.hypot(s.vx,s.vy),max=690*speedFactor;
  // Afterburner momentum decays naturally instead of snapping back to cruise speed.
  if(speed>max){s.vx*=max/speed;s.vy*=max/speed;}
  s.x=clamp(s.x+s.vx*dt,24,1776);s.y=clamp(s.y+s.vy*dt,24,1776);
  for(const r of s.rocks){const d=distance(s,r),limit=r.r+14;if(d<limit){const a=Math.atan2(s.y-r.y,s.x-r.x);s.x=r.x+Math.cos(a)*limit;s.y=r.y+Math.sin(a)*limit;
      const impact=Math.abs(s.vx*Math.cos(a)+s.vy*Math.sin(a));s.vx*=.35;s.vy*=.35;if(impact>65)damagePilot(s,Math.min(15,impact*.035));}}
  s.x=clamp(s.x,24,1776);s.y=clamp(s.y,24,1776);
}
export function stepSalvage(s:SalvageSession,input:FlightInput,dt:number):void {
  if(s.paused||s.phase!=='flying'||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(.04,dt);s.elapsed+=dt;s.sectorTime+=dt;
  for(const key of ['cooldown','pulseCooldown','invulnerable','noticeTime','boostCooldown','boostTime','shieldDelay','hitFlash','comboClock'] as const)s[key]=Math.max(0,s[key]-dt);
  s.energy=Math.min(100,s.energy+dt*(s.boostTime>0?5:23));if(s.shieldDelay===0)s.shield=Math.min(maxPatrolShield(s),s.shield+dt*(7+s.upgrades.shield*1.5));
  updatePilot(s,input,dt);if(s.phase!=='flying')return;
  if(input.fire)fireSalvage(s);if(input.pulse)pulseSalvage(s);
  collectResources(s,input,dt);updateEMP(s,dt);updateVessels(s,dt);updateProjectiles(s,dt);finishDestruction(s);
  if(s.phase!=='flying')return;
  updateArcade(s,dt);if(s.phase!=='flying')return;
  for(const storm of patrolStorms(s))if(storm.active&&distance(s,storm)<storm.r)damagePilot(s,5);
  if(!s.arcade&&s.sectorTime>12&&s.cargo+s.delivered<s.quota&&distance(s,RELAY)>240){
    s.waveClock-=dt;const count=s.ships.filter(v=>hostile(s,v)).length+s.warps.length;
    if(s.waveClock<=0){s.waveClock=30;if(count<5+s.difficulty){const[x,y]=position(s,600,60);s.warps.push({x,y,clock:2.4,role:s.sector>2?'sniper':'skirmisher'});announce(s,'A raider is warping in. Its arrival ring marks the position.','warning',4);}}
  }
  for(const w of s.warps){w.clock-=dt;if(w.clock<=0)s.ships.push(vessel(s,w.kind==='carrier'?'carrier':'raider',w.x,w.y,w.role));}s.warps=s.warps.filter(w=>w.clock>0).slice(-12);
  for(const p of s.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(p.kind!=='text'){p.vx*=Math.exp(-dt*2);p.vy*=Math.exp(-dt*2);}}
  s.particles=s.particles.filter(p=>p.life>0).slice(-300);s.best=Math.max(s.best,s.score);
}

const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const number=(v:unknown,min=0,max=1e12):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const integer=(v:unknown,min:number,max:number)=>number(v,min,max)&&Number.isInteger(v);
const enumValue=<T extends string>(v:unknown,choices:readonly T[],fallback:T):T=>choices.includes(v as T)?v as T:fallback;
/** Earlier archive saves migrate in place. Transient shots and impact effects resume cleanly. */
export function restoreSalvage(value:unknown):SalvageSession|null {
  if(!object(value))return null;const v=value;
  if(!integer(v.sector,1,6)||!integer(v.difficulty,1,5)||!integer(v.seed,0,4294967295)||!['ready','flying','docked','lost','complete'].includes(v.phase))return null;
  if(!['hull','shield','energy','credits','score','best','x','y','elapsed','cooldown','pulseCooldown','invulnerable','cargo','delivered','quota','reputation','kills','sectorKills','rescues','noticeTime','nextId'].every(k=>number(v[k]))||!['vx','vy','angle'].every(k=>number(v[k],-1e6,1e6)))return null;
  if(v.x>1800||v.y>1800||v.hull>100||v.shield>200||v.energy>100||!object(v.upgrades)||!['engine','weapon','shield','tractor'].every(k=>integer(v.upgrades[k],0,3)))return null;
  if(typeof v.courierSaved!=='boolean'||typeof v.notice!=='string'||v.notice.length>300)return null;
  if(!Array.isArray(v.ships)||v.ships.length>40||!v.ships.every(q=>object(q)&&['raider','warden','courier','carrier'].includes(q.kind)&&['id','x','y','hp'].every(k=>number(q[k],0,10000))&&['vx','vy','angle','cooldown'].every(k=>number(q[k],-1e6,1e6))))return null;
  if(!Array.isArray(v.relics)||v.relics.length>200||!v.relics.every(r=>object(r)&&['x','y','id'].every(k=>number(r[k]))&&integer(r.kind,0,3)&&typeof r.collected==='boolean'))return null;
  if(!Array.isArray(v.rocks)||v.rocks.length>40||!v.rocks.every(r=>object(r)&&['x','y','rotation'].every(k=>number(r[k]))&&number(r.r,1,60)))return null;
  const base=newSalvage(v.difficulty,v.seed,v.best),s={...base,...structuredClone(v),version:2,paused:true,bolts:[],particles:[]} as SalvageSession;
  s.weapon=enumValue(v.weapon,['blaster','scatter','lance'],'blaster');s.chassis=enumValue(v.chassis,['ranger','swift','bulwark'],'ranger');s.flight='classic';s.aimAssist=false;
  for(const key of ['autoTractor','safety'] as const)s[key]=typeof v[key]==='boolean'?v[key]:true;
  for(const key of ['sectorTime','boostCooldown','boostTime','shieldDelay','combo','comboClock','waveClock','retries'] as const)s[key]=number(v[key],0,1e9)?v[key]:base[key];
  s.boostTime=0;s.hitFlash=0;s.zoom=clamp((number(v.zoom,.6,1.6)?v.zoom:1)*(v.flightVersion===1?1:.8),.6,1.25);s.sectorSeed=integer(v.sectorSeed,0,4294967295)?v.sectorSeed:v.seed;
  s.flightVersion=1;s.angularVelocity=number(v.angularVelocity,-4,4)?v.angularVelocity:0;s.engineThrottle=number(v.engineThrottle,0,1)?v.engineThrottle:0;
  s.pulseCooldown=clamp(s.pulseCooldown,0,EMP_RECHARGE);
  s.empPulses=Array.isArray(v.empPulses)?v.empPulses.filter(w=>object(w)&&number(w.x,0,1800)&&number(w.y,0,1800)&&number(w.angle,-Math.PI,Math.PI)&&number(w.distance,0,EMP_RANGE)&&Array.isArray(w.hitIds)&&w.hitIds.length<=40&&w.hitIds.every(id=>integer(id,0,1e9))).slice(-2):[];
  s.waypoint={kind:'auto'};if(object(v.waypoint)){const kind=enumValue(v.waypoint.kind,['auto','relay','fragments','beacons','courier','hostiles','point'],'auto');setPatrolWaypoint(s,kind,v.waypoint.x,v.waypoint.y);}
  s.stats=emptyStats();if(object(v.stats))for(const k of Object.keys(s.stats) as (keyof PatrolStats)[])if(number(v.stats[k]))s.stats[k]=v.stats[k];
  s.log=Array.isArray(v.log)?v.log.filter(q=>object(q)&&typeof q.text==='string'&&q.text.length<=300&&number(q.time)&&['info','good','warning'].includes(q.kind)).slice(-7):[];
  s.pickups=Array.isArray(v.pickups)?v.pickups.filter(q=>object(q)&&integer(q.id,0,1e9)&&number(q.x,0,1800)&&number(q.y,0,1800)&&number(q.life,0,200)&&['repair','energy','shield','credits','overdrive','magnet'].includes(q.kind)).slice(-60):[];
  s.warps=Array.isArray(v.warps)?v.warps.filter(q=>object(q)&&number(q.x,30,1770)&&number(q.y,30,1770)&&number(q.clock,0,3)&&['skirmisher','gunship','sniper'].includes(q.role)).slice(0,12):[];s.mission=base.mission;
  if(object(v.mission)){
    s.mission.beacons=Array.isArray(v.mission.beacons)?v.mission.beacons.filter(q=>object(q)&&integer(q.id,0,1e9)&&number(q.x,0,1800)&&number(q.y,0,1800)&&number(q.progress,0,1)&&typeof q.scanned==='boolean').slice(0,3):[];
    s.mission.rewards=Array.isArray(v.mission.rewards)?v.mission.rewards.filter(q=>typeof q==='string'&&['courier','survey','bounty','carrier'].includes(q)):[];
    s.mission.bossDefeated=v.mission.bossDefeated===true;s.mission.courierLost=v.mission.courierLost===true;s.mission.bounty=integer(v.mission.bounty,0,10000)?v.mission.bounty:0;
  }else s.mission.bossDefeated=!s.ships.some(q=>q.kind==='carrier');
  s.mission.bossRequired=s.sector===3||s.sector===6;s.shield=Math.min(maxPatrolShield(s),s.shield);
  for(const ship of s.ships){ship.role=enumValue<RaiderRole>(ship.role,['skirmisher','gunship','sniper'],'skirmisher');ship.maxHp=number(ship.maxHp,ship.hp,2000)?ship.maxHp:ship.hp;ship.hit=0;ship.charge=0;ship.cooldown=Math.max(.5,ship.cooldown);ship.phase=integer(ship.phase,0,2)?ship.phase:0;ship.active=ship.kind!=='courier'||ship.active===true;ship.credited=ship.credited===true;ship.disabledFor=number(ship.disabledFor,0,5)?ship.disabledFor:0;}
  for(const rock of s.rocks){rock.hp=number(rock.hp,0,200)?rock.hp:35+rock.r;rock.ore=rock.ore===true;}
  const arcade=v.arcade;s.arcade=newArcade();
  if(object(arcade)&&arcade.version===1){
    s.arcade.wave=integer(arcade.wave,1,3)?arcade.wave:1;s.arcade.rest=number(arcade.rest,0,4)?arcade.rest:0;s.arcade.cleared=arcade.cleared===true&&s.arcade.wave===3;
    s.arcade.finishClock=number(arcade.finishClock,0,2.5)?arcade.finishClock:0;s.arcade.overdrive=number(arcade.overdrive,0,12)?arcade.overdrive:0;s.arcade.magnet=number(arcade.magnet,0,20)?arcade.magnet:0;s.arcade.autoFire=arcade.autoFire===true;
    s.arcade.caches=Array.isArray(arcade.caches)?arcade.caches.filter(c=>object(c)&&integer(c.id,0,1e9)&&number(c.x,30,1770)&&number(c.y,30,1770)&&number(c.hp,0,100)&&number(c.maxHp,1,100)&&c.hp<=c.maxHp&&typeof c.volatile==='boolean').slice(0,12).map(c=>({...c,hit:0})):[];
  }else{
    // Honour cargo earned under the former ferrying loop, once, then use immediate banking.
    s.delivered+=s.cargo;s.credits+=s.cargo*30;s.score+=s.cargo*100;s.cargo=0;s.ships=s.ships.filter(v=>v.kind!=='warden');
    if(s.delivered>=s.quota&&(!s.mission.bossRequired||s.mission.bossDefeated)){s.arcade.wave=3;s.arcade.cleared=true;}
  }
  if(s.ships.some(v=>v.hp>0&&hostile(s,v))||s.warps.length)s.arcade.cleared=false;
  const c=v.checkpoint;
  s.checkpoint=object(c)&&c.sector===s.sector&&integer(c.seed,0,4294967295)&&['credits','score','kills','rescues'].every(k=>number(c[k]))&&object(c.upgrades)&&['engine','weapon','shield','tractor'].every(k=>integer(c.upgrades[k],0,3))?{sector:c.sector,seed:c.seed,credits:c.credits,score:c.score,kills:c.kills,rescues:c.rescues,upgrades:{engine:c.upgrades.engine,weapon:c.upgrades.weapon,shield:c.upgrades.shield,tractor:c.upgrades.tractor},nextId:integer(c.nextId,1,1e9)?c.nextId:1}:{sector:s.sector,seed:s.sectorSeed,credits:s.credits,score:s.score,kills:s.kills,rescues:s.rescues,upgrades:{...s.upgrades}};
  if(object(c)&&object(c.snapshot)&&c.snapshot.checkpoint===null&&c.snapshot.sector===s.sector&&c.snapshot.phase==='docked'){const saved=restoreSalvage(c.snapshot);if(saved&&s.checkpoint){saved.checkpoint=null;s.checkpoint.snapshot=saved;}}
  if(s.phase==='flying'&&sectorComplete(s)){
    s.phase='docked';s.hull=100;s.shield=maxPatrolShield(s);s.energy=100;s.vx=s.vy=0;
    announce(s,'Sector secured. Your loot is banked. Choose upgrades, then launch the next sector.','good',8);
  }else if(/Weapons standby|Quota secured|recover \d+ fragments|Return your cargo/i.test(s.notice)){
    announce(s,'Blast raiders and caches. Cores bank immediately; upgrades open after three waves.','info',6);
  }
  s.best=Math.max(s.best,s.score);return s;
}
