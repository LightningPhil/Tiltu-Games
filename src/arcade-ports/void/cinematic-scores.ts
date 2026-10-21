// @ts-nocheck
/** Ported from neon-void; the standalone source remains independent. */
import {document,window,localStorage,requestAnimationFrame,cancelAnimationFrame,setTimeout,clearTimeout,setInterval,clearInterval,AudioContext,ResizeObserver} from './environment.ts';
import type {MusicNote} from './music.ts';

// Original themes and arrangements. The references inform atmosphere and
// instrumentation; neither score quotes a recording or uses sampled audio.
export function cinematicStep(absoluteStep:number):MusicNote[] {
    const step=absoluteStep%(96*16),bar=Math.floor(step/16),beat=step%16,seconds=60/92/4,events:MusicNote[]=[];
    const chords=[[38,3],[34,4],[43,3],[36,4],[38,3],[41,4],[34,4],[45,4]];
    const [root,third]=chords[Math.floor(bar/4)%8];
    const rise=bar<16?.28:bar<40?.48:bar<64?.7:bar<80?1:bar<88?.55:.25;
    const add=(instrument:MusicNote['instrument'],midi:number,duration:number,velocity:number,pan=0)=>events.push({instrument,midi,duration,velocity,pan});
    const tones=[0,third,7,12];
    if(beat===0&&bar%2===0){
        add('bass',root,seconds*28,.28+rise*.25);
        tones.slice(0,3).forEach((interval,i)=>add(bar<16?'pad':'strings',root+12+interval,seconds*30,rise*.7,(i-1)*.45));
        if(bar>=40&&bar<80)add('strings',root+24+7,seconds*30,rise*.4,.3);
    }
    const ostinato=[0,7,12,7,third,7,14,7];
    if(bar<16||bar>=88){
        if(beat===0||beat===8)add('piano',root+24+(beat===0?third:7),seconds*7,.5,-.15);
        if(beat===12&&bar%4===3)add('piano',root+36,seconds*4,.3,.3);
    }else if(beat%2===0){
        add('piano',root+24+ostinato[beat/2],seconds*(bar<40?2.6:1.8),.4+rise*.25,beat%4?-.24:.24);
    }
    if(bar>=24&&bar<88&&beat%4===2)add('arp',root+24+tones[(beat/4|0)%4],seconds*2.4,.2+rise*.15,beat%8<4?-.4:.4);
    if(bar>=40&&bar<80){
        if([0,8].includes(beat))add('taiko',root,seconds*2,.5+rise*.3);
        if(bar>=64&&[6,14].includes(beat))add('taiko',root+7,seconds*1.6,.45,.2);
        if(bar>=64&&beat%4===2)add('hat',0,.1,.18,beat%8===2?-.4:.4);
        if(bar%8===0&&beat===0)add('crash',0,1.15,.35);
    }
    const theme=[12,-1,19,-1,17,14,-1,12,10,-1,7,-1,14,-1,12,-1];
    if(bar>=48&&bar<80&&bar%2===0&&theme[beat]>=0){
        const interval=theme[beat]+(third===4&&theme[beat]===10?1:0);
        add(bar>=64?'horn':'strings',root+(bar>=64?12:24)+interval,seconds*3.2,.5+rise*.2,0);
    }
    return events;
}

export function tranceStep(absoluteStep:number):MusicNote[] {
    const step=absoluteStep%(96*16),bar=Math.floor(step/16),beat=step%16,seconds=60/138/4,events:MusicNote[]=[];
    const [root,third]=[[47,3],[43,4],[40,3],[45,4]][Math.floor(bar/2)%4];
    const breakdown=bar>=32&&bar<48,outro=bar>=88,drop=bar>=48&&bar<80,full=bar>=16&&bar<32||drop;
    const add=(instrument:MusicNote['instrument'],midi:number,duration:number,velocity:number,pan=0)=>events.push({instrument,midi,duration,velocity,pan});
    if(beat===0&&bar%2===0)[0,third,7,14].forEach((interval,i)=>add('pad',root+12+interval,seconds*30,breakdown?.8:.5,(i-1.5)*.3));
    if(!breakdown&&!outro){
        if(beat%4===0)add('kick',0,.26,.92);
        if(beat%4===2)add('bass',root,seconds*.85,.9);
        if(drop&&beat%4===3)add('bass',root+12,seconds*.7,.45);
        if([4,12].includes(beat)&&bar>=8)add('clap',0,.18,.68);
        if(beat%2===0&&bar>=4)add('hat',0,.055,beat%4===0?.22:.42,beat%4===0?-.2:.2);
        if(beat%4===2&&bar>=8)add('openHat',0,.18,.28,.25);
    }
    const arp=[0,12,7,14,third,12,19,7];
    if(bar>=8&&beat%2===0&&!outro)add('arp',root+24+arp[beat/2],seconds*1.3,breakdown?.24:.42,beat%4===0?-.4:.4);
    const phrase=bar>=64?[19,-1,-1,14,-1,-1,12,-1,17,-1,-1,14,-1,-1,10,-1]:
        [12,-1,-1,14,-1,-1,19,-1,17,-1,-1,14,-1,-1,7,-1];
    if((full||breakdown&&bar>=36)&&phrase[beat]>=0){
        const note=root+12+phrase[beat]+(third===4&&phrase[beat]===10?1:0);
        add(breakdown?'piano':'trance',note,seconds*(breakdown?4:2.5),drop?.76:.62);
    }
    if(breakdown&&bar>=46&&beat%(bar===47?1:2)===0)add('snare',0,.08,.16+(bar-46)*.12+beat*.008,beat%2?-.2:.2);
    if(drop&&bar%8===0&&beat===0)add('crash',0,1.1,.35);
    if(full&&bar%4===3&&beat>=14)add('snare',0,.1,.3+beat*.008);
    if(outro&&beat===0)add('piano',root+24+third,seconds*8,.4,.2);
    return events;
}
