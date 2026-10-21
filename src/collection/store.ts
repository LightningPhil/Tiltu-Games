import { restoreTurn } from './turn-games.ts';
import type { TurnSession } from './turn-games.ts';
import { restoreBackgammon } from './backgammon.ts';
import type { BackgammonSession } from './backgammon.ts';
import { restoreCribbage } from './cribbage.ts';
import type { CribSession } from './cribbage.ts';
import { restoreMahjong } from './mahjong.ts';
import type { MahjongSession } from './mahjong.ts';
import { restoreSnake } from './snake.ts';
import type { SnakeSession } from './snake.ts';
import { restoreNonogram,restorePegs,restoreSliding } from './puzzles.ts';
import type { NonogramSession,PegSession,SlidingSession } from './puzzles.ts';
import { restoreFreeCell,restoreSpider } from './patience-collection.ts';
import type { FreeCellSession,SpiderSession } from './patience-collection.ts';
export const COLLECTION_GAMES=['noughts','reversi','snake','backgammon','mahjong','sliding','pegs','dots','morris','kalah','nonograms','cribbage'] as const;
export type CollectionGame=typeof COLLECTION_GAMES[number];
export type CollectionKey=CollectionGame|'freecell'|'spider';
export interface CollectionStore { noughts:TurnSession|null;reversi:TurnSession|null;dots:TurnSession|null;morris:TurnSession|null;kalah:TurnSession|null;snake:SnakeSession|null;backgammon:BackgammonSession|null;mahjong:MahjongSession|null;sliding:SlidingSession|null;pegs:PegSession|null;nonograms:NonogramSession|null;cribbage:CribSession|null;freecell:FreeCellSession|null;spider:SpiderSession|null }
export const emptyCollection=():CollectionStore=>({noughts:null,reversi:null,dots:null,morris:null,kalah:null,snake:null,backgammon:null,mahjong:null,sliding:null,pegs:null,nonograms:null,cribbage:null,freecell:null,spider:null});
export function restoreCollection(value:unknown):CollectionStore{
  const s=emptyCollection();if(!value||typeof value!=='object')return s;const v=value as Record<string,unknown>;
  const safely=<T>(read:()=>T):T|null=>{try{return read();}catch{return null;}};
  for(const kind of ['noughts','reversi','dots','morris','kalah'] as const)s[kind]=safely(()=>restoreTurn(v[kind],kind));
  s.backgammon=safely(()=>restoreBackgammon(v.backgammon));s.cribbage=safely(()=>restoreCribbage(v.cribbage));s.mahjong=safely(()=>restoreMahjong(v.mahjong));s.snake=safely(()=>restoreSnake(v.snake));s.sliding=safely(()=>restoreSliding(v.sliding));s.pegs=safely(()=>restorePegs(v.pegs));s.nonograms=safely(()=>restoreNonogram(v.nonograms));s.freecell=safely(()=>restoreFreeCell(v.freecell));s.spider=safely(()=>restoreSpider(v.spider));return s;
}
