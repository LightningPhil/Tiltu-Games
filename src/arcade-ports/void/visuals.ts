// @ts-nocheck
/** Ported from neon-void; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
// These drawings share the hangar's equipment colours and mounting positions.
export function drawPlayer(ctx: CanvasRenderingContext2D, p: any, time: number, reduced = false) {
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.tilt*.45);
    const dash = p.dashTimer > 0;
    if (p.hitGrace > 0 && !dash) ctx.globalAlpha = reduced ? .7 : .55 + .4*Math.sin(p.hitGrace/45);
    if (p.tempShield > 0) { ctx.strokeStyle='#eafaff'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(0,0,27,0,Math.PI*2); ctx.stroke(); }
    if (p.regenShield > 1) { ctx.strokeStyle=`rgba(104,180,255,${.2+.45*p.regenShield/p.maxRegenShield})`; ctx.lineWidth=1.5; ctx.beginPath(); ctx.ellipse(0,1,23,28,0,0,Math.PI*2); ctx.stroke(); }
    ctx.shadowBlur=dash?22:10; ctx.shadowColor=p.color||'#48e6ff'; ctx.fillStyle='#0a1e2b'; ctx.strokeStyle='#b9efff'; ctx.lineWidth=1.7;
    if(p.megaLevel>0){
        ctx.save();ctx.strokeStyle='#ffb35d';ctx.fillStyle='#3b291e';
        ctx.fillRect(-8,-14,16,36);ctx.strokeRect(-8,-14,16,36);ctx.fillRect(-3,-35,6,25);ctx.strokeRect(-3,-35,6,25);
        ctx.beginPath();ctx.moveTo(-11,8);ctx.lineTo(11,8);ctx.stroke();ctx.restore();
    }
    const wing=p.shipId==='striker'?15:p.shipId==='spectre'?25:20;
    ctx.beginPath(); ctx.moveTo(0,-24); ctx.lineTo(-wing,18); ctx.lineTo(-7,13); ctx.lineTo(0,20); ctx.lineTo(7,13); ctx.lineTo(wing,18); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle=p.color||'#48e6ff'; ctx.beginPath(); ctx.moveTo(0,-14);ctx.lineTo(-5,0);ctx.lineTo(0,7);ctx.lineTo(5,0);ctx.closePath();ctx.fill();
    if (p.spreadCount>1) { ctx.strokeStyle='#f678ff'; ctx.lineWidth=2; ctx.beginPath(); for (const x of [-7,0,7]) {ctx.moveTo(x,-18);ctx.lineTo(x,-28);} ctx.stroke(); }
    if (p.sideGunLevel>0) { ctx.strokeStyle='#ffaa44';ctx.fillStyle='#4d301a';ctx.fillRect(-27,2,11,10);ctx.fillRect(16,2,11,10);ctx.strokeRect(-27,2,11,10);ctx.strokeRect(16,2,11,10);ctx.beginPath();ctx.moveTo(-27,7);ctx.lineTo(-35,7);ctx.moveTo(27,7);ctx.lineTo(35,7);ctx.stroke(); }
    if (p.missileLevel>0) { ctx.fillStyle='#282144';ctx.strokeStyle='#b89aff';ctx.fillRect(-14,0,6,13);ctx.strokeRect(-14,0,6,13);ctx.fillRect(8,0,6,13);ctx.strokeRect(8,0,6,13);ctx.fillStyle='#d9caff';ctx.fillRect(-12,2,2,5);ctx.fillRect(10,2,2,5); }
    if (p.magnetRange>0) {ctx.strokeStyle='#ffe45e';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-4,9);ctx.lineTo(-4,5);ctx.lineTo(4,5);ctx.lineTo(4,9);ctx.stroke();}
    for(const side of [-1,1]){
        if(!(side<0?p.clusterLevel:p.clusterRightLevel))continue;
        ctx.save();ctx.translate(side*34,2);ctx.scale(2/3,2/3);ctx.strokeStyle='#b89aff';ctx.fillStyle='#29203c';
        ctx.fillRect(-6.5,-10.5,13,21);ctx.strokeRect(-6.5,-10.5,13,21);
        ctx.beginPath();ctx.moveTo(side<0?6.5:-6.5,5);ctx.lineTo(side<0?18:-18,5);ctx.stroke();
        for(let i=0;i<3;i++){ctx.fillStyle=i<(side<0?p.clusterAmmo:p.clusterRightAmmo)?'#d8baff':'#413253';ctx.fillRect(-4+i*3,-6.5,2,11);}
        ctx.restore();
    }
    for(const turret of p.turrets||[]){
        if(!p.turretLevels[turret.key])continue;
        ctx.save();ctx.translate(turret.x,turret.y);ctx.rotate(-p.tilt*.45);ctx.strokeStyle=turret.color;ctx.fillStyle='#14392f';ctx.lineWidth=1.2;
        ctx.globalAlpha*=.5;ctx.beginPath();ctx.arc(0,0,8,turret.axis-Math.PI/2,turret.axis+Math.PI/2);ctx.stroke();ctx.globalAlpha*=2;
        ctx.beginPath();ctx.arc(0,0,5.5,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.rotate(turret.angle);ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(2,0);ctx.lineTo(12,0);ctx.stroke();ctx.restore();
    }
    const flame=(dash?35:12)+(reduced?0:Math.sin(time*.04)*3);
    ctx.fillStyle=dash?'#b9efff':'#ffae62';ctx.shadowColor=dash?'#48e6ff':'#ff9860';ctx.beginPath();ctx.moveTo(-5,17);ctx.lineTo(0,17+flame);ctx.lineTo(5,17);ctx.fill();
    ctx.restore();
}

export function drawEnemy(ctx: CanvasRenderingContext2D, e: any, reduced = false) {
    ctx.save();ctx.translate(e.x,e.y);
    if (e.entryDelay>0) {
        ctx.translate(0,e.radius+13);ctx.strokeStyle=e.color;ctx.lineWidth=2;ctx.globalAlpha=reduced ? .8 : .5+.4*Math.sin(e.entryDelay*.02);
        ctx.beginPath();ctx.moveTo(-12,0);ctx.lineTo(0,8);ctx.lineTo(12,0);ctx.stroke();ctx.restore();return;
    }
    const r=e.radius;
    const flash=e.hitFlash>0&&!reduced;
    ctx.shadowBlur=flash?18:8;ctx.shadowColor=flash?'#ffffff':e.color;
    ctx.strokeStyle=flash?'#ffffff':e.color;ctx.lineWidth=e.isBoss?2.5:1.6;ctx.fillStyle=flash?'#ffffff77':`${e.color}20`;
    ctx.beginPath();
    if(e.type==='INVADER'){
        ctx.moveTo(-r,-r*.65);ctx.lineTo(-r*.45,-r*.65);ctx.lineTo(-r*.25,-r);ctx.lineTo(r*.25,-r);ctx.lineTo(r*.45,-r*.65);ctx.lineTo(r,-r*.65);ctx.lineTo(r,r*.45);ctx.lineTo(r*.6,r*.45);ctx.lineTo(r*.6,r*.85);ctx.lineTo(r*.25,r*.85);ctx.lineTo(r*.25,r*.35);ctx.lineTo(-r*.25,r*.35);ctx.lineTo(-r*.25,r*.85);ctx.lineTo(-r*.6,r*.85);ctx.lineTo(-r*.6,r*.45);ctx.lineTo(-r,r*.45);
    } else if (e.type==='BASIC'||e.type==='INTERMEDIATE'||e.type==='INTERCEPTOR') {
        ctx.moveTo(0,r*.8);ctx.lineTo(-r*.8,-r*.55);ctx.lineTo(-r*.25,-r*.15);ctx.lineTo(0,-r*.7);ctx.lineTo(r*.25,-r*.15);ctx.lineTo(r*.8,-r*.55);
    } else if (e.type==='CORVETTE') {ctx.moveTo(0,r);ctx.lineTo(-r*.65,0);ctx.lineTo(-r*.3,-r*.75);ctx.lineTo(r*.3,-r*.75);ctx.lineTo(r*.65,0);}
    else if (e.type==='BOMBER') {ctx.moveTo(-r*.8,-r*.5);ctx.lineTo(-r*.8,r*.4);ctx.lineTo(0,r*.8);ctx.lineTo(r*.8,r*.4);ctx.lineTo(r*.8,-r*.5);ctx.lineTo(0,-r*.8);}
    else if (e.type==='FRIGATE') {ctx.rect(-r*.7,-r*.8,r*.35,r*1.45);ctx.rect(r*.35,-r*.8,r*.35,r*1.45);ctx.moveTo(-r*.35,0);ctx.lineTo(r*.35,0);}
    else if (e.type==='STRAFER') {ctx.moveTo(0,r*.8);ctx.lineTo(-r*.9,0);ctx.lineTo(-r*.9,-r*.6);ctx.lineTo(-r*.3,-r*.3);ctx.lineTo(0,-r*.75);ctx.lineTo(r*.3,-r*.3);ctx.lineTo(r*.9,-r*.6);ctx.lineTo(r*.9,0);}
    else if (e.type==='LANCER') {ctx.moveTo(0,r);ctx.lineTo(-r*.4,-r*.2);ctx.lineTo(-r*.65,-r*.8);ctx.lineTo(0,-r*.4);ctx.lineTo(r*.65,-r*.8);ctx.lineTo(r*.4,-r*.2);}
    else if (e.type==='CARRIER') {ctx.rect(-r*.8,-r*.45,r*1.6,r*.9);ctx.rect(-r*.85,-r*.7,r*.3,r*1.4);ctx.rect(r*.55,-r*.7,r*.3,r*1.4);}
    else if (e.type==='DESTROYER'||e.type==='DREADNOUGHT') {
        for(let i=0;i<8;i++){const a=i*Math.PI/4+Math.PI/8;const x=Math.cos(a)*r*.8,y=Math.sin(a)*r*.8;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}
    } else {ctx.moveTo(0,r*.8);ctx.lineTo(-r*.8,0);ctx.lineTo(-r*.4,-r*.65);ctx.lineTo(r*.4,-r*.65);ctx.lineTo(r*.8,0);}
    ctx.closePath();ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.arc(0,0,r*.22,0,Math.PI*2);ctx.fillStyle=flash?'#fff':e.color;ctx.fill();
    if(e.type==='INVADER'){
        ctx.fillStyle='#e6f5ff';ctx.fillRect(-r*.65,-r*.3,r*.25,r*.16);ctx.fillRect(r*.4,-r*.3,r*.25,r*.16);
        for(let i=0;i<3;i++){ctx.fillStyle=e.hp/e.maxHp>(i/3)?e.color:'#243346';ctx.fillRect(-11+i*9,-r-10,6,3);}
    }
    if(e.type==='DESTROYER'||e.type==='DREADNOUGHT'){ctx.beginPath();for(let i=0;i<4;i++){const a=i*Math.PI/2;ctx.moveTo(Math.cos(a)*r*.35,Math.sin(a)*r*.35);ctx.lineTo(Math.cos(a)*r*.9,Math.sin(a)*r*.9);}ctx.stroke();}
    if(e.hp<e.maxHp&&!e.isBoss){ctx.shadowBlur=0;ctx.fillStyle='#15232f';ctx.fillRect(-r,r+7,r*2,3);ctx.fillStyle=e.color;ctx.fillRect(-r,r+7,r*2*Math.max(0,e.hp/e.maxHp),3);}
    if (e.fireTimer < 450 && e.y>=r) {
        ctx.strokeStyle='#ffd47e';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r+6,0,Math.PI*2);ctx.stroke();
    }
    ctx.restore();
}
