import {panelNavigation} from '../../arcade-controls.ts';

export function voidNavigation(root:HTMLElement){
  const get=(selector:string)=>root.querySelector<HTMLElement>(selector)!;
  const shell=get('.title-shell'),layout=get('.title-layout');
  const heading=document.createElement('div');heading.className='void-hangar-heading';
  heading.append(get('.hangar-title'),get('.title-intro'),get('.port-launch-actions'));
  const host=document.createElement('div');host.id='void-hangar-panels';
  const shipHeading=get('#ship-picker').previousElementSibling!;
  const practice=get('#practice-panel') as HTMLDetailsElement;practice.open=true;
  const career=get('.career-panel') as HTMLDetailsElement;career.open=true;
  const help=get('.controls-details') as HTMLDetailsElement;help.open=true;
  panelNavigation(host,'Hangar sections',[
    {name:'Fly',elements:[get('.difficulty-picker'),get('#difficulty-note'),shipHeading,get('#ship-picker'),get('#checkpoint-note')]},
    {name:'Practice',elements:[practice]},
    {name:'Career',elements:[get('.record-strip'),career]},
    {name:'Controls',elements:[help,get('.briefing-card')]},
  ]);
  layout.replaceWith(heading,host);
  const settings=get('.pause-settings');
  panelNavigation(settings,'Pause sections',[
    {name:'Flight',elements:[get('.flight-settings')]},
    {name:'Sound',elements:[get('.soundtrack-settings')]},
  ]);
}
