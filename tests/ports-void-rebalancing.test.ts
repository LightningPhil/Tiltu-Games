import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGame} from './ports-void-harness.ts';
import {GAME_CONFIG,COMMANDERS,INVASION,STEP_MS,SHIPS,createLevels,getPracticeLevels,getEnemyScale,getEnemyHullBonus} from '../src/arcade-ports/void/balance.ts';

const close=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);

test('real multishot volleys deal square-root total damage at every rank, including both temporary boosts and each ship',()=>{
    const {Game}=loadGame();const p=Game.player;
    for(const ship of Object.keys(SHIPS))for(const extra of [false,true])for(const plasma of [false,true])for(let rank=0;rank<=12;rank++){
        Game.shipId=ship;Game.levels.spread=rank;Game.levels.weaponPower=5;
        p.buffs.buff_guns=extra?1000:0;p.buffs.buff_plasma=plasma?1000:0;p.updateStats();
        Game.bullets=[];p.shoot();const count=rank+1+(extra?2:0);
        assert.equal(Game.bullets.length,count);
        Game.bullets.forEach(shot=>close(shot.damage,p.damage/Math.sqrt(count)));
        close(Game.bullets.reduce((sum,shot)=>sum+shot.damage,0),p.damage*Math.sqrt(count));
        close(p.volleyDamage,p.damage*Math.sqrt(count));
        if(count===4)close(p.volleyDamage,p.damage*2);
        if(count>1)assert.ok(Game.bullets[0].vx<0&&Game.bullets.at(-1).vx>0);
    }
});

test('adding pellets does not weaken the mega cannon, side cannons or tracking turrets',()=>{
    const {Game,Enemy}=loadGame();const p=Game.player;Game.levels={...createLevels(),weaponPower:8,megaCannon:2,sideGuns:2,turretFront:2};
    const target=new Enemy('BOMBER',1);target.x=p.x;target.y=100;target.entryDelay=0;Game.enemies=[target];
    for(const rank of [0,1,3,7,12]){
        Game.levels.spread=rank;p.updateStats();Game.bullets=[];p.shoot();
        assert.ok(Game.bullets.filter(b=>b.kind==='side').every(b=>b.damage===p.damage*2));
        p.shootMega();assert.equal(Game.bullets.at(-1).damage,p.damage*6);
        p.shootTurret('turretFront');assert.equal(Game.bullets.at(-1).damage,p.damage*2);
    }
});

test('the added hull bonus ramps linearly from zero to fifty percent without changing enemy projectile damage',()=>{
    const {Game,Enemy}=loadGame();
    for(let wave=1;wave<=30;wave++){
        const previous=1+Math.min(wave-1,9)*.16+Math.max(0,wave-10)*.055;
        const scale=getEnemyScale(wave),factor=1+.5*(wave-1)/29;
        close(getEnemyHullBonus(wave),factor);close(scale.hp/previous,factor);
        const enemy=new Enemy('BASIC',wave);close(enemy.hp,GAME_CONFIG.ENEMIES.BASIC.hp*previous*factor);
        close(enemy.damage,8*(1+Math.min(wave-1,9)*.04)*1.125);
    }
    for(const commander of COMMANDERS.slice(0,-1)){
        Game.wave=commander.wave;const enemy=new Enemy(commander.type,commander.wave,true);
        close(enemy.hp,commander.hp*getEnemyHullBonus(commander.wave));
    }
    close(getEnemyHullBonus(300),1.5);
});

test('the final fleet has a fourth row and fifty percent more average armour per ship, counted once',()=>{
    for(const width of [1200,600]){
        const {Game}=loadGame(1,width);Game.wave=30;Game.beginCommander();
        const count=width===1200?20:16,oldCount=width===1200?15:12;
        assert.equal(Game.enemies.length,count);assert.equal(new Set(Game.enemies.map(e=>e.row)).size,4);
        const total=Game.enemies.reduce((sum,e)=>sum+e.hp,0);close(total,112500);
        close(total/count,(56250/oldCount)*1.5);assert.equal(Game.invasion.maxHp,total);
    }
});

test('fleet motion has no held frames, respects elapsed time, and eases a descent without overshoot',()=>{
    const distance=(dt)=>{
        const {Game}=loadGame();Game.wave=30;Game.beginCommander();const ship=Game.enemies[0],start=ship.x;
        for(let i=0;i<Math.round(1000/dt);i++){const previous=ship.x;Game.updateInvasion(dt);assert.ok(ship.x>previous);}
        return ship.x-start;
    };
    assert.ok(Math.abs(distance(STEP_MS)-distance(STEP_MS/2))<.2);
    const {Game}=loadGame();Game.wave=30;Game.beginCommander();const ship=Game.enemies[0],y=ship.y;
    Game.invasion.dropTimer=INVASION.descentDuration;const steps=[];
    for(let i=0;i<39;i++){const before=ship.y;Game.updateInvasion(STEP_MS);steps.push(ship.y-before);}
    close(ship.y-y,INVASION.descent);assert.ok(steps[0]<steps[19]);assert.ok(steps.at(-1)<steps[19]);
});

function docked(){
    const runtime=loadGame();const {Game}=runtime;Game.wave=2;Game.levels.weaponPower=4;Game.player.updateStats();Game.coins=1234;
    Game.completeWave();Game.openShop();Game.toHangar();return runtime;
}

test('practice jumps directly to the final fleet with a usable build and preserves the expedition through restart and defeat',()=>{
    const {Game,elements}=docked(),profile=Game.profile,saved=JSON.parse(JSON.stringify(profile));
    assert.equal(Game.startPractice(30,'recommended'),true);assert.equal(Game.practice,true);assert.equal(Game.recordable,false);
    assert.equal(Game.wave,30);assert.equal(Game.shopPhase,'boss');assert.equal(Game.enemies.length,20);
    assert.equal(Game.levels.megaCannon,2);assert.equal(Game.player.hull,Game.player.maxHull);assert.equal(Game.pulseCharge,100);
    assert.equal(Game.player.clusterAmmo,3);assert.equal(Game.player.clusterRightAmmo,3);
    assert.match(elements.get('hud-mode').innerText,/PRACTICE/);assert.deepEqual(profile,saved);
    Game.enemies.forEach(e=>e.takeDamage(1e6));Game.update(STEP_MS);assert.equal(Game.victory,true);
    assert.deepEqual(profile,saved);assert.equal(Game.startPractice(30,'recommended'),true);
    Game.gameOver();assert.match(elements.get('result-record').innerText,/PRACTICE/);assert.deepEqual(profile,saved);
    Game.toHangar();assert.equal(Game.practice,false);assert.equal(Game.recordable,true);assert.equal(Game.profile,profile);
    assert.deepEqual(Game.profile,saved);assert.equal(Game.resumeRun(),true);assert.equal(Game.wave,2);assert.equal(Game.coins,1234+getWaveReward());
});

function getWaveReward(){return Math.round((100+2*18)*.45);}

test('practice supports every wave, saved or stock builds, rejects invalid input, and normal flights resume recording',()=>{
    const {Game}=docked(),saved=JSON.parse(JSON.stringify(Game.profile.checkpoint));
    for(const wave of [0,31,NaN,2.5,'30'])assert.equal(Game.startPractice(wave,'recommended'),false);
    assert.equal(Game.startPractice(3,'missing'),false);assert.equal(Game.practice,false);
    assert.equal(Game.startPractice(17,'saved'),true);assert.equal(Game.wave,17);assert.equal(Game.shopPhase,'fighting');
    assert.deepEqual(JSON.parse(JSON.stringify(Game.levels)),saved.levels);assert.equal(Game.coins,saved.coins);
    Game.shopPhase='beacon';Game.openShop();Game.coins=9999;Game.levels.weaponPower=12;Game.saveCheckpoint();
    Game.toHangar();assert.deepEqual(Game.profile.checkpoint,saved);
    assert.equal(Game.startPractice(5,'stock'),true);assert.equal(Game.shopPhase,'boss');assert.equal(Game.enemies[0].commander.wave,5);
    assert.deepEqual(JSON.parse(JSON.stringify(Game.levels)),createLevels());Game.gameOver();Game.start();
    assert.equal(Game.practice,false);assert.equal(Game.recordable,true);assert.equal(Game.wave,1);
    Game.wave=2;Game.completeWave();assert.ok(Game.profile.checkpoint);
    for(let wave=1;wave<=30;wave++){
        const levels=getPracticeLevels(wave);for(const [key,rank]of Object.entries(levels))assert.ok(Number.isInteger(rank)&&rank>=0&&rank<=GAME_CONFIG.UPGRADES[key].max);
    }
});
