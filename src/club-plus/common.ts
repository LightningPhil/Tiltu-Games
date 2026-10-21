import type {PlusGame} from './meta.ts';
export interface Base {kind:PlusGame;mode:'computer'|'local';level:number;seed:number;turn:number;result:number|null;notice:string;moves:number;elapsed:number;history:Record<string,any>[];records:string[]}
export const base=(kind:PlusGame,mode:Base['mode']='computer',level=3,seed=Math.floor(Math.random()*0xffffffff)):Base=>({kind,mode,level,seed:seed>>>0,turn:0,result:null,notice:'',moves:0,elapsed:0,history:[],records:[]});
export function random(s:{seed:number}):number{s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
export const rand=(s:{seed:number},n:number)=>Math.floor(random(s)*n);
export function shuffled<T>(s:{seed:number},values:T[]):T[]{const a=values.slice();for(let i=a.length-1;i>0;i--){const j=rand(s,i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function snapshot(s:Base):Record<string,any>{const {history,records,...position}=s;return structuredClone(position);}
export function remember(s:Base,label:string):void{s.history.push(snapshot(s));s.records.push(label);if(s.history.length>100){s.history.shift();s.records.shift();}s.moves++;s.notice='';}
export function undoBase(s:Base,human=0):boolean{if(!s.history.length)return false;do{const previous=s.history.pop()!;s.records.pop();Object.assign(s,previous);}while(s.mode==='computer'&&s.turn!==human&&s.history.length);return true;}
export function assertBase(s:unknown,kind:PlusGame):s is Base{const v=s as Base;return !!v&&v.kind===kind&&['computer','local'].includes(v.mode)&&Number.isInteger(v.level)&&v.level>=1&&v.level<=5&&Number.isInteger(v.seed)&&Number.isInteger(v.turn)&&v.turn>=0&&v.turn<4&&[null,-1,0,1,2,3].includes(v.result)&&Number.isInteger(v.moves)&&v.moves>=0&&Number.isInteger(v.elapsed)&&v.elapsed>=0&&typeof v.notice==='string'&&v.notice.length<2000&&Array.isArray(v.records)&&v.records.length<=100&&v.records.every(t=>typeof t==='string'&&t.length<500)&&Array.isArray(v.history)&&v.history.length<=100;}
export const integers=(a:unknown,length:number,min:number,max:number):a is number[]=>Array.isArray(a)&&a.length===length&&a.every(n=>Number.isInteger(n)&&n>=min&&n<=max);
export const gridNeighbours=(at:number,size:number)=>[at-size,at+size,...(at%size?[at-1]:[]),...(at%size<size-1?[at+1]:[])].filter(i=>i>=0&&i<size*size);
