import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/tetrigrid/game.ts';
import { Storage, defaults, saveRecord, type Records } from '../src/tetrigrid/storage.ts';

test('unavailable local storage leaves preferences and sessions usable for the visit',() => {
  const storage=new Storage();assert.deepEqual(storage.settings(),defaults);assert.equal(storage.available,false);
  storage.write('settings',{...defaults,mode:'zen',sound:false});assert.equal(storage.settings().mode,'zen');assert.equal(storage.settings().sound,false);
  const game=new Game('marathon');storage.write('session',game.snapshot());assert.ok(storage.session());
});
test('malformed preferences and records cannot break app startup',() => {
  const storage=new Storage();storage.memory.set('settings','{');assert.deepEqual(storage.settings(),defaults);
  storage.write('settings',{mode:'constructor',volume:Infinity,ghost:'yes',handling:'wild'});assert.deepEqual(storage.settings(),defaults);
  storage.write('records',{marathon:[null,{score:-1,lines:3,elapsed:10,pieces:1,date:'bad'}, {score:300,lines:3,elapsed:1000,pieces:5,date:'2026-10-14'}]});
  assert.equal(storage.records().marathon?.length,1);
});
test('corrupt JSON is distinct from blocked storage, and quota failures prefer visit memory',() => {
  const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const data=new Map<string,string>();let quota=false;
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string) => data.get(key) ?? null,setItem:(key:string,value:string) => {if(quota) throw new Error('Quota exceeded');data.set(key,value);}}});
  try {
    data.set('tetra_grid_v2_settings','{');const storage=new Storage();assert.deepEqual(storage.settings(),defaults);assert.equal(storage.available,true);
    storage.write('settings',defaults);quota=true;storage.write('settings',{...defaults,mode:'zen'});
    assert.equal(storage.available,false);assert.equal(storage.settings().mode,'zen');
  } finally {if(previous) Object.defineProperty(globalThis,'localStorage',previous);else Reflect.deleteProperty(globalThis,'localStorage');}
});
test('records rank sprint by completion time and score modes by points, retaining five',() => {
  let records: Records={};
  for(let i=0;i<8;i++) {const game=new Game('marathon');game.score=i*100;game.ended='topout';records=saveRecord(records,game).records;}
  assert.deepEqual(new Storage().records(),{});
  assert.deepEqual(records.marathon?.map(r => r.score),[700,600,500,400,300]);
  const sprint=new Game('sprint');sprint.lines=40;sprint.ended='complete';sprint.elapsed=90000;
  const a=saveRecord({},sprint);assert.equal(a.best,true);sprint.elapsed=80000;const b=saveRecord(a.records,sprint);
  assert.equal(b.best,true);assert.equal(b.records.sprint?.[0].elapsed,80000);
  sprint.ended='topout';assert.equal(saveRecord(b.records,sprint).records.sprint?.length,2);
  assert.deepEqual(saveRecord({},new Game('zen')).records,{});
});
test('music migration restores the original mix once, then respects deliberate mute choices',()=> {
  const storage=new Storage();storage.write('settings',{mode:'zen',music:false,volume:0.35});
  const migrated=storage.settings();assert.equal(migrated.music,true);assert.equal(migrated.musicTrack,'classic-house');assert.equal(migrated.volume,0.5);assert.equal(migrated.mode,'zen');
  storage.write('settings',{...migrated,music:false,musicTrack:'midnight-groove',musicVolume:0.7,effectsVolume:0.4});
  const restored=storage.settings();assert.equal(restored.music,false);assert.equal(restored.musicTrack,'midnight-groove');assert.equal(restored.musicVolume,0.7);assert.equal(restored.effectsVolume,0.4);
  storage.write('settings',{...defaults,musicTrack:'constructor',musicVolume:-1,effectsVolume:4});
  assert.equal(storage.settings().musicTrack,'classic-house');assert.equal(storage.settings().musicVolume,0);assert.equal(storage.settings().effectsVolume,1);
});

test('the Bach-inspired music choice persists with independent sound levels',()=> {
  const storage=new Storage();storage.write('settings',{...defaults,musicTrack:'cello-flow',musicVolume:0.8,effectsVolume:0.3});
  const restored=storage.settings();assert.equal(restored.musicTrack,'cello-flow');assert.equal(restored.musicVolume,0.8);assert.equal(restored.effectsVolume,0.3);
  assert.equal(defaults.musicTrack,'classic-house');
});
