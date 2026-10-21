import {panelNavigation} from '../../arcade-controls.ts';
export function ballisticsNavigation(root:HTMLElement){
  const get=(s:string)=>root.querySelector<HTMLElement>(s)!;
  const host=document.createElement('div');host.id='ballistics-workshop';
  const squads=get('#squad-options') as HTMLDetailsElement;squads.open=true;
  panelNavigation(host,'Workshop sections',[
    {name:'Battle',elements:[get('.match-options'),get('.quick-brief')]},
    {name:'Map',elements:[get('.map-generator')]},
    {name:'Squads',elements:[squads]},
  ]);
  get('.briefing-grid').replaceWith(host);
  const settings=get('.settings-layout'),sections=[...settings.children];
  panelNavigation(settings,'Operation settings',[
    {name:'Controls',elements:[sections[0]]},
    {name:'Sound & view',elements:[sections[1]]},
  ]);
}
