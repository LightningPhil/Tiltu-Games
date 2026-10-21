// State-aware tuning pilot for the real final encounter, with no invulnerability
// or free mid-fight healing. Results diagnose viability, not human win rates.
import { loadGame } from './ports-void-harness.ts';
import { STEP_MS, createLevels, getPracticeLevels } from '../src/arcade-ports/void/balance.ts';

export const fleetBuilds={
    forward:{weaponPower:10,spread:4,missiles:1,megaCannon:2,turret:1,turretRight:1,turretFront:1,fireRate:8,speed:2,shieldGen:6},
    flanking:{weaponPower:12,sideGuns:3,missiles:3,megaCannon:2,turret:1,fireRate:10,speed:2,shieldGen:6},
    crossfire:{weaponPower:10,spread:4,sideGuns:3,megaCannon:2,turret:1,fireRate:8,speed:2,shieldGen:6},
    modest:{weaponPower:7,spread:3,missiles:1,megaCannon:1,fireRate:6,speed:1,shieldGen:4},
    recommended:getPracticeLevels(30),
};
export function simulateInvasion(seed=1,style:keyof typeof fleetBuilds='forward',width=1200,options:{difficulty?:string;stationary?:boolean;shoot?:boolean;ship?:string}={}){
    const {Game,random}=loadGame(seed,width,800);Game.recordable=false;
    Game.profile.settings.ship=options.ship||'vanguard';Game.start();Game.difficulty=options.difficulty||'arcade';
    Game.levels={...createLevels(),...fleetBuilds[style]};Game.player.updateStats();Game.player.regenShield=Game.player.maxRegenShield;
    if(options.shoot===false){Game.levels.missiles=0;Game.player.updateStats();}
    Game.wave=30;Game.beginCommander();Game.player.x=width*(.2+random()*.6);Game.player.y=670;Game.pulseCharge=100;
    let maxShots=0,minHull=Game.player.hull,damage=0;
    const takeDamage=Game.player.takeDamage;
    Game.player.takeDamage=function(...args){const before=this.hull+this.regenShield;takeDamage.apply(this,args);damage+=before-this.hull-this.regenShield;};
    for(let frame=0;frame<60*240&&Game.active;frame++){
        const p=Game.player,fleet=Game.invasion;
        if(!options.stationary&&frame%9===0){
            const fronts=Game.enemies.filter(e=>e.active&&!Game.enemies.some(other=>other.active&&other.column===e.column&&other.y>e.y));
            const target=fronts.sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0];
            const lead=fleet.direction*(88+122*(1-Game.enemies.length/fleet.total))*Math.max(0,p.y-(target?.y||0))/900;
            let best={dx:0,dy:0,cost:Infinity};
            for(const dx of [-1,0,1])for(const dy of [-1,0,1]){
                const x=Math.max(22,Math.min(width-22,p.x+dx*p.speedBase*9)),y=Math.max(420,Math.min(755,p.y+dy*p.speedBase*9));
                let cost=Math.abs(y-670)*.35+(target?Math.abs(x-target.x-lead)*.2:0);
                for(const b of Game.bullets)if(b.owner==='enemy')cost+=Math.max(0,65-Math.hypot(x-b.x-b.vx*9,y-b.y-b.vy*9))**2;
                for(const e of Game.enemies)if(e.active)cost+=Math.max(0,e.radius+40-Math.hypot(x-e.x,y-e.y))**2;
                if(x<=22||x>=width-22||y>=755)cost+=100;
                if(cost<best.cost)best={dx,dy,cost};
            }
            Game.keys.a=best.dx<0;Game.keys.d=best.dx>0;Game.keys.w=best.dy<0;Game.keys.s=best.dy>0;
        }
        Game.keys[' ']=options.shoot!==false;Game.update(STEP_MS);
        maxShots=Math.max(maxShots,Game.bullets.filter(b=>b.owner==='enemy').length);minHull=Math.min(minHull,Game.player.hull);
    }
    return {seed,style,width,difficulty:Game.difficulty,won:Game.victory,seconds:Math.round(Game.elapsed/1000),remaining:Game.enemies.filter(e=>e.active).length,
        minHull:Math.round(minHull),damage:Math.round(damage),descents:Game.invasion.descents,maxShots,cause:Game.stats.lastHit};
}
if(process.argv[1]?.endsWith('invasion-sim.ts')){
    for(const style of Object.keys(fleetBuilds) as (keyof typeof fleetBuilds)[])for(const width of [1200,600]){
        const runs=Array.from({length:5},(_,i)=>simulateInvasion(i+1,style,width));
        console.log(JSON.stringify({style,width,wins:runs.filter(r=>r.won).length,runs}));
    }
    console.log(JSON.stringify({stationary:simulateInvasion(1,'forward',1200,{stationary:true}),noFire:simulateInvasion(1,'forward',1200,{stationary:true,shoot:false})}));
    for(const difficulty of ['chill','veteran'])console.log(JSON.stringify(simulateInvasion(1,'modest',1200,{difficulty})));
}
