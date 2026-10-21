import type {SavedState} from '../state.ts';
import {PortScope} from './scope.ts';
import {newPortSave,type PortGame} from './store.ts';
import {createGame as createVoid} from './void/controller.ts';
import {createGame as createWhacker} from './whacker/controller.ts';
import {createGame as createHorizon} from './horizon/controller.ts';
import {createGame as createBallistics} from './ballistics/controller.ts';
import {view as voidView} from './void/view.ts';
import {view as whackerView} from './whacker/view.ts';
import {view as horizonView} from './horizon/view.ts';
import {view as ballisticsView} from './ballistics/view.ts';
import './void/style.css';
import './whacker/style.css';
import './horizon/style.css';
import './ballistics/style.css';
import './style.css';

import {PORT_NAMES} from './catalog.ts';
const configs={
  void:{view:voidView,create:createVoid,tag:'BUILD · EVADE · BREAK THE BLOCKADE'},
  whacker:{view:whackerView,create:createWhacker,tag:'PICK · POP · BONK'},
  horizon:{view:horizonView,create:createHorizon,tag:'LEARN · EXPLORE · TAKE FLIGHT'},
  ballistics:{view:ballisticsView,create:createBallistics,tag:'AIM · ADAPT · RESHAPE THE WORLD'},
};

/** Views are real collection children. Engines never load another app or document. */
export class PortedArcadeController {
  private game:PortGame|null=null;
  private instances=new Map<PortGame,PortScope>();
  constructor(private root:HTMLElement,private state:SavedState,private saveOnly:()=>boolean|void){}
  ensure(game:PortGame){this.state.actionArcade[game]??=newPortSave();this.game=game;}
  render(game:PortGame){this.ensure(game);return `<main class="ports-page ${game}-page"><header class="action-heading port-heading"><div><p class="eyebrow">${configs[game].tag}</p><h1 id="page-title" tabindex="-1">${PORT_NAMES[game]}</h1></div><span class="port-collection-label">TILTU’S GAMES <b>·</b> Progress stays on this browser</span></header><div class="port-viewport" id="ported-game-host"></div></main>`;}
  mount(game:PortGame){
    this.ensure(game);const host=this.root.querySelector<HTMLElement>('#ported-game-host');if(!host)return;
    let scope=this.instances.get(game);
    if(scope){scope.deactivate();host.append(scope.root);scope.activate();return;}
    const view=document.createElement('section');view.className=`arcade-port ${game}-port`;view.setAttribute('aria-label',PORT_NAMES[game]);view.innerHTML=configs[game].view;host.append(view);
    if(game==='void'){
      const intro=view.querySelector('.title-intro'),launch=view.querySelector('#launch-btn'),resume=view.querySelector('#resume-run-btn');
      if(intro&&launch){const actions=document.createElement('div');actions.className='port-launch-actions';actions.append(launch);if(resume)actions.append(resume);intro.after(actions);}
    }
    if(game==='horizon'){
      const intro=view.querySelector('.intro'),launch=view.querySelector('#start'),cruise=view.querySelector('#cruise-button');
      if(intro&&launch){const actions=document.createElement('div');actions.className='port-launch-actions';actions.append(launch);if(cruise)actions.append(cruise);intro.after(actions);}
    }
    if(game==='ballistics'){
      const title=view.querySelector('.title-row'),modes=view.querySelector('.mode-list');
      if(title&&modes){modes.classList.add('port-mode-actions');title.after(modes);}
    }
    if(game==='whacker'){
      // Keep the original garden/characters; place setup, guide and records beside it like the collection's other games.
      const sidebar=view.querySelector('.sidebar'),leaderboard=view.querySelector('.leaderboard');if(sidebar&&leaderboard)sidebar.append(leaderboard);
      const setup=view.querySelector('#setup-panel'),start=view.querySelector('#start');if(setup&&start)setup.prepend(start);
    }
    scope=new PortScope(game,view,this.state.actionArcade[game]!,this.saveOnly);this.instances.set(game,scope);scope.activate();
    try{scope.hooks=configs[game].create(scope);scope.resize();}
    catch(error){scope.deactivate();console.error(`Could not initialise ${PORT_NAMES[game]}`,error);view.innerHTML=`<div class="port-error"><h2>${PORT_NAMES[game]} could not start</h2><p>${error instanceof Error?error.message.replace(/[<>]/g,''):String(error)}</p><p>Your other games and saves are safe.</p></div>`;}
    const url=new URL(location.href);url.searchParams.set('game',game);history.replaceState(null,'',url);
  }
  leave(){if(this.game)this.instances.get(this.game)?.deactivate();this.game=null;}
  keydown(_event:KeyboardEvent){} // Each port's scoped input system handles its documented bindings.
  action(_action:string){}
  setting(_id:string,_value:string){}
  tapHold(_action:string){}
}

export function portGraphic(game:PortGame):string {
  const shape=game==='void'?'<path class="art-primary" d="m120 24 36 80-26-12-10 24-10-24-26 12z"/><path class="art-rival" d="m45 30 17 14-17 13-17-13zm148 58 16 14-16 14-16-14z"/><path class="art-line" d="M111 111v20m18-20v20M53 91l10-17m115-40-9 18"/>':game==='horizon'?'<path class="art-frame" d="M23 121V66h25v55m9 0V33h29v88m8 0V77h20v44m39 0V49h26v72m8 0V24h29v97"/><path class="art-primary" d="m122 47 39 41-34-8-11 22-3-26-25-14z"/><circle class="art-line" cx="135" cy="56" r="37"/>':game==='whacker'?'<ellipse class="art-frame" cx="116" cy="115" rx="63" ry="16"/><path class="art-primary" d="M85 108V80c0-27 62-27 62 0v28z"/><ellipse class="art-rival" cx="98" cy="42" rx="10" ry="31"/><ellipse class="art-rival" cx="133" cy="42" rx="10" ry="31"/><circle cx="103" cy="81" r="3" fill="var(--bg)"/><circle cx="132" cy="81" r="3" fill="var(--bg)"/><path class="art-line" d="m172 36 27 31m-30-44 35 35m-29-14 19 18"/>':'<path class="art-frame" d="m18 122 26-11 25 7 28-21 25 7 24-22 30 14 22-7 24 17"/><path class="art-primary" d="M54 92h48v16H54zM65 79h25v13H65zm15 1 32-22 5 8-32 23z"/><path class="art-rival" d="M164 68h35v14h-35zm7-11h20v11h-20z"/><path class="art-line" stroke-dasharray="3 4" d="M117 61q30-50 62-5"/>';
  return `<span class="game-art" aria-hidden="true"><svg viewBox="0 0 240 150" fill="none">${shape}</svg></span>`;
}
