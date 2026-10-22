import {test as base,expect} from '@playwright/test';

const test=base.extend<{runtimeChecks:void}>({runtimeChecks:[async({page},use)=>{const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await use();expect(errors).toEqual([]);},{auto:true}]});
test.use({hasTouch:true,actionTimeout:15_000});

for(const scenario of [
 {mode:'mission',view:'cockpit',viewport:{width:1280,height:800},reduced:false},
 {mode:'cruise',view:'chase',viewport:{width:390,height:844},reduced:false},
 {mode:'practice',view:'clear',viewport:{width:844,height:390},reduced:true},
])test(`Horizon ${scenario.mode} crashes on its first impact and shows an animated explosion`,async({page},info)=>{
 await page.setViewportSize(scenario.viewport);await page.goto('./?game=horizon');
 await page.locator('#mode').selectOption(scenario.mode);
 await page.getByRole('tab',{name:'Controls',exact:true}).click();await page.locator('#controls').selectOption('keyboard');
 await page.getByRole('tab',{name:'Look',exact:true}).click();await page.locator('#quality').selectOption('performance');await page.locator('#view').selectOption(scenario.view);await page.locator('#reduced-motion').setChecked(scenario.reduced);
 await page.getByRole('tab',{name:'Sound',exact:true}).first().click();await page.locator('#sound').uncheck();
 await page.getByRole('tab',{name:'Fly',exact:true}).click();await page.locator('#start').click();
 await expect(page.locator('#hud-shield')).toHaveText('100%');
 // Dive into the real ground collision geometry; do not inject a game-over state.
 await page.keyboard.down('ArrowDown');await expect(page.locator('#crash-animation')).toBeVisible({timeout:12_000});await page.keyboard.up('ArrowDown');
 await expect(page.locator('#crash-cause')).toHaveText(/GROUND IMPACT|BUILDING IMPACT/);await expect(page.locator('#crash-screen')).toBeHidden();await expect(page.locator('#ui-layer')).toBeHidden();
 const startImage=info.outputPath('explosion-start.png'),motionImage=info.outputPath('explosion-in-motion.png');
 const first=await page.locator('#flight-view').screenshot({path:startImage});await info.attach('explosion-start',{path:startImage,contentType:'image/png'});
 await page.waitForTimeout(180);const later=await page.locator('#flight-view').screenshot({path:motionImage});await info.attach('explosion-in-motion',{path:motionImage,contentType:'image/png'});expect(later.equals(first),'the explosion animates before the results cover it').toBe(false);
 await expect(page.locator('#crash-screen')).toBeVisible({timeout:8_000});await expect(page.locator('#result-title')).toHaveText('SHIP DESTROYED');await expect(page.locator('#result-bonus')).toContainText('One collision');await expect(page.locator('#crash-animation')).toBeHidden();
 await page.locator('#retry').click();await expect(page.locator('#ui-layer')).toBeVisible();await expect(page.locator('#hud-shield')).toHaveText('100%');await expect(page.locator('#crash-animation')).toBeHidden();await expect(page.locator('#crash-screen')).toBeHidden();
 if(await page.locator('#touch-pulse').isVisible())expect(await page.locator('#touch-pulse').evaluate(node=>{const r=node.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===node;})).toBe(true);
 await page.locator('#pause-button').click();await expect(page.locator('#pause-screen')).toBeVisible();
});
