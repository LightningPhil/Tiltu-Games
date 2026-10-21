import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from './ports-void-harness.ts';
import { STEP_MS, WAVE_COUNT, GAME_CONFIG, getWaveProfile, getEnemyScale, getUpgradeCost } from '../src/arcade-ports/void/balance.ts';

test('one projectile hits one active target; destroyed enemies and coin crates pay once', () => {
    const { Game, Enemy, Bullet, LootCrate, Coin } = loadGame();
    const a = new Enemy('BASIC', 1), b = new Enemy('BASIC', 1); a.x = b.x = 300; a.y = b.y = 300; a.entryDelay=b.entryDelay=0;
    Game.enemies = [a, b]; Game.bullets = [new Bullet(300, 300, 0, 0, 100, 'player')];
    Game.handleCollisions(); Game.handleCollisions(); a.takeDamage(100);
    assert.equal(a.active, false); assert.equal(b.hp, 35); assert.equal(Game.drops.length, 1);
    const crate=new LootCrate();crate.x=300;crate.y=300;crate.lootRoll=.2;
    Game.enemies=[];Game.drops=[];Game.crates=[crate];Game.bullets=[new Bullet(300,300,0,0,100,'player')];
    Game.handleCollisions();Game.handleCollisions();crate.takeDamage(100);
    assert.equal(crate.active,false);assert.equal(Game.drops.length,3);assert.ok(Game.drops.every(drop=>drop instanceof Coin));
    Game.drops.forEach(drop=>{drop.collect();drop.collect();});
    assert.equal(Game.coins,39);assert.equal(Game.stats.creditsEarned,39);assert.equal('cogs' in Game,false);
});

test('retired repair pickups become coin caches; support and weapon bonuses retain their chances and effects', () => {
    const { Game, LootCrate, Coin }=loadGame();
    const counts={coins:0,support:0,buff:0},bonuses=new Set();
    Game.player.regenShield=0;
    for(let i=0;i<1000;i++){
        const crate=new LootCrate();crate.lootRoll=(i+.5)/1000;Game.drops=[];
        crate.takeDamage(100);const dropCount=Game.drops.length;crate.takeDamage(100);assert.equal(Game.drops.length,dropCount);
        assert.ok(Game.drops.length>0);
        if(Game.drops[0] instanceof Coin){
            counts.coins++;assert.equal(crate.isCoinCache,true);assert.equal(Game.drops.length,3);assert.ok(Game.drops.every(drop=>drop instanceof Coin));
        } else {
            assert.equal(crate.isCoinCache,false);assert.equal(Game.drops.length,1);
            const type=Game.drops[0].config.type;bonuses.add(type);
            if(type.startsWith('buff_'))counts.buff++;else counts.support++;
        }
        Game.drops.forEach(drop=>{drop.collect();drop.collect();});
    }
    assert.deepEqual(counts,{coins:450,support:300,buff:250});
    assert.equal('cogs' in Game,false);assert.equal(Game.coins,450*39);assert.equal(Game.stats.creditsEarned,Game.coins);
    assert.deepEqual([...bonuses].sort(),['battery','buff_guns','buff_missiles','buff_plasma','buff_rapid','overshield']);
    assert.equal(Game.player.regenShield,Game.player.maxRegenShield);assert.equal(Game.player.tempShield,100);
    for(const buff of Object.values(Game.player.buffs))assert.equal(buff,10000);
});
test('overlapping contacts and volleys respect hit grace and shield recharge delay', () => {
    const { Game, Enemy } = loadGame(); const p = Game.player;
    p.regenShield = 0; const e = new Enemy('DESTROYER', 1); e.x = p.x; e.y = p.y; e.entryDelay=0; Game.enemies = [e];
    Game.handleCollisions(); assert.equal(p.hull, 55.25);
    for (let i = 0; i < 20; i++) { p.takeDamage(10); p.update(STEP_MS); }
    assert.equal(p.hull, 55.25); assert.equal(p.regenShield, 0);
    for (let i = 0; i < 210; i++) p.update(STEP_MS);
    assert.ok(p.regenShield > 0); assert.equal(p.hull, 55.25);
});
test('purchases charge authoritative costs and allow any affordable rank from the first dock', () => {
    const { Game,buyUpgrade }=loadGame();Game.coins=100000;buyUpgrade('weaponPower');assert.equal(Game.levels.weaponPower,0);
    Game.wave=2;Game.shopPhase='beacon';Game.openShop();
    for(const key of ['spread','missiles','sideGuns','megaCannon','cluster','turret'])buyUpgrade(key);
    assert.equal(Game.levels.turret,1);assert.equal(Game.player.clusterAmmo,3);
    const before=Game.coins,cost=getUpgradeCost('spread',Game.levels);buyUpgrade('spread');assert.equal(Game.coins,before-cost);assert.equal(Game.levels.spread,2);
    for(let i=0;i<50;i++)buyUpgrade('weaponPower');assert.equal(Game.levels.weaponPower,30);assert.equal(Game.player.damage,114);
    const shield=Game.player.regenShield;buyUpgrade('shieldGen');assert.equal(Game.player.maxRegenShield,30);assert.equal(Game.player.regenShield,shield+5);
    Game.coins=0;const rank=Game.levels.spread;buyUpgrade('spread');assert.equal(Game.levels.spread,rank);buyUpgrade('not-a-real-upgrade');
});

test('wave clear grants predictable income and recovery while pickups and projectiles keep moving', () => {
    const { Game, Coin, Bullet } = loadGame();
    Game.player.hull = 60; Game.player.regenShield = 0;
    Game.drops = [new Coin(10,10,14), new Coin(10,10,10), new Coin(10,10,20)]; Game.bullets = [new Bullet(0,0,0,0,10,'enemy')];
    Game.completeWave();
    assert.equal(Game.coins,getWaveProfile(1).reward); assert.equal('cogs' in Game,false);
    assert.equal(Game.stats.creditsEarned, Game.coins); assert.equal(getWaveProfile(1).reward, 53);
    assert.equal(Game.player.hull, 66); assert.equal(Game.player.regenShield, 6.25);
    assert.equal(Game.bullets.length, 1); assert.equal(Game.drops.length,3);assert.ok(Game.drops.every(d=>d.active));assert.equal(Game.shopPhase, 'fighting');
    assert.equal(Game.wave, 2); assert.equal(Game.beacon, null);
});
test('resupply arrives every two waves, with rewards and held controls preserved between stops', () => {
    const { Game, closeShop } = loadGame();
    const stops = [];
    for (let wave=1; wave<WAVE_COUNT; wave++) {
        assert.equal(Game.wave, wave);
        Game.keys[' '] = true; Game.keys.d = true; Game.accumulator = STEP_MS*2;
        Game.completeWave();
        assert.equal('cogs' in Game,false);
        if (wave % 2 === 0) {
            assert.equal(Game.shopPhase, 'beacon'); assert.ok(Game.beacon);
            stops.push(wave); Game.openShop(); closeShop();
            assert.equal(Game.keys[' '], false);
        } else {
            assert.equal(Game.shopPhase, 'fighting'); assert.equal(Game.beacon, null);
            assert.equal(Game.keys[' '], true); assert.equal(Game.keys.d, true);
            assert.equal(Game.accumulator, STEP_MS*2);
        }
    }
    assert.deepEqual(stops, Array.from({length:14},(_,i)=>(i+1)*2));
    assert.equal(Game.coins, Array.from({length:WAVE_COUNT-1},(_,i)=>getWaveProfile(i+1).reward).reduce((sum,n)=>sum+n,0));
    Game.completeWave(); assert.equal('cogs' in Game,false); assert.equal(Game.victory, true); assert.equal(Game.paused, false);
});
test('the wave-five commander advances directly to wave six without an extra shop', () => {
    const { Game } = loadGame(); Game.wave=5; Game.shopPhase='clearing';
    Game.update(STEP_MS); assert.equal(Game.shopPhase,'boss');
    Game.enemies[0].takeDamage(100_000); Game.update(STEP_MS);
    assert.equal(Game.wave,6); assert.equal(Game.shopPhase,'fighting'); assert.equal(Game.beacon,null);
});
test('bosses must be defeated, victory leads to optional endless, restart resets the build', () => {
    const { Game, closeShop, continueEndless } = loadGame();
    Game.wave = WAVE_COUNT; Game.shopPhase = 'clearing'; Game.update(STEP_MS);
    assert.equal(Game.shopPhase, 'boss'); const boss = Game.enemies[0];
    for (let i=0; i<500; i++) boss.update(STEP_MS);
    assert.equal(boss.active, true); assert.ok(boss.y < 200);
    Game.enemies.forEach(enemy=>enemy.takeDamage(100_000)); Game.update(STEP_MS);
    assert.equal(Game.victory, true); assert.equal(Game.active, false);
    Game.update(Game.ending.duration);
    Game.levels.missiles = 2; continueEndless();
    assert.equal(Game.paused, true); closeShop(); assert.equal(Game.wave, WAVE_COUNT+1); assert.equal(Game.levels.missiles, 2);
    Game.start(); assert.equal(Game.wave, 1); assert.equal(Game.levels.missiles, 0); assert.equal(Game.player.missileLevel, 0);
});
test('incoming enemies wait until visible, and commander aim locks before firing', () => {
    const { Game, Enemy } = loadGame();
    const boss = new Enemy('DREADNOUGHT', 10, true);
    const timer = boss.fireTimer; boss.update(STEP_MS);
    assert.equal(boss.fireTimer, timer); assert.equal(Game.bullets.length, 0);
    boss.y = 130; boss.fireTimer = 340; boss.update(STEP_MS);
    const aim = boss.aimAngle; assert.equal(typeof aim, 'number');
    Game.player.x = 1100; boss.update(STEP_MS); assert.equal(boss.aimAngle, aim);
    boss.fireTimer = 1; boss.update(STEP_MS);
    assert.equal(Game.bullets.length, 5); assert.equal(boss.aimAngle, null);
    assert.ok(Math.abs(Math.atan2(Game.bullets[2].vy, Game.bullets[2].vx)-aim) < 0.0001);
});
test('spawn threat and total wave budget bound overwhelming combinations', () => {
    const { Game } = loadGame(9); Game.wave = 10;
    const profile = getWaveProfile(10);
    for (let i=0; i<2400; i++) {
        Game.shopTimer=i*STEP_MS;
        Game.handleSpawning(STEP_MS);
        const threat = Game.enemies.reduce((sum,e) => sum+GAME_CONFIG.ENEMIES[e.type].threat,0);
        assert.ok(threat <= profile.maxThreat + 0.001);
        assert.ok(Game.spentThreat <= profile.budget + 0.001);
        if (i % 60 === 0) Game.enemies = [];
    }
    assert.ok(getEnemyScale(100).damage <= 1.36); assert.equal(getWaveProfile(100).maxThreat, profile.maxThreat);
});
test('30, 60 and 120 Hz render rates advance the same combat clock and movement', () => {
    const states = [30,60,120].map(hz => {
        const { Game } = loadGame(); Game.draw=()=>{}; Game.drawBg=()=>{}; Game.handleSpawning=()=>{};
        Game.player.x=200; Game.keys.d=true;
        for (let i=1; i<=hz; i++) Game.loop(i*1000/hz);
        return { x:Game.player.x, elapsed:Game.elapsed };
    });
    assert.ok(Math.max(...states.map(s=>s.x))-Math.min(...states.map(s=>s.x)) <= 5.001);
    assert.ok(Math.max(...states.map(s=>s.elapsed))-Math.min(...states.map(s=>s.elapsed)) <= STEP_MS+0.001);
});
test('shop pause freezes combat; pause releases controls; coincident pickups stay finite', () => {
    const { Game, Coin } = loadGame(); Game.drawBg=()=>{};
    Game.keys.d=true; Game.togglePause(); const elapsed=Game.elapsed; Game.loop(50);
    assert.equal(Game.elapsed, elapsed); assert.equal(Game.keys.d,false);
    const c=new Coin(Game.player.x,Game.player.y,10); c.update();
    assert.ok(Number.isFinite(c.x)); assert.ok(Number.isFinite(c.y));
    const cost=getUpgradeCost('weaponPower',Game.levels); assert.equal(cost,80);
});
test('magnet starts off, attracts both pickup types only after purchase, and resets on a new run', () => {
    const { Game, Coin, Powerup, buyUpgrade } = loadGame();
    const p = Game.player;
    assert.equal(p.magnetRange,0);
    const coin = new Coin(p.x-25,p.y,10); coin.vx=0; coin.update();
    const item = new Powerup(p.x-25,p.y,{type:'battery',color:'#00ff00',label:'BATTERY'}); item.update();
    assert.equal(coin.vx,0); assert.equal(item.vx,0);
    Game.wave=2; Game.coins=1000; Game.shopPhase='beacon'; Game.openShop();
    buyUpgrade('magnet'); assert.equal(p.magnetRange,60);
    coin.update(); item.update(); assert.ok(coin.vx>0); assert.ok(item.vx>0);
    const furtherCoin = new Coin(p.x-55,p.y,10); furtherCoin.vx=0; furtherCoin.update(); assert.ok(furtherCoin.vx>0);
    buyUpgrade('magnet'); assert.equal(p.magnetRange,70);
    buyUpgrade('magnet'); assert.equal(p.magnetRange,80);
    Game.start(); assert.equal(Game.levels.magnet,0); assert.equal(Game.player.magnetRange,0);
});
test('the shop loadout reflects purchased pods, magnet status, repairs and temporary boosts', () => {
    const { Game, elements, buyUpgrade, buyRepair } = loadGame();
    Game.wave=2; Game.coins=5000; Game.player.hull=60;
    Game.shopPhase='beacon'; Game.openShop();
    const diagram = () => elements.get('ship-loadout').innerHTML;
    assert.match(diagram(),/HOMING PODS empty/); assert.match(diagram(),/SIDE CANNONS empty/);
    assert.match(diagram(),/Magnet off/); assert.match(diagram(),/OFF · NOT FITTED/);
    buyUpgrade('missiles'); assert.match(diagram(),/HOMING PODS rank 1/);
    buyUpgrade('sideGuns'); assert.match(diagram(),/SIDE CANNONS rank 1/);
    assert.match(diagram(),/WEAPONS 2\/9/);
    buyUpgrade('magnet'); assert.match(diagram(),/Magnet rank 1/); assert.match(diagram(),/60 RANGE/);
    buyRepair(); assert.match(diagram(),/Hull 80 of 80/);
    Game.player.buffs.buff_guns=5000; Game.openShop();
    assert.match(diagram(),/EXTRA GUNS · 5s/);
    Game.start(); Game.wave=2; Game.shopPhase='beacon'; Game.player.buffs.buff_missiles=4000; Game.openShop();
    assert.match(diagram(),/HOMING BARRAGE · 4s/);
    assert.match(diagram(),/WEAPONS 0\/9/);
});
