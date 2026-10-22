import {test as base,expect,type Page} from '@playwright/test';
import {GAMES} from '../../src/state.ts';
import {GAME_NAMES} from '../../src/catalog.ts';
import {openFromHome,switchGame} from './navigation.ts';

const test=base.extend<{runtimeChecks:void}>({runtimeChecks:[async({page},use)=>{const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await use();expect(errors,'discovery runtime errors').toEqual([]);},{auto:true}]});
test.use({hasTouch:true,actionTimeout:15_000});
const home=async(page:Page)=>{await page.goto('./');await page.getByRole('button',{name:'Tiltu’s Games home',exact:true}).click();await expect(page.locator('#home-library')).toBeVisible();};
async function checkPages(page:Page,host:string){
 const library=page.locator(host),seen:string[]=[];
 for(let i=0;i<30;i++){
  await expect(library.locator('.game-card').first()).toBeVisible();
  const geometry=await library.evaluate(el=>({scroll:el.querySelector('.library-results')!.scrollHeight-el.querySelector('.library-results')!.clientHeight,tiles:[...el.querySelectorAll<HTMLElement>('.game-card')].map(tile=>({game:tile.dataset.game,r:tile.getBoundingClientRect().toJSON(),art:tile.querySelector('.game-art')?.getBoundingClientRect().toJSON(),drawing:tile.querySelector('.game-art>svg')?.childElementCount??0}))}));
  expect(geometry.scroll,'the game page needs no internal scrolling').toBeLessThanOrEqual(1);
  for(const tile of geometry.tiles){seen.push(tile.game!);expect(tile.r.height).toBeGreaterThanOrEqual(104);expect(tile.r.y).toBeGreaterThanOrEqual(0);expect(tile.r.bottom).toBeLessThanOrEqual(page.viewportSize()!.height+1);expect(tile.r.right).toBeLessThanOrEqual(page.viewportSize()!.width+1);expect(tile.drawing,`${tile.game}: original illustration`).toBeGreaterThan(0);expect(tile.art,`${tile.game}: artwork frame`).toBeDefined();expect(tile.art!.width).toBeGreaterThanOrEqual(90);expect(tile.art!.height).toBeGreaterThanOrEqual(60);expect(tile.art!.y).toBeGreaterThanOrEqual(tile.r.y);expect(tile.art!.bottom).toBeLessThanOrEqual(tile.r.bottom);}
  const next=library.getByRole('button',{name:'Next games',exact:true});if(await next.isDisabled())break;await next.tap();
 }
 expect(seen.length).toBe(54);expect(new Set(seen).size).toBe(54);expect(new Set(seen)).toEqual(new Set(GAMES.filter(game=>game!=='home')));
 await library.locator('[data-library-page]').selectOption('0');await expect(library.getByRole('button',{name:'Previous games',exact:true})).toBeDisabled();
}

for(const viewport of [{width:320,height:640},{width:390,height:844},{width:844,height:390},{width:1280,height:800}])test(`all 54 games are reachable without scrolling at ${viewport.width} × ${viewport.height}`,async({page})=>{
 test.setTimeout(120_000);await page.setViewportSize(viewport);await home(page);
 expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(viewport.height+1);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width+1);
 await checkPages(page,'#home-library');await openFromHome(page,'four');await page.getByRole('button',{name:'Switch game',exact:true}).tap();
 await expect(page.getByRole('dialog',{name:'Choose a game'})).toBeVisible();await expect(page.locator('#library-search')).not.toBeFocused();
 await checkPages(page,'#switch-library');await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'Switch game',exact:true})).toBeFocused();
});

test('search keeps its input stable, searches every category, and has a clear empty-state recovery',async({page})=>{
 await page.setViewportSize({width:390,height:844});await home(page);await page.locator('[data-library-filter="Board games"]').tap();
 await expect(page.locator('.library-count')).toContainText('22');const input=page.locator('#game-search'),handle=await input.elementHandle();await input.focus();await input.pressSequentially('spider');
 expect(await input.evaluate((el,original)=>el===original,handle)).toBe(true);await expect(input).toBeFocused();await expect(page.locator('.game-card h2')).toHaveText('Spider');
 await expect(page.locator('[data-library-filter="All games"]')).toHaveAttribute('aria-pressed','true');await page.locator('.game-card[data-game="patience"]').tap();
 await expect(page.locator('.spider-table')).toBeVisible();
 await page.getByRole('button',{name:'Switch game',exact:true}).tap();await page.locator('#library-search').fill('unfindable qqq');await expect(page.locator('.empty-library')).toContainText('No games match');await page.getByRole('button',{name:'Show all 54 games'}).tap();await expect(page.locator('#library-search')).toHaveValue('');
 await page.locator('#library-search').fill('tic tac toe');await page.locator('.game-card[data-game="noughts"]').tap();await expect(page.locator('#page-title')).toHaveText(GAME_NAMES.noughts);
});

test('recent games survive reload, switching preserves moves, and cancelling restores focus',async({page})=>{
 await page.setViewportSize({width:390,height:844});await home(page);await openFromHome(page,'four');await page.locator('[data-column="3"]').tap();await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('grid-club-v1')!).four.moves.length)).toBe(2);
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('grid-club-v1')!).four.board);
 await switchGame(page,'sudoku');await expect(page.locator('#page-title')).toHaveText('Sudoku');await page.getByRole('button',{name:'Switch game',exact:true}).tap();await page.locator('#switch-library [data-library-filter="Recent"]').tap();
 await expect(page.locator('#switch-library .game-card').first()).toHaveAttribute('data-game','sudoku');await page.locator('#switch-library .game-card[data-game="four"]').tap();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('grid-club-v1')!).four.board)).toEqual(before);
 await page.reload();await page.getByRole('button',{name:'Switch game',exact:true}).tap();await page.locator('#switch-library [data-library-filter="Recent"]').tap();await expect(page.locator('#switch-library .game-card').first()).toHaveAttribute('data-game','four');
 await page.getByRole('button',{name:'Close game picker'}).tap();await expect(page.getByRole('button',{name:'Switch game',exact:true})).toBeFocused();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('grid-club-v1')!).four.board)).toEqual(before);
});

test('opening the chooser suspends an arcade run and its keys do not reach the game',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('./?game=void');await page.locator('#launch-btn').tap();await page.getByRole('button',{name:'Switch game',exact:true}).tap();
 await expect(page.locator('#pause-screen')).toBeVisible();const save=()=>page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('grid-club-v1')!).actionArcade.void));const before=await save();expect(before).toBeDefined();await page.locator('#library-search').fill('go');await page.keyboard.press('ArrowDown');await page.keyboard.press(' ');expect(await save()).toBe(before);
 await page.getByRole('button',{name:'Close game picker'}).tap();await page.getByRole('button',{name:'RESUME FLIGHT',exact:true}).tap();await expect(page.locator('#pause-screen')).not.toBeVisible();
});

test('search remains usable when the viewport shrinks for a phone keyboard',async({page})=>{
 await page.setViewportSize({width:390,height:844});await home(page);await page.locator('#game-search').fill('chess');await page.setViewportSize({width:390,height:430});
 await expect(page.locator('.game-card[data-game="chess"]')).toBeVisible();const tile=(await page.locator('.game-card[data-game="chess"]').boundingBox())!;expect(tile.y+tile.height).toBeLessThanOrEqual(430);
 await page.locator('#game-search').press('Enter');await expect(page.locator('#game-search')).not.toBeFocused();await page.setViewportSize({width:390,height:844});await page.locator('.game-card[data-game="chess"]').tap();await expect(page.locator('#page-title')).toHaveText('Chess');
});

test('library browsing works in every theme and without persistent storage',async({page})=>{
 await page.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='tiltu-library-v1')throw new DOMException('Storage disabled','SecurityError');return original.call(this,key,value);};});
 await page.setViewportSize({width:320,height:640});await home(page);
 const themes=await page.locator('#theme option').evaluateAll(options=>options.map(option=>(option as HTMLOptionElement).value));
 for(const theme of themes){await page.locator('#theme').selectOption(theme);await expect(page.locator('.game-card').first()).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(640);}
 await openFromHome(page,'chess');await switchGame(page,'go');await expect(page.locator('#page-title')).toHaveText('Go');
});

test('returning home and changing theme retain the category and page being browsed',async({page})=>{
 await page.setViewportSize({width:390,height:844});await home(page);await page.locator('[data-library-filter="Board games"]').tap();await page.locator('[data-library-page]').selectOption('1');
 const game=await page.locator('.game-card').first().getAttribute('data-game');await page.locator('.game-card').first().tap();await page.getByRole('button',{name:'Tiltu’s Games home',exact:true}).tap();
 await expect(page.locator('[data-library-filter="Board games"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('[data-library-page]')).toHaveValue('1');await expect(page.locator('.game-card').first()).toHaveAttribute('data-game',game!);
 await page.locator('#theme').selectOption('woodland');await expect(page.locator('[data-library-page]')).toHaveValue('1');await expect(page.locator('.game-card').first()).toHaveAttribute('data-game',game!);
});
