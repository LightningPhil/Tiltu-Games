import {bridgeCross,loopCellEdges,loopEdges} from './networks.ts';
import type {LoopSession,HashiSession} from './networks.ts';
export interface NetworkHint {at:number;value:number;reason:string}
/** Corrections come before deductions so tentative mistakes cannot imply a false forced move. */
export function loopHint(s:LoopSession):NetworkHint|null {
 if(s.result!==null)return null;
 const wrong=s.edges.findIndex((v,i)=>!s.givens[i]&&v!==0&&v!==s.solution[i]);
 if(wrong>=0)return {at:wrong,value:0,reason:`Edge ${wrong+1} disagrees with the checked solution. This is a solution-based correction, not a deduction from the current marks. Clear it before following other clues.`};
 for(let cell=0;cell<s.clues.length;cell++){
  const clue=s.clues[cell];if(clue<0)continue;const edges=loopCellEdges(s.size,cell),on=edges.filter(i=>s.edges[i]===1).length,unknown=edges.filter(i=>!s.edges[i]);
  if(unknown.length&&(on===clue||on+unknown.length===clue))return {at:unknown[0],value:on===clue?-1:1,reason:`The ${clue} clue at row ${Math.floor(cell/s.size)+1}, column ${cell%s.size+1} has ${on} drawn side(s) and ${unknown.length} undecided side(s). ${on===clue?'Its count is complete, so each remaining side must be crossed.':'Every undecided side is needed to reach the clue, so draw this edge.'}`};
 }
 const geometry=loopEdges(s.size);
 for(let vertex=0;vertex<(s.size+1)**2;vertex++){
  const edges=geometry.flatMap((e,i)=>e.a===vertex||e.b===vertex?[i]:[]),on=edges.filter(i=>s.edges[i]===1).length,unknown=edges.filter(i=>!s.edges[i]);
  if(!unknown.length)continue;
  if(on===2||on===0&&unknown.length===1)return {at:unknown[0],value:-1,reason:`At the highlighted edge’s endpoint (dot row ${Math.floor(vertex/(s.size+1))+1}, column ${vertex%(s.size+1)+1}), ${on===2?'two lines already meet, so a third would branch':'only one undecided edge remains and no line enters, so drawing it would make a loose end'}. A loop uses either zero or two edges at every dot; cross this edge.`};
  if(on===1&&unknown.length===1)return {at:unknown[0],value:1,reason:'One line enters this dot and only one undecided edge can continue it. Draw that edge: every used dot needs exactly two lines.'};
 }
 const at=s.edges.findIndex(v=>!v);return at<0?null:{at,value:s.solution[at],reason:`Reveal edge ${at+1} as ${s.solution[at]===1?'a line':'a cross'} from the uniquely checked loop. No single clue or dot deduction was found; this is a solution reveal, not a claimed one-step proof.`};
}
export function hashiHint(s:HashiSession):NetworkHint|null {
 if(s.result!==null)return null;
 const wrong=s.values.findIndex((v,i)=>!s.givens[i]&&v>0&&(s.solution[i]===0||v>s.solution[i]));
 const name=(at:number)=>`islands ${s.links[at].a+1} and ${s.links[at].b+1}`;
 if(wrong>=0)return {at:wrong,value:s.solution[wrong]||-1,reason:`The connection between ${name(wrong)} disagrees with the checked solution. ${s.solution[wrong]?`It needs ${s.solution[wrong]} bridge, rather than ${s.values[wrong]}.`:'It must have no bridges.'} Correct this before adding another link. This correction uses the solution.`};
 for(let island=0;island<s.islands.length;island++){
  const incident=s.links.flatMap((e,i)=>e.a===island||e.b===island?[i]:[]),total=incident.reduce((n,i)=>n+Math.max(0,s.values[i]),0),need=s.islands[island].clue-total;
  const options=incident.filter(i=>!s.givens[i]&&s.values[i]>=0&&s.values[i]<2&&!s.links.some((_,j)=>s.values[j]>0&&bridgeCross(s,i,j)));
  const capacity=options.reduce((n,i)=>n+2-s.values[i],0);
  if(need>0&&options.length&&(options.length===1||need===capacity)){
   const at=options[0],add=options.length===1?need:2-s.values[at],value=s.values[at]+add;
   if(value<=2&&value===s.solution[at])return {at,value,reason:`Island ${island+1} needs ${s.islands[island].clue} bridges and currently has ${total}. ${options.length===1?'Only this connection has room for the remaining bridges.':`Its remaining connections have exactly ${capacity} spaces, so all are needed.`} Set ${value} bridge${value===1?'':'s'} between ${name(at)}. Bridges join nearest aligned islands and cannot cross.`};
  }
 }
 const at=s.values.findIndex((v,i)=>!s.givens[i]&&(s.solution[i]===0?v===0:Math.max(0,v)!==s.solution[i]));
 return at<0?null:{at,value:s.solution[at]||-1,reason:`Reveal ${s.solution[at]?`${s.solution[at]} bridge${s.solution[at]===1?'':'s'}`:'no bridges'} between ${name(at)} from the uniquely checked connected network. No immediate island-capacity deduction was found; this is an explicit solution reveal.`};
}
