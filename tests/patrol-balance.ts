/** Repeatable campaign playthroughs using ordinary flight/combat actions, never teleporting or awarding resources. */
import {newSalvage,stepSalvage,dockSalvage,nextSector,sectorComplete,upgradeSalvage,maxPatrolShield,hostile,WEAPON_INFO,retrySalvage} from '../src/archive-patrol.ts';
import type {SalvageSession,PatrolWeapon,FlightInput} from '../src/archive-patrol.ts';
import {writeFileSync} from 'node:fs';
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
function buy(s:SalvageSession){
  const priorities:(keyof typeof s.upgrades)[]=['engine','weapon','weapon','shield','weapon','shield','engine','tractor','shield','engine','tractor','tractor'];
  const goals={engine:0,weapon:0,shield:0,tractor:0};for(const key of priorities){goals[key]++;if(s.upgrades[key]<goals[key]){if(!upgradeSalvage(s,key))break;}}
}
function control(s:SalvageSession):FlightInput {
  const enemies=s.ships.filter(v=>hostile(s,v)&&v.hp>0).sort((a,b)=>dist(a,s)-dist(b,s)),boss=s.ships.find(v=>v.kind==='carrier'&&v.hp>0);
  const full=s.cargo+s.delivered>=s.quota,repair=s.hull<55||s.shield<maxPatrolShield(s)*.16&&s.hull<85;
  const fighting=full&&s.mission.bossRequired&&!s.mission.bossDefeated&&!repair;
  const fragment=s.relics.filter(r=>!r.collected).sort((a,b)=>dist(a,s)-dist(b,s))[0];
  const destination=repair||full&&!fighting?{x:900,y:900}:fighting&&boss?boss:fragment??{x:900,y:900};
  let dx=destination.x-s.x,dy=destination.y-s.y,length=Math.max(1,Math.hypot(dx,dy));dx/=length;dy/=length;
  if(fighting&&boss){const desired=s.weapon==='scatter'?180:s.weapon==='lance'?430:330,d=dist(boss,s),approach=clamp((d-desired)/100,-1,1),side=.75;const tx=dx*approach-dy*side,ty=dy*approach+dx*side;dx=tx;dy=ty;}
  for(const rock of s.rocks){const rx=s.x-rock.x,ry=s.y-rock.y,d=Math.hypot(rx,ry),limit=rock.r+105;if(d<limit&&d>.1){const force=(1-d/limit)*3;dx+=rx/d*force;dy+=ry/d*force;if(Math.abs(dx*ry-dy*rx)<5){dx+=-ry/d*.8;dy+=rx/d*.8;}}}
  const target=fighting&&boss?boss:enemies[0],range=s.weapon==='scatter'?320:s.weapon==='lance'?840:620;
  const aim=target&&dist(target,s)<range?Math.atan2(target.y-s.y,target.x-s.x):Math.atan2(dy,dx);
  const danger=s.bolts.some(b=>b.owner>0&&dist(b,s)<100),nearby=enemies.filter(v=>dist(v,s)<210).length;
  return {turn:0,thrust:0,strafe:0,moveX:dx,moveY:dy,fire:!!target&&dist(target,s)<range&&s.energy>6,tractor:true,pulse:nearby>=3||danger&&s.hull<40,boost:(length>480&&enemies.length<3)||danger&&s.energy>45,brake:false,scan:false,aim};
}
export function playPatrol(level:number,weapon:PatrolWeapon,seed:number,maxSeconds=720){
  const s=newSalvage(level,seed);s.weapon=weapon;s.phase='flying';s.paused=false;let attempts=0,damage=0,docks=0,previousDamage=0;
  for(let i=0;i<maxSeconds*60&&s.phase!=='complete';i++){
    if(s.phase==='lost'){
      if(attempts++>=2)break;damage+=s.stats.damage-previousDamage;previousDamage=0;retrySalvage(s);s.phase='flying';s.paused=false;
    }
    const repair=s.hull<55||s.shield<maxPatrolShield(s)*.16&&s.hull<85,full=s.cargo+s.delivered>=s.quota;
    if(dist(s,{x:900,y:900})<=108&&(s.cargo>0||repair||sectorComplete(s))){
      damage+=s.stats.damage-previousDamage;previousDamage=s.stats.damage;dockSalvage(s);docks++;buy(s);
      if(sectorComplete(s)){nextSector(s);previousDamage=0;}
      if(s.phase==='complete')break;s.phase='flying';s.paused=false;s.invulnerable=Math.max(2,s.invulnerable);
    }
    stepSalvage(s,control(s),1/60);
  }
  damage+=s.stats.damage-previousDamage;
  return {level,weapon,seed,complete:s.phase==='complete',sector:s.sector,seconds:Math.round(s.elapsed),losses:attempts,docks,damage:Math.round(damage),score:s.score,kills:s.kills,cargo:s.cargo,delivered:s.delivered,quota:s.quota,carrier:s.mission.bossDefeated};
}
const results=[];
for(const seed of [761,1729,4643])for(const level of [1,2,3,4,5])for(const weapon of ['blaster','scatter','lance'] as PatrolWeapon[]){const result=playPatrol(level,weapon,seed);results.push(result);process.stdout.write(JSON.stringify(result)+'\n');}
if(process.argv.includes('--write'))writeFileSync(new URL('./results/patrol-balance.json',import.meta.url),JSON.stringify({date:new Date().toISOString(),description:'Public-state scripted pilot; real movement, firing, collision, docking and purchasing. Maximum 720 simulated seconds and two checkpoint retries.',results},null,2));
