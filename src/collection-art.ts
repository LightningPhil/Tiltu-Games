/** Original vector artwork for Grid Club's traditional games and quiet puzzles.
 * All colour comes from the active theme; no fonts, images or network assets are required.
 */

const ink = 'var(--text)';
const accent = 'var(--accent)';
const primary = 'var(--p1)';
const rival = 'var(--p2)';
const paper = 'var(--piece-light,var(--cell))';
const paperEdge = 'var(--piece-light-edge,var(--line))';

const svg = (body: string, box = '0 0 160 100', className = '') =>
  `<svg${className ? ` class="${className}"` : ''} viewBox="${box}" aria-hidden="true" focusable="false">${body}</svg>`;

function stone(x: number, y: number, other = false, radius = 6): string {
  return `<ellipse cx="${x + .6}" cy="${y + 1.8}" rx="${radius}" ry="${radius * .8}" fill="#000" opacity=".22"/><circle class="${other ? 'art-rival' : 'art-primary'}" cx="${x}" cy="${y}" r="${radius}"/><circle class="art-ring" cx="${x}" cy="${y}" r="${radius * .7}"/><path d="M${x - radius * .58} ${y - radius * .16}a${radius * .65} ${radius * .65} 0 0 1 ${radius * .69} ${-radius * .49}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".8" stroke-linecap="round"/>`;
}

const line = (path: string, colour = 'var(--muted)', width = 1, extra = '') =>
  `<path d="${path}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;

/** A reusable physical die, including an inset rim and correctly arranged pips. */
export function diceGraphic(value: number): string {
  const n = Number.isFinite(value) ? Math.max(1, Math.min(6, Math.round(value))) : 1;
  const pips: [number, number][] = [];
  if (n % 2) pips.push([32, 31]);
  if (n >= 2) pips.push([19, 18], [45, 44]);
  if (n >= 4) pips.push([45, 18], [19, 44]);
  if (n === 6) pips.push([19, 31], [45, 31]);
  return svg(`<rect x="5" y="7" width="55" height="55" rx="11" fill="var(--board)" stroke="var(--line)"/><rect x="4" y="3" width="55" height="55" rx="11" fill="${paper}" stroke="${paperEdge}" stroke-width="1.5"/><rect x="8" y="7" width="47" height="47" rx="8" fill="none" stroke="${paperEdge}" stroke-opacity=".25"/>${line('M10 23V15q0-6 6-6h21', '#fff', 1.5, 'opacity=".65"')}${pips.map(([x,y]) => `<circle cx="${x}" cy="${y + .7}" r="4.2" fill="${paperEdge}" opacity=".22"/><circle cx="${x}" cy="${y}" r="3.8" fill="${paperEdge}"/>`).join('')}`, '0 0 64 64', 'collection-die');
}

/** A peg and its socket share the same view box, keeping boards aligned. */
export function pegGraphic(occupied = true): string {
  const hole = `<ellipse cx="24" cy="28" rx="16" ry="14" fill="var(--cell)" stroke="var(--line)" stroke-width="1.2"/><ellipse cx="24" cy="29" rx="11" ry="9" fill="#000" opacity=".2"/>`;
  return svg(hole + (occupied ? `<ellipse cx="24" cy="30" rx="13" ry="10" fill="#000" opacity=".25"/><path d="M11 21v7c0 14 26 14 26 0v-7" fill="${primary}" stroke="var(--line)"/><ellipse cx="24" cy="21" rx="13" ry="12" fill="${primary}" stroke="${ink}" stroke-opacity=".25"/><ellipse cx="21" cy="17" rx="7" ry="3.5" fill="#fff" opacity=".3"/>${line('M15 25q8 9 18 0', 'var(--cell)', .8, 'opacity=".4"')}` : ''), '0 0 48 48', 'collection-peg');
}

const pipPositions: [number, number][][] = [
  [[32,40]],
  [[32,23],[32,57]],
  [[20,22],[32,40],[44,58]],
  [[20,25],[44,25],[20,55],[44,55]],
  [[18,23],[46,23],[32,40],[18,57],[46,57]],
  [[20,21],[44,21],[20,40],[44,40],[20,59],[44,59]],
  [[32,14],[20,32],[44,32],[20,48],[44,48],[20,64],[44,64]],
  [[20,16],[44,16],[20,32],[44,32],[20,48],[44,48],[20,64],[44,64]],
  [[17,20],[32,20],[47,20],[17,40],[32,40],[47,40],[17,60],[32,60],[47,60]],
];

const numeralStrokes = [
  'M19 30h26',
  'M21 23h22M17 36h30',
  'M21 18h22M23 29h18M17 41h30',
  'M18 17h28v27H18zM27 18v11q0 5-5 7M36 18v16h6',
  'M20 17h25M23 28h19l-2 16M29 18l-4 26M17 44h31',
  'M30 15l5 7M18 27h29M26 33l-8 12M39 33l8 12',
  'M17 26l30-4M31 14v26q0 5 5 5h9',
  'M27 17q-1 20-11 29M37 17q1 20 11 29',
  'M17 26h24l-3 15q-1 5 5 5h5M28 15q1 20-13 31',
];

function mahjongBonusFace(face: number): string {
  const blossom = (x: number, y: number, radius: number) =>
    `${Array.from({length:5},(_,i)=>`<ellipse cx="${x}" cy="${y-radius*.65}" rx="${radius*.48}" ry="${radius*.7}" transform="rotate(${i*72} ${x} ${y})" fill="${rival}" stroke="${paperEdge}" stroke-opacity=".4" stroke-width=".6"/>`).join('')}<circle cx="${x}" cy="${y}" r="${radius*.22}" fill="${paper}" stroke="${primary}" stroke-width=".8"/>`;
  if (face === 34) {
    return `${line('M19 65q9-17 16-29t9-21M29 48l-7-19m14 6 9 7', paperEdge, 2)}${blossom(22,28,7)}${blossom(44,17,6)}${blossom(44,43,7.5)}${blossom(31,48,5)}<path d="M20 61q-8-10-5-15 8 3 8 12M35 32q7-10 13-7-3 7-12 10" fill="${primary}" stroke="${paperEdge}" stroke-width=".6"/>`;
  }
  if (face === 35) {
    return `${line('M30 66q9-18 1-36', primary, 1.7)}<path d="M29 65q-3-21-15-25 2 18 15 25Zm2 0q10-23 20-24-4 18-20 24Z" fill="${primary}" stroke="${paperEdge}" stroke-width=".6"/><path d="M32 31C14 35 10 20 20 20c7-1 9 6 12 11ZM32 31C14 17 24 8 30 14c5 5 2 11 2 17ZM32 31c2-20 14-21 15-12 0 9-8 12-15 12Zm0 0c16-10 23-2 17 5-5 5-12 0-17-5Zm0 0c12 7 9 17 1 13-6-3-6-8-1-13Z" fill="${rival}" stroke="${paperEdge}" stroke-width=".7"/><path d="M27 29q6-5 11 1l-6 8Z" fill="${paper}" stroke="${primary}" stroke-width="1"/><circle cx="32" cy="31" r="1.5" fill="${primary}"/>`;
  }
  if (face === 36) {
    return `${line('M32 66V37', primary, 1.8)}<path d="M31 59q-16-1-16-13 12-1 16 13Zm2-5q1-12 14-13 1 10-14 13Z" fill="${primary}" stroke="${paperEdge}" stroke-width=".6"/>${Array.from({length:14},(_,i)=>`<ellipse cx="32" cy="23" rx="3.1" ry="10" transform="rotate(${i*360/14} 32 33)" fill="${i%2?primary:rival}" stroke="${paperEdge}" stroke-opacity=".5" stroke-width=".5"/>`).join('')}<circle cx="32" cy="33" r="8" fill="${paper}" stroke="${rival}" stroke-width="1.2"/>${Array.from({length:7},(_,i)=>`<circle cx="${32+Math.cos(i*Math.PI*2/7)*4.4}" cy="${33+Math.sin(i*Math.PI*2/7)*4.4}" r=".9" fill="${primary}"/>`).join('')}<circle cx="32" cy="33" r="1.1" fill="${rival}"/>`;
  }
  if (face === 37) {
    return `${line('M25 68q9-26 4-46m8 46q-4-20 4-37M24 57h9m-6-16h8m-8-14h7m1 28h7m-5-13h7', primary, 1.8)}<path d="M29 48q-16-3-18-16 13 3 18 16Zm3-8q2-15 16-19-2 13-16 19Zm6 15q4-13 15-12-4 10-15 12Zm-9 3q-15 1-17-9 12-1 17 9Z" fill="${primary}" stroke="${paperEdge}" stroke-width=".6"/>${line('M29 27q4-11 9-15m-7 10-10-6m13 3 10-2m-7-4-5-5m7 4 6-3', paperEdge, .9)}<ellipse cx="20" cy="15" rx="2.1" ry="3.7" transform="rotate(-48 20 15)" fill="${rival}"/><ellipse cx="25" cy="18" rx="1.9" ry="3.2" transform="rotate(-42 25 18)" fill="${rival}"/><ellipse cx="31" cy="9" rx="1.8" ry="3.2" transform="rotate(-23 31 9)" fill="${rival}"/><ellipse cx="38" cy="11" rx="1.9" ry="3.4" transform="rotate(25 38 11)" fill="${rival}"/><ellipse cx="45" cy="9" rx="1.8" ry="3.1" transform="rotate(46 45 9)" fill="${rival}"/><ellipse cx="43" cy="18" rx="2" ry="3.8" transform="rotate(60 43 18)" fill="${rival}"/>${line('M17 71h29', primary, .7, 'opacity=".6"')}`;
  }
  if (face === 38) {
    return `${line('M32 63V38q0-11 6-17', primary, 1.9)}<path d="M31 49C13 49 12 35 15 29c14 1 19 9 16 20Zm2-11C32 21 44 16 51 20c-2 13-8 18-18 18Z" fill="${primary}" stroke="${paperEdge}" stroke-width=".8"/>${line('M18 34l13 14m14-24L33 37', paper, 1, 'opacity=".65"')}<path d="M16 64q16-7 32 0" fill="none" stroke="${rival}" stroke-width="1.5" stroke-linecap="round"/>${line('M13 69h38', primary, .8)}<path d="M18 16q-6 8 0 9 6-1 0-9Zm8-7q-5 7 0 8 5-1 0-8Z" fill="${rival}" opacity=".75"/>`;
  }
  if (face === 39) {
    return `${Array.from({length:12},(_,i)=>`<g transform="rotate(${i*30} 32 35)">${line(i%2?'M32 13v5':'M32 10v8', primary, 2)}</g>`).join('')}<circle cx="32" cy="35" r="12.5" fill="${rival}" stroke="${paperEdge}" stroke-width="1"/><circle cx="32" cy="35" r="8.5" fill="none" stroke="${paper}" stroke-width=".8" stroke-opacity=".7"/>${line('M12 62q5-5 10 0t10 0 10 0 10 0M15 69q5-5 10 0t10 0 10 0', primary, 1.4)}`;
  }
  if (face === 40) {
    return `<path d="m32 12 6 13 9-5-1 13 10-2-8 12 5 5-15 4-6 12-6-12-15-4 5-5-8-12 10 2-1-13 9 5Z" fill="${rival}" stroke="${paperEdge}" stroke-width=".9"/>${line('M32 24v45M32 43l-9-10m9 17 10-11M32 44l9-13m-9 20-9-9', paperEdge, 1.1)}${line('M18 70h26', primary, .8, 'opacity=".6"')}`;
  }
  return `${Array.from({length:6},(_,i)=>`<g transform="rotate(${i*60} 32 37)">${line('M32 37V14m0 9-6-5m6 5 6-5m-6 12-5-4m5 4 5-4', primary, 1.9)}</g>`).join('')}<circle cx="32" cy="37" r="3.2" fill="${paper}" stroke="${rival}" stroke-width="1.6"/>${line('M15 68q8-4 17-1t17 0', rival, 1.1)}<circle cx="13" cy="57" r="1.2" fill="${rival}"/><circle cx="51" cy="57" r="1.2" fill="${rival}"/>`;
}

/**
 * Faces 0–8: circles; 9–17: bamboo; 18–26: characters;
 * 27–30: East/South/West/North; 31–33: red/green/white dragons.
 * 34–37: plum/orchid/chrysanthemum/bamboo flower; 38–41: spring/summer/autumn/winter.
 * The entire tile is drawn, so this may be placed directly inside a tile button.
 */
export function mahjongTileGraphic(value: number): string {
  const face = Number.isFinite(value) ? ((Math.trunc(value) % 42) + 42) % 42 : 0;
  let symbols = '';
  if (face < 9) {
    const rank = face % 9;
    const radius = rank === 0 ? 15 : rank < 3 ? 8 : rank < 6 ? 6.5 : 5.2;
    symbols = pipPositions[rank].map(([x,y], i) => {
      const colour = i % 3 === 1 ? rival : primary;
      return `<circle cx="${x}" cy="${y}" r="${radius}" fill="none" stroke="${colour}" stroke-width="2.1"/><circle cx="${x}" cy="${y}" r="${radius * .58}" fill="none" stroke="${colour}" stroke-width="1"/><circle cx="${x}" cy="${y}" r="${radius * .19}" fill="${colour}"/>`;
    }).join('');
    if (rank === 0) symbols += `${line('M32 29v22M21 40h22', rival, 1)}<circle cx="32" cy="40" r="5.5" fill="none" stroke="${rival}"/>`;
  } else if (face < 18) {
    const rank = face % 9;
    symbols = pipPositions[rank].map(([x,y], i) => {
      const colour = i % 3 === 1 ? rival : primary;
      const h = rank < 3 ? 9 : 6;
      return line(`M${x - 2} ${y - h}v${h * 2}m4 ${-h * 2}v${h * 2}M${x - 4} ${y - h}h8M${x - 4} ${y}h8M${x - 4} ${y + h}h8`, colour, 1.7);
    }).join('');
  } else if (face < 27) {
    symbols = line(numeralStrokes[face % 9], primary, 2.8) + line('M21 54h22M25 51v10m14-10v10M23 63h18v8M32 61v12M19 71h26', rival, 2.2);
  } else if (face < 31) {
    const letter = ['E','S','W','N'][face - 27];
    symbols = `<path d="m32 13 19 27-19 27-19-27Z" fill="none" stroke="${primary}" stroke-width="1.2"/><text x="32" y="48" fill="${primary}" text-anchor="middle" font-family="Georgia,serif" font-size="25" font-weight="700">${letter}</text>${line('M25 10h14M25 70h14', rival, 1.2)}`;
  } else if (face === 31) {
    symbols = line('M32 16v49M19 28h26v22H19zM17 62h30', rival, 3);
  } else if (face === 32) {
    symbols = line('M23 16h17l-7 11 11 8-8 10 12 13M19 27h23M25 36l-7 13m15-4-9 18m13-19 8 18M18 61h25', primary, 2.8);
  } else if (face === 33) {
    symbols = `<rect x="15" y="15" width="34" height="50" rx="3" fill="none" stroke="${primary}" stroke-width="2.6"/><rect x="20" y="20" width="24" height="40" rx="1" fill="none" stroke="${primary}" stroke-width="1"/>`;
  } else {
    symbols = mahjongBonusFace(face);
  }
  return svg(`<rect x="3" y="6" width="58" height="72" rx="7" fill="var(--board)" stroke="var(--line)"/><rect x="2" y="2" width="58" height="72" rx="7" fill="${paper}" stroke="${paperEdge}" stroke-width="1.3"/>${line('M7 18v-7q0-4 4-4h33', '#fff', 1.1, 'opacity=".7"')}${symbols}`, '0 0 64 80', 'mahjong-face');
}

const contents = (graphic: string) => graphic.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

function noughtsArt(): string {
  const marks = [[0,0],[1,1],[2,2]].map(([c,r]) => line(`m${47.5+c*26} ${19.5+r*26} 13 13m0-13-13 13`, primary, 3.4)).join('');
  return `<rect class="art-frame" x="36" y="3" width="88" height="93" rx="9"/>${line('M67 13v78M93 13v78M41 39h78M41 65h78', 'var(--line)', 1.4)}${line('M48 20l64 64', accent, 6, 'opacity=".12"')}${marks}<circle cx="106" cy="26" r="8" fill="none" stroke="${rival}" stroke-width="3.3"/><circle cx="54" cy="78" r="8" fill="none" stroke="${rival}" stroke-width="3.3"/>`;
}

function reversiArt(): string {
  const grid = Array.from({length:64}, (_,i) => `<rect class="art-tile" x="${37+i%8*11}" y="${6+Math.floor(i/8)*11}" width="10.8" height="10.8"/>`).join('');
  const pieces = [[2,2,0],[3,2,1],[4,2,1],[5,2,1],[3,3,0],[4,3,1],[2,4,1],[3,4,0],[4,4,0],[5,4,1],[2,5,0],[3,5,0],[4,5,1],[5,5,1],[6,6,0]];
  return `<rect class="art-frame" x="33" y="2" width="96" height="96" rx="6"/>${grid}${pieces.map(([c,r,p]) => stone(42.5+c*11,11.5+r*11,Boolean(p),4.6)).join('')}<rect x="58.5" y="27.5" width="33" height="11" rx="4" fill="none" stroke="${accent}" stroke-width=".8" opacity=".7"/>`;
}

function snakeArt(): string {
  const squares = Array.from({length:40},(_,i) => `<rect class="art-tile" x="${24+i%8*14}" y="${13+Math.floor(i/8)*14}" width="12" height="12" rx="1.5" opacity=".55"/>`).join('');
  return `<rect class="art-frame" x="20" y="8" width="120" height="84" rx="8"/>${squares}${line('M31 77V61h28V33h28v14', '#000', 11, 'opacity=".18" transform="translate(1 2)"')}${line('M31 75V61h28V33h28v14', primary, 10)}${line('M31 72v-8h28V36h25', '#fff', 1.1, 'opacity=".3"')}<rect class="art-primary" x="80" y="39" width="19" height="16" rx="5"/><circle cx="93.5" cy="43" r="1.6" fill="var(--cell)"/><circle cx="93.5" cy="50.5" r="1.6" fill="var(--cell)"/>${line('M99 47h4m0 0 2-2m-2 2 2 2', rival, 1)}<path class="art-rival" d="M115 57c-9-5-14 5-10 11 3 6 7 3 10 4 3-1 7 2 10-4 4-6-1-16-10-11Z"/>${line('M115 59q-2-7 3-10', 'var(--muted)', 1.5)}<path d="M117 52q7-7 10-2-2 5-10 2Z" fill="${primary}"/>${line('M109 61q-3 1-2 5', '#fff', 1.3, 'opacity=".6"')}`;
}

function backgammonArt(): string {
  const triangles = Array.from({length:12},(_,i) => {
    const x = (i < 6 ? 24 : 84) + i%6*8.5;
    return `<path class="${i%2?'art-rival':'art-primary'}" d="m${x} 14 4.25 32 4.25-32z" opacity=".7"/><path class="${i%2?'art-primary':'art-rival'}" d="m${x} 85 4.25-32 4.25 32z" opacity=".7"/>`;
  }).join('');
  return `<rect class="art-frame" x="17" y="7" width="126" height="86" rx="6"/><rect x="23" y="13" width="114" height="73" rx="2" fill="var(--cell)" stroke="var(--line)"/>${triangles}<rect class="art-frame" x="76" y="11" width="8" height="77" rx="2"/>${[0,1,2,3].map(i=>stone(28.3,80-i*7,false,3.8)).join('')}${[0,1,2].map(i=>stone(70.8,19+i*7,true,3.8)).join('')}${[0,1,2].map(i=>stone(131,80-i*7,true,3.8)).join('')}${[0,1].map(i=>stone(97,19+i*7,false,3.8)).join('')}<g transform="translate(55 43) rotate(-12 10 10) scale(.33)">${contents(diceGraphic(5))}</g><g transform="translate(88 44) rotate(13 10 10) scale(.33)">${contents(diceGraphic(3))}</g>${line('M80 17v4m0 57v4', 'var(--muted)', .8)}`;
}

function mahjongArt(): string {
  const tiles = [
    [22,52,2],[44,52,11],[66,52,18],[88,52,5],[110,52,30],
    [33,29,31],[55,29,3],[77,29,10],[99,29,33],
    [55,8,12],[77,8,0],
  ];
  return `<ellipse cx="80" cy="91" rx="64" ry="4" fill="#000" opacity=".12"/>${tiles.map(([x,y,n])=>`<g transform="translate(${x} ${y}) scale(.36)">${contents(mahjongTileGraphic(n))}</g>`).join('')}`;
}

function slidingArt(): string {
  const order = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,0,15];
  return `<rect class="art-frame" x="36" y="5" width="88" height="90" rx="7"/>${order.map((n,i)=>{
    const x=41+i%4*20, y=10+Math.floor(i/4)*20;
    return n ? `<g><rect class="${n===15?'art-primary':'art-tile'}" x="${x}" y="${y}" width="18" height="18" rx="3"/>${line(`M${x+3} ${y+3}h11`, '#fff', .7, 'opacity=".3"')}<text class="art-number" x="${x+9}" y="${y+13}" style="font-size:11px;${n===15?'fill:var(--accent-ink)':''}">${n}</text></g>` : `<rect class="art-hole" x="${x}" y="${y}" width="18" height="18" rx="3"/>`;
  }).join('')}${line('M95 79h-8m0 0 3-3m-3 3 3 3', accent, 1.2, 'opacity=".7"')}`;
}

function pegsArt(): string {
  const occupied = new Set([9,10,16,17,18,21,22,23,24,25,26,30,31,32,37,38]);
  let holes = '';
  for(let r=0;r<7;r++) for(let c=0;c<7;c++) if((r>=2&&r<=4)||(c>=2&&c<=4)) {
    const x=45+c*12,y=14+r*12,id=r*7+c;
    holes += `<circle cx="${x}" cy="${y+1}" r="4.3" fill="var(--cell)" stroke="var(--line)" stroke-width=".8"/>`;
    if(occupied.has(id)) holes += stone(x,y-.5,false,4.2);
  }
  return `<path class="art-frame" stroke-linejoin="round" d="M63 8h36v24h24v36H99v24H63V68H39V32h24Z"/>${holes}<circle cx="93" cy="26" r="4.3" fill="none" stroke="${accent}" stroke-width="1.2"/>${line('M69 26q12-10 24 0', accent, 1.1, 'stroke-dasharray="2 2"')}`;
}

function dotsArt(): string {
  const nodes=Array.from({length:20},(_,i)=>`<circle cx="${36+i%5*22}" cy="${15+Math.floor(i/5)*22}" r="2.2" fill="${ink}"/><circle cx="${35.5+i%5*22}" cy="${14.4+Math.floor(i/5)*22}" r=".65" fill="#fff" opacity=".6"/>`).join('');
  return `<rect class="art-frame" x="27" y="6" width="106" height="87" rx="6"/><rect x="36" y="15" width="22" height="22" fill="${primary}" opacity=".18"/><rect x="80" y="37" width="22" height="22" fill="${rival}" opacity=".18"/>${line('M36 15h22v22H36V15m22 0h22m0 22v22h22V37H80m-22 0v22H36m66 0h22v22h-22M58 81h22', primary, 2.6)}${line('M80 37h22v22H80V37m0-22h22v22m-66 22v22h22m0-22h22m22-44h22v22', rival, 2.6)}${line('M80 81h22', accent, 2, 'stroke-dasharray="3 3"')}<circle cx="47" cy="26" r="3.8" fill="none" stroke="${primary}" stroke-width="1"/><path d="m91 44 4 4-4 4-4-4Z" fill="${rival}"/>${nodes}`;
}

function morrisArt(): string {
  const points: [number,number][]=[];
  for(const [lo,hi] of [[39,121],[52,108],[65,95]]) points.push([lo,lo-30],[80,lo-30],[hi,lo-30],[lo,50],[hi,50],[lo,hi-30],[80,hi-30],[hi,hi-30]);
  const men = new Map([[0,false],[3,false],[5,false],[14,false],[2,true],[9,true],[12,true],[23,true]]);
  return `<rect class="art-frame" x="32" y="2" width="96" height="96" rx="8"/>${line('M39 9h82v82H39V9m13 13h56v56H52V22m13 13h30v30H65V35M80 9v26m0 30v26M39 50h26m30 0h26', 'var(--muted)', 1.2)}${line('M39 9v82', primary, 4, 'opacity=".2"')}${points.map(([x,y],i)=>men.has(i)?stone(x,y,men.get(i),5):`<circle cx="${x}" cy="${y}" r="1.6" fill="${ink}" opacity=".7"/>`).join('')}`;
}

function kalahArt(): string {
  const seeds=(x:number,y:number,count:number,other=false)=>Array.from({length:count},(_,i)=>`<ellipse cx="${x+[-2,2,0,-1.5,2.3][i%5]}" cy="${y+[-1,0,2,3,-3][i%5]}" rx="1.25" ry="1.6" transform="rotate(${i*47} ${x} ${y})" fill="${other?rival:primary}" stroke="var(--text)" stroke-opacity=".18" stroke-width=".35"/>`).join('');
  return `<rect class="art-frame" x="15" y="17" width="130" height="66" rx="28"/><rect x="20" y="23" width="120" height="54" rx="23" fill="none" stroke="var(--line)" stroke-width=".6"/><rect x="25" y="29" width="14" height="42" rx="7" fill="var(--cell)" stroke="var(--line)"/><rect x="121" y="29" width="14" height="42" rx="7" fill="var(--cell)" stroke="var(--line)"/>${Array.from({length:12},(_,i)=>{const x=49+i%6*12.5,y=i<6?36:64;return `<ellipse cx="${x}" cy="${y}" rx="5.8" ry="7" fill="var(--cell)" stroke="var(--line)" stroke-width=".8"/>${seeds(x,y,[3,4,1,4,2,3,4,2,4,3,1,4][i],i<6)}`;}).join('')}${seeds(32,38,4,true)}${seeds(32,51,3,true)}${seeds(32,62,2,true)}${seeds(128,39,3)}${seeds(128,52,4)}${seeds(128,63,3)}${line('M108 49H53m0 0 3-2m-3 2 3 2', 'var(--muted)', .7, 'opacity=".55"')}`;
}

function nonogramsArt(): string {
  const picture=['01010','11111','11111','01110','00100'];
  let cells='';
  for(let r=0;r<5;r++)for(let c=0;c<5;c++) {
    const x=60+c*12,y=29+r*12, filled=picture[r][c]==='1';
    cells += `<rect class="${filled?'art-primary':'art-tile'}" x="${x}" y="${y}" width="11" height="11" rx="1"/>`;
    if(!filled) cells += line(`m${x+4} ${y+4} 3 3m0-3-3 3`, 'var(--muted)', .8, 'opacity=".5"');
  }
  return `<rect class="art-frame" x="35" y="8" width="92" height="87" rx="6"/><path d="M56 13v77M40 25h82" fill="none" stroke="var(--line)"/>${[2,4,4,4,2].map((n,i)=>`<text class="art-number" style="font-size:9px" x="${65.5+i*12}" y="22">${n}</text>`).join('')}${['1 1','5','5','3','1'].map((n,i)=>`<text class="art-number" style="font-size:8px" x="47" y="${37.5+i*12}">${n}</text>`).join('')}${cells}`;
}

function cribbageArt(): string {
  const cards = [[53,10,-14,'5'],[75,6,0,'6'],[97,10,13,'4']];
  const cardsArt=cards.map(([x,y,angle,rank],i)=>`<g transform="rotate(${angle} ${Number(x)+13} ${Number(y)+19})"><rect class="art-card" x="${x}" y="${y}" width="27" height="39" rx="2.5"/><text class="art-rank" x="${Number(x)+4}" y="${Number(y)+11}" style="font-size:10px">${rank}</text><path d="${i===1?`M${Number(x)+13} ${Number(y)+16}c-5-6-10 1-5 4-6 3 0 9 4 4l-2 6h7l-2-6c4 5 10-1 4-4 5-3 0-10-5-4Z`:`m${Number(x)+13} ${Number(y)+15} 5 7-5 7-5-7Z`}" fill="${paperEdge}"/></g>`).join('');
  const holes=[];
  for(let i=0;i<12;i++) for(const y of [49,56,67,74]) holes.push(`<circle cx="${36+i*7.7}" cy="${y}" r="1.45" fill="var(--cell)" stroke="var(--line)" stroke-width=".5"/>`);
  for(const x of [26,137]) for(const y of [54,61,68]) holes.push(`<circle cx="${x}" cy="${y}" r="1.4" fill="var(--cell)" stroke="var(--line)" stroke-width=".5"/>`);
  const peg=(x:number,y:number,other=false)=>`<path d="M${x-1.2} ${y}v-8h2.4v8Z" fill="${other?rival:primary}" stroke="var(--line)" stroke-width=".5"/><ellipse cx="${x}" cy="${y-8}" rx="2.4" ry="2" fill="${other?rival:primary}" stroke="var(--text)" stroke-opacity=".25" stroke-width=".5"/>`;
  return `${cardsArt}<rect class="art-frame" x="15" y="40" width="130" height="43" rx="20"/><rect x="20" y="44" width="120" height="35" rx="16" fill="none" stroke="var(--line)" stroke-width=".7"/>${line('M34 61h95', 'var(--line)', .6)}${holes.join('')}${peg(82.2,49)}${peg(74.5,49)}${peg(105.3,67,true)}${peg(97.6,67,true)}<circle cx="29" cy="61" r="1.5" fill="${accent}"/>`;
}

const illustrations: Record<string, () => string> = {
  noughts: noughtsArt, reversi: reversiArt, snake: snakeArt,
  backgammon: backgammonArt, mahjong: mahjongArt, sliding: slidingArt,
  pegs: pegsArt, dots: dotsArt, morris: morrisArt,
  kalah: kalahArt, nonograms: nonogramsArt, cribbage: cribbageArt,
};

/** Matches the existing lobby's 160 × 100 composition and shared art material. */
export function collectionGraphic(game: string): string {
  const art = illustrations[game]?.();
  return art ? `<div class="game-art" aria-hidden="true">${svg(art)}</div>` : '';
}
