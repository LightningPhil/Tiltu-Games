export interface CardWorkspaceParts {stats:HTMLElement;inputs:HTMLElement;actions:HTMLElement;tools:HTMLElement;help:HTMLElement;setup:HTMLElement;feedback:HTMLElement}

/** Keep the cards and current decision together; move reference material out of play. */
export function prepareCardWorkspace(game:string,main:HTMLElement,arena:HTMLElement,board:HTMLElement,p:CardWorkspaceParts){
 const palette=getComputedStyle(board);for(const key of ['--felt','--felt-text','--back-colour','--card-paper','--card-ink']){const value=palette.getPropertyValue(key).trim();if(value)main.style.setProperty(key,value);}
 const move=(selector:string,target:HTMLElement)=>{for(const el of [...arena.querySelectorAll<HTMLElement>(selector)])if(el!==board)target.append(el);};
 const table=game==='patience',hand=['hearts','spades','whist','gin','cribbage'].includes(game);
 board.classList.add('workspace-card-field');if(table)board.classList.add('workspace-patience-table');
 move('.plus-table-scores,.table-bankroll',p.stats);
 if(game==='cribbage'){
  const pegs=arena.querySelector('.crib-pegboard'),legend=pegs?.querySelector('.pegboard-legend');
  if(legend){const score=legend.cloneNode(true) as HTMLElement;score.classList.add('workspace-crib-score');p.stats.append(score);}
  if(pegs)p.tools.append(pegs);
 }
 if(hand){
  const playerHand=arena.querySelector<HTMLElement>('.plus-card-hand,.crib-your-hand');
  if(playerHand){const heading=playerHand.previousElementSibling;if(heading?.matches('.plus-hand-heading,h3')){heading.classList.add('workspace-hand-heading');p.inputs.append(heading);}playerHand.classList.add('workspace-hand');const count=Math.max(1,playerHand.querySelectorAll('button').length);playerHand.style.setProperty('--hand-count',String(count));playerHand.style.setProperty('--hand-columns',String(Math.min(13,count)));playerHand.style.setProperty('--hand-small-columns',String(Math.min(game==='gin'||game==='cribbage'?6:7,count)));playerHand.setAttribute('role','group');playerHand.setAttribute('aria-label','Your hand');p.inputs.append(playerHand);const note=document.createElement('p');note.className='workspace-hand-note';note.textContent='Swipe sideways to see every card.';note.hidden=true;p.inputs.append(note);}
  const opponents=arena.querySelector('.plus-opponents');if(opponents){if(board.matches('.plus-trick-stage'))board.prepend(opponents);else p.tools.append(opponents);}
 }
 if(game==='blackjack'||game==='poker')move('.blackjack-actions',p.actions);
 if(game==='poker')move('.poker-decision-bar',p.inputs);
 if(table){
  move('.patience-collection-picker',p.setup);
  move('.card-destinations,.card-destination-list',p.feedback);
  const sidebar=main.querySelector('.sidebar');
  for(const el of [...(sidebar?.querySelectorAll<HTMLElement>('#undo,[data-patience="hint"],[data-patience="auto"]')??[])])el.remove(); // Existing on-table versions remain the live controls.
 }
 if(game==='blackjack'){
  const stake=p.stats.querySelector<HTMLSelectElement>('#blackjack-bet-table');if(stake){stake.setAttribute('aria-label','Next stake in practice chips');for(const option of stake.options)option.textContent=option.value;}
  const reset=arena.querySelector('#new-game');if(reset)main.querySelector('.settings-card')?.append(reset);
 }
 move('.tutor-panel,.blackjack-coach,.poker-table-tutor,.poker-showdown,.poker-stages,.gin-hand-legend,.plus-round-summary,.plus-last-trick,.poker-key-guide,.retro-status',p.tools);
 move('.table-action-guide',p.help);
 // Redundant window menus duplicate the shared Setup/Help and play actions.
 for(const el of [...arena.querySelectorAll('.retro-titlebar,.retro-menubar,.shoe-marker')])el.remove();
 return {table,hand};
}
