import {test as base,expect,type Page} from '@playwright/test';
import {GAME_CATEGORY} from '../../src/catalog.ts';
import {pegMoves} from '../../src/collection/puzzles.ts';
import {mahjongPairs} from '../../src/collection/mahjong.ts';
import {abstractMoves} from '../../src/club-plus/abstracts.ts';
import {hopMoves} from '../../src/club-plus/hop.ts';
import {turnMoves} from '../../src/collection/turn-games.ts';
import {backgammonMoves} from '../../src/collection/backgammon.ts';
import {draughtsMoves} from '../../src/rules.ts';
import {newPatience,patienceMoves} from '../../src/patience.ts';
import {newFreeCell,newSpider,freeCellMoves,spiderMoves} from '../../src/collection/patience-collection.ts';
const test=base.extend<{runtimeChecks:void}>({runtimeChecks:[async({page},use)=>{const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await use();expect(errors,'browser runtime errors').toEqual([]);},{auto:true}]});
test.use({hasTouch:true,actionTimeout:15_000});
const puzzles=Object.keys(GAME_CATEGORY).filter(key=>GAME_CATEGORY[key as keyof typeof GAME_CATEGORY]==='Puzzles');
const boards=Object.keys(GAME_CATEGORY).filter(key=>GAME_CATEGORY[key as keyof typeof GAME_CATEGORY]==='Board games');
const cards=Object.keys(GAME_CATEGORY).filter(key=>GAME_CATEGORY[key as keyof typeof GAME_CATEGORY]==='Card games');
const open=async(page:Page,game:string)=>{await page.goto('./');await page.getByRole('button',{name:'Tiltu’s Games home',exact:true}).click();await page.locator(`.game-card[data-game="${game}"]`).click();await page.locator('.workspace-board:not(.board-loading)').waitFor();};

for(const viewport of [{width:320,height:640},{width:844,height:390},{width:1280,height:800}])test(`all fifteen puzzles keep play and actions on screen at ${viewport.width} × ${viewport.height}`,async({page})=>{
 test.setTimeout(180_000);await page.setViewportSize(viewport);
 for(const game of puzzles)await test.step(game,async()=>{
  await open(page,game);
  const geometry=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,w:innerWidth,h:innerHeight}));
  expect(geometry.width,`${game}: horizontal page overflow`).toBeLessThanOrEqual(geometry.w+1);expect(geometry.height,`${game}: vertical page overflow`).toBeLessThanOrEqual(geometry.h+1);
  const surface=(await page.locator('.workspace-surface').boundingBox())!,board=(await page.locator('.workspace-board').boundingBox())!;
  expect(surface.height,`${game}: play area`).toBeGreaterThan(viewport.height<500?180:viewport.height*.38);
  expect(board.height,`${game}: board visibility`).toBeGreaterThan(130);expect(board.y).toBeGreaterThanOrEqual(surface.y-2);expect(board.y+board.height).toBeLessThanOrEqual(surface.y+surface.height+3);
  expect(board.x+board.width).toBeLessThanOrEqual(viewport.width+1);
  for(const action of await page.locator('.workspace-actions button:visible').all()){const b=(await action.boundingBox())!;expect(b.y+b.height).toBeLessThanOrEqual(viewport.height+1);expect(b.height).toBeGreaterThanOrEqual(viewport.height<500?34:40);}
  await page.getByRole('tab',{name:'Setup',exact:true}).click();await expect(page.locator('.settings-card').first()).toBeVisible();await expect(page.locator('.workspace-board')).not.toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('tab',{name:'Play',exact:true})).toHaveAttribute('aria-selected','true');
  await page.getByRole('tab',{name:'Help',exact:true}).click();await expect(page.locator('#license-info')).toBeVisible();
 });
});

for(const viewport of [{width:320,height:640},{width:844,height:390},{width:1280,height:800}])test(`all twenty-two board games keep play and actions on screen at ${viewport.width} × ${viewport.height}`,async({page})=>{
 test.setTimeout(180_000);await page.setViewportSize(viewport);
 for(const game of boards)await test.step(game,async()=>{
  await open(page,game);
  expect(await page.evaluate(()=>document.documentElement.scrollHeight),`${game}: page height`).toBeLessThanOrEqual(viewport.height+1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth),`${game}: page width`).toBeLessThanOrEqual(viewport.width+1);
  const surface=(await page.locator('.workspace-surface').boundingBox())!,board=(await page.locator('.workspace-board').boundingBox())!;
  expect(surface.height,`${game}: play area`).toBeGreaterThan(viewport.height<500?180:viewport.height*.38);
  expect(board.height,`${game}: board height`).toBeGreaterThan(['senet','ur','kalah'].includes(game)?75:130);
  expect(board.y,`${game}: board top`).toBeGreaterThanOrEqual(surface.y-2);expect(board.y+board.height,`${game}: board bottom`).toBeLessThanOrEqual(surface.y+surface.height+3);
  for(const control of await page.locator('.workspace-actions button,.workspace-inputs button').all()){const b=await control.boundingBox();if(b&&b.width&&b.height)expect(b.y+b.height,`${game}: action bottom`).toBeLessThanOrEqual(viewport.height+1);}
  await page.getByRole('tab',{name:'Setup',exact:true}).click();await expect(page.locator('.settings-card').first()).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('.workspace-board')).toBeVisible();
 });
});

test('Sudoku keeps number entry, notes, hints and setup reachable without page scrolling',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page,'sudoku');
 const empty=page.locator('.sudoku-cell:not(.given)').first();await empty.click();await page.locator('#notes').click();await page.locator('.workspace-inputs [data-number="1"]').click();
 await expect(page.locator('#notes')).toHaveAttribute('aria-pressed','true');
 await page.getByRole('tab',{name:'Tools',exact:true}).click();await expect(page.locator('#check')).toBeVisible();
 await page.getByRole('tab',{name:'Setup',exact:true}).click();await page.locator('#size').selectOption('6');await expect(page.getByRole('tab',{name:'Setup',exact:true})).toHaveAttribute('aria-selected','true');
 await page.getByRole('tab',{name:'Play',exact:true}).click();await page.locator('#hint').click();await expect(page.locator('.workspace-feedback #apply-hint')).toBeVisible();
});

test('all board games accept a legal touch move with game actions kept in Play',async({page})=>{
 test.setTimeout(180_000);await page.setViewportSize({width:390,height:844});
 const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('grid-club-v1')!));
 for(const game of boards)await test.step(game,async()=>{
  await open(page,game);await page.getByRole('tab',{name:'Setup',exact:true}).click();
  const mode=page.locator('#opponent,#collection-mode,#plus-mode').first();await mode.selectOption('local');
  if(['four','draughts','chess','go'].includes(game))await page.locator('#new-game').click();
  const confirm=page.locator('dialog[open] [data-confirm]');if(await confirm.count())await confirm.click();
  await page.getByRole('tab',{name:'Play',exact:true}).click();await page.keyboard.press('Escape');
  const state=await save();
  if(['snakes','senet','ludo','ur'].includes(game)){
   await page.locator('[data-plus="race-roll"]').tap();await expect.poll(async()=>(await save()).plus[game].records.length).toBeGreaterThan(0);
   const counter=page.locator('[data-plus^="race-move:"]:not(:disabled)').first();if(game!=='snakes'&&await counter.count()&&await counter.isVisible()){await counter.tap();await expect.poll(async()=>(await save()).plus[game].moves).toBeGreaterThan(0);}
  }else if(['gomoku','nim','hex'].includes(game)){
   const move=abstractMoves(state.plus[game])[0];await page.locator(`[data-plus="abstract:${move}"]`).tap();await expect.poll(async()=>(await save()).plus[game].moves).toBe(1);
  }else if(['chinese','halma','fox','tafl'].includes(game)){
   const move=hopMoves(state.plus[game])[0];await page.locator(`[data-plus="hop:${move.from}"]`).tap();await page.locator(`[data-plus="hop:${move.to}"]`).tap();await expect.poll(async()=>(await save()).plus[game].moves).toBe(1);
  }else if(game==='dominoes'){
   await page.locator('.hand-domino:not(:disabled)').first().tap();await page.locator('.workspace-actions [data-plus^="domino-play:"]').first().tap();await expect.poll(async()=>(await save()).plus.dominoes.chain.length).toBe(1);
  }else if(['noughts','reversi','dots','morris','kalah'].includes(game)){
   const move=turnMoves(state.collection[game])[0];if(move.from!==undefined)await page.locator(`[data-collection="turn:${move.from}"]`).tap();await page.locator(`[data-collection="turn:${move.to}"]`).tap();await expect.poll(async()=>(await save()).collection[game].history.length).toBe(1);
  }else if(game==='four'){
   await page.locator('[data-column="3"]').tap();await expect.poll(async()=>(await save()).four.moves.length).toBe(1);
  }else if(game==='draughts'){
   const move=draughtsMoves(state.draughts.board,state.draughts.turn)[0];await page.locator(`[data-square="${move.from}"]`).tap();await page.locator(`[data-square="${move.path[0]}"]`).tap();await expect.poll(async()=>(await save()).draughts.moves.length).toBe(1);
  }else if(game==='chess'){
   await page.locator('[data-chess-square="52"]').tap();await page.locator('[data-chess-square="36"]').tap();await expect.poll(async()=>(await save()).chess.moves).toEqual(['e4']);
  }else if(game==='go'){
   await page.locator('[data-point="40"]').tap();const place=page.locator('[data-quick="go-place"]');if(await place.count())await place.tap();await expect.poll(async()=>(await save()).go.moves.length).toBe(1);
  }else if(game==='backgammon'){
   for(let i=0;i<6;i++){await page.locator('.workspace-actions [data-collection="roll"]').tap();if((await save()).collection.backgammon.phase!=='opening')break;}
   const s=(await save()).collection.backgammon,move=backgammonMoves(s)[0];await page.locator(`[data-collection="bg-point:${move.from}"]`).tap();await page.locator(`[data-collection="bg-move:${move.from}:${move.to}:${move.die}"]`).tap();await expect.poll(async()=>(await save()).collection.backgammon.history.length).toBeGreaterThan(s.history.length);
  }
  await expect(page.getByRole('tab',{name:'Play',exact:true})).toHaveAttribute('aria-selected','true');
 });
});

for(const viewport of [{width:320,height:640},{width:844,height:390},{width:1280,height:800}])test(`all eight card games keep cards and decisions on screen at ${viewport.width} × ${viewport.height}`,async({page})=>{
 test.setTimeout(120_000);await page.setViewportSize(viewport);
 for(const game of cards)await test.step(game,async()=>{
  await open(page,game);
  expect(await page.evaluate(()=>document.documentElement.scrollHeight),`${game}: page height`).toBeLessThanOrEqual(viewport.height+1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth),`${game}: page width`).toBeLessThanOrEqual(viewport.width+1);
  const surface=(await page.locator('.workspace-surface').boundingBox())!,hand=await page.locator('.workspace-hand').count()?await page.locator('.workspace-hand').boundingBox():null;
  expect(surface.height,`${game}: table visibility`).toBeGreaterThan(130);
  expect(surface.height+(hand?.height??0),`${game}: cards given screen space`).toBeGreaterThan(viewport.height<500?180:viewport.height*.43);
  for(const control of await page.locator('.workspace-actions button,.workspace-hand>button').all()){const b=await control.boundingBox();if(b&&b.width&&b.height){expect(b.y+b.height,`${game}: decision controls`).toBeLessThanOrEqual(viewport.height+1);expect(b.x+b.width,`${game}: hand right edge`).toBeLessThanOrEqual(viewport.width+1);}}
  await page.getByRole('tab',{name:'Setup',exact:true}).click();await expect(page.locator('.settings-card').first()).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('.workspace-board')).toBeVisible();
 });
});

test('card tables support passing, bidding, drawing, discarding and pegging by touch',async({page})=>{
 test.setTimeout(180_000);await page.setViewportSize({width:390,height:844});
 const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('grid-club-v1')!));
 await open(page,'hearts');
 await page.locator('[data-workspace-zoom]').tap();await expect(page.locator('.workspace-inputs')).toHaveClass(/large-hand/);await page.locator('[data-workspace-zoom]').tap();await expect(page.locator('.workspace-inputs')).not.toHaveClass(/large-hand/);
 for(let i=0;i<3;i++)await page.locator('.workspace-hand .plus-hand-card').nth(i).tap();
 await page.locator('[data-plus="hearts-pass"]').tap();await expect(page.locator('.workspace-hand .plus-hand-card:not(:disabled)').first()).toBeEnabled({timeout:20_000});
 await page.locator('.workspace-hand .plus-hand-card:not(:disabled)').first().tap();await expect.poll(async()=>(await save()).plus.hearts.hands[0].length).toBe(12);
 await open(page,'spades');await page.locator('[data-plus="bid-select:4"]').waitFor();await page.locator('[data-plus="bid-select:4"]').tap();await page.locator('[data-plus="spades-bid"]').tap();await expect.poll(async()=>(await save()).plus.spades.bids[0]).toBe(4);
 await expect(page.locator('.workspace-hand .plus-hand-card:not(:disabled)').first()).toBeEnabled({timeout:20_000});await page.locator('.workspace-hand .plus-hand-card:not(:disabled)').first().tap();await expect.poll(async()=>(await save()).plus.spades.hands[0].length).toBe(12);
 await open(page,'whist');await expect(page.locator('.workspace-hand .plus-hand-card:not(:disabled)').first()).toBeEnabled({timeout:20_000});await page.locator('.workspace-hand .plus-hand-card:not(:disabled)').first().tap();await expect.poll(async()=>(await save()).plus.whist.hands[0].length).toBe(12);
 await open(page,'gin');await page.locator('.workspace-actions [data-plus="gin-draw:discard"]').tap();await page.locator('.workspace-hand .plus-hand-card:not(:disabled)').first().tap();await page.locator('.workspace-actions [data-plus="gin-discard"]').tap();await expect.poll(async()=>(await save()).plus.gin.hands[0].length).toBe(10);
 await open(page,'cribbage');await page.locator('.workspace-hand .crib-card-button').nth(0).tap();await page.locator('.workspace-hand .crib-card-button').nth(1).tap();await page.locator('[data-collection="crib-discard"]').tap();await page.locator('[data-collection="crib-cut"]').tap();await expect(page.locator('.workspace-hand .crib-card-button:not(:disabled)').first()).toBeEnabled({timeout:20_000});await page.locator('.workspace-hand .crib-card-button:not(:disabled)').first().tap();await expect.poll(async()=>(await save()).collection.cribbage.hands[0].length).toBe(3);
 await open(page,'blackjack');await page.locator('.workspace-actions [data-bj="deal"]').tap();await expect.poll(async()=>(await save()).blackjack.phase).not.toBe('betting');if((await save()).blackjack.phase==='player')await page.locator('.workspace-actions [data-bj="stand"]').tap();await expect.poll(async()=>(await save()).blackjack.phase,{timeout:20_000}).toBe('settled');
});

test('all three Patience variants support tap destinations and panning without moving cards',async({page,context})=>{
 test.setTimeout(120_000);await page.setViewportSize({width:390,height:844});const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('grid-club-v1')!));
 await open(page,'patience');
 // Known valid saved deals keep this input test independent of random opening moves.
 await page.evaluate(deals=>{const s=JSON.parse(localStorage.getItem('grid-club-v1')!);s.patience=deals.patience;s.collection.freecell=deals.freecell;s.collection.spider=deals.spider;localStorage.setItem('grid-club-v1',JSON.stringify(s));},{patience:newPatience(1,Array.from({length:52},(_,i)=>i)),freecell:newFreeCell(42),spider:newSpider(1,42)});
 await page.reload();await page.locator('.workspace-actions [data-patience="draw"]').tap();await expect.poll(async()=>(await save()).patience.waste.length).toBe(1);
 const state=await save(),move=patienceMoves(state.patience)[0];
 expect(move).toBeTruthy();const source=page.locator(`[data-card-source="${move.from.pile}:${move.from.index}:${move.from.at}"]`),r=(await source.boundingBox())!;await source.tap({position:{x:r.width/2,y:8}});await page.locator(`.workspace-feedback [data-patience="move:${move.to.pile}:${move.to.index}"]`).tap();await expect.poll(async()=>(await save()).patience.moves).toBeGreaterThan(state.patience.moves);
 await page.locator('[data-workspace-zoom]').tap();await page.locator('[data-workspace-pan]').tap();await expect(page.locator('[data-workspace-pan]')).toHaveAttribute('aria-pressed','true');const surface=(await page.locator('.workspace-surface').boundingBox())!,cdp=await context.newCDPSession(page),finger={id:1,x:surface.x+surface.width*.8,y:surface.y+surface.height*.5},before=(await save()).patience.moves;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...finger,x:finger.x-130}]});await expect.poll(()=>page.locator('.workspace-surface').evaluate(e=>e.scrollLeft)).toBeGreaterThan(0);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 expect(await page.locator('.workspace-surface').evaluate(e=>e.scrollLeft)).toBeGreaterThan(0);expect((await save()).patience.moves).toBe(before);await page.locator('[data-workspace-pan]').tap();await expect(page.locator('[data-workspace-pan]')).toHaveAttribute('aria-pressed','false');await page.locator('[data-workspace-pan]').tap();await page.keyboard.press('Escape');await expect(page.locator('[data-workspace-pan]')).toHaveAttribute('aria-pressed','false');await page.locator('[data-workspace-zoom]').tap();
 for(const variant of ['freecell','spider']){
  await page.getByRole('tab',{name:'Setup',exact:true}).tap();await page.locator(`[data-patience-variant="${variant}"]`).tap();await page.keyboard.press('Escape');
  await expect(page.locator(`.${variant}-table`)).toBeVisible();const model=(await save()).collection[variant];
  if(variant==='freecell'){const m=freeCellMoves(model).find(m=>m.to.area==='cell')!;const from=page.locator(`[data-collection-card="${m.from.area}:${m.from.index}:${m.from.at}"]`);await from.tap({position:{x:10,y:8}});await page.locator(`.workspace-feedback [data-collection="destination:${m.to.area}:${m.to.index}:0"]`).tap();}
  else{let m=spiderMoves(model)[0];if(!m){await page.locator('[data-collection="spider-deal"]').first().tap();m=spiderMoves((await save()).collection.spider)[0];}expect(m).toBeTruthy();await page.locator(`[data-collection-card="column:${m.from}:${m.at}"]`).tap({position:{x:10,y:8}});await page.locator(`.workspace-feedback [data-collection="destination:column:${m.to}:0"]`).tap();}
  await expect.poll(async()=>(await save()).collection[variant].moves).toBeGreaterThan(0);
 }
});

test('Poker keeps decisions reachable for Hold’em, Omaha and Five-card Draw',async({page})=>{
 test.setTimeout(180_000);await page.setViewportSize({width:390,height:844});const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('grid-club-v1')!));
 for(const variant of ['holdem','omaha','draw'])await test.step(variant,async()=>{
  await open(page,'poker');await page.getByRole('tab',{name:'Setup',exact:true}).tap();await page.locator('#poker-variant').selectOption(variant);await page.locator('#new-game').tap();const confirm=page.locator('dialog[open] [data-confirm]');if(await confirm.count())await confirm.tap();await page.getByRole('tab',{name:'Play',exact:true}).tap();await page.locator('.workspace-actions [data-poker="deal"]').tap();
  for(let i=0;i<20;i++){
   await expect.poll(async()=>{const s=(await save()).poker;return ['ready','showdown','draw'].includes(s.phase)||s.turn===0;},{timeout:20_000}).toBe(true);
   const s=(await save()).poker;if(['ready','showdown'].includes(s.phase))break;
   if(s.phase==='draw'){await page.locator('.poker-discard').first().tap();await page.locator('.workspace-actions [data-poker="exchange"]').tap();await expect.poll(async()=>(await save()).poker.phase).not.toBe('draw');}
   else await page.locator('.workspace-actions [data-poker="check"]:not(:disabled),.workspace-actions [data-poker="call"]:not(:disabled)').first().tap();
  }
  expect(['ready','showdown']).toContain((await save()).poker.phase);expect((await save()).poker.variant).toBe(variant);
 });
});

test('Go scoring and Hex colour swapping stay available in Play',async({page})=>{
 await page.setViewportSize({width:390,height:844});const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('grid-club-v1')!));
 await open(page,'go');await page.getByRole('tab',{name:'Setup',exact:true}).tap();await page.locator('#opponent').selectOption('local');await page.locator('#new-game').tap();await page.getByRole('tab',{name:'Play',exact:true}).tap();
 await page.locator('.workspace-actions #pass').tap();await page.locator('.workspace-actions #pass').tap();await expect(page.locator('.workspace-feedback .score-panel')).toBeVisible();await expect(page.locator('.workspace-actions #resume-go')).toBeVisible();await page.locator('.workspace-actions #finish-go').tap();expect((await save()).go.result).not.toBeNull();
 await open(page,'hex');await page.getByRole('tab',{name:'Setup',exact:true}).tap();await page.locator('#plus-mode').selectOption('local');await page.getByRole('tab',{name:'Play',exact:true}).tap();await page.locator('[data-plus="abstract:0"]').tap();await page.locator('.workspace-actions [data-plus="abstract:-1"]').tap();expect((await save()).plus.hex.colours).toEqual([2,1]);
});

test('dense minefields enlarge to tappable squares and Nim shows its legal taking choices',async({page})=>{
 await page.setViewportSize({width:320,height:640});await open(page,'mines');await page.getByRole('tab',{name:'Setup',exact:true}).tap();await page.locator('#mine-level').selectOption('expert');await page.locator('#new-game').tap();await expect(page.locator('.mine-cell')).toHaveCount(480);await page.locator('[data-workspace-zoom]').tap();const cell=(await page.locator('.mine-cell').first().boundingBox())!;expect(cell.width).toBeGreaterThanOrEqual(30);expect(cell.height).toBeGreaterThanOrEqual(30);await expect(page.locator('[data-workspace-pan]')).toBeVisible();
 await open(page,'nim');await page.getByRole('tab',{name:'Setup',exact:true}).tap();await page.locator('#plus-variant').selectOption('subtract');await page.getByRole('tab',{name:'Play',exact:true}).tap();await expect(page.locator('.nim-stone')).toHaveCount(3);await page.locator('[data-plus="abstract:3"]').tap();await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('grid-club-v1')!).plus.nim.heaps[0])).toBeLessThanOrEqual(14);
});

test('all 45 shared workspaces remain usable in every theme on a phone',async({page})=>{
 test.setTimeout(240_000);await page.setViewportSize({width:390,height:844});
 for(const game of [...puzzles,...boards,...cards])await test.step(game,async()=>{
  await open(page,game);const themes=await page.locator('#theme option').evaluateAll(options=>options.map(option=>(option as HTMLOptionElement).value));
  for(const theme of themes){await page.locator('#theme').selectOption(theme);await expect(page.locator('.workspace-board')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth),`${game}/${theme}: width`).toBeLessThanOrEqual(391);expect(await page.evaluate(()=>document.documentElement.scrollHeight),`${game}/${theme}: height`).toBeLessThanOrEqual(845);}
 });
});

test('each puzzle accepts a touch play action and keeps zoom usable',async({page})=>{
 test.setTimeout(120_000);await page.setViewportSize({width:390,height:844});
 const actions:Record<string,string>={memory:'[data-plus^="memory:"]:not(:disabled)',kakuro:'.plus-number-cell:not(.fixed-digit)',slitherlink:'.loop-edge:not(:disabled)',hashi:'.hashi-link:not(:disabled)',futoshiki:'.plus-number-cell:not(.fixed-digit)',skyscrapers:'.plus-number-cell:not(.fixed-digit)',tangrams:'.tan-piece-button',wordsearch:'[data-word-at="0"]',sudoku:'.sudoku-cell:not(.given)',mines:'[data-mine="0"]',tetravex:'[data-tile-place="tray:0"]',mahjong:'.mahjong-tile.free-tile',sliding:'.sliding-tile:not(:disabled)',pegs:'.peg-socket',nonograms:'.nono-cell'};
 const save=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('grid-club-v1')!));
 for(const game of puzzles)await test.step(game,async()=>{
  await open(page,game);await page.keyboard.press('Escape');const before=await save();
  if(game==='pegs'){const move=pegMoves(before.collection.pegs)[0];await page.locator(`[data-collection="peg:${move.from}"]`).tap();await page.locator(`[data-collection="peg:${move.to}"]`).tap();await expect.poll(async()=>(await save()).collection.pegs.moves).toBe(before.collection.pegs.moves+1);}
  else if(game==='mahjong'){const pair=mahjongPairs(before.collection.mahjong)[0];for(const id of pair)await page.locator(`[data-collection="mahjong:${id}"]`).tap();await expect.poll(async()=>(await save()).collection.mahjong.moves).toBe(before.collection.mahjong.moves+1);}
  else if(game==='wordsearch'){const path=before.plus.wordsearch.placements[0].path;await page.locator(`[data-word-at="${path[0]}"]`).tap();await page.locator(`[data-word-at="${path.at(-1)}"]`).tap();expect((await save()).plus.wordsearch.found.length).toBe(1);}
  else{
   await page.locator(actions[game]).first().tap();
   if(['kakuro','futoshiki','skyscrapers'].includes(game)){await page.locator('[data-plus="number:1"]').tap();const s=(await save()).plus[game];expect(s.values[s.selected]).toBe(1);}
   if(game==='memory')expect((await save()).plus.memory.flipped).toHaveLength(1);
   if(game==='tangrams'){await page.locator('[data-plus="tan-rotate:1"]').tap();expect((await save()).plus.tangrams.moves).toBe(before.plus.tangrams.moves+1);}
   if(game==='tetravex'){await page.locator('[data-tile-place="board:0"]').tap();expect((await save()).tetravex.board[0]).not.toBeNull();}
   if(game==='sliding')expect((await save()).collection.sliding.moves).toBe(before.collection.sliding.moves+1);
   if(game==='nonograms')expect((await save()).collection.nonograms.cells[0]).toBe(1);
   if(game==='mines')expect((await save()).mines.open[0]).toBe(true);
   if(game==='sudoku'){await page.locator('.workspace-inputs [data-number="1"]').tap();const s=(await save()).sudoku;expect(s.values[s.selected]).toBe(1);}
  }
  await page.locator('[data-workspace-zoom]').click();await expect(page.locator('.workspace-surface')).toHaveClass(/is-enlarged/);await page.locator('[data-workspace-zoom]').click();await expect(page.locator('.workspace-surface')).not.toHaveClass(/is-enlarged/);
 });
});
