import test from 'node:test';
import assert from 'node:assert/strict';
import { ABILITIES, createProfile, loadProfile, saveProfile, recordRun, scoreMultiplier } from '../src/arcade-ports/void/progress.ts';
import { loadGame } from './ports-void-harness.ts';
import { STEP_MS, GAME_CONFIG, getSalvageValue, moduleCount } from '../src/arcade-ports/void/balance.ts';
import { drawEnemy } from '../src/arcade-ports/void/visuals.ts';

test('dash uses the intended direction, protects briefly and cannot be spammed', () => {
    const { Game }=loadGame();const p=Game.player;Game.keys.d=true;
    assert.equal(p.dash(),true);assert.equal(p.dash(),false);assert.equal(Game.stats.dashes,1);
    const x=p.x,hull=p.hull;p.takeDamage(999);assert.equal(p.hull,hull);
    for(let i=0;i<8;i++)p.update(STEP_MS);
    assert.ok(p.x-x>p.speedBase*8*2);assert.ok(p.dashCooldown>0);
    Game.keys.d=false;for(let i=0;i<200;i++)p.update(STEP_MS);
    assert.equal(p.dashCooldown,0);Game.togglePause();assert.equal(p.dash(),false);
});
test('shockwave consumes charge, clears hostile shots and damages only nearby enemies', () => {
    const { Game,Enemy,Bullet,Missile }=loadGame();const p=Game.player;
    const close=new Enemy('BASIC',1),far=new Enemy('BASIC',1);close.entryDelay=far.entryDelay=0;
    close.x=p.x;close.y=p.y-80;far.x=p.x;far.y=40;Game.enemies=[close,far];
    const friendly=new Bullet(10,10,0,-10,10,'player'),hostile=new Bullet(30,30,0,5,10,'enemy');
    Game.bullets=[friendly,hostile];Game.missiles=[new Missile(100,100,null,10,'enemy')];
    Game.pulseCharge=99;assert.equal(Game.usePulse(),false);
    Game.pulseCharge=100;assert.equal(Game.usePulse(),true);
    assert.equal(friendly.active,true);assert.equal(hostile.active,false);assert.equal(Game.missiles[0].active,false);
    assert.equal(close.active,false);assert.equal(far.active,true);assert.equal(Game.stats.pulses,1);
    assert.equal(Game.pulseCharge,ABILITIES.pulsePerKill);assert.equal(Game.usePulse(),false);
});
test('kills build score rather than inflating credits, and damage breaks the chain', () => {
    const { Game,Enemy }=loadGame();
    for(let i=0;i<4;i++){const e=new Enemy('BASIC',1);e.takeDamage(1000);e.takeDamage(1000);}
    assert.equal(Game.stats.kills,4);assert.equal(Game.stats.combo,4);assert.equal(Game.coins,0);
    assert.equal(Game.stats.score,140*3+175);assert.equal(scoreMultiplier(100),3);
    Game.player.takeDamage(1);assert.equal(Game.stats.combo,0);assert.equal(Game.stats.bestCombo,4);
});
test('guided missiles retarget a live ship rather than wasting the rest of a volley', () => {
    const { Game,Enemy,Missile }=loadGame();const a=new Enemy('BASIC',1),b=new Enemy('BASIC',1);
    a.entryDelay=b.entryDelay=0;a.x=200;a.y=200;b.x=300;b.y=200;Game.enemies=[a,b];
    const m=new Missile(250,500,a,25,'player');a.takeDamage(1000);m.update();
    assert.equal(m.target,b);assert.equal(m.active,true);assert.ok(Number.isFinite(m.x));
    b.takeDamage(1000);const y=m.y;m.update();assert.equal(m.active,true);assert.notEqual(m.y,y);
});
test('command phase transition clears old volleys and gives time before the next attack', () => {
    const { Game,Enemy,Bullet }=loadGame();const boss=new Enemy('DREADNOUGHT',10,true);boss.y=130;
    Game.enemies=[boss];Game.bullets=[new Bullet(10,10,0,5,10,'enemy')];
    boss.takeDamage(boss.maxHp*.51);boss.update(STEP_MS);
    assert.equal(boss.phase,2);assert.equal(Game.bullets[0].active,false);assert.ok(boss.fireTimer>1000);
    const timer=boss.fireTimer;boss.update(STEP_MS);assert.ok(boss.fireTimer<timer);
});
test('difficulty modifiers apply to the increased enemy damage', () => {
    const { Game,Enemy }=loadGame();const base=new Enemy('BASIC',1);
    Game.difficulty='chill';const chill=new Enemy('BASIC',1);
    Game.difficulty='veteran';const veteran=new Enemy('BASIC',1);
    assert.equal(base.hp,35);assert.equal(base.damage,9);assert.equal(chill.hp,35*.85);assert.equal(chill.damage,8*.65*1.125);
    assert.ok(veteran.hp>base.hp);assert.ok(veteran.damage>base.damage);
});
test('blocked or corrupt storage stays playable, and preferences are validated', () => {
    const blocked={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
    assert.equal(loadProfile(blocked).settings.difficulty,'arcade');assert.equal(saveProfile(createProfile(),blocked),false);
    const bad={getItem:()=>'{broken',setItem(){}};assert.equal(loadProfile(bad).settings.autoFire,false);
    const odd={getItem:()=>JSON.stringify({settings:{difficulty:'constructor',music:7,sfx:-2,autoFire:'true'},records:{'arcade-mission':{bestScore:123,bestWave:-5}}}),setItem(){}};
    const p=loadProfile(odd);assert.equal(p.settings.difficulty,'arcade');assert.equal(p.settings.music,1);assert.equal(p.settings.sfx,0);assert.equal(p.settings.autoFire,false);assert.equal(p.records['arcade-mission'].bestWave,0);
});
test('records are separated by difficulty and endless; a finished run is counted once', () => {
    let p=createProfile();const run={difficulty:'arcade' as const,endless:false,won:true,score:100,wave:10,kills:30,elapsed:400000};
    p=recordRun(p,run);p=recordRun(p,{...run,score:50,elapsed:390000});
    assert.equal(p.records['arcade-mission'].bestScore,100);assert.equal(p.records['arcade-mission'].fastestWin,390000);
    p=recordRun(p,{...run,difficulty:'veteran',score:400});p=recordRun(p,{...run,endless:true,won:false,wave:14});
    assert.equal(p.records['arcade-mission'].wins,2);assert.equal(p.records['arcade-endless'].bestWave,14);assert.equal(p.records['veteran-mission'].bestScore,400);
    const { Game }=loadGame();Game.gameOver();Game.gameOver();assert.equal(Game.profile.records['arcade-expedition'].attempts,1);
});
test('salvage removes a fitted weapon, refunds 60% of paid ranks and cannot create credits in a loop', () => {
    const { Game,buyUpgrade,salvageModule }=loadGame();Game.wave=6;Game.coins=2000;Game.shopPhase='beacon';Game.openShop();
    buyUpgrade('spread');buyUpgrade('spread');buyUpgrade('missiles');
    const before=Game.coins,paid=210+Math.round(210*1.14),refund=Math.floor(paid*.6);
    assert.equal(moduleCount(Game.levels),2);assert.equal(getSalvageValue('spread',Game.levels),refund);
    salvageModule('spread');assert.equal(Game.coins,before+refund);assert.equal(Game.levels.spread,0);assert.equal(moduleCount(Game.levels),1);
    salvageModule('spread');assert.equal(Game.coins,before+refund);
    const rebuy=Game.coins;buyUpgrade('spread');salvageModule('spread');assert.ok(Game.coins<rebuy);
    Game.paused=false;const levels={...Game.levels};salvageModule('missiles');assert.deepEqual(Game.levels,levels);
    assert.equal(getSalvageValue('shieldGen',{...Game.levels,shieldGen:3}),0);
});
test('development flights never write personal scores and pointer control stops at its target', () => {
    const { Game }=loadGame();Game.recordable=false;
    const p=Game.player;p.x=500;p.y=500;Object.assign(Game.pointer,{active:true,x:502,y:500});
    p.update(STEP_MS);assert.equal(p.x,502);p.update(STEP_MS);assert.equal(p.x,502);
    Game.gameOver();assert.equal(Object.keys(Game.profile.records).length,0);
});
test('encounters keep arriving late in a wave without spending the threat budget early', () => {
    const { Game }=loadGame(20);Game.wave=10;let lastSpawn=0;
    for(let frame=0;frame<2400;frame++){
        Game.shopTimer=frame*STEP_MS;const spent=Game.spentThreat;Game.handleSpawning(STEP_MS);
        if(Game.spentThreat>spent)lastSpawn=Game.shopTimer;
        if(Game.shopTimer<10000)assert.ok(Game.spentThreat<24);
        Game.enemies=[];
    }
    assert.ok(lastSpawn>32000);assert.ok(Game.spentThreat>50);assert.ok(Game.spentThreat<=58);
});
test('a lethal hit ends scoring and collecting immediately, and records the cause', () => {
    const { Game,Enemy,Bullet,Coin }=loadGame();const p=Game.player;
    p.hull=5;p.regenShield=0;p.tempShield=0;
    const enemy=new Enemy('BASIC',1);enemy.entryDelay=0;enemy.x=100;enemy.y=100;Game.enemies=[enemy];
    Game.bullets=[new Bullet(p.x,p.y,0,0,10,'enemy'),new Bullet(100,100,0,0,1000,'player')];
    Game.drops=[new Coin(p.x,p.y,100)];Game.handleCollisions();
    assert.equal(Game.active,false);assert.equal(Game.stats.kills,0);assert.equal(Game.coins,0);
    assert.equal(Game.stats.lastHit,'HOSTILE VOLLEY');assert.equal(Game.profile.records['arcade-expedition'].bestScore,Game.stats.score);
});
test('critical hull warning re-arms after repairs, and difficulty changes shot speed', () => {
    const { Game,Bullet }=loadGame();const p=Game.player;p.regenShield=0;p.hull=35;p.takeDamage(10);
    assert.equal(p.hullWarned,true);p.hull=70;p.updateStats();assert.equal(p.hullWarned,false);
    Game.difficulty='chill';const chill=new Bullet(0,0,0,5,10,'enemy');
    Game.difficulty='veteran';const veteran=new Bullet(0,0,0,5,10,'enemy');assert.ok(chill.vy<5);assert.ok(veteran.vy>5);
});
test('all combat silhouettes, equipment, drops and effects render with and without reduced motion', () => {
    const { Game,Enemy,Bullet,Missile,ClusterSeeker,Powerup,LootCrate }=loadGame();
    for(const key of Object.keys(Game.levels))Game.levels[key]=2;
    Game.player.updateStats();Game.player.tempShield=20;Game.player.hitGrace=300;Game.createStars();
    Game.enemies=Object.keys(GAME_CONFIG.ENEMIES).map((type,i)=>{
        const e=new Enemy(type,10,i===8);e.x=60+i*115;e.y=100;e.entryDelay=0;e.fireTimer=300;e.aimAngle=1.5;e.hp*=.6;return e;
    });
    Game.bullets=[new Bullet(20,20,1,-5,24,'player'),new Bullet(30,30,0,5,10,'enemy')];
    Game.missiles=[new Missile(50,50,Game.enemies[0],50,'player'),new ClusterSeeker(200,200,.5,144)];Game.crates=[new LootCrate()];
    Game.drops=['battery','overshield','buff_rapid','buff_plasma','buff_guns','buff_missiles'].map((type,i)=>new Powerup(60+i*100,400,{type,color:'#ffaa00',label:type}));
    Game.pulseCharge=100;Game.usePulse();Game.player.regenShield=0;Game.player.hitGrace=0;Game.player.takeDamage(2);
    assert.doesNotThrow(()=>Game.draw());Game.profile.settings.reducedMotion=true;
    assert.doesNotThrow(()=>Game.draw());Game.player.dash();assert.doesNotThrow(()=>Game.draw());
});
test('saved preferences and scores round-trip without persisting equipment', () => {
    let data='';const store={getItem:()=>data,setItem:(_key,value)=>{data=value;}};
    const profile=createProfile();profile.settings.autoFire=true;profile.settings.music=.6;profile.settings.difficulty='chill';
    const saved=recordRun(profile,{difficulty:'chill',endless:false,won:true,score:1234,wave:10,kills:40,elapsed:450000});
    assert.equal(saveProfile(saved,store),true);assert.deepEqual(loadProfile(store),saved);
    assert.equal(Object.hasOwn(JSON.parse(data),'levels'),false);
    assert.equal(loadProfile(null,true).settings.reducedMotion,true);
    assert.equal(loadProfile(store,true).settings.reducedMotion,false);
});
test('actual firing cadence matches its stat and idle time cannot bank a burst', () => {
    const { Game }=loadGame();Game.keys[' ']=true;
    for(let frame=0;frame<600;frame++)Game.player.update(STEP_MS);
    assert.equal(Game.stats.shots,Math.ceil(10000/Game.player.fireDelay));
    Game.keys[' ']=false;for(let frame=0;frame<300;frame++)Game.player.update(STEP_MS);
    const before=Game.stats.shots;Game.keys[' ']=true;Game.player.update(STEP_MS);
    assert.equal(Game.stats.shots,before+1);Game.player.update(STEP_MS);assert.equal(Game.stats.shots,before+1);
});
test('opening enemies shoot straight forward while later enemies can lock their aim', () => {
    const { Game,Enemy }=loadGame();Game.player.x=100;Game.player.y=700;
    for(const type of ['BASIC','INTERMEDIATE']){
        const e=new Enemy(type,1);e.entryDelay=0;e.x=800;e.y=100;e.fireTimer=300;
        e.update(STEP_MS);assert.equal(e.aimAngle,null);
        e.fireWeapon();Game.player.x=1100;e.fireWeapon();
    }
    assert.ok(Game.bullets.every(b=>b.vx===0&&b.vy>0));
    const advanced=new Enemy('ADVANCED',4);advanced.entryDelay=0;advanced.x=200;advanced.y=120;advanced.fireTimer=300;
    advanced.update(STEP_MS);const locked=advanced.aimAngle;assert.equal(typeof locked,'number');
    Game.player.x=100;advanced.update(STEP_MS);assert.equal(advanced.aimAngle,locked);
    advanced.fireWeapon();assert.ok(Game.bullets.slice(-3).some(b=>Math.abs(b.vx)>1));
});
test('all hostile plasma uses blue pointed shapes and enemies draw no dotted aim beams', () => {
    const { Game,Enemy,Bullet }=loadGame();
    for(const type of Object.keys(GAME_CONFIG.ENEMIES)){
        const bulletsBefore=Game.bullets.length,missilesBefore=Game.missiles.length;
        const enemy=new Enemy(type,10);enemy.y=150;enemy.fireWeapon();
        for(const shot of [...Game.bullets.slice(bulletsBefore),...Game.missiles.slice(missilesBefore)])assert.ok(Math.abs(shot.damage-GAME_CONFIG.ENEMIES[type].damage*1.36*1.125*1.5)<1e-10);
    }
    assert.ok(Game.bullets.length>10);assert.ok(Game.bullets.every(b=>b.color==='#4d8dff'));
    const methods=[];const ctx=new Proxy({}, {get:(_,key)=> (..._args)=>methods.push(key)});
    const enemy=new Enemy('ADVANCED',4);enemy.entryDelay=0;enemy.y=100;enemy.fireTimer=150;enemy.aimAngle=1.4;
    drawEnemy(ctx,enemy);assert.equal(methods.includes('setLineDash'),false);
});
test('the lighter ship dies in eight basic projectile hits and clears only restore a quarter shield', () => {
    const { Game,Enemy,Bullet }=loadGame();const p=Game.player,enemy=new Enemy('BASIC',1);
    assert.equal(p.hull,80);assert.equal(p.regenShield,25);assert.equal(p.regenPerSecond,1.5);
    let hits=0;while(Game.active&&hits<25){p.takeDamage(new Bullet(0,0,0,1,enemy.damage,'enemy').damage);hits++;p.update(451);}
    assert.equal(hits,8);assert.equal(Game.active,false);
    Game.start();Game.player.hull=40;Game.player.regenShield=0;Game.completeWave();
    assert.equal(Game.player.hull,46);assert.equal(Game.player.regenShield,6.25);
});
