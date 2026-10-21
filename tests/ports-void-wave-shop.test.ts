import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGame} from './ports-void-harness.ts';
import {STEP_MS,WAVE_DURATION_MS,COIN_VALUE,getWaveProfile,getSalvageValue} from '../src/arcade-ports/void/balance.ts';

test('the last enemies retreat offscreen, and coins, bonuses and crates remain collectible before docking',()=>{
    const {Game,Enemy,Coin,Powerup,LootCrate,elements}=loadGame();Game.wave=2;Game.shopTimer=WAVE_DURATION_MS-STEP_MS;
    const enemy=new Enemy('BASIC',2);enemy.x=100;enemy.y=770;enemy.entryDelay=0;enemy.fireTimer=100000;
    const coin=new Coin(300,450,100),bonus=new Powerup(450,440,{type:'overshield',color:'#fff',label:'OVERSHIELD'}),crate=new LootCrate();crate.x=750;crate.y=300;
    Game.enemies=[enemy];Game.drops=[coin,bonus];Game.crates=[crate];
    Game.update(STEP_MS);assert.equal(Game.shopPhase,'clearing');assert.equal(enemy.active,true);
    assert.ok(enemy.retreatSpeed>enemy.speedY&&enemy.retreatSpeed<4);
    for(let i=0;i<80&&Game.shopPhase!=='beacon';i++)Game.update(STEP_MS);
    assert.equal(Game.shopPhase,'beacon');assert.equal(Game.paused,false);assert.ok(Game.enemies.every(e=>!e.active));
    assert.ok(Game.drops.includes(coin)&&coin.active);assert.ok(Game.drops.includes(bonus)&&bonus.active);assert.ok(Game.crates.includes(crate)&&crate.active);
    assert.ok(coin.y>450&&bonus.y>440&&crate.y>300);assert.equal(Game.coins,getWaveProfile(2).reward);
    Game.player.x=coin.x;Game.player.y=coin.y;Game.handleCollisions();
    const earned=Math.max(1,Math.round(100*COIN_VALUE));assert.equal(Game.coins,getWaveProfile(2).reward+earned);
    Game.player.x=bonus.x;Game.player.y=bonus.y;Game.handleCollisions();assert.ok(Game.player.tempShield>0);
    // A pickup under the dock is collected before the shop pauses or saves.
    const last=new Coin(Game.beacon.x,Game.beacon.y,100);Game.drops.push(last);Game.player.x=last.x;Game.player.y=last.y;
    Game.handleCollisions();assert.equal(last.active,false);assert.equal(Game.paused,false);Game.openShop();assert.equal(Game.paused,true);assert.equal(elements.get('shop-screen').style.display,'flex');
    assert.equal(Game.profile.checkpoint.coins,Game.coins);assert.equal(Game.profile.checkpoint.tempShield,Game.player.tempShield);
});

test('uncollected objects drift away or carry into the next wave without an automatic payout',()=>{
    const {Game,Coin,Powerup,LootCrate,Bullet,Missile,closeShop}=loadGame();Game.wave=2;
    const coin=new Coin(100,300,100),bonus=new Powerup(200,300),crate=new LootCrate();crate.x=300;crate.y=300;
    const bullet=new Bullet(200,200,0,3,10,'enemy'),missile=new Missile(900,300,null,10,'player');
    Game.drops=[coin,bonus];Game.crates=[crate];Game.bullets=[bullet];Game.missiles=[missile];Game.completeWave();
    const reward=Game.coins;Game.completeWave();assert.equal(Game.coins,reward);
    Game.openShop();closeShop();assert.equal(Game.wave,3);
    assert.ok(Game.drops.includes(coin)&&Game.drops.includes(bonus)&&Game.crates.includes(crate));assert.ok(Game.bullets.includes(bullet)&&Game.missiles.includes(missile));
    missile.update();assert.equal(missile.active,true);assert.ok(missile.y<300);
    coin.y=819;bonus.y=820;crate.y=849;coin.update();bonus.update();crate.update();
    assert.equal(coin.active,false);assert.equal(bonus.active,false);assert.equal(crate.active,false);assert.equal(Game.coins,reward);
});

test('scrapping asks first, cancellation preserves every credit and confirmation removes the quoted item once',()=>{
    const {Game,buyUpgrade,requestSalvage,cancelSalvage,confirmSalvage,closeShop,elements}=loadGame();Game.wave=2;Game.shopPhase='beacon';Game.coins=10000;Game.openShop();
    buyUpgrade('cluster');buyUpgrade('cluster');const coins=Game.coins,refund=getSalvageValue('cluster',Game.levels),checkpoint=JSON.stringify(Game.profile.checkpoint);
    requestSalvage('cluster');assert.equal(Game.coins,coins);assert.equal(Game.levels.cluster,2);assert.equal(Game.player.clusterAmmo,3);
    assert.equal(elements.get('salvage-dialog').open,true);assert.equal(Game.salvagePending.key,'cluster');assert.match(elements.get('salvage-rank').innerText,/ALL 2 RANKS/);
    assert.equal(elements.get('salvage-refund').innerText,`${refund.toLocaleString()} CR`);
    requestSalvage('clusterRight');buyUpgrade('spread');closeShop();assert.equal(Game.levels.spread,0);assert.equal(Game.wave,2);assert.equal(Game.coins,coins);
    cancelSalvage();confirmSalvage();assert.equal(elements.get('salvage-dialog').open,false);assert.equal(Game.levels.cluster,2);assert.equal(Game.coins,coins);assert.equal(JSON.stringify(Game.profile.checkpoint),checkpoint);
    requestSalvage('cluster');confirmSalvage();confirmSalvage();assert.equal(Game.coins,coins+refund);assert.equal(Game.levels.cluster,0);assert.equal(Game.player.clusterAmmo,0);assert.equal(Game.salvagePending,null);
    assert.equal(Game.profile.checkpoint.coins,Game.coins);assert.equal(Game.profile.checkpoint.levels.cluster,0);
    // An accidental click can buy again, but can never scrap the new item without another confirmation.
    buyUpgrade('cluster');const afterRebuy=Game.coins;requestSalvage('cluster');assert.equal(Game.coins,afterRebuy);assert.equal(Game.levels.cluster,1);cancelSalvage();
});

test('a stale scrap quote or leaving the shop cannot sell a different rank later',()=>{
    const {Game,buyUpgrade,requestSalvage,confirmSalvage,elements}=loadGame();Game.wave=2;Game.shopPhase='beacon';Game.coins=10000;Game.openShop();buyUpgrade('megaCannon');
    const coins=Game.coins;requestSalvage('megaCannon');Game.levels.megaCannon=2;confirmSalvage();assert.equal(Game.coins,coins);assert.equal(Game.levels.megaCannon,2);
    requestSalvage('megaCannon');Game.toHangar();assert.equal(Game.salvagePending,null);assert.equal(elements.get('salvage-dialog').open,false);confirmSalvage();assert.equal(Game.coins,coins);
    Game.start();requestSalvage('megaCannon');assert.equal(Game.salvagePending,null);
});

test('cancelling a scrap after rotating into a phone layout rebuilds the paged shop without spending credits',()=>{
    const {Game,window,buyUpgrade,requestSalvage,cancelSalvage,elements}=loadGame();Game.wave=2;Game.shopPhase='beacon';Game.coins=10000;Game.openShop();buyUpgrade('megaCannon');
    const coins=Game.coins;requestSalvage('megaCannon');window.innerWidth=390;window.innerHeight=844;Game.resize();
    assert.equal(Game.salvagePending.key,'megaCannon');cancelSalvage();assert.equal(Game.coins,coins);assert.equal(Game.levels.megaCannon,1);
    assert.equal(elements.get('shop-page-label').innerText,'1 / 3');assert.equal(elements.get('shop-pagination').hidden,false);
});
