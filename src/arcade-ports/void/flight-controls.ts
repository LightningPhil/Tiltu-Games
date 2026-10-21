// @ts-nocheck
/** Ported from neon-void; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
export type FlightPoint = {x:number;y:number};

/** One steering finger owns the ship; other fingers remain free for abilities. */
export class FlightPointer {
    active=false;id:number|null=null;type='mouse';x=0;y=0;
    private last:FlightPoint={x:0,y:0};
    begin(id:number,type:string,point:FlightPoint,ship:FlightPoint) {
        if(this.active)return false;
        this.active=true;this.id=id;this.type=type;this.last={...point};
        this.x=type==='mouse'?point.x:ship.x;this.y=type==='mouse'?point.y:ship.y;
        return true;
    }
    move(id:number,point:FlightPoint,width:number,height:number,radius=12) {
        if(!this.active||id!==this.id)return false;
        if(this.type==='mouse'){this.x=point.x;this.y=point.y;}
        else {this.x+=point.x-this.last.x;this.y+=point.y-this.last.y;}
        this.last={...point};
        this.x=Math.max(radius,Math.min(width-radius,this.x));
        this.y=Math.max(radius,Math.min(height-radius,this.y));
        return true;
    }
    end(id?:number) {
        if(id!==undefined&&id!==this.id)return;
        this.active=false;this.id=null;
    }
}

export function fitFlightArena(width:number,height:number,bounds:{left:number;right:number;top:number;bottom:number}) {
    const availableWidth=Math.max(80,bounds.right-bounds.left),availableHeight=Math.max(80,bounds.bottom-bounds.top);
    const worldWidth=availableWidth/availableHeight<1.1?600:1200,worldHeight=800;
    const scale=Math.min(availableWidth/worldWidth,availableHeight/worldHeight);
    return {worldWidth,worldHeight,scale,width:worldWidth*scale,height:worldHeight*scale,
        left:bounds.left+(availableWidth-worldWidth*scale)/2,top:bounds.top+(availableHeight-worldHeight*scale)/2};
}

export function compactShop(width:number,height:number) {return width<=700||height<=540;}
