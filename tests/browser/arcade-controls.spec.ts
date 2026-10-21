import {test as base,expect} from '@playwright/test';
const test=base.extend<{runtimeChecks:void}>({runtimeChecks:[async({page},use)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await use();expect(errors,'arcade runtime errors').toEqual([]);
},{auto:true}]});
test.use({hasTouch:true});

for(const viewport of [{width:320,height:640},{width:844,height:390},{width:1280,height:800}])test(`all nine arcade play screens fit ${viewport.width} × ${viewport.height}`,async({page})=>{
  test.setTimeout(120_000);await page.setViewportSize(viewport);
  const games=[
    {id:'void',launch:'#launch-btn',field:'#game-layer'},
    {id:'whacker',launch:'#start',field:'#garden'},
    {id:'horizon',launch:'#cruise-button',field:'#flight-view'},
    {id:'ballistics',launch:'#practice-button',field:'#battlefield'},
    {id:'blocks',launch:'[data-action-arcade="play"]',field:'#action-canvas'},
    {id:'salvage',launch:'[data-action-arcade="play"]',field:'#action-canvas'},
    {id:'snake',launch:'.snake-overlay [data-collection="snake-run"]',field:'#snake-canvas'},
    {id:'ski',launch:'.ski-controls [data-arcade="run"]',field:'#ski-canvas'},
    {id:'life',launch:'.arena [data-arcade="run"]',field:'#life-canvas'},
  ];
  for(const game of games)await test.step(game.id,async()=>{
    await page.goto('./');await page.getByRole('button',{name:'Tiltu’s Games home',exact:true}).click();await page.locator(`.game-card[data-game="${game.id}"]`).click();
    await expect(page.locator('.port-error')).toHaveCount(0);await page.locator(game.launch).click();
    await expect(page.locator(game.field)).toBeVisible();
    const geometry=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,w:innerWidth,h:innerHeight}));
    expect(geometry.width,`${game.id} horizontal page overflow`).toBeLessThanOrEqual(geometry.w+1);
    expect(geometry.height,`${game.id} vertical page overflow`).toBeLessThanOrEqual(geometry.h+1);
    const field=(await page.locator(game.field).boundingBox())!;expect(field.height,`${game.id} usable playfield`).toBeGreaterThan(70);
    expect(field.y+field.height,`${game.id} playfield bottom`).toBeLessThanOrEqual(viewport.height+1);
  });
});

test('Life fits the phone screen, keeps tools reachable, and paints continuous strokes',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('./');await page.locator('.game-card[data-game="life"]').click();
  expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThanOrEqual(844);
  await page.getByRole('tab',{name:'Patterns',exact:true}).click();await page.locator('[data-arcade="pattern:clear"]').click();
  await page.getByRole('tab',{name:'Play',exact:true}).click();
  const r=(await page.locator('#life-canvas').boundingBox())!;
  const a={x:r.x+r.width*2.5/40,y:r.y+r.height*4.5/28},b={x:r.x+r.width*12.5/40,y:a.y};
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y);await page.mouse.up();
  const cells=await page.evaluate(()=>JSON.parse(localStorage.getItem('grid-club-v1')!).life.cells);
  expect(cells.slice(4*40+2,4*40+13)).toEqual(Array(11).fill(1));
  await page.getByRole('tab',{name:'Snapshots',exact:true}).click();await page.locator('[data-arcade="save-snapshot"]').click();
  await expect(page.locator('[data-arcade="swap-snapshot"]')).toBeEnabled();
  await page.getByRole('tab',{name:'World',exact:true}).click();await expect(page.locator('#life-mode')).toBeVisible();
  await page.getByRole('tab',{name:'Play',exact:true}).click();await page.keyboard.press('p');
  await expect(page.locator('.life-run-state')).toContainText('Running');await page.keyboard.press('p');
  await expect(page.locator('.life-run-state')).toContainText('Paused');
});

test('Downhill Skiing pauses on focus loss and groups setup away from its thumb controls',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('./');await page.locator('.game-card[data-game="ski"]').click();
  await page.locator('.ski-controls [data-arcade="run"]').click();
  await expect(page.locator('.ski-countdown')).toBeVisible();
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await expect(page.locator('.ski-run-state')).toHaveText('Paused');
  await page.locator('.ski-settings summary').click();
  await page.getByRole('tab',{name:'How to play',exact:true}).click();
  await expect(page.locator('#ski-mode')).not.toBeVisible();
  await page.getByRole('tab',{name:'Run & steering',exact:true}).click();
  await expect(page.locator('#ski-mode')).toBeVisible();
  const jump=(await page.locator('[data-ski-control="jump"]').boundingBox())!;expect(jump.height).toBeGreaterThanOrEqual(44);
});

test('Snake turns during a swipe and Escape pauses without repeat-key flicker',async({page,context})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('./');await page.locator('.game-card[data-game="snake"]').click();
  await page.locator('.snake-run-actions [data-collection="snake-run"]').click();
  const canvas=(await page.locator('#snake-canvas').boundingBox())!,cdp=await context.newCDPSession(page);
  const finger={id:1,x:canvas.x+canvas.width/2,y:canvas.y+canvas.height/2};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...finger,y:finger.y-40}]});
  await page.keyboard.down('Escape');await page.keyboard.down('Escape');
  const snake=await page.evaluate(()=>JSON.parse(localStorage.getItem('grid-club-v1')!).collection.snake);
  expect(snake.phase).toBe('paused');expect(snake.direction==='up'||snake.queue.includes('up')).toBe(true);
  await page.keyboard.up('Escape');await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await page.locator('.snake-settings-toggle').click();await expect(page.locator('#collection-level')).toBeVisible();
  await expect(page.locator('.snake-settings #motion')).toHaveCount(0);
});

test('Archive Patrol keeps flight controls outside the arena and makes sound settings directly reachable',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('./');await page.locator('.game-card[data-game="salvage"]').click();
  await page.locator('[data-action-arcade="play"]').click();
  const canvas=(await page.locator('#action-canvas').boundingBox())!,stick=(await page.locator('[data-patrol-stick]').boundingBox())!;
  expect(stick.y).toBeGreaterThanOrEqual(canvas.y+canvas.height);
  await expect(page.locator('.patrol-touch-actions [data-action-hold="boost"]')).toBeVisible();
  await page.locator('[data-action-arcade="settings"]').click();await page.locator('[data-action-arcade="settings-tab-sound"]').click();
  await expect(page.locator('#action-volume')).toBeVisible();await expect(page.locator('.patrol-control-map')).not.toBeVisible();
});

test('TetriGrid keeps Hold and Drop within thumb reach and separates sound settings',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('./');await page.locator('.game-card[data-game="blocks"]').click();
  await page.locator('[data-action-arcade="play"]').click();
  const hold=page.locator('.tg-touch [data-action-hold="hold"]');await expect(hold).toBeEnabled();
  await hold.click();await expect(hold).toBeDisabled();
  await page.locator('.tg-touch [data-action-hold="hard"]').click();await expect(hold).toBeEnabled();
  const drop=(await page.locator('.tg-touch [data-action-hold="hard"]').boundingBox())!;expect(drop.y+drop.height).toBeLessThanOrEqual(844);
  await page.locator('[data-action-arcade="settings"]').click();await page.locator('[data-action-arcade="settings-tab-sound"]').click();
  await expect(page.locator('#action-tg-track')).toBeVisible();await expect(page.locator('#action-tg-handling')).not.toBeVisible();
});

test('Ballistics lists every weapon on a phone and cancels a charged shot without firing',async({page,context})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('./?game=ballistics');
  await page.getByRole('tab',{name:'Map',exact:true}).click();await expect(page.locator('#map-code-input')).toBeVisible();
  await page.getByRole('tab',{name:'Squads',exact:true}).click();await expect(page.locator('#team-0-name')).toBeVisible();
  await page.locator('#practice-button').click();
  await expect(page.locator('#weapon-select option')).toHaveCount(10);
  await page.locator('#weapon-select').selectOption('0');
  const fire=(await page.locator('.touch-fire').boundingBox())!,cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:fire.x+fire.width/2,y:fire.y+fire.height/2}]});
  await expect(page.locator('#power-label')).toContainText('POWER');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await expect(page.locator('#power-label')).toContainText('HOLD FIRE');
  await expect(page.locator('#phase-label')).toContainText('YOUR TURN');
  await expect(page.locator('.touch-fire')).toHaveAttribute('aria-pressed','false');
});

test('Neon Horizon exposes flight, controls, presentation and audio without a long setup page',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('./?game=horizon');
  await expect(page.locator('#horizon-deck')).toBeVisible();
  await page.getByRole('tab',{name:'Controls',exact:true}).click();await page.locator('#controls').selectOption('touch');
  await page.getByRole('tab',{name:'Look',exact:true}).click();await page.locator('#quality').selectOption('performance');
  await page.getByRole('tab',{name:'Sound',exact:true}).first().click();await expect(page.locator('#music-track')).toBeVisible();
  await page.getByRole('tab',{name:'Fly',exact:true}).click();await page.locator('#cruise-button').click();
  await expect(page.locator('#ui-layer')).toBeVisible();await expect(page.locator('#touch-stick')).toBeVisible();
  await page.locator('#hud-detail').click();await expect(page.locator('#hud-detail')).toHaveAttribute('aria-pressed','true');
  await page.locator('#pause-button').click();
  await page.getByRole('tab',{name:'Controls & look',exact:true}).click();await expect(page.locator('#pause-controls')).toBeVisible();
  await expect(page.locator('#resume')).toBeVisible();
});

test('Whack-a-Party imports a JPG, recalls it, and keeps options out of the playing garden',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('./?game=whacker');
  await page.getByRole('tab',{name:'Guests',exact:true}).click();
  const jpeg=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=80;canvas.height=100;const c=canvas.getContext('2d')!;c.fillStyle='#9cd7e8';c.fillRect(0,0,80,100);c.fillStyle='#efb463';c.fillRect(20,20,40,60);return canvas.toDataURL('image/jpeg').split(',')[1];});
  await page.locator('#custom-file').setInputFiles({name:'Party guest.JPG',mimeType:'image/jpeg',buffer:Buffer.from(jpeg,'base64')});
  await expect(page.locator('#upload-draft')).toBeVisible();
  await expect(page.locator('#custom-name')).toHaveValue('Party guest');
  await page.locator('#save-custom').click();
  await expect(page.locator('#custom-picker img')).toHaveCount(1);
  await page.reload();await page.getByRole('tab',{name:'Guests',exact:true}).click();
  await expect(page.locator('#custom-picker img')).toHaveCount(1);
  await page.getByRole('tab',{name:'Party',exact:true}).click();
  expect(await page.locator('#whack-options-panel-0').evaluate(element=>element.scrollHeight-element.clientHeight)).toBeLessThanOrEqual(1);
  await page.getByRole('tab',{name:'Pace',exact:true}).click();await expect(page.locator('#difficulty-picker')).toBeVisible();
  await page.getByRole('tab',{name:'Party',exact:true}).click();
  await page.locator('#start').click();
  await expect(page.locator('#garden')).toBeVisible();
  await expect(page.locator('#whack-options')).not.toBeVisible();
  const garden=(await page.locator('#garden').boundingBox())!;expect(garden.height).toBeGreaterThan(350);
  await page.locator('#pause').click();await expect(page.locator('#overlay-title')).toHaveText('Paused.');
});

test('Neon Void keeps both thumbs below the arena and releases held input',async({page,context})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('./?game=void');
  await expect(page.locator('.port-error')).toHaveCount(0);
  await page.locator('#launch-btn').click();
  const arena=(await page.locator('#game-layer').boundingBox())!;
  const fire=(await page.locator('#fire-btn').boundingBox())!,stick=(await page.locator('#void-stick').boundingBox())!;
  expect(fire.y).toBeGreaterThanOrEqual(arena.y+arena.height);
  expect(stick.y).toBeGreaterThanOrEqual(arena.y+arena.height);
  expect(fire.x+fire.width).toBeLessThan(stick.x);
  expect(stick.y+stick.height).toBeLessThanOrEqual(844);
  const cdp=await context.newCDPSession(page);
  const finger={id:1,x:stick.x+stick.width*.8,y:stick.y+stick.height*.5};
  const trigger={id:2,x:fire.x+fire.width/2,y:fire.y+fire.height/2};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger,trigger]});
  await expect(page.locator('#void-stick')).toHaveClass(/held/);
  await expect(page.locator('#fire-btn')).toHaveAttribute('aria-pressed','true');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[trigger]});
  await expect(page.locator('#fire-btn')).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#void-stick')).toHaveClass(/held/);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await expect(page.locator('#void-stick')).not.toHaveClass(/held/);
  await page.locator('#void-stick').focus();await page.keyboard.down('ArrowUp');await page.keyboard.down('ArrowRight');
  await page.keyboard.up('ArrowRight');await expect(page.locator('#void-stick')).toHaveClass(/held/);
  await page.keyboard.up('ArrowUp');await expect(page.locator('#void-stick')).not.toHaveClass(/held/);
  await page.locator('[title="Pause and settings"]').click();
  await page.getByRole('tab',{name:'Sound',exact:true}).click();
  await expect(page.locator('.soundtrack-settings')).toBeVisible();
});
