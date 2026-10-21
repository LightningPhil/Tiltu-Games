export function stickVector(x:number,y:number,radius:number,deadZone=.12){
  const distance=Math.hypot(x,y),amount=Math.min(1,distance/Math.max(1,radius));
  if(amount<=deadZone)return {x:0,y:0};
  const strength=(amount-deadZone)/(1-deadZone);
  return {x:x/distance*strength,y:y/distance*strength};
}

/** Captured pointers keep movement independent of a second finger on an action. */
export class VirtualStick {
  x=0;y=0;private pointer:number|null=null;private keys=new Set<string>();
  private element:HTMLElement;private change:()=>void;
  constructor(element:HTMLElement,change:()=>void=()=>{}){
    this.element=element;this.change=change;
    element.addEventListener('pointerdown',event=>{
      if(event.button>0||this.pointer!==null)return;
      event.preventDefault();this.pointer=event.pointerId;element.setPointerCapture(event.pointerId);this.move(event);
    });
    element.addEventListener('pointermove',event=>{if(event.pointerId===this.pointer)this.move(event);});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,event=>{
      if((event as PointerEvent).pointerId===this.pointer)this.reset();
    });
    element.addEventListener('keydown',event=>{
      if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();
      this.keys.add(event.key);this.keyboardMove();
    });
    element.addEventListener('keyup',event=>{if(event.key.startsWith('Arrow')){event.preventDefault();event.stopPropagation();this.keys.delete(event.key);this.keyboardMove();}});
    element.addEventListener('blur',()=>this.reset());
  }
  private move(event:PointerEvent){
    const r=this.element.getBoundingClientRect(),vector=stickVector(event.clientX-r.left-r.width/2,event.clientY-r.top-r.height/2,Math.min(r.width,r.height)*.35);
    this.set(vector.x,vector.y);
  }
  private keyboardMove(){const x=Number(this.keys.has('ArrowRight'))-Number(this.keys.has('ArrowLeft')),y=Number(this.keys.has('ArrowDown'))-Number(this.keys.has('ArrowUp')),length=Math.hypot(x,y)||1;this.set(x/length,y/length);}
  private set(x:number,y:number){
    this.x=x;this.y=y;
    this.element.style.setProperty('--stick-x',`${x*28}px`);this.element.style.setProperty('--stick-y',`${y*28}px`);
    this.element.classList.toggle('held',Boolean(x||y));this.change();
  }
  reset(){const pointer=this.pointer;this.pointer=null;this.keys.clear();if(pointer!==null&&this.element.hasPointerCapture(pointer))this.element.releasePointerCapture(pointer);this.set(0,0);}
}

export function holdControl(button:HTMLButtonElement,change:(held:boolean,cancelled?:boolean)=>void){
  const pointers=new Set<number>();let keyboard=false;
  const update=(cancelled=false)=>{const held=keyboard||pointers.size>0;button.classList.toggle('held',held);button.setAttribute('aria-pressed',String(held));change(held,cancelled);};
  const reset=()=>{const captured=[...pointers];pointers.clear();keyboard=false;for(const id of captured)if(button.hasPointerCapture(id))button.releasePointerCapture(id);update(true);};
  button.addEventListener('pointerdown',event=>{if(button.disabled||event.button>0)return;event.preventDefault();pointers.add(event.pointerId);button.setPointerCapture(event.pointerId);update();});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,event=>{if(pointers.delete((event as PointerEvent).pointerId))update(type!=='pointerup');});
  button.addEventListener('keydown',event=>{if([' ','Enter'].includes(event.key)){event.preventDefault();event.stopPropagation();keyboard=true;update();}});
  button.addEventListener('keyup',event=>{if([' ','Enter'].includes(event.key)){event.preventDefault();event.stopPropagation();keyboard=false;update();}});
  button.addEventListener('blur',reset);
  return {reset};
}

/** Keep navigation visible and put only the selected settings panel in the layout. */
export function panelNavigation(host:HTMLElement,label:string,groups:{name:string;elements:Element[]}[],initial=0,onSelect?:(index:number)=>void){
  const nav=document.createElement('div');nav.className='arcade-panel-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label',label);
  const panels=groups.map((group,index)=>{
    const panel=document.createElement('section');panel.className='arcade-tab-panel';panel.id=`${host.id||label.replace(/\W/g,'')}-panel-${index}`;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-label',group.name);
    for(const element of group.elements)panel.append(element);
    const button=document.createElement('button');button.id=`${panel.id}-tab`;button.type='button';button.textContent=group.name;button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);panel.setAttribute('aria-labelledby',button.id);
    nav.append(button);return {panel,button};
  });
  const select=(index:number)=>{panels.forEach(({panel,button},i)=>{panel.hidden=i!==index;button.setAttribute('aria-selected',String(i===index));button.tabIndex=i===index?0:-1;});onSelect?.(index);};
  panels.forEach(({button},index)=>{
    button.addEventListener('click',()=>select(index));
    button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?panels.length-1:(index+(event.key==='ArrowRight'?1:-1)+panels.length)%panels.length;select(next);panels[next].button.focus();});
  });
  host.append(nav,...panels.map(item=>item.panel));select(initial);
}
