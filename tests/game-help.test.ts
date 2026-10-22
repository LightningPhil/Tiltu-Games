import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GAMES} from '../src/state.ts';
import {GAME_HELP,renderGameHelp} from '../src/game-help.ts';
import type {HelpGame} from '../src/game-help.ts';

test('every selectable game has a complete, individual guide',()=>{
 const games=GAMES.filter((game):game is HelpGame=>game!=='home');
 assert.equal(games.length,54);assert.deepEqual(Object.keys(GAME_HELP).sort(),[...games].sort());
 assert.equal(new Set(Object.values(GAME_HELP).map(h=>h.introduction)).size,54);
 for(const game of games){
  const h=GAME_HELP[game];assert.ok(h.introduction.length>35,game);
  assert.ok(h.gettingStarted.length>=2,`${game}: getting started`);assert.ok(h.tips.length>=2,`${game}: tips`);assert.ok(h.rules.length>=2,`${game}: rules`);
  for(const text of [h.introduction,...h.gettingStarted,...h.tips,...h.rules]){
   assert.ok(text.trim().length>20,`${game}: incomplete paragraph`);
   assert.doesNotMatch(text,/<[^>]+>|\bTODO\b|\bTBD\b|lorem ipsum/i,game);
  }
  if(h.source)assert.equal(new URL(h.source).protocol,'https:');
 }
});
test('each help page presents the four required sections in reading order',()=>{
 for(const game of Object.keys(GAME_HELP) as HelpGame[]){
  const html=renderGameHelp(game);
  assert.deepEqual([...html.matchAll(/<h2 tabindex="-1">(.*?)<\/h2>/g)].map(m=>m[1]),['Introduction','Getting started','Tips','Full rules'],game);
  assert.equal((html.match(/data-help-jump=/g)??[]).length,4);
  assert.equal((html.match(/data-help-section=/g)??[]).length,4);
  assert.ok(html.includes(`data-help-game="${game}"`));
 }
});
