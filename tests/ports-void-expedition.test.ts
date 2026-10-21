import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from './ports-void-harness.ts';
import { WAVE_COUNT, COMMANDERS, GAME_CONFIG, getWaveProfile, getEnemyScale, getAct, getCommander, getPlayerStats, createLevels, upgradeLock } from '../src/arcade-ports/void/balance.ts';
import { createProfile, advanceCareer, shipUnlocked, validateCheckpoint, loadProfile, saveProfile, recordRun } from '../src/arcade-ports/void/progress.ts';

test('the expedition has three distinct acts and introduces new squadrons gradually',()=>{
    assert.equal(WAVE_COUNT,30);
    assert.equal(new Set(Array.from({length:30},(_,i)=>getWaveProfile(i+1).name)).size,30);
    assert.equal(getAct(10).number,1);assert.equal(getAct(11).number,2);assert.equal(getAct(21).number,3);
    for(let wave=1;wave<=10;wave++)assert.ok(!getWaveProfile(wave).pool.includes('STRAFER'));
    assert.ok(getWaveProfile(11).pool.includes('STRAFER'));assert.ok(getWaveProfile(16).pool.includes('LANCER'));assert.ok(getWaveProfile(21).pool.includes('CARRIER'));
    assert.equal(getWaveProfile(30).maxThreat,getWaveProfile(10).maxThreat);
    assert.ok(Math.abs(getEnemyScale(30).hp-5.31)<1e-10);assert.ok(getEnemyScale(300).damage<=1.36);
});
test('all six commanders gate progression and have distinct attack patterns',()=>{
    const { Game,Enemy }=loadGame();const patterns=new Set();
    for(const descriptor of COMMANDERS){
        Game.wave=descriptor.wave;Game.shopPhase='clearing';Game.bossSpawned=false;Game.enemies=[];Game.update(1000/60);
        assert.equal(Game.shopPhase,'boss');const boss=Game.enemies[0];assert.equal(boss.commander.name,descriptor.name);patterns.add(boss.commander.pattern);
        if(descriptor.pattern==='invasion'){
            assert.equal(Game.enemies.filter(e=>e.isInvader).length,20);Game.enemies.forEach(e=>e.takeDamage(100000));Game.update(1000/60);assert.equal(Game.victory,true);continue;
        }
        boss.y=130;boss.volley=1;Game.bullets=[];Game.missiles=[];boss.fireWeapon();
        assert.ok(Game.bullets.length+Game.missiles.length>0);
        assert.ok(Game.bullets.every(b=>b.color===GAME_CONFIG.ENEMY_PLASMA_COLOR));
        boss.takeDamage(100000);Game.update(1000/60);
        if(descriptor.wave<30)assert.equal(Game.victory,false);else assert.equal(Game.victory,true);
    }
    assert.equal(patterns.size,6);assert.equal(Game.profile.career.clearedWave,30);
    assert.equal(getCommander(35).wave,30);assert.equal(getCommander(40).wave,25);
});
test('fine-grained ranks have no wave gates or fitting locks',()=>{
    const levels={...createLevels(),weaponPower:6,fireRate:5,shieldGen:4,spread:3,missiles:1};
    for(const key of Object.keys(levels))assert.equal(upgradeLock(key,levels,2),'');
    assert.equal(upgradeLock('weaponPower',{...levels,weaponPower:30},2),'MAX RANK');
    const stats=getPlayerStats({...createLevels(),weaponPower:1,fireRate:1,shieldGen:1,speed:1,spread:1});
    assert.equal(stats.damage,27);assert.equal(stats.spreadCount,2);assert.equal(stats.maxRegenShield,30);assert.equal(stats.speedBase,5.1);
});

test('career goals unlock alternate ships with real tradeoffs and preserve the fragile starter',()=>{
    let p=createProfile();assert.equal(shipUnlocked(p,'striker'),false);assert.equal(shipUnlocked(p,'spectre'),false);
    p=advanceCareer(p,{kills:100,dashes:12,pulses:4,clearedWave:10,bestChain:18,score:10000});
    assert.equal(shipUnlocked(p,'striker'),true);assert.equal(shipUnlocked(p,'spectre'),false);
    p=advanceCareer(p,{kills:20,dashes:1,pulses:1,clearedWave:20,bestChain:10,score:15000});
    assert.equal(shipUnlocked(p,'spectre'),true);assert.equal(p.career.kills,120);assert.equal(p.career.bestChain,18);
    const { Game }=loadGame();Game.active=false;Game.profile=p;Game.selectShip('striker');Game.start();assert.equal(Game.player.maxHull,60);assert.equal(Game.player.regenShield,15);assert.equal(Game.player.damage,29);
    Game.gameOver();Game.selectShip('spectre');Game.start();Game.player.dash();assert.equal(Game.player.dashCooldown,2200);
    assert.equal(getPlayerStats(createLevels()).damage,24);assert.equal(getPlayerStats(createLevels()).maxRegenShield,25);
});
test('dock saves restore purchases, hull, wallet and career accounting without duplicate credit',()=>{
    const { Game,buyUpgrade,buyRepair,closeShop }=loadGame();Game.wave=2;Game.coins=1000;Game.stats.kills=12;Game.stats.dashes=4;Game.elapsed=80000;Game.player.hull=40;
    Game.completeWave();assert.ok(Game.profile.checkpoint);assert.equal(Game.profile.career.kills,12);
    Game.openShop();buyUpgrade('magnet');buyRepair();
    const snapshot=JSON.parse(JSON.stringify(Game.profile.checkpoint));assert.equal(snapshot.levels.magnet,1);assert.equal(snapshot.hull,80);
    Game.toHangar();assert.equal(Game.active,false);assert.equal(Game.resumeRun(),true);
    assert.equal(Game.wave,2);assert.equal(Game.paused,true);assert.equal(Game.player.hull,80);assert.equal(Game.player.magnetRange,60);assert.equal(Game.coins,snapshot.coins);assert.equal('cogs' in snapshot,false);assert.equal('cogs' in Game,false);
    Game.openShop();Game.openShop();assert.equal(Game.profile.career.kills,12);
    closeShop();assert.equal(Game.wave,3);Game.stats.kills+=5;Game.completeWave();assert.equal(Game.profile.career.kills,12);
    // Returning before the next dock rolls back the entire leg, including career credit.
    Game.togglePause();Game.toHangar();Game.resumeRun();assert.equal(Game.stats.kills,12);
    closeShop();Game.stats.kills+=5;Game.completeWave();Game.stats.kills+=3;Game.completeWave();assert.equal(Game.profile.career.kills,20);
    Game.gameOver();assert.equal(Game.profile.career.kills,20);assert.equal(Game.profile.checkpoint,null);assert.equal(Game.resumeRun(),false);
    Game.start();assert.equal(Game.player.magnetRange,0);
});
test('checkpoint validation rejects invalid equipment and damaged data; old records remain separate',()=>{
    const { Game }=loadGame();Game.wave=2;Game.completeWave();const saved=Game.profile.checkpoint;
    assert.ok(validateCheckpoint(saved));assert.equal(validateCheckpoint({...saved,wave:3}),null);
    assert.equal(validateCheckpoint({...saved,hull:Infinity}),null);
    assert.ok(validateCheckpoint({...saved,levels:{...saved.levels,spread:1,sideGuns:1,missiles:1}}));assert.equal(validateCheckpoint({...saved,clusterAmmo:4}),null);
    assert.equal(validateCheckpoint({...saved,banked:{...saved.banked,kills:100000}}),null);
    let encoded='';const store={getItem:()=>encoded,setItem:(_key,value)=>encoded=value};saveProfile(Game.profile,store);
    const restored=loadProfile(store);assert.deepEqual(restored.checkpoint,saved);
    const legacy={settings:{},records:{'arcade-mission':{bestWave:10,bestKills:99,wins:1,bestScore:900}}};
    encoded=JSON.stringify(legacy);const migrated=loadProfile(store);assert.equal(migrated.career.clearedWave,10);assert.equal(shipUnlocked(migrated,'striker'),true);
    const next=recordRun(migrated,{difficulty:'arcade',endless:false,won:true,score:10000,wave:30,kills:500,elapsed:1500000,mode:'expedition'});
    assert.equal(next.records['arcade-mission'].bestScore,900);assert.equal(next.records['arcade-expedition'].bestScore,10000);
});
