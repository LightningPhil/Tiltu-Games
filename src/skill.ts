/** Shared accuracy ladder. Randomness only chooses among legal actions. */
export const SKILL_NAMES = ['Easy', 'Casual', 'Challenging', 'Hard', 'Expert'] as const;
export const SKILL_LAPSE = [1, .48, .20, .045, 0] as const;
export const skillIndex = (level:number):number => Math.max(0,Math.min(4,Math.trunc(level || 1)-1));
export function skillChoice<T>(ranked:readonly T[],level:number,random:()=>number):T {
  if(!ranked.length)throw Error('A computer choice requires a legal action.');
  const i=skillIndex(level);
  return ranked.length>1&&random()<SKILL_LAPSE[i]?ranked[Math.min(ranked.length-1,Math.floor(random()*ranked.length))]:ranked[0];
}
export function seededRandom(seed:number):()=>number{return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
