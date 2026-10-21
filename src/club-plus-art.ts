/** Original, theme-aware miniatures for the second Grid Club collection. */
const P = 'var(--p1)', Q = 'var(--p2)', A = 'var(--accent)';
const I = 'var(--text)', L = 'var(--line)', C = 'var(--cell)';
const PAPER = 'var(--piece-light,var(--surface))';
const EDGE = 'var(--piece-light-edge,var(--text))';
const path = (d: string, colour = L, width = 1, attrs = '') => `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${attrs}/>`;
const svg = (body: string, box = '0 0 160 100', cls = '') => `<svg${cls ? ` class="${cls}"` : ''} viewBox="${box}" aria-hidden="true" focusable="false">${body}</svg>`;
const inside = (graphic: string) => graphic.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
const number = (x: number, y: number, value: string | number, size = 9, colour = I) => `<text x="${x}" y="${y}" fill="${colour}" text-anchor="middle" font-family="Consolas,monospace" font-weight="600" font-size="${size}">${value}</text>`;
const frame = (x: number, y: number, w: number, h: number, r = 6) => `<rect class="art-frame" x="${x}" y="${y + 2}" width="${w}" height="${h}" rx="${r}"/><rect class="art-frame" x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>${path(`M${x + 5} ${y + 10}v-3q0-3 3-3h${w - 20}`, '#fff', .7, 'opacity=".24"')}`;

function marble(x: number, y: number, colour = P, radius = 4): string {
  return `<ellipse cx="${x + .6}" cy="${y + 1.3}" rx="${radius}" ry="${radius * .8}" fill="#000" opacity=".24"/><circle cx="${x}" cy="${y}" r="${radius}" fill="${colour}" stroke="${I}" stroke-opacity=".25" stroke-width=".6"/><ellipse cx="${x - radius * .25}" cy="${y - radius * .34}" rx="${radius * .4}" ry="${radius * .23}" fill="#fff" opacity=".48"/>`;
}

const PIPS: [number, number][][] = [[], [[16,16]], [[9,9],[23,23]], [[9,9],[16,16],[23,23]], [[9,9],[23,9],[9,23],[23,23]], [[9,9],[23,9],[16,16],[9,23],[23,23]], [[9,8],[23,8],[9,16],[23,16],[9,24],[23,24]]];
const pipValue = (n: number) => Number.isFinite(n) ? Math.max(0, Math.min(6, Math.round(n))) : 0;
function dominoBody(a: number, b: number): string {
  const dots = (n: number, y: number) => PIPS[pipValue(n)].map(([x,v])=>`<circle cx="${x}" cy="${v+y+.5}" r="2.2" fill="${EDGE}" opacity=".24"/><circle cx="${x}" cy="${v+y}" r="2" fill="${EDGE}"/>`).join('');
  return `<rect x="2" y="4" width="32" height="64" rx="4.5" fill="var(--board)" stroke="${L}"/><rect x="1" y="1" width="32" height="64" rx="4.5" fill="${PAPER}" stroke="${EDGE}" stroke-width="1"/>${path('M5 16V8q0-3 3-3h14', '#fff', 1, 'opacity=".65"')}${path('M5 33h24', EDGE, .9)}<circle cx="17" cy="33" r="1" fill="${A}"/>${dots(a,1)}${dots(b,33)}`;
}

/** A complete double-six domino, blank halves included; values clamp to 0–6. */
export function dominoGraphic(a: number, b: number): string {
  return svg(dominoBody(a,b), '0 0 36 70', 'plus-domino');
}

function pawnBody(colour: string): string {
  return `<ellipse cx="32" cy="57" rx="21" ry="4" fill="#000" opacity=".2"/><path d="M23 26h18l-5 8q-1 9 9 16l3 6H16l3-6q10-7 9-16Z" fill="${colour}" stroke="${I}" stroke-opacity=".3" stroke-width="1.2"/><ellipse cx="32" cy="53" rx="15" ry="3.2" fill="#000" opacity=".12"/><circle cx="32" cy="18" r="11" fill="${colour}" stroke="${I}" stroke-opacity=".3" stroke-width="1.2"/>${path('M25 17q0-7 8-7M25 38q-1 7-5 11M21 54h20', '#fff', 1.8, 'opacity=".42"')}${path('M23 29h18', I, 1, 'opacity=".22"')}`;
}

/** Turned race-game pawn. Side 0 uses player one; any other side uses player two. */
export function racePawn(side: number): string {
  return svg(pawnBody(side === 0 ? P : Q), '0 0 64 64', `race-pawn pawn-${side === 0 ? 'one' : 'two'}`);
}

/** Split casting sticks: zero shows the dark rounded back; nonzero the pale face. */
export function castingSticks(values: number[]): string {
  const sticks = values.slice(0,8);
  const width = Math.max(1,sticks.length) * 17 + 8;
  return svg(sticks.map((v,i)=>`<g transform="translate(${i * 17 + 4} 5) rotate(${i % 2 ? 4 : -4} 6 32)"><rect x="1" y="2" width="11" height="63" rx="5.5" fill="#000" opacity=".2"/><rect width="11" height="63" rx="5.5" fill="${v ? PAPER : 'var(--board)'}" stroke="${v ? EDGE : A}" stroke-width=".9"/>${path('M3 12V7q0-3 3-3', '#fff', .8, 'opacity=".55"')}${v ? `${path('M3 17h5M3 47h5', EDGE, .7)}<path d="m5.5 25 2.5 6-2.5 6-2.5-6Z" fill="${P}" opacity=".7"/>` : path('M5.5 10v44', A, .8, 'opacity=".4"')}</g>`).join(''), `0 0 ${width} 78`, 'casting-sticks');
}

function snakesArt(): string {
  const tiles = Array.from({length:36},(_,i)=>{
    const row=Math.floor(i/6), col=i%6, x=40+col*13,y=10+row*13;
    return `<rect x="${x}" y="${y}" width="13" height="13" fill="${(col+row)%2?'var(--raised)':C}" stroke="${L}" stroke-width=".35"/>${number(x+3.5,y+4.5,(5-row)*6+(row%2?col+1:6-col),3.7,'var(--muted)')}`;
  }).join('');
  return `${frame(35,5,88,89)}${tiles}${path('M53 72 75 22M59 75 81 25', A, 2.1)}${Array.from({length:6},(_,i)=>path(`M${56+i*3.5} ${66-i*8}l6 3`, A, 1.4)).join('')}${path('M100 24c-19 2 8 20-7 24s-5 18-14 20', '#000', 6, 'opacity=".16" transform="translate(1 1)"')}${path('M100 24c-19 2 8 20-7 24s-5 18-14 20', Q, 4.8)}<ellipse cx="102" cy="23" rx="5.2" ry="3.8" fill="${Q}"/><circle cx="104" cy="21.8" r=".7" fill="${I}"/>${path('M107 24h3m0 0 2-1m-2 1 2 1', Q, .7)}<g transform="translate(34 61) scale(.34)">${pawnBody(P)}</g>`;
}

function senetArt(): string {
  const squares = Array.from({length:30},(_,i)=>`<rect x="${21+i%10*12}" y="${19+Math.floor(i/10)*15}" width="12" height="15" fill="${i%2?C:'var(--raised)'}" stroke="${L}" stroke-width=".5"/>`).join('');
  const cone=(x:number,y:number,colour:string)=>`<ellipse cx="${x}" cy="${y+5}" rx="4.4" ry="2" fill="#000" opacity=".2"/><path d="m${x} ${y-9} 4 12q-4 3-8 0Z" fill="${colour}" stroke="${I}" stroke-opacity=".25" stroke-width=".6"/>${path(`M${x-1} ${y-5}l-1 6`, '#fff', .6, 'opacity=".6"')}`;
  return `${frame(15,12,132,59,6)}${squares}${path('M25 55h7m-6-3 3 3-3 3M38 53q3-5 6 0m-6 3q3-5 6 0M50 51l3 7 3-7m6 1h6m-3 0v7M76 52l-3 3 3 3 3-3Z', A, .9)}${cone(27,29,P)}${cone(63,44,P)}${cone(111,29,P)}${marble(51,26,Q,4.8)}${marble(99,41,Q,4.8)}${marble(123,56,Q,4.8)}<g transform="translate(53 73) rotate(-5) scale(.51 .24)">${inside(castingSticks([1,0,1,0]))}</g>${path('M21 65h120', A, .5, 'opacity=".4"')}`;
}

function ludoArt(): string {
  const colours=[P,Q,'color-mix(in srgb,var(--p1) 45%,var(--text))','color-mix(in srgb,var(--p2) 45%,var(--text))'];
  const camps=[[39,9],[90,9],[90,60],[39,60]].map(([x,y],i)=>`<rect x="${x}" y="${y}" width="32" height="32" rx="3" fill="${colours[i]}" opacity=".24"/><rect x="${x+5}" y="${y+5}" width="22" height="22" rx="3" fill="${C}"/>${[0,1,2,3].map(j=>marble(x+11+j%2*10,y+11+Math.floor(j/2)*10,colours[i],3.4)).join('')}`).join('');
  let track='';
  for(let r=0;r<13;r++)for(let c=0;c<13;c++)if((c>=5&&c<=7)||(r>=5&&r<=7))track+=`<rect x="${39+c*6.4}" y="${9+r*6.4}" width="6.4" height="6.4" fill="${r===6&&c<6?P:c===6&&r<6?Q:r===6&&c>6?colours[2]:c===6&&r>6?colours[3]:C}" stroke="${L}" stroke-width=".4"/>`;
  return `${frame(34,4,93,93)}${camps}${track}<path d="m71 41 9.6 9.6-9.6 9.6Z" fill="${P}"/><path d="m71 41 9.6 9.6 9.6-9.6Z" fill="${Q}"/><path d="m90.2 41-9.6 9.6 9.6 9.6Z" fill="${colours[2]}"/><path d="m71 60.2 9.6-9.6 9.6 9.6Z" fill="${colours[3]}"/>${marble(55,50,P,3)}${marble(81,24,Q,3)}${marble(106,44,colours[2],3)}`;
}

function dominoesArt(): string {
  return `<ellipse cx="80" cy="88" rx="61" ry="4" fill="#000" opacity=".12"/><g transform="translate(26 13) rotate(-17 10 24) scale(.78)">${dominoBody(6,4)}</g><g transform="translate(60 20) rotate(14 10 24) scale(.78)">${dominoBody(4,2)}</g><g transform="translate(93 29) rotate(-13 10 24) scale(.78)">${dominoBody(2,5)}</g><g transform="translate(113 66) rotate(75 10 24) scale(.58)">${dominoBody(5,5)}</g>`;
}

function chineseArt(): string {
  const rows=[1,2,3,4,13,12,11,10,9,10,11,12,13,4,3,2,1];
  let holes='';
  rows.forEach((count,r)=>{
    for(let c=0;c<count;c++) {
      const x=80+(c-(count-1)/2)*7.5,y=8+r*5.2;
      holes+=`<circle cx="${x}" cy="${y}" r="2.55" fill="${C}" stroke="${L}" stroke-width=".5"/>`;
      if(r<4)holes+=marble(x,y,P,2.6);
      if(r>12)holes+=marble(x,y,Q,2.6);
      if((r>=4&&r<=6&&c<7-r)||(r>=10&&r<=12&&c>count-(r-8)))holes+=marble(x,y,'color-mix(in srgb,var(--p1) 45%,var(--text))',2.6);
      if((r>=4&&r<=6&&c>count-(7-r))||(r>=10&&r<=12&&c<r-9))holes+=marble(x,y,'color-mix(in srgb,var(--p2) 45%,var(--text))',2.6);
    }
  });
  return `<path class="art-frame" d="m80 2 19 25h35l-17 24 17 25H99L80 99 61 76H26l17-25-17-24h35Z" stroke-linejoin="round"/>${holes}${marble(80,49,P,2.8)}${marble(91.25,64.2,Q,2.8)}`;
}

function rosette(x:number,y:number):string {
  return `${Array.from({length:8},(_,i)=>`<ellipse cx="${x}" cy="${y-3}" rx="1.2" ry="2.5" transform="rotate(${i*45} ${x} ${y})" fill="${A}" opacity=".8"/>`).join('')}<circle cx="${x}" cy="${y}" r="1.6" fill="${C}" stroke="${A}" stroke-width=".6"/>`;
}

function urArt(): string {
  let board='';
  for(let r=0;r<3;r++)for(let c=0;c<8;c++)if(r===1||c<4||c>5){
    const x=22+c*14,y=22+r*15;
    board+=`<rect x="${x}" y="${y}" width="13.5" height="14.5" fill="${C}" stroke="${A}" stroke-opacity=".45" stroke-width=".7"/>`;
    if((c===0&&r!==1)||(c===3&&r===1)||(c===6&&r!==1))board+=rosette(x+6.75,y+7.25);
    else board+=path(`M${x+3} ${y+3}h7v8h-7Z`, L, .55);
  }
  const die=(x:number,y:number,white:boolean)=>`<path d="m${x} ${y-10} 10 17-19-2Z" fill="${white?PAPER:'var(--board)'}" stroke="${EDGE}" stroke-width=".8"/>${path(`M${x} ${y-10}l-2 14 12 3`, EDGE, .6)}<circle cx="${x}" cy="${y-6}" r="1.4" fill="${white?P:Q}"/>`;
  return `<path class="art-frame" d="M17 17h61v15h28V17h34v55h-34V57H78v15H17Z" stroke-linejoin="round"/>${board}${marble(43,44,P,4.6)}${marble(71,44,Q,4.6)}${marble(127,59,P,4.6)}${die(61,85,true)}${die(85,82,false)}${die(107,85,true)}`;
}

function squareGrid(size:number,x:number,y:number,step:number,chequer=false):string {
  return Array.from({length:size*size},(_,i)=>`<rect x="${x+i%size*step}" y="${y+Math.floor(i/size)*step}" width="${step}" height="${step}" fill="${chequer&&(i%size+Math.floor(i/size))%2?'var(--raised)':C}" stroke="${L}" stroke-width=".45"/>`).join('');
}

function gomokuArt():string {
  const lines=Array.from({length:9},(_,i)=>path(`M40 ${10+i*10}h80M${40+i*10} 10v80`, 'var(--muted)', .6)).join('');
  return `${frame(34,4,92,92)}${lines}<circle cx="80" cy="50" r="1.4" fill="${I}"/>${path('M50 70 90 30', A, 10, 'opacity=".12"')}${[[50,70],[60,60],[70,50],[80,40],[90,30]].map(([x,y])=>marble(x,y,P,4.7)).join('')}${[[70,60],[80,60],[80,50],[90,50],[100,40]].map(([x,y])=>marble(x,y,Q,4.7)).join('')}${path('M47 73 93 27', A, .8, 'stroke-dasharray="2 3"')}`;
}

function halmaArt():string {
  let pieces='';
  for(let r=0;r<4;r++)for(let c=0;c<4-r;c++)pieces+=marble(43.5+c*9,13.5+r*9,P,3.2)+marble(115.5-c*9,85.5-r*9,Q,3.2);
  return `${frame(34,4,92,92)}${squareGrid(9,39,9,9,true)}<path d="M39 9h36L39 45ZM120 90H84l36-36Z" fill="${A}" opacity=".09"/>${pieces}${marble(70.5,49.5,P,3.3)}${marble(88.5,67.5,Q,3.3)}${path('M52.5 31.5q2 15 18 18t18 18', A, 1.3, 'stroke-dasharray="2 3"')}${path('m84.5 66.5 4 1-1-4', A, 1)}`;
}

function foxArt():string {
  let holes='';
  for(let r=0;r<7;r++)for(let c=0;c<7;c++)if((r>=2&&r<=4)||(c>=2&&c<=4)){
    const x=44+c*12,y=13+r*12;
    holes+=`<circle cx="${x}" cy="${y}" r="2" fill="${C}" stroke="${L}" stroke-width=".7"/>`;
    if(r>=4&&!(r===4&&c===3))holes+=`<ellipse cx="${x}" cy="${y+1}" rx="4" ry="2.8" fill="${PAPER}" stroke="${EDGE}" stroke-width=".65"/><path d="m${x+1} ${y}q-1-8 2-7 3 1 0 3v4" fill="${PAPER}" stroke="${EDGE}" stroke-width=".65"/><path d="m${x+4} ${y-6} 3 1-3 1" fill="${A}"/><circle cx="${x+3}" cy="${y-6}" r=".55" fill="${EDGE}"/>`;
  }
  return `<path class="art-frame" d="M62 5h36v24h24v42H98v24H62V71H38V29h24Z"/>${path('M44 37h72M44 49h72M44 61h72M68 13v72M80 13v72M92 13v72M44 37l48 48M68 13l48 48M44 61l48-48M68 85l48-48', L, .65)}${holes}<g transform="translate(70 21)"><path d="M1 16q-9-4-9-12 5 7 12 6L7 7 5 0l6 3 6-3-2 8 4 7-10 7Z" fill="${Q}" stroke="${I}" stroke-opacity=".35" stroke-width=".8"/><path d="m7 13 3 5 6-6-2 7-5 2Z" fill="${PAPER}"/><circle cx="9" cy="10" r=".8" fill="${I}"/><circle cx="14" cy="10" r=".8" fill="${I}"/><circle cx="11" cy="17" r="1" fill="${I}"/></g>`;
}

function taflArt():string {
  const pieces=[[1,0,1],[4,0,1],[7,0,1],[0,3,1],[0,5,1],[8,3,1],[8,5,1],[1,8,1],[4,8,1],[7,8,1],[4,2,0],[3,3,0],[5,3,0],[2,4,0],[6,4,0],[3,5,0],[5,5,0],[4,6,0]];
  return `${frame(34,4,92,92)}${squareGrid(9,39,9,9)}${[[0,0],[8,0],[0,8],[8,8],[4,4]].map(([c,r])=>`<rect x="${39+c*9}" y="${9+r*9}" width="9" height="9" fill="${A}" opacity=".19"/>${path(`m${41+c*9} ${11+r*9} 5 5m0-5-5 5`, A, .7)}`).join('')}${pieces.map(([c,r,other])=>marble(43.5+c*9,13.5+r*9,other?Q:P,3.4)).join('')}<g transform="translate(69 36)"><path d="m3 6 4 3 4-6 4 6 4-3-3 13H6Z" fill="${PAPER}" stroke="${EDGE}" stroke-width=".9"/>${path('M7 15h8m-4-12v10', EDGE, .8)}<circle cx="11" cy="1" r="1.4" fill="${A}"/></g>`;
}

function nimArt():string {
  const groups=[3,5,7];
  return `${frame(21,8,118,84,8)}${groups.map((count,r)=>{
    const y=25+r*26,start=80-(count-1)*7;
    return `${path(`M${start-7} ${y+12}h${count*14}`, L, .5)}${Array.from({length:count},(_,i)=>`<g transform="rotate(${i%2?-4:4} ${start+i*14} ${y})"><path d="M${start+i*14-1.6} ${y-7}h3.2v18h-3.2Z" fill="${PAPER}" stroke="${EDGE}" stroke-width=".5"/><ellipse cx="${start+i*14}" cy="${y-8}" rx="3.2" ry="4.4" fill="${r===1?Q:P}" stroke="${I}" stroke-opacity=".25" stroke-width=".5"/><ellipse cx="${start+i*14-1}" cy="${y-9}" rx=".8" ry="1.4" fill="#fff" opacity=".45"/></g>`).join('')}`;
  }).join('')}${path('M119 62q17 10 8 23m0 0 0-5m0 5 5-1', A, 1, 'stroke-dasharray="2 3"')}`;
}

function hexArt():string {
  let hexes='';
  const selected=new Set(['0,1','1,1','2,2','3,2','4,3','5,3']);
  for(let r=0;r<6;r++)for(let c=0;c<6;c++){
    const x=43+c*12.3+r*6.15,y=17+r*11, key=`${r},${c}`;
    const fill=selected.has(key)?P:['0,4','1,3','2,3','3,4','4,4'].includes(key)?Q:C;
    hexes+=`<path d="m${x} ${y-7} 6-3.5 6 3.5v7l-6 3.5-6-3.5Z" fill="${fill}" stroke="${L}" stroke-width=".7"/>${fill!==C?path(`M${x+2} ${y-.8}v-4l4-2.3`, '#fff', .8, 'opacity=".4"'):''}`;
  }
  return `<path class="art-frame" d="m32 8 79-5 37 74-79 15Z"/>${path('M40 7h68M70 89h68', P, 3.5)}${path('m34 16 31 65m49-70 29 61', Q, 3.5)}${hexes}`;
}

const SUITS = {
  heart: 'M12 22C8 17 1 13 1 7 1-1 9-1 12 5 15-1 23-1 23 7c0 6-7 10-11 15Z',
  spade: 'M12 1C8 6 1 10 1 15c0 6 7 7 10 2l-3 6h8l-3-6c3 5 10 4 10-2C23 10 16 6 12 1Z',
  club: 'M12 2a5 5 0 0 0-4 8c-8-3-10 9-3 10 3 0 5-2 6-4l-3 7h8l-3-7c1 2 3 4 6 4 7-1 5-13-3-10a5 5 0 0 0-4-8Z',
  diamond: 'M12 1 22 12 12 23 2 12Z',
};
type Suit = keyof typeof SUITS;
function card(x:number,y:number,rank:string,suit:Suit,angle=0,scale=1):string {
  const colour=suit==='heart'||suit==='diamond'?'color-mix(in srgb,var(--p2) 45%,#a42a3a)':EDGE;
  return `<g transform="translate(${x} ${y}) rotate(${angle} ${17*scale} ${24*scale}) scale(${scale})"><rect x="1" y="3" width="34" height="49" rx="3" fill="#000" opacity=".16"/><rect class="art-card" width="34" height="49" rx="3"/>${path('M3 13V6q0-3 3-3h17', '#fff', .7, 'opacity=".6"')}${number(7,12,rank,9,colour)}<g transform="translate(13 20) scale(.62)" fill="${colour}"><path d="${SUITS[suit]}"/></g><g transform="translate(31 47) rotate(180) scale(.25)" fill="${colour}"><path d="${SUITS[suit]}"/></g></g>`;
}

function heartsArt():string {
  return `${card(30,23,'Q','spade',-20,.95)}${card(53,18,'A','heart',-7,1.05)}${card(82,20,'K','heart',12,1.05)}<g transform="translate(109 63) scale(1.15)"><path d="${SUITS.heart}" fill="${Q}" stroke="${I}" stroke-opacity=".2" stroke-width=".7"/>${path('m13 2-4 7 6 3-5 8', PAPER, 1.5)}</g>${path('M37 87q42 11 81-1', A, .7, 'opacity=".45"')}`;
}

function spadesArt():string {
  return `${card(32,24,'7','spade',-18,.96)}${card(52,15,'K','spade',-6,1.05)}${card(79,12,'A','spade',13,1.16)}<g transform="translate(116 61) scale(1.1)"><path d="${SUITS.spade}" fill="${P}" stroke="${I}" stroke-opacity=".3" stroke-width=".7"/></g><circle cx="128" cy="83" r="10" fill="${C}" stroke="${A}" stroke-width=".7"/>${number(128,86,'4',9,A)}`;
}

function ginArt():string {
  return `${card(21,27,'7','heart',-15,.9)}${card(42,22,'8','heart',-7,.9)}${card(63,20,'9','heart',0,.9)}${card(91,24,'4','club',7,.86)}${card(111,29,'4','diamond',15,.86)}${path('M22 83q28 9 62 0m9 1q18 6 37-1', A, 1.3)}${number(54,96,'7 · 8 · 9',6,'var(--muted)')}${number(113,96,'4 · 4',6,'var(--muted)')}`;
}

function whistArt():string {
  return `<ellipse cx="80" cy="51" rx="62" ry="40" fill="var(--board)" stroke="${L}" stroke-width="1.3"/><ellipse cx="80" cy="51" rx="56" ry="34" fill="none" stroke="${A}" stroke-opacity=".2" stroke-width=".7"/>${card(68,7,'A','club',0,.65)}${card(101,35,'9','club',90,.65)}${card(68,61,'K','club',180,.65)}${card(37,35,'4','club',-90,.65)}${['N','E','S','W'].map((s,i)=>number([80,141,80,19][i],[6,53,98,53][i],s,5.5,'var(--muted)')).join('')}<circle cx="80" cy="51" r="7" fill="${C}" stroke="${A}" stroke-width=".6"/><path d="m80 46 2 5-2 5-2-5Z" fill="${A}"/>`;
}

function memoryArt():string {
  const symbols=(kind:number,x:number,y:number)=>kind===0?`<path d="m${x} ${y-6} 1.8 4 4.5.5-3.3 3 1 4.5-4-2.3-4 2.3 1-4.5-3.3-3 4.5-.5Z" fill="${P}"/>`:kind===1?`<path d="M${x+3} ${y-6}a6 6 0 1 0 2 10 6 6 0 0 1-2-10Z" fill="${Q}"/>`:`<path d="M${x-4} ${y-2}q4-5 8 0v4q-4 7-8 0Z" fill="${P}" stroke="${EDGE}" stroke-width=".6"/>${path(`M${x-5} ${y-2}q5-5 10 0M${x} ${y-5}v-3`, EDGE, 1)}`;
  return `${Array.from({length:12},(_,i)=>{
    const x=29+i%4*27,y=9+Math.floor(i/4)*28,open=[0,3,5,6,9].includes(i),kind=i===0||i===3?0:i===5||i===9?1:2;
    return `<g transform="rotate(${i===3?6:0} ${x+11} ${y+12})"><rect x="${x+1}" y="${y+2}" width="23" height="25" rx="3" fill="#000" opacity=".16"/><rect x="${x}" y="${y}" width="23" height="25" rx="3" fill="${open?PAPER:'var(--board)'}" stroke="${open?EDGE:L}" stroke-width=".8"/>${open?symbols(kind,x+11.5,y+12.5):`${path(`m${x+11.5} ${y+4} 7.5 8.5-7.5 8.5-7.5-8.5Z`, A, .65, 'opacity=".7"')}<circle cx="${x+11.5}" cy="${y+12.5}" r="2.2" fill="${A}" opacity=".55"/>`}</g>`;
  }).join('')}${path('M40 6h81', A, .8, 'opacity=".35"')}`;
}

function kakuroArt():string {
  let tiles='';
  for(let r=0;r<5;r++)for(let c=0;c<5;c++){
    const x=39+c*16,y=10+r*16,entry=({ '0,0':'#','0,1':'#','0,2':'d16','0,3':'d7','0,4':'#','1,0':'#','1,1':'r4','1,2':'1','1,3':'3','1,4':'d6','2,0':'r9','2,1':'2','2,2':'7','2,3':'b8','2,4':'','3,0':'r8','3,1':'6','3,2':'2','3,3':'r5','3,4':'5','4,0':'#','4,1':'#','4,2':'r6','4,3':'4','4,4':'2' } as Record<string,string>)[`${r},${c}`];
    const clue=entry.startsWith('d')||entry.startsWith('r')||entry.startsWith('b');
    tiles+=`<rect x="${x}" y="${y}" width="16" height="16" fill="${entry==='#'||clue?'var(--board)':C}" stroke="${L}" stroke-width=".6"/>`;
    if(clue)tiles+=path(`M${x} ${y}l16 16`, A, .6)+number(x+11.5,y+5.5,entry.startsWith('d')?'':entry.slice(1),4.4,A)+number(x+4.5,y+13,entry.startsWith('r')?'':entry==='b8'?12:entry.slice(1),4.4,A);
    else if(entry!=='#')tiles+=number(x+8,y+11,entry,9);
  }
  return `${frame(34,5,90,90)}${tiles}`;
}

function slitherlinkArt():string {
  const dots=Array.from({length:36},(_,i)=>`<circle cx="${40+i%6*16}" cy="${10+Math.floor(i/6)*16}" r="1.5" fill="${I}"/>`).join('');
  const clues=[[0,0,3],[2,0,2],[4,0,2],[1,1,1],[3,1,3],[0,2,2],[2,2,0],[4,2,3],[1,3,2],[3,3,1],[0,4,3],[2,4,2],[4,4,2]];
  return `${frame(33,3,94,94)}${path('M40 10h32v16h32V10h16v48h-16v16h16v16H72V74H40V42h16V26H40Z', P, 2.5)}${clues.map(([c,r,n])=>number(48+c*16,21+r*16,n,8.5)).join('')}${dots}${path('m76 30 5 5m0-5-5 5m32 30 5 5m0-5-5 5', 'var(--muted)', .7, 'opacity=".55"')}`;
}

function hashiArt():string {
  const islands=[[41,16,3],[80,16,4],[119,16,3],[41,50,4],[80,50,5],[119,50,3],[41,84,3],[80,84,4],[119,84,3]];
  return `${frame(28,4,104,92)}${path('M41 16h78M41 50h78M41 84h78M41 16v68M80 16v68M119 16v68', P, 1.2)}${path('M41 19h39M83 16v34M119 53v31M41 81h39M44 50v34M80 81h39', P, 1.1)}${islands.map(([x,y,n])=>`<circle cx="${x+.7}" cy="${y+1.3}" r="8" fill="#000" opacity=".15"/><circle cx="${x}" cy="${y}" r="7.8" fill="${C}" stroke="${A}" stroke-width="1.2"/>${number(x,y+3,n,8.5)}`).join('')}`;
}

function futoshikiArt():string {
  const values=[1,0,3,0,0,3,0,1,3,0,1,0,0,1,0,3];
  const tiles=values.map((n,i)=>{const x=40+i%4*21,y=9+Math.floor(i/4)*21;return `<rect x="${x}" y="${y}" width="16" height="16" rx="2" fill="${C}" stroke="${L}" stroke-width=".7"/>${n?number(x+8,y+11.5,n,10):''}`;}).join('');
  const inequalities=[[0,0,0],[2,0,1],[1,1,0],[0,2,1],[2,3,0]].map(([c,r,reverse])=>path(`m${57.5+c*21+(reverse?2:0)} ${14+r*21} ${reverse?-2:2} 3 ${reverse?2:-2} 3`, A, 1.1)).join('');
  const vertical=[[0,0],[2,1],[3,2]].map(([c,r])=>path(`m${45+c*21} ${27+r*21} 3 2 3-2`, Q, 1.1)).join('');
  return `${frame(34,3,92,93)}${tiles}${inequalities}${vertical}`;
}

function skyscrapersArt():string {
  let buildings='';
  const heights=[[1,3,2,4],[3,2,4,1],[2,4,1,3],[4,1,3,2]];
  for(let r=0;r<4;r++)for(let c=0;c<4;c++){
    const x=79+(c-r)*13,y=39+(r+c)*6.7,h=heights[r][c]*7;
    buildings+=`<path d="m${x} ${y} 11 5.5-11 5.5-11-5.5Z" fill="${C}" stroke="${L}" stroke-width=".5"/><path d="m${x-9} ${y-h} 9 4.5v${h}l-9-4.5Z" fill="${P}" stroke="${I}" stroke-opacity=".25" stroke-width=".45"/><path d="m${x} ${y-h+4.5} 9-4.5v${h}l-9 4.5Z" fill="${Q}" stroke="${I}" stroke-opacity=".25" stroke-width=".45"/><path d="m${x} ${y-h-4.5} 9 4.5-9 4.5-9-4.5Z" fill="${PAPER}" stroke="${EDGE}" stroke-width=".5"/>${Array.from({length:heights[r][c]-1},(_,i)=>path(`m${x-6} ${y-h+8+i*7} 3 1.5m6-1.5 3-1.5`, C, 1, 'opacity=".6"')).join('')}`;
  }
  return `<path class="art-frame" d="m79 30 61 30-61 33-61-33Z" stroke-linejoin="round"/>${[1,2,2,3].map((n,i)=>number(37-i*0+13*i,41-i*6.7,n,5.5,A)).join('')}${[2,2,1,3].map((n,i)=>number(33+13*i,76+i*6.7,n,5.5,A)).join('')}${[3,1,2,2].map((n,i)=>number(126-13*i,43-i*6.7,n,5.5,A)).join('')}${buildings}`;
}

function tangramsArt():string {
  const shape=(points:string,colour:string)=>`<polygon points="${points}" fill="${colour}" stroke="${C}" stroke-width="1.3" stroke-linejoin="round"/>`;
  return `<ellipse cx="81" cy="91" rx="55" ry="3" fill="#000" opacity=".12"/>${shape('43,37 43,13 67,37',P)}${shape('70,37 94,13 94,37',Q)}${shape('43,37 68,37 68,62 43,62',PAPER)}${shape('43,63 93,63 93,88',P)}${shape('43,63 43,88 93,88',Q)}${shape('69,37 94,37 94,62',A)}${shape('94,88 112,70 112,45 94,63','color-mix(in srgb,var(--p1) 65%,var(--surface))')}${path('M46 40h18m-18 2v16', '#fff', .7, 'opacity=".45"')}`;
}

function wordsearchArt():string {
  const letters=[...'GRIDSPALMOANCLUBMECHESSYSTONESPLAYAB'];
  const found=(x:number,y:number,w:number,colour:string)=>`<rect x="${x}" y="${y}" width="${w}" height="12" rx="6" fill="${colour}" fill-opacity=".15" stroke="${colour}" stroke-opacity=".6" stroke-width=".8"/>`;
  return `${frame(31,3,98,94)}${found(36,10,54,P)}${found(36,52,68,Q)}${found(36,66,82,A)}${letters.map((ch,i)=>number(42+i%6*14,19+Math.floor(i/6)*14,ch,8)).join('')}${path('M37 9v-1h8m73 79v4h-8', A, .8, 'opacity=".5"')}`;
}

const illustrations: Record<string, () => string> = {
  snakes: snakesArt, senet: senetArt, ludo: ludoArt, dominoes: dominoesArt,
  chinese: chineseArt, ur: urArt, gomoku: gomokuArt, halma: halmaArt,
  fox: foxArt, tafl: taflArt, nim: nimArt, hex: hexArt,
  hearts: heartsArt, spades: spadesArt, gin: ginArt, whist: whistArt,
  memory: memoryArt, kakuro: kakuroArt, slitherlink: slitherlinkArt, hashi: hashiArt,
  futoshiki: futoshikiArt, skyscrapers: skyscrapersArt, tangrams: tangramsArt, wordsearch: wordsearchArt,
};

/** The lobby's shared 160 × 100 composition; unknown game IDs produce no artwork. */
export function plusGraphic(game: string): string {
  const illustration = illustrations[game]?.();
  return illustration ? `<div class="game-art" aria-hidden="true">${svg(illustration)}</div>` : '';
}
