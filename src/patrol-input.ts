import type {FlightInput} from './archive-patrol.ts';

export const PATROL_KEYS:Readonly<Record<string,string>>={
  KeyW:'thrust',ArrowUp:'thrust',KeyS:'brake',ArrowDown:'brake',
  KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',
  Space:'fire',KeyE:'pulse',KeyX:'pulse',ShiftLeft:'boost',ShiftRight:'boost',KeyQ:'boost',
  KeyF:'tractor',KeyB:'brake',KeyG:'dock',KeyH:'nav-relay',KeyT:'nav-cycle',
  KeyR:'auto-fire',KeyP:'pause',Escape:'escape',Enter:'pause',
  Digit1:'weapon-blaster',Digit2:'weapon-scatter',Digit3:'weapon-lance',
};
/** Code keeps physical controls stable; key supports browsers that omit code. */
export function patrolKey(code:string,key=''):string|undefined {
  if(PATROL_KEYS[code])return PATROL_KEYS[code];
  if(code&&code!=='Unidentified')return undefined;
  const fallback=key.length===1?/^[a-z]$/i.test(key)?'Key'+key.toUpperCase():/^[1-3]$/.test(key)?'Digit'+key:key===' '?'Space':key:key==='Shift'?'ShiftLeft':key;
  return PATROL_KEYS[fallback];
}
export const patrolKeyIdentity=(code:string,key:string)=>code&&code!=='Unidentified'?code:key.toLowerCase();
/** Both keyboard layouts and touch controls use these same ship-relative actions. */
export function patrolFlightInput(actions:Iterable<string>,stick={x:0,y:0},mouseFire=false,continuousFire=false):FlightInput {
  const held=new Set(actions),on=(...keys:string[])=>keys.some(key=>held.has(key));
  return {turn:Number(on('right'))-Number(on('left'))+stick.x,
    thrust:Number(on('thrust','up'))+Math.max(0,-stick.y),
    brake:on('brake','down')||stick.y>.15,strafe:0,
    fire:mouseFire||on('fire')||continuousFire,boost:on('boost'),
    tractor:on('tractor'),scan:on('tractor','scan'),pulse:false,aim:null};
}
