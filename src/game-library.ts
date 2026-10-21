import {CATEGORIES,GAME_CATEGORY,GAME_DESCRIPTIONS,GAME_NAMES,PATIENCE_NAMES} from './catalog.ts';
import type {Category} from './catalog.ts';
import {GAMES} from './state.ts';
import type {Game} from './state.ts';

export type LibraryFilter=Category|'Recent';
export interface LibraryTarget {game:Game;patience?:keyof typeof PATIENCE_NAMES}
const games=GAMES.filter(game=>game!=='home');
const known=new Set<Game>(games);
const historyKey='tiltu-library-v1';
const labels:Record<LibraryFilter,string>={'All games':'All',Recent:'Recent','Board games':'Board','Card games':'Cards',Puzzles:'Puzzles','Arcade & worlds':'Arcade'};
const aliases:Partial<Record<Game,string>>={four:'connect four connect4 connect 4',draughts:'checkers',noughts:'tic tac toe tictactoe',patience:'solitaire free cell freecell spider klondike',nonograms:'nonogram picross',tetravex:'tetravex edge matching',sliding:'fifteen sliding puzzle',life:'game of life conway',whacker:'whack a mole whack a party',chinese:'chinese checkers',poker:'texas holdem hold em five card draw'};
const normalize=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const esc=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

export function recentGames(value:unknown):Game[]{
 return Array.isArray(value)?[...new Set(value.filter((game):game is Game=>typeof game==='string'&&known.has(game as Game)))].slice(0,8):[];
}
export function findLibraryGames(filter:LibraryFilter,query:string,recent:Game[]=[]):Game[]{
 const term=normalize(query),words=term.split(' ').filter(Boolean);
 const source=words.length?games:filter==='Recent'?recentGames(recent):games.filter(game=>filter==='All games'||GAME_CATEGORY[game]===filter);
 const result=source.filter(game=>{const text=normalize(`${GAME_NAMES[game]} ${GAME_DESCRIPTIONS[game]} ${GAME_CATEGORY[game]} ${aliases[game]??''}`),compact=text.replace(/ /g,'');return words.every(word=>text.includes(word)||compact.includes(word));});
 const relevance=(game:Game)=>{const name=normalize(GAME_NAMES[game]),alias=normalize(aliases[game]??'');return name===term||name.replace(/ /g,'')===term.replace(/ /g,'')?0:name.startsWith(term)||alias===term?1:name.includes(term)?2:alias.includes(term)?3:4;};
 return filter==='Recent'&&!words.length?result:result.sort((a,b)=>(words.length?relevance(a)-relevance(b):0)||GAME_NAMES[a].localeCompare(GAME_NAMES[b],'en',{numeric:true,sensitivity:'base'}));
}
export function libraryPage(source:Game[],requested:number,size:number){
 const capacity=Number.isFinite(size)?Math.max(1,Math.floor(size)):1,count=Math.max(1,Math.ceil(source.length/capacity));
 const index=Number.isFinite(requested)?Math.max(0,Math.min(count-1,Math.floor(requested))):0,start=index*capacity;
 return {games:source.slice(start,start+capacity),index,count,start,end:Math.min(source.length,start+capacity),total:source.length};
}
export function libraryTarget(game:Game,query:string):LibraryTarget{
 const term=normalize(query).replace(/ /g,'');
 const patience=game==='patience'?Object.keys(PATIENCE_NAMES).find(variant=>term.includes(variant)):undefined;
 return {game,...(patience?{patience:patience as keyof typeof PATIENCE_NAMES}:{})};
}

interface ViewState {filter:LibraryFilter;query:string;page:number;capacity?:number}
interface LibraryOptions {
 current:()=>Game;hasProgress:(game:Game)=>boolean;
 beforeOpen:()=>void;choose:(game:Game,patience?:keyof typeof PATIENCE_NAMES)=>void;afterCancel:()=>void;
}

class LibraryView {
 private host:HTMLElement;private state:ViewState;private recent:()=>Game[];private options:LibraryOptions;private choose:(target:LibraryTarget)=>void;
 private observer:ResizeObserver;private capacity=6;private columns=2;private rows=3;private pageOptions='';
 private search:HTMLInputElement;private results:HTMLElement;private count:HTMLElement;private pager:HTMLSelectElement;
 constructor(host:HTMLElement,state:ViewState,recent:()=>Game[],options:LibraryOptions,choose:(target:LibraryTarget)=>void){
  this.host=host;this.state=state;this.recent=recent;this.options=options;this.choose=choose;
  this.capacity=state.capacity??6;
  const id=host.id==='home-library'?'game-search':'library-search';
  host.classList.add('game-library');
  host.innerHTML=`<div class="library-search"><label class="visually-hidden" for="${id}">Find any of ${games.length} games</label><span aria-hidden="true">⌕</span><input id="${id}" type="search" enterkeyhint="search" placeholder="Search all ${games.length} games" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(state.query)}"><button type="button" data-library-clear aria-label="Clear search">×</button></div>
   <div class="library-filters" role="group" aria-label="Game categories">${(['All games','Recent',...CATEGORIES.slice(1)] as LibraryFilter[]).map(filter=>`<button type="button" data-library-filter="${filter}" aria-pressed="false"><span>${labels[filter]}</span><small></small></button>`).join('')}</div>
   <p class="library-count" role="status" aria-live="polite" aria-atomic="true"></p><section class="library-results game-cards" aria-label="Games"></section>
   <nav class="library-pagination" aria-label="Game pages"><button type="button" data-library-previous aria-label="Previous games">← <span>Previous</span></button><label><span class="visually-hidden">Game page</span><select data-library-page aria-label="Game page"></select></label><button type="button" data-library-next aria-label="Next games"><span>Next</span> →</button></nav>`;
  this.search=host.querySelector('input')!;this.results=host.querySelector('.library-results')!;this.count=host.querySelector('.library-count')!;this.pager=host.querySelector('[data-library-page]')!;
  this.search.addEventListener('input',event=>{event.stopPropagation();state.query=this.search.value;state.page=0;if(state.query.trim())state.filter='All games';this.refresh();});
  this.search.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();this.search.blur();}});
  this.pager.addEventListener('change',event=>{event.stopPropagation();state.page=Number(this.pager.value);this.refresh();});
  host.addEventListener('click',event=>{
   const button=(event.target as Element).closest<HTMLButtonElement>('button');if(!button||button.disabled)return;event.stopPropagation();
   if(button.dataset.libraryGame){this.choose(libraryTarget(button.dataset.libraryGame as Game,state.query));return;}
   if(button.hasAttribute('data-library-clear')||button.hasAttribute('data-library-reset')){state.query='';this.search.value='';state.page=0;state.filter='All games';this.refresh();this.search.focus();return;}
   if(button.dataset.libraryFilter){state.filter=button.dataset.libraryFilter as LibraryFilter;state.query='';this.search.value='';state.page=0;this.refresh();return;}
   if(button.hasAttribute('data-library-next'))state.page++;
   if(button.hasAttribute('data-library-previous'))state.page--;
   this.refresh();
  });
  this.observer=new ResizeObserver(()=>this.fit());this.observer.observe(this.results);this.fit();this.refresh();
 }
 destroy(){this.observer.disconnect();}
 clearSearch(){if(this.state.query){this.state.query='';this.state.page=0;}}
 private fit(){
  const {width,height}=this.results.getBoundingClientRect();if(!width||!height)return;
  const columns=width>=920?4:width>=610?3:2,rows=Math.max(1,Math.min(6,Math.floor((height+8)/82)));
  if(columns===this.columns&&rows===this.rows&&this.capacity===columns*rows)return;
  const first=this.state.page*this.capacity;this.columns=columns;this.rows=rows;this.capacity=columns*rows;this.state.capacity=this.capacity;this.state.page=Math.floor(first/this.capacity);
  this.results.style.setProperty('--library-columns',String(columns));this.results.style.setProperty('--library-rows',String(rows));this.refresh();
 }
 private refresh(){
  const recent=this.recent();
  for(const button of this.host.querySelectorAll<HTMLButtonElement>('[data-library-filter]')){
   const filter=button.dataset.libraryFilter as LibraryFilter,n=filter==='Recent'?recent.length:filter==='All games'?games.length:games.filter(game=>GAME_CATEGORY[game]===filter).length;
   button.setAttribute('aria-pressed',String(this.state.filter===filter));button.setAttribute('aria-label',`${filter}, ${n} games`);button.querySelector('small')!.textContent=String(n);button.disabled=filter==='Recent'&&!n;
  }
  this.host.querySelector<HTMLButtonElement>('[data-library-clear]')!.hidden=!this.state.query;
  const page=libraryPage(findLibraryGames(this.state.filter,this.state.query,recent),this.state.page,this.capacity);this.state.page=page.index;
  this.count.textContent=page.total?`${this.state.query.trim()?`${page.total} match${page.total===1?'':'es'}`:this.state.filter==='Recent'?'Recently played':`${this.state.filter} · ${page.total}`} · ${page.start+1}–${page.end}`:'No games found';
  this.results.innerHTML=page.games.map(game=>{
   const target=libraryTarget(game,this.state.query),name=target.patience?PATIENCE_NAMES[target.patience]:GAME_NAMES[game],current=this.options.current()===game;
   const category=labels[GAME_CATEGORY[game]],detail=target.patience?'Patience':current?'Playing':this.options.hasProgress(game)?'Continue':game==='patience'?'3 variants':game==='poker'?'3 styles':'';
   const words=GAME_NAMES[game].replace(/[^a-zA-Z0-9 ]/g,'').split(' ').filter(Boolean),monogram=/^\d/.test(words[0])?words[0]:words.length===1?words[0].slice(0,2):words[0][0]+words.at(-1)![0];
   return `<button type="button" class="game-card library-game" data-game="${game}" data-library-game="${game}" ${current?'aria-current="page"':''} title="${esc(GAME_DESCRIPTIONS[game])}"><span class="library-icon" data-kind="${category}" aria-hidden="true">${monogram}</span><span class="library-game-label"><h2>${esc(name)}</h2><small>${category}${detail?' · '+detail:''}</small></span></button>`;
  }).join('')||(this.state.filter==='Recent'?'<div class="empty-library"><p>Your recent games will appear here.</p><button type="button" class="button" data-library-reset>Browse all games</button></div>':'<div class="empty-library"><p>No games match that search.</p><button type="button" class="button" data-library-reset>Show all 54 games</button></div>');
  this.results.scrollTop=0;
  this.host.querySelector<HTMLButtonElement>('[data-library-previous]')!.disabled=page.index===0;
  this.host.querySelector<HTMLButtonElement>('[data-library-next]')!.disabled=page.index===page.count-1;
  const key=String(page.count);
  if(key!==this.pageOptions){this.pager.innerHTML=Array.from({length:page.count},(_,index)=>`<option value="${index}">${index+1} / ${page.count}</option>`).join('');this.pageOptions=key;}
  this.pager.value=String(page.index);this.pager.disabled=page.count===1;
 }
}

/** The home library and the in-game chooser share discovery and responsive pagination. */
export class GameLibrary {
 private root:HTMLElement;private options:LibraryOptions;
 private recent:Game[]=[];private home:LibraryView|null=null;private homeState:ViewState={filter:'All games',query:'',page:0};private dialog:HTMLDialogElement|null=null;
 constructor(root:HTMLElement,options:LibraryOptions){
  this.root=root;this.options=options;
  const fitViewport=()=>{const viewport=window.visualViewport,height=viewport&&Math.abs(viewport.scale-1)<.01?viewport.height:innerHeight;document.documentElement.style.setProperty('--library-viewport-height',`${height}px`);document.documentElement.classList.toggle('library-keyboard',!!document.activeElement?.matches('.library-search input')&&height<innerHeight-100);};
  window.addEventListener('resize',fitViewport);window.visualViewport?.addEventListener('resize',fitViewport);document.addEventListener('focusin',fitViewport);document.addEventListener('focusout',()=>queueMicrotask(fitViewport));fitViewport();
  try{this.recent=recentGames(JSON.parse(localStorage.getItem(historyKey)??'[]'));}catch{/* Storage may be unavailable. */}
  this.remember(options.current());
  root.addEventListener('click',event=>{if((event.target as Element).closest('[data-library-open]')){event.stopImmediatePropagation();this.open();}},true);
 }
 get isOpen(){return this.dialog!==null;}
 remember(game:Game){if(!known.has(game))return;this.recent=recentGames([game,...this.recent]);try{localStorage.setItem(historyKey,JSON.stringify(this.recent));}catch{/* Discovery also works without storage. */}}
 unmountHome(){this.home?.destroy();this.home=null;}
 mountHome(){const host=this.root.querySelector<HTMLElement>('#home-library');if(host)this.home=new LibraryView(host,this.homeState,()=>this.recent,this.options,target=>{this.home?.clearSearch();this.options.choose(target.game,target.patience);});}
 open(){
  if(this.dialog||document.querySelector('dialog[open]'))return;
  this.options.beforeOpen();
  const dialog=document.createElement('dialog');this.dialog=dialog;dialog.className='game-library-dialog';dialog.setAttribute('aria-labelledby','game-library-title');
  dialog.innerHTML='<div class="library-dialog-heading"><h2 id="game-library-title">Choose a game</h2><button class="button" type="button" data-library-close autofocus aria-label="Close game picker">Close ×</button></div><div id="switch-library"></div>';
  let selected:LibraryTarget|null=null;document.body.append(dialog);document.documentElement.classList.add('library-dialog-open');dialog.showModal();
  this.root.querySelector('[data-library-open]')?.setAttribute('aria-expanded','true');
  const view=new LibraryView(dialog.querySelector('#switch-library')!,{filter:'All games',query:'',page:0},()=>this.recent,this.options,target=>{selected=target;dialog.close();});
  dialog.querySelector('[data-library-close]')!.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  dialog.addEventListener('close',()=>{view.destroy();dialog.remove();this.dialog=null;document.documentElement.classList.remove('library-dialog-open');if(selected)this.options.choose(selected.game,selected.patience);else{this.options.afterCancel();this.root.querySelector<HTMLElement>('[data-library-open]')?.focus({preventScroll:true});}});
 }
}
