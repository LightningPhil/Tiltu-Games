import {test} from 'node:test';
import assert from 'node:assert/strict';
import {newPortSave,restorePortSave,portStorage,PORT_GAMES} from '../src/arcade-ports/store.ts';
import {PortScope} from '../src/arcade-ports/scope.ts';
import {createEnvironment} from '../src/arcade-ports/environment.ts';

test('each imported game keeps its own save without touching standalone storage',()=>{
  const saves=PORT_GAMES.map(()=>newPortSave());
  saves.forEach((save,i)=>portStorage(save,()=>true).setItem('settings',String(i)));
  assert.deepEqual(saves.map(s=>s.data.settings),['0','1','2','3']);
  const restored=restorePortSave(JSON.parse(JSON.stringify(saves[2])))!;
  portStorage(restored,()=>true).setItem('settings','new');
  assert.equal(saves[2].data.settings,'2');assert.equal(restored.data.settings,'new');
});

test('custom character image storage survives restoration, but corrupt saves stay bounded',()=>{
  const save=newPortSave();portStorage(save,()=>true).setItem('gallery','x'.repeat(2_000_000));save.elapsed=180;
  const restored=restorePortSave(JSON.parse(JSON.stringify(save)))!;
  assert.equal(restored.data.gallery.length,2_000_000);assert.equal(restored.elapsed,180);
  assert.equal(restorePortSave(null),null);assert.equal(restorePortSave({data:[]}),null);
  const bad=restorePortSave({data:JSON.parse('{"__proto__":"bad","constructor":"bad","ok":"yes","number":3}'),elapsed:Infinity})!;
  assert.deepEqual(bad,{data:{ok:'yes'},elapsed:0});
  assert.deepEqual(restorePortSave({data:{huge:'x'.repeat(2_100_001)}})?.data,{});
});

test('quota failures roll back a new item and preserve the previous preference',()=>{
  const save=newPortSave();save.data.settings='old';const storage=portStorage(save,()=>false);
  assert.throws(()=>storage.setItem('settings','new'),/unavailable/);assert.equal(storage.getItem('settings'),'old');
  assert.throws(()=>storage.setItem('gallery','new'),/unavailable/);assert.equal(storage.getItem('gallery'),null);
  assert.throws(()=>storage.setItem('__proto__','new'),/Invalid/);
});

function fixture(run:(ctx:any)=>void){
  const keys=['window','document','Node','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','clearTimeout'];
  const old=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  class FakeNode extends EventTarget {clientWidth=640;clientHeight=400;contains(node:unknown){return node===this;}querySelectorAll(){return [];}querySelector(){return null;}getBoundingClientRect(){return {left:20,top:30,right:660,bottom:430,width:640,height:400};}}
  const win=new EventTarget(),doc=new EventTarget(),root=new FakeNode(),frames=new Map<number,FrameRequestCallback>(),timers=new Map<number,()=>void>();let serial=0;
  Object.assign(doc,{pointerLockElement:null,hidden:false});Object.assign(win,{setTimeout:(cb:()=>void)=>{timers.set(++serial,cb);return serial;}});
  const globals={window:win,document:doc,Node:FakeNode,ResizeObserver:class {observe(){}disconnect(){}},requestAnimationFrame:(cb:FrameRequestCallback)=>{frames.set(++serial,cb);return serial;},cancelAnimationFrame:(id:number)=>frames.delete(id),clearTimeout:(id:number)=>timers.delete(id)};
  for(const [key,value] of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,value});
  try{run({root,win,doc,frames,timers});}finally{for(const key of keys){const descriptor=old.get(key);if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}}
}

test('navigation suspends frames, timers and audio; returning preserves pending work',()=>fixture(({root,frames,timers})=>{
  const scope=new PortScope('void',root,newPortSave(),()=>true);let paused=0,rendered=0,fired=0,suspended=0,closed=0;
  scope.hooks={pause:()=>paused++,running:()=>true};scope.trackAudio({state:'running',suspend:async()=>{suspended++;},close:async()=>{closed++;}} as AudioContext);
  scope.activate();scope.frame(()=>rendered++);scope.timer(()=>fired++,1000);
  assert.equal(frames.size,1);assert.equal(timers.size,1);scope.deactivate();
  assert.equal(paused,1);assert.equal(suspended,1);assert.equal(frames.size,0);assert.equal(timers.size,0);
  scope.activate();assert.equal(frames.size,1);assert.equal(timers.size,1);
  const [id,callback]=[...frames][0];frames.delete(id);callback(100);assert.equal(rendered,1);
  [...timers.values()][0]();assert.equal(fired,1);scope.dispose();assert.equal(closed,1);
}));

test('inactive engines cannot consume collection input and lose no saved progress',()=>fixture(({root,win})=>{
  const save=newPortSave(),scope=new PortScope('horizon',root,save,()=>true);let keys=0;
  scope.listen(win,'keydown',()=>keys++);win.dispatchEvent(new Event('keydown'));assert.equal(keys,0);
  scope.activate();win.dispatchEvent(new Event('keydown'));assert.equal(keys,1);
  scope.storage.setItem('route','NH-123');scope.deactivate();win.dispatchEvent(new Event('keydown'));
  assert.equal(keys,1);assert.equal(save.data.route,'NH-123');scope.dispose();
}));

test('the environment scopes dimensions, handlers, storage and document to its game',()=>fixture(({root})=>{
  const scope=new PortScope('ballistics',root,newPortSave(),()=>true),env=createEnvironment(()=>scope);
  assert.equal(env.document.body,root);assert.equal(env.window.innerWidth,640);assert.equal(env.window.innerHeight,400);
  (env.window as any).launch='local';assert.equal(scope.globals.launch,'local');assert.equal((globalThis.window as any).launch,undefined);
  env.localStorage.setItem('map','123456');assert.equal(scope.save.data.map,'123456');scope.dispose();
}));
