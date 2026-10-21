import test from 'node:test';
import assert from 'node:assert/strict';
import {GAMES} from '../src/state.ts';
import {findLibraryGames,libraryPage,libraryTarget,recentGames} from '../src/game-library.ts';

test('the library includes all 54 games and the complete category counts',()=>{
 assert.equal(findLibraryGames('All games','').length,54);
 for(const [filter,count]of [['Board games',22],['Card games',8],['Puzzles',15],['Arcade & worlds',9]]as const)assert.equal(findLibraryGames(filter,'').length,count);
});
test('mobile search finds familiar names, punctuation variants and Patience variants globally',()=>{
 for(const [query,game]of [['checkers','draughts'],['tic-tac-toe','noughts'],['connect4','four'],['whackaparty','whacker'],['Free Cell','patience'],['Omaha','poker'],['game of life','life']]as const)assert(findLibraryGames('Board games',query).includes(game),query);
 assert.deepEqual(findLibraryGames('Recent','not a real game'),[]);
});
test('every game can be found by its name through the shared search',async()=>{
 const {GAME_NAMES}=await import('../src/catalog.ts');
 for(const game of GAMES.filter(game=>game!=='home'))assert.equal(findLibraryGames('All games',GAME_NAMES[game])[0],game,GAME_NAMES[game]);
 assert.equal(findLibraryGames('All games','checkers')[0],'draughts');
});
test('pagination reaches every game exactly once and clamps stale pages after filtering',()=>{
 const all=findLibraryGames('All games','');
 for(const size of [2,6,12,20,24]){
  const pages=Array.from({length:Math.ceil(all.length/size)},(_,i)=>libraryPage(all,i,size).games).flat();assert.deepEqual(pages,all);
 }
 assert.equal(libraryPage(all,99,6).index,8);assert.equal(libraryPage(all,-3,6).index,0);
 assert.deepEqual(libraryPage([],8,6),{games:[],index:0,count:1,start:0,end:0,total:0});
 assert.equal(libraryPage(all,NaN,0).games.length,1);
});
test('recent games retain visit order, reject invalid data and never include home or duplicates',()=>{
 assert.deepEqual(recentGames(['chess','home','chess','not-a-game','sudoku',null]),['chess','sudoku']);
 assert.deepEqual(recentGames({chess:true}),[]);assert.equal(recentGames(GAMES).length,8);
 assert.deepEqual(findLibraryGames('Recent','',['sudoku','chess']),['sudoku','chess']);
});
test('a named Patience variant launches directly without changing the default 54-game catalogue',()=>{
 assert.deepEqual(libraryTarget('patience','Free Cell'),{game:'patience',patience:'freecell'});
 assert.deepEqual(libraryTarget('patience','Spider'),{game:'patience',patience:'spider'});
 assert.deepEqual(libraryTarget('patience','Klondike'),{game:'patience',patience:'klondike'});
 assert.deepEqual(libraryTarget('patience','Patience'),{game:'patience'});
 assert.deepEqual(libraryTarget('chess','Spider'),{game:'chess'});
});
