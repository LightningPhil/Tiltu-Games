import test from 'node:test';
import assert from 'node:assert/strict';
import {cardName} from '../src/cards.ts';
import {newPlus} from '../src/club-plus/store.ts';
import type {PlusSession} from '../src/club-plus/store.ts';
import type {PlusGame} from '../src/club-plus/meta.ts';
import {plusSuggestion} from '../src/club-plus/suggestion.ts';
import {explainPlusSuggestion} from '../src/club-plus/guidance.ts';
import {playAbstract} from '../src/club-plus/abstracts.ts';
import {castRace,moveRace} from '../src/club-plus/race.ts';
import {moveHop} from '../src/club-plus/hop.ts';
import {playDomino,drawDomino,passDomino} from '../src/club-plus/dominoes.ts';
import {passHearts,bidSpades,playTrick,collectTrick} from '../src/club-plus/tricks.ts';
import {drawGin,discardGin,passGinOffer} from '../src/club-plus/gin.ts';
import {flipMemory} from '../src/club-plus/playful.ts';

type Suggestion=ReturnType<typeof plusSuggestion>;
const raceKinds=['snakes','senet','ur','ludo'];
const continuationKinds=['senet','ur','ludo','gin','spades','hearts','whist','dominoes'];

/** Use the public rules actions, rather than duplicating move legality in a test. */
function applySuggestion(s:PlusSession,result:Suggestion):boolean {
  if(result.cards)return s.kind==='hearts'&&passHearts(s,result.cards);
  if(result.entry)return (s.kind==='kakuro'||s.kind==='futoshiki'||s.kind==='skyscrapers')&&
    (result.entry.value===0||s.solution[result.entry.at]===result.entry.value);
  if(!result.command)return true;
  const [action,a,b]=result.command.split(':'),at=Number(a);
  switch(action){
    case 'abstract':return (s.kind==='gomoku'||s.kind==='hex'||s.kind==='nim')&&playAbstract(s,at);
    case 'race-roll':return raceKinds.includes(s.kind)&&castRace(s as Parameters<typeof castRace>[0]);
    case 'race-move':return raceKinds.includes(s.kind)&&moveRace(s as Parameters<typeof moveRace>[0],at);
    case 'hop-move':return (s.kind==='chinese'||s.kind==='halma'||s.kind==='fox'||s.kind==='tafl')&&moveHop(s,at,Number(b));
    case 'domino-play':return s.kind==='dominoes'&&playDomino(s,{tile:at,end:Number(b) as 0|1});
    case 'domino-draw':return s.kind==='dominoes'&&drawDomino(s);
    case 'domino-pass':return s.kind==='dominoes'&&passDomino(s);
    case 'spades-bid':return s.kind==='spades'&&bidSpades(s,at);
    case 'trick-card':return (s.kind==='hearts'||s.kind==='spades'||s.kind==='whist')&&playTrick(s,at);
    case 'gin-draw':return s.kind==='gin'&&(a==='stock'||a==='discard')&&drawGin(s,a);
    case 'gin-pass':return s.kind==='gin'&&passGinOffer(s);
    case 'gin-play':return s.kind==='gin'&&discardGin(s,at,b==='1');
    case 'memory':return s.kind==='memory'&&flipMemory(s,at);
    default:return false;
  }
}

function assertSpecificExplanation(result:Suggestion,text:string):void {
  assert.ok(text.length>35,'the tutor should explain its reasoning');
  assert.doesNotMatch(text,/^Review the visible position|no longer legal|no longer available|cannot be played now|unavailable;/i);
  if(result.cards){
    for(const card of result.cards)assert.ok(text.includes(cardName(card)),'identify every recommended card');
    assert.match(text,/penalty|suit|high cards/i);
    return;
  }
  const [action,a,b]=result.command!.split(':'),at=Number(a);
  switch(action){
    case 'abstract':assert.match(text,/pile|row|pie rule/i);break;
    case 'race-roll':assert.match(text,/cast|roll/i);break;
    case 'race-move':assert.ok(text.includes(`counter ${at+1}`));assert.match(text,/rolled|roll/i);break;
    case 'hop-move':assert.ok(text.includes(`point ${at+1}`));assert.ok(text.includes(`to ${Number(b)+1}`));break;
    case 'domino-play':assert.match(text,/matching|required opening/);break;
    case 'domino-draw':case 'domino-pass':assert.match(text,/fits|matches|draw|pass/i);break;
    case 'trick-card':assert.ok(text.includes(cardName(at)));assert.match(text,/suit|lead|trick/);break;
    case 'spades-bid':assert.ok(text.includes(at===0?'Nil':`${at} tricks`));assert.match(text,/spades|trump|high-card/);break;
    case 'gin-play':assert.ok(text.includes(cardName(at)));assert.match(text,/deadwood|Gin/);break;
    case 'gin-draw':case 'gin-pass':assert.match(text,/upcard|discard pile|stock|deadwood/);break;
    case 'memory':assert.ok(text.includes(`tile ${at+1}`));assert.match(text,/remembered|revealed|exploratory/);break;
    default:assert.fail(`No explanation coverage for ${action}`);
  }
}

const configurations:[string,PlusGame,Record<string,unknown>][]=[
  ['Gomoku','gomoku',{}],['Hex','hex',{}],
  ['normal Nim','nim',{}],['misère Nim','nim',{variant:'misere'}],['take-up-to-three Nim','nim',{variant:'subtract'}],
  ['Senet','senet',{}],['Royal Game of Ur','ur',{}],['two-player Ludo','ludo',{players:2}],['four-player Ludo','ludo',{players:4}],
  ['Chinese Chequers','chinese',{}],['compact Halma','halma',{size:10}],['classic Halma','halma',{size:16}],
  ['Fox and Geese','fox',{human:0}],['Hnefatafl','tafl',{human:0}],
  ['draw Dominoes','dominoes',{variant:'draw'}],['block Dominoes','dominoes',{variant:'block'}],['fives Dominoes','dominoes',{variant:'fives'}],
  ['Hearts','hearts',{}],['Spades','spades',{}],['Whist','whist',{}],['Gin Rummy','gin',{}],['Memory Pairs','memory',{}],
  ['Kakuro','kakuro',{size:7}],['Futoshiki','futoshiki',{size:4}],['Skyscrapers','skyscrapers',{size:4}],
];

// 58 successive recommendations, including bidding, passing, drawing and play.
for(const [label,kind,options] of configurations)test(`${label}: tutor actions are legal, explained and leave the position untouched`,()=>{
  const s=newPlus(kind,options,1234),turns=continuationKinds.includes(kind)?4:1;
  for(let turn=0;turn<turns&&s.result===null;turn++){
    if((s.kind==='hearts'||s.kind==='spades'||s.kind==='whist')&&s.phase==='collect'){
      assert.equal(collectTrick(s),true);continue;
    }
    const before=structuredClone(s),result=plusSuggestion(s,5);
    assert.ok(result.command||result.cards?.length||result.entry,'a playable position should receive actionable guidance');
    assert.deepEqual(s,before,'choosing advice must not change the game or future random sequence');
    if(result.command||result.cards)assertSpecificExplanation(result,explainPlusSuggestion(s,result));
    if(result.entry){assert.ok(result.entry.reason.length>35);assert.ok(!s.givens[result.entry.at]);}
    assert.deepEqual(s,before,'explaining advice must not change the game');
    assert.equal(applySuggestion(s,result),true,JSON.stringify(result));
  }
});

/** Change only information covered from the advising player. Public Whist trump stays in place. */
function permuteHiddenInformation(s:PlusSession):PlusSession {
  const copy=structuredClone(s);
  if(copy.kind==='memory'){
    const ids=copy.deck.flatMap((_,i)=>copy.known[i]<0&&!copy.matched[i]&&!copy.flipped.includes(i)?[i]:[]),faces=ids.map(i=>copy.deck[i]).reverse();
    ids.forEach((at,i)=>copy.deck[at]=faces[i]);return copy;
  }
  if(copy.kind==='dominoes'||copy.kind==='gin'){
    const other=1-copy.turn,shown=copy.kind==='gin'?copy.knownTakes[other]:[],slots=copy.hands[other].flatMap((c,i)=>shown.includes(c)?[]:[i]);
    const cards=[...slots.map(i=>copy.hands[other][i]),...copy.stock].reverse();
    slots.forEach((at,i)=>copy.hands[other][at]=cards[i]);copy.stock=cards.slice(slots.length);return copy;
  }
  assert.ok(copy.kind==='hearts'||copy.kind==='spades'||copy.kind==='whist');
  const player=copy.kind==='hearts'&&copy.phase==='pass'?0:copy.turn;
  const slots=copy.hands.flatMap((hand,p)=>p===player?[]:hand.flatMap((card,i)=>copy.kind==='whist'&&p===copy.dealer&&card===copy.exposed?[]:[{p,i}]));
  const cards=slots.map(({p,i})=>copy.hands[p][i]).reverse();slots.forEach(({p,i},n)=>copy.hands[p][i]=cards[n]);return copy;
}

// 48 paired positions: the recommendation AND its explanation must be identical.
for(const kind of ['dominoes','gin','hearts','spades','whist','memory'] as const)test(`${kind}: tutor cannot use covered cards or unexposed memory faces`,()=>{
  for(let seed=1;seed<=8;seed++){
    const s=newPlus(kind,{},seed),other=permuteHiddenInformation(s),a=plusSuggestion(s,5),b=plusSuggestion(other,5);
    assert.deepEqual(b,a,`covered-information permutation changed seed ${seed}'s recommendation`);
    assert.equal(explainPlusSuggestion(other,b),explainPlusSuggestion(s,a),`covered-information permutation changed seed ${seed}'s explanation`);
  }
});
