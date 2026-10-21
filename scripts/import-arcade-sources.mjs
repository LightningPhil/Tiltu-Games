// One-time source import snapshot. Port adaptations are maintained in src/arcade-ports; rerunning overwrites them.
/** Manual one-time source import. Builds never read or change the standalone apps. */
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
const base='apps/grid-club/src/arcade-ports';
const ports={void:'neon-void',whacker:'whack-a',horizon:'neon-horozon',ballistics:'neon-synth-ballistics'};
const envNames=['document','window','localStorage','requestAnimationFrame','cancelAnimationFrame','setTimeout','clearTimeout','setInterval','clearInterval','AudioContext','ResizeObserver'];
const normalizeImports=s=>s.replace(/(from\s*|import\s*)(['"])(\.[^'"]+)\2/g,(all,prefix,q,file)=>prefix+q+file+(/\.[a-z]+$/i.test(file)?'':'.ts')+q);
const environment=`import {createEnvironment} from '../environment.ts';
import type {PortScope} from '../scope.ts';
let current:PortScope|null=null;
export const bindScope=(scope:PortScope)=>{current=scope;};
const env=createEnvironment(()=>current);
export const {${envNames.join(',')}}=env;
export type AudioContext=globalThis.AudioContext;
export type ResizeObserver=globalThis.ResizeObserver;
`;
function scopedImports(){return "import {"+envNames.join(',')+"} from './environment.ts';\n";}
function selectors(text){let out=[],start=0,depth=0,quote='';for(let i=0;i<text.length;i++){const c=text[i];if(quote){if(c===quote&&text[i-1]!=='\\')quote='';continue;}if(c==='"'||c==="'")quote=c;else if(c==='('||c==='[')depth++;else if(c===')'||c===']')depth--;else if(c===','&&!depth){out.push(text.slice(start,i));start=i+1;}}out.push(text.slice(start));return out;}
function colour(hex,prop,id){
 const raw=hex.slice(1),full=raw.length===3||raw.length===4?[...raw].map(c=>c+c).join(''):raw;
 const rgb=[0,2,4].map(i=>parseInt(full.slice(i,i+2),16)/255),[r,g,b]=rgb,max=Math.max(...rgb),min=Math.min(...rgb),l=(max+min)/2;
 let result='var(--port-surface)';const border=/border|outline|stroke/.test(prop),text=/^color$|fill$|caret/.test(prop);
 if(max-min<.1){result=text?'var(--text)':border?'var(--line)':'var(--port-surface)';}
 else if(max<.4){result=text?'var(--text)':border?'var(--line)':'var(--port-bg)';}
 else if(max-min<.35){result=text?(l>.76?'var(--text)':'var(--muted)'):border?'var(--line)':'var(--port-raised)';}
 else if(g>r*1.18&&b>r*1.15)result='var(--accent)';
 else if(r>g*1.12&&b>g*1.05)result='var(--p2)';
 else if(r>b*1.3&&g>b*1.15)result=id==='whacker'?'var(--accent)':'var(--port-gold)';
 else if(g>r&&g>b)result='var(--port-good)';
 else result=text?'var(--muted)':'var(--port-raised)';
 if(full.length===8){const alpha=parseInt(full.slice(6),16)/255;result=`color-mix(in srgb,${result} ${Math.round(alpha*100)}%,transparent)`;}
 return result;
}
function css(source,id){
 const root=postcss.parse(source),scope=`.arcade-port.${id}-port`,animations=new Map();
 root.walkAtRules(rule=>{if(rule.name==='font-face'||rule.name==='import')rule.remove();else if(/keyframes$/.test(rule.name)){const old=rule.params;animations.set(old,id+'-'+old);rule.params=id+'-'+old;}});
 root.walkRules(rule=>{
   if(rule.parent?.type==='atrule'&&/keyframes$/.test(rule.parent.name))return;
   if(rule.selector.trim()===':root'){rule.remove();return;}
   const wasBody=/^(body|html)(\b|[.:])/.test(rule.selector.trim());
   rule.selector=selectors(rule.selector).map(selector=>{let s=selector.trim().replace(/:root|(?<![\w-])(?:html|body)(?![\w-])/g,scope);return s.startsWith(scope)?s:scope+' '+s;}).join(',');
   rule.walkDecls(decl=>{
     if(decl.prop==='font-family'){decl.remove();return;}
     if(wasBody&&['min-width','min-height','height','width','overflow'].includes(decl.prop)){decl.remove();return;}
     if(decl.prop==='position'&&decl.value==='fixed')decl.value='absolute';
     if(/:hover/.test(rule.selector)&&decl.prop==='transform'){decl.remove();return;}
   });
 });
 root.walkDecls(decl=>{
   decl.value=decl.value.replace(/([\d.]+)(?:d|s|l)?vh\b/g,'$1cqh').replace(/([\d.]+)vw\b/g,'$1cqw');
   if(decl.prop.startsWith('animation'))for(const[old,name]of animations)decl.value=decl.value.replace(new RegExp(`\\b${old}\\b`,'g'),name);
   const art=id==='whacker'&&/garden|animal|well-|turf|scenery|decor|mallet|impact/.test(decl.parent.selector??'');
   if(!art&&!decl.prop.startsWith('--')&&!/^cursor$/.test(decl.prop))decl.value=decl.value.replace(/#[a-f\d]{8}\b|#[a-f\d]{6}\b|#[a-f\d]{4}\b|#[a-f\d]{3}\b/gi,hex=>colour(hex,decl.prop,id));
 });
 return `/* Collection-scoped presentation, adapted from ${ports[id]}. */\n`+root.toString();
}
for(const[id,folder]of Object.entries(ports)){
 const from='apps/'+folder,dir=base+'/'+id;fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(dir+'/environment.ts',environment);
 for(const entry of fs.readdirSync(from+'/src',{withFileTypes:true})){
   if(!entry.isFile()||['main.ts','style.css','presentation.css','vendor.d.ts'].includes(entry.name))continue;
   if(!entry.name.endsWith('.ts')){fs.copyFileSync(from+'/src/'+entry.name,dir+'/'+entry.name);continue;}
   let source=normalizeImports(fs.readFileSync(from+'/src/'+entry.name,'utf8'));
   const imports=scopedImports(source);if(!imports.includes('{}'))source=imports+source;
   fs.writeFileSync(dir+'/'+entry.name,(id==='void'?'// @ts-nocheck\n':'')+`/** Ported from ${folder}; the standalone source remains independent. */\n`+source);
 }
 let html=fs.readFileSync(from+'/index.html','utf8').match(/<body[^>]*>([\s\S]*?)<\/body>/i)[1].replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<template id="third-party-notices">[\s\S]*?<\/template>/i,'');
 const inline=[];html=html.replace(/\son(click|change|input|cancel|submit)="([^"]*)"/g,(_,event,code)=>{const key='inline-'+inline.length;inline.push({key,event,code});return ` data-${key}=""`;});
 if(id==='whacker')html=html.replace('id="app"','id="whack-root"');
 fs.writeFileSync(dir+'/view.ts',`/** The game's panels are native children of the collection screen. */\nexport const view=${JSON.stringify(html)};\n`);
 let imports=[];let source=fs.readFileSync(from+'/src/main.ts','utf8').replaceAll('\r\n','\n');
 source=source.replace(/^import[\s\S]*?;\s*/gm,text=>{if(!/\.css['"]/.test(text))imports.push(text.trim());return '';}).replace(/^export\s*\{[^}]*\};?\s*$/gm,'');
 source=normalizeImports(source);
 source=source.replace(/(?<![.\w])innerWidth\b/g,'window.innerWidth').replace(/(?<![.\w])innerHeight\b/g,'window.innerHeight');
 if(id==='whacker')source=source.replaceAll('el("app")','el("whack-root")');
 if(id==='void')source=source.replace("const hud=document.querySelector('.flight-hud')?.getBoundingClientRect(),footer=document.querySelector('.flight-bottom')?.getBoundingClientRect();","const hud=scope.rect(document.querySelector('.flight-hud')),footer=scope.rect(document.querySelector('.flight-bottom')); ");
 const bindings=inline.map(({key,event,code})=>{
   // Inline actions become ordinary, statically compiled listeners. No eval or global handlers.
   const compiled=code.replace(/(?<![.\w])([a-zA-Z_$][\w$]*)\s*\(/g,(all,name)=>['if','switch','for'].includes(name)?all:`window.${name}(`);
   return `for(const node of scope.root.querySelectorAll('[data-${key}]'))node.addEventListener('${event}',function(event){${compiled}});`;
 }).join('\n');
 const hooks={
 void:`{pause:()=>{Game.pauseForFocus();Game.clearKeys();AudioEngine.stopMusic();AudioEngine.victorySound?.stop();},running:()=>Game.active&&!Game.paused,resize:()=>Game.resize(),resetClock:()=>{Game.lastTime=performance.now();Game.accumulator=0;}}`,
 whacker:`{pause:()=>{pauseRound();audio.stop();},running:()=>game.phase==='playing',resetClock:()=>{lastFrame=performance.now();}}`,
 horizon:`{pause:()=>{pauseGame();controls?.release();musicPreview=false;applyAudio();},running:()=>state==='playing',resize:()=>{if(!presentation)return;camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();presentation.resize(window.innerWidth,window.innerHeight,settings.quality);needsRender=true;},resetClock:()=>{lastFrame=performance.now();},dispose:()=>renderer?.dispose()}`,
 ballistics:`{pause:()=>pauseOnLeave(),running:()=>started&&!paused&&!inMenu&&!awaitingReady&&battle.phase!=='over',resize:()=>resize(),resetClock:()=>{lastFrame=0;accumulator=0;}}`,
 }[id];
 fs.writeFileSync(dir+'/controller.ts',(id==='void'?'// @ts-nocheck\n':'')+`/** Full gameplay port from ${folder}, hosted by Tiltu's Games. */\nimport type {PortScope,PortHooks} from '../scope.ts';\nimport {bindScope} from './environment.ts';\n`+scopedImports(source)+normalizeImports(imports.join('\n'))+`\nexport function createGame(scope:PortScope):PortHooks {\nbindScope(scope);\n// BEGIN GAME RUNTIME\n`+source+`\n// END GAME RUNTIME\n${bindings}\nreturn ${hooks};\n}\n`);
 const style=['style.css','presentation.css'].filter(name=>fs.existsSync(from+'/src/'+name)).map(name=>fs.readFileSync(from+'/src/'+name,'utf8')).join('\n');fs.writeFileSync(dir+'/style.css',css(style,id));
}
console.log('Four full source ports generated. Originals read only.');
