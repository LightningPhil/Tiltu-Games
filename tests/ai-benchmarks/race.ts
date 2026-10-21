// Research prototype only; uses public state and sampled future dice, never live RNG order.
import {newRace,raceMoves,castRace,moveRace,raceFinish} from '../../src/club-plus/race.ts';
import {chooseRace} from '../../src/club-plus/race.ts';
import type {RaceSession} from '../../src/club-plus/race.ts';
import {skillChoice,seededRandom} from '../../src/skill.ts';
const hash=(n:number)=>{n=Math.imul(n^(n>>>16),0x85ebca6b);n=Math.imul(n^(n>>>13),0xc2b2ae35);return (n^(n>>>16))>>>0;};
const clone=(s:RaceSession):RaceSession=>({...s,pawns:s.pawns.map(a=>a.slice()),dice:s.dice.slice(),last:[],history:[],records:[]});
const weights=[1,4,6,4,1],forced=weights.map((_,r)=>Array.from({length:4},(_,i)=>i<r?1:0));
const tables=new Map<string,number[]>();
function costTable(kind:RaceSession['kind']){
 if(tables.has(kind))return tables.get(kind)!;const end=raceFinish(kind),e=Array.from({length:end+2},(_,i)=>Math.max(0,end-i+1));e[end+1]=0;
 for(let iteration=0;iteration<1500;iteration++){let difference=0;for(let pos=end-1;pos>=-1;pos--){if(kind==='senet'&&pos<0)continue;let value=1;for(let r=0;r<5;r++){const roll=kind==='senet'&&!r?5:r;let to=pos+roll;if(kind==='senet'){if((pos===27&&roll!==3)||(pos===28&&roll!==2)||(pos===29&&roll!==1)||to>end||(pos<25&&to>25))to=pos;if(to===26)to=14;}else if(!roll||to>end)to=pos;value+=weights[r]/16*e[to+1];}difference=Math.max(difference,Math.abs(e[pos+1]-value));e[pos+1]=value;}if(difference<1e-10)break;}tables.set(kind,e);return e;
}
function evaluate(s:RaceSession,p:number){if(s.result!==null)return s.result===p?10000:-10000;const e=costTable(s.kind),costs=s.pawns.map(a=>a.reduce((n,pos)=>n+e[pos+1],0));return costs[1-p]-costs[p]+(s.turn===p?.8:-.8);}
function rankedCost(s:RaceSession){const p=s.turn;return raceMoves(s).map(m=>{const n=clone(s);moveRace(n,m);return {m,n,value:evaluate(n,p)};}).sort((a,b)=>b.value-a.value);}
// Freeze the pre-port level3 reference so measurements remain reproducible after production changes.
function oldLevelThree(s:RaceSession){const p=s.turn,end=raceFinish(s.kind),ranked=raceMoves(s).map(m=>{const n=clone(s);moveRace(n,m);const values=n.pawns.map(a=>a.reduce((sum,pos)=>sum+(pos===end?end+45:pos<0?-8:pos)+(n.kind==='ur'&&[3,7,13].includes(pos)?7:0)+(n.kind==='senet'&&a.some(x=>x!==pos&&Math.abs(x-pos)===1)?3:0),0));return {m,n,value:n.result!==null?(n.result===p?10000:-10000):values[p]-values[1-p]};}).sort((a,b)=>b.value-a.value);if(ranked[0]?.n.result===p)return ranked[0].m;return skillChoice(ranked,3,seededRandom(s.seed+s.moves*997)).m;}
function expected(s:RaceSession,p:number,d:number):number{
 if(s.result!==null||d<=0)return evaluate(s,p);let total=0;for(let r=0;r<5;r++){const n=clone(s);castRace(n,forced[r]);let value;if(n.phase==='move'){const choices=raceMoves(n).map(m=>{const v=clone(n);moveRace(v,m);return expected(v,p,d-1);});value=n.turn===p?Math.max(...choices):Math.min(...choices);}else value=expected(n,p,d-1);total+=weights[r]/16*value;}return total;
}
function rollout(start:RaceSession,p:number,seed:number){const s=clone(start),rng=seededRandom(seed);let actions=0;while(s.result===null&&actions++<350){if(s.phase==='roll'){const f=Array.from({length:4},()=>rng()<.5?0:1);castRace(s,f);}else{const rank=rankedCost(s);if(!rank.length)throw Error('No rollout move');moveRace(s,rank[0].m);}s.history=[];s.records=[];}return s.result===p?1:s.result!==null?-1:Math.tanh(evaluate(s,p)/12);}
let simChoices=0;
export function prototypeChoose(s:RaceSession,level:number,method:string){const legal=raceMoves(s);if(!legal.length)return null;const rng=seededRandom(s.seed+s.moves*997);if(level===1)return legal[Math.floor(rng()*legal.length)];if(legal.length===1)return legal[0];const p=s.turn,rank=rankedCost(s);if(rank[0].n.result===p&&level>=3)return rank[0].m;
 if(method==='expert'){const top=chooseRace(s,5)!;rank.sort((a,b)=>a.m===top?-1:b.m===top?1:0);}
 if(method==='expect')for(const item of rank)item.value=expected(item.n,p,2);
 if(method.startsWith('mc')){const samples=Number(method.slice(2))||64;for(const item of rank){item.value=0;for(let trial=0;trial<samples;trial++)item.value+=rollout(item.n,p,hash((s.seed^0xa511e9b3)+trial*7919));simChoices++;}}
 if(method!=='expert')rank.sort((a,b)=>b.value-a.value);return skillChoice(rank,level,rng).m;
}
const method=process.argv[2]??'cost',opponentLabel=process.argv[3]??'5',opponent=Number(opponentLabel),seeds=Number(process.argv[4]??32),all=process.argv[5]==='all',only=process.argv[6];const started=performance.now();
if(method==='fidelity'){
 let decisions=0;for(const kind of ['ur','senet'] as const){let s=newRace(kind,2,hash(6301)),positions=0;const rng=seededRandom(hash(6302));while(positions<96){if(s.result!==null){s=newRace(kind,2,hash(6301+positions));continue;}if(s.phase==='roll'){castRace(s);continue;}const v=clone(s);v.seed=hash(positions+6701);for(let level=1;level<=5;level++){const before=JSON.stringify(v),actual=chooseRace(v,level),reference=prototypeChoose(v,level,'cost');if(actual!==reference)throw Error(`${kind} position${positions} level${level}: ${actual} !== ${reference}`);if(JSON.stringify(v)!==before)throw Error('Mutated source');if(actual===null||!raceMoves(v).includes(actual))throw Error('Illegal choice');decisions++;}positions++;const legal=raceMoves(s);moveRace(s,legal[Math.floor(rng()*legal.length)]);s.history=[];s.records=[];}console.log(JSON.stringify({kind,positions,decisions,match:'100%',mutations:0,illegal:0}));}process.exit(0);
}
for(const kind of ['ur','senet'] as const){if(only&&only!==kind)continue;const results=[];for(const level of all?[1,2,3,4,5]:[5]){let wins=0,losses=0,unfinished=0,actions=0;for(let seed=1;seed<=seeds;seed++)for(const seat of [0,1]){
 const s=newRace(kind,2,hash(seed+2301)),end=raceFinish(kind),fixtures=kind==='ur'?[[[2,5],[4,8]],[[7,9],[8,11]],[[3,9],[6,10]],[[8,10],[9,11]]]:[[[10,19],[11,20]],[[18,24],[19,25]],[[23,25],[24,27]],[[4,11],[8,15]]],active=fixtures[(seed-1)%4];s.pawns=active.map(a=>[...a,...Array(s.pawns[0].length-2).fill(end)]);let turns=0;
 while(s.result===null&&turns++<500){if(s.phase==='roll')castRace(s);else{const m=s.turn===seat?prototypeChoose(s,level,method):opponentLabel==='old3'?oldLevelThree(s):chooseRace(s,opponent);if(m===null||!moveRace(s,m))throw Error('Illegal prototype move');}s.history=[];s.records=[];}actions+=turns;if(s.result===seat)wins++;else if(s.result!==null)losses++;else unfinished++;
 }results.push({level,wins,losses,unfinished,actions,score:+(wins/(2*seeds)*100).toFixed(2)});}console.log(JSON.stringify({kind,method,opponent:opponentLabel,seeds,pairedSeats:true,results,elapsedMs:Math.round(performance.now()-started),simChoices,costs:costTable(kind)}));}
