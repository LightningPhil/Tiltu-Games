/** Exact small Backgammon races. Counts run from the one-point to six-point. */
const encode=(a:readonly number[])=>a.reduce((key,n,i)=>key+n*16**i,0);
const decode=(key:number)=>Array.from({length:6},(_,i)=>Math.floor(key/16**i)%16);
const outcomes=new Map<string,number[]>(),chances=new Map<string,number>();
function endings(counts:readonly number[],a:number,b:number):number[]{
 const key=encode(counts)+'/'+a+b,hit=outcomes.get(key);if(hit)return hit;
 const dice=a===b?[a,a,a,a]:[a,b],leaves:{key:number;used:number}[]=[];
 function walk(c:number[],left:number[],used:number):void{
  let moved=false;
  for(const die of new Set(left))for(let from=0;from<6;from++)if(c[from]){
   const to=from-die;if(to<0&&die!==from+1&&c.some((n,i)=>i>from&&n))continue;
   moved=true;const n=c.slice(),remaining=left.slice();n[from]--;if(to>=0)n[to]++;remaining.splice(remaining.indexOf(die),1);
   walk(n,remaining,used+1);
  }
  if(!moved)leaves.push({key:encode(c),used});
 }
 walk([...counts],dice,0);const maximum=Math.max(...leaves.map(v=>v.used)),unique=[...new Set(leaves.filter(v=>v.used===maximum).map(v=>v.key))];outcomes.set(key,unique);return unique;
}
export function bearoffOutcomes(counts:readonly number[],a:number,b:number):number[][]{return endings(counts,a,b).map(decode);}
/** Probability that the side about to roll wins, with optimal play on both sides. */
export function bearoffWinChance(own:readonly number[],enemy:readonly number[],stop:()=>void=()=>{}):number{
 function solve(a:number,b:number):number{
  if(!a)return 1;if(!b)return 0;const key=a+'/'+b,hit=chances.get(key);if(hit!==undefined)return hit;stop();
  const counts=decode(a);let result=0;
  for(let first=1;first<=6;first++)for(let second=first;second<=6;second++){
   let best=0;for(const next of endings(counts,first,second))best=Math.max(best,next===0?1:1-solve(b,next));
   result+=best*(first===second?1:2)/36;
  }
  result=Math.max(0,Math.min(1,result));chances.set(key,result);return result;
 }
 return solve(encode(own),encode(enemy));
}
