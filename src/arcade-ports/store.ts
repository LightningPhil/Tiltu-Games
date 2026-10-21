export const PORT_GAMES=['void','whacker','horizon','ballistics'] as const;
export type PortGame=typeof PORT_GAMES[number];
export const isPortGame=(game:string):game is PortGame=>PORT_GAMES.includes(game as PortGame);
export interface PortSave {data:Record<string,string>;elapsed:number}
export const newPortSave=():PortSave=>({data:{},elapsed:0});
export function restorePortSave(value:unknown):PortSave|null {
  if(!value||typeof value!=='object')return null;const raw=value as PortSave;
  if(!raw.data||typeof raw.data!=='object'||Array.isArray(raw.data))return null;
  const result=newPortSave();let total=0;
  for(const [key,v]of Object.entries(raw.data)){
    if(key.length>120||['__proto__','constructor','prototype'].includes(key)||typeof v!=='string'||v.length>2_100_000)continue;
    total+=v.length;if(total>2_500_000)break;result.data[key]=v;
  }
  if(typeof raw.elapsed==='number'&&Number.isFinite(raw.elapsed)&&raw.elapsed>=0)result.elapsed=Math.min(1e10,raw.elapsed);
  return result;
}

/** The imported games' keys live inside this collection save, never in their standalone namespaces. */
export function portStorage(save:PortSave,persist:()=>boolean|void):Storage {
  const data=save.data;
  return {
    get length(){return Object.keys(data).length;},
    key(index:number){return Object.keys(data)[index]??null;},
    getItem(key:string){return Object.hasOwn(data,key)?data[key]:null;},
    setItem(key:string,value:string){
      if(['__proto__','constructor','prototype'].includes(key)||key.length>120)throw new Error('Invalid game save key.');
      const old=data[key];data[key]=String(value);
      if(persist()===false){if(old===undefined)delete data[key];else data[key]=old;throw new Error('Collection storage is unavailable.');}
    },
    removeItem(key:string){delete data[key];persist();},
    clear(){for(const key of Object.keys(data))delete data[key];persist();},
  };
}
