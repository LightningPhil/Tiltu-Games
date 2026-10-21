import {createEnvironment} from '../environment.ts';
import type {PortScope} from '../scope.ts';
let current:PortScope|null=null;
export const bindScope=(scope:PortScope)=>{current=scope;};
const env=createEnvironment(()=>current);
export const {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver}=env;
export type AudioContext=globalThis.AudioContext;
export type ResizeObserver=globalThis.ResizeObserver;
