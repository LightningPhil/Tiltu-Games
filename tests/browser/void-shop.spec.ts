import {test as base,expect,type Page,type Locator} from '@playwright/test';
import {createProfile,createRunStats} from '../../src/arcade-ports/void/progress.ts';
import {createLevels,GAME_CONFIG,MODULE_KEYS,ORDNANCE_KEYS,getRepairCost,getSalvageValue,getUpgradeCost} from '../../src/arcade-ports/void/balance.ts';

const test=base.extend<{runtimeChecks:void}>({runtimeChecks:[async({page},use)=>{const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await use();expect(errors).toEqual([]);},{auto:true}]});
test.use({hasTouch:true,actionTimeout:15_000});
const profileKey='neon_void_drifter_profile_v1';
async function dock(page:Page,coins=10000){
 const p=createProfile();p.settings.muted=true;
 p.checkpoint={version:5,wave:2,difficulty:'arcade',shipId:'vanguard',endless:false,levels:{...createLevels(),sideGuns:1},hull:40,shield:25,tempShield:0,coins,elapsed:80000,pulseCharge:100,clusterAmmo:0,clusterRightAmmo:0,stats:createRunStats(),banked:{kills:0,dashes:0,pulses:0},buffs:{}};
 await page.addInitScript(({profile,key})=>{if(sessionStorage.getItem('shop-fixture'))return;sessionStorage.setItem('shop-fixture','1');const state=JSON.parse(localStorage.getItem('grid-club-v1')||'{}');state.version=1;state.actionArcade??={};state.actionArcade.void={data:{[key]:JSON.stringify(profile)},elapsed:0};localStorage.setItem('grid-club-v1',JSON.stringify(state));},{profile:p,key:profileKey});
 await page.goto('./?game=void');await page.locator('#resume-run-btn').tap();await expect(page.locator('#shop-screen')).toBeVisible();
}
const checkpoint=(page:Page)=>page.evaluate(key=>JSON.parse(JSON.parse(localStorage.getItem('grid-club-v1')!).actionArcade.void.data[key]).checkpoint,profileKey);
async function onScreen(page:Page,el:Locator){const r=(await el.boundingBox())!;expect(r).toBeTruthy();expect(r.height).toBeGreaterThanOrEqual(43);expect(r.x).toBeGreaterThanOrEqual(0);expect(r.y).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(page.viewportSize()!.width+1);expect(r.y+r.height).toBeLessThanOrEqual(page.viewportSize()!.height+1);}
async function reachable(page:Page,el:Locator){await onScreen(page,el);expect(await el.evaluate(node=>{const r=node.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===node||node.contains(hit);}),'control is not covered by another element').toBe(true);}

for(const viewport of [{width:320,height:640},{width:390,height:844},{width:667,height:375},{width:844,height:390},{width:1280,height:800}])test(`Neon Void dock keeps every purchase and repair reachable at ${viewport.width} × ${viewport.height}`,async({page})=>{
 test.setTimeout(120_000);await page.setViewportSize(viewport);await dock(page);
 expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(viewport.height+1);
 await page.locator('[data-info="spread"]').tap();const briefing=(await page.locator('#equipment-dialog').boundingBox())!;expect((await page.locator('#equipment-name').boundingBox())!.y).toBeGreaterThanOrEqual(briefing.y);await reachable(page,page.locator('#equipment-close'));await page.locator('#equipment-close').tap();
 await page.locator('[data-salvage="sideGuns"]').tap();const confirmation=(await page.locator('#salvage-dialog').boundingBox())!;expect((await page.locator('#salvage-name').boundingBox())!.y).toBeGreaterThanOrEqual(confirmation.y);await reachable(page,page.locator('#salvage-cancel'));await reachable(page,page.locator('#salvage-confirm'));await page.locator('#salvage-cancel').tap();
 const expected={weapons:MODULE_KEYS.filter(k=>!ORDNANCE_KEYS.includes(k)),ordnance:[...ORDNANCE_KEYS],systems:Object.keys(GAME_CONFIG.UPGRADES).filter(k=>!MODULE_KEYS.includes(k as typeof MODULE_KEYS[number]))};
 for(const [tab,keys]of Object.entries(expected)){
  await page.locator(`[data-shop-tab="${tab}"]`).tap();const seen:string[]=[];
  for(let i=0;i<10;i++){
   for(const item of await page.locator('#shop-grid .shop-item').all()){
    seen.push((await item.getAttribute('data-upgrade'))!);
    for(const button of await item.locator('button').all()){await button.scrollIntoViewIfNeeded();await reachable(page,button);}
   }
   if(!await page.locator('#shop-pagination').isVisible())break;
   await reachable(page,page.locator('#shop-prev'));await reachable(page,page.locator('#shop-next'));
   const next=page.locator('#shop-next');if(await next.isDisabled())break;await next.tap();
  }
  expect(new Set(seen)).toEqual(new Set(keys));expect(seen.length).toBe(keys.length);
 }
 const before=await checkpoint(page);if(await page.locator('[data-shop-tab="ship"]').isVisible())await page.locator('[data-shop-tab="ship"]').tap();await expect(page.locator('#shop-pagination')).toBeHidden();await expect(page.locator('#ship-loadout')).toBeVisible();await reachable(page,page.locator('#repair-btn'));await page.locator('#repair-btn').tap();
 const after=await checkpoint(page);expect(after.hull).toBe(80);expect(after.coins).toBe(before.coins-getRepairCost(before.levels,40,80));await expect(page.locator('#repair-btn')).toBeDisabled();
 await reachable(page,page.locator('.shop-launch'));await page.locator('.shop-launch').tap();await expect(page.locator('#shop-screen')).toBeHidden();await expect(page.locator('#hud-wave')).toContainText('3/30');
});

test('dock touch purchases, equipment details, salvage confirmation and repairs survive reload',async({page})=>{
 await page.setViewportSize({width:390,height:844});await dock(page);
 const before=await checkpoint(page);await page.locator('[data-info="spread"]').tap();await expect(page.locator('#equipment-dialog')).toBeVisible();await expect(page.locator('#equipment-description')).not.toBeEmpty();await page.locator('#equipment-close').tap();
 await page.locator('[data-buy="spread"]').tap();let s=await checkpoint(page);expect(s.levels.spread).toBe(1);expect(s.coins).toBe(before.coins-getUpgradeCost('spread',before.levels));await expect(page.locator('.loadout-fittings .installed').filter({hasText:'MULTISHOT'})).toContainText('R1');
 await page.locator('[data-salvage="sideGuns"]').tap();await expect(page.locator('#salvage-dialog')).toBeVisible();await reachable(page,page.locator('#salvage-cancel'));await page.locator('#salvage-cancel').tap();expect((await checkpoint(page)).coins).toBe(s.coins);
 await page.locator('[data-salvage="sideGuns"]').tap();await reachable(page,page.locator('#salvage-confirm'));await page.locator('#salvage-confirm').tap();const sold=await checkpoint(page);expect(sold.levels.sideGuns).toBe(0);expect(sold.coins).toBe(s.coins+getSalvageValue('sideGuns',s.levels));
 await page.reload();await page.locator('#resume-run-btn').tap();s=await checkpoint(page);expect(s.levels.spread).toBe(1);expect(s.levels.sideGuns).toBe(0);expect(s.coins).toBe(sold.coins);
 await page.locator('[data-shop-tab="ship"]').tap();await page.locator('#repair-btn').tap();await page.locator('.shop-footer .text-button').tap();await expect(page.locator('#start-screen')).toBeVisible();await page.locator('#resume-run-btn').tap();expect((await checkpoint(page)).hull).toBe(80);
});

test('rotating a docked phone preserves its page and unaffordable purchases stay disabled',async({page})=>{
 await page.setViewportSize({width:390,height:844});await dock(page,0);await page.locator('#shop-next').tap();const keys=await page.locator('.shop-item').evaluateAll(items=>items.map(e=>(e as HTMLElement).dataset.upgrade));
 await page.setViewportSize({width:844,height:390});await expect.poll(()=>page.locator('.shop-item').evaluateAll(items=>items.map(e=>(e as HTMLElement).dataset.upgrade))).toEqual(keys);
 for(const buy of await page.locator('[data-buy]').all()){await expect(buy).toBeDisabled();await reachable(page,buy);}
 expect((await checkpoint(page)).coins).toBe(0);await page.locator('[data-shop-tab="ship"]').tap();await expect(page.locator('#repair-btn')).toBeDisabled();
 await page.setViewportSize({width:1280,height:800});await expect(page.locator('#shop-loadout-tab')).toBeHidden();await expect(page.locator('.shop-item').first()).toBeVisible();await expect(page.locator('#ship-loadout')).toBeVisible();
});
