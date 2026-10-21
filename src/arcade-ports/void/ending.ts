// @ts-nocheck
/** Ported from neon-void; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
export const END_SEQUENCE = { victory:2600, defeat:2000, reduced:1600, celebrationAt:850 };

// An elapsed-time effect keeps the last explosion alive after combat stops.
export class ShipExplosion {
    elapsed=0;
    x:number;y:number;color:string;scale:number;reduced:boolean;
    fragments:{angle:number;speed:number;size:number;spin:number;color:string;panel:boolean}[];
    constructor(x:number,y:number,color:string,scale=1,reduced=false){
        this.x=x;this.y=y;this.color=color;this.scale=scale;this.reduced=reduced;
        this.fragments=Array.from({length:reduced?8:36},(_,i)=>({angle:i/36*Math.PI*2+i*.71,speed:55+(i*47%155),size:i<10?6+i%5:1.5+i%3,spin:(i%2?1:-1)*(1+i%4),color:i<10?color:i%3===0?'#fff3ca':i%3===1?'#ffbd64':'#ff795c',panel:i<10}));
    }
    update(dt:number){this.elapsed+=dt;}
    draw(ctx:CanvasRenderingContext2D){
        const t=this.elapsed/1000,fade=Math.max(0,1-t/1.85);if(!fade)return;
        ctx.save();ctx.translate(this.x,this.y);ctx.scale(this.scale,this.scale);
        const glow=ctx.createRadialGradient(0,0,0,0,0,this.reduced?60:100+35*t);
        glow.addColorStop(0,`rgba(255,232,169,${Math.max(0,.65-t*.75)})`);glow.addColorStop(.3,`rgba(255,135,67,${Math.max(0,.32-t*.35)})`);glow.addColorStop(1,'rgba(255,110,40,0)');
        ctx.fillStyle=glow;ctx.fillRect(-180,-180,360,360);
        if(!this.reduced)for(const delay of [0,.16,.38]){
            const age=t-delay;if(age<0||age>1.2)continue;
            ctx.globalAlpha=(1-age/1.2)*.75;ctx.strokeStyle=delay===0?'#fff1c4':this.color;ctx.lineWidth=3*(1-age/1.2)+.5;
            ctx.beginPath();ctx.arc(0,0,12+135*(1-Math.exp(-age*2.4)),0,Math.PI*2);ctx.stroke();
        }
        for(const piece of this.fragments){
            const travel=this.reduced?5*t:piece.speed*(1-Math.exp(-t*1.6))/1.6;
            const x=Math.cos(piece.angle)*travel,y=Math.sin(piece.angle)*travel+(this.reduced?0:20*t*t);
            ctx.save();ctx.translate(x,y);ctx.rotate(this.reduced?piece.angle:piece.angle+piece.spin*t);
            ctx.globalAlpha=fade*(piece.panel?.9:Math.max(0,1-t/1.35));ctx.fillStyle=piece.color;
            if(piece.panel){
                ctx.strokeStyle='#e8f7ff';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-piece.size,-piece.size*.45);ctx.lineTo(piece.size,-piece.size*.6);ctx.lineTo(piece.size*.2,piece.size);ctx.closePath();ctx.fill();ctx.stroke();
            }else {ctx.shadowBlur=6;ctx.shadowColor=piece.color;ctx.fillRect(-piece.size,-piece.size/2,piece.size*(2+t),piece.size);}
            ctx.restore();
        }
        ctx.globalAlpha=Math.max(0,1-t/.55);ctx.fillStyle='#fff6d4';ctx.beginPath();ctx.arc(0,0,Math.max(0,14-t*17),0,Math.PI*2);ctx.fill();ctx.restore();
    }
}
