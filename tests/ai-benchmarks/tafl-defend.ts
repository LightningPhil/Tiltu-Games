// Complete three-ply forcing-escape reference, all opponent replies, eight symmetries.
import assert from 'node:assert/strict';
import {newHop,chooseHop,hopMoves,moveHop} from '../../src/club-plus/hop.ts';
import type {HopSession,HopMove} from '../../src/club-plus/hop.ts';
const hash=(n:number)=>{n=Math.imul(n^(n>>>16),0x85ebca6b);n=Math.imul(n^(n>>>13),0xc2b2ae35);return (n^(n>>>16))>>>0;};
const apply=(s:HopSession,m:HopMove)=>{const n={...s,board:s.board.slice(),positions:s.positions.slice(),last:[],history:[],records:[]};assert.ok(moveHop(n,m.from,m.to));return n;};
const finish=(s:HopSession)=>hopMoves(s,0).some(m=>s.board[m.from]===3&&[0,6,42,48].includes(m.to));
const base=Array(49).fill(0);base[8]=3;base[17]=base[25]=1;base[22]=base[31]=base[39]=2;
const correct=Array(5).fill(0),counts=Array(5).fill(0),details=[],started=performance.now(),samples=64;for(let symmetry=0;symmetry<4;symmetry++){
 const s=newHop('tafl',7,42);s.turn=0;s.board.fill(0);base.forEach((v,i)=>{let r=Math.floor(i/7),c=i%7;if(symmetry&1)r=6-r;if(symmetry&2)c=6-c;if(symmetry&4)[r,c]=[c,r];s.board[r*7+c]=v;});assert.ok(!finish(s));const outcomes=hopMoves(s).map(m=>{const n=apply(s,m);if(n.result!==null)return {m,value:n.result===0?1:-1};let value=1;for(const reply of hopMoves(n)){const v=apply(n,reply);if(v.result!==null?v.result!==0:!finish(v)){value=0;break;}}return {m,value};});assert.ok(outcomes.some(o=>o.value===1));assert.ok(outcomes.some(o=>o.value<1));
 for(let sample=0;sample<samples;sample++)for(let level=1;level<=5;level++){if(level===5&&sample>0)continue;s.seed=hash(sample+7301);const before=JSON.stringify(s),m=chooseHop(s,level);assert.ok(m);assert.equal(JSON.stringify(s),before);const outcome=outcomes.find(o=>o.m.from===m.from&&o.m.to===m.to);assert.ok(outcome);counts[level-1]++;if(outcome.value===1)correct[level-1]++;}details.push({symmetry,board:s.board.join(''),winning:outcomes.filter(o=>o.value===1).map(o=>[o.m.from,o.m.to])});console.log(JSON.stringify({symmetry,elapsedMs:Math.round(performance.now()-started)}));
}console.log(JSON.stringify({type:'tafl-forced-three-ply',positions:4,counts,expertDeterministic:true,correct,accuracy:correct.map((v,i)=>v/counts[i]*100),elapsedMs:Math.round(performance.now()-started),details}));
