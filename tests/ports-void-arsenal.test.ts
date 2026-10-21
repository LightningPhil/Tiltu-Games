import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGame} from './ports-void-harness.ts';
import {GAME_CONFIG,STEP_MS,TURRET_MOUNTS,createLevels,getUpgradeCost,getSalvageValue} from '../src/arcade-ports/void/balance.ts';
import {validateCheckpoint} from '../src/arcade-ports/void/progress.ts';

test('cannon and one, two or three turrets share the main cadence and their specified phases, including rapid fire',()=>{
    const combinations=[['turret'],['turretRight'],['turretFront'],['turret','turretRight'],['turret','turretFront'],['turret','turretRight','turretFront']];
    for(const keys of combinations)for(const rapid of [false,true]){
        const {Game,Enemy}=loadGame();const p=Game.player;Game.levels.megaCannon=1;
        keys.forEach(key=>Game.levels[key]=1);Game.levels.fireRate=rapid?30:0;p.buffs.buff_rapid=rapid?20000:0;p.updateStats();
        const target=new Enemy('BASIC',1);target.entryDelay=0;target.x=p.x;target.y=100;Game.enemies=[target];Game.keys[' ']=true;
        const frames:Record<string,number[]>={main:[],mega:[]};keys.forEach(key=>frames[key]=[]);
        for(let frame=0;frame<600;frame++){
            p.update(STEP_MS);
            for(const shot of Game.bullets)frames[shot.kind==='turret'?shot.mount:shot.kind==='mega'?'mega':'main'].push(frame);
            Game.bullets=[];
        }
        const phases={mega:.5,...Object.fromEntries(keys.map((key,i)=>[key,(i+1)/(keys.length+1)]))};
        for(const [key,phase] of Object.entries(phases)){
            assert.ok(Math.abs(frames[key].length-frames.main.length)<=1,`${key} must fire once per main volley`);
            assert.ok(frames[key].length>10);
            for(const frame of frames[key]){
                assert.equal(frames.main.includes(frame),false);
                const before=frames.main.filter(n=>n<frame).at(-1),after=frames.main.find(n=>n>frame);
                assert.notEqual(before,undefined);
                if(after!==undefined)assert.ok(Math.abs(frame-(before!+(after-before!)*phase))<=1,`${key} phase ${phase}, frame ${frame}`);
            }
        }
        if(keys.length===1)assert.deepEqual(frames[keys[0]],frames.mega);
        Game.keys[' ']=false;for(let i=0;i<120;i++)p.update(STEP_MS);
        assert.equal(Game.bullets.length,0);assert.equal(p.pendingShots.length,0);
        Game.keys[' ']=true;p.update(STEP_MS);assert.ok(Game.bullets.every(shot=>!shot.kind));
    }
});

test('all three weapon ranks multiply live main-gun power, including plasma boosts; side guns fire horizontally with the main volley',()=>{
    const {Game,Enemy}=loadGame();const p=Game.player;
    const target=new Enemy('BASIC',1);target.entryDelay=0;target.x=p.x;target.y=100;Game.enemies=[target];
    for(const rank of [1,2,3])for(const plasma of [false,true]){
        Game.levels.megaCannon=Game.levels.sideGuns=rank;TURRET_MOUNTS.forEach(m=>Game.levels[m.key]=rank);
        Game.levels.weaponPower=7;p.buffs.buff_plasma=plasma?10000:0;p.updateStats();
        assert.equal(p.damage,45*(plasma?1.5:1));Game.bullets=[];p.shoot();
        const sides=Game.bullets.filter(b=>b.kind==='side');assert.equal(sides.length,2);
        assert.deepEqual(sides.map(b=>b.vx),[-15,15]);assert.ok(sides.every(b=>b.vy===0&&b.damage===p.damage*rank));
        p.shootMega();const mega=Game.bullets.at(-1);assert.equal(mega.damage,p.damage*3*rank);assert.equal(mega.x,p.x);assert.equal(mega.y,p.y-35);assert.equal(mega.vx,0);assert.equal(mega.vy,-15);
        for(const mount of TURRET_MOUNTS){p.shootTurret(mount.key);const shot=Game.bullets.at(-1);assert.equal(shot.mount,mount.key);assert.equal(shot.damage,p.damage*rank);}
    }
});

test('turrets track the nearest target in their own 180 degree sectors, including rear targets on either side',()=>{
    const {Game,Enemy}=loadGame();const p=Game.player;TURRET_MOUNTS.forEach(m=>Game.levels[m.key]=1);p.updateStats();
    const targets=[[-60,60],[60,60],[0,-150]].map(([dx,dy])=>{const e=new Enemy('BASIC',1);e.entryDelay=0;e.x=p.x+dx;e.y=p.y+dy;return e;});Game.enemies=targets;
    for(const [i,mount] of TURRET_MOUNTS.entries()){
        p.shootTurret(mount.key);assert.equal(p.turrets[i].target,targets[i]);
        const shot=Game.bullets.at(-1),angle=Math.atan2(shot.vy,shot.vx),delta=Math.atan2(Math.sin(angle-mount.axis),Math.cos(angle-mount.axis));
        assert.ok(Math.abs(delta)<=Math.PI/2+1e-9);assert.equal(shot.vy>0,i<2);
    }
    Game.enemies=[targets[1]];Game.bullets=[];p.shootTurret('turret');p.shootTurret('turretFront');assert.equal(Game.bullets.length,0);
    p.shootTurret('turretRight');assert.equal(Game.bullets.length,1);
    targets[1].active=false;p.shootTurret('turretRight');assert.equal(Game.bullets.length,1);
});

test('three-rank purchases use the requested cannon prices and half-price side guns, stop at rank three and salvage consistently',()=>{
    const {Game,buyUpgrade,salvageModule}=loadGame();Game.wave=2;Game.shopPhase='beacon';Game.coins=100000;Game.openShop();
    const cannon=[475,950,1425],turrets=[550,1100,1650],sides=[275,550,825];
    for(const key of ['megaCannon','turret','turretRight','turretFront','sideGuns','missiles','cluster','clusterRight']){
        const costs=key==='megaCannon'?cannon:key==='sideGuns'?sides:key==='missiles'?[280,560,840]:key.startsWith('cluster')?[780,1560,2340]:turrets;
        for(let rank=0;rank<3;rank++){assert.equal(getUpgradeCost(key,Game.levels),costs[rank]);const wallet=Game.coins;buyUpgrade(key);assert.equal(Game.coins,wallet-costs[rank]);}
        const before=Game.coins;buyUpgrade(key);assert.equal(Game.levels[key],3);assert.equal(Game.coins,before);
        const refund=Math.floor(costs.reduce((sum,n)=>sum+n,0)*.6);assert.equal(getSalvageValue(key,Game.levels),refund);salvageModule(key);assert.equal(Game.coins,before+refund);assert.equal(Game.levels[key],0);
    }
});

test('missile damage upgrades use plasma prices and steps, while all missile pods multiply that independent damage through three ranks',()=>{
    const {Game,Enemy,buyUpgrade}=loadGame();const p=Game.player;
    Game.wave=2;Game.shopPhase='beacon';Game.coins=100000;Game.openShop();
    for(let rank=0;rank<30;rank++){
        assert.equal(getUpgradeCost('missilePower',Game.levels),getUpgradeCost('weaponPower',{...Game.levels,weaponPower:rank}));
        const before=Game.coins,cost=getUpgradeCost('missilePower',Game.levels);buyUpgrade('missilePower');
        assert.equal(Game.coins,before-cost);assert.equal(p.missileBaseDamage,24+(rank+1)*3);assert.equal(p.damage,24);
    }
    const wallet=Game.coins;buyUpgrade('missilePower');assert.equal(Game.coins,wallet);assert.equal(Game.levels.missilePower,30);
    Game.paused=false;Game.shopPhase='fighting';Game.levels.weaponPower=9;
    const target=new Enemy('BOMBER',1);target.entryDelay=0;target.x=p.x;target.y=100;Game.enemies=[target];
    for(const rank of [1,2,3])for(const missileRank of [0,7])for(const plasmaBoost of [false,true]){
        Game.levels.missiles=Game.levels.cluster=Game.levels.clusterRight=rank;Game.levels.missilePower=missileRank;p.buffs.buff_plasma=plasmaBoost?10000:0;p.updateStats();p.refillOrdnance();
        const base=24+missileRank*3;assert.equal(p.missileBaseDamage,base);assert.equal(p.damage,51*(plasmaBoost?1.5:1));
        Game.missiles=[];p.shootMissile();assert.equal(Game.missiles.length,1);assert.equal(Game.missiles[0].damage,base*rank);
        for(const side of ['left','right']){
            p.clusterCooldown=0;assert.equal(p.launchCluster(),true);const rocket=Game.missiles.at(-1);
            assert.equal(rocket.x,p.x+(side==='left'?-34:34));assert.equal(rocket.damage,base*rank);
            rocket.detonate();const seekers=Game.missiles.slice(-16);assert.equal(seekers.length,16);assert.ok(seekers.every(m=>m.kind==='cluster-seeker'&&m.damage===base*rank));
        }
    }
    const hostile=new Enemy('FRIGATE',1);const before=hostile.damage;Game.levels.missilePower=30;p.updateStats();hostile.fireWeapon();assert.equal(Game.missiles.at(-1).damage,before*1.5);
});

test('the homing barrage bonus supplies a useful temporary pod and never invents a fourth equipment rank',()=>{
    const {Game,Enemy}=loadGame();const p=Game.player,target=new Enemy('BASIC',1);target.entryDelay=0;Game.enemies=[target];
    Game.levels.missilePower=5;p.buffs.buff_missiles=1000;p.updateStats();p.shootMissile();
    assert.equal(p.missileLevel,1);assert.equal(Game.missiles.length,1);assert.equal(Game.missiles[0].damage,39);assert.equal(Game.levels.missiles,0);
    Game.missiles=[];Game.levels.missiles=3;p.updateStats();p.shootMissile();
    assert.equal(p.missileLevel,3);assert.equal(Game.missiles.length,2);assert.ok(Game.missiles.every(m=>m.damage===117));
    p.buffs.buff_missiles=0;p.updateStats();assert.equal(p.missileCount,1);
});

test('commanders hold their patrol position during the firing warning, giving small builds an opening',()=>{
    const {Game,Enemy}=loadGame();Game.wave=5;const boss=new Enemy('DESTROYER',5,true);boss.y=130;boss.fireTimer=1000;boss.update(STEP_MS);const x=boss.x;
    boss.fireTimer=400;for(let i=0;i<10;i++)boss.update(STEP_MS);assert.equal(boss.x,x);assert.ok(boss.fireTimer>0);
});

test('manual launcher consumes one round, bursts immediately in proximity into 16 friendly homing missiles, and retargets',()=>{
    const {Game,Enemy}=loadGame();const p=Game.player;Game.levels.cluster=1;p.updateStats();p.refillOrdnance();
    const e=new Enemy('BOMBER',1);e.x=p.x;e.y=p.y-200;e.entryDelay=0;Game.enemies=[e];
    assert.equal(p.launchCluster(),true);assert.equal(p.clusterAmmo,2);assert.equal(p.launchCluster(),false);
    const missile=Game.missiles[0];for(let i=0;i<150&&missile.active;i++)missile.update(STEP_MS);
    assert.equal(missile.active,false);assert.ok(missile.time<450);assert.equal(Game.bullets.length,0);
    const seekers=Game.missiles.filter(m=>m.kind==='cluster-seeker');assert.equal(seekers.length,16);assert.ok(seekers.every(m=>m.owner==='player'&&m.damage===p.missileBaseDamage));
    missile.detonate();assert.equal(Game.missiles.filter(m=>m.kind==='cluster-seeker').length,16);
    Game.missiles=[];p.clusterCooldown=0;p.launchCluster();const second=Game.missiles.at(-1);e.active=false;
    const replacement=new Enemy('BASIC',1);replacement.entryDelay=0;replacement.x=p.x+60;replacement.y=p.y-120;Game.enemies.push(replacement);second.update(STEP_MS);assert.equal(second.target,replacement);
});

test('cluster seekers scatter before homing, arc smoothly and only retarget live enemies',()=>{
    const {Game,Enemy,ClusterMissile,ClusterSeeker}=loadGame();const p=Game.player;
    p.x=600;p.y=700;const bomb=new ClusterMissile(600,350,null,p.missileBaseDamage,5,1);bomb.detonate();
    assert.equal(new Set(Game.missiles.map(m=>Math.atan2(m.vy,m.vx))).size,16);
    for(const seeker of Game.missiles){
        const angle=seeker.angle;
        for(let i=0;i<19;i++)seeker.update(STEP_MS);
        assert.equal(seeker.angle,angle);assert.equal(seeker.target,null);assert.ok(Math.hypot(seeker.x-600,seeker.y-350)>130);
        assert.equal(seeker.color,GAME_CONFIG.PLAYER_MISSILE_COLOR);assert.equal(seeker.owner,'player');
    }
    const enemy=new Enemy('BOMBER',1);enemy.entryDelay=0;enemy.x=500;enemy.y=250;Game.enemies=[enemy];
    const seeker=new ClusterSeeker(500,350,0,144);
    for(let i=0;i<20;i++)seeker.update(STEP_MS);
    assert.equal(seeker.target,null);assert.equal(seeker.vy,0);
    for(let i=0;i<3;i++)seeker.update(STEP_MS);
    assert.equal(seeker.target,enemy);assert.ok(seeker.vy<0);assert.ok(Math.abs(seeker.angle)<.2);
    enemy.active=false;seeker.update(STEP_MS);assert.equal(seeker.target,null);
    p.x=seeker.x;p.y=seeker.y;
    const replacement=new Enemy('BASIC',1);replacement.entryDelay=0;replacement.x=200;replacement.y=200;Game.enemies.push(replacement);
    seeker.update(STEP_MS);assert.equal(seeker.target,replacement);
    for(let i=0;i<400&&seeker.active;i++)seeker.update(STEP_MS);assert.equal(seeker.active,false);
});

test('cluster seekers damage enemies once, pass safely through the player and survive friendly shockwaves',()=>{
    const {Game,Enemy,ClusterMissile}=loadGame();const p=Game.player;const bomb=new ClusterMissile(p.x,p.y-100,null,p.missileBaseDamage,5,1);bomb.detonate();
    const shot=Game.missiles[0],e=new Enemy('BOMBER',1);e.x=shot.x;e.y=shot.y;e.entryDelay=0;Game.enemies=[e];Game.missiles.slice(1).forEach(m=>{m.x=100;m.y=100;});const hp=e.hp;Game.handleCollisions();assert.equal(e.hp,hp-p.missileBaseDamage);assert.equal(shot.active,false);
    Game.handleCollisions();assert.equal(e.hp,hp-p.missileBaseDamage);
    const friendly=Game.missiles.find(m=>m.active);friendly.x=p.x;friendly.y=p.y;p.hitGrace=0;
    Game.enemies=[];const hull=p.hull,shield=p.regenShield;Game.handleCollisions();
    assert.equal(p.hull,hull);assert.equal(p.regenShield,shield);assert.equal(friendly.active,true);assert.equal(Game.active,true);
    Game.pulseCharge=100;Game.usePulse();assert.equal(friendly.active,true);
});

test('only entering the shop refills the magazine; purchases, tabs, waves and salvage cannot create combat ammo',()=>{
    const {Game,buyUpgrade,salvageModule,closeShop}=loadGame();Game.wave=2;Game.shopPhase='beacon';Game.coins=10000;Game.openShop();buyUpgrade('cluster');assert.equal(Game.player.clusterAmmo,3);
    Game.player.clusterAmmo=1;buyUpgrade('clusterRight');assert.equal(Game.player.clusterAmmo,1);assert.equal(Game.player.clusterRightAmmo,3);
    Game.player.clusterRightAmmo=1;buyUpgrade('clusterRight');Game.openShop();Game.selectShopTab('systems');buyUpgrade('weaponPower');assert.equal(Game.player.clusterAmmo,1);assert.equal(Game.player.clusterRightAmmo,1);
    const saved=Game.profile.checkpoint;assert.equal(saved.clusterAmmo,1);assert.equal(saved.clusterRightAmmo,1);assert.ok(validateCheckpoint(saved));
    closeShop();assert.equal(Game.player.clusterAmmo,1);Game.nextWave();assert.equal(Game.player.clusterAmmo,1);
    Game.shopPhase='beacon';Game.openShop();assert.equal(Game.player.clusterAmmo,3);assert.equal(Game.player.clusterRightAmmo,3);salvageModule('cluster');assert.equal(Game.player.clusterAmmo,0);assert.equal(Game.player.clusterRightAmmo,3);
    Game.toHangar();assert.equal(Game.resumeRun(),true);assert.equal(Game.player.clusterAmmo,0);assert.equal(Game.player.clusterRightAmmo,3);assert.equal(Game.levels.clusterRight,2);
    Game.start();assert.equal(Game.player.clusterAmmo,0);assert.equal(Game.player.clusterRightAmmo,0);
});

test('independent left and right pods fire one rocket per press, alternate sides, and hold six rounds together',()=>{
    const {Game,Enemy}=loadGame();const p=Game.player;Game.levels.cluster=1;Game.levels.clusterRight=3;p.updateStats();p.refillOrdnance();
    const enemy=new Enemy('BOMBER',1);enemy.entryDelay=0;enemy.x=p.x;enemy.y=100;Game.enemies=[enemy];
    assert.equal(p.clusterCapacity,6);
    for(let i=0;i<6;i++){
        p.clusterCooldown=0;assert.equal(p.launchCluster(),true);assert.equal(Game.missiles.length,i+1);
        const rocket=Game.missiles.at(-1);assert.equal(rocket.x,p.x+(i%2?34:-34));assert.equal(rocket.speed,5);assert.equal(rocket.damage,p.missileBaseDamage*(i%2?3:1));
    }
    p.clusterCooldown=0;assert.equal(p.clusterAmmo,0);assert.equal(p.clusterRightAmmo,0);assert.equal(p.launchCluster(),false);
    Game.levels.cluster=0;p.updateStats();p.refillOrdnance();assert.equal(p.clusterCapacity,3);assert.equal(p.launchCluster(),true);assert.equal(Game.missiles.at(-1).x,p.x+34);
});

test('old dock saves migrate equipment ranks and currency, while all new weapons survive a disk round trip',()=>{
    const {Game}=loadGame();Game.wave=2;Game.completeWave();const current=Game.profile.checkpoint;
    const old={...current,version:1,coins:1000,levels:{weaponPower:3,spread:2,sideGuns:0,missiles:2,fireRate:4,speed:2,shieldGen:3,magnet:0}};
    const migrated=validateCheckpoint(old);assert.ok(migrated);assert.equal(migrated.version,5);assert.equal(migrated.coins,450);assert.equal(migrated.levels.spread,4);assert.equal(migrated.levels.megaCannon,0);assert.equal(migrated.levels.missilePower,migrated.levels.weaponPower);
    const saved={...current,levels:{...createLevels(),megaCannon:3,cluster:3,clusterRight:2,turret:2,turretRight:3,turretFront:1,spread:1,sideGuns:1,missiles:1,missilePower:6},clusterAmmo:2,clusterRightAmmo:1};assert.deepEqual(validateCheckpoint(JSON.parse(JSON.stringify(saved))),saved);
    assert.equal(validateCheckpoint({...saved,clusterRightAmmo:4}),null);
    assert.equal(validateCheckpoint({...saved,levels:{...saved.levels,megaCannon:4}}),null);
    const previous=JSON.parse(JSON.stringify(current));previous.version=2;previous.levels.megaCannon=12;previous.levels.sideGuns=20;previous.levels.turret=12;previous.levels.weaponPower=7;previous.levels.missiles=20;previous.levels.cluster=12;
    delete previous.levels.turretRight;delete previous.levels.turretFront;delete previous.levels.clusterRight;delete previous.levels.missilePower;delete previous.clusterRightAmmo;
    const restored=validateCheckpoint(previous);assert.ok(restored);assert.equal(restored.version,5);assert.equal(restored.levels.clusterRight,0);assert.equal(restored.clusterRightAmmo,0);assert.equal(restored.levels.missilePower,7);assert.equal(restored.levels.missiles,3);assert.equal(restored.levels.cluster,3);
    assert.equal(restored.levels.megaCannon,3);assert.equal(restored.levels.sideGuns,3);assert.equal(restored.levels.turret,3);assert.equal(restored.levels.turretRight,0);assert.equal(restored.levels.turretFront,0);assert.equal(restored.coins,current.coins);
    assert.equal(validateCheckpoint({...previous,levels:{...previous.levels,megaCannon:13}}),null);
    const previousThree={...saved,version:3,levels:{...saved.levels,weaponPower:11,missiles:20,cluster:12,clusterRight:8}};delete previousThree.levels.missilePower;
    const converted=validateCheckpoint(previousThree);assert.ok(converted);assert.equal(converted.levels.missilePower,11);assert.equal(converted.levels.clusterRight,3);assert.equal(converted.clusterRightAmmo,1);assert.equal(converted.levels.turretRight,3);
    for(const key of ['missiles','cluster','clusterRight'])assert.equal(validateCheckpoint({...saved,levels:{...saved.levels,[key]:4}}),null);
    assert.ok(getUpgradeCost('weaponPower',{...createLevels(),weaponPower:1})-getUpgradeCost('weaponPower',createLevels())<15);
});
