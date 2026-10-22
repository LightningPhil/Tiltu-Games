import {GAME_NAMES} from './catalog.ts';
import {renderGameHelp} from './game-help.ts';
import type {HelpGame} from './game-help.ts';

/** Shortcuts work inside either the workspace's scroll panel or the modal body. */
export function bindGameHelp(host:HTMLElement){
 host.addEventListener('click',event=>{
  const button=(event.target as Element).closest<HTMLElement>('[data-help-jump]');if(!button)return;
  event.stopPropagation();
  const heading=host.querySelector<HTMLElement>(`[data-help-section="${button.dataset.helpJump}"] h2`);
  heading?.scrollIntoView({block:'start'});heading?.focus({preventScroll:true});
 });
}

interface HelpOptions {current:()=>HelpGame|'home';beforeOpen:()=>void;afterClose:()=>void}
export class GameHelpView {
 private root:HTMLElement;private options:HelpOptions;private dialog:HTMLDialogElement|null=null;
 constructor(root:HTMLElement,options:HelpOptions){
  this.root=root;this.options=options;
  root.addEventListener('click',event=>{
   const button=(event.target as Element).closest<HTMLElement>('[data-help-open],[data-action-arcade="help"]');
   if(!button)return;event.preventDefault();event.stopImmediatePropagation();this.open(button);
  },true);
 }
 get isOpen(){return this.dialog!==null;}
 private open(trigger:HTMLElement){
  const game=this.options.current();if(game==='home'||this.dialog||document.querySelector('dialog[open]'))return;
  const restore=trigger.id?`#${trigger.id}`:trigger.hasAttribute('data-help-open')?'[data-help-open]':'[data-action-arcade="help"]';
  this.options.beforeOpen();
  const dialog=document.createElement('dialog');this.dialog=dialog;dialog.className='game-help-dialog';dialog.setAttribute('aria-labelledby','game-help-title');
  dialog.innerHTML='<header class="help-dialog-heading"><h2 id="game-help-title"></h2><button type="button" class="button" data-help-close autofocus>Close ×</button></header><div class="help-dialog-body"></div>';
  dialog.querySelector('#game-help-title')!.textContent=`${GAME_NAMES[game]} · Help`;
  const body=dialog.querySelector<HTMLElement>('.help-dialog-body')!;body.innerHTML=renderGameHelp(game);bindGameHelp(body);
  dialog.querySelector('[data-help-close]')!.addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{
   dialog.remove();this.dialog=null;document.documentElement.classList.remove('game-help-open');this.options.afterClose();
   (this.root.querySelector<HTMLElement>(restore)??this.root.querySelector<HTMLElement>('[data-help-open]'))?.focus({preventScroll:true});
  });
  document.body.append(dialog);document.documentElement.classList.add('game-help-open');dialog.showModal();
 }
}
