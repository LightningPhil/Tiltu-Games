import {expect,type Page} from '@playwright/test';
import {GAME_NAMES} from '../../src/catalog.ts';
import type {Game} from '../../src/state.ts';

export async function openFromHome(page:Page,game:string){
 await page.locator('#game-search').fill(GAME_NAMES[game as Game]);
 const tile=page.locator(`#home-library .game-card[data-game="${game}"]`);await expect(tile).toBeVisible();await tile.click();
}
export async function switchGame(page:Page,game:string){
 await page.getByRole('button',{name:'Switch game',exact:true}).click();await page.locator('#library-search').fill(GAME_NAMES[game as Game]);
 await page.locator(`#switch-library .game-card[data-game="${game}"]`).click();
}
