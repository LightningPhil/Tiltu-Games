import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGame} from './ports-void-harness.ts';
import {END_SEQUENCE} from '../src/arcade-ports/void/ending.ts';
import {STEP_MS} from '../src/arcade-ports/void/balance.ts';

test('a fatal hit animates at the player position before offering a retry and never advances combat during the explosion',()=>{
    const {Game,Bullet,Coin,elements}=loadGame();const p=Game.player;p.x=390;p.y=620;p.regenShield=0;p.hull=5;
    Game.elapsed=35000;Game.keys.d=true;Game.keys[' ']=true;Game.bullets=[new Bullet(p.x,p.y,0,0,20,'enemy')];Game.drops=[new Coin(p.x,p.y,100)];
    Game.handleCollisions();assert.equal(Game.active,false);assert.equal(p.hull,0);assert.equal(Game.ending.won,false);
    assert.equal(Game.ending.explosion.x,390);assert.equal(Game.ending.explosion.y,620);
    assert.equal(elements.get('game-over-screen').style.display,'none');assert.equal(elements.get('end-cinematic').style.display,'flex');
    Game.updateHUD();assert.equal(elements.get('hud-phase').innerText,'FLIGHT LOST · SHIP DESTROYED');
    assert.equal(Game.keys.d,false);assert.equal(Game.keys[' '],false);assert.equal(Game.bullets.length,0);
    const score=Game.stats.score,coins=Game.coins,x=p.x,shield=p.regenShield;let draws=0;p.draw=()=>draws++;
    Game.update(1000);Game.draw();assert.equal(draws,0);assert.equal(Game.elapsed,35000);assert.equal(p.x,x);assert.equal(p.regenShield,shield);
    assert.equal(Game.coins,coins);assert.equal(Game.stats.score,score);assert.equal(Game.ending.explosion.elapsed,1000);
    Game.update(END_SEQUENCE.defeat-1001);assert.equal(elements.get('game-over-screen').style.display,'none');
    Game.update(1);assert.equal(Game.ending,null);assert.equal(elements.get('game-over-screen').style.display,'flex');
    assert.equal(elements.get('result-title').innerText,'SHIP DESTROYED');assert.equal(elements.get('replay-btn').innerText,'TRY AGAIN ↗');
    assert.equal(Game.profile.records['arcade-expedition'].attempts,1);
});

test('the final kill wins immediately, preserves its explosion origin, and reveals a celebratory victory after the blast',()=>{
    const {Game,Bullet,elements,continueEndless,AudioEngine}=loadGame();Game.wave=30;Game.beginCommander();let fanfares=0;AudioEngine.playVictory=()=>fanfares++;
    Game.enemies.slice(0,-1).forEach(e=>e.takeDamage(1e6));const last=Game.enemies.at(-1);last.x=430;last.y=280;
    const p=Game.player;p.hull=1;p.regenShield=0;p.hitGrace=0;
    Game.bullets=[new Bullet(last.x,last.y,0,0,1e6,'player'),new Bullet(p.x,p.y,0,0,1e6,'enemy')];
    Game.handleCollisions();assert.equal(Game.victory,true);assert.equal(Game.active,false);assert.ok(p.hull>0);
    assert.equal(Game.ending.explosion.x,last.x);assert.equal(Game.ending.explosion.y,last.y);assert.equal(Game.stats.kills,20);
    assert.equal(elements.get('game-over-screen').style.display,'none');assert.equal(elements.get('result-title').innerText,'YOU WIN');
    Game.updateHUD();assert.equal(elements.get('hud-phase').innerText,'VICTORY · CORE FLEET DESTROYED');
    const score=Game.stats.score,coins=Game.coins,record=JSON.stringify(Game.profile.records);Game.completeWave();Game.gameOver(true);
    assert.equal(Game.stats.score,score);assert.equal(Game.coins,coins);assert.equal(JSON.stringify(Game.profile.records),record);
    continueEndless();assert.equal(Game.active,false);assert.equal(Game.endless,false);
    Game.update(END_SEQUENCE.celebrationAt);assert.equal(Game.ending.celebrated,true);assert.equal(elements.get('cinematic-title').innerText,'YOU WIN');
    assert.equal(fanfares,1);
    assert.equal(elements.get('game-over-screen').style.display,'none');
    Game.update(END_SEQUENCE.victory-END_SEQUENCE.celebrationAt);assert.equal(Game.ending,null);
    assert.equal(fanfares,1);
    assert.equal(elements.get('game-over-screen').style.display,'flex');assert.match(elements.get('result-detail').innerText,/Congratulations/);
    assert.equal(Game.profile.records['arcade-expedition'].wins,1);assert.equal(Game.profile.career.wins,1);
    continueEndless();assert.equal(Game.active,true);assert.equal(Game.endless,true);assert.equal(Game.paused,true);
});

test('practice victories get the same congratulations without changing the saved expedition or career',()=>{
    const {Game,elements}=loadGame();Game.wave=2;Game.completeWave();Game.openShop();Game.toHangar();
    const original=Game.profile,snapshot=JSON.stringify(original);Game.startPractice(30,'recommended');
    Game.enemies.forEach(e=>e.takeDamage(1e6));assert.equal(Game.ending.won,true);
    Game.update(END_SEQUENCE.victory);assert.equal(elements.get('result-title').innerText,'YOU WIN');
    assert.match(elements.get('result-detail').innerText,/Congratulations/);assert.doesNotMatch(elements.get('result-detail').innerText,/Try again/);
    assert.equal(JSON.stringify(original),snapshot);Game.toHangar();assert.equal(Game.profile,original);assert.equal(JSON.stringify(Game.profile),snapshot);
});

test('ending effects run at the same speed across render rates and never replay the result accounting',()=>{
    for(const hz of [30,60,120]){
        const {Game,elements}=loadGame();Game.player.regenShield=0;Game.player.takeDamage(1e6);let time=0;
        while(time<END_SEQUENCE.defeat+100){time+=1000/hz;Game.loop(time);}
        assert.equal(Game.ending,null);assert.equal(elements.get('game-over-screen').style.display,'flex');
        assert.equal(Game.elapsed,0);assert.equal(Game.profile.records['arcade-expedition'].attempts,1);
        Game.update(1000);Game.gameOver();assert.equal(Game.profile.records['arcade-expedition'].attempts,1);
    }
});

test('reduced motion gets a quieter visible explosion and still waits before showing results',()=>{
    const {Game,elements}=loadGame();Game.profile.settings.reducedMotion=true;Game.player.regenShield=0;Game.player.takeDamage(1e6);
    assert.equal(Game.ending.explosion.reduced,true);assert.equal(Game.ending.duration,END_SEQUENCE.reduced);assert.ok(Game.ending.explosion.fragments.length<=8);
    Game.update(500);assert.doesNotThrow(()=>Game.draw());assert.equal(elements.get('game-over-screen').style.display,'none');assert.equal(Game.shake,0);
    Game.update(END_SEQUENCE.reduced-500);assert.equal(elements.get('game-over-screen').style.display,'flex');
});

test('voluntary flight endings stay immediate and restarting or returning to hangar clears a pending animation',()=>{
    const {Game,elements}=loadGame();Game.gameOver();assert.equal(Game.ending,null);assert.equal(elements.get('result-title').innerText,'FLIGHT ENDED');
    assert.equal(elements.get('game-over-screen').style.display,'flex');
    Game.start();Game.player.regenShield=0;Game.player.takeDamage(1e6);assert.ok(Game.ending);Game.start();
    assert.equal(Game.ending,null);assert.equal(elements.get('end-cinematic').style.display,'none');Game.update(STEP_MS);assert.equal(Game.active,true);
    Game.player.regenShield=0;Game.player.hitGrace=0;Game.player.takeDamage(1e6);Game.toHangar();assert.equal(Game.ending,null);
    Game.update(5000);assert.equal(elements.get('game-over-screen').style.display,'none');assert.equal(elements.get('start-screen').style.display,'flex');
});
