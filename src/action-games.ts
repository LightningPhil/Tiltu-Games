import {PORT_GAMES,restorePortSave} from './arcade-ports/store.ts';
import type {PortGame,PortSave} from './arcade-ports/store.ts';
/** Arcade engines use the collection's routes and saves. */
export type ActionGame='blocks'|'salvage'|PortGame;
export const ACTION_GAMES:readonly ActionGame[]=['blocks','salvage',...PORT_GAMES];
export const isActionGame=(game:string):game is ActionGame=>ACTION_GAMES.includes(game as ActionGame);
export type Point=[number,number];
export * from './archive-patrol.ts';
export {newBlocks,restoreBlocks} from './tetrigrid/session.ts';
export type {BlocksSession} from './tetrigrid/session.ts';
import {restoreSalvage} from './archive-patrol.ts';
import type {SalvageSession} from './archive-patrol.ts';
import {restoreBlocks} from './tetrigrid/session.ts';
import type {BlocksSession} from './tetrigrid/session.ts';
import {defaults,readSettings,readRecords} from './tetrigrid/storage.ts';
import type {Settings,Records} from './tetrigrid/storage.ts';
export interface ActionStore extends Record<PortGame,PortSave|null> {blocks:BlocksSession|null;salvage:SalvageSession|null;music:boolean;effects:boolean;volume:number;blocksSettings:Settings;blocksRecords:Records}
export const emptyActionArcade=():ActionStore=>({void:null,whacker:null,horizon:null,ballistics:null,blocks:null,salvage:null,music:true,effects:true,volume:.3,blocksSettings:{...defaults},blocksRecords:{}});
export function restoreActionArcade(value:unknown):ActionStore {
 const out=emptyActionArcade();if(!value||typeof value!=='object')return out;const v=value as Record<string,unknown>;
 for(const game of PORT_GAMES)out[game]=restorePortSave(v[game]);
 out.blocks=restoreBlocks(v.blocks);out.salvage=restoreSalvage(v.salvage);out.blocksSettings=readSettings(v.blocksSettings);out.blocksRecords=readRecords(v.blocksRecords);
 if(typeof v.music==='boolean')out.music=v.music;if(typeof v.effects==='boolean')out.effects=v.effects;if(typeof v.volume==='number'&&Number.isFinite(v.volume)&&v.volume>=0&&v.volume<=1)out.volume=v.volume;
 return out;
}
