import {test as base,expect} from '@playwright/test';
import {openFromHome} from './navigation.ts';
const test=base.extend<{runtimeChecks:void}>({runtimeChecks:[async({page},use)=>{const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await use();expect(errors).toEqual([]);},{auto:true}]});
test.use({hasTouch:true,actionTimeout:15_000});
const games=[{id:'salvage',stick:'[data-patrol-stick]',fire:'.thumb-fire',aux:'[data-action-hold="boost"]',pause:'[data-action-arcade="pause"]'}, {id:'void',stick:'#void-stick',fire:'#fire-btn',aux:'#dash-btn',pause:'[title="Pause and settings"]'}, {id:'horizon',stick:'#touch-stick',fire:'#touch-fire',aux:'#touch-boost',pause:'#pause-button'}];
for(const size of [{width:320,height:740},{width:390,height:844},{width:844,height:390}])for(const game of games)test(game.id+' two-thumb controls at '+size.width+'×'+size.height,async({page,context},info)=>{
 await page.setViewportSize(size);await page.goto('./'+(game.id==='salvage'?'':'?game='+game.id));
 if(game.id==='salvage'){await openFromHome(page,game.id);await page.locator('[data-action-arcade="play"]').click();}
 if(game.id==='void')await page.locator('#launch-btn').click();
 if(game.id==='horizon'){await page.getByRole('tab',{name:'Controls',exact:true}).click();await page.locator('#controls').selectOption('touch');await page.getByRole('tab',{name:'Look',exact:true}).click();await page.locator('#quality').selectOption('performance');await page.getByRole('tab',{name:'Fly',exact:true}).click();await page.locator('#cruise-button').click();}
 const stick=page.locator(game.stick),fire=page.locator(game.fire),aux=page.locator(game.aux);
 await expect(stick).toBeVisible();await expect(fire).toBeEnabled();
 const sr=(await stick.boundingBox())!,fr=(await fire.boundingBox())!,ar=(await aux.boundingBox())!;
 expect(fr.x+fr.width).toBeLessThanOrEqual(ar.x);expect(ar.x+ar.width).toBeLessThanOrEqual(sr.x);
 for(const control of [stick,fire,...await page.locator('.thumb-aux button:visible').all()]){const r=(await control.boundingBox())!;expect(r.width).toBeGreaterThanOrEqual(48);expect(r.height).toBeGreaterThanOrEqual(48);expect(r.x).toBeGreaterThanOrEqual(0);expect(r.x+r.width).toBeLessThanOrEqual(size.width);expect(r.y+r.height).toBeLessThanOrEqual(size.height);expect(await control.evaluate(el=>{const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return el===hit||el.contains(hit);})).toBe(true);}
 await page.screenshot({path:info.outputPath('flight-deck.png')});
 const cdp=await context.newCDPSession(page),trigger={id:1,x:fr.x+fr.width/2,y:fr.y+fr.height/2},thumb={id:2,x:sr.x+sr.width*.65,y:sr.y+sr.height*.5};
 // Fire first: the steering thumb is deliberately a non-primary pointer.
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[trigger]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[trigger,thumb]});
 await expect(stick).toHaveAttribute('data-stick-x','0.000');await expect(stick).toHaveAttribute('data-stick-y','0.000');await expect(fire).toHaveAttribute('aria-pressed','true');
 thumb.x+=sr.width*.32;await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[trigger,thumb]});await expect(stick).toHaveAttribute('data-stick-x','1.000');
 // A third finger can use an auxiliary action without stealing either held control.
 const action={id:3,x:ar.x+ar.width/2,y:ar.y+ar.height/2};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[trigger,thumb,action]});await expect(stick).toHaveClass(/held/);await expect(fire).toHaveAttribute('aria-pressed','true');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[trigger]});await expect(fire).toHaveAttribute('aria-pressed','false');await expect(stick).toHaveClass(/held/);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await expect(stick).not.toHaveClass(/held/);await expect(stick).toHaveAttribute('data-stick-x','0.000');
 // Pausing while steering remains held must neutralise input and visual feedback.
 const next=(await stick.boundingBox())!,newThumb={id:4,x:next.x+next.width/2,y:next.y+next.height/2};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[newThumb]});newThumb.x-=next.width*.32;await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[newThumb]});
 await page.locator(game.pause).click();await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await expect(page.locator(game.stick)).not.toHaveClass(/held/);await expect(page.locator(game.fire)).toHaveAttribute('aria-pressed','false');
 if(size.width===390){
  await page.locator(game.id==='salvage'?'[data-action-arcade="play"]':game.id==='void'?'.pause-resume':'#resume').click();
  const r=(await page.locator(game.stick).boundingBox())!,finger={id:8,x:r.x+r.width/2,y:r.y+r.height/2};
  const f=(await page.locator(game.fire).boundingBox())!,triggerAgain={id:9,x:f.x+f.width/2,y:f.y+f.height/2};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger,triggerAgain]});finger.x+=r.width*.32;await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[finger,triggerAgain]});await expect(page.locator(game.stick)).toHaveClass(/held/);await expect(page.locator(game.fire)).toHaveAttribute('aria-pressed','true');
  await page.setViewportSize({width:844,height:390});await expect(page.locator(game.stick)).not.toHaveClass(/held/);await expect(page.locator(game.fire)).toHaveAttribute('aria-pressed','false');await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 }
});
