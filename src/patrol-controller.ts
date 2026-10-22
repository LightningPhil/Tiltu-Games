import {newSalvage,stepSalvage,dockSalvage,upgradeSalvage,nextSector,fireSalvage,pulseSalvage} from './action-games.ts';
import type {SalvageSession,FlightInput} from './action-games.ts';
import type {SavedState} from './state.ts';
import {ArcadeAudio} from './arcade-audio.ts';
import {drawSalvage,readArcadePalette} from './action-renderer.ts';
import type {ArcadePalette} from './action-renderer.ts';
import {boostSalvage,retrySalvage,setPatrolWaypoint,selectPatrolWeapon,selectPatrolChassis,patrolNavigation,maxPatrolShield,patrolObjective,patrolMultiplier,patrolEMPCharge} from './archive-patrol.ts';
import type {PatrolWeapon,PatrolChassis,WaypointKind} from './archive-patrol.ts';
import {patrolMapPoint,transferPatrolScene} from './archive-renderer.ts';
import {renderPatrol} from './patrol-view.ts';
import {patrolKey,patrolFlightInput,patrolKeyIdentity} from './patrol-input.ts';
import './patrol.css';
import {VirtualStick} from './arcade-controls.ts';
/** One animation loop owns drawing. HUD updates never replace the canvas or move the page. */
export class PatrolController {
  private game:'salvage'|null=null;
  private canvas:HTMLCanvasElement|null=null;
  private palette:ArcadePalette|null=null;
  private frame=0;private last=0;private accumulator=0;private hudClock=0;
  private held=new Map<string,string>();private pointers=new Map<number,string>();
  private mouseFire=false;
  private settings=false;private confirmReset=false;
  private settingsTab:'controls'|'options'|'sound'='controls';
  private pointerControls=new Map<number,HTMLElement>();
  private difficulty=2;
  private audio=new ArcadeAudio();private lastShot=0;
  private patrolMissions=false;private stick:VirtualStick|null=null;
  private heard={shots:0,kills:0,scans:0};
  private canvasSession:SalvageSession|null=null;
  private docking:{x:number;y:number;angle:number;clock:number}|null=null;
  constructor(private root:HTMLElement,private state:SavedState,private changed:()=>void,private saveOnly:()=>void=()=>{}) {
    window.addEventListener('keyup',e=>this.held.delete(patrolKeyIdentity(e.code,e.key)));
    window.addEventListener('mouseup',e=>{if(e.button===0)this.mouseFire=false;});
    root.addEventListener('mousedown',e=>this.mouseDown(e));
    window.addEventListener('blur',()=>this.pause());
    window.addEventListener('resize',()=>this.clearInput());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.pause();});
    root.addEventListener('pointerdown',e=>this.pointerDown(e));
    root.addEventListener('contextmenu',e=>{if(this.game==='salvage'&&e.target===this.canvas)e.preventDefault();});
    window.addEventListener('pointerup',e=>this.pointerEnd(e.pointerId));
    window.addEventListener('pointercancel',e=>this.pointerEnd(e.pointerId));
    root.addEventListener('lostpointercapture',e=>this.pointerEnd((e as PointerEvent).pointerId));
    root.addEventListener('input',e=>{
      const target=e.target;if(target instanceof HTMLInputElement&&target.id==='action-volume'){
        this.state.actionArcade.volume=Number(target.value)/100;this.configureAudio();
        const label=this.root.querySelector('#action-volume-label');if(label)label.textContent=`${target.value}%`;
      }
    });
    root.addEventListener('change',e=>{
      const target=e.target;if(target instanceof HTMLInputElement&&target.id==='action-volume')this.changed();
    });
  }
  ensure():void {const store=this.state.actionArcade;store.salvage??=newSalvage();if(!this.game){this.settings=false;this.confirmReset=false;this.patrolMissions=false;this.difficulty=store.salvage.difficulty;}this.game='salvage';this.configureAudio();}
  private configureAudio():void {const s=this.state.actionArcade;this.audio.configure(s.music,s.volume,s.effects);}
  private session():SalvageSession|null {return this.game?this.state.actionArcade[this.game]:null;}
  private running():boolean {const s=this.session();return !!s&&!s.paused&&['playing','clearing','flying'].includes(s.phase);}
  private clearInput():void {this.held.clear();this.pointers.clear();this.mouseFire=false;this.stick?.reset();const captured=[...this.pointerControls];this.pointerControls.clear();for(const [id,control] of captured){control.classList.remove('held');control.setAttribute('aria-pressed','false');if(control.hasPointerCapture(id))control.releasePointerCapture(id);}}
  private pause():void {
    const s=this.session();this.clearInput();this.audio.pause();if(!s||s.paused)return;s.paused=true;this.changed();
  }
  leave():void {const s=this.session();if(s)s.paused=true;if(this.docking&&this.game==='salvage')this.state.actionArcade.salvage!.x=this.state.actionArcade.salvage!.y=900;this.docking=null;this.clearInput();this.audio.pause();cancelAnimationFrame(this.frame);this.frame=0;this.canvas=null;this.canvasSession=null;this.game=null;this.settings=false;this.confirmReset=false;this.patrolMissions=false;}
  mount():void {
    this.clearInput();const pad=this.root.querySelector<HTMLElement>('[data-patrol-stick]');this.stick=pad?new VirtualStick(pad,()=>{},()=>this.running()):null;
    const touch=this.root.querySelector('.patrol-touch-flight'),world=this.root.querySelector('.patrol-world');if(touch&&world)world.after(touch);
    const game='salvage';this.ensure();cancelAnimationFrame(this.frame);const previous=this.canvas;this.canvas=this.root.querySelector<HTMLCanvasElement>('#action-canvas');this.palette=readArcadePalette();
    if(game==='salvage'){const f=this.state.actionArcade.salvage!;if(this.canvasSession===f)transferPatrolScene(previous,this.canvas);this.canvasSession=f;this.heard={shots:f.stats.shots,kills:f.kills,scans:f.mission.beacons.filter(b=>b.scanned).length};}
    this.last=performance.now();this.accumulator=0;this.hudClock=0;this.paint();this.updateHud();
    this.frame=requestAnimationFrame(now=>this.tick(now));
  }
  private paint():void {if(!this.canvas||!this.palette)return;const s=this.state.actionArcade;if(this.game==='salvage'){let display=s.salvage!;if(this.docking){const d=this.docking,t=Math.min(1,d.clock/.7),ease=t*t*(3-2*t),angle=Math.atan2(Math.sin(-Math.PI/2-d.angle),Math.cos(-Math.PI/2-d.angle));display={...display,x:d.x+(900-d.x)*ease,y:d.y+(900-d.y)*ease,angle:d.angle+angle*ease,elapsed:display.elapsed+d.clock};}drawSalvage(this.canvas,display,this.palette,{thrust:display.engineThrottle,tractor:this.pressed('tractor')});}}
  private pressed(...actions:string[]):boolean {return actions.some(action=>[...this.held.values(),...this.pointers.values()].includes(action));}
  private flightInput():FlightInput {
    return patrolFlightInput([...this.held.values(),...this.pointers.values()],this.stick??{x:0,y:0},this.mouseFire,!!this.state.actionArcade.salvage!.arcade?.autoFire);
  }

  private tick(now:number):void {
    if(!this.game)return;const dt=Math.max(0,Math.min(.15,(now-this.last)/1000));this.last=now;
    if(this.docking){this.docking.clock+=dt;if(this.docking.clock>=.7){const f=this.state.actionArcade.salvage!;f.x=f.y=900;f.angle=-Math.PI/2;this.docking=null;this.audio.pause();this.changed();return;}}
    if(this.running()){
      const s=this.session()!,phase=s.phase;
      {
        const f=this.state.actionArcade.salvage!,empCooldown=f.pulseCooldown,collected=f.stats.fragments,caches=f.arcade?.caches.length??0,power=(f.arcade?.overdrive??0)+(f.arcade?.magnet??0),hull=f.hull+f.shield,input=this.flightInput();
        this.accumulator+=dt;while(this.accumulator>=1/60&&this.running()){stepSalvage(f,input,1/60);this.accumulator-=1/60;}
        if(f.pulseCooldown>empCooldown+1)this.audio.effect('pulse');
        if(f.stats.fragments>collected)this.audio.effect('collect');if(f.hull+f.shield<hull-2)this.audio.effect('hit');
        if((f.arcade?.caches.length??0)<caches)this.audio.effect('explosion');
        if((f.arcade?.overdrive??0)+(f.arcade?.magnet??0)>power+1)this.audio.effect('powerup');
        if(f.stats.shots>this.heard.shots&&now-this.lastShot>80){this.audio.effect('shot');this.lastShot=now;}
        if(f.kills>this.heard.kills)this.audio.effect('explosion');const scans=f.mission.beacons.filter(b=>b.scanned).length;if(scans>this.heard.scans)this.audio.effect('scan');
        this.heard={shots:f.stats.shots,kills:f.kills,scans};this.audio.setIntensity(Math.min(1,f.ships.filter(v=>(v.kind==='raider'||v.kind==='carrier')&&Math.hypot(v.x-f.x,v.y-f.y)<560).length/5+(f.hull<35?.25:0)));
      }
      if(s.phase!==phase&&(s.paused||s.phase==='docked')){this.audio.pause();this.clearInput();this.changed();return;}
    }
    this.paint();this.hudClock+=dt;if(this.hudClock>.1){this.updateHud();this.hudClock=0;}
    this.frame=requestAnimationFrame(t=>this.tick(t));
  }
  private updateHud():void {
    const set=(id:string,value:string)=>{const node=this.root.querySelector(`#${id}`);if(node&&node.textContent!==value)node.textContent=value;};
    for(const control of this.root.querySelectorAll<HTMLButtonElement>('.action-touch-controls button,.patrol-touch-flight button'))control.disabled=!this.running();
    if(this.game==='salvage'){
      const f=this.state.actionArcade.salvage!;set('action-score',f.score.toLocaleString());set('action-progress',`${Math.min(f.delivered,f.quota)} / ${f.quota}`);set('action-cargo',f.arcade?`×${patrolMultiplier(f)}`:String(f.cargo));set('action-credits',String(f.credits));
      set('patrol-speed',`${Math.round(Math.hypot(f.vx,f.vy))} m/s`);set('action-emp',`${Math.floor(patrolEMPCharge(f)*100)}%`);
      set('action-hull',`${Math.ceil(f.hull)}%`);set('action-shield',`${Math.ceil(f.shield)}`);set('action-energy',`${Math.floor(f.energy)}%`);
      const nav=patrolNavigation(f),beacon=f.mission.beacons.find(b=>!b.scanned&&Math.hypot(b.x-f.x,b.y-f.y)<125);
      const objective=patrolObjective(f),goal=objective.title;
      set('patrol-goal',goal);set('patrol-target',`${nav.name} · ${Math.round(nav.distance)} m`);
      const safe=!f.arcade&&Math.hypot(f.x-900,f.y-900)<145;set('patrol-zone',f.arcade?objective.wave:safe?'SAFE HARBOUR · WEAPONS STANDBY':`SECTOR ${f.sector} · PRIMARY`);
      const status=f.noticeTime>0?f.notice:f.arcade?objective.detail:beacon?`Survey beacon in range. Hold F or tractor to scan · ${Math.round(beacon.progress*100)}%.`:'Shoot raiders and collect cores.';set('action-notice',status);
      set('patrol-powerups',f.arcade?[f.arcade.overdrive>0?`OVERDRIVE ${Math.ceil(f.arcade.overdrive)}s`:'',f.arcade.magnet>0?`MAGNET ${Math.ceil(f.arcade.magnet)}s`:''].filter(Boolean).join(' · ')||'CORES BANK INSTANTLY · WEAPONS HAVE UNLIMITED AMMO':'');
      if(this.canvas){this.canvas.dataset.wave=String(f.arcade?.wave??1);this.canvas.dataset.shots=String(f.stats.shots);this.canvas.dataset.kills=String(f.sectorKills);this.canvas.dataset.cores=String(f.delivered);}
      const auto=this.root.querySelector('[data-action-arcade="auto-fire"]');if(auto){auto.setAttribute('aria-pressed',String(f.arcade?.autoFire??false));auto.textContent=`Continuous fire ${f.arcade?.autoFire?'on':'off'} · R`;}
      for(const [id,value,max] of [['hull',f.hull,100],['shield',f.shield,maxPatrolShield(f)],['energy',f.energy,100],['emp',patrolEMPCharge(f)*100,100]] as const){const bar=this.root.querySelector<HTMLElement>(`#patrol-${id}-bar`);if(bar){bar.style.width=`${value/max*100}%`;bar.parentElement?.setAttribute('aria-valuenow',String(Math.ceil(value)));bar.closest('.patrol-vital')?.classList.toggle('low',value/max<.25);}}
      for(const weapon of ['blaster','scatter','lance'])this.root.querySelector(`[data-action-arcade="weapon-${weapon}"]`)?.setAttribute('aria-pressed',String(f.weapon===weapon));
      const dock=this.root.querySelector<HTMLButtonElement>('[data-action-arcade="dock"]');if(dock)dock.disabled=!this.running()||f.phase!=='flying'||Math.hypot(f.x-900,f.y-900)>110;
      for(const pulse of this.root.querySelectorAll<HTMLButtonElement>('[data-action-arcade="pulse"]')){pulse.disabled=!this.running()||safe||f.pulseCooldown>0;pulse.classList.toggle('ready',f.pulseCooldown===0);pulse.textContent=f.pulseCooldown>0?`EMP ${Math.ceil(f.pulseCooldown)}s`:pulse.closest('.patrol-touch-actions')?'EMP':'EMP ready · E';pulse.title='Secondary weapon · E or right-click · forward 60° cone · 580 m range · disables raiders for 5s, carriers for 3s · 18s recharge · no energy cost';}
      const fire=this.root.querySelector<HTMLButtonElement>('[data-action-hold="fire"]');if(fire){fire.disabled=!this.running()||safe;fire.title=safe?'Fly beyond the relay shield to engage.':'Hold to fire straight ahead. Steer the ship to aim.';}
      const boost=this.root.querySelector<HTMLButtonElement>('[data-action-arcade="boost"]');if(boost){boost.disabled=!this.running()||f.boostCooldown>0||f.energy<18;boost.textContent=f.boostCooldown>0?`Boost ${Math.ceil(f.boostCooldown)}s`:'Boost · Shift';}
      const boss=f.ships.find(v=>v.kind==='carrier'&&v.hp>0),bossPanel=this.root.querySelector<HTMLElement>('.patrol-boss');if(bossPanel){bossPanel.hidden=!boss||Math.hypot(boss.x-f.x,boss.y-f.y)>950;const bar=this.root.querySelector<HTMLElement>('#patrol-boss-health');if(boss&&bar){bar.style.width=`${boss.hp/(boss.maxHp??boss.hp)*100}%`;set('patrol-boss-phase',boss.hp<(boss.maxHp??boss.hp)*.32?'CORE EXPOSED':boss.hp<(boss.maxHp??boss.hp)*.65?'ARMOUR DAMAGED':'ARMOURED CARRIER');}}
      const zoom=this.root.querySelector('[data-action-arcade="zoom"]');if(zoom)zoom.textContent=`${Math.round(f.zoom*100)}%`;
    }
    set('action-audio-status',this.audio.error||(!this.running()?'Music begins when you play.':this.state.actionArcade.music?'Original generative soundtrack':'Music muted'));
  }
  private async play():Promise<void> {
    const s=this.session();if(this.docking||!s||['over','won','lost','complete'].includes(s.phase))return;
    if(s.phase==='ready')s.phase='flying';if(s.phase==='docked'){s.phase='flying';(s as SalvageSession).invulnerable=2;}
    this.settings=false;this.confirmReset=false;this.patrolMissions=false;s.paused=false;this.clearInput();this.last=performance.now();this.accumulator=0;
    const game=this.game!;this.changed();await this.audio.start(game);if(this.game!==game||!this.running())return;this.updateHud();
    this.canvas?.focus({preventScroll:true});
  }
  action(action:string):void {
    if(!this.game||this.docking)return;const s=this.session()!;
    if(action.startsWith('settings-tab-')){const tab=action.slice(13);if(['controls','options','sound'].includes(tab)){this.settingsTab=tab as typeof this.settingsTab;this.changed();}return;}
    if(action==='play'){void this.play();return;}
    if(action==='pause'){if(this.running())this.pause();else void this.play();return;}
    if(action==='settings'){this.pause();this.settings=!this.settings;this.confirmReset=false;this.changed();return;}
    if(action==='close-settings'){this.settings=false;this.changed();return;}
    if(action==='new'){this.pause();if(s.elapsed>0&&!['over','won','lost','complete'].includes(s.phase)){this.confirmReset=true;this.settings=false;this.changed();}else this.reset();return;}
    if(action==='cancel-new'){this.confirmReset=false;this.changed();return;}
    if(action==='confirm-new'){this.reset();return;}
    if(action==='music'){this.state.actionArcade.music=!this.state.actionArcade.music;this.configureAudio();if(this.running())void this.audio.start(this.game);this.changed();return;}
    if(action==='effects'){this.state.actionArcade.effects=!this.state.actionArcade.effects;this.configureAudio();this.changed();return;}
    const f=this.state.actionArcade.salvage!;
    if(action==='missions'){this.pause();this.settings=false;this.patrolMissions=true;this.changed();return;}
    if(action==='close-missions'){this.patrolMissions=false;this.changed();return;}
    if(action==='retry'&&retrySalvage(f)){this.settings=false;this.patrolMissions=false;this.canvasSession=null;if(f.arcade)void this.play();else this.changed();return;}
    if(action.startsWith('nav-')){setPatrolWaypoint(f,action.slice(4) as WaypointKind);if(this.patrolMissions){this.patrolMissions=false;this.changed();}else{this.updateHud();this.paint();this.saveOnly();}return;}
    if(action.startsWith('weapon-')&&selectPatrolWeapon(f,action.slice(7) as PatrolWeapon)){this.updateHud();this.saveOnly();return;}
    if(action==='auto-fire'&&f.arcade){f.arcade.autoFire=!f.arcade.autoFire;this.updateHud();this.saveOnly();return;}
    if(action.startsWith('chassis-')&&selectPatrolChassis(f,action.slice(8) as PatrolChassis)){this.changed();return;}
    if(action==='toggle-tractor'||action==='toggle-safety'){const key=action==='toggle-tractor'?'autoTractor':'safety';f[key]=!f[key];this.changed();return;}
    if(action==='zoom'){f.zoom=f.zoom<.7?.8:f.zoom<.9?1:f.zoom<1.1?1.2:.65;this.paint();this.updateHud();this.saveOnly();return;}
    if(action==='boost'){if(boostSalvage(f)){this.audio.effect('boost');this.updateHud();}return;}
    if(action==='dock'&&dockSalvage(f)){this.docking={x:f.x,y:f.y,angle:f.angle,clock:0};this.audio.effect('dock');this.clearInput();this.changed();}
    if(action==='pulse'){if(pulseSalvage(f))this.audio.effect('pulse');else if(this.running()&&f.pulseCooldown>0){f.notice=`EMP recharging · ready in ${Math.ceil(f.pulseCooldown)}s. Space / left-click keeps the main gun firing.`;f.noticeTime=2;}this.updateHud();}
    if(action.startsWith('upgrade-')&&upgradeSalvage(f,action.slice(8) as keyof SalvageSession['upgrades']))this.changed();
    if(action==='sector'&&nextSector(f)){this.canvasSession=null;if(f.arcade&&f.phase!=='complete')void this.play();else this.changed();}
  }
  setting(id:string,value:string):void {
    if(id==='action-difficulty')this.difficulty=Math.max(1,Math.min(5,Number(value)||2));
  }
  private reset():void {
    {const old=this.state.actionArcade.salvage!,fresh=newSalvage(this.difficulty,undefined,old.best);for(const key of ['chassis','weapon','autoTractor','safety','zoom'] as const)(fresh as any)[key]=old[key];fresh.shield=maxPatrolShield(fresh);this.state.actionArcade.salvage=fresh;}
    this.settings=false;this.confirmReset=false;this.patrolMissions=false;this.canvasSession=null;this.clearInput();this.audio.pause();this.changed();
  }
  private firePatrol():void {const f=this.state.actionArcade.salvage!;if(!fireSalvage(f)&&!f.arcade&&Math.hypot(f.x-900,f.y-900)<145){f.notice='Weapons standby inside the relay shield. Fly outside the ring to engage.';f.noticeTime=3;this.updateHud();}}
  tapHold(action:string):void {
    if(!this.running())return;
    {const f=this.state.actionArcade.salvage!;if(action==='fire')this.firePatrol();else stepSalvage(f,{...this.flightInput(),turn:action==='left'?-1:action==='right'?1:0,thrust:action==='thrust'?1:0,brake:action==='brake',tractor:action==='tractor'},.04);}
    this.paint();this.updateHud();
  }
  keydown(e:KeyboardEvent):void {
    if(!this.game||e.ctrlKey||e.metaKey||e.altKey)return;
    if((e.target as HTMLElement).closest('input,select,textarea'))return;
    if((e.target as HTMLElement).closest('button')&&['Enter','Space'].includes(e.code))return;
    const action=patrolKey(e.code,e.key);if(!action)return;e.preventDefault();if(e.repeat)return;
    if(action==='escape'){if(this.settings){this.action('close-settings');return;}if(this.patrolMissions){this.action('close-missions');return;}if(this.confirmReset){this.action('cancel-new');return;}if(this.running())this.pause();return;}
    if(action==='pause'){this.action(this.running()?'pause':'play');return;}
    if(!this.running())return;
    this.held.set(patrolKeyIdentity(e.code,e.key),action);
    if(action==='fire')this.firePatrol();
    else if(action==='nav-cycle'){const kinds:WaypointKind[]=['auto','fragments','beacons','courier','hostiles','relay'],current=this.state.actionArcade.salvage!.waypoint.kind;this.action('nav-'+kinds[(kinds.indexOf(current)+1)%kinds.length]);}
    else if(['pulse','boost','dock','nav-relay','auto-fire'].includes(action)||action.startsWith('weapon-'))this.action(action);
  }
  private mouseDown(e:MouseEvent):void {
    if(this.game!=='salvage'||e.target!==this.canvas||!this.running())return;
    if(e.button===2){e.preventDefault();this.action('pulse');return;}
    if(e.button!==0)return;e.preventDefault();this.canvas!.focus({preventScroll:true});const f=this.state.actionArcade.salvage!,point=patrolMapPoint(this.canvas!,f,e.clientX,e.clientY);
    if(point){setPatrolWaypoint(f,'point',point.x,point.y);this.updateHud();this.saveOnly();return;}
    this.mouseFire=true;this.firePatrol();
  }

  private pointerDown(e:PointerEvent):void {
    if(!this.game)return;const target=e.target as HTMLElement;
    if(e.button!==0)return;const hold=target.closest<HTMLButtonElement>('[data-action-hold]');
    if(hold?.disabled)return;
    if(hold&&this.running()){
      e.preventDefault();this.pointers.set(e.pointerId,hold.dataset.actionHold!);this.pointerControls.set(e.pointerId,hold);hold.setPointerCapture(e.pointerId);hold.classList.add('held');hold.setAttribute('aria-pressed','true');
      if(this.game==='salvage'&&hold.dataset.actionHold==='fire')this.firePatrol();
    }else if(target===this.canvas)this.canvas!.focus({preventScroll:true});
  }

  private pointerEnd(id:number):void {const control=this.pointerControls.get(id);this.pointers.delete(id);this.pointerControls.delete(id);if(control&&!Array.from(this.pointerControls.values()).includes(control)){control.classList.remove('held');control.setAttribute('aria-pressed','false');}}
  render():string {this.ensure();return renderPatrol(this.state.actionArcade.salvage!,this.state.actionArcade,{settings:this.settings,settingsTab:this.settingsTab,missions:this.patrolMissions,confirmReset:this.confirmReset,difficulty:this.difficulty,docking:!!this.docking});}
}
