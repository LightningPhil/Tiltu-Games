import {panelNavigation} from './arcade-controls.ts';

export function lifeLayout(root:HTMLElement,selected:number,onSelect:(index:number)=>void){
  const main=root.querySelector<HTMLElement>('.arcade-page')!,arena=main.querySelector<HTMLElement>('.arena')!,layout=main.querySelector('.play-layout')!;
  const settings=main.querySelector('.settings-card')!,help=main.querySelector('.rules-card')!,status=main.querySelector('.status-card')!;
  const patterns=main.querySelector<HTMLDetailsElement>('.life-library'),snapshots=main.querySelector<HTMLDetailsElement>('.life-experiments');
  const stage=arena.querySelector('.life-stage')!,view=document.createElement('div');view.className='life-view';stage.before(view);view.append(stage);
  const groups=[{name:'Play',elements:[arena]},{name:'World',elements:[settings]}];
  if(patterns){patterns.removeAttribute('data-remember');patterns.open=true;groups.push({name:'Patterns',elements:[patterns]});}
  if(snapshots){snapshots.removeAttribute('data-remember');snapshots.open=true;groups.push({name:'Snapshots',elements:[snapshots]});}
  help.setAttribute('open','');groups.push({name:'Help',elements:[help]});
  const host=document.createElement('div');host.id='life-workbench';
  panelNavigation(host,'Life workspace sections',groups,Math.min(selected,groups.length-1),onSelect);
  main.classList.add('life-page');main.append(host,status);layout.remove();
}
