export type InputAction='left'|'right'|'soft'|'cw'|'ccw'|'hard'|'hold';
export const HANDLING={relaxed:[190,65],balanced:[150,40],fast:[100,20]} as const;
/** TetriGrid's input timing, independent of OS repeat and frame rate. */
export class Handling {
  private held=new Map<string,{action:InputAction;elapsed:number;next:number;order:number}>();
  private order=0;
  private apply:(action:InputAction)=>void;
  preset:keyof typeof HANDLING;
  constructor(apply:(action:InputAction)=>void,preset:keyof typeof HANDLING='balanced'){this.apply=apply;this.preset=preset;}
  press(source:string,action:InputAction){
    if(this.held.has(source))return;this.apply(action);
    if(['left','right','soft'].includes(action))this.held.set(source,{action,elapsed:0,next:action==='soft'?35:HANDLING[this.preset][0],order:++this.order});
  }
  release(source:string){this.held.delete(source);}
  clear(){this.held.clear();}
  tick(dt:number){
    const horizontal=[...this.held.values()].filter(v=>v.action!=='soft').sort((a,b)=>b.order-a.order)[0];
    for(const v of this.held.values()){
      v.elapsed+=dt;if(v.action!=='soft'&&v!==horizontal){v.next=v.elapsed;continue;}
      const step=v.action==='soft'?35:HANDLING[this.preset][1];let limit=0;
      while(v.elapsed>=v.next&&limit++<8){v.next+=step;this.apply(v.action);}
    }
  }
}
