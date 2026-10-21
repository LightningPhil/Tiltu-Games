import {panelNavigation} from '../../arcade-controls.ts';
export function horizonNavigation(root:HTMLElement){
  const get=(s:string)=>root.querySelector<HTMLElement>(s)!;
  const field=(id:string)=>[get(`label[for="${id}"]`),get(`#${id}`)];
  const check=(id:string)=>get(`#${id}`).closest('label')!;
  const panel=get('#load-screen .menu-panel'),host=document.createElement('div');host.id='horizon-deck';
  const manual=get('.flight-manual') as HTMLDetailsElement;manual.open=true;
  panelNavigation(host,'Flight deck sections',[
    {name:'Fly',elements:[get('.field-row'),get('#cruise-setup'),get('#briefing-title'),get('#mode-description'),get('.route-picker'),get('#launch-note')]},
    {name:'Controls',elements:[...field('controls'),get('#control-summary'),...field('sensitivity'),get('.assist-options'),check('invert-y')]},
    {name:'Look',elements:[...field('visual-style'),...field('quality'),...field('view'),check('reduced-motion')]},
    {name:'Sound',elements:[check('sound'),check('music'),get('#load-screen .soundtrack-settings'),get('#music-volume').closest('label')!,get('#effects-volume').closest('label')!]},
    {name:'Guide',elements:[manual,get('#mission-route')]},
  ]);
  // All inputs remain the same live nodes, with their existing handlers and IDs.
  get('.setup-grid').replaceWith(host);
  const pause=get('#pause-screen .pause-panel'),pauseHost=document.createElement('div');pauseHost.id='horizon-pause';
  const radio=get('.pause-radio') as HTMLDetailsElement,look=get('.pause-presentation') as HTMLDetailsElement;radio.open=look.open=true;
  panelNavigation(pauseHost,'Paused flight sections',[
    {name:'Flight',elements:[get('.pause-settings'),get('#pause-cruise-setup')]},
    {name:'Controls & look',elements:[look]},
    {name:'Sound',elements:[radio]},
  ]);
  pause.insertBefore(pauseHost,get('#resume'));
  const resume=get('#resume');pause.insertBefore(resume,pauseHost);
  const telemetry=document.createElement('button');telemetry.id='hud-detail';telemetry.textContent='HUD';telemetry.setAttribute('aria-label','Show detailed flight instruments');telemetry.setAttribute('aria-pressed','false');
  telemetry.addEventListener('click',()=>{const detailed=root.classList.toggle('detailed-hud');telemetry.setAttribute('aria-pressed',String(detailed));telemetry.setAttribute('aria-label',detailed?'Hide detailed flight instruments':'Show detailed flight instruments');});
  get('.hud-actions').prepend(telemetry);
}
