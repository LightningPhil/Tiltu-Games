import {GAME_CATEGORY} from './catalog.ts';
import {panelNavigation} from './arcade-controls.ts';
import type {Game} from './state.ts';
import {prepareCardWorkspace} from './card-workspace.ts';

const puzzleBoards:Record<string,string>={sudoku:'.sudoku-board,.board-loading',mines:'.mine-window',tetravex:'.tetra-tables',mahjong:'.mahjong-board',sliding:'.sliding-board',pegs:'.peg-board',nonograms:'.nonogram-board',memory:'.memory-grid',kakuro:'.plus-number-board',futoshiki:'.futoshiki-board',skyscrapers:'.skyscrapers-board',slitherlink:'.plus-loop-board',hashi:'.plus-hashi-board',tangrams:'.tangram-stage',wordsearch:'.wordsearch-grid'};
const boardGames:Record<string,string>={snakes:'.snakes-board',senet:'.senet-board',ludo:'.ludo-board',dominoes:'.domino-line',chinese:'.plus-hop-network',ur:'.ur-board',gomoku:'.plus-gomoku',halma:'.plus-halma',fox:'.plus-hop-network',tafl:'.plus-tafl',nim:'.plus-nim-board',hex:'.plus-hex',four:'.four-board',draughts:'.draughts-board',chess:'.chess-board',go:'.go-board',noughts:'.noughts-board',reversi:'.reversi-board',backgammon:'.backgammon-board',dots:'.dots-board',morris:'.morris-board',kalah:'.kalah-board'};
const cardGames:Record<string,string>={hearts:'.plus-trick-stage',spades:'.plus-trick-stage',whist:'.plus-trick-stage',gin:'.plus-gin-table',cribbage:'.crib-table',blackjack:'.blackjack-table',poker:'.poker-table',patience:'.patience-board,.collection-card-table'};
const primary=new Set(['undo','hint','pause','flag-mode','deselect','return-tile','shuffle','notes','erase','number:0','mark:1','mark:-1','mark:0','tan-rotate:1','tan-rotate:-1','tan-flip','next-picture']);
const shorter:Record<string,string>={'A little hint':'Hint','Explain a move':'Hint','Reveal 1 tile':'Hint','Pencil marks':'Notes','Pencil marks on':'Notes on','Reshuffle remaining':'Shuffle','Return to tray':'Return tile','Clear selection':'Clear','Ⅱ Pause':'Pause','▶ Resume':'Resume'};
const boardActions=new Set(['race-roll','roll','double','accept','decline','pass','clear','four-hint','inspect-go','go-place','go-cancel','drop','clear-drop','suggest','flip-chess','flip-draughts','abstract:-1']);
const actionLabels:Record<string,string>={draw:'Draw',auto:'Home','four-hint':'Hint',suggest:'Hint','gin-pass':'Pass','gin-discard':'Discard','abstract:-1':'Swap colours'};

/** One viewport-sized workspace; settings never displace the active board. */
export class GameWorkspace {
 private tabs=new Map<string,string>();private zoom=new Map<string,boolean>();private game:Game='home';private selectPlay:(()=>void)|null=null;
 private resize:ResizeObserver|null=null;
 private pan=new Map<string,boolean>();private panPointer:{id:number;surface:HTMLElement;board:HTMLElement;x:number;y:number;left:number;top:number;inside:number}|null=null;
 constructor(private root:HTMLElement){
  root.addEventListener('click',event=>{if((event.target as Element).closest('.workspace-surface.is-panning')){event.preventDefault();event.stopImmediatePropagation();return;}const target=(event.target as Element).closest<HTMLElement>('button');if(!target)return;const action=target.dataset.plus??target.dataset.collection??target.dataset.arcade??target.dataset.patience??target.dataset.bj??target.dataset.poker;if(target.id==='new-game'||['new','deal','refill','next-picture','numbered-deal'].includes(action??'')||target.dataset.patienceVariant)this.tabs.set(this.game,'Play');if(target.dataset.patienceVariant){this.pan.set(this.game,false);this.zoom.set(this.game,false);}},true);
  root.addEventListener('keydown',event=>{if(event.key!=='Escape'||!this.selectPlay)return;if(this.tabs.get(this.game)!=='Play'){event.preventDefault();event.stopPropagation();this.selectPlay();}else if(this.pan.get(this.game)){event.preventDefault();event.stopPropagation();this.root.querySelector<HTMLButtonElement>('[data-workspace-pan]')?.click();}},true);
  root.addEventListener('pointerdown',event=>{const surface=(event.target as Element).closest<HTMLElement>('.workspace-surface.is-panning');if(!surface||event.button!==0)return;event.preventDefault();event.stopImmediatePropagation();if(this.panPointer)return;const board=surface.querySelector<HTMLElement>('.workspace-board')!;this.panPointer={id:event.pointerId,surface,board,x:event.clientX,y:event.clientY,left:surface.scrollLeft,top:surface.scrollTop,inside:board.scrollTop};surface.setPointerCapture(event.pointerId);},true);
  root.addEventListener('pointermove',event=>{const p=this.panPointer;if(!p||p.id!==event.pointerId)return;event.preventDefault();event.stopImmediatePropagation();p.surface.scrollLeft=p.left+p.x-event.clientX;p.surface.scrollTop=p.top+p.y-event.clientY;p.board.scrollTop=p.inside+p.y-event.clientY;},true);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])root.addEventListener(type,event=>{const p=this.panPointer;if(!p||p.id!==(event as PointerEvent).pointerId)return;this.panPointer=null;if(p.surface.hasPointerCapture(p.id))p.surface.releasePointerCapture(p.id);event.stopImmediatePropagation();},true);
  root.addEventListener('keydown',event=>{if(this.selectPlay&&this.tabs.get(this.game)!=='Play')event.stopPropagation();});
 }
 mount(game:Game){
  this.resize?.disconnect();this.resize=null;this.panPointer=null;this.game=game;this.selectPlay=null;
  if(!['Puzzles','Board games','Card games'].includes(GAME_CATEGORY[game]))return;
  const main=this.root.querySelector<HTMLElement>('main')!,arena=main.querySelector<HTMLElement>('.arena'),layout=main.querySelector('.play-layout'),sidebar=main.querySelector<HTMLElement>('.sidebar');
  if(!arena||!layout||!sidebar)return; // A generated puzzle may still be preparing.
  const board=(game==='spades'?arena.querySelector<HTMLElement>('.bid-picker'):null)??arena.querySelector<HTMLElement>(puzzleBoards[game]??boardGames[game]??cardGames[game]);if(!board)return;
  main.classList.add('game-workspace');this.root.dataset.workspace='true';
  const tools=document.createElement('div'),setup=document.createElement('div'),help=document.createElement('div');
  tools.className=setup.className=help.className='workspace-options';
  const stats=document.createElement('div'),surface=document.createElement('div'),inputs=document.createElement('div'),actions=document.createElement('div'),feedback=document.createElement('div');
  stats.className='workspace-stats';surface.className='workspace-surface';inputs.className='workspace-inputs';actions.className='workspace-actions';feedback.className='workspace-feedback';
  board.classList.add('workspace-board');
  const computed=getComputedStyle(board).aspectRatio.split('/').map(Number),ratio=computed.length===2?computed[0]/computed[1]:1;
  surface.style.setProperty('--board-ratio',String(game==='tetravex'?2:game==='tangrams'?4/3:game==='memory'?Number(board.style.getPropertyValue('--memory-cols'))**2/board.children.length:ratio));
  if(game==='tetravex')surface.classList.add('workspace-tile-tables');
  if(game==='senet'){
   surface.classList.add('workspace-senet');
   for(const piece of board.querySelectorAll<HTMLElement>('.senet-house,.race-counter')){piece.style.setProperty('--senet-x',String(parseFloat(piece.style.left)));piece.style.setProperty('--senet-y',String(parseFloat(piece.style.top)));}
  }
  if(game==='memory')surface.style.setProperty('--board-head','14px');
  if(game==='nim')surface.style.setProperty('--board-ratio','1.5');
  if(game==='mines'){
   const cells=board.querySelector('.mine-board'),cols=Number((cells as HTMLElement)?.style.getPropertyValue('--mine-cols'))||9,rows=cells?cells.children.length/cols:9;
   surface.style.setProperty('--board-ratio',String(cols/rows));surface.style.setProperty('--board-head','112px');surface.style.setProperty('--workspace-large-width',`${Math.max(680,cols*32+24)}px`);
   board.classList.add('fit-minefield');
  }
  const cards=GAME_CATEGORY[game]==='Card games'?prepareCardWorkspace(game,main,arena,board,{stats,inputs,actions,tools,help,setup,feedback}):{table:false,hand:false};
  for(const element of [...arena.querySelectorAll('.puzzle-stats,.memory-scores,.players')])stats.append(element);
  for(const element of [...sidebar.querySelectorAll('.rules-card'),...arena.querySelectorAll('.board-caption')]){if(element instanceof HTMLDetailsElement){element.removeAttribute('data-remember');element.open=true;}help.append(element);}
  const status=arena.querySelector('.status-card');
  if(game==='go'){
   const score=arena.querySelector('.score-panel');if(score){for(const button of [...score.querySelectorAll('button')])actions.append(button);feedback.append(score);}
   if(arena.querySelector('[data-quick="inspect-go"][aria-pressed="true"],[data-quick="go-place"]')){
    const guidance=arena.querySelector('.board-guidance'),preview=arena.querySelector('.position-tools>span');for(const node of [guidance,preview])if(node){node.classList.add('workspace-guidance');inputs.append(node);}
   }
  }
  if(GAME_CATEGORY[game]==='Board games')for(const node of [...main.querySelectorAll('.coach-advice,.draughts-tutor-actions')])feedback.append(node);
  if(game==='sudoku'){
   arena.querySelector('.mobile-input')?.remove();
   const pad=sidebar.querySelector('.number-pad');if(pad)inputs.append(pad);
   for(const id of ['notes','erase','undo','hint','pause']){const button=sidebar.querySelector<HTMLElement>(`#${id}`);if(button)actions.append(button);}
   for(const id of ['redo','auto-notes','check']){const button=sidebar.querySelector<HTMLElement>(`#${id}`);if(button)tools.append(button);}
  }
  for(const element of [...arena.querySelectorAll('.plus-number-pad,.word-list,.tan-piece-picker,.race-cast-panel,.race-reserves,.bg-dashboard,.bg-off,.hex-colour-key,.plus-domino-rival,.domino-end-summary,.plus-domino-hand')])inputs.append(element);
  if(game==='dominoes'){
   const rival=inputs.querySelector('.plus-domino-rival'),ends=inputs.querySelector('.domino-end-summary');if(rival)tools.append(rival);
   if(ends){const openEnds=ends.children[1];if(openEnds){openEnds.classList.add('workspace-domino-ends');stats.querySelector('.puzzle-stats')?.append(openEnds);}tools.append(ends);}
  }
  for(const pad of inputs.querySelectorAll<HTMLElement>('.number-pad,.plus-number-pad')){const digits=pad.children.length;pad.style.setProperty('--workspace-digits',String(digits===12?6:digits));}
  const tilePreview=arena.querySelector('.mahjong-inspector');if(tilePreview&&!tilePreview.querySelector('.empty-tile-preview'))inputs.append(tilePreview);
  for(const toolbar of [...arena.querySelectorAll('.collection-toolbar,.arcade-toolbar,.nono-tools,.match-tools,.position-tools,.drop-confirm,.patience-quickbar')]){
   for(const button of [...toolbar.querySelectorAll<HTMLButtonElement>('button')]){
    const action=button.dataset.plus??button.dataset.collection??button.dataset.arcade??button.dataset.quick??button.dataset.coach??button.dataset.patience??button.id;
    if(['zoom','tile-size','fit-field','board-size','new','card-spread'].includes(action)){button.remove();continue;}
    const destination=primary.has(action)||boardActions.has(action)||action.startsWith('domino-')||action.startsWith('bg-move:')||GAME_CATEGORY[game]==='Card games'&&!['restart','card-sort'].includes(action)?actions:tools;
    if(shorter[button.textContent?.trim()??''])button.textContent=shorter[button.textContent!.trim()];
    const label=actionLabels[action]??(action==='hint'?'Hint':action==='gin-draw:discard'?'Take upcard':action==='crib-discard'?button.textContent?.replace(/^Send (\d+) \/ 2.*$/,'To crib · $1 / 2'):undefined);
    if(label&&button.textContent?.trim()!==label){button.setAttribute('aria-label',button.textContent!.trim());button.title=button.textContent!.trim();button.textContent=label;}
    destination.append(button);
   }
   if(toolbar.textContent?.trim())tools.append(toolbar);else toolbar.remove();
  }
  for(const element of [...arena.querySelectorAll('.hint-card,.action-feedback,.go-scoring,.capture-routes')])feedback.append(element);
  for(const element of [...arena.querySelectorAll('.chess-captures'),...sidebar.querySelectorAll('.tutor-panel')])tools.append(element);
  surface.append(board);
  for(const child of [...arena.children]){
   if(child===status||child===stats||child===surface||child===inputs||child===actions||child===feedback)continue;
   if(child.textContent?.trim()||child.querySelector('button,input,svg'))tools.append(child);else child.remove();
  }
  setup.append(...sidebar.children);
  const zoom=document.createElement('button');zoom.type='button';zoom.className='button';zoom.dataset.workspaceZoom='';
  const pan=document.createElement('button');pan.type='button';pan.className='button';pan.dataset.workspacePan='';
  const setPan=(active:boolean)=>{this.pan.set(game,active);surface.classList.toggle('is-panning',active);pan.textContent=active?'Move pieces':'Pan board';pan.setAttribute('aria-pressed',String(active));};
  pan.addEventListener('click',()=>setPan(!this.pan.get(game)));setPan(this.pan.get(game)??false);
  const setZoom=(enlarged:boolean)=>{this.zoom.set(game,enlarged);surface.classList.toggle('is-enlarged',enlarged&&!cards.hand);inputs.classList.toggle('large-hand',enlarged&&cards.hand);const note=inputs.querySelector<HTMLElement>('.workspace-hand-note');if(note)note.hidden=!enlarged;zoom.textContent=cards.hand?enlarged?'Fit hand':'Larger cards':enlarged?'Fit board':'Enlarge';zoom.setAttribute('aria-pressed',String(enlarged));pan.hidden=cards.hand||!enlarged&&!cards.table;if(!enlarged&&!cards.table)setPan(false);this.fitBoard(surface,board);};
  zoom.addEventListener('click',()=>setZoom(!this.zoom.get(game)));setZoom(this.zoom.get(game)??false);actions.append(zoom,pan);
  arena.replaceChildren(stats,surface,inputs,actions,feedback,...(status?[status]:[]));
  const host=document.createElement('div');host.id='game-workspace';
  const groups=[{name:'Play',elements:[arena]},...(tools.children.length?[{name:'Tools',elements:[tools]}]:[]),{name:'Setup',elements:[setup]},{name:'Help',elements:[help]}];
  panelNavigation(host,'Game sections',groups,Math.max(0,groups.findIndex(group=>group.name===this.tabs.get(game))),index=>this.tabs.set(game,groups[index].name));
  host.querySelectorAll('[role=tab]').forEach((tab,index)=>{tab.id=`workspace-tab-${groups[index].name.toLowerCase()}`;host.querySelector(`[role=tabpanel]:nth-of-type(${index+1})`)?.setAttribute('aria-labelledby',tab.id);});
  this.selectPlay=()=>{(host.querySelector('[role=tab]') as HTMLButtonElement).click();(host.querySelector('[role=tab]') as HTMLButtonElement).focus({preventScroll:true});};
  const license=this.root.querySelector('#license-info');if(license)help.append(license);
  main.append(host);layout.remove();
  this.resize=new ResizeObserver(()=>this.fitBoard(surface,board));this.resize.observe(surface);this.fitBoard(surface,board);
 }
 private fitBoard(surface:HTMLElement,board:HTMLElement){
  board.style.removeProperty('--workspace-fit-width');
  if(surface.classList.contains('is-enlarged')||board.classList.contains('workspace-card-field')||!surface.clientHeight)return;
  // Account for real grid gaps, clue gutters and decorative frames as well as aspect ratio.
  for(let pass=0;pass<3;pass++){
   const box=board.getBoundingClientRect(),height=surface.clientHeight-4;
   if(box.height<=height||box.width<=0)break;
   board.style.setProperty('--workspace-fit-width',`${Math.max(1,Math.floor(box.width*height/box.height)-2)}px`);
  }
 }
}
