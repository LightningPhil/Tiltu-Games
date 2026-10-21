import type {PortScope} from './scope.ts';

/** Explicit DOM/input/audio ownership for the ported engines, without another document or iframe. */
export function createEnvironment(scope:()=>PortScope|null){
  const nativeWindow=()=>globalThis.window;
  const nativeDocument=()=>globalThis.document;
  const audio=function(this:unknown,...args:ConstructorParameters<typeof AudioContext>){
    const Constructor=globalThis.AudioContext||(globalThis as any).webkitAudioContext||(nativeWindow() as any)?.AudioContext||(nativeWindow() as any)?.webkitAudioContext;
    const context=new Constructor(...args);return scope()?.trackAudio(context)??context;
  } as unknown as typeof AudioContext;
  const observer=function(this:unknown,callback:ResizeObserverCallback){return new globalThis.ResizeObserver((entries,instance)=>{if(!scope()||scope()!.active)callback(entries,instance);});} as unknown as typeof ResizeObserver;
  const portDocument=new Proxy({} as Document,{
    get(_target,key){
      const s=scope(),doc=nativeDocument();if(!s){const value=(doc as any)?.[key];return typeof value==='function'?value.bind(doc):value;}
      if(key==='body'||key==='documentElement')return s.root;
      if(key==='getElementById')return (id:string)=>s.root.querySelector('#'+CSS.escape(id));
      if(key==='querySelector')return s.root.querySelector.bind(s.root);
      if(key==='querySelectorAll')return s.root.querySelectorAll.bind(s.root);
      if(key==='addEventListener')return (type:string,listener:EventListener,options?:AddEventListenerOptions)=>s.listen(doc,type,listener,options);
      const value=(doc as any)[key];return typeof value==='function'?value.bind(doc):value;
    },
  });
  const portStorage=new Proxy({} as Storage,{get(_target,key){const storage=scope()?.storage??globalThis.localStorage;const value=(storage as any)?.[key];return typeof value==='function'?value.bind(storage):value;}});
  const frame=(callback:FrameRequestCallback)=>scope()?.frame(callback)??globalThis.requestAnimationFrame(callback);
  const cancelFrame=(id:number)=>scope()?scope()!.cancelFrame(id):globalThis.cancelAnimationFrame(id);
  const timeout=(callback:TimerHandler,delay=0,...args:unknown[])=>scope()?scope()!.timer(()=>{if(typeof callback==='function')callback(...args);},delay):globalThis.setTimeout(callback,delay,...args);
  const interval=(callback:TimerHandler,delay=0,...args:unknown[])=>scope()?scope()!.timer(()=>{if(typeof callback==='function')callback(...args);},delay,true):globalThis.setInterval(callback,delay,...args);
  const clearTimer=(id:number)=>scope()?scope()!.clearTimer(id):globalThis.clearTimeout(id);
  const portWindow=new Proxy({} as Window&typeof globalThis,{
    get(_target,key){
      const s=scope(),win=nativeWindow();
      if(!s){const value=(win as any)?.[key];return typeof value==='function'?value.bind(win):value;}
      if(key==='document')return portDocument;if(key==='localStorage')return portStorage;
      if(key==='AudioContext'||key==='webkitAudioContext')return audio;if(key==='ResizeObserver')return observer;
      if(key==='requestAnimationFrame')return frame;if(key==='cancelAnimationFrame')return cancelFrame;
      if(key==='setTimeout')return timeout;if(key==='setInterval')return interval;if(key==='clearTimeout'||key==='clearInterval')return clearTimer;
      if(s){
        if(key==='innerWidth')return s.width;if(key==='innerHeight')return s.height;
        if(Object.hasOwn(s.globals,key))return s.globals[key];
        if(key==='addEventListener')return (type:string,listener:EventListener,options?:AddEventListenerOptions)=>s.listen(win,type,listener,options);
        if(key==='scrollTo')return ()=>{};
        if(key==='visualViewport'&&win.visualViewport)return new Proxy(win.visualViewport,{get(target,name){if(name==='addEventListener')return(type:string,listener:EventListener,options?:AddEventListenerOptions)=>s.listen(target,type,listener,options);const value=(target as any)[name];return typeof value==='function'?value.bind(target):value;}});
      }
      const value=(win as any)?.[key];return typeof value==='function'?value.bind(win):value;
    },
    set(_target,key,value){const s=scope();if(s)s.globals[key]=value;return true;},
  });
  return {document:portDocument,window:portWindow,localStorage:portStorage,requestAnimationFrame:frame,cancelAnimationFrame:cancelFrame,setTimeout:timeout,setInterval:interval,clearTimeout:clearTimer,clearInterval:clearTimer,AudioContext:audio,ResizeObserver:observer};
}
