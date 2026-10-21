// Bounded proof of a camp finish on the next own turn, for <=2 unplaced men.
import assert from 'node:assert/strict';
import {newHop,hopMoves,moveHop,hopGoal,chooseHop} from '../../src/club-plus/hop.ts';
import type {HopSession,HopMove} from '../../src/club-plus/hop.ts';
import {skillChoice,seededRandom} from '../../src/skill.ts';
const hash=(n:number)=>{n=Math.imul(n^(n>>>16),0x85ebca6b);n=Math.imul(n^(n>>>13),0xc2b2ae35);return (n^(n>>>16))>>>0;};
const apply=(s:HopSession,m:HopMove)=>{const n={...s,board:s.board.slice(),positions:s.positions.slice(),last:[],history:[],records:[]};assert.ok(moveHop(n,m.from,m.to));return n;};
function finishingMove(s:HopSession,p:number):boolean {const goals=hopGoal(s,p),piece=p+1;return hopMoves(s,p).some(m=>goals.every(at=>at===m.to?true:at===m.from?false:s.board[at]===piece));}
export function campPrecheck(s:HopSession,limitMs=300):HopMove[]{
 if(s.kind!=='chinese'&&s.kind!=='halma')return [];const p=s.turn,goals=new Set(hopGoal(s,p));if(s.board.filter((v,i)=>v===p+1&&!goals.has(i)).length>2)return [];
 const deadline=performance.now()+limitMs,proven:HopMove[]=[];for(const m of hopMoves(s)){
  if(performance.now()>deadline)break;const n=apply(s,m);if(n.result!==null){if(n.result===p)proven.push(m);continue;}
  if(!finishingMove(n,p))continue;let complete=true;for(const reply of hopMoves(n)){
   if(performance.now()>deadline){complete=false;break;}const v=apply(n,reply);if(v.result!==null?v.result!==p:!finishingMove(v,p)){complete=false;break;}
  }if(complete)proven.push(m);
 }return proven;
}
function choose(s:HopSession,level:number){if(level===1)return chooseHop(s,level);const proven=campPrecheck(s);if(!proven.length)return chooseHop(s,level);const keys=new Set(proven.map(m=>m.from+':'+m.to)),ranked=[...proven,...hopMoves(s).filter(m=>!keys.has(m.from+':'+m.to))];return skillChoice(ranked,level,seededRandom(s.seed+s.moves*997));}
for(const [kind,size,ones]of [['chinese',7,[105,112,113,114,115,116,117,118,119,120]],['halma',10,[69,78,79,87,88,89,95,96,97,98]],['halma',16,[190,191,205,206,207,219,220,221,222,223,235,236,237,238,239,251,252,253,254]]] as const){
 const opening=newHop(kind,size,42),original=JSON.stringify(opening),start=performance.now();for(let i=0;i<100;i++)assert.deepEqual(campPrecheck(opening),[]);const openingMs=(performance.now()-start)/100;assert.equal(JSON.stringify(opening),original);
 const s=newHop(kind,size,42);s.board.fill(0);for(const at of ones)s.board[at]=1;for(let at=30;at<30+ones.length;at++)s.board[at]=2;const t=performance.now(),proof=campPrecheck(s),proofMs=performance.now()-t;assert.ok(proof.length);const keys=new Set(proof.map(m=>m.from+':'+m.to)),correct=Array(5).fill(0),timing=Array(5).fill(0);for(let sample=0;sample<64;sample++)for(let level=1;level<=5;level++){s.seed=hash(sample+7301);const before=JSON.stringify(s),began=performance.now(),m=choose(s,level);timing[level-1]+=performance.now()-began;assert.ok(m);assert.ok(hopMoves(s).some(n=>n.from===m.from&&n.to===m.to));assert.equal(JSON.stringify(s),before);if(keys.has(m.from+':'+m.to))correct[level-1]++;}console.log(JSON.stringify({kind,size,openingMeanPrecheckMs:openingMs,proofMs,proof:[...keys],correct,accuracy:correct.map(v=>v/64*100),meanChoiceMs:timing.map(v=>v/64),illegal:0,mutations:0}));
}
