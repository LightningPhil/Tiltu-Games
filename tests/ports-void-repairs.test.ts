import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGame} from './ports-void-harness.ts';
import {GAME_CONFIG,SHIPS,createLevels,getUpgradeCost,getUpgradeScrapValue,getSalvageValue,getShipValue,getRepairCost} from '../src/arcade-ports/void/balance.ts';
import {validateCheckpoint} from '../src/arcade-ports/void/progress.ts';

test('ship value includes the base hull and every installed upgrade at its scrap value',()=>{
    const levels=createLevels();assert.equal(getShipValue(levels),2000);
    for(const key of Object.keys(levels)){
        const before=getShipValue(levels);let paid=0;
        for(let rank=0;rank<GAME_CONFIG.UPGRADES[key].max;rank++){
            paid+=getUpgradeCost(key,levels);levels[key]++;
            assert.equal(getUpgradeScrapValue(key,levels),Math.floor(paid*.6));
            assert.equal(getShipValue(levels),before+Math.floor(paid*.6));
        }
    }
    assert.equal(getSalvageValue('weaponPower',levels),0); // Systems have value but remain installed.
    for(const ship of Object.values(SHIPS)){
        assert.equal(getRepairCost(createLevels(),ship.hull/2,ship.hull),100);
        assert.equal(getRepairCost(createLevels(),ship.hull,ship.hull),0);
        assert.equal(getRepairCost(createLevels(),0,ship.hull),200);
    }
});

test('paid repairs quote the current build, require enough credits, restore all hull once and persist the expense',()=>{
    const {Game,buyRepair,buyUpgrade,salvageModule,elements}=loadGame();const p=Game.player;
    p.hull=40;p.regenShield=7;p.tempShield=4;p.hullWarned=true;Game.coins=1000;
    buyRepair();assert.equal(p.hull,40);assert.equal(Game.coins,1000);
    Game.wave=2;Game.shopPhase='beacon';Game.openShop();
    assert.equal(elements.get('shop-ship-value').innerText,'2,000');
    assert.equal(elements.get('repair-btn').innerText,'REPAIR · 100 CR');
    assert.equal(elements.get('repair-detail').innerText,'50% HULL MISSING');
    Game.coins=99;Game.openShop();assert.equal(elements.get('repair-btn').disabled,true);
    buyRepair();assert.equal(p.hull,40);assert.equal(Game.coins,99);
    Game.coins=100;Game.openShop();assert.equal(elements.get('repair-btn').disabled,false);buyRepair();
    assert.equal(p.hull,80);assert.equal(Game.coins,0);assert.equal(Game.stats.spent,100);
    assert.equal(p.regenShield,7);assert.equal(p.tempShield,4);assert.equal(p.hullWarned,false);
    assert.equal(elements.get('repair-btn').innerText,'HULL FULL');assert.equal(elements.get('repair-btn').disabled,true);
    buyRepair();assert.equal(Game.stats.spent,100);
    assert.equal(Game.profile.checkpoint.coins,0);assert.equal(Game.profile.checkpoint.hull,80);assert.equal(Game.profile.checkpoint.stats.spent,100);
    Game.coins=10000;p.hull=53.5;buyUpgrade('megaCannon');buyUpgrade('weaponPower');
    assert.equal(getShipValue(Game.levels),2000+285+48);
    assert.equal(getRepairCost(Game.levels,p.hull,p.maxHull),78);
    assert.equal(elements.get('repair-btn').innerText,'REPAIR · 78 CR');
    salvageModule('megaCannon');assert.equal(getShipValue(Game.levels),2048);
    assert.equal(elements.get('shop-ship-value').innerText,'2,048');
    assert.equal(elements.get('repair-btn').innerText,'REPAIR · 68 CR');
    Game.toHangar();assert.equal(Game.resumeRun(),true);assert.equal(getShipValue(Game.levels),2048);
    assert.equal(Game.player.hull,53.5);assert.equal(elements.get('repair-btn').innerText,'REPAIR · 68 CR');
});

test('older saves discard repair currency and preserve the rest of the expedition',()=>{
    const {Game}=loadGame();Game.wave=2;Game.completeWave();const current=Game.profile.checkpoint;
    assert.equal(current.version,5);assert.equal('cogs' in current,false);
    const migrated=validateCheckpoint({...current,version:4,cogs:23});
    assert.deepEqual(migrated,current);assert.equal('cogs' in migrated,false);
    assert.equal('cogs' in Game,false);
});

test('enemy bullets and guided missiles deal 50% extra damage without increasing collisions or friendly weapons',()=>{
    const {Game,Enemy,Bullet,Missile}=loadGame();const p=Game.player;
    const enemy=new Enemy('BASIC',1);enemy.entryDelay=0;enemy.x=p.x;enemy.y=100;Game.enemies=[enemy];
    enemy.fireWeapon();assert.equal(Game.bullets[0].damage,8*1.125*1.5);
    const bullet=new Bullet(p.x,p.y,0,0,enemy.damage,'enemy');
    p.regenShield=0;Game.bullets=[bullet];Game.handleCollisions();assert.equal(p.hull,80-13.5);
    p.hitGrace=0;Game.bullets=[];Game.missiles=[new Missile(p.x,p.y,p,enemy.damage,'enemy')];
    Game.handleCollisions();assert.equal(p.hull,80-27);
    p.hitGrace=0;Game.missiles=[];enemy.x=p.x;enemy.y=p.y;Game.handleCollisions();
    assert.equal(p.hull,80-27-22*1.125);
    assert.equal(new Bullet(0,0,0,-1,24,'player').damage,24);
    assert.equal(new Missile(0,0,enemy,24,'player').damage,24);
});
