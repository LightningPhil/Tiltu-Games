/** Original, theme-coloured artwork shared by the lobby, games and tutors. */
export type ChessArtPiece = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
let paintSerial = 0;
const chessShapes: Record<ChessArtPiece, string> = {
  p: '<circle cx="32" cy="18" r="8"/><path d="M25 27h14l-3 7c0 7 2 11 7 15H21c5-4 7-8 7-15z"/><path d="M23 26h18v5H23z"/>',
  r: '<path d="M17 10h7v7h5v-7h6v7h5v-7h7v17l-7 5 2 17H22l2-17-7-5z"/><path class="piece-detail" d="M22 27h20M26 34v10m12-10v10"/>',
  b: '<path d="M32 6c-5 7-13 13-13 21 0 6 5 10 13 10s13-4 13-10C45 19 37 13 32 6z"/><path d="M27 37h10l5 12H22z"/><path class="piece-detail" d="m35 16-7 11M22 32h20"/>',
  n: '<path d="M21 49c1-7 2-11 8-16l-9 3-6-7 10-13 1-9 8 5c16 1 20 18 16 37z"/><path class="piece-detail" d="m28 19-7 10m14-10c9 5 10 15 8 22"/><circle class="piece-eye" cx="30" cy="21" r="2"/>',
  q: '<path d="m17 18 7 7 8-12 8 12 7-7-6 23H23z"/><path d="M23 41h18l3 8H20z"/><circle cx="16" cy="15" r="3"/><circle cx="32" cy="10" r="3"/><circle cx="48" cy="15" r="3"/><path class="piece-detail" d="M24 34h16m-13-8 2 8m8-8-2 8"/>',
  k: '<path d="M29 5h6v6h6v6h-6v7h-6v-7h-6v-6h6z"/><path d="M24 23c-8-4-12 3-8 10l8 10-3 6h22l-3-6 8-10c4-7 0-14-8-10l-8 5z"/><path class="piece-detail" d="M24 41h16m-8-12v10"/>',
};
export function chessGraphic(piece: ChessArtPiece): string {
  const id = `chess-material-${++paintSerial}`;
  return `<svg class="chess-sculpture" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2=".25"><stop class="piece-stop-lit" offset="0"/><stop class="piece-stop-lit" offset=".22"/><stop class="piece-stop-body" offset=".48"/><stop class="piece-stop-shade" offset="1"/></linearGradient></defs><ellipse class="piece-ground" cx="33" cy="57" rx="23" ry="4"/><g class="piece-body" style="fill:url(#${id})" stroke-linejoin="round" stroke-linecap="round">${chessShapes[piece]}<path d="M20 49h24l4 6v4H16v-4z"/><path class="piece-detail" d="M22 53h20M20 57h24"/></g><path class="piece-highlight" d="M19 55v2m5-5h10"/></svg>`;
}

export function clubMark(): string {
  return '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="2" y="2" width="28" height="28" rx="7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 3v26M21 3v26M3 12h26M3 21h26" fill="none" stroke="currentColor" stroke-opacity=".35"/><circle cx="16.5" cy="16.5" r="3.5" fill="currentColor"/><circle cx="7.5" cy="25.5" r="2.4" fill="currentColor" opacity=".5"/><circle cx="25.5" cy="7.5" r="2.4" fill="currentColor" opacity=".5"/></svg>';
}

export function discEmblem(piece: number): string {
  const shape = Math.abs(piece) === 2
    ? '<path d="m7 13 5 6 8-10 8 10 5-6-4 15H11z"/><path d="M12 32h16"/><circle cx="7" cy="10" r="1.5"/><circle cx="20" cy="6" r="1.5"/><circle cx="33" cy="10" r="1.5"/>'
    : piece > 0 ? '<circle cx="20" cy="20" r="11"/>' : '<path d="m20 6 14 14-14 14L6 20z"/>';
  return `<svg class="piece-emblem ${Math.abs(piece) === 2 ? 'crown-emblem' : ''}" viewBox="0 0 40 40" aria-hidden="true" focusable="false">${shape}</svg>`;
}

const SUIT_PATHS = [
  'M12 1C8 6 2 9 2 14c0 5 6 6 9 2l-3 7h8l-3-7c3 4 9 3 9-2C22 9 16 6 12 1Z',
  'M12 22C9 18 1 13 1 7 1-1 10-1 12 5 14-1 23-1 23 7c0 6-8 11-11 15Z',
  'M12 2a5 5 0 0 0-4 8c-8-3-10 9-3 10 3 0 5-2 6-4l-3 7h8l-3-7c1 2 3 4 6 4 7-1 5-13-3-10a5 5 0 0 0-4-8Z',
  'M12 1 22 12 12 23 2 12Z',
];
export function cardSuit(suit: number): string {
  return `<svg class="card-suit" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${SUIT_PATHS[suit % 4]}" fill="currentColor"/></svg>`;
}
export function aceGraphic(suit: number): string {
  return `<svg class="ace-art" viewBox="0 0 80 100" aria-hidden="true"><path class="ace-flourish" d="M16 78C-1 59 6 29 23 20M64 78C81 59 74 29 57 20M13 59l-4-8 8 2m-5-10 2-8 5 5m48 19 4-8-8 2m5-10-2-8-5 5M28 85h24M32 89h16"/><g transform="translate(17 23) scale(1.9)"><path d="${SUIT_PATHS[suit % 4]}" fill="currentColor"/></g><path class="ace-flourish" d="m35 12 5-5 5 5-5 5z"/></svg>`;
}
export function chipGraphic(value: number | string = '', secondary = false): string {
  return `<svg class="chip-art ${secondary ? 'secondary-chip' : ''}" viewBox="0 0 64 64" aria-hidden="true"><circle class="chip-edge" cx="32" cy="34" r="29"/><circle class="chip-face" cx="32" cy="30" r="28"/><circle class="chip-inlays" cx="32" cy="30" r="24"/><circle class="chip-centre" cx="32" cy="30" r="19"/><circle class="chip-fine-ring" cx="32" cy="30" r="16"/><text x="32" y="34">${value}</text><path class="chip-glint" d="M11 25a22 22 0 0 1 29-16"/></svg>`;
}
export function chipStack(value: number): string {
  return `<span class="pot-chips" aria-hidden="true"><span>${chipGraphic('', true)}</span><span>${chipGraphic('')}</span><span>${chipGraphic(value > 999 ? '1K' : value)}</span></span>`;
}

const DIGIT_SEGMENTS = ['abcefg', 'cf', 'acdeg', 'acdfg', 'bcdf', 'abdfg', 'abdefg', 'acf', 'abcdefg', 'abcdfg'];
const SEGMENTS: Record<string,string> = { a:'3,1 17,1 19,3 17,5 3,5 1,3', b:'1,4 3,6 3,14 1,16 0,14 0,6', c:'19,4 20,6 20,14 19,16 17,14 17,6', d:'3,15 17,15 19,17 17,19 3,19 1,17', e:'1,18 3,20 3,28 1,30 0,28 0,20', f:'19,18 20,20 20,28 19,30 17,28 17,20', g:'3,29 17,29 19,31 17,33 3,33 1,31' };
export function digitalGraphic(value: number): string {
  const n = Math.max(-999, Math.min(999, Math.trunc(value)));
  const text = n < 0 ? `-${String(-n).padStart(2,'0')}` : String(n).padStart(3,'0');
  return `<svg class="segment-display" viewBox="0 0 ${text.length * 24} 36" aria-hidden="true">${[...text].map((n,i)=>`<g transform="translate(${i*24+2} 1)">${Object.entries(SEGMENTS).map(([key,points])=>`<polygon class="${(n==='-'?'d':DIGIT_SEGMENTS[Number(n)]).includes(key)?'segment-on':'segment-off'}" points="${points}"/>`).join('')}</g>`).join('')}</svg><span class="visually-hidden">${text}</span>`;
}

export function cardBackGraphic(): string {
  return '<svg viewBox="0 0 60 84" aria-hidden="true"><path d="M30 7 53 42 30 77 7 42Z" fill="none" stroke="currentColor" stroke-width=".7"/><path d="M30 14 48 42 30 70 12 42Z" fill="none" stroke="currentColor" stroke-width=".5"/><path d="M5 5h12M5 5v12m50-12H43m12 0v12M5 79h12M5 79V67m50 12H43m12 0V67" fill="none" stroke="currentColor"/><g transform="translate(15 27) scale(.94)">'+clubMark().replace('<svg viewBox="0 0 32 32" aria-hidden="true">','').replace('</svg>','')+'</g><circle cx="30" cy="18" r="1.5" fill="currentColor"/><circle cx="30" cy="66" r="1.5" fill="currentColor"/></svg>';
}

export function courtGraphic(rank: number, suit = 0): string {
  const crown = rank === 11 ? '<path d="M12 17 29 10l7 9H12z"/>' : rank === 12 ? '<path d="m12 18-2-10 9 6 5-10 5 10 9-6-2 10z"/>' : '<path d="M12 18 9 7l10 6 5-10 5 10 10-6-3 11z"/>';
  const half = `<path class="court-coat" d="m3 52 7-16 11-6h9l10 6 5 16z"/><path class="court-gold" d="m17 32 7 8 7-8 3 20H14z"/><path class="court-embroidery" d="m7 44 7-7m-5 12 7-7m18-4 7 7m-9-2 7 7M20 42l4 4 4-4m-9 8 5-4 5 4"/><path class="court-hair" d="M13 18q10-10 21 0l1 14-9 3-15-6z"/><path class="court-face" d="M17 17h15v6l3 3-4 1v4l-10 2-5-6z"/><path class="court-line" d="m25 21 4 0m-6 6 5 1m-9-7v5"/>${rank === 13 ? '<path class="court-hair" d="m20 28 5 3 6-1-3 8-9-7z"/>' : ''}<g class="court-gold">${crown}</g><path class="court-line" d="M13 18h23M15 15h19m-17 1 2-4m8 4 1-5"/><g class="court-suit" transform="translate(5 31) scale(.24)"><path d="${SUIT_PATHS[suit]}"/></g>${rank === 13 ? '<path class="court-gold" d="m38 16 3 5-2 23h-2l-2-23z"/><path class="court-line" d="M33 27h10m-5-7v22"/>' : rank === 12 ? '<path class="court-line" d="m38 24-2 20m-3-18 3-3 4 3m-7 4 3-3 4 3"/>' : '<path class="court-gold" d="m39 24 3 5-6 4-2-4z"/><path class="court-line" d="m39 29-4 17"/>'}<path class="court-face" d="m32 40 6-4 3 4-7 5z"/>`;
  return `<svg class="court-portrait" viewBox="0 0 48 100" aria-hidden="true"><path class="court-ground" d="M1 1h46v98H1z"/><g>${half}</g><g transform="translate(48 100) rotate(180)">${half}</g><path class="court-line" d="m2 50 44 0"/></svg>`;
}

export function mineGraphic(kind: 'mine' | 'flag' | 'happy' | 'lost' | 'won'): string {
  const content = kind === 'flag' ? '<path class="mine-flag" d="M10 3v13l13-7z"/><path d="M10 3v21m-5 1h15" fill="none" stroke="currentColor" stroke-width="2.5"/>' : kind === 'mine' ? '<path d="M14 1v26M1 14h26M5 5l18 18M5 23 23 5" stroke="currentColor" stroke-width="2"/><circle cx="14" cy="14" r="8" fill="currentColor"/><path d="M9 10h4v4H9z" fill="var(--cell)"/>' : `<circle cx="14" cy="14" r="11" class="mine-face"/><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">${kind === 'won' ? '<path d="M5 9h18m-16 0v5h5V9m4 0v5h5V9"/>' : kind === 'lost' ? '<path d="m8 8 4 4m0-4-4 4m8-4 4 4m0-4-4 4"/>' : '<path d="M10 9v2m8-2v2"/>'}<path d="${kind === 'lost' ? 'M9 21q5-7 10 0' : 'M8 17q6 8 12 0'}"/></g>`;
  return `<svg class="mine-symbol" viewBox="0 0 28 28" aria-hidden="true">${content}</svg>`;
}

const dot = (x: number, y: number, rival = false, r = 8) => `<circle class="${rival ? 'art-rival' : 'art-primary'}" cx="${x}" cy="${y}" r="${r}"/><circle class="art-ring" cx="${x}" cy="${y}" r="${r * .65}"/>`;
const grid = (cols: number, rows: number, x: number, y: number, step: number) => Array.from({length:cols*rows},(_,i)=>`<rect class="art-tile" x="${x+i%cols*step}" y="${y+Math.floor(i/cols)*step}" width="${step-2}" height="${step-2}" rx="2"/>`).join('');
const svgContents = (svg: string) => svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
export function gameGraphic(game: string): string {
  let art = '';
  if (game === 'four') art = `<rect class="art-frame" x="32" y="9" width="96" height="80" rx="7"/>${Array.from({length:20},(_,i)=>dot(45+i%5*18,23+Math.floor(i/5)*18,[11,14,18].includes(i),6.5)).map((s,i)=>i<10?s.replace('art-primary','art-hole'):s).join('')}`;
  if (game === 'draughts' || game === 'chess') art = `<g transform="translate(40 9)">${grid(4,4,0,0,20)}${game === 'draughts' ? `${dot(10,50)}${dot(30,30)}${dot(50,50,true)}${dot(70,10,true)}<path class="art-line" d="m5 49 3 4 3-5 3 5 3-4"/>` : `<g class="chess-white" transform="translate(0 3) scale(.65)">${chessGraphic('n')}</g><g class="chess-black" transform="translate(42 27) scale(.65)">${chessGraphic('k')}</g>`}</g>`;
  if (game === 'sudoku') art = `<g transform="translate(40 9)">${grid(4,4,0,0,20)}<path class="art-line" d="M39 0v78M0 39h78"/>${[1,0,3,0,0,3,0,1,3,0,1,0,0,1,0,3].map((n,i)=>n?`<text class="art-number" x="${9+i%4*20}" y="${14+Math.floor(i/4)*20}">${n}</text>`:'').join('')}</g>`;
  if (game === 'go') art = `<rect class="art-frame" x="35" y="9" width="90" height="80" rx="6"/><path class="art-line" d="M45 20h70M45 35h70M45 50h70M45 65h70M45 80h70M50 15v70m15-70v70m15-70v70m15-70v70m15-70v70"/>${dot(65,35,false,8)}${dot(80,50,true,8)}${dot(95,65,false,8)}${dot(65,65,true,8)}`;
  if (['blackjack','patience','poker'].includes(game)) {
    const label = game === 'patience' ? 'K' : game === 'poker' ? 'Q' : 'A';
    const portrait = game === 'blackjack' ? '<g transform="translate(80 31) scale(.35)">'+svgContents(aceGraphic(0))+'</g>' : '<g transform="translate(85 30) scale(.42)">'+svgContents(courtGraphic(game === 'patience' ? 13 : 12, game === 'patience' ? 2 : 1))+'</g>';
    art = `<g transform="rotate(-13 66 53)"><rect class="art-frame" x="38" y="16" width="45" height="67" rx="4"/><g class="mini-back-mark" transform="translate(47 37) scale(.85)">${svgContents(clubMark())}</g><path class="art-line" d="m60 23 18 27-18 27-18-27z"/></g><g class="mini-ink ${game === 'poker' ? 'red-card' : ''}" transform="rotate(12 94 53)"><rect class="art-card" x="72" y="14" width="45" height="67" rx="4"/><text class="art-rank" x="78" y="29">${label}</text>${portrait}</g>${game === 'poker' ? `<g class="chip-art secondary-chip" transform="translate(110 64) scale(.4)">${svgContents(chipGraphic('',true))}</g><g class="chip-art" transform="translate(126 62) scale(.4)">${svgContents(chipGraphic('25'))}</g>` : ''}`;
  }
  if (game === 'mines') art = `<g transform="translate(40 9)">${grid(4,4,0,0,20)}${[0,1,4,5,8,9,12,13].map(i=>`<rect class="art-hole" x="${i%4*20+1}" y="${Math.floor(i/4)*20+1}" width="16" height="16" rx="1"/>`).join('')}<text class="art-number" x="30" y="34">1</text><text class="art-number" x="30" y="54">2</text><g transform="translate(43 23) scale(.55)">${mineGraphic('flag')}</g></g>`;
  if (game === 'life') art = `<g transform="translate(28 7)">${grid(6,5,0,0,18)}${[2,9,13,14,15,22,27].map((i,j)=>`<rect class="${j>4?'art-rival':'art-primary'}" x="${i%6*18+2}" y="${Math.floor(i/6)*18+2}" width="12" height="12" rx="3"/>`).join('')}</g>`;
  if (game === 'ski') art = `<path class="art-track" d="M91 1c-65 26 51 27-13 56S46 84 54 98m44-97c-65 26 51 27-13 56S53 84 61 98"/><path class="art-frame" d="m28 59 14-29 14 29h-8l13 17H23l13-17zM110 33l12-25 12 25h-7l10 13h-30l10-13z"/><path class="art-rival" d="m83 53-7 14 8 4 5-13z"/><circle class="art-primary" cx="87" cy="47" r="5"/><path class="art-line" d="m75 70 15 12m-12-15 19 13M73 59l25 8"/>`;
  if (game === 'tetravex') art = `<g transform="translate(37 8)">${[0,1,2,3].map((_,i)=>`<g transform="translate(${i%2*44} ${Math.floor(i/2)*44})"><rect class="art-frame" width="40" height="40" rx="3"/><path class="art-primary" d="M1 1h38L20 20z"/><path class="art-rival" d="M1 39h38L20 20z"/><path class="art-line" d="m0 0 40 40m0-40L0 40"/><text class="art-small-number" x="20" y="12">${[2,4,6,2][i]}</text><text class="art-small-number" x="20" y="36">${[6,2,3,5][i]}</text></g>`).join('')}</g>`;
  return `<span class="game-art" aria-hidden="true"><svg viewBox="0 0 160 100" focusable="false">${art}</svg></span>`;
}
