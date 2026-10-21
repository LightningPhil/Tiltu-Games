import {panelNavigation} from '../../arcade-controls.ts';
export function whackerNavigation(root:HTMLElement){
  const get=(selector:string)=>root.querySelector<HTMLElement>(selector)!;
  const sidebar=get('.sidebar'),host=document.createElement('div');host.id='whack-options';
  const custom=get('#custom-menu') as HTMLDetailsElement;custom.open=true;
  const pace=document.createElement('section');pace.className='panel';
  for(const selector of ['.pace-heading','#difficulty-picker','#pace-note','.tap-settings','#tap-note','.practice-toggle'])pace.append(get(selector));
  panelNavigation(host,'Party options',[
    {name:'Party',elements:[get('#setup-panel')]},
    {name:'Pace',elements:[pace]},
    {name:'Guests',elements:[custom]},
    {name:'Records',elements:[get('.leaderboard')]},
    {name:'Help',elements:[get('.guide')]},
  ]);
  get('.board-section').append(get('#round-panel'),get('#results-panel'));
  sidebar.append(host);
}
