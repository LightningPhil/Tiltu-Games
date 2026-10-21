import {PortedArcadeController,portGraphic} from './arcade-ports/controller.ts';
import {isPortGame} from './arcade-ports/store.ts';
import {patrolShipGraphic} from './patrol-view.ts';
import type {ActionGame} from './action-games.ts';
import type {SavedState} from './state.ts';
import {PatrolController} from './patrol-controller.ts';
import {TetriGridController} from './tetrigrid/controller.ts';
export function actionGraphic(game:ActionGame):string {
 if(isPortGame(game))return portGraphic(game);
 if(game==='salvage')return '<span class="game-art" aria-hidden="true">'+patrolShipGraphic('ranger')+'</span>';
 return '<span class="game-art" aria-hidden="true"><svg viewBox="0 0 240 150" fill="none"><rect class="art-frame" x="77" y="13" width="86" height="124" rx="5"/><path class="art-line" d="M81 111h78M81 88h78M99 17v116m21-116v116m21-116v116" opacity=".25"/><g class="art-primary"><rect x="82" y="115" width="16" height="16" rx="3"/><rect x="102" y="115" width="16" height="16" rx="3"/><rect x="122" y="115" width="16" height="16" rx="3"/><rect x="142" y="115" width="16" height="16" rx="3"/><rect x="82" y="95" width="16" height="16" rx="3"/><rect x="102" y="95" width="16" height="16" rx="3"/></g><g class="art-rival"><rect x="112" y="35" width="16" height="16" rx="3"/><rect x="92" y="55" width="16" height="16" rx="3"/><rect x="112" y="55" width="16" height="16" rx="3"/><rect x="132" y="55" width="16" height="16" rx="3"/></g><path class="art-line" stroke-dasharray="3 3" d="M112 74v12"/><path class="art-primary" d="M181 48v22m-7-11h14" opacity=".65"/></svg></span>';
}

/** Arcade games share app navigation, theme and persistence; each owns its input and animation loop. */
export class ActionArcadeController {
  private game:ActionGame|null=null;
  private ports:PortedArcadeController;
  private patrol:PatrolController;
  private blocks:TetriGridController;
  constructor(root:HTMLElement,state:SavedState,changed:()=>void,saveOnly:()=>void=()=>{}){this.ports=new PortedArcadeController(root,state,saveOnly);this.patrol=new PatrolController(root,state,changed,saveOnly);this.blocks=new TetriGridController(root,state,changed,saveOnly);}
  private get current(){return this.game==='blocks'?this.blocks:this.patrol;}
  ensure(game:ActionGame){this.game=game;if(isPortGame(game))this.ports.ensure(game);else this.current.ensure();}
  render(game:ActionGame){this.ensure(game);return isPortGame(game)?this.ports.render(game):this.current.render();}
  mount(game:ActionGame){this.ensure(game);if(isPortGame(game))this.ports.mount(game);else this.current.mount();}
  leave(){this.ports.leave();this.blocks.leave();this.patrol.leave();this.game=null;}
  keydown(e:KeyboardEvent){if(this.game&&!isPortGame(this.game))this.current.keydown(e);}
  action(action:string){if(this.game&&!isPortGame(this.game))this.current.action(action);}
  setting(id:string,value:string){if(this.game&&!isPortGame(this.game))this.current.setting(id,value);}
  tapHold(action:string){if(this.game&&!isPortGame(this.game))this.current.tapHold(action);}
}
