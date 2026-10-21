export interface ArcadePalette {bg:string;surface:string;raised:string;line:string;text:string;muted:string;accent:string;rival:string;neon:boolean;reduced:boolean;}
export function readArcadePalette():ArcadePalette {
  const s=getComputedStyle(document.documentElement),get=(n:string)=>s.getPropertyValue(n).trim();
  return {bg:get('--bg'),surface:get('--surface'),raised:get('--raised'),line:get('--line'),text:get('--text'),muted:get('--muted'),accent:get('--accent'),rival:get('--p2'),neon:['tron','pulse'].includes(document.documentElement.dataset.theme??''),reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};
}
export {drawSalvage,flightView,shipOutline} from './archive-renderer.ts';
