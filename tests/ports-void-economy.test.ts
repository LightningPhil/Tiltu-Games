import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGame} from './ports-void-harness.ts';
import {MODULE_KEYS,getUpgradeCost,getRepairCost,getSalvageValue,GAME_CONFIG} from '../src/arcade-ports/void/balance.ts';

test('graphics quality, background stars and extra rendered frames do not change loot or enemy randomness',()=>{
    const snapshots=[];
    for(const mode of ['full','touch','reduced']){
        const {Game,Enemy,LootCrate}=loadGame(125);Game.touchMode=mode==='touch';Game.profile.settings.reducedMotion=mode==='reduced';
        Game.createStars();
        for(let i=0;i<6;i++){
            const enemy=new Enemy('BASIC',1);Game.enemies.push(enemy);enemy.takeDamage(1e6);
            if(mode==='full'){Game.shakeScreen(7);for(let j=0;j<8;j++)Game.draw();}
        }
        const drops=Game.drops.map(d=>[d.x,d.y,d.value,d.vx,d.vy]);
        const crates=Array.from({length:12},()=>{const c=new LootCrate();return[c.x,c.lootRoll];});
        snapshots.push(JSON.stringify({drops,crates}));
    }
    assert.equal(snapshots[0],snapshots[1]);assert.equal(snapshots[0],snapshots[2]);
});

test('selling and rebuying to obtain cheaper repairs always costs more than simply repairing',()=>{
    for(const key of MODULE_KEYS)for(let rank=1;rank<=GAME_CONFIG.UPGRADES[key].max;rank++){
        const {Game,buyUpgrade,buyRepair,salvageModule}=loadGame();Game.wave=2;Game.shopPhase='beacon';Game.coins=1e7;Game.openShop();
        for(let i=0;i<rank;i++)buyUpgrade(key);
        const levels={...Game.levels};Game.player.hull=1;
        const direct=getRepairCost(levels,1,80),wallet=Game.coins;
        salvageModule(key);buyRepair();for(let i=0;i<rank;i++)buyUpgrade(key);
        assert.ok(Game.coins<wallet-direct,`${key} rank ${rank} cannot profit from repair arbitrage`);
        assert.deepEqual(Game.levels,levels);
        assert.ok(getSalvageValue(key,levels)<Array.from({length:rank},(_,i)=>getUpgradeCost(key,{...levels,[key]:i})).reduce((a,b)=>a+b,0));
    }
});
