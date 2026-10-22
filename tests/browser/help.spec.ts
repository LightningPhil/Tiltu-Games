import {test as base,expect,type Page,type Locator} from '@playwright/test';
import {GAMES,freshState} from '../../src/state.ts';
import {GAME_CATEGORY} from '../../src/catalog.ts';
import {GAME_HELP} from '../../src/game-help.ts';
import {openFromHome,switchGame} from './navigation.ts';

const test=base.extend<{runtimeChecks:void}>({runtimeChecks:[async({page},use)=>{const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await use();expect(errors).toEqual([]);},{auto:true}]});
test.use({hasTouch:true,actionTimeout:15_000});
const headings=['Introduction','Getting started','Tips','Full rules'];
async function reachable(page:Page,el:Locator){
 await expect.poll(()=>el.evaluate(node=>{const r=node.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>0&&r.height>=43&&r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&(hit===node||node.contains(hit));})).toBe(true);
}
for(const viewport of [{width:320,height:640},{width:844,height:390},{width:1280,height:800}])test(`all 54 complete help pages are reachable at ${viewport.width} × ${viewport.height}`,async({page})=>{
 test.setTimeout(240_000);await page.setViewportSize(viewport);await page.goto('./');await openFromHome(page,'four');
 for(const game of GAMES.filter(g=>g!=='home')){
  await switchGame(page,game);await expect(page.locator('#app')).toHaveAttribute('data-game',game,{timeout:30_000});await expect(page.locator('.game-library-dialog')).toHaveCount(0);
  await reachable(page,page.getByRole('button',{name:'Switch game',exact:true}));await reachable(page,page.getByRole('button',{name:'Game help',exact:true}));
  await page.getByRole('button',{name:'Game help',exact:true}).tap();const dialog=page.locator('.game-help-dialog'),guide=dialog.locator('.game-help');
  await expect(dialog).toBeVisible();await expect(guide).toHaveAttribute('data-help-game',game);await expect(guide.locator('h2')).toHaveText(headings);
  await expect(guide.locator('[data-help-section="0"]')).toContainText(GAME_HELP[game].introduction);
  for(const section of headings)await reachable(page,guide.getByRole('button',{name:section,exact:true}));
  await guide.getByRole('button',{name:'Full rules',exact:true}).tap();await expect(guide.getByRole('heading',{name:'Full rules',exact:true})).toBeFocused();
  const position=await guide.getByRole('heading',{name:'Full rules',exact:true}).boundingBox();const contents=await guide.locator('.help-contents').boundingBox();expect(position!.y).toBeGreaterThanOrEqual(contents!.y+contents!.height-1);
  await guide.locator('section').last().locator('p').last().scrollIntoViewIfNeeded();await reachable(page,dialog.locator('[data-help-close]'));
  await guide.getByRole('button',{name:'Introduction',exact:true}).tap();await expect(guide.getByRole('heading',{name:'Introduction',exact:true})).toBeFocused();
  await dialog.locator('[data-help-close]').tap();await expect(dialog).toHaveCount(0);await expect(page.getByRole('button',{name:'Game help',exact:true})).toBeFocused();
  if(viewport.width===320&&GAME_CATEGORY[game]!=='Arcade & worlds'){
   const tab=page.getByRole('tab',{name:'Help',exact:true});await tab.tap();await expect(page.locator('#game-workspace .game-help h2')).toHaveText(headings);await expect(page.locator('#game-workspace .game-help')).toContainText(GAME_HELP[game].introduction);await page.getByRole('tab',{name:'Play',exact:true}).tap();
  }
 }
});
test('help shortcuts and Escape preserve a played board and restore keyboard focus',async({page})=>{
 const state=freshState();state.preferences.four.mode='local';state.four.options.mode='local';await page.addInitScript(s=>localStorage.setItem('grid-club-v1',JSON.stringify(s)),state);
 await page.setViewportSize({width:390,height:844});await page.goto('./');await openFromHome(page,'four');
 await page.locator('[data-column="3"]').click();const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('grid-club-v1')!).four);
 await page.getByRole('button',{name:'Game help',exact:true}).click();await page.locator('.game-help-dialog [data-help-jump="3"]').click();await page.keyboard.press('ArrowDown');await page.keyboard.press('1');await page.keyboard.press('Space');
 await expect(page.locator('.game-help-dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Game help',exact:true})).toBeFocused();
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('grid-club-v1')!).four);expect(after).toEqual(before);
});
test('TetriGrid existing How to play opens the shared help and pauses play',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('./');await openFromHome(page,'blocks');await page.locator('[data-action-arcade="help"]').click();await expect(page.locator('.game-help-dialog h2')).toContainText(['TetriGrid · Help',...headings]);await page.keyboard.press('Escape');await expect(page.locator('[data-action-arcade="help"]')).toBeFocused();await expect(page.locator('[data-action-arcade="pause"]').first()).toContainText('Resume');
});
test('Ski setup uses the same complete guide',async({page})=>{
 await page.setViewportSize({width:320,height:640});await page.goto('./');await openFromHome(page,'ski');await page.locator('.ski-settings summary').click();await page.getByRole('tab',{name:'How to play',exact:true}).click();await expect(page.locator('#ski-setup-panels .game-help h2')).toHaveText(headings);
});
test('Life, Whack-a-Party and Horizon retain full help in their existing guide tabs',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('./');await openFromHome(page,'life');
 for(const [game,tab] of [['life','Help'],['whacker','Help'],['horizon','Guide']]){
  if(game!=='life'){await switchGame(page,game);await expect(page.locator('#app')).toHaveAttribute('data-game',game,{timeout:30_000});}
  await page.getByRole('tab',{name:tab,exact:true}).click();await expect(page.locator(`.game-help[data-help-game="${game}"] h2`)).toHaveText(headings);
 }
});
