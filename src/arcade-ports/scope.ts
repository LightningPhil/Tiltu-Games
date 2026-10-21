import type {PortGame,PortSave} from './store.ts';
import {portStorage} from './store.ts';
export interface PortHooks {pause:()=>void;running:()=>boolean;resize?:()=>void;dispose?:()=>void;resetClock?:()=>void}
type Frame={callback:FrameRequestCallback;native:number};
type Timer={callback:()=>void;delay:number;left:number;deadline:number;repeat:boolean;native:number};

/** A game owns one view and its resources; collection navigation owns when they may run. */
export class PortScope {
  active=false;
  readonly storage:Storage;
  readonly globals:Record<PropertyKey,unknown>={};
  private frames=new Map<number,Frame>();private timers=new Map<number,Timer>();private serial=0;
  private contexts=new Set<AudioContext>();private listeners:(()=>void)[]=[];private resizers:(()=>void)[]=[];
  private observer:ResizeObserver;private updateBounds:(()=>void)|null=null;private last=0;private saveClock=0;
  hooks:PortHooks|null=null;
  readonly id:PortGame;readonly root:HTMLElement;readonly save:PortSave;private persist:()=>boolean|void;
  constructor(id:PortGame,root:HTMLElement,save:PortSave,persist:()=>boolean|void){
    this.id=id;this.root=root;this.save=save;this.persist=persist;
    this.storage=portStorage(save,()=>this.persist());
    this.observer=new ResizeObserver(()=>{if(this.active)this.resize();});this.observer.observe(root);
    // Game controls are handled by their own controller, not the collection's card/match handlers.
    for(const type of ['click','change','input'])root.addEventListener(type,e=>e.stopPropagation());
  }
  get width(){return Math.max(280,this.root.clientWidth);}
  get height(){return Math.max(180,this.root.clientHeight);}
  rect(element:Element|null){if(!element)return undefined;const r=element.getBoundingClientRect(),origin=this.root.getBoundingClientRect();return {left:r.left-origin.left,right:r.right-origin.left,top:r.top-origin.top,bottom:r.bottom-origin.top,width:r.width,height:r.height};}
  bindBounds(callback:()=>void){this.updateBounds=callback;callback();}
  listen(target:EventTarget,type:string,listener:EventListenerOrEventListenerObject|null,options?:boolean|AddEventListenerOptions){
    if(!listener)return;
    if(target===window&&type==='resize'){
      const callback=()=>{const e=new Event('resize');typeof listener==='function'?listener.call(window,e):listener.handleEvent(e);};this.resizers.push(callback);return;
    }
    const callback=(event:Event)=>{
      if(!this.active)return;
      if(/^(key|wheel)/.test(type)&&event.target instanceof Node&&!this.root.contains(event.target)&&event.target!==document.body)return;
      if(type==='blur'&&target===window){this.hooks?.pause();this.suspendAudio();}
      if(type==='visibilitychange'&&document.hidden){this.hooks?.pause();this.suspendAudio();}
      if(typeof listener==='function')listener.call(target,event);else listener.handleEvent(event);
    };
    target.addEventListener(type,callback,options);this.listeners.push(()=>target.removeEventListener(type,callback,options));
  }
  frame(callback:FrameRequestCallback):number {
    const id=++this.serial;this.frames.set(id,{callback,native:0});if(this.active)this.scheduleFrame(id);return id;
  }
  private scheduleFrame(id:number){const frame=this.frames.get(id);if(!frame)return;frame.native=requestAnimationFrame(now=>{
    if(!this.active)return;this.frames.delete(id);
    const dt=this.last?Math.min(.1,Math.max(0,(now-this.last)/1000)):0;this.last=now;
    if(this.hooks?.running()){this.save.elapsed+=dt;this.saveClock+=dt;if(this.saveClock>2){this.persist();this.saveClock=0;}}
    frame.callback(now);
  });}
  cancelFrame(id:number){const frame=this.frames.get(id);if(frame)cancelAnimationFrame(frame.native);this.frames.delete(id);}
  timer(callback:()=>void,delay=0,repeat=false):number{
    const id=++this.serial;this.timers.set(id,{callback,delay,left:delay,deadline:0,repeat,native:0});if(this.active)this.scheduleTimer(id);return id;
  }
  private scheduleTimer(id:number){const timer=this.timers.get(id);if(!timer)return;timer.deadline=performance.now()+timer.left;timer.native=window.setTimeout(()=>{
    if(!this.active)return;if(!timer.repeat)this.timers.delete(id);timer.callback();if(timer.repeat&&this.timers.has(id)){timer.left=timer.delay;this.scheduleTimer(id);}
  },timer.left);}
  clearTimer(id:number){const timer=this.timers.get(id);if(timer)clearTimeout(timer.native);this.timers.delete(id);}
  trackAudio(context:AudioContext){this.contexts.add(context);return context;}
  private suspendAudio(){for(const context of this.contexts)if(context.state==='running')void context.suspend().catch(()=>{});}
  activate(){if(this.active)return;this.active=true;this.last=0;this.hooks?.resetClock?.();this.resize();for(const id of this.frames.keys())this.scheduleFrame(id);for(const id of this.timers.keys())this.scheduleTimer(id);}
  resize(){this.updateBounds?.();for(const callback of this.resizers)callback();this.hooks?.resize?.();}
  deactivate(){
    if(!this.active)return;this.hooks?.pause();
    for(const dialog of this.root.querySelectorAll<HTMLDialogElement>('dialog[open]'))dialog.close();
    if(this.root.contains(document.pointerLockElement))document.exitPointerLock();
    this.active=false;this.last=0;
    for(const frame of this.frames.values()){cancelAnimationFrame(frame.native);frame.native=0;}
    for(const timer of this.timers.values()){clearTimeout(timer.native);timer.left=Math.max(0,timer.deadline-performance.now());}
    this.suspendAudio();this.persist();
  }
  dispose(){this.deactivate();this.observer.disconnect();this.listeners.forEach(remove=>remove());this.frames.clear();this.timers.clear();this.hooks?.dispose?.();for(const context of this.contexts)if(context.state!=='closed')void context.close().catch(()=>{});}
}
