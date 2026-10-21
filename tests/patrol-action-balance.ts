import {newSalvage,stepSalvage,hostile,upgradeSalvage,nextSector,retrySalvage} from '../src/archive-patrol.ts';
/** Test-only pilot: turns and accelerates through the same limited inputs as a human. No aiming assistance exists in the game. */
export function playPatrol(level:number,seed:number,stationary=false){
  const s=newSalvage(level,seed);s.phase='flying';s.paused=false;let ticks=0,firstKill=0,firstCore=0,damage=0;
  while(ticks++<60*600&&s.phase!=='complete'){
    if(s.phase==='lost'){if(s.retries>=12||!retrySalvage(s))break;s.phase='flying';s.paused=false;} 
    if(s.phase==='docked'){
      for(const key of ['weapon','weapon','shield','engine','tractor'] as const)upgradeSalvage(s,key);
      if(!nextSector(s))break;if(s.phase==='complete')break;s.phase='flying';s.paused=false;
    }
    const enemies=s.ships.filter(v=>hostile(s,v)&&v.hp>0).sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y)),enemy=enemies[0];
    const loot=s.relics.filter(r=>!r.collected).sort((a,b)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b.x-s.x,b.y-s.y))[0];
    const target=enemy??loot??s.arcade!.caches[0],range=target?Math.hypot(target.x-s.x,target.y-s.y):0;
    // Deliberately lead shots in this test pilot, then turn the actual ship towards that bearing.
    const lead=enemy?range/710:0,tx=(target?.x??s.x)+((enemy?.vx??0)-s.vx*.35)*lead,ty=(target?.y??s.y)+((enemy?.vy??0)-s.vy*.35)*lead;
    const angle=target?Math.atan2(ty-s.y,tx-s.x):s.angle,error=Math.atan2(Math.sin(angle-s.angle),Math.cos(angle-s.angle));
    const turn=Math.max(-1,Math.min(1,(error*5-s.angularVelocity*.65)/2.8));
    const thrust=stationary?0:enemy?(range>310&&Math.abs(error)<.8?1:range>220&&Math.abs(error)<.4?.32:0):Math.abs(error)<.7?1:0;
    const brake=!stationary&&((!!enemy&&range<190)||(!enemy&&range<70));
    const before=s.stats.damage;
    stepSalvage(s,{turn,thrust,strafe:0,fire:!!enemy&&Math.abs(error)<.14,tractor:true,pulse:!!enemy&&Math.abs(error)<.35&&(enemies.length>2||enemy.kind==='carrier'),aim:null,brake},1/60);
    damage+=s.stats.damage-before;
    if(s.kills&&!firstKill)firstKill=ticks/60;if(s.stats.fragments&&!firstCore)firstCore=ticks/60;
  }
  return {level,seed,stationary,phase:s.phase,sector:s.sector,time:+(ticks/60).toFixed(1),firstKill:+firstKill.toFixed(2),firstCore:+firstCore.toFixed(2),damage:Math.round(damage),kills:s.kills,retries:s.retries,score:s.score};
}
if(process.argv[1]?.endsWith('patrol-action-balance.ts'))console.log(JSON.stringify([1,2,3,4,5].flatMap(level=>[123,432,729].map(seed=>playPatrol(level,seed))),null,2));
